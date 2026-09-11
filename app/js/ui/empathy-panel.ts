// SPDX-License-Identifier: AGPL-3.0-or-later
// ui/empathy-panel — the simulations, as something a child can reach and leave.
//
// ========================= WHY THIS FILE EXISTS, AND WHY IT ALMOST DID NOT =========================
// The engine 9.0.0 upgrade moved contrast and colour correction onto the accessibility bar's own icons
// and took this game's vision `<select>` away with them. That select also carried the nine EMPATHY
// modes — three colour-blindness simulations, five low-vision ones, and blindness — and they landed
// nowhere, because the engine's `empatia` panel is something a consumer game builds for itself.
//
// ⚠️ I REPORTED THAT AS A SMALL LOSS AND IT WAS NOT, and the correction is the Dev's: «As crianças
// usam, mas não como adaptação, mas para experimentar no jogo questões de acessibilidade e inclusão
// trabalhados em sala de aula.» They are not a grown-up's demonstration tool. They are game content
// for a child, continuous with a lesson — which makes losing them a removed feature rather than a
// retired convenience, and makes reaching them a requirement rather than a nicety.
//
// ========================= WHOSE LOOK THIS IS =========================
// The Dev's priority is that the project uses the engine's menus, icons and themes, so the catalogue
// keeps one visual identity. The engine publishes no builder for this panel — `settings-visual`'s
// renderer is the platformer's, full of role colours and owner colours this game has no notion of. So
// the MARKUP is ours and everything else is the engine's: the class names its stylesheet already
// styles (`.ctrl-row`, `.mode-btn`), the mode list derived from `VIZ_MODES` rather than typed out,
// and every label and description read from the engine's own dictionary keys.
//
// ⚠️ RADIO ROWS, NOT A SELECT, and the engine wrote down why after getting it wrong once: «no menu de
// empatia as três correções eram LINHAS VISÍVEIS, com descrição; dentro de um `<select>` viraram uma
// linha fechada dentro de uma caixa fechada. Para um controle cuja razão de existir é ser ACHADO por
// quem enxerga mal, esconder atrás de um clique é quase o mesmo que não ter movido.»

import { VIZ_MODES, VIZ_FILTER } from '@the-inclusionist/engine/render/viz-modes.js';
import { simulacaoIndisponivel } from '@the-inclusionist/engine/render/viz-axes.js';
import type { Simulacao, VisualState } from '@the-inclusionist/engine/render/viz-axes.js';
import type { I18n } from '../i18n/index.ts';

/**
 * The nine, derived and never listed.
 *
 * `sim: true` is the catalogue's own answer to «does this pretend to be a disability?». The second
 * half of the test is «can this game deliver it HONESTLY», and it is two clauses because the engine
 * delivers a low-vision mode in two pieces: a CSS filter AND an overlay texture, through a
 * `lvOverlayTex(lv)` the consumer supplies.
 *
 * 🔴 THIS GAME SUPPLIED NO OVERLAY, AND THE OLD MENU OFFERED THE MODES ANYWAY. Measured: `lv-tunnel`
 * arrived as `blur(.5px)` and no tunnel, `lv-diabetic` as `blur(.8px)` and no spots, `lv-macular` as
 * an empty string — nothing at all. A child picking «visão em túnel» would have concluded that
 * tunnel vision is a slight blur.
 *
 * ⚠️ THAT WAS TOLERABLE WHEN THESE WERE A GROWN-UP'S DEMO AND IS NOT NOW. The Dev's correction makes
 * them lesson content: «as crianças usam… para experimentar no jogo questões de acessibilidade e
 * inclusão trabalhados em sala de aula». A half-delivered simulation in a lesson teaches something
 * false, which is worse than a mode that is absent. So the game draws the overlays — see
 * `#lv-overlay` in the stylesheet — and a mode is offered when EITHER piece can carry it.
 */
const MODES = VIZ_MODES.filter((m) => m.sim && (VIZ_FILTER[m.key] || m.lv));

export interface EmpathyPanelDeps {
  readonly doc: Document;
  readonly i18n: I18n;
  /** The child's current visual state — read fresh, because the bar can change it while this is open. */
  readonly visual: () => VisualState;
  readonly onPick: (simulacao: Simulacao) => void;
}

export interface EmpathyPanel {
  readonly root: HTMLElement;
  show(): void;
  hide(): void;
  isOpen(): boolean;
  /** Re-read the state and the language. Cheap; called on open and on every i18n change. */
  refresh(): void;
  destroy(): void;
}

export function createEmpathyPanel(deps: EmpathyPanelDeps): EmpathyPanel {
  const { doc, i18n } = deps;
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string): HTMLElementTagNameMap[K] => {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    return node;
  };

  const root = el('div', 'empathy-panel');
  root.id = 'empathy-panel';
  root.hidden = true;
  // `dialog`-shaped without being a `<dialog>`: this panel lives inside the chrome column and must not
  // become modal, because the accessibility bar beside it is how a child changes her mind.
  root.setAttribute('role', 'group');

  const heading = el('h2');
  heading.id = 'empathy-title';
  root.setAttribute('aria-labelledby', heading.id);

  const intro = el('p', 'empathy-intro');

  // ⚠️ A `<fieldset>` WITH A LEGEND, not a bare list of inputs. Nine radios that share a name are one
  // control to a screen reader only if something says what the group is for, and «what is this asking
  // me?» is the question a child arrives with here.
  const fieldset = el('fieldset', 'empathy-modes');
  const legend = el('legend');
  fieldset.appendChild(legend);

  interface Row {
    readonly mode: string;
    readonly input: HTMLInputElement;
    readonly why: HTMLElement;
    readonly name: HTMLElement;
    readonly desc: HTMLElement;
  }
  const rows: Row[] = [];

  /**
   * ⚠️ «NENHUMA» IS A ROW AND NOT A CLOSE BUTTON, and that is the whole safety of this panel. A child
   * inside `lv-tunnel` sees a keyhole; a child inside `blind` sees nothing at all. Leaving has to be
   * the same shape as arriving, in the same list, in the same place — not a second control she has to
   * find in a state that was designed to make finding things hard.
   */
  const off = buildRow('normal');
  const offInput = off.input;

  for (const mode of MODES) buildRow(mode.key);

  function buildRow(key: string): Row {
    const row = el('label', 'ctrl-row');
    const input = el('input');
    input.type = 'radio';
    input.name = 'empathy-mode';
    input.value = key;
    const text = el('span');
    const name = el('strong');
    const desc = el('span', 'opt-hint');
    const why = el('span', 'empathy-why');
    why.hidden = true;
    text.append(name, desc, why);
    row.append(input, text);
    fieldset.appendChild(row);
    const entry: Row = { mode: key, input, why, name, desc };
    rows.push(entry);
    input.addEventListener('change', () => {
      if (!input.checked) return;
      deps.onPick(key === 'normal' ? null : (key as Simulacao));
      refresh();
    });
    return entry;
  }

  const close = el('button', 'mode-btn');
  close.type = 'button';
  close.addEventListener('click', () => hide());

  root.append(heading, intro, fieldset, close);

  function refresh(): void {
    const v = deps.visual();
    heading.textContent = i18n.t('empathy.title');
    intro.textContent = i18n.t('empathy.intro');
    legend.textContent = i18n.t('empathy.legend');
    close.textContent = i18n.t('empathy.close');

    /**
     * ⚠️ THE REFUSAL IS VISIBLE AND EXPLAINED, WHICH ADR-0076 REQUIRES AND WHICH IS NOT POLITENESS.
     *
     * A simulation cannot run over an adaptation: high contrast or a colour correction already
     * repaints the screen, so a simulation on top of it would teach something false about both. The
     * engine answers WHY and not just no — `'tema'`, `'correcao'` or `'ambos'` — and the reason is a
     * fact about the demonstration, never a reproach to the child: whoever turned on high contrast
     * turned it on because she needs it.
     *
     * Disabled AND told, rather than hidden: a row that vanishes teaches that the thing is not for
     * her, which is exactly the lesson ADR-0106 §5 says a dead control gives.
     */
    const blocked = simulacaoIndisponivel({ ...v, simulacao: 'sim-protan' });
    for (const r of rows) {
      const catalogue = VIZ_MODES.find((m) => m.key === r.mode);
      r.name.textContent = r.mode === 'normal' ? i18n.t('empathy.none') : i18n.t(catalogue?.nome ?? '');
      r.desc.textContent = r.mode === 'normal' ? i18n.t('empathy.noneHint') : i18n.t(catalogue?.desc ?? '');
      const isOff = r.mode === 'normal';
      r.input.checked = isOff ? v.simulacao === null : v.simulacao === r.mode;
      r.input.disabled = !isOff && blocked !== null;
      r.why.hidden = !r.input.disabled;
      if (r.input.disabled) r.why.textContent = i18n.t(`empathy.blocked.${blocked}`);
    }
    offInput.disabled = false;   // never, under any state: leaving is always available
  }

  function show(): void {
    refresh();
    root.hidden = false;
    // Focus the group's current choice, so a keyboard arrives inside the control rather than above it.
    (rows.find((r) => r.input.checked)?.input ?? offInput).focus();
  }

  function hide(): void {
    root.hidden = true;
  }

  refresh();

  return {
    root,
    show,
    hide,
    isOpen: () => !root.hidden,
    refresh,
    destroy: () => root.remove(),
  };
}
