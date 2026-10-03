// SPDX-License-Identifier: AGPL-3.0-or-later
// Pages Function: `o-inclusionista.jrocha.dev.br/heavy/*` → bucket R2 `the-inclusionist-lfs`.
//
// 🔴 UMA FUNCAO SO SERVE TODOS OS JOGOS DA ORIGEM (ADR-0117). O `/heavy/*` vive na RAIZ do dominio, nao
// debaixo de `/<slug>/`, porque os jogos poem `<base href="/">` no `index.html` para o `document.baseURI`
// cair na raiz. Com baseURI em `/`, o `new URL('heavy/<host><path>', doc.baseURI)` da engine resolve
// `/heavy/<host><path>` — o mesmo URL para `game-platformer`, `game-chess` e qualquer jogo seguinte, e o
// cache HTTP do navegador partilha-se por URL. A engine ja guardava no `CacheStorage('incl-pesados-v2')`
// pela URL upstream (`platform/heavy.deliveryCacheKey`), entao o cache nomeado tambem partilha; agora o
// cache do navegador tambem partilha. Dois niveis de dedup.
//
// ⚠️ O LAYOUT DO BUCKET E' O DA ARVORE LFS (`vosk-models/...`, `kokoro-82m-v1.0-onnx/onnx/...`,
// `mediapipe-tasks-vision-1.0.1/models/...`), nao o da entrega (`heavy/<host><path>`). A engine ja tem a
// tabela de traducao em `platform/heavy-mirror.MIRROR_FOLDERS`; copiada aqui em vez de importada por tres
// razoes:
//
// 1. Pages Functions correm no runtime do Workers e esbuild bundles so tem acesso a modulos do repo. O
//    `@the-inclusionist/engine/platform/heavy-mirror.js` chega via `exports` do pacote, mas o esbuild do
//    Pages tratao como external por omissao — a importacao falharia no runtime.
// 2. A tabela e' pequena (uma dezena de linhas) e muda uma vez por versao da engine.
// 3. Um deploy que a desatualizasse falharia 404 numa classe inteira de ficheiros, com uma linha vermelha
//    nos logs do Pages — ao contrario de uma import silenciosamente a resolver mal e devolver `null`.
//
// 📌 PARA MANTER SINCRONIZADA: ao subir a versao da engine, correr
//    `node -p "require('@the-inclusionist/engine/platform/heavy-mirror.js').MIRROR_FOLDERS"`
// e comparar com a tabela abaixo. Um ficheiro `.github/workflows/mirror-folders.yml` podia aferir isto no
// CI do deploy — fica anotado para o Dev decidir se quer adicionar.

/** Prefixo upstream → pasta no bucket LFS. Copiado de `@the-inclusionist/engine/platform/heavy-mirror.js`
 *  da versao 11.0.0. Sem a barra final, exatamente como la. */
const MIRROR_FOLDERS: ReadonlyArray<readonly [string, string]> = [
  ['https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main', 'kokoro-82m-v1.0-onnx'],
  ['https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1', 'mediapipe-tasks-vision-1.0.1/tasks-vision@1.0.1'],
  ['https://storage.googleapis.com/mediapipe-models', 'mediapipe-tasks-vision-1.0.1/models'],
  ['https://lfs-oinclusionista.jrocha.dev.br/whisper-small-onnx', 'whisper-small-onnx'],
  ['https://lfs-oinclusionista.jrocha.dev.br/moonshine-streaming-small-onnx', 'moonshine-streaming-small-onnx'],
  ['https://lfs-oinclusionista.jrocha.dev.br/moonshine-streaming-small-es-onnx', 'moonshine-streaming-small-es-onnx'],
  ['https://lfs-oinclusionista.jrocha.dev.br/vosk-browser-dynamic-execution-0', 'vosk-browser-dynamic-execution-0'],
  ['https://lfs-oinclusionista.jrocha.dev.br/vosk-models', 'vosk-models'],
  ['https://lfs-oinclusionista.jrocha.dev.br/espeak-ng-530bf0a', 'espeak-ng-530bf0a'],
  ['https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0', 'onnxruntime-web-1.27.0'],
  ['https://lfs-oinclusionista.jrocha.dev.br/fonts', 'fonts'],
];

/** `heavy/<host><path>` → pasta no bucket LFS, ou `null` se o pedido nao mapeia a nada no catalogo. */
function mirrorKey(heavyPath: string): string | null {
  // `heavyPath` chega como ex.: `huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/onnx/model.onnx`
  // Reconstruir o URL upstream e passar pela tabela. O `?sha256=...` que a engine mete no URL fica para a cache,
  // nao vai para o R2 (nao e' pathname).
  const upstream = 'https://' + heavyPath;
  for (const [prefix, folder] of MIRROR_FOLDERS) {
    if (upstream.startsWith(prefix + '/')) return folder + upstream.slice(prefix.length);
  }
  return null;
}

interface Env {
  readonly LFS: R2Bucket;
}

export const onRequestGet: PagesFunction<Env> = async ({ params, request, env }) => {
  const parts = Array.isArray(params.path) ? params.path : [params.path ?? ''];
  const heavyPath = parts.filter(Boolean).join('/');
  if (!heavyPath) return new Response('heavy: no path', { status: 400 });

  const key = mirrorKey(heavyPath);
  if (!key) {
    // Um pedido fora do catalogo (host desconhecido): nao serve o bucket. 404 claro, para a engine marcar o
    // subsistema como `sem-fonte` sem adivinhar.
    return new Response(`heavy: ${heavyPath} is not in the mirror catalogue`, { status: 404 });
  }

  /*
   * ⚠️ `onlyIf: etagMatches` LE O ETAG DO PEDIDO para responder 304 se a crianca ja tem a ultima versao.
   * O cache verificado da engine ja usa `?sha256=<hash>` como cache-buster, entao os `heavy/*` sao imutaveis:
   * dois bytes diferentes nunca partilham URL, e um 200 vale para sempre.
   */
  const inm = request.headers.get('if-none-match');
  const etagClean = inm?.replace(/^W\//, '').replace(/^"|"$/g, '');
  const obj = await env.LFS.get(key, etagClean ? { onlyIf: { etagMatches: etagClean } } : undefined);
  if (!obj) {
    if (etagClean) return new Response(null, { status: 304 });
    return new Response(`heavy: ${key} not in bucket`, { status: 404 });
  }

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  // 📌 IMMUTABLE porque a engine chega com `?sha256=<hash>` no URL (`platform/heavy.js:284`).
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  // CORS: so por preserva de porta aberta — hoje a plataforma e o bucket vivem na mesma origem servida.
  headers.set('access-control-allow-origin', '*');
  return new Response(obj.body, { headers });
};
