// =============================================================================
// m20_voltage_ladder.js — "Walking Down the Voltage Ladder: What Each Voltage
// Is For" (module m20-walking-down-the-ladder).
//
// A VERTICAL ladder of voltage tiers, top (480VAC) to bottom (24VDC). The
// learner clicks a rung — or hits "Walk down" to step one rung at a time — to
// light it up and open a detail card showing WHAT LIVES THERE and ITS JOB, plus
// concrete loads, shock danger, sensor availability and fuse ease. A glowing
// "safe line" marks the below-50V touch-safe zone so the descent lands on
// 24VDC as the modern standard.
//
// Self-contained ES module. Every class is prefixed `m20vl-`. No imports.
// =============================================================================

export function render(host) {
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---- the ladder data (top rung first = highest voltage) -------------------
  const RUNGS = [
    {
      key: "480",
      volts: "480",
      unit: "VAC",
      name: "480 Volts AC",
      tagline: "The heavy lifting",
      job: "Move BIG power into big machines. This is where the real horsepower lives — it does the plant's hardest work.",
      loads: ["Large 3-phase motors", "Conveyor & pump drives", "Heavy heaters / ovens"],
      danger: "extreme",
      dangerNote: "Lethal. Arc-flash territory — never probe casually.",
      sensors: "Almost none made for it",
      fuse: "Hard to fuse small loads",
      safe: false,
      accent: "#EF4444",
    },
    {
      key: "240",
      volts: "240",
      unit: "VAC",
      name: "240 Volts AC",
      tagline: "Mid-size muscle",
      job: "Run the larger single-phase loads — things too hungry for 120V but not full 3-phase motors.",
      loads: ["Heater bands", "Welders", "Large fans / blowers"],
      danger: "high",
      dangerNote: "Still very dangerous. A shock here can kill.",
      sensors: "Very few made for it",
      fuse: "Fusing still awkward",
      safe: false,
      accent: "#F97316",
    },
    {
      key: "120",
      volts: "120",
      unit: "VAC",
      name: "120 Volts AC",
      tagline: "“Now you’re talking”",
      job: "The classic control & utility level — easy fuses up to ~15A, the home of legacy controls, lights and outlets.",
      loads: ["Solenoids & small motors", "Control relays (older)", "Lights & receptacles"],
      danger: "moderate",
      dangerNote: "Still a real shock hazard — a 1950s approach industry is leaving.",
      sensors: "Some, but fading",
      fuse: "Easy to fuse (cheap 15A)",
      safe: false,
      accent: "#EAB308",
    },
    {
      key: "24ac",
      volts: "24",
      unit: "VAC",
      name: "24 Volts AC",
      tagline: "The comfort level",
      job: "A low-voltage AC tier kept around mostly for HVAC controls — thermostats, damper actuators, gas valves.",
      loads: ["HVAC controls", "Thermostats", "Damper / valve actuators"],
      danger: "safe",
      dangerNote: "Under 50V — touch-safe.",
      sensors: "HVAC-specific",
      fuse: "Easy to fuse",
      safe: true,
      accent: "#22C55E",
    },
    {
      key: "24dc",
      volts: "24",
      unit: "VDC",
      name: "24 Volts DC",
      tagline: "The modern standard",
      job: "Where nearly ALL modern logic lives. Safe, cheapest to wire, and what today's sensors, switches and PLCs expect.",
      loads: ["PLCs & I/O", "Control relays", "Sensors, switches & HMIs"],
      danger: "safe",
      dangerNote: "Under 50V — touch-safe. This is the standard you'll work in most.",
      sensors: "Almost everything modern",
      fuse: "Easy & cheap to fuse",
      safe: true,
      accent: "#3B82F6",
      star: true,
    },
  ];

  // ---------------------------------------------------------------- style
  const style = document.createElement("style");
  style.textContent = `
  .m20vl-root{
    --m20vl-accent:#3B82F6;
    position:absolute; inset:0; display:flex; flex-direction:column;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--text,#303749);
    background:
      radial-gradient(1100px 460px at 80% -10%, rgba(124,92,255,.07), transparent 60%),
      radial-gradient(900px 420px at 8% 108%, rgba(59,130,246,.08), transparent 60%),
      var(--bg,#F6F8FC);
    overflow:hidden;
  }
  .m20vl-head{ padding:20px 26px 12px; flex:0 0 auto; }
  .m20vl-kicker{
    font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--blue-deep,#2563EB); display:flex; align-items:center; gap:9px;
  }
  .m20vl-kicker::before{ content:""; width:26px; height:2px; border-radius:2px;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); }
  .m20vl-title{
    margin:7px 0 3px; font-weight:800; font-size:25px; letter-spacing:-.025em;
    line-height:1.08; color:var(--ink,#0E1326);
  }
  .m20vl-sub{ font-size:13px; color:var(--muted,#6B7488); max-width:560px; line-height:1.45; }

  .m20vl-body{ flex:1 1 auto; display:flex; gap:22px; padding:6px 26px 22px; min-height:0; }

  /* ---- ladder column ---- */
  .m20vl-ladder{ flex:0 0 318px; position:relative; min-height:0;
    display:flex; flex-direction:column; }
  .m20vl-svgwrap{ flex:1 1 auto; min-height:0; }
  .m20vl-svgwrap svg{ width:100%; height:100%; display:block; overflow:visible; }

  .m20vl-rail{ stroke:#C2CCE0; stroke-width:5; stroke-linecap:round; }
  .m20vl-rung-hit{ cursor:pointer; }
  /* the rung is one click target — its child shapes/text must not be
     independently hit-testable (that made sub-elements read as separate
     "dead" clickables even though the parent handles everything) */
  .m20vl-rung-hit > *{ pointer-events:none; cursor:default; }
  .m20vl-rung-plate{
    fill:#FFFFFF; stroke:#E0E6F2; stroke-width:1.5;
    transition:fill .35s ease, stroke .35s ease, transform .35s cubic-bezier(.2,.8,.25,1);
    transform-box:fill-box; transform-origin:center; filter:drop-shadow(0 4px 10px rgba(20,30,60,.06));
  }
  .m20vl-rung-hit:hover .m20vl-rung-plate{ stroke:#B9C6E4; transform:translateX(3px); }
  .m20vl-rung-volts{
    font-family:var(--font-mono,"JetBrains Mono",monospace); font-weight:700;
    fill:var(--ink,#0E1326); transition:fill .35s ease;
  }
  .m20vl-rung-unit{
    font-family:var(--font-mono,"JetBrains Mono",monospace); font-weight:600;
    font-size:12px; fill:var(--muted,#6B7488); letter-spacing:.06em; transition:fill .35s ease;
  }
  .m20vl-rung-tag{
    font-family:var(--font-display,"Inter",sans-serif); font-weight:600; font-size:12px;
    fill:var(--muted,#6B7488); transition:fill .35s ease;
  }
  .m20vl-dot{ transition:fill .35s ease, r .35s ease; }
  .m20vl-rung-hit.is-active{ cursor:default; }
  .m20vl-step{ /* the little walker pip */
    fill:var(--violet,#7C5CFF); filter:drop-shadow(0 0 6px rgba(124,92,255,.65));
    transition:transform .55s cubic-bezier(.34,1.4,.5,1), opacity .3s ease;
    transform-box:view-box;
  }

  /* active rung lights up */
  .m20vl-rung-hit.is-active .m20vl-rung-plate{
    fill:var(--rung-accent); stroke:var(--rung-accent);
    transform:translateX(6px) scale(1.015);
    filter:drop-shadow(0 8px 20px var(--rung-glow));
  }
  .m20vl-rung-hit.is-active .m20vl-rung-volts,
  .m20vl-rung-hit.is-active .m20vl-rung-unit,
  .m20vl-rung-hit.is-active .m20vl-rung-tag{ fill:#FFFFFF; }
  .m20vl-rung-hit.is-active .m20vl-dot{ fill:#FFFFFF; }

  /* the safe-zone band behind the lower rungs */
  .m20vl-safeband{ fill:rgba(34,197,94,.10); }
  .m20vl-safeline{ stroke:#22C55E; stroke-width:2; stroke-dasharray:7 5; }
  .m20vl-safelabel{
    font-family:var(--font-mono,"JetBrains Mono",monospace); font-size:11.5px;
    letter-spacing:.06em; text-transform:uppercase; fill:#15803D; font-weight:700;
  }

  /* ---- detail card column ---- */
  .m20vl-detail{ flex:1 1 auto; min-width:0; display:flex; flex-direction:column; }
  .m20vl-card{
    flex:1 1 auto; background:var(--surface,#fff);
    border:1px solid var(--border,#E6EAF3); border-radius:18px;
    box-shadow:0 14px 36px rgba(20,30,60,.08);
    padding:0; overflow:hidden; display:flex; flex-direction:column;
    position:relative; min-height:0;
  }
  .m20vl-card-top{
    padding:18px 22px 16px; color:#fff; position:relative;
    background:linear-gradient(135deg, var(--rung-accent), color-mix(in srgb, var(--rung-accent) 62%, #1A1F36));
    transition:background .4s ease;
  }
  .m20vl-card-top::after{ content:""; position:absolute; inset:0;
    background:radial-gradient(360px 120px at 88% -30%, rgba(255,255,255,.28), transparent 70%); pointer-events:none; }
  .m20vl-badgerow{ display:flex; align-items:center; gap:12px; }
  .m20vl-bignum{
    font-family:var(--font-mono,"JetBrains Mono",monospace); font-weight:800;
    font-size:46px; line-height:.9; letter-spacing:-.02em; color:#fff;
  }
  .m20vl-bignum small{ font-size:17px; font-weight:700; opacity:.92; margin-left:3px; letter-spacing:.04em; }
  .m20vl-cardname{ font-weight:800; font-size:17px; letter-spacing:-.01em; }
  .m20vl-cardtag{ font-size:12px; opacity:.92; margin-top:1px; }
  .m20vl-star{
    margin-left:auto; font-family:var(--font-mono,monospace); font-size:11px; font-weight:700;
    letter-spacing:.1em; text-transform:uppercase; background:rgba(255,255,255,.22);
    border:1px solid rgba(255,255,255,.45); padding:5px 10px; border-radius:999px; white-space:nowrap;
  }
  .m20vl-job{
    padding:15px 22px 4px; font-size:14px; line-height:1.5; color:var(--text,#303749);
  }
  .m20vl-job b{ color:var(--ink,#0E1326); }

  .m20vl-loads{ padding:10px 22px 6px; }
  .m20vl-loads-h, .m20vl-stats-h{
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.1em;
    text-transform:uppercase; color:var(--muted,#6B7488); margin-bottom:8px;
  }
  .m20vl-chips{ display:flex; flex-wrap:wrap; gap:8px; }
  .m20vl-chip{
    display:inline-flex; align-items:center; gap:7px; font-size:12.5px; font-weight:600;
    color:var(--ink,#0E1326); background:var(--blue-soft,#EAF1FE);
    border:1px solid color-mix(in srgb, var(--rung-accent) 28%, #fff);
    padding:7px 12px; border-radius:10px;
    opacity:0; transform:translateY(6px); animation:m20vl-pop .42s cubic-bezier(.2,.8,.25,1) forwards;
  }
  .m20vl-chip .m20vl-dotmark{ width:7px; height:7px; border-radius:50%; background:var(--rung-accent); flex:0 0 auto; }
  @keyframes m20vl-pop{ to{ opacity:1; transform:none; } }

  .m20vl-stats{ margin-top:auto; padding:12px 22px 18px;
    display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .m20vl-stat{
    background:var(--bg,#F6F8FC); border:1px solid var(--border,#E6EAF3);
    border-radius:12px; padding:10px 13px;
  }
  .m20vl-stat-k{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.08em;
    text-transform:uppercase; color:var(--muted,#6B7488); }
  .m20vl-stat-v{ font-size:13px; font-weight:700; color:var(--ink,#0E1326); margin-top:3px; }
  .m20vl-danger-pill{ display:inline-flex; align-items:center; gap:6px; }
  .m20vl-danger-pill .m20vl-bar{ width:34px; height:6px; border-radius:3px; background:#E6EAF3; position:relative; overflow:hidden; }
  .m20vl-danger-pill .m20vl-bar i{ position:absolute; inset:0 100% 0 0; border-radius:3px;
    transition:right .5s cubic-bezier(.2,.8,.25,1); }

  /* ---- controls ---- */
  .m20vl-controls{ display:flex; align-items:center; gap:12px; margin-top:14px; flex:0 0 auto; }
  .m20vl-walk{
    border:none; cursor:pointer; font-family:var(--font-display,"Inter",sans-serif);
    font-weight:700; font-size:13.5px; color:#fff; padding:11px 20px; border-radius:12px;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    box-shadow:0 8px 20px rgba(59,130,246,.32); transition:transform .15s ease, box-shadow .2s ease, filter .2s ease;
    display:inline-flex; align-items:center; gap:9px;
  }
  .m20vl-walk:hover{ transform:translateY(-1px); box-shadow:0 11px 26px rgba(59,130,246,.4); }
  .m20vl-walk:active{ transform:translateY(0); }
  .m20vl-walk:disabled{ filter:grayscale(.5) opacity(.55); cursor:default; box-shadow:none; transform:none; }
  .m20vl-walk svg{ width:15px; height:15px; }
  .m20vl-reset{
    border:1px solid var(--border,#E6EAF3); background:var(--surface,#fff); cursor:pointer;
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.1em; text-transform:uppercase;
    color:var(--muted,#6B7488); padding:10px 15px; border-radius:11px; transition:all .18s ease;
  }
  .m20vl-reset:hover{ color:var(--blue-deep,#2563EB); border-color:rgba(59,130,246,.4); background:var(--blue-soft,#EAF1FE); }
  .m20vl-progress{
    margin-left:auto; font-family:var(--font-mono,monospace); font-size:11px;
    color:var(--muted,#6B7488); display:flex; align-items:center; gap:7px;
  }
  .m20vl-progress b{ color:var(--ink,#0E1326); }
  `;
  host.appendChild(style);

  // ---------------------------------------------------------------- DOM scaffold
  const root = document.createElement("div");
  root.className = "m20vl-root";
  host.appendChild(root);

  root.innerHTML = `
    <div class="m20vl-head">
      <div class="m20vl-kicker">Advanced &middot; the voltage ladder</div>
      <h2 class="m20vl-title">Walking down the voltage ladder</h2>
      <div class="m20vl-sub">One incoming voltage is stepped down into a ladder of tiers.
        Step down each rung to see <b>what lives there</b> and <b>the job it does</b> &mdash; landing on 24VDC, the modern safe standard.</div>
    </div>
    <div class="m20vl-body">
      <div class="m20vl-detail">
        <div class="m20vl-card" id="m20vl-card"></div>
        <div class="m20vl-controls">
          <button class="m20vl-walk" id="m20vl-walk">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>
            <span id="m20vl-walk-lbl">Walk down a rung</span>
          </button>
          <button class="m20vl-reset" id="m20vl-reset">Back to top</button>
          <div class="m20vl-progress">rung <b id="m20vl-step-n">1</b> / ${RUNGS.length}</div>
        </div>
      </div>
      <div class="m20vl-ladder">
        <div class="m20vl-svgwrap" id="m20vl-svgwrap"></div>
      </div>
    </div>
  `;

  // swap left/right: ladder on LEFT, card on RIGHT reads more naturally for a
  // "walk down" — reorder via flex.
  const body = root.querySelector(".m20vl-body");
  const ladderCol = root.querySelector(".m20vl-ladder");
  const detailCol = root.querySelector(".m20vl-detail");
  body.insertBefore(ladderCol, detailCol);

  // ---------------------------------------------------------------- build SVG ladder
  const VB_W = 318, VB_H = 470;
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  root.querySelector("#m20vl-svgwrap").appendChild(svg);

  const mk = (n, a = {}, txt) => {
    const e = document.createElementNS(SVGNS, n);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    if (txt != null) e.textContent = txt;
    return e;
  };

  const railL = 70, railR = 248;     // ladder rail x-positions
  const topY = 40, botY = VB_H - 30;
  const n = RUNGS.length;
  const gap = (botY - topY) / (n - 1);
  const rungY = (i) => topY + i * gap;

  // safe-zone band: behind all rungs whose .safe === true (the lowest ones).
  const firstSafe = RUNGS.findIndex((r) => r.safe);
  if (firstSafe >= 0) {
    const bandTop = rungY(firstSafe) - gap * 0.5;
    svg.appendChild(mk("rect", {
      class: "m20vl-safeband", x: railL - 28, y: bandTop,
      width: (railR - railL) + 56, height: botY - bandTop + 22, rx: 14,
    }));
    svg.appendChild(mk("line", {
      class: "m20vl-safeline", x1: railL - 28, y1: bandTop, x2: railR + 28, y2: bandTop,
    }));
    svg.appendChild(mk("text", {
      class: "m20vl-safelabel", x: railR + 26, y: bandTop - 7, "text-anchor": "end",
    }, "↓ below 50V · touch-safe"));
  }

  // the two vertical rails
  svg.appendChild(mk("line", { class: "m20vl-rail", x1: railL, y1: topY - 14, x2: railL, y2: botY + 14 }));
  svg.appendChild(mk("line", { class: "m20vl-rail", x1: railR, y1: topY - 14, x2: railR, y2: botY + 14 }));

  // a moving "walker" pip that rides down the left rail
  const walker = mk("circle", { class: "m20vl-step", cx: railL, cy: rungY(0), r: 6 });
  svg.appendChild(walker);

  // build each rung
  const rungEls = [];
  RUNGS.forEach((r, i) => {
    const y = rungY(i);
    const g = mk("g", { class: "m20vl-rung-hit" });
    g.style.setProperty("--rung-accent", r.accent);
    g.style.setProperty("--rung-glow", hexA(r.accent, 0.4));

    // connecting rung line between the rails (the "step")
    g.appendChild(mk("line", {
      class: "m20vl-rail", x1: railL, y1: y, x2: railR, y2: y,
      "stroke-width": 3, opacity: 0.55,
    }));
    // end dots on the rails
    g.appendChild(mk("circle", { class: "m20vl-dot", cx: railL, cy: y, r: 4.5, fill: "#C2CCE0" }));

    // the plate (the clickable label tile sitting on the rung)
    const pw = 150, ph = 46, px = (railL + railR) / 2 - pw / 2, py = y - ph / 2;
    g.appendChild(mk("rect", { class: "m20vl-rung-plate", x: px, y: py, width: pw, height: ph, rx: 11 }));

    // voltage number
    g.appendChild(mk("text", {
      class: "m20vl-rung-volts", x: px + 16, y: y + 3, "font-size": 21, "text-anchor": "start",
    }, r.volts));
    g.appendChild(mk("text", {
      class: "m20vl-rung-unit", x: px + 16 + r.volts.length * 13 + 5, y: y + 2, "text-anchor": "start",
    }, r.unit));
    // tagline under
    g.appendChild(mk("text", {
      class: "m20vl-rung-tag", x: px + pw - 14, y: y + 14, "text-anchor": "end",
    }, r.tagline));
    g.appendChild(mk("text", {
      class: "m20vl-rung-tag", x: px + pw - 14, y: y - 7, "text-anchor": "end", "font-size": 11,
      "font-family": "var(--font-mono,monospace)", "letter-spacing": "0.06em", opacity: 0.8,
    }, r.star ? "STANDARD" : ""));

    g.addEventListener("click", () => {
      if (idx === i) {
        // already the selected rung — re-click re-confirms it with a quick
        // pulse on the plate instead of silently doing nothing
        const plate = g.querySelector(".m20vl-rung-plate");
        plate?.animate(
          [{ filter: "brightness(1)" }, { filter: "brightness(1.35)" }, { filter: "brightness(1)" }],
          { duration: 380, easing: "ease-out" }
        );
        return;
      }
      select(i, true);
    });
    svg.appendChild(g);
    rungEls.push(g);
  });

  // ---------------------------------------------------------------- card render
  const cardEl = root.querySelector("#m20vl-card");
  const walkBtn = root.querySelector("#m20vl-walk");
  const walkLbl = root.querySelector("#m20vl-walk-lbl");
  const resetBtn = root.querySelector("#m20vl-reset");
  const stepN = root.querySelector("#m20vl-step-n");

  const DANGER = {
    extreme: { label: "EXTREME", fill: 1.0, color: "#DC2626" },
    high: { label: "HIGH", fill: 0.72, color: "#F97316" },
    moderate: { label: "MODERATE", fill: 0.45, color: "#EAB308" },
    safe: { label: "TOUCH-SAFE", fill: 0.14, color: "#22C55E" },
  };

  function renderCard(r) {
    const d = DANGER[r.danger];
    cardEl.style.setProperty("--rung-accent", r.accent);
    const chips = r.loads.map((l, k) =>
      `<span class="m20vl-chip" style="animation-delay:${k * 70}ms"><span class="m20vl-dotmark"></span>${l}</span>`
    ).join("");
    cardEl.innerHTML = `
      <div class="m20vl-card-top">
        <div class="m20vl-badgerow">
          <div class="m20vl-bignum">${r.volts}<small>${r.unit}</small></div>
          <div>
            <div class="m20vl-cardname">${r.name}</div>
            <div class="m20vl-cardtag">${r.tagline}</div>
          </div>
          ${r.star ? `<div class="m20vl-star">&starf; modern standard</div>` : ""}
        </div>
      </div>
      <div class="m20vl-job"><b>Its job:</b> ${r.job}</div>
      <div class="m20vl-loads">
        <div class="m20vl-loads-h">What lives here</div>
        <div class="m20vl-chips">${chips}</div>
      </div>
      <div class="m20vl-stats">
        <div class="m20vl-stat">
          <div class="m20vl-stat-k">Shock danger</div>
          <div class="m20vl-stat-v m20vl-danger-pill">
            <span class="m20vl-bar"><i></i></span>
            <span style="color:${d.color}">${d.label}</span>
          </div>
          <div class="m20vl-stat-k" style="margin-top:6px;text-transform:none;letter-spacing:0;font-family:var(--font-display,sans-serif);font-size:11.5px;color:var(--muted,#6B7488)">${r.dangerNote}</div>
        </div>
        <div class="m20vl-stat">
          <div class="m20vl-stat-k">Sensors for it</div>
          <div class="m20vl-stat-v">${r.sensors}</div>
          <div class="m20vl-stat-k" style="margin-top:8px">Fuse ease</div>
          <div class="m20vl-stat-v">${r.fuse}</div>
        </div>
      </div>
    `;
    // animate the danger bar after layout
    const bar = cardEl.querySelector(".m20vl-bar i");
    if (bar) {
      bar.style.background = d.color;
      bar.style.right = "100%";
      requestAnimationFrame(() => { bar.style.right = `${(1 - d.fill) * 100}%`; });
    }
  }

  // ---------------------------------------------------------------- selection
  let idx = -1;
  function select(i, animateWalker) {
    i = Math.max(0, Math.min(i, n - 1));
    idx = i;
    rungEls.forEach((g, k) => g.classList.toggle("is-active", k === i));
    // light up the active rung's end dot + move the walker pip
    const y = rungY(i);
    if (animateWalker) {
      walker.style.transform = `translateY(${y - rungY(0)}px)`;
    } else {
      walker.style.transition = "none";
      walker.style.transform = `translateY(${y - rungY(0)}px)`;
      // restore transition next frame
      requestAnimationFrame(() => { walker.style.transition = ""; });
    }
    stepN.textContent = String(i + 1);
    renderCard(RUNGS[i]);

    const atBottom = i >= n - 1;
    walkBtn.disabled = atBottom;
    walkLbl.textContent = atBottom ? "At the bottom — 24VDC" : "Walk down a rung";
  }

  walkBtn.addEventListener("click", () => { if (idx < n - 1) select(idx + 1, true); });
  resetBtn.addEventListener("click", () => select(0, true));

  // start at the top rung
  select(0, false);

  // ---------------------------------------------------------------- helpers
  function hexA(hex, a) {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
}
