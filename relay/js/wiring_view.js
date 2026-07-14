// =============================================================================
// wiring_view.js — the "Field Wiring" split view: the ladder print beside the
// SAME circuit drawn the way it physically lands in the panel — supply terminal
// strip → pushbutton screw terminals → the sealing device's NUMBERED terminals
// → back to the supply return. One continuous point-to-point run, no abstract
// gaps: every wire terminates on a visibly numbered screw.
//
// Two device scenes:
//   octal8    — CR sealing via an 8-pin octal socket. PIN TRUTH SOURCE is the
//               dpdt8 map in realistic_relay_octal.js (verified against the
//               750R cut sheets): coil A1=pin2 / A2=pin7; pole1 COM=1 NC=4 NO=3;
//               pole2 COM=8 NC=5 NO=6. Both poles are always drawn — a real
//               socket has all 8 screws; the non-seal pole is labeled with what
//               it does (spare, or the lamp pole), never hidden.
//   contactor — M sealing via its aux contact 13-14; coil A1 (top) / A2
//               (bottom); main poles 1/L1-2/T1 … de-emphasized gray power
//               section feeding the motor (three phases when spec asks).
//
// Both panes run on the ONE solve() state: main.js builds a full CircuitView
// into `schemSvg` (press/probe/meter identical to the normal schematic view)
// and forwards every solved state into applyState() here, so the panel wires
// glow with the same energized/return/hot semantics as the print.
// Self-contained: every class prefixed fw-, styles injected here (m22 pattern).
// =============================================================================

import { indexCircuit, normalizeCircuit } from "./model.js";

// The Field Wiring tab adds a pill to lessons whose tab bar was already within
// one tab-width of wrapping at the 980px app window (a wrapped bar crushes the
// stage below its 260px usability floor). Tighten the pills slightly at narrow
// viewports only — injected once at import (main.js loads this at startup) so
// it covers every view, not just this one.
const barFix = document.createElement("style");
barFix.textContent = `@media (max-width:1100px){ .view-tab{ padding:8px 11px; font-size:12.5px; } }`;
document.head.appendChild(barFix);

const SVGNS = "http://www.w3.org/2000/svg";
function E(n, a = {}, txt) {
  const e = document.createElementNS(SVGNS, n);
  for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}
function el(tag, cls) { const e = document.createElement(tag); if (cls) e.className = cls; return e; }

// dpdt8 truth (see header). Angles are the same socket-face positions the
// verified illustration uses, so this face matches Lesson 17's pin diagrams.
const OCTAL_ANGLE = { 1: 145, 2: 180, 3: 215, 4: 250, 5: 290, 6: 325, 7: 0, 8: 35 };
const OCTAL_COIL = { a1: 2, a2: 7 };
const OCTAL_POLES = [{ c: 1, nc: 4, no: 3 }, { c: 8, nc: 5, no: 6 }];

const CSS = `
.fw-root{
  /* width must be explicit: container-type:inline-size collapses an in-flow
     auto-width block to min-content (m22 avoids this via position:absolute) */
  width:100%; min-height:100%; display:flex; flex-direction:column; box-sizing:border-box;
  padding:18px 20px 20px; gap:12px;
  font-family:var(--font-display,"Inter",system-ui,sans-serif); color:var(--text,#303749);
  background:
    radial-gradient(900px 400px at 90% -10%, rgba(124,92,255,.06), transparent 60%),
    var(--bg,#F6F8FC);
  container-type:inline-size;
}
.fw-eyebrow{
  font-family:var(--font-mono,"JetBrains Mono",monospace); font-size:11px;
  letter-spacing:.18em; text-transform:uppercase; color:var(--violet-deep,#6D3FF0);
}
.fw-sub{ font-size:13px; color:var(--muted,#6B7488); margin:4px 0 0; max-width:860px; line-height:1.45; }
.fw-grid{ display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start; }
@container (max-width:760px){ .fw-grid{ grid-template-columns:1fr; } }
.fw-pane{
  background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3); border-radius:14px;
  box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.05)); padding:10px 12px 12px; min-width:0;
}
.fw-pane-label{
  font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.14em;
  text-transform:uppercase; color:var(--muted,#6B7488); margin:2px 2px 6px;
}
/* height cap keeps a stacked pane from towering past one narrow-shell screen;
   preserveAspectRatio letterboxes, so click coordinates stay true */
.fw-pane svg{ width:100%; height:auto; max-height:62vh; display:block; }
.fw-callout{
  background:var(--violet-soft,#F3EFFF); border:1px solid #D9CCFF; border-radius:12px;
  padding:11px 15px; font-size:13px; line-height:1.5; color:var(--ink,#0E1326);
}
.fw-callout b{ color:var(--violet-deep,#6D3FF0); }

/* ---- panel scenery ---- */
.fw-panel-bg{ fill:#EDF1F7; stroke:#D6DDEC; stroke-width:2; }
.fw-rail{ fill:#C9D2E0; stroke:#9AA6B8; stroke-width:1; }
.fw-rail-edge{ stroke:#9AA6B8; stroke-width:1; }
.fw-dev{ fill:#DCE3EE; stroke:#8A94A6; stroke-width:1.4; }
.fw-dev-light{ fill:#F4F7FB; stroke:#8A94A6; stroke-width:1.4; }
.fw-dev-name{ font-weight:700; font-size:14px; fill:var(--ink,#0E1326); }
.fw-dev-sub{ font-size:10.5px; fill:var(--muted,#6B7488); }
.fw-tab{ fill:#EDF1F7; stroke:#8A94A6; stroke-width:1.2; }
.fw-term-lbl{ font-family:var(--font-mono,monospace); font-size:12px; font-weight:700; fill:#3B4354; }
.fw-screw{ fill:#E9EDF4; stroke:#5E6778; stroke-width:1.6; }
.fw-slot{ stroke:#5E6778; stroke-width:1.6; stroke-linecap:round; }

/* ---- wires: same state language as the schematic ---- */
.fw-wire{ fill:none; stroke:#8A94A6; stroke-width:3; stroke-linecap:round; stroke-linejoin:round; }
.fw-wire.fw-power{ stroke:#BCC5D4; stroke-width:4.4; }
.fw-wire.hot{ stroke:#D89B95; }
.fw-wire.energized{ stroke:var(--live,#EF4444); filter:drop-shadow(0 0 3px rgba(239,68,68,.55)); }
.fw-wire.return{ stroke:#1F2937; }
.fw-junc{ fill:#5E6778; }
.fw-junc.hot{ fill:#D89B95; }
.fw-junc.energized{ fill:var(--live,#EF4444); }
.fw-junc.return{ fill:#1F2937; }
.fw-tag rect{ fill:#FFFFFF; stroke:#B9C2D2; stroke-width:1; }
.fw-tag text{ font-family:var(--font-mono,monospace); font-size:12px; font-weight:700; fill:#3B4354; }

/* ---- device internals (inside-the-part linkage, dashed) ---- */
.fw-int{ stroke:#94A3B8; stroke-width:1.6; stroke-dasharray:4 4; fill:none; }
.fw-blade{ stroke:#475569; stroke-width:3; stroke-linecap:round; }
.fw-blade.closed{ stroke:#334155; }                      /* made, but not necessarily hot */
.fw-blade.closed.hot{ stroke:var(--live,#EF4444); filter:drop-shadow(0 0 2px rgba(239,68,68,.5)); }
.fw-pole-spare{ opacity:.38; }
.fw-coilbody{ fill:#FFFFFF; stroke:#6B7488; stroke-width:1.6; }
.fw-coilbody.on{ stroke:var(--violet,#7C5CFF); fill:#F3EFFF; filter:drop-shadow(0 0 7px rgba(124,92,255,.5)); }
.fw-coiltext{ font-family:var(--font-mono,monospace); font-size:10.5px; font-weight:700; fill:#4B5563; }
.fw-plate{ fill:#F8FAFD; stroke:#8A94A6; stroke-width:2; }
.fw-hub{ fill:#E2E8F2; stroke:#9AA6B8; stroke-width:1.4; }
.fw-key{ fill:#C9D2E0; stroke:#9AA6B8; stroke-width:1; }
.fw-pin-num{ font-family:var(--font-mono,monospace); font-size:15px; font-weight:800; fill:#2B3345; }
.fw-pin-lbl{ font-family:var(--font-mono,monospace); font-size:13px; font-weight:800; fill:var(--violet-deep,#6D3FF0); }
.fw-role{ font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; fill:#6B7488; }
.fw-note{ font-size:11.5px; fill:#6B7488; font-style:italic; }
.fw-caption{ font-size:12.5px; font-weight:600; fill:#3B4354; }
.fw-sealtag rect{ fill:var(--violet-soft,#F3EFFF); stroke:#C9B6FF; stroke-width:1.2; }
.fw-sealtag text{ font-family:var(--font-mono,monospace); font-size:12px; font-weight:800; fill:var(--violet-deep,#6D3FF0); }

/* ---- contactor ---- */
.fw-ctr-body{ fill:#3E4653; stroke:#2B333D; stroke-width:2; }
.fw-strip{ fill:#DCE3EE; stroke:#8A94A6; stroke-width:1.2; }
.fw-plate2{ fill:#EDF1F7; stroke:#8A94A6; stroke-width:1; }
.fw-plate2-t{ font-size:11px; fill:#3B4354; }
.fw-plate2-big{ font-size:16px; font-weight:800; fill:var(--ink,#0E1326); }
.fw-body-note{ font-size:10.5px; fill:#C4CBD8; font-style:italic; }

/* ---- station buttons ---- */
.fw-btn{ cursor:pointer; }
.fw-btn:focus{ outline:none; }
.fw-op-ring{ fill:#CBD5E1; stroke:#8A94A6; stroke-width:1.4; }
.fw-op-stop{ fill:#DC2626; stroke:#991B1B; stroke-width:2; }
.fw-op-start{ fill:#16A34A; stroke:#166534; stroke-width:2; }
.fw-op-text{ font-size:11px; font-weight:800; fill:#FFFFFF; letter-spacing:.05em; }
.fw-op-cap{ transition:transform .07s ease; }
.fw-btn.pressed .fw-op-cap{ transform:translateY(3px); }
.fw-btn.pressed .fw-op-stop{ fill:#B91C1C; }
.fw-btn.pressed .fw-op-start{ fill:#15803D; }
.fw-block{ fill:#F4F7FB; stroke:#8A94A6; stroke-width:1.4; }
.fw-block-kind{ font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; fill:#6B7488; }
.fw-plunger{ stroke:#8A94A6; stroke-width:2.4; }
.fw-station-lbl{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.12em; fill:#6B7488; }
.fw-enclosure{ fill:#E3E9F2; stroke:#B9C2D2; stroke-width:1.6; }

/* ---- motor ---- */
.fw-motor-body{ fill:#F4F7FB; stroke:#6B7488; stroke-width:2; }
.fw-rotor{ fill:none; stroke:#9AA6B8; stroke-width:2.5; stroke-dasharray:7 9; }
.fw-motor-g{ font-size:20px; font-weight:800; fill:#4B5563; }
.fw-motor-sub{ font-family:var(--font-mono,monospace); font-size:10px; fill:#6B7488; }
.fw-motor.running .fw-motor-body{ stroke:var(--live,#EF4444); filter:drop-shadow(0 0 6px rgba(239,68,68,.4)); }
.fw-motor.running .fw-rotor{ stroke:var(--live,#EF4444); animation:fwspin 1s linear infinite; }
@keyframes fwspin{ to{ stroke-dashoffset:-64; } }

/* labels stay readable where a wire runs behind them (panel-bg halo) */
.fw-term-lbl, .fw-pin-num, .fw-pin-lbl, .fw-role, .fw-note, .fw-caption,
.fw-coiltext, .fw-block-kind, .fw-station-lbl{
  paint-order:stroke; stroke:#EDF1F7; stroke-width:3.5px; stroke-linejoin:round;
}
`;

// ---------------------------------------------------------------- primitives
function screw(root, x, y) {
  root.appendChild(E("circle", { class: "fw-screw", cx: x, cy: y, r: 7 }));
  root.appendChild(E("line", { class: "fw-slot", x1: x - 3.6, y1: y, x2: x + 3.6, y2: y }));
  return { x, y };
}
function run(layer, nodeId, pts, cls = "") {
  const d = pts.map((p, i) => `${i ? "L" : "M"} ${p[0]} ${p[1]}`).join(" ");
  layer.appendChild(E("path", { class: `fw-wire${cls ? " " + cls : ""}`, d, "data-node": nodeId }));
}
function junc(layer, nodeId, x, y) {
  layer.appendChild(E("circle", { class: "fw-junc", cx: x, cy: y, r: 4.2, "data-node": nodeId }));
}
function tag(layer, text, x, y) {
  if (!text) return;
  const w = 12 + text.length * 8;
  const g = E("g", { class: "fw-tag" });
  g.appendChild(E("rect", { x: x - w / 2, y: y - 9, width: w, height: 18, rx: 4 }));
  g.appendChild(E("text", { x, y: y + 4.2, "text-anchor": "middle" }, text));
  layer.appendChild(g);
}
function sealTag(root, text, x, y) {
  const w = 16 + text.length * 7.6;
  const g = E("g", { class: "fw-sealtag" });
  g.appendChild(E("rect", { x: x - w / 2, y: y - 11, width: w, height: 22, rx: 11 }));
  g.appendChild(E("text", { x, y: y + 4.2, "text-anchor": "middle" }, text));
  root.appendChild(g);
}

// supply + fuse on the DIN rail, top-left — shared by both scenes.
// srcText comes from the circuit's source (24VDC vs 24VAC must match the print).
// Returns landing points for L+, L−, fuse-in, fuse-out screws.
function furniture(root, srcText) {
  root.appendChild(E("rect", { class: "fw-panel-bg", x: 10, y: 10, width: 780, height: 540, rx: 12 }));
  root.appendChild(E("rect", { class: "fw-rail", x: 40, y: 80, width: 720, height: 16, rx: 2 }));
  root.appendChild(E("line", { class: "fw-rail-edge", x1: 40, y1: 85, x2: 760, y2: 85 }));
  root.appendChild(E("line", { class: "fw-rail-edge", x1: 40, y1: 91, x2: 760, y2: 91 }));
  // control supply
  root.appendChild(E("rect", { class: "fw-dev", x: 60, y: 46, width: 110, height: 84, rx: 6 }));
  root.appendChild(E("text", { class: "fw-dev-name", x: 115, y: 78, "text-anchor": "middle" }, srcText || "24VDC"));
  root.appendChild(E("text", { class: "fw-dev-sub", x: 115, y: 94, "text-anchor": "middle" }, "SUPPLY"));
  root.appendChild(E("text", { class: "fw-term-lbl", x: 90, y: 122, "text-anchor": "middle" }, "L+"));
  root.appendChild(E("text", { class: "fw-term-lbl", x: 140, y: 122, "text-anchor": "middle" }, "L−"));
  root.appendChild(E("rect", { class: "fw-tab", x: 80, y: 130, width: 20, height: 18, rx: 3 }));
  root.appendChild(E("rect", { class: "fw-tab", x: 130, y: 130, width: 20, height: 18, rx: 3 }));
  const Lp = screw(root, 90, 143), Ln = screw(root, 140, 143);
  // fuse holder FU1
  root.appendChild(E("rect", { class: "fw-dev-light", x: 205, y: 50, width: 44, height: 80, rx: 6 }));
  root.appendChild(E("text", { class: "fw-term-lbl", x: 227, y: 72, "text-anchor": "middle" }, "FU1"));
  root.appendChild(E("rect", { x: 217, y: 84, width: 20, height: 34, rx: 3, fill: "#fff", stroke: "#8A94A6", "stroke-width": 1.2 }));
  root.appendChild(E("line", { x1: 227, y1: 86, x2: 227, y2: 116, stroke: "#8A94A6", "stroke-width": 1.6 }));
  root.appendChild(E("rect", { class: "fw-tab", x: 207, y: 130, width: 18, height: 18, rx: 3 }));
  root.appendChild(E("rect", { class: "fw-tab", x: 229, y: 130, width: 18, height: 18, rx: 3 }));
  const fIn = screw(root, 216, 143), fOut = screw(root, 238, 143);
  return { Lp, Ln, fIn, fOut };
}

// control station: enclosure + real 22mm operators with screw-terminal contact
// blocks. buttons: [{ id, kind:"stop"|"start", cx, nums:[a,b] }]
// Returns { screws: { compId: [ptA, ptB] } } — the wire landing points.
function station(root, buttons, box) {
  root.appendChild(E("rect", { class: "fw-enclosure", x: box.x, y: box.y, width: box.w, height: box.h, rx: 10 }));
  root.appendChild(E("text", { class: "fw-station-lbl", x: box.x + box.w / 2, y: box.y + 20, "text-anchor": "middle" }, "CONTROL STATION"));
  const screws = {};
  for (const b of buttons) {
    const g = E("g", { class: "fw-btn", "data-comp": b.id });
    const cy = 372;
    if (b.kind === "stop") {
      g.appendChild(E("circle", { class: "fw-op-ring", cx: b.cx, cy, r: 33 }));
      const cap = E("g", { class: "fw-op-cap" });
      cap.appendChild(E("circle", { class: "fw-op-stop", cx: b.cx, cy, r: 27 }));
      cap.appendChild(E("ellipse", { cx: b.cx - 8, cy: cy - 9, rx: 9, ry: 5, fill: "rgba(255,255,255,.28)" }));
      cap.appendChild(E("text", { class: "fw-op-text", x: b.cx, y: cy + 4, "text-anchor": "middle" }, "STOP"));
      g.appendChild(cap);
    } else {
      g.appendChild(E("circle", { class: "fw-op-ring", cx: b.cx, cy, r: 26 }));
      const cap = E("g", { class: "fw-op-cap" });
      cap.appendChild(E("circle", { class: "fw-op-start", cx: b.cx, cy, r: 20 }));
      cap.appendChild(E("ellipse", { cx: b.cx - 6, cy: cy - 7, rx: 7, ry: 4, fill: "rgba(255,255,255,.28)" }));
      cap.appendChild(E("text", { class: "fw-op-text", x: b.cx, y: cy + 3.6, "text-anchor": "middle", "font-size": "9.5" }, "START"));
      g.appendChild(cap);
    }
    g.appendChild(E("line", { class: "fw-plunger", x1: b.cx, y1: cy + (b.kind === "stop" ? 30 : 24), x2: b.cx, y2: 415 }));
    g.appendChild(E("rect", { class: "fw-block", x: b.cx - 35, y: 415, width: 70, height: 58, rx: 6 }));
    g.appendChild(E("text", { class: "fw-block-kind", x: b.cx, y: 436, "text-anchor": "middle" }, b.kind === "stop" ? "NC" : "NO"));
    const xa = b.cx - 20, xb = b.cx + 20;
    g.appendChild(E("text", { class: "fw-term-lbl", x: xa, y: 464, "text-anchor": "middle" }, b.nums[0]));
    g.appendChild(E("text", { class: "fw-term-lbl", x: xb, y: 464, "text-anchor": "middle" }, b.nums[1]));
    g.appendChild(E("rect", { class: "fw-tab", x: xa - 8, y: 473, width: 16, height: 16, rx: 3 }));
    g.appendChild(E("rect", { class: "fw-tab", x: xb - 8, y: 473, width: 16, height: 16, rx: 3 }));
    root.appendChild(g);
    screws[b.id] = [screw(root, xa, 484), screw(root, xb, 484)];
  }
  return { screws };
}

const rad = (deg) => (deg * Math.PI) / 180;
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// state → wire/junction classes: identical semantics to CircuitView.applyState
function applyWireStates(svg, st) {
  svg.querySelectorAll("[data-node]").forEach((w) => {
    const n = w.getAttribute("data-node");
    const flowing = st.flowNodes.has(n), pos = st.posSet.has(n), neg = st.negSet.has(n);
    w.classList.toggle("energized", flowing && pos);
    w.classList.toggle("return", flowing && neg);
    w.classList.toggle("hot", !flowing && pos);
  });
}
function setBlade(bl, closed) {
  bl.setAttribute("x2", bl.getAttribute(closed ? "data-no-x" : "data-nc-x"));
  bl.setAttribute("y2", bl.getAttribute(closed ? "data-no-y" : "data-nc-y"));
  bl.classList.toggle("closed", closed);
}

// ---------------------------------------------------------------- octal scene
function sceneOctal(svg, circuit, spec) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", "0 0 800 560");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("fw-panel-svg");
  const root = E("g", {});
  svg.appendChild(root);
  const nid = resolveNodes(circuit, spec);
  furniture(root, nid.src);

  // ---- the octal socket face, wire side ----
  const C = { x: 600, y: 220 }, R = 82;
  root.appendChild(E("circle", { class: "fw-plate", cx: C.x, cy: C.y, r: 105 }));
  root.appendChild(E("circle", { class: "fw-hub", cx: C.x, cy: C.y, r: 40 }));
  root.appendChild(E("rect", { class: "fw-key", x: C.x - 5, y: C.y + 30, width: 10, height: 12, rx: 2 }));
  root.appendChild(E("text", { class: "fw-caption", x: C.x, y: C.y - 14, "text-anchor": "middle", "font-weight": "800" }, spec.relayLabel));
  const coilRect = E("rect", { class: "fw-coilbody", x: C.x - 26, y: C.y - 4, width: 52, height: 20, rx: 3 });
  root.appendChild(coilRect);
  root.appendChild(E("text", { class: "fw-coiltext", x: C.x, y: C.y + 10.5, "text-anchor": "middle" }, "COIL"));

  const pin = {};
  for (let n = 1; n <= 8; n++) {
    const a = rad(OCTAL_ANGLE[n]);
    const p = { x: C.x + Math.cos(a) * R, y: C.y + Math.sin(a) * R };
    pin[n] = p;
    screw(root, p.x, p.y);
    const q = { x: C.x + Math.cos(a) * (R - 24), y: C.y + Math.sin(a) * (R - 24) };
    root.appendChild(E("text", { class: "fw-pin-num", x: q.x, y: q.y + 5, "text-anchor": "middle" }, String(n)));
  }
  root.appendChild(E("text", { class: "fw-pin-lbl", x: pin[2].x - 12, y: pin[2].y - 16, "text-anchor": "end" }, "A1"));
  root.appendChild(E("text", { class: "fw-pin-lbl", x: pin[7].x + 12, y: pin[7].y - 16, "text-anchor": "start" }, "A2"));

  // internal coil linkage (inside the plugged-in relay): A1=2, A2=7
  root.appendChild(E("line", { class: "fw-int", x1: pin[2].x, y1: pin[2].y, x2: C.x - 26, y2: C.y + 6 }));
  root.appendChild(E("line", { class: "fw-int", x1: pin[7].x, y1: pin[7].y, x2: C.x + 26, y2: C.y + 6 }));

  // BOTH poles, always: the seal pole normal weight, the other pole visible but
  // annotated (a real socket has all 8 screws — the tech must see what's spare).
  const blades = [];
  OCTAL_POLES.forEach((pl, i) => {
    const poleNo = i + 1;
    const used = poleNo === spec.sealPole;
    const g = E("g", { class: used ? "fw-pole" : "fw-pole fw-pole-spare" });
    const c = pin[pl.c], nc = pin[pl.nc], no = pin[pl.no];
    const pivot = lerp(c, C, 0.5), ncPt = lerp(nc, C, 0.45), noPt = lerp(no, C, 0.45);
    g.appendChild(E("line", { class: "fw-int", x1: c.x, y1: c.y, x2: pivot.x, y2: pivot.y }));
    g.appendChild(E("line", { class: "fw-int", x1: nc.x, y1: nc.y, x2: ncPt.x, y2: ncPt.y }));
    g.appendChild(E("line", { class: "fw-int", x1: no.x, y1: no.y, x2: noPt.x, y2: noPt.y }));
    g.appendChild(E("circle", { cx: pivot.x, cy: pivot.y, r: 3, fill: "#475569" }));
    const bl = E("line", {
      class: "fw-blade", x1: pivot.x, y1: pivot.y, x2: ncPt.x, y2: ncPt.y,
      "data-nc-x": ncPt.x, "data-nc-y": ncPt.y, "data-no-x": noPt.x, "data-no-y": noPt.y,
    });
    g.appendChild(bl);
    root.appendChild(g);
    blades.push({ el: bl, used });
    if (used) {
      // role labels sit radially outside the two screws every wire lands on
      const side = c.x < C.x ? -1 : 1;
      root.appendChild(E("text", { class: "fw-role", x: c.x + side * 24, y: c.y + 18, "text-anchor": side < 0 ? "end" : "start" }, "COM"));
      root.appendChild(E("text", { class: "fw-role", x: no.x + side * 24, y: no.y - 10, "text-anchor": side < 0 ? "end" : "start" }, "NO"));
    }
  });
  // what the other pole is doing (never hidden, per the field sketch)
  const spareSide = spec.sealPole === 1 ? 1 : -1;   // note goes on the NON-seal pole's side
  const noteX = C.x + spareSide * 95;
  (spec.poleNote || []).forEach((line, i) =>
    root.appendChild(E("text", { class: "fw-note", x: noteX, y: 306 + i * 15, "text-anchor": "middle" }, line)));

  root.appendChild(E("text", { class: "fw-caption", x: C.x, y: 352, "text-anchor": "middle" },
    `${spec.relayLabel} — 8-pin octal socket · wire side`));
  const sp = OCTAL_POLES[spec.sealPole - 1];
  sealTag(root, `SEAL: ${sp.c} → ${sp.no}`, C.x, 378);

  // ---- control station ----
  const hasStop = !!spec.stop;
  const st = hasStop
    ? station(root, [
        { id: spec.stop, kind: "stop", cx: 140, nums: ["11", "12"] },
        { id: spec.start, kind: "start", cx: 250, nums: ["13", "14"] },
      ], { x: 60, y: 300, w: 260, h: 220 })
    : station(root, [
        { id: spec.start, kind: "start", cx: 160, nums: ["13", "14"] },
      ], { x: 60, y: 300, w: 200, h: 220 });

  // ---- the wires: one continuous point-to-point run, terminal to terminal ----
  const W = E("g", {});       // wires above devices so every landing is visible
  const J = E("g", {});       // junction dots + tags on top
  root.appendChild(W); root.appendChild(J);
  const tg = (n) => (spec.tags || {})[n];

  // L+ → FU1(in)
  run(W, nid.L, [[90, 150], [90, 182], [216, 182], [216, 150]]);
  tag(J, tg(nid.L), 152, 182);
  const a1 = pin[OCTAL_COIL.a1], a2 = pin[OCTAL_COIL.a2];
  const com = pin[sp.c], no = pin[sp.no];

  if (hasStop) {
    const [s11, s12] = st.screws[spec.stop];
    const [s13, s14] = st.screws[spec.start];
    // FU1(out) → STOP 11
    run(W, nid.stopIn, [[238, 150], [238, 204], [52, 204], [52, 530], [s11.x, 530], [s11.x, s11.y + 7]]);
    tag(J, tg(nid.stopIn), 145, 204);
    // STOP 12 → START 13, teeing off to the seal pole's COM screw (the seal tap)
    run(W, nid.startIn, [[s12.x, s12.y + 7], [s12.x, 532], [com.x, 532], [com.x, com.y + 7]]);
    run(W, nid.startIn, [[s13.x, 532], [s13.x, s13.y + 7]]);
    junc(J, nid.startIn, s13.x, 532);
    tag(J, tg(nid.startIn), 420, 532);
    // START 14 → A1 (pin 2), plus the seal return jumper NO → A1 over the socket
    run(W, nid.startOut, [[s14.x, s14.y + 7], [s14.x, 512], [440, 512], [440, a1.y], [a1.x - 7, a1.y]]);
    run(W, nid.startOut, [[a1.x, a1.y - 7], [a1.x, 112], [no.x, 112], [no.x, no.y - 7]]);
    junc(J, nid.startOut, a1.x, a1.y);
    tag(J, tg(nid.startOut), 355, 512);
    tag(J, tg(nid.startOut), 592, 112);
  } else {
    const [s13, s14] = st.screws[spec.start];
    // FU1(out) → START 13, teeing off to the seal pole's COM screw
    run(W, nid.startIn, [[238, 150], [238, 204], [52, 204], [52, 532], [com.x, 532], [com.x, com.y + 7]]);
    run(W, nid.startIn, [[s13.x, 532], [s13.x, s13.y + 7]]);
    junc(J, nid.startIn, s13.x, 532);
    tag(J, tg(nid.startIn), 350, 532);
    // START 14 → A1 (pin 2); seal return NO → the same vertical (T-junction)
    run(W, nid.startOut, [[s14.x, s14.y + 7], [s14.x, 512], [440, 512], [440, a1.y], [a1.x - 7, a1.y]]);
    run(W, nid.startOut, [[440, a1.y], [440, 140], [no.x, 140], [no.x, no.y - 7]]);
    junc(J, nid.startOut, 440, a1.y);
    tag(J, tg(nid.startOut), 340, 512);
  }
  // A2 (pin 7) → L− — around the bottom of the panel, never across the socket
  run(W, nid.coilB, [[a2.x + 7, a2.y], [742, a2.y], [742, 544], [36, 544], [36, 186], [140, 186], [140, 150]]);
  tag(J, tg(nid.coilB), 455, 544);

  return {
    applyState(stt) {
      applyWireStates(svg, stt);
      const on = !!stt.coilEnergized.get(spec.coil);
      coilRect.classList.toggle("on", on);
      for (const b of blades) {
        // seal pole shows its solved contact state; the spare pole rides the
        // same armature, so it swings with the coil. RED only when the pole is
        // actually carrying current (closed ≠ hot).
        const closed = b.used ? !!stt.contactClosed.get(spec.seal) : on;
        setBlade(b.el, closed);
        b.el.classList.toggle("hot", b.used && closed && stt.flowNodes.has(nid.startOut));
      }
    },
  };
}

// ------------------------------------------------------------ contactor scene
function sceneContactor(svg, circuit, spec) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", "0 0 800 560");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("fw-panel-svg");
  const root = E("g", {});
  svg.appendChild(root);
  const nid = resolveNodes(circuit, spec);
  furniture(root, nid.src);

  // ---- contactor body ----
  root.appendChild(E("rect", { class: "fw-ctr-body", x: 480, y: 120, width: 230, height: 310, rx: 12 }));
  // internal pole linkage (dashed, behind the strips/nameplate)
  const poleXs = [525, 595, 665];
  const poleBlades = [];
  poleXs.forEach((x) => {
    root.appendChild(E("line", { class: "fw-int", x1: x, y1: 155, x2: x, y2: 192 }));
    root.appendChild(E("line", { class: "fw-int", x1: x, y1: 226, x2: x, y2: 397 }));
    root.appendChild(E("circle", { cx: x, cy: 196, r: 3, fill: "#94A3B8" }));
    root.appendChild(E("circle", { cx: x, cy: 222, r: 3, fill: "#94A3B8" }));
    const bl = E("line", {
      class: "fw-blade", x1: x, y1: 222, x2: x - 10, y2: 199,
      "data-nc-x": x - 10, "data-nc-y": 199, "data-no-x": x, "data-no-y": 201,
    });
    root.appendChild(bl);
    poleBlades.push(bl);
  });
  // terminal strips: line side up top, load side below — all six numbered
  root.appendChild(E("rect", { class: "fw-strip", x: 492, y: 122, width: 206, height: 52, rx: 6 }));
  root.appendChild(E("rect", { class: "fw-strip", x: 492, y: 376, width: 206, height: 52, rx: 6 }));
  const topLbl = ["1/L1", "3/L2", "5/L3"], botLbl = ["2/T1", "4/T2", "6/T3"];
  const Ltop = poleXs.map((x, i) => {
    const p = screw(root, x, 148);
    root.appendChild(E("text", { class: "fw-term-lbl", x, y: 168, "text-anchor": "middle" }, topLbl[i]));
    return p;
  });
  const Tbot = poleXs.map((x, i) => {
    const p = screw(root, x, 404);
    root.appendChild(E("text", { class: "fw-term-lbl", x, y: 392, "text-anchor": "middle" }, botLbl[i]));
    return p;
  });
  // coil terminals: A1 on top, A2 on the bottom (IEC face)
  root.appendChild(E("rect", { class: "fw-tab", x: 486, y: 88, width: 30, height: 32, rx: 4 }));
  const A1 = screw(root, 501, 97);
  root.appendChild(E("text", { class: "fw-term-lbl", x: 501, y: 116, "text-anchor": "middle" }, "A1"));
  root.appendChild(E("rect", { class: "fw-tab", x: 470, y: 428, width: 30, height: 34, rx: 4 }));
  root.appendChild(E("text", { class: "fw-term-lbl", x: 485, y: 440, "text-anchor": "middle" }, "A2"));
  const A2 = screw(root, 485, 453);
  // internal coil linkage
  root.appendChild(E("line", { class: "fw-int", x1: 501, y1: 122, x2: 501, y2: 324 }));
  root.appendChild(E("line", { class: "fw-int", x1: 501, y1: 324, x2: 546, y2: 324 }));
  root.appendChild(E("line", { class: "fw-int", x1: 485, y1: 445, x2: 485, y2: 340 }));
  root.appendChild(E("line", { class: "fw-int", x1: 485, y1: 340, x2: 546, y2: 340 }));
  // aux block on the side — the seal contact, clearly numbered 13/14
  root.appendChild(E("rect", { class: "fw-strip", x: 438, y: 190, width: 42, height: 130, rx: 5 }));
  root.appendChild(E("text", { class: "fw-block-kind", x: 459, y: 206, "text-anchor": "middle" }, "AUX"));
  const X13 = screw(root, 459, 228);
  root.appendChild(E("text", { class: "fw-term-lbl", x: 459, y: 248, "text-anchor": "middle" }, "13"));
  root.appendChild(E("line", { class: "fw-int", x1: 459, y1: 235, x2: 459, y2: 256 }));
  root.appendChild(E("circle", { cx: 459, cy: 258, r: 3, fill: "#94A3B8" }));
  root.appendChild(E("circle", { cx: 459, cy: 278, r: 3, fill: "#94A3B8" }));
  const auxBlade = E("line", {
    class: "fw-blade", x1: 459, y1: 278, x2: 450, y2: 260,
    "data-nc-x": 450, "data-nc-y": 260, "data-no-x": 459, "data-no-y": 261,
  });
  root.appendChild(auxBlade);
  root.appendChild(E("line", { class: "fw-int", x1: 459, y1: 280, x2: 459, y2: 297 }));
  root.appendChild(E("text", { class: "fw-term-lbl", x: 459, y: 293, "text-anchor": "middle" }, "14"));
  const X14 = screw(root, 459, 304);
  sealTag(root, "SEAL: 13 → 14", 459, 338);   // pinned right under its two screws
  // nameplate + coil box
  root.appendChild(E("rect", { class: "fw-plate2", x: 520, y: 230, width: 150, height: 72, rx: 4 }));
  root.appendChild(E("text", { class: "fw-plate2-big", x: 595, y: 254, "text-anchor": "middle" }, spec.relayLabel));
  root.appendChild(E("text", { class: "fw-plate2-t", x: 595, y: 272, "text-anchor": "middle" }, "3-POLE CONTACTOR"));
  root.appendChild(E("text", { class: "fw-plate2-t", x: 595, y: 288, "text-anchor": "middle" },
    `COIL 24V${spec.ac ? "AC" : "DC"} · 25A AC-3`));
  const coilRect = E("rect", { class: "fw-coilbody", x: 546, y: 313, width: 98, height: 34, rx: 4 });
  root.appendChild(coilRect);
  root.appendChild(E("text", { class: "fw-coiltext", x: 595, y: 329, "text-anchor": "middle" }, "COIL"));
  root.appendChild(E("text", { class: "fw-coiltext", x: 595, y: 342, "text-anchor": "middle" }, "A1 – A2"));
  if (spec.bodyNote) root.appendChild(E("text", { class: "fw-body-note", x: 595, y: 366, "text-anchor": "middle" }, spec.bodyNote));

  // ---- motor ----
  const M = { x: 595, y: 498 };
  const motorG = E("g", { class: "fw-motor" });
  motorG.appendChild(E("circle", { class: "fw-motor-body", cx: M.x, cy: M.y, r: 30 }));
  motorG.appendChild(E("circle", { class: "fw-rotor", cx: M.x, cy: M.y, r: 21 }));
  motorG.appendChild(E("text", { class: "fw-motor-g", x: M.x, y: M.y + 7, "text-anchor": "middle" }, "M"));
  motorG.appendChild(E("text", { class: "fw-motor-sub", x: M.x + 36, y: M.y + 4 }, spec.threePhase ? "3~" : ""));
  root.appendChild(motorG);

  // ---- control station ----
  const st = station(root, [
    { id: spec.stop, kind: "stop", cx: 140, nums: ["11", "12"] },
    { id: spec.start, kind: "start", cx: 250, nums: ["13", "14"] },
  ], { x: 60, y: 300, w: 260, h: 220 });

  // ---- wires ----
  const W = E("g", {}), J = E("g", {});
  root.appendChild(W); root.appendChild(J);
  const tg = (n) => (spec.tags || {})[n];
  const [s11, s12] = st.screws[spec.stop];
  const [s13, s14] = st.screws[spec.start];

  // L+ → FU1(in)
  run(W, nid.L, [[90, 150], [90, 182], [216, 182], [216, 150]]);
  tag(J, tg(nid.L), 152, 182);
  // FU1(out) → STOP 11
  run(W, nid.stopIn, [[238, 150], [238, 204], [52, 204], [52, 530], [s11.x, 530], [s11.x, s11.y + 7]]);
  tag(J, tg(nid.stopIn), 145, 204);
  // STOP 12 → START 13, teeing to aux 13 (the seal tap)
  run(W, nid.startIn, [[s12.x, s12.y + 7], [s12.x, 530], [380, 530], [380, X13.y], [X13.x - 7, X13.y]]);
  run(W, nid.startIn, [[s13.x, 530], [s13.x, s13.y + 7]]);
  junc(J, nid.startIn, s13.x, 530);
  tag(J, tg(nid.startIn), 322, 530);
  // START 14 → aux 14, teeing up to coil A1 (the seal return feeds the coil)
  run(W, nid.startOut, [[s14.x, s14.y + 7], [s14.x, 512], [410, 512], [410, X14.y], [X14.x - 7, X14.y]]);
  run(W, nid.startOut, [[410, X14.y], [410, 72], [A1.x, 72], [A1.x, A1.y - 7]]);
  junc(J, nid.startOut, 410, X14.y);
  tag(J, tg(nid.startOut), 340, 512);
  // A2 → L−  (motor return joins the same lane — both are the return node)
  run(W, nid.coilB, [[A2.x, A2.y + 7], [A2.x, 545], [36, 545], [36, 186], [140, 186], [140, 150]]);
  run(W, nid.coilB, [[M.x, M.y + 31], [M.x, 545], [A2.x, 545]], "fw-power");
  junc(J, nid.coilB, A2.x, 545);
  tag(J, tg(nid.coilB), 272, 545);

  // power section (de-emphasized): feeder → line terminals, load side → motor
  const feed = nid.mainsIn[0];
  if (spec.threePhase) {
    // fed from ahead of the operators (n1): one drop per phase off a top lane
    run(W, feed, [[238, 204], [300, 204], [300, 60], [665, 60], [665, 141]], "fw-power");
    run(W, feed, [[525, 60], [525, 141]], "fw-power");
    run(W, feed, [[595, 60], [595, 141]], "fw-power");
    junc(J, feed, 525, 60); junc(J, feed, 595, 60); junc(J, feed, 238, 204);
    run(W, nid.mainsOut[0], [[525, 411], [525, 458], [577, 458], [577, 478]], "fw-power");
    run(W, nid.mainsOut[1], [[595, 411], [595, 467]], "fw-power");
    run(W, nid.mainsOut[2], [[665, 411], [665, 458], [613, 458], [613, 478]], "fw-power");
    tag(J, tg(nid.mainsOut[0]), 548, 458);
    tag(J, tg(nid.mainsOut[1]), 595, 440);
    tag(J, tg(nid.mainsOut[2]), 642, 458);
  } else {
    // fed from the sealed control node (this teaching circuit runs the motor
    // on the control supply through pole 1) — tee off the aux-13 run
    run(W, feed, [[380, X13.y], [380, 60], [525, 60], [525, 141]], "fw-power");
    junc(J, feed, 380, X13.y);
    run(W, nid.mainsOut[0], [[525, 411], [525, 458], [577, 458], [577, 478]], "fw-power");
    tag(J, tg(nid.mainsOut[0]), 548, 458);
  }

  return {
    applyState(stt) {
      applyWireStates(svg, stt);
      const on = !!stt.coilEnergized.get(spec.coil);
      coilRect.classList.toggle("on", on);
      // one armature moves EVERY contact together: aux + all three poles.
      // A pole glows red only when ITS circuit carries current — a closed
      // spare pole stays neutral (closed ≠ hot).
      setBlade(auxBlade, on);
      auxBlade.classList.toggle("hot", on && stt.flowNodes.has(nid.startOut));
      poleBlades.forEach((bl, i) => {
        setBlade(bl, on);
        const outNode = nid.mainsOut[i];
        bl.classList.toggle("hot", on && outNode != null && stt.flowNodes.has(outNode));
      });
      const running = (spec.motors || []).some((id) => !!stt.loadOn.get(id));
      motorG.classList.toggle("running", running);
    },
  };
}

// resolve the real node ids each wire run belongs to, straight from the
// lesson's circuit JSON (derive, don't guess)
function resolveNodes(circuit, spec) {
  const c = normalizeCircuit(circuit);
  const { compById, source } = indexCircuit(c);
  const t = (id, term) => { const comp = id ? compById.get(id) : null; return comp ? comp.terminals[term] : null; };
  return {
    src: source ? `${source.volts}V${source.current || "DC"}` : "24VDC",
    L: source ? source.terminals.pos : null,
    N: source ? source.terminals.neg : null,
    stopIn: spec.stop ? t(spec.stop, "in") : t(spec.start, "in"),
    startIn: t(spec.start, "in"),
    startOut: t(spec.start, "out"),
    coilA: t(spec.coil, "a"),
    coilB: t(spec.coil, "b"),
    mainsIn: (spec.mains || []).map((id) => t(id, "in")),
    mainsOut: (spec.mains || []).map((id) => t(id, "out")),
  };
}

// momentary press-and-hold on the panel's physical buttons — same semantics as
// interact.js, including the synthetic-click fallback for assistive tech.
function bindPanelButtons(svg, opts) {
  svg.querySelectorAll("[data-comp]").forEach((g) => {
    const id = g.getAttribute("data-comp");
    let lastPtr = -1e9;
    const press = () => { g.classList.add("pressed"); opts.onPress && opts.onPress(id); };
    const release = () => {
      if (!g.classList.contains("pressed")) return;
      g.classList.remove("pressed");
      opts.onRelease && opts.onRelease(id);
    };
    g.addEventListener("pointerdown", (e) => { e.preventDefault(); lastPtr = performance.now(); press(); });
    g.addEventListener("pointerup", () => { lastPtr = performance.now(); release(); });
    g.addEventListener("pointerleave", () => { lastPtr = performance.now(); release(); });
    g.addEventListener("pointercancel", () => { lastPtr = performance.now(); release(); });
    g.setAttribute("tabindex", "0");
    g.setAttribute("role", "button");
    g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); press(); } });
    g.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") release(); });
    g.addEventListener("click", () => {
      if (performance.now() - lastPtr < 900) return;   // real pointer already handled it
      press(); setTimeout(release, 450);
    });
  });
}

/**
 * Render the Field Wiring split view into `host`.
 * opts: { circuit, spec, caption, onPress(id), onRelease(id) }
 * Returns { schemSvg, applyState(state) } — main.js builds its CircuitView into
 * schemSvg and forwards each solved state into applyState so both panes stay
 * on the one engine.
 */
export function renderFieldWiring(host, opts) {
  host.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = CSS;
  host.appendChild(style);

  const root = el("div", "fw-root");
  host.appendChild(root);

  const head = el("div", "fw-head");
  head.innerHTML = `<span class="fw-eyebrow">THE PRINT ⟷ THE PANEL</span>
    <p class="fw-sub">Same circuit, two languages: the ladder print, and the wires as they physically land —
    terminal screw to terminal screw. Press START in either pane; both light together.</p>`;
  root.appendChild(head);

  const grid = el("div", "fw-grid");
  root.appendChild(grid);

  const paneA = el("div", "fw-pane");
  paneA.appendChild(el("div", "fw-pane-label")).textContent = "The print — schematic";
  const schemSvg = E("svg", { class: "fw-schem-svg" });
  paneA.appendChild(schemSvg);
  grid.appendChild(paneA);

  const paneB = el("div", "fw-pane");
  paneB.appendChild(el("div", "fw-pane-label")).textContent = "The panel — field wiring";
  const panelSvg = E("svg", {});
  paneB.appendChild(panelSvg);
  grid.appendChild(paneB);

  const scene = (opts.spec.device === "contactor" ? sceneContactor : sceneOctal)(panelSvg, opts.circuit, opts.spec);
  bindPanelButtons(panelSvg, opts);

  if (opts.caption) {
    const co = el("div", "fw-callout");
    co.innerHTML = `<b>Read the seal:</b> ${opts.caption}`;
    root.appendChild(co);
  }
  return { schemSvg, applyState: scene.applyState };
}
