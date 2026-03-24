import { prisma } from "@/lib/prisma";

export type SettlementLine = {
  marketName: string;
  outcomeName: string;
  price: number;
  info: string | null;
  hit: boolean | null;
};

export type SettlementPayload = {
  snapshotCapturedAt: string;
  snapshotBatch: string | null;
  homeScore: number;
  awayScore: number;
  lines: SettlementLine[];
  parsedCount: number;
  unparsedCount: number;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Heurística: devolve se a linha ganhou (true), perdeu (false) ou não aplicável (null). */
export function gradeOddsLine(
  marketName: string,
  outcomeName: string,
  info: string | null,
  homeScore: number,
  awayScore: number,
): boolean | null {
  const m = norm(marketName);
  const o = outcomeName.trim();
  const ol = norm(o);
  const inf = info ? norm(info) : "";
  const totalGoals = homeScore + awayScore;
  const homeWins = homeScore > awayScore;
  const draw = homeScore === awayScore;
  const awayWins = homeScore < awayScore;
  const btts = homeScore >= 1 && awayScore >= 1;

  // --- 1X2 "Resultado Final" (sem combos) ---
  const isCombo =
    m.includes("dupla") ||
    m.includes("total de gols") ||
    m.includes("total gols") ||
    m.includes("ambas") ||
    m.includes("ambos") ||
    m.includes("placar correto") ||
    m.includes("numero exato") ||
    m.includes("número exato") ||
    m.includes("faixa");
  if (
    (m.includes("resultado final") || m === "resultado final") &&
    !isCombo
  ) {
    if (ol === "1" || ol.includes("casa")) {
      if (homeWins) return true;
      if (draw || awayWins) return false;
    }
    if (ol === "x" || ol.includes("empate")) {
      if (draw) return true;
      return false;
    }
    if (ol === "2" || ol.includes("visitante") || ol.includes("visit")) {
      if (awayWins) return true;
      return false;
    }
    return null;
  }

  // --- Ambas / BTTS ---
  if (m.includes("ambas") || m.includes("ambos") || m.includes("marcam")) {
    if (ol.includes("sim") && !ol.includes("nao") && !ol.includes("não"))
      return btts;
    if (ol.includes("nao") || ol.includes("não")) return !btts;
    return null;
  }

  // --- Dupla chance ---
  if (m.includes("dupla")) {
    const pick12 = homeWins || awayWins;
    const pick1x = homeWins || draw;
    const pickx2 = draw || awayWins;
    if (ol.includes("1x") || ol === "1 x") return pick1x;
    if (ol.includes("12") || ol === "1 2") return pick12;
    if (ol.includes("x2") || ol === "x 2") return pickx2;
    return null;
  }

  // --- Total de gols jogo 2.5 (não "equipe") ---
  const isTeamTotal =
    m.includes("equipe") || m.includes("(v)") || m.includes("mandante");
  if (
    (m.includes("total") && m.includes("gol") && !isTeamTotal) ||
    (m.includes("gols no jogo") && !isTeamTotal)
  ) {
    const over = totalGoals > 2;
    if (ol.includes("mais") || inf.includes("mais")) return over;
    if (ol.includes("menos") || inf.includes("menos")) return !over;
    return null;
  }

  // --- Total de gols da equipe (mandante): linha 2.5 típica virtual ---
  if (m.includes("equipe") || (m.includes("(v)") && m.includes("gol"))) {
    const overH = homeScore > 2;
    if (ol.includes("mais") || inf.includes("mais")) return overH;
    if (ol.includes("menos") || inf.includes("menos")) return !overH;
    return null;
  }

  // --- Número exato total ---
  if (m.includes("numero exato") || m.includes("número exato")) {
    if (!m.includes("(v)") && !m.includes("equipe")) {
      const n = Number.parseInt(o.replace(/\D/g, ""), 10);
      if (!Number.isFinite(n)) return null;
      return totalGoals === n;
    }
    const n = Number.parseInt(o.replace(/\D/g, ""), 10);
    if (!Number.isFinite(n)) return null;
    return homeScore === n;
  }

  // --- Faixa de gols ---
  if (m.includes("faixa")) {
    if (ol.includes("0") && ol.includes("1") && totalGoals <= 1) return true;
    if (
      (ol.includes("2") && ol.includes("3") && !ol.includes("4")) ||
      ol.includes("2-3")
    ) {
      return totalGoals >= 2 && totalGoals <= 3;
    }
    if (ol.includes("4") || ol.includes("4+")) return totalGoals >= 4;
    return null;
  }

  // --- Placar correto ---
  if (m.includes("placar correto")) {
    const match = o.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!match) return null;
    const h = Number.parseInt(match[1], 10);
    const a = Number.parseInt(match[2], 10);
    return homeScore === h && awayScore === a;
  }

  // --- Resultado + total / resultado + ambas (combo) ---
  if (m.includes("resultado final") && m.includes("total")) {
    const over = totalGoals > 2;
    const needOver = ol.includes("mais") || inf.includes("mais");
    const needUnder = ol.includes("menos") || inf.includes("menos");
    let ok1x2 = false;
    if (ol.includes("1") && !ol.includes("2") && !ol.includes("x")) ok1x2 = homeWins;
    else if (ol.includes("2")) ok1x2 = awayWins;
    else if (ol.includes("x") || ol.includes("empate")) ok1x2 = draw;
    else return null;
    if (needOver) return ok1x2 && over;
    if (needUnder) return ok1x2 && !over;
    return null;
  }

  if (
    m.includes("resultado final") &&
    (m.includes("ambas") || m.includes("ambos"))
  ) {
    const needSim = ol.includes("sim");
    const needNao = ol.includes("nao") || ol.includes("não");
    let ok1x2 = false;
    if (ol.includes("1") && homeWins) ok1x2 = true;
    else if (ol.includes("2") && awayWins) ok1x2 = true;
    else if ((ol.includes("x") || ol.includes("empate")) && draw) ok1x2 = true;
    else return null;
    if (needSim) return ok1x2 && btts;
    if (needNao) return ok1x2 && !btts;
    return null;
  }

  return null;
}

type OddRow = {
  marketName: string;
  outcomeName: string;
  price: number;
  info: string | null;
};

async function loadOddsBatchAtOrBefore(
  eventId: string,
  before: Date,
): Promise<{
  capturedAt: Date;
  snapshotBatch: string;
  rows: OddRow[];
} | null> {
  const anchor = await prisma.oddsSnapshot.findFirst({
    where: { eventId, capturedAt: { lte: before } },
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
  });
  if (!anchor) {
    const any = await prisma.oddsSnapshot.findFirst({
      where: { eventId },
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
    });
    if (!any) return null;
    const rows = await prisma.oddsSnapshot.findMany({
      where: { eventId, capturedAt: any.capturedAt },
    });
    const batch = rows[0]?.snapshotBatch ?? "";
    return { capturedAt: any.capturedAt, snapshotBatch: batch, rows };
  }
  const rows = await prisma.oddsSnapshot.findMany({
    where: { eventId, capturedAt: anchor.capturedAt },
  });
  const batch = rows[0]?.snapshotBatch ?? "";
  return { capturedAt: anchor.capturedAt, snapshotBatch: batch, rows };
}

/**
 * Grava em `Result.settlementJson` o confronto placar vs lote de odds (≤ hora do fim).
 */
export async function computeAndPersistSettlementForResult(
  resultId: string,
): Promise<SettlementPayload | null> {
  const res = await prisma.result.findUnique({
    where: { id: resultId },
    include: { event: true },
  });
  if (!res) return null;

  const batch = await loadOddsBatchAtOrBefore(res.eventId, res.finishedAt);
  if (!batch || batch.rows.length === 0) {
    const empty: SettlementPayload = {
      snapshotCapturedAt: new Date(0).toISOString(),
      snapshotBatch: null,
      homeScore: res.homeScore,
      awayScore: res.awayScore,
      lines: [],
      parsedCount: 0,
      unparsedCount: 0,
    };
    await prisma.result.update({
      where: { id: resultId },
      data: { settlementJson: JSON.stringify(empty) },
    });
    return empty;
  }

  const lines: SettlementLine[] = [];
  let parsedCount = 0;
  let unparsedCount = 0;
  for (const r of batch.rows) {
    const hit = gradeOddsLine(
      r.marketName,
      r.outcomeName,
      r.info,
      res.homeScore,
      res.awayScore,
    );
    lines.push({
      marketName: r.marketName,
      outcomeName: r.outcomeName,
      price: r.price,
      info: r.info,
      hit,
    });
    if (hit === null) unparsedCount += 1;
    else parsedCount += 1;
  }

  const payload: SettlementPayload = {
    snapshotCapturedAt: batch.capturedAt.toISOString(),
    snapshotBatch: batch.snapshotBatch || null,
    homeScore: res.homeScore,
    awayScore: res.awayScore,
    lines,
    parsedCount,
    unparsedCount,
  };

  await prisma.result.update({
    where: { id: resultId },
    data: { settlementJson: JSON.stringify(payload) },
  });

  return payload;
}
