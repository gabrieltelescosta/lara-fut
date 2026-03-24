import { AppNav } from "@/components/AppNav";
import { ui } from "@/lib/page-ui";
import { Suspense } from "react";
import { TeamPageContent } from "./TeamPageContent";

export default function TeamHistoryPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppNav />
          <div
            className={`${ui.main} flex min-h-[40vh] items-center justify-center text-sm text-zinc-500`}
          >
            Carregando…
          </div>
        </>
      }
    >
      <TeamPageContent />
    </Suspense>
  );
}
