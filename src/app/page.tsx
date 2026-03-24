import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";

export default function Home() {
  return (
    <PageShell
      title="Início"
      description={
        <>
          Coleta automática de eventos, odds e resultados (futebol virtual,{" "}
          <code className="text-zinc-500">sportId 190</code>). Os{" "}
          <strong className="text-zinc-200">sinais</strong> são gerados pelo
          coletor e acompanhados no <strong className="text-zinc-200">Tracker</strong>
          ; a <strong className="text-zinc-200">Estratégia</strong> mostra o
          backtest walk-forward sobre o mesmo histórico.
        </>
      }
    >
      <section className="space-y-6">
        <div className={ui.calloutNeutral}>
          <p className="font-medium text-zinc-300">Fluxo rápido</p>
          <ol className="mt-3 list-inside list-decimal space-y-2 text-zinc-400">
            <li>
              <strong className="text-zinc-300">Dados:</strong>{" "}
              <span className="text-zinc-500">Ao vivo</span> e{" "}
              <span className="text-zinc-500">Histórico</span> mostram o que está
              no SQLite.
            </li>
            <li>
              <strong className="text-zinc-300">Sinais:</strong> automáticos no
              coletor — métricas e gale no{" "}
              <span className="text-zinc-500">Tracker</span>.
            </li>
            <li>
              <strong className="text-zinc-300">Refino:</strong>{" "}
              <span className="text-zinc-500">Estratégia</span> compara
              heurísticas; <span className="text-zinc-500">Estatísticas</span>{" "}
              agrega placares.
            </li>
          </ol>
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            API útil
          </h2>
          <ul className="space-y-2 text-sm text-zinc-300">
            <li>
              <code className="text-red-400/90">POST /api/collector/run</code>{" "}
              — corre o coletor manualmente.
            </li>
            <li>
              <code className="text-red-400/90">GET /api/cron/collector</code> —
              mesmo fluxo, protegido (cron / Bearer).
            </li>
            <li className="text-zinc-500">
              Com{" "}
              <code className="text-zinc-400">ENABLE_COLLECTOR_CRON=true</code>{" "}
              no <code className="text-zinc-400">.env</code>, o processo Node
              agenda o coletor a cada 1 min. Em produção (Vercel), usa o cron em{" "}
              <code className="text-zinc-400">/api/cron/collector</code> e deixa{" "}
              <code className="text-zinc-400">ENABLE_COLLECTOR_CRON=false</code>
              .
            </li>
          </ul>
        </div>
      </section>
    </PageShell>
  );
}
