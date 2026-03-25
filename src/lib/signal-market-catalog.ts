/**
 * Catálogo de mercados (alinhado à oferta Superbet). Todos os ids listados em
 * `IMPLEMENTED_MARKET_IDS` têm heurística de sinal + gradação no backtest.
 */

export const IMPLEMENTED_MARKET_IDS = [
  "oneX2",
  "btts",
  "teamOu",
  "totalGolsJogo",
  "duplaChance",
  "faixaGolsTotais",
  "resultadoFinalTotalGols",
  "numeroExatoGols",
  "timeNumeroExatoGols",
  "placarCorreto",
  "resultadoFinalAmbasMarcam",
] as const;

export type ImplementedMarketId = (typeof IMPLEMENTED_MARKET_IDS)[number];

export type CatalogMarketId = ImplementedMarketId;

export type CatalogEntry = {
  id: CatalogMarketId;
  labelPt: string;
  implemented: boolean;
  note?: string;
};

export const SIGNAL_MARKET_CATALOG: CatalogEntry[] = [
  { id: "oneX2", labelPt: "Resultado Final", implemented: true },
  {
    id: "teamOu",
    labelPt: "Total de Gols da Equipe (mandante, linha 2.5)",
    implemented: true,
  },
  { id: "btts", labelPt: "Ambos as Equipes Marcam", implemented: true },
  {
    id: "totalGolsJogo",
    labelPt: "Total de Gols (jogo, linha 2.5)",
    implemented: true,
  },
  { id: "duplaChance", labelPt: "Dupla Chance", implemented: true },
  { id: "faixaGolsTotais", labelPt: "Faixa de Gols Totais", implemented: true },
  {
    id: "resultadoFinalTotalGols",
    labelPt: "Resultado Final & Total de Gols (combo)",
    implemented: true,
  },
  {
    id: "numeroExatoGols",
    labelPt: "Número Exato de Gols",
    implemented: true,
  },
  {
    id: "timeNumeroExatoGols",
    labelPt: "Número Exato de Gols (mandante)",
    implemented: true,
  },
  { id: "placarCorreto", labelPt: "Placar Correto", implemented: true },
  {
    id: "resultadoFinalAmbasMarcam",
    labelPt: "Resultado Final & Ambas Marcam",
    implemented: true,
  },
];

/**
 * Nome do mercado alinhado à oferta Superbet e ao texto do sinal (Telegram / tracker).
 * Preferir isto a `MARKET_SHORT_LABEL` em qualquer UI ou mensagem ao utilizador.
 */
export function marketDisplayName(id: ImplementedMarketId): string {
  const c = SIGNAL_MARKET_CATALOG.find((x) => x.id === id);
  return c?.labelPt ?? id;
}

/** Rótulos muito curtos (só onde o espaço é crítico — logs, colunas estreitas). */
export const MARKET_SHORT_LABEL: Record<ImplementedMarketId, string> = {
  oneX2: "1X2",
  btts: "BTTS",
  teamOu: "Gols mand. 2.5",
  totalGolsJogo: "Total gols 2.5",
  duplaChance: "Dupla",
  faixaGolsTotais: "Faixa gols",
  resultadoFinalTotalGols: "1X2+total 2.5",
  numeroExatoGols: "Exato tot.",
  timeNumeroExatoGols: "Exato mand.",
  placarCorreto: "Placar",
  resultadoFinalAmbasMarcam: "1X2+BTTS",
};

const DEFAULT_ENABLED: ImplementedMarketId[] = ["oneX2", "btts", "teamOu"];

/**
 * Lê `SIGNAL_MARKETS_ENABLED` (lista separada por vírgulas).
 * Se vazio ou ausente → os 3 mercados originais (mensagens mais curtas).
 */
export function parseEnabledSignalMarkets(
  envValue: string | undefined,
): ImplementedMarketId[] {
  const raw = envValue?.trim();
  const parts = (raw && raw.length > 0 ? raw : DEFAULT_ENABLED.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<ImplementedMarketId>();
  for (const part of parts) {
    const inCatalog = SIGNAL_MARKET_CATALOG.find((c) => c.id === part);
    if (!inCatalog) {
      console.warn(
        `[signal-markets] SIGNAL_MARKETS_ENABLED: id desconhecido ignorado: "${part}"`,
      );
      continue;
    }
    if (!inCatalog.implemented) {
      console.warn(
        `[signal-markets] SIGNAL_MARKETS_ENABLED: "${part}" ainda não implementado — ignorado`,
      );
      continue;
    }
    seen.add(part as ImplementedMarketId);
  }

  if (seen.size === 0) {
    console.warn(
      "[signal-markets] SIGNAL_MARKETS_ENABLED vazio ou inválido — a usar os 3 mercados padrão.",
    );
    return [...DEFAULT_ENABLED];
  }

  return IMPLEMENTED_MARKET_IDS.filter((id) => seen.has(id));
}

export function getEnabledSignalMarkets(): ImplementedMarketId[] {
  return parseEnabledSignalMarkets(process.env.SIGNAL_MARKETS_ENABLED);
}

/**
 * `all` / `full` = todos os mercados implementados; ou lista `oneX2,btts,...`.
 * Ordem na resposta segue `IMPLEMENTED_MARKET_IDS`.
 */
export function parseMarketsQueryString(
  raw: string | null,
): ImplementedMarketId[] | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const t = raw.trim().toLowerCase();
  if (t === "all" || t === "full") {
    return [...IMPLEMENTED_MARKET_IDS];
  }
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set<ImplementedMarketId>();
  for (const part of parts) {
    if ((IMPLEMENTED_MARKET_IDS as readonly string[]).includes(part)) {
      set.add(part as ImplementedMarketId);
    }
  }
  if (set.size === 0) return undefined;
  return IMPLEMENTED_MARKET_IDS.filter((id) => set.has(id));
}
