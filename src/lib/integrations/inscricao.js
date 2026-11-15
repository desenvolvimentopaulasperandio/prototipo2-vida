/* Envio da inscrição para a Supabase Edge Function `registrar-inscricao`.
   Contrato de resposta (a função devolve sempre JSON):
     { ok:true,  status:"received", webhook:"sent"|"pending" }
     { ok:false, code:"validation_error", fields:{...} }   (HTTP 400)
     { ok:false, code:"rate_limited" }                    (HTTP 429)
     { ok:false, code:"internal_error" }                  (HTTP 500)
   Este módulo devolve: { ok:true, webhook } | { ok:false, code, fields? }
   (code extra do cliente: "network_error" para falha de rede/timeout/resposta inválida, "config_error"). */
(function (root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.VIDA = root.VIDA || {}; root.VIDA.inscricao = api; }
})(typeof self !== 'undefined' ? self : this, function (root) {
  var TIMEOUT_MS = 15000;

  function cfg() { return (root.LP_CONFIG || {}); }

  /* Mock só funciona em localhost, mesmo que a flag seja esquecida ligada na publicação. */
  function mockAtivo(S) {
    var h = root.location && root.location.hostname;
    var local = h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
    return !!(S.mock && local);
  }
  function mockResposta() {
    var m = new URLSearchParams(root.location.search).get('mock') || 'sent';
    var tabela = {
      sent: { ok: true, webhook: 'sent' },
      pending: { ok: true, webhook: 'pending' },
      validation: { ok: false, code: 'validation_error', fields: { email: 'Digite um e-mail válido' } },
      rate: { ok: false, code: 'rate_limited' },
      error: { ok: false, code: 'internal_error' },
      network: { ok: false, code: 'network_error' }
    };
    return new Promise(function (res) { setTimeout(function () { res(tabela[m] || tabela.sent); }, 700); });
  }

  function montarCorpo(v) {
    var E = cfg().evento || {};
    var utm = (root.VIDA && root.VIDA.utm) ? root.VIDA.utm.get() : {};
    return {
      nome: v.nome, whatsapp: v.whatsapp, email: v.email,
      evento: E.nome || 'super-aulao',
      dataEvento: E.dataISO || '',
      origem: root.location.href,
      utm_source: utm.utm_source || '', utm_medium: utm.utm_medium || '', utm_campaign: utm.utm_campaign || '',
      utm_content: utm.utm_content || '', utm_term: utm.utm_term || '',
      honeypot: v.honeypot || ''
    };
  }

  function submitInscricao(v, opts) {
    var S = cfg().supabase || {};
    if (mockAtivo(S)) return mockResposta();
    var base = String(S.url || '').replace(/\/+$/, '');
    var corpo = montarCorpo(v);
    if (!base || !corpo.dataEvento) {
      if (root.console) console.error('[inscricao] configure supabase.url e evento.dataISO em config.js');
      return Promise.resolve({ ok: false, code: 'config_error' });
    }
    var headers = { 'Content-Type': 'application/json' };
    if (S.anonKey) {
      headers.apikey = S.anonKey;
      if (/^eyJ/.test(S.anonKey)) headers.Authorization = 'Bearer ' + S.anonKey; /* chave legada (JWT) */
    }
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, (opts && opts.timeoutMs) || TIMEOUT_MS);
    return fetch(base + '/functions/v1/registrar-inscricao', {
      method: 'POST', headers: headers, body: JSON.stringify(corpo), signal: ctrl.signal
    }).then(function (r) {
      return r.json().then(function (j) { return { status: r.status, json: j }; });
    }).then(function (x) {
      var j = x.json;
      if (j && j.ok === true) return { ok: true, webhook: j.webhook === 'sent' ? 'sent' : 'pending' };
      if (j && j.ok === false && j.code) return { ok: false, code: String(j.code), fields: j.fields || {} };
      return { ok: false, code: 'network_error' };
    }).catch(function () {
      return { ok: false, code: 'network_error' };
    }).then(function (r) { clearTimeout(t); return r; });
  }

  return { submitInscricao: submitInscricao, montarCorpo: montarCorpo };
});
