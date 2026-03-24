import { parseMarketsQueryString } from "@/lib/signal-market-catalog";
import { getStrategySimJsonResponse } from "@/lib/strategy-sim-json";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Query opcional: `?markets=all` ou `full` ou `oneX2,btts` — força mercados na simulação
 * (só os implementados) e ignora cache; útil para ver assertividade dos 3 sem mudar `.env`.
 */
export async function GET(req: NextRequest) {
  const markets = parseMarketsQueryString(
    req.nextUrl.searchParams.get("markets"),
  );
  const body = await getStrategySimJsonResponse(
    markets ? { marketsEnabled: markets } : undefined,
  );
  return NextResponse.json(body);
}
