"use server";

import { getStrategySimJsonResponse } from "@/lib/strategy-sim-json";
import { refreshStrategySimulation } from "@/lib/strategy-sim-persist";

/** Recalcula e grava cache (mesmo efeito do coletor). Para o botão na UI sem Bearer. */
export async function recalculateStrategySimAction(): Promise<
  Record<string, unknown>
> {
  await refreshStrategySimulation();
  return getStrategySimJsonResponse();
}
