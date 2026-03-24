/**
 * Janela de sinal alinhada ao virtual (grades ~5 min):
 * - Antecedência mínima: só entra jogo com kickoff ≥ agora + folga (para apostar).
 * - Horizonte: até quanto tempo à frente buscar eventos (próximo jogo “apostável”).
 */

/** Folga mínima entre agora e o início do jogo (min). Default 5 → ex.: 17:50 → próximo sinal 17:55. */
export function getSignalMinLeadMinutes(): number {
  const m = parseFloat(process.env.SIGNAL_MIN_LEAD_MINUTES ?? "5");
  if (Number.isNaN(m) || m < 0.5) return 5;
  return Math.min(30, m);
}

export function getSignalMinLeadMs(): number {
  return getSignalMinLeadMinutes() * 60 * 1000;
}

/** Até quantos minutos à frente listar jogos sem resultado. Default 15. Sempre ≥ folga + 2 min para a janela existir. */
export function getSignalLookaheadMinutes(): number {
  const m = parseFloat(process.env.SIGNAL_LOOKAHEAD_MINUTES ?? "15");
  const raw = Number.isNaN(m) || m < 5 ? 15 : Math.min(120, m);
  const lead = getSignalMinLeadMinutes();
  return Math.max(raw, lead + 2);
}

export function getSignalLookaheadMs(): number {
  return getSignalLookaheadMinutes() * 60 * 1000;
}
