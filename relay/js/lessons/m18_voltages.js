// =============================================================================
// m18_voltages.js  —  "Why a Plant Has Many Voltages (480/240/120/24)"
//
// A clean, animated ONE-LINE power diagram that steps DOWN the voltage ladder:
//
//     incoming 480VAC ─▶ [transformer] ─▶ 240/120VAC ─▶ [control xfmr / PSU] ─▶ 24V
//
// The learner CLICKS each voltage tier to highlight it and reveal WHAT IT POWERS.
// Transformer symbols animate (energized windings glow + flux ripple) and the
// active feeder run lights up red as current. Caption drives the lesson home:
//   higher voltage moves big power efficiently; lower voltage is safe for logic —
//   that's why a plant runs several at once.
//
// Self-contained ES module. Every class is prefixed `m18v-` so nothing collides.
//   export function render(host) { ... }
// =============================================================================

const NS = "http://www.w3.org/2000/svg";
function S(name, attrs = {}, txt) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}
function H(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

// ---- the voltage ladder (the data that drives everything) ------------------
const TIERS = [
  {
    key: "480",
    volts: "480",
    name: "480 VAC",
    sub: "3-phase · incoming service",
    color: "var(--v-480)",
    badge: "HEAVY POWER",
    headline: "Big 3-phase motors & heaters",
    powers: [
      "Large 3-phase motors (pumps, compressors, conveyors)",
      "Industrial heaters & process heating banks",
      "Anything that needs serious horsepower",
    ],
    why: "High voltage moves big power with smaller current, so wires stay thin and losses stay low. The trade-off: it's lethal and impractical to fuse for tiny loads.",
    danger: 3,
  },
  {
    key: "240",
    volts: "240",
    name: "240 VAC",
    sub: "stepped down · single/3-phase",
    color: "var(--v-240)",
    badge: "WORKHORSE",
    headline: "Heaters, welders & small motors",
    powers: [
      "Heater bands & welders",
      "Smaller single-phase motors & fans",
      "Larger receptacles and shop equipment",
    ],
    why: "A transformer drops 480 V down so mid-size loads don't need a 480 V circuit. Still dangerous, but easier to wire and protect than the incoming service.",
    danger: 2,
  },
  {
    key: "120",
    volts: "120",
    name: "120 VAC",
    sub: "lighting · receptacles · legacy control",
    color: "var(--v-120)",
    badge: "EVERYDAY",
    headline: "Lighting, receptacles & older controls",
    powers: [
      "Plant lighting & wall receptacles",
      "Solenoids, small motors, contactor coils",
      "Legacy (1950s-era) control circuits",
    ],
    why: "Easy to fuse up to ~15 A and familiar to everyone, but it's still a real shock hazard — which is why modern control is moving below it.",
    danger: 1,
  },
  {
    key: "24",
    volts: "24",
    name: "24 VAC / 24 VDC",
    sub: "control transformer & power supply",
    color: "var(--v-24dc)",
    badge: "SAFE LOGIC",
    headline: "PLCs, relays, sensors & HMIs",
    powers: [
      "PLC inputs/outputs & control relays",
      "Sensors, push-buttons & switches",
      "HMI touchscreens & indicator lamps",
    ],
    why: "Under 50 V it's touch-safe, it's the cheapest to wire, and nearly every modern sensor and logic device is built for it. This is where the brains of the plant live.",
    danger: 0,
  },
];

export function render(host) {
  // ----------------------------------------------------------------- styles
  const style = H("style");
  style.textContent = CSS;
  host.appendChild(style);

  const root = H("div", "m18v-root");
  host.appendChild(root);

  // ---- header ----
  const head = H("div", "m18v-head");
  head.appendChild(H("div", "m18v-eyebrow", "ADVANCED · POWER DISTRIBUTION"));
  head.appendChild(H("h2", "m18v-title", "Why a plant runs many voltages"));
  head.appendChild(
    H(
      "p",
      "m18v-lede",
      "One big voltage comes in and gets stepped down into a ladder. Click any tier on the line to light its feeder and see exactly what it powers."
    )
  );
  root.appendChild(head);

  // ---- the one-line diagram (SVG) ----
  const diagram = H("div", "m18v-diagram");
  const svg = buildDiagram();
  diagram.appendChild(svg);
  root.appendChild(diagram);

  // ---- detail / "what it powers" card ----
  const detail = H("div", "m18v-detail");
  root.appendChild(detail);

  // ---- caption ----
  const cap = H("div", "m18v-caption");
  cap.innerHTML =
    '<span class="m18v-cap-icon">⚡</span>' +
    "<span><b>Higher voltage</b> moves big power efficiently (thin wires, low loss). " +
    "<b>Lower voltage</b> is safe and cheap for control &amp; logic. " +
    "No single voltage is good at every job — so the plant runs several at once.</span>";
  root.appendChild(cap);

  // ---------------------------------------------------- interaction wiring
  let active = null;

  function select(key) {
    active = key;
    // SVG highlight state
    svg.querySelectorAll("[data-tier]").forEach((g) => {
      g.classList.toggle("m18v-on", g.getAttribute("data-tier") === key);
    });
    svg.querySelectorAll("[data-feeder]").forEach((p) => {
      p.classList.toggle("m18v-live", p.getAttribute("data-feeder") === key);
    });
    // which transformers are "carrying" up to this tier
    const idx = TIERS.findIndex((t) => t.key === key);
    svg.querySelectorAll("[data-xfmr]").forEach((g) => {
      const xi = Number(g.getAttribute("data-xfmr"));
      g.classList.toggle("m18v-energized", xi <= idx);
    });
    renderDetail(detail, TIERS[idx]);
  }

  // click + keyboard on each tier node
  svg.querySelectorAll("[data-tier]").forEach((g) => {
    const key = g.getAttribute("data-tier");
    g.addEventListener("click", () => select(key));
    g.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        select(key);
      }
      if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
        ev.preventDefault();
        const i = TIERS.findIndex((t) => t.key === active);
        const ni =
          ev.key === "ArrowRight"
            ? Math.min(TIERS.length - 1, i + 1)
            : Math.max(0, i - 1);
        const node = svg.querySelector(`[data-tier="${TIERS[ni].key}"]`);
        node.focus();
        select(TIERS[ni].key);
      }
    });
  });

  // start on the incoming service so the diagram never looks dead
  select("480");
}

// --------------------------------------------------------------- the detail card
function renderDetail(host, tier) {
  host.innerHTML = "";
  host.style.setProperty("--m18v-accent", tier.color);

  const left = H("div", "m18v-d-left");
  const head = H("div", "m18v-d-head");
  const chip = H("div", "m18v-d-chip", tier.name);
  const badge = H("span", "m18v-d-badge", tier.badge);
  head.appendChild(chip);
  head.appendChild(badge);
  left.appendChild(head);
  left.appendChild(H("div", "m18v-d-headline", tier.headline));

  const ul = H("ul", "m18v-d-list");
  tier.powers.forEach((p) => {
    const li = H("li", "m18v-d-li");
    li.appendChild(H("span", "m18v-d-dot"));
    li.appendChild(H("span", null, p));
    ul.appendChild(li);
  });
  left.appendChild(ul);
  host.appendChild(left);

  const right = H("div", "m18v-d-right");
  right.appendChild(H("div", "m18v-d-why-k", "WHY THIS TIER EXISTS"));
  right.appendChild(H("p", "m18v-d-why", tier.why));

  // shock-danger meter
  const meter = H("div", "m18v-d-meter");
  meter.appendChild(H("div", "m18v-d-meter-k", "Shock hazard"));
  const bar = H("div", "m18v-d-bar");
  for (let i = 0; i < 3; i++) {
    const seg = H("span", "m18v-d-seg" + (i < tier.danger ? " m18v-d-seg-on" : ""));
    bar.appendChild(seg);
  }
  meter.appendChild(bar);
  const word =
    tier.danger === 0
      ? "Touch-safe (< 50 V)"
      : tier.danger === 1
      ? "Hazardous"
      : tier.danger === 2
      ? "Dangerous"
      : "Lethal";
  meter.appendChild(H("div", "m18v-d-meter-w" + (tier.danger === 0 ? " m18v-safe" : ""), word));
  right.appendChild(meter);
  host.appendChild(right);

  // gentle entrance animation
  host.classList.remove("m18v-pop");
  // force reflow so the animation re-triggers
  void host.offsetWidth;
  host.classList.add("m18v-pop");
}

// --------------------------------------------------------------- the SVG diagram
function buildDiagram() {
  const W = 860,
    Hh = 250;
  const svg = S("svg", {
    class: "m18v-svg",
    viewBox: `0 0 ${W} ${Hh}`,
    preserveAspectRatio: "xMidYMid meet",
    role: "group",
    "aria-label": "One-line power diagram stepping voltage down",
  });

  // defs: arrow marker + soft glow
  const defs = S("defs");
  const glow = S("filter", { id: "m18v-glow", x: "-40%", y: "-40%", width: "180%", height: "180%" });
  glow.appendChild(S("feGaussianBlur", { stdDeviation: "3.4", result: "b" }));
  const merge = S("feMerge");
  merge.appendChild(S("feMergeNode", { in: "b" }));
  merge.appendChild(S("feMergeNode", { in: "SourceGraphic" }));
  glow.appendChild(merge);
  defs.appendChild(glow);
  svg.appendChild(defs);

  // baseline geometry: tiers sit on a horizontal bus, transformers between them
  const railY = 96;
  const xs = { "480": 78, "240": 300, "120": 522, "24": 760 };
  const xfmrX = [189, 411, 641]; // between 480-240, 240-120, 120-24

  // ---------- inert backbone bus (slate, drawn first so live runs sit on top) ----
  for (let i = 0; i < TIERS.length - 1; i++) {
    const a = TIERS[i].key,
      b = TIERS[i + 1].key;
    svg.appendChild(
      S("line", {
        class: "m18v-bus",
        x1: xs[a] + 46,
        y1: railY,
        x2: xs[b] - 46,
        y2: railY,
      })
    );
  }

  // ---------- LIVE feeder overlay: one continuous path per selected tier -------
  // For tier k we light the run from the incoming service all the way to k.
  TIERS.forEach((t, idx) => {
    const endX = xs[t.key];
    const d = `M ${xs["480"]} ${railY} L ${endX} ${railY}`;
    const live = S("path", {
      class: "m18v-feeder",
      "data-feeder": t.key,
      d,
      fill: "none",
    });
    svg.appendChild(live);
  });

  // ---------- transformers (the step-down symbols) -----------------------------
  xfmrX.forEach((x, i) => svg.appendChild(transformer(x, railY, i)));

  // ---------- incoming service mark (utility) ----------------------------------
  const inc = S("g", { class: "m18v-incoming" });
  inc.appendChild(S("line", { class: "m18v-bus", x1: 24, y1: railY, x2: 78, y2: railY }));
  inc.appendChild(S("circle", { class: "m18v-util", cx: 24, cy: railY, r: 11 }));
  inc.appendChild(S("path", { class: "m18v-util-wave", d: "M 18 96 q 3 -6 6 0 q 3 6 6 0" }));
  inc.appendChild(S("text", { class: "m18v-util-lbl", x: 6, y: railY + 30 }, "UTILITY"));
  svg.appendChild(inc);

  // ---------- tier nodes (clickable) -------------------------------------------
  TIERS.forEach((t) => svg.appendChild(tierNode(t, xs[t.key], railY)));

  return svg;
}

// a clean rectangular transformer symbol (two coupled windings + core)
function transformer(x, y, index) {
  const g = S("g", { class: "m18v-xfmr", "data-xfmr": String(index + 1), transform: `translate(${x},${y})` });

  // primary + secondary winding bumps drawn as arcs, core bar between them
  const prim = S("path", { class: "m18v-wind m18v-wind-p", d: windPath(-16) });
  const sec = S("path", { class: "m18v-wind m18v-wind-s", d: windPath(16) });
  g.appendChild(S("line", { class: "m18v-core", x1: 0, y1: -22, x2: 0, y2: 22 }));
  g.appendChild(S("line", { class: "m18v-core", x1: 3, y1: -22, x2: 3, y2: 22 }));
  g.appendChild(prim);
  g.appendChild(sec);

  // connection stubs into the bus
  g.appendChild(S("line", { class: "m18v-stub", x1: -46, y1: 0, x2: -28, y2: 0 }));
  g.appendChild(S("line", { class: "m18v-stub", x1: 28, y1: 0, x2: 46, y2: 0 }));

  // flux ripple (animates when energized)
  const flux = S("g", { class: "m18v-flux" });
  flux.appendChild(S("path", { class: "m18v-flux-arc", d: "M -2 -19 A 16 16 0 0 1 -2 19" }));
  flux.appendChild(S("path", { class: "m18v-flux-arc", d: "M 5 -19 A 16 16 0 0 0 5 19" }));
  g.appendChild(flux);

  // step-down tag
  g.appendChild(
    S("text", { class: "m18v-xfmr-lbl", x: 0, y: -34, "text-anchor": "middle" }, index === 2 ? "CONTROL XFMR / PSU" : "STEP-DOWN")
  );
  return g;

  function windPath(off) {
    // three little half-circle bumps stacked vertically — classic winding glyph
    const r = 7;
    let d = `M ${off} -22`;
    for (let k = 0; k < 3; k++) {
      const yTop = -22 + k * 15;
      const sweep = off < 0 ? 0 : 1;
      d += ` A ${r} ${r} 0 0 ${sweep} ${off} ${yTop + 14}`;
    }
    return d;
  }
}

// a clickable voltage tier: vertical drop + value chip + caption
function tierNode(t, x, railY) {
  const g = S("g", {
    class: "m18v-tier",
    "data-tier": t.key,
    tabindex: "0",
    role: "button",
    "aria-label": `${t.name} — ${t.headline}`,
  });
  g.style.setProperty("--m18v-tier-color", t.color);

  // drop line from bus down to the chip
  const chipY = railY + 54;
  g.appendChild(S("line", { class: "m18v-drop", x1: x, y1: railY, x2: x, y2: chipY - 26 }));
  g.appendChild(S("circle", { class: "m18v-tap", cx: x, cy: railY, r: 6 }));

  // value chip
  const cw = 96,
    ch = 52;
  g.appendChild(S("rect", { class: "m18v-chip", x: x - cw / 2, y: chipY - 26, width: cw, height: ch, rx: 12 }));
  g.appendChild(S("rect", { class: "m18v-chip-bar", x: x - cw / 2, y: chipY - 26, width: 6, height: ch, rx: 3 }));
  g.appendChild(S("text", { class: "m18v-chip-v", x: x + 4, y: chipY, "text-anchor": "middle" }, t.volts));
  g.appendChild(S("text", { class: "m18v-chip-u", x: x + 4, y: chipY + 16, "text-anchor": "middle" }, t.key === "24" ? "VAC / VDC" : "VAC"));

  // small caption under the chip — x clamped so edge-tier captions never
  // spill past the 860-unit viewBox at the larger (readable) font size
  g.appendChild(S("text", { class: "m18v-tier-sub", x: Math.max(112, Math.min(748, x)), y: chipY + 44, "text-anchor": "middle" }, t.sub));

  // pulse ring used on selection
  g.appendChild(S("circle", { class: "m18v-ring", cx: x, cy: railY, r: 6 }));
  return g;
}

// --------------------------------------------------------------------- styles
const CSS = `
.m18v-root{
  box-sizing:border-box; width:100%; height:100%;
  display:flex; flex-direction:column; gap:14px;
  padding:22px 26px 20px; overflow:auto;
  font-family:var(--font-display,"Inter",system-ui,sans-serif);
  color:var(--text,#303749);
  background:
    radial-gradient(1200px 420px at 12% -10%, rgba(59,130,246,.06), transparent 60%),
    radial-gradient(900px 360px at 96% 0%, rgba(124,92,255,.06), transparent 55%);
}
.m18v-root *{ box-sizing:border-box; }

/* ---------- header ---------- */
.m18v-eyebrow{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.16em; font-weight:600;
  color:var(--blue-deep,#2563EB); margin-bottom:4px;
}
.m18v-title{
  margin:0; font-size:25px; line-height:1.1; font-weight:800;
  letter-spacing:-.01em; color:var(--ink,#0E1326);
}
.m18v-lede{
  margin:6px 0 0; max-width:680px; font-size:13.5px; line-height:1.5;
  color:var(--muted,#6B7488);
}

/* ---------- diagram ---------- */
.m18v-diagram{
  background:var(--surface,#fff);
  border:1px solid var(--border,#E6EAF3);
  border-radius:18px;
  box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
  padding:10px 16px 4px;
}
.m18v-svg{ width:100%; height:auto; display:block; }

/* backbone bus + incoming */
.m18v-bus{ stroke:var(--wire-rest,#94A3B8); stroke-width:3.5; stroke-linecap:round; }
.m18v-util{ fill:var(--surface,#fff); stroke:var(--wire-rest,#94A3B8); stroke-width:3; }
.m18v-util-wave{ fill:none; stroke:var(--muted,#6B7488); stroke-width:1.6; stroke-linecap:round; }
.m18v-util-lbl{
  font-family:var(--font-mono,monospace); font-size:12.5px; font-weight:600;
  letter-spacing:.1em; fill:var(--muted,#6B7488);
}

/* live feeder — only the selected tier's run is shown */
.m18v-feeder{
  stroke:var(--live,#EF4444); stroke-width:4.5; stroke-linecap:round;
  opacity:0; stroke-dasharray:10 14; filter:url(#m18v-glow);
  transition:opacity .28s ease;
}
.m18v-feeder.m18v-live{ opacity:1; animation:m18v-flow var(--flow-ms,850ms) linear infinite; }
@keyframes m18v-flow{ to{ stroke-dashoffset:-48; } }

/* ---------- transformers ---------- */
.m18v-core{ stroke:var(--border-strong,#D6DDEC); stroke-width:2.4; stroke-linecap:round; transition:stroke .3s ease; }
.m18v-wind{ fill:none; stroke:var(--contact-open,#94A3B8); stroke-width:2.6; transition:stroke .3s ease; }
.m18v-stub{ stroke:var(--wire-rest,#94A3B8); stroke-width:3.2; stroke-linecap:round; }
.m18v-xfmr-lbl{
  font-family:var(--font-mono,monospace); font-size:12.5px; font-weight:600;
  letter-spacing:.08em; fill:var(--muted,#6B7488);
}
.m18v-flux{ opacity:0; transition:opacity .3s ease; }
.m18v-flux-arc{ fill:none; stroke:var(--violet,#7C5CFF); stroke-width:1.6; stroke-linecap:round; }

.m18v-xfmr.m18v-energized .m18v-wind{ stroke:var(--violet,#7C5CFF); }
.m18v-xfmr.m18v-energized .m18v-core{ stroke:var(--violet-deep,#6D28D9); }
.m18v-xfmr.m18v-energized .m18v-stub{ stroke:var(--live,#EF4444); }
.m18v-xfmr.m18v-energized .m18v-flux{ opacity:.9; animation:m18v-pulse var(--coil-pulse-ms,1100ms) ease-in-out infinite; }
@keyframes m18v-pulse{ 0%,100%{ opacity:.35; } 50%{ opacity:.95; } }

/* ---------- tier nodes ---------- */
.m18v-tier{ cursor:pointer; outline:none; }
.m18v-tier.m18v-on{ cursor:default; }
.m18v-drop{ stroke:var(--wire-rest,#94A3B8); stroke-width:3; stroke-linecap:round; transition:stroke .25s ease; }
.m18v-tap{ fill:var(--surface,#fff); stroke:var(--wire-rest,#94A3B8); stroke-width:2.6; transition:all .25s ease; }
.m18v-chip{
  fill:var(--surface,#fff); stroke:var(--border-strong,#D6DDEC); stroke-width:1.6;
  transition:all .28s cubic-bezier(.2,.8,.2,1);
}
.m18v-chip-bar{ fill:var(--m18v-tier-color,#3B82F6); opacity:.55; transition:opacity .25s ease; }
.m18v-chip-v{
  font-family:var(--font-mono,monospace); font-weight:800; font-size:24px;
  fill:var(--ink,#0E1326); transition:fill .25s ease;
}
.m18v-chip-u{
  font-family:var(--font-mono,monospace); font-weight:600; font-size:12.5px;
  letter-spacing:.06em; fill:var(--muted,#6B7488);
}
.m18v-tier-sub{
  font-family:var(--font-display,"Inter",sans-serif); font-size:12.5px; font-weight:500;
  fill:var(--muted,#6B7488);
}
.m18v-ring{ fill:none; stroke:var(--m18v-tier-color,#3B82F6); stroke-width:2.4; opacity:0; }

/* hover affordance */
.m18v-tier:hover .m18v-chip{ stroke:var(--m18v-tier-color,#3B82F6); transform:translateY(-2px); }
.m18v-tier:hover .m18v-chip-bar{ opacity:1; }
.m18v-tier:focus-visible .m18v-chip{ stroke:var(--m18v-tier-color,#3B82F6); }
.m18v-tier:focus-visible .m18v-ring{ opacity:.5; }

/* selected tier */
.m18v-tier.m18v-on .m18v-chip{
  stroke:var(--m18v-tier-color,#3B82F6); stroke-width:2.6;
  filter:drop-shadow(0 6px 16px rgba(16,19,38,.16));
}
.m18v-tier.m18v-on .m18v-chip-bar{ opacity:1; }
.m18v-tier.m18v-on .m18v-chip-v{ fill:var(--m18v-tier-color,#3B82F6); }
.m18v-tier.m18v-on .m18v-drop{ stroke:var(--live,#EF4444); }
.m18v-tier.m18v-on .m18v-tap{ fill:var(--live,#EF4444); stroke:var(--live,#EF4444); }
.m18v-tier.m18v-on .m18v-ring{ animation:m18v-ring 1.6s ease-out infinite; }
@keyframes m18v-ring{
  0%{ opacity:.55; r:6; } 70%{ opacity:0; r:20; } 100%{ opacity:0; r:20; }
}

/* ---------- detail card ---------- */
.m18v-detail{
  --m18v-accent:var(--blue,#3B82F6);
  display:grid; grid-template-columns:1.25fr 1fr; gap:18px;
  background:var(--surface,#fff);
  border:1px solid var(--border,#E6EAF3);
  border-left:5px solid var(--m18v-accent);
  border-radius:16px; padding:16px 20px;
  box-shadow:var(--shadow-sm,0 1px 3px rgba(16,19,38,.05));
}
.m18v-detail.m18v-pop{ animation:m18v-pop .34s cubic-bezier(.2,.8,.2,1); }
@keyframes m18v-pop{ from{ opacity:.3; transform:translateY(6px); } to{ opacity:1; transform:none; } }

.m18v-d-head{ display:flex; align-items:center; gap:10px; margin-bottom:8px; }
.m18v-d-chip{
  font-family:var(--font-mono,monospace); font-weight:800; font-size:15px;
  color:var(--m18v-accent); letter-spacing:.01em;
}
.m18v-d-badge{
  font-family:var(--font-mono,monospace); font-size:11px; font-weight:700;
  letter-spacing:.1em; color:#fff; background:var(--m18v-accent);
  padding:3px 8px; border-radius:999px;
}
.m18v-d-headline{
  font-size:16px; font-weight:700; color:var(--ink,#0E1326);
  line-height:1.25; margin-bottom:10px;
}
.m18v-d-list{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:7px; }
.m18v-d-li{
  display:flex; align-items:flex-start; gap:9px;
  font-size:13px; line-height:1.4; color:var(--text,#303749);
}
.m18v-d-dot{
  flex:0 0 auto; width:7px; height:7px; margin-top:6px; border-radius:50%;
  background:var(--m18v-accent);
  box-shadow:0 0 0 3px color-mix(in srgb, var(--m18v-accent) 18%, transparent);
}

.m18v-d-right{ display:flex; flex-direction:column; gap:10px; }
.m18v-d-why-k,.m18v-d-meter-k{
  font-family:var(--font-mono,monospace); font-size:11px; font-weight:700;
  letter-spacing:.12em; color:var(--muted,#6B7488);
}
.m18v-d-why{
  margin:2px 0 0; font-size:12.5px; line-height:1.5; color:var(--text,#303749);
}
.m18v-d-meter{
  margin-top:auto; padding-top:8px; border-top:1px dashed var(--border,#E6EAF3);
  display:flex; flex-direction:column; gap:5px;
}
.m18v-d-bar{ display:flex; gap:5px; }
.m18v-d-seg{
  flex:1; height:8px; border-radius:4px; background:var(--border,#E6EAF3);
  transition:background .3s ease;
}
.m18v-d-seg-on{ background:var(--live,#EF4444); }
.m18v-d-meter-w{
  font-size:12px; font-weight:700; color:var(--live-label,#DC2626);
}
.m18v-d-meter-w.m18v-safe{ color:var(--success,#10B981); }

/* ---------- caption ---------- */
.m18v-caption{
  display:flex; align-items:center; gap:12px;
  background:linear-gradient(135deg, rgba(59,130,246,.08), rgba(124,92,255,.08));
  border:1px solid var(--border,#E6EAF3); border-radius:14px;
  padding:12px 16px; font-size:13px; line-height:1.5; color:var(--text,#303749);
}
.m18v-caption b{ color:var(--ink,#0E1326); }
.m18v-cap-icon{
  flex:0 0 auto; display:grid; place-items:center;
  width:30px; height:30px; border-radius:9px; font-size:16px;
  background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); color:#fff;
  box-shadow:var(--shadow-blue,0 10px 34px -10px rgba(59,130,246,.4));
}

@media (max-width:760px){
  .m18v-detail{ grid-template-columns:1fr; }
}
@media (prefers-reduced-motion: reduce){
  .m18v-feeder.m18v-live,
  .m18v-xfmr.m18v-energized .m18v-flux,
  .m18v-tier.m18v-on .m18v-ring{ animation:none; }
}
`;
