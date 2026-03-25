"use client";

import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";
import {
  DEFAULT_GALE_SIM_CONFIG,
  GALE_SIM_STORAGE_KEY,
  type GaleSimConfig,
  parseGaleSimConfig,
  simulateGaleBankroll,
} from "@/lib/gale-simulation";
import {
  IMPLEMENTED_MARKET_IDS,
  marketDisplayName,
  type ImplementedMarketId,
} from "@/lib/signal-market-catalog";
import { MARKET_LINE_ORDER } from "@/lib/signal-picks";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  matchName: string;
  matchDate: string;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  homeScore: number | null;
  awayScore: number | null;
  hitOneX2: boolean | null;
  hitBtts: boolean | null;
  hitTeamOu: boolean | null;
  hitsTotal: number | null;
  picksCount?: number;
  grades?: Partial<Record<string, boolean | null>>;
  oddsAtSignalLines?: number;
  oddsTeamOuAtSignal?: number | null;
  galeAttemptInChain?: number | null;
  galeChainStatus?: "green" | "red-keep" | "red-final" | null;
};

function BankrollSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 4;
  const w = 320;
  const h = 56;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-14 w-full max-w-md text-emerald-400/90"
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        points={points}
      />
    </svg>
  );
}

export default function TrackerPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<{
    pending: number;
    resolved: number;
    avgHitsPerSignal: number | null;
    totalHits: number;
    maxPossibleHits: number;
  } | null>(null);
  const [byMarket, setByMarket] = useState<Record<
    string,
    { hit: number; total: number; pct: number | null; label: string }
  > | null>(null);
  const [meta, setMeta] = useState<{
    firstSignalAt: string | null;
    firstEventAt: string | null;
    oddsSnapshotsTotal: number;
    eventsTotal: number;
    tournamentsTotal: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [galeConfig, setGaleConfig] = useState<GaleSimConfig>(
    DEFAULT_GALE_SIM_CONFIG,
  );
  const [galeHydrated, setGaleHydrated] = useState(false);

  useEffect(() => {
    setGaleConfig(parseGaleSimConfig(localStorage.getItem(GALE_SIM_STORAGE_KEY)));
    setGaleHydrated(true);
  }, []);

  useEffect(() => {
    if (!galeHydrated) return;
    localStorage.setItem(GALE_SIM_STORAGE_KEY, JSON.stringify(galeConfig));
  }, [galeConfig, galeHydrated]);

  const galeSim = useMemo(() => {
    const resolved = rows
      .filter(
        (r) =>
          r.resolvedAt != null &&
          r.hitsTotal != null &&
          (r.picksCount ?? 0) > 0,
      )
      .sort(
        (a, b) =>
          new Date(a.resolvedAt!).getTime() -
          new Date(b.resolvedAt!).getTime(),
      );
    const rounds = resolved.map((r) => ({
      hitsTotal: r.hitsTotal ?? 0,
      picksCount: r.picksCount ?? 0,
    }));
    const results = simulateGaleBankroll(rounds, galeConfig);
    return { resolved, results };
  }, [rows, galeConfig]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/tracker");
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setRows(j.data);
      setSummary(j.summary);
      setByMarket(j.byMarket);
      setMeta(j.meta ?? null);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetApplicationData = useCallback(async () => {
    if (
      !confirm(
        "Apagar todos os sinais, jogos, odds e simulações no banco? O contador do tracker volta a zero.",
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      const r = await fetch("/api/admin/reset-data", { method: "POST" });
      const j = await r.json();
      if (r.status === 401) {
        throw new Error(
          "Não autorizado. Sem CRON_SECRET no servidor o POST funciona em dev; com secret usa curl com Authorization: Bearer …",
        );
      }
      if (!r.ok) throw new Error(j.error || JSON.stringify(j));
      await load();
      alert(
        `Limpo. ${JSON.stringify(j.deleted)}\n\nCorre o coletor para repovoar eventos.`,
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setResetting(false);
    }
  }, [load]);

  const icon = (v: boolean | null | undefined) => {
    if (v === true) {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-950/80 text-base text-emerald-400">
          ✓
        </span>
      );
    }
    if (v === false) {
      return (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-red-950/60 text-base text-red-400">
          ✗
        </span>
      );
    }
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 text-zinc-500">
        —
      </span>
    );
  };

  const gradeForRow = (
    r: Row,
    id: ImplementedMarketId,
  ): boolean | null | undefined => {
    if (r.grades && Object.prototype.hasOwnProperty.call(r.grades, id)) {
      return r.grades[id] ?? null;
    }
    if (id === "oneX2") return r.hitOneX2;
    if (id === "btts") return r.hitBtts;
    if (id === "teamOu") return r.hitTeamOu;
    return undefined;
  };

  const orderedMarketsForRow = (r: Row): ImplementedMarketId[] => {
    return MARKET_LINE_ORDER.filter((id) => {
      if (r.grades && Object.prototype.hasOwnProperty.call(r.grades, id)) {
        return true;
      }
      if (id === "oneX2") return r.hitOneX2 != null;
      if (id === "btts") return r.hitBtts != null;
      if (id === "teamOu") return r.hitTeamOu != null;
      return false;
    });
  };

  return (
    <PageShell
      title="Tracker"
      description={
        <>
          Sinais <strong className="text-zinc-200">automáticos</strong> antes do
          jogo; resolução quando o resultado entra no banco. Mercados ativos:{" "}
          <code className="text-zinc-500">SIGNAL_MARKETS_ENABLED</code> no{" "}
          <code className="text-zinc-500">.env</code>.
        </>
      }
    >
        {!loading && meta && (
          <div className={`${ui.calloutInfo} mb-6`}>
            <p className="font-medium text-sky-50">Contagem atual no banco</p>
            <ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-400">
              <li>
                Primeiro sinal:{" "}
                {meta.firstSignalAt
                  ? new Date(meta.firstSignalAt).toLocaleString("pt-BR")
                  : "—"}
              </li>
              <li>
                Primeiro evento (coletor):{" "}
                {meta.firstEventAt
                  ? new Date(meta.firstEventAt).toLocaleString("pt-BR")
                  : "—"}
              </li>
              <li>
                Odds gravadas: {meta.oddsSnapshotsTotal} linhas (histórico por
                coleta; lotes iguais não duplicam) · Eventos: {meta.eventsTotal}{" "}
                · Torneios: {meta.tournamentsTotal}
              </li>
            </ul>
            <p className="mt-2 text-[11px] text-zinc-500">
              Mercados e cotações por jogo:{" "}
              <a href="/live" className="text-sky-400 underline">
                Ao vivo
              </a>{" "}
              ou{" "}
              <code className="text-zinc-600">GET /api/live</code> (campo{" "}
              <code className="text-zinc-600">odds</code>). Cada sinal novo
              guarda um snapshot das cotações no momento da criação (
              <code className="text-zinc-600">oddsAtSignalLines</code> na API).
              Para o mercado principal do plano atual, mostramos também a odd de{" "}
              <strong className="text-zinc-300">
                Total de Gols da Equipe
              </strong>{" "}
              no instante do sinal.
            </p>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={resetApplicationData}
            disabled={resetting}
            className={ui.btnDanger}
          >
            {resetting ? "A limpar…" : "Limpar dados (sinais + jogos + odds)"}
          </button>
          <span className="text-[11px] text-zinc-500">
            Ou no terminal:{" "}
            <code className="text-zinc-600">npm run db:reset</code> (apaga o
            ficheiro SQLite e recria tudo).
          </span>
        </div>

        <div className={`${ui.calloutNeutral} mb-6`}>
          <p className="font-medium text-zinc-300">Legenda — coluna &quot;Mercados (acertos)&quot;</p>
          <ul className="mt-2 list-inside list-disc space-y-1.5">
            <li>
              Só aparecem os mercados que{" "}
              <strong className="text-zinc-300">existiam naquele sinal</strong>{" "}
              quando foi gerado. Sinais antigos podem ter só 3 linhas; sinais
              novos (com env com todos os ids) mostram até 11 chips.
            </li>
            <li>
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-emerald-950/80 text-emerald-400">
                ✓
              </span>{" "}
              = acertou esse mercado ·{" "}
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-red-950/60 text-red-400">
                ✗
              </span>{" "}
              = errou. Isto é o resultado real do jogo, não tem a ver com gales.
            </li>
          </ul>
        </div>

        {loading && <p className={ui.loading}>Carregando…</p>}
        {err && <p className={ui.error}>{err}</p>}

        {!loading && !err && summary && (
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="rounded-xl border border-zinc-600/60 bg-zinc-900/70 px-4 py-3 shadow-md shadow-black/30">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pendentes
              </p>
              <p className="text-2xl font-bold tabular-nums text-zinc-100">
                {summary.pending}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-600/60 bg-zinc-900/70 px-4 py-3 shadow-md shadow-black/30">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Resolvidos
              </p>
              <p className="text-2xl font-bold tabular-nums text-zinc-100">
                {summary.resolved}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/25 px-4 py-3 shadow-md shadow-black/30">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-600/90">
                Média acertos / sinal
              </p>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">
                {summary.avgHitsPerSignal ?? "—"}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {summary.totalHits} acertos · até{" "}
                {summary.maxPossibleHits} mercados contabilizados
              </p>
            </div>
          </div>
        )}

        {!loading && !err && byMarket && summary && summary.resolved > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Assertividade por mercado (sinais resolvidos)
            </p>
            <p className="mb-2 text-[11px] text-zinc-500">
              Só entram cartões em que houve pelo menos um sinal com esse mercado.
              Histórico antigo pode mostrar só 3 mercados até haver resoluções com
              picks maiores.
            </p>
            <div className="flex flex-wrap gap-3">
              {IMPLEMENTED_MARKET_IDS.filter((id) => (byMarket[id]?.total ?? 0) > 0).map(
                (id) => {
                  const b = byMarket[id];
                  return (
                    <div
                      key={id}
                      className="min-w-[140px] flex-1 rounded-xl border border-zinc-600/60 bg-zinc-900/70 px-3 py-2 shadow-md shadow-black/30"
                    >
                      <p className="text-[11px] font-medium text-zinc-400">
                        {b.label}
                      </p>
                      <p className="mt-0.5 text-lg font-bold tabular-nums text-sky-300">
                        {b.pct != null ? `${b.pct}%` : "—"}
                      </p>
                      <p className="font-mono text-[10px] text-zinc-500">
                        {b.hit}/{b.total}
                      </p>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        )}

        {!loading && !err && galeHydrated && (
          <section className="mt-8 rounded-xl border border-zinc-600/60 bg-zinc-900/40 p-4 shadow-inner shadow-black/20">
            <h2 className="text-sm font-semibold text-zinc-100">
              Simulação de banca (gales)
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-amber-200/80">
              Simulação educativa: não há dinheiro real nem odds de mercado. Gales
              aumentam o risco e não mudam a vantagem matemática a longo prazo.
              Aposte só o que pode perder.
            </p>
            <div className="mt-3 space-y-2 rounded-lg border border-zinc-700/80 bg-zinc-950/40 px-3 py-2.5 text-xs leading-relaxed text-zinc-400">
              <p className="font-medium text-zinc-300">Como ler esta secção</p>
              <ul className="list-inside list-disc space-y-1.5">
                <li>
                  Cada <strong className="text-zinc-300">rodada</strong> é um
                  sinal já resolvido, na ordem do tempo (mais antigo primeiro).
                  Não é por mercado dentro do jogo — é um &quot;passo&quot; na
                  sequência de jogos.
                </li>
                <li>
                  <strong className="text-emerald-400/90">GREEN</strong> /{" "}
                  <strong className="text-red-400/90">RED</strong> na tabela
                  abaixo referem-se só à{" "}
                  <strong className="text-zinc-300">regra de green</strong> que
                  escolheste: com &quot;≥1 acerto&quot;, GREEN se acertaste pelo
                  menos um mercado daquele sinal; RED se acertaste zero. Com
                  &quot;Todos os mercados&quot;, GREEN só se acertaste todos.
                </li>
                <li>
                  <strong className="text-zinc-300">Gale</strong> (número na
                  coluna): nível 0 = stake normal; 1 = primeiro gale depois de um
                  RED; 2 e 3 = seguintes. O stake = base × (multiplicador)
                  <sup>nível</sup>. Depois de um GREEN, o nível volta a 0. Se
                  perdes no nível máximo, o próximo passo volta à base (marca
                  &quot;reset&quot;).
                </li>
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Stake base
                <input
                  type="number"
                  min={0.01}
                  step={0.5}
                  value={galeConfig.baseStake}
                  onChange={(e) =>
                    setGaleConfig((c) => ({
                      ...c,
                      baseStake: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-28 rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 font-mono text-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Multiplicador
                <input
                  type="number"
                  min={1}
                  step={0.25}
                  value={galeConfig.multiplier}
                  onChange={(e) =>
                    setGaleConfig((c) => ({
                      ...c,
                      multiplier: Number(e.target.value) || 1,
                    }))
                  }
                  className="w-24 rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 font-mono text-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Máx. gales (níveis 0…N)
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={1}
                  value={galeConfig.maxGales}
                  onChange={(e) =>
                    setGaleConfig((c) => ({
                      ...c,
                      maxGales: Math.round(Number(e.target.value)) || 0,
                    }))
                  }
                  className="w-24 rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 font-mono text-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Odd fixa (simulação)
                <input
                  type="number"
                  min={1.01}
                  step={0.05}
                  value={galeConfig.fixedOdd}
                  onChange={(e) =>
                    setGaleConfig((c) => ({
                      ...c,
                      fixedOdd: Number(e.target.value) || 1.01,
                    }))
                  }
                  className="w-24 rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 font-mono text-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Banca inicial
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={galeConfig.startingBankroll}
                  onChange={(e) =>
                    setGaleConfig((c) => ({
                      ...c,
                      startingBankroll: Number(e.target.value) || 0,
                    }))
                  }
                  className="w-28 rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 font-mono text-zinc-100"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Regra de green
                <select
                  value={galeConfig.greenRule}
                  onChange={(e) =>
                    setGaleConfig((c) => ({
                      ...c,
                      greenRule: e.target.value === "allHits" ? "allHits" : "anyHit",
                    }))
                  }
                  className="rounded border border-zinc-600 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100"
                >
                  <option value="anyHit">≥1 acerto (any hit)</option>
                  <option value="allHits">Todos os mercados (full)</option>
                </select>
              </label>
            </div>

            {galeSim.results.length > 0 && (
              <div className="mt-4">
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-[11px] text-zinc-500">Banca final (última rodada)</p>
                    <p className="font-mono text-2xl font-semibold text-emerald-300">
                      {galeSim.results[
                        galeSim.results.length - 1
                      ]?.bancaDepois.toFixed(2) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-zinc-500">P/L vs inicial</p>
                    <p
                      className={`font-mono text-lg font-semibold ${
                        (galeSim.results[galeSim.results.length - 1]?.bancaDepois ??
                          galeConfig.startingBankroll) -
                          galeConfig.startingBankroll >=
                        0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {(
                        (galeSim.results[galeSim.results.length - 1]?.bancaDepois ??
                          galeConfig.startingBankroll) - galeConfig.startingBankroll
                      ).toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-zinc-700/80 bg-zinc-950/50 p-2">
                  <p className="mb-1 text-[10px] uppercase text-zinc-500">
                    Evolução da banca
                  </p>
                  <BankrollSparkline
                    values={[
                      galeConfig.startingBankroll,
                      ...galeSim.results.map((x) => x.bancaDepois),
                    ]}
                  />
                </div>
              </div>
            )}

            {galeSim.results.length > 0 && (
              <div className="mt-4 max-h-64 overflow-auto rounded-lg border border-zinc-700/60">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="sticky top-0 bg-zinc-800/95 text-zinc-300">
                    <tr>
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Jogo</th>
                      <th className="px-2 py-2">Resolvido</th>
                      <th
                        className="px-2 py-2"
                        title="Acertos nesse sinal / mercados no sinal"
                      >
                        Hits
                      </th>
                      <th
                        className="px-2 py-2"
                        title="Nível de gale no início desta rodada (0 = stake base)"
                      >
                        Gale
                      </th>
                      <th className="px-2 py-2">Stake</th>
                      <th
                        className="px-2 py-2"
                        title="Vitória ou derrota da rodada segundo a regra de green"
                      >
                        Rodada
                      </th>
                      <th className="px-2 py-2">P/L</th>
                      <th className="px-2 py-2">Banca</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 text-zinc-400">
                    {galeSim.results.map((sim, i) => {
                      const row = galeSim.resolved[i];
                      return (
                        <tr key={row?.id ?? i} className="hover:bg-zinc-800/40">
                          <td className="px-2 py-1.5 font-mono text-zinc-500">
                            {i + 1}
                          </td>
                          <td className="max-w-[180px] truncate px-2 py-1.5 text-zinc-300">
                            {row?.matchName ?? "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-[10px]">
                            {row?.resolvedAt
                              ? new Date(row.resolvedAt).toLocaleString("pt-BR")
                              : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 font-mono text-zinc-300">
                            {row?.hitsTotal ?? "—"} / {row?.picksCount ?? "—"}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-amber-200/90">
                            {sim.galeLevel}
                            {sim.forcedReset && (
                              <span className="ml-1 text-[10px] text-zinc-500">
                                (reset)
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 font-mono">
                            {sim.stake.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5">
                            {sim.green ? (
                              <span
                                className="text-emerald-400"
                                title="Rodada ganha pela regra de green"
                              >
                                GREEN
                              </span>
                            ) : (
                              <span
                                className="text-red-400"
                                title="Rodada perdida pela regra de green"
                              >
                                RED
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-2 py-1.5 font-mono ${
                              sim.netPl >= 0 ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {sim.netPl >= 0 ? "+" : ""}
                            {sim.netPl.toFixed(2)}
                          </td>
                          <td className="px-2 py-1.5 font-mono text-zinc-200">
                            {sim.bancaDepois.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {galeSim.results.length === 0 && summary && summary.resolved === 0 && (
              <p className="mt-4 text-xs text-zinc-500">
                Sem sinais resolvidos ainda — a simulação aparece quando houver
                histórico.
              </p>
            )}
            {galeSim.results.length === 0 && summary && summary.resolved > 0 && (
              <p className="mt-4 text-xs text-zinc-500">
                Nenhum sinal com mercados contabilizados para simular (verifica{" "}
                <code className="text-zinc-400">picksCount</code>).
              </p>
            )}
          </section>
        )}

        {!loading && !err && (
          <div className={`${ui.tablePanel} mt-8`}>
            <table className={`${ui.table} min-w-[720px]`}>
              <thead className={ui.thead}>
                <tr>
                  <th className={ui.th}>Jogo</th>
                  <th className={ui.th}>Sinal</th>
                  <th className={ui.th}>Placar</th>
                  <th className={ui.th}>Mercados (acertos)</th>
                  <th
                    className={ui.th}
                    title="Linhas de odds congeladas quando o sinal foi criado"
                  >
                    Odds no sinal
                  </th>
                  <th className={ui.th}>Cadeia gale</th>
                  <th className={ui.th}>Pts</th>
                </tr>
              </thead>
              <tbody className={ui.tbody}>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={
                      i % 2 === 1
                        ? "bg-zinc-900/50 hover:bg-zinc-800/90"
                        : "hover:bg-zinc-800/50"
                    }
                  >
                    <td className="px-3 py-2 align-top text-zinc-200">
                      <div className="max-w-[200px] text-xs font-medium">
                        {r.matchName}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {new Date(r.matchDate).toLocaleString("pt-BR")}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <pre className="max-w-[280px] whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-zinc-300">
                        {r.message}
                      </pre>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-base font-semibold text-amber-200/90">
                      {r.homeScore != null && r.awayScore != null
                        ? `${r.homeScore}-${r.awayScore}`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex max-w-[min(100vw,420px)] flex-wrap gap-1.5">
                        {orderedMarketsForRow(r).map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-0.5 rounded border border-zinc-700/80 bg-zinc-900/80 px-1 py-0.5 text-[10px] text-zinc-400"
                            title={id}
                          >
                            <span className="max-w-[72px] truncate">
                              {marketDisplayName(id)}
                            </span>
                            {icon(gradeForRow(r, id))}
                          </span>
                        ))}
                        {orderedMarketsForRow(r).length === 0 && (
                          <span className="text-zinc-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 align-top font-mono text-xs text-zinc-400">
                      {r.oddsAtSignalLines != null && r.oddsAtSignalLines > 0 ? (
                        <div className="space-y-0.5">
                          <div>{r.oddsAtSignalLines} linhas</div>
                          <div className="text-amber-200/90">
                            TeamOu:{" "}
                            {typeof r.oddsTeamOuAtSignal === "number"
                              ? `@ ${r.oddsTeamOuAtSignal.toFixed(2)}`
                              : "—"}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 align-top text-xs">
                      <div className="font-mono text-zinc-300">
                        {r.galeAttemptInChain != null ? `T${r.galeAttemptInChain}` : "—"}
                      </div>
                      <div className="text-[10px]">
                        {r.galeChainStatus === "green" && (
                          <span className="text-emerald-400/90">GREEN fecha ciclo</span>
                        )}
                        {r.galeChainStatus === "red-final" && (
                          <span className="text-red-400/90">RED final (gales esgotados)</span>
                        )}
                        {r.galeChainStatus === "red-keep" && (
                          <span className="text-amber-300/90">RED parcial (segue gale)</span>
                        )}
                        {r.galeChainStatus == null && (
                          <span className="text-zinc-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center font-mono text-lg font-semibold text-zinc-100">
                      {r.hitsTotal ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="p-8 text-center text-sm text-zinc-500">
                Ainda não há sinais. Rode o coletor com jogos futuros no banco —
                os sinais são gerados automaticamente.
              </p>
            )}
          </div>
        )}

        <p className="mt-8 text-xs leading-relaxed text-zinc-500">
          Atualize a página após os jogos terminarem para ver acertos. O coletor
          resolve sozinho na próxima execução.
        </p>
    </PageShell>
  );
}
