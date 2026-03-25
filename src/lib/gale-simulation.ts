/**
 * Simulação de banca com gales (martingale clássico baseado em odds).
 * Quando a odd real do sinal está disponível, calcula o stake para
 * recuperar o prejuízo acumulado + lucro desejado. Caso contrário
 * usa `fixedOdd` como fallback.
 */

/** Pelo menos um acerto vs todos os mercados do sinal. */
export type GaleGreenRule = "anyHit" | "allHits";

export type GaleSimConfig = {
  baseStake: number;
  /** Legado / fallback: usado só quando não há odd real. */
  multiplier: number;
  /** Nível máximo de gale (ex.: 3 → níveis 0…3). */
  maxGales: number;
  greenRule: GaleGreenRule;
  /** Odd decimal fallback (usada quando a rodada não tem odd gravada). */
  fixedOdd: number;
  /** Banca antes da primeira rodada. */
  startingBankroll: number;
};

export const DEFAULT_GALE_SIM_CONFIG: GaleSimConfig = {
  baseStake: 1,
  multiplier: 2,
  maxGales: 3,
  greenRule: "anyHit",
  fixedOdd: 1.9,
  startingBankroll: 100,
};

export type RoundInput = {
  hitsTotal: number;
  /** Quantos mercados tinha o sinal (para regra allHits). */
  picksCount: number;
  /** Odd real do sinal (teamOu); null/undefined = usar fixedOdd. */
  oddPerRound?: number | null;
};

export type GaleRoundResult = {
  /** Índice 0-based na ordem cronológica. */
  index: number;
  /** Nível de gale no início desta rodada (0 = stake base). */
  galeLevel: number;
  stake: number;
  green: boolean;
  /** Odd usada nesta rodada (real ou fallback). */
  oddUsed: number;
  /** Lucro líquido da rodada (negativo em red). */
  netPl: number;
  bancaDepois: number;
  /** Nível de gale no início da próxima rodada. */
  nextLevel: number;
  /** true se perdeu no nível max e o nível voltou a 0. */
  forcedReset: boolean;
};

/**
 * Green: `anyHit` = hitsTotal >= 1; `allHits` = hitsTotal === picksCount.
 */
export function computeRoundGreen(
  hitsTotal: number,
  picksCount: number,
  rule: GaleGreenRule,
): boolean {
  if (picksCount <= 0) return false;
  if (rule === "anyHit") return hitsTotal >= 1;
  return hitsTotal === picksCount;
}

/**
 * Próximo nível após RED. Se já está em `maxGales`, volta a 0 (stop / volta à base).
 */
export function nextLevelAfterRed(
  currentLevel: number,
  maxGales: number,
): { level: number; forcedReset: boolean } {
  if (currentLevel < maxGales) {
    return { level: currentLevel + 1, forcedReset: false };
  }
  return { level: 0, forcedReset: true };
}

function resolveOdd(
  roundOdd: number | null | undefined,
  fixedOdd: number,
): number {
  if (
    typeof roundOdd === "number" &&
    Number.isFinite(roundOdd) &&
    roundOdd > 1
  ) {
    return roundOdd;
  }
  return fixedOdd;
}

/**
 * Calcula o stake para recuperar prejuízo acumulado + lucro desejado.
 * `desiredProfit` = baseStake * (oddInicial - 1).
 * `stake = (accLoss + desiredProfit) / (currentOdd - 1)`.
 */
export function recoveryStake(
  accumulatedLoss: number,
  desiredProfit: number,
  currentOdd: number,
): number {
  const denom = currentOdd - 1;
  if (denom <= 0) return 0;
  return (accumulatedLoss + desiredProfit) / denom;
}

/**
 * Simula sequência de rodadas (cronológica: mais antigo -> mais recente).
 * Usa martingale clássico baseado em odds quando disponível.
 */
export function simulateGaleBankroll(
  rounds: RoundInput[],
  config: GaleSimConfig,
): GaleRoundResult[] {
  const { baseStake, maxGales, greenRule, fixedOdd, startingBankroll } = config;

  const out: GaleRoundResult[] = [];
  let bankroll = startingBankroll;
  let level = 0;
  let accLoss = 0;
  let chainInitialOdd = fixedOdd;

  for (let i = 0; i < rounds.length; i++) {
    const { hitsTotal, picksCount, oddPerRound } = rounds[i];
    const green = computeRoundGreen(hitsTotal, picksCount, greenRule);
    const odd = resolveOdd(oddPerRound, fixedOdd);

    let stake: number;
    if (level === 0) {
      stake = baseStake;
      chainInitialOdd = odd;
      accLoss = 0;
    } else {
      const desiredProfit = baseStake * (chainInitialOdd - 1);
      stake = recoveryStake(accLoss, desiredProfit, odd);
    }

    stake = Math.max(0, stake);
    const net = green ? stake * (odd - 1) : -stake;
    bankroll += net;

    let levelAfter: number;
    let forced = false;
    if (green) {
      levelAfter = 0;
      accLoss = 0;
    } else {
      accLoss += stake;
      const n = nextLevelAfterRed(level, maxGales);
      levelAfter = n.level;
      forced = n.forcedReset;
      if (forced) {
        accLoss = 0;
      }
    }

    out.push({
      index: i,
      galeLevel: level,
      stake,
      green,
      oddUsed: odd,
      netPl: net,
      bancaDepois: bankroll,
      nextLevel: levelAfter,
      forcedReset: forced,
    });

    level = levelAfter;
  }

  return out;
}

export const GALE_SIM_STORAGE_KEY = "vr_gale_sim_config_v1";

export function parseGaleSimConfig(raw: string | null): GaleSimConfig {
  if (!raw) return { ...DEFAULT_GALE_SIM_CONFIG };
  try {
    const j = JSON.parse(raw) as Partial<GaleSimConfig>;
    return {
      baseStake: clampNum(j.baseStake, 0.01, 1e9, DEFAULT_GALE_SIM_CONFIG.baseStake),
      multiplier: clampNum(j.multiplier, 1, 100, DEFAULT_GALE_SIM_CONFIG.multiplier),
      maxGales: clampInt(j.maxGales, 0, 10, DEFAULT_GALE_SIM_CONFIG.maxGales),
      greenRule: j.greenRule === "allHits" ? "allHits" : "anyHit",
      fixedOdd: clampNum(j.fixedOdd, 1.01, 1000, DEFAULT_GALE_SIM_CONFIG.fixedOdd),
      startingBankroll: clampNum(
        j.startingBankroll,
        0,
        1e12,
        DEFAULT_GALE_SIM_CONFIG.startingBankroll,
      ),
    };
  } catch {
    return { ...DEFAULT_GALE_SIM_CONFIG };
  }
}

function clampNum(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof v === "number" && !Number.isNaN(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return Math.round(clampNum(v, min, max, fallback));
}
