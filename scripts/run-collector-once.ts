/**
 * Executa o coletor uma vez (CLI), sem subir o Next.
 * Uso: npx tsx scripts/run-collector-once.ts
 */
import { runCollector } from "@/lib/collector";

void runCollector()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
