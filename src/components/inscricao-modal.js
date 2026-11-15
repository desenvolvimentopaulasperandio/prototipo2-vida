/* <InscricaoModal /> em JS puro (a página é HTML estático, sem build).
   Peças equivalentes aos componentes pedidos:
     campoTexto()  -> CampoTexto      campoTelefone() -> CampoTelefone
     botaoDourado() -> BotaoDourado   criarFormulario() -> useInscricaoForm()
   API: VIDA.modal.open(origemEl) / VIDA.modal.close().  Estado global simples: VIDA.modal.isOpen().
   Textos e dados vêm de window.LP_CONFIG (evento, eventTime, privacyUrl, checkoutUrl). */
(function () {
  var V = window.VIDA = window.VIDA || {};
  var C = window.LP_CONFIG || {};
  var EV = C.evento || {};
  var VAL = V.validacao;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Pixel/GTM: usa VIDA.track (definido na página). Sem ele, não faz nada. */
  function trackEvent(nome, dados) { if (typeof V.track === 'function') V.track(nome, dados); }

  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (v === true) e.setAttribute(k, '');
      else if (v !== false && v != null) e.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function svg(path, extra) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', extra || '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path); s.appendChild(p);
    return s;
  }

  /* ---------- Textos (config) ---------- */
  var horario = C.eventTime || EV.horario || '';
  var quando = (EV.dataExtenso || '') + (horario ? ' às ' + horario : '');
  var cobrado = !EV.gratuito && !!C.checkoutUrl; /* evento pago: não prometer "vaga garantida" antes do pagamento */

  /* ---------- CampoTexto ---------- */
  function campoTexto(o) {
    var id = 'im-' + o.name;
    var input = h('input', {
      class: 'im-input', id: id, name: o.name, type: o.type || 'text', placeholder: o.placeholder, autocomplete: o.autocomplete,
      inputmode: o.inputmode, 'aria-describedby': id + '-err', required: true, maxlength: o.maxlength
    });
    var err = h('p', { class: 'im-err', id: id + '-err', role: 'alert' });
    var label = h('label', { class: 'im-label', for: id, text: o.label });
    var control = o.prefix ? h('div', { class: 'im-tel' }, [h('div', { class: 'im-prefix', 'aria-hidden': 'true', text: o.prefix }), input]) : input;
    var wrap = h('div', { class: 'im-field' }, [label, control, err]);
    return {
      wrap: wrap, input: input,
      setError: function (msg) {
        wrap.classList.toggle('has-err', !!msg); err.textContent = msg || '';
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      }
    };
  }
  /* ---------- CampoTelefone (+55 fixo, máscara à mão) ---------- */
  function campoTelefone() {
    var c = campoTexto({ name: 'whatsapp', label: 'WhatsApp com DDD', type: 'tel', inputmode: 'numeric', autocomplete: 'tel-national', placeholder: '(11) 99999-9999', prefix: '+55', maxlength: 16 });
    c.input.addEventListener('input', function () { c.input.value = VAL.mascaraTelefone(c.input.value); });
    return c;
  }
  /* ---------- BotaoDourado ---------- */
  function botaoDourado(texto) {
    var label = h('span', { class: 'im-label-txt', text: texto });
    var arrow = h('span', { class: 'im-arrow' }, [svg('M5 12h14M13 6l6 6-6 6'), h('span', { class: 'im-spin' })]);
    var b = h('button', { class: 'im-submit', type: 'submit' }, [label, arrow]);
    return {
      el: b,
      loading: function (on) { b.disabled = !!on; b.classList.toggle('is-loading', !!on); label.textContent = on ? 'Enviando...' : texto; b.setAttribute('aria-busy', on ? 'true' : 'false'); }
    };
  }

  /* ---------- Construção do DOM ---------- */
  var root, card, closeBtn, chip, titleEl, subEl, formWrap, form, nome, tel, email, hp, formErr, submit, micro, okBox, okTitle, okText, okBtns, origem = null, open = false, closeTimer = null;

  function build() {
    root = h('div', { class: 'im-root', id: 'inscricao', 'aria-hidden': 'true' });
    card = h('div', { class: 'im-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'im-title', tabindex: '-1' });

    closeBtn = h('button', { class: 'im-x', type: 'button', 'aria-label': 'Fechar' }, [svg('M6 6l12 12M18 6L6 18')]);
    var xwrap = h('div', { class: 'im-xwrap' }, [closeBtn]);

    chip = h('div', { class: 'im-chip', text: 'Super Aulão ao vivo' + (quando ? ' · ' + quando : '') });
    titleEl = h('h2', { class: 'im-title', id: 'im-title' }, ['Garanta seu lugar', h('em', { text: 'no aulão.' })]);
    subEl = h('p', { class: 'im-sub', text: EV.envioAutomaticoLink ? 'O link de acesso chega no seu WhatsApp e no seu e-mail antes de a gente começar.' : 'Preencha os dados abaixo para garantir sua vaga no super aulão.' });

    nome = campoTexto({ name: 'nome', label: 'Nome', type: 'text', autocomplete: 'name', placeholder: 'Seu nome completo', maxlength: 120 });
    tel = campoTelefone();
    email = campoTexto({ name: 'email', label: 'E-mail', type: 'email', inputmode: 'email', autocomplete: 'email', placeholder: 'voce@email.com', maxlength: 254 });
    /* Honeypot: readonly impede o preenchimento automático do navegador (que gerava falso positivo); robôs que setam .value continuam sendo pegos. */
    hp = h('input', { class: 'im-hp', type: 'text', name: 'ref_codigo_x', tabindex: '-1', autocomplete: 'off', readonly: true, 'aria-hidden': 'true', 'data-lpignore': 'true', 'data-1p-ignore': 'true' });
    formErr = h('div', { class: 'im-formerr', role: 'alert' });
    submit = botaoDourado('Fazer minha inscrição');

    micro = h('p', { class: 'im-micro' });
    var marca = EV.marcaNome ? 'Seus dados ficam só com ' + EV.marcaNome + '.' : 'Seus dados estão protegidos.';
    micro.appendChild(document.createTextNode(marca + ' '));
    if (C.privacyUrl) micro.appendChild(h('a', { href: C.privacyUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Política de privacidade' }));

    form = h('form', { class: 'im-form', novalidate: true, autocomplete: 'on' }, [nome.wrap, tel.wrap, email.wrap, hp, formErr, submit.el, micro]);
    formWrap = h('div', { class: 'im-form-wrap' }, [chip, titleEl, subEl, form]);

    okTitle = h('h2', { class: 'im-title', id: 'im-ok-title', tabindex: '-1', text: 'Inscrição confirmada!' });
    okText = h('p', { class: 'im-sub' });
    okBtns = h('div', { class: 'im-btns' });
    okBox = h('div', { class: 'im-ok', 'aria-live': 'polite' }, [
      h('div', { class: 'im-check' }, [svg('M5 12.5l4.5 4.5L19 7.5', '2.6')]), okTitle, okText, okBtns
    ]);

    card.appendChild(xwrap); card.appendChild(formWrap); card.appendChild(okBox);
    root.appendChild(card);
    document.body.appendChild(root);

    closeBtn.addEventListener('click', close);
    var downOnBackdrop = false;
    root.addEventListener('mousedown', function (e) { downOnBackdrop = e.target === root; });
    root.addEventListener('click', function (e) { if (e.target === root && downOnBackdrop) close(); downOnBackdrop = false; });
    form.addEventListener('submit', onSubmit);
    [nome, tel, email].forEach(function (c) {
      c.input.addEventListener('blur', function () { if (tentou) validarUm(c); });
      c.input.addEventListener('input', function () { if (tentou && c.wrap.classList.contains('has-err')) validarUm(c); });
      c.input.addEventListener('focus', function () {
        setTimeout(function () { try { c.wrap.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); } catch (e) {} }, 300);
      });
    });
    document.addEventListener('keydown', onKey);
    if (window.visualViewport) { visualViewport.addEventListener('resize', ajustarViewport); visualViewport.addEventListener('scroll', ajustarViewport); }
  }

  /* ---------- useInscricaoForm ---------- */
  var tentou = false, enviando = false;
  function campoPorNome(n) { return { nome: nome, whatsapp: tel, email: email }[n]; }
  function validarUm(c) {
    var n = c.input.name;
    c.setError(VAL.validarCampo(n, c.input.value));
  }
  function aplicarErros(errs) {
    var primeiro = null;
    ['nome', 'whatsapp', 'email'].forEach(function (n) {
      var c = campoPorNome(n), m = errs[n] || '';
      c.setError(m);
      if (m && !primeiro) primeiro = c;
    });
    if (primeiro) primeiro.input.focus();
  }
  function mostrarErroForm(msg) { formErr.textContent = msg || ''; formErr.classList.toggle('on', !!msg); }

  function onSubmit(e) {
    e.preventDefault();
    if (enviando) return;
    tentou = true; mostrarErroForm('');
    var r = VAL.validarInscricao({ nome: nome.input.value, whatsapp: tel.input.value, email: email.input.value });
    if (!r.ok) { aplicarErros(r.errors); return; }
    ['nome', 'whatsapp', 'email'].forEach(function (n) { campoPorNome(n).setError(''); });
    enviando = true; submit.loading(true);
    var dados = { nome: r.values.nome, whatsapp: r.values.whatsapp, email: r.values.email, honeypot: hp.value };
    V.inscricao.submitInscricao(dados).then(function (res) {
      enviando = false; submit.loading(false);
      if (res.ok) return sucesso(res.webhook);
      if (res.code === 'validation_error') {
        var f = res.fields || {};
        if (f.nome || f.whatsapp || f.email) return aplicarErros({ nome: f.nome, whatsapp: f.whatsapp, email: f.email });
        return mostrarErroForm('Não foi possível concluir sua inscrição agora. Tente novamente.');
      }
      if (res.code === 'rate_limited') return mostrarErroForm('Muitas tentativas. Aguarde um instante e tente novamente.');
      mostrarErroForm('Não foi possível concluir sua inscrição agora. Tente novamente.');
    });
  }

  function sucesso(webhook) {
    trackEvent('Lead', { content_name: 'Super Aulão VIDA', webhook: webhook });
    form.reset(); ['nome', 'whatsapp', 'email'].forEach(function (n) { campoPorNome(n).setError(''); }); tentou = false; mostrarErroForm('');
    okBtns.textContent = '';
    if (cobrado) {
      okTitle.textContent = 'Inscrição recebida!';
      okText.textContent = 'Recebemos seus dados. Finalize o pagamento para garantir sua vaga no super aulão' + (quando ? ': ' + quando + '.' : '.');
      var pg = h('a', { class: 'im-btn pri', href: V.checkoutHref ? V.checkoutHref() : C.checkoutUrl, text: 'Ir para o pagamento' });
      pg.addEventListener('click', function () { trackEvent('InitiateCheckout', { content_name: 'Super Aulão VIDA', value: 47, currency: 'BRL', cta_position: 'modal' }); });
      okBtns.appendChild(pg);
    } else {
      okTitle.textContent = 'Inscrição confirmada!';
      var salve = 'Salve a data: ' + quando + '.';
      if (webhook === 'sent') okText.textContent = (EV.envioAutomaticoLink ? 'Enviamos o link de acesso para o seu WhatsApp e e-mail. ' : 'Sua vaga está garantida. ') + salve;
      else okText.textContent = 'Recebemos sua inscrição! ' + salve;
      if (EV.grupoWhatsappUrl) okBtns.appendChild(h('a', { class: 'im-btn pri', href: EV.grupoWhatsappUrl, target: '_blank', rel: 'noopener noreferrer', text: 'Entrar no grupo do WhatsApp' }));
    }
    var fechar = h('button', { class: 'im-btn sec', type: 'button', text: 'Fechar' }); fechar.addEventListener('click', close);
    okBtns.appendChild(fechar);
    formWrap.classList.add('off'); okBox.classList.add('on');
    card.scrollTop = 0;
    okTitle.focus({ preventScroll: true });
  }
  function mostrarFormulario() { okBox.classList.remove('on'); formWrap.classList.remove('off'); }

  /* ---------- abrir / fechar ---------- */
  function focaveis() {
    return Array.prototype.filter.call(card.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),[tabindex]:not([tabindex="-1"])'), function (e) { return e.offsetParent !== null || e === document.activeElement; });
  }
  function onKey(e) {
    if (!open) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = focaveis(); if (!f.length) return;
    var a = f[0], z = f[f.length - 1], at = document.activeElement;
    if (e.shiftKey && (at === a || at === card)) { e.preventDefault(); z.focus(); }
    else if (!e.shiftKey && at === z) { e.preventDefault(); a.focus(); }
    else if (!card.contains(at)) { e.preventDefault(); a.focus(); }
  }
  function ajustarViewport() {
    if (!open || !window.visualViewport) return;
    var vv = visualViewport;
    root.style.top = vv.offsetTop + 'px'; root.style.height = vv.height + 'px';
  }
  var inertados = [];
  function travarFundo(on) {
    var de = document.documentElement;
    if (on) {
      var sbw = window.innerWidth - de.clientWidth;
      de.style.setProperty('--im-sbw', sbw + 'px'); de.classList.add('im-lock');
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === root || el.tagName === 'SCRIPT') return;
        if (!el.hasAttribute('inert')) { el.setAttribute('inert', ''); inertados.push(el); }
      });
    } else {
      de.classList.remove('im-lock'); de.style.removeProperty('--im-sbw');
      inertados.forEach(function (el) { el.removeAttribute('inert'); }); inertados = [];
    }
  }

  function openModal(from) {
    if (!root) build();
    if (open) return;
    clearTimeout(closeTimer);
    origem = from || document.activeElement;
    if (okBox.classList.contains('on')) mostrarFormulario();
    open = true;
    root.removeAttribute('aria-hidden');
    travarFundo(true);
    root.style.top = ''; root.style.height = '';
    ajustarViewport();
    requestAnimationFrame(function () { root.classList.add('is-open'); });
    setTimeout(function () { try { nome.input.focus({ preventScroll: true }); } catch (e) { nome.input.focus(); } }, reduce ? 0 : 60);
    trackEvent('modal_open', { cta_position: from && from.dataset ? from.dataset.pos : '' });
  }
  function close() {
    if (!open) return;
    open = false;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    closeTimer = setTimeout(function () { root.style.top = ''; root.style.height = ''; }, 260);
    travarFundo(false);
    var o = origem; origem = null;
    if (o && o.focus && document.contains(o)) { try { o.focus({ preventScroll: true }); } catch (e) { o.focus(); } }
  }

  V.modal = { open: openModal, close: close, isOpen: function () { return open; } };

  /* Todos os CTAs abrem o modal. href passa para #inscricao (o checkout só aparece depois do cadastro). */
  Array.prototype.forEach.call(document.querySelectorAll('.js-cta'), function (a) {
    a.setAttribute('href', '#inscricao');
    a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', function (e) { e.preventDefault(); openModal(a); });
  });
})();
