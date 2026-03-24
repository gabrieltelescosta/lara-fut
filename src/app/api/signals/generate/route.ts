import { prisma } from "@/lib/prisma";
import {
  buildSignalText,
  filterByTeam,
  filterH2H,
  type FinishedMatch,
} from "@/lib/team-stats";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const focusTeam = searchParams.get("team")?.trim();
  const opponent = searchParams.get("opponent")?.trim();
  const last = Math.min(
    30,
    Math.max(3, Number(searchParams.get("last") ?? "10")),
  );

  if (!focusTeam) {
    return NextResponse.json({ error: "missing team" }, { status: 400 });
  }

  const results = await prisma.result.findMany({
    include: { event: true },
    orderBy: { finishedAt: "desc" },
    take: 2000,
  });

  const matches: FinishedMatch[] = results.map((r) => ({
    matchName: r.event.matchName,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    finishedAt: r.finishedAt,
  }));

  const allForTeam = filterByTeam(focusTeam, matches);
  const lastN = allForTeam.slice(0, last);
  const h2h =
    opponent && opponent.length > 0
      ? filterH2H(focusTeam, opponent, matches).slice(0, last)
      : [];

  const text = buildSignalText({
    focusTeam,
    opponent: opponent ?? undefined,
    lastN,
    h2h,
  });

  return NextResponse.json({
    text,
    meta: {
      sampleSize: lastN.length,
      h2hSize: h2h.length,
    },
  });
}
