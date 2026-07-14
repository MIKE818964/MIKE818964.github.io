// =============================================================================
// renderer.js — circuit JSON -> inline SVG, reflect solver output via classes.
// Professional, standard electrical schematic symbols (thin technical lines).
// Build once; applyState() toggles classes so CSS animations play smoothly.
// =============================================================================

import { SYMBOLS, componentTerminals, terminalPoint } from "./symbols.js";
import { normalizeCircuit, indexCircuit } from "./model.js";

const SVGNS = "http://www.w3.org/2000/svg";
function el(name, attrs = {}) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// ---------------------------------------------------------------------------
// Real-part photo chips: each schematic symbol gets a small photo of the
// actual AutomationDirect part next to it. Realism + a BIG click target —
// the chip is a full proxy for the symbol (press-and-hold works on it).
// ---------------------------------------------------------------------------
const PARTS_DIR = "assets/parts/";
function photoAssetFor(comp) {
  switch (comp.type) {
    case "pushbutton":
      return comp.contact === "NC"
        ? "estop_gcx1131_red_mushroom.jpg"          // Stop = red mushroom head
        : "pushbutton_gcx1102_green_flush.jpg";     // Start = green flush
    case "contact_no": return "contact_block_ecx1040_no.jpg";   // green NO block
    case "contact_nc": return "contact_block_ecx1030_nc.jpg";   // red NC block
    case "coil":
      // device consistency: an M-numbered coil is a motor starter/contactor in
      // the field — its chip must never show an ice-cube relay. Lesson JSONs
      // mark it explicitly (device:"contactor"); the M-prefix fallback covers
      // scenario circuits that predate the field.
      return comp.device === "contactor" || /^M\d/.test(comp.label || comp.id || "")
        ? "contactor_cwb25_11_30c03_front.jpg"
        : "relay_750r_2c_24d.jpg";
    case "timer_coil": return "timer_trs_td_face_view.jpg";
    case "bulb":
      return /run/i.test(comp.label || "")
        ? "pilot_ecx2052_24l_green.jpg"
        : "pilot_ecx2051_24l_red.jpg";
    case "motor":      return "contactor_cwb25_11_30c03_front.jpg";
    case "fuse":       return "fuse_hclr5_class_cc.jpg";
    case "source":     return "psu_rhino_psl24-030.jpg";
    default:           return null;                 // test_point etc: no chip
  }
}
let CHIP_SEQ = 0;   // unique clipPath ids across every CircuitView instance

export class CircuitView {
  constructor(svg) {
    this.svg = svg;
    this.circuit = null;
    this.nodeById = new Map();
    this.leadEls = [];
    this.junctionEls = [];
    this.compEls = new Map();
    this.testPoints = [];
    this.onTestPointClick = null;
    // probe-on-the-wire: click any conductor to land a meter lead right there
    this.onWireProbe = null;      // (nodeId, {x,y} in schematic coords) => void
    this.gProbes = null;          // layer for the red/black probe glyphs
    this.gPhotos = null;          // real-part photo chip layer
    this.photoChips = [];         // [{compId, el, rect}]
    this.photoToggle = null;      // 📷 PARTS ON/OFF control
    this._wireSegs = [];          // conductor segments (chip placement avoids them)
    this._vb = null;              // current viewBox rect
    // meter-lead UX (opt-in via enableLeadChip before build()):
    this.onProbeClear = null;     // (kind "a"|"b") => void — click a placed lead to lift it
    this.enableLeadChip = false;  // main app turns this on; landing page stays clean
    this.leadChip = null;         // { g, bg, dotA, dotB, text }
  }

  // convert a mouse event to schematic (viewBox) coordinates
  _svgPoint(evt) {
    const pt = this.svg.createSVGPoint();
    pt.x = evt.clientX; pt.y = evt.clientY;
    const m = this.svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }

  build(circuit) {
    this.circuit = normalizeCircuit(circuit);
    this.nodeById = indexCircuit(this.circuit).nodeById;

    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    this.leadEls = []; this.junctionEls = []; this.compEls = new Map(); this.testPoints = [];
    this.photoChips = []; this._wireSegs = []; this.photoToggle = null;

    const xs = [], ys = [];
    for (const n of this.circuit.nodes) { xs.push(n.x); ys.push(n.y); }
    for (const c of this.circuit.components) { if (c.x != null) xs.push(c.x); if (c.y != null) ys.push(c.y); }
    const pad = 54;
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad;
    this.svg.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
    this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    this.gWires = el("g", { class: "wires" });
    this.gJunc = el("g", { class: "junctions" });
    this.gComps = el("g", { class: "components" });

    const degree = new Map();
    for (const comp of this.circuit.components) {
      if (comp.type === "test_point") continue;
      for (const t of componentTerminals(comp)) degree.set(t.nodeId, (degree.get(t.nodeId) || 0) + 1);
    }

    for (const comp of this.circuit.components) {
      if (comp.type === "test_point") continue;
      for (const t of componentTerminals(comp)) {
        const node = this.nodeById.get(t.nodeId);
        if (!node) continue;
        this._wire(this.gWires, orthoPath(t.x, t.y, node.x, node.y), t.nodeId);
      }
    }

    for (const [nodeId, deg] of degree) {
      if (deg < 3) continue;
      const node = this.nodeById.get(nodeId);
      if (!node) continue;
      const c = el("circle", { class: "junction", cx: node.x, cy: node.y, r: 3.4, "data-node": nodeId });
      this.gJunc.appendChild(c);
      // junctions are prime probe real estate — make them generous targets
      const jhit = el("circle", { class: "junction-hit", cx: node.x, cy: node.y, r: 11, "data-node": nodeId });
      jhit.addEventListener("click", () => {
        if (this.onWireProbe) this.onWireProbe(nodeId, { x: node.x, y: node.y });
      });
      this.gJunc.appendChild(jhit);
      this.junctionEls.push({ circle: c, nodeId });
    }

    for (const comp of this.circuit.components) {
      const g = el("g", { class: `comp comp-${comp.type}`, "data-id": comp.id });
      this._draw(comp, g);
      this.gComps.appendChild(g);
      this.compEls.set(comp.id, { g, type: comp.type, comp });
    }

    this.svg.appendChild(this.gWires);
    this.svg.appendChild(this.gJunc);
    this.svg.appendChild(this.gComps);
    // every component TERMINAL is a probe target — a tech following the print
    // lands the lead ON the device screw (hopscotch teaching). Invisible hit
    // circles above the symbols, snapping the probe to the exact terminal.
    this.gTerms = el("g", { class: "term-hits" });
    for (const comp of this.circuit.components) {
      if (comp.type === "test_point") continue;
      for (const t of componentTerminals(comp)) {
        if (t.nodeId == null) continue;
        const th = el("circle", {
          class: "term-hit", cx: t.x, cy: t.y, r: 10,
          "data-node": t.nodeId, "data-comp": comp.id, "data-term": t.name,
        });
        const tip = el("title");
        tip.textContent = `Probe ${comp.label || comp.id} · terminal ${t.name}`;
        th.appendChild(tip);
        th.addEventListener("click", (evt) => {
          evt.stopPropagation();
          if (this.onWireProbe) this.onWireProbe(t.nodeId, { x: t.x, y: t.y });
        });
        this.gTerms.appendChild(th);
      }
    }
    this.svg.appendChild(this.gTerms);
    // photo chips: above the components, but UNDER the meter probes
    this.gPhotos = el("g", { class: "photo-layer" });
    this.svg.appendChild(this.gPhotos);
    this.gProbes = el("g", { class: "probes" });   // meter leads render above all
    this.svg.appendChild(this.gProbes);
    this._vb = { minX, minY, w, h };
    this._buildPhotoChips();
    this._buildPhotoToggle();
    if (this.enableLeadChip) this._buildLeadChip();
  }

  // ---- real-part photo chips ------------------------------------------------
  // Place a ~46x46 photo card near each symbol: default ABOVE when the symbol
  // sits in the lower half of the sheet, BELOW otherwise — then score the
  // above/below/left/right candidates against every wire segment, symbol box,
  // label box and already-placed chip, and keep the cleanest spot.
  _buildPhotoChips() {
    const CW = 46, CH = 46, OFF = 61;      // 61 = 38px clearance + half a chip
    const vb = this._vb;
    const midY = vb.minY + vb.h / 2;

    // obstacle boxes: symbols, their labels, test-point text + markers
    const boxes = [];
    for (const c of this.circuit.components) {
      if (c.x == null) continue;
      if (c.type === "test_point") {
        boxes.push({ x: c.x - 24, y: c.y - 12, w: 48, h: 16 });
        const n = this.nodeById.get(c.terminals.p);
        if (n) boxes.push({ x: n.x - 10, y: n.y - 10, w: 20, h: 20 });
        continue;
      }
      boxes.push({ id: c.id, x: c.x - 26, y: c.y - 32, w: 52, h: 64 });
      if (c.label) boxes.push({ id: c.id, x: c.x - 42, y: c.y + 12, w: 84, h: 26 });
    }

    const inter = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const overlapArea = (a, b) =>
      Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
    const segHits = (s, r) =>    // exact for our orthogonal conductors
      Math.max(s.x1, s.x2) >= r.x && Math.min(s.x1, s.x2) <= r.x + r.w &&
      Math.max(s.y1, s.y2) >= r.y && Math.min(s.y1, s.y2) <= r.y + r.h;

    const placed = [];
    const score = (r, ownId) => {
      let s = 0;
      // covering a conductor is the worst offense — a chip must never hide copper
      for (const seg of this._wireSegs) if (segHits(seg, r)) s += 18;
      // symbol/label boxes: penalty proportional to how MUCH is covered
      for (const b of boxes) { if (b.id && b.id === ownId) continue; s += 9 * overlapArea(r, b) / (r.w * r.h); }
      for (const p of placed) {
        const pr = { x: p.rect.x - 6, y: p.rect.y - 6, w: p.rect.w + 12, h: p.rect.h + 12 };
        if (inter(r, pr)) s += 40;
      }
      if (r.x < vb.minX || r.x + r.w > vb.minX + vb.w) s += 2;
      if (r.y < vb.minY || r.y + r.h > vb.minY + vb.h) s += 2;
      return s;
    };

    for (const comp of this.circuit.components) {
      const file = photoAssetFor(comp);
      if (!file || comp.x == null) continue;
      const at = (dx, dy) => ({ x: comp.x + dx - CW / 2, y: comp.y + dy - CH / 2, w: CW, h: CH });
      const up = -OFF, dn = OFF;
      const [p1, p2] = comp.y > midY ? [up, dn] : [dn, up];   // lower half → above first
      const cands = [
        at(0, p1), at(0, p2),                 // straight above/below (preferred side first)
        at(-OFF - 3, 0), at(OFF + 3, 0),      // left / right
        at(-52, p1), at(52, p1),              // diagonals on the preferred side
        at(-52, p2), at(52, p2),              // diagonals on the other side
      ];
      let best = cands[0], bestS = Infinity;
      for (const cand of cands) { const s = score(cand, comp.id); if (s < bestS) { bestS = s; best = cand; } }
      placed.push({ comp, file, rect: { ...best } });
    }

    // residual overlap pass: two chips on the same band closer than 52px → nudge x
    placed.sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y);
    for (let i = 0; i < placed.length; i++)
      for (let j = i + 1; j < placed.length; j++) {
        const A = placed[i].rect, B = placed[j].rect;
        const vOverlap = A.y < B.y + B.h && B.y < A.y + A.h;
        if (vOverlap && Math.abs((A.x + A.w / 2) - (B.x + B.w / 2)) < 52)
          B.x = A.x + A.w / 2 + 52 - B.w / 2;
      }

    for (const p of placed) this._renderChip(p.comp, p.file, p.rect);

    // grow the sheet so no chip is clipped; reserve a strip for the toggle
    if (placed.length) {
      let x0 = vb.minX, y0 = vb.minY, x1 = vb.minX + vb.w, y1 = vb.minY + vb.h;
      for (const p of placed) {
        x0 = Math.min(x0, p.rect.x - 8);          y0 = Math.min(y0, p.rect.y - 8);
        x1 = Math.max(x1, p.rect.x + p.rect.w + 8); y1 = Math.max(y1, p.rect.y + p.rect.h + 8);
      }
      y0 -= 30;   // headroom: the 📷 toggle lives above everything, top-right
      this._vb = { minX: x0, minY: y0, w: x1 - x0, h: y1 - y0 };
      this.svg.setAttribute("viewBox", `${x0} ${y0} ${x1 - x0} ${y1 - y0}`);
    }
  }

  _renderChip(comp, file, rect) {
    const ccx = rect.x + rect.w / 2, ccy = rect.y + rect.h / 2;
    const gc = el("g", { class: `photo-chip chip-${comp.type}`, "data-chip": comp.id });

    // leader tick: chip border toward the symbol, stopping short of it
    const dx = comp.x - ccx, dy = comp.y - ccy;
    const len = Math.hypot(dx, dy) || 1;
    if (len > rect.w / 2 + 18) {
      const t = Math.min(dx ? (rect.w / 2) / Math.abs(dx) : Infinity,
                         dy ? (rect.h / 2) / Math.abs(dy) : Infinity);
      gc.appendChild(el("line", {
        class: "chip-leader",
        x1: ccx + dx * t, y1: ccy + dy * t,
        x2: comp.x - (dx / len) * 16, y2: comp.y - (dy / len) * 16,
      }));
    }

    gc.appendChild(el("rect", { class: "chip-card", x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: 8 }));
    const clipId = `chip-clip-${++CHIP_SEQ}`;
    const cp = el("clipPath", { id: clipId });
    cp.appendChild(el("rect", { x: rect.x + 2, y: rect.y + 2, width: rect.w - 4, height: rect.h - 4, rx: 6 }));
    gc.appendChild(cp);
    const img = el("image", {
      x: rect.x + 2, y: rect.y + 2, width: rect.w - 4, height: rect.h - 4,
      "clip-path": `url(#${clipId})`, preserveAspectRatio: "xMidYMid slice",
    });
    img.setAttribute("href", PARTS_DIR + file);
    gc.appendChild(img);
    gc.appendChild(el("rect", { class: "chip-frame", x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: 8 }));

    // click proxy: the chip IS the component. Pushbutton press-and-hold
    // semantics are bound by interact.js (via rec.chipEl); everything else
    // simply forwards a click to the symbol group.
    if (comp.type !== "pushbutton") {
      gc.addEventListener("click", () => {
        const rec = this.compEls.get(comp.id);
        if (rec) rec.g.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      });
    }

    this.gPhotos.appendChild(gc);
    const rec = this.compEls.get(comp.id);
    if (rec) { rec.chipEl = gc; rec.chipRect = rect; }
    this.photoChips.push({ compId: comp.id, el: gc, rect });
  }

  // in-SVG 📷 PARTS ON/OFF toggle, top-right corner; hides/shows the photo layer
  _buildPhotoToggle() {
    if (!this.photoChips.length) return;
    const vb = this._vb;
    const w = 122, h = 24;
    const x = vb.minX + vb.w - w - 8, y = vb.minY + 6;
    const g = el("g", { class: "photo-toggle", role: "button", tabindex: "0" });
    g.appendChild(el("rect", { class: "photo-toggle-bg", x, y, width: w, height: h, rx: 12 }));
    const t = el("text", { class: "photo-toggle-text", x: x + w / 2, y: y + 16, "text-anchor": "middle" });
    t.textContent = "\u{1F4F7} PARTS ON";
    g.appendChild(t);
    const flip = () => {
      const off = this.gPhotos.classList.toggle("photos-off");
      g.classList.toggle("off", off);
      t.textContent = off ? "\u{1F4F7} PARTS OFF" : "\u{1F4F7} PARTS ON";
    };
    g.addEventListener("click", flip);
    g.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } });
    this.svg.appendChild(g);
    this.photoToggle = g;
  }

  // Draw the red (V+) and black (COM) meter leads touching the exact points
  // the learner clicked. a/b = {x, y} in schematic coords, or null.
  // Each placed lead is itself a click target: clicking it LIFTS that lead
  // (via onProbeClear) — no more silent A/B/reset cycling.
  setProbeMarkers(a, b) {
    if (!this.gProbes) return;
    while (this.gProbes.firstChild) this.gProbes.removeChild(this.gProbes.firstChild);
    const draw = (pt, kind) => {
      if (!pt) return;
      const g = el("g", { class: `probe-glyph probe-${kind}` });
      const dir = kind === "a" ? 1 : -1;             // red leans right, black leans left
      // contact tip on the conductor
      g.appendChild(el("circle", { class: "probe-tip", cx: pt.x, cy: pt.y, r: 3 }));
      // needle + grip (a real meter lead at ~55°)
      g.appendChild(el("line", { class: "probe-needle", x1: pt.x + dir * 3, y1: pt.y - 4, x2: pt.x + dir * 13, y2: pt.y - 18 }));
      g.appendChild(el("line", { class: "probe-grip", x1: pt.x + dir * 13, y1: pt.y - 18, x2: pt.x + dir * 26, y2: pt.y - 36 }));
      const lbl = el("text", { class: "probe-label", x: pt.x + dir * 30, y: pt.y - 40, "text-anchor": dir > 0 ? "start" : "end" });
      lbl.textContent = kind === "a" ? "V+" : "COM";
      g.appendChild(lbl);
      // fat hit zone over tip + needle: click a placed lead to lift it
      const hit = el("circle", { class: "probe-hit", cx: pt.x + dir * 8, cy: pt.y - 12, r: 17 });
      const tip = el("title");
      tip.textContent = kind === "a" ? "Click to lift the RED lead" : "Click to lift the BLACK lead";
      hit.appendChild(tip);
      hit.addEventListener("click", (evt) => {
        evt.stopPropagation();
        if (this.onProbeClear) this.onProbeClear(kind);
      });
      g.appendChild(hit);
      this.gProbes.appendChild(g);
    };
    draw(a, "a");
    draw(b, "b");
  }

  // ---- persistent meter-lead status chip, top-left of the sheet -------------
  // Walks the learner through the lead lifecycle: ① RED (V+) → ② BLACK (COM)
  // → reading live · click a lead to lift it. Updated via setLeadState().
  _buildLeadChip() {
    const vb = this._vb;
    const h = 26;
    const x0 = vb.minX + 8, y0 = vb.minY + 5;
    const g = el("g", { class: "lead-chip" });
    const bg = el("rect", { class: "lead-chip-bg", x: x0, y: y0, width: 220, height: h, rx: 13 });
    g.appendChild(bg);
    const dotA = el("circle", { class: "lead-chip-dot dot-red", cx: x0 + 16, cy: y0 + h / 2, r: 5 });
    const dotB = el("circle", { class: "lead-chip-dot dot-blk", cx: x0 + 31, cy: y0 + h / 2, r: 5 });
    g.appendChild(dotA); g.appendChild(dotB);
    const text = el("text", { class: "lead-chip-text", x: x0 + 44, y: y0 + h / 2 + 4 });
    g.appendChild(text);
    this.svg.appendChild(g);
    this.leadChip = { g, bg, dotA, dotB, text };
    this.setLeadState(false, false);
  }

  setLeadState(hasA, hasB) {
    if (!this.leadChip) return;
    const { bg, dotA, dotB, text } = this.leadChip;
    dotA.classList.toggle("placed", !!hasA);
    dotB.classList.toggle("placed", !!hasB);
    const msg =
      !hasA && !hasB ? "① Place RED (V+) — click any terminal, wire, or junction" :
      hasA && !hasB  ? "② Now place BLACK (COM) — the reading goes live" :
      !hasA && hasB  ? "① Place RED (V+) — BLACK stays parked" :
                       "READING LIVE · next click walks RED · click a lead to lift it";
    text.textContent = msg;
    // size the pill to the text (getComputedTextLength can be 0 while hidden)
    let tw = 0;
    try { tw = text.getComputedTextLength(); } catch { tw = 0; }
    if (!tw || !isFinite(tw)) tw = msg.length * 6.4;
    bg.setAttribute("width", Math.round(44 - 8 + tw + 14));
  }

  _wire(group, d, nodeId) {
    const base = el("path", { class: "wire", d, "data-node": nodeId });
    const flow = el("path", { class: "wire-flow", d, "data-node": nodeId });
    group.appendChild(base);
    group.appendChild(flow);
    // fat invisible hit zone: THIS is how a tech probes — click the conductor
    // itself, exactly where the meter lead would touch copper.
    const hit = el("path", { class: "wire-hit", d, "data-node": nodeId });
    hit.addEventListener("click", (evt) => {
      if (!this.onWireProbe) return;
      const p = this._svgPoint(evt);
      this.onWireProbe(nodeId, { x: p.x, y: p.y });
    });
    group.appendChild(hit);
    this.leadEls.push({ path: base, flow, nodeId });
    // remember the conductor geometry so photo chips can dodge every wire
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    for (let i = 2; i + 1 < nums.length; i += 2)
      this._wireSegs.push({ x1: nums[i - 2], y1: nums[i - 1], x2: nums[i], y2: nums[i + 1] });
    return base;
  }

  _label(g, comp, x, y) {
    if (!comp.label) return;
    const def = SYMBOLS[comp.type] || { h: 44 };
    const t = el("text", {
      class: "comp-label",
      x: x ?? comp.x,
      y: y ?? comp.y + def.h / 2 + 16,
      "text-anchor": "middle",
    });
    t.textContent = comp.label;
    g.appendChild(t);
  }

  // ---- professional, standard schematic symbols (all absolute coords) ----
  _draw(comp, g) {
    const cx = comp.x, cy = comp.y;
    const T = (name) => terminalPoint(comp, name);
    const add = (n, a, txt) => { const e = el(n, a); if (txt != null) e.textContent = txt; g.appendChild(e); return e; };
    const line = (x1, y1, x2, y2, cls) => add("line", { class: cls, x1, y1, x2, y2 });

    switch (comp.type) {
      case "source": {                       // DC battery (2 cells)
        const p = T("pos"), ng = T("neg");
        this._wire(g, `M ${cx} ${cy - 14} L ${p.x} ${p.y}`, comp.terminals.pos);
        this._wire(g, `M ${cx} ${cy + 14} L ${ng.x} ${ng.y}`, comp.terminals.neg);
        line(cx - 13, cy - 14, cx + 13, cy - 14, "plate-long");
        line(cx - 6,  cy - 8,  cx + 6,  cy - 8,  "plate-short");
        line(cx - 13, cy,      cx + 13, cy,      "plate-long");
        line(cx - 6,  cy + 6,  cx + 6,  cy + 6,  "plate-short");
        line(cx, cy + 6, cx, cy + 14, "sym-stroke");      // lead from last plate
        add("text", { class: "sym-plus",  x: cx + 18, y: cy - 9 }, "+");
        add("text", { class: "sym-minus", x: cx + 18, y: cy + 12 }, "–");
        this._label(g, comp, cx, cy + 34);
        break;
      }
      case "fuse": {                          // IEC fuse: rectangle + element line
        const a = T("a"), b = T("b");
        this._wire(g, `M ${a.x} ${a.y} L ${cx - 16} ${cy}`, comp.terminals.a);
        this._wire(g, `M ${cx + 16} ${cy} L ${b.x} ${b.y}`, comp.terminals.b);
        add("rect", { class: "dev-body", x: cx - 16, y: cy - 7, width: 32, height: 14, rx: 1.5 });
        line(cx - 16, cy, cx + 16, cy, "fuse-link");
        line(cx - 5, cy, cx + 5, cy, "fuse-break");
        this._label(g, comp, cx, cy + 22);
        break;
      }
      case "contact_no":
      case "contact_nc": {                    // standard ladder contact: —| |—  /  —|/|—
        const a = T("in"), b = T("out");
        this._wire(g, `M ${a.x} ${a.y} L ${cx - 8} ${cy}`, comp.terminals.in);
        this._wire(g, `M ${cx + 8} ${cy} L ${b.x} ${b.y}`, comp.terminals.out);
        line(cx - 8, cy - 10, cx - 8, cy + 10, "ladder-plate");     // left contact face
        line(cx + 8, cy - 10, cx + 8, cy + 10, "ladder-plate");     // right contact face
        add("line", { class: "ladder-bridge", x1: cx - 8, y1: cy, x2: cx + 8, y2: cy });  // shows when CLOSED
        if (comp.type === "contact_nc")
          line(cx - 11, cy + 12, cx + 11, cy - 12, "nc-slash");     // NC diagonal slash
        this._label(g, comp, cx, cy + 24);
        // fat invisible hit zone — the tiny plates are hard to press
        add("rect", { class: "comp-hit", x: cx - 20, y: cy - 20, width: 40, height: 40, rx: 6 });
        break;
      }
      case "pushbutton": {                    // ladder contact + pushbutton actuator
        const a = T("in"), b = T("out");
        this._wire(g, `M ${a.x} ${a.y} L ${cx - 8} ${cy}`, comp.terminals.in);
        this._wire(g, `M ${cx + 8} ${cy} L ${b.x} ${b.y}`, comp.terminals.out);
        line(cx - 8, cy - 10, cx - 8, cy + 10, "ladder-plate");
        line(cx + 8, cy - 10, cx + 8, cy + 10, "ladder-plate");
        add("line", { class: "ladder-bridge", x1: cx - 8, y1: cy, x2: cx + 8, y2: cy });
        if (comp.contact === "NC")
          line(cx - 11, cy + 12, cx + 11, cy - 12, "nc-slash");
        // button actuator above the contact
        const cap = el("g", { class: "btn-cap-g" });
        cap.appendChild(el("line", { class: "plunger", x1: cx, y1: cy - 10, x2: cx, y2: cy - 22 }));
        cap.appendChild(el("rect", { class: "btn-cap", x: cx - 9, y: cy - 27, width: 18, height: 5, rx: 1.5 }));
        g.appendChild(cap);
        this._label(g, comp, cx, cy + 24);
        // fat invisible hit zone over contact + actuator: easy to press-and-hold
        add("rect", { class: "comp-hit", x: cx - 20, y: cy - 30, width: 40, height: 50, rx: 6 });
        break;
      }
      case "coil":
      case "timer_coil": {                    // relay coil: IEC rectangle
        const a = T("a"), b = T("b");
        this._wire(g, `M ${a.x} ${a.y} L ${cx - 16} ${cy}`, comp.terminals.a);
        this._wire(g, `M ${cx + 16} ${cy} L ${b.x} ${b.y}`, comp.terminals.b);
        add("rect", { class: "coil-body", x: cx - 16, y: cy - 11, width: 32, height: 22, rx: 2 });
        if (comp.type === "timer_coil") {
          line(cx - 16, cy - 11, cx + 16, cy + 11, "coil-diag");   // timer slash
          add("text", { class: "coil-glyph", x: cx, y: cy + 4, "text-anchor": "middle" }, "T");
        }
        this._label(g, comp, cx, cy + 25);
        break;
      }
      case "bulb": {                          // realistic incandescent lamp
        const a = T("a"), b = T("b");
        this._wire(g, `M ${a.x} ${a.y} L ${cx - 13} ${cy}`, comp.terminals.a);
        this._wire(g, `M ${cx + 13} ${cy} L ${b.x} ${b.y}`, comp.terminals.b);
        add("circle", { class: "bulb-halo", cx, cy: cy - 2, r: 21 });
        // glass envelope (bulb silhouette: round top, short neck to base)
        add("path", { class: "bulb-glass", d:
          `M ${cx - 8} ${cy + 9} `+
          `C ${cx - 14} ${cy + 4} ${cx - 14} ${cy - 14} ${cx} ${cy - 14} `+
          `C ${cx + 14} ${cy - 14} ${cx + 14} ${cy + 4} ${cx + 8} ${cy + 9} Z` });
        // filament: support posts in from the leads, coiled element across the middle
        add("path", { class: "filament", d:
          `M ${cx - 13} ${cy} L ${cx - 6} ${cy} L ${cx - 6} ${cy - 3} `+
          `L ${cx - 3.5} ${cy + 1} L ${cx - 1.2} ${cy - 4} L ${cx + 1.2} ${cy + 1} L ${cx + 3.5} ${cy - 4} `+
          `L ${cx + 6} ${cy - 3} L ${cx + 6} ${cy} L ${cx + 13} ${cy}` });
        // screw base
        add("rect", { class: "bulb-base", x: cx - 7, y: cy + 9, width: 14, height: 6, rx: 1 });
        line(cx - 7, cy + 12, cx + 7, cy + 12, "bulb-thread");
        this._label(g, comp, cx, cy + 30);
        break;
      }
      case "motor": {                         // motor: circle with M (3-phase load)
        const a = T("a"), b = T("b");
        this._wire(g, `M ${a.x} ${a.y} L ${cx - 16} ${cy}`, comp.terminals.a);
        this._wire(g, `M ${cx + 16} ${cy} L ${b.x} ${b.y}`, comp.terminals.b);
        add("circle", { class: "motor-halo", cx, cy, r: 21 });
        add("circle", { class: "motor-body", cx, cy, r: 16 });
        add("text", { class: "motor-glyph", x: cx, y: cy + 6, "text-anchor": "middle" }, "M");
        this._label(g, comp, cx, cy + 31);
        break;
      }
      case "test_point": {
        // The MARKER sits ON the node it measures (that's where a real lead
        // touches); the authored (x,y) is just where the label text lives.
        const node = this.nodeById.get(comp.terminals.p);
        const nx = node ? node.x : cx, ny = node ? node.y : cy;
        if (node && (Math.abs(nx - cx) > 4 || Math.abs(ny - cy) > 4))
          add("line", { class: "tp-leader", x1: cx, y1: cy + 6, x2: nx, y2: ny - 6 });
        const lbl = el("text", { class: "tp-label", x: cx, y: cy, "text-anchor": "middle" });
        lbl.textContent = comp.label || comp.id;
        g.appendChild(lbl);
        add("circle", { class: "tp-ring", cx: nx, cy: ny, r: 7 });
        add("circle", { class: "tp-dot", cx: nx, cy: ny, r: 2.6 });
        g.classList.add("clickable");
        g.addEventListener("click", () => this.onTestPointClick && this.onTestPointClick(comp));
        this.testPoints.push({ compId: comp.id, nodeId: comp.terminals.p, el: g, x: nx, y: ny });
        break;
      }
    }
  }

  applyState(state) {
    for (const { path, flow, nodeId } of this.leadEls) {
      const flowing = state.flowNodes.has(nodeId);
      const pos = state.posSet.has(nodeId);
      const neg = state.negSet.has(nodeId);
      path.classList.toggle("energized", flowing && pos);   // + side: red/hot
      path.classList.toggle("return", flowing && neg);      // − side: black/return
      path.classList.toggle("hot", !flowing && pos);        // + present, no current
      if (flow) flow.classList.toggle("on", flowing);
    }
    for (const { circle, nodeId } of this.junctionEls) {
      const flowing = state.flowNodes.has(nodeId);
      const pos = state.posSet.has(nodeId);
      const neg = state.negSet.has(nodeId);
      circle.classList.toggle("energized", flowing && pos);
      circle.classList.toggle("return", flowing && neg);
      circle.classList.toggle("hot", !flowing && pos);
    }
    for (const [id, rec] of this.compEls) {
      const g = rec.g;
      switch (rec.type) {
        case "contact_no": case "contact_nc": case "pushbutton": {
          const closed = !!state.contactClosed.get(id);
          g.setAttribute("data-state", closed ? "closed" : "open");
          const inN = rec.comp.terminals.in, outN = rec.comp.terminals.out;
          const conducting = closed && (state.flowNodes.has(inN) || state.flowNodes.has(outN));
          g.classList.toggle("conducting", conducting);
          const onNeg = conducting && (state.negSet.has(inN) || state.negSet.has(outN)) &&
                        !(state.posSet.has(inN) || state.posSet.has(outN));
          g.classList.toggle("neg-side", onNeg);
          break;
        }
        case "coil": case "timer_coil":
          g.classList.toggle("energized", !!state.coilEnergized.get(id));
          g.classList.toggle("damaged", !!(state.damaged && state.damaged.get(id)));
          break;
        case "bulb":
          g.classList.toggle("lit", !!state.loadOn.get(id));
          break;
        case "motor":
          g.classList.toggle("running", !!state.loadOn.get(id));
          break;
        case "fuse":
          g.classList.toggle("blown", !!(rec.comp.fault && rec.comp.fault.kind === "blown_fuse"));
          break;
      }
    }
  }

  pulseTestPoint(compId) {
    const tp = this.testPoints.find((t) => t.compId === compId);
    if (!tp) return;
    tp.el.classList.remove("ping");
    void tp.el.getBBox; tp.el.classList.add("ping");
  }

  setProbes(a, b) {
    for (const { el } of this.testPoints) el.classList.remove("probe-a", "probe-b");
    const ta = this.testPoints.find((t) => t.nodeId === a);
    const tb = this.testPoints.find((t) => t.nodeId === b);
    if (ta) ta.el.classList.add("probe-a");
    if (tb) tb.el.classList.add("probe-b");
  }
}

function orthoPath(x1, y1, x2, y2) {
  if (x1 === x2 || y1 === y2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  return `M ${x1} ${y1} L ${x1} ${y2} L ${x2} ${y2}`;
}
