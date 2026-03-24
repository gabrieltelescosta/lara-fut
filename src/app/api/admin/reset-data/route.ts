import { truncateApplicationData } from "@/lib/db-reset-data";
import { authorizeCronRequest } from "@/lib/cron-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** POST: apaga sinais, eventos, odds, simulações, tournaments; reinicia TelegramGaleState. Auth = mesmo que cron. */
export async function POST(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const deleted = await truncateApplicationData();
    return NextResponse.json({
      ok: true,
      at: new Date().toISOString(),
      deleted,
      hint: "Corre o coletor (GET /api/cron/collector ou ENABLE_COLLECTOR_CRON) para repovoar eventos e odds.",
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 },
    );
  }
}
