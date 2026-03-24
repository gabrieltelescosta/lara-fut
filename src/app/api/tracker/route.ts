import {
  IMPLEMENTED_MARKET_IDS,
  MARKET_SHORT_LABEL,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parsePicksKeys(picksJson: string): Set<ImplementedMarketId> {
  const active = new Set<ImplementedMarketId>();
  try {
    const p = JSON.parse(picksJson) as Record<string, unknown>;
    for (const id of IMPLEMENTED_MARKET_IDS) {
      if (p[id] !== undefined) active.add(id);
    }
  } catch {
    for (const id of IMPLEMENTED_MARKET_IDS) active.add(id);
  }
  return active;
}

function gradesMapFromRow(r: {
  picksJson: string;
  gradesJson: string | null;
  hitOneX2: boolean | null;
  hitBtts: boolean | null;
  hitTeamOu: boolean | null;
}): Partial<Record<ImplementedMarketId, boolean | null>> {
  const keys = parsePicksKeys(r.picksJson);
  let fromJson: Partial<Record<ImplementedMarketId, boolean>> = {};
  if (r.gradesJson) {
    try {
      fromJson = JSON.parse(r.gradesJson) as Partial<
        Record<ImplementedMarketId, boolean>
      >;
    } catch {
      fromJson = {};
    }
  }
  const out: Partial<Record<ImplementedMarketId, boolean | null>> = {};
  for (const id of keys) {
    if (fromJson[id] !== undefined) {
      out[id] = fromJson[id]!;
      continue;
    }
    if (id === "oneX2") out[id] = r.hitOneX2;
    else if (id === "btts") out[id] = r.hitBtts;
    else if (id === "teamOu") out[id] = r.hitTeamOu;
    else out[id] = null;
  }
  return out;
}

export async function GET() {
  const [
    rows,
    firstSignal,
    firstEvent,
    oddsSnapshotsTotal,
    eventsTotal,
    tournamentsTotal,
  ] = await Promise.all([
    prisma.signalPrediction.findMany({
      orderBy: { matchDate: "desc" },
      take: 200,
    }),
    prisma.signalPrediction.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.event.findFirst({
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.oddsSnapshot.count(),
    prisma.event.count(),
    prisma.tournament.count(),
  ]);

  const resolved = rows.filter((r) => r.resolvedAt != null);
  const totalHits = resolved.reduce((s, r) => s + (r.hitsTotal ?? 0), 0);

  let maxHits = 0;
  for (const r of resolved) {
    const keys = parsePicksKeys(r.picksJson);
    maxHits += keys.size;
  }

  const byMarket: Record<
    string,
    { hit: number; total: number; pct: number | null; label: string }
  > = {};

  for (const id of IMPLEMENTED_MARKET_IDS) {
    byMarket[id] = {
      hit: 0,
      total: 0,
      pct: null,
      label: MARKET_SHORT_LABEL[id],
    };
  }

  for (const r of resolved) {
    const g = gradesMapFromRow(r);
    for (const id of IMPLEMENTED_MARKET_IDS) {
      if (!(id in g)) continue;
      const ok = g[id];
      if (ok === null || ok === undefined) continue;
      byMarket[id].total += 1;
      if (ok === true) byMarket[id].hit += 1;
    }
  }

  const pct = (hit: number, total: number) =>
    total > 0 ? Math.round((100 * hit) / total) : null;

  for (const id of IMPLEMENTED_MARKET_IDS) {
    const b = byMarket[id];
    b.pct = pct(b.hit, b.total);
  }

  function oddsAtSignalLineCount(oddsAtSignalJson: string | null): number {
    if (!oddsAtSignalJson) return 0;
    try {
      const a = JSON.parse(oddsAtSignalJson) as unknown;
      return Array.isArray(a) ? a.length : 0;
    } catch {
      return 0;
    }
  }

  return NextResponse.json({
    summary: {
      pending: rows.filter((r) => !r.resolvedAt).length,
      resolved: resolved.length,
      avgHitsPerSignal:
        resolved.length > 0
          ? Math.round((totalHits / resolved.length) * 100) / 100
          : null,
      totalHits,
      maxPossibleHits: maxHits,
    },
    meta: {
      firstSignalAt: firstSignal?.createdAt.toISOString() ?? null,
      firstEventAt: firstEvent?.createdAt.toISOString() ?? null,
      oddsSnapshotsTotal,
      eventsTotal,
      tournamentsTotal,
    },
    byMarket,
    data: rows.map((r) => ({
      id: r.id,
      superbetEventId: r.superbetEventId,
      matchName: r.matchName,
      matchDate: r.matchDate.toISOString(),
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      resolvedAt: r.resolvedAt?.toISOString() ?? null,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      hitOneX2: r.hitOneX2,
      hitBtts: r.hitBtts,
      hitTeamOu: r.hitTeamOu,
      hitsTotal: r.hitsTotal,
      picksCount: parsePicksKeys(r.picksJson).size,
      grades: gradesMapFromRow(r),
      oddsAtSignalLines: oddsAtSignalLineCount(r.oddsAtSignalJson),
    })),
  });
}
