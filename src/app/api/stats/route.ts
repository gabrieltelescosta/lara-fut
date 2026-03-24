import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const results = await prisma.result.findMany({
    select: {
      homeScore: true,
      awayScore: true,
    },
  });

  const scoreKey = (h: number, a: number) => `${h}-${a}`;
  const freq = new Map<string, number>();
  for (const r of results) {
    const k = scoreKey(r.homeScore, r.awayScore);
    freq.set(k, (freq.get(k) ?? 0) + 1);
  }

  const scorelines = [...freq.entries()]
    .map(([scoreline, count]) => ({ scoreline, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  const totalGoals = results.reduce(
    (acc, r) => acc + r.homeScore + r.awayScore,
    0,
  );
  const avgGoals =
    results.length > 0 ? totalGoals / results.length : 0;

  return NextResponse.json({
    totalFinishedMatches: results.length,
    averageTotalGoals: Math.round(avgGoals * 100) / 100,
    topScorelines: scorelines,
  });
}
