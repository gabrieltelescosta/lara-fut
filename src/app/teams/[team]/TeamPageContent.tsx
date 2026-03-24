"use client";

import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";
import { teamFromSlug, teamSlug } from "@/lib/match-name";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  opponent: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  finishedAt: string;
};

export function TeamPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const team = useMemo(
    () => teamFromSlug((params.team as string) ?? ""),
    [params.team],
  );

  const [opponent, setOpponent] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [h2h, setH2h] = useState<Row[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setOpponent(searchParams.get("opponent") ?? "");
  }, [searchParams]);

  const load = useCallback(async () => {
    if (!team) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        team,
        limit: "40",
      });
      if (opponent.trim()) qs.set("opponent", opponent.trim());
      const r = await fetch(`/api/team/matches?${qs}`);
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setRows(j.matches ?? []);
      setH2h(j.h2h ?? []);
      setTotalGames(j.totalGames ?? 0);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [team, opponent]);

  useEffect(() => {
    load();
  }, [load]);

  const applyOpponent = () => {
    const q = new URLSearchParams();
    if (opponent.trim()) q.set("opponent", opponent.trim());
    router.replace(`/teams/${teamSlug(team)}${q.toString() ? `?${q}` : ""}`);
    load();
  };

  return (
    <PageShell
      title={team ? `Time — ${team}` : "Time"}
      description={
        team ? (
          <>
            {totalGames} jogos com resultado no banco (ordenado do mais recente).
            Sinais são automáticos — vê o{" "}
            <Link href="/tracker" className="text-sky-400 underline">
              Tracker
            </Link>
            .
          </>
        ) : (
          "—"
        )
      }
      actions={
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/teams" className="text-zinc-500 hover:text-zinc-300">
            ← Times
          </Link>
        </div>
      }
    >
        <div className="mb-6 flex flex-wrap items-end gap-2">
          <label className={ui.label}>
            Confronto direto (adversário)
            <input
              className={`${ui.input} min-w-[220px]`}
              placeholder="ex: Arsenal (V)"
              value={opponent}
              onChange={(e) => setOpponent(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={applyOpponent}
            className={ui.btnPrimary}
          >
            Aplicar filtro
          </button>
        </div>

        {loading && <p className={ui.loading}>Carregando…</p>}
        {err && <p className={ui.error}>{err}</p>}

        {!loading && !err && opponent.trim() && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-300">
              Contra {opponent.trim()}{" "}
              {h2h.length > 0 ? `(${h2h.length} no recorte)` : "(nenhum confronto gravado)"}
            </h2>
            {h2h.length > 0 && (
              <div className={`${ui.tablePanel} mt-2`}>
                <table className={`${ui.table} min-w-[560px]`}>
                  <thead className={ui.thead}>
                    <tr>
                      <th className={ui.th}>Data</th>
                      <th className={ui.th}>Casa?</th>
                      <th className={ui.th}>Gols</th>
                    </tr>
                  </thead>
                  <tbody className={ui.tbody}>
                    {h2h.map((e, i) => (
                      <tr key={`${e.finishedAt}-${i}`} className="hover:bg-zinc-900/50">
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                          {new Date(e.finishedAt).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-3 py-2 text-zinc-400">
                          {e.isHome ? "Sim" : "Não"}
                        </td>
                        <td className="px-3 py-2 font-mono text-zinc-100">
                          {e.goalsFor} – {e.goalsAgainst}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!loading && !err && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-300">
              Últimos jogos (geral)
            </h2>
            <div className={`${ui.tablePanel} mt-2`}>
              <table className={`${ui.table} min-w-[640px]`}>
                <thead className={ui.thead}>
                  <tr>
                    <th className={ui.th}>Data</th>
                    <th className={ui.th}>Adversário</th>
                    <th className={ui.th}>Casa</th>
                    <th className={ui.th}>Placar (a favor)</th>
                  </tr>
                </thead>
                <tbody className={ui.tbody}>
                  {rows.map((e, i) => (
                    <tr key={`${e.finishedAt}-${i}`} className="hover:bg-zinc-900/50">
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-500">
                        {new Date(e.finishedAt).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-2 text-zinc-200">{e.opponent}</td>
                      <td className="px-3 py-2 text-zinc-400">
                        {e.isHome ? "Sim" : "Não"}
                      </td>
                      <td className="px-3 py-2 font-mono text-zinc-100">
                        {e.goalsFor} – {e.goalsAgainst}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && (
                <p className="p-6 text-center text-sm text-zinc-500">
                  Nenhuma partida encontrada para este time.
                </p>
              )}
            </div>
          </div>
        )}
    </PageShell>
  );
}
