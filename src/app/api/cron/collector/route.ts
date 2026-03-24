import { runCollector } from "@/lib/collector";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** Coletor + subscription + geração/resolução de sinais pode passar de 60s. */
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runCollector();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
