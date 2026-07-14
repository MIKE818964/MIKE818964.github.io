// =============================================================================
// exam_visual.js — READ-ONLY schematic renders for Test Center questions.
//
// A quiz item may carry an optional `visual` object:
//   {
//     lesson:  "m13-stop-button-3wire",          // source-lesson circuit … OR
//     circuit: { nodes:[…], components:[…] },    // …an inline circuit JSON
//     pressed:  ["START"],                       // buttons held in this state
//     prevCoil: ["CR1"],                         // coils latched BEFORE this instant
//     faults:   [{ component:"S2", kind:"stuck_open" }],
//     caption:  "Station as found — idle."       // exam-neutral wording
//   }
// buildExamVisual() resolves the circuit, applies the faults, runs the real
// solver for the described state and renders it through CircuitView — exactly
// the same electrical truth the lessons use. The result is a print, not a lab:
//   • no interaction at all (pointer-events off — no probing, no presses)
//   • photo chips stripped (a real part photo can give an answer away)
//   • test-point labels stay ON (questions reference TP names)
// The SVG scales to the question card: full width, capped height, never
// clipped (preserveAspectRatio "meet" + width:100%/height:auto/aspect-ratio).
// Self-contained: styles injected once, ev- prefixed. No main.js imports.
// =============================================================================

import { CircuitView } from "./renderer.js";
import { solve } from "./solver.js";
import { applyFaults } from "./faults.js";

// module id -> lesson circuit file (mirrors main.js LESSON_CIRCUITS — main.js
// is the app bootstrap and must not be imported for its side effects)
const LESSON_FILE = {
  "m02-circuit-source-load-path": "02_source_path_load",
  "m03-switch-is-a-drawbridge": "03_drawbridge",
  "m04-normally-open-normally-closed": "04_no_vs_nc",
  "m05-dc-supply-24v": "05_supply_24v",
  "m06-single-throw-one-destination": "06_single_throw",
  "m08-what-is-a-pole": "08_what_is_a_pole",
  "m11-momentary-button-problem": "11_momentary_button",
  "m12-seal-in-latch": "12_seal_in",
  "m13-stop-button-3wire": "13_seal_in_latch",
  "m14-swap-bulb-for-motor-starter": "14_motor_starter",
  "m15-poles-for-3phase": "15_poles_3phase",
  "m26-meter-basics-safe-measurement": "26_meter_safety",
};

const circuitCache = new Map();   // lesson file -> circuit json (shared, never mutated)

async function loadLessonCircuit(moduleId) {
  const file = LESSON_FILE[moduleId] || moduleId;   // allow direct file ids too
  if (circuitCache.has(file)) return circuitCache.get(file);
  const r = await fetch(`data/lessons/${file}.json`);
  if (!r.ok) throw new Error(`exam visual: fetch data/lessons/${file}.json -> ${r.status}`);
  const circuit = (await r.json()).circuit;
  circuitCache.set(file, circuit);
  return circuit;
}

// ---------------------------------------------------------------- styles
let stylesDone = false;
function injectStyles() {
  if (stylesDone || document.getElementById("ev-styles")) { stylesDone = true; return; }
  const st = document.createElement("style");
  st.id = "ev-styles";
  st.textContent = `
  .ev-fig { margin: 0 0 18px; }
  .ev-sheet {
    background: #FDFEFF;
    border: 1px solid var(--border, #E6EAF3);
    border-radius: 12px;
    padding: 8px 12px;
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(16,19,38,.04));
  }
  /* a print, not a lab: nothing inside is clickable or hoverable */
  .ev-sheet svg, .ev-sheet svg * { pointer-events: none !important; cursor: default; }
  .ev-svg {
    display: block;
    width: 100%;
    height: auto;
    max-height: clamp(160px, 36vh, 400px);   /* fully visible beside the question at 1600x900 */
    margin: 0 auto;
  }
  /* short shells (980x820 --app window): leave room for the question text
     AND the first two options below the print */
  @media (max-height: 880px) {
    .ev-svg { max-height: clamp(140px, 30vh, 280px); }
  }
  .ev-fig.ev-compact .ev-svg { max-height: 190px; }
  .ev-fig.ev-compact .ev-sheet { padding: 5px 8px; }
  /* last-resort tightening when a long question + print + options barely miss
     the viewport: shave the figure's chrome, never the drawing itself */
  .ev-fig.ev-tight { margin-bottom: 8px; }
  .ev-fig.ev-tight .ev-sheet { padding: 4px 8px; }
  .ev-fig.ev-tight .ev-caption { margin-top: 3px; font-size: 12px; }
  .ev-sheet svg text { font-family: var(--font-mono, "JetBrains Mono", monospace); }
  .ev-caption {
    margin: 7px 2px 0;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--muted, #6B7488);
    font-style: italic;
  }
  .ev-caption::before {
    content: "PRINT";
    font-family: var(--font-mono, monospace);
    font-style: normal;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .12em;
    color: var(--blue-deep, #2563EB);
    margin-right: 8px;
  }
  `;
  document.head.appendChild(st);
  stylesDone = true;
}

// tight sheet bounds from the circuit itself (same math as CircuitView.build
// BEFORE the photo-chip layer grows the viewBox — we strip that layer)
function tightViewBox(svg, circuit) {
  const xs = [], ys = [];
  for (const n of circuit.nodes) { xs.push(n.x); ys.push(n.y); }
  for (const c of circuit.components) { if (c.x != null) xs.push(c.x); if (c.y != null) ys.push(c.y); }
  if (!xs.length) return null;
  const pad = 54;
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad;
  svg.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
  return { w, h };
}

/**
 * Build the read-only schematic figure for a quiz item's `visual` spec.
 * opts.compact — smaller cap for the grade-screen review list.
 * Returns an HTMLElement, or null if the visual cannot be built (the exam
 * degrades gracefully to a text-only question — never blocks the runner).
 */
export async function buildExamVisual(visual, opts = {}) {
  if (!visual) return null;
  try {
    injectStyles();
    const base = visual.circuit || await loadLessonCircuit(visual.lesson);
    if (!base) return null;

    // applyFaults deep-clones, so the shared cached circuit is never mutated
    const circuit = applyFaults(base, visual.faults || []);

    const pressed = new Set(visual.pressed || []);
    const prevCoil = new Map((visual.prevCoil || []).map((id) => [id, true]));
    const state = solve(circuit, { pressed, prevCoil });

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("ev-svg");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", visual.caption || "circuit schematic for this question");

    const view = new CircuitView(svg);
    view.build(circuit);

    // photo chips OFF: a real-part photo (red mushroom head, contactor face…)
    // can hint the answer. Strip the layer + its toggle, then re-tighten the
    // sheet bounds that the chip pass had grown.
    if (view.gPhotos) view.gPhotos.remove();
    if (view.photoToggle) view.photoToggle.remove();
    const vb = tightViewBox(svg, view.circuit);

    view.applyState(state);

    // lock the sheet's aspect so width:100% + max-height letterboxes via
    // preserveAspectRatio "meet" — the drawing is ALWAYS fully visible
    if (vb && vb.h > 0) svg.style.aspectRatio = `${vb.w} / ${vb.h}`;

    const fig = document.createElement("figure");
    fig.className = "ev-fig" + (opts.compact ? " ev-compact" : "");
    const sheet = document.createElement("div");
    sheet.className = "ev-sheet";
    sheet.appendChild(svg);
    fig.appendChild(sheet);
    if (visual.caption) {
      const cap = document.createElement("figcaption");
      cap.className = "ev-caption";
      cap.textContent = visual.caption;
      fig.appendChild(cap);
    }
    return fig;
  } catch (e) {
    console.warn("exam visual skipped:", e);   // warn, not error — never fail an exam over a picture
    return null;
  }
}
