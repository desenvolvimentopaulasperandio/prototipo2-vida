// Lógica da função registrar-inscricao, sem dependência de Deno/Supabase (tudo injetado),
// para ser testada de ponta a ponta com banco e webhook falsos (tests/handler.test.mjs).
import { validarCorpo } from "./validacao.ts";

export interface LeadRow {
  nome: string;
  whatsapp: string;
  email: string;
  evento: string;
  data_evento: string;
  origem: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  timestamp: string;
  status_webhook: "pending";
  tentativas_envio: 0;
}

export interface Db {
  /** true = dentro do limite; false = bloqueado. */
  checkRateLimit(ipHash: string, limite: number, janelaSeg: number): Promise<boolean>;
  insertLead(row: LeadRow): Promise<{ id: string }>;
  updateLead(
    id: string,
    patch: { status_webhook: "sent" | "failed"; tentativas_envio: number; erro_webhook: string | null },
  ): Promise<void>;
}

export interface Deps {
  env: (nome: string) => string | undefined;
  db: Db;
  fetchFn: typeof fetch;
  now: () => Date;
  log: (...args: unknown[]) => void;
}

const ORIGENS_DEV = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:3000",
  "http://localhost:5173",
];
const MAX_BODY = 8 * 1024;

function origensPermitidas(env: Deps["env"]): string[] {
  const v = env("ALLOWED_ORIGINS");
  const lista = v ? v.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean) : [];
  return lista.length ? lista : ORIGENS_DEV;
}

function resposta(status: number, corpo: unknown, origin: string | null): Response {
  const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8", "Vary": "Origin", "Cache-Control": "no-store" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "authorization, apikey, content-type, x-client-info";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Max-Age"] = "86400";
  }
  return new Response(JSON.stringify(corpo), { status, headers });
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + "|" + ip));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ipDe(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "desconhecido";
}

/** Corpo enviado ao webhook: EXATAMENTE estes campos, nesta ordem. */
export function montarPayloadWebhook(
  d: { nome: string; whatsapp: string; email: string; evento: string; dataEvento: string; origem: string; utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string; utm_term: string },
  timestamp: string,
) {
  return {
    nome: d.nome,
    whatsapp: d.whatsapp,
    email: d.email,
    evento: d.evento,
    dataEvento: d.dataEvento,
    origem: d.origem,
    utm_source: d.utm_source,
    utm_medium: d.utm_medium,
    utm_campaign: d.utm_campaign,
    utm_content: d.utm_content,
    utm_term: d.utm_term,
    timestamp,
  };
}

async function enviarWebhook(
  url: string,
  payload: unknown,
  fetchFn: typeof fetch,
  timeoutMs: number,
): Promise<{ ok: boolean; erro: string | null }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetchFn(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    try { await r.body?.cancel(); } catch { /* ignora */ }
    if (r.status >= 200 && r.status < 300) return { ok: true, erro: null };
    return { ok: false, erro: `HTTP ${r.status}` };
  } catch (e) {
    const nome = (e as { name?: string })?.name;
    return { ok: false, erro: nome === "AbortError" ? "timeout" : "network_error" };
  } finally {
    clearTimeout(t);
  }
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const { env, db, fetchFn, now, log } = deps;
  const origin = req.headers.get("origin");
  const permitidas = origensPermitidas(env);
  const origemOk = origin ? permitidas.includes(origin.replace(/\/+$/, "")) : false;
  const corsOrigin = origemOk ? origin : null;

  if (req.method === "OPTIONS") {
    if (!origemOk) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin!,
        "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
        "Vary": "Origin",
      },
    });
  }
  if (req.method !== "POST") return resposta(405, { ok: false, code: "method_not_allowed" }, corsOrigin);
  if (origin && !origemOk) return resposta(403, { ok: false, code: "forbidden_origin" }, null);

  // Corpo (limite de tamanho) e JSON
  let bruto: string;
  try {
    bruto = await req.text();
  } catch {
    return resposta(400, { ok: false, code: "validation_error", fields: {} }, corsOrigin);
  }
  if (bruto.length > MAX_BODY) return resposta(413, { ok: false, code: "validation_error", fields: {} }, corsOrigin);
  let corpo: Record<string, unknown>;
  try {
    const j = JSON.parse(bruto);
    if (!j || typeof j !== "object" || Array.isArray(j)) throw new Error("formato");
    corpo = j as Record<string, unknown>;
  } catch {
    return resposta(400, { ok: false, code: "validation_error", fields: {} }, corsOrigin);
  }

  // Honeypot: responde como sucesso genérico e não registra nada (sem afirmar envio ao webhook)
  if (typeof corpo.honeypot === "string" && corpo.honeypot.trim() !== "") {
    log("honeypot_preenchido", "tamanho=" + corpo.honeypot.length);
    return resposta(200, { ok: true, status: "received", webhook: "pending" }, corsOrigin);
  }

  // Rate limit por IP (hash). Se o controle falhar, não bloqueia a inscrição.
  const limite = Number(env("RATE_LIMIT_MAX")) || 8;
  const janela = Number(env("RATE_LIMIT_WINDOW_SEC")) || 600;
  try {
    const ipHash = await hashIp(ipDe(req), env("RATE_LIMIT_SALT") ?? "inscricao");
    if (!(await db.checkRateLimit(ipHash, limite, janela))) {
      return resposta(429, { ok: false, code: "rate_limited" }, corsOrigin);
    }
  } catch (e) {
    log("rate_limit_falhou", (e as Error)?.message);
  }

  const v = validarCorpo(corpo);
  if (!v.ok) return resposta(400, { ok: false, code: "validation_error", fields: v.fields }, corsOrigin);
  const d = v.dados;
  const timestamp = now().toISOString();

  // 1) Registra o lead ANTES de chamar o webhook
  let id: string;
  try {
    ({ id } = await db.insertLead({
      nome: d.nome, whatsapp: d.whatsapp, email: d.email, evento: d.evento, data_evento: d.dataEvento, origem: d.origem,
      utm_source: d.utm_source, utm_medium: d.utm_medium, utm_campaign: d.utm_campaign, utm_content: d.utm_content, utm_term: d.utm_term,
      timestamp, status_webhook: "pending", tentativas_envio: 0,
    }));
  } catch (e) {
    log("insert_falhou", (e as Error)?.message);
    return resposta(500, { ok: false, code: "internal_error" }, corsOrigin);
  }

  // 2) Encaminha ao webhook. A inscrição já está salva; falha aqui não a derruba.
  const url = env("EVENTO_WEBHOOK_URL");
  let status: "sent" | "failed";
  let erro: string | null;
  if (!url || !/^https?:\/\//i.test(url)) {
    log("EVENTO_WEBHOOK_URL ausente ou inválida; lead", id, "ficou sem envio");
    status = "failed"; erro = "webhook_nao_configurado";
  } else {
    const r = await enviarWebhook(url, montarPayloadWebhook(d, timestamp), fetchFn, Number(env("WEBHOOK_TIMEOUT_MS")) || 8000);
    status = r.ok ? "sent" : "failed"; erro = r.erro;
    if (!r.ok) log("webhook_falhou", id, erro);
  }
  try {
    await db.updateLead(id, { status_webhook: status, tentativas_envio: url ? 1 : 0, erro_webhook: erro });
  } catch (e) {
    log("update_status_falhou", id, (e as Error)?.message);
  }

  return resposta(200, { ok: true, status: "received", webhook: status === "sent" ? "sent" : "pending" }, corsOrigin);
}
