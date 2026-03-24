import type { SettlementPayload } from "@/lib/odds-settlement";

export type SettlementLineDto = {
  marketName: string;
  outcomeName: string;
  price: number;
  info: string | null;
  hit: boolean | null;
};

/** Forma enviada às páginas / API: totais + linhas para UI (verde/vermelho/cinza). */
export type SettlementForClient = {
  snapshotCapturedAt: string | null;
  homeScore: number;
  awayScore: number;
  parsedCount: number;
  unparsedCount: number;
  totalLines: number;
  /** Linhas com hit === true */
  winCount: number;
  /** Linhas com hit === false */
  lossCount: number;
  lines: SettlementLineDto[];
};

export function settlementFromJson(
  raw: string | null | undefined,
): SettlementForClient | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as SettlementPayload;
    if (!j.lines || !Array.isArray(j.lines)) return null;
    let winCount = 0;
    let lossCount = 0;
    const lines: SettlementLineDto[] = j.lines.map((L) => {
      if (L.hit === true) winCount += 1;
      else if (L.hit === false) lossCount += 1;
      return {
        marketName: L.marketName,
        outcomeName: L.outcomeName,
        price: L.price,
        info: L.info ?? null,
        hit: L.hit,
      };
    });
    return {
      snapshotCapturedAt: j.snapshotCapturedAt ?? null,
      homeScore: j.homeScore,
      awayScore: j.awayScore,
      parsedCount: j.parsedCount ?? 0,
      unparsedCount: j.unparsedCount ?? 0,
      totalLines: lines.length,
      winCount,
      lossCount,
      lines,
    };
  } catch {
    return null;
  }
}
