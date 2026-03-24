import { redirect } from "next/navigation";

/** Sinais manuais foram removidos da UI; tudo é automático no Tracker. */
export default function SignalsPage() {
  redirect("/tracker");
}
