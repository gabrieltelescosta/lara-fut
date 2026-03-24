import { prisma } from "@/lib/prisma";
import {
  chunkIds,
  fetchEventById,
  fetchEventsByDate,
  fetchSubscriptionEvents,
} from "@/lib/superbet-api";
import {
  expectedPrematchOddsLines,
  mergeOfferListsPreferRicherOdds,
  normalizeEventFromApi,
} from "@/lib/offer-normalize";
import {
  generateUpcomingSignals,
  pruneDistantPendingSignals,
  resolveSignalPredictions,
} from "@/lib/signal-lifecycle";
import { replaceEventOddsSnapshots } from "@/lib/odds-persist";
import { computeAndPersistSettlementForResult } from "@/lib/odds-settlement";
import { refreshStrategySimulation } from "@/lib/strategy-sim-persist";
import type { CollectorRunResult, SuperbetEventItem } from "@/lib/types";

/** Omisso = ligado (compatível com deploys antigos). `false` / `0` / `no` / `off` = só captura. */
function isSignalsEnabled(): boolean {
  const v = process.env.ENABLE_SIGNALS;
  if (v === undefined || v === "") return true;
  const s = v.trim().toLowerCase();
  return s !== "false" && s !== "0" && s !== "no" && s !== "off";
}

const BATCH = 25;
/** Paralelismo ao buscar `/events/{id}` (oferta completa; by-date traz só pré-selecionadas). */
const HYDRATE_CONCURRENCY = 8;

async function hydrateOfferItem(
  item: SuperbetEventItem,
  errors: string[],
): Promise<SuperbetEventItem> {
  const expected = expectedPrematchOddsLines(item);
  const have = item.odds?.length ?? 0;
  if (expected <= have) return item;
  try {
    const raw = await fetchEventById(item.eventId);
    const full = normalizeEventFromApi(raw);
    if (full && (full.odds?.length ?? 0) > have) return full;
  } catch (e) {
    errors.push(
      `hydrate ${item.eventId}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return item;
}

function parseScores(
  home?: string,
  away?: string,
): { home: number | null; away: number | null } {
  const h = home != null && home !== "" ? Number.parseInt(home, 10) : NaN;
  const a = away != null && away !== "" ? Number.parseInt(away, 10) : NaN;
  return {
    home: Number.isFinite(h) ? h : null,
    away: Number.isFinite(a) ? a : null,
  };
}

async function upsertTournamentFromEvent(item: SuperbetEventItem) {
  await prisma.tournament.upsert({
    where: { id: item.tournamentId },
    create: {
      id: item.tournamentId,
      sportId: item.sportId,
      categoryId: item.categoryId,
      name: null,
    },
    update: {
      sportId: item.sportId,
      categoryId: item.categoryId,
    },
  });
}

export async function runCollector(): Promise<CollectorRunResult> {
  const errors: string[] = [];
  const now = new Date();
  // Wider window: prematch listings are sparse in a 1h–2h slice; API often has many events per day.
  const start = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  let eventsListed = 0;
  let subscriptionBatches = 0;
  let upsertedEvents = 0;
  let updatedFromSubscription = 0;
  let newResults = 0;
  let signalsCreated = 0;
  let signalsResolved = 0;
  let signalsPruned = 0;
  const captureOnly = !isSignalsEnabled();

  try {
    const [prematchList, settledList] = await Promise.all([
      fetchEventsByDate({ startDate: start, endDate: end, offerState: "prematch" }),
      fetchEventsByDate({ startDate: start, endDate: end, offerState: "settled" }),
    ]);
    const prematchItems = (prematchList.data ?? [])
      .map((r) => normalizeEventFromApi(r))
      .filter((x): x is SuperbetEventItem => x != null);
    const settledItems = (settledList.data ?? [])
      .map((r) => normalizeEventFromApi(r))
      .filter((x): x is SuperbetEventItem => x != null);
    const merged = mergeOfferListsPreferRicherOdds(prematchItems, settledItems);
    eventsListed = merged.length;

    const hydrated: SuperbetEventItem[] = [];
    for (let i = 0; i < merged.length; i += HYDRATE_CONCURRENCY) {
      const chunk = merged.slice(i, i + HYDRATE_CONCURRENCY);
      const part = await Promise.all(
        chunk.map((it) => hydrateOfferItem(it, errors)),
      );
      hydrated.push(...part);
    }

    const seenIds = new Set<number>();
    for (const item of hydrated) {
      try {
        await upsertTournamentFromEvent(item);
        const matchDate = new Date(item.utcDate);
        await prisma.event.upsert({
          where: { superbetEventId: item.eventId },
          create: {
            superbetEventId: item.eventId,
            tournamentId: item.tournamentId,
            matchName: item.matchName,
            matchDate,
            status: "listed",
            listingPayloadJson: JSON.stringify(item),
          },
          update: {
            matchName: item.matchName,
            matchDate,
            tournamentId: item.tournamentId,
            listingPayloadJson: JSON.stringify(item),
          },
        });
        upsertedEvents += 1;
        seenIds.add(item.eventId);

        if (item.odds?.length) {
          const ev = await prisma.event.findUnique({
            where: { superbetEventId: item.eventId },
            select: { id: true },
          });
          if (ev) {
            await replaceEventOddsSnapshots(ev.id, item.odds);
          }
        }
      } catch (e) {
        errors.push(
          `event ${item.eventId}: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    // Also query subscription for DB events that never got a result (they cycle out of the listing quickly).
    const pending = await prisma.event.findMany({
      where: { result: null, finishedAt: null },
      select: { superbetEventId: true },
    });
    for (const p of pending) {
      seenIds.add(p.superbetEventId);
    }

    const idList = [...seenIds];
    const batches = chunkIds(idList, BATCH);

    for (const batch of batches) {
      subscriptionBatches += 1;
      let payloads: Awaited<ReturnType<typeof fetchSubscriptionEvents>> = [];
      try {
        payloads = await fetchSubscriptionEvents(batch);
      } catch (e) {
        errors.push(
          `subscription batch: ${e instanceof Error ? e.message : String(e)}`,
        );
        continue;
      }

      for (const p of payloads) {
        try {
          const meta = p.inplay_stats_metadata;
          const stats = p.inplay_stats;
          const status = meta?.status ?? "unknown";
          const { home, away } = parseScores(
            stats?.home_team_score,
            stats?.away_team_score,
          );

          const existing = await prisma.event.findUnique({
            where: { superbetEventId: p.event_id },
            include: { result: true },
          });

          if (!existing) continue;

          updatedFromSubscription += 1;

          await prisma.event.update({
            where: { id: existing.id },
            data: {
              status,
              homeScore: home,
              awayScore: away,
              periodScores: stats?.periods
                ? JSON.parse(JSON.stringify(stats.periods))
                : undefined,
              finishedAt:
                status === "FINISHED" ? new Date() : existing.finishedAt,
              subscriptionPayloadJson: JSON.stringify(p),
            },
          });

          if (
            status === "FINISHED" &&
            home !== null &&
            away !== null &&
            !existing.result
          ) {
            const createdRes = await prisma.result.create({
              data: {
                eventId: existing.id,
                homeScore: home,
                awayScore: away,
                periodScores: stats?.periods
                  ? JSON.parse(JSON.stringify(stats.periods))
                  : undefined,
                finishedAt: new Date(),
              },
            });
            newResults += 1;
            try {
              await computeAndPersistSettlementForResult(createdRes.id);
            } catch (e) {
              errors.push(
                `settlement ${p.event_id}: ${e instanceof Error ? e.message : String(e)}`,
              );
            }
          }
        } catch (e) {
          errors.push(
            `payload ${p.event_id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }

  if (!captureOnly) {
    try {
      const pr = await pruneDistantPendingSignals();
      signalsPruned = pr.pruned;
      const gen = await generateUpcomingSignals();
      signalsCreated = gen.created;
      const res = await resolveSignalPredictions();
      signalsResolved = res.resolved;
      try {
        await refreshStrategySimulation();
      } catch (e2) {
        errors.push(
          `sim-estrategia: ${e2 instanceof Error ? e2.message : String(e2)}`,
        );
      }
    } catch (e) {
      errors.push(
        `sinais: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    at: new Date().toISOString(),
    eventsListed,
    subscriptionBatches,
    upsertedEvents,
    updatedFromSubscription,
    newResults,
    signalsCreated,
    signalsResolved,
    signalsPruned,
    captureOnly,
    errors,
  };
}
