// =============================================================================
// realistic_contactor.js — a labeled, technically-accurate illustration of a
// real IEC contactor/relay (NOT a schematic symbol). Matches the real part
// photos in assets/relays/: coil terminals A1/A2 on the top face, main power
// terminals 1/L1, 3/L2, 5/L3 (in) over 2/T1, 4/T2, 6/T3 (out), an auxiliary
// NO contact 13-14, and a DIN-rail clip. Draws into a caller-supplied <svg>.
//
// Returns { hotspots:{coil,pole1,pole2,pole3,auxNO}, setHighlight(key,on) } so
// a dual-view (see dual_view.js) can link it to a live schematic.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
function E(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}

// One hotspot = an invisible clickable hit-area + a highlight ring drawn
// around the real terminals it represents. `onClick(key)` fires on click.
function makeHotspot(root, key, ringPoints, hitBox, onClick) {
  const g = E("g", { class: "rc-hotspot", "data-key": key, tabindex: "0", role: "button" });
  const ring = E("rect", {
    class: "rc-ring", x: hitBox.x - 6, y: hitBox.y - 6,
    width: hitBox.w + 12, height: hitBox.h + 12, rx: 10,
  });
  g.appendChild(ring);
  for (const p of ringPoints) g.appendChild(p);
  const hit = E("rect", { class: "rc-hit", x: hitBox.x, y: hitBox.y, width: hitBox.w, height: hitBox.h, rx: 8 });
  g.appendChild(hit);
  g.addEventListener("click", () => onClick && onClick(key));
  g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick && onClick(key); } });
  root.appendChild(g);
  return { g, ring };
}

// Real contactors print the terminal number + wire code together, INSIDE the
// light terminal block (never on the dark body above/below it — no contrast
// there). `towardCenter` = true puts the label below the hole (top row,
// reading down toward the nameplate); false puts it above (bottom row,
// reading up toward the nameplate) — either way it stays on the light block.
function terminal(cx, cy, numLabel, wireLabel, towardCenter) {
  const g = E("g", { class: "rc-terminal" });
  g.appendChild(E("circle", { class: "rc-term-hole", cx, cy, r: 9 }));
  g.appendChild(E("circle", { class: "rc-term-screw", cx, cy, r: 3.4 }));
  const ly = towardCenter ? cy + 21 : cy - 15;
  const text = wireLabel ? `${numLabel} ${wireLabel}` : numLabel;
  g.appendChild(E("text", { class: "rc-term-label", x: cx, y: ly, "text-anchor": "middle" }, text));
  return g;
}

/**
 * Build the illustration into `svg` (an existing <svg> element; viewBox is set here).
 * onHotspotClick(key) fires when the learner clicks a terminal group.
 */
export function buildContactorIllustration(svg, onHotspotClick) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", "0 0 360 480");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.classList.add("rc-svg");

  const defs = E("defs");
  const bodyGrad = E("linearGradient", { id: "rc-body-grad", x1: "0", y1: "0", x2: "1", y2: "1" });
  bodyGrad.appendChild(E("stop", { offset: "0", "stop-color": "#4B5563" }));
  bodyGrad.appendChild(E("stop", { offset: "1", "stop-color": "#2B333D" }));
  defs.appendChild(bodyGrad);
  const topGrad = E("linearGradient", { id: "rc-top-grad", x1: "0", y1: "0", x2: "0", y2: "1" });
  topGrad.appendChild(E("stop", { offset: "0", "stop-color": "#6B7688" }));
  topGrad.appendChild(E("stop", { offset: "1", "stop-color": "#4B5563" }));
  defs.appendChild(topGrad);
  svg.appendChild(defs);

  const root = E("g", { class: "rc-root" });
  svg.appendChild(root);

  // ---- DIN rail (background) ----
  root.appendChild(E("rect", { class: "rc-dinrail", x: 20, y: 430, width: 320, height: 14, rx: 2 }));
  root.appendChild(E("rect", { class: "rc-dinclip", x: 130, y: 410, width: 100, height: 26, rx: 3 }));

  // ---- body ----
  root.appendChild(E("rect", { class: "rc-body", x: 70, y: 66, width: 220, height: 348, rx: 14 }));
  root.appendChild(E("rect", { class: "rc-top-face", x: 78, y: 60, width: 204, height: 26, rx: 8 }));

  // mounting ears (left/right)
  root.appendChild(E("rect", { class: "rc-ear", x: 44, y: 210, width: 30, height: 46, rx: 8 }));
  root.appendChild(E("circle", { class: "rc-ear-hole", cx: 59, cy: 233, r: 6 }));
  root.appendChild(E("rect", { class: "rc-ear", x: 286, y: 210, width: 30, height: 46, rx: 8 }));
  root.appendChild(E("circle", { class: "rc-ear-hole", cx: 301, cy: 233, r: 6 }));

  // ---- nameplate ----
  const plate = E("g", { class: "rc-plate" });
  plate.appendChild(E("rect", { x: 96, y: 250, width: 168, height: 70, rx: 4 }));
  plate.appendChild(E("text", { class: "rc-plate-brand", x: 180, y: 272, "text-anchor": "middle" }, "RELAY TRAINING CO."));
  plate.appendChild(E("text", { class: "rc-plate-model", x: 180, y: 290, "text-anchor": "middle" }, "CN-25  ·  3-POLE CONTACTOR"));
  plate.appendChild(E("text", { class: "rc-plate-spec", x: 180, y: 306, "text-anchor": "middle" }, "COIL 24VDC  ·  600V 25A AC-3"));
  root.appendChild(plate);

  // indicator flags (the moving-contact-carrier windows real contactors show)
  const flags = E("g", { class: "rc-flags" });
  [148, 180, 212].forEach((x) => flags.appendChild(E("rect", { class: "rc-flag", x: x - 12, y: 328, width: 24, height: 34, rx: 3 })));
  root.appendChild(flags);

  // ---- coil terminals A1 / A2 (top corners) ----
  const a1 = E("g", { class: "rc-coilterm" });
  a1.appendChild(E("rect", { x: 78, y: 44, width: 26, height: 22, rx: 3 }));
  a1.appendChild(E("circle", { class: "rc-term-screw", cx: 91, cy: 55, r: 3 }));
  a1.appendChild(E("text", { class: "rc-term-num", x: 91, y: 36, "text-anchor": "middle" }, "A1"));
  root.appendChild(a1);
  const a2 = E("g", { class: "rc-coilterm" });
  a2.appendChild(E("rect", { x: 256, y: 44, width: 26, height: 22, rx: 3 }));
  a2.appendChild(E("circle", { class: "rc-term-screw", cx: 269, cy: 55, r: 3 }));
  a2.appendChild(E("text", { class: "rc-term-num", x: 269, y: 36, "text-anchor": "middle" }, "A2"));
  root.appendChild(a2);

  // ---- top terminal row: 1/L1, 3/L2, 5/L3, 13 ----
  const topY = 108;
  root.appendChild(E("rect", { class: "rc-termblock", x: 82, y: topY - 25, width: 196, height: 50, rx: 6 }));
  const topXs = [116, 168, 220, 262];
  const topLabels = [["1", "L1"], ["3", "L2"], ["5", "L3"], ["13", ""]];
  topXs.forEach((x, i) => root.appendChild(terminal(x, topY, topLabels[i][0], topLabels[i][1], true)));

  // ---- bottom terminal row: 2/T1, 4/T2, 6/T3, 14 ----
  const botY = 396;
  root.appendChild(E("rect", { class: "rc-termblock", x: 82, y: botY - 25, width: 196, height: 50, rx: 6 }));
  const botXs = [116, 168, 220, 262];
  const botLabels = [["2", "T1"], ["4", "T2"], ["6", "T3"], ["14", ""]];
  botXs.forEach((x, i) => root.appendChild(terminal(x, botY, botLabels[i][0], botLabels[i][1], false)));

  root.appendChild(E("text", { class: "rc-caption", x: 180, y: 470, "text-anchor": "middle" }, "Click a terminal — or a part in the schematic — to link them"));

  // ---- hotspots (drawn LAST so their highlight rings sit on top) ----
  const hotspots = {};
  hotspots.coil = makeHotspot(root, "coil", [], { x: 74, y: 40, w: 212, h: 40 }, onHotspotClick);
  hotspots.pole1 = makeHotspot(root, "pole1", [], { x: 100, y: topY - 26, w: 32, h: botY - topY + 52 }, onHotspotClick);
  hotspots.pole2 = makeHotspot(root, "pole2", [], { x: 152, y: topY - 26, w: 32, h: botY - topY + 52 }, onHotspotClick);
  hotspots.pole3 = makeHotspot(root, "pole3", [], { x: 204, y: topY - 26, w: 32, h: botY - topY + 52 }, onHotspotClick);
  hotspots.auxNO = makeHotspot(root, "auxNO", [], { x: 246, y: topY - 26, w: 32, h: botY - topY + 52 }, onHotspotClick);

  function setHighlight(key, on) {
    const h = hotspots[key];
    if (h) h.ring.classList.toggle("hot", on);
  }
  function clearAll() { for (const k in hotspots) setHighlight(k, false); }

  return { hotspots, setHighlight, clearAll };
}
