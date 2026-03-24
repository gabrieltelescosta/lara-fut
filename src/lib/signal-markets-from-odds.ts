import type { ImplementedMarketId } from "@/lib/signal-market-catalog";

type OddLine = { marketName: string; outcomeName: string; info?: string | null };

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Quais mercados **implementados** aparecem nas linhas de odds da oferta
 * (nomes em PT como na Superbet).
 */
export function detectImplementedMarketsInOdds(
  lines: OddLine[],
): Set<ImplementedMarketId> {
  const found = new Set<ImplementedMarketId>();
  if (lines.length === 0) return found;

  for (const row of lines) {
    const m = norm(row.marketName);
    const combo =
      m.includes("dupla") ||
      (m.includes("total") && m.includes("gol")) ||
      m.includes("ambas") ||
      m.includes("ambos") ||
      m.includes("placar correto") ||
      m.includes("numero exato") ||
      m.includes("número exato") ||
      m.includes("faixa");

    if (
      (m.includes("resultado final") || m === "resultado final") &&
      !combo
    ) {
      found.add("oneX2");
    }
    if (m.includes("dupla")) {
      found.add("duplaChance");
    }
    if (
      (m.includes("ambas") || m.includes("ambos")) &&
      m.includes("marc")
    ) {
      found.add("btts");
    }
    const isTeamTotal =
      m.includes("equipe") ||
      (m.includes("(v)") && m.includes("gol") && !m.includes("exato"));
    if (
      (m.includes("total") && m.includes("gol") && !isTeamTotal) ||
      m.includes("gols no jogo")
    ) {
      if (!m.includes("resultado final")) found.add("totalGolsJogo");
    }
    if (isTeamTotal && (m.includes("total") || m.includes("gol"))) {
      found.add("teamOu");
    }
    if (m.includes("faixa") && m.includes("gol")) {
      found.add("faixaGolsTotais");
    }
    if (
      m.includes("numero exato") ||
      m.includes("número exato")
    ) {
      if (m.includes("(v)") || m.includes("equipe")) {
        found.add("timeNumeroExatoGols");
      } else {
        found.add("numeroExatoGols");
      }
    }
    if (m.includes("placar correto")) {
      found.add("placarCorreto");
    }
    if (m.includes("resultado final") && m.includes("total") && m.includes("gol")) {
      found.add("resultadoFinalTotalGols");
    }
    if (
      m.includes("resultado final") &&
      (m.includes("ambas") || m.includes("ambos"))
    ) {
      found.add("resultadoFinalAmbasMarcam");
    }
  }

  return found;
}
