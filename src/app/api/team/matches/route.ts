import { prisma } from "@/lib/prisma";
import {
  filterByTeam,
  filterH2H,
  type FinishedMatch,
} from "@/lib/team-stats";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const team = searchParams.get("team")?.trim();
  const opponent = searchParams.get("opponent")?.trim() ?? "";
  const limit = Math.min(
    100,
    Math.max(1, Number(searchParams.get("limit") ?? "30")),
  );

  if (!team) {
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

  const allForTeam = filterByTeam(team, matches);
  const slice = allForTeam.slice(0, limit);

  let h2h: ReturnType<typeof filterH2H> = [];
  if (opponent) {
    h2h = filterH2H(team, opponent, matches).slice(0, limit);
  }

  return NextResponse.json({
    team,
    opponent: opponent || null,
    totalGames: allForTeam.length,
    matches: slice.map((m) => ({
      opponent: m.opponent,
      isHome: m.isHome,
      goalsFor: m.goalsFor,
      goalsAgainst: m.goalsAgainst,
      finishedAt: m.finishedAt.toISOString(),
    })),
    h2h: opponent
      ? h2h.map((m) => ({
          opponent: m.opponent,
          isHome: m.isHome,
          goalsFor: m.goalsFor,
          goalsAgainst: m.goalsAgainst,
          finishedAt: m.finishedAt.toISOString(),
        }))
      : [],
  });
}
