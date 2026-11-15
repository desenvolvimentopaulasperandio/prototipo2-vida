import test from 'node:test';
import assert from 'node:assert/strict';
import { loadUmd } from './_umd.mjs';
const utm = loadUmd('../src/lib/tracking/utm.js');

function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
const VAZIAS = { utm_source: '', utm_medium: '', utm_campaign: '', utm_content: '', utm_term: '' };

test('sem UTMs: strings vazias', () => {
  assert.deepEqual(utm.capture('', fakeStorage()), VAZIAS);
});
test('UTMs completas são salvas e lidas', () => {
  const s = fakeStorage();
  const r = utm.capture('?utm_source=ig&utm_medium=bio&utm_campaign=aulao&utm_content=reel1&utm_term=marketing', s);
  assert.deepEqual(r, { utm_source: 'ig', utm_medium: 'bio', utm_campaign: 'aulao', utm_content: 'reel1', utm_term: 'marketing' });
});
test('navegar/voltar sem parâmetros não apaga; novas UTMs não sobrescrevem', () => {
  const s = fakeStorage();
  utm.capture('?utm_source=ig&utm_campaign=a', s);
  assert.equal(utm.capture('', s).utm_source, 'ig');          // voltou sem parâmetros
  assert.equal(utm.get(s).utm_campaign, 'a');                  // outra página, mesma sessão
  assert.equal(utm.capture('?utm_source=outra', s).utm_source, 'ig'); // já havia UTMs na sessão
});
test('valor é limpo e limitado', () => {
  const r = utm.capture('?utm_source=' + 'x'.repeat(500), fakeStorage());
  assert.equal(r.utm_source.length, 200);
});
