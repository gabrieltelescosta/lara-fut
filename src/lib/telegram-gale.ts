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
import { marketDisplayName } from "@/lib/signal-market-catalog";
import {
  countActivePicks,
  type GradeResult,
  type StoredPicksJson,
} from "@/lib/signal-picks";
import {
  buildTelegramResolvedMessage,
  editTelegramMessage,
  getTelegramSignalMarkets,
  isTelegramEnabled,
  sendTelegramMessage,
} from "@/lib/telegram";

const STATE_ID = 1;

export function getTelegramGaleMaxRecoveries(): number {
  const n = parseInt(process.env.TELEGRAM_GALE_MAX ?? "3", 10);
  if (Number.isNaN(n) || n < 0) return 3;
  return Math.min(10, n);
}

/** Total de jogadas na cadeia: 1 entrada + N gales. */
export function getTelegramMaxAttemptsInChain(): number {
  return 1 + getTelegramGaleMaxRecoveries();
}

async function loadState() {
  return prisma.telegramGaleState.upsert({
    where: { id: STATE_ID },
    create: {
      id: STATE_ID,
      maxAttempts: getTelegramMaxAttemptsInChain(),
    },
    update: {},
  });
}

async function saveState(data: {
  messageId: number | null;
  currentAttempt: number;
  maxAttempts: number;
  pendingEditNext: boolean;
}) {
  await prisma.telegramGaleState.update({
    where: { id: STATE_ID },
    data: {
      messageId: data.messageId,
      currentAttempt: data.currentAttempt,
      maxAttempts: data.maxAttempts,
      pendingEditNext: data.pendingEditNext,
    },
  });
}

async function nextEventKickoffHint(after: Date): Promise<string | null> {
  const ev = await prisma.event.findFirst({
    where: {
      result: null,
      matchDate: { gt: after },
    },
    orderBy: { matchDate: "asc" },
    select: { matchDate: true },
  });
  if (!ev) return null;
  return formatKickoffHHmm(ev.matchDate);
}

export async function notifyTelegramSignalCreated(params: {
  homeTeam: string;
  awayTeam: string;
  matchDate: Date;
  tgPicks: StoredPicksJson;
  roundsUsed: number;
  rankLine?: string;
}): Promise<void> {
  if (!isTelegramEnabled()) return;

  const tgMarkets = getTelegramSignalMarkets();
  if (countActivePicks(params.tgPicks) === 0) return;

  if (!signalBestHomeTeamOnly()) {
    const nextHint = await nextEventKickoffHint(params.matchDate);
    const body = buildTelegramSignalCard({
      homeTeam: params.homeTeam,
      awayTeam: params.awayTeam,
      matchDate: params.matchDate,
      picks: params.tgPicks,
      telegramMarkets: tgMarkets,
      roundsUsed: params.roundsUsed,
      rankLine: params.rankLine,
      nextKickoffHint: nextHint,
    });
    await sendTelegramMessage(body);
    return;
  }

  const maxA = getTelegramMaxAttemptsInChain();
  let state = await loadState();
  if (state.maxAttempts !== maxA) {
    await prisma.telegramGaleState.update({
      where: { id: STATE_ID },
      data: { maxAttempts: maxA },
    });
    state = await loadState();
  }

  const nextHint = await nextEventKickoffHint(params.matchDate);
  const displayAttempt = state.pendingEditNext
    ? state.currentAttempt + 1
    : Math.max(1, state.currentAttempt || 1);
  const attemptLabel = `Tentativa ${displayAttempt}/${state.maxAttempts} na cadeia`;

  const body = buildTelegramSignalCard({
    homeTeam: params.homeTeam,
    awayTeam: params.awayTeam,
    matchDate: params.matchDate,
    picks: params.tgPicks,
    telegramMarkets: tgMarkets,
    roundsUsed: params.roundsUsed,
    rankLine: params.rankLine,
    attemptLabel,
    nextKickoffHint: nextHint,
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
      });
      return;
    }
    await saveState({
      messageId: state.messageId,
      currentAttempt: state.currentAttempt + 1,
      maxAttempts: maxA,
      pendingEditNext: false,
    });
    return;
  }

  const sent = await sendTelegramMessage(body);
  await saveState({
    messageId: sent.messageId ?? null,
    currentAttempt: 1,
    maxAttempts: maxA,
    pendingEditNext: false,
  });
}

export async function notifyTelegramSignalResolved(params: {
  matchName: string;
  homeScore: number;
  awayScore: number;
  picks: StoredPicksJson;
  grade: GradeResult;
}): Promise<void> {
  if (!isTelegramEnabled()) {
    return;
  }

  if (!signalBestHomeTeamOnly()) {
    const text = buildTelegramResolvedMessage({
      matchName: params.matchName,
      homeScore: params.homeScore,
      awayScore: params.awayScore,
      picks: params.picks,
      grade: params.grade,
      telegramMarkets: getTelegramSignalMarkets(),
    });
    await sendTelegramMessage(text);
    return;
  }

  const tgMarkets = getTelegramSignalMarkets();
  const primary = tgMarkets[0];
  if (!primary) return;

  const hit = primaryMarketHit(params.grade, primary);
  const marketLabel = marketDisplayName(primary);

  const state = await loadState();
  const maxA = state.maxAttempts;
  const msgId = state.messageId;

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
      maxAttempts: getTelegramMaxAttemptsInChain(),
      pendingEditNext: false,
    });
    return;
  }

  if (hit === false) {
    const nextHint = await nextEventKickoffHint(new Date());
    if (state.currentAttempt >= maxA) {
      const text = buildTelegramGaleFinalRed({
        matchName: params.matchName,
        homeScore: params.homeScore,
        awayScore: params.awayScore,
        marketLabel,
        attemptsUsed: state.currentAttempt,
      });
      if (msgId != null) {
        await editTelegramMessage(msgId, text);
      } else {
        await sendTelegramMessage(text);
      }
      await saveState({
        messageId: null,
        currentAttempt: 0,
        maxAttempts: getTelegramMaxAttemptsInChain(),
        pendingEditNext: false,
      });
      return;
    }

    const text = buildTelegramGaleInterimRed({
      matchName: params.matchName,
      homeScore: params.homeScore,
      awayScore: params.awayScore,
      marketLabel,
      galeStep: state.currentAttempt,
      maxAttempts: maxA,
      nextKickoffHint: nextHint,
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
