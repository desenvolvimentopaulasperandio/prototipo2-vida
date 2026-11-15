/* Validação e normalização da inscrição (frontend).
   O backend (supabase/functions/registrar-inscricao/validacao.ts) replica estas regras e é a fonte de verdade.
   Funciona no navegador (window.VIDA.validacao) e no Node (testes). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.VIDA = root.VIDA || {}; root.VIDA.validacao = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  var DDDS = {};
  '11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'
    .split(' ').forEach(function (d) { DDDS[d] = true; });

  var MSG = {
    nome: 'Digite seu nome completo',
    whatsapp: 'Digite um WhatsApp válido com DDD',
    email: 'Digite um e-mail válido'
  };

  function normalizarNome(v) {
    return String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
  }
  function validarNome(v) {
    var n = normalizarNome(v);
    if (n.length < 3 || n.length > 120) return false;
    if (n.split(' ').length < 2) return false;
    return /^[\p{L}\p{M}][\p{L}\p{M}'’.\- ]*$/u.test(n);
  }

  /* Parte nacional (DDD + número) a partir do que a pessoa digitou. */
  function parteNacional(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '').replace(/^0+/, '');
    if ((d.length === 12 || d.length === 13) && d.slice(0, 2) === '55') d = d.slice(2);
    return d;
  }
  /* Só dígitos, com 55 na frente (sem duplicar). */
  function normalizarWhatsapp(v) {
    return '55' + parteNacional(v);
  }
  function validarWhatsapp(v) {
    var n = parteNacional(v);
    if (n.length !== 10 && n.length !== 11) return false;
    if (!DDDS[n.slice(0, 2)]) return false;
    if (n.length === 11 && n.charAt(2) !== '9') return false;
    return true;
  }

  function normalizarEmail(v) {
    return String(v == null ? '' : v).trim().toLowerCase();
  }
  function validarEmail(v) {
    var e = normalizarEmail(v);
    if (e.length > 254 || e.indexOf('..') !== -1) return false;
    return /^[^\s@]+@[^\s@.][^\s@]*\.[^\s@.]{2,}$/.test(e);
  }

  /* Máscara (DD) 9XXXX-XXXX para o campo de telefone (o +55 é fixo na tela). */
  function mascaraTelefone(v) {
    var d = String(v == null ? '' : v).replace(/\D/g, '');
    if (d.length > 11 && d.slice(0, 2) === '55') d = d.slice(2);
    d = d.slice(0, 11);
    if (!d.length) return '';
    if (d.length <= 2) return '(' + d;
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }

  function validarCampo(campo, valor) {
    if (campo === 'nome') return validarNome(valor) ? '' : MSG.nome;
    if (campo === 'whatsapp') return validarWhatsapp(valor) ? '' : MSG.whatsapp;
    if (campo === 'email') return validarEmail(valor) ? '' : MSG.email;
    return '';
  }

  /* valores brutos -> { ok, values (normalizados), errors } */
  function validarInscricao(raw) {
    raw = raw || {};
    var errors = {};
    ['nome', 'whatsapp', 'email'].forEach(function (c) {
      var m = validarCampo(c, raw[c]);
      if (m) errors[c] = m;
    });
    return {
      ok: Object.keys(errors).length === 0,
      errors: errors,
      values: {
        nome: normalizarNome(raw.nome),
        whatsapp: normalizarWhatsapp(raw.whatsapp),
        email: normalizarEmail(raw.email)
      }
    };
  }

  return {
    MSG: MSG,
    normalizarNome: normalizarNome, validarNome: validarNome,
    normalizarWhatsapp: normalizarWhatsapp, validarWhatsapp: validarWhatsapp,
    normalizarEmail: normalizarEmail, validarEmail: validarEmail,
    mascaraTelefone: mascaraTelefone, validarCampo: validarCampo, validarInscricao: validarInscricao
  };
});
