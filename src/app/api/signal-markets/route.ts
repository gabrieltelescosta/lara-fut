import {
  getEnabledSignalMarkets,
  SIGNAL_MARKET_CATALOG,
} from "@/lib/signal-market-catalog";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Catálogo completo + mercados efetivos na geração automática (env). */
export async function GET() {
  return NextResponse.json({
    enabled: getEnabledSignalMarkets(),
    catalog: SIGNAL_MARKET_CATALOG,
  });
}
