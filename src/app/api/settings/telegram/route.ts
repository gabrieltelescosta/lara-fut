import { authorizeCronRequest } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import {
  getResolvedTelegramSettings,
  maskBotToken,
} from "@/lib/telegram-settings";
import { NextResponse, type NextRequest } from "next/server";

const SETTINGS_ID = 1;

export const dynamic = "force-dynamic";

function envTelegramEnabledRaw(): boolean {
  const v = process.env.TELEGRAM_ENABLED?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

export async function GET(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await prisma.telegramAppSettings.findUnique({
    where: { id: SETTINGS_ID },
  });
  const resolved = await getResolvedTelegramSettings();

  const tokenSource = row?.botToken?.trim()
    ? row.botToken.trim()
    : process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const mask = maskBotToken(tokenSource);

  return NextResponse.json({
    enabled:
      row?.enabled !== null && row?.enabled !== undefined
        ? row.enabled
        : null,
    enabledEffective: resolved.enabled,
    envFallbackEnabled: envTelegramEnabledRaw(),
    chatId: row?.chatId ?? "",
    chatIdEffective: resolved.chatId,
    signalMarkets: row?.signalMarkets ?? "",
    signalMarketsEffective: resolved.telegramSignalMarketsCsv,
    galeMax: row?.galeMax ?? null,
    galeMaxEffective: resolved.galeMaxRecoveries,
    timezone: row?.timezone ?? "",
    timezoneEffective: resolved.timezone,
    botTokenConfigured: mask.configured,
    botTokenLast4: mask.last4,
  });
}

type PutBody = {
  enabled?: boolean | null;
  chatId?: string;
  signalMarkets?: string;
  galeMax?: number | null;
  timezone?: string;
  /** Vazio = não alterar token guardado. */
  botToken?: string;
};

export async function PUT(req: NextRequest) {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PutBody;
  try {
    body = (await req.json()) as PutBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.telegramAppSettings.findUnique({
    where: { id: SETTINGS_ID },
  });

  const nextToken =
    typeof body.botToken === "string" && body.botToken.trim().length > 0
      ? body.botToken.trim()
      : existing?.botToken ?? null;

  await prisma.telegramAppSettings.upsert({
    where: { id: SETTINGS_ID },
    create: {
      id: SETTINGS_ID,
      enabled:
        body.enabled === undefined || body.enabled === null
          ? null
          : Boolean(body.enabled),
      chatId: body.chatId?.trim() || null,
      signalMarkets: body.signalMarkets?.trim() || null,
      galeMax:
        body.galeMax === undefined || body.galeMax === null
          ? null
          : Math.max(0, Math.min(10, Math.floor(Number(body.galeMax)))),
      timezone: body.timezone?.trim() || null,
      botToken: nextToken,
    },
    update: {
      ...(body.enabled !== undefined
        ? {
            enabled:
              body.enabled === null ? null : Boolean(body.enabled),
          }
        : {}),
      ...(body.chatId !== undefined
        ? { chatId: body.chatId.trim() || null }
        : {}),
      ...(body.signalMarkets !== undefined
        ? { signalMarkets: body.signalMarkets.trim() || null }
        : {}),
      ...(body.galeMax !== undefined
        ? {
            galeMax:
              body.galeMax === null
                ? null
                : Math.max(0, Math.min(10, Math.floor(Number(body.galeMax)))),
          }
        : {}),
      ...(body.timezone !== undefined
        ? { timezone: body.timezone.trim() || null }
        : {}),
      ...(typeof body.botToken === "string" && body.botToken.trim().length > 0
        ? { botToken: body.botToken.trim() }
        : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
