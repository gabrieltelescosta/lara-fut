import type { SuperbetEventItem } from "@/lib/types";

/**
 * Normaliza um item bruto da API v2 (campos podem variar ligeiramente).
 */
export function normalizeEventFromApi(raw: unknown): SuperbetEventItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const eventId = Number(r.eventId ?? r.offerId);
  if (!Number.isFinite(eventId)) return null;

  const matchName = String(r.matchName ?? "");
  const utcDate = String(r.utcDate ?? r.matchDate ?? "");
  if (!utcDate) return null;

  const tournamentId = Number(r.tournamentId);
  const sportId = Number(r.sportId);
  const categoryId = Number(r.categoryId);

  const counts =
    r.counts && typeof r.counts === "object"
      ? (r.counts as SuperbetEventItem["counts"])
      : undefined;
  const marketCount =
    typeof r.marketCount === "number" ? r.marketCount : undefined;

  let odds: SuperbetEventItem["odds"];
  if (Array.isArray(r.odds)) {
    odds = r.odds
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const o = row as Record<string, unknown>;
        const price = Number(o.price);
        if (!Number.isFinite(price)) return null;
        const marketName = String(o.marketName ?? "").trim();
        const name = String(o.name ?? "").trim();
        if (!marketName || !name) return null;
        const info =
          o.info != null && o.info !== ""
            ? String(o.info).trim()
            : undefined;
        return { marketName, name, price, info };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);
    if (odds.length === 0) odds = undefined;
  }

  return {
    eventId,
    matchName,
    tournamentId: Number.isFinite(tournamentId) ? tournamentId : 0,
    sportId: Number.isFinite(sportId) ? sportId : 190,
    categoryId: Number.isFinite(categoryId) ? categoryId : 0,
    utcDate,
    matchDate:
      typeof r.matchDate === "string" ? r.matchDate : undefined,
    counts,
    marketCount,
    odds,
  };
}

/** Linhas de odds esperadas no estado prematch ativo (`counts.odds["1"]`). */
export function expectedPrematchOddsLines(item: SuperbetEventItem): number {
  const o = item.counts?.odds;
  if (!o || typeof o !== "object") return 0;
  const n = Number(o["1"]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * `prematch` + `settled` podem repetir o mesmo `eventId`. A oferta **settled**
 * muitas vezes traz só 3 linhas (1X2); se processarmos depois, apagamos as ~80+
 * linhas do pré-jogo. Mantém sempre o item com **mais** linhas de odds.
 */
export function mergeOfferListsPreferRicherOdds(
  prematch: SuperbetEventItem[],
  settled: SuperbetEventItem[],
): SuperbetEventItem[] {
  const map = new Map<number, SuperbetEventItem>();
  for (const item of [...prematch, ...settled]) {
    const prev = map.get(item.eventId);
    if (!prev) {
      map.set(item.eventId, item);
      continue;
    }
    const a = prev.odds?.length ?? 0;
    const b = item.odds?.length ?? 0;
    if (b > a) map.set(item.eventId, item);
  }
  return [...map.values()];
}
