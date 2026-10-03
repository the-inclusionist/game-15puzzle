# game-15-puzzle — engine 11.0.0 + Cloudflare

> Plano em pt-BR porque é a superfície da conversa. **Tudo dentro do repositório continua em inglês.**

## 🔴 publicação no Cloudflare — plano (2026-10-02)

### Contexto

O ADR-0117 escolheu **uma origem** para todos os jogos — `o-inclusionista.jrocha.dev.br` — para que
a cache `incl-pesados-v2` (particionada por origem) seja descarregada **uma vez por criança**, não
uma vez por jogo. Entrega pelo Cloudflare: um Router Worker em `jrocha.dev.br` roteia
`o-inclusionista.jrocha.dev.br/<slug>/*` para `<slug>.pages.dev` (Pages do jogo) e
`o-inclusionista.jrocha.dev.br/heavy/*` para R2 via Functions. Padrão medido no `game-platformer`
em 02/10/2026 e documentado por si na orientação deste turno.

### O que NÃO é desta sessão

Três coisas são da plataforma e do Dev, e eu não as faço nem no cartucho nem no shell:

1. **Router Worker + tabela `GAMES`.** Precisa de uma linha nova:
   `'game-15-puzzle': 'game-15-puzzle.pages.dev'`. Deploy e empurrão são do repositório do worker.
2. **R2 bucket `the-inclusionist-lfs`** (jurisdição EU) com o espelho dos heavy. Hoje é cópia
   manual de `~/Claude/inclusionist-heavy-mirror/heavy/`; a Press Start 2P deste jogo tem de estar
   no espelho para `/heavy/<host><path>` resolver.
3. **Seis pedidos à sessão da engine** (pausa/HUD por assento, painéis per-seat, cores por papel no
   visual, «sair» por assento, gamepad no título, `inclusionist-heavy --base` com layout
   `MIRROR_FOLDERS`). Fica registado aqui para ir à conversa certa; nenhum é tocado aqui.

### 📏 Medido antes do planeamento — o que já está pronto

Dei uma varredura ao repositório antes de desenhar o plano. Três coisas que o `game-platformer`
precisou são verdade aqui **sem trabalho adicional**:

- **Nenhum `fetch(…)` nem `BaseTexture.from(…)` com caminho relativo.** O jogo desenha procedural
  (ADR-0027: zero glifos no framebuffer, todas as formas vêm de primitivas Pixi). As três mordidas
  do platformer — mapa, demo do pad, atlas do personagem — não existem aqui.
- **`uses` declarado** em `app/js/boot/standalone.ts:134`:
  `uses: { neuralVoice: true, fonts: ['Press Start 2P'] }` (step 11f). `reading: true` **não é
  preciso** — o jogo não tem texto em imagem para reconhecer.
- **Chaves do preset nos três idiomas** em `app/js/i18n/{pt,en,es}.ts`: `preset.up.label`,
  `preset.action1.label`, etc. (step 11b/11e). O `word()` da engine resolve-as sem recorrer à engine.
  Não precisamos de `app/js/i18n/game-keys.ts` separado — a nossa organização já cobre.
- **`app/public/` nem existe** — saiu com a fonte vendorizada em 11f. Vite não copia nada que não
  deva ir.
- **CI reutiliza o workflow da engine** (`.github/workflows/ci.yml` chama `the-inclusionist-engine/
  .github/workflows/game-ci.yml@main`). O deploy do Pages corre pela integração GitHub do CF — não
  precisamos de outro workflow a não ser que queiramos auditar o deploy.

### Slug — a decisão primeira, por sua

A pasta é `game-15-puzzle`, o package é `@the-inclusionist/game-15-puzzle` (sem hífen interno).
ADR-0082 §1 pede repo = package = uma palavra; há incoerência histórica. Para a tabela `GAMES` e
para `INCL_BASE`, a convenção do platformer é o **nome do package**. Então o slug no plano é
**`game-15-puzzle`** (`INCL_BASE = "/game-15-puzzle/"`, `name = "game-15-puzzle"` no Pages/wrangler).
Se preferir casar o repo (`game-15-puzzle`), três linhas mudam e o plano continua válido.

### Passos — pequenos, em ordem

**12a — Vite com `base` configurável.** `vite.config.ts` passa a aceitar `INCL_BASE` do ambiente,
e o `defineGameBuild` continua a embrulhar. Shape:

```ts
const BASE = process.env.INCL_BASE || '/';
const out  = 'dist' + BASE.replace(/\/$/, '');
// ...
config: defineConfig({
  root: 'app',
  base: BASE,
  build: { outDir: `../${out}`, emptyOutDir: true, target: 'es2022' },
  // resto como está
})
```

⚠️ **O `build.outDir` muda com o `BASE`.** `vite build` no CF Pages corre com
`INCL_BASE=/game-15-puzzle/`, saída `dist/game-15-puzzle/` — que é o que o `pages_build_output_dir =
"dist"` do `wrangler.toml` serve, com o subpath embutido. Localmente, sem `INCL_BASE`, continua a
sair `dist/` cru para o `vite preview` abrir na raiz. Modo `cartridge` do `defineGameBuild` ignora
`base` e `outDir` (vai para `dist-lib/cartridge.js` como sempre) — não precisa de condicional.

**12b — `<base href="/" />` no `app/index.html`.** Uma linha no `<head>`. Faz o `<base>` ser SEMPRE
a raiz do domínio, para que `/heavy/<host><path>` resolva fora do subpath. É a receita que o
platformer provou necessária, mesmo com a `base` do Vite — o Vite reescreve só os `src=` que ELE
emite; HTML estático não.

**12c — `wrangler.toml` na raiz.** Entrada mínima medida:

```toml
name = "game-15-puzzle"
compatibility_date = "2024-11-15"
pages_build_output_dir = "dist/game-15-puzzle"
[vars]
INCL_BASE = "/game-15-puzzle/"
[[r2_buckets]]
binding = "LFS"
bucket_name = "the-inclusionist-lfs"
jurisdiction = "eu"
```

📌 **`jurisdiction = "eu"` é o erro «R2 bucket not found» mais comum.** Não omitir.

📌 **Com `wrangler.toml` presente, o dashboard do CF Pages fica somente leitura para bindings.** O
ficheiro é a verdade.

**12d — `functions/heavy/[[path]].ts`.** Proxia `/heavy/<host><path>` para o R2. A tabela
`MIRROR_FOLDERS` vem inlined — a sua orientação diz-no e dá a razão: *«esbuild do CF Pages não
resolve o import do pacote de forma estável; é melhor copiar a tabela»*. Entra como ficheiro novo,
derivado do do `game-platformer` com a `MIRROR_FOLDERS` da engine 11.

**12e — `scripts/post-build-cloudflare.mjs`.** Escreve `dist/game-15-puzzle/_headers` com os caminhos
prefixados por `INCL_BASE`. `package.json` ganha o script `build:cf` = `vite build && node
scripts/post-build-cloudflare.mjs`, e CF Pages chama-o em vez de `vite build`.

**12f — CI/CD do deploy — DECIDIDO: pela integração GitHub do CF Pages.** `git push` para `main`
dispara. Sem workflow nosso de deploy (o `.github/workflows/deploy-router-worker.yml` da sua
orientação é só para quem move o Router Worker — não é este repo).

**12g — Preparar o pedido ao Dev para a linha no Router Worker.** Depois do primeiro deploy
funcionar, abrir issue/mensagem para incluir `'game-15-puzzle': 'game-15-puzzle.pages.dev'` em `GAMES`
e para colocar a Press Start 2P no espelho R2 (se ainda não lá estiver pela engine).

### Verificação

- `INCL_BASE=/game-15-puzzle/ npm run build` → sai em `dist/game-15-puzzle/`, com os assets a
  conterem `/game-15-puzzle/assets/…`.
- `npx wrangler pages dev dist/game-15-puzzle` serve local em `localhost:8788/game-15-puzzle/`,
  `/heavy/<host><path>` responde (R2 em DEV precisa de bind local ou mock).
- Primeiro `git push main` → projecto `game-15-puzzle.pages.dev` criado automaticamente, deploy
  verde.
- Depois da linha no Router Worker: `o-inclusionista.jrocha.dev.br/game-15-puzzle/` abre a tela de
  título, 🚥/🌗 montam da barra, Enter num tile ativa (step 11c), `engine.problems` vazio.
- Rede: um pedido a `o-inclusionista.jrocha.dev.br/heavy/…` quando a Kokoro é lazy-carregada à
  primeira fala. Nenhum pedido a `huggingface.co` ou `cdn.jsdelivr.net` da parte da engine (step
  11f desligou a VLibras; a engine serve o resto do seu lado).

### Ficheiros tocados

**Criados**: `wrangler.toml`, `functions/heavy/[[path]].ts`, `scripts/post-build-cloudflare.mjs`.
**Editados**: `vite.config.ts` (base + outDir), `app/index.html` (`<base>`), `package.json`
(scripts), `README.md` (parágrafo sobre a URL de produção).

### O que NÃO entra, dito explícito

- **Multi-tenant com `players > 1`** — o jogo é um só assento (step 11b). Os seis pedidos à engine
  (pausa/HUD por assento) não se aplicam.
- **`inclusionist-heavy --base`** — não geramos espelho; a Press Start 2P vem do que a engine
  publicar no R2.
- **Workflow de deploy próprio** — a integração GitHub do CF basta.
- **Testes contra `*.pages.dev` em CI** — não há runner `axe` contra a URL de produção neste plano;
  o `scripts/axe-check.mjs` continua a correr contra o `dist/` local.

---



## 🔴 engine 11.0.0 — plano (2026-10-02)

### Contexto — por que agora

Dois registos aceitos desde a última subida mudam o enquadramento sem obrigar código: **ADR-0152**
(12/09) retira os 300 jogos do MVP — a superfície da engine passa a ser pesada pelos consumidores
reais; **ADR-0246** (26/09) decide um app instalável por plataforma (Tauri/APK) carregando cartuchos
verificados por sha256 da origem do shell. ADR-0117 segue; muda só o envelope.

O que obriga é a 11.0.0 em si. Ela faz quatro coisas que o nosso código estava a tapar:

1. **Põe `onCommand(VirtualCommand)` em `CreateGameOptions`.** O ADR-0111 §1 — *"o cartucho não vê
   códigos de tecla, índices de pad ou pontos de toque"* — tem porta pela primeira vez. Cumprir deixa
   de ser escrever desculpa em `tile-grid.ts`.
2. **Monta o painel de empatia, desenha o overlay de baixa visão e abre o cartão de pausa.** Três
   coisas que construímos à mão nas duas subidas anteriores, porque não existiam.
3. **Renomeia toda a superfície pt-BR → en** (`pausa→pause`, `cenas→scenes`, `GanchosDoCartucho→
   CartridgeHooks`, `baixarPesados→downloadHeavy`, `nome→name`…). Breaks compilam em massa, e dois
   são silenciosos: `{ nome: 'title' }` passa a devolver `undefined` em `scenes.top()?.name`, e
   `declines.semAssistenteDePad` deixa de existir sem aviso.
4. **Publica `defineGameBuild` + `inclusionist-check-cartridge` + `inclusionist-heavy`** —
   ferramentas de build que o nosso `vite.config.ts` e o nosso `scripts/check-cartridge.mjs`
   duplicam, com nomes de modo e asserções diferentes.

### Nove coisas que o jogo faz e a engine 11 passa a fazer

Cada uma foi medida contra a árvore descompactada da 11.0.0.

| Hoje no `pixi-15-puzzle` | Em engine 11 | Resultado |
|---|---|---|
| `app/js/ui/empathy-panel.ts` (ficheiro inteiro) + `tests/empathy-panel.browser.test.ts` | A engine monta `ui/settings-empathy` em `create-game.js:1496-1600`, aberta por `options → empatia` do cartão de pausa | **Delete** do ficheiro e do teste |
| `pauseActs.empatia` em `cartridge.ts:339` | A engine escreve `engineActions.empatia = empathyPanel.open` em `create-game.js:1600`, e `getPauseActs` do cartucho é espalhado POR CIMA | **Delete** do item — o nosso sobrepõe e PERDE o painel da engine |
| `#lv-overlay` em `cartridge.ts:370-376` + gradientes CSS + teste `paints a shape for every mode` | A engine desenha com `drawLowVision(c, lv, w, h)` numa `canvas#viz-overlay` que `ui/simulation-over-the-world.js:77-131` monta e pinta | **Delete** do elemento, do CSS e do gate (o gate mede o nosso desenho) |
| HUD «Experimentar» (`onEmpathy`) em `app/js/ui/hud.ts` | A engine abre pelo cartão de pausa, pelo ☰ da barra, por SELECT (default `KeyF`), ou por `systemPress('select')` de qualquer transporte | **Delete** do botão, do handler e do dep |
| `tile-grid.ts` keydown + FALLBACK + `deps.actionOf` | `onCommand(cmd: VirtualCommand)` entrega `{action, pressed, source, player}` de teclado/pad/toque/olhos/voz/varredura pelo mesmo canal | Grid ganha API imperativa `move(dir)/activate()`; cartucho despacha `onCommand` para ela |
| i18n register loop em `standalone.ts:85-93` | `createGame({ dictionaries: catalogs })` — a engine faz o loop em `create-game.js:291-292` e em `mount()` | **Delete** do loop; o módulo de dados fica |
| `@mintplex-labs/piper-tts-web` em deps + `carregarVozNeural` + `baixarPesados({ apenas })` | `uses: { neuralVoice: true }`; a engine importa `kokoro-runtime` à primeira fala e fetches no fundo via `heavyAtBoot` | **Delete** da dep, dos três campos; `ort-wasm` (27 MB) sai do bundle; `npx inclusionist-heavy dist` entrega em `dist/heavy/` no build |
| `app/public/fonts/press-start-2p-400.woff2` + CSS `@font-face` | Press Start 2P está em `platform/font-library.json`; `uses: { fonts: ['Press Start 2P'] }` + `inclusionist-heavy dist --fonts "Press Start 2P"` | **Delete** da fonte e do `OFL.txt`; a engine escreve o `@font-face` com SHA256 pinado |
| HUD controles (size, shuffle, hint, reduced-motion) em `app/js/ui/hud.ts` | Engine 11 tem `hud` (números), `gameOptions` (switch/list/steps), `preset` (ações), e abre «Opções do jogo» do cartão de pausa | Ver §Decisões abaixo — a maior parte do painel vai embora |

### Decisões que a 11.0.0 obriga, com as nossas respostas

**1. `accommodations` é OBRIGATÓRIO e refuta o boot** (`cartridgeRefusals` em `create-game.js:204-215`
chama `accommodationAnswersProblems`, e `createGame` **lança**). Dezassete chaves em `GAME_KEYED` de
`core/accommodations.d.ts:32`. Para quebra-cabeças:

| chave | resposta | porquê |
|---|---|---|
| `hints` | `{ labelKey: 'accom.hints.label', hintKey: 'accom.hints.hint' }` | o botão «Dica» ilumina ladrilhos |
| as outras 16 (cameraSway, easyMode, wheelchairMode, detectionLeniency, intensity, reducedCharacterMotion, caneSpacing, textPace, lexicalDifficulty, wordHighlight, pieceSets, distinguishableSuits, timingWindow, aimAssist, repeatedInput, ownerColors, contrastOutlines) | `false` | sem câmara, personagem, texto a correr, naipes, tiro, pontuação por dono, delineados próprios |

**2. `genre: 'Traditional puzzle game'`** — opcional mas presente em `core/genres`.

**3. `preset: ActionPreset` com cinco posições**: `up, down, left, right, action1`, cada uma com
`labelKey` apontando para `dictionaries`. **Proibido** declarar `start`/`select` — refutam o boot.

**Decidido (resposta A, 02/10)**: Shuffle e Hint tornam-se **ações da engine**: `action3`=Dica,
`action4`=Embaralhar. Teclas default `KeyK`/`KeyI`, remapeáveis, chegam pelo d-pad virtual e pela
varredura. Descoberta visual vai no `howToPlay`.

**4. `keyboardMapping(players, seat)` — porque Enter colide com o cartão.** Default da engine:
`start → KeyH + Enter`. O grid é `role="gridcell"` de botões reais; Enter aciona o botão nativamente E
abre o cartão (`create-game.js:2563` escuta em `win`). Declarar:

- `action1: ['Enter']` — ativa o tile sob o cursor
- `start: ['KeyH']` — Enter sai de `start`
- `action2: ['KeyJ']` — Space fica livre; a ativação nativa do botão continua a funcionar

**5. `dictionaries` em `createGame`** — substitui o loop do shell. Chaves novas para `preset`,
`accommodations`, `gameOptions`, `howToPlay` em pt/en/es.

**6. `hud` — os dois números do jogo**:

- `{ band: 'identity', nameKey: 'hud.moves', value: () => run.moves() }`
- `{ band: 'mission', nameKey: 'hud.progress', value: () => ({ have: run.tilesHome(), need: run.size * run.size - 1 }) }`

**7. `gameOptions` — tamanho e movimento reduzido**: um `kind: 'list'` com os três tamanhos, um
`kind: 'switch'` para o movimento. Vão para o painel «Opções do jogo» da engine.

**8. `howToPlay` — três slides**:

- `{ textKey: 'howto.slide1' }` «deslize um ladrilho para o espaço vazio»
- `{ textKey: 'howto.slide2' }` «clique num ladrilho distante na mesma linha para empurrar vários»
- `{ textKey: 'howto.slide3' }` «peça dica a qualquer altura»

**9. Fontes e voz**:

- `uses: { fonts: ['Press Start 2P'], neuralVoice: true }`
- Delete da dep `piper-tts-web`; delete do `carregarVozNeural`; delete do `baixarPesados`; delete do
  woff2 e `OFL.txt`. A engine serve a fonte com SHA256 pinado de `dist/heavy/`; a Kokoro é carregada
  à primeira fala.

**10. Build — `defineGameBuild`**. `vite.config.ts` encolhe para uma declaração; `--mode lib` → `--mode cartridge`.
`inclusionist-check-cartridge` roda ANTES do nosso `scripts/check-cartridge.mjs` — a engine testa o
CONTRATO (`cartridgeRefusals` sobre o default export), o nosso testa o BUNDLE (teto 60 kB, grep contra
`piper`/`huggingface`, caminhada do `dist-lib`). O cartucho passa a **exportar `default`** — hoje é
`export function createCartridge()` nomeado; o checker da engine refuta por «default export: missing».

**11. VLibras sai**. `setVlibrasSay`, `vlibrasSay`, `vlTick` foram removidos sem substituto nominal
— o modo surdo é agora `engine.deafMode` e a tradução entra pelo porto `host.interpreter`. Enquanto
não há intérprete, a página fica sem o único script de rede obrigatória.

**12. `startLoop` tem assinatura nova** (`core/loop.d.ts:22`): 4º arg
`{ speed: () => number, onFailure: (failure) => void }` **obrigatório**. Ligar a `engine.gameSpeed` e
`engine.onFailure`.

**13. `sonarPlayers` sai de `CartridgeHooks`.** A engine agora deriva-o da `declaration` (topologia,
alvos, nomes). Linha some do cartucho.

### Rename mecânico — a lista medida

| 9.0.0 | 11.0.0 |
|---|---|
| `@the-inclusionist/engine/platform/pesados.js` | `.../platform/heavy.js` |
| `GanchosDoCartucho` | `CartridgeHooks` |
| `baixarPesados`, `PESADOS`, `apenas:` | `downloadHeavy`, `HEAVY_FILES`, `only:` |
| `lerCenaGuardada()` | `readStoredScene(store, reducedByDefault)` — passa um store |
| `lerVisualGuardado(i)` | `readStoredVisual(store, i)` — idem |
| `simulacaoIndisponivel`, `alcanceDoModo`, `PADRAO`, `Simulacao` | `simulationUnavailable`, `reachOfMode`, `DEFAULT_VISUAL`, `Simulation` |
| `setTemaDoJogador`, `setCorrecaoDoJogador` | `setPlayerTheme`, `setPlayerCorrection` |
| `declines.semAtorDePausa`, `.semVozNeural` | `declines.noPauseActor`, `.noNeuralVoice` |
| `declines.semAssistenteDePad` | **removido** |
| `engine.pausa.mostrar/esconder` | `engine.pause.show/hide` |
| `engine.aplicarFiltroDeVisao` | `engine.applyVisionFilter` |
| `engine.cenas.*` + `{ nome }` | `engine.scenes.*` + `{ name }` — **quebra silenciosa** |
| `srAlert`, `srSay` | `engine.alert`, `engine.say` (ou `createAnnouncer({doc,raf}).{say,alert}`) |
| `store.get/set/kJogo` | `createStorage(backend)` + `gameKey('15puzzle', name)` de `platform/storage-keys.js`, ou `engine.settings` |
| `registerDict` | `createGame({ dictionaries })` ou método de `createTranslator()` |
| `initLayout`, `layout` | `createLayout(ctx).layout()` |

### Ordem — sete commits, cada um verde antes do seguinte

1. **11a — renames mecânicos**: pt-BR → en, `pesados → heavy`, `nome → name`, `declines`, hooks,
   métodos de `engine.*`, `startLoop` opts. Build quebra; testes quebram. Nada mais.
2. **11b — contrato**: `accommodations` (17 chaves), `genre`, `preset`, `dictionaries` em
   `createGame`. Boot volta a passar. Chaves novas em `app/js/i18n/{pt,en,es}.ts`.
3. **11c — controle virtual**: `onCommand` no cartucho; `tile-grid.ts` perde o `keydown` e ganha
   `move(dir)/activate()`; `declaration.keyboardMapping` tira Enter de `start`. Gate ADR-0111:
   `grep` por `event.code`/`event.key` em `app/js/` fica em zero fora de `tests/`.
4. **11d — devolver o que é da engine**: delete `app/js/ui/empathy-panel.ts`,
   `tests/empathy-panel.browser.test.ts`, `#lv-overlay`, botão «Experimentar» do HUD,
   `pauseActs.empatia`. Primeiro commit nesta sessão em que o número de ficheiros DIMINUI.
5. **11e — HUD, Opções do Jogo, Como Jogar**: `hud`, `gameOptions`, `howToPlay` em `createGame`;
   `shuffle`/`hint` como `action4`/`action3` do preset. `app/js/ui/hud.ts` encolhe para o rodapé
   legal (SOURCE_URL AGPL §13) e o painel `.hud` continua a existir sem controles.
6. **11f — pesados e fontes**: `uses: { neuralVoice: true, fonts: ['Press Start 2P'] }`; delete da
   dep `piper-tts-web`, do `carregarVozNeural`, do `baixarPesados`, do woff2 e do `OFL.txt`.
   `inclusionist-heavy dist --fonts "Press Start 2P"` entra no script de build.
7. **11g — build**: `vite.config.ts` para `defineGameBuild`; modo `lib → cartridge`; `export default`
   do cartucho; `inclusionist-check-cartridge && node scripts/check-cartridge.mjs` no mesmo script.

### Ficheiros tocados

**Apagados** (3): `app/js/ui/empathy-panel.ts`, `tests/empathy-panel.browser.test.ts`,
`app/public/fonts/press-start-2p-400.woff2` + `press-start-2p.OFL.txt`.

**Editados**:

- `app/js/cartridge.ts` — rename de métodos de engine, campos novos (`preset`, `dictionaries`, `hud`,
  `gameOptions`, `howToPlay`, `accommodations`, `genre`, `onCommand`, `uses`); delete do painel de
  empatia, do overlay, do `pauseActs.empatia`, do `sonarPlayers` hook; **default export**.
- `app/js/boot/standalone.ts` — `startLoop` opts, delete do loop `registerDict`, delete do VLibras,
  delete do piper, delete do `baixarPesados`.
- `app/js/ui/tile-grid.ts` — delete do `keydown`, API imperativa `move`/`activate`, delete de
  FALLBACK/`actionOf`.
- `app/js/ui/hud.ts` — delete do size select, shuffle, hint, reduced-motion, `onEmpathy`.
- `app/js/declaration/puzzle-declaration.ts` — adicionar `keyboardMapping(players, seat)`.
- `app/js/i18n/{pt,en,es}.ts` — chaves novas (`accom.*`, `preset.*`, `hud.moves`, `hud.progress`,
  `howto.slide1..3`, `game-options.*`).
- `app/css/style.css` — delete dos gradientes `#lv-overlay`, da `.empathy-panel`, das linhas de
  contraste/visão/motion que acompanham controles que já não existem.
- `app/index.html` — adiciona `<link>` para `/vendor/fonts.css` da engine; remove `<link>` local da
  Press Start 2P.
- `vite.config.ts` — reescrito em cima de `defineGameBuild`.
- `package.json` — delete do `piper-tts-web`; scripts `build:cartridge` e `heavy:delivery`; `exports`
  para `default` do cartucho; `uses.neuralVoice` força `inclusionist-heavy` no build.
- `scripts/check-cartridge.mjs` — mantido; `build:cartridge` chama `inclusionist-check-cartridge`
  antes.
- `README.md` + `docs/LICENSES.md` — delete do piper; versão 11.0.0.
- `tests/docs.node.test.ts` — version string vai a 11.0.0 (o gate acompanha sozinho).
- `tests/cartridge.browser.test.ts`, `tests/cartridge-rules.node.test.ts`,
  `tests/render.node.test.ts`, `tests/libras.node.test.ts` — adaptações do rename e da fronteira
  nova; o `libras.node` passa a asseverar «não monta VLibras».

### Verificação

- `npm run validate` → 0, os dois alvos de build, `inclusionist-check-cartridge` 0, nosso
  `check-cartridge.mjs` 0.
- Protocolo de boot externo (Playwright):
  - `engine.problems: []`
  - cartão de pausa abre por `KeyF` e pelo ☰ da barra; `systemPress('select')` abre
  - 🚥 e 🌗 continuam a montar; 🧩 continua a reduzir movimento
  - **Enter num tile ativa SEM abrir o cartão** (prova do `keyboardMapping`)
  - `onCommand({action:'up'})` move o cursor; `action1` ativa; `action4` embaralha; `action3` pede dica
- `scripts/axe-check.mjs` em 0 nos sete estados.
- Peso: `dist-lib/cartridge.js` ≤ 60 kB; `dist/` sem `ort-wasm` nem `piper`; `dist/heavy/` com Kokoro
  e Press Start 2P (bytes conferem contra o SHA256 do `font-library.json`).

### O que NÃO entra, dito explícito

- **Multiplayer** (ADR-0235: proibido por ora). Nada toca `players` acima de 1.
- **Tauri / APK shell** (ADR-0246). O jogo continua a ser cartucho; o shell é trabalho da plataforma.
- **Libras pela engine** (`host.interpreter`). VLibras sai; se a engine ganhar um porto de
  intérprete, religar fica para quando houver.
- **`padMapping`** — este jogo nunca teve pad; esperar sinal.
- **Adoção do painel `empatia` em `app/css/style.css`** além do que a engine já estiliza — a folha
  da engine entra por `@import` como já está, e a identidade do painel passa a ser dela.

---

## 🔵 engine 9.0.0 — 9a a 9e FEITOS (`172dbfd`, `b1e5088`). Duas coisas ficaram em aberto:

1. ~~As simulações de empatia sumiram.~~ **RESOLVIDO (`a8cc6d2`)** — e a minha leitura estava errada:
   você corrigiu que **as crianças usam**, como conteúdo de sala de aula. Painel novo
   (`ui/empathy-panel.ts`) com os nove modos, marcação nossa e tudo o resto da engine (classes,
   catálogo, dicionário). Achou dois defeitos anteriores: os modos de baixa visão precisam de uma
   **sobreposição** que este jogo nunca desenhou (`lv-tunnel` era só um desfoque, `lv-macular` era
   nada), e o gradiente que a conserta foi descartado em silêncio por CSS inválido.
2. **O cartão de pausa não tem tecla que o abra neste jogo.** Medido: sete teclas premidas a sério,
   nenhuma abre — o `_pause` da engine é o START do gamepad. O `engine.pausa.mostrar(0)` existe, então
   ligar uma tecla é pequeno. **Decisão sua: qual tecla**, e eu não invento uma — o tabuleiro já usa
   setas e Enter.

📏 E uma medição que desarma o susto: a barra **continua alcançável por Tab durante a partida**
(`tabIndex 0`). O `tabIndex = -1` do ADR-0044 item 7 está no `buildQuickBar`, que este jogo não usa —
a barra dele vem por `a11yBarHost`. Então tirar os controles do painel não deixou ninguém sem
contraste.

---

## 🔵 O estudo da 9.0.0 (2026-09-11)

A 9.0.0 saiu **depois** da conversão para cartucho e é, quase linha por linha, a construção do que eu
estava a citar como *"aceito e não construído"*. Cinco adaptações saem daqui, e a segunda é uma
correção a mim.

### 9a. Subir para a 9.0.0 — `^9.0.0` no par, `9.0.0` exato no dev

Mecânico. O gate `tests/docs.node.test.ts` obriga o README e o `docs/LICENSES.md` a acompanharem, que
é precisamente para que não fique um `8.0.0` em prosa como ficou o `7.0.1`.

⚠️ **Uma quebra, e não nos alcança:** em `ui/pause-icons`, `seguraTeclas` deixou de ser `boolean` e
passou a `() => boolean` — mesmo argumento do ADR-0084, uma resposta lida uma vez que envelhece em
silêncio. Só atinge quem monta os ícones de pausa por fora; este jogo não monta. Verificar, não
presumir.

### 9b. `declines` muda de lado — e é uma errata que me corrige

🔴 **Eu respondi esta pergunta sozinho e respondi ao contrário.** O contrato do cartucho listava
*"whether `declines` is host-owned or game-owned"* como aberta; eu pus `declines` no shell. A 9.0.0
exporta o tipo `MetadeDoJogo` com a resposta, e a errata que o acompanha diz o porquê: a lista
original do ADR-0139 §1 contou **quinze campos e deixou cinco de fora** — `declines`,
`getPauseActs`, `setPauseActor`, `setTemaDoJogador` e `setCorrecaoDoJogador`. O teste que o próprio
registro dá — *"uma PÁGINA conseguiria responder isto sem saber que jogo corre?"* — põe os cinco do
lado do jogo.

Conserto: `declines` sai do `standalone.ts` e entra em `cartridge.hooks`, e os `hooks` passam a ser
tipados por `GanchosDoCartucho` da engine em vez da minha interface local de dois campos.

### 9c. `mount()` / `unmount()` — e isto apaga o defeito que eu acabei de reportar

O ADR-0142 foi construído. `engine.mount(declaration, ganchos)` refaz as leituras ansiosas; o
`unmount()` põe os mapeamentos a `null`, retira o aviso de alcance e esvazia a pilha de cenas **com
`pop()`**, disparando cada `exit()` — que é exatamente a ordem que eu tive de descobrir à mão.

📏 **E resolve a regressão medida nesta sessão:** `engine.problems` passou a conter *"mundo declarado
não encontrado: #world"*, porque `createGame` resolve o seletor no arranque e o `#world` passou a ser
criado pelo cartucho depois. Com `mount` chamado **após** `create(ctx)`, a verificação corre com o
`#world` já no documento e a linha desaparece — sem desfazer nada da conversão. O `KNOWN` que eu pus
no shell deixa de ser necessário e deve sair, não ficar a tolerar um problema que já não existe.

O `teardown()` do cartucho deixa de esvaziar a pilha à mão: quem chama `unmount()` é o shell, porque
a engine é dele.

### 9d. 🌗 e 🚥 tornam-se montáveis — e há uma decisão sua aqui

Os campos `setTemaDoJogador` e `setCorrecaoDoJogador` existem agora. Os dois ícones da barra só
montavam para quem entrega quem os escreve, e ninguém entregava porque **não havia porta**.

⚠️ **E a engine cita este repositório pelo nome do sintoma.** A nota dela diz: *"o consumidor externo
que mediu isto leu a ausência como «este jogo tem os seus próprios controles», o que é verdade sobre
o resultado e falso sobre a causa. Uma lacuna que o consumidor lê como escolha é a pior forma de
lacuna."* O comentário que escrevi no `standalone.ts` diz exatamente isso: *"a engine só monta ícone
que tenha quem o acione, e este jogo passa nenhum escritor"*. Eu li a lacuna como escolha.

**A decisão é sua e não faço sem resposta:** ligar os dois escritores faz a barra ganhar contraste e
visão — e passa a haver **dois controles para a mesma coisa**, porque o painel deste jogo já os tem.
As saídas são (i) ligar os escritores e tirar os dois controles do painel, deixando a barra dona;
(ii) ligar e manter ambos, aceitando a duplicação, com o risco de discordarem como o TEA e a caixa de
movimento já discordam; (iii) não ligar, e escrever no código que é escolha e não lacuna — que é a
única coisa que hoje é falsa.

### 9e. `getPauseActs` — e esta não é preferência, é um defeito de acessibilidade a correr

🔴 **Hoje, neste jogo, o direcional não consegue conduzir a barra de acessibilidade.** A engine diz
porquê: `entrarNaBarra` chama `acts.resume?.()` para sair do cartão de pausa antes de entregar as
direções à barra; com a tabela vazia esse `resume` é `undefined`, o cartão fica por cima do jogo, e o
item 7 do ADR-0044 era **inalcançável a partir de qualquer jogo montado por `createGame`**.

Passar `getPauseActs` com pelo menos `resume` fecha isso. Enquanto lá estamos, os itens que este jogo
sabe acionar — embaralhar, dica, mudar de tamanho — deixam de ser botões mortos que o
`refrescarItensDaPausa` esconde.

⚠️ **Verificar antes de acreditar:** isto tem de ser medido no protocolo de arranque, com o
direcional premido a sério, e não deduzido da leitura. O sintoma é silencioso dos dois lados.

---

## ✅ EXECUTADO — 2026-09-11

Passos 0 a 8 feitos e commitados; verificação 1 a 9 corrida e verde. **7 commits por empurrar**
(`d05e6d5` … `34edc4b`), árvore limpa. Nada nesta lista está em aberto.

| Passo | Commit |
|---|---|
| 0 — conserto de movimento reduzido | `d05e6d5` |
| 1–4, 6 — barra, voz neural, descarga filtrada, movimento, rota do axe | `69c497d` |
| 5 — Libras | `15465c9` |
| 7 — documentos + gate de versões | `db9c6f5` |
| 8 — costura página/jogo + gates do cartucho | `d9ca9e1` |
| achado da rede (jsdelivr) | `34edc4b` |

**Verificação, medida e não suposta:** `validate` 0 com 284 testes · `dist/` 28 MB (26,5 MB do WASM
da voz) · hash servido igual ao de `dist/` · `engine.problems: []` · 6 filtros CVD · 7 botões da barra
a 44 px, fora de `#world`, primeiro Tab antes do jogo começar · sob `blind` o tabuleiro tem 1
ancestral filtrado e a barra e o painel têm 0 · teclado 0→1→5→4→0 · TEA silencia o deslize com a caixa
do painel intocada **e a segunda prensa continua a registar** (1→2→3) · fora da origem só as vozes e o
VLibras, nenhum `visao:*`, nenhum `webgazer` · axe 0 violações em 7 estados · os 8 gates novos nascidos
vermelhos por mutação e restaurados.

**Um achado que não estava no plano:** `cdn.jsdelivr.net` deixou de ser só um CDN pesado — o plugin do
gov.br espelha-se lá (`spbgovbr-vlibras/vlibras-portal@v7.12.2`), então ele passou a ser carga para o
bloqueio do VLibras no axe. Registado no ficheiro para que ninguém o apare.

## Contexto

O jogo estava fixado na engine 7.0.1. A 8.0.0 saiu e muda o contrato de três formas, e a subida
revelou coisas que não eram da subida:

1. **Dois campos novos obrigatórios** no `GameDeclaration` — `holdsAtOnce()` e `seguraTeclas()` — e a
   obrigatoriedade é a decisão registrada: *"não declarar é ter a acessibilidade programada no
   controle pro sorte"*. O `conformanceProblems` da própria engine recusa a declaração sem eles.
2. **A pausa deixou de ser declinável** (ADR-0120). `semMenuDePausa` saiu do `Declinios`.
3. **`engine.problems` deixou de estar vazio.** A engine aponta um defeito verdadeiro deste jogo: não
   há barra de acessibilidade na primeira tela. Das seis do catálogo, cinco estavam assim.
4. **A 8.0.0 baixa ~241 MB** de coisas pesadas no primeiro carregamento, por padrão.

Duas decisões já tomadas por você: **adotar a barra da engine** e **narração neural completa**.

### E o material de 2026-09-11, que é a razão desta revisão

Cinco registros aceitos hoje mudam o que este repositório é: **ADR-0139** (um cartucho fornece metade
de `CreateGameOptions` e nunca chama `createGame`), **ADR-0140** (PWA autónomo *e* cartucho, de uma
fonte só), **ADR-0141** (um cartucho é dono da sua corrente aleatória), **ADR-0142** (a engine monta e
desmonta um cartucho) e **ADR-0117** (o PWA é o *site*, e a plataforma carrega as vozes uma vez para
todos os cartuchos). O `cartridge-brief.md` e o `cartridge-contract.md` do site são a leitura longa.

---

## O que este material muda para ESTE repositório — medido, não suposto

### 1. A ordem de trabalho não é nossa, e ela diz para esperar

ADR-0068 §6 exige que **um** jogo vá de ponta a ponta antes dos outros começarem, e o brief nomeia
qual: **whackwhack** — menor build dos seis (344 KB), já na engine 8, CI e 24 ficheiros de teste. E
fecha a frase sem margem: *"If you are not whackwhack, wait for the contract to come back with its
holes filled."*

O contrato tem quatro buracos declarados: a forma exata de `GameCtx`, se `declines` é do host ou do
jogo, a política de semente, e a API de `mount` (que o ADR-0142 decidiu **existir** mas que ninguém
construiu). Converter contra buracos é retrabalho garantido.

⚠️ **Então a conversão para cartucho NÃO é trabalho deste plano.** O que este plano passa a fazer é
terminar a subida à v8 **sem criar trabalho que a conversão terá de desfazer** — e isso muda dois
passos que já estavam escritos.

### 2. Três regras do material já estão cumpridas aqui, e uma delas por escrito antes do registro

📏 Medido hoje, neste repositório:

| Regra | Estado |
|---|---|
| **ADR-0141** — um cartucho não importa `rnd`, `randInt`, `shuffle` nem `reseed` de `core/rng` | ✅ **Zero ocorrências.** `app/js/puzzle/rng.ts` é uma fábrica própria, e o cabeçalho dele dá o mesmo argumento do registro: *"é `let _seed` em escopo de módulo, e é COMPARTILHADO"* |
| **D14** — nenhum `let` em escopo de módulo | ✅ A única ligação de topo em `main.ts:67` é `const key`, uma função pura. Todo o estado vive dentro de `boot()` |
| **ADR-0139 §4** — o `ctx` traz `region`, e o jogo não escreve fora dele | ✅ Tudo que `boot()` cria aterra em `#world` ou `#side`, ambos dentro de `#game-region` |

O que **não** está cumprido é um só: `main.ts:83` lê `location.search` diretamente, e o `boot()` roda
na última linha do módulo.

### 3. A voz neural é metade do HOST — e é isso que responde a sua pergunta sobre o PWA da engine

Você perguntou se era possível pegar as vozes do PWA da engine em vez de carregá-las aqui. **A
resposta do ADR-0117 é não, e a razão é a mesma que torna a plataforma a resposta certa:** Cache
Storage é particionado **por origem**, e o cache HTTP é particionado por site de topo. Não há cache a
partilhar entre dois PWAs. A partilha só existe quando é *a mesma origem* — que é exatamente o que a
plataforma é.

📏 **E o preço disto está no disco agora.** Medido no `dist/` construído:

| | em disco | comprimido (o que atravessa a rede) |
|---|---|---|
| `dist/assets/ort-wasm-simd-threaded.jsep.wasm` | **27.797 kB** | **6.651 kB** |
| `ort.bundle.min.js` + `piper` + `voices_static` | 604 kB | 164 kB |
| o jogo inteiro (`index.*.js` + CSS + fonte) | 636 kB | 195 kB |
| **total** | **~28 MB** | **~7 MB** |

⚠️ **Os dois números, e nunca só um.** 28 MB é o que ocupa o disco de quem constrói; ~7 MB é o que
uma escola descarrega. Citar o primeiro contra um teto de entrega exagera por quatro; citar o segundo
a esconder o primeiro engana quem mede um cartão SD. O teto do ADR-0058 é do artefacto que a criança
instala, e nenhum destes é esse — este é o build autónomo.

⚠️ **Correção a um número que este plano carregava:** ele prometia *"hoje 668 KB; com a folha da
engine, ~730 KB"*. Isso era verdade antes da decisão da voz neural e é falso desde então, por um fator
de quarenta. O comentário do `package.json` já dizia o custo — *"27 MB de WASM no build"* — a dizer
por que o jogo declinava; a decisão inverteu-se e o número não.

**E o número está certo assim**, o que é o ponto:

- No build **app** (autónomo), o ADR-0140 §3 é explícito — o artefacto autónomo é rota de
  desenvolvimento, auditoria e demonstração, **nunca rota de entrega a uma criança**. O teto de 30 MB
  do ADR-0058 é do artefacto que a criança instala, e este não é. O próprio ADR-0140 antecipa o
  engano: *"é também uma armadilha para quem medir o artefacto errado contra o pilar 1"*.
- No build **lib** (cartucho), `carregarVozNeural` é do **host** pela divisão do ADR-0139 §1, então o
  import desaparece e os 26,5 MB vão para a plataforma, **uma vez**. O gate do ADR-0117 diz isso como
  ausência: *"um cartucho não declara entrega — nenhum ficheiro de fonte, nenhuma voz, nenhum runtime
  no `package` ou no `dist` de um jogo"*.

📌 **Consequência prática, e é o que muda o passo 2:** a ligação da voz é metade do *shell*, não do
jogo. Escrevê-la hoje no sítio onde o `standalone.ts` vai nascer custa o mesmo e não se desfaz.

### 4. `engine.problems` vazio continua a ser o marco — mas só em modo autónomo

O ADR-0139 §5 mediu nove leituras ansiosas em `create-game.js` e concluiu, em maiúsculas, que
`engine.problems` e `engine.alcance` **não são de confiança em modo plataforma**: descrevem o cartucho
que estava montado no boot. O ADR-0142 escolheu pagar essa dívida com `mount()`/`unmount()`, e ainda
não foi construído.

Nada disto invalida a nossa verificação — ela corre em modo autónomo, onde há um jogo e um boot, e aí
`problems` diz a verdade. O que muda é que o plano tem de **dizer que modo está a medir**, senão o
gate herda uma promessa que só vale de um lado.

### 5. Uma aresta aberta que este jogo é o primeiro a ter

Este é o primeiro jogo do ecossistema com a oferta de fonte do §13 da AGPL na interface, e ela aponta
para o repositório *deste* jogo. Dentro de uma plataforma que serve seis jogos de licenças diferentes
na mesma origem, quem oferece o quê é uma pergunta de licenciamento, não de código. **Não é decisão
deste plano** — fica registada aqui para ir à conversa certa.

---

## Estado atual — trabalho em disco, não commitado

Feito e verde: pino em `8.0.0`, `holdsAtOnce() → 1`, `seguraTeclas() → false`, `semMenuDePausa`
removido, a barra de acessibilidade montada, a folha da engine importada, as vozes filtradas.

🔴 **E uma coisa vermelha, que é o passo 0:** a verificação de boot da v8 apanhou um defeito anterior
à subida — sob movimento reduzido, `slide.begin()` punha `t = 1` mas deixava `push` cheio, e `advance`
saía pelo guarda sem limpar. `active()` ficava verdadeiro para sempre e o composition root recusava
todo o input seguinte: **uma criança com movimento reduzido fazia exatamente uma jogada e o tabuleiro
morria**. O conserto está aplicado e os testes novos passam; um teste antigo ainda crava a forma velha
e faz `npm run validate` sair 1.

---

## Passos

### 0. Terminar o conserto de movimento reduzido

`tests/render.node.test.ts:218` exige `travelling()` a devolver uma peça parada com deslocamento zero
— era a forma do defeito. Sob movimento reduzido não há viagem nenhuma e `[]` é a resposta verdadeira.
Atualizar mantendo a propriedade que o teste guardava (que o interruptor é lido a cada `begin`), com
um comentário a registar que a expectativa anterior codificava o defeito. `npm run validate` → 0,
**pelo código de saída**.

### 1. Commitar a adaptação de contrato

Sete ficheiros modificados, um por commitar. Anunciados antes: `package.json`, `package-lock.json`,
`app/index.html`, `app/css/style.css`, `app/js/boot/main.ts`, `app/js/render/slide.ts`,
`scripts/axe-check.mjs`, `tests/render.node.test.ts`. O `boot-check.tmp.mjs` é descartável e não entra.

### 2. Narração neural — e **onde** ela é ligada passa a importar

`@mintplex-labs/piper-tts-web` volta como dependência; `carregarVozNeural: () => import(...)` entra em
`createGame`; `declines.semVozNeural` sai. A descarga é pedida à parte e **filtrada**:

```ts
import { PESADOS, baixarPesados } from '@the-inclusionist/engine/platform/pesados.js';
createGame({ …, baixarPesados: false, carregarVozNeural: () => import('@mintplex-labs/piper-tts-web') })
void baixarPesados({ apenas: PESADOS.filter((p) => p.id.startsWith('voz:')).map((p) => p.id) });
```

A lista sai **derivada do catálogo**, nunca escrita à mão. Sem o filtro, este jogo baixaria também
`visao:*` — 34,1 MB de MediaPipe mais o `webgazer`, que a medição do 2048 diz falhar por CORS a cada
carregamento.

⚠️ **NOVO, e é o passo 3 do material aplicado:** `carregarVozNeural`, `baixarPesados` e
`aoProgredirPesados` são os três **do host** pela divisão do ADR-0139 §1. Ficam agrupados num único
bloco de `main.ts`, comentado como *the host's half*, contíguo e sem nada do jogo pelo meio — para que
a extração para `src/standalone.ts` seja um recorte e não uma arqueologia. Custa uma reordenação de
linhas hoje e poupa a conversão inteira depois.

### 3. A barra de acessibilidade

**A folha da engine entra por `@import`, não por `import` de JS** — precedente do `game-chess`, e a
razão é cascata: duas folhas que escrevem `:root` e `.sr-only` desempatam por **ordem**, e a ordem de
uma folha injetada por JS contra um `<link>` no `<head>` é propriedade do empacotador.

| Reclamação | Porquê |
|---|---|
| `html { background: #05070f; }` | A folha estiliza `html,body`; o jogo só estiliza `body`, então sobre-rolagem pisca azul de outro jogo |
| `.hud { flex-wrap: nowrap; max-width: none; }` | ⚠️ A quebra real. A engine declara `flex-wrap:wrap`; numa coluna de altura definida isso parte o painel em **duas colunas** |
| `.title-press { letter-spacing: normal; word-spacing: normal; }` | A engine põe `.12em` em `html,body` e o atalho `font:` não reseta letter-spacing. A Press Start 2P é medida em caracteres: 20 viram 22,4 e o crédito sai da tela |

⚠️ **Não pôr `class="game-region"` na região** — a engine estiliza `.game-region` com
`overflow:hidden`. A barra mora num id **próprio**, nunca `#title-icons` (a folha posiciona esse
`absolute; top:10px; left:50%`, e o 2048 mediu o estrago). **E fora de `#world`**, pela mesma razão que
o painel: a barra é o instrumento de **sair** de uma simulação, e um filtro de ancestral não se desfaz
num descendente.

**Sete botões montam**: 🦯 cego, 🗨️ TTS, 🤟 Libras, 🧩 TEA e três `soon`. 🌗 contraste, 🚥 visão e
☝️ alternância **não montam** — a engine só monta ícone que tenha quem o acione. **Modo cego não
precisa de nada**: desde a v8 o `isBlindMode` tem por padrão `() => state.modoCego`.

📌 **E isto também é metade do host.** A marcação `#side` / `#a11y-bar` vive em `app/index.html`, que é
o shell autónomo; em modo plataforma a marcação é da plataforma e o `host.a11yBarHost` aponta para a
dela. O trabalho não se perde — muda de lado da fronteira, que é onde já está.

### 4. Movimento reduzido — as duas chaves que não podem discordar

O 🧩 escreve a chave da engine; o HUD deste jogo escreve `incl.15puzzle.motion`; a engine não expõe
evento nem getter geral. Solução: **o OR das duas**, lido no início de cada deslize.

```ts
import { lerCenaGuardada } from '@the-inclusionist/engine/ui/motion-scene.js';
const motionReduced = (): boolean => reducedMotion || lerCenaGuardada().items === true;
```

Ligar TEA reduz o movimento; a caixa do HUD reduz o movimento. O que não se pode fazer é **re**ligar o
movimento pela caixa enquanto o TEA pede calma — e essa assimetria é a certa.

### 5. Libras — decisão separável

O 🤟 liga honestamente o *modo*; falta o tradutor. Dois irmãos (`soccer`, `platformer`) montam o
widget: marcação `[vw]`, o script do `vlibras.gov.br` e `setVlibrasSay(vlibrasSay)`.

**Custo declarado:** é a única coisa de origem externa e obrigatoriamente online da página, e torna
**falsa** a frase do `scripts/axe-check.mjs` — *"NO EXCLUSIONS, AND THAT IS DELIBERATE"*. Recomendo
montar. ⚠️ **E ele é do host também** — é infraestrutura de página, não regra de jogo — portanto entra
no mesmo bloco do passo 2. **Este passo pode cair sem afetar os outros.**

### 6. O que a CI não pode disparar

Os cinco testes de navegador montam módulos direto e nunca chamam `createGame`; só o
`scripts/axe-check.mjs` carrega a página real, três vezes. Uma linha de `page.route()` abortando os
hosts pesados resolve, e mantém o caminho de produção sendo o que embarca.

### 7. Documentos

`README.md` (a seção que diz que este jogo declina a voz neural passa a dizer o contrário, e por quê,
**com o número de 26,5 MB e a distinção build-app / build-lib do ADR-0140 §3**), `docs/LICENSES.md`
(o `piper-tts-web` volta à tabela; a folha da engine entra) e `package.json` — onde o
`comment:dependencies` **não é editado, é substituído**: o texto atual argumenta a decisão contrária e
cita ADR-0094 e ADR-0058 a favor dela.

### 8. Preparação para o cartucho — três coisas que não se desfazem

⚠️ **Isto não é a conversão.** É o subconjunto do material que já está decidido, é verificável em modo
autónomo e que a conversão vai consumir em vez de refazer. Nada aqui depende dos quatro buracos
abertos do contrato.

**8a. `params` deixa de ser lido do endereço** (ADR-0139 §4). Hoje `main.ts:83` faz
`new URLSearchParams(location.search)`. Na plataforma há **um** endereço para todos os cartuchos, então
um jogo que lê `location.search` lê os parâmetros de outro — e este lê `?seed=` e `?debug=`, que é
precisamente o exemplo que o contrato usa. `boot()` passa a receber os params de quem o chama, e a
última linha do módulo passa-lhe `new URLSearchParams(location.search)`. Uma linha muda de sítio.

**8b. Um gate para o que já é verdade.** Duas asserções baratas, ambas já satisfeitas, escritas para
que uma regressão seja ruidosa: nenhuma importação de `rnd`/`randInt`/`shuffle`/`reseed` a partir de
`@the-inclusionist/engine/core/rng.js` em `app/**` (ADR-0141 §3 — *"o lint é carga, não decoração"*,
porque um build autónomo passa nos dois casos), e nenhum `let`/`var` em escopo de módulo sob
`app/js/**` (D14). ⚠️ **Ambos escritos com o caminho literal**, não por junção — renomear repositório
já cegou 36 gates aqui uma vez, sem falhar nenhum.

**8c. O `boot()` recebe o seu host.** Os cinco `getElementById` de `main.ts:70-80` passam a chegar como
argumento. É o que torna a extração de `src/standalone.ts` um recorte de trinta linhas — e é também o
que permite o gate do ADR-0139, *"um cartucho importado e nunca instanciado não faz nada observável"*,
no dia em que a última linha do módulo sair.

**E o que NÃO se faz agora, com a razão:**

| Adiado | Porquê |
|---|---|
| build `lib`, `external`, `build.lib` | O consumidor não existe; o gate do ADR-0140 é *"a CI constrói AMBOS"*, e um alvo que ninguém instala apodrece verde |
| `peerDependencies` + `devDependencies` | Só rende quando há uma plataforma a instalar; hoje só duplicaria a declaração |
| `exports`, `files`, `private: false`, publicar | Publicar um cartucho antes do contrato fechar é publicar uma forma que vai mudar |
| `vite-plugin-pwa` no build app | Trabalho real e independente; não é pré-requisito de nada aqui |
| exportar os dicionários de i18n | Espera a decisão de quem os regista |
| `create(ctx)` / `teardown()` | **É a conversão.** ADR-0068 §6: depois do whackwhack |

---

## Verificação

Pelo **código de saída**, nunca pelo resumo do cano — `N passed` convive com erro não tratado.

1. `npm run validate` → 0.
2. `npm run build` → 0, e **medir o `dist/` e registar a composição**: hoje 28 MB, dos quais 26,5 MB
   são `ort-wasm-simd-threaded.jsep.wasm`. ⚠️ Registar como o número do **artefacto autónomo**, com a
   frase do ADR-0140 §3 ao lado, para que ninguém o compare com o teto de 30 MB do ADR-0058, que é do
   artefacto que a criança instala.
3. Servir `dist/` e correr o protocolo da casa por fora, com Playwright — **e a verificação declara
   que mede o modo AUTÓNOMO**: hash do `<script src>` igual ao do `dist/`, exatamente 1 canvas,
   **`engine.problems` vazio** (o marco deste plano, e verdadeiro aqui porque há um jogo e um boot —
   ADR-0139 §5 diz que em modo plataforma este campo descreve outro cartucho), 6 filtros CVD,
   `holdsAtOnce` 1, `seguraTeclas` false, topologia `{grid,[4,4],orthogonal,compass}`, mundo `#world`.
4. **Teclado, pressionado a sério** e não por evento sintético: setas movem o cursor, Enter desliza. O
   sintoma de teclado roubado é *uma tecla só a funcionar*.
5. **A barra**: sete botões, alvo ≥ 44 px CSS no piso k=2, alcançável por Tab **antes** de começar o
   jogo, e **nenhum ancestral filtrado** sob `blind` — enquanto o tabuleiro tem um.
6. **Rede**: listar cada pedido fora da origem. Deve haver os `voz:*` e **nenhum `visao:*`**, nenhum
   `webgazer`.
7. **Movimento**: ligar 🧩 e confirmar que o deslize deixa de animar mesmo com a caixa do HUD
   desmarcada — **e que uma segunda jogada ainda acontece**, que é o defeito do passo 0.
8. `AXE_URL=… node scripts/axe-check.mjs` → 0 violações na tela de título e nos seis estados do
   tabuleiro, com a folha da engine no lugar.
9. **Os dois gates novos do passo 8b** nascem vermelhos antes de passarem: mutar um import de
   `core/rng` e um `let` de topo, confirmar a falha, reverter. Todo gate nasce vermelho.
