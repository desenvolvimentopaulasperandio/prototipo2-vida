// Teste de interface no Chrome real (CDP), com emulação de aparelho. Requer Chrome instalado.
// Uso: node tests/ui-check.mjs [pasta_para_screenshots]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { startDevServer } from './dev-server.mjs';

const SHOTS = process.argv[2] ? path.resolve(process.argv[2]) : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const srv = await startDevServer({ port: 0 });
const BASE = `http://127.0.0.1:${srv.port}`;
const set = (o) => fetch(BASE + '/__set', { method: 'POST', body: JSON.stringify(o) });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-check-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', `--user-data-dir=${profile}`, '--remote-debugging-port=9333', 'about:blank'], { stdio: 'ignore' });
for (let i = 0; i < 50; i++) { try { await fetch('http://127.0.0.1:9333/json/version'); break; } catch { await sleep(200); } }

class Page {
  static async open(url, { w, h, mobile = false }) {
    const t = await (await fetch('http://127.0.0.1:9333/json/new?about:blank', { method: 'PUT' })).json();
    const p = new Page(t); await p.ready;
    await p.send('Page.enable'); await p.send('Runtime.enable');
    await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mobile ? 2 : 1, mobile });
    if (mobile) await p.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    await p.send('Page.navigate', { url });
    for (let i = 0; i < 60; i++) { await sleep(150); try { if (await p.ev(`typeof VIDA!=='undefined'&&!!VIDA.modal&&document.readyState==='complete'`)) break; } catch {} }
    await sleep(300);
    return p;
  }
  constructor(t) {
    this.id = t.id; this.n = 0; this.pending = new Map(); this.ws = new WebSocket(t.webSocketDebuggerUrl);
    this.ready = new Promise((r) => (this.ws.onopen = r));
    this.ws.onmessage = (m) => { const d = JSON.parse(m.data); const p = this.pending.get(d.id); if (p) { this.pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } };
  }
  send(method, params = {}) { const id = ++this.n; this.ws.send(JSON.stringify({ id, method, params })); return new Promise((res, rej) => this.pending.set(id, { res, rej })); }
  async ev(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'erro'); return r.result.value; }
  async rect(sel) { return this.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,cx:r.x+r.width/2,cy:r.y+r.height/2}})()`); }
  async click(sel) { await this.ev(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({block:'center',behavior:'instant'})`); await sleep(150); const r = await this.rect(sel); await this.clickAt(r.cx, r.cy); }
  async clickAt(x, y) { for (const type of ['mousePressed', 'mouseReleased']) await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); }
  async type(sel, text) { await this.ev(`document.querySelector(${JSON.stringify(sel)}).focus()`); await this.send('Input.insertText', { text }); }
  async key(key, extra = {}) { const o = { key, code: key === 'Escape' ? 'Escape' : key, windowsVirtualKeyCode: key === 'Escape' ? 27 : key === 'Tab' ? 9 : 0, ...extra }; await this.send('Input.dispatchKeyEvent', { type: 'keyDown', ...o }); await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...o }); }
  async shot(name) { if (!SHOTS) return; const r = await this.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64')); }
  async close() { try { this.ws.close(); await fetch(`http://127.0.0.1:9333/json/close/${this.id}`); } catch {} }
}

const results = []; let falhas = 0;
async function check(nome, fn) {
  try { await fn(); results.push('✔ ' + nome); } catch (e) { falhas++; results.push('✖ ' + nome + '\n    ' + String(e.message).split('\n').join('\n    ')); }
}
const aberto = (p) => p.ev(`document.querySelector('.im-root').classList.contains('is-open')`);
async function preencher(p, nome = 'Maria da Silva', tel = '27999999999', email = 'Maria@Exemplo.com') {
  await p.type('#im-nome', nome); await p.type('#im-whatsapp', tel); await p.type('#im-email', email);
}
const HERO = '.hero .js-cta';

const DEVICES = [['desktop 1280', 1280, 800, false], ['mobile 360', 360, 740, true], ['mobile 390', 390, 844, true], ['mobile 430', 430, 932, true]];

for (const [nomeDev, w, h, mobile] of DEVICES) {
  await set({ reset: true, webhook: '200', gratuito: false, envio: false, dbfail: false, mock: false, grupo: '' });
  const p = await Page.open(BASE + '/?utm_source=ig&utm_medium=bio&utm_campaign=aulao', { w, h, mobile });
  const tag = `[${nomeDev}] `;

  await check(tag + 'sem scroll horizontal (página e modal aberto)', async () => {
    assert.equal(await p.ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), true);
    await p.click(HERO); await sleep(450);
    assert.equal(await p.ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), true);
    const c = await p.rect('.im-card');
    assert.ok(c.x >= 15 && c.x + c.w <= w - 15, `card fora da tela: ${JSON.stringify(c)}`);
    if (mobile) assert.ok(Math.abs(c.w - (w - 32)) < 2, 'largura do card no mobile = 100% - 32px, veio ' + c.w);
    else assert.ok(c.w <= 500.5, 'card <= 500px, veio ' + c.w);
  });
  await check(tag + 'modal: aria, foco no nome, scroll travado, fundo inerte, z-index acima da faixa', async () => {
    assert.equal(await aberto(p), true);
    const info = await p.ev(`(()=>{const c=document.querySelector('.im-card');return {role:c.getAttribute('role'),modal:c.getAttribute('aria-modal'),lb:c.getAttribute('aria-labelledby'),title:document.getElementById('im-title').textContent,focus:document.activeElement.id,lock:document.documentElement.classList.contains('im-lock'),inert:document.getElementById('topbar').hasAttribute('inert'),zr:getComputedStyle(document.querySelector('.im-root')).zIndex,zt:getComputedStyle(document.getElementById('topbar')).zIndex}})()`);
    assert.equal(info.role, 'dialog'); assert.equal(info.modal, 'true'); assert.equal(info.lb, 'im-title');
    assert.equal(info.title, 'Garanta seu lugarno aulão.'); assert.equal(info.focus, 'im-nome'); assert.equal(info.lock, true); assert.equal(info.inert, true);
    assert.ok(Number(info.zr) > Number(info.zt));
    await p.shot(`${nomeDev.replace(' ', '_')}_1_form`);
  });
  await check(tag + 'chip, subtítulo e microcopy usam o config', async () => {
    const t = await p.ev(`({chip:document.querySelector('.im-chip').textContent,sub:document.querySelector('.im-sub').textContent,micro:document.querySelector('.im-micro').textContent,ph:[...document.querySelectorAll('.im-input')].map(i=>i.placeholder),fs:[...document.querySelectorAll('.im-input')].map(i=>parseFloat(getComputedStyle(i).fontSize)),hs:[...document.querySelectorAll('.im-input')].map(i=>i.getBoundingClientRect().height)})`);
    assert.equal(t.chip, 'Super Aulão ao vivo · 12 de dezembro às 14h');
    assert.equal(t.sub, 'Preencha os dados abaixo para garantir sua vaga no super aulão.');
    assert.match(t.micro, /^Seus dados ficam só com Marca Teste\./);
    assert.deepEqual(t.ph, ['Seu nome completo', '(11) 99999-9999', 'voce@email.com']);
    assert.ok(t.fs.every((f) => f >= 16), 'inputs >= 16px (iOS zoom): ' + t.fs); assert.ok(t.hs.every((x) => Math.abs(x - 56) < 1));
  });
  await check(tag + 'fechar: ESC, X e backdrop devolvem o foco ao botão de origem', async () => {
    await p.key('Escape'); await sleep(350); assert.equal(await aberto(p), false);
    assert.equal(await p.ev(`document.activeElement.classList.contains('js-cta')&&document.activeElement.dataset.pos`), 'hero');
    assert.equal(await p.ev(`document.documentElement.classList.contains('im-lock')||document.getElementById('topbar').hasAttribute('inert')`), false);
    await p.click(HERO); await sleep(400); assert.equal(await aberto(p), true);
    await p.click('.im-x'); await sleep(350); assert.equal(await aberto(p), false);
    await p.click(HERO); await sleep(400);
    await p.clickAt(4, 4); await sleep(350); assert.equal(await aberto(p), false);
    assert.equal(await p.ev(`document.activeElement.dataset.pos`), 'hero');
  });
  await check(tag + 'focus trap: Tab/Shift+Tab ficam dentro do modal', async () => {
    await p.click(HERO); await sleep(400);
    for (let i = 0; i < 9; i++) { await p.key('Tab'); assert.equal(await p.ev(`!!document.activeElement.closest('.im-card')`), true, 'Tab ' + i + ' saiu do modal'); }
    for (let i = 0; i < 9; i++) { await p.key('Tab', { modifiers: 8 }); assert.equal(await p.ev(`!!document.activeElement.closest('.im-card')`), true, 'Shift+Tab ' + i + ' saiu do modal'); }
  });
  await check(tag + 'validação: nome de 1 palavra, e-mail inválido, whatsapp inválido; erros acessíveis; some ao corrigir', async () => {
    await preencher(p, 'Maria', '123', 'abc');
    await p.click('.im-submit'); await sleep(200);
    const e = await p.ev(`(()=>{const o={};for(const n of ['nome','whatsapp','email']){const i=document.getElementById('im-'+n);o[n]={err:document.getElementById('im-'+n+'-err').textContent,inv:i.getAttribute('aria-invalid'),desc:i.getAttribute('aria-describedby')}};return o})()`);
    assert.equal(e.nome.err, 'Digite seu nome completo'); assert.equal(e.whatsapp.err, 'Digite um WhatsApp válido com DDD'); assert.equal(e.email.err, 'Digite um e-mail válido');
    assert.equal(e.nome.inv, 'true'); assert.equal(e.email.desc, 'im-email-err');
    assert.equal(await p.ev('document.activeElement.id'), 'im-nome');
    assert.equal(srv.leads.length, 0);
    await p.shot(`${nomeDev.replace(' ', '_')}_2_erros`);
    await p.ev(`document.getElementById('im-nome').value=''`); await p.type('#im-nome', ' Maria  da Silva'); await p.ev(`document.getElementById('im-nome').dispatchEvent(new Event('blur'))`);
    assert.equal(await p.ev(`document.getElementById('im-nome-err').textContent`), '');
  });
  await check(tag + 'máscara do telefone e +55 fixo', async () => {
    await p.ev(`document.getElementById('im-whatsapp').value=''`); await p.type('#im-whatsapp', '27999999999');
    assert.equal(await p.ev(`document.getElementById('im-whatsapp').value`), '(27) 99999-9999');
    assert.equal(await p.ev(`document.querySelector('.im-prefix').textContent`), '+55');
    assert.deepEqual(await p.ev(`(()=>{const i=document.getElementById('im-whatsapp');return [i.type,i.inputMode,i.autocomplete]})()`), ['tel', 'numeric', 'tel-national']);
  });
  await check(tag + 'envio: cliques consecutivos = 1 lead; webhook recebe o JSON exato; sucesso (evento pago)', async () => {
    await p.ev(`document.getElementById('im-email').value=''`); await p.type('#im-email', 'Maria@Exemplo.com');
    await set({ delay: 600 });
    const r = await p.rect('.im-submit'); await p.clickAt(r.cx, r.cy); await p.clickAt(r.cx, r.cy); await p.clickAt(r.cx, r.cy);
    await sleep(120);
    assert.equal(await p.ev(`(()=>{const b=document.querySelector('.im-submit');return b.disabled+'|'+b.textContent})()`), 'true|Enviando...');
    await sleep(1300); await set({ delay: 0 });
    assert.equal(srv.leads.length, 1, 'leads: ' + srv.leads.length); assert.equal(srv.hooks.length, 1);
    const h = srv.hooks[0];
    assert.deepEqual(Object.keys(h), ['nome', 'whatsapp', 'email', 'evento', 'dataEvento', 'origem', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'timestamp']);
    assert.equal(h.nome, 'Maria da Silva'); assert.equal(h.whatsapp, '5527999999999'); assert.equal(h.email, 'maria@exemplo.com');
    assert.equal(h.evento, 'super-aulao'); assert.equal(h.dataEvento, '2026-12-12'); assert.match(h.origem, /utm_source=ig/);
    assert.deepEqual([h.utm_source, h.utm_medium, h.utm_campaign, h.utm_content, h.utm_term], ['ig', 'bio', 'aulao', '', '']);
    assert.match(h.timestamp, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.equal(srv.leads[0].status_webhook, 'sent');
    const ok = await p.ev(`({on:document.querySelector('.im-ok').classList.contains('on'),title:document.getElementById('im-ok-title').textContent,text:document.querySelector('.im-ok .im-sub').textContent,btns:[...document.querySelectorAll('.im-btns > *')].map(b=>b.textContent+'|'+(b.getAttribute('href')||'')),focus:document.activeElement.id,form:document.getElementById('im-nome').value})`);
    assert.equal(ok.on, true); assert.equal(ok.title, 'Inscrição recebida!'); assert.match(ok.text, /Finalize o pagamento.*12 de dezembro às 14h/);
    assert.match(ok.btns[0], /^Ir para o pagamento\|https:\/\/pay\.kiwify\.com\.br\/rIiYAl1\?.*utm_source=ig/); assert.equal(ok.btns[1], 'Fechar|');
    assert.equal(ok.focus, 'im-ok-title'); assert.equal(ok.form, '');
    await p.shot(`${nomeDev.replace(' ', '_')}_3_sucesso`);
  });
  await check(tag + 'navegação preserva UTMs; voltar sem parâmetros não apaga', async () => {
    await p.send('Page.navigate', { url: BASE + '/' }); await sleep(1200);
    assert.deepEqual(await p.ev(`VIDA.utm.get()`), { utm_source: 'ig', utm_medium: 'bio', utm_campaign: 'aulao', utm_content: '', utm_term: '' });
    await p.send('Page.navigate', { url: BASE + '/?utm_source=outra' }); await sleep(1200);
    assert.equal(await p.ev(`VIDA.utm.get().utm_source`), 'ig');
  });
  await check(tag + 'honeypot preenchido: sucesso genérico, nada gravado', async () => {
    const antes = srv.leads.length;
    await p.click(HERO); await sleep(400); await preencher(p);
    assert.deepEqual(await p.ev(`(()=>{const h=document.querySelector('.im-hp');return [h.getAttribute('aria-hidden'),h.tabIndex,h.autocomplete,h.getBoundingClientRect().x<-5000]})()`), ['true', -1, 'off', true]);
    await p.ev(`document.querySelector('.im-hp').value='http://spam.com'`);
    await p.click('.im-submit'); await sleep(1000);
    assert.equal(srv.leads.length, antes); assert.equal(await p.ev(`document.querySelector('.im-ok').classList.contains('on')`), true);
  });
  await p.close();
}

// ---- Cenários de backend/estado (um aparelho só) ----
async function cenario(nome, cfg, fn, { w = 390, h = 844, query = '' } = {}) {
  await set({ reset: true, webhook: '200', gratuito: false, envio: false, dbfail: false, mock: false, grupo: '', ...cfg });
  const p = await Page.open(BASE + '/' + query, { w, h, mobile: true });
  await check(nome, async () => { await p.click(HERO); await sleep(400); await preencher(p); await p.click('.im-submit'); await sleep(1500); await fn(p); });
  await p.close();
}
const okText = (p) => p.ev(`({t:document.getElementById('im-ok-title').textContent,x:document.querySelector('.im-ok .im-sub').textContent,on:document.querySelector('.im-ok').classList.contains('on'),btns:[...document.querySelectorAll('.im-btns > *')].map(b=>b.textContent)})`);
const formErr = (p) => p.ev(`document.querySelector('.im-formerr.on')?.textContent||null`);

await cenario('gratuito + webhook 200: "Sua vaga está garantida" + data', { gratuito: true }, async (p) => {
  const o = await okText(p); assert.equal(o.t, 'Inscrição confirmada!'); assert.equal(o.x, 'Sua vaga está garantida. Salve a data: 12 de dezembro às 14h.'); assert.deepEqual(o.btns, ['Fechar']);
});
await cenario('gratuito + envioAutomaticoLink: texto do link por WhatsApp/e-mail', { gratuito: true, envio: true }, async (p) => {
  assert.equal((await okText(p)).x, 'Enviamos o link de acesso para o seu WhatsApp e e-mail. Salve a data: 12 de dezembro às 14h.');
  assert.equal(await p.ev(`document.querySelector('.im-sub').textContent`), 'O link de acesso chega no seu WhatsApp e no seu e-mail antes de a gente começar.');
});
await cenario('gratuito + grupo do WhatsApp: botão aparece com rel seguro', { gratuito: true, grupo: 'https://chat.whatsapp.com/abc' }, async (p) => {
  assert.deepEqual((await okText(p)).btns, ['Entrar no grupo do WhatsApp', 'Fechar']);
  assert.equal(await p.ev(`document.querySelector('.im-btns a').rel`), 'noopener noreferrer');
});
await cenario('webhook 500: inscrição recebida, SEM afirmar envio (lead preservado como failed)', { gratuito: true, webhook: '500' }, async (p) => {
  const o = await okText(p); assert.equal(o.x, 'Recebemos sua inscrição! Salve a data: 12 de dezembro às 14h.');
  assert.equal(srv.leads.length, 1); assert.equal(srv.leads[0].status_webhook, 'failed'); assert.equal(srv.leads[0].erro_webhook, 'HTTP 500');
});
await cenario('webhook com conexão derrubada: mesmo comportamento', { gratuito: true, webhook: 'drop' }, async (p) => {
  assert.equal((await okText(p)).x, 'Recebemos sua inscrição! Salve a data: 12 de dezembro às 14h.'); assert.equal(srv.leads[0].status_webhook, 'failed');
});
await cenario('falha no banco: erro, dados mantidos, botão reabilitado, webhook não chamado', { dbfail: true }, async (p) => {
  assert.equal(await formErr(p), 'Não foi possível concluir sua inscrição agora. Tente novamente.');
  assert.equal(await p.ev(`document.getElementById('im-nome').value`), 'Maria da Silva'); assert.equal(await p.ev(`document.querySelector('.im-submit').disabled`), false);
  assert.equal(srv.hooks.length, 0); assert.equal((await okText(p)).on, false);
  await p.shot('mobile_390_4_erro_banco');
});
await cenario('mock rate_limited: mensagem de muitas tentativas', { mock: true }, async (p) => { assert.equal(await formErr(p), 'Muitas tentativas. Aguarde um instante e tente novamente.'); }, { query: '?mock=rate' });
await cenario('mock network_error: mensagem genérica', { mock: true }, async (p) => { assert.equal(await formErr(p), 'Não foi possível concluir sua inscrição agora. Tente novamente.'); }, { query: '?mock=network' });
await cenario('mock validation_error: mostra erro no campo', { mock: true }, async (p) => { assert.equal(await p.ev(`document.getElementById('im-email-err').textContent`), 'Digite um e-mail válido'); }, { query: '?mock=validation' });
await cenario('mock pending/sent sem rede', { mock: true, gratuito: true }, async (p) => { assert.equal((await okText(p)).x, 'Recebemos sua inscrição! Salve a data: 12 de dezembro às 14h.'); }, { query: '?mock=pending' });

// ---- Teclado aberto no celular (altura de tela reduzida) ----
await set({ reset: true, webhook: '200', gratuito: false, mock: false });
{
  const p = await Page.open(BASE + '/', { w: 390, h: 844, mobile: true });
  await check('[mobile 390] teclado aberto: card rola por dentro, botão alcançável, X sempre visível', async () => {
    await p.click(HERO); await sleep(450);
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 330, deviceScaleFactor: 2, mobile: true }); await sleep(400);
    const m = await p.ev(`(()=>{const c=document.querySelector('.im-card');return {ch:c.clientHeight,sh:c.scrollHeight,vh:innerHeight,ov:getComputedStyle(c).overflowY,ob:getComputedStyle(c).overscrollBehaviorY}})()`);
    assert.ok(m.ch <= m.vh - 31, `card (${m.ch}) deve caber na tela (${m.vh})`); assert.ok(m.sh > m.ch, 'tem que haver rolagem interna'); assert.equal(m.ov, 'auto'); assert.equal(m.ob, 'contain');
    await p.ev(`document.getElementById('im-email').focus()`); await sleep(900);
    await p.ev(`document.querySelector('.im-submit').scrollIntoView({block:'end'})`); await sleep(300);
    const b = await p.rect('.im-submit'), x = await p.rect('.im-x');
    assert.ok(b.y >= 0 && b.y + b.h <= m.vh, `botão visível após rolar: ${JSON.stringify(b)}`);
    assert.ok(x.y >= 0 && x.y + x.h <= m.vh && x.w >= 44 && x.h >= 44, `X visível e >= 44px: ${JSON.stringify(x)}`);
    await p.shot('mobile_390_5_teclado');
    await p.ev(`document.querySelector('.im-x').click()`); await sleep(300);
    assert.equal(await p.ev(`document.documentElement.scrollWidth <= document.documentElement.clientWidth`), true);
  });
  await p.close();
}

console.log(results.join('\n'));
console.log(`\n${results.length - falhas}/${results.length} verificações OK`);
chrome.kill(); srv.close(); try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
process.exit(falhas ? 1 : 0);
