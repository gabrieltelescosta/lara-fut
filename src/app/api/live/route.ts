import { prisma } from "@/lib/prisma";
import { groupLatestOddsByEventId } from "@/lib/odds-snapshot-utils";
import { settlementFromJson } from "@/lib/settlement-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
      const settlement = settlementFromJson(e.result?.settlementJson);
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
        settlement,
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
