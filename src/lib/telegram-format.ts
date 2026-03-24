import { MARKET_SHORT_LABEL } from "@/lib/signal-market-catalog";
import type { ImplementedMarketId } from "@/lib/signal-market-catalog";
import type { GradeResult, StoredPicksJson } from "@/lib/signal-picks";
import { getSignalMinLeadMinutes } from "@/lib/signal-timing";

const TZ = process.env.TELEGRAM_TIMEZONE?.trim() || "America/Sao_Paulo";

export function formatKickoffHHmm(d: Date): string {
  return d.toLocaleTimeString("pt-BR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatKickoffDateTime(d: Date): string {
  return d.toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** +5 min (grade típico virtual) para referência de tempo. */
export function formatNextGradeHint(d: Date): string {
  const t = new Date(d.getTime() + 5 * 60 * 1000);
  return formatKickoffHHmm(t);
}

function pickLineForMarket(
  id: ImplementedMarketId,
  picks: StoredPicksJson,
  homeTeam: string,
): string | null {
  if (id === "oneX2" && picks.oneX2 !== undefined) {
    return `1X2 → ${picks.oneX2}`;
  }
  if (id === "duplaChance" && picks.duplaChance !== undefined) {
    return `Dupla chance → ${picks.duplaChance}`;
  }
  if (id === "teamOu" && picks.teamOu !== undefined) {
    const ou = picks.teamOu.side === "mais" ? "Mais" : "Menos";
    return `Gols ${homeTeam} (linha 2.5) → ${ou}`;
  }
  if (id === "btts" && picks.btts !== undefined) {
    return `BTTS → ${picks.btts === "sim" ? "Sim" : "Não"}`;
  }
  if (id === "totalGolsJogo" && picks.totalGolsJogo !== undefined) {
    const ou = picks.totalGolsJogo.side === "mais" ? "Mais" : "Menos";
    return `Total gols jogo 2.5 → ${ou}`;
  }
  return null;
}

export function buildTelegramSignalCard(params: {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  picks: StoredPicksJson;
  telegramMarkets: ImplementedMarketId[];
  roundsUsed: number;
  rankLine?: string;
  attemptLabel?: string;
  nextKickoffHint?: string | null;
}): string {
  const {
    homeTeam,
    awayTeam,
    matchDate,
    picks,
    telegramMarkets,
    roundsUsed,
    rankLine,
    attemptLabel,
    nextKickoffHint,
  } = params;

  const t0 = formatKickoffHHmm(matchDate);
  const t5 = formatNextGradeHint(matchDate);
  const leadMin = getSignalMinLeadMinutes();

  const lines: string[] = [
    "🎯 Sinal — Virtual",
    ...(attemptLabel ? [`📌 ${attemptLabel}`, ""] : []),
    `⚽ ${homeTeam} x ${awayTeam}`,
    `🕐 Início do jogo (sua entrada): ${t0}`,
    `⏱️ Grade seguinte (+5 min): ${t5}`,
    `⏳ Só sugerimos jogos com pelo menos ${leadMin} min até o início (tempo para apostar).`,
    "",
  ];
  if (nextKickoffHint) {
    lines.push(`🔜 Próximo jogo na lista: ~${nextKickoffHint}`);
    lines.push("");
  }

  lines.push("📊 Mercados (Telegram)");
  for (const id of telegramMarkets) {
    const line = pickLineForMarket(id, picks, homeTeam);
    if (line) {
      lines.push(`  • ${MARKET_SHORT_LABEL[id]}: ${line}`);
    }
  }

  lines.push("");
  lines.push(`🧠 Base: últimos ${roundsUsed} jogos do mandante`);
  if (rankLine) {
    lines.push(rankLine);
  }
  lines.push("");
  lines.push("⚠️ Jogo responsável. Aposte só o que pode perder.");

  return lines.join("\n");
}

export function buildTelegramGaleInterimRed(params: {
  matchName: string;
  homeScore: number;
  awayScore: number;
  marketLabel: string;
  galeStep: number;
  maxAttempts: number;
  nextKickoffHint: string | null;
}): string {
  const {
    matchName,
    homeScore,
    awayScore,
    marketLabel,
    galeStep,
    maxAttempts,
    nextKickoffHint,
  } = params;
  const lines = [
    "🔴 RED (parcial)",
    `⚽ ${matchName}`,
    `📍 Placar: ${homeScore}–${awayScore}`,
    `📉 Mercado: ${marketLabel}`,
    "",
    `🔄 Gale ${galeStep} de ${maxAttempts - 1} recuperações possíveis`,
    "⏳ Aguarda o próximo sinal na mesma mensagem (próximo jogo).",
  ];
  if (nextKickoffHint) {
    lines.push(`🔜 Próximo kickoff provável: ${nextKickoffHint}`);
  }
  return lines.join("\n");
}

export function buildTelegramGaleFinalGreen(params: {
  matchName: string;
  homeScore: number;
  awayScore: number;
  marketLabel: string;
  attempt: number;
}): string {
  const { matchName, homeScore, awayScore, marketLabel, attempt } = params;
  return [
    "✅ GREEN — ciclo fechado",
    `⚽ ${matchName}`,
    `📍 Placar: ${homeScore}–${awayScore}`,
    `📈 Mercado: ${marketLabel}`,
    "",
    `🏆 Vitória contabilizada após ${attempt} tentativa(s) na cadeia.`,
    "",
    "— Fim da sequência. Próximo sinal = nova mensagem.",
  ].join("\n");
}

export function buildTelegramGaleFinalRed(params: {
  matchName: string;
  homeScore: number;
  awayScore: number;
  marketLabel: string;
  attemptsUsed: number;
}): string {
  const { matchName, homeScore, awayScore, marketLabel, attemptsUsed } =
    params;
  return [
    "⛔ RED final — ciclo encerrado",
    `⚽ ${matchName}`,
    `📍 Placar: ${homeScore}–${awayScore}`,
    `📉 Mercado: ${marketLabel}`,
    "",
    `💀 Derrota contabilizada após ${attemptsUsed} tentativa(s) (gales esgotados).`,
    "",
    "— Próximo sinal = nova mensagem.",
  ].join("\n");
}

export function primaryMarketHit(
  grade: GradeResult,
  primary: ImplementedMarketId,
): boolean | undefined {
  return grade.byMarket[primary];
}
