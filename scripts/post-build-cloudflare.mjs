#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Pos-build que escreve `dist/_headers` com os caminhos no `base` certo. Corre so no build de producao
// (apos `vite build`); nao faz nada em dev. O `app/public/_headers` original ficou obsoleto quando o jogo
// passou a viver em `dist/game-15puzzle/*` em producao: um `_headers` dentro de `dist/game-15puzzle/`
// NAO E' LIDO pelo CF Pages, que so olha para a raiz de `pages_build_output_dir` (`dist/`).

import { writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const DIST = join(REPO, 'dist');
const base = (process.env.INCL_BASE || '/').replace(/\/+$/, '/').replace(/\/+$/, '');
// base e' sempre do tipo `/game-15puzzle` (sem barra final) ou vazio para raiz.
const prefix = base; // ex.: `/game-15puzzle`

if (!existsSync(DIST)) {
  console.error(`post-build: ${DIST} nao existe. Correste \`vite build\`?`);
  process.exit(1);
}

/*
 * O ficheiro de headers para o CF Pages. As regras valem para o URL que o navegador PEDE, nao para o nome
 * do ficheiro no disco; por isso levam o `prefix`. Sem `no-cache` em `sw.js`/`index.html`/`manifest`, o
 * mecanismo de atualizacao do PWA fica preso num build velho (`vite-plugin-pwa` por Workbox precacheia por
 * content-hash e auto-atualiza, mas so se a borda nao servir uma versao em cache). Os bundles do Vite
 * (`assets/*-[hash].*`) sao imutaveis com seguranca — o hash muda quando o conteudo muda.
 */
const headers = `# gerado por scripts/post-build-cloudflare.mjs

${prefix}/sw.js
  Cache-Control: no-cache
${prefix}/index.html
  Cache-Control: no-cache
${prefix}/manifest.webmanifest
  Cache-Control: no-cache
${prefix}/assets/*
  Cache-Control: public, max-age=31536000, immutable
${prefix}/vendor/*
  Cache-Control: public, max-age=31536000, immutable
`;

writeFileSync(join(DIST, '_headers'), headers);
console.log(`post-build: wrote dist/_headers (prefix: ${prefix || '/'})`);

/*
 * E se o Vite ja copiou o `_headers` velho para dentro da sub-pasta, apaga-se: fica so o novo na raiz. O
 * velho tinha caminhos sem prefixo (`/sw.js`), que para o CF Pages serviria o `sw.js` do dominio raiz —
 * que nem sequer existe no deploy deste jogo.
 */
if (prefix) {
  const stale = join(DIST, prefix.replace(/^\//, ''), '_headers');
  if (existsSync(stale)) {
    rmSync(stale);
    console.log(`post-build: removed stale ${stale.slice(REPO.length + 1)}`);
  }
}
