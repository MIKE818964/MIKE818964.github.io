// =============================================================================
// m03_button_cutaway.js  —  "Inside a Pushbutton: cutaway + break-before-make"
//
//   Side cross-section of a real 22mm panel pushbutton (AutomationDirect
//   GCX1102 family — 22mm metal flush green head). Shows:
//     - operator HEAD + legend plate, sitting proud of the panel face
//     - the PANEL itself, drawn as a section cut (hatched edge)
//     - RETURN SPRING around the stem
//     - PLUNGER / STEM passing through the panel bore
//     - a snap-on CONTACT BLOCK below the panel with TWO contacts stacked:
//         NC (top)  — closed at rest, opens first
//         NO (bottom) — open at rest, closes second
//   PRESS-AND-HOLD (pointerdown/up, on the button head OR the big PRESS pad)
//   drives the plunger down with eased motion. Timing is staged so the
//   learner can SEE break-before-make:
//     0%                       -> NC starts to lift
//     ~38% travel  (NC_OPEN)   -> NC fully open (break)
//     ~38-62% travel           -> DEAD ZONE — neither contact touching
//     ~62% travel  (NO_CLOSE)  -> NO fully closed (make)
//     100% travel              -> full stroke, held
//   Release reverses it (spring return), same staged thresholds.
//
//   Beside the cutaway: a live mini circuit — 24VDC source feeding two
//   branches, each through one contact to its own pilot lamp. Each lamp
//   lights only while its contact is actually closed, matching the
//   break-before-make gap (both lamps OFF during the dead zone).
//
//   Clickable parts (head, spring, NC block, NO block, whole contact block)
//   open a fact card: head color/legend convention, spring fatigue failure,
//   and the classic "block snapped off the body" failure (button still
//   travels, feels normal, but nothing happens because the block never
//   moved with it).
//
//   Self-contained ES module. Pure vanilla JS + inline SVG + CSS. Every
//   class is prefixed `m03-` so nothing collides with sibling lessons.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
function S(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}
function H(tag, attrs = {}, txt) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  if (txt != null) e.textContent = txt;
  return e;
}

// ---- travel thresholds (0..1 of full stroke) ----------------------------
const NC_START = 0.06;   // NC starts lifting almost immediately
const NC_OPEN  = 0.38;   // NC fully open (break complete)
const NO_START = 0.62;   // NO starts making
const NO_CLOSE = 0.86;   // NO fully closed (make complete)

// ---- fact card content ----------------------------------------------------
const FACTS = {
  head: {
    title: "Operator head & legend",
    tag: "GCX1102 · 22mm metal flush",
    body:
      "Head color is a convention, not decoration: GREEN = Start/Run, RED = Stop/E-stop, " +
      "black/gray = general purpose. A flush green head like this is the classic momentary " +
      "START button — press-to-run, release-to-let-go. The legend plate under the bezel " +
      "can be swapped without touching the wiring.",
  },
  spring: {
    title: "Return spring",
    tag: "mechanical · wears over time",
    body:
      "Pushes the plunger back up the instant you let go — this is what makes the button " +
      "“momentary.” After tens of thousands of cycles the spring can fatigue and weaken: " +
      "the button feels mushy, returns slowly, or in extreme cases stays part-way down. " +
      "A sluggish return is an early warning sign worth logging, not ignoring.",
  },
  nc: {
    title: "N.C. contact — top",
    tag: "closed at rest · opens FIRST",
    body:
      "Normally-Closed: current flows through this contact when the button is NOT pressed. " +
      "As the plunger travels down, the moving bridge lifts off this contact first — this is " +
      "the “break” half of break-before-make. Typically wired into a STOP or interlock rung " +
      "so releasing it removes a permissive.",
  },
  no: {
    title: "N.O. contact — bottom",
    tag: "open at rest · closes SECOND",
    body:
      "Normally-Open: no current flows until the plunger pushes the moving bridge down onto " +
      "this contact — the “make” half of break-before-make. This is the classic START contact: " +
      "closed only while you're pressing (or latched by a seal-in rung).",
  },
  block: {
    title: "Snap-on contact block",
    tag: "failure mode · looks fine, does nothing",
    body:
      "Contact blocks snap onto the back of the operator body and stack (NC block, NO block, " +
      "more blocks) without any wiring to the head itself — the plunger just pushes a plastic " +
      "actuator down through each block. Classic field failure: the block's snap-clip cracks or " +
      "was never fully seated. The button still travels and feels completely normal, but the " +
      "block doesn't move with it — so NOTHING switches. Symptom: “I pressed it, nothing " +
      "happened,” with a perfectly good-feeling button. Always verify at the terminals, not by feel.",
  },
};

export function render(host) {
  host.innerHTML = "";

  // ---------------------------------------------------------------- styles
  const style = H("style");
  style.textContent = css();
  host.appendChild(style);

  const root = H("div", { class: "m03-root" });
  host.appendChild(root);

  // ---- header ----
  const head = H("div", { class: "m03-head" });
  head.appendChild(H("div", { class: "m03-kicker" }, "PUSHBUTTON CUTAWAY"));
  head.appendChild(H("h2", { class: "m03-title" }, "Inside a 22mm pushbutton — break-before-make"));
  head.appendChild(H("p", { class: "m03-sub" },
    "Press and hold. Watch the plunger travel: the N.C. contact opens FIRST, then — after a real gap — the N.O. contact closes. Click any part for detail."));
  root.appendChild(head);

  // ---- main grid: cutaway (left) + live circuit (right) ----
  const grid = H("div", { class: "m03-grid" });
  root.appendChild(grid);

  const leftCol = H("div", { class: "m03-left" });
  const rightCol = H("div", { class: "m03-right" });
  grid.appendChild(leftCol);
  grid.appendChild(rightCol);

  // ===== cutaway SVG =====
  const stageCard = H("div", { class: "m03-stage-card" });
  leftCol.appendChild(stageCard);
  const svg = S("svg", { class: "m03-svg", viewBox: "0 0 480 520", preserveAspectRatio: "xMidYMid meet" });
  stageCard.appendChild(svg);

  // ---- PRESS control ----
  const pressWrap = H("div", { class: "m03-press-wrap" });
  const pressBtn = H("button", { class: "m03-press", type: "button" });
  pressBtn.appendChild(H("span", { class: "m03-press-dot" }));
  pressBtn.appendChild(H("span", { class: "m03-press-txt" }, "PRESS & HOLD"));
  pressWrap.appendChild(pressBtn);
  const timing = H("div", { class: "m03-timing" });
  const tNC = H("span", { class: "m03-t-seg m03-t-nc" }, "N.C. OPEN");
  const tGap = H("span", { class: "m03-t-seg m03-t-gap" }, "GAP — NEITHER MADE");
  const tNO = H("span", { class: "m03-t-seg m03-t-no" }, "N.O. CLOSE");
  timing.appendChild(H("span", { class: "m03-t-label" }, "BREAK-BEFORE-MAKE:"));
  timing.appendChild(tNC);
  timing.appendChild(H("span", { class: "m03-t-arrow" }, "→"));
  timing.appendChild(tGap);
  timing.appendChild(H("span", { class: "m03-t-arrow" }, "→"));
  timing.appendChild(tNO);
  pressWrap.appendChild(timing);
  leftCol.appendChild(pressWrap);

  // ===== live mini circuit =====
  const circCard = H("div", { class: "m03-circ-card" });
  rightCol.appendChild(circCard);
  circCard.appendChild(H("div", { class: "m03-circ-title" }, "Live mini circuit — 24VDC"));
  const circSvg = S("svg", { class: "m03-circ-svg", viewBox: "0 0 300 400", preserveAspectRatio: "xMidYMid meet" });
  circCard.appendChild(circSvg);

  // ---- fact panel ----
  const factCard = H("div", { class: "m03-fact" });
  const factTag = H("div", { class: "m03-fact-tag" });
  const factTitle = H("div", { class: "m03-fact-title" });
  const factBody = H("div", { class: "m03-fact-body" });
  factCard.appendChild(factTag);
  factCard.appendChild(factTitle);
  factCard.appendChild(factBody);
  rightCol.appendChild(factCard);

  let currentFactKey = null;
  function showFact(key) {
    const f = FACTS[key];
    if (!f) return;
    if (key === currentFactKey) {
      // Same part clicked again while its card is already open — this is a
      // legitimate no-op for the CONTENT (nothing new to show), but a click
      // should never look inert: re-affirm with a brief highlight pulse so
      // it's visibly "yes, that's this part" rather than doing nothing.
      factCard.classList.remove("m03-pulse");
      void factCard.offsetWidth; // restart the CSS animation
      factCard.classList.add("m03-pulse");
      return;
    }
    currentFactKey = key;
    factCard.classList.add("show");
    factTag.textContent = f.tag;
    factTitle.textContent = f.title;
    factBody.textContent = f.body;
  }
  // default content so the panel isn't empty on load
  showFact("head");
  factCard.classList.remove("show");
  requestAnimationFrame(() => factCard.classList.add("show"));

  // ---------------------------------------------------------------- state
  let travel = 0;          // 0..1 current plunger travel
  let target = 0;          // 0 or 1, what travel is animating toward
  let raf = null;
  const DUR_MS = 260;      // full-stroke duration (press or release)
  let animStart = null;
  let animFrom = 0;

  function ncState(t) {
    if (t <= NC_START) return 1;                 // fully closed
    if (t >= NC_OPEN) return 0;                   // fully open
    return 1 - (t - NC_START) / (NC_OPEN - NC_START); // 1..0
  }
  function noState(t) {
    if (t <= NO_START) return 0;                  // fully open
    if (t >= NO_CLOSE) return 1;                  // fully closed
    return (t - NO_START) / (NO_CLOSE - NO_START); // 0..1
  }

  function step(ts) {
    if (animStart == null) animStart = ts;
    const el = ts - animStart;
    const dur = DUR_MS * Math.abs(target - animFrom || 1);
    const p = Math.min(1, el / Math.max(1, dur));
    // ease: quick start, soft settle (spring-ish)
    const eased = target > animFrom
      ? 1 - Math.pow(1 - p, 2.2)
      : 1 - Math.pow(1 - p, 1.6);
    travel = animFrom + (target - animFrom) * eased;
    paint();
    if (p < 1) {
      raf = requestAnimationFrame(step);
    } else {
      travel = target;
      paint();
      raf = null;
    }
  }
  function animateTo(t) {
    if (raf) cancelAnimationFrame(raf);
    animFrom = travel;
    target = t;
    animStart = null;
    raf = requestAnimationFrame(step);
  }

  function press() {
    root.classList.add("m03-pressed");
    animateTo(1);
  }
  function release() {
    root.classList.remove("m03-pressed");
    animateTo(0);
  }

  // Track whether the current interaction was already handled by a real
  // pointerdown, so the "click" fallback below never double-fires a second
  // press/release for genuine mouse/touch users (a real click is preceded
  // by pointerdown+pointerup, both already wired below).
  let pointerHandled = false;
  pressBtn.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    pointerHandled = true;
    press();
    pressBtn.setPointerCapture(ev.pointerId);
  });
  pressBtn.addEventListener("pointerup", release);
  pressBtn.addEventListener("pointercancel", release);
  pressBtn.addEventListener("pointerleave", (ev) => { if (ev.buttons === 0) release(); });
  // Plain "click" — fires for synthetic dispatch (assistive tech, automated
  // tests) that skip pointer events entirely. Treat it as a brief tap:
  // press immediately, release fast so the DOM settles well before any
  // caller's next assertion. Real pointer-driven clicks are ignored here
  // (already handled above) so a physical press-and-hold isn't cut short.
  pressBtn.addEventListener("click", () => {
    if (pointerHandled) { pointerHandled = false; return; }
    press();
    window.setTimeout(release, 80);
  });
  // keyboard: Enter/Space press-and-hold semantics (press on keydown, release
  // on keyup), matching native button activation expectations.
  pressBtn.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
      ev.preventDefault();
      if (!ev.repeat) press();
    }
  });
  pressBtn.addEventListener("keyup", (ev) => {
    if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
      ev.preventDefault();
      release();
    }
  });

  svg.addEventListener("pointerdown", (ev) => {
    if (ev.target.closest(".m03-hit-head")) { ev.preventDefault(); press(); svg.setPointerCapture(ev.pointerId); }
  });
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);
  svg.addEventListener("pointerleave", (ev) => { if (ev.buttons === 0) release(); });

  // clickable-part fact lookups (click, not press-drag)
  svg.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-fact]");
    if (el) showFact(el.getAttribute("data-fact"));
  });
  circSvg.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-fact]");
    if (el) showFact(el.getAttribute("data-fact"));
  });

  // ---------------------------------------------------------------- paint
  // The cutaway/circuit SVGs are built ONCE (drawCutaway/drawCircuit fully
  // construct the DOM from scratch — that full rebuild logic is preserved
  // unchanged below). Every subsequent frame just patches the handful of
  // attributes that actually move (bridge position/state, moving-group
  // transform, chips, wires/lamps) via updateCutaway/updateCircuit instead
  // of tearing the tree down again. This matters beyond perf: destroying and
  // recreating the clickable part-groups every animation frame would orphan
  // any reference (assistive tech, automated tooling, a user's click that
  // lands mid-frame) held onto a previous node — the fact-card click
  // targets need to be the SAME elements for the life of the view.
  let built = false;
  function paint() {
    const nc = ncState(travel);   // 1 = closed .. 0 = open
    const no = noState(travel);   // 0 = open .. 1 = closed
    const ncClosed = nc > 0.5;
    const noClosed = no > 0.5;
    const deadZone = !ncClosed && !noClosed;

    if (!built) {
      drawCutaway(svg, travel, nc, no);
      drawCircuit(circSvg, ncClosed, noClosed);
      built = true;
    } else {
      updateCutaway(svg, travel, nc, no);
      updateCircuit(circSvg, ncClosed, noClosed);
    }

    // timing strip highlight
    tNC.classList.toggle("active", travel > 0 && travel < NC_OPEN + 0.02);
    tGap.classList.toggle("active", deadZone && travel > NC_START);
    tNO.classList.toggle("active", travel >= NO_START - 0.02);

    pressBtn.classList.toggle("down", travel > 0.5);
    pressWrap.querySelector(".m03-press-txt").textContent =
      travel > 0.96 ? "HELD DOWN" : (travel > 0.02 ? "TRAVELING…" : "PRESS & HOLD");
  }

  paint();
}

// =============================================================================
// In-place update path — mirrors the dynamic bits of drawCutaway/drawCircuit
// exactly, but patches existing nodes instead of rebuilding the tree. Keeps
// every clickable part-group's DOM node identity stable across the whole
// press/release animation.
// =============================================================================
function updateCutaway(svg, travel, nc, no) {
  const cx = 240, panelY = 258, stroke = 34;
  const dy = travel * stroke;

  const moving = svg.querySelector(".m03-moving");
  if (moving) moving.setAttribute("transform", `translate(0, ${dy})`);

  const blkY = panelY + 26 + 8; // panelH(26) + snap-clip offset(8), matches drawCutaway
  const ncBridge = svg.querySelector(".m03-contact-g[data-fact='nc'] .m03-bridge");
  if (ncBridge) {
    const ncLift = (1 - nc) * 16;
    const ncY = blkY + 46;
    ncBridge.setAttribute("y", ncY - 5 - ncLift);
    ncBridge.setAttribute("class", "m03-bridge" + (nc > 0.5 ? " m03-made" : " m03-open"));
  }
  const noBridge = svg.querySelector(".m03-contact-g[data-fact='no'] .m03-bridge");
  if (noBridge) {
    const noRestGap = 16;
    const noDrop = no * noRestGap;
    const noY = blkY + 118;
    noBridge.setAttribute("y", noY - 5 - noRestGap + noDrop);
    noBridge.setAttribute("class", "m03-bridge" + (no > 0.5 ? " m03-made" : " m03-open"));
  }

  const chips = svg.querySelectorAll(".m03-chip");
  if (chips[0]) {
    chips[0].setAttribute("class", `m03-chip m03-chip-${nc > 0.5 ? "closed" : "open"}`);
    const t = chips[0].querySelector("text");
    if (t) t.textContent = nc > 0.5 ? "NC CLOSED" : "NC OPEN";
  }
  if (chips[1]) {
    chips[1].setAttribute("class", `m03-chip m03-chip-${no > 0.5 ? "closed" : "open"}`);
    const t = chips[1].querySelector("text");
    if (t) t.textContent = no > 0.5 ? "NO CLOSED" : "NO OPEN";
  }
}

function updateCircuit(svg, ncClosed, noClosed) {
  const midX = 150;
  const rows = [
    { closed: ncClosed, factKey: "nc" },
    { closed: noClosed, factKey: "no" },
  ];
  rows.forEach(({ closed, factKey }) => {
    const g = svg.querySelector(`.m03-mini-contact[data-fact='${factKey}']`);
    const blade = g && g.querySelector(".m03-mini-blade");
    if (blade) {
      const y = g.querySelector(".m03-mini-term")?.getAttribute("cy");
      blade.setAttribute("class", "m03-mini-blade" + (closed ? " m03-made" : " m03-open"));
      blade.setAttribute("x2", closed ? midX + 22 : midX + 8);
      blade.setAttribute("y2", closed ? y : Number(y) - 14);
    }
    svg.querySelectorAll(`.m03-wire[data-row='${factKey}']`).forEach((w) => w.classList.toggle("m03-live", closed));
    const lampG = svg.querySelector(`.m03-lamp[data-row='${factKey}']`);
    if (lampG) {
      lampG.classList.toggle("m03-lit", closed);
      const body = lampG.querySelector(".m03-lamp-body");
      if (body) { if (closed) body.setAttribute("filter", "url(#m03-lamp-glow)"); else body.removeAttribute("filter"); }
    }
    const status = svg.querySelector(`.m03-mini-status[data-row='${factKey}']`);
    if (status) {
      status.setAttribute("class", "m03-mini-status " + (closed ? "on" : "off"));
      status.textContent = closed ? "PASSING CURRENT" : "no current";
    }
  });
  const note = svg.querySelector(".m03-circ-note");
  const shouldShowNote = !ncClosed && !noClosed;
  if (shouldShowNote && !note) {
    svg.appendChild(S("text", { class: "m03-circ-note", x: 150, y: 205, "text-anchor": "middle" }, "— dead zone: both lamps off —"));
  } else if (!shouldShowNote && note) {
    note.remove();
  }
}

// =============================================================================
// CUTAWAY drawing — side section view.
//   Coordinate plan (viewBox 0 0 480 520):
//     panel plane at y = 260 (drawn as a hatched section line, full width)
//     head/bezel sits above the panel, stem passes through the bore,
//     contact block snapped on below, NC contact ~ y 330, NO contact ~ y 400
// =============================================================================
function drawCutaway(svg, travel, nc, no) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = S("defs");
  // metal gradient for the bezel
  const bezelGrad = S("linearGradient", { id: "m03-bezel", x1: "0", y1: "0", x2: "1", y2: "1" });
  bezelGrad.appendChild(S("stop", { offset: "0%", "stop-color": "#F4F6FB" }));
  bezelGrad.appendChild(S("stop", { offset: "45%", "stop-color": "#C6CEDD" }));
  bezelGrad.appendChild(S("stop", { offset: "55%", "stop-color": "#9AA5B8" }));
  bezelGrad.appendChild(S("stop", { offset: "100%", "stop-color": "#E7EBF3" }));
  defs.appendChild(bezelGrad);
  // hatch pattern for the panel section cut
  const hatch = S("pattern", { id: "m03-hatch", width: 8, height: 8, patternTransform: "rotate(45)", patternUnits: "userSpaceOnUse" });
  hatch.appendChild(S("rect", { width: 8, height: 8, fill: "#EDF0F7" }));
  hatch.appendChild(S("line", { x1: 0, y1: 0, x2: 0, y2: 8, stroke: "#C6CEDD", "stroke-width": 2 }));
  defs.appendChild(hatch);
  svg.appendChild(defs);

  const cx = 240;          // centerline x
  const panelY = 258;      // top of panel plate
  const panelH = 26;       // panel thickness
  const boreW = 46;        // bore half-clearance region (visual)
  const stroke = 34;       // px of full plunger travel in this drawing

  const dy = travel * stroke; // downward offset applied to head/plunger

  // ---- PANEL (section cut), drawn full width with a bore gap ----
  const panelG = S("g", { class: "m03-panel" });
  svg.appendChild(panelG);
  // left panel segment
  panelG.appendChild(S("rect", { x: 20, y: panelY, width: cx - boreW - 20, height: panelH, fill: "url(#m03-hatch)", stroke: "#B7C0D4", "stroke-width": 1.5 }));
  // right panel segment
  panelG.appendChild(S("rect", { x: cx + boreW, y: panelY, width: 460 - (cx + boreW), height: panelH, fill: "url(#m03-hatch)", stroke: "#B7C0D4", "stroke-width": 1.5 }));
  // cut-line ticks along the top edge (classic section-view hatch marker)
  panelG.appendChild(S("line", { x1: 20, y1: panelY, x2: 460, y2: panelY, stroke: "#8792AA", "stroke-width": 2 }));
  panelG.appendChild(S("text", { class: "m03-lbl", x: 40, y: panelY + panelH + 20 }, "PANEL"));

  // bushing / threaded collar in the bore
  panelG.appendChild(S("rect", { x: cx - boreW, y: panelY - 4, width: boreW * 2, height: panelH + 8, rx: 4, fill: "#DEE3EE", stroke: "#B7C0D4", "stroke-width": 1.5 }));

  // ---- MOUNTING NUT (visible behind panel, real detail) ----
  panelG.appendChild(S("rect", { x: cx - boreW - 6, y: panelY + panelH - 6, width: (boreW + 6) * 2, height: 10, rx: 2, fill: "#B9C2D6", stroke: "#8792AA", "stroke-width": 1 }));

  // ================= moving assembly (head + stem) — shifts down by dy ====
  const moving = S("g", { class: "m03-moving", transform: `translate(0, ${dy})` });
  svg.appendChild(moving);

  // ---- STEM / PLUNGER (passes through the bore, extends up into the head and
  //      down to the contact-block actuator) ----
  const stemW = 16;
  moving.appendChild(S("rect", {
    class: "m03-stem", x: cx - stemW / 2, y: 150, width: stemW, height: 260, rx: 3,
  }));

  // ---- SPRING coiled around the stem, above the panel ----
  const springTop = 168, springBot = panelY - 6;
  const springG = S("g", { class: "m03-spring-g clickable", "data-fact": "spring" });
  // single invisible hit-area spanning the whole coil stack — the real click
  // target for this group (see the m03-hit CSS rule: every OTHER shape in
  // here is pointer-events:none so a click always lands on this one rect,
  // never on an individual coil that happens to be "dead" once the fact is
  // already showing).
  springG.appendChild(S("rect", {
    class: "m03-hit", x: cx - 32, y: springTop - 6, width: 64, height: (springBot - springTop) + 12,
    fill: "transparent",
  }));
  const coilN = 7;
  const coilStep = (springBot - springTop) / coilN;
  for (let i = 0; i < coilN; i++) {
    const y0 = springTop + i * coilStep;
    springG.appendChild(S("ellipse", {
      class: "m03-spring-coil", cx, cy: y0, rx: 27, ry: 6.5,
    }));
  }
  moving.appendChild(springG);
  svg.appendChild(S("text", { class: "m03-lbl clickable", "data-fact": "spring", x: cx + 40, y: (springTop + springBot) / 2 }, "RETURN SPRING"));

  // ---- HEAD / BEZEL (operator button), above the spring ----
  const headG = S("g", { class: "m03-head-g clickable m03-hit-head", "data-fact": "head" });
  // single invisible hit-area spanning bezel + face + legend (see m03-hit note above)
  headG.appendChild(S("rect", { class: "m03-hit", x: cx - 62, y: 60, width: 124, height: 110, fill: "transparent" }));
  // bezel ring (chrome-look, real GCX proportions: wide flush bezel)
  headG.appendChild(S("rect", { class: "m03-bezel", x: cx - 62, y: 78, width: 124, height: 30, rx: 6 }));
  headG.appendChild(S("rect", { class: "m03-bezel-skirt", x: cx - 50, y: 108, width: 100, height: 44, rx: 4 }));
  // green button face (flush, slightly domed via gradient highlight)
  headG.appendChild(S("ellipse", { class: "m03-face-shadow", cx, cy: 96, rx: 46, ry: 15 }));
  headG.appendChild(S("rect", { class: "m03-face", x: cx - 46, y: 60, width: 92, height: 40, rx: 8 }));
  headG.appendChild(S("ellipse", { class: "m03-face-hl", cx: cx - 14, cy: 68, rx: 22, ry: 7 }));
  // legend plate below bezel
  headG.appendChild(S("rect", { class: "m03-legend", x: cx - 40, y: 150, width: 80, height: 20, rx: 3 }));
  headG.appendChild(S("text", { class: "m03-legend-txt", x: cx, y: 164, "text-anchor": "middle" }, "START"));
  moving.appendChild(headG);

  // travel dimension hint arrow (small, subtle)
  moving.appendChild(S("line", { class: "m03-dim", x1: cx + 78, y1: 88, x2: cx + 78, y2: 88 + stroke }));

  // ================= CONTACT BLOCK (fixed to panel, snapped on below) =====
  const blockG = S("g", { class: "m03-block-g clickable", "data-fact": "block" });
  svg.appendChild(blockG);
  const blkX = cx - 70, blkY = panelY + panelH + 8, blkW = 140, blkH = 172;
  // single invisible hit-area spanning the whole block body (see m03-hit note
  // above) — the NC/NO contact pairs are their own nested clickable groups
  // (m03-contact-g) with higher specificity in the DOM so their own clicks
  // still resolve to "nc"/"no" rather than bubbling up to "block".
  blockG.appendChild(S("rect", { class: "m03-hit", x: blkX, y: blkY - 8, width: blkW, height: blkH + 8, fill: "transparent" }));
  blockG.appendChild(S("rect", { class: "m03-block-body", x: blkX, y: blkY, width: blkW, height: blkH, rx: 8 }));
  // snap-clip details (two little tabs at top, realistic detail)
  [blkX + 14, blkX + blkW - 14].forEach((tx) => {
    blockG.appendChild(S("rect", { class: "m03-snap-clip", x: tx - 6, y: blkY - 8, width: 12, height: 14, rx: 2 }));
  });
  svg.appendChild(S("text", { class: "m03-lbl clickable", "data-fact": "block", x: blkX + blkW + 14, y: blkY + 14 }, "CONTACT BLOCK"));
  // ("snaps on — no wires to head" micro-sublabel cut for legibility — the
  //  CONTACT BLOCK fact card already explains the snap-on detail)

  // actuator rod from the moving stem down into the block (visual continuity)
  moving.appendChild(S("rect", { class: "m03-actuator", x: cx - 6, y: 388, width: 12, height: 70, rx: 2 }));

  // ---- NC contact (top pair) ----
  const ncY = blkY + 46;
  const ncG = S("g", { class: "m03-contact-g clickable", "data-fact": "nc" });
  // single invisible hit-area spanning the whole NC row (term blocks + bridge
  // travel range + tag text) — see m03-hit note above.
  ncG.appendChild(S("rect", { class: "m03-hit", x: blkX + 6, y: ncY - 30, width: blkW - 12, height: 52, fill: "transparent" }));
  ncG.appendChild(S("rect", { class: "m03-term-block", x: blkX + 8, y: ncY - 16, width: 26, height: 32, rx: 3 }));
  ncG.appendChild(S("rect", { class: "m03-term-block", x: blkX + blkW - 34, y: ncY - 16, width: 26, height: 32, rx: 3 }));
  ncG.appendChild(S("circle", { class: "m03-term-screw", cx: blkX + 21, cy: ncY, r: 5 }));
  ncG.appendChild(S("circle", { class: "m03-term-screw", cx: blkX + blkW - 21, cy: ncY, r: 5 }));
  // fixed contact points
  ncG.appendChild(S("circle", { class: "m03-fixed-pt", cx: blkX + 40, cy: ncY, r: 4 }));
  ncG.appendChild(S("circle", { class: "m03-fixed-pt", cx: blkX + blkW - 40, cy: ncY, r: 4 }));
  // moving bridge: lifts as nc -> 0 (nc=1 closed/down onto contacts, nc=0 open/up)
  const ncLift = (1 - nc) * 16; // 0..16 px lift when opening
  const ncBridge = S("rect", {
    class: "m03-bridge" + (nc > 0.5 ? " m03-made" : " m03-open"),
    x: blkX + 34, y: ncY - 5 - ncLift, width: blkW - 68, height: 10, rx: 4,
  });
  ncG.appendChild(ncBridge);
  ncG.appendChild(S("text", { class: "m03-contact-tag nc-tag", x: cx, y: ncY - 24, "text-anchor": "middle" }, "N.C."));
  blockG.appendChild(ncG);

  // ---- NO contact (bottom pair) ----
  const noY = blkY + 118;
  const noG = S("g", { class: "m03-contact-g clickable", "data-fact": "no" });
  // single invisible hit-area spanning the whole NO row (see m03-hit note above)
  noG.appendChild(S("rect", { class: "m03-hit", x: blkX + 6, y: noY - 22, width: blkW - 12, height: 62, fill: "transparent" }));
  noG.appendChild(S("rect", { class: "m03-term-block", x: blkX + 8, y: noY - 16, width: 26, height: 32, rx: 3 }));
  noG.appendChild(S("rect", { class: "m03-term-block", x: blkX + blkW - 34, y: noY - 16, width: 26, height: 32, rx: 3 }));
  noG.appendChild(S("circle", { class: "m03-term-screw", cx: blkX + 21, cy: noY, r: 5 }));
  noG.appendChild(S("circle", { class: "m03-term-screw", cx: blkX + blkW - 21, cy: noY, r: 5 }));
  noG.appendChild(S("circle", { class: "m03-fixed-pt", cx: blkX + 40, cy: noY, r: 4 }));
  noG.appendChild(S("circle", { class: "m03-fixed-pt", cx: blkX + blkW - 40, cy: noY, r: 4 }));
  // moving bridge: starts high (open, resting above), drops onto contacts as no -> 1
  const noRestGap = 16;
  const noDrop = no * noRestGap;
  const noBridge = S("rect", {
    class: "m03-bridge" + (no > 0.5 ? " m03-made" : " m03-open"),
    x: blkX + 34, y: noY - 5 - noRestGap + noDrop, width: blkW - 68, height: 10, rx: 4,
  });
  noG.appendChild(noBridge);
  noG.appendChild(S("text", { class: "m03-contact-tag no-tag", x: cx, y: noY + 34, "text-anchor": "middle" }, "N.O."));
  blockG.appendChild(noG);

  // terminal numbers (real convention: NC = 1-2 style top block, NO = 3-4 style)
  svg.appendChild(S("text", { class: "m03-term-num", x: blkX + 21, y: ncY - 22 }, "1"));
  svg.appendChild(S("text", { class: "m03-term-num", x: blkX + blkW - 21, y: ncY - 22 }, "2"));
  svg.appendChild(S("text", { class: "m03-term-num", x: blkX + 21, y: noY + 30 }, "3"));
  svg.appendChild(S("text", { class: "m03-term-num", x: blkX + blkW - 21, y: noY + 30 }, "4"));

  // status chips under the block
  const chipY = blkY + blkH + 22;
  svg.appendChild(makeChip(cx - 140, chipY, nc > 0.5 ? "NC CLOSED" : "NC OPEN", nc > 0.5 ? "closed" : "open"));
  svg.appendChild(makeChip(cx + 8, chipY, no > 0.5 ? "NO CLOSED" : "NO OPEN", no > 0.5 ? "closed" : "open"));
}

function makeChip(x, y, text, state) {
  const g = S("g", { class: `m03-chip m03-chip-${state}`, transform: `translate(${x},${y})` });
  g.appendChild(S("rect", { width: 132, height: 26, rx: 13 }));
  g.appendChild(S("text", { x: 66, y: 17, "text-anchor": "middle" }, text));
  return g;
}

// =============================================================================
// live mini circuit: 24VDC source -> two parallel branches (through NC / NO)
// -> two pilot lamps -> common return.
// =============================================================================
function drawCircuit(svg, ncClosed, noClosed) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const defs = S("defs");
  const glow = S("filter", { id: "m03-lamp-glow", x: "-80%", y: "-80%", width: "260%", height: "260%" });
  glow.appendChild(S("feGaussianBlur", { in: "SourceGraphic", stdDeviation: 4, result: "b" }));
  const mg = S("feMerge");
  mg.appendChild(S("feMergeNode", { in: "b" }));
  mg.appendChild(S("feMergeNode", { in: "SourceGraphic" }));
  glow.appendChild(mg);
  defs.appendChild(glow);
  svg.appendChild(defs);

  const railX = 40;      // + rail (left)
  const retX = 260;      // return rail (right)
  const topY = 30, botY = 370;

  // supply symbol
  svg.appendChild(S("text", { class: "m03-circ-src", x: railX, y: 20, "text-anchor": "middle" }, "+24VDC"));
  svg.appendChild(S("line", { class: "m03-rail", x1: railX, y1: 26, x2: railX, y2: botY }));
  svg.appendChild(S("line", { class: "m03-rail", x1: retX, y1: 26, x2: retX, y2: botY }));
  svg.appendChild(S("text", { class: "m03-circ-src", x: retX, y: 20, "text-anchor": "middle" }, "0V"));

  // two branch rows
  branch(svg, 130, "NC", ncClosed, "nc");
  branch(svg, 270, "NO", noClosed, "no");

  function branch(root, y, label, closed, factKey) {
    const midX = 150;
    // wire: rail -> contact
    root.appendChild(S("line", { class: "m03-wire" + (closed ? " m03-live" : ""), x1: railX, y1: y, x2: midX - 22, y2: y, "data-row": factKey }));
    // contact symbol (small gap = open, small bridge = closed)
    const g = S("g", { class: "m03-mini-contact clickable", "data-fact": factKey });
    // single invisible hit-area spanning the mini-contact symbol (see m03-hit note above)
    g.appendChild(S("rect", { class: "m03-hit", x: midX - 26, y: y - 20, width: 52, height: 40, fill: "transparent" }));
    g.appendChild(S("circle", { cx: midX - 22, cy: y, r: 4, class: "m03-mini-term" }));
    g.appendChild(S("circle", { cx: midX + 22, cy: y, r: 4, class: "m03-mini-term" }));
    g.appendChild(S("line", {
      class: "m03-mini-blade" + (closed ? " m03-made" : " m03-open"),
      x1: midX - 22, y1: y, x2: closed ? midX + 22 : midX + 8, y2: closed ? y : y - 14,
    }));
    root.appendChild(g);
    root.appendChild(S("text", { class: "m03-mini-lbl", x: midX, y: y - 20, "text-anchor": "middle" }, label));

    // wire: contact -> lamp
    root.appendChild(S("line", { class: "m03-wire" + (closed ? " m03-live" : ""), x1: midX + 22, y1: y, x2: 200, y2: y, "data-row": factKey }));

    // lamp
    const lampG = S("g", { class: "m03-lamp" + (closed ? " m03-lit" : ""), "data-row": factKey });
    lampG.appendChild(S("circle", { cx: 200, cy: y, r: 15, class: "m03-lamp-body", filter: closed ? "url(#m03-lamp-glow)" : null }));
    lampG.appendChild(S("line", { x1: 200 - 7, y1: y - 7, x2: 200 + 7, y2: y + 7, class: "m03-lamp-x" }));
    lampG.appendChild(S("line", { x1: 200 - 7, y1: y + 7, x2: 200 + 7, y2: y - 7, class: "m03-lamp-x" }));
    root.appendChild(lampG);

    // wire: lamp -> return rail
    root.appendChild(S("line", { class: "m03-wire" + (closed ? " m03-live" : ""), x1: 215, y1: y, x2: retX, y2: y, "data-row": factKey }));
    // (three m03-wire segments per row now share data-row=factKey for reliable in-place updates)

    root.appendChild(S("text", { class: "m03-mini-status " + (closed ? "on" : "off"), "data-row": factKey, x: 200, y: y + 34, "text-anchor": "middle" },
      closed ? "PASSING CURRENT" : "no current"));
  }

  // dead-zone note when neither is closed
  if (!ncClosed && !noClosed) {
    svg.appendChild(S("text", { class: "m03-circ-note", x: 150, y: 205, "text-anchor": "middle" }, "— dead zone: both lamps off —"));
  }
}

// =============================================================================
function css() {
  return `
.m03-root{
  box-sizing:border-box; width:100%; height:100%;
  padding:22px 26px; display:flex; flex-direction:column; gap:16px;
  font-family:var(--font-display,"Inter",system-ui,sans-serif);
  color:var(--text,#303749);
  background:var(--bg,#F6F8FC);
}
.m03-root *{box-sizing:border-box;}

.m03-head{flex:0 0 auto;}
.m03-kicker{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.18em; font-weight:600;
  color:var(--blue-deep,#2563EB);
  background:var(--blue-soft,#EAF1FE);
  display:inline-block; padding:4px 10px; border-radius:999px; margin-bottom:8px;
}
.m03-title{margin:0 0 4px; font-size:22px; font-weight:800; letter-spacing:-.01em; color:var(--ink,#0E1326);}
.m03-sub{margin:0; font-size:13.5px; line-height:1.45; color:var(--muted,#6B7488); max-width:820px;}

.m03-grid{flex:1 1 auto; display:grid; grid-template-columns:1.3fr 1fr; gap:20px; min-height:0;}

/* ---------------- left: cutaway stage ---------------- */
.m03-left{display:flex; flex-direction:column; gap:12px; min-height:0;}
.m03-stage-card{
  flex:1 1 auto; min-height:0; background:var(--surface,#fff);
  border:1px solid var(--border,#E6EAF3); border-radius:16px;
  padding:8px; box-shadow:var(--shadow-sm,0 1px 3px rgba(16,19,38,.05));
  display:flex;
}
.m03-svg{flex:1 1 auto; width:100%; height:100%; min-height:0; display:block;}

.m03-press-wrap{
  flex:0 0 auto; display:flex; align-items:center; gap:16px; flex-wrap:wrap;
  background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
  border-radius:14px; padding:12px 16px; box-shadow:var(--shadow-sm,0 1px 3px rgba(16,19,38,.05));
}
.m03-press{
  appearance:none; cursor:pointer; border:none; border-radius:12px;
  background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
  color:#fff; font-family:var(--font-display,sans-serif); font-weight:700; font-size:13.5px;
  padding:12px 20px; display:flex; align-items:center; gap:10px;
  box-shadow:var(--shadow-blue,0 10px 34px -10px rgba(59,130,246,.4));
  transition:transform .16s cubic-bezier(.34,1.3,.5,1), box-shadow .16s ease;
  user-select:none; touch-action:none;
}
.m03-press:active, .m03-press.down{transform:translateY(2px) scale(.98); box-shadow:0 4px 14px -6px rgba(59,130,246,.5);}
.m03-press-dot{width:9px; height:9px; border-radius:50%; background:#fff; opacity:.85;}
.m03-press.down .m03-press-dot{background:var(--live,#EF4444); animation:m03-blink .5s ease-in-out infinite;}
@keyframes m03-blink{0%,100%{opacity:1;}50%{opacity:.4;}}

.m03-timing{
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.03em;
}
.m03-t-label{color:var(--muted,#6B7488); font-weight:700; letter-spacing:.08em; font-size:11px;}
.m03-t-seg{
  padding:4px 9px; border-radius:8px; font-weight:700; color:var(--muted,#6B7488);
  background:var(--surface-2,#FBFCFE); border:1px solid var(--border,#E6EAF3);
  transition:all .2s ease;
}
.m03-t-arrow{color:var(--faint,#99A1B3);}
.m03-t-nc.active{background:#FFE9E7; border-color:var(--live,#EF4444); color:var(--live-label,#DC2626);}
.m03-t-gap.active{background:#FEF3C7; border-color:var(--warning,#F59E0B); color:#92400E;}
.m03-t-no.active{background:var(--blue-soft,#EAF1FE); border-color:var(--blue,#3B82F6); color:var(--blue-deep,#2563EB);}

/* ---------------- right column ---------------- */
.m03-right{display:flex; flex-direction:column; gap:14px; min-height:0;}
.m03-circ-card{
  background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
  border-radius:16px; padding:14px 14px 10px; box-shadow:var(--shadow-sm,0 1px 3px rgba(16,19,38,.05));
  flex:1 1 auto; min-height:0; display:flex; flex-direction:column;
}
.m03-circ-title{
  font-family:var(--font-mono,monospace); font-size:11.5px; font-weight:700;
  letter-spacing:.1em; color:var(--muted,#6B7488); margin-bottom:6px; text-transform:uppercase;
}
.m03-circ-svg{flex:1 1 auto; width:100%; height:100%; min-height:0; display:block;}

.m03-fact{
  background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
  border-radius:16px; padding:16px 18px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
  position:relative; overflow:hidden; opacity:0; transform:translateY(6px);
  transition:opacity .28s cubic-bezier(.34,1.1,.5,1), transform .28s cubic-bezier(.34,1.1,.5,1);
  flex:0 0 auto;
}
.m03-fact.show{opacity:1; transform:translateY(0);}
.m03-fact::before{
  content:""; position:absolute; left:0; top:0; bottom:0; width:5px;
  background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
}
/* re-clicking the part that's already showing its fact card: a visible
   "yes, that one" acknowledgement instead of a silent no-op. */
.m03-fact.m03-pulse{animation:m03-fact-pulse .38s ease-out;}
@keyframes m03-fact-pulse{
  0%{box-shadow:0 6px 28px -8px rgba(16,19,38,.12), 0 0 0 0 rgba(59,130,246,.5);}
  40%{box-shadow:0 6px 28px -8px rgba(16,19,38,.12), 0 0 0 6px rgba(59,130,246,0);}
  100%{box-shadow:0 6px 28px -8px rgba(16,19,38,.12), 0 0 0 0 rgba(59,130,246,0);}
}
.m03-fact-tag{
  font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; letter-spacing:.06em;
  color:var(--blue-deep,#2563EB); background:var(--blue-soft,#EAF1FE);
  display:inline-block; padding:3px 8px; border-radius:7px; margin-bottom:8px;
}
.m03-fact-title{font-size:15.5px; font-weight:800; color:var(--ink,#0E1326); margin-bottom:6px;}
.m03-fact-body{font-size:12.8px; line-height:1.55; color:var(--text,#303749);}

/* ============================================================ SVG parts */
.clickable{cursor:pointer;}
/* Every part-group (spring/head/block/nc/no/mini-contact) opens the SAME
   fact card no matter which shape inside it you click — one shape per group
   stays a real hit target (default pointer-events, inherits cursor:pointer
   from .clickable), everything else in that group is cosmetic only:
   pointer-events:none so the click passes straight to the real hit target
   underneath instead of stopping on a decorative ellipse/rect, and
   cursor:default so CSS inheritance doesn't paint a pointer-hand over parts
   that were never independently clickable. (SVG2's pointer-events:bounding-box
   on the group would be the tidy way to do this but isn't supported by
   Chromium's hit-testing — verified experimentally — hence the explicit
   primary-hit-target pattern below.) */
.m03-spring-g > *:not(.m03-hit), .m03-head-g > *:not(.m03-hit),
.m03-block-g > *:not(.m03-hit):not(.clickable), .m03-contact-g > *:not(.m03-hit),
.m03-mini-contact > *:not(.m03-hit){
  pointer-events:none; cursor:default;
}
/* the group container itself is not the hit target (its .m03-hit rect is) —
   give it cursor:default so it doesn't ALSO get picked up as its own
   separate "looks clickable" candidate alongside the rect. */
.m03-spring-g, .m03-head-g, .m03-block-g, .m03-contact-g, .m03-mini-contact{
  cursor:default;
}
.m03-hit{cursor:pointer;}

/* panel section */
/* main cutaway svg renders at ~0.77x of its 480-unit viewBox — sizes below are
   pre-compensated so the EFFECTIVE rendered size stays ≥ ~11px */
.m03-lbl{
  font-family:var(--font-mono,monospace); font-size:15px; font-weight:700;
  letter-spacing:.06em; fill:var(--muted,#6B7488);
}
.m03-lbl.small{font-size:13px; font-weight:600; fill:var(--muted,#6B7488);}

/* head / bezel */
.m03-bezel{fill:url(#m03-bezel); stroke:#8792AA; stroke-width:1.5;}
.m03-bezel-skirt{fill:#B9C2D6; stroke:#8792AA; stroke-width:1.5;}
.m03-face{fill:#1E9E63; stroke:#0F7A48; stroke-width:2;}
.m03-face-hl{fill:#5FCB93; opacity:.55;}
.m03-face-shadow{fill:#0E1326; opacity:.08;}
.m03-legend{fill:#F7F9FD; stroke:#B9C2D6; stroke-width:1.3;}
.m03-legend-txt{
  font-family:var(--font-mono,monospace); font-size:14.5px; font-weight:800; letter-spacing:.08em;
  fill:#15803D; text-anchor:middle;
}
.m03-head-g:hover .m03-face{stroke:var(--blue,#3B82F6);}

/* stem + spring */
.m03-stem{fill:#C7CEDF; stroke:#8792AA; stroke-width:1.5;}
.m03-spring-coil{fill:none; stroke:#93A0B8; stroke-width:2.6;}
.m03-spring-g:hover .m03-spring-coil{stroke:var(--blue,#3B82F6);}
.m03-actuator{fill:#B9C2D6; stroke:#8792AA; stroke-width:1.3;}
.m03-dim{stroke:var(--faint,#99A1B3); stroke-width:1.5; stroke-dasharray:3 3;}

/* contact block */
.m03-block-body{fill:#F4F8F5; stroke:#79A98A; stroke-width:2;}
.m03-block-g:hover .m03-block-body{stroke:var(--blue,#3B82F6);}
.m03-snap-clip{fill:#DCE9E0; stroke:#79A98A; stroke-width:1.2;}
.m03-term-block{fill:#E7F1EA; stroke:#79A98A; stroke-width:1.3;}
.m03-term-screw{fill:#9AA5B8; stroke:#6B7488; stroke-width:1;}
.m03-fixed-pt{fill:var(--contact-closed,#64748B);}
.m03-term-num{
  font-family:var(--font-mono,monospace); font-size:14.5px; font-weight:700;
  fill:var(--muted,#6B7488); text-anchor:middle;
}
.m03-contact-tag{
  font-family:var(--font-mono,monospace); font-size:14.5px; font-weight:800; letter-spacing:.08em;
}
.nc-tag{fill:var(--live-label,#DC2626);}
.no-tag{fill:var(--blue-deep,#2563EB);}

.m03-bridge{stroke-width:9; stroke-linecap:round; transition:y .05s linear;}
.m03-bridge.m03-made{stroke:var(--contact-closed,#475569);}
.m03-bridge.m03-open{stroke:var(--contact-open,#94A3B8);}
.m03-contact-g:hover .m03-fixed-pt{fill:var(--blue,#3B82F6);}

/* status chips */
.m03-chip rect{fill:var(--surface-2,#FBFCFE); stroke:var(--border-strong,#D6DDEC); stroke-width:1.4;}
.m03-chip text{
  font-family:var(--font-mono,monospace); font-size:15px; font-weight:700; letter-spacing:.05em;
  fill:var(--muted,#6B7488);
}
.m03-chip-closed rect{fill:#FFE9E7; stroke:var(--live,#EF4444);}
.m03-chip-closed text{fill:var(--live-label,#DC2626);}

/* ---- live mini circuit (300-unit viewBox at ~0.67x — pre-compensated) ---- */
.m03-circ-src{
  font-family:var(--font-mono,monospace); font-size:16.5px; font-weight:700; fill:var(--muted,#6B7488);
}
.m03-rail{stroke:var(--wire-rest,#94A3B8); stroke-width:3;}
.m03-wire{stroke:var(--wire-rest,#94A3B8); stroke-width:3; stroke-linecap:round; transition:stroke .25s ease;}
.m03-wire.m03-live{stroke:var(--live,#EF4444);}
.m03-mini-lbl{
  font-family:var(--font-mono,monospace); font-size:16.5px; font-weight:800; letter-spacing:.06em;
  fill:var(--ink,#0E1326);
}
.m03-mini-term{fill:var(--surface,#fff); stroke:var(--contact-closed,#64748B); stroke-width:2;}
.m03-mini-blade{stroke:var(--ink,#0E1326); stroke-width:3.4; stroke-linecap:round; transition:all .18s ease;}
.m03-mini-blade.m03-made{stroke:var(--contact-closed,#475569);}
.m03-mini-blade.m03-open{stroke:var(--contact-open,#94A3B8);}
.m03-mini-contact:hover .m03-mini-term{stroke:var(--blue,#3B82F6);}

.m03-lamp-body{fill:#EEF1F8; stroke:var(--border-strong,#D6DDEC); stroke-width:2; transition:all .2s ease;}
.m03-lamp-x{stroke:var(--faint,#99A1B3); stroke-width:1.6; transition:opacity .2s ease;}
.m03-lamp.m03-lit .m03-lamp-body{fill:#FFD9D2; stroke:var(--live,#EF4444);}
.m03-lamp.m03-lit .m03-lamp-x{opacity:0;}
.m03-mini-status{
  font-family:var(--font-mono,monospace); font-size:16.5px; font-weight:700; letter-spacing:.05em;
  fill:var(--muted,#6B7488);
}
.m03-mini-status.on{fill:var(--live-label,#DC2626);}
.m03-circ-note{
  font-family:var(--font-mono,monospace); font-size:15px; font-weight:700; letter-spacing:.04em;
  fill:#92400E;
}
`;
}
