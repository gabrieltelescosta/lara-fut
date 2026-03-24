#!/usr/bin/env node
/**
 * Apaga dev.db e recria via migrações (reset “físico”).
 * Uso: npm run db:reset
 */
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(fileURLToPath(new URL("..", import.meta.url)));
const dbPath = join(root, "dev.db");

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log("Removido:", dbPath);
} else {
  console.log("Sem ficheiro dev.db (ok).");
}

execSync("npx prisma migrate deploy", { cwd: root, stdio: "inherit" });
execSync("npx prisma generate", { cwd: root, stdio: "inherit" });
console.log("\nBase nova criada. Corre o coletor para popular dados.");
