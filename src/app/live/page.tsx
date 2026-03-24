"use client";

import { PageShell } from "@/components/PageShell";
import { SettlementBreakdown } from "@/components/SettlementBreakdown";
import type { SettlementForClient } from "@/lib/settlement-api";
import { ui } from "@/lib/page-ui";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

type OddLine = {
  marketName: string;
  outcomeName: string;
  price: number;
  info: string | null;
  capturedAt: string;
};

type Row = {
  id: string;
  superbetEventId: number;
  matchName: string;
  matchDate: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  tournamentId: number | null;
  finishedAt: string | null;
  hasResult: boolean;
  hasListingPayload?: boolean;
  hasSubscriptionPayload?: boolean;
  settlement?: SettlementForClient | null;
  oddsCount?: number;
  odds?: OddLine[];
};

function groupOddsByMarket(odds: OddLine[]): Map<string, OddLine[]> {
  const m = new Map<string, OddLine[]>();
  for (const o of odds) {
    const key = o.marketName || "—";
    const list = m.get(key) ?? [];
    list.push(o);
    m.set(key, list);
  }
  return m;
}

function distinctMarketCount(odds: OddLine[] | undefined): number {
  if (!odds?.length) return 0;
  return new Set(odds.map((o) => o.marketName)).size;
}

export default function LivePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [at, setAt] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/live");
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setRows(j.data);
      setAt(j.at);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const colCount = 6;

  const description = useMemo(
    () => (
      <>
        Cada corrida do coletor grava{" "}
        <strong className="text-zinc-200">listagem + odds + subscrição</strong>{" "}
        no SQLite. Expande <strong className="text-zinc-200">Mercados</strong>{" "}
        para ver todas as linhas e cotações. Quando o jogo fecha, o sistema
        gera <strong className="text-zinc-200">liquidação</strong>: na coluna vês{" "}
        <span className="text-emerald-400/90">✓</span> bateu /{" "}
        <span className="text-red-300/80">✗</span> não bateu /{" "}
        <span className="text-zinc-500">?</span> sem parser. Expande o jogo para
        a lista completa por mercado.
      </>
    ),
    [],
  );

  return (
    <PageShell
      title="Ao vivo"
      description={description}
      actions={
        <p className="text-right text-xs leading-relaxed text-zinc-500">
          Atualiza a cada 15s
          <br />
          <span className="font-mono text-zinc-400">
            {at ? new Date(at).toLocaleString("pt-BR") : "—"}
          </span>
        </p>
      }
    >
      {loading && <p className={ui.loading}>Carregando…</p>}
      {err && <p className={ui.error}>{err}</p>}
      {!loading && !err && (
        <div className={ui.tablePanel}>
          <table className={ui.table}>
            <thead className={ui.thead}>
              <tr>
                <th className={ui.th}>Horário</th>
                <th className={ui.th}>Partida</th>
                <th className={ui.th}>Status</th>
                <th className={ui.th}>Placar</th>
                <th className={ui.th}>Liquidação</th>
                <th className={ui.th}>Mercados / odds</th>
              </tr>
            </thead>
            <tbody className={ui.tbody}>
              {rows.map((e, i) => {
                const odds = e.odds ?? [];
                const nLines = e.oddsCount ?? odds.length;
                const nMarkets = distinctMarketCount(odds);
                const open = expandedId === e.id;
                const byMarket = open ? groupOddsByMarket(odds) : null;

                return (
                  <Fragment key={e.id}>
                    <tr
                      className={
                        i % 2 === 1
                          ? "bg-zinc-900/50 hover:bg-zinc-800/80"
                          : "hover:bg-zinc-800/40"
                      }
                    >
                      <td className={ui.tdMuted}>
                        {new Date(e.matchDate).toLocaleString("pt-BR")}
                      </td>
                      <td className={ui.tdStrong}>
                        <span className="block">{e.matchName}</span>
                        <span className="mt-0.5 block font-mono text-[10px] font-normal text-zinc-500">
                          id {e.superbetEventId}
                          {e.tournamentId != null
                            ? ` · torneio ${e.tournamentId}`
                            : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            e.status === "FINISHED"
                              ? "text-emerald-400"
                              : "text-amber-400"
                          }
                        >
                          {e.status}
                        </span>
                        {e.hasResult && (
                          <span className="ml-2 text-xs text-zinc-500">
                            (resultado gravado)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-base font-semibold text-amber-200/90">
                        {e.homeScore != null && e.awayScore != null
                          ? `${e.homeScore} – ${e.awayScore}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-zinc-400">
                        {!e.hasResult ? (
                          <span className="text-zinc-600">—</span>
                        ) : e.settlement && e.settlement.totalLines > 0 ? (
                          <SettlementBreakdown
                            settlement={e.settlement}
                            compactSummary
                          />
                        ) : (
                          <span className="text-zinc-600">sem liquidação</span>
                        )}
                      </td>
                      <td className="px-3 py-2 align-top">
                        {nLines === 0 ? (
                          <span className="text-sm text-zinc-500">
                            Sem odds ainda
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedId((id) =>
                                id === e.id ? null : e.id,
                              )
                            }
                            className="text-left text-sm text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                          >
                            {nMarkets} mercado{nMarkets === 1 ? "" : "s"} ·{" "}
                            {nLines} linha{nLines === 1 ? "" : "s"}{" "}
                            <span className="font-mono text-zinc-500">
                              {open ? "▲" : "▼"}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && byMarket && (
                      <tr
                        key={`${e.id}-detail`}
                        className={
                          i % 2 === 1 ? "bg-zinc-900/50" : "bg-zinc-900/30"
                        }
                      >
                        <td colSpan={colCount} className="px-3 py-4">
                          <div className="space-y-4">
                            {e.hasResult &&
                              e.settlement &&
                              e.settlement.lines.length > 0 && (
                                <SettlementBreakdown settlement={e.settlement} />
                              )}
                            <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/60 p-3">
                            <p className="mb-3 text-xs text-zinc-500">
                              Último lote de cotações. Payload bruto da oferta:{" "}
                              <code className="text-zinc-400">
                                listingPayloadJson
                              </code>{" "}
                              e SSE:{" "}
                              <code className="text-zinc-400">
                                subscriptionPayloadJson
                              </code>{" "}
                              (ver{" "}
                              <code className="text-zinc-400">
                                GET /api/live?full=1
                              </code>
                              ).
                            </p>
                            <div className="max-h-[min(420px,55vh)] space-y-4 overflow-y-auto pr-1">
                              {[...byMarket.entries()]
                                .sort(([a], [b]) => a.localeCompare(b, "pt"))
                                .map(([market, lines]) => (
                                  <div key={market}>
                                    <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                                      {market}
                                    </h3>
                                    <ul className="space-y-1 font-mono text-[11px] text-zinc-300">
                                      {lines.map((o, idx) => (
                                        <li
                                          key={`${o.outcomeName}-${o.price}-${idx}`}
                                          className="flex flex-wrap gap-x-2 border-b border-zinc-800/80 py-1 last:border-0"
                                        >
                                          <span className="text-zinc-200">
                                            {o.outcomeName}
                                          </span>
                                          {o.info ? (
                                            <span className="text-zinc-500">
                                              ({o.info})
                                            </span>
                                          ) : null}
                                          <span className="text-amber-200/90">
                                            {o.price.toFixed(2)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                            </div>
                          </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-500">
              Nenhum evento no banco. Rode o coletor:{" "}
              <code className="text-zinc-400">POST /api/collector/run</code>
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
