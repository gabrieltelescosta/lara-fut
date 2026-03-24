import { parseMatchName } from "@/lib/match-name";
import {
  getEnabledSignalMarkets,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import {
  computePicksFromHistory,
  countActivePicks,
  gradePicks,
  subsetPicks,
} from "@/lib/signal-picks";
import type { FinishedMatch } from "@/lib/team-stats";

export type StrategyDef = {
  id: string;
  label: string;
  maxRounds: number;
};

/** Estratégias comparáveis (só muda quantidade de jogos no histórico). */
export const BACKTEST_STRATEGIES: StrategyDef[] = [
  { id: "5j", label: "Últimos 5 jogos", maxRounds: 5 },
  { id: "10j", label: "Últimos 10 jogos (atual)", maxRounds: 10 },
  { id: "15j", label: "Últimos 15 jogos", maxRounds: 15 },
];

export type StrategyAgg = {
  strategyId: string;
  label: string;
  evaluated: number;
  hitByMarket: Partial<Record<ImplementedMarketId, number>>;
  totalHits: number;
  maxHits: number;
};

function emptyHits(
  enabled: ImplementedMarketId[],
): Partial<Record<ImplementedMarketId, number>> {
  const o: Partial<Record<ImplementedMarketId, number>> = {};
  for (const id of enabled) o[id] = 0;
  return o;
}

/**
 * Walk-forward: sem olhar o futuro — só jogos já finalizados antes do placar atual.
 */
export function runWalkForwardBacktest(
  results: Array<{
    event: { matchName: string };
    homeScore: number;
    awayScore: number;
    finishedAt: Date;
  }>,
  strategies: StrategyDef[] = BACKTEST_STRATEGIES,
  enabledMarkets: ImplementedMarketId[] = getEnabledSignalMarkets(),
): StrategyAgg[] {
  const sorted = [...results].sort(
    (a, b) => a.finishedAt.getTime() - b.finishedAt.getTime(),
  );

  const aggs = new Map<
    string,
    {
      evaluated: number;
      hitByMarket: Partial<Record<ImplementedMarketId, number>>;
      totalHits: number;
      maxHits: number;
    }
  >();
  for (const s of strategies) {
    aggs.set(s.id, {
      evaluated: 0,
      hitByMarket: emptyHits(enabledMarkets),
      totalHits: 0,
      maxHits: 0,
    });
  }

  const history: FinishedMatch[] = [];

  for (const r of sorted) {
    const p = parseMatchName(r.event.matchName);
    if (!p) {
      history.push({
        matchName: r.event.matchName,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        finishedAt: r.finishedAt,
      });
      continue;
    }

    for (const s of strategies) {
      const picks = computePicksFromHistory(
        p.home,
        p.away,
        history,
        s.maxRounds,
      );
      const a = aggs.get(s.id)!;
      if (!picks) continue;

      const stored = subsetPicks(picks, enabledMarkets);
      if (countActivePicks(stored) === 0) continue;

      const k = countActivePicks(stored);
      const g = gradePicks(stored, r.homeScore, r.awayScore);
      a.evaluated += 1;
      a.maxHits += k;
      a.totalHits += g.hitsTotal;
      for (const id of enabledMarkets) {
        if (g.byMarket[id] === true) {
          const prev = a.hitByMarket[id] ?? 0;
          a.hitByMarket[id] = prev + 1;
        }
      }
    }

    history.push({
      matchName: r.event.matchName,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      finishedAt: r.finishedAt,
    });
  }

  return strategies.map((s) => {
    const a = aggs.get(s.id)!;
    return {
      strategyId: s.id,
      label: s.label,
      evaluated: a.evaluated,
      hitByMarket: a.hitByMarket,
      totalHits: a.totalHits,
      maxHits: a.maxHits,
    };
  });
}

export type BestStrategyRef = {
  strategyId: string;
  label: string;
};

function pickBestByMarketPct(
  strategies: Array<{
    strategyId: string;
    label: string;
    pctByMarket: Partial<Record<ImplementedMarketId, number | null>>;
  }>,
  marketId: ImplementedMarketId,
): BestStrategyRef | null {
  const withVal = strategies.filter(
    (s) =>
      s.pctByMarket[marketId] !== null &&
      s.pctByMarket[marketId] !== undefined,
  );
  if (withVal.length === 0) return null;
  const maxPct = Math.max(
    ...withVal.map((s) => s.pctByMarket[marketId] as number),
  );
  const atMax = withVal.filter((s) => s.pctByMarket[marketId] === maxPct);
  const order = new Map(
    BACKTEST_STRATEGIES.map((d, i) => [d.id, i] as const),
  );
  atMax.sort(
    (a, b) =>
      (order.get(a.strategyId) ?? 0) - (order.get(b.strategyId) ?? 0),
  );
  const w = atMax[0];
  return w
    ? { strategyId: w.strategyId, label: w.label }
    : null;
}

export type StrategySimPayload = {
  at: string;
  totalGamesInDb: number;
  strategies: Array<
    StrategyAgg & {
      pctByMarket: Partial<Record<ImplementedMarketId, number | null>>;
      pctHitsPerGame: number;
    }
  >;
  /** Vencedor após empate: ordem fixa 5j → 10j → 15j. */
  bestByAvgHits: string | null;
  bestByAvgHitsLabel: string | null;
  bestByAvgHitsTied: boolean;
  bestByAvgHitsTiedIds: string[];
  bestByMarket: Partial<Record<ImplementedMarketId, BestStrategyRef>>;
  marketsEnabled: ImplementedMarketId[];
};

export type BuildSimPayloadOptions = {
  marketsEnabled?: ImplementedMarketId[];
};

export function buildSimPayload(
  results: Array<{
    event: { matchName: string };
    homeScore: number;
    awayScore: number;
    finishedAt: Date;
  }>,
  options?: BuildSimPayloadOptions,
): StrategySimPayload {
  const enabled =
    options?.marketsEnabled ?? getEnabledSignalMarkets();
  const aggs = runWalkForwardBacktest(results, BACKTEST_STRATEGIES, enabled);
  const strategies = aggs.map((a) => {
    const n = a.evaluated;
    const pctM = (
      hits: number | undefined,
      id: ImplementedMarketId,
    ): number | null => {
      if (!enabled.includes(id)) return null;
      if (n <= 0) return 0;
      const h = hits ?? 0;
      return Math.round((100 * h) / n);
    };
    const pctByMarket: Partial<
      Record<ImplementedMarketId, number | null>
    > = {};
    for (const id of enabled) {
      pctByMarket[id] = pctM(a.hitByMarket[id], id);
    }
    return {
      ...a,
      pctByMarket,
      pctHitsPerGame:
        a.maxHits > 0 ? Math.round((100 * a.totalHits) / a.maxHits) : 0,
    };
  });

  let bestByAvgHits: string | null = null;
  let bestByAvgHitsLabel: string | null = null;
  let bestByAvgHitsTied = false;
  let bestByAvgHitsTiedIds: string[] = [];

  if (strategies.length > 0) {
    const maxPct = Math.max(
      0,
      ...strategies.map((s) => s.pctHitsPerGame),
    );
    const atMax = strategies.filter((s) => s.pctHitsPerGame === maxPct);
    const order = new Map(
      BACKTEST_STRATEGIES.map((d, i) => [d.id, i] as const),
    );
    atMax.sort(
      (a, b) =>
        (order.get(a.strategyId) ?? 0) - (order.get(b.strategyId) ?? 0),
    );
    const winner = atMax[0];
    bestByAvgHits = winner?.strategyId ?? null;
    bestByAvgHitsLabel = winner?.label ?? null;
    bestByAvgHitsTied = atMax.length > 1;
    bestByAvgHitsTiedIds = atMax.map((s) => s.strategyId);
  }

  const bestByMarket: Partial<Record<ImplementedMarketId, BestStrategyRef>> =
    {};
  for (const id of enabled) {
    const b = pickBestByMarketPct(strategies, id);
    if (b) bestByMarket[id] = b;
  }

  return {
    at: new Date().toISOString(),
    totalGamesInDb: results.length,
    strategies,
    bestByAvgHits,
    bestByAvgHitsLabel,
    bestByAvgHitsTied,
    bestByAvgHitsTiedIds,
    bestByMarket,
    marketsEnabled: enabled,
  };
}
