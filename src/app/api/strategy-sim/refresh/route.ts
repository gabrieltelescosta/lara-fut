import { authorizeCronRequest } from "@/lib/cron-auth";
import { getStrategySimJsonResponse } from "@/lib/strategy-sim-json";
import { refreshStrategySimulation } from "@/lib/strategy-sim-persist";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Recalcula simulação, grava cache e devolve o mesmo JSON que GET /api/strategy-sim. */
export async function POST(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await refreshStrategySimulation();
    const body = await getStrategySimJsonResponse();
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
