"use client";

import type { SettlementForClient } from "@/lib/settlement-api";
import { useMemo } from "react";

function hitBadge(hit: boolean | null) {
  if (hit === true) {
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/20 text-emerald-300">
        bateu
      </span>
    );
  }
  if (hit === false) {
    return (
      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-red-500/15 text-red-300/90">
        não
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-zinc-600/30 text-zinc-500"
      title="Mercado não reconhecido pelo parser — amplia odds-settlement se precisares"
    >
      —
    </span>
  );
}

export function SettlementBreakdown({
  settlement,
  compactSummary,
}: {
  settlement: SettlementForClient;
  /** Uma linha curta para células da tabela */
  compactSummary?: boolean;
}) {
  const byMarket = useMemo(() => {
    const m = new Map<string, SettlementForClient["lines"]>();
    for (const L of settlement.lines) {
      const key = L.marketName || "—";
      const list = m.get(key) ?? [];
      list.push(L);
      m.set(key, list);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "pt"));
  }, [settlement.lines]);

  if (compactSummary) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[11px] leading-relaxed">
        <span className="font-mono text-emerald-400/90">{settlement.winCount}</span>
        <span className="text-zinc-600">✓</span>
        <span className="font-mono text-red-300/80">{settlement.lossCount}</span>
        <span className="text-zinc-600">✗</span>
        <span className="font-mono text-zinc-500">{settlement.unparsedCount}</span>
        <span className="text-zinc-600">?</span>
        <span className="text-zinc-600">/</span>
        <span className="font-mono text-zinc-400">{settlement.totalLines}</span>
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-700/80 bg-zinc-950/80 p-3">
      <p className="mb-2 text-xs text-zinc-400">
        Placar final{" "}
        <span className="font-mono font-semibold text-amber-200/90">
          {settlement.homeScore} – {settlement.awayScore}
        </span>
        {settlement.snapshotCapturedAt ? (
          <>
            {" "}
            · lote odds capturado{" "}
            <span className="font-mono text-zinc-500">
              {new Date(settlement.snapshotCapturedAt).toLocaleString("pt-BR")}
            </span>
          </>
        ) : null}
      </p>
      <p className="mb-3 text-[11px] text-zinc-500">
        <span className="text-emerald-400/90">{settlement.winCount}</span> bateu ·{" "}
        <span className="text-red-300/80">{settlement.lossCount}</span> não bateu ·{" "}
        <span className="text-zinc-500">{settlement.unparsedCount}</span> sem parser (
        {settlement.totalLines} linhas)
      </p>
      <div className="max-h-[min(380px,50vh)] space-y-3 overflow-y-auto pr-1">
        {byMarket.map(([market, lines]) => (
          <div key={market}>
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
              {market}
            </h4>
            <ul className="space-y-1">
              {lines.map((L, idx) => (
                <li
                  key={`${L.outcomeName}-${L.price}-${idx}`}
                  className="flex flex-wrap items-center gap-2 border-b border-zinc-800/60 py-1.5 text-[11px] last:border-0"
                >
                  {hitBadge(L.hit)}
                  <span className="font-mono text-zinc-200">{L.outcomeName}</span>
                  {L.info ? (
                    <span className="text-zinc-500">({L.info})</span>
                  ) : null}
                  <span className="font-mono text-amber-200/80">{L.price.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
