# Licences, ownership and third-party terms

## The code

**AGPL-3.0-or-later.** `LICENSE` at the repository root is the verbatim FSF text; `package.json`'s
`license` field carries the same string. Two places, one string, mechanically comparable — which is
the confirmation ADR-0064 asks for.

Every source file carries `// SPDX-License-Identifier: AGPL-3.0-or-later` on line 1 and **no
copyright line**. That absence is deliberate and it matches the engine's 135 files and the chess
repository's 30: it avoids asserting in code something the executive branch has not yet granted.

## Ownership

⚠️ **Economic ownership belongs to the MUNICÍPIO, not to the developer.** Software produced in the
exercise of one's duties belongs to the employer (Lei nº 9.609/1998, art. 4º). That is why
publication under AGPL is a *pedido* addressed to the Poder Executivo — item 39, alínea `e` of the
requerimento — and not a decision of whoever wrote the code.

This mirrors the engine's own `docs/LICENSES.md`. Nothing here changes that arrangement; this
repository is a consumer of the engine and inherits its position.

### Authorship is a different right, and the title screen states it

⚠️ **A credit is not a copyright notice, and the two laws are not the same law.** Lei nº 9.609/1998
art. 4º moves the **patrimonial** right to the employer — that is the sentence above, and it is why
`LICENSE` names no holder and why `agpl-source-offer.node.test.ts` pins the absence of one in every
source file. Lei nº 9.610/1998 art. 24, II is a different right entirely: the **moral** right of the
author to have their name shown on the work, which is inalienable and irrenunciable, and therefore
not the employer's to take or to grant.

So the title screen reads **"por prof. José Rocha"**, and nothing about that reopens the ownership
question. The Município owns the software; the authorship is stated. Recorded here because a reader
who finds the credit and the missing copyright line in the same repository would otherwise be right
to think one of them is a mistake.

⚠️ **And this is where the claim is stated, not in the package name.** The scope
`@the-inclusionist` names the CONTAINER (ADR-0071). A scope carrying the Prefeitura's name,
published by a public servant *before the ato*, would be a public claim on someone else's name.

## AGPL section 13 — the source offer, and what it can and cannot do today

Section 13 is the whole reason this project is AGPL rather than GPL: running a service is not
distributing, so under GPL a supplier could take this code, improve it, host it for schools, and owe
the improvement to nobody. Section 13 closes that, and it is the argument the requerimento makes to
the Município in alínea `e`.

**The obligation it creates is implemented here.** The interface carries a "Source code" item
pointing at this repository, and `tests/agpl-source-offer.node.test.ts` fails if that link is
removed or silently changed. This repository is the first in the ecosystem to carry it — neither the
engine nor `game-chess` does today (a grep for `github.com` or `gitlab.com` across either
`app/` returns nothing).

⚠️ **The link resolves to a private repository until the *ato*.** That is a limit of the process,
not of the implementation: the offer is in place and becomes effective the day the Município
authorises publication (ADR-0066 §3). It is recorded here rather than left as a promise nobody wrote
down.

This is not in tension with ADR-0037's prohibition. What that record bars is a *configurable room
address* — an environment variable, a settings field, a build flag, an endpoint reached at runtime.
A static source link is none of those, and nothing in this game fetches anything off-origin; the
verification protocol greps the built `dist/` to prove it.

## The typeface on the title screen

Press Start 2P is a pixel face, which is the opposite of what the engine's typography roster
(ADR-0012) exists for: that roster is there so a child can choose a face she reads well and resize
it. So the pixel face is scoped to the **title screen only** — a name, seen once, which is a logo —
and never reaches the board's digits, where it would override the face she chose for herself.
`title-screen.browser.test.ts` pins that scope.

It is **self-hosted, never fetched from a font CDN**. Two reasons, and either would be enough:
pillar 8 is offline-first, and a school browser asking Google for a font is a request leaving the
device on behalf of a child, in a project whose whole compliance position is that nothing about her
does.

⚠️ It lives in `app/public/fonts/` rather than beside the stylesheet, and that is a licence decision.
OFL 1.1 requires the notice to be distributed **with** the font; a `.txt` beside a bundled `.woff2`
is referenced by nothing, so the bundler would copy the font into `assets/` under a content hash and
leave the licence behind. `public/` is copied verbatim, so the two arrive together.

## The art

There are no image assets. Every pixel this game draws is procedural: rectangles and lines issued
through the engine's `render/port.ts`, which has no text primitive at all — so ADR-0027's
`text-in-framebuffer: 0 glyphs` holds structurally here rather than by discipline. The tile numbers
are DOM text, in the reader's own font, at the reader's own size.

Consequently the dual regime the engine documents (code AGPL, art under Lei nº 9.610 and NOT FOSS)
has no art side in this repository. If an image asset is ever added, it arrives with its own licence
statement and does **not** inherit the AGPL.

## Third-party

| Component | Licence | Note |
|---|---|---|
| `@the-inclusionist/engine` | AGPL-3.0-or-later | Same owner. From public npmjs, pinned exact at **8.0.0** (ADR-0072); this repository is its second external consumer after `game-chess`. Its stylesheet is pulled in by `@import` at the top of `app/css/style.css` and ships inside this build. |
| `@mintplex-labs/piper-tts-web` 1.0.4 | **MIT** | The neural voice provider, named here because the engine takes it as a port and cannot name it itself (ADR-0094). |
| `onnxruntime-web` | **MIT** | Not declared by this repository and not optional: it is a hard peer of the provider above, and it is what the 27,797 kB `ort-wasm-simd-threaded.jsep.wasm` in `dist/` is. |
| PixiJS 7.4.2 | MIT | Pinned to the engine's **exact** version — a second PixiJS in one page is a bug, not a fallback. |
| Vite, Vitest, Playwright, TypeScript | MIT / Apache-2.0 | Development only; none ships. |
| **Press Start 2P** by CodeMan38 | **SIL OFL 1.1** | The title screen's typeface, and only the title screen's — see below. Vendored at `app/public/fonts/`, with `press-start-2p.OFL.txt` beside it. |
| **VLibras** (`vlibras.gov.br`) | *not asserted — see below* | The Libras interpreter. **Loaded from the government's address at runtime and never vendored**, so this repository redistributes none of it and takes no position on its terms. It is the only third-party, network-required component on the page. |

⚠️ **THE VOICE SECTION HERE USED TO SAY THE OPPOSITE**, and it is replaced rather than edited,
because it argued a case: *"No neural voice ships with this game… this game declines: narration is
Web Speech."* That was true until the decision changed. The reasoning that overturned it is in the
README — the voices are narration for a child who cannot read, not game content, so measuring them
against how much this game says was measuring the wrong thing.

⚠️ **And the paragraph it replaced sat INSIDE the table**, between two rows, which silently ended the
table at that point: everything from PixiJS down rendered as plain text in any Markdown viewer. Both
are fixed here.

**What ships and what does not**, because the distinction is about to matter: `piper-tts-web` and the
ONNX runtime are in **this** build, which ADR-0140 defines as a development, audit and demonstration
artifact and never a delivery route to a child. In cartridge form `carregarVozNeural` is the host's
half of `CreateGameOptions` (ADR-0139), so neither appears in the published module and the platform
carries them once for every cartridge (ADR-0117). The same line divides VLibras: the markup and the
script tag live in `app/index.html`, which is the standalone shell.

### The upstream this game remakes

The 15 Puzzle by **arnisritins** — <https://github.com/arnisritins/15-Puzzle>, MIT. It is the
reference for what the game *is*: a 4×4 tray, click a tile to slide it into the blank, a scramble
built from random legal moves rather than a random permutation.

**No code is taken from it.** That project renders with positioned DOM spans and CSS transitions;
this one draws tile bodies procedurally into a 320×180 PixiJS framebuffer and animates from the
engine's own frame clock. MIT would have permitted copying with attribution; there was simply
nothing to copy across that gap. The credit is owed for the design, and it is given in the README.

Two deliberate divergences from it, both recorded because they are product decisions and not
oversights:

- **Its "solve" button does not exist here.** In its place a hint *reveals* the next three moves and
  never plays them. Requerimento §49.e distinguishes delivering the answer INSTEAD of the reasoning
  from revealing it alongside the attempt; auto-solving is the first, showing the road is the second.
- **The hint is never locked, never counted and never penalised.** There is no wrong move in a
  sliding puzzle — every move is reversible in one keypress and nothing is lost. Gating help behind
  a performance condition would be inventing a punishment in order to justify the gate, which is the
  pattern ADR-0049 is written against.
