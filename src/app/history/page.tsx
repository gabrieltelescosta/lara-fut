"use client";

import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";
import { useCallback, useEffect, useState } from "react";

type Row = {
  resultId: string;
  superbetEventId: number;
  matchName: string;
  matchDate: string;
  tournamentId: number | null;
  tournamentName: string | null;
  homeScore: number;
  awayScore: number;
  status: string;
  finishedAt: string;
  settlement?: {
    parsedCount: number;
    unparsedCount: number;
    totalLines: number;
  } | null;
};

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(15);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tournamentId, setTournamentId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tournamentId.trim()) qs.set("tournamentId", tournamentId.trim());
      const r = await fetch(`/api/results?${qs}`);
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setRows(j.data);
      setTotal(j.total);
      setTotalPages(j.totalPages);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PageShell
      title="Histórico"
      description="Resultados finais com resumo de liquidação automática (linhas de odds reconhecidas vs placar)."
    >
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <label className={ui.label}>
          Torneio (ID)
          <input
            className={`${ui.input} min-w-[140px]`}
            placeholder="ex: 92228"
            value={tournamentId}
            onChange={(e) => {
              setTournamentId(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <button type="button" onClick={() => load()} className={ui.btnPrimary}>
          Aplicar filtro
        </button>
      </div>

      {loading && <p className={ui.loading}>Carregando…</p>}
      {err && <p className={ui.error}>{err}</p>}

      {!loading && !err && (
        <>
          <p className="mb-4 text-xs text-zinc-500">
            Total: {total} · Página {page} de {Math.max(1, totalPages)}
          </p>
          <div className={ui.tablePanel}>
            <table className={`${ui.table} min-w-[800px]`}>
              <thead className={ui.thead}>
                <tr>
                  <th className={ui.th}>Final</th>
                  <th className={ui.th}>Partida</th>
                  <th className={ui.th}>Placar</th>
                  <th
                    className={ui.th}
                    title="Linhas de odds com resultado calculado vs não reconhecidas / total"
                  >
                    Liquidação
                  </th>
                  <th className={ui.th}>Torneio</th>
                </tr>
              </thead>
              <tbody className={ui.tbody}>
                {rows.map((e) => (
                  <tr key={e.resultId} className="hover:bg-zinc-800/40">
                    <td className={ui.tdMuted}>
                      {new Date(e.finishedAt).toLocaleString("pt-BR")}
                    </td>
                    <td className={ui.tdStrong}>{e.matchName}</td>
                    <td className="px-3 py-2 font-mono text-zinc-100">
                      {e.homeScore} – {e.awayScore}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                      {e.settlement && e.settlement.totalLines > 0 ? (
                        <>
                          <span className="text-emerald-400/90">
                            {e.settlement.parsedCount}
                          </span>
                          <span className="text-zinc-600"> + </span>
                          <span className="text-zinc-500">
                            {e.settlement.unparsedCount}
                          </span>
                          <span className="text-zinc-600"> ? / </span>
                          <span className="text-zinc-300">
                            {e.settlement.totalLines}
                          </span>
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {e.tournamentId ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && (
              <p className="p-6 text-center text-sm text-zinc-500">
                Nenhum resultado ainda. Execute o coletor enquanto há jogos a
                finalizar.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={ui.btnPrimary}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={ui.btnPrimary}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </PageShell>
  );
}
