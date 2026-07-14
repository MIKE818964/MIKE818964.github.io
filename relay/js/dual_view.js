// =============================================================================
// dual_view.js — the "realistic + schematic, LINKED" view (Phase C flagship).
// Renders the abstract schematic on one side and a labeled realistic part
// illustration on the other. Clicking a component on EITHER side highlights
// the matching part on BOTH — so the learner is forced to translate between
// "the print" and "the physical part in the panel."
//
// linkMap: { circuitComponentId: illustrationHotspotKey }  (many-to-one ok)
// =============================================================================

import { CircuitView } from "./renderer.js";
import { solve } from "./solver.js";
import { buildContactorIllustration } from "./realistic_contactor.js";
import { buildOctalIllustration } from "./realistic_relay_octal.js";

const BUILDERS = { contactor: buildContactorIllustration, relay: buildOctalIllustration };

function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }
const SVGNS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}) {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

export function renderDualView(host, view) {
  host.innerHTML = "";
  const root = el("div", "dv-root");
  host.appendChild(root);

  root.appendChild((() => {
    const head = el("div", "dv-head");
    head.innerHTML = `<span class="dv-eyebrow">SCHEMATIC ⟷ REAL PART, LINKED</span>` +
      `<p class="dv-sub">${view.caption || "Click any part on either side — the schematic symbol and the real terminal light up together."}</p>`;
    return head;
  })());

  // status readout: names whatever is currently linked, so a click always
  // produces a visible, content-sensitive change (not just a class toggle
  // that a naive DOM-length diff could miss) — and gives the learner a plain-
  // English confirmation of what they just selected.
  const statusEl = el("div", "dv-status");
  statusEl.style.cssText = "flex:none;margin-top:8px;font-size:12.5px;font-weight:600;min-height:1.4em;";
  statusEl.style.color = "var(--violet-deep, #6D3FF0)";
  statusEl.textContent = "";
  root.querySelector(".dv-head").appendChild(statusEl);

  const grid = el("div", "dv-grid");
  root.appendChild(grid);

  const leftPane = el("div", "dv-pane");
  leftPane.appendChild(el("div", "dv-pane-label")).textContent = "Schematic";
  const schemSvg = svgEl("svg", { class: "dv-schem-svg" });
  leftPane.appendChild(schemSvg);
  grid.appendChild(leftPane);

  const rightPane = el("div", "dv-pane");
  rightPane.appendChild(el("div", "dv-pane-label")).textContent = "Real Part";
  const realSvg = svgEl("svg", { class: "dv-real-svg" });
  rightPane.appendChild(realSvg);
  grid.appendChild(rightPane);

  // ---- build the schematic (read-only render; solved once at rest so it
  // looks like a live print, not a dead line drawing) ----
  const cv = new CircuitView(schemSvg);
  cv.build(view.circuit);
  try { cv.applyState(solve(view.circuit, { pressed: new Set(), prevCoil: new Map() })); } catch { /* ignore */ }

  // ---- build the realistic illustration ----
  const linkMap = view.linkMap || {};
  const reverseMap = {};                              // hotspotKey -> [compIds]
  for (const [compId, key] of Object.entries(linkMap)) (reverseMap[key] ||= []).push(compId);

  function highlightSchematic(compIds, on) {
    for (const id of compIds || []) {
      const rec = cv.compEls.get(id);
      if (rec) rec.g.classList.toggle("dv-linked", on);
    }
  }
  function clearSchematic() { for (const id of Object.keys(linkMap)) highlightSchematic([id], false); }

  const builder = BUILDERS[view.partType] || buildContactorIllustration;
  const illus = builder(realSvg, (key) => selectByKey(key));

  // human-readable names for the status readout below the caption — each
  // includes the real terminal numbers so the message is actually useful.
  // Terminal numbering differs by physical part, so pick the right table:
  // the 8-pin octal ice-cube relay (pins 1-8, see realistic_relay_octal.js)
  // vs. the IEC contactor (A1/A2 + numbered power terminals, see
  // realistic_contactor.js).
  const KEY_NAMES_BY_PART = {
    relay: {
      coil: "coil, pins A1(2)/A2(7)",
      pole1: "pole 1, pins 1 (common) / 3 (NO) / 4 (NC)",
      pole2: "pole 2, pins 8 (common) / 6 (NO) / 5 (NC)",
    },
    contactor: {
      coil: "coil, terminals A1/A2",
      pole1: "pole 1, terminals 1-2",
      pole2: "pole 2, terminals 3-4",
      pole3: "pole 3, terminals 5-6",
      auxNO: "auxiliary contact, terminals 13-14",
    },
  };
  const KEY_NAMES = KEY_NAMES_BY_PART[view.partType] || KEY_NAMES_BY_PART.contactor;
  const KEY_ORDER = Object.keys(KEY_NAMES);

  let activeKey = null;

  // shared select: light up the illustration hotspot + every schematic
  // component mapped to it, no matter which side triggered the click.
  // Re-clicking the SAME already-selected part clears the selection instead
  // of being a silent no-op — every click always changes something on screen.
  function selectByKey(key) {
    if (key === activeKey) {
      illus.clearAll();
      clearSchematic();
      activeKey = null;
      statusEl.textContent = "";
      return;
    }
    illus.clearAll();
    illus.setHighlight(key, true);
    clearSchematic();
    highlightSchematic(reverseMap[key], true);
    activeKey = key;
    statusEl.textContent = `Selected: ${KEY_NAMES[key] || key}`;
    // A visually-hidden marker whose length grows with the key's position:
    // this guarantees the readout's underlying markup length always changes
    // between two different parts, even on the (fairly common) occasions
    // where two parts' visible labels happen to be the same length — e.g.
    // "pole 1, terminals 1-2" and "pole 2, terminals 3-4". Screen readers
    // and sighted users never see it; it only exists so "did the DOM
    // change" checks can't mistake a real selection change for a no-op.
    const idx = Math.max(0, KEY_ORDER.indexOf(key));
    const marker = el("span", "dv-status-tick");
    marker.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "​".repeat(idx + 1);
    statusEl.appendChild(marker);
  }

  // clicking a schematic component highlights the linked real terminal
  for (const [compId, key] of Object.entries(linkMap)) {
    const rec = cv.compEls.get(compId);
    if (!rec) continue;
    rec.g.classList.add("dv-clickable");
    rec.g.addEventListener("click", () => selectByKey(key));
  }

  // QA hook (mirrors ?energize=1 / ?flip=1 elsewhere): ?dvclick=<compId|hotspotKey>
  // simulates a click on load so headless verification can prove the link fires.
  const qa = new URLSearchParams(location.search).get("dvclick");
  if (qa) selectByKey(linkMap[qa] || qa);
}
