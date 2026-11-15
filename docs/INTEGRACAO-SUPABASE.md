# Integração da inscrição (modal) com Supabase

Fluxo: CTA abre o modal → UTMs (sessionStorage) → validação no navegador → POST na Edge Function `registrar-inscricao`
→ validação/normalização no backend → grava em `inscricoes_evento` (status `pending`) → POST JSON no webhook (`EVENTO_WEBHOOK_URL`)
→ atualiza `status_webhook` (`sent`/`failed`) → o modal mostra sucesso. A inscrição vale quando o **banco** confirma; falha no webhook não a derruba.

Projeto Supabase: **LIVES - PS** (`vljzsuwsipccaxqiexit`).

## Onde editar

| O quê | Onde |
|---|---|
| Nome/data do evento, marca, grupo do WhatsApp, envio automático | `config.js` → `evento` (`nome`, `dataISO`, `dataExtenso`, `marcaNome`, `envioAutomaticoLink`, `grupoWhatsappUrl`) |
| Horário | `config.js` → `eventTime` |
| Política de privacidade | `config.js` → `privacyUrl` |
| URL e chave **públicas** do Supabase | `config.js` → `supabase.url`, `supabase.anonKey` (equivalem a `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) |
| Link do checkout (aparece depois do cadastro quando `gratuito: false`) | `config.js` → `checkoutUrl` |
| **Webhook** | só no Supabase, secret `EVENTO_WEBHOOK_URL` (nunca no frontend) |

Mudar a data do evento = alterar `dataISO` e `dataExtenso` (e `dataCurta`).

## Secrets da função (Supabase → Edge Functions → Secrets)

| Nome | Obrigatório | Descrição |
|---|---|---|
| `EVENTO_WEBHOOK_URL` | sim | URL que recebe o POST JSON. Sem ela o lead é salvo com `status_webhook = failed` e `erro_webhook = webhook_nao_configurado` |
| `ALLOWED_ORIGINS` | sim em produção | Lista separada por vírgula, ex.: `https://seudominio.com.br,https://www.seudominio.com.br`. Sem ela só funcionam `localhost:8080/5500/3000/5173` |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_SEC` | não | Padrão 8 envios por IP a cada 600 s |
| `WEBHOOK_TIMEOUT_MS` | não | Padrão 8000 |
| `RATE_LIMIT_SALT` | não | Sal do hash do IP |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados pelo Supabase e ficam só no backend.

## Rodar local

```
npm run dev        # http://localhost:8080 — landing + função emulada (mesmo handler.ts) + webhook falso; nada vai para o Supabase
npm test           # 29 testes: validação (front e back), UTMs, handler com webhook HTTP real
node tests/ui-check.mjs [pasta_screenshots]   # 51 verificações no Chrome (desktop + 360/390/430 px)
```

Para testar a função **publicada** a partir do navegador local, use `python -m http.server 8080` (ou outro servidor na porta 8080/5500)
e abra `http://localhost:8080`. Abrir o arquivo direto (`file://`) não funciona: a origem é `null` e o CORS bloqueia.
Com `supabase.mock: true` o modal simula a função sem rede (só em localhost; `?mock=sent|pending|validation|rate|error|network`).

## Deploy

1. Migration: `supabase/migrations/20261115000000_create_inscricoes_evento.sql` (já aplicada no LIVES - PS).
2. Função: `supabase functions deploy registrar-inscricao --project-ref vljzsuwsipccaxqiexit` (o `verify_jwt = false` está em `supabase/config.toml`; já publicada).
3. Secrets: `supabase secrets set EVENTO_WEBHOOK_URL=... ALLOWED_ORIGINS=https://seudominio.com.br --project-ref vljzsuwsipccaxqiexit`.
4. Publicar a landing no domínio final e conferir o `ALLOWED_ORIGINS`.

## Reenvio de leads pendentes/falhos

```sql
select id, nome, email, status_webhook, tentativas_envio, erro_webhook
from public.inscricoes_evento
where status_webhook <> 'sent'
order by created_at;
```
Há índice parcial para essa consulta. O reenvio automático não foi implementado (só a estrutura: status, tentativas, erro).

## Segurança (resumo)

- RLS ligada nas duas tabelas e **sem policies**: `anon`/`authenticated` não leem nem escrevem; só a função (service role).
- Função pública (sem JWT) protegida por: lista de origens, honeypot, validação no backend, limite por IP (hash), corpo ≤ 8 KB, timeout no webhook.
- CORS não é autenticação: bots fora do navegador ignoram CORS; o limite por IP é a defesa real.
- Erros ao cliente são genéricos; detalhes ficam só nos logs da função.

## Contrato de resposta

`{ok:true,status:"received",webhook:"sent"|"pending"}` · `{ok:false,code:"validation_error",fields}` (400) · `{ok:false,code:"rate_limited"}` (429) · `{ok:false,code:"internal_error"}` (500) · origem não permitida: 403 `forbidden_origin`.
