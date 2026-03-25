import {
  parseSignalRankMarket,
  signalBestHomeTeamOnly,
} from "@/lib/home-team-assertiveness";
import {
  getEnabledSignalMarkets,
  IMPLEMENTED_MARKET_IDS,
  marketDisplayName,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import type { GradeResult, StoredPicksJson } from "@/lib/signal-picks";

function parseTelegramMarketList(raw: string): ImplementedMarketId[] {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const out: ImplementedMarketId[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!(IMPLEMENTED_MARKET_IDS as readonly string[]).includes(part)) {
      console.warn(`[telegram] TELEGRAM_SIGNAL_MARKETS: id ignorado: "${part}"`);
      continue;
    }
    if (seen.has(part)) continue;
    seen.add(part);
    out.push(part as ImplementedMarketId);
  }
  return out;
}

/**
 * Mercados nas mensagens Telegram.
 * Com `SIGNAL_BEST_HOME_TEAM_ONLY`: **um** mercado — o de ranking (`SIGNAL_RANK_MARKET`, default teamOu)
 * se `TELEGRAM_SIGNAL_MARKETS` estiver vazio; senão só o **primeiro** id da lista.
 * Sem essa flag: vazio → igual a `SIGNAL_MARKETS_ENABLED`; senão lista completa válida.
 */
export function getTelegramSignalMarkets(): ImplementedMarketId[] {
  const raw = process.env.TELEGRAM_SIGNAL_MARKETS?.trim();

  if (signalBestHomeTeamOnly()) {
    const rank = parseSignalRankMarket();
    if (!raw || raw.length === 0) {
      return [rank];
    }
    const list = parseTelegramMarketList(raw);
    if (list.length === 0) {
      return [rank];
    }
    if (list.length > 1) {
      console.warn(
        "[telegram] SIGNAL_BEST_HOME_TEAM_ONLY: TELEGRAM_SIGNAL_MARKETS tem vários ids — a usar só o primeiro.",
      );
    }
    return [list[0]];
  }

  if (!raw || raw.length === 0) {
    return getEnabledSignalMarkets();
  }
  const list = parseTelegramMarketList(raw);
  if (list.length === 0) {
    console.warn(
      "[telegram] TELEGRAM_SIGNAL_MARKETS vazio após parse — a usar SIGNAL_MARKETS_ENABLED.",
    );
    return getEnabledSignalMarkets();
  }
  return list;
}

export function isTelegramEnabled(): boolean {
  const v = process.env.TELEGRAM_ENABLED?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  return false;
}

export type TelegramSendResult = {
  ok: boolean;
  messageId?: number;
};

/**
 * Envia texto ao chat configurado. Erros são logados; não lança.
 */
export async function sendTelegramMessage(text: string): Promise<TelegramSendResult> {
  if (!isTelegramEnabled()) return { ok: false };
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.warn(
      "[telegram] TELEGRAM_ENABLED mas falta TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID",
    );
    return { ok: false };
  }
  const body = {
    chat_id: chatId,
    text: text.slice(0, 4096),
  };
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const raw = await r.text();
    if (!r.ok) {
      console.warn("[telegram] sendMessage failed:", raw);
      return { ok: false };
    }
    let data: { result?: { message_id?: number } };
    try {
      data = JSON.parse(raw) as { result?: { message_id?: number } };
    } catch {
      return { ok: false };
    }
    const messageId = data.result?.message_id;
    return { ok: true, messageId };
  } catch (e) {
    console.warn("[telegram] sendMessage error:", e);
    return { ok: false };
  }
}

/**
 * Edita mensagem existente (mesmo chat do `.env`).
 */
export async function editTelegramMessage(
  messageId: number,
  text: string,
): Promise<boolean> {
  if (!isTelegramEnabled()) return false;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) {
    console.warn(
      "[telegram] TELEGRAM_ENABLED mas falta TELEGRAM_BOT_TOKEN ou TELEGRAM_CHAT_ID",
    );
    return false;
  }
  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 4096),
  };
  try {
    const r = await fetch(
      `https://api.telegram.org/bot${token}/editMessageText`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    if (!r.ok) {
      console.warn("[telegram] editMessageText failed:", await r.text());
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[telegram] editMessageText error:", e);
    return false;
  }
}

export function buildTelegramResolvedMessage(params: {
  matchName: string;
  homeScore: number;
  awayScore: number;
  picks: StoredPicksJson;
  grade: GradeResult;
  telegramMarkets: ImplementedMarketId[];
}): string {
  const { matchName, homeScore, awayScore, picks, grade, telegramMarkets } =
    params;
  const lines: string[] = [
    "📊 Resultado",
    matchName,
    `⚽ Placar: ${homeScore}–${awayScore}`,
    "",
  ];

  let hitsTg = 0;
  let totalTg = 0;
  const detail: string[] = [];
  const p = picks as Record<string, unknown>;
  for (const id of telegramMarkets) {
    if (p[id] === undefined) continue;
    totalTg += 1;
    const ok = grade.byMarket[id];
    if (ok === true) hitsTg += 1;
    const symbol = ok === true ? "✓" : ok === false ? "✗" : "—";
    detail.push(`${marketDisplayName(id)}: ${symbol}`);
  }

  if (telegramMarkets.length <= 1) {
    lines.push(`Mercado: ${hitsTg}/${totalTg} acerto(s)`);
  } else {
    lines.push(`Acertos (filtro Telegram): ${hitsTg}/${totalTg}`);
    lines.push(`Acertos (sinal completo): ${grade.hitsTotal}`);
  }
  lines.push("");
  lines.push(...detail);

  return lines.join("\n");
}
