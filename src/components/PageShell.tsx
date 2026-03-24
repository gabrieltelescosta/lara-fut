import { AppNav } from "@/components/AppNav";
import { ui } from "@/lib/page-ui";
import type { ReactNode } from "react";

type PageShellProps = {
  title: string;
  description?: ReactNode;
  /** Conteúdo à direita do título (ex.: última atualização, botões). */
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Layout padrão: nav global + main com cabeçalho de página alinhado.
 */
export function PageShell({
  title,
  description,
  actions,
  children,
}: PageShellProps) {
  return (
    <>
      <AppNav />
      <main className={ui.main}>
        <header className="mb-8 flex flex-col gap-4 border-b border-zinc-800/90 pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className={ui.pageTitle}>{title}</h1>
            {description != null ? (
              <div className={ui.pageDesc}>{description}</div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              {actions}
            </div>
          ) : null}
        </header>
        {children}
      </main>
    </>
  );
}
