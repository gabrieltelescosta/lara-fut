import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma";
import { settlementFromJson } from "@/lib/settlement-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? "20")),
  );
  const tournamentId = searchParams.get("tournamentId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: Prisma.ResultWhereInput = {};
  if (tournamentId) {
    where.event = {
      is: { tournamentId: Number.parseInt(tournamentId, 10) },
    };
  }
  if (from || to) {
    where.finishedAt = {};
    if (from) where.finishedAt.gte = new Date(from);
    if (to) where.finishedAt.lte = new Date(to);
  }

  const [total, rows] = await Promise.all([
    prisma.result.count({ where }),
    prisma.result.findMany({
      where,
      include: {
        event: { include: { tournament: true } },
      },
      orderBy: { finishedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    data: rows.map((r) => ({
      resultId: r.id,
      superbetEventId: r.event.superbetEventId,
      matchName: r.event.matchName,
      matchDate: r.event.matchDate.toISOString(),
      tournamentId: r.event.tournamentId,
      tournamentName: r.event.tournament?.name ?? null,
      homeScore: r.homeScore,
      awayScore: r.awayScore,
      status: r.event.status,
      finishedAt: r.finishedAt.toISOString(),
      settlement: settlementFromJson(r.settlementJson),
    })),
  });
}
