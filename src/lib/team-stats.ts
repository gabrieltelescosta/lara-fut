import { parseMatchName } from "@/lib/match-name";

export type FinishedMatch = {
  matchName: string;
  homeScore: number;
  awayScore: number;
  finishedAt: Date;
};

export type TeamPerspective = {
  opponent: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  finishedAt: Date;
};

export function matchToPerspective(
  team: string,
  m: FinishedMatch,
): TeamPerspective | null {
  const p = parseMatchName(m.matchName);
  if (!p) return null;
  const norm = (s: string) => s.trim();
  const teamN = norm(team);
  let isHome: boolean;
  let opponent: string;
  if (norm(p.home) === teamN) {
    isHome = true;
    opponent = p.away;
  } else if (norm(p.away) === teamN) {
    isHome = false;
    opponent = p.home;
  } else {
    return null;
  }
  return {
    opponent,
    isHome,
    goalsFor: isHome ? m.homeScore : m.awayScore,
    goalsAgainst: isHome ? m.awayScore : m.homeScore,
    finishedAt: m.finishedAt,
  };
}

export function filterByTeam(
  team: string,
  matches: FinishedMatch[],
): TeamPerspective[] {
  const out: TeamPerspective[] = [];
  for (const m of matches) {
    const row = matchToPerspective(team, m);
    if (row) out.push(row);
  }
  out.sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
  return out;
}

export function filterH2H(
  teamA: string,
  teamB: string,
  matches: FinishedMatch[],
): TeamPerspective[] {
  const norm = (s: string) => s.trim();
  const a = norm(teamA);
  const b = norm(teamB);
  const out: TeamPerspective[] = [];
  for (const m of matches) {
    const p = parseMatchName(m.matchName);
    if (!p) continue;
    const h = norm(p.home);
    const aw = norm(p.away);
    if ((h === a && aw === b) || (h === b && aw === a)) {
      const row = matchToPerspective(teamA, m);
      if (row) out.push(row);
    }
  }
  out.sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
  return out;
}

export function countGamesWithMinGoals(
  rows: TeamPerspective[],
  minGoals: number,
): number {
  return rows.filter((r) => r.goalsFor >= minGoals).length;
}

export function avgGoalsFor(rows: TeamPerspective[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((s, r) => s + r.goalsFor, 0);
  return Math.round((sum / rows.length) * 100) / 100;
}

/** Mercado 1X2: 1=casa vence, X=empate, 2=visitante vence (placar do jogo). */
export function count1X2(rows: TeamPerspective[]): { n: number; one: number; x: number; two: number } {
  let one = 0;
  let x = 0;
  let two = 0;
  for (const r of rows) {
    if (r.goalsFor > r.goalsAgainst) {
      if (r.isHome) one += 1;
      else two += 1;
    } else if (r.goalsFor === r.goalsAgainst) {
      x += 1;
    } else {
      if (r.isHome) two += 1;
      else one += 1;
    }
  }
  return { n: rows.length, one, x, two };
}

/** Perspectiva do time: vitória / empate / derrota (útil para leitura). */
export function countWDL(rows: TeamPerspective[]): { w: number; d: number; l: number } {
  let w = 0;
  let d = 0;
  let l = 0;
  for (const r of rows) {
    if (r.goalsFor > r.goalsAgainst) w += 1;
    else if (r.goalsFor === r.goalsAgainst) d += 1;
    else l += 1;
  }
  return { w, d, l };
}

/** Over gols da equipe: linha 1.5 → precisa ≥2 gols; 2.5 → ≥3; 3.5 → ≥4. */
export function countTeamTotalOU(
  rows: TeamPerspective[],
  line: 1.5 | 2.5 | 3.5,
): { over: number; under: number; n: number } {
  const need = line === 1.5 ? 2 : line === 2.5 ? 3 : 4;
  let over = 0;
  for (const r of rows) {
    if (r.goalsFor >= need) over += 1;
  }
  const n = rows.length;
  return { over, under: n - over, n };
}

/** Ambas marcam: sim se os dois ≥1 gol. */
export function countBtts(rows: TeamPerspective[]): { sim: number; nao: number; n: number } {
  let sim = 0;
  for (const r of rows) {
    if (r.goalsFor >= 1 && r.goalsAgainst >= 1) sim += 1;
  }
  const n = rows.length;
  return { sim, nao: n - sim, n };
}

/** Gols totais do jogo (soma dos dois lados). */
export function totalMatchGoals(r: TeamPerspective): number {
  return r.goalsFor + r.goalsAgainst;
}

/** Over/under 2.5 nos gols totais do jogo (≥3 = mais). */
export function countTotalMatchGoalsOU(
  rows: TeamPerspective[],
): { over: number; under: number; n: number } {
  let over = 0;
  for (const r of rows) {
    if (totalMatchGoals(r) >= 3) over += 1;
  }
  const n = rows.length;
  return { over, under: n - over, n };
}

/** Quantas vezes cada dupla chance “ganharia” no histórico (perspectiva mandante). */
export function countDuplaChanceWins(rows: TeamPerspective[]): {
  "1X": number;
  "12": number;
  "X2": number;
} {
  let d1X = 0;
  let d12 = 0;
  let dX2 = 0;
  for (const r of rows) {
    const homeWins = r.goalsFor > r.goalsAgainst;
    const draw = r.goalsFor === r.goalsAgainst;
    const awayWins = r.goalsFor < r.goalsAgainst;
    if (homeWins || draw) d1X += 1;
    if (homeWins || awayWins) d12 += 1;
    if (draw || awayWins) dX2 += 1;
  }
  return { "1X": d1X, "12": d12, "X2": dX2 };
}

export type FaixaGolsTotais = "0-1" | "2-3" | "4+";

export function bucketFaixaGolsTotais(totalGoals: number): FaixaGolsTotais {
  if (totalGoals <= 1) return "0-1";
  if (totalGoals <= 3) return "2-3";
  return "4+";
}

export function countFaixaGolsTotais(
  rows: TeamPerspective[],
): Record<FaixaGolsTotais, number> {
  const c: Record<FaixaGolsTotais, number> = {
    "0-1": 0,
    "2-3": 0,
    "4+": 0,
  };
  for (const r of rows) {
    c[bucketFaixaGolsTotais(totalMatchGoals(r))] += 1;
  }
  return c;
}

/** Moda de valores; em empate retorna o menor índice em `order`. */
export function modeCount<T extends string>(
  rows: TeamPerspective[],
  getKey: (r: TeamPerspective) => T,
  order: readonly T[],
): T | null {
  if (rows.length === 0) return null;
  const freq = new Map<T, number>();
  for (const r of rows) {
    const k = getKey(r);
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }
  let best: T | null = null;
  let bestN = -1;
  for (const k of order) {
    const n = freq.get(k) ?? 0;
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return best;
}

function pct(a: number, n: number): string {
  if (n === 0) return "0%";
  return `${Math.round((100 * a) / n)}%`;
}

/** Texto curto para colar em mensagem (análise manual por time). */
export function buildSignalText(params: {
  focusTeam: string;
  opponent?: string;
  lastN: TeamPerspective[];
  h2h: TeamPerspective[];
}): string {
  const { focusTeam, opponent, lastN, h2h } = params;
  const n = lastN.length;
  if (n === 0) {
    return `${focusTeam}: sem jogos no histórico ainda.`;
  }

  const x12 = count1X2(lastN);
  const b = countBtts(lastN);
  const ou = countTeamTotalOU(lastN, 2.5);
  const m = Math.max(x12.one, x12.x, x12.two);
  let lean: "1" | "X" | "2" = "X";
  if (m === x12.one) lean = "1";
  else if (m === x12.two) lean = "2";
  const bttsLean = b.sim >= b.nao ? "Sim" : "Não";
  const ouLean = ou.over >= ou.under ? "Mais" : "Menos";

  const lines: string[] = [
    `${focusTeam} · base últimos ${n} jogos`,
    ``,
    `Resultado Final: ${lean}`,
    `Total de Gols da Equipe (${focusTeam}): ${ouLean} 2.5`,
    `Ambos as Equipes Marcam: ${bttsLean}`,
  ];

  if (opponent?.trim() && h2h.length >= 3) {
    const x2 = count1X2(h2h);
    const bh = countBtts(h2h);
    const mh = Math.max(x2.one, x2.x, x2.two);
    let lh: "1" | "X" | "2" = "X";
    if (mh === x2.one) lh = "1";
    else if (mh === x2.two) lh = "2";
    lines.push(
      ``,
      `vs ${opponent.trim()} (${h2h.length} jogos):`,
      `Resultado Final: ${lh} · Ambos as Equipes Marcam: ${bh.sim >= bh.nao ? "Sim" : "Não"}`,
    );
  }

  lines.push(`⚠️ Virtuais são aleatórios — não é dica de aposta.`);

  return lines.join("\n");
}
