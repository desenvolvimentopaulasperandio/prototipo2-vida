// Roda os MESMOS casos no frontend (src/lib/validation/inscricao.js) e no backend (validacao.ts).
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadUmd } from './_umd.mjs';
import * as back from '../supabase/functions/registrar-inscricao/validacao.ts';
const front = loadUmd('../src/lib/validation/inscricao.js');

for (const [lado, m] of [['frontend', front], ['backend', back]]) {
  test(`[${lado}] WhatsApp: com e sem 55, sem duplicar`, () => {
    for (const entrada of ['(27) 99999-9999', '27999999999', '+55 27 99999-9999', '5527999999999', '055 27 99999 9999', '(27)99999.9999']) {
      assert.equal(m.normalizarWhatsapp(entrada), '5527999999999', entrada);
      assert.ok(m.validarWhatsapp(entrada), entrada);
    }
    // DDD 55 (RS): "55" no começo NÃO é código do país quando só há 10/11 dígitos
    assert.equal(m.normalizarWhatsapp('(55) 99999-9999'), '5555999999999');
    assert.equal(m.normalizarWhatsapp('5555999999999'), '5555999999999');
  });
  test(`[${lado}] WhatsApp inválido`, () => {
    for (const x of ['', '123', '(27) 9999-999', '(00) 99999-9999', '(10) 99999-9999', '(27) 89999-9999', '27999999999999', 'abc']) {
      assert.equal(m.validarWhatsapp(x), false, x);
    }
    assert.ok(m.validarWhatsapp('(27) 3333-4444'), 'fixo de 10 dígitos é aceito');
  });
  test(`[${lado}] e-mail`, () => {
    assert.equal(m.normalizarEmail('  Maria@Exemplo.COM '), 'maria@exemplo.com');
    for (const x of ['maria@exemplo.com', 'a.b+c@sub.dominio.com.br']) assert.ok(m.validarEmail(x), x);
    for (const x of ['', 'maria', 'maria@', '@x.com', 'maria@x', 'maria@x.c', 'ma ria@x.com', 'a..b@x.com', 'a@.com']) assert.equal(m.validarEmail(x), false, x);
  });
  test(`[${lado}] nome`, () => {
    assert.equal(m.normalizarNome('  Maria   da  Silva '), 'Maria da Silva');
    for (const x of ['Maria Silva', "Ana d'Ávila", 'João-Pedro Souza', 'Zé Ó']) assert.ok(m.validarNome(x), x);
    for (const x of ['', '   ', 'Maria', 'Maria 123', '<b>x</b> y', 'A']) assert.equal(m.validarNome(x), false, x);
  });
}

test('frontend: máscara do telefone', () => {
  const f = front.mascaraTelefone;
  assert.equal(f(''), ''); assert.equal(f('2'), '(2'); assert.equal(f('27'), '(27'); assert.equal(f('279'), '(27) 9');
  assert.equal(f('279999'), '(27) 9999'); assert.equal(f('2799999'), '(27) 9999-9'); assert.equal(f('2733334444'), '(27) 3333-4444');
  assert.equal(f('27999999999'), '(27) 99999-9999'); assert.equal(f('+55 27 99999-9999'), '(27) 99999-9999'); assert.equal(f('279999999999999'), '(27) 99999-9999');
});

test('frontend: validarInscricao devolve mensagens e valores normalizados', () => {
  const r = front.validarInscricao({ nome: 'Maria', whatsapp: '12', email: 'x' });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors, { nome: 'Digite seu nome completo', whatsapp: 'Digite um WhatsApp válido com DDD', email: 'Digite um e-mail válido' });
  const ok = front.validarInscricao({ nome: ' Maria  Silva ', whatsapp: '(27) 99999-9999', email: ' A@B.com ' });
  assert.deepEqual(ok.values, { nome: 'Maria Silva', whatsapp: '5527999999999', email: 'a@b.com' });
});

test('backend: validarCorpo valida evento, data e origem', () => {
  const base = { nome: 'Maria Silva', whatsapp: '27999999999', email: 'm@x.com', evento: 'super-aulao', dataEvento: '2026-12-12', origem: 'https://site.com/?utm_source=a' };
  assert.equal(back.validarCorpo(base).ok, true);
  for (const [k, v] of [['dataEvento', '2026-02-30'], ['dataEvento', ''], ['evento', 'Super Aulão'], ['origem', 'javascript:alert(1)'], ['origem', '']]) {
    const r = back.validarCorpo({ ...base, [k]: v }); assert.equal(r.ok, false, k + v); assert.ok(r.fields[k], k);
  }
});
