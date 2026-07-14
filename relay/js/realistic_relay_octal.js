// =============================================================================
// realistic_relay_octal.js — labeled, pin-end illustrations of REAL relay
// bases, grown into a multi-layout library. Every pinout below was read off
// the rasterized AutomationDirect cut sheets in app/assets/cutsheets/:
//
//   'spdt5'  — 5-blade SPDT (781-1C):  NC 1(12) / NO 5(14) / COM 9(11),
//              coil 13(A1)+ / 14(A2)−        [78_series_relays/p5.png, tREL-20]
//   'dpdt8'  — 8-pin octal DPDT (750R-2C): A1=2, A2=7; pole1 c1/nc4/no3,
//              pole2 c8/nc5/no6 — the SAME verified mapping used everywhere
//              since relay_anatomy.js          [750R_series_relays/p3.png, 750-2C-SKT]
//   '3pdt11' — 11-pin octal 3PDT (750R-3C): A1=2, A2=10; pole1 c1/nc4/no3,
//              pole2 c6/nc5/no7, pole3 c11/nc8/no9
//                                              [750R_series_relays/p3.png, 750-3C-SKT]
//   '4pdt14' — 14-blade 4PDT (784-4C-24D): NC row 1-4, NO row 5-8,
//              COM row 9-12, coil 13(A1)+ / 14(A2)−
//                        [78_series_relays/p5.png + 784-4C-24D_cutsheet/p1.png]
//
// Every layout: labeled pins, the coil drawn between its real terminals, pole
// blades resting on NC, and an ENERGIZE toggle inside the SVG that swings the
// blades NC→NO (same data-nc-*/data-no-* attribute pattern as relay_anatomy.js)
// while the coil glows.
// Same hotspot API as realistic_contactor.js so dual_view.js can drive either
// interchangeably: { hotspots, setHighlight, clearAll }. Hotspot keys: "coil",
// "pole1".."pole4" (per layout). buildOctalIllustration() stays exported as the
// dpdt8 shortcut so existing callers keep working unchanged.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
function E(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}

function makeRingHotspot(root, key, cx, cy, r, onClick) {
  const g = E("g", { class: "rc-hotspot", "data-key": key, tabindex: "0", role: "button" });
  const ring = E("circle", { class: "rc-ring", cx, cy, r });
  g.appendChild(ring);
  const hit = E("circle", { class: "rc-hit", cx, cy, r });
  g.appendChild(hit);
  g.addEventListener("click", () => onClick && onClick(key));
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(key); } });
  root.appendChild(g);
  return { g, ring };
}

// fresh <svg> canvas with the shared rc-root group
function prep(svg, viewBox) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", viewBox);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("rc-svg");
  const root = E("g", { class: "rc-root" });
  svg.appendChild(root);
  return root;
}

// a moving blade that rests on NC and remembers where NO is (relay_anatomy.js pattern)
function addBlade(parent, x1, y1, ncX, ncY, noX, noY) {
  parent.appendChild(E("line", {
    class: "rc-octal-blade", x1, y1, x2: ncX, y2: ncY,
    "data-nc-x": ncX, "data-nc-y": ncY, "data-no-x": noX, "data-no-y": noY,
  }));
}

// a flat blade terminal (rect) with its number inside — counts as an .rc-pin
function bladePin(root, n, x, y, w = 30) {
  root.appendChild(E("rect", { class: "rc-pin rc-pin-blade", x: x - w / 2, y: y - 7, width: w, height: 14, rx: 3 }));
  root.appendChild(E("text", { class: "rc-pin-num", x, y: y + 4, "text-anchor": "middle" }, String(n)));
  return { x, y };
}

// the in-panel ENERGIZE toggle: flips .energized on rc-root and swings blades
function wireEnergize(root, x, y, w = 200) {
  const g = E("g", { class: "rc-energize", transform: `translate(${x},${y})`, tabindex: "0", role: "button", "aria-label": "Energize the coil" });
  g.appendChild(E("rect", { class: "rc-eng-bg", x: 0, y: 0, width: w, height: 40, rx: 20 }));
  g.appendChild(E("circle", { class: "rc-eng-led", cx: 22, cy: 20, r: 7 }));
  const label = E("text", { class: "rc-eng-text", x: w / 2 + 10, y: 25, "text-anchor": "middle" }, "ENERGIZE COIL");
  g.appendChild(label);
  g.appendChild(E("rect", { class: "rc-eng-hit", x: 0, y: 0, width: w, height: 40, rx: 20 }));
  let on = false;
  const apply = () => {
    root.classList.toggle("energized", on);
    label.textContent = on ? "COIL ENERGIZED" : "ENERGIZE COIL";
    root.querySelectorAll(".rc-octal-blade").forEach((bl) => {
      bl.setAttribute("x2", bl.getAttribute(on ? "data-no-x" : "data-nc-x"));
      bl.setAttribute("y2", bl.getAttribute(on ? "data-no-y" : "data-nc-y"));
    });
  };
  const flip = () => { on = !on; apply(); };
  g.addEventListener("click", flip);
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } });
  root.appendChild(g);
  apply();
  return g;
}

function finish(hotspots) {
  function setHighlight(key, on) {
    const h = hotspots[key];
    if (h) h.ring.classList.toggle("hot", on);
  }
  function clearAll() { for (const k in hotspots) setHighlight(k, false); }
  return { hotspots, setHighlight, clearAll };
}

// ---------------------------------------------------------------------------
// circular octal bases (8-pin DPDT and 11-pin 3PDT) share one builder
// ---------------------------------------------------------------------------
const CFG_DPDT8 = {
  caption: "Top-down · 8-pin octal base (DPDT)",
  pins: [
    { n: 1, a: 145 }, { n: 2, a: 180, lbl: "A1", pol: "+" }, { n: 3, a: 215 },
    { n: 4, a: 250 }, { n: 5, a: 290 }, { n: 6, a: 325 },
    { n: 7, a: 0, lbl: "A2", pol: "–" }, { n: 8, a: 35 },
  ],
  coil: [2, 7],
  poles: [{ c: 1, nc: 4, no: 3 }, { c: 8, nc: 5, no: 6 }],
  poleRingR: 56,
};

const CFG_3PDT11 = {
  caption: "Top-down · 11-pin octal base (3PDT)",
  // 11 pins spread over 290° with the keyway gap at the bottom (same style as
  // the 8-pin drawing); A1 = pin 2, A2 = pin 10 per the 750-3C-SKT print
  pins: Array.from({ length: 11 }, (_, i) => {
    const p = { n: i + 1, a: (125 + i * 29) % 360 };
    if (p.n === 2) { p.lbl = "A1"; p.pol = "+"; }
    if (p.n === 10) { p.lbl = "A2"; p.pol = "–"; }
    return p;
  }),
  coil: [2, 10],
  poles: [{ c: 1, nc: 4, no: 3 }, { c: 6, nc: 5, no: 7 }, { c: 11, nc: 8, no: 9 }],
  poleRingR: 48,
};

function buildCircularOctal(svg, onClick, cfg) {
  const root = prep(svg, "0 0 360 512");
  const cx = 180, cy = 214, R = 140;
  root.appendChild(E("text", { class: "rc-caption", x: cx, y: 40, "text-anchor": "middle" }, cfg.caption));
  root.appendChild(E("circle", { class: "rc-octal-body", cx, cy, r: R }));
  root.appendChild(E("circle", { class: "rc-octal-inner", cx, cy, r: R - 26 }));

  const pos = {};
  for (const p of cfg.pins) {
    const rad = (p.a * Math.PI) / 180;
    const px = cx + Math.cos(rad) * R, py = cy + Math.sin(rad) * R;
    pos[p.n] = { x: px, y: py };
    root.appendChild(E("circle", { class: "rc-pin", cx: px, cy: py, r: 10 }));
    root.appendChild(E("text", { class: "rc-pin-num", x: px, y: py + 4, "text-anchor": "middle" }, String(p.n)));
    const lx = cx + Math.cos(rad) * (R + 24), ly = cy + Math.sin(rad) * (R + 24);
    if (p.lbl) root.appendChild(E("text", { class: "rc-pin-lbl", x: lx + (p.pol === "+" ? -8 : 8), y: ly + 4, "text-anchor": "middle" }, p.lbl));
    if (p.pol) root.appendChild(E("text", { class: `rc-pin-lbl ${p.pol === "+" ? "plus" : "minus"}`, x: lx + 14, y: ly + 4 }, p.pol));
  }

  // ---- coil in the center, fed by its real pins ----
  const [a1, a2] = cfg.coil;
  const coilG = E("g", { class: "rc-octal-coil" });
  coilG.appendChild(E("line", { class: "rc-octal-wire", x1: pos[a1].x, y1: pos[a1].y, x2: cx - 30, y2: cy }));
  coilG.appendChild(E("line", { class: "rc-octal-wire", x1: pos[a2].x, y1: pos[a2].y, x2: cx + 30, y2: cy }));
  coilG.appendChild(E("rect", { class: "rc-octal-coilbody", x: cx - 30, y: cy - 16, width: 60, height: 32, rx: 4 }));
  coilG.appendChild(E("text", { class: "rc-octal-coiltext", x: cx, y: cy + 5, "text-anchor": "middle" }, "COIL"));
  root.appendChild(coilG);

  // ---- SPDT poles: common -> blade (rests on NC) -> NO / NC leads ----
  for (const pl of cfg.poles) {
    const c = pos[pl.c], nc = pos[pl.nc], no = pos[pl.no];
    const midX = (c.x + cx) / 2, midY = (c.y + cy) / 2;
    root.appendChild(E("line", { class: "rc-octal-wire", x1: c.x, y1: c.y, x2: midX, y2: midY }));
    root.appendChild(E("circle", { class: "rc-octal-common", cx: midX, cy: midY, r: 3 }));
    const ncX = midX + (nc.x - midX) * 0.4, ncY = midY + (nc.y - midY) * 0.4;
    const noX = midX + (no.x - midX) * 0.4, noY = midY + (no.y - midY) * 0.4;
    root.appendChild(E("line", { class: "rc-octal-wire nc-lead", x1: nc.x, y1: nc.y, x2: ncX, y2: ncY }));
    root.appendChild(E("line", { class: "rc-octal-wire no-lead", x1: no.x, y1: no.y, x2: noX, y2: noY }));
    addBlade(root, midX, midY, ncX, ncY, noX, noY);
  }

  // ---- hotspots last so highlight rings sit on top ----
  const hotspots = {};
  hotspots.coil = makeRingHotspot(root, "coil", cx, cy, 40, onClick);
  cfg.poles.forEach((pl, i) => {
    const c = pos[pl.c], nc = pos[pl.nc], no = pos[pl.no];
    hotspots[`pole${i + 1}`] = makeRingHotspot(root, `pole${i + 1}`,
      (c.x + nc.x + no.x) / 3, (c.y + nc.y + no.y) / 3, cfg.poleRingR, onClick);
  });

  wireEnergize(root, 80, 460, 200);
  return finish(hotspots);
}

// ---------------------------------------------------------------------------
// 'spdt5' — 5-blade SPDT, AutomationDirect 781-1C style
// (blade numbers + IEC codes straight off the 78-series wiring diagram page)
// ---------------------------------------------------------------------------
function buildSpdt5(svg, onClick) {
  const root = prep(svg, "0 0 360 512");
  root.appendChild(E("text", { class: "rc-caption", x: 180, y: 40, "text-anchor": "middle" }, "Pin-end view · 5-blade SPDT (781 style)"));
  root.appendChild(E("rect", { class: "rc-octal-body", x: 70, y: 62, width: 220, height: 348, rx: 18 }));

  // switch terminals: NC 1(12), NO 5(14), COM 9(11)
  const nc = bladePin(root, 1, 120, 112);
  const no = bladePin(root, 5, 240, 112);
  const com = bladePin(root, 9, 180, 268);
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 120, y: 92, "text-anchor": "middle" }, "NC (12)"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 240, y: 92, "text-anchor": "middle" }, "NO (14)"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 180, y: 294, "text-anchor": "middle" }, "COM (11)"));

  // internal contact stubs + the moving blade (rests on NC)
  const ncC = { x: 150, y: 168 }, noC = { x: 210, y: 168 }, pivot = { x: 180, y: 236 };
  root.appendChild(E("line", { class: "rc-octal-wire nc-lead", x1: nc.x, y1: nc.y + 7, x2: ncC.x, y2: ncC.y }));
  root.appendChild(E("line", { class: "rc-octal-wire no-lead", x1: no.x, y1: no.y + 7, x2: noC.x, y2: noC.y }));
  root.appendChild(E("line", { class: "rc-octal-wire", x1: com.x, y1: com.y - 7, x2: pivot.x, y2: pivot.y }));
  root.appendChild(E("circle", { class: "rc-octal-common", cx: pivot.x, cy: pivot.y, r: 3 }));
  addBlade(root, pivot.x, pivot.y, ncC.x, ncC.y, noC.x, noC.y);

  // coil: blades 13 (A1 +) and 14 (A2 −) at the bottom of the base
  const a1 = bladePin(root, 13, 110, 372);
  const a2 = bladePin(root, 14, 250, 372);
  root.appendChild(E("line", { class: "rc-octal-wire", x1: a1.x, y1: a1.y, x2: 150, y2: 340 }));
  root.appendChild(E("line", { class: "rc-octal-wire", x1: a2.x, y1: a2.y, x2: 210, y2: 340 }));
  root.appendChild(E("rect", { class: "rc-octal-coilbody", x: 150, y: 324, width: 60, height: 32, rx: 4 }));
  root.appendChild(E("text", { class: "rc-octal-coiltext", x: 180, y: 345, "text-anchor": "middle" }, "COIL"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 102, y: 398, "text-anchor": "middle" }, "A1"));
  root.appendChild(E("text", { class: "rc-pin-lbl plus", x: 118, y: 398 }, "+"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 242, y: 398, "text-anchor": "middle" }, "A2"));
  root.appendChild(E("text", { class: "rc-pin-lbl minus", x: 258, y: 398 }, "–"));

  const hotspots = {};
  hotspots.pole1 = makeRingHotspot(root, "pole1", 180, 182, 66, onClick);
  hotspots.coil = makeRingHotspot(root, "coil", 180, 348, 44, onClick);
  wireEnergize(root, 80, 452, 200);
  return finish(hotspots);
}

// ---------------------------------------------------------------------------
// '4pdt14' — 14-blade 4PDT, AutomationDirect 784-4C-24D style
// (grid straight off the 78-series wiring diagram: NC 1-4 / NO 5-8 / COM 9-12,
//  coil 13/14 — each column of three is one pole)
// ---------------------------------------------------------------------------
function buildQuad14(svg, onClick) {
  const root = prep(svg, "0 0 420 520");
  root.appendChild(E("text", { class: "rc-caption", x: 210, y: 40, "text-anchor": "middle" }, "Pin-end view · 14-blade 4PDT (784 style)"));
  root.appendChild(E("rect", { class: "rc-octal-body", x: 42, y: 58, width: 336, height: 364, rx: 18 }));

  const cols = [96, 172, 248, 324];
  const NC_Y = 112, NO_Y = 192, COM_Y = 288;
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 64, y: NC_Y + 4, "text-anchor": "middle" }, "NC"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 64, y: NO_Y + 4, "text-anchor": "middle" }, "NO"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 63, y: COM_Y + 4, "text-anchor": "middle" }, "COM"));

  cols.forEach((colX, i) => {
    const nc = bladePin(root, i + 1, colX, NC_Y, 24);
    const no = bladePin(root, i + 5, colX, NO_Y, 24);
    const com = bladePin(root, i + 9, colX, COM_Y, 24);
    const ncC = { x: colX - 22, y: 226 }, noC = { x: colX + 22, y: 226 }, pivot = { x: colX, y: 262 };
    root.appendChild(E("line", { class: "rc-octal-wire nc-lead", x1: nc.x, y1: nc.y + 7, x2: ncC.x, y2: ncC.y }));
    root.appendChild(E("line", { class: "rc-octal-wire no-lead", x1: no.x, y1: no.y + 7, x2: noC.x, y2: noC.y }));
    root.appendChild(E("line", { class: "rc-octal-wire", x1: com.x, y1: com.y - 7, x2: pivot.x, y2: pivot.y }));
    root.appendChild(E("circle", { class: "rc-octal-common", cx: pivot.x, cy: pivot.y, r: 3 }));
    addBlade(root, pivot.x, pivot.y, ncC.x, ncC.y, noC.x, noC.y);
  });

  // coil row: 13 (A1 +) and 14 (A2 −) drive all four poles
  const a1 = bladePin(root, 13, 126, 378, 28);
  const a2 = bladePin(root, 14, 294, 378, 28);
  root.appendChild(E("line", { class: "rc-octal-wire", x1: a1.x + 14, y1: a1.y, x2: 180, y2: 378 }));
  root.appendChild(E("line", { class: "rc-octal-wire", x1: a2.x - 14, y1: a2.y, x2: 240, y2: 378 }));
  root.appendChild(E("rect", { class: "rc-octal-coilbody", x: 180, y: 362, width: 60, height: 32, rx: 4 }));
  root.appendChild(E("text", { class: "rc-octal-coiltext", x: 210, y: 383, "text-anchor": "middle" }, "COIL"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 118, y: 404, "text-anchor": "middle" }, "A1"));
  root.appendChild(E("text", { class: "rc-pin-lbl plus", x: 134, y: 404 }, "+"));
  root.appendChild(E("text", { class: "rc-pin-lbl", x: 286, y: 404, "text-anchor": "middle" }, "A2"));
  root.appendChild(E("text", { class: "rc-pin-lbl minus", x: 302, y: 404 }, "–"));

  const hotspots = {};
  cols.forEach((colX, i) => {
    hotspots[`pole${i + 1}`] = makeRingHotspot(root, `pole${i + 1}`, colX, 220, 36, onClick);
  });
  hotspots.coil = makeRingHotspot(root, "coil", 210, 380, 42, onClick);
  wireEnergize(root, 110, 462, 200);
  return finish(hotspots);
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/**
 * Build a labeled real-relay pinout into `svg`. onClick(key) fires on hotspot
 * click (keys: coil, pole1..pole4 depending on layout).
 * Layouts: 'spdt5' | 'dpdt8' | '3pdt11' | '4pdt14'.
 */
export function buildRelayPinout(svg, onClick, { layout = "dpdt8" } = {}) {
  switch (layout) {
    case "spdt5": return buildSpdt5(svg, onClick);
    case "3pdt11": return buildCircularOctal(svg, onClick, CFG_3PDT11);
    case "4pdt14": return buildQuad14(svg, onClick);
    case "dpdt8":
    default: return buildCircularOctal(svg, onClick, CFG_DPDT8);
  }
}

/** Back-compat: the original 8-pin octal DPDT illustration. */
export function buildOctalIllustration(svg, onHotspotClick) {
  return buildRelayPinout(svg, onHotspotClick, { layout: "dpdt8" });
}
