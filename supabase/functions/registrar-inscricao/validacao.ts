// Validação e normalização no backend (fonte de verdade).
// Espelha src/lib/validation/inscricao.js; tests/validacao.test.mjs roda os mesmos casos nos dois.

const DDDS = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99"
    .split(" "),
);

export const MSG = {
  nome: "Digite seu nome completo",
  whatsapp: "Digite um WhatsApp válido com DDD",
  email: "Digite um e-mail válido",
};

export function normalizarNome(v: unknown): string {
  return String(v ?? "").replace(/\s+/g, " ").trim();
}
export function validarNome(v: unknown): boolean {
  const n = normalizarNome(v);
  if (n.length < 3 || n.length > 120) return false;
  if (n.split(" ").length < 2) return false;
  return /^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u.test(n);
}

function parteNacional(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if ((d.length === 12 || d.length === 13) && d.slice(0, 2) === "55") d = d.slice(2);
  return d;
}
export function normalizarWhatsapp(v: unknown): string {
  return "55" + parteNacional(v);
}
export function validarWhatsapp(v: unknown): boolean {
  const n = parteNacional(v);
  if (n.length !== 10 && n.length !== 11) return false;
  if (!DDDS.has(n.slice(0, 2))) return false;
  if (n.length === 11 && n.charAt(2) !== "9") return false;
  return true;
}

export function normalizarEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}
export function validarEmail(v: unknown): boolean {
  const e = normalizarEmail(v);
  if (e.length > 254 || e.includes("..")) return false;
  return /^[^\s@]+@[^\s@.][^\s@]*\.[^\s@.]{2,}$/.test(e);
}

function limparTexto(v: unknown, max: number): string {
  return String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

export interface Inscricao {
  nome: string;
  whatsapp: string;
  email: string;
  evento: string;
  dataEvento: string; // YYYY-MM-DD
  origem: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
}

export type ResultadoValidacao =
  | { ok: true; dados: Inscricao }
  | { ok: false; fields: Record<string, string> };

function dataValida(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function origemValida(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validarCorpo(raw: unknown): ResultadoValidacao {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const fields: Record<string, string> = {};

  if (!validarNome(b.nome)) fields.nome = MSG.nome;
  if (!validarWhatsapp(b.whatsapp)) fields.whatsapp = MSG.whatsapp;
  if (!validarEmail(b.email)) fields.email = MSG.email;

  const evento = limparTexto(b.evento, 60);
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(evento)) fields.evento = "Evento inválido";

  const dataEvento = limparTexto(b.dataEvento, 10);
  if (!dataValida(dataEvento)) fields.dataEvento = "Data do evento inválida";

  const origem = limparTexto(b.origem, 500);
  if (!origemValida(origem)) fields.origem = "Origem inválida";

  if (Object.keys(fields).length) return { ok: false, fields };

  return {
    ok: true,
    dados: {
      nome: normalizarNome(b.nome),
      whatsapp: normalizarWhatsapp(b.whatsapp),
      email: normalizarEmail(b.email),
      evento,
      dataEvento,
      origem,
      utm_source: limparTexto(b.utm_source, 200),
      utm_medium: limparTexto(b.utm_medium, 200),
      utm_campaign: limparTexto(b.utm_campaign, 200),
      utm_content: limparTexto(b.utm_content, 200),
      utm_term: limparTexto(b.utm_term, 200),
    },
  };
}
