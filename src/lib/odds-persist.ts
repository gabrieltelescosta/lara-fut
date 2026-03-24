import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashOddsContent } from "@/lib/odds-snapshot-utils";
import type { SuperbetEventItem } from "@/lib/types";

const INSERT_CHUNK = 200;

function skipOddsHashDedupe(): boolean {
  return process.env.ODDS_SKIP_HASH_DEDUPE === "true";
}

/**
 * Acrescenta um lote de odds (histórico). Por omissão não duplica lote idêntico;
 * com `ODDS_SKIP_HASH_DEDUPE=true` grava sempre (útil para auditoria contínua).
 */
export async function replaceEventOddsSnapshots(
  eventId: string,
  odds: NonNullable<SuperbetEventItem["odds"]>,
): Promise<{ count: number; skippedDuplicate?: boolean }> {
  if (odds.length === 0) return { count: 0 };

  const contentHash = hashOddsContent(odds);
  if (!skipOddsHashDedupe()) {
    const last = await prisma.oddsSnapshot.findFirst({
      where: { eventId },
      orderBy: { capturedAt: "desc" },
      select: { contentHash: true },
    });
    if (last?.contentHash === contentHash) {
      return { count: 0, skippedDuplicate: true };
    }
  }

  const capturedAt = new Date();
  const snapshotBatch = randomUUID();

  let count = 0;
  for (let i = 0; i < odds.length; i += INSERT_CHUNK) {
    const slice = odds.slice(i, i + INSERT_CHUNK);
    await prisma.oddsSnapshot.createMany({
      data: slice.map((o) => ({
        eventId,
        marketName: o.marketName?.trim() || "—",
        outcomeName: o.name?.trim() || "—",
        price: o.price,
        info: o.info?.trim() || null,
        capturedAt,
        contentHash,
        snapshotBatch,
      })),
    });
    count += slice.length;
  }

  return { count };
}
