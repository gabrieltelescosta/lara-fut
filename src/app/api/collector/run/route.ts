import { runCollector } from "@/lib/collector";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
/** Avoid platform default cutting off long outbound fetches to Superbet. */
export const maxDuration = 60;

export async function POST() {
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

export async function GET() {
  return POST();
}
