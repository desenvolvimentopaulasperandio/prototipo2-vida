# Checklist do projeto — Super Aulão VIDA

Legenda: [x] feito e verificado · [ ] pendente (depende de você ou de decisão externa)

## 1. Design e página
- [x] Tema preto + dourado, inspirado em grupoeli.com.br
- [x] Tipografia premium: Playfair Display, Work Sans, Pinyon Script, Bebas Neue (um acento script por seção)
- [x] Mesma ordem de seções em desktop, tablet e mobile; teste em 1440, 1024, 820, 390 px
- [x] Primeira dobra mobile-first: faixa vermelha fixa, foto, chips, título, subtítulo, CTA e microcopy; CTA visível em 390x844
- [x] Sem scroll horizontal em 360, 390, 430 e 1280 px
- [x] Foto da Paula otimizada (1,4 MB -> 70 KB, sem metadados EXIF)
- [x] Conteúdo configurável por `config.js` (campo vazio = não aparece)

## 2. Modal de inscrição
- [x] Todos os CTAs abrem o modal (hero, ingresso, dor, benefícios, evento, final, barra fixa)
- [x] Campos: nome, WhatsApp (+55 fixo, máscara), e-mail; honeypot invisível
- [x] Acessibilidade: role=dialog, aria-modal, foco automático, focus trap, ESC, clique fora, botão X, foco devolvido ao botão de origem
- [x] Scroll do fundo travado, fundo inerte, animação respeitando prefers-reduced-motion
- [x] Mobile com teclado aberto: card rola por dentro, botão alcançável, X sempre visível, inputs >= 16 px
- [x] Estados: carregando, erro por campo, erro geral, rate limit, sucesso (pago e gratuito), webhook pendente
- [x] Evento pago não promete "vaga garantida": botão "Ir para o pagamento" leva à Kiwify com UTMs

## 3. UTMs e tracking
- [x] 5 UTMs em sessionStorage (nunca localStorage); não sobrescreve; voltar sem parâmetros não apaga; sem UTM = string vazia
- [x] Eventos Pixel/dataLayer: `modal_open`, `Lead`, `InitiateCheckout` (Pixel só carrega com `metaPixelId`)

## 4. Backend (Supabase, projeto LIVES - PS)
- [x] Migration aplicada: tabela `inscricoes_evento`, tabela e função de rate limit, índices de reenvio
- [x] RLS ligada nas tabelas e sem policies; `anon`/`authenticated` sem acesso (verificado)
- [x] Edge Function `registrar-inscricao` publicada (`verify_jwt = false`, acesso público por desenho)
- [x] Validação e normalização no backend; timestamp ISO 8601 UTC gerado no servidor
- [x] Lead gravado ANTES do webhook; falha do webhook não derruba a inscrição; status `pending/sent/failed`
- [x] CORS por lista de origens; honeypot; limite por IP (hash); corpo <= 8 KB; timeout no webhook
- [x] Payload do webhook idêntico à especificação (12 campos, mesma ordem), validado em teste
- [x] Webhook: Google Apps Script gravando em planilha; secret `EVENTO_WEBHOOK_URL` configurado

## 5. Testes
- [x] 29 testes de lógica (validação front/back com os mesmos casos, UTMs, handler com webhook HTTP real)
- [x] 51 verificações no Chrome (desktop + 360/390/430), incluindo teclado aberto, ESC/X/fundo, focus trap, clique triplo, honeypot, webhook 500/queda, falha de banco
- [x] Teste real ponta a ponta: navegador -> função publicada -> banco -> webhook -> planilha
- [x] Todas as referências de arquivos do `index.html` existem

## 6. Segurança e dados sensíveis
- [x] Varredura do repositório: sem service role, secret keys, JWT, URLs de webhook ou senhas
- [x] No repositório só há valores públicos por natureza: URL do projeto Supabase, chave *publishable* (protegida por RLS), link de checkout
- [x] `.gitignore` bloqueia `.env`, chaves e pastas locais; `supabase/.env.example` só tem nomes
- [x] Pasta `.claude/` (ferramentas locais) fora do pacote

## 7. Pendências antes de ir ao ar
- [x] Ano de `evento.dataISO` confirmado (2026-12-11)
- [x] `marcaNome` e `privacyUrl` ficam vazios por decisão (o texto vira "Seus dados estão protegidos." e o link não aparece). Recomendado ter política de privacidade (LGPD) antes de divulgar em larga escala
- [ ] Trocar a foto: o fundo mostra parte de um banner de outro evento ("Fl...", "EM B...", "01.1...")
- [ ] Incluir o domínio da Vercel (https, sem barra final) em `ALLOWED_ORIGINS` (Supabase -> Secrets); acrescentar o domínio próprio quando existir. Previews da Vercel têm outro endereço e serão barrados
- [x] Leads de teste apagados no Supabase e na planilha
- [x] Senha (`TOKEN`) do Apps Script trocada. Confirmar que o secret `EVENTO_WEBHOOK_URL` tem a URL nova
- [ ] Criar imagem 1200x630 (`og:image`) e ativar a tag no `index.html`
- [ ] Confirmar texto "O link de acesso chega no seu e-mail" x "WhatsApp e e-mail" (FAQ) com o que a Kiwify/o envio realmente fazem
- [ ] Meta Pixel ID (`metaPixelId`), se for usar
- [ ] Preencher perguntas 2 e 3 do FAQ ou deixá-las ocultas (estão ocultas)
- [ ] Decidir reenvio automático de leads `failed` (hoje só há a consulta manual em `docs/INTEGRACAO-SUPABASE.md`)
- [ ] Decidir deduplicação de e-mail (hoje a mesma pessoa pode gerar dois leads)
