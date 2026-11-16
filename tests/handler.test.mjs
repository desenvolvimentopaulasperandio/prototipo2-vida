// Teste de ponta a ponta do backend: handler real + webhook HTTP real (local) + banco em memória.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handle } from '../supabase/functions/registrar-inscricao/handler.ts';

const ORIGEM = 'http://localhost:8080';
const BODY = {
  nome: 'Maria  da Silva', whatsapp: '(27) 99999-9999', email: ' Maria@Exemplo.com ', evento: 'super-aulao', dataEvento: '2026-12-12',
  origem: 'http://localhost:8080/?utm_source=ig', utm_source: 'ig', utm_medium: 'bio', utm_campaign: 'aulao', utm_content: 'c', utm_term: 't', honeypot: '',
};

function memDb({ falharInsert = false, falharUpdate = false } = {}) {
  const rows = []; const contagem = new Map();
  return {
    rows,
    async checkRateLimit(ip, limite) { const n = (contagem.get(ip) || 0) + 1; contagem.set(ip, n); return n <= limite; },
    async insertLead(row) { if (falharInsert) throw new Error('db down'); const r = { id: 'id-' + (rows.length + 1), ...row }; rows.push(r); return { id: r.id }; },
    async updateLead(id, patch) { if (falharUpdate) throw new Error('db down'); Object.assign(rows.find((r) => r.id === id), patch); },
  };
}

async function webhook(handlerFn) {
  const recebidos = [];
  const srv = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c));
    req.on('end', () => { recebidos.push({ method: req.method, ct: req.headers['content-type'], raw: b }); handlerFn(req, res); });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${srv.address().port}/hook`, recebidos, close: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(r); }) };
}

function montar({ db = memDb(), url, extraEnv = {} } = {}) {
  const logs = [];
  const env = { EVENTO_WEBHOOK_URL: url, ALLOWED_ORIGINS: ORIGEM, ...extraEnv };
  const deps = { env: (n) => env[n], db, fetchFn: fetch, now: () => new Date('2026-11-14T23:52:00.000Z'), log: (...a) => logs.push(a.join(' ')) };
  const post = (body, { origin = ORIGEM, ip = '1.1.1.1', raw } = {}) => handle(new Request('http://fn/registrar-inscricao', {
    method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), 'x-forwarded-for': ip }, body: raw ?? JSON.stringify(body),
  }), deps);
  return { db, logs, post, deps };
}
const json = async (r) => r.json();

test('webhook 200: payload idêntico à especificação, lead "sent"', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end('ok'); });
  const { db, post } = montar({ url: w.url });
  const r = await post(BODY);
  assert.equal(r.status, 200);
  assert.deepEqual(await json(r), { ok: true, status: 'received', webhook: 'sent' });
  assert.equal(w.recebidos.length, 1);
  assert.equal(w.recebidos[0].method, 'POST'); assert.equal(w.recebidos[0].ct, 'application/json');
  const enviado = JSON.parse(w.recebidos[0].raw);
  assert.deepEqual(enviado, {
    nome: 'Maria da Silva', whatsapp: '5527999999999', email: 'maria@exemplo.com', evento: 'super-aulao', dataEvento: '2026-12-12',
    origem: 'http://localhost:8080/?utm_source=ig', utm_source: 'ig', utm_medium: 'bio', utm_campaign: 'aulao', utm_content: 'c', utm_term: 't',
    timestamp: '2026-11-14T23:52:00.000Z',
  });
  assert.deepEqual(Object.keys(enviado), ['nome', 'whatsapp', 'email', 'evento', 'dataEvento', 'origem', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'timestamp']);
  assert.equal(db.rows[0].status_webhook, 'sent'); assert.equal(db.rows[0].tentativas_envio, 1); assert.equal(db.rows[0].erro_webhook, null);
  assert.equal(db.rows[0].data_evento, '2026-12-12');
  await w.close();
});

test('sem UTMs: campos vão como string vazia', async () => {
  const w = await webhook((q, s) => { s.writeHead(204); s.end(); });
  const { post } = montar({ url: w.url });
  const { utm_source, utm_medium, utm_campaign, utm_content, utm_term, ...semUtm } = BODY;
  assert.equal((await post(semUtm)).status, 200);
  const e = JSON.parse(w.recebidos[0].raw);
  assert.deepEqual([e.utm_source, e.utm_medium, e.utm_campaign, e.utm_content, e.utm_term], ['', '', '', '', '']);
  await w.close();
});

test('whatsapp já com 55 não duplica', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { post } = montar({ url: w.url });
  await post({ ...BODY, whatsapp: '5527999999999' });
  assert.equal(JSON.parse(w.recebidos[0].raw).whatsapp, '5527999999999');
  await w.close();
});

test('webhook 500: inscrição preservada, resposta pending, status failed', async () => {
  const w = await webhook((q, s) => { s.writeHead(500); s.end('erro interno'); });
  const { db, post, logs } = montar({ url: w.url });
  const r = await post(BODY);
  assert.equal(r.status, 200);
  assert.deepEqual(await json(r), { ok: true, status: 'received', webhook: 'pending' });
  assert.equal(db.rows.length, 1); assert.equal(db.rows[0].status_webhook, 'failed'); assert.equal(db.rows[0].erro_webhook, 'HTTP 500');
  assert.ok(logs.some((l) => l.includes('webhook_falhou')));
  await w.close();
});

test('falha de conexão com o webhook: pending/failed (network_error)', async () => {
  const w = await webhook((q, s) => s.end()); const url = w.url; await w.close(); // porta fechada
  const { db, post } = montar({ url });
  const r = await post(BODY);
  assert.deepEqual(await json(r), { ok: true, status: 'received', webhook: 'pending' });
  assert.equal(db.rows[0].status_webhook, 'failed'); assert.equal(db.rows[0].erro_webhook, 'network_error');
});

test('webhook lento: timeout', async () => {
  const w = await webhook(() => { /* nunca responde */ });
  const { db, post } = montar({ url: w.url, extraEnv: { WEBHOOK_TIMEOUT_MS: '300' } });
  const t0 = Date.now(); const r = await post(BODY);
  assert.ok(Date.now() - t0 < 3000);
  assert.deepEqual(await json(r), { ok: true, status: 'received', webhook: 'pending' });
  assert.equal(db.rows[0].erro_webhook, 'timeout');
  await w.close();
});

test('secret EVENTO_WEBHOOK_URL ausente: erro controlado e registrado, lead salvo', async () => {
  const { db, post, logs } = montar({ url: undefined });
  const r = await post(BODY);
  assert.deepEqual(await json(r), { ok: true, status: 'received', webhook: 'pending' });
  assert.equal(db.rows[0].status_webhook, 'failed'); assert.equal(db.rows[0].erro_webhook, 'webhook_nao_configurado'); assert.equal(db.rows[0].tentativas_envio, 0);
  assert.ok(logs.some((l) => l.includes('EVENTO_WEBHOOK_URL')));
});

test('falha no registro do banco: internal_error e webhook NÃO é chamado', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { post } = montar({ url: w.url, db: memDb({ falharInsert: true }) });
  const r = await post(BODY);
  assert.equal(r.status, 500); assert.deepEqual(await json(r), { ok: false, code: 'internal_error' });
  assert.equal(w.recebidos.length, 0);
  await w.close();
});

test('falha ao atualizar o status não derruba a resposta', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { post } = montar({ url: w.url, db: memDb({ falharUpdate: true }) });
  assert.deepEqual(await json(await post(BODY)), { ok: true, status: 'received', webhook: 'sent' });
  await w.close();
});

test('validação: e-mail inválido, nome vazio, whatsapp inválido', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { db, post } = montar({ url: w.url });
  let r = await post({ ...BODY, email: 'abc' }); assert.equal(r.status, 400);
  let j = await json(r); assert.equal(j.code, 'validation_error'); assert.equal(j.fields.email, 'Digite um e-mail válido');
  r = await post({ ...BODY, nome: '' }); j = await json(r); assert.equal(j.fields.nome, 'Digite seu nome completo');
  r = await post({ ...BODY, whatsapp: '123' }); j = await json(r); assert.equal(j.fields.whatsapp, 'Digite um WhatsApp válido com DDD');
  r = await post(null, { raw: '{quebrado' }); assert.equal(r.status, 400);
  assert.equal(db.rows.length, 0); assert.equal(w.recebidos.length, 0);
  await w.close();
});

test('honeypot: sucesso genérico, nada gravado, webhook não chamado', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { db, post } = montar({ url: w.url });
  const r = await post({ ...BODY, honeypot: 'http://spam' });
  assert.equal(r.status, 200); assert.deepEqual(await json(r), { ok: true, status: 'received', webhook: 'pending' });
  assert.equal(db.rows.length, 0); assert.equal(w.recebidos.length, 0);
  await w.close();
});

test('rate limit por IP: 429 depois do limite, outro IP segue livre', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { post } = montar({ url: w.url, extraEnv: { RATE_LIMIT_MAX: '3' } });
  for (let i = 0; i < 3; i++) assert.equal((await post(BODY, { ip: '9.9.9.9' })).status, 200);
  const r = await post(BODY, { ip: '9.9.9.9' });
  assert.equal(r.status, 429); assert.deepEqual(await json(r), { ok: false, code: 'rate_limited' });
  assert.equal((await post(BODY, { ip: '8.8.8.8' })).status, 200);
  await w.close();
});

test('CORS: origem permitida, bloqueada e preflight', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { post, deps } = montar({ url: w.url });
  const ok = await post(BODY); assert.equal(ok.headers.get('access-control-allow-origin'), ORIGEM);
  const ruim = await post(BODY, { origin: 'https://malicioso.com' }); assert.equal(ruim.status, 403); assert.equal(ruim.headers.get('access-control-allow-origin'), null);
  const pre = await handle(new Request('http://fn/', { method: 'OPTIONS', headers: { origin: ORIGEM, 'access-control-request-method': 'POST' } }), deps);
  assert.equal(pre.status, 204); assert.match(pre.headers.get('access-control-allow-headers'), /apikey/); assert.equal(pre.headers.get('access-control-allow-origin'), ORIGEM);
  const preRuim = await handle(new Request('http://fn/', { method: 'OPTIONS', headers: { origin: 'https://malicioso.com' } }), deps);
  assert.equal(preRuim.status, 403);
  assert.equal((await handle(new Request('http://fn/', { method: 'GET', headers: { origin: ORIGEM } }), deps)).status, 405);
  await w.close();
});

test('cliques consecutivos chegam como requisições separadas (dedupe é do frontend)', async () => {
  const w = await webhook((q, s) => { s.writeHead(200); s.end(); });
  const { db, post } = montar({ url: w.url });
  await Promise.all([post(BODY), post(BODY)]);
  assert.equal(db.rows.length, 2); // backend não bloqueia por duplicidade; ver docs
  await w.close();
});
