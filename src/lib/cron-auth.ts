import type { NextRequest } from "next/server";

/** Mesma regra que `/api/cron/collector`: Bearer CRON_SECRET, Vercel Cron, ou dev sem secret. */
export function authorizeCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    const token = auth?.replace(/^Bearer\s+/i, "");
    if (token === secret) return true;
  }
  if (
    process.env.VERCEL === "1" &&
    req.headers.get("x-vercel-cron") === "1"
  ) {
    return true;
  }
  if (!secret && process.env.NODE_ENV !== "production") {
    return true;
  }
  return false;
}
