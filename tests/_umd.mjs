// Carrega os módulos UMD do frontend (src/lib/**/*.js) no Node, independente do "type" do package.json.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export function loadUmd(rel, globals = {}) {
  const file = fileURLToPath(new URL(rel, import.meta.url));
  const module = { exports: {} };
  new Function('module', 'exports', 'self', fs.readFileSync(file, 'utf8'))(module, module.exports, globals);
  return module.exports;
}
