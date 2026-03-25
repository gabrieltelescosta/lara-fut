"use client";

import { PageShell } from "@/components/PageShell";
import { ui } from "@/lib/page-ui";
import { useCallback, useEffect, useState } from "react";

type SettingsPayload = {
  enabled: boolean | null;
  enabledEffective: boolean;
  envFallbackEnabled: boolean;
  chatId: string;
  chatIdEffective: string;
  signalMarkets: string;
  signalMarketsEffective: string;
  galeMax: number | null;
  galeMaxEffective: number;
  timezone: string;
  timezoneEffective: string;
  botTokenConfigured: boolean;
  botTokenLast4: string | null;
};

const ADMIN_KEY = "virtual-results-cron-secret";

export default function TelegramSettingsPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [payload, setPayload] = useState<SettingsPayload | null>(null);

  const [enabled, setEnabled] = useState<boolean | "inherit">("inherit");
  const [chatId, setChatId] = useState("");
  const [signalMarkets, setSignalMarkets] = useState("");
  const [galeMax, setGaleMax] = useState("");
  const [timezone, setTimezone] = useState("");
  const [botToken, setBotToken] = useState("");

  useEffect(() => {
    try {
      const s = sessionStorage.getItem(ADMIN_KEY);
      if (s) setAdminSecret(s);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const authHeaders = useCallback((): HeadersInit => {
    const h: Record<string, string> = {};
    if (adminSecret.trim()) {
      h.Authorization = `Bearer ${adminSecret.trim()}`;
    }
    return h;
  }, [adminSecret]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/settings/telegram", { headers: authHeaders() });
      if (r.status === 401) {
        throw new Error(
          "Não autorizado. Em produção define CRON_SECRET no servidor e preenche o secret abaixo (igual ao Bearer).",
        );
      }
      if (!r.ok) throw new Error(await r.text());
      const j = (await r.json()) as SettingsPayload;
      setPayload(j);
      setEnabled(
        j.enabled === null || j.enabled === undefined
          ? "inherit"
          : j.enabled,
      );
      setChatId(j.chatId);
      setSignalMarkets(j.signalMarkets);
      setGaleMax(j.galeMax != null ? String(j.galeMax) : "");
      setTimezone(j.timezone);
      setBotToken("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
  }, [hydrated, load]);

  const persistSecret = () => {
    try {
      if (adminSecret.trim()) {
        sessionStorage.setItem(ADMIN_KEY, adminSecret.trim());
      } else {
        sessionStorage.removeItem(ADMIN_KEY);
      }
    } catch {
      /* ignore */
    }
  };

  const save = async () => {
    setSaving(true);
    setErr(null);
    persistSecret();
    try {
      const body: Record<string, unknown> = {
        chatId: chatId.trim(),
        signalMarkets: signalMarkets.trim(),
        timezone: timezone.trim(),
      };
      if (enabled === "inherit") {
        body.enabled = null;
      } else {
        body.enabled = enabled;
      }
      if (galeMax.trim() === "") {
        body.galeMax = null;
      } else {
        const n = Number.parseInt(galeMax, 10);
        if (Number.isNaN(n) || n < 0 || n > 10) {
          throw new Error("Gale max: número entre 0 e 10 (recuperações).");
        }
        body.galeMax = n;
      }
      if (botToken.trim()) {
        body.botToken = botToken.trim();
      }

      const r = await fetch("/api/settings/telegram", {
        method: "PUT",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {
        throw new Error(
          "Não autorizado. Verifica o secret admin (CRON_SECRET no servidor).",
        );
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "Erro ao gravar");
      }
      setBotToken("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="Telegram"
      description={
        <>
          Configuração guardada na base de dados. O ficheiro{" "}
          <code className="text-zinc-300">.env</code> usa-se como fallback
          quando um campo está vazio na BD.
        </>
      }
    >
      <div className="mx-auto max-w-xl space-y-6">
        <div className={ui.calloutNeutral}>
          <p className="font-medium text-zinc-300">Secret admin (CRON_SECRET)</p>
          <p className="mt-1">
            Em produção com <code className="text-zinc-400">CRON_SECRET</code>{" "}
            definido, cola o mesmo valor aqui para carregar e gravar. Opcional
            em dev sem secret.
          </p>
          <input
            type="password"
            autoComplete="off"
            className={`${ui.input} mt-3 w-full`}
            placeholder="Bearer token (mesmo que CRON_SECRET)"
            value={adminSecret}
            onChange={(e) => setAdminSecret(e.target.value)}
          />
          <button
            type="button"
            className={`${ui.btnPrimary} mt-2`}
            onClick={() => {
              persistSecret();
              void load();
            }}
          >
            Recarregar com este secret
          </button>
        </div>

        {err ? <p className={ui.error}>{err}</p> : null}
        {loading ? <p className={ui.loading}>A carregar…</p> : null}

        {payload && !loading ? (
          <div className="space-y-4">
            <p className="text-xs text-zinc-500">
              Efeito atual: Telegram{" "}
              <strong className="text-zinc-300">
                {payload.enabledEffective ? "ligado" : "desligado"}
              </strong>
              {payload.botTokenConfigured ? (
                <>
                  {" "}
                  · token …{" "}
                  <span className="text-zinc-300">{payload.botTokenLast4}</span>
                </>
              ) : (
                " · token não configurado (BD nem .env)"
              )}
            </p>

            <label className={ui.label}>
              Ativar Telegram
              <select
                className={ui.input}
                value={
                  enabled === "inherit"
                    ? "inherit"
                    : enabled
                      ? "true"
                      : "false"
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "inherit") setEnabled("inherit");
                  else setEnabled(v === "true");
                }}
              >
                <option value="inherit">Herdar do .env</option>
                <option value="true">Ligado (BD)</option>
                <option value="false">Desligado (BD)</option>
              </select>
              {enabled === "inherit" ? (
                <span className="text-[11px] text-zinc-600">
                  Env atual:{" "}
                  {payload.envFallbackEnabled ? "true" : "false"} (
                  TELEGRAM_ENABLED)
                </span>
              ) : null}
            </label>

            <label className={ui.label}>
              Chat ID
              <input
                className={ui.input}
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder={payload.chatIdEffective || "-100…"}
              />
            </label>

            <label className={ui.label}>
              Mercados Telegram (CSV, opcional)
              <input
                className={ui.input}
                value={signalMarkets}
                onChange={(e) => setSignalMarkets(e.target.value)}
                placeholder="ex.: teamOu"
              />
              <span className="text-[11px] text-zinc-600">
                Efetivo: {payload.signalMarketsEffective || "(regras default)"}
              </span>
            </label>

            <label className={ui.label}>
              Gales (recuperações, 0–10)
              <input
                className={ui.input}
                value={galeMax}
                onChange={(e) => setGaleMax(e.target.value)}
                placeholder={`vazio = herdar · efetivo ${payload.galeMaxEffective}`}
              />
            </label>

            <label className={ui.label}>
              Fuso horário (IANA)
              <input
                className={ui.input}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder={payload.timezoneEffective}
              />
            </label>

            <label className={ui.label}>
              Novo bot token (deixa vazio para não alterar)
              <input
                type="password"
                className={ui.input}
                autoComplete="off"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={
                  payload.botTokenConfigured
                    ? "•••••••• (mantém o atual)"
                    : "cola o token do BotFather"
                }
              />
            </label>

            <button
              type="button"
              className={ui.btnPrimary}
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "A gravar…" : "Guardar"}
            </button>
          </div>
        ) : null}
      </div>
    </PageShell>
  );
}
