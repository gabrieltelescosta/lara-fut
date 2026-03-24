import { prisma } from "@/lib/prisma";
import { groupLatestOddsByEventId } from "@/lib/odds-snapshot-utils";
import type { SettlementPayload } from "@/lib/odds-settlement";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function settlementSummary(
  raw: string | null | undefined,
): {
  snapshotCapturedAt: string | null;
  parsedCount: number;
  unparsedCount: number;
  totalLines: number;
} | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as SettlementPayload;
    if (!j.lines) return null;
    return {
      snapshotCapturedAt: j.snapshotCapturedAt ?? null,
      parsedCount: j.parsedCount ?? 0,
      unparsedCount: j.unparsedCount ?? 0,
      totalLines: j.lines.length,
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const now = new Date();
  const from = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const full = req.nextUrl.searchParams.get("full") === "1";

  const events = await prisma.event.findMany({
    where: {
      matchDate: { gte: from },
    },
    include: {
      tournament: true,
      result: true,
    },
    orderBy: { matchDate: "asc" },
    take: 200,
  });

  const eventIds = events.map((e) => e.id);
  const allOdds =
    eventIds.length === 0
      ? []
      : await prisma.oddsSnapshot.findMany({
          where: { eventId: { in: eventIds } },
        });
  const latestByEvent = groupLatestOddsByEventId(allOdds);

  return NextResponse.json({
    at: now.toISOString(),
    full,
    data: events.map((e) => {
      const snap = latestByEvent.get(e.id) ?? [];
      const ordered = [...snap].sort((a, b) =>
        `${a.marketName}|${a.outcomeName}`.localeCompare(
          `${b.marketName}|${b.outcomeName}`,
          "en",
        ),
      );
      const sum = settlementSummary(e.result?.settlementJson);
      const row: Record<string, unknown> = {
        id: e.id,
        superbetEventId: e.superbetEventId,
        matchName: e.matchName,
        matchDate: e.matchDate.toISOString(),
        status: e.status,
        homeScore: e.homeScore,
        awayScore: e.awayScore,
        tournamentId: e.tournamentId,
        finishedAt: e.finishedAt?.toISOString() ?? null,
        hasResult: !!e.result,
        hasListingPayload: Boolean(e.listingPayloadJson),
        hasSubscriptionPayload: Boolean(e.subscriptionPayloadJson),
        settlement: sum,
        odds: ordered.map((o) => ({
          marketName: o.marketName,
          outcomeName: o.outcomeName,
          price: o.price,
          info: o.info,
          capturedAt: o.capturedAt.toISOString(),
          snapshotBatch: o.snapshotBatch || undefined,
        })),
        oddsCount: ordered.length,
      };
      if (full) {
        row.listingPayloadJson = e.listingPayloadJson;
        row.subscriptionPayloadJson = e.subscriptionPayloadJson;
        row.settlementJson = e.result?.settlementJson ?? null;
      }
      return row;
    }),
  });
}
