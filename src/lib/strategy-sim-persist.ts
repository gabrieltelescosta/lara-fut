import { prisma } from "@/lib/prisma";
import { buildSimPayload } from "@/lib/signal-backtest";

/** Recalcula simulação walk-forward e grava 1 linha (substitui anteriores). */
export async function refreshStrategySimulation(): Promise<{ ok: boolean }> {
  const results = await prisma.result.findMany({
    include: { event: true },
    orderBy: { finishedAt: "asc" },
    take: 8000,
  });

  const payload = buildSimPayload(
    results.map((r) => ({
      event: { matchName: r.event.matchName },
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      finishedAt: r.finishedAt,
    })),
  );

  await prisma.strategySimRun.deleteMany({});
  await prisma.strategySimRun.create({
    data: { summaryJson: JSON.stringify(payload) },
  });

  return { ok: true };
}
