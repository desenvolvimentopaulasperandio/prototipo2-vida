/* Captura e persistência das UTMs em sessionStorage (nunca localStorage).
   Regras: só grava se houver UTM na URL e ainda não houver UTMs salvas na sessão;
   voltar sem parâmetros NÃO apaga o que já foi salvo; sem UTMs => strings vazias. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.VIDA = root.VIDA || {}; root.VIDA.utm = api; }
})(typeof self !== 'undefined' ? self : this, function () {
  var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  var STORE = 'vida_utms';

  function store(s) {
    if (s) return s;
    try { return window.sessionStorage; } catch (e) { return null; }
  }
  function ler(st) {
    try { var j = JSON.parse(st.getItem(STORE) || 'null'); return j && typeof j === 'object' ? j : null; } catch (e) { return null; }
  }
  function limpar(v) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 200);
  }

  /* search: "?utm_source=..."; s: storage (injetável nos testes) */
  function capture(search, s) {
    var st = store(s); if (!st) return get(s);
    var qs = new URLSearchParams(search == null ? (typeof location !== 'undefined' ? location.search : '') : search);
    var novas = {}, tem = false;
    KEYS.forEach(function (k) { var v = limpar(qs.get(k)); novas[k] = v; if (v) tem = true; });
    if (tem && !ler(st)) { try { st.setItem(STORE, JSON.stringify(novas)); } catch (e) {} }
    return get(s);
  }

  function get(s) {
    var st = store(s), salvo = st ? ler(st) : null, out = {};
    KEYS.forEach(function (k) { out[k] = salvo && salvo[k] ? String(salvo[k]) : ''; });
    return out;
  }

  return { KEYS: KEYS, capture: capture, get: get };
});
