import { parseMatchName } from "@/lib/match-name";
import {
  IMPLEMENTED_MARKET_IDS,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import {
  computePicksFromHistory,
  gradePicks,
  SIGNAL_ROUNDS,
  subsetPicks,
  type StoredPicksJson,
} from "@/lib/signal-picks";
import type { FinishedMatch } from "@/lib/team-stats";

/**
 * Walk-forward só em jogos em que `homeTeam` é mandante: % de acertos do mercado
 * com a mesma heurística que o sinal (últimos N jogos do mandante).
 */
export function homeTeamWalkForwardMarketPct(
  homeTeam: string,
  market: ImplementedMarketId,
  allMatches: FinishedMatch[],
  maxRounds: number = SIGNAL_ROUNDS,
): { hits: number; evaluated: number; pct: number } {
  const sorted = [...allMatches].sort(
    (a, b) => a.finishedAt.getTime() - b.finishedAt.getTime(),
  );
  const history: FinishedMatch[] = [];
  let hits = 0;
  let evaluated = 0;

  for (const r of sorted) {
    const p = parseMatchName(r.matchName);
    if (!p) {
      history.push(r);
      continue;
    }
    if (p.home !== homeTeam) {
      history.push(r);
      continue;
    }

    const fullPicks = computePicksFromHistory(
      p.home,
      p.away,
      history,
      maxRounds,
    );
    if (fullPicks) {
      const slice = subsetPicks(fullPicks, [market]);
      const key = market as keyof StoredPicksJson;
      if (slice[key] !== undefined) {
        const g = gradePicks(slice, r.homeScore, r.awayScore);
        const hit = g.byMarket[market];
        if (hit !== undefined) {
          evaluated += 1;
          if (hit === true) hits += 1;
        }
      }
    }
    history.push(r);
  }

  const pct =
    evaluated > 0 ? Math.round((100 * hits) / evaluated) : 0;
  return { hits, evaluated, pct };
}

/** Mercado usado para ordenar mandantes (`SIGNAL_RANK_MARKET`). */
export function parseSignalRankMarket(): ImplementedMarketId {
  const raw = process.env.SIGNAL_RANK_MARKET?.trim();
  if (
    raw &&
    (IMPLEMENTED_MARKET_IDS as readonly string[]).includes(raw)
  ) {
    return raw as ImplementedMarketId;
  }
  return "teamOu";
}

export function signalBestHomeTeamOnly(): boolean {
  const v = process.env.SIGNAL_BEST_HOME_TEAM_ONLY?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export function signalMinEvaluatedGamesForRank(): number {
  const n = parseInt(process.env.SIGNAL_MIN_EVALUATED_GAMES ?? "3", 10);
  if (Number.isNaN(n) || n < 1) return 3;
  return Math.min(500, n);
}
