import type {
  EventsByDateResponse,
  SubscriptionEventPayload,
} from "@/lib/types";

const OFFER_BASE =
  "https://production-superbet-offer-br.freetls.fastly.net";

const BR_TZ = "America/Sao_Paulo";

/**
 * Format instant as YYYY-MM-DD HH:mm:ss in Brazil wall clock.
 * Use a **space** between date and time: URLSearchParams encodes space as `+` in the query
 * string, which servers decode as space. A literal `+` in the value (sent as %2B) makes the API return 400.
 */
export function formatQueryDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BR_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPart["type"]) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

// identity avoids undici gzip stream errors ("terminated" / Z_DATA_ERROR) on large JSON.
const offerHeaders: Record<string, string> = {
  Accept: "application/json",
  Origin: "https://superbet.bet.br",
  "Accept-Encoding": "identity",
};

/**
 * List virtual football events (sportId=190) in a time window.
 */
export async function fetchEventsByDate(params: {
  startDate: Date;
  endDate: Date;
  sportId?: number;
  currentStatus?: string;
  offerState?: string;
}): Promise<EventsByDateResponse> {
  const sportId = params.sportId ?? 190;
  const currentStatus = params.currentStatus ?? "active";
  const offerState = params.offerState ?? "prematch";
  const qs = new URLSearchParams({
    currentStatus,
    offerState,
    startDate: formatQueryDate(params.startDate),
    endDate: formatQueryDate(params.endDate),
    sportId: String(sportId),
  });
  const url = `${OFFER_BASE}/v2/pt-BR/events/by-date?${qs.toString()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: offerHeaders,
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`events/by-date ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<EventsByDateResponse>;
}

/**
 * Detalhe completo de um evento — inclui **todas** as linhas de odds em prematch
 * (a listagem `by-date` só envia as pré-selecionadas, ~3 linhas).
 */
export async function fetchEventById(eventId: number): Promise<unknown | null> {
  const url = `${OFFER_BASE}/v2/pt-BR/events/${eventId}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: offerHeaders,
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    throw new Error(`events/${eventId} ${res.status}: ${await res.text()}`);
  }
  const j = (await res.json()) as {
    error?: boolean;
    data?: unknown[];
  };
  if (j.error || !Array.isArray(j.data) || j.data.length === 0) {
    return null;
  }
  return j.data[0];
}

/**
 * Parse first SSE `data:` line body (JSON array of subscription events).
 */
export function parseSubscriptionSseBody(text: string): SubscriptionEventPayload[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith("data:")) {
      const json = line.slice("data:".length).trim();
      if (!json || json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json) as unknown;
        if (Array.isArray(parsed)) {
          return parsed as SubscriptionEventPayload[];
        }
      } catch {
        // ignore malformed chunk
      }
    }
  }
  return [];
}

/**
 * Fetch subscription snapshot for event ids (scores + status).
 * The endpoint is SSE — it never closes on its own. We stream-read only until we get
 * the first `data:` line with a valid JSON array, then abort the connection.
 */
export async function fetchSubscriptionEvents(
  eventIds: number[],
): Promise<SubscriptionEventPayload[]> {
  if (eventIds.length === 0) return [];
  const qs = new URLSearchParams({
    events: eventIds.join(","),
    preselected: "true",
  });
  const url = `${OFFER_BASE}/v3/subscription/pt-BR/events?${qs.toString()}`;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 20_000);

  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        Accept: "text/event-stream",
        Origin: "https://superbet.bet.br",
        "Accept-Encoding": "identity",
      },
    });
    if (!res.ok) {
      throw new Error(`subscription/events ${res.status}: ${await res.text()}`);
    }

    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const json = line.slice("data:".length).trim();
        if (!json || json === "[DONE]") continue;
        try {
          const parsed = JSON.parse(json) as unknown;
          if (Array.isArray(parsed)) {
            ctrl.abort();
            return parsed as SubscriptionEventPayload[];
          }
        } catch {
          /* not valid json yet */
        }
      }
    }

    return parseSubscriptionSseBody(buf);
  } finally {
    clearTimeout(timeout);
  }
}

export function chunkIds<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}
