import type { ImplementedMarketId } from "@/lib/signal-market-catalog";
import type { StoredPicksJson } from "@/lib/signal-picks";

export type OddsLineLite = {
  marketName: string;
  outcomeName: string;
  price: number;
  info: string | null;
};

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isTeamTotalMarketForHome(marketName: string, homeTeam: string): boolean {
  const m = norm(marketName);
  const h = norm(homeTeam);
  return m.includes("total de gols") && m.includes(h);
}

function outcomeMatchesTeamOu(
  outcomeName: string,
  side: "mais" | "menos",
  line: number,
): boolean {
  const o = norm(outcomeName);
  const token = String(line).replace(".", ",");
  const tokenDot = String(line);
  const hasLine = o.includes(token) || o.includes(tokenDot);
  if (!hasLine) return false;
  if (side === "mais") {
    return o.includes("mais");
  }
  return o.includes("menos");
}

/** Devolve a odd exata do pick principal (hoje: teamOu) no snapshot do sinal. */
export function pickOddByMarket(params: {
  marketId: ImplementedMarketId;
  picks: StoredPicksJson;
  homeTeam: string;
  odds: OddsLineLite[];
}): number | null {
  const { marketId, picks, homeTeam, odds } = params;
  if (marketId !== "teamOu" || !picks.teamOu) return null;
  const side = picks.teamOu.side;
  const line = picks.teamOu.line;
  const hit = odds.find(
    (o) =>
      isTeamTotalMarketForHome(o.marketName, homeTeam) &&
      outcomeMatchesTeamOu(o.outcomeName, side, line),
  );
  return hit?.price ?? null;
}

