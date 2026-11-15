// Servidor local para desenvolvimento/testes: serve a landing e emula a Edge Function usando o MESMO handler.ts
// (banco em memória + webhook local). Uso:  node tests/dev-server.mjs   ->  http://localhost:8080
// Ajuste em tempo real:  POST /__set {webhook:'200'|'500'|'drop', gratuito, envio, dbfail, mock, grupo, utmOnly}
//                        GET /__leads (leads gravados) · GET /__hooks (payloads recebidos pelo webhook)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from '../supabase/functions/registrar-inscricao/handler.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json' };

export async function startDevServer({ port = 8080 } = {}) {
  const state = { webhook: '200', gratuito: false, envio: false, dbfail: false, mock: false, grupo: '' };
  const leads = []; const hooks = []; const rate = new Map();
  const db = {
    async checkRateLimit(ip, limite) { const n = (rate.get(ip) || 0) + 1; rate.set(ip, n); return n <= limite; },
    async insertLead(row) { if (state.dbfail) throw new Error('db down (simulado)'); const r = { id: 'lead-' + (leads.length + 1), ...row }; leads.push(r); return { id: r.id }; },
    async updateLead(id, patch) { Object.assign(leads.find((l) => l.id === id), patch); },
  };

  const hookSrv = http.createServer((req, res) => {
    let b = ''; req.on('data', (c) => (b += c));
    req.on('end', () => {
      hooks.push(JSON.parse(b || '{}'));
      if (state.webhook === 'drop') return req.socket.destroy();
      res.writeHead(state.webhook === '500' ? 500 : 200); res.end('x');
    });
  });
  await new Promise((r) => hookSrv.listen(0, '127.0.0.1', r));
  const hookUrl = `http://127.0.0.1:${hookSrv.address().port}/hook`;

  const srv = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const origin = `http://${req.headers.host}`;
    if (url.pathname === '/__set' && req.method === 'POST') {
      let b = ''; for await (const c of req) b += c;
      Object.assign(state, JSON.parse(b)); if (state.reset) { leads.length = 0; hooks.length = 0; rate.clear(); delete state.reset; }
      res.writeHead(200); return res.end('{}');
    }
    if (url.pathname === '/__leads') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(leads)); }
    if (url.pathname === '/__hooks') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(hooks)); }

    if (url.pathname === '/functions/v1/registrar-inscricao') {
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay)); /* simula rede lenta (testa o estado "Enviando...") */
      const body = req.method === 'POST' ? Buffer.concat(await (async () => { const a = []; for await (const c of req) a.push(c); return a; })()) : undefined;
      const headers = new Headers(); for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
      const env = { EVENTO_WEBHOOK_URL: hookUrl, ALLOWED_ORIGINS: origin, RATE_LIMIT_MAX: '100', WEBHOOK_TIMEOUT_MS: '2000' };
      const r = await handle(new Request(origin + req.url, { method: req.method, headers, body }), {
        env: (n) => env[n], db, fetchFn: fetch, now: () => new Date(), log: (...a) => console.error('[fn]', ...a),
      });
      res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
    }

    let file = path.join(ROOT, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('404'); }
    let data = fs.readFileSync(file);
    if (url.pathname === '/config.js') {
      data = Buffer.from(data.toString('utf8') + `
;(function(c){c.supabase=c.supabase||{};c.supabase.url=location.origin;c.supabase.mock=${state.mock};c.evento.gratuito=${state.gratuito};c.evento.envioAutomaticoLink=${state.envio};c.evento.grupoWhatsappUrl=${JSON.stringify(state.grupo)};c.evento.marcaNome=c.evento.marcaNome||"Marca Teste";})(window.LP_CONFIG);`);
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  });
  await new Promise((r) => srv.listen(port, '127.0.0.1', r));
  return { port: srv.address().port, state, leads, hooks, close: () => { srv.closeAllConnections?.(); hookSrv.closeAllConnections?.(); srv.close(); hookSrv.close(); } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await startDevServer({ port: Number(process.env.PORT) || 8080 });
  console.log(`Landing: http://localhost:${s.port}  (função emulada em /functions/v1/registrar-inscricao; webhook falso local)`);
}
