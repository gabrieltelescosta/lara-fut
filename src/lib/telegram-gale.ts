import { prisma } from "@/lib/prisma";
import { signalBestHomeTeamOnly } from "@/lib/home-team-assertiveness";
import {
  buildTelegramGaleFinalGreen,
  buildTelegramGaleFinalRed,
  buildTelegramGaleInterimRed,
  buildTelegramSignalCard,
  formatKickoffHHmm,
  primaryMarketHit,
} from "@/lib/telegram-format";
import {
  marketDisplayName,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import {
  countActivePicks,
  type GradeResult,
  type StoredPicksJson,
} from "@/lib/signal-picks";
import { recoveryStake } from "@/lib/gale-simulation";
import { getResolvedTelegramSettings } from "@/lib/telegram-settings";
import {
  buildTelegramResolvedMessage,
  editTelegramMessage,
  getTelegramSignalMarkets,
  isTelegramEnabled,
  sendTelegramMessage,
} from "@/lib/telegram";

const STATE_ID = 1;
const DEFAULT_BASE_STAKE = 10;

export async function getTelegramGaleMaxRecoveries(): Promise<number> {
  const r = await getResolvedTelegramSettings();
  return r.galeMaxRecoveries;
}

/** Total de jogadas na cadeia: 1 entrada + N gales. */
export async function getTelegramMaxAttemptsInChain(): Promise<number> {
  return 1 + (await getTelegramGaleMaxRecoveries());
}

async function loadState() {
  const maxA = await getTelegramMaxAttemptsInChain();
  return prisma.telegramGaleState.upsert({
    where: { id: STATE_ID },
    create: {
      id: STATE_ID,
      maxAttempts: maxA,
    },
    update: {},
  });
}

async function saveState(data: {
  messageId: number | null;
  currentAttempt: number;
  maxAttempts: number;
  pendingEditNext: boolean;
  accumulatedLoss: number;
  initialOdd: number | null;
  baseStake: number;
}) {
  await prisma.telegramGaleState.update({
    where: { id: STATE_ID },
    data: {
      messageId: data.messageId,
      currentAttempt: data.currentAttempt,
      maxAttempts: data.maxAttempts,
      pendingEditNext: data.pendingEditNext,
      accumulatedLoss: data.accumulatedLoss,
      initialOdd: data.initialOdd,
      baseStake: data.baseStake,
    },
  });
}

function resetChainFields() {
  return {
    accumulatedLoss: 0,
    initialOdd: null as number | null,
    baseStake: DEFAULT_BASE_STAKE,
  };
}

function primaryOddFromParams(
  oddsByMarket: Partial<Record<ImplementedMarketId, number | null>> | undefined,
): number | null {
  if (!oddsByMarket) return null;
  const v = oddsByMarket.teamOu;
  if (typeof v === "number" && Number.isFinite(v) && v > 1) return v;
  return null;
}

async function nextEventKickoffHint(
  after: Date,
  timeZone: string,
): Promise<string | null> {
  const ev = await prisma.event.findFirst({
    where: {
      result: null,
      matchDate: { gt: after },
    },
    orderBy: { matchDate: "asc" },
    select: { matchDate: true },
  });
  if (!ev) return null;
  return formatKickoffHHmm(ev.matchDate, timeZone);
}

export async function notifyTelegramSignalCreated(params: {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  tgPicks: StoredPicksJson;
  roundsUsed: number;
  rankLine?: string;
  oddsByMarket?: Partial<Record<ImplementedMarketId, number | null>>;
}): Promise<void> {
  if (!(await isTelegramEnabled())) return;

  const settings = await getResolvedTelegramSettings();
  const tgMarkets = await getTelegramSignalMarkets();
  if (countActivePicks(params.tgPicks) === 0) return;

  if (!signalBestHomeTeamOnly()) {
    const nextHint = await nextEventKickoffHint(
      params.matchDate,
      settings.timezone,
    );
    const body = buildTelegramSignalCard({
      homeTeam: params.homeTeam,
      awayTeam: params.awayTeam,
      matchDate: params.matchDate,
      picks: params.tgPicks,
      telegramMarkets: tgMarkets,
      roundsUsed: params.roundsUsed,
      timeZone: settings.timezone,
      rankLine: params.rankLine,
      nextKickoffHint: nextHint,
      oddsByMarket: params.oddsByMarket,
    });
    await sendTelegramMessage(body);
    return;
  }

  const maxA = await getTelegramMaxAttemptsInChain();
  let state = await loadState();
  if (state.maxAttempts !== maxA) {
    await prisma.telegramGaleState.update({
      where: { id: STATE_ID },
      data: { maxAttempts: maxA },
    });
    state = await loadState();
  }

  const nextHint = await nextEventKickoffHint(
    params.matchDate,
    settings.timezone,
  );
  const displayAttempt = state.pendingEditNext
    ? state.currentAttempt + 1
    : Math.max(1, state.currentAttempt || 1);
  const attemptLabel = `Tentativa ${displayAttempt}/${state.maxAttempts} na cadeia`;

  const currentOdd = primaryOddFromParams(params.oddsByMarket);

  const isNewChain = !state.pendingEditNext || state.currentAttempt === 0;
  let stakeHint: string | undefined;
  if (!isNewChain && state.accumulatedLoss > 0 && currentOdd && currentOdd > 1) {
    const initOdd = state.initialOdd ?? currentOdd;
    const desiredProfit = state.baseStake * (initOdd - 1);
    const suggested = recoveryStake(state.accumulatedLoss, desiredProfit, currentOdd);
    stakeHint = `💰 Stake sugerido: ${suggested.toFixed(2)} (recuperar ${state.accumulatedLoss.toFixed(2)} + lucro)`;
  }

  const body = buildTelegramSignalCard({
    homeTeam: params.homeTeam,
    awayTeam: params.awayTeam,
    matchDate: params.matchDate,
    picks: params.tgPicks,
    telegramMarkets: tgMarkets,
    roundsUsed: params.roundsUsed,
    timeZone: settings.timezone,
    rankLine: params.rankLine,
    attemptLabel: stakeHint ? `${attemptLabel}\n${stakeHint}` : attemptLabel,
    nextKickoffHint: nextHint,
    oddsByMarket: params.oddsByMarket,
  });

  if (state.pendingEditNext && state.messageId != null) {
    const ok = await editTelegramMessage(state.messageId, body);
    if (!ok) {
      const sent = await sendTelegramMessage(body);
      await saveState({
        messageId: sent.messageId ?? null,
        currentAttempt: state.currentAttempt + 1,
        maxAttempts: maxA,
        pendingEditNext: false,
        accumulatedLoss: state.accumulatedLoss,
        initialOdd: state.initialOdd,
        baseStake: state.baseStake,
      });
      return;
    }
    await saveState({
      messageId: state.messageId,
      currentAttempt: state.currentAttempt + 1,
      maxAttempts: maxA,
      pendingEditNext: false,
      accumulatedLoss: state.accumulatedLoss,
      initialOdd: state.initialOdd,
      baseStake: state.baseStake,
    });
    return;
  }

  const sent = await sendTelegramMessage(body);
  await saveState({
    messageId: sent.messageId ?? null,
    currentAttempt: 1,
    maxAttempts: maxA,
    pendingEditNext: false,
    accumulatedLoss: 0,
    initialOdd: currentOdd,
    baseStake: DEFAULT_BASE_STAKE,
  });
}

export async function notifyTelegramSignalResolved(params: {
  matchName: string;
  homeScore: number;
  awayScore: number;
  picks: StoredPicksJson;
  grade: GradeResult;
}): Promise<void> {
  if (!(await isTelegramEnabled())) {
    return;
  }

  const settings = await getResolvedTelegramSettings();

  if (!signalBestHomeTeamOnly()) {
    const text = buildTelegramResolvedMessage({
      matchName: params.matchName,
      homeScore: params.homeScore,
      awayScore: params.awayScore,
      picks: params.picks,
      grade: params.grade,
      telegramMarkets: await getTelegramSignalMarkets(),
    });
    await sendTelegramMessage(text);
    return;
  }

  const tgMarkets = await getTelegramSignalMarkets();
  const primary = tgMarkets[0];
  if (!primary) return;

  const hit = primaryMarketHit(params.grade, primary);
  const marketLabel = marketDisplayName(primary);

  const state = await loadState();
  const maxA = state.maxAttempts;
  const msgId = state.messageId;

  const currentStake = state.currentAttempt <= 1
    ? state.baseStake
    : (() => {
        const initOdd = state.initialOdd ?? 1.9;
        const desiredProfit = state.baseStake * (initOdd - 1);
        return recoveryStake(
          state.accumulatedLoss - state.baseStake,
          desiredProfit,
          initOdd,
        );
      })();

  if (hit === true) {
    const text = buildTelegramGaleFinalGreen({
      matchName: params.matchName,
      homeScore: params.homeScore,
      awayScore: params.awayScore,
      marketLabel,
      attempt: state.currentAttempt || 1,
    });
    if (msgId != null) {
      await editTelegramMessage(msgId, text);
    } else {
      await sendTelegramMessage(text);
    }
    await saveState({
      messageId: null,
      currentAttempt: 0,
      maxAttempts: await getTelegramMaxAttemptsInChain(),
      pendingEditNext: false,
      ...resetChainFields(),
    });
    return;
  }

  if (hit === false) {
    const stakeThisRound = state.currentAttempt <= 1
      ? state.baseStake
      : (() => {
          const initOdd = state.initialOdd ?? 1.9;
          const desiredProfit = state.baseStake * (initOdd - 1);
          const prevLoss = state.accumulatedLoss;
          return recoveryStake(prevLoss, desiredProfit, initOdd);
        })();

    const newAccLoss = state.accumulatedLoss + stakeThisRound;
    const nextHint = await nextEventKickoffHint(new Date(), settings.timezone);

    if (state.currentAttempt >= maxA) {
      const text = buildTelegramGaleFinalRed({
        matchName: params.matchName,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        marketLabel,
        attemptsUsed: state.currentAttempt,
        totalLoss: newAccLoss,
      });
      if (msgId != null) {
        await editTelegramMessage(msgId, text);
      } else {
        await sendTelegramMessage(text);
      }
      await saveState({
        messageId: null,
        currentAttempt: 0,
        maxAttempts: await getTelegramMaxAttemptsInChain(),
        pendingEditNext: false,
        ...resetChainFields(),
      });
      return;
    }

    const initOdd = state.initialOdd ?? 1.9;
    const desiredProfit = state.baseStake * (initOdd - 1);
    const suggestedNext = recoveryStake(newAccLoss, desiredProfit, initOdd);

    const text = buildTelegramGaleInterimRed({
      matchName: params.matchName,
      homeScore: params.homeScore,
      awayScore: params.awayScore,
      marketLabel,
      galeStep: state.currentAttempt,
      maxAttempts: maxA,
      nextKickoffHint: nextHint,
      suggestedStake: suggestedNext,
      accumulatedLoss: newAccLoss,
    });
    let outMid = msgId;
    if (outMid != null) {
      await editTelegramMessage(outMid, text);
    } else {
      const s = await sendTelegramMessage(text);
      outMid = s.messageId ?? null;
    }
    await saveState({
      messageId: outMid,
      currentAttempt: state.currentAttempt,
      maxAttempts: maxA,
      pendingEditNext: true,
      accumulatedLoss: newAccLoss,
      initialOdd: state.initialOdd,
      baseStake: state.baseStake,
    });
    return;
  }

  const fallback = buildTelegramResolvedMessage({
    matchName: params.matchName,
    homeScore: params.homeScore,
    awayScore: params.awayScore,
    picks: params.picks,
    grade: params.grade,
    telegramMarkets: tgMarkets,
  });
  await sendTelegramMessage(fallback);
}
