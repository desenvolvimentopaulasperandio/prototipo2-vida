# Super Aulão VIDA Marketing Autêntico — landing page

Landing page estática (HTML + CSS + JS puro, sem build) com modal de inscrição ligado a uma Supabase Edge Function.

## Estrutura

```
index.html, config.js, favicon.svg, Perfil.webp   -> o site (raiz publicada)
src/components/   modal de inscrição (JS + CSS)
src/lib/          UTMs (sessionStorage), validação, envio para a função
supabase/         migration SQL, Edge Function registrar-inscricao, config.toml
docs/             integração com Supabase e checklist do projeto
tests/            testes automáticos (desenvolvimento; não são necessários para publicar)
```

## O que editar antes de publicar (`config.js`)

`evento.dataISO` (confirmar o ano) · `evento.marcaNome` · `privacyUrl` · `evento.grupoWhatsappUrl` (opcional) · `eventTime` · `checkoutUrl`.
Campos vazios simplesmente não aparecem na página.

## Dados sensíveis

Nada sensível fica no repositório. O `config.js` contém só valores **públicos por natureza**: URL do projeto Supabase,
chave *publishable* (protegida por RLS: o navegador não consegue ler nem gravar nada nas tabelas) e o link público de checkout.
O webhook, a lista de origens e a service role ficam **somente** nos secrets do Supabase. Veja `docs/INTEGRACAO-SUPABASE.md`.

## Rodar local

```
npm run dev      # http://localhost:8080 com função e webhook simulados (nada vai ao Supabase)
npm test         # testes de lógica (Node 22+)
node tests/ui-check.mjs   # testes no Chrome (precisa do Chrome instalado)
```

## Publicar

1. Hospedagem estática apontando para a **raiz** desta pasta (Vercel, Netlify, Cloudflare Pages ou GitHub Pages).
2. No Supabase: adicionar o domínio final ao secret `ALLOWED_ORIGINS`.
3. Conferir o `docs/CHECKLIST.md`.
