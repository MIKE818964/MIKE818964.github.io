// =============================================================================
// m07_selector.js — Module m07-double-throw-two-destinations
// "Double Throw: Two Destinations (the Selector)"
//
// Self-contained interactive lesson. Exports render(host).
//   - A 24VDC source feeds a COMMON pole.
//   - The pole's wiper throws to Destination 1 (Lamp A / "Stopped")
//     or Destination 2 (Lamp B / "Running"). Never both at once.
//   - Clicking the selector (or the toggle) flips the wiper with a smooth
//     animation; the active wire path lights up (energized color) and the
//     selected lamp turns ON while the other goes dark.
//   - A side panel contrasts SINGLE THROW (one destination) with the
//     DOUBLE THROW selector the learner is operating.
//
// Theme: "The Well-Lit Workbench" — bright, airy, high-contrast, AAA craft.
// Every CSS class is prefixed `m07sel-` so nothing collides with other modules.
// Pure vanilla JS + inline SVG + CSS. No imports, no network.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";

/** Tiny namespaced-element helper. */
function E(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}

export function render(host) {
  // ---- scoped styles (must be the FIRST child appended) ----------------
  const style = document.createElement("style");
  style.textContent = CSS;
  host.appendChild(style);

  const root = document.createElement("div");
  root.className = "m07sel-root";
  host.appendChild(root);

  // ---- header ----------------------------------------------------------
  const header = document.createElement("div");
  header.className = "m07sel-header";
  header.innerHTML = `
    <div class="m07sel-kicker">BEGINNER · SCHEMATIC LAB</div>
    <h2 class="m07sel-title">Double Throw — One Common, Two Destinations</h2>
    <p class="m07sel-sub">A single common pole can route power to <b>one of two</b> outputs.
    Throw the selector and watch the wiper swing — exactly one lamp lights, never both.</p>
  `;
  root.appendChild(header);

  // ---- body: schematic stage + side rail -------------------------------
  const body = document.createElement("div");
  body.className = "m07sel-body";
  root.appendChild(body);

  const stage = document.createElement("div");
  stage.className = "m07sel-stage";
  body.appendChild(stage);

  const rail = document.createElement("div");
  rail.className = "m07sel-rail";
  body.appendChild(rail);

  // ---- the schematic SVG ----------------------------------------------
  const svg = E("svg", {
    class: "m07sel-svg",
    viewBox: "0 0 560 460",
    preserveAspectRatio: "xMidYMid meet",
  });
  stage.appendChild(svg);
  const refs = buildSchematic(svg);

  // ---- side rail content ----------------------------------------------
  rail.innerHTML = `
    <div class="m07sel-selcard">
      <div class="m07sel-selrow">
        <span class="m07sel-selabel">SELECTOR POSITION</span>
        <span class="m07sel-selpos" data-pos>—</span>
      </div>
      <button class="m07sel-flip" data-flip type="button">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 7h11l-3-3M20 17H9l3 3" fill="none"
                stroke="currentColor" stroke-width="2.2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span data-flip-label>Throw the selector</span>
      </button>
      <div class="m07sel-hint">Tip: you can also click the wiper bar in the schematic.</div>
    </div>

    <div class="m07sel-compare" data-compare>
      <div class="m07sel-cmp-head">Single&nbsp;throw <span>vs</span> Double&nbsp;throw</div>
      <div class="m07sel-cmp-grid">
        <div class="m07sel-cmp single">
          <div class="m07sel-cmp-name">SINGLE&nbsp;THROW</div>
          ${miniSingle()}
          <div class="m07sel-cmp-foot">1 destination · on / off</div>
        </div>
        <div class="m07sel-cmp double">
          <div class="m07sel-cmp-name">DOUBLE&nbsp;THROW</div>
          ${miniDouble()}
          <div class="m07sel-cmp-foot">2 destinations · pick one</div>
        </div>
      </div>
    </div>
  `;

  // ---- caption ---------------------------------------------------------
  const caption = document.createElement("div");
  caption.className = "m07sel-caption";
  caption.innerHTML = `
    <span class="m07sel-cap-dot"></span>
    <span data-caption>A <b>double-throw</b> contact connects the common to output&nbsp;A
    <b>or</b> output&nbsp;B — one closes as the other opens, so it acts as a
    <b>selector</b> between two destinations. You pick one at a time.</span>
  `;
  root.appendChild(caption);

  // ---- state + behavior ------------------------------------------------
  // pos: 0 = throw to Destination 1 (Lamp A / "STOPPED")
  //      1 = throw to Destination 2 (Lamp B / "RUNNING")
  let pos = 0;
  let busy = false;

  const posEl = rail.querySelector("[data-pos]");
  const flipBtn = rail.querySelector("[data-flip]");
  const flipLabel = rail.querySelector("[data-flip-label]");
  const miniD = rail.querySelector(".m07sel-cmp.double");

  function apply(animate) {
    // Wiper angle: rest on A (up) at pos 0, swing down to B at pos 1.
    const angle = pos === 0 ? -18 : 18;
    refs.wiper.style.transition = animate
      ? "transform .42s cubic-bezier(.34,1.56,.64,1)"
      : "none";
    refs.wiper.style.transform = `rotate(${angle}deg)`;

    // Energize the chosen path + lamp; de-energize the other.
    const aLive = pos === 0;
    refs.pathA.classList.toggle("live", aLive);
    refs.pathB.classList.toggle("live", !aLive);
    refs.lampA.classList.toggle("on", aLive);
    refs.lampB.classList.toggle("on", !aLive);
    refs.glowA.classList.toggle("on", aLive);
    refs.glowB.classList.toggle("on", !aLive);
    refs.tapA.classList.toggle("made", aLive);
    refs.tapB.classList.toggle("made", !aLive);

    // Labels / readout.
    posEl.textContent = aLive ? "DEST 1 · LAMP A" : "DEST 2 · LAMP B";
    posEl.classList.toggle("a", aLive);
    posEl.classList.toggle("b", !aLive);
    flipLabel.textContent = aLive ? "Throw → Lamp B" : "Throw → Lamp A";

    // Mirror in the mini double-throw illustration.
    miniD.classList.toggle("to-b", !aLive);
  }

  function flip() {
    if (busy) return;
    busy = true;
    pos = pos === 0 ? 1 : 0;
    apply(true);
    // brief lock so the smooth swing isn't interrupted mid-flight
    setTimeout(() => { busy = false; }, 430);
  }

  flipBtn.addEventListener("click", flip);
  refs.wiperHit.addEventListener("click", flip);
  refs.wiperHit.style.cursor = "pointer";

  // initial state (no animation on first paint)
  apply(false);
}

// -----------------------------------------------------------------------------
// Main schematic. Standard symbols: source (battery), SPDT contact (common +
// wiper + two fixed throws), two lamps (⊗). Returns refs for animation.
// -----------------------------------------------------------------------------
function buildSchematic(svg) {
  // soft drop shadow for cards
  const defs = E("defs");
  const f = E("filter", { id: "m07sel-soft", x: "-20%", y: "-20%", width: "140%", height: "140%" });
  f.appendChild(E("feDropShadow", { dx: 0, dy: 3, stdDeviation: 4, "flood-color": "#0E1326", "flood-opacity": "0.10" }));
  defs.appendChild(f);
  // lamp glow
  const g = E("filter", { id: "m07sel-glow", x: "-60%", y: "-60%", width: "220%", height: "220%" });
  g.appendChild(E("feGaussianBlur", { stdDeviation: 6, result: "b" }));
  const merge = E("feMerge");
  merge.appendChild(E("feMergeNode", { in: "b" }));
  merge.appendChild(E("feMergeNode", { in: "SourceGraphic" }));
  g.appendChild(merge);
  defs.appendChild(g);
  svg.appendChild(defs);

  // board background card
  svg.appendChild(E("rect", { class: "m07sel-board", x: 8, y: 8, width: 544, height: 444, rx: 18, filter: "url(#m07sel-soft)" }));

  // ----- geometry --------------------------------------------------------
  const SRC = { x: 86, y: 230 };     // source center
  const PIV = { x: 250, y: 230 };    // common pivot (wiper hinge)
  const A   = { x: 372, y: 150 };    // throw 1 fixed contact (up)
  const B   = { x: 372, y: 310 };    // throw 2 fixed contact (down)
  const LA  = { x: 470, y: 116 };    // Lamp A center
  const LB  = { x: 470, y: 344 };    // Lamp B center
  const RET = 230;                   // return-rail y (bottom feeder)

  // ----- ENERGIZED feeder from source(+) to the common pivot ------------
  // This wire is always live (source -> common). Drawn as the "supply" hot.
  const supply = E("path", {
    class: "m07sel-wire supply",
    d: `M ${SRC.x} ${SRC.y - 38} L ${SRC.x} ${SRC.y - 70} L ${PIV.x - 6} ${SRC.y - 70} L ${PIV.x - 6} ${PIV.y}`,
  });
  svg.appendChild(supply);
  // animated "flow" overlay on the supply (dashed, marching)
  svg.appendChild(E("path", {
    class: "m07sel-flow", d: supply.getAttribute("d"),
  }));

  // ----- THROW A branch (pivot via fixed-contact A -> lamp A -> return) --
  const pathA = E("g", { class: "m07sel-path", "data-path": "a" });
  pathA.appendChild(E("path", { class: "m07sel-wire branch",
    d: `M ${A.x} ${A.y} L ${LA.x - 30} ${A.y} L ${LA.x - 30} ${LA.y}` }));
  pathA.appendChild(E("path", { class: "m07sel-wire branch",
    d: `M ${LA.x + 30} ${LA.y} L ${LA.x + 64} ${LA.y} L ${LA.x + 64} ${RET} L ${SRC.x} ${RET} L ${SRC.x} ${SRC.y + 38}` }));
  const flowA = E("path", { class: "m07sel-flow branch-flow",
    d: `M ${A.x} ${A.y} L ${LA.x - 30} ${A.y} L ${LA.x - 30} ${LA.y}` });
  pathA.appendChild(flowA);
  svg.appendChild(pathA);

  // ----- THROW B branch -------------------------------------------------
  const pathB = E("g", { class: "m07sel-path", "data-path": "b" });
  pathB.appendChild(E("path", { class: "m07sel-wire branch",
    d: `M ${B.x} ${B.y} L ${LB.x - 30} ${B.y} L ${LB.x - 30} ${LB.y}` }));
  pathB.appendChild(E("path", { class: "m07sel-wire branch",
    d: `M ${LB.x + 30} ${LB.y} L ${LB.x + 64} ${LB.y} L ${LB.x + 64} ${RET} L ${SRC.x} ${RET} L ${SRC.x} ${SRC.y + 38}` }));
  const flowB = E("path", { class: "m07sel-flow branch-flow",
    d: `M ${B.x} ${B.y} L ${LB.x - 30} ${B.y} L ${LB.x - 30} ${LB.y}` });
  pathB.appendChild(flowB);
  svg.appendChild(pathB);

  // ----- SOURCE: 24VDC battery symbol -----------------------------------
  const src = E("g", { class: "m07sel-source" });
  // long plate (+) and short plate (-)
  src.appendChild(E("line", { class: "m07sel-cell long",  x1: SRC.x - 16, y1: SRC.y - 14, x2: SRC.x + 16, y2: SRC.y - 14 }));
  src.appendChild(E("line", { class: "m07sel-cell short", x1: SRC.x - 9,  y1: SRC.y - 2,  x2: SRC.x + 9,  y2: SRC.y - 2 }));
  src.appendChild(E("line", { class: "m07sel-cell long",  x1: SRC.x - 16, y1: SRC.y + 10, x2: SRC.x + 16, y2: SRC.y + 10 }));
  src.appendChild(E("line", { class: "m07sel-cell short", x1: SRC.x - 9,  y1: SRC.y + 22, x2: SRC.x + 9,  y2: SRC.y + 22 }));
  // stubs up/down to the rails
  src.appendChild(E("line", { class: "m07sel-wire supply", x1: SRC.x, y1: SRC.y - 38, x2: SRC.x, y2: SRC.y - 14 }));
  src.appendChild(E("line", { class: "m07sel-wire", x1: SRC.x, y1: SRC.y + 22, x2: SRC.x, y2: SRC.y + 38 }));
  src.appendChild(E("text", { class: "m07sel-srctag", x: SRC.x, y: SRC.y - 50, "text-anchor": "middle" }, "24 VDC"));
  src.appendChild(E("text", { class: "m07sel-pol plus",  x: SRC.x + 26, y: SRC.y - 24 }, "+"));
  src.appendChild(E("text", { class: "m07sel-pol minus", x: SRC.x + 26, y: SRC.y + 30 }, "–"));
  svg.appendChild(src);

  // ----- COMMON node + label --------------------------------------------
  svg.appendChild(E("circle", { class: "m07sel-node common", cx: PIV.x, cy: PIV.y, r: 6 }));
  svg.appendChild(E("text", { class: "m07sel-termlbl com", x: PIV.x - 12, y: PIV.y + 26, "text-anchor": "middle" }, "COMMON"));

  // ----- FIXED THROW CONTACTS (the two destinations the wiper can reach) -
  // Throw A target pad
  const tapA = E("circle", { class: "m07sel-tap", cx: A.x, cy: A.y, r: 6 });
  svg.appendChild(tapA);
  svg.appendChild(E("text", { class: "m07sel-termlbl", x: A.x + 4, y: A.y - 14, "text-anchor": "middle" }, "THROW 1"));
  // Throw B target pad
  const tapB = E("circle", { class: "m07sel-tap", cx: B.x, cy: B.y, r: 6 });
  svg.appendChild(tapB);
  svg.appendChild(E("text", { class: "m07sel-termlbl", x: B.x + 4, y: B.y + 22, "text-anchor": "middle" }, "THROW 2"));

  // ----- WIPER (moving bar). Hinged at PIV; rotates between A and B. -----
  // local coords: pivot at (PIV.x,PIV.y); bar extends to the right toward
  // the contacts. Length reaches roughly the contact column.
  const wiper = E("g", { class: "m07sel-wiper" });
  wiper.style.transformOrigin = `${PIV.x}px ${PIV.y}px`;
  wiper.style.transformBox = "view-box";
  wiper.appendChild(E("line", { class: "m07sel-wiper-bar", x1: PIV.x, y1: PIV.y, x2: A.x + 6, y2: PIV.y }));
  // contact ball at the wiper tip
  wiper.appendChild(E("circle", { class: "m07sel-wiper-tip", cx: A.x + 6, cy: PIV.y, r: 7 }));
  svg.appendChild(wiper);

  // bigger invisible hit target over the wiper for easy clicking
  const wiperHit = E("rect", { class: "m07sel-wiper-hit",
    x: PIV.x - 4, y: PIV.y - 60, width: (A.x + 24) - PIV.x, height: 120, fill: "transparent" });
  svg.appendChild(wiperHit);

  // dashed arc showing the wiper's range of travel between the two throws
  svg.appendChild(E("path", { class: "m07sel-arc",
    d: `M ${A.x - 6} ${A.y + 14} A 122 122 0 0 1 ${B.x - 6} ${B.y - 14}` }));

  // ----- LAMPS (⊗ symbol) -----------------------------------------------
  const lampA = lampSymbol(LA, "LAMP A", "FORWARD");
  const lampB = lampSymbol(LB, "LAMP B", "REVERSE");
  // glow discs behind lamps
  const glowA = E("circle", { class: "m07sel-lampglow", cx: LA.x, cy: LA.y, r: 26, filter: "url(#m07sel-glow)" });
  const glowB = E("circle", { class: "m07sel-lampglow", cx: LB.x, cy: LB.y, r: 26, filter: "url(#m07sel-glow)" });
  svg.appendChild(glowA);
  svg.appendChild(glowB);
  svg.appendChild(lampA.g);
  svg.appendChild(lampB.g);

  // legend chip: live vs dead color key
  const legend = E("g", { class: "m07sel-legend", transform: "translate(24,418)" });
  legend.appendChild(E("line", { class: "m07sel-wire live", x1: 0, y1: 0, x2: 26, y2: 0 }));
  legend.appendChild(E("text", { class: "m07sel-legtxt", x: 32, y: 4 }, "energized path"));
  legend.appendChild(E("line", { class: "m07sel-wire", x1: 150, y1: 0, x2: 176, y2: 0 }));
  legend.appendChild(E("text", { class: "m07sel-legtxt", x: 182, y: 4 }, "open / no flow"));
  svg.appendChild(legend);

  return {
    wiper, wiperHit,
    pathA, pathB,
    lampA: lampA.g, lampB: lampB.g,
    glowA, glowB,
    tapA, tapB,
  };
}

/** Standard lamp symbol: circle with an internal ✕, plus name/role tags. */
function lampSymbol(c, name, role) {
  const grp = E("g", { class: "m07sel-lamp" });
  grp.appendChild(E("circle", { class: "m07sel-lamp-body", cx: c.x, cy: c.y, r: 20 }));
  const k = 14;
  grp.appendChild(E("line", { class: "m07sel-lamp-x", x1: c.x - k, y1: c.y - k, x2: c.x + k, y2: c.y + k }));
  grp.appendChild(E("line", { class: "m07sel-lamp-x", x1: c.x - k, y1: c.y + k, x2: c.x + k, y2: c.y - k }));
  grp.appendChild(E("text", { class: "m07sel-lamp-name", x: c.x, y: c.y - 30, "text-anchor": "middle" }, name));
  grp.appendChild(E("text", { class: "m07sel-lamp-role", x: c.x, y: c.y + 40, "text-anchor": "middle" }, role));
  return { g: grp };
}

// -----------------------------------------------------------------------------
// Mini SVGs for the side-rail comparison (single vs double throw).
// -----------------------------------------------------------------------------
function miniSingle() {
  return `
  <svg class="m07sel-mini" viewBox="0 0 140 86" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <circle class="m07sel-mini-node" cx="18" cy="43" r="4"/>
    <line class="m07sel-mini-wire" x1="18" y1="43" x2="18" y2="43"/>
    <line class="m07sel-mini-bar single" x1="18" y1="43" x2="86" y2="22"/>
    <circle class="m07sel-mini-tap" cx="92" cy="22" r="4"/>
    <circle class="m07sel-mini-lamp on" cx="120" cy="22" r="9"/>
    <text class="m07sel-mini-x" x="120" y="26" text-anchor="middle">✕</text>
  </svg>`;
}

function miniDouble() {
  return `
  <svg class="m07sel-mini" viewBox="0 0 140 86" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <circle class="m07sel-mini-node" cx="18" cy="43" r="4"/>
    <circle class="m07sel-mini-tap a" cx="92" cy="20" r="4"/>
    <circle class="m07sel-mini-tap b" cx="92" cy="66" r="4"/>
    <line class="m07sel-mini-bar double" x1="18" y1="43" x2="86" y2="20"/>
    <circle class="m07sel-mini-lamp lampA on" cx="120" cy="20" r="9"/>
    <text class="m07sel-mini-x xA" x="120" y="24" text-anchor="middle">✕</text>
    <circle class="m07sel-mini-lamp lampB" cx="120" cy="66" r="9"/>
    <text class="m07sel-mini-x xB" x="120" y="70" text-anchor="middle">✕</text>
  </svg>`;
}

// -----------------------------------------------------------------------------
// Scoped CSS — bright "Well-Lit Workbench" theme. All classes `m07sel-`.
// -----------------------------------------------------------------------------
const CSS = `
.m07sel-root{
  --m07-bg: var(--bg,#F6F8FC);
  --m07-surface: var(--surface,#FFFFFF);
  --m07-ink: var(--ink,#0E1326);
  --m07-text: var(--text,#303749);
  --m07-muted: var(--muted,#6B7488);
  --m07-border: var(--border,#E6EAF3);
  --m07-blue: var(--blue,#3B82F6);
  --m07-blue-deep: var(--blue-deep,#2563EB);
  --m07-blue-soft: var(--blue-soft,#EAF1FE);
  --m07-violet: var(--violet,#7C5CFF);
  --m07-live: var(--live,#EF4444);
  --m07-amber:#F59E0B;
  --m07-green:#22C55E;
  box-sizing:border-box;
  width:100%; height:100%;
  display:flex; flex-direction:column;
  gap:14px;
  padding:18px 20px;
  font-family:var(--font-display,"Inter",system-ui,sans-serif);
  color:var(--m07-text);
  background:
    radial-gradient(1100px 460px at 18% -10%, #FFFFFF 0%, rgba(255,255,255,0) 60%),
    var(--m07-bg);
  overflow:hidden;
}
.m07sel-root *{box-sizing:border-box;}

/* ---------- header ---------- */
.m07sel-header{flex:0 0 auto;}
.m07sel-kicker{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.16em; font-weight:600;
  color:var(--m07-blue-deep);
  background:var(--m07-blue-soft);
  display:inline-block; padding:4px 10px; border-radius:999px;
  margin-bottom:8px;
}
.m07sel-title{
  margin:0 0 4px; font-size:23px; line-height:1.15; font-weight:800;
  letter-spacing:-.01em; color:var(--m07-ink);
}
.m07sel-sub{margin:0; font-size:13.5px; line-height:1.5; color:var(--m07-muted); max-width:760px;}
.m07sel-sub b{color:var(--m07-text); font-weight:700;}

/* ---------- body layout ---------- */
.m07sel-body{
  flex:1 1 auto; min-height:0;
  display:grid; grid-template-columns:minmax(0,1fr) 232px; gap:16px;
}
.m07sel-stage{
  min-height:0; min-width:0;
  background:linear-gradient(180deg,#FFFFFF, #FBFCFF);
  border:1px solid var(--m07-border);
  border-radius:16px;
  box-shadow:0 8px 26px rgba(14,19,38,.06);
  display:flex; align-items:center; justify-content:center;
  padding:8px;
}
.m07sel-svg{width:100%; height:100%; display:block;}

/* ---------- side rail ---------- */
.m07sel-rail{display:flex; flex-direction:column; gap:14px; min-width:0;}
.m07sel-selcard{
  background:var(--m07-surface);
  border:1px solid var(--m07-border);
  border-radius:14px; padding:14px;
  box-shadow:0 6px 18px rgba(14,19,38,.05);
}
.m07sel-selrow{display:flex; flex-direction:column; gap:6px; margin-bottom:12px;}
.m07sel-selabel{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.14em; color:var(--m07-muted); font-weight:600;
}
.m07sel-selpos{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:16px; font-weight:700; letter-spacing:.01em;
  color:var(--m07-ink);
  transition:color .3s ease;
}
.m07sel-selpos.a{color:var(--m07-blue-deep);}
.m07sel-selpos.b{color:var(--m07-green);}

.m07sel-flip{
  width:100%;
  display:inline-flex; align-items:center; justify-content:center; gap:8px;
  border:none; cursor:pointer;
  padding:12px 14px; border-radius:11px;
  font-family:var(--font-display,"Inter",sans-serif);
  font-size:14px; font-weight:700; color:#fff;
  background:var(--grad, linear-gradient(135deg,#3B82F6,#7C5CFF));
  box-shadow:0 8px 18px rgba(59,130,246,.30);
  transition:transform .12s ease, box-shadow .2s ease, filter .2s ease;
}
.m07sel-flip:hover{transform:translateY(-1px); box-shadow:0 12px 24px rgba(59,130,246,.38);}
.m07sel-flip:active{transform:translateY(0) scale(.98); filter:brightness(.97);}
.m07sel-flip svg{flex:0 0 auto;}
.m07sel-hint{margin-top:9px; font-size:11px; line-height:1.4; color:var(--m07-muted); text-align:center;}

/* ---------- compare card ---------- */
.m07sel-compare{
  background:var(--m07-surface);
  border:1px solid var(--m07-border);
  border-radius:14px; padding:12px 12px 14px;
  box-shadow:0 6px 18px rgba(14,19,38,.05);
}
.m07sel-cmp-head{
  font-size:12px; font-weight:700; color:var(--m07-ink); text-align:center; margin-bottom:10px;
}
.m07sel-cmp-head span{color:var(--m07-muted); font-weight:600; font-size:11px; padding:0 2px;}
.m07sel-cmp-grid{display:grid; grid-template-columns:1fr 1fr; gap:10px;}
.m07sel-cmp{
  border:1px solid var(--m07-border); border-radius:11px;
  padding:9px 8px 8px; text-align:center; background:#FCFDFF;
}
.m07sel-cmp.double{border-color:#D5E3FF; background:linear-gradient(180deg,#F4F8FF,#FFFFFF);}
.m07sel-cmp-name{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.08em; font-weight:700; color:var(--m07-muted);
  margin-bottom:4px;
}
.m07sel-cmp.double .m07sel-cmp-name{color:var(--m07-blue-deep);}
.m07sel-cmp-foot{font-size:11px; color:var(--m07-muted); margin-top:4px; line-height:1.3;}
.m07sel-mini{width:100%; height:62px; display:block;}

/* mini schematic strokes */
.m07sel-mini-wire,.m07sel-mini-bar{stroke:#9AA4B8; stroke-width:2.4; stroke-linecap:round; fill:none;}
.m07sel-mini-bar{transition:none;}
.m07sel-mini-node{fill:#6B7488;}
.m07sel-mini-tap{fill:#fff; stroke:#9AA4B8; stroke-width:2;}
.m07sel-mini-lamp{fill:#fff; stroke:#C2CADb; stroke-width:2.4; transition:fill .3s,stroke .3s;}
.m07sel-mini-x{font-size:11px; fill:#C2CADb; font-family:var(--font-mono,monospace); transition:fill .3s;}
.m07sel-mini-lamp.on{fill:#FFF6E2; stroke:var(--m07-amber);}
.m07sel-mini-lamp.lampA.on, .m07sel-mini-lamp.single.on{stroke:var(--m07-amber);}
.m07sel-cmp.single .m07sel-mini-lamp{fill:#FFF6E2; stroke:var(--m07-amber);}
.m07sel-cmp.single .m07sel-mini-x{fill:var(--m07-amber);}
.m07sel-mini-tap.a{fill:var(--m07-blue);stroke:var(--m07-blue);}
/* double-throw mini animates between A and B */
.m07sel-cmp.double .m07sel-mini-bar.double{transition:transform .42s cubic-bezier(.34,1.56,.64,1); transform-origin:18px 43px; transform-box:view-box;}
.m07sel-cmp.double .m07sel-mini-lamp.lampA{fill:#FFF6E2; stroke:var(--m07-amber);}
.m07sel-cmp.double .m07sel-mini-x.xA{fill:var(--m07-amber);}
.m07sel-cmp.double.to-b .m07sel-mini-bar.double{transform:rotate(40deg);}
.m07sel-cmp.double.to-b .m07sel-mini-lamp.lampA{fill:#fff; stroke:#C2CADb;}
.m07sel-cmp.double.to-b .m07sel-mini-x.xA{fill:#C2CADb;}
.m07sel-cmp.double.to-b .m07sel-mini-lamp.lampB{fill:#E9FBEF; stroke:var(--m07-green);}
.m07sel-cmp.double.to-b .m07sel-mini-x.xB{fill:var(--m07-green);}
.m07sel-cmp.double .m07sel-mini-tap.a{fill:var(--m07-amber);stroke:var(--m07-amber);}
.m07sel-cmp.double.to-b .m07sel-mini-tap.a{fill:#fff;stroke:#9AA4B8;}
.m07sel-cmp.double.to-b .m07sel-mini-tap.b{fill:var(--m07-green);stroke:var(--m07-green);}

/* ---------- caption ---------- */
.m07sel-caption{
  flex:0 0 auto;
  display:flex; align-items:flex-start; gap:10px;
  background:var(--m07-blue-soft);
  border:1px solid #D9E6FF;
  border-radius:12px; padding:12px 14px;
  font-size:13px; line-height:1.5; color:var(--m07-text);
}
.m07sel-caption b{color:var(--m07-ink); font-weight:700;}
.m07sel-cap-dot{
  flex:0 0 auto; width:9px; height:9px; border-radius:50%; margin-top:4px;
  background:var(--grad, linear-gradient(135deg,#3B82F6,#7C5CFF));
  box-shadow:0 0 0 4px rgba(59,130,246,.14);
}

/* =========================================================================
   SCHEMATIC SVG styling
   ========================================================================= */
.m07sel-board{fill:#FFFFFF; stroke:var(--m07-border); stroke-width:1.5;}

/* wires: default = de-energized grey */
.m07sel-wire{
  fill:none; stroke:#9AA4B8; stroke-width:3.4;
  stroke-linecap:round; stroke-linejoin:round;
  transition:stroke .3s ease, stroke-width .3s ease;
}
.m07sel-wire.supply{stroke:var(--m07-live); stroke-width:3.6;} /* always hot from source */
.m07sel-path .m07sel-wire.branch{stroke:#AEB6C6;}
.m07sel-path.live .m07sel-wire.branch{stroke:var(--m07-live); stroke-width:3.8;}

/* marching-ants flow overlay — only visible on live segments */
.m07sel-flow{
  fill:none; stroke:#FFD0CF; stroke-width:3.6;
  stroke-linecap:round; stroke-dasharray:2 12;
  opacity:.9;
  animation:m07sel-march 1s linear infinite;
}
.m07sel-flow.branch-flow{opacity:0; transition:opacity .25s ease; stroke:#FFE0DF;}
.m07sel-path.live .m07sel-flow.branch-flow{opacity:.95;}
@keyframes m07sel-march{to{stroke-dashoffset:-28;}}

/* nodes / terminals */
.m07sel-node{fill:#fff; stroke:#5B6478; stroke-width:2.4;}
.m07sel-node.common{fill:var(--m07-ink); stroke:var(--m07-ink);}
.m07sel-tap{fill:#fff; stroke:#9AA4B8; stroke-width:2.6; transition:fill .25s ease, stroke .25s ease;}
.m07sel-tap.made{fill:var(--m07-live); stroke:var(--m07-live);}

.m07sel-termlbl{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.06em; fill:var(--m07-muted); font-weight:600;
}
.m07sel-termlbl.com{font-size:11px;}

/* source / battery */
.m07sel-cell{stroke:var(--m07-ink); stroke-linecap:round;}
.m07sel-cell.long{stroke-width:3;}
.m07sel-cell.short{stroke-width:5;}
.m07sel-srctag{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:12px; font-weight:700; fill:var(--m07-ink); letter-spacing:.03em;
}
.m07sel-pol{font-family:var(--font-mono,monospace); font-size:14px; font-weight:800;}
.m07sel-pol.plus{fill:var(--m07-live);}
.m07sel-pol.minus{fill:var(--m07-blue-deep);}

/* wiper (moving selector bar) */
.m07sel-wiper-bar{
  stroke:var(--m07-ink); stroke-width:5; stroke-linecap:round;
}
.m07sel-wiper-tip{fill:var(--m07-ink);}
.m07sel-wiper{will-change:transform;}
.m07sel-wiper-hit:hover ~ .m07sel-wiper .m07sel-wiper-bar{stroke:var(--m07-blue-deep);}
.m07sel-arc{fill:none; stroke:#C7CEDC; stroke-width:1.6; stroke-dasharray:3 6; opacity:.8;}

/* lamps */
.m07sel-lamp-body{fill:#fff; stroke:#C2CADb; stroke-width:3; transition:fill .35s ease, stroke .35s ease;}
.m07sel-lamp-x{stroke:#C2CADb; stroke-width:3; stroke-linecap:round; transition:stroke .35s ease;}
.m07sel-lamp.on .m07sel-lamp-body{fill:#FFF3D6; stroke:var(--m07-amber);}
.m07sel-lamp.on .m07sel-lamp-x{stroke:var(--m07-amber);}
.m07sel-lamp-name{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; font-weight:700; fill:var(--m07-ink); letter-spacing:.04em;
}
.m07sel-lamp-role{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; font-weight:600; letter-spacing:.12em; fill:var(--m07-muted);
}
.m07sel-lamp.on .m07sel-lamp-role{fill:#B45309;}
.m07sel-lampglow{fill:var(--m07-amber); opacity:0; transition:opacity .4s ease;}
.m07sel-lampglow.on{opacity:.34;}

/* legend */
.m07sel-legtxt{font-family:var(--font-mono,monospace); font-size:11px; fill:var(--m07-muted);}
.m07sel-legend .m07sel-wire.live{stroke:var(--m07-live);}

/* responsive: stack rail under stage on narrow stages */
@media (max-width:720px){
  .m07sel-body{grid-template-columns:1fr;}
}
`;
