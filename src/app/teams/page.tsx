"use client";

import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";
import { teamSlug } from "@/lib/match-name";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TeamRow = { name: string; games: number };

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/teams");
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      setTeams(j.teams ?? []);
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

  return (
    <PageShell
      title="Times"
      description="Equipas com pelo menos um resultado gravado. Abre o detalhe para ver sequência de jogos (dados locais)."
    >
      {loading && <p className={ui.loading}>Carregando…</p>}
      {err && <p className={ui.error}>{err}</p>}

      {!loading && !err && (
        <div className={ui.tablePanel}>
          <ul className="divide-y divide-zinc-700/80">
            {teams.map((t) => (
              <li key={t.name}>
                <Link
                  href={`/teams/${teamSlug(t.name)}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm text-zinc-200 transition hover:bg-zinc-800/50"
                >
                  <span>{t.name}</span>
                  <span className="font-mono text-xs text-zinc-500">
                    {t.games} jogos
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {teams.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-500">
              Nenhum time ainda — rode o coletor para acumular resultados.
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}
