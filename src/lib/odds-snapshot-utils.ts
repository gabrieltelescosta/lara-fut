import { createHash } from "node:crypto";
import type { SuperbetEventItem } from "@/lib/types";

export function hashOddsContent(
  odds: NonNullable<SuperbetEventItem["odds"]>,
): string {
  const normalized = [...odds]
    .map((o) => ({
      m: o.marketName?.trim() ?? "",
      n: o.name?.trim() ?? "",
      p: o.price,
      i: o.info?.trim() ?? "",
    }))
    .sort((a, b) =>
      `${a.m}|${a.n}|${a.i}`.localeCompare(`${b.m}|${b.n}|${b.i}`, "en"),
    );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export type OddsRow = {
  marketName: string;
  outcomeName: string;
  price: number;
  info: string | null;
  capturedAt: Date;
};

/** Mantém só as linhas do lote com `capturedAt` mais recente (por evento, usar com linhas desse evento). */
export function pickLatestOddsRows<T extends OddsRow>(rows: T[]): T[] {
  if (rows.length === 0) return [];
  let max = -Infinity;
  for (const r of rows) {
    const t = r.capturedAt.getTime();
    if (t > max) max = t;
  }
  return rows.filter((r) => r.capturedAt.getTime() === max);
}

export function groupLatestOddsByEventId<
  T extends OddsRow & { eventId: string },
>(rows: T[]): Map<string, T[]> {
  const byEvent = new Map<string, T[]>();
  for (const r of rows) {
    const list = byEvent.get(r.eventId);
    if (list) list.push(r);
    else byEvent.set(r.eventId, [r]);
  }
  const out = new Map<string, T[]>();
  for (const [eid, list] of byEvent) {
    out.set(eid, pickLatestOddsRows(list));
  }
  return out;
}
