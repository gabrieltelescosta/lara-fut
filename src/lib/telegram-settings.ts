import { prisma } from "@/lib/prisma";

const SETTINGS_ID = 1;

export type ResolvedTelegramSettings = {
  enabled: boolean;
  botToken: string;
  chatId: string;
  /** Equivalente a `TELEGRAM_SIGNAL_MARKETS` após merge. */
  telegramSignalMarketsCsv: string;
  galeMaxRecoveries: number;
  timezone: string;
};

function envTelegramEnabled(): boolean {
  const v = process.env.TELEGRAM_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function parseEnvGaleMax(): number {
  const n = Number.parseInt(process.env.TELEGRAM_GALE_MAX ?? "3", 10);
  if (Number.isNaN(n) || n < 0) return 3;
  return Math.min(10, n);
}

function mergeGaleMax(rowGale: number | null | undefined): number {
  if (rowGale != null && Number.isFinite(rowGale)) {
    return Math.max(0, Math.min(10, Math.floor(rowGale)));
  }
  return parseEnvGaleMax();
}

/**
 * Lê singleton na BD e faz merge com `TELEGRAM_*` do env (BD prevalece quando preenchida).
 */
export async function getResolvedTelegramSettings(): Promise<ResolvedTelegramSettings> {
  const row = await prisma.telegramAppSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const enabled =
    row?.enabled !== null && row?.enabled !== undefined
      ? row.enabled
      : envTelegramEnabled();

  const botToken =
    row?.botToken?.trim() || process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const chatId =
    row?.chatId?.trim() || process.env.TELEGRAM_CHAT_ID?.trim() || "";

  const telegramSignalMarketsCsv =
    row?.signalMarkets?.trim() ||
    process.env.TELEGRAM_SIGNAL_MARKETS?.trim() ||
    "";

  const galeMaxRecoveries = mergeGaleMax(row?.galeMax);

  const timezone =
    row?.timezone?.trim() ||
    process.env.TELEGRAM_TIMEZONE?.trim() ||
    "America/Sao_Paulo";

  return {
    enabled,
    botToken,
    chatId,
    telegramSignalMarketsCsv,
    galeMaxRecoveries,
    timezone,
  };
}

export function maskBotToken(token: string): {
  configured: boolean;
  last4: string | null;
} {
  const t = token.trim();
  if (!t) return { configured: false, last4: null };
  if (t.length <= 4) return { configured: true, last4: t };
  return { configured: true, last4: t.slice(-4) };
}
