import {
  IMPLEMENTED_MARKET_IDS,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import {
  bucketFaixaGolsTotais,
  count1X2,
  countBtts,
  countDuplaChanceWins,
  countFaixaGolsTotais,
  countTeamTotalOU,
  countTotalMatchGoalsOU,
  filterByTeam,
  totalMatchGoals,
  type FaixaGolsTotais,
  type FinishedMatch,
  type TeamPerspective,
} from "@/lib/team-stats";

/** Fixo em produção até validar o simulador em `/strategy`; fase 2 = alinhar ao melhor `maxRounds` do backtest. */
export const SIGNAL_ROUNDS = 10;

export type FullPicks = {
  oneX2: "1" | "X" | "2";
  btts: "sim" | "nao";
  teamOu: { team: string; line: 2.5; side: "mais" | "menos" };
  totalGolsJogo: { line: 2.5; side: "mais" | "menos" };
  duplaChance: "1X" | "12" | "X2";
  faixaGolsTotais: FaixaGolsTotais;
  resultadoFinalTotalGols: {
    oneX2: "1" | "X" | "2";
    totalSide: "mais" | "menos";
  };
  numeroExatoGols: number;
  timeNumeroExatoGols: number;
  placarCorreto: { home: number; away: number };
  resultadoFinalAmbasMarcam: {
    oneX2: "1" | "X" | "2";
    btts: "sim" | "nao";
  };
};

/** Subconjunto gravado no DB conforme mercados ativos. */
export type StoredPicksJson = Partial<FullPicks>;

/** Ordem das linhas no texto (legível). */
export const MARKET_LINE_ORDER: ImplementedMarketId[] = [
  "oneX2",
  "duplaChance",
  "totalGolsJogo",
  "teamOu",
  "btts",
  "faixaGolsTotais",
  "numeroExatoGols",
  "timeNumeroExatoGols",
  "placarCorreto",
  "resultadoFinalTotalGols",
  "resultadoFinalAmbasMarcam",
];

function pickMaxDuplaChance(
  w: ReturnType<typeof countDuplaChanceWins>,
): "1X" | "12" | "X2" {
  const order: Array<"1X" | "12" | "X2"> = ["1X", "12", "X2"];
  let best: "1X" | "12" | "X2" = "1X";
  let bestN = -1;
  for (const k of order) {
    const n = w[k];
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

function pickMaxFaixa(c: Record<FaixaGolsTotais, number>): FaixaGolsTotais {
  const order: FaixaGolsTotais[] = ["0-1", "2-3", "4+"];
  let best: FaixaGolsTotais = "0-1";
  let bestN = -1;
  for (const k of order) {
    if (c[k] > bestN) {
      bestN = c[k];
      best = k;
    }
  }
  return best;
}

function modeExactTotalGoals(rows: TeamPerspective[]): number {
  const freq = new Map<number, number>();
  for (const r of rows) {
    const t = totalMatchGoals(r);
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }
  let best = 0;
  let bestN = -1;
  const keys = [...freq.keys()].sort((a, b) => a - b);
  for (const k of keys) {
    const n = freq.get(k) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

function modeExactHomeGoals(rows: TeamPerspective[]): number {
  const freq = new Map<number, number>();
  for (const r of rows) {
    const g = r.goalsFor;
    freq.set(g, (freq.get(g) ?? 0) + 1);
  }
  let best = 0;
  let bestN = -1;
  const keys = [...freq.keys()].sort((a, b) => a - b);
  for (const k of keys) {
    const n = freq.get(k) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

function modeScoreline(rows: TeamPerspective[]): { home: number; away: number } {
  const freq = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.goalsFor}-${r.goalsAgainst}`;
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  let bestKey = "0-0";
  let bestN = -1;
  for (const [k, v] of freq) {
    if (v > bestN) {
      bestN = v;
      bestKey = k;
    }
  }
  const [h, a] = bestKey.split("-").map(Number);
  return { home: h, away: a };
}

export function subsetPicks(
  picks: FullPicks,
  enabled: ImplementedMarketId[],
): StoredPicksJson {
  const set = new Set(enabled);
  const out: StoredPicksJson = {};
  if (set.has("oneX2")) out.oneX2 = picks.oneX2;
  if (set.has("btts")) out.btts = picks.btts;
  if (set.has("teamOu")) out.teamOu = picks.teamOu;
  if (set.has("totalGolsJogo")) out.totalGolsJogo = picks.totalGolsJogo;
  if (set.has("duplaChance")) out.duplaChance = picks.duplaChance;
  if (set.has("faixaGolsTotais")) out.faixaGolsTotais = picks.faixaGolsTotais;
  if (set.has("resultadoFinalTotalGols")) {
    out.resultadoFinalTotalGols = picks.resultadoFinalTotalGols;
  }
  if (set.has("numeroExatoGols")) out.numeroExatoGols = picks.numeroExatoGols;
  if (set.has("timeNumeroExatoGols")) {
    out.timeNumeroExatoGols = picks.timeNumeroExatoGols;
  }
  if (set.has("placarCorreto")) out.placarCorreto = picks.placarCorreto;
  if (set.has("resultadoFinalAmbasMarcam")) {
    out.resultadoFinalAmbasMarcam = picks.resultadoFinalAmbasMarcam;
  }
  return out;
}

/** Quantos mercados entram no sinal (subset não vazio). */
export function countActivePicks(stored: StoredPicksJson): number {
  let n = 0;
  if (stored.oneX2 !== undefined) n += 1;
  if (stored.btts !== undefined) n += 1;
  if (stored.teamOu !== undefined) n += 1;
  if (stored.totalGolsJogo !== undefined) n += 1;
  if (stored.duplaChance !== undefined) n += 1;
  if (stored.faixaGolsTotais !== undefined) n += 1;
  if (stored.resultadoFinalTotalGols !== undefined) n += 1;
  if (stored.numeroExatoGols !== undefined) n += 1;
  if (stored.timeNumeroExatoGols !== undefined) n += 1;
  if (stored.placarCorreto !== undefined) n += 1;
  if (stored.resultadoFinalAmbasMarcam !== undefined) n += 1;
  return n;
}

/** Tendência a partir dos últimos jogos do mandante. `maxRounds` = quantos jogos olhar (padrão 10). */
export function computePicksFromHistory(
  homeTeam: string,
  _awayTeam: string,
  matches: FinishedMatch[],
  maxRounds: number = SIGNAL_ROUNDS,
): FullPicks | null {
  const rows = filterByTeam(homeTeam, matches).slice(0, maxRounds);
  if (rows.length < 3) return null;

  const x12 = count1X2(rows);
  const m = Math.max(x12.one, x12.x, x12.two);
  let oneX2: "1" | "X" | "2" = "X";
  if (m === x12.one) oneX2 = "1";
  else if (m === x12.two) oneX2 = "2";

  const b = countBtts(rows);
  const btts: "sim" | "nao" = b.sim >= b.nao ? "sim" : "nao";

  const ou = countTeamTotalOU(rows, 2.5);
  const sideTeam: "mais" | "menos" = ou.over >= ou.under ? "mais" : "menos";

  const ouTot = countTotalMatchGoalsOU(rows);
  const sideTot: "mais" | "menos" = ouTot.over >= ouTot.under ? "mais" : "menos";

  const dc = countDuplaChanceWins(rows);
  const duplaChance = pickMaxDuplaChance(dc);

  const faixaC = countFaixaGolsTotais(rows);
  const faixaGolsTotais = pickMaxFaixa(faixaC);

  const resultadoFinalTotalGols = {
    oneX2,
    totalSide: sideTot,
  };

  const numeroExatoGols = modeExactTotalGoals(rows);
  const timeNumeroExatoGols = modeExactHomeGoals(rows);
  const placarCorreto = modeScoreline(rows);

  const resultadoFinalAmbasMarcam = { oneX2, btts };

  return {
    oneX2,
    btts,
    teamOu: { team: homeTeam, line: 2.5, side: sideTeam },
    totalGolsJogo: { line: 2.5, side: sideTot },
    duplaChance,
    faixaGolsTotais,
    resultadoFinalTotalGols,
    numeroExatoGols,
    timeNumeroExatoGols,
    placarCorreto,
    resultadoFinalAmbasMarcam,
  };
}

export function buildSimpleSignalMessage(
  homeTeam: string,
  awayTeam: string,
  matchDate: Date,
  picks: StoredPicksJson,
  roundsUsed: number,
): string {
  const when = matchDate.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const lines: string[] = [
    `${homeTeam} x ${awayTeam}`,
    `${when} · base últimos ${roundsUsed} jogos`,
    ``,
  ];

  const ordered = MARKET_LINE_ORDER.filter((id) => {
    const p = picks as Record<string, unknown>;
    return p[id] !== undefined;
  });

  for (const id of ordered) {
    if (id === "oneX2" && picks.oneX2 !== undefined) {
      lines.push(`Resultado Final: ${picks.oneX2}`);
    }
    if (id === "duplaChance" && picks.duplaChance !== undefined) {
      lines.push(`Dupla Chance: ${picks.duplaChance}`);
    }
    if (id === "totalGolsJogo" && picks.totalGolsJogo !== undefined) {
      const ou =
        picks.totalGolsJogo.side === "mais" ? "Mais" : "Menos";
      lines.push(`Total de Gols (jogo): ${ou} 2.5`);
    }
    if (id === "teamOu" && picks.teamOu !== undefined) {
      const ou = picks.teamOu.side === "mais" ? "Mais" : "Menos";
      lines.push(`Total de Gols da Equipe (${homeTeam}): ${ou} 2.5`);
    }
    if (id === "btts" && picks.btts !== undefined) {
      const bttsLabel = picks.btts === "sim" ? "Sim" : "Não";
      lines.push(`Ambos as Equipes Marcam: ${bttsLabel}`);
    }
    if (id === "faixaGolsTotais" && picks.faixaGolsTotais !== undefined) {
      lines.push(`Faixa de Gols Totais: ${picks.faixaGolsTotais}`);
    }
    if (id === "numeroExatoGols" && picks.numeroExatoGols !== undefined) {
      lines.push(`Número Exato de Gols: ${picks.numeroExatoGols}`);
    }
    if (id === "timeNumeroExatoGols" && picks.timeNumeroExatoGols !== undefined) {
      lines.push(
        `Número Exato de Gols (${homeTeam}): ${picks.timeNumeroExatoGols}`,
      );
    }
    if (id === "placarCorreto" && picks.placarCorreto !== undefined) {
      const pc = picks.placarCorreto;
      lines.push(`Placar Correto: ${pc.home}-${pc.away}`);
    }
    if (id === "resultadoFinalTotalGols" && picks.resultadoFinalTotalGols) {
      const c = picks.resultadoFinalTotalGols;
      const ou = c.totalSide === "mais" ? "Mais" : "Menos";
      lines.push(
        `Resultado Final & Total de Gols: ${c.oneX2} · Total gols ${ou} 2.5`,
      );
    }
    if (id === "resultadoFinalAmbasMarcam" && picks.resultadoFinalAmbasMarcam) {
      const c = picks.resultadoFinalAmbasMarcam;
      const bt = c.btts === "sim" ? "Sim" : "Não";
      lines.push(`Resultado Final & BTTS: ${c.oneX2} · ${bt}`);
    }
  }

  return lines.join("\n");
}

export function actualOneX2(homeScore: number, awayScore: number): "1" | "X" | "2" {
  if (homeScore > awayScore) return "1";
  if (homeScore === awayScore) return "X";
  return "2";
}

export function actualBtts(homeScore: number, awayScore: number): "sim" | "nao" {
  return homeScore >= 1 && awayScore >= 1 ? "sim" : "nao";
}

/** Mais 2.5 gols do mandante = 3+ gols. */
export function teamMais25(homeGoals: number): boolean {
  return homeGoals >= 3;
}

export function actualTotalGolsOu25(
  homeScore: number,
  awayScore: number,
): "mais" | "menos" {
  return homeScore + awayScore >= 3 ? "mais" : "menos";
}

export function gradeDuplaChance(
  pick: "1X" | "12" | "X2",
  homeScore: number,
  awayScore: number,
): boolean {
  const homeWins = homeScore > awayScore;
  const draw = homeScore === awayScore;
  const awayWins = homeScore < awayScore;
  if (pick === "1X") return homeWins || draw;
  if (pick === "12") return homeWins || awayWins;
  return draw || awayWins;
}

export type GradeResult = {
  byMarket: Partial<Record<ImplementedMarketId, boolean>>;
  hitsTotal: number;
};

export function gradePicks(
  picks: StoredPicksJson,
  homeScore: number,
  awayScore: number,
): GradeResult {
  const byMarket: Partial<Record<ImplementedMarketId, boolean>> = {};
  let hitsTotal = 0;

  if (picks.oneX2 !== undefined) {
    const ok = picks.oneX2 === actualOneX2(homeScore, awayScore);
    byMarket.oneX2 = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.btts !== undefined) {
    const ok = picks.btts === actualBtts(homeScore, awayScore);
    byMarket.btts = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.teamOu !== undefined) {
    const mais = teamMais25(homeScore);
    const ok = picks.teamOu.side === "mais" ? mais : !mais;
    byMarket.teamOu = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.totalGolsJogo !== undefined) {
    const act = actualTotalGolsOu25(homeScore, awayScore);
    const ok = picks.totalGolsJogo.side === act;
    byMarket.totalGolsJogo = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.duplaChance !== undefined) {
    const ok = gradeDuplaChance(
      picks.duplaChance,
      homeScore,
      awayScore,
    );
    byMarket.duplaChance = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.faixaGolsTotais !== undefined) {
    const t = homeScore + awayScore;
    const act = bucketFaixaGolsTotais(t);
    const ok = picks.faixaGolsTotais === act;
    byMarket.faixaGolsTotais = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.resultadoFinalTotalGols !== undefined) {
    const c = picks.resultadoFinalTotalGols;
    const ok =
      c.oneX2 === actualOneX2(homeScore, awayScore) &&
      c.totalSide === actualTotalGolsOu25(homeScore, awayScore);
    byMarket.resultadoFinalTotalGols = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.numeroExatoGols !== undefined) {
    const t = homeScore + awayScore;
    const ok = picks.numeroExatoGols === t;
    byMarket.numeroExatoGols = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.timeNumeroExatoGols !== undefined) {
    const ok = picks.timeNumeroExatoGols === homeScore;
    byMarket.timeNumeroExatoGols = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.placarCorreto !== undefined) {
    const ok =
      picks.placarCorreto.home === homeScore &&
      picks.placarCorreto.away === awayScore;
    byMarket.placarCorreto = ok;
    if (ok) hitsTotal += 1;
  }
  if (picks.resultadoFinalAmbasMarcam !== undefined) {
    const c = picks.resultadoFinalAmbasMarcam;
    const ok =
      c.oneX2 === actualOneX2(homeScore, awayScore) &&
      c.btts === actualBtts(homeScore, awayScore);
    byMarket.resultadoFinalAmbasMarcam = ok;
    if (ok) hitsTotal += 1;
  }

  return { byMarket, hitsTotal };
}
