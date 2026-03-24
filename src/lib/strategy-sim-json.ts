import { buildSimPayload } from "@/lib/signal-backtest";
import type { ImplementedMarketId } from "@/lib/signal-market-catalog";
import { prisma } from "@/lib/prisma";

async function loadResultsForSim() {
  return prisma.result.findMany({
    include: { event: true },
    orderBy: { finishedAt: "asc" },
    take: 8000,
  });
}

function mapSimResults(
  results: Awaited<ReturnType<typeof loadResultsForSim>>,
): Array<{
  event: { matchName: string };
  homeScore: number;
  awayScore: number;
  finishedAt: Date;
}> {
  return results.map((r) => ({
    event: { matchName: r.event.matchName },
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    finishedAt: r.finishedAt,
  }));
}

/**
 * Resposta JSON da simulação: cache em `StrategySimRun` ou cálculo direto se vazio.
 * `cachedAt` = quando o coletor (ou refresh) gravou o cache; `null` = cálculo direto.
 *
 * Com `marketsEnabled` explícito (ex. API `?markets=all` ou lista), recalcula sempre a
 * partir dos `Result` e ignora cache — não depende do `.env`.
 */
export async function getStrategySimJsonResponse(
  opts?: { marketsEnabled?: ImplementedMarketId[] },
): Promise<Record<string, unknown>> {
  const override = opts?.marketsEnabled;

  if (override !== undefined) {
    const rows = await loadResultsForSim();
    const payload = buildSimPayload(mapSimResults(rows), {
      marketsEnabled: override,
    });
    return {
      ...payload,
      cachedAt: null,
      simMarketsOverride: true,
    };
  }

  const latest = await prisma.strategySimRun.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (latest) {
    try {
      const parsed = JSON.parse(latest.summaryJson) as Record<string, unknown>;
      return {
        ...parsed,
        cachedAt: latest.createdAt.toISOString(),
        simMarketsOverride: false,
      };
    } catch {
      /* fall through */
    }
  }

  const rows = await loadResultsForSim();
  const payload = buildSimPayload(mapSimResults(rows));
  return {
    ...payload,
    cachedAt: null,
    simMarketsOverride: false,
  };
}
