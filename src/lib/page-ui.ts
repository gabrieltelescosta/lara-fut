/** Classes partilhadas para páginas da app (layout + tabelas + formulários). */

export const ui = {
  /** Conteúdo principal sob o header global. */
  main: "mx-auto w-full max-w-6xl flex-1 px-4 py-8",

  pageTitle: "text-xl font-semibold tracking-tight text-zinc-50",
  pageDesc: "mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400",

  /** Tabela principal (lista de dados). */
  tablePanel:
    "overflow-x-auto rounded-xl border border-zinc-600/60 bg-zinc-900/50 shadow-lg shadow-black/25",
  table: "w-full min-w-[640px] text-left text-sm",
  thead: "border-b border-zinc-600 bg-zinc-800/95",
  th: "px-3 py-3 font-semibold text-zinc-200",
  tbody: "divide-y divide-zinc-700/80",
  tdMuted: "whitespace-nowrap px-3 py-2 text-zinc-400",
  tdStrong: "px-3 py-2 font-medium text-zinc-100",

  /** Cartão / métrica. */
  statCard:
    "rounded-xl border border-zinc-600/60 bg-zinc-900/50 p-4 shadow-md shadow-black/20",

  loading: "mt-6 text-sm text-zinc-500",
  error:
    "mt-6 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300",

  input:
    "rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500",
  label: "flex flex-col gap-1 text-xs font-medium text-zinc-500",

  btnPrimary:
    "rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40",
  btnDanger:
    "rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs font-medium text-red-200 transition hover:bg-red-950/70 disabled:opacity-50",

  calloutInfo:
    "rounded-xl border border-sky-900/50 bg-sky-950/30 px-4 py-3 text-xs text-sky-100/95",
  calloutNeutral:
    "rounded-xl border border-zinc-600/70 bg-zinc-900/60 px-4 py-3 text-xs leading-relaxed text-zinc-400",
} as const;
