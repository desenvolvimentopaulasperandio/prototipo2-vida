// Edge Function pública `registrar-inscricao` (sem login do participante; verify_jwt = false em supabase/config.toml).
// Segredos: EVENTO_WEBHOOK_URL (obrigatório p/ encaminhar), ALLOWED_ORIGINS, RATE_LIMIT_*, WEBHOOK_TIMEOUT_MS (opcionais).
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados pelo Supabase e ficam SÓ aqui no backend.
import { createClient } from "npm:@supabase/supabase-js@2";
import { type Db, handle } from "./handler.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const db: Db = {
  async checkRateLimit(ipHash, limite, janelaSeg) {
    const { data, error } = await supabase.rpc("registrar_tentativa_inscricao", {
      p_ip_hash: ipHash,
      p_limite: limite,
      p_janela_seg: janelaSeg,
    });
    if (error) throw new Error(error.message);
    return data === true;
  },
  async insertLead(row) {
    const { data, error } = await supabase.from("inscricoes_evento").insert(row).select("id").single();
    if (error) throw new Error(error.message);
    return { id: data.id as string };
  },
  async updateLead(id, patch) {
    const { error } = await supabase.from("inscricoes_evento").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
  },
};

Deno.serve((req) =>
  handle(req, {
    env: (n) => Deno.env.get(n),
    db,
    fetchFn: fetch,
    now: () => new Date(),
    log: (...a) => console.error("[registrar-inscricao]", ...a),
  })
);
