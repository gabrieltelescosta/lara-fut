"use client";

import { recalculateStrategySimAction } from "@/app/strategy/actions";
import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";
import {
  IMPLEMENTED_MARKET_IDS,
  MARKET_SHORT_LABEL,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import { useCallback, useEffect, useState, useTransition } from "react";

type BestRef = { strategyId: string; label: string };

type Strat = {
  strategyId: string;
  label: string;
  evaluated: number;
  pctByMarket: Partial<Record<string, number | null>>;
  pctHitsPerGame: number;
};

function formatPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${v}%`;
}

function parseBestRef(v: unknown): BestRef | null {
  if (
    v &&
    typeof v === "object" &&
    "strategyId" in v &&
    "label" in v
  ) {
    return {
      strategyId: String((v as BestRef).strategyId),
      label: String((v as BestRef).label),
    };
  }
  return null;
}

function migrateStrategyRow(raw: Record<string, unknown>): Strat {
  if (raw.pctByMarket && typeof raw.pctByMarket === "object") {
    return {
      strategyId: String(raw.strategyId),
      label: String(raw.label),
      evaluated: Number(raw.evaluated),
      pctByMarket: raw.pctByMarket as Partial<
        Record<string, number | null>
      >,
      pctHitsPerGame: Number(raw.pctHitsPerGame),
    };
  }
  return {
    strategyId: String(raw.strategyId),
    label: String(raw.label),
    evaluated: Number(raw.evaluated),
    pctByMarket: {
      oneX2:
        raw.pctRf === undefined || raw.pctRf === null
          ? null
          : Number(raw.pctRf),
      btts:
        raw.pctBtts === undefined || raw.pctBtts === null
          ? null
          : Number(raw.pctBtts),
      teamOu:
        raw.pctOu === undefined || raw.pctOu === null
          ? null
          : Number(raw.pctOu),
    },
    pctHitsPerGame: Number(raw.pctHitsPerGame),
  };
}

function parseBestByMarket(
  j: Record<string, unknown>,
): Partial<Record<string, BestRef | null>> {
  if (j.bestByMarket && typeof j.bestByMarket === "object") {
    const out: Partial<Record<string, BestRef | null>> = {};
    for (const [k, v] of Object.entries(
      j.bestByMarket as Record<string, unknown>,
    )) {
      out[k] = parseBestRef(v);
    }
    return out;
  }
  return {
    oneX2: parseBestRef(j.bestByMarketRf),
    btts: parseBestRef(j.bestByMarketBtts),
    teamOu: parseBestRef(j.bestByMarketOu),
  };
}

function applySimPayload(
  j: Record<string, unknown>,
  setters: {
    setStrategies: (v: Strat[]) => void;
    setBestByAvgHits: (v: string | null) => void;
    setBestLabel: (v: string | null) => void;
    setBestTied: (v: boolean) => void;
    setBestTiedIds: (v: string[]) => void;
    setTotalGames: (v: number) => void;
    setCachedAt: (v: string | null) => void;
    setBestByMarket: (v: Partial<Record<string, BestRef | null>>) => void;
    setMarketsEnabled: (v: ImplementedMarketId[]) => void;
    setSimMarketsOverride: (v: boolean) => void;
  },
) {
  const {
    setStrategies,
    setBestByAvgHits,
    setBestLabel,
    setBestTied,
    setBestTiedIds,
    setTotalGames,
    setCachedAt,
    setBestByMarket,
    setMarketsEnabled,
    setSimMarketsOverride,
  } = setters;

  const rawStrats = Array.isArray(j.strategies)
    ? (j.strategies as Record<string, unknown>[])
    : [];
  setStrategies(rawStrats.map(migrateStrategyRow));

  const bid = (j.bestByAvgHits as string | null) ?? null;
  setBestByAvgHits(bid);
  let label = (j.bestByAvgHitsLabel as string | null) ?? null;
  if (label == null && bid) {
    const match = rawStrats.find((s) => String(s.strategyId) === bid);
    label = match?.label != null ? String(match.label) : null;
  }
  setBestLabel(label);
  setBestTied(Boolean(j.bestByAvgHitsTied));
  let tiedIds = Array.isArray(j.bestByAvgHitsTiedIds)
    ? (j.bestByAvgHitsTiedIds as string[])
    : [];
  if (tiedIds.length === 0 && bid && j.bestByAvgHitsTied) {
    const migrated = rawStrats.map(migrateStrategyRow);
    const maxPct = Math.max(0, ...migrated.map((s) => s.pctHitsPerGame));
    tiedIds = migrated
      .filter((s) => s.pctHitsPerGame === maxPct)
      .map((s) => s.strategyId);
  }
  setBestTiedIds(tiedIds);
  setTotalGames(typeof j.totalGamesInDb === "number" ? j.totalGamesInDb : 0);
  setCachedAt(
    typeof j.cachedAt === "string" || j.cachedAt === null
      ? (j.cachedAt as string | null)
      : null,
  );

  const me = j.marketsEnabled;
  setMarketsEnabled(
    Array.isArray(me) && me.length > 0
      ? (me as ImplementedMarketId[])
      : ["oneX2", "btts", "teamOu"],
  );

  setSimMarketsOverride(Boolean(j.simMarketsOverride));
  setBestByMarket(parseBestByMarket(j));
}

export default function StrategyPage() {
  const [strategies, setStrategies] = useState<Strat[]>([]);
  const [bestByAvgHits, setBestByAvgHits] = useState<string | null>(null);
  const [bestLabel, setBestLabel] = useState<string | null>(null);
  const [bestTied, setBestTied] = useState(false);
  const [bestTiedIds, setBestTiedIds] = useState<string[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [marketsEnabled, setMarketsEnabled] = useState<ImplementedMarketId[]>(
    ["oneX2", "btts", "teamOu"],
  );
  const [bestByMarket, setBestByMarket] = useState<
    Partial<Record<string, BestRef | null>>
  >({});
  const [simMarketsOverride, setSimMarketsOverride] = useState(false);
  const [simMode, setSimMode] = useState<"env" | "all" | "custom">("env");
  const [customMarkets, setCustomMarkets] = useState<ImplementedMarketId[]>([
    ...IMPLEMENTED_MARKET_IDS,
  ]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      let url = "/api/strategy-sim";
      if (simMode === "all") {
        url = "/api/strategy-sim?markets=all";
      } else if (simMode === "custom") {
        if (customMarkets.length === 0) {
          setErr("Seleciona pelo menos um mercado.");
          setLoading(false);
          return;
        }
        url = `/api/strategy-sim?markets=${encodeURIComponent(customMarkets.join(","))}`;
      }
      const r = await fetch(url);
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as Record<string, unknown>;
      applySimPayload(j, {
        setStrategies,
        setBestByAvgHits,
        setBestLabel,
        setBestTied,
        setBestTiedIds,
        setTotalGames,
        setCachedAt,
        setBestByMarket,
        setMarketsEnabled,
        setSimMarketsOverride,
      });
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [simMode, customMarkets]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRecalculate = () => {
    setErr(null);
    startTransition(async () => {
      try {
        await recalculateStrategySimAction();
        await load();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const toggleCustomMarket = (id: ImplementedMarketId) => {
    setCustomMarkets((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return IMPLEMENTED_MARKET_IDS.filter((x) => set.has(x));
    });
  };

  const selectAllCustom = () => {
    setCustomMarkets([...IMPLEMENTED_MARKET_IDS]);
  };

  const clearCustom = () => {
    setCustomMarkets([]);
  };

  return (
    <PageShell
      title="Estratégia"
      description={
        <>
          Backtest <strong className="text-zinc-200">walk-forward</strong>: em
          cada jogo só entram resultados <em>anteriores</em> para montar o
          sinal. Compara janelas de{" "}
          <strong className="text-zinc-200">5, 10 e 15</strong> jogos do
          mandante. O coletor grava o cache; aqui podes mudar mercados na vista
          ou forçar recálculo.
        </>
      }
      actions={
        <>
          <div className="flex flex-wrap justify-end gap-1 rounded-lg border border-zinc-600 bg-zinc-900/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSimMode("env")}
              disabled={loading || isPending}
              className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                simMode === "env"
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Cache / .env
            </button>
            <button
              type="button"
              onClick={() => setSimMode("all")}
              disabled={loading || isPending}
              className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                simMode === "all"
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Todos ({IMPLEMENTED_MARKET_IDS.length})
            </button>
            <button
              type="button"
              onClick={() => setSimMode("custom")}
              disabled={loading || isPending}
              className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                simMode === "custom"
                  ? "bg-zinc-700 text-zinc-50"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Personalizado
            </button>
          </div>
          <button
            type="button"
            onClick={onRecalculate}
            disabled={isPending || loading}
            className={`${ui.btnPrimary} w-full sm:w-auto`}
          >
            {isPending ? "A recalcular…" : "Recalcular agora"}
          </button>
        </>
      }
    >

        {simMode === "custom" && (
          <div className="mt-4 rounded-lg border border-zinc-600/80 bg-zinc-900/40 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-zinc-500">Mercados na simulação:</span>
              <button
                type="button"
                onClick={selectAllCustom}
                className="text-sky-400 hover:underline"
              >
                Todos
              </button>
              <span className="text-zinc-600">·</span>
              <button
                type="button"
                onClick={clearCustom}
                className="text-zinc-400 hover:underline"
              >
                Limpar
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {IMPLEMENTED_MARKET_IDS.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300"
                >
                  <input
                    type="checkbox"
                    checked={customMarkets.includes(id)}
                    onChange={() => toggleCustomMarket(id)}
                    className="rounded border-zinc-500"
                  />
                  <span>
                    {MARKET_SHORT_LABEL[id]}{" "}
                    <span className="font-mono text-zinc-500">({id})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {simMarketsOverride && (
          <p className="mt-4 rounded-lg border border-amber-900/50 bg-amber-950/25 px-3 py-2 text-sm text-amber-200/90">
            Vista com mercados escolhidos no pedido — ignora{" "}
            <code className="text-amber-300/90">SIGNAL_MARKETS_ENABLED</code>{" "}
            e o cache; recalcula direto dos resultados gravados.
          </p>
        )}

        {loading && <p className={ui.loading}>Carregando…</p>}
        {err && <p className={ui.error}>{err}</p>}

        {!loading && !err && (
          <div className="mt-6 space-y-3 text-sm text-zinc-400">
            <p>
              Jogos no banco (amostra):{" "}
              <span className="font-mono text-zinc-200">{totalGames}</span>
            </p>
            <p className="text-xs text-zinc-500">
              Mercados nesta vista:{" "}
              <span className="font-mono text-zinc-400">
                {marketsEnabled.join(", ")}
              </span>
            </p>
            <p className="text-xs leading-relaxed text-zinc-500">
              {cachedAt ? (
                <>
                  Cache gravado em{" "}
                  <span className="font-mono text-zinc-400">
                    {new Date(cachedAt).toLocaleString("pt-BR")}
                  </span>{" "}
                  (coletor ou “Recalcular”) — só em modo{" "}
                  <strong className="text-zinc-400">Cache / .env</strong>.
                </>
              ) : (
                <>
                  Sem cache aplicável neste pedido ou sem linha em{" "}
                  <code className="text-zinc-400">StrategySimRun</code>.
                </>
              )}
            </p>
            {(bestByAvgHits || bestLabel) && (
              <div className="space-y-2 rounded-lg border border-emerald-900/40 bg-emerald-950/25 px-3 py-2 text-emerald-200/90">
                <p>
                  Melhor % de acertos (média dos mercados ativos,{" "}
                  {marketsEnabled.length}):{" "}
                  <strong className="text-emerald-100">
                    {bestLabel ?? bestByAvgHits}
                  </strong>
                  {bestByAvgHits && bestLabel && (
                    <span className="font-mono text-emerald-300/80">
                      {" "}
                      ({bestByAvgHits})
                    </span>
                  )}
                </p>
                {bestTied && bestTiedIds.length > 1 && (
                  <p className="text-xs text-emerald-300/80">
                    Empate no mesmo % entre:{" "}
                    {bestTiedIds
                      .map(
                        (id) =>
                          strategies.find((s) => s.strategyId === id)?.label ??
                          id,
                      )
                      .join(", ")}
                    . Desempate para destaque: ordem fixa 5 → 10 → 15 jogos.
                  </p>
                )}
              </div>
            )}
            {!loading && !err && strategies.length > 0 && (
              <div className="rounded-lg border border-zinc-600/60 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300">
                <p className="text-xs font-medium text-zinc-500">
                  Melhor janela (5 / 10 / 15) por mercado
                </p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {marketsEnabled.map((id) => {
                    const ref = bestByMarket[id];
                    return (
                      <li key={id} className="text-xs text-zinc-400">
                        <span className="text-zinc-500">
                          {MARKET_SHORT_LABEL[id]}:
                        </span>{" "}
                        {ref ? (
                          <>
                            <strong className="text-zinc-200">
                              {ref.label}
                            </strong>{" "}
                            <span className="font-mono text-zinc-500">
                              ({ref.strategyId})
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {!loading && !err && strategies.length > 0 && (
          <div className={`${ui.tablePanel} mt-8 shadow-lg shadow-black/20`}>
            <table className={`${ui.table} min-w-[640px]`}>
              <thead className={ui.thead}>
                <tr>
                  <th className="sticky left-0 z-10 bg-zinc-800/95 px-3 py-3 font-semibold text-zinc-200">
                    Estratégia
                  </th>
                  <th className={ui.th}>Jogos</th>
                  {marketsEnabled.map((id) => (
                    <th
                      key={id}
                      className="max-w-[120px] px-2 py-3 text-xs font-semibold leading-tight text-zinc-200"
                      title={id}
                    >
                      {MARKET_SHORT_LABEL[id]}
                    </th>
                  ))}
                  <th className={ui.th}>% total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/80">
                {strategies.map((s, i) => {
                  const isWinner =
                    bestByAvgHits != null && s.strategyId === bestByAvgHits;
                  const isTiedBand =
                    bestTied && bestTiedIds.includes(s.strategyId);
                  return (
                    <tr
                      key={s.strategyId}
                      className={
                        isWinner
                          ? "bg-emerald-950/30"
                          : isTiedBand
                            ? "bg-emerald-950/10"
                            : i % 2 === 1
                              ? "bg-zinc-900/40"
                              : "bg-transparent"
                      }
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-3 font-medium text-zinc-100">
                        {s.label}
                        {isWinner && bestTied && (
                          <span className="ml-2 text-xs font-normal text-emerald-400/90">
                            (desempate)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-zinc-300">
                        {s.evaluated}
                      </td>
                      {marketsEnabled.map((id) => (
                        <td
                          key={id}
                          className="px-2 py-3 font-mono text-xs text-zinc-200"
                        >
                          {formatPct(s.pctByMarket[id] ?? null)}
                        </td>
                      ))}
                      <td className="px-3 py-3">
                        <span className="font-mono text-lg font-semibold text-amber-300/95">
                          {s.pctHitsPerGame}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !err && strategies.length === 0 && (
          <p className="mt-8 text-sm text-zinc-500">
            Sem jogos suficientes no histórico ainda. Colete mais resultados.
          </p>
        )}

        <div className={`${ui.calloutNeutral} mt-8`}>
          <p>
            <strong className="text-zinc-400">Quantos jogos entram?</strong> Até{" "}
            <strong className="text-zinc-400">8000</strong> resultados
            cronológicos. A coluna <strong className="text-zinc-400">Jogos</strong>{" "}
            é quantas vezes deu para avaliar o sinal em walk-forward. Para gerar
            pick são precisos pelo menos{" "}
            <strong className="text-zinc-400">3</strong> jogos do mandante no
            histórico.
          </p>
          <p className="mt-2">
            Cada mercado usa a mesma heurística (moda / tendência nos últimos N
            jogos do mandante). Mercados como placar exato ou número exato de
            gols são naturalmente mais difíceis — os % refletem isso.
          </p>
        </div>
    </PageShell>
  );
}
