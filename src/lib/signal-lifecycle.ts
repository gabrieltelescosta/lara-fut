import { prisma } from "@/lib/prisma";
import {
  homeTeamWalkForwardMarketPct,
  parseSignalRankMarket,
  signalBestHomeTeamOnly,
  signalMinEvaluatedGamesForRank,
} from "@/lib/home-team-assertiveness";
import { parseMatchName } from "@/lib/match-name";
import { getEnabledSignalMarkets } from "@/lib/signal-market-catalog";
import type { ImplementedMarketId } from "@/lib/signal-market-catalog";
import {
  buildSimpleSignalMessage,
  computePicksFromHistory,
  countActivePicks,
  gradePicks,
  SIGNAL_ROUNDS,
  subsetPicks,
  type StoredPicksJson,
} from "@/lib/signal-picks";
import { getTelegramSignalMarkets } from "@/lib/telegram";
import {
  notifyTelegramSignalCreated,
  notifyTelegramSignalResolved,
} from "@/lib/telegram-gale";
import { filterByTeam, type FinishedMatch } from "@/lib/team-stats";
import {
  getSignalLookaheadMs,
  getSignalMinLeadMs,
} from "@/lib/signal-timing";
import { groupLatestOddsByEventId } from "@/lib/odds-snapshot-utils";
import { pickOddByMarket, type OddsLineLite } from "@/lib/signal-odds";

/**
 * Janela legada (minutos). Preferir `getSignalLookaheadMs()` / `SIGNAL_LOOKAHEAD_MINUTES`.
 * Mantido para imports antigos.
 */
export const SIGNAL_WINDOW_MS = 15 * 60 * 1000;

/**
 * Remove sinais ainda pendentes cujo jogo está além do horizonte de busca.
 */
export async function pruneDistantPendingSignals(): Promise<{ pruned: number }> {
  const now = new Date();
  const maxKickoff = new Date(now.getTime() + getSignalLookaheadMs());
  const r = await prisma.signalPrediction.deleteMany({
    where: {
      resolvedAt: null,
      matchDate: { gt: maxKickoff },
    },
  });
  return { pruned: r.count };
}

/** Mantém no máximo 1 linha pendente (modo melhor mandante). Remove duplicatas antigas. */
async function enforceSinglePendingSignalIfBestHome(): Promise<void> {
  if (!signalBestHomeTeamOnly()) return;
  const pending = await prisma.signalPrediction.findMany({
    where: { resolvedAt: null },
    orderBy: { matchDate: "asc" },
    select: { id: true },
  });
  if (pending.length <= 1) return;
  const [, ...rest] = pending;
  await prisma.signalPrediction.deleteMany({
    where: { id: { in: rest.map((p) => p.id) } },
  });
  console.warn(
    `[signal] SIGNAL_BEST_HOME_TEAM_ONLY: removidos ${rest.length} sinal(is) pendente(s) extra — mantido kickoff mais cedo.`,
  );
}

/** Carrega histórico para tendências. */
async function loadFinishedMatches(): Promise<FinishedMatch[]> {
  const results = await prisma.result.findMany({
    include: { event: true },
    orderBy: { finishedAt: "desc" },
    take: 3000,
  });
  return results.map((r) => ({
    matchName: r.event.matchName,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    finishedAt: r.finishedAt,
  }));
}

/**
 * Cria sinais para jogos na janela (sem duplicar por eventId).
 * Com `SIGNAL_BEST_HOME_TEAM_ONLY`, no máximo 1 sinal **ativo** (pendente): enquanto existir
 * `SignalPrediction` sem `resolvedAt`, não cria outro — evita vários Telegrams numa mesma janela (cron a cada minuto).
 * Usa `SIGNAL_ROUNDS` fixo (15 jogos mandante); não lê ainda vencedor dinâmico do simulador.
 */
export async function generateUpcomingSignals(): Promise<{
  created: number;
  skipped: number;
}> {
  await enforceSinglePendingSignalIfBestHome();

  const matches = await loadFinishedMatches();
  const now = new Date();
  const minKickoff = new Date(now.getTime() + getSignalMinLeadMs());
  const windowEnd = new Date(now.getTime() + getSignalLookaheadMs());

  /** Próximo jogo com folga p/ apostar (ex.: 17:50 → só entradas ≥17:55, não 17:52). */
  const upcoming = await prisma.event.findMany({
    where: {
      result: null,
      matchDate: { gte: minKickoff, lte: windowEnd },
    },
    orderBy: { matchDate: "asc" },
    take: 24,
  });

  const upcomingIds = upcoming.map((e) => e.id);
  const oddsForUpcoming =
    upcomingIds.length === 0
      ? []
      : await prisma.oddsSnapshot.findMany({
          where: { eventId: { in: upcomingIds } },
        });
  const latestOddsByEvent = groupLatestOddsByEventId(oddsForUpcoming);

  /** Com melhor-mandante, só um sinal ativo por vez: o cron roda várias vezes na janela e antes gerava um jogo novo por execução. */
  if (signalBestHomeTeamOnly()) {
    const pending = await prisma.signalPrediction.findFirst({
      where: { resolvedAt: null },
      select: { id: true },
    });
    if (pending) {
      return { created: 0, skipped: upcoming.length };
    }
  }

  let bestEventId: number | null = null;
  let rankMeta: {
    market: ImplementedMarketId;
    pct: number;
    evaluated: number;
  } | null = null;

  if (signalBestHomeTeamOnly()) {
    const rankMarket = parseSignalRankMarket();
    const minEval = signalMinEvaluatedGamesForRank();
    const candidates: Array<{
      ev: (typeof upcoming)[number];
      pct: number;
      evaluated: number;
    }> = [];

    for (const ev of upcoming) {
      const exists = await prisma.signalPrediction.findUnique({
        where: { superbetEventId: ev.superbetEventId },
      });
      if (exists) continue;

      const p = parseMatchName(ev.matchName);
      if (!p) continue;

      const { pct, evaluated } = homeTeamWalkForwardMarketPct(
        p.home,
        rankMarket,
        matches,
        SIGNAL_ROUNDS,
      );
      if (evaluated < minEval) continue;

      candidates.push({ ev, pct, evaluated });
    }

    if (candidates.length > 0) {
      candidates.sort(
        (a, b) =>
          b.pct - a.pct ||
          a.ev.matchDate.getTime() - b.ev.matchDate.getTime(),
      );
      const top = candidates[0];
      bestEventId = top.ev.superbetEventId;
      rankMeta = {
        market: rankMarket,
        pct: top.pct,
        evaluated: top.evaluated,
      };
    }
  }

  let created = 0;
  let skipped = 0;

  for (const ev of upcoming) {
    const exists = await prisma.signalPrediction.findUnique({
      where: { superbetEventId: ev.superbetEventId },
    });
    if (exists) {
      skipped += 1;
      continue;
    }

    if (signalBestHomeTeamOnly()) {
      if (bestEventId === null) {
        skipped += 1;
        continue;
      }
      if (ev.superbetEventId !== bestEventId) {
        skipped += 1;
        continue;
      }
    }

    const p = parseMatchName(ev.matchName);
    if (!p) {
      skipped += 1;
      continue;
    }

    const fullPicks = computePicksFromHistory(p.home, p.away, matches);
    if (!fullPicks) {
      skipped += 1;
      continue;
    }

    const enabled = getEnabledSignalMarkets();
    const picks: StoredPicksJson = subsetPicks(fullPicks, enabled);
    if (countActivePicks(picks) === 0) {
      skipped += 1;
      continue;
    }

    const roundsUsed = Math.min(
      SIGNAL_ROUNDS,
      filterByTeam(p.home, matches).length,
    );

    const rankLine =
      signalBestHomeTeamOnly() && rankMeta
        ? `\n📊 Ranking mandante (${rankMeta.market}): ${rankMeta.pct}% em ${rankMeta.evaluated} jogos simulados`
        : "";

    const latestOdds = latestOddsByEvent.get(ev.id) ?? [];
    const oddsLite: OddsLineLite[] = latestOdds.map((o) => ({
      marketName: o.marketName,
      outcomeName: o.outcomeName,
      price: o.price,
      info: o.info,
    }));
    const oddTeamOu = pickOddByMarket({
      marketId: "teamOu",
      picks,
      homeTeam: p.home,
      odds: oddsLite,
    });
    const oddLine =
      picks.teamOu && oddTeamOu != null
        ? `\n💸 Odd no sinal (Total de Gols da Equipe): @ ${oddTeamOu.toFixed(2)}`
        : "";
    const message =
      buildSimpleSignalMessage(
        p.home,
        p.away,
        ev.matchDate,
        picks,
        roundsUsed,
      ) +
      oddLine +
      rankLine;

    const oddsAtSignalJson =
      latestOdds.length > 0
        ? JSON.stringify(
            latestOdds.map((o) => ({
              marketName: o.marketName,
              outcomeName: o.outcomeName,
              price: o.price,
              info: o.info,
              capturedAt: o.capturedAt.toISOString(),
            })),
          )
        : null;

    await prisma.signalPrediction.create({
      data: {
        superbetEventId: ev.superbetEventId,
        matchName: ev.matchName,
        matchDate: ev.matchDate,
        homeTeam: p.home,
        awayTeam: p.away,
        focusTeam: p.home,
        message,
        picksJson: JSON.stringify(picks),
        oddsAtSignalJson,
      },
    });
    created += 1;

    try {
      const tgPicks = subsetPicks(fullPicks, await getTelegramSignalMarkets());
      await notifyTelegramSignalCreated({
        homeTeam: p.home,
        awayTeam: p.away,
        matchDate: ev.matchDate,
        tgPicks,
        roundsUsed,
        oddsByMarket: { teamOu: oddTeamOu },
        rankLine:
          signalBestHomeTeamOnly() && rankMeta
            ? `📊 Ranking mandante (${rankMeta.market}): ${rankMeta.pct}% em ${rankMeta.evaluated} jogos simulados`
            : undefined,
      });
    } catch (e) {
      console.warn("[telegram] notify create:", e);
    }
  }

  return { created, skipped };
}

/** Resolve acertos quando já existe placar final. */
export async function resolveSignalPredictions(): Promise<{ resolved: number }> {
  await enforceSinglePendingSignalIfBestHome();

  const pending = await prisma.signalPrediction.findMany({
    where: { resolvedAt: null },
  });

  let resolved = 0;
  for (const s of pending) {
    const ev = await prisma.event.findUnique({
      where: { superbetEventId: s.superbetEventId },
      include: { result: true },
    });
    if (!ev?.result) continue;

    const hs = ev.result.homeScore;
    const as = ev.result.awayScore;
    let picks: StoredPicksJson;
    try {
      picks = JSON.parse(s.picksJson) as StoredPicksJson;
    } catch {
      continue;
    }

    const g = gradePicks(picks, hs, as);

    await prisma.signalPrediction.update({
      where: { id: s.id },
      data: {
        resolvedAt: new Date(),
        homeScore: hs,
        awayScore: as,
        hitOneX2: g.byMarket.oneX2 ?? null,
        hitBtts: g.byMarket.btts ?? null,
        hitTeamOu: g.byMarket.teamOu ?? null,
        hitsTotal: g.hitsTotal,
        gradesJson: JSON.stringify(g.byMarket),
      },
    });
    resolved += 1;

    try {
      await notifyTelegramSignalResolved({
        matchName: s.matchName,
        homeScore: hs,
        awayScore: as,
        picks,
        grade: g,
      });
    } catch (e) {
      console.warn("[telegram] notify resolve:", e);
    }
  }

  return { resolved };
}
