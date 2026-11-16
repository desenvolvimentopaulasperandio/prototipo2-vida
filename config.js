/* ============================================================
   CONFIGURAÇÃO DA LP — SUPER AULÃO VIDA MARKETING AUTÊNTICO
   Tudo que ainda não foi definido fica VAZIO ("") e a LP
   simplesmente não exibe o campo. Preencha e publique.
   ============================================================ */
window.LP_CONFIG = {
  // Link do checkout do Super Aulão (R$47). A oferta da gravação (+R$37) é configurada no checkout.
  checkoutUrl: "https://pay.kiwify.com.br/rIiYAl1",            // ex.: "https://pay.exemplo.com/super-aulao"

  // Tracking (não colocar IDs fictícios)
  metaPixelId: "",            // ex.: "123456789012345"

  // Dados do evento — deixe vazio até serem confirmados
  // TODO(Paula): confirmar que o horário continua 14h, pois 12/12 cai num sábado.
  eventTime: "14h",              // ex.: "20h (horário de Brasília)"
  eventDuration: "",          // ex.: "2 horas"

  // Paula Sperandio — preencher somente com informações oficiais
  paula: {
    role: "Estrategista de Posicionamento · Diretora Criativa · Treinadora",                 // cargo / posicionamento oficial
    bio: "Paula une estratégia, branding e comunicação para ajudar especialistas e marcas a serem percebidos pelo valor que realmente entregam.",                  // bio oficial (texto curto)
    photo: "Perfil.webp",     // foto da Paula (primeira dobra)
    photoBio: "IMG_0306.PNG"  // foto da seção "Quem vai te guiar" (se vazio, usa photo)
  },

  // Primeira dobra (hero). Horário vem de eventTime; link vem de checkoutUrl.
  // EVENTO: único lugar para editar data/nome do evento. O horário vem de eventTime (acima)
  // e a política de privacidade de privacyUrl (abaixo). O webhook NÃO fica aqui: é o secret EVENTO_WEBHOOK_URL no Supabase.
  evento: {
    nome: "super-aulao",           // slug enviado ao backend/webhook (campo "evento")
    dataCurta: "12 DE DEZEMBRO",   // faixa vermelha do topo
    dataExtenso: "12 de dezembro", // chip e textos do modal
    dataISO: "2026-12-12",         // YYYY-MM-DD (campo "dataEvento"). CONFIRMAR O ANO antes de publicar
    dataBarra: "12/12",            // versão curta da data (CTA final e Como funciona)
    preco: "R$47",                 // ingresso (oferta, CTA final e botão)
    precoDe: "R$97",               // preço "de" (riscado ao lado do preço atual)
    // TODO(Paula): definir limite de vagas ou data de término do lote. Sem prazo nem contador até lá.
    lote: "LOTE ESPECIAL (VAGAS LIMITADAS)", // selo junto ao preço (Ingresso e Oferta)
    precoGravacao: "+R$37",        // gravação opcional no checkout
    gratuito: false,               // o ingresso custa R$47: só mude para true se o aulão virar gratuito
    vagasLimitadas: false,         // true => acrescenta "· Vagas limitadas" abaixo do botão
    marcaNome: "",                 // PREENCHER: nome da marca/empresa ("Seus dados ficam só com ...")
    envioAutomaticoLink: false,    // só true quando o envio do link por WhatsApp/e-mail estiver funcionando de verdade
    grupoWhatsappUrl: ""           // opcional: se vazio, o botão do grupo não aparece
  },

  // Supabase (valores PÚBLICOS; nunca colocar a service role key aqui)
  supabase: {
    url: "https://vljzsuwsipccaxqiexit.supabase.co",
    anonKey: "sb_publishable_l3rErgBJEJq-Em8Tx2aCrQ_fsijeVxU", // chave pública (publishable) do projeto LIVES - PS
    mock: false                    // true só para desenvolvimento: simula a função (ignorado fora de localhost)
  },

  // ---------- Textos que dependem de confirmação da Paula (tudo DESLIGADO por padrão) ----------
  // Lista de provas/depoimentos. Vazia = bloco não aparece. Ex.: [{ texto: "…", fonte: "Nome, @perfil" }]
  provaSocial: [],

  // Selo de garantia acima do botão da oferta. Só aparece com ativa: true.
  garantia: { ativa: false, texto: "Se na primeira hora você sentir que não era para você, devolvemos seu investimento." },

  // Segundo parágrafo da bio da Paula. Só aparece com ativa: true.
  paulaFraseOrigem: { ativa: false, texto: "Ela criou o método VIDA justamente porque viu, de perto, quanta gente competente fica invisível por não saber como se comunicar sem se perder." },

  // true => microcopy da oferta vira "Pagamento seguro · Link do Zoom e avisos…"
  microPagamentoSeguro: false,

  // Dúvidas frequentes: só itens com confirmado: true aparecem (sem nenhum, a seção some).
  // Aceita {dataExtenso} {dataBarra} {hora} {preco} {precoDe} {gravacao} nos textos.
  faq: [
    { pergunta: "O aulão será ao vivo?", resposta: "Sim. O Super Aulão acontece ao vivo pelo Zoom, em {dataExtenso}, às {hora} (horário de Brasília).", confirmado: true },
    { pergunta: "PREENCHER (pergunta 2)", resposta: "", confirmado: false },
    { pergunta: "PREENCHER (pergunta 3)", resposta: "", confirmado: false },
    { pergunta: "Quanto custa?", resposta: "O ingresso do lote especial custa {preco} (de {precoDe}). A gravação é opcional e pode ser adicionada no checkout por {gravacao}.", confirmado: true },
    { pergunta: "Preciso ter experiência com produção de conteúdo?", resposta: "Não.", confirmado: true },
    { pergunta: "Onde vou receber o link do aulão?", resposta: "O link do Zoom e os avisos chegam no seu WhatsApp e e-mail, junto com o acesso ao grupo VIP.", confirmado: true }
  ],

  // Rodapé
  privacyUrl: ""              // URL da política de privacidade (opcional)
};
