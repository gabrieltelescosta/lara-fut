import { prisma } from "@/lib/prisma";
import { parseMatchName } from "@/lib/match-name";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.result.findMany({
    select: {
      event: { select: { matchName: true } },
    },
  });

  const counts = new Map<string, number>();
  for (const r of rows) {
    const p = parseMatchName(r.event.matchName);
    if (!p) continue;
    for (const t of [p.home, p.away]) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  const teams = [...counts.entries()]
    .map(([name, games]) => ({ name, games }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name, "pt-BR"));

  return NextResponse.json({ teams });
}
