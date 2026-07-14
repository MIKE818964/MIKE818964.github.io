// =============================================================================
// m14_exploded_contactor.js — "EXPLODED VIEW: Inside a real IEC contactor"
//
// A premium interactive teardown, side cross-section, three stacked layers
// (top -> bottom, matching how the real part comes apart):
//   1. CONTACT CARRIER  — moving contact carrier + main contacts (1L1/3L2/5L3
//      in over 2T1/4T2/6T3 out) + the 13/14 aux finger
//   2. ARMATURE + SPRINGS — the moving iron + return springs that snap it
//      back open when the coil de-energizes
//   3. COIL + CORE + BASE — electromagnet coil, magnetic core/yoke, DIN foot
//
// A drag SLIDER (or grabbing the assembly itself) explodes the three layers
// apart vertically with a springy transition; labels + leader lines fade in
// as separation increases. Click any layer to highlight it + populate a
// fact card (function + common failure mode). An ENERGIZE toggle works at
// ANY explosion level: coil glows, armature + carrier pull down, main
// contacts close (green), aux (13-14, NO) follows and closes too.
//
// Self-contained ES module. Pure vanilla JS + inline SVG. Every CSS class is
// prefixed `m14x-` so nothing collides with sibling modules or the real
// m14-swap-bulb-for-motor-starter lesson (different namespace entirely).
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
function S(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}
function H(name, attrs = {}, txt) {
  const e = document.createElement(name);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  if (txt != null) e.textContent = txt;
  return e;
}

// ---------------------------------------------------------------- layer facts
const FACTS = {
  carrier: {
    tag: "LAYER 1 · TOP",
    title: "Moving contact carrier + main contacts",
    body: "The insulated carrier holds three bridging contacts (one per pole). " +
      "The coil's pull drags this carrier straight down, bridging 1L1→2T1, " +
      "3L2→4T2 and 5L3→6T3 in one simultaneous stroke — plus the 13-14 " +
      "auxiliary finger for your control/seal-in circuit.",
    fails: "FAILS AS: welded/stuck contacts (arced from switching under load, won't " +
      "reopen — motor stays running after Stop) · a cracked carrier (chatters or " +
      "won't bridge all 3 poles evenly) · burnt/pitted contact faces (voltage drop, heat).",
  },
  armature: {
    tag: "LAYER 2 · MIDDLE",
    title: "Armature + return springs",
    body: "The armature is the moving iron half of the magnetic circuit. Energized, " +
      "it's pulled down onto the fixed core; the return springs are what shove it " +
      "back UP the instant the coil drops out — that's what makes contactors " +
      "fail-safe (no coil power = no closed contacts).",
    fails: "FAILS AS: a weak/broken return spring (contacts stay half-welded shut, " +
      "sluggish drop-out, chatter/buzz) · worn armature face (won't seat flush, " +
      "loud hum, won't pull in fully on marginal voltage).",
  },
  coil: {
    tag: "LAYER 3 · BOTTOM",
    title: "Coil, magnetic core + DIN base",
    body: "The coil (A1/A2) is copper magnet wire wound around the fixed core/yoke. " +
      "Energize it and it becomes an electromagnet, pulling the armature down " +
      "through the airgap. The DIN foot clips the whole assembly to the rail and " +
      "grounds the frame.",
    fails: "FAILS AS: shorted/open coil winding (measure A1-A2 resistance — open = " +
      "infinite Ω, shorted = near 0Ω and it'll hum + smell hot) · cracked/" +
      "chipped core face (loud buzz, won't fully seat, chatters) · broken DIN clip " +
      "(unit rattles or falls off the rail).",
  },
};

export function render(host) {
  host.innerHTML = "";

  const style = H("style");
  style.textContent = css();
  host.appendChild(style);

  const root = H("div", { class: "m14x-root" });
  host.appendChild(root);

  // ---- header ----
  const head = H("div", { class: "m14x-head" });
  head.appendChild(H("div", { class: "m14x-kicker" }, "EXPLODED VIEW"));
  head.appendChild(H("h2", { class: "m14x-title" }, "Inside a real IEC contactor"));
  head.appendChild(H("p", { class: "m14x-sub" },
    "Drag the slider (or grab the contactor) to pull the three layers apart. Click a layer for what it does and how it fails."));
  root.appendChild(head);

  // ---- main layout: stage (svg) left, side rail (energize + fact card) right ----
  const grid = H("div", { class: "m14x-grid" });
  root.appendChild(grid);

  const stageWrap = H("div", { class: "m14x-stage-wrap" });
  grid.appendChild(stageWrap);

  const svg = S("svg", { class: "m14x-svg", viewBox: "0 -140 620 780", preserveAspectRatio: "xMidYMid meet" });
  stageWrap.appendChild(svg);

  // vertical explode slider (custom, drawn in HTML so it's easy to grab)
  const sliderWrap = H("div", { class: "m14x-slider-wrap" });
  const sliderTrack = H("div", { class: "m14x-slider-track" });
  const sliderFill = H("div", { class: "m14x-slider-fill" });
  const sliderThumb = H("div", { class: "m14x-slider-thumb", role: "slider", tabindex: "0",
    "aria-label": "Explode assembly", "aria-valuemin": "0", "aria-valuemax": "100" });
  sliderThumb.appendChild(H("div", { class: "m14x-thumb-grip" }));
  sliderTrack.appendChild(sliderFill);
  sliderTrack.appendChild(sliderThumb);
  sliderWrap.appendChild(H("div", { class: "m14x-slider-lbl-top" }, "EXPLODE"));
  sliderWrap.appendChild(sliderTrack);
  sliderWrap.appendChild(H("div", { class: "m14x-slider-lbl-bot" }, "ASSEMBLED"));
  stageWrap.appendChild(sliderWrap);

  const hint = H("div", { class: "m14x-hint" });
  hint.appendChild(H("span", { class: "m14x-hint-dot" }));
  const hintTxt = H("span", {}, "Grab the contactor body and drag up/down");
  hint.appendChild(hintTxt);
  stageWrap.appendChild(hint);

  // ---- right rail ----
  const rail = H("div", { class: "m14x-rail" });
  grid.appendChild(rail);

  // energize toggle
  const tgl = H("button", { class: "m14x-toggle", type: "button" });
  const tglLed = H("span", { class: "m14x-toggle-led" });
  const tglTxt = H("span", { class: "m14x-toggle-txt" }, "ENERGIZE COIL");
  tgl.appendChild(tglLed);
  tgl.appendChild(tglTxt);
  rail.appendChild(tgl);

  const stateLine = H("div", { class: "m14x-state" });
  const stateDot = H("span", { class: "m14x-state-dot" });
  const stateTxt = H("span", {}, "De-energized · contacts open");
  stateLine.appendChild(stateDot);
  stateLine.appendChild(stateTxt);
  rail.appendChild(stateLine);

  // fact card
  const card = H("div", { class: "m14x-card" });
  const cardTag = H("div", { class: "m14x-card-tag" }, "TAP A LAYER");
  const cardTitle = H("div", { class: "m14x-card-title" }, "Explode the contactor to explore");
  const cardBody = H("div", { class: "m14x-card-body" },
    "Drag the slider to separate the carrier, armature, and coil/base. Click any layer once it's visible to see what it does and how it typically fails.");
  const cardFailTag = H("div", { class: "m14x-card-fail-tag" }, "COMMON FAILURE MODES");
  const cardFail = H("div", { class: "m14x-card-fail" }, "—");
  card.appendChild(cardTag);
  card.appendChild(cardTitle);
  card.appendChild(cardBody);
  card.appendChild(cardFailTag);
  card.appendChild(cardFail);
  rail.appendChild(card);

  // legend of the 3 layers (also acts as clickable index)
  const legend = H("div", { class: "m14x-legend" });
  const legendRows = {};
  [["carrier", "1 · Contact carrier"], ["armature", "2 · Armature + springs"], ["coil", "3 · Coil + core + base"]]
    .forEach(([key, label]) => {
      const row = H("button", { class: "m14x-legend-row", type: "button", "data-layer": key });
      row.appendChild(H("span", { class: `m14x-legend-swatch m14x-swatch-${key}` }));
      row.appendChild(H("span", { class: "m14x-legend-txt" }, label));
      legend.appendChild(row);
      legendRows[key] = row;
    });
  rail.appendChild(legend);

  // =========================================================== SVG BUILD
  const defs = S("defs");
  svg.appendChild(defs);
  const glow = S("filter", { id: "m14x-glow", x: "-80%", y: "-80%", width: "260%", height: "260%" });
  glow.appendChild(S("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "4.2", result: "b" }));
  const mg = S("feMerge");
  mg.appendChild(S("feMergeNode", { in: "b" }));
  mg.appendChild(S("feMergeNode", { in: "SourceGraphic" }));
  glow.appendChild(mg);
  defs.appendChild(glow);

  const bodyGrad = S("linearGradient", { id: "m14x-body-grad", x1: "0", y1: "0", x2: "0", y2: "1" });
  bodyGrad.appendChild(S("stop", { offset: "0", "stop-color": "#EEF1F8" }));
  bodyGrad.appendChild(S("stop", { offset: "1", "stop-color": "#C7CEDE" }));
  defs.appendChild(bodyGrad);
  const darkGrad = S("linearGradient", { id: "m14x-dark-grad", x1: "0", y1: "0", x2: "0", y2: "1" });
  darkGrad.appendChild(S("stop", { offset: "0", "stop-color": "#3A4150" }));
  darkGrad.appendChild(S("stop", { offset: "1", "stop-color": "#20242E" }));
  defs.appendChild(darkGrad);
  const coilGrad = S("linearGradient", { id: "m14x-coil-grad", x1: "0", y1: "0", x2: "0", y2: "1" });
  coilGrad.appendChild(S("stop", { offset: "0", "stop-color": "#B45309" }));
  coilGrad.appendChild(S("stop", { offset: "1", "stop-color": "#7C3A0B" }));
  defs.appendChild(coilGrad);

  // outer stage group (static: leader-line anchors etc reference layer groups directly)
  const stage = S("g", { class: "m14x-stage" });
  svg.appendChild(stage);

  // faint DIN rail silhouette behind everything, fixed at the bottom
  stage.appendChild(S("rect", { class: "m14x-rail-bg", x: 70, y: 566, width: 480, height: 16, rx: 3 }));

  // Layer groups — each is translated vertically by JS as `explode` changes.
  // Base (rest / assembled) Y positions chosen so the stack reads top->bottom
  // exactly like the real CWB25: carrier (poles) on top, armature/spring
  // in the middle, coil+core+DIN foot on the bottom.
  const gCarrier = S("g", { class: "m14x-layer m14x-layer-carrier clickable", "data-layer": "carrier" });
  const gArmature = S("g", { class: "m14x-layer m14x-layer-armature clickable", "data-layer": "armature" });
  const gCoil = S("g", { class: "m14x-layer m14x-layer-coil clickable", "data-layer": "coil" });
  // leader-line layer drawn above everything, faded in with explosion
  const gLeaders = S("g", { class: "m14x-leaders" });

  stage.appendChild(gCoil);
  stage.appendChild(gArmature);
  stage.appendChild(gCarrier);
  stage.appendChild(gLeaders);

  buildCoilLayer(gCoil);
  buildArmatureLayer(gArmature);
  buildCarrierLayer(gCarrier);
  buildLeaders(gLeaders);

  // ---- caption under the svg (dynamic) ----
  const cap = H("div", { class: "m14x-cap" });
  stageWrap.appendChild(cap);

  // =========================================================== STATE
  let explode = 0;      // 0..1
  let energized = false;
  let selected = null;   // "carrier" | "armature" | "coil" | null

  // rest (explode=0) Y offsets — all zero, layers sit stacked/touching.
  // full-explode (explode=1) Y offsets — separate them with real headroom.
  const REST = { carrier: 0, armature: 0, coil: 0 };
  const BLOWN = { carrier: -140, armature: 0, coil: 150 };
  // energized pull: at explode=0 the carrier+armature travel together as one
  // physical stroke; as explode->1 the pull becomes a smaller "local nudge"
  // on each separated layer so the mechanism still visibly reacts.
  const PULL_ASSEMBLED = 16;   // px the carrier+armature travel when made, at explode=0
  const PULL_EXPLODED = 9;     // residual local nudge once fully separated

  function layerY(key, ex) {
    return REST[key] + (BLOWN[key] - REST[key]) * ex;
  }

  function paint() {
    const ex = explode;
    const pull = PULL_ASSEMBLED * (1 - ex) + PULL_EXPLODED * ex;
    const energDy = energized ? pull : 0;

    // carrier + armature move down together when energized (mechanically linked)
    const carrierY = layerY("carrier", ex) + energDy;
    const armatureY = layerY("armature", ex) + energDy;
    const coilY = layerY("coil", ex); // fixed — coil/core never move

    gCarrier.setAttribute("transform", `translate(0 ${carrierY})`);
    gArmature.setAttribute("transform", `translate(0 ${armatureY})`);
    gCoil.setAttribute("transform", `translate(0 ${coilY})`);

    stage.classList.toggle("m14x-energized", energized);
    stage.style.setProperty("--m14x-explode", ex.toFixed(3));

    // leader lines / labels fade in with explosion amount
    gLeaders.style.opacity = Math.max(0, (ex - 0.12) / 0.5).toString();
    gLeaders.style.pointerEvents = ex > 0.2 ? "auto" : "none";
    // recompute leader anchor points to track the (possibly energized) layers
    positionLeaders(gLeaders, carrierY, armatureY, coilY);

    // slider visuals
    const pct = Math.round(ex * 100);
    sliderFill.style.height = `${pct}%`;
    sliderThumb.style.bottom = `${pct}%`;
    sliderThumb.setAttribute("aria-valuenow", String(pct));

    // energize toggle visuals
    tgl.classList.toggle("on", energized);
    tglTxt.textContent = energized ? "COIL ENERGIZED" : "ENERGIZE COIL";
    stateDot.classList.toggle("on", energized);
    stateTxt.textContent = energized
      ? "Energized · main contacts CLOSED · aux 13-14 CLOSED"
      : "De-energized · contacts open (springs hold it there)";

    // caption
    if (ex < 0.05) {
      cap.textContent = "Fully assembled — this is what you'd see closing the cover.";
    } else if (ex > 0.92) {
      cap.textContent = "Fully exploded — three field-replaceable layers, stacked top → bottom.";
    } else {
      cap.textContent = "Separating… keep dragging to reveal every layer and its labels.";
    }

    // legend active state
    for (const k in legendRows) legendRows[k].classList.toggle("active", selected === k);
    root.querySelectorAll(".m14x-layer").forEach((g) => {
      g.classList.toggle("selected", g.dataset.layer === selected);
    });
  }

  function selectLayer(key) {
    selected = selected === key ? null : key;
    if (selected) {
      const f = FACTS[selected];
      cardTag.textContent = f.tag;
      cardTitle.textContent = f.title;
      cardBody.textContent = f.body;
      cardFail.textContent = f.fails;
      card.classList.add("m14x-card-filled");
    } else {
      cardTag.textContent = "TAP A LAYER";
      cardTitle.textContent = "Explode the contactor to explore";
      cardBody.textContent = "Drag the slider to separate the carrier, armature, and coil/base. Click any layer once it's visible to see what it does and how it typically fails.";
      cardFail.textContent = "—";
      card.classList.remove("m14x-card-filled");
    }
    paint();
  }

  root.querySelectorAll(".m14x-layer").forEach((g) => {
    g.addEventListener("click", () => selectLayer(g.dataset.layer));
  });
  legend.querySelectorAll(".m14x-legend-row").forEach((row) => {
    row.addEventListener("click", () => selectLayer(row.dataset.layer));
  });

  tgl.addEventListener("click", () => { energized = !energized; paint(); });

  // ---- slider drag (pointer events, works for mouse + touch + pen) ----
  function setExplodeFromClientY(clientY) {
    const rect = sliderTrack.getBoundingClientRect();
    let t = (rect.bottom - clientY) / rect.height; // bottom = 0 (assembled), top = 1 (exploded)
    t = Math.min(1, Math.max(0, t));
    explode = t;
    paint();
  }
  let draggingSlider = false;
  sliderTrack.addEventListener("pointerdown", (e) => {
    draggingSlider = true;
    sliderTrack.setPointerCapture(e.pointerId);
    setExplodeFromClientY(e.clientY);
  });
  sliderTrack.addEventListener("pointermove", (e) => { if (draggingSlider) setExplodeFromClientY(e.clientY); });
  sliderTrack.addEventListener("pointerup", (e) => { draggingSlider = false; try { sliderTrack.releasePointerCapture(e.pointerId); } catch (_) {} });
  sliderTrack.addEventListener("pointercancel", () => { draggingSlider = false; });
  sliderThumb.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowRight") { explode = Math.min(1, explode + 0.08); paint(); e.preventDefault(); }
    if (e.key === "ArrowDown" || e.key === "ArrowLeft") { explode = Math.max(0, explode - 0.08); paint(); e.preventDefault(); }
  });

  // ---- grab-drag directly on the contactor body in the SVG ----
  let draggingBody = false;
  let dragStartY = 0;
  let dragStartExplode = 0;
  svg.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".m14x-layer")) return;
    draggingBody = true;
    dragStartY = e.clientY;
    dragStartExplode = explode;
    svg.setPointerCapture(e.pointerId);
    hint.classList.add("m14x-hint-fade");
  });
  svg.addEventListener("pointermove", (e) => {
    if (!draggingBody) return;
    const svgRect = svg.getBoundingClientRect();
    // scale client pixels to viewBox units (viewBox height 780)
    const scale = 780 / svgRect.height;
    const dyClient = e.clientY - dragStartY;
    const dyView = dyClient * scale;
    // dragging DOWN increases separation (mirrors slider: up = more explode
    // visually, but grabbing the part and pulling it apart reads naturally
    // as pulling outward in either direction) — normalize by total travel range
    const travel = 260; // approx total viewBox px span of full explosion
    explode = Math.min(1, Math.max(0, dragStartExplode + Math.abs(dyView) / travel));
    paint();
  });
  function endBodyDrag(e) {
    if (!draggingBody) return;
    draggingBody = false;
    try { svg.releasePointerCapture(e.pointerId); } catch (_) {}
  }
  svg.addEventListener("pointerup", endBodyDrag);
  svg.addEventListener("pointercancel", endBodyDrag);

  paint();
}

// =============================================================================
// LAYER 1 — moving contact carrier + main contacts + aux finger.
// Drawn in local coords; sits "on top" at rest (small negative-y footprint so
// it visually stacks above the armature/coil block beneath it).
// =============================================================================
function buildCarrierLayer(g) {
  // insulated carrier body (the part the mechanism drives down)
  g.appendChild(S("rect", { class: "m14x-carrier-body", x: 210, y: 60, width: 200, height: 46, rx: 8 }));
  g.appendChild(S("rect", { class: "m14x-carrier-shaft", x: 290, y: 100, width: 40, height: 26, rx: 4 }));

  // three moving bridge contacts (one per pole), each a small silver bridge
  // riding on the carrier with its own light contact spring (drawn as a tiny
  // chevron) so the realism reads: bridge floats slightly, spring-loaded.
  const poleXs = [250, 310, 370];
  poleXs.forEach((x) => {
    g.appendChild(S("rect", { class: "m14x-bridge", x: x - 16, y: 100, width: 32, height: 10, rx: 3 }));
    g.appendChild(S("circle", { class: "m14x-bridge-pad", cx: x - 10, cy: 105, r: 4 }));
    g.appendChild(S("circle", { class: "m14x-bridge-pad", cx: x + 10, cy: 105, r: 4 }));
  });

  // fixed terminals: TOP row (line side 1L1/3L2/5L3) feeding down onto the
  // bridges, BOTTOM row (load side 2T1/4T2/6T3) picked up from the bridges.
  const topY = 30, botY = 176;
  poleXs.forEach((x, i) => {
    const inLbl = ["1L1", "3L2", "5L3"][i];
    const outLbl = ["2T1", "4T2", "6T3"][i];
    // top fixed contact + screw terminal
    g.appendChild(S("line", { class: "m14x-fixed-lead", x1: x, y1: topY, x2: x, y2: 96 }));
    g.appendChild(S("rect", { class: "m14x-fixed-pad top", x: x - 14, y: topY - 14, width: 28, height: 16, rx: 3 }));
    g.appendChild(S("circle", { class: "m14x-screw", cx: x, cy: topY - 6, r: 4 }));
    g.appendChild(S("text", { class: "m14x-term-lbl", x, y: topY - 22, "text-anchor": "middle" }, inLbl));

    // bottom fixed contact + screw terminal
    g.appendChild(S("line", { class: "m14x-fixed-lead", x1: x, y1: 110, x2: x, y2: botY }));
    g.appendChild(S("rect", { class: "m14x-fixed-pad bot", x: x - 14, y: botY, width: 28, height: 16, rx: 3 }));
    g.appendChild(S("circle", { class: "m14x-screw", cx: x, cy: botY + 8, r: 4 }));
    g.appendChild(S("text", { class: "m14x-term-lbl", x, y: botY + 32, "text-anchor": "middle" }, outLbl));

    // spark/arc glyph shown only when the pole is actually conducting (CSS-gated)
    g.appendChild(S("circle", { class: "m14x-arc-glow", cx: x, cy: 105, r: 15, filter: "url(#m14x-glow)" }));
  });

  // aux finger (13 NO / 14 NO) riding lower-right of the carrier
  g.appendChild(S("rect", { class: "m14x-aux-bridge", x: 424, y: 100, width: 26, height: 10, rx: 3 }));
  g.appendChild(S("line", { class: "m14x-fixed-lead aux", x1: 437, y1: 30, x2: 437, y2: 96 }));
  g.appendChild(S("rect", { class: "m14x-fixed-pad top aux", x: 423, y: 16, width: 28, height: 16, rx: 3 }));
  g.appendChild(S("circle", { class: "m14x-screw", cx: 437, cy: 24, r: 4 }));
  g.appendChild(S("text", { class: "m14x-term-lbl", x: 437, y: 4, "text-anchor": "middle" }, "13 NO"));
  g.appendChild(S("line", { class: "m14x-fixed-lead aux", x1: 437, y1: 110, x2: 437, y2: 176 }));
  g.appendChild(S("rect", { class: "m14x-fixed-pad bot aux", x: 423, y: 176, width: 28, height: 16, rx: 3 }));
  g.appendChild(S("circle", { class: "m14x-screw", cx: 437, cy: 184, r: 4 }));
  g.appendChild(S("text", { class: "m14x-term-lbl", x: 437, y: 208, "text-anchor": "middle" }, "14 NO"));
  g.appendChild(S("circle", { class: "m14x-arc-glow aux", cx: 437, cy: 105, r: 13, filter: "url(#m14x-glow)" }));

  const tag = S("text", { class: "m14x-layer-tag", x: 156, y: 100, "text-anchor": "end" });
  tag.appendChild(S("tspan", { x: 156, dy: 0 }, "CONTACT"));
  tag.appendChild(S("tspan", { x: 156, dy: 20 }, "CARRIER"));
  g.appendChild(tag);
}

// =============================================================================
// LAYER 2 — armature + return springs. Sits directly under the carrier.
// =============================================================================
function buildArmatureLayer(g) {
  // two return springs (drawn as zig-zags) flanking the armature
  [246, 384].forEach((sx) => {
    g.appendChild(S("path", {
      class: "m14x-spring",
      d: `M ${sx} 210 l -9 8 l 18 8 l -18 8 l 18 8 l -18 8 l 9 8`,
    }));
  });
  // labels sit BELOW the spring's midpoint, offset outward (away from center)
  // so they never collide with the carrier layer's 2T1/6T3 terminal labels
  // that occupy the same x/y neighborhood at rest (explode=0).
  g.appendChild(S("text", { class: "m14x-part-label", x: 246, y: 244, "text-anchor": "end" }, "RETURN SPRING"));
  g.appendChild(S("text", { class: "m14x-part-label", x: 384, y: 244, "text-anchor": "start" }, "RETURN SPRING"));

  // armature bar (moving iron), a squat E-shaped-ish bar for realism
  g.appendChild(S("rect", { class: "m14x-armature-bar", x: 226, y: 260, width: 168, height: 34, rx: 6 }));
  // three "teeth" hinting at the E-core mating face
  [246, 310, 374].forEach((x) => g.appendChild(S("rect", { class: "m14x-armature-tooth", x: x - 10, y: 288, width: 20, height: 14, rx: 2 })));

  const tag = S("text", { class: "m14x-layer-tag", x: 156, y: 272, "text-anchor": "end" });
  tag.appendChild(S("tspan", { x: 156, dy: 0 }, "ARMATURE +"));
  tag.appendChild(S("tspan", { x: 156, dy: 20 }, "SPRINGS"));
  g.appendChild(tag);
}

// =============================================================================
// LAYER 3 — coil, magnetic core/yoke, DIN base. This layer never moves when
// energized (it's the fixed half of the magnetic circuit) — only carrier +
// armature travel toward it.
// =============================================================================
function buildCoilLayer(g) {
  // yoke (U-shaped fixed iron, drawn as a squared bracket under the coil)
  g.appendChild(S("path", {
    class: "m14x-yoke",
    d: "M 214 306 L 214 372 L 236 372 L 236 330 L 384 330 L 384 372 L 406 372 L 406 306 Z",
  }));

  // coil bobbin body with visible winding lines (matches relay_anatomy style)
  g.appendChild(S("rect", { class: "m14x-coil-body", x: 244, y: 300, width: 132, height: 66, rx: 6 }));
  for (let i = 0; i < 6; i++) {
    g.appendChild(S("line", { class: "m14x-coil-turn", x1: 244, y1: 310 + i * 9.5, x2: 376, y2: 310 + i * 9.5 }));
  }
  // fixed core face sticking up into the airgap toward the armature
  g.appendChild(S("rect", { class: "m14x-core", x: 296, y: 268, width: 28, height: 40, rx: 3 }));
  g.appendChild(S("text", { class: "m14x-part-label small", x: 310, y: 260, "text-anchor": "middle" }, "core"));

  // magnetic field arcs (visible only when energized, CSS-gated)
  const field = S("g", { class: "m14x-field" });
  [24, 38, 52].forEach((r) => {
    field.appendChild(S("path", { class: "m14x-field-arc", d: `M ${310 - r} 300 A ${r} ${r} 0 0 1 ${310 + r} 300` }));
  });
  g.appendChild(field);

  // coil leads A1 / A2 down to a small terminal block
  g.appendChild(S("line", { class: "m14x-lead", x1: 264, y1: 366, x2: 264, y2: 402 }));
  g.appendChild(S("line", { class: "m14x-lead", x1: 356, y1: 366, x2: 356, y2: 402 }));
  g.appendChild(S("rect", { class: "m14x-fixed-pad top", x: 250, y: 402, width: 28, height: 16, rx: 3 }));
  g.appendChild(S("rect", { class: "m14x-fixed-pad top", x: 342, y: 402, width: 28, height: 16, rx: 3 }));
  g.appendChild(S("circle", { class: "m14x-screw", cx: 264, cy: 410, r: 4 }));
  g.appendChild(S("circle", { class: "m14x-screw", cx: 356, cy: 410, r: 4 }));
  g.appendChild(S("text", { class: "m14x-term-lbl plus", x: 264, y: 434, "text-anchor": "middle" }, "A1 +"));
  g.appendChild(S("text", { class: "m14x-term-lbl minus", x: 356, y: 434, "text-anchor": "middle" }, "A2 –"));

  // main body shell around the coil block (the plastic housing)
  g.appendChild(S("rect", { class: "m14x-shell", x: 180, y: 296, width: 260, height: 150, rx: 14 }));
  // re-stack coil visuals above the shell by re-appending (SVG paints in doc order)
  g.appendChild(g.querySelector(".m14x-yoke"));
  g.appendChild(g.querySelector(".m14x-coil-body"));
  Array.from(g.querySelectorAll(".m14x-coil-turn")).forEach((el) => g.appendChild(el));
  g.appendChild(g.querySelector(".m14x-core"));
  g.appendChild(field);
  Array.from(g.querySelectorAll(".m14x-lead")).forEach((el) => g.appendChild(el));
  Array.from(g.querySelectorAll(".m14x-fixed-pad")).forEach((el) => g.appendChild(el));
  Array.from(g.querySelectorAll(".m14x-screw")).forEach((el) => g.appendChild(el));
  Array.from(g.querySelectorAll(".m14x-term-lbl")).forEach((el) => g.appendChild(el));
  g.appendChild(g.querySelector(".m14x-part-label.small"));

  // DIN mounting foot at the very bottom
  const foot = S("g", { class: "m14x-dinfoot" });
  foot.appendChild(S("rect", { class: "m14x-foot-body", x: 230, y: 446, width: 160, height: 22, rx: 5 }));
  foot.appendChild(S("rect", { class: "m14x-foot-clip", x: 248, y: 468, width: 40, height: 14, rx: 3 }));
  foot.appendChild(S("rect", { class: "m14x-foot-clip", x: 332, y: 468, width: 40, height: 14, rx: 3 }));
  g.appendChild(foot);

  const tag = S("text", { class: "m14x-layer-tag", x: 156, y: 384, "text-anchor": "end" });
  tag.appendChild(S("tspan", { x: 156, dy: 0 }, "COIL + CORE"));
  tag.appendChild(S("tspan", { x: 156, dy: 20 }, "+ DIN BASE"));
  g.appendChild(tag);
}

// =============================================================================
// Leader lines connecting the static "LAYER" tag text (left margin, doesn't
// move) to the currently-positioned part — these are rebuilt in `positionLeaders`
// each paint so they always point at the live (possibly energized) layer Y.
// buildLeaders just creates the empty <line> elements once.
// =============================================================================
function buildLeaders(g) {
  g.appendChild(S("line", { class: "m14x-leader", "data-target": "carrier", x1: 162, y1: 100, x2: 208, y2: 83 }));
  g.appendChild(S("line", { class: "m14x-leader", "data-target": "armature", x1: 162, y1: 272, x2: 224, y2: 277 }));
  g.appendChild(S("line", { class: "m14x-leader", "data-target": "coil", x1: 162, y1: 384, x2: 244, y2: 333 }));
}
function positionLeaders(g, carrierY, armatureY, coilY) {
  const map = { carrier: carrierY, armature: armatureY, coil: coilY };
  const ends = { carrier: 83, armature: 277, coil: 333 };
  g.querySelectorAll(".m14x-leader").forEach((line) => {
    const key = line.getAttribute("data-target");
    line.setAttribute("y2", ends[key] + map[key]);
  });
}

// =============================================================================
function css() {
  return `
.m14x-root{
  box-sizing:border-box; width:100%; height:100%;
  padding:22px 26px; display:flex; flex-direction:column; gap:14px;
  font-family:var(--font-display,"Inter",system-ui,sans-serif);
  color:var(--text,#303749); background:var(--bg,#F6F8FC);
}
.m14x-root *{box-sizing:border-box;}

.m14x-head{flex:0 0 auto;}
.m14x-kicker{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.18em; font-weight:700;
  color:var(--blue-deep,#2563EB); background:var(--blue-soft,#EAF1FE);
  display:inline-block; padding:4px 10px; border-radius:999px; margin-bottom:8px;
}
.m14x-title{margin:0 0 4px; font-size:23px; font-weight:800; letter-spacing:-.01em; color:var(--ink,#0E1326);}
.m14x-sub{margin:0; font-size:13.5px; line-height:1.45; color:var(--muted,#6B7488); max-width:760px;}

.m14x-grid{flex:1 1 auto; display:grid; grid-template-columns:1fr 300px; gap:20px; min-height:0;}

/* ---------- stage ---------- */
.m14x-stage-wrap{
  position:relative; background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
  border-radius:18px; padding:10px 64px 10px 10px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
  display:flex; flex-direction:column; min-height:0;
}
.m14x-svg{flex:1 1 auto; width:100%; height:100%; min-height:0; display:block; touch-action:none;}

.m14x-cap{flex:0 0 auto; text-align:center; font-size:12px; color:var(--muted,#6B7488); padding:10px 4px 2px; margin-top:4px;}

.m14x-hint{
  position:absolute; left:22px; top:14px; max-width:calc(100% - 120px);
  display:flex; align-items:center; gap:7px;
  font-size:11.5px; color:var(--muted,#6B7488); background:var(--surface-2,#FBFCFE);
  border:1px solid var(--border,#E6EAF3); border-radius:999px; padding:5px 11px 5px 8px;
  transition:opacity .4s ease;
}
.m14x-hint-fade{opacity:0;}
.m14x-hint-dot{
  width:7px; height:7px; border-radius:50%; background:var(--blue,#3B82F6);
  box-shadow:0 0 0 3px var(--blue-soft,#EAF1FE); animation:m14x-pulse 1.6s ease-in-out infinite;
}
@keyframes m14x-pulse{0%,100%{opacity:.5;}50%{opacity:1;}}

/* ---------- vertical explode slider ---------- */
.m14x-slider-wrap{
  position:absolute; right:16px; top:14px; bottom:38px; width:40px;
  display:flex; flex-direction:column; align-items:center;
}
.m14x-slider-lbl-top, .m14x-slider-lbl-bot{
  font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; letter-spacing:.1em;
  color:var(--muted,#6B7488); flex:0 0 auto; padding:2px 0; text-align:center;
}
.m14x-slider-track{
  position:relative; flex:1 1 auto; width:8px; margin:6px 0;
  background:var(--border-strong,#D6DDEC); border-radius:999px; cursor:pointer;
}
.m14x-slider-fill{
  position:absolute; left:0; right:0; bottom:0; height:0%;
  background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); border-radius:999px;
  transition:height .05s linear;
}
.m14x-slider-thumb{
  position:absolute; left:50%; bottom:0%; width:26px; height:26px; margin-left:-13px; margin-bottom:-13px;
  border-radius:50%; background:#fff; border:3px solid var(--blue,#3B82F6);
  box-shadow:var(--shadow-blue,0 10px 34px -10px rgba(59,130,246,.4));
  cursor:grab; display:flex; align-items:center; justify-content:center;
  transition:bottom .05s linear, transform .15s ease;
}
.m14x-slider-thumb:active{cursor:grabbing; transform:scale(1.08);}
.m14x-thumb-grip{width:10px; height:2px; background:var(--blue,#3B82F6); border-radius:2px; box-shadow:0 4px 0 var(--blue,#3B82F6), 0 -4px 0 var(--blue,#3B82F6);}

/* ---------- rail ---------- */
.m14x-rail{display:flex; flex-direction:column; gap:12px; min-height:0;}

.m14x-toggle{
  appearance:none; cursor:pointer; border:1.5px solid var(--border-strong,#D6DDEC);
  background:var(--surface,#fff); border-radius:14px; padding:13px 16px;
  display:flex; align-items:center; gap:10px;
  font-family:var(--font-display,"Inter",sans-serif); font-weight:700; font-size:13.5px;
  color:var(--ink,#0E1326); box-shadow:var(--shadow-sm,0 1px 3px rgba(16,19,38,.05));
  transition:border-color .18s ease, background .18s ease, box-shadow .2s ease, transform .12s ease;
}
.m14x-toggle:hover{border-color:var(--blue,#3B82F6); transform:translateY(-1px);}
.m14x-toggle:active{transform:translateY(0);}
.m14x-toggle-led{
  width:12px; height:12px; border-radius:50%; background:var(--contact-open,#94A3B8);
  box-shadow:inset 0 0 0 2px rgba(0,0,0,.06); transition:background .2s ease, box-shadow .2s ease;
  flex:0 0 auto;
}
.m14x-toggle.on{border-color:transparent; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); box-shadow:var(--shadow-blue,0 10px 34px -10px rgba(59,130,246,.4));}
.m14x-toggle.on .m14x-toggle-txt{color:#fff;}
.m14x-toggle.on .m14x-toggle-led{background:var(--live,#EF4444); box-shadow:0 0 0 4px rgba(239,68,68,.28), 0 0 10px 2px rgba(239,68,68,.5);}

.m14x-state{
  display:flex; align-items:center; gap:8px; font-size:12px; color:var(--muted,#6B7488);
  padding:0 4px;
}
.m14x-state-dot{width:8px; height:8px; border-radius:50%; background:var(--contact-open,#94A3B8); flex:0 0 auto; transition:background .2s ease, box-shadow .2s ease;}
.m14x-state-dot.on{background:var(--live,#EF4444); box-shadow:0 0 0 3px rgba(239,68,68,.22);}

.m14x-card{
  background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3); border-radius:16px;
  padding:16px 18px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
  position:relative; overflow:hidden; flex:1 1 auto; min-height:0; overflow-y:auto;
  transition:box-shadow .25s ease;
}
.m14x-card::before{content:""; position:absolute; left:0; top:0; bottom:0; width:5px; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));}
.m14x-card-tag{
  font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; letter-spacing:.12em;
  color:var(--blue-deep,#2563EB); margin-bottom:6px;
}
.m14x-card-title{font-size:15.5px; font-weight:800; color:var(--ink,#0E1326); margin-bottom:8px; line-height:1.3;}
.m14x-card-body{font-size:13px; line-height:1.5; color:var(--text,#303749); margin-bottom:12px;}
.m14x-card-fail-tag{
  font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; letter-spacing:.1em;
  color:var(--live-label,#DC2626); margin-bottom:5px; border-top:1px dashed var(--border,#E6EAF3); padding-top:10px;
}
.m14x-card-fail{font-size:12.5px; line-height:1.5; color:var(--muted,#6B7488);}
.m14x-card-filled .m14x-card-fail{color:#7A3A34;}

.m14x-legend{display:flex; flex-direction:column; gap:6px; flex:0 0 auto;}
.m14x-legend-row{
  appearance:none; cursor:pointer; border:1px solid var(--border,#E6EAF3); background:var(--surface,#fff);
  border-radius:10px; padding:8px 10px; display:flex; align-items:center; gap:9px;
  font-size:12px; font-weight:600; color:var(--text,#303749);
  transition:border-color .16s ease, background .16s ease, transform .12s ease;
}
.m14x-legend-row:hover{border-color:var(--blue,#3B82F6); transform:translateX(2px);}
.m14x-legend-row.active{border-color:var(--blue,#3B82F6); background:var(--blue-soft,#EAF1FE);}
.m14x-legend-swatch{width:12px; height:12px; border-radius:4px; flex:0 0 auto;}
.m14x-swatch-carrier{background:#93A4C3;}
.m14x-swatch-armature{background:#6B7488;}
.m14x-swatch-coil{background:#B45309;}

/* ================= SVG part styling ================= */
.m14x-rail-bg{fill:#DDE3F0;}

.m14x-layer{cursor:pointer; transition:transform .5s cubic-bezier(.22,1.4,.36,1);}
.m14x-layer.selected .m14x-carrier-body,
.m14x-layer.selected .m14x-armature-bar,
.m14x-layer.selected .m14x-shell{
  filter:drop-shadow(0 0 0 2px var(--blue,#3B82F6)) drop-shadow(0 0 10px rgba(59,130,246,.45));
}

/* -- carrier layer -- */
.m14x-carrier-body{fill:url(#m14x-body-grad); stroke:#AEB8CC; stroke-width:1.5;}
.m14x-carrier-shaft{fill:#B7BFD2; stroke:#9AA4BC; stroke-width:1.2;}
.m14x-bridge{fill:#CBD3E1; stroke:#8891A5; stroke-width:1.4; transition:fill .2s ease;}
.m14x-bridge-pad{fill:#E7ECF5; stroke:#9AA4BC; stroke-width:1;}
.m14x-fixed-lead{stroke:var(--wire-rest,#94A3B8); stroke-width:3; stroke-linecap:round;}
.m14x-fixed-lead.aux{stroke-width:2.4;}
.m14x-fixed-pad{fill:#F3F5FA; stroke:#B9C1D4; stroke-width:1.4;}
.m14x-screw{fill:#8B93A6; stroke:#5B6478; stroke-width:1;}
/* teardown svg renders at ~0.64x of its 620-unit viewBox — sizes pre-compensated ≥ ~11px effective */
.m14x-term-lbl{font-family:var(--font-mono,monospace); font-size:18px; font-weight:700; fill:var(--muted,#6B7488);}
.m14x-term-lbl.plus{fill:var(--blue-deep,#2563EB);}
.m14x-term-lbl.minus{fill:var(--violet-deep,#6D28D9);}
.m14x-aux-bridge{fill:#CBD3E1; stroke:#8891A5; stroke-width:1.4;}
.m14x-arc-glow{fill:var(--live,#EF4444); opacity:0;}

/* main contacts turn green + arc-glow flashes briefly when energized */
.m14x-energized .m14x-bridge{fill:#BEE7CE; stroke:#3D9764;}
.m14x-energized .m14x-aux-bridge{fill:#BEE7CE; stroke:#3D9764;}
.m14x-energized .m14x-arc-glow{animation:m14x-arc .5s ease-out 1;}
@keyframes m14x-arc{0%{opacity:.85;}100%{opacity:0;}}

/* -- armature layer -- */
.m14x-armature-bar{fill:url(#m14x-dark-grad); stroke:#171B22; stroke-width:1.4;}
.m14x-armature-tooth{fill:#454C5A; stroke:#171B22; stroke-width:1.2;}
.m14x-spring{fill:none; stroke:#8B93A6; stroke-width:2.6; stroke-linecap:round; stroke-linejoin:round; transition:d .3s ease;}
.m14x-energized .m14x-spring{stroke:#5B6478;}

/* -- coil layer -- */
.m14x-shell{fill:#F7F9FD; stroke:var(--border-strong,#D6DDEC); stroke-width:1.5; opacity:.55;}
.m14x-yoke{fill:#535B69; stroke:#2B303B; stroke-width:1.2;}
.m14x-coil-body{fill:url(#m14x-coil-grad); stroke:#5C2C08; stroke-width:1.4;}
.m14x-coil-turn{stroke:#8C4413; stroke-width:1.4; opacity:.8;}
.m14x-core{fill:#4B5563; stroke:#20242E; stroke-width:1.4;}
.m14x-part-label{font-family:var(--font-mono,monospace); font-size:18px; font-weight:700; letter-spacing:.05em; fill:var(--muted,#6B7488);}
.m14x-part-label.small{font-size:18px; fill:var(--muted,#6B7488); opacity:.95;}
.m14x-field-arc{fill:none; stroke:var(--coil-energized,#7C5CFF); stroke-width:2; opacity:0; transition:opacity .25s ease;}
.m14x-energized .m14x-field-arc{opacity:.55; animation:m14x-field 1.1s ease-in-out infinite;}
@keyframes m14x-field{0%,100%{opacity:.35;}50%{opacity:.75;}}
.m14x-energized .m14x-coil-body{fill:#D97706; filter:drop-shadow(0 0 8px rgba(217,119,6,.55));}
.m14x-energized .m14x-core{fill:#6D28D9; filter:drop-shadow(0 0 8px rgba(124,92,255,.55));}
.m14x-lead{stroke:var(--wire-rest,#94A3B8); stroke-width:3; stroke-linecap:round; transition:stroke .2s ease;}
.m14x-energized .m14x-lead{stroke:var(--live,#EF4444);}
.m14x-dinfoot .m14x-foot-body{fill:#3A414E; stroke:#20242E; stroke-width:1.2;}
.m14x-dinfoot .m14x-foot-clip{fill:#20242E;}

/* -- static layer tags (left margin, don't move) -- */
.m14x-layer-tag{font-family:var(--font-mono,monospace); font-size:18px; font-weight:800; letter-spacing:.08em; fill:var(--ink,#0E1326);}

/* -- leader lines (fade in with explosion) -- */
.m14x-leaders{transition:opacity .25s ease;}
.m14x-leader{stroke:var(--faint,#99A1B3); stroke-width:1.4; stroke-dasharray:3 3;}
`;
}
