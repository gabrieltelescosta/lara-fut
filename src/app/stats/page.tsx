"use client";

import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";
import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Stats = {
  totalFinishedMatches: number;
  averageTotalGoals: number;
  topScorelines: { scoreline: string; count: number }[];
};

export default function StatsPage() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/stats");
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
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

  const chartData =
    data?.topScorelines.map((s) => ({
      name: s.scoreline,
      jogos: s.count,
    })) ?? [];

  return (
    <PageShell
      title="Estatísticas"
      description="Agregados sobre resultados finais no SQLite — mesma fonte que Histórico e simulações."
    >
      {loading && <p className={ui.loading}>Carregando…</p>}
      {err && <p className={ui.error}>{err}</p>}

      {!loading && !err && data && (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className={ui.statCard}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Partidas finalizadas
              </p>
              <p className="mt-1 text-3xl font-semibold text-zinc-100">
                {data.totalFinishedMatches}
              </p>
            </div>
            <div className={ui.statCard}>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Média de gols (total)
              </p>
              <p className="mt-1 text-3xl font-semibold text-zinc-100">
                {data.averageTotalGoals}
              </p>
            </div>
          </div>

          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Placares mais frequentes
            </h2>
            <div
              className={`${ui.tablePanel} h-80 p-2`}
              style={{ overflow: "hidden" }}
            >
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ bottom: 8, left: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#18181b",
                        border: "1px solid #52525b",
                        borderRadius: 8,
                      }}
                      labelStyle={{ color: "#e4e4e7" }}
                    />
                    <Bar dataKey="jogos" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="flex h-full items-center justify-center text-sm text-zinc-500">
                  Sem dados — rode o coletor e aguarde partidas finalizadas.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
