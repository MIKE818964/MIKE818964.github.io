// =============================================================================
// builder.js — the CIRCUIT BUILDER: trainees design their own control circuits
// on a blank sheet and watch them run live on the real engine.
//
// Reuses the whole stack untouched: CircuitView renders, solve() runs,
// validateCircuit() + an in-page copy of the validate_lesson press-combination
// logic power the always-on mistake panel. The builder only OWNS the editing
// shell: palette, click-to-place, terminal-dot wiring (merge nodeIds — wires
// stay implicit; DRAG dot-to-dot or click-click, with a live rubber band),
// drag-move, coil-picker chips, first-run coach strip, checks, challenges.
//
// Entry point: renderBuilder(host) — full-stage experience like test_center.js.
// All classes are cb- prefixed; base styling lives in css/app.css, and the
// wiring-affordance / coach / toast / run-banner styles are injected by this
// module (CB_CSS below) so they always travel with the code.
// =============================================================================

import { CircuitView } from "./renderer.js";
import { solve } from "./solver.js";
import { Meter } from "./meter.js";
import { bindButtons } from "./interact.js";
import { validateCircuit } from "./model.js";
import { SYMBOLS, componentTerminals, terminalPoint } from "./symbols.js";

const STORE_KEY = "relay_builder_v1";
const SVGNS = "http://www.w3.org/2000/svg";
const GRID = 10;
const snap = (v) => Math.round(v / GRID) * GRID;

// ---------------------------------------------------------------- tiny makers
function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}
function svgEl(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}
function svgPoint(svg, evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX; pt.y = evt.clientY;
  const m = svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

// ---------------------------------------------------------------- injected CSS
// Everything the wiring interaction needs beyond app.css: hover-enlarging dots,
// the drag rubber band, beckoning drop targets, the first-run coach strip, the
// cancel toast, the LIVE run banner and the blocked-run highlight. Text >= 12px.
const CB_STYLE_ID = "cb-style-wiring";
const COACH_KEY = "cb_coach_v1";
const CB_CSS = `
/* --- terminal dots: big hit targets + hover growth --- */
.cb-term-hit { touch-action: none; }
.cb-termg:hover .cb-term { r: 7.5px; stroke-width: 2.6px; }
.cb-termg:hover .cb-term-hit { fill: rgba(124,92,255,.15); }
/* while a wire is pending (drag or click-click) every drop target beckons */
.cb-svg.cb-wiring { cursor: crosshair; }
.cb-svg.cb-wiring .cb-termg .cb-term { animation: cbBeckon 1.15s ease-in-out infinite; }
.cb-svg.cb-wiring .cb-termg.pending .cb-term,
.cb-svg.cb-wiring .cb-termg:hover .cb-term { animation: none; }
.cb-svg.cb-wiring .cb-termg:hover .cb-term { r: 8px; fill: #EDE9FE; }
@keyframes cbBeckon { 0%, 100% { r: 5px; } 50% { r: 6.8px; } }
/* --- live rubber band while wiring --- */
.cb-rubber { pointer-events: none; }
.cb-rubber-line { stroke: var(--violet, #7C5CFF); stroke-width: 2.4; stroke-dasharray: 7 5; stroke-linecap: round; }
.cb-rubber-end { fill: var(--violet, #7C5CFF); stroke: #FFFFFF; stroke-width: 1.6; }
/* --- wires advertise the disconnect action in build mode --- */
.cb-svg.cb-build .wire-hit { cursor: pointer; }
.cb-svg.cb-build .wire-hit:hover { stroke: rgba(239, 68, 68, 0.22); }
/* --- toast (cancelled wire, blocked run) --- */
.cb-toast {
  position: absolute; z-index: 36; left: 50%; top: 16px; transform: translate(-50%, 0);
  max-width: calc(100% - 40px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  pointer-events: none; padding: 9px 16px; border-radius: 999px;
  font-size: 12.5px; font-weight: 700; color: #92400E;
  background: #FFF9EF; border: 1.5px solid rgba(245,158,11,.6);
  box-shadow: 0 12px 30px -12px rgba(180,83,9,.45);
  animation: cbToastIn .18s ease-out;
}
@keyframes cbToastIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
/* --- first-run coach strip --- */
.cb-coach {
  flex: none; display: flex; align-items: center; flex-wrap: wrap; gap: 6px 10px;
  padding: 8px 12px; border-radius: 12px;
  background: var(--blue-soft, #EAF2FF); border: 1px solid rgba(59,130,246,.42);
  box-shadow: 0 8px 22px -14px rgba(59,130,246,.55);
}
.cb-coach-step { display: inline-flex; align-items: center; gap: 7px; }
.cb-coach-num {
  flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center;
  background: var(--grad, linear-gradient(135deg,#3B82F6,#7C5CFF)); color: #fff; font-weight: 800; font-size: 12px;
}
.cb-coach-txt { font-size: 12.5px; font-weight: 650; color: var(--ink, #1E2433); line-height: 1.3; }
.cb-coach-sep { color: var(--faint, #9AA3B2); font-weight: 700; }
.cb-coach-dismiss {
  margin-left: auto; padding: 4px 11px; border-radius: 999px; font-size: 12px; font-weight: 700;
  color: var(--blue-deep, #1D4ED8); background: var(--surface, #FFFFFF);
  border: 1px solid rgba(59,130,246,.45); transition: all .15s ease; white-space: nowrap;
}
.cb-coach-dismiss:hover { background: #FFFFFF; border-color: var(--blue, #3B82F6); box-shadow: 0 4px 12px -6px rgba(59,130,246,.6); }
/* --- "?" help button in the topbar re-opens the coach --- */
.cb-help {
  flex: none; width: 30px; height: 30px; border-radius: 50%; font-size: 14px; font-weight: 800;
  color: var(--blue-deep, #1D4ED8); background: var(--surface, #FFFFFF);
  border: 1px solid var(--border-strong, #C7CEDB); transition: all .15s ease;
}
.cb-help:hover { background: var(--blue-soft, #EAF2FF); border-color: rgba(59,130,246,.5); }
/* --- LIVE banner while the circuit runs --- */
.cb-runbanner {
  position: absolute; z-index: 16; top: 10px; left: 50%; transform: translateX(-50%);
  display: inline-flex; align-items: center; gap: 8px; pointer-events: none; white-space: nowrap;
  padding: 7px 15px; border-radius: 999px; font-size: 12.5px; font-weight: 800; letter-spacing: .04em;
  color: #065F46; background: rgba(236,253,245,.95); border: 1.5px solid rgba(16,185,129,.55);
  box-shadow: 0 10px 26px -12px rgba(16,185,129,.6);
}
.cb-runbanner-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--success, #10B981); animation: cbLiveBlink 1.4s ease-in-out infinite; }
@keyframes cbLiveBlink { 50% { opacity: .3; } }
/* --- blocked RUN: the offending check rows light up --- */
.cb-check.err.cb-blocking {
  border-color: #EF4444;
  box-shadow: 0 0 0 1px rgba(239,68,68,.35), 0 8px 20px -10px rgba(239,68,68,.55);
  animation: cbBlockPulse .8s ease-in-out 3;
}
@keyframes cbBlockPulse { 50% { background: rgba(239,68,68,.16); } }
/* --- first-class wires: hover highlight + selection ring language --- */
.cb-svg.cb-build .cb-wireg:hover .cb-wire { stroke-width: 4; }
.cb-wireg.selected .cb-wire { stroke-width: 3.4; }
.cb-wire-halo {
  fill: none; stroke: var(--violet, #7C5CFF); stroke-width: 10; opacity: .30;
  stroke-linecap: round; stroke-linejoin: round; pointer-events: none;
}
/* return-tied copper draws dark even before current flows (build-mode polarity) */
.cb-svg .wire.return { stroke: #1F2937; }
/* a no-load bridge from + to − : unmistakable, never the normal red */
.cb-svg .wire.cb-short {
  stroke: #F97316; stroke-width: 3.4; stroke-dasharray: 7 4;
  filter: drop-shadow(0 0 3px rgba(249,115,22,.85));
  animation: cbShortFlash .55s step-end infinite;
}
.cb-svg .junction.cb-short { fill: #F97316; }
@keyframes cbShortFlash { 50% { stroke: #B45309; } }
/* build-mode junction dots advertise the leg-disconnect popover */
.cb-svg.cb-build .junction-hit { cursor: pointer; }
/* --- polarity badges at the supply + L/N wire tags --- */
.cb-polbadge circle { stroke: #FFFFFF; stroke-width: 1.6; }
.cb-polbadge.pos circle { fill: #DC2626; }
.cb-polbadge.neg circle { fill: #1F2937; }
.cb-polbadge text { fill: #FFFFFF; font-size: 13px; font-weight: 800; }
.cb-wtag rect { stroke-width: 1.2; }
.cb-wtag.l rect { fill: #FEE2E2; stroke: #DC2626; }
.cb-wtag.n rect { fill: #E5E7EB; stroke: #1F2937; }
.cb-wtag text { font-size: 10.5px; font-weight: 800; }
.cb-wtag.l text { fill: #B91C1C; }
.cb-wtag.n text { fill: #1F2937; }
.cb-wtag, .cb-polbadge { pointer-events: none; }
/* --- swinging contact blade (rest -> pulled-in), colored with the current --- */
.cb-blade { stroke: #475569; stroke-width: 2.4; stroke-linecap: round; pointer-events: none; }
.comp.conducting .cb-blade { stroke: var(--live, #EF4444); }
.comp.conducting.neg-side .cb-blade { stroke: #1F2937; }
/* --- selected-wire action badges (✕ delete, ✂ legs) --- */
.cb-cutbtn { cursor: pointer; }
.cb-cutbtn circle { fill: #FFFFFF; stroke: rgba(59,130,246,.6); stroke-width: 1.6; }
.cb-cutbtn text { fill: #1D4ED8; font-size: 11px; font-weight: 800; }
.cb-cutbtn:hover circle { fill: rgba(59,130,246,.12); stroke: #3B82F6; }
/* --- topbar undo / redo --- */
.cb-act:disabled { opacity: .42; cursor: default; pointer-events: none; }
`;
function ensureBuilderStyle() {
  if (document.getElementById(CB_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = CB_STYLE_ID;
  s.textContent = CB_CSS;
  document.head.appendChild(s);
}

// ---------------------------------------------------------------- palette
// tool -> how to mint a component. Auto-labels use per-type counters scanned
// from the ids already on the sheet (S1, S2, CR1, PL1, M1, FU1, ...).
const PALETTE = [
  { tool: "source",        name: "Source 24VDC", sub: "one per circuit" },
  { tool: "fuse",          name: "Fuse",         sub: "protects the rung" },
  { tool: "pushbutton_no", name: "Pushbutton NO", sub: "momentary · Start" },
  { tool: "pushbutton_nc", name: "Pushbutton NC", sub: "momentary · Stop" },
  { tool: "contact_no",    name: "Contact NO",   sub: "closes when coil pulls in" },
  { tool: "contact_nc",    name: "Contact NC",   sub: "opens when coil pulls in" },
  { tool: "coil",          name: "Relay coil",   sub: "CR — drives contacts" },
  { tool: "bulb",          name: "Pilot lamp",   sub: "indicator load" },
  { tool: "motor",         name: "Motor",        sub: "the big load" },
  { tool: "test_point",    name: "Test point",   sub: "meter probe target" },
];

// small line-art icons for the palette (stroke = currentColor)
function paletteIcon(tool) {
  const W = 46, H = 30, cx = 23, cy = 15;
  const s = (inner) =>
    `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;
  switch (tool) {
    case "source": return s(`<line x1="4" y1="${cy}" x2="17" y2="${cy}"/><line x1="17" y1="5" x2="17" y2="25"/><line x1="24" y1="10" x2="24" y2="20" stroke-width="3.4"/><line x1="24" y1="${cy}" x2="42" y2="${cy}"/>`);
    case "fuse": return s(`<line x1="3" y1="${cy}" x2="9" y2="${cy}"/><rect x="9" y="8" width="28" height="14" rx="2"/><line x1="9" y1="${cy}" x2="37" y2="${cy}"/><line x1="37" y1="${cy}" x2="43" y2="${cy}"/>`);
    case "pushbutton_no": return s(`<line x1="3" y1="19" x2="15" y2="19"/><line x1="15" y1="11" x2="15" y2="27"/><line x1="31" y1="11" x2="31" y2="27"/><line x1="31" y1="19" x2="43" y2="19"/><line x1="23" y1="11" x2="23" y2="6"/><rect x="16" y="2" width="14" height="4" rx="1.5"/>`);
    case "pushbutton_nc": return s(`<line x1="3" y1="19" x2="15" y2="19"/><line x1="15" y1="11" x2="15" y2="27"/><line x1="31" y1="11" x2="31" y2="27"/><line x1="31" y1="19" x2="43" y2="19"/><line x1="12" y1="28" x2="34" y2="10"/><line x1="23" y1="11" x2="23" y2="6"/><rect x="16" y="2" width="14" height="4" rx="1.5"/>`);
    case "contact_no": return s(`<line x1="3" y1="${cy}" x2="16" y2="${cy}"/><line x1="16" y1="6" x2="16" y2="24"/><line x1="30" y1="6" x2="30" y2="24"/><line x1="30" y1="${cy}" x2="43" y2="${cy}"/>`);
    case "contact_nc": return s(`<line x1="3" y1="${cy}" x2="16" y2="${cy}"/><line x1="16" y1="6" x2="16" y2="24"/><line x1="30" y1="6" x2="30" y2="24"/><line x1="30" y1="${cy}" x2="43" y2="${cy}"/><line x1="12" y1="26" x2="34" y2="4"/>`);
    case "coil": return s(`<line x1="3" y1="${cy}" x2="12" y2="${cy}"/><rect x="12" y="6" width="22" height="18" rx="2"/><line x1="34" y1="${cy}" x2="43" y2="${cy}"/>`);
    case "bulb": return s(`<line x1="3" y1="${cy}" x2="13" y2="${cy}"/><circle cx="${cx}" cy="${cy}" r="10"/><line x1="16" y1="8" x2="30" y2="22"/><line x1="30" y1="8" x2="16" y2="22"/><line x1="33" y1="${cy}" x2="43" y2="${cy}"/>`);
    case "motor": return s(`<line x1="3" y1="${cy}" x2="13" y2="${cy}"/><circle cx="${cx}" cy="${cy}" r="10"/><path d="M 19 20 L 19 10 L 23 16 L 27 10 L 27 20" stroke-width="1.7"/><line x1="33" y1="${cy}" x2="43" y2="${cy}"/>`);
    case "test_point": return s(`<circle cx="${cx}" cy="${cy}" r="7"/><circle cx="${cx}" cy="${cy}" r="2.4" fill="currentColor"/>`);
    default: return s("");
  }
}

const ID_PREFIX = {
  source: "PS", fuse: "FU", pushbutton: "S", contact_no: "C", contact_nc: "C",
  coil: "CR", bulb: "PL", motor: "M", test_point: "TP",
};

// ---------------------------------------------------------------- state
let B = null;   // the whole builder session (rebuilt on every renderBuilder)
let keysBound = false;

function emptyCircuit() {
  return { id: "builder", nodes: [], components: [], wires: [] };
}

function loadStore() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    if (s && s.designs && typeof s.designs === "object") {
      // older saves (node-merge format, no wires[]) migrate in place on load
      for (const name of Object.keys(s.designs)) s.designs[name] = migrateCircuit(s.designs[name]);
      return s;
    }
  } catch { /* fresh start */ }
  return { current: "My first circuit", designs: { "My first circuit": emptyCircuit() } };
}
function saveStore() {
  // B.name is null exactly once: mid-delete (deleteDesign nulls it so this
  // write-back can't resurrect the design the user just deleted).
  if (B.name) {
    B.store.designs[B.name] = B.circuit;
    B.store.current = B.name;
  }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(B.store)); } catch { /* storage full — design won't persist */ }
}

// ---------------------------------------------------------------- circuit ops
const comps = () => B.circuit.components;
const nodes = () => B.circuit.nodes;
const compById = (id) => comps().find((c) => c.id === id);
const nodeById = (id) => nodes().find((n) => n.id === id);
const labelOf = (id) => { const c = compById(id); return c ? (c.label || c.id) : id; };

function nextId(prefix) {
  let max = 0;
  for (const c of comps()) {
    const m = c.id.match(new RegExp(`^${prefix}(\\d+)$`));
    if (m) max = Math.max(max, +m[1]);
  }
  return `${prefix}${max + 1}`;
}
function nextNodeId() {
  let max = 0;
  for (const n of nodes()) {
    const m = String(n.id).match(/^n(\d+)$/);
    if (m) max = Math.max(max, +m[1]);
  }
  return `n${max + 1}`;
}

// how many terminals (across ALL components) land on a node
function nodeDegree(nodeId) {
  let d = 0;
  for (const c of comps())
    for (const nid of Object.values(c.terminals || {}))
      if (nid === nodeId) d++;
  return d;
}
function terminalsOnNode(nodeId) {
  const out = [];
  for (const c of comps())
    for (const [t, nid] of Object.entries(c.terminals || {}))
      if (nid === nodeId) out.push({ compId: c.id, term: t });
  return out;
}

// ---------------------------------------------------------------- wires (first-class)
// A wire is an explicit drafting object: { id:"w1", a:{c,t}, b:{c,t} }.
// Electrical nodes are DERIVED from the wire list (union-find over terminals),
// so deleting one wire un-merges exactly that connection and nothing else.
const wires = () => (B.circuit.wires || (B.circuit.wires = []));

function nextWireId(circuit) {
  let max = 0;
  for (const w of circuit.wires || []) {
    const m = String(w.id).match(/^w(\d+)$/);
    if (m) max = Math.max(max, +m[1]);
  }
  return `w${max + 1}`;
}
const wiresAtTerminal = (compId, term) =>
  wires().filter((w) => (w.a.c === compId && w.a.t === term) || (w.b.c === compId && w.b.t === term));

// migrate any circuit (old saves, imports, lesson files) to the wires[] format:
// synthesize a nearest-neighbor chain of wires for every merged node so the
// drawing matches how an electrician would daisy-chain the terminals.
function migrateCircuit(circuit) {
  if (!circuit || !Array.isArray(circuit.components)) return circuit;
  circuit.nodes = circuit.nodes || [];
  if (Array.isArray(circuit.wires)) {
    // already the wires[] format (e.g. an exported design pasted back in):
    // the WIRES are the truth — rebuild the node merges so the solver agrees
    // with the drawing even if the pasted nodes[] were stale or unmerged
    rebuildNodesFor(circuit);
    return circuit;
  }
  circuit.wires = [];
  const byNode = new Map();
  for (const c of circuit.components) {
    for (const [t, nid] of Object.entries(c.terminals || {})) {
      if (!byNode.has(nid)) byNode.set(nid, []);
      const p = terminalPoint(c, t);
      byNode.get(nid).push({ c: c.id, t, x: p.x, y: p.y });
    }
  }
  let seq = 0;
  for (const [, terms] of byNode) {
    if (terms.length < 2) continue;
    // greedy nearest chain, starting from the leftmost terminal — deterministic
    terms.sort((a, b) => a.x - b.x || a.y - b.y || (a.c + a.t).localeCompare(b.c + b.t));
    const left = [...terms];
    const chain = [left.shift()];
    while (left.length) {
      const tail = chain[chain.length - 1];
      let bi = 0, bd = Infinity;
      for (let i = 0; i < left.length; i++) {
        const d = Math.hypot(left[i].x - tail.x, left[i].y - tail.y);
        if (d < bd) { bd = d; bi = i; }
      }
      chain.push(left.splice(bi, 1)[0]);
    }
    for (let i = 1; i < chain.length; i++)
      circuit.wires.push({ id: `w${++seq}`, a: { c: chain[i - 1].c, t: chain[i - 1].t }, b: { c: chain[i].c, t: chain[i].t } });
  }
  return circuit;
}

// derive nodes[] + terminal bindings from the wire list (stable node ids)
function rebuildNodes() {
  rebuildNodesFor(B.circuit);
  B._routeCache = null;
}
function rebuildNodesFor(c) {
  const key = (r) => r.c + '::' + r.t;   // '::' never appears in ids/terms
  const byId = new Map();
  for (const comp of c.components) byId.set(comp.id, comp);
  // drop wires whose endpoints vanished
  c.wires = (c.wires || []).filter((w) => {
    const ca = byId.get(w.a.c), cb = byId.get(w.b.c);
    return ca && cb && ca.terminals && cb.terminals &&
           ca.terminals[w.a.t] !== undefined && cb.terminals[w.b.t] !== undefined;
  });
  // union-find over every terminal
  const parent = new Map();
  const find = (k) => { let r = k; while (parent.get(r) !== r) r = parent.get(r); parent.set(k, r); return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  const termList = [];
  for (const comp of c.components)
    for (const t of Object.keys(comp.terminals || {})) {
      const k = key({ c: comp.id, t });
      parent.set(k, k);
      termList.push({ k, comp, t });
    }
  for (const w of c.wires) union(key(w.a), key(w.b));
  // group terminals by root, in stable authoring order
  const groups = new Map();
  for (const rec of termList) {
    const r = find(rec.k);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(rec);
  }
  // reassign node ids: keep each group's existing id when free, else mint
  const used = new Set();
  let mint = 0;
  for (const n of c.nodes) { const m = String(n.id).match(/^n(\d+)$/); if (m) mint = Math.max(mint, +m[1]); }
  const newNodes = [];
  for (const [, members] of groups) {
    let nid = null;
    for (const m of members) {
      const cur = m.comp.terminals[m.t];
      if (cur != null && !used.has(cur)) { nid = cur; break; }
    }
    if (nid == null) nid = `n${++mint}`;
    used.add(nid);
    // node position: a lone terminal keeps its exact point; a test point in
    // the group anchors it (the marker must sit where the probe touches);
    // otherwise the snapped centroid of the member terminals
    let px = 0, py = 0, anchor = null;
    for (const m of members) {
      const p = terminalPoint(m.comp, m.t);
      px += p.x; py += p.y;
      if (m.comp.type === "test_point" && !anchor) anchor = p;
    }
    if (!anchor && members.length === 1) anchor = terminalPoint(members[0].comp, members[0].t);
    const x = anchor ? anchor.x : snap(px / members.length);
    const y = anchor ? anchor.y : snap(py / members.length);
    newNodes.push({ id: nid, x, y });
    for (const m of members) m.comp.terminals[m.t] = nid;
  }
  c.nodes = newNodes;
}

// connect two terminals: add an explicit wire (refuse only exact duplicates)
function addWire(a, b) {
  const ca = compById(a.compId), cb = compById(b.compId);
  if (!ca || !cb) return false;
  const dup = wires().some((w) =>
    (w.a.c === a.compId && w.a.t === a.term && w.b.c === b.compId && w.b.t === b.term) ||
    (w.b.c === a.compId && w.b.t === a.term && w.a.c === b.compId && w.a.t === b.term));
  if (dup) { setFlash("Those two points are already on the same wire."); return false; }
  wires().push({ id: nextWireId(B.circuit), a: { c: a.compId, t: a.term }, b: { c: b.compId, t: b.term } });
  rebuildNodes();
  return true;
}

// remove exactly one wire — parts stay, the node un-merges by itself
function deleteWire(wireId) {
  B.circuit.wires = wires().filter((w) => w.id !== wireId);
  if (B.selectedWire === wireId) B.selectedWire = null;
  rebuildNodes();
}

function placeComponent(tool, x, y) {
  const type = tool.startsWith("pushbutton") ? "pushbutton" : tool;
  const id = nextId(ID_PREFIX[type] || "X");
  const comp = { id, type, x: snap(x), y: snap(y), label: id, terminals: {} };
  switch (type) {
    case "source":     Object.assign(comp, { current: "DC", volts: 24, label: "24VDC" }); break;
    case "fuse":       comp.ratingA = 1; break;
    case "pushbutton": Object.assign(comp, { mode: "momentary", contact: tool === "pushbutton_nc" ? "NC" : "NO",
                                             label: `${id} ${tool === "pushbutton_nc" ? "(NC)" : "(NO)"}` }); break;
    case "contact_no":
    case "contact_nc": { comp.coil = null; comp.label = autoContactLabel(comp); break; }
    case "coil":       Object.assign(comp, { ratedVolts: 24, ratedCurrent: "DC" }); break;
  }
  // every terminal gets its OWN fresh node exactly at the terminal point —
  // that's an "unwired terminal" until the learner connects it to another dot
  for (const [tname, off] of Object.entries(SYMBOLS[type].terminals)) {
    const nid = nextNodeId();
    nodes().push({ id: nid, x: comp.x + off.dx, y: comp.y + off.dy });
    comp.terminals[tname] = nid;
  }
  comps().push(comp);
  return comp;
}

function autoContactLabel(comp) {
  const kind = comp.type === "contact_nc" ? "NC" : "NO";
  return comp.coil ? `${comp.coil} ${kind}` : `${kind} — pick coil`;
}
const isAutoContactLabel = (comp) =>
  !comp.label || /^(NO|NC) — pick coil$/.test(comp.label) || /^\S+ (NO|NC)$/.test(comp.label);

// cut every wire touching one terminal — that leg comes free, the rest of the
// net stays intact (the popover's "✂ cut this leg" action)
function disconnectTerminal(compId, term) {
  const cut = new Set(wiresAtTerminal(compId, term).map((w) => w.id));
  if (!cut.size) return;
  B.circuit.wires = wires().filter((w) => !cut.has(w.id));
  if (cut.has(B.selectedWire)) B.selectedWire = null;
  rebuildNodes();
}

function deleteComponent(compId) {
  B.circuit.components = comps().filter((c) => c.id !== compId);
  const gone = new Set(wires().filter((w) => w.a.c === compId || w.b.c === compId).map((w) => w.id));
  B.circuit.wires = wires().filter((w) => !gone.has(w.id));
  if (gone.has(B.selectedWire)) B.selectedWire = null;
  if (B.selected === compId) B.selected = null;
  if (B.pending && B.pending.compId === compId) B.pending = null;
  rebuildNodes();
}

function moveComponent(comp, nx, ny) {
  comp.x = nx; comp.y = ny;
  // nodes are derived geometry — refresh their anchor points as the part moves
  updateNodePositions();
  B._routeCache = null;
}

// node positions follow their member terminals (centroid; test points anchor)
function updateNodePositions() {
  const members = new Map();
  for (const c of comps())
    for (const [t, nid] of Object.entries(c.terminals || {})) {
      if (!members.has(nid)) members.set(nid, []);
      members.get(nid).push({ comp: c, t });
    }
  for (const n of nodes()) {
    const list = members.get(n.id);
    if (!list || !list.length) continue;
    let px = 0, py = 0, anchor = null;
    for (const m of list) {
      const p = terminalPoint(m.comp, m.t);
      px += p.x; py += p.y;
      if (m.comp.type === "test_point" && !anchor) anchor = p;
    }
    if (!anchor && list.length === 1) anchor = terminalPoint(list[0].comp, list[0].t);
    n.x = anchor ? anchor.x : snap(px / list.length);
    n.y = anchor ? anchor.y : snap(py / list.length);
  }
}

function cycleContactCoil(comp) {
  const coilIds = comps().filter((c) => c.type === "coil" || c.type === "timer_coil").map((c) => c.id);
  if (!coilIds.length) { setFlash("Place a relay coil first — then this contact can follow it."); return; }
  const idx = coilIds.indexOf(comp.coil);
  const wasAuto = isAutoContactLabel(comp);
  comp.coil = coilIds[(idx + 1) % coilIds.length];
  if (wasAuto) comp.label = autoContactLabel(comp);
}

// ---------------------------------------------------------------- wire router
// Drafting-standard orthogonal routing. Every wire runs point-to-point between
// its two terminals with square corners; candidates are scored so a wire
// (a) never cuts through a part body, its label, or a coil chip,
// (b) never lies ON TOP of another wire's parallel segment — shared corridors
//     get offset lanes a few px apart, like conductors in a wireway,
// (c) takes few bends and little copper.
// Pure function of the circuit → deterministic and stable across re-renders.

function escapeDir(comp, term) {
  const def = SYMBOLS[comp.type];
  const off = def && def.terminals[term];
  if (!off) return [0, 0];
  if (Math.abs(off.dx) >= Math.abs(off.dy)) return [Math.sign(off.dx) || 0, 0];
  return [0, Math.sign(off.dy) || 0];
}

// obstacle boxes: symbol bodies, their label text, contact coil chips.
// label baselines mirror renderer._draw exactly (source +34, fuse +22, ...)
const LABEL_DY = { source: 34, fuse: 22, contact_no: 24, contact_nc: 24, pushbutton: 24,
                   coil: 25, timer_coil: 25, bulb: 30, motor: 31 };
function routeObstacles() {
  const boxes = [];
  for (const c of comps()) {
    const def = SYMBOLS[c.type];
    if (!def) continue;
    if (c.type === "test_point") {
      boxes.push({ comp: c.id, x: c.x - 22, y: c.y - 10, w: 44, h: 14 });
      continue;
    }
    boxes.push({ comp: c.id, x: c.x - def.w / 2, y: c.y - def.h / 2, w: def.w, h: def.h });
    if (c.label) {
      const base = c.y + (LABEL_DY[c.type] || def.h / 2 + 16);
      const half = Math.min(60, c.label.length * 3.8 + 4);   // ~7.6px/char mono
      boxes.push({ comp: c.id, x: c.x - half, y: base - 12, w: half * 2, h: 17 });
    }
    // coil-picker chip above contacts (build mode)
    if (c.type === "contact_no" || c.type === "contact_nc")
      boxes.push({ comp: c.id, x: c.x - 31, y: c.y - 50, w: 62, h: 17 });
  }
  return boxes;
}

const segLen = (s) => Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1);
function pathSegs(pts) {
  const segs = [];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x === pts[i - 1].x && pts[i].y === pts[i - 1].y) continue;
    segs.push({ x1: pts[i - 1].x, y1: pts[i - 1].y, x2: pts[i].x, y2: pts[i].y });
  }
  return segs;
}
// overlap length of an orthogonal segment with a rect (inflated by m);
// a crossing that only clips the rect still counts a minimum sliver
function segRectOverlap(s, r, m) {
  const rx0 = r.x - m, ry0 = r.y - m, rx1 = r.x + r.w + m, ry1 = r.y + r.h + m;
  const sx0 = Math.min(s.x1, s.x2), sx1 = Math.max(s.x1, s.x2);
  const sy0 = Math.min(s.y1, s.y2), sy1 = Math.max(s.y1, s.y2);
  if (sx1 <= rx0 || sx0 >= rx1 || sy1 <= ry0 || sy0 >= ry1) return 0;
  if (s.y1 === s.y2) return Math.max(0.5, Math.min(sx1, rx1) - Math.max(sx0, rx0));
  if (s.x1 === s.x2) return Math.max(0.5, Math.min(sy1, ry1) - Math.max(sy0, ry0));
  return 0;
}
// collinear overlap between two parallel segments (the "on top of one another" sin)
function segSegOverlap(a, b) {
  const aH = a.y1 === a.y2, bH = b.y1 === b.y2;
  if (aH !== bH) return 0;                                    // perpendicular = plain crossing, fine
  if (aH) {
    if (Math.abs(a.y1 - b.y1) > 0.6) return 0;
    return Math.max(0, Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) -
                       Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2)));
  }
  if (Math.abs(a.x1 - b.x1) > 0.6) return 0;
  return Math.max(0, Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) -
                     Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2)));
}
// is the overlapping stretch of two parallel segments entirely within `r` px
// of point p? (a short common stem leaving a SHARED terminal is a normal T-off)
function overlapNear(a, b, p, r) {
  const H = a.y1 === a.y2;
  if (H) {
    const x0 = Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2));
    const x1 = Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2));
    return Math.abs(a.y1 - p.y) <= r && Math.abs(x0 - p.x) <= r && Math.abs(x1 - p.x) <= r;
  }
  const y0 = Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2));
  const y1 = Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2));
  return Math.abs(a.x1 - p.x) <= r && Math.abs(y0 - p.y) <= r && Math.abs(y1 - p.y) <= r;
}
const samePt = (a, b) => a && b && Math.abs(a.x - b.x) < 0.6 && Math.abs(a.y - b.y) < 0.6;

function scoreRoute(pts, endA, endB, obstacles, placed) {
  const segs = pathSegs(pts);
  let s = segs.length > 1 ? (segs.length - 1) * 3 : 0;
  for (const seg of segs) {
    s += segLen(seg) * 0.02;
    for (const ob of obstacles) {
      // a wire may live within 18px of its OWN terminal even where the part's
      // body/label sits (that is the landing zone) — subtract that exclusion
      let ov = segRectOverlap(seg, ob, 4);
      if (ov > 0.9) {
        if (ob.comp === endA.comp)
          ov -= segRectOverlap(seg, { x: endA.p.x - 18, y: endA.p.y - 18, w: 36, h: 36 }, 0);
        if (ob.comp === endB.comp)
          ov -= segRectOverlap(seg, { x: endB.p.x - 18, y: endB.p.y - 18, w: 36, h: 36 }, 0);
      }
      if (ov > 0.9) s += 900 + ov * 4;
    }
    for (const pl of placed) {
      let ov = segSegOverlap(seg, pl);
      if (ov > 0.6) {
        // both wires land on the SAME terminal: a ≤18px common stem is fine
        const shared = [endA.p, endB.p].find((p) => samePt(pl.ea, p) || samePt(pl.eb, p));
        if (shared && overlapNear(seg, pl, shared, 18)) ov = 0;
      }
      if (ov > 0.6) s += 400 + ov * 8;
    }
  }
  return s;
}

// candidate polylines from A to B honoring each terminal's escape direction
function routeCandidates(A, da, Bp, db) {
  const out = [];
  const push = (pts) => out.push(pts);
  const stubsA = (da[0] || da[1]) ? [10, 0] : [0];
  const stubsB = (db[0] || db[1]) ? [10, 0] : [0];
  // fine lanes near the bases (wireway spacing) plus wide detour channels
  const offs = [0, -6, 6, -12, 12, -20, 20, -30, 30, -44, 44, -60, 60];
  const CAP = 4200;
  for (const sa of stubsA) for (const sb of stubsB) {
    if (out.length > CAP) break;
    const A2 = { x: A.x + da[0] * sa, y: A.y + da[1] * sa };
    const B2 = { x: Bp.x + db[0] * sb, y: Bp.y + db[1] * sb };
    const bases = [A2, B2, { x: (A2.x + B2.x) / 2, y: (A2.y + B2.y) / 2 }];
    const Xs = [], Ys = [];
    for (const b of bases) for (const o of offs) {
      const x = Math.round(b.x + o), y = Math.round(b.y + o);
      if (!Xs.includes(x)) Xs.push(x);
      if (!Ys.includes(y)) Ys.push(y);
    }
    // cheap L / Z shapes first (the early-exit set)
    push([A, A2, { x: B2.x, y: A2.y }, B2, Bp]);
    push([A, A2, { x: A2.x, y: B2.y }, B2, Bp]);
    for (const mx of Xs) push([A, A2, { x: mx, y: A2.y }, { x: mx, y: B2.y }, B2, Bp]);
    for (const my of Ys) push([A, A2, { x: A2.x, y: my }, { x: B2.x, y: my }, B2, Bp]);
    // full spine grids (only reached when the cheap set scores badly):
    // H-V-H (horizontal first) AND V-H-V (vertical first) — both symmetries,
    // so a run can climb over a row of parts and drop down the far side
    for (const mx of Xs) {
      if (out.length > CAP) break;
      for (const my of Ys) {
        push([A, A2, { x: mx, y: A2.y }, { x: mx, y: my }, { x: B2.x, y: my }, B2, Bp]);
        push([A, A2, { x: A2.x, y: my }, { x: mx, y: my }, { x: mx, y: B2.y }, B2, Bp]);
      }
    }
  }
  return out;
}

// drop repeated points + merge collinear runs
function simplifyRoute(pts) {
  const out = [];
  for (const p of pts) {
    const q = { x: Math.round(p.x), y: Math.round(p.y) };
    const last = out[out.length - 1];
    if (last && last.x === q.x && last.y === q.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      if ((a.x === last.x && last.x === q.x) || (a.y === last.y && last.y === q.y)) out.pop();
    }
    out.push(q);
  }
  return out;
}

function routeKey() {
  const c = B.circuit;
  let k = "";
  for (const cm of c.components) k += `${cm.id}@${cm.x},${cm.y},${cm.type},${(cm.label || "").length};`;
  for (const w of c.wires || []) k += `${w.id}:${w.a.c}.${w.a.t}-${w.b.c}.${w.b.t};`;
  return k;
}

// route every wire; returns [{ wire, pts, netId }] in stable wire order
function routeAllWires() {
  const k = routeKey();
  if (B._routeCache && B._routeCache.key === k) return B._routeCache.routes;
  const obstacles = routeObstacles();
  const placed = [];
  const routes = [];
  const list = wires().slice().sort((a, b) => String(a.id).localeCompare(String(b.id), "en", { numeric: true }));
  for (const w of list) {
    const ca = compById(w.a.c), cb = compById(w.b.c);
    if (!ca || !cb) continue;
    const A = terminalPoint(ca, w.a.t), Bp = terminalPoint(cb, w.b.t);
    const endA = { comp: ca.id, p: A }, endB = { comp: cb.id, p: Bp };
    const cands = routeCandidates(A, escapeDir(ca, w.a.t), Bp, escapeDir(cb, w.b.t));
    const man = Math.abs(Bp.x - A.x) + Math.abs(Bp.y - A.y);   // clean lower bound
    let best = null, bestS = Infinity;
    for (let i = 0; i < cands.length; i++) {
      const pts = simplifyRoute(cands[i]);
      const s = scoreRoute(pts, endA, endB, obstacles, placed);
      if (s < bestS - 1e-9) { bestS = s; best = pts; }
      // early exit: a clean near-minimal shape (no obstacle/overlap penalty) wins
      if (i >= 1 && bestS <= man * 0.02 + 26) break;
      if (i > 420 && bestS <= man * 0.02 + 130) break;   // good-enough guard on huge sheets
    }
    const pts = best || [A, Bp];
    routes.push({ wire: w, pts, netId: ca.terminals[w.a.t] });
    for (const seg of pathSegs(pts)) placed.push({ ...seg, ea: A, eb: Bp });
  }
  B._routeCache = { key: k, routes };
  return routes;
}

// junction dots: a terminal where 2+ wires land is an electrical join
function junctionPoints() {
  const count = new Map();   // "comp::term" -> n wires
  for (const w of wires()) {
    for (const e of [w.a, w.b]) {
      const key = e.c + "::" + e.t;
      count.set(key, (count.get(key) || 0) + 1);
    }
  }
  const out = [];
  for (const [key, n] of count) {
    if (n < 2) continue;
    const [cid, term] = key.split("::");
    const comp = compById(cid);
    if (!comp) continue;
    const p = terminalPoint(comp, term);
    out.push({ x: p.x, y: p.y, nodeId: comp.terminals[term] });
  }
  return out;
}

// ---------------------------------------------------------------- analysis
// The live mistake panel: structural checks + the validate_lesson.mjs
// press-combination logic run in-page, plus direct-short detection via the
// solver's own posSet/negSet flood (a node on BOTH sides = copper path across
// the source with no load bridging).
function pressStates(circuit) {
  const btns = circuit.components.filter((c) => c.type === "pushbutton").map((c) => c.id);
  const states = [];
  let prev = new Map();
  const run = (pressed, desc) => {
    try {
      const st = solve(circuit, { pressed: new Set(pressed), prevCoil: prev });
      prev = st.coilEnergized;
      states.push({ st, desc });
    } catch (e) { states.push({ st: null, desc, err: String(e && e.message || e) }); }
  };
  run([], "at rest");
  for (const b of btns) {
    run([b], `with ${labelOf(b)} pressed`);
    run([], `after releasing ${labelOf(b)}`);
  }
  if (btns.length > 1) run(btns, "with ALL buttons pressed");
  return states;
}
const hasShort = (st) => { for (const n of st.posSet) if (st.negSet.has(n)) return true; return false; };

function analyzeCircuit(circuit) {
  const errors = [], warnings = [];
  if (!circuit.components.length) return { empty: true, errors, warnings, ok: false };

  // 1) structural: unknown/dangling terminal refs, no source, dup ids...
  const v = validateCircuit(circuit);
  for (const e of v.errors) errors.push(e === "no source component" ? "No power source — place the 24VDC supply." : e);

  // 2) exactly one source
  const sources = circuit.components.filter((c) => c.type === "source");
  if (sources.length > 1)
    errors.push(`${sources.length} power sources on the sheet — a control circuit gets exactly ONE.`);

  // 3) contacts must follow a real coil
  for (const c of circuit.components) {
    if (c.type !== "contact_no" && c.type !== "contact_nc") continue;
    if (!c.coil) errors.push(`${c.label || c.id} has no coil assigned — click its coil chip.`);
    else if (!circuit.components.some((k) => (k.type === "coil" || k.type === "timer_coil") && k.id === c.coil))
      errors.push(`${c.label || c.id} follows coil "${c.coil}" — but no such coil is on the sheet.`);
  }

  // 4) unwired terminals (a node only ONE terminal lands on = open copper)
  const degree = new Map();
  for (const c of circuit.components)
    for (const nid of Object.values(c.terminals || {}))
      degree.set(nid, (degree.get(nid) || 0) + 1);
  for (const c of circuit.components)
    for (const [t, nid] of Object.entries(c.terminals || {}))
      if (degree.get(nid) === 1)
        warnings.push(`${c.label || c.id} · terminal “${t}” is not wired to anything.`);

  // 5+6) solver checks whenever the structure is solvable. A DIRECT SHORT
  // flags IMMEDIATELY — even while other red items exist — because a no-load
  // bridge from + to − is the one mistake that costs hardware.
  const loads = circuit.components.filter((c) => ["bulb", "motor", "coil", "timer_coil"].includes(c.type));
  if (v.ok) {
    const quiet = errors.length > 0;          // other reds present: shorts only
    const states = pressStates(circuit);
    const everOn = new Map(loads.map((l) => [l.id, false]));
    const shortDescs = [];
    for (const { st, desc, err } of states) {
      if (err) { if (!quiet) errors.push(`Solver error ${desc}: ${err}`); continue; }
      if (hasShort(st)) shortDescs.push(desc);
      for (const l of loads) if (st.loadOn.get(l.id)) everOn.set(l.id, true);
    }
    if (shortDescs.length)
      errors.push(`DIRECT SHORT across the source ${shortDescs[0]} — current has a copper path from + to − with no load in the way. That pops FU or cooks the supply.`);
    if (!quiet) {
      for (const l of loads)
        if (!everOn.get(l.id))
          errors.push(`${l.label || l.id} can never energize — no press combination completes its path (tried rest, each button, all buttons).`);
    }
    if (!loads.length)
      warnings.push("No load yet — add a lamp, coil, or motor so the circuit does something.");
  }

  return { empty: false, errors, warnings, ok: !errors.length && !warnings.length };
}

// ---------------------------------------------------------------- challenges
function seqStates(circuit, seq) {
  let prev = new Map();
  return seq.map((pressed) => {
    const st = solve(circuit, { pressed: new Set(pressed), prevCoil: prev });
    prev = st.coilEnergized;
    return st;
  });
}
const bulbsOf = (c) => c.components.filter((x) => x.type === "bulb");
const buttonsOf = (c) => c.components.filter((x) => x.type === "pushbutton").map((x) => x.id);
const litBulbs = (st, c) => bulbsOf(c).filter((b) => st.loadOn.get(b.id)).map((b) => b.id);
const anyLoadOn = (st) => [...st.loadOn.values()].some(Boolean);
const structuralOk = (c) => c.components.length && validateCircuit(c).ok &&
  c.components.filter((x) => x.type === "source").length === 1;

function gradeLamp(c) {
  const R = (label) => ({ label, pass: false });
  const reqs = [
    R("Parts: one source, a pushbutton, and a lamp"),
    R("Lamp is OFF at rest"),
    R("Pressing a button lights a lamp"),
    R("Releasing the button turns it back off"),
    R("No short across the source"),
  ];
  if (!structuralOk(c) || !bulbsOf(c).length || !buttonsOf(c).length) return reqs;
  reqs[0].pass = true;
  let best = null;
  for (const b of buttonsOf(c)) {
    const [st0, st1, st2] = seqStates(c, [[], [b], []]);
    const r = [
      litBulbs(st0, c).length === 0,
      litBulbs(st1, c).length > 0,
      litBulbs(st2, c).length === 0,
      !hasShort(st0) && !hasShort(st1) && !hasShort(st2),
    ];
    const score = r.filter(Boolean).length;
    if (!best || score > best.score) best = { r, score };
  }
  if (best) best.r.forEach((p, i) => { reqs[i + 1].pass = p; });
  return reqs;
}

function gradeLatch(c) {
  const R = (label) => ({ label, pass: false });
  const reqs = [
    R("Parts: source, TWO buttons, and a coil with its own NO seal-in contact"),
    R("Everything the coil drives is OFF at rest"),
    R("Start button pulls the coil in (load turns ON)"),
    R("Load STAYS ON after Start is released — the seal-in holds"),
    R("Stop button drops it OUT"),
    R("Stays OFF after Stop is released"),
    R("No short across the source in any state"),
  ];
  const coils = c.components.filter((x) => x.type === "coil");
  const hasSeal = coils.some((k) => c.components.some((x) => x.type === "contact_no" && x.coil === k.id));
  if (!structuralOk(c) || buttonsOf(c).length < 2 || !coils.length) return reqs;
  reqs[0].pass = hasSeal;
  const loadIds = c.components.filter((x) => ["bulb", "motor", "coil"].includes(x.type)).map((x) => x.id);
  let best = null;
  for (const s of buttonsOf(c)) for (const t of buttonsOf(c)) {
    if (s === t) continue;
    const sts = seqStates(c, [[], [s], [], [t], []]);   // rest, start, release, stop, release
    for (const L of loadIds) {
      const on = sts.map((st) => !!st.loadOn.get(L));
      const r = [!on[0], on[1], on[2], !on[3], !on[4], sts.every((st) => !hasShort(st))];
      const score = r.filter(Boolean).length;
      if (!best || score > best.score) best = { r, score };
    }
  }
  if (best) best.r.forEach((p, i) => { reqs[i + 1].pass = p; });
  return reqs;
}

function gradeTwoLamps(c) {
  const R = (label) => ({ label, pass: false });
  const reqs = [
    R("Parts: one coil driving BOTH a NO and an NC contact, and two lamps"),
    R("Exactly one lamp (Stopped) is ON at rest"),
    R("Energizing the coil swaps them — Running ON, Stopped OFF"),
    R("No short across the source"),
  ];
  const coils = c.components.filter((x) => x.type === "coil");
  const pairCoil = coils.find((k) =>
    c.components.some((x) => x.type === "contact_no" && x.coil === k.id) &&
    c.components.some((x) => x.type === "contact_nc" && x.coil === k.id));
  if (!structuralOk(c) || bulbsOf(c).length < 2 || !coils.length) return reqs;
  reqs[0].pass = !!pairCoil;
  const [st0] = seqStates(c, [[]]);
  const restLit = litBulbs(st0, c);
  reqs[1].pass = restLit.length === 1 && !hasShort(st0);
  let swap = false, shortFree = !hasShort(st0);
  for (const b of buttonsOf(c)) {
    const [, st1, st2] = seqStates(c, [[], [b], []]);          // pressed + latched-after-release
    for (const st of [st1, st2]) {
      const lit = litBulbs(st, c);
      if (lit.length && restLit.length && !lit.includes(restLit[0])) swap = true;
      if (hasShort(st)) shortFree = false;
    }
  }
  reqs[2].pass = swap;
  reqs[3].pass = shortFree;
  return reqs;
}

const CHALLENGES = [
  { id: "lamp",  icon: "💡", title: "Light a lamp with a button",
    blurb: "Source → button → lamp → back to the source. The very first rung every electrician wires.",
    grade: gradeLamp },
  { id: "latch", icon: "🔒", title: "Build a seal-in latch",
    blurb: "Start (NO) pulls a coil in; the coil's own NO contact seals it; Stop (NC) breaks the seal. the classic 3-wire.",
    grade: gradeLatch },
  { id: "twolamps", icon: "🚦", title: "One coil, two lamps",
    blurb: "Running (NO) + Stopped (NC) lamps off one coil — one pole tells both truths at once.",
    grade: gradeTwoLamps },
];

// ---------------------------------------------------------------- entry point
export function renderBuilder(host) {
  ensureBuilderStyle();
  B = {
    host,
    store: loadStore(),
    name: null,
    circuit: null,
    mode: "build",          // "build" | "run"
    tool: null,             // armed palette tool
    pending: null,          // { compId, term } first wiring click
    selected: null,         // selected component id
    selectedWire: null,     // selected wire id (wires are first-class)
    routes: [],             // last routed wire geometry
    hist: null,             // undo/redo snapshots for the current design
    view: null,
    flash: null,
    chalResults: {},        // challengeId -> last grade result
    lastClient: { x: 0, y: 0 },
    run: null,              // { pressed, prevCoil, meter, ptA, ptB }
    drag: null,
    coachEl: null,          // the 3-step first-run strip (when visible)
    rubberEl: null,         // live rubber-band group while wiring
  };
  B.name = B.store.designs[B.store.current] ? B.store.current : Object.keys(B.store.designs)[0];
  B.circuit = B.store.designs[B.name];
  initHistory();

  host.innerHTML = "";
  const root = el("div", "cb-root");

  // ---- top bar ----
  const top = el("div", "cb-topbar");
  top.appendChild(el("div", "cb-eyebrow", "🔧 CIRCUIT BUILDER"));
  const sel = el("select", "cb-select");
  sel.title = "Your saved designs";
  sel.addEventListener("change", () => switchDesign(sel.value));
  top.appendChild(sel);
  // icon + label as separate spans: below 1100px the label hides and the
  // buttons collapse to icon-only chips (the title tooltip carries the name)
  const mkBtn = (cls, icon, label, title, fn) => {
    const b = el("button", "cb-act " + cls);
    b.title = title;
    b.appendChild(el("span", "cb-act-ico", icon));
    b.appendChild(el("span", "cb-act-lbl", label));
    b.addEventListener("click", fn);
    top.appendChild(b);
    return b;
  };
  mkBtn("cb-new", "＋", "New", "Start a fresh blank design", newDesign);
  mkBtn("cb-dup", "⧉", "Duplicate", "Copy this design", duplicateDesign);
  mkBtn("cb-ren", "✎", "Rename", "Rename this design", renameDesign);
  // "Delete design" in full — a bare "Delete" next to a selected part reads
  // as part-delete and burns the user when it targets the whole design
  mkBtn("cb-delD", "🗑", "Delete design", "Delete this whole design (not the selected part — that's the ✕ badge or Delete key)", deleteDesign);
  mkBtn("cb-exp", "⇩", "Export", "Copy this design as JSON", exportDesign);
  mkBtn("cb-imp", "⇧", "Import", "Paste a design JSON", importDesign);
  B.btnUndo = mkBtn("cb-undo", "↶", "Undo", "Undo (Ctrl+Z)", doUndo);
  B.btnRedo = mkBtn("cb-redo", "↷", "Redo", "Redo (Ctrl+Y)", doRedo);
  top.appendChild(el("div", "cb-spacer"));
  const modeWrap = el("div", "cb-modewrap");
  const bBuild = el("button", "cb-mode-btn", "🛠 BUILD");
  const bRun = el("button", "cb-mode-btn cb-mode-run", "▶ RUN");
  bBuild.addEventListener("click", () => setMode("build"));
  bRun.addEventListener("click", () => setMode("run"));
  modeWrap.appendChild(bBuild); modeWrap.appendChild(bRun);
  top.appendChild(modeWrap);
  const help = el("button", "cb-help", "?");
  help.title = "Show the quick-start steps";
  help.addEventListener("click", () => { if (B.coachEl) hideCoach(false); else showCoach(); });
  top.appendChild(help);
  root.appendChild(top);

  // ---- body: palette | stage | checks ----
  const body = el("div", "cb-body");
  const palette = el("div", "cb-palette");
  body.appendChild(palette);

  const stageWrap = el("div", "cb-stagewrap");
  const canvasCard = el("div", "cb-canvas-card");
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("class", "cb-svg");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  canvasCard.appendChild(svg);
  stageWrap.appendChild(canvasCard);
  const bottom = el("div", "cb-bottombar");
  stageWrap.appendChild(bottom);
  body.appendChild(stageWrap);

  const side = el("div", "cb-side");
  body.appendChild(side);
  root.appendChild(body);
  host.appendChild(root);

  Object.assign(B, { root, topSel: sel, bBuild, bRun, palette, stageWrap, canvasCard, svg, bottom, side });

  // track raw client coords for popover placement
  svg.addEventListener("pointerdown", (e) => { B.lastClient = { x: e.clientX, y: e.clientY }; }, true);
  // empty-canvas click = deselect (selection itself is never a toggle)
  svg.addEventListener("click", (e) => {
    if (e.target === svg && B.mode === "build") {
      // like native dblclick, an intervening click elsewhere resets the
      // double-click window — a fast select→deselect→re-select must SELECT,
      // never hijack the user into the rename modal
      B.lastClick = null;
      if (B.selected || B.selectedWire) {
        B.selected = null; B.selectedWire = null; renderStage(); updateHint();
      }
    }
  });
  // click-click wiring: the rubber band trails the cursor until the second dot
  svg.addEventListener("pointermove", (e) => { if (B.pending && B.rubberEl) updateRubber(e); });
  // close any node popover when clicking elsewhere
  document.addEventListener("pointerdown", onDocPointerDown, true);

  if (!keysBound) {
    document.addEventListener("keydown", onKeyDown);
    keysBound = true;
  }
  if (!coachSeen()) showCoach();   // first visit: the 3-step quick start
  renderAll();
}

function onDocPointerDown(e) {
  if (!B || !B.host.isConnected) { document.removeEventListener("pointerdown", onDocPointerDown, true); return; }
  const pop = B.stageWrap.querySelector(".cb-pop");
  if (pop && !pop.contains(e.target)) pop.remove();
}

function onKeyDown(e) {
  if (!B || !B.host.isConnected) { document.removeEventListener("keydown", onKeyDown); keysBound = false; return; }
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
  // undo / redo: Ctrl+Z / Ctrl+Y (Cmd on a Mac; Ctrl+Shift+Z = redo too)
  if ((e.ctrlKey || e.metaKey) && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === "z") { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); return; }
    if (k === "y") { e.preventDefault(); doRedo(); return; }
  }
  if (e.key === "Escape") {
    if (B.wireDragCancel) B.wireDragCancel();   // kill a live wire-drag so release can't connect
    B.tool = null; B.pending = null; B.selected = null; B.selectedWire = null;
    B.lastClick = null;                         // Esc also resets the double-click window
    closeModal(); renderStage(); renderPalette(); updateHint();
  }
  if ((e.key === "Delete" || e.key === "Backspace") && B.mode === "build") {
    if (B.selectedWire) {                       // wires are first-class: Delete removes JUST the wire
      e.preventDefault();
      deleteWire(B.selectedWire);
      commit();
    } else if (B.selected) {
      e.preventDefault();
      deleteComponent(B.selected);
      commit();
    }
  }
}

// ---------------------------------------------------------------- render: all
function renderAll() {
  renderTopbar();
  renderPalette();
  renderStage();
  renderSide();
  updateHint();
}

function renderTopbar() {
  const sel = B.topSel;
  sel.innerHTML = "";
  for (const name of Object.keys(B.store.designs)) {
    const o = el("option", null, name);
    o.value = name;
    if (name === B.name) o.selected = true;
    sel.appendChild(o);
  }
  B.bBuild.classList.toggle("active", B.mode === "build");
  B.bRun.classList.toggle("active", B.mode === "run");
  updateUndoButtons();
}

function renderPalette() {
  const p = B.palette;
  p.innerHTML = "";
  p.appendChild(el("div", "cb-rail-title", "PARTS"));
  for (const item of PALETTE) {
    const b = el("button", "cb-part" + (B.tool === item.tool ? " armed" : ""));
    b.dataset.tool = item.tool;
    b.title = B.tool === item.tool ? "Armed — click the canvas to place (click again to cancel)" : `Place a ${item.name}`;
    const ic = el("span", "cb-part-icon");
    ic.innerHTML = paletteIcon(item.tool);
    b.appendChild(ic);
    const tx = el("span", "cb-part-text");
    tx.appendChild(el("span", "cb-part-name", item.name));
    tx.appendChild(el("span", "cb-part-sub", item.sub));
    b.appendChild(tx);
    b.addEventListener("click", () => {
      if (B.mode !== "build") setMode("build");
      B.tool = B.tool === item.tool ? null : item.tool;
      B.pending = null;
      renderPalette(); renderStage(); updateHint();
    });
    p.appendChild(b);
  }
}

// ---------------------------------------------------------------- wire layer
// Replace the renderer's node-star stubs with the routed point-to-point wires.
// Registered into view.leadEls / junctionEls so applyState() colors them with
// the exact hot/return/energized language the lessons use.
const routePathD = (pts) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");

function replaceWireLayer(view, mode) {
  const svg = view.svg;
  if (view.gWires) view.gWires.remove();
  if (view.gJunc) view.gJunc.remove();
  view.leadEls = view.leadEls.filter((le) => le.path.isConnected);   // keep symbol-internal leads
  view.junctionEls = [];
  const routes = routeAllWires();
  const gR = svgEl("g", { class: "cb-wires" });
  const gJ = svgEl("g", { class: "cb-junctions" });
  const segsAll = [];
  for (const r of routes) {
    const d = routePathD(r.pts);
    const sel = mode === "build" && B.selectedWire === r.wire.id;
    const g = svgEl("g", { class: "cb-wireg" + (sel ? " selected" : ""), "data-wire": r.wire.id, "data-node": r.netId });
    if (sel) g.appendChild(svgEl("path", { class: "cb-wire-halo", d }));
    const base = svgEl("path", { class: "wire cb-wire", d, "data-node": r.netId });
    const flow = svgEl("path", { class: "wire-flow", d, "data-node": r.netId });
    const hit = svgEl("path", { class: "wire-hit", d, "data-node": r.netId, "data-wire": r.wire.id });
    hit.appendChild(svgEl("title", {}, mode === "build"
      ? "Wire — click to select (✕ or Delete removes it)"
      : "Wire — click to land a meter lead here"));
    if (mode === "build") {
      g.addEventListener("click", (e) => { e.stopPropagation(); selectWire(r.wire.id); });
    } else {
      g.addEventListener("click", (e) => {
        const p = svgPoint(B.svg, e);
        if (view.onWireProbe) view.onWireProbe(r.netId, { x: p.x, y: p.y });
      });
    }
    g.appendChild(base); g.appendChild(flow); g.appendChild(hit);
    gR.appendChild(g);
    view.leadEls.push({ path: base, flow, nodeId: r.netId });
    for (const s of pathSegs(r.pts)) segsAll.push(s);
  }
  for (const j of junctionPoints()) {
    const c = svgEl("circle", { class: "junction", cx: j.x, cy: j.y, r: 3.4, "data-node": j.nodeId });
    gJ.appendChild(c);
    const hit = svgEl("circle", { class: "junction-hit", cx: j.x, cy: j.y, r: 11, "data-node": j.nodeId });
    if (mode === "build") {
      hit.appendChild(svgEl("title", {}, "Junction — click to disconnect a leg"));
      hit.addEventListener("click", (e) => {
        e.stopPropagation();
        B.lastClient = { x: e.clientX, y: e.clientY };
        openNodePopover(j.nodeId);
      });
    } else {
      hit.addEventListener("click", () => { if (view.onWireProbe) view.onWireProbe(j.nodeId, { x: j.x, y: j.y }); });
    }
    gJ.appendChild(hit);
    view.junctionEls.push({ circle: c, nodeId: j.nodeId });
  }
  svg.insertBefore(gR, view.gComps);
  svg.insertBefore(gJ, view.gComps);
  view._wireSegs = segsAll;      // photo chips (run mode) dodge the REAL copper
  B.routes = routes;
  return routes;
}

// ---- swinging contact blades: rest -> pulled-in, tweened like real hardware ----
function addBlades(view) {
  for (const [, rec] of view.compEls) {
    if (!["contact_no", "contact_nc", "pushbutton"].includes(rec.type)) continue;
    const cx = rec.comp.x, cy = rec.comp.y;
    const blade = svgEl("line", { class: "cb-blade", x1: cx - 8, y1: cy, x2: cx + 5, y2: cy - 11 });
    rec.g.appendChild(blade);
    rec.bladeEl = blade;
  }
}
function bladeTarget(rec, closed) {
  const cx = rec.comp.x, cy = rec.comp.y;
  return closed ? { x: cx + 8, y: cy } : { x: cx + 5, y: cy - 11 };
}
function setBlades(view, st, animate) {
  for (const [id, rec] of view.compEls) {
    if (!rec.bladeEl) continue;
    const closed = st
      ? !!st.contactClosed.get(id)
      : rec.type === "contact_nc" || (rec.type === "pushbutton" && rec.comp.contact === "NC");
    const t = bladeTarget(rec, closed);
    if (animate) tweenLineEnd(rec.bladeEl, t.x, t.y);
    else { rec.bladeEl.setAttribute("x2", t.x); rec.bladeEl.setAttribute("y2", t.y); }
  }
}
function tweenLineEnd(el, tx, ty, ms = 260) {
  if (el._raf) cancelAnimationFrame(el._raf);
  const x0 = +el.getAttribute("x2"), y0 = +el.getAttribute("y2");
  if (Math.abs(x0 - tx) < 0.01 && Math.abs(y0 - ty) < 0.01) return;
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    const e = 1 - Math.pow(1 - k, 3);                      // ease-out, like a snap-action spring
    el.setAttribute("x2", (x0 + (tx - x0) * e).toFixed(2));
    el.setAttribute("y2", (y0 + (ty - y0) * e).toFixed(2));
    el._raf = k < 1 ? requestAnimationFrame(step) : 0;
  };
  el._raf = requestAnimationFrame(step);
}

// ---- live BUILD-mode electrical paint: solve at rest, color the copper ----
function restSolve() {
  try { return solve(B.circuit, { pressed: new Set(), prevCoil: new Map() }); }
  catch { return null; }
}
function paintBuildState(view) {
  addBlades(view);
  const st = restSolve();
  if (!st) { setBlades(view, null, false); return null; }
  view.applyState(st);
  // polarity legibility: return-tied copper draws DARK even with no current
  const markReturn = (elm, nid) => {
    if (st.negSet.has(nid) && !st.posSet.has(nid) && !st.flowNodes.has(nid)) elm.classList.add("return");
  };
  for (const { path, nodeId } of view.leadEls) markReturn(path, nodeId);
  for (const { circle, nodeId } of view.junctionEls) markReturn(circle, nodeId);
  // a no-load bridge from + to −: paint that copper unmistakably
  const shortNets = new Set([...st.posSet].filter((n) => st.negSet.has(n)));
  if (shortNets.size) {
    for (const { path, nodeId } of view.leadEls) if (shortNets.has(nodeId)) path.classList.add("cb-short");
    for (const { circle, nodeId } of view.junctionEls) if (shortNets.has(nodeId)) circle.classList.add("cb-short");
  }
  setBlades(view, st, false);
  return st;
}

// ---- +/− badges at the supply and L/N tags on the rail wires ----
function drawPolarityBadges(layer) {
  const src = comps().find((c) => c.type === "source");
  if (!src) return;
  const pos = terminalPoint(src, "pos"), neg = terminalPoint(src, "neg");
  const mk = (cls, x, y, txt, tip) => {
    const g = svgEl("g", { class: "cb-polbadge " + cls });
    g.appendChild(svgEl("circle", { cx: x, cy: y, r: 8 }));
    g.appendChild(svgEl("text", { x, y: y + 4.5, "text-anchor": "middle" }, txt));
    g.appendChild(svgEl("title", {}, tip));
    layer.appendChild(g);
  };
  mk("pos", pos.x + 17, pos.y + 6, "+", "Positive (hot) terminal — wires from here draw RED");
  mk("neg", neg.x + 17, neg.y - 6, "−", "Negative (return) terminal — wires to here draw DARK");
}
function drawWireTags(layer) {
  const src = comps().find((c) => c.type === "source");
  if (!src) return;
  const Lnet = src.terminals.pos, Nnet = src.terminals.neg;
  for (const r of B.routes || []) {
    const isL = r.netId === Lnet, isN = r.netId === Nnet;
    if (!isL && !isN) continue;
    let bestSeg = null, bestLen = -1;
    for (const s of pathSegs(r.pts)) { const L = segLen(s); if (L > bestLen) { bestLen = L; bestSeg = s; } }
    if (!bestSeg || bestLen < 34) continue;
    const mx = (bestSeg.x1 + bestSeg.x2) / 2, my = (bestSeg.y1 + bestSeg.y2) / 2;
    const horiz = bestSeg.y1 === bestSeg.y2;
    const tx = horiz ? mx : mx + 13, ty = horiz ? my - 13 : my;
    const g = svgEl("g", { class: "cb-wtag " + (isL ? "l" : "n") });
    g.appendChild(svgEl("rect", { x: tx - 8, y: ty - 7, width: 16, height: 14, rx: 3.5 }));
    g.appendChild(svgEl("text", { x: tx, y: ty + 3.5, "text-anchor": "middle" }, isL ? "L" : "N"));
    g.appendChild(svgEl("title", {}, isL ? "L — the hot rail from the + terminal" : "N — the return rail to the − terminal"));
    layer.appendChild(g);
  }
}

function selectWire(id) {
  if (B.mode !== "build") return;
  B.selected = null;
  B.pending = null;
  endRubber();
  B.selectedWire = id;
  renderStage();
  updateHint();
}

// ---------------------------------------------------------------- render: stage
function computeViewBox() {
  // union of the content bbox and a FIXED default sheet: the sheet never jumps
  // around while placing parts (stable click targets), and only grows when a
  // design outruns it
  let x0 = 40, y0 = 30, x1 = 40 + 780, y1 = 30 + 480;
  const pad = 60;
  for (const n of nodes()) {
    x0 = Math.min(x0, n.x - pad); y0 = Math.min(y0, n.y - pad);
    x1 = Math.max(x1, n.x + pad); y1 = Math.max(y1, n.y + pad);
  }
  for (const c of comps()) {
    x0 = Math.min(x0, c.x - pad); y0 = Math.min(y0, c.y - pad - 16);
    x1 = Math.max(x1, c.x + pad); y1 = Math.max(y1, c.y + pad + 16);
  }
  for (const r of B.routes || []) for (const p of r.pts) {
    x0 = Math.min(x0, p.x - 24); y0 = Math.min(y0, p.y - 24);
    x1 = Math.max(x1, p.x + 24); y1 = Math.max(y1, p.y + 24);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function renderStage() {
  const svg = B.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  B.view = null;
  B.rubberEl = null;                            // cleared with the children above
  svg.classList.remove("cb-wiring");
  svg.classList.toggle("cb-build", B.mode !== "run");
  if (B.mode === "run") { renderRunStage(); return; }

  if (comps().length) {
    B.view = new CircuitView(svg);
    B.view.build(B.circuit);
    // build mode: strip run-only chrome; wires become first-class objects
    if (B.view.gPhotos) B.view.gPhotos.remove();
    if (B.view.photoToggle) B.view.photoToggle.remove();
    if (B.view.gTerms) B.view.gTerms.remove();
    B.view.onWireProbe = (nodeId, pt) => openNodePopover(nodeId, pt);   // symbol-internal leads
    replaceWireLayer(B.view, "build");
    paintBuildState(B.view);
    addWireTitles(svg);
  } else {
    B.routes = [];
  }
  const vb = computeViewBox();
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
  drawBuilderLayer(svg, vb);
}

// hover tooltip on the symbol-internal leads (routed wires carry their own)
function addWireTitles(svg) {
  for (const w of svg.querySelectorAll(".wire-hit")) {
    if (w.querySelector("title")) continue;
    w.appendChild(svgEl("title", {}, "Wire — click a routed run to select it"));
  }
}

function drawBuilderLayer(svg, vb) {
  const layer = svgEl("g", { class: "cb-layer" });

  if (!comps().length) {
    const hint = svgEl("text", { class: "cb-empty-hint", x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 - 12, "text-anchor": "middle" },
      "Blank sheet — pick a part on the left, then click here to place it.");
    const hint2 = svgEl("text", { class: "cb-empty-hint2", x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 + 14, "text-anchor": "middle" },
      "Wire parts by dragging between terminal dots. Flip to ▶ RUN to bring it to life.");
    layer.appendChild(hint); layer.appendChild(hint2);
  }

  // --- drag / select hit zones + selection ring ---
  for (const comp of comps()) {
    const hit = svgEl("rect", {
      class: "cb-draghit", "data-comp": comp.id,
      x: comp.x - 30, y: comp.y - 36, width: 60, height: 72, rx: 9,
    });
    const tip = svgEl("title", {}, `${comp.label || comp.id} — drag to move · click to select · double-click to rename`);
    hit.appendChild(tip);
    hit.addEventListener("pointerdown", (e) => startDrag(comp.id, e));
    hit.addEventListener("dblclick", (e) => { e.preventDefault(); renameComponent(comp.id); });
    layer.appendChild(hit);

    if (B.selected === comp.id) {
      layer.appendChild(svgEl("rect", {
        class: "cb-sel-ring", x: comp.x - 34, y: comp.y - 40, width: 68, height: 80, rx: 11,
      }));
      const del = svgEl("g", { class: "cb-delbtn", "data-del": comp.id });
      del.appendChild(svgEl("circle", { cx: comp.x + 34, cy: comp.y - 40, r: 9.5 }));
      del.appendChild(svgEl("text", { x: comp.x + 34, y: comp.y - 36, "text-anchor": "middle" }, "✕"));
      const dt = svgEl("title", {}, `Remove ${comp.label || comp.id}`);
      del.appendChild(dt);
      del.addEventListener("pointerdown", (e) => e.stopPropagation());
      del.addEventListener("click", (e) => { e.stopPropagation(); deleteComponent(comp.id); commit(); });
      layer.appendChild(del);
    }
  }

  // --- coil-picker chips on contacts ---
  for (const comp of comps()) {
    if (comp.type !== "contact_no" && comp.type !== "contact_nc") continue;
    const missing = !comp.coil || !comps().some((k) => k.type === "coil" && k.id === comp.coil);
    const g = svgEl("g", { class: "cb-coilchip" + (missing ? " missing" : ""), "data-comp": comp.id });
    g.appendChild(svgEl("rect", { x: comp.x - 31, y: comp.y - 50, width: 62, height: 17, rx: 8.5 }));
    g.appendChild(svgEl("text", { x: comp.x, y: comp.y - 37.5, "text-anchor": "middle" },
      comp.coil ? `⚡ ${comp.coil}` : "coil?"));
    const t = svgEl("title", {}, "Which coil drives this contact — click to cycle through the placed coils");
    g.appendChild(t);
    g.addEventListener("pointerdown", (e) => e.stopPropagation());
    g.addEventListener("click", (e) => { e.stopPropagation(); cycleContactCoil(comp); commit(); });
    layer.appendChild(g);
  }

  // --- terminal dots (the wiring UI) ---
  for (const comp of comps()) {
    for (const t of componentTerminals(comp)) {
      const open = nodeDegree(t.nodeId) === 1;
      const isPending = B.pending && B.pending.compId === comp.id && B.pending.term === t.name;
      const g = svgEl("g", {
        class: "cb-termg" + (open ? " open" : " wired") + (isPending ? " pending" : ""),
        "data-comp": comp.id, "data-term": t.name,
      });
      if (isPending) g.appendChild(svgEl("circle", { class: "cb-term-pulse", cx: t.x, cy: t.y, r: 11 }));
      g.appendChild(svgEl("circle", { class: "cb-term", cx: t.x, cy: t.y, r: 5 }));
      // big invisible hit target (same pattern as renderer.js term-hits, fatter)
      const hit = svgEl("circle", { class: "cb-term-hit", cx: t.x, cy: t.y, r: 16 });
      const tip = svgEl("title", {}, `${comp.label || comp.id} · ${t.name} — ${open ? "UNWIRED. " : ""}Drag to another dot to wire (or click here, then click the far dot)`);
      hit.appendChild(tip);
      hit.addEventListener("pointerdown", (e) => startWire({ compId: comp.id, term: t.name }, e));
      g.appendChild(hit);
      layer.appendChild(g);
    }
  }

  // --- placement layer (topmost while a tool is armed) ---
  if (B.tool) {
    const place = svgEl("rect", {
      class: "cb-placelayer", x: vb.x, y: vb.y, width: vb.w, height: vb.h, fill: "transparent",
    });
    const ghost = svgEl("g", { class: "cb-ghost" });
    const gr = svgEl("rect", { x: -32, y: -28, width: 64, height: 56, rx: 8 });
    const gt = svgEl("text", { x: 0, y: 44, "text-anchor": "middle" },
      (PALETTE.find((p) => p.tool === B.tool) || {}).name || B.tool);
    ghost.appendChild(gr); ghost.appendChild(gt);
    ghost.setAttribute("visibility", "hidden");
    place.addEventListener("pointermove", (e) => {
      const p = svgPoint(B.svg, e);
      ghost.setAttribute("transform", `translate(${snap(p.x)}, ${snap(p.y)})`);
      ghost.setAttribute("visibility", "visible");
    });
    place.addEventListener("pointerleave", () => ghost.setAttribute("visibility", "hidden"));
    place.addEventListener("click", (e) => {
      const p = svgPoint(B.svg, e);
      const comp = placeComponent(B.tool, p.x, p.y);
      B.tool = null;
      B.selected = comp.id;
      B.selectedWire = null;
      commit();
      renderPalette();
    });
    layer.appendChild(ghost);
    layer.appendChild(place);
  }

  // --- polarity chrome: +/− badges at the supply, L/N tags on the rails ---
  drawPolarityBadges(layer);
  drawWireTags(layer);

  // --- selected wire: ✕ removes it, ✂ opens the leg-disconnect popover ---
  if (B.selectedWire) {
    const r = (B.routes || []).find((x) => x.wire.id === B.selectedWire);
    if (r) {
      const mid = routeMidpoint(r.pts);
      const mkBadge = (cls, x, y, glyph, tip, fn) => {
        const g = svgEl("g", { class: cls });
        g.appendChild(svgEl("circle", { cx: x, cy: y, r: 9.5 }));
        g.appendChild(svgEl("text", { x, y: y + 4, "text-anchor": "middle" }, glyph));
        g.appendChild(svgEl("title", {}, tip));
        g.addEventListener("pointerdown", (e) => e.stopPropagation());
        g.addEventListener("click", (e) => { e.stopPropagation(); fn(e); });
        layer.appendChild(g);
      };
      mkBadge("cb-delbtn cb-wiredel", mid.x - 13, mid.y - 17, "✕",
        "Remove JUST this wire (parts stay put)",
        () => { deleteWire(B.selectedWire); commit(); });
      mkBadge("cb-cutbtn", mid.x + 13, mid.y - 17, "✂",
        "Disconnect a leg of this wire",
        (e) => { B.lastClient = { x: e.clientX, y: e.clientY }; openWirePopover(r.wire); });
    }
  }

  svg.appendChild(layer);
  // click-click mode survives re-renders: re-anchor the rubber band
  if (B.pending) beginRubber(B.pending);
}

// halfway point along a routed polyline (badge anchor)
function routeMidpoint(pts) {
  const segs = pathSegs(pts);
  let total = 0;
  for (const s of segs) total += segLen(s);
  let walk = total / 2;
  for (const s of segs) {
    const L = segLen(s);
    if (walk <= L) {
      const k = L ? walk / L : 0;
      return { x: s.x1 + (s.x2 - s.x1) * k, y: s.y1 + (s.y2 - s.y1) * k };
    }
    walk -= L;
  }
  return pts[0] || { x: 0, y: 0 };
}

// ---------------------------------------------------------------- wiring
// BOTH idioms, like every real circuit sim: press a dot and DRAG to another
// dot (live rubber band, release to connect), or click a dot then click the
// second one (rubber band trails the cursor between clicks). Esc or the same
// dot cancels; dropping a drag off-target cancels with a toast that says
// exactly what to do instead.
function startWire(ref, e) {
  e.stopPropagation();
  if (B.mode !== "build") return;
  e.preventDefault();
  if (B.pending) { finishWire(ref); return; }   // second click of click-click
  const sx = e.clientX, sy = e.clientY;
  let dragging = false;
  const onMove = (ev) => {
    if (!dragging && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 5) {
      dragging = true;
      beginRubber(ref);
    }
    if (dragging) updateRubber(ev);
  };
  const onUp = (ev) => {
    if (B.wireDragCancel === cancel) B.wireDragCancel = null;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (!dragging) {                            // plain click — arm click-click
      B.pending = ref;
      renderStage(); updateHint();
      return;
    }
    const drop = dropTargetAt(ev.clientX, ev.clientY);
    endRubber();
    if (drop && !(drop.compId === ref.compId && drop.term === ref.term)) {
      if (addWire(ref, drop)) { wireSucceeded(ref, drop); return; }
      // addWire set its own flash ("already on the same wire")
    } else {
      showToast("Wire cancelled — drop on a terminal dot");
    }
    renderStage(); updateHint();
  };
  // Esc mid-drag must cancel for REAL: removing the rubber band alone left
  // these listeners alive, so the eventual release still added the wire AFTER
  // the UI said "cancelled". onKeyDown's Escape branch calls this instead.
  const cancel = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    B.wireDragCancel = null;
    dragging = false;
    endRubber();
  };
  B.wireDragCancel = cancel;
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// second dot of the click-click idiom (same dot = cancel, like always)
function finishWire(ref) {
  const from = B.pending;
  B.pending = null;
  endRubber();
  if (!(from.compId === ref.compId && from.term === ref.term) && addWire(from, ref)) {
    wireSucceeded(from, ref);
    return;
  }
  renderStage(); updateHint();
}

function wireSucceeded(a, b) {
  setFlash(`✓ Connected ${labelOf(a.compId)} · ${a.term} ↔ ${labelOf(b.compId)} · ${b.term}`);
  if (B.coachEl) hideCoach(true);               // first real wire = coach done
  commit();
}

// what terminal (if any) sits under a client point — the drag drop test
function dropTargetAt(cx, cy) {
  const elAt = document.elementFromPoint(cx, cy);
  const g = elAt && elAt.closest ? elAt.closest(".cb-termg") : null;
  if (!g) return null;
  return { compId: g.getAttribute("data-comp"), term: g.getAttribute("data-term") };
}

// ---- the rubber band itself ----
function beginRubber(ref) {
  endRubber();
  const comp = compById(ref.compId);
  if (!comp) return;
  const p = terminalPoint(comp, ref.term);
  const g = svgEl("g", { class: "cb-rubber" });
  g.appendChild(svgEl("line", { class: "cb-rubber-line", x1: p.x, y1: p.y, x2: p.x, y2: p.y }));
  g.appendChild(svgEl("circle", { class: "cb-rubber-end", cx: p.x, cy: p.y, r: 4.5 }));
  B.svg.appendChild(g);
  B.rubberEl = g;
  B.svg.classList.add("cb-wiring");
}
function updateRubber(ev) {
  if (!B.rubberEl) return;
  const p = svgPoint(B.svg, ev);
  const line = B.rubberEl.querySelector(".cb-rubber-line");
  line.setAttribute("x2", p.x); line.setAttribute("y2", p.y);
  const end = B.rubberEl.querySelector(".cb-rubber-end");
  end.setAttribute("cx", p.x); end.setAttribute("cy", p.y);
}
function endRubber() {
  if (B.rubberEl) B.rubberEl.remove();
  B.rubberEl = null;
  B.svg.classList.remove("cb-wiring");
}

// wire / junction clicked in build mode → offer to disconnect a leg
function openNodePopover(nodeId) {
  const legs = terminalsOnNode(nodeId);
  const old = B.stageWrap.querySelector(".cb-pop");
  if (old) old.remove();
  if (legs.length < 2) { setFlash("That wire leg only touches one terminal — nothing to disconnect."); updateHint(); return; }
  const pop = el("div", "cb-pop");
  pop.appendChild(el("div", "cb-pop-title", "This wire connects:"));
  for (const leg of legs) {
    const b = el("button", "cb-pop-btn", `✂ ${labelOf(leg.compId)} · ${leg.term}`);
    b.title = "Cut this leg off the wire";
    b.addEventListener("click", () => {
      disconnectTerminal(leg.compId, leg.term);
      pop.remove();
      commit();
    });
    pop.appendChild(b);
  }
  const close = el("button", "cb-pop-close", "✕");
  close.addEventListener("click", () => pop.remove());
  pop.appendChild(close);
  B.stageWrap.appendChild(pop);
  positionPopover(pop, legs.length);
}

// leg-disconnect popover for ONE selected wire (its two endpoints)
function openWirePopover(w) {
  const old = B.stageWrap.querySelector(".cb-pop");
  if (old) old.remove();
  const pop = el("div", "cb-pop");
  pop.appendChild(el("div", "cb-pop-title", "This wire connects:"));
  for (const leg of [w.a, w.b]) {
    const b = el("button", "cb-pop-btn", `✂ ${labelOf(leg.c)} · ${leg.t}`);
    b.title = "Cut this leg loose (removes every wire on this terminal)";
    b.addEventListener("click", () => {
      disconnectTerminal(leg.c, leg.t);
      pop.remove();
      commit();
    });
    pop.appendChild(b);
  }
  const close = el("button", "cb-pop-close", "✕");
  close.addEventListener("click", () => pop.remove());
  pop.appendChild(close);
  B.stageWrap.appendChild(pop);
  positionPopover(pop, 2);
}

function positionPopover(pop, nRows) {
  const wr = B.stageWrap.getBoundingClientRect();
  const px = Math.min(Math.max(B.lastClient.x - wr.left, 8), wr.width - 190);
  const py = Math.min(Math.max(B.lastClient.y - wr.top, 8), wr.height - (40 + nRows * 34));
  pop.style.left = px + "px";
  pop.style.top = py + "px";
}

// ---------------------------------------------------------------- drag to move
function startDrag(compId, e) {
  if (B.mode !== "build") return;
  e.preventDefault();
  const comp = compById(compId);
  if (!comp) return;
  const start = svgPoint(B.svg, e);
  const ox = comp.x - start.x, oy = comp.y - start.y;
  let moved = false, raf = 0;
  const onMove = (ev) => {
    const p = svgPoint(B.svg, ev);
    const nx = snap(p.x + ox), ny = snap(p.y + oy);
    if (nx === comp.x && ny === comp.y) return;
    if (Math.abs(nx - comp.x) + Math.abs(ny - comp.y) > 0) moved = true;
    moveComponent(comp, nx, ny);
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; redrawKeepViewBox(); });
  };
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (moved) { commit(); return; }
    // manual double-click detection: a plain click re-renders the stage, which
    // replaces this hit element — a native dblclick would never fire on it
    const now = performance.now();
    if (B.lastClick && B.lastClick.compId === compId && now - B.lastClick.t < 450) {
      B.lastClick = null;
      renameComponent(compId);
      return;
    }
    B.lastClick = { compId, t: now };
    // click SELECTS, always — never a toggle. Clicking the part you just
    // placed (already auto-selected) must not silently drop the selection,
    // or the Delete key/✕ badge "do nothing" for the exact user who is
    // trying to learn them. Deselect = click empty canvas, or Esc.
    B.selected = compId;
    B.selectedWire = null;
    renderStage(); updateHint();
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

// during a drag: rebuild the picture but FREEZE the viewBox (no coordinate feedback)
function redrawKeepViewBox() {
  const vbAttr = B.svg.getAttribute("viewBox");
  const svg = B.svg;
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  B.view = null;
  B.rubberEl = null;
  if (comps().length) {
    B.view = new CircuitView(svg);
    B.view.build(B.circuit);
    if (B.view.gPhotos) B.view.gPhotos.remove();
    if (B.view.photoToggle) B.view.photoToggle.remove();
    if (B.view.gTerms) B.view.gTerms.remove();
    B.view.onWireProbe = (nodeId, pt) => openNodePopover(nodeId, pt);
    replaceWireLayer(B.view, "build");
    paintBuildState(B.view);
    addWireTitles(svg);
  }
  if (vbAttr) svg.setAttribute("viewBox", vbAttr);
  const p = (vbAttr || "0 0 800 500").split(/\s+/).map(Number);
  drawBuilderLayer(svg, { x: p[0], y: p[1], w: p[2], h: p[3] });
}

// ---------------------------------------------------------------- rename / flash
function renameComponent(compId) {
  const comp = compById(compId);
  if (!comp) return;
  askText(`Rename ${comp.label || comp.id}`, "Label on the print (like CR1, S1 Start, FU1):", comp.label || comp.id, (val) => {
    comp.label = val.trim() || comp.id;
    commit();
  });
}

function setFlash(msg) { B.flash = msg; }

function updateHint() {
  if (B.mode === "run") return;   // run mode owns the bottom bar
  const bar = B.bottom;
  bar.innerHTML = "";
  bar.className = "cb-bottombar cb-hintbar";
  let msg;
  if (B.flash) { msg = B.flash; B.flash = null; bar.classList.add("flash"); }
  else if (B.tool) msg = `Placing ${(PALETTE.find((p) => p.tool === B.tool) || {}).name || B.tool} — click the canvas grid. Esc or re-click the part to cancel.`;
  else if (B.pending) msg = `Wiring from ${labelOf(B.pending.compId)} · ${B.pending.term} — click a second terminal dot to connect (same dot or Esc cancels).`;
  else if (B.selectedWire) msg = "Wire selected — ✕ badge or Delete key removes JUST this wire · ✂ disconnects one leg · Ctrl+Z undoes.";
  else if (B.selected) msg = `${labelOf(B.selected)} selected — drag to move · double-click to rename · Delete key or ✕ removes.`;
  else msg = "Click a part on the left to place it · drag between terminal dots to wire · click a wire to select it · Ctrl+Z undoes.";
  bar.appendChild(el("span", "cb-hint-text", msg));
}

// ---------------------------------------------------------------- run mode
function setMode(mode) {
  if (B.mode === mode) return;
  if (mode === "run") {
    // RUN is always clickable — but a circuit that can't run answers with a
    // toast AND drags the mistake panel into view with the blockers lit up,
    // so "nothing happened" never happens.
    const res = analyzeCircuit(B.circuit);
    if (res.empty || res.errors.length) {
      showToast(res.empty
        ? "Nothing to run yet — place parts and wire them first."
        : `Can't run yet — fix the ${res.errors.length === 1 ? "red item" : res.errors.length + " red items"} in LIVE CHECKS.`);
      revealChecks();
      return;
    }
  }
  B.mode = mode;
  B.tool = null; B.pending = null; B.selected = null;
  if (mode === "run") B.run = { pressed: new Set(), prevCoil: new Map(), meter: new Meter(), ptA: null, ptB: null };
  renderTopbar(); renderPalette(); renderStage(); updateHint();
  if (mode === "run") {
    showRunBanner();
    if (B.coachEl) hideCoach(true);   // they reached step 3 — coach done
  } else {
    hideRunBanner();
  }
}

// scroll the LIVE CHECKS panel into view and light up the blocking rows
function revealChecks() {
  renderSide();
  const panel = B.side.querySelector(".cb-checks");
  if (!panel) return;
  const rows = panel.querySelectorAll(".cb-check.err");
  rows.forEach((r) => r.classList.add("cb-blocking"));
  (rows[0] || panel).scrollIntoView({ block: "nearest" });
}

// the unmissable "it's alive" state while running
function showRunBanner() {
  hideRunBanner();
  const b = el("div", "cb-runbanner");
  b.appendChild(el("span", "cb-runbanner-dot"));
  b.appendChild(el("span", "cb-runbanner-txt", "CIRCUIT LIVE — press your buttons"));
  B.canvasCard.appendChild(b);
}
function hideRunBanner() {
  const b = B.canvasCard && B.canvasCard.querySelector(".cb-runbanner");
  if (b) b.remove();
}

// ---------------------------------------------------------------- toast + coach
function showToast(msg) {
  const old = B.stageWrap.querySelector(".cb-toast");
  if (old) old.remove();
  const t = el("div", "cb-toast", msg);
  B.stageWrap.appendChild(t);
  clearTimeout(B._toastTimer);
  B._toastTimer = setTimeout(() => t.remove(), 2600);
}

function coachSeen() {
  try { return !!localStorage.getItem(COACH_KEY); } catch { return true; }
}
function showCoach() {
  if (B.coachEl) return;
  const c = el("div", "cb-coach");
  const steps = [
    ["1", "Click or drag a part onto the bench"],
    ["2", "Drag between terminal dots to wire"],
    ["3", "Press RUN and push your buttons"],
  ];
  steps.forEach(([n, txt], i) => {
    if (i) c.appendChild(el("span", "cb-coach-sep", "·"));
    const s = el("span", "cb-coach-step");
    s.appendChild(el("span", "cb-coach-num", n));
    s.appendChild(el("span", "cb-coach-txt", txt));
    c.appendChild(s);
  });
  const d = el("button", "cb-coach-dismiss", "✕ Got it");
  d.title = "Hide these tips (the ? button brings them back)";
  d.addEventListener("click", () => hideCoach(true));
  c.appendChild(d);
  B.stageWrap.insertBefore(c, B.stageWrap.firstChild);
  B.coachEl = c;
}
function hideCoach(remember) {
  if (remember) { try { localStorage.setItem(COACH_KEY, "1"); } catch { /* private mode */ } }
  if (B.coachEl) { B.coachEl.remove(); B.coachEl = null; }
}

function renderRunStage() {
  const svg = B.svg;
  if (!comps().length) {
    svg.setAttribute("viewBox", "0 0 780 480");
    svg.appendChild(svgEl("text", { class: "cb-empty-hint", x: 390, y: 236, "text-anchor": "middle" },
      "Nothing to run yet — flip back to 🛠 BUILD and place some parts."));
    renderRunBar();
    return;
  }
  const view = new CircuitView(svg);
  view.enableLeadChip = true;
  view.build(B.circuit);
  B.view = view;
  // routed drafting wires in RUN too — the glow follows the same copper the
  // learner drew, and the part photos re-place themselves around it
  replaceWireLayer(view, "run");
  try {
    view.photoChips = [];
    while (view.gPhotos.firstChild) view.gPhotos.removeChild(view.gPhotos.firstChild);
    if (view.photoToggle) { view.photoToggle.remove(); view.photoToggle = null; }
    view._buildPhotoChips();
    view._buildPhotoToggle();
  } catch { /* photo chips are decoration — never block the run */ }
  addBlades(view);
  const badges = svgEl("g", { class: "cb-runbadges" });
  drawPolarityBadges(badges);
  svg.insertBefore(badges, view.gProbes);
  view.onTestPointClick = (comp) => {
    const tp = view.testPoints.find((t) => t.compId === comp.id);
    placeRunProbe(comp.terminals.p, tp ? { x: tp.x, y: tp.y } : null);
    view.pulseTestPoint(comp.id);
  };
  view.onWireProbe = (nodeId, pt) => placeRunProbe(nodeId, pt);
  view.onProbeClear = (kind) => {
    if (kind === "a") { B.run.meter.probeA = null; B.run.ptA = null; }
    else { B.run.meter.probeB = null; B.run.ptB = null; }
    runUpdate();
  };
  bindButtons(view, {
    onPress: (id) => { B.run.pressed.add(id); runUpdate(); },
    onRelease: (id) => { B.run.pressed.delete(id); runUpdate(); },
  });
  renderRunBar();
  runUpdate();
}

// the meter lead lifecycle, same as the main app: red walks, black parks
function placeRunProbe(nodeId, pt) {
  const m = B.run.meter;
  if (m.probeA == null)      { m.probeA = nodeId; B.run.ptA = pt || null; }
  else if (m.probeB == null) { m.probeB = nodeId; B.run.ptB = pt || null; }
  else                       { m.probeA = nodeId; B.run.ptA = pt || null; }
  runUpdate();
}

function renderRunBar() {
  const bar = B.bottom;
  bar.innerHTML = "";
  bar.className = "cb-bottombar cb-runbar";
  const meterBox = el("div", "cb-meter");
  const val = el("span", "cb-meter-value", "--.--");
  const sub = el("span", "cb-meter-sub", "multimeter");
  meterBox.appendChild(val); meterBox.appendChild(sub);
  bar.appendChild(meterBox);
  const modes = el("div", "cb-meter-modes");
  for (const [m, label] of [["VDC", "VDC"], ["VAC", "VAC"], ["CONT", "Ω•))"]]) {
    const b = el("button", "cb-meter-mode" + (B.run.meter.mode === m ? " active" : ""), label);
    b.addEventListener("click", () => {
      B.run.meter.setMode(m);              // mode change lifts both leads…
      B.run.ptA = B.run.ptB = null;        // …so the glyphs lift too
      modes.querySelectorAll(".cb-meter-mode").forEach((x) => x.classList.toggle("active", x === b));
      runUpdate();
    });
    modes.appendChild(b);
  }
  bar.appendChild(modes);
  bar.appendChild(el("span", "cb-run-hint", "Press the buttons · probe any wire, junction, or terminal"));
  const spacer = el("div", "cb-spacer"); bar.appendChild(spacer);
  const reset = el("button", "cb-act", "↻ Reset run");
  reset.title = "Release everything, drop the latch, lift the leads";
  reset.addEventListener("click", () => {
    B.run.pressed.clear(); B.run.prevCoil = new Map();
    B.run.meter.reset(); B.run.ptA = B.run.ptB = null;
    runUpdate();
  });
  bar.appendChild(reset);
  B.runVal = val; B.runSub = sub;
}

function runUpdate() {
  if (B.mode !== "run" || !B.view || !comps().length) return;
  const input = { pressed: B.run.pressed, prevCoil: B.run.prevCoil };
  let st;
  try { st = solve(B.circuit, input); }
  catch (e) { console.error("builder run solve failed", e); return; }
  B.run.prevCoil = st.coilEnergized;      // persist coil state so a latch holds
  B.view.applyState(st);
  setBlades(B.view, st, true);            // blades physically swing on state changes
  B.view.setProbes(B.run.meter.probeA, B.run.meter.probeB);
  B.view.setProbeMarkers(B.run.ptA, B.run.ptB);
  B.view.setLeadState(B.run.meter.probeA != null, B.run.meter.probeB != null);
  const r = B.run.meter.read(st, B.circuit, input);
  if (B.runVal) { B.runVal.textContent = r.display; B.runSub.textContent = r.sub; }
}

// ---------------------------------------------------------------- side rail
function renderSide() {
  const side = B.side;
  side.innerHTML = "";

  // ---- live mistake panel ----
  const checks = el("div", "cb-checks");
  checks.appendChild(el("div", "cb-rail-title", "LIVE CHECKS"));
  const res = analyzeCircuit(B.circuit);
  if (res.empty) {
    checks.appendChild(el("div", "cb-check neutral", "Empty sheet — checks start the moment you place a part."));
  } else if (res.ok) {
    const pass = el("div", "cb-allpass");
    pass.innerHTML = `<span class="cb-allpass-icon">✓</span><span><b>ALL CHECKS PASS</b> — ready to run. Flip to ▶ RUN and press your buttons.</span>`;
    checks.appendChild(pass);
  } else {
    for (const t of res.errors)   checks.appendChild(mkCheck("err", t));
    for (const t of res.warnings) checks.appendChild(mkCheck("warn", t));
  }
  side.appendChild(checks);

  // ---- challenges ----
  const ch = el("div", "cb-challenges");
  ch.appendChild(el("div", "cb-rail-title", "CHALLENGES"));
  for (const c of CHALLENGES) {
    const card = el("div", "cb-chal");
    const head = el("div", "cb-chal-head");
    head.appendChild(el("span", "cb-chal-icon", c.icon));
    head.appendChild(el("span", "cb-chal-title", c.title));
    card.appendChild(head);
    card.appendChild(el("p", "cb-chal-blurb", c.blurb));

    const result = B.chalResults[c.id];
    const list = el("div", "cb-chal-reqs");
    if (result) {
      for (const r of result) {
        const row = el("div", "cb-chal-req " + (r.pass ? "pass" : "fail"));
        row.innerHTML = `<span class="cb-req-mark">${r.pass ? "✓" : "✕"}</span><span>${r.label}</span>`;
        list.appendChild(row);
      }
    } else {
      for (const r of c.grade(emptyCircuit())) {   // requirement labels, ungraded
        const row = el("div", "cb-chal-req todo");
        row.innerHTML = `<span class="cb-req-mark">•</span><span>${r.label}</span>`;
        list.appendChild(row);
      }
    }
    card.appendChild(list);

    const foot = el("div", "cb-chal-foot");
    const grade = el("button", "cb-grade", result ? "↻ Grade again" : "▶ Grade my circuit");
    grade.addEventListener("click", () => {
      let out;
      try { out = c.grade(B.circuit); }
      catch (e) { console.error("grader failed", e); out = c.grade(emptyCircuit()); }
      B.chalResults[c.id] = out;
      renderSide();
    });
    foot.appendChild(grade);
    if (result) {
      const all = result.every((r) => r.pass);
      foot.appendChild(el("span", "cb-chal-pill " + (all ? "pass" : "fail"),
        all ? "★ CHALLENGE PASSED" : `${result.filter((r) => r.pass).length}/${result.length} checks`));
    }
    card.appendChild(foot);
    ch.appendChild(card);
  }
  side.appendChild(ch);
}

function mkCheck(kind, text) {
  const row = el("div", "cb-check " + kind);
  row.innerHTML = `<span class="cb-check-icon">${kind === "err" ? "✕" : "⚠"}</span><span>${text}</span>`;
  return row;
}

// ---------------------------------------------------------------- commit
// every edit funnels through here: repaint, re-check, autosave, undo snapshot
function commit() {
  B.chalResults = {};          // edits invalidate old grades
  B._routeCache = null;
  renderStage();
  renderSide();
  updateHint();
  saveStore();
  pushHistory();
}

// ---------------------------------------------------------------- undo / redo
// A snapshot of the circuit JSON on every commit(); Ctrl+Z / Ctrl+Y (and the
// topbar ↶ ↷) walk the stack. One stack per open design, capped at 50.
const HIST_CAP = 50;

function initHistory() {
  B.hist = { stack: [JSON.stringify(B.circuit)], idx: 0 };
  updateUndoButtons();
}
function pushHistory() {
  const h = B.hist;
  if (!h) return;
  const snap = JSON.stringify(B.circuit);
  if (h.stack[h.idx] === snap) { updateUndoButtons(); return; }   // no-op edit
  h.stack.length = h.idx + 1;                                     // drop the redo tail
  h.stack.push(snap);
  while (h.stack.length > HIST_CAP) h.stack.shift();
  h.idx = h.stack.length - 1;
  updateUndoButtons();
}
function restoreFromHistory() {
  B.circuit = migrateCircuit(JSON.parse(B.hist.stack[B.hist.idx]));
  B.store.designs[B.name] = B.circuit;
  B.tool = null; B.pending = null; B.selected = null; B.selectedWire = null;
  B.chalResults = {};
  B._routeCache = null;
  renderStage();
  renderSide();
  updateHint();
  renderPalette();
  saveStore();
  updateUndoButtons();
}
function doUndo() {
  if (B.mode !== "build" || !B.hist || B.hist.idx <= 0) return;
  B.hist.idx--;
  restoreFromHistory();
}
function doRedo() {
  if (B.mode !== "build" || !B.hist || B.hist.idx >= B.hist.stack.length - 1) return;
  B.hist.idx++;
  restoreFromHistory();
}
function updateUndoButtons() {
  if (!B || !B.btnUndo) return;
  B.btnUndo.disabled = !(B.mode === "build" && B.hist && B.hist.idx > 0);
  B.btnRedo.disabled = !(B.mode === "build" && B.hist && B.hist.idx < B.hist.stack.length - 1);
}

// ---------------------------------------------------------------- design mgmt
function switchDesign(name) {
  if (!B.store.designs[name]) return;
  saveStore();
  B.name = name;
  B.circuit = migrateCircuit(B.store.designs[name]);
  B.store.current = name;
  B.tool = null; B.pending = null; B.selected = null; B.selectedWire = null; B.chalResults = {};
  B._routeCache = null;
  initHistory();
  if (B.mode === "run") B.run = { pressed: new Set(), prevCoil: new Map(), meter: new Meter(), ptA: null, ptB: null };
  renderAll();
  saveStore();
}

function uniqueName(base) {
  let name = base, i = 2;
  while (B.store.designs[name]) name = `${base} ${i++}`;
  return name;
}

function newDesign() {
  askText("New design", "Name it:", uniqueName("Design"), (val) => {
    const name = uniqueName(val.trim() || "Design");
    B.store.designs[name] = emptyCircuit();
    switchDesign(name);
  });
}

function duplicateDesign() {
  askText("Duplicate design", "Name for the copy:", uniqueName(`${B.name} copy`), (val) => {
    const name = uniqueName(val.trim() || `${B.name} copy`);
    B.store.designs[name] = JSON.parse(JSON.stringify(B.circuit));
    switchDesign(name);
  });
}

function renameDesign() {
  askText("Rename design", "New name:", B.name, (val) => {
    const name = val.trim();
    if (!name || name === B.name) return;
    const finalName = B.store.designs[name] ? uniqueName(name) : name;
    B.store.designs[finalName] = B.circuit;
    delete B.store.designs[B.name];
    B.name = finalName;
    B.store.current = finalName;
    renderTopbar();
    saveStore();
  });
}

function deleteDesign() {
  const body = el("div", "cb-modal-body");
  body.appendChild(el("p", "cb-modal-text", `Delete “${B.name}” for good? There is no undo.`));
  const row = el("div", "cb-modal-row");
  const yes = el("button", "cb-act cb-danger", "🗑 Delete it");
  yes.addEventListener("click", () => {
    delete B.store.designs[B.name];
    // switchDesign()'s first job is saveStore(), which writes the CURRENT
    // design back into the store — with B.name still set that silently
    // resurrected the design we just deleted. Null it so the delete sticks.
    B.name = null;
    const names = Object.keys(B.store.designs);
    if (!names.length) B.store.designs[uniqueName("My first circuit")] = emptyCircuit();
    closeModal();
    switchDesign(Object.keys(B.store.designs)[0]);
  });
  const no = el("button", "cb-act", "Keep it");
  no.addEventListener("click", closeModal);
  row.appendChild(yes); row.appendChild(no);
  body.appendChild(row);
  showModal("Delete design", body);
}

function exportDesign() {
  const body = el("div", "cb-modal-body");
  body.appendChild(el("p", "cb-modal-text", "Copy this JSON anywhere — paste it back with Import."));
  const ta = el("textarea", "cb-modal-ta");
  ta.readOnly = true;
  ta.value = JSON.stringify(B.circuit, null, 2);
  body.appendChild(ta);
  const row = el("div", "cb-modal-row");
  const copy = el("button", "cb-act", "⧉ Copy to clipboard");
  copy.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(ta.value); copy.textContent = "✓ Copied"; }
    catch { ta.select(); document.execCommand("copy"); copy.textContent = "✓ Copied"; }
  });
  const close = el("button", "cb-act", "Close");
  close.addEventListener("click", closeModal);
  row.appendChild(copy); row.appendChild(close);
  body.appendChild(row);
  showModal("Export design JSON", body);
}

function importDesign() {
  const body = el("div", "cb-modal-body");
  body.appendChild(el("p", "cb-modal-text", "Paste a design (a circuit JSON, or a whole lesson file — both work). It replaces this design's sheet."));
  const ta = el("textarea", "cb-modal-ta");
  ta.placeholder = '{ "nodes": [...], "components": [...] }';
  body.appendChild(ta);
  const err = el("p", "cb-modal-err", "");
  body.appendChild(err);
  const row = el("div", "cb-modal-row");
  const go = el("button", "cb-act cb-primary", "⇧ Import");
  go.addEventListener("click", () => {
    let data;
    try { data = JSON.parse(ta.value); }
    catch (e) { err.textContent = "That's not valid JSON — " + e.message; return; }
    const circuit = data && data.circuit ? data.circuit : data;
    if (!circuit || !Array.isArray(circuit.nodes) || !Array.isArray(circuit.components)) {
      err.textContent = "Expected { nodes: [...], components: [...] } (or a lesson file wrapping one).";
      return;
    }
    B.circuit = migrateCircuit(JSON.parse(JSON.stringify(circuit)));
    B.circuit.id = B.circuit.id || "builder";
    B.store.designs[B.name] = B.circuit;
    closeModal();
    B.tool = null; B.pending = null; B.selected = null; B.selectedWire = null;
    commit();
  });
  const close = el("button", "cb-act", "Cancel");
  close.addEventListener("click", closeModal);
  row.appendChild(go); row.appendChild(close);
  body.appendChild(row);
  showModal("Import design JSON", body);
}

// ---------------------------------------------------------------- modal kit
function showModal(title, bodyEl) {
  closeModal();
  const back = el("div", "cb-modal-back");
  const box = el("div", "cb-modal");
  box.appendChild(el("div", "cb-modal-title", title));
  box.appendChild(bodyEl);
  back.appendChild(box);
  back.addEventListener("pointerdown", (e) => { if (e.target === back) closeModal(); });
  B.root.appendChild(back);
  const firstInput = box.querySelector("input, textarea");
  if (firstInput) firstInput.focus();
}
function closeModal() {
  if (!B || !B.root) return;
  const m = B.root.querySelector(".cb-modal-back");
  if (m) m.remove();
}
function askText(title, label, initial, onOk) {
  const body = el("div", "cb-modal-body");
  body.appendChild(el("p", "cb-modal-text", label));
  const input = el("input", "cb-modal-input");
  input.type = "text";
  input.value = initial;
  input.maxLength = 48;
  body.appendChild(input);
  const row = el("div", "cb-modal-row");
  const ok = el("button", "cb-act cb-primary", "✓ OK");
  const go = () => { const v = input.value; closeModal(); onOk(v); };
  ok.addEventListener("click", go);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  const cancel = el("button", "cb-act", "Cancel");
  cancel.addEventListener("click", closeModal);
  row.appendChild(ok); row.appendChild(cancel);
  body.appendChild(row);
  showModal(title, body);
  input.select();
}
