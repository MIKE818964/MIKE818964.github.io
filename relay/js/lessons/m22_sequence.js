// =============================================================================
// m22_sequence.js — "Build the Fan + Conveyor Timed Sequence" interactive.
//
// the classic timed-sequence build, live: a START/STOP station drives a
// 3-wire latch (CR1) that feeds TWO timers at once —
//   TMR2 (on-delay)  gates the CONVEYOR: it starts t2 seconds AFTER Start.
//   TMR3 (off-delay) holds the FAN:     it runs the instant Start is pressed
//                                       and keeps running t3 seconds PAST Stop
//                                       to clear the dust out of the duct.
// The learner presses the real buttons and watches four things react at once:
//   1. an animated machine panel (spinning fan blades, moving conveyor belt)
//   2. a live mini ladder diagram (power flow + contact states highlighted)
//   3. a 2-track timing chart drawing FAN and CONVEYOR in real time
//   4. a NEXT-STEP coach bar narrating every state (countdowns included)
// Interruptions are first-class: STOP during the conveyor wait aborts it
// (fan still clears out), and START during the fan-hold CANCELS the shutdown
// cleanly — CR1 re-latches and the fan never stops.
//
// Timing decisions use WALL-clock (performance.now) so throttled tabs can't
// stall the countdown; a watchdog interval keeps stepping when rAF starves.
// Self-contained ES module. Every CSS class prefixed `m22sq-`. No imports.
// =============================================================================

export function render(host) {
  const SVGNS = "http://www.w3.org/2000/svg";
  const E = (n, a = {}, txt) => {
    const e = document.createElementNS(SVGNS, n);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    if (txt != null) e.textContent = txt;
    return e;
  };

  // ---------------------------------------------------------------- style
  const style = document.createElement("style");
  style.textContent = `
  .m22sq-root{
    position:absolute; inset:0; display:flex; flex-direction:column;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--text,#303749);
    background:
      radial-gradient(1000px 440px at 85% -8%, rgba(124,92,255,.07), transparent 60%),
      radial-gradient(900px 420px at 5% 110%, rgba(59,130,246,.08), transparent 60%),
      var(--bg,#F6F8FC);
    overflow:auto;                 /* narrow stages stack + scroll (see @container below) */
    container-type:inline-size;    /* lets the layout respond to the STAGE width, not the window */
  }
  .m22sq-head{ padding:16px 24px 8px; flex:0 0 auto; }
  .m22sq-kicker{
    font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--blue-deep,#2563EB); display:flex; align-items:center; gap:9px;
  }
  .m22sq-kicker::before{ content:""; width:26px; height:2px; border-radius:2px;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); }
  .m22sq-title{
    margin:5px 0 2px; font-weight:800; font-size:21px; letter-spacing:-.02em;
    line-height:1.1; color:var(--ink,#0E1326);
  }
  .m22sq-sub{ font-size:13px; color:var(--muted,#6B7488); max-width:720px; line-height:1.4; }

  .m22sq-body{ flex:1 1 auto; display:flex; gap:14px; padding:6px 24px 14px; min-height:0; }

  /* ============================ LEFT: station + ladder ============================ */
  .m22sq-leftcol{ flex:0 0 296px; display:flex; flex-direction:column; gap:10px; min-height:0; }

  .m22sq-station{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
    padding:10px; flex:0 0 auto;
  }
  .m22sq-pushrow{ display:flex; gap:10px; }
  .m22sq-push{
    flex:1 1 0; border-radius:13px; padding:9px 6px 8px; cursor:pointer;
    border:1.5px solid var(--border-strong,#D6DDEC); background:var(--surface-2,#FBFCFE);
    display:flex; flex-direction:column; align-items:center; gap:5px;
    font-family:var(--font-display,sans-serif);
    transition:all .16s cubic-bezier(.2,.8,.25,1);
  }
  .m22sq-push > *{ pointer-events:none; } /* decorative children never eat the click */
  .m22sq-push:hover{ transform:translateY(-1px); border-color:var(--border-strong,#C9D2E4); }
  .m22sq-push:active .m22sq-cap{ transform:translateY(1.5px) scale(.93); }
  .m22sq-cap{
    width:36px; height:36px; border-radius:50%; transition:transform .08s ease;
    box-shadow:inset 0 -3px 5px rgba(0,0,0,.28), 0 3px 8px rgba(16,19,38,.25);
    border:3px solid #E3E8F2;
  }
  .m22sq-push-start .m22sq-cap{ background:radial-gradient(circle at 35% 30%, #4ADE80, #16A34A 75%); }
  .m22sq-push-stop  .m22sq-cap{ width:44px; background:radial-gradient(circle at 35% 30%, #F87171, #DC2626 75%); border-radius:50%/58%; }
  .m22sq-push b{ font-size:13px; letter-spacing:.06em; color:var(--ink,#0E1326); }
  .m22sq-push span{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.02em; color:var(--muted,#6B7488); text-transform:uppercase; }
  .m22sq-push-start.is-latched{
    border-color:transparent; background:linear-gradient(135deg,#DCFCE7,#F0FDF4);
    box-shadow:0 0 0 2px rgba(34,197,94,.35), 0 8px 18px rgba(34,197,94,.2);
  }
  .m22sq-push-start.is-latched .m22sq-cap{ box-shadow:inset 0 -3px 5px rgba(0,0,0,.28), 0 0 14px 3px rgba(74,222,128,.75); }

  .m22sq-sliders{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.04));
    padding:10px 13px 8px; flex:0 0 auto;
  }
  .m22sq-slidewrap{ margin-bottom:7px; }
  .m22sq-slidewrap:last-child{ margin-bottom:2px; }
  .m22sq-slidehead{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px; }
  .m22sq-slidehead-l{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.02em;
    text-transform:uppercase; color:var(--muted,#6B7488); }
  .m22sq-slidehead-l b{ color:var(--ink,#0E1326); }
  .m22sq-slidehead-v{ font-family:var(--font-mono,monospace); font-size:14px; font-weight:700; }
  .m22sq-v-conv{ color:var(--violet,#7C5CFF); }
  .m22sq-v-fan{ color:var(--blue,#3B82F6); }
  .m22sq-slider{
    -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:4px;
    background:linear-gradient(90deg,var(--blue,#3B82F6),var(--violet,#7C5CFF)); outline:none; cursor:pointer;
  }
  .m22sq-slider::-webkit-slider-thumb{
    -webkit-appearance:none; appearance:none; width:17px; height:17px; border-radius:50%;
    background:#fff; border:3px solid var(--violet,#7C5CFF); box-shadow:0 2px 8px rgba(20,30,60,.25); cursor:grab;
  }
  .m22sq-slider::-moz-range-thumb{
    width:17px; height:17px; border-radius:50%; background:#fff; border:3px solid var(--violet,#7C5CFF);
    box-shadow:0 2px 8px rgba(20,30,60,.25); cursor:grab;
  }
  .m22sq-slider.m22sq-sl-fan::-webkit-slider-thumb{ border-color:var(--blue,#3B82F6); }
  .m22sq-slider.m22sq-sl-fan::-moz-range-thumb{ border-color:var(--blue,#3B82F6); }

  .m22sq-laddercard{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
    padding:8px 10px 6px; flex:1 1 auto; min-height:0; display:flex; flex-direction:column;
  }
  .m22sq-ladderlabel{
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.06em;
    text-transform:uppercase; color:var(--muted,#6B7488); text-align:center; padding:1px 0 3px;
  }
  .m22sq-laddercard svg{ width:100%; height:100%; flex:1 1 auto; min-height:0; display:block; }

  /* ============================ RIGHT: coach + panel + chart ============================ */
  .m22sq-rightcol{ flex:1 1 auto; display:flex; flex-direction:column; gap:10px; min-width:0; min-height:0; }

  .m22sq-coach{
    display:flex; align-items:center; gap:10px; flex:0 0 auto;
    padding:9px 13px; border-radius:12px;
    background:linear-gradient(135deg, rgba(124,92,255,.16), rgba(59,130,246,.10));
    border:1.5px solid var(--violet,#7C5CFF);
    box-shadow:0 4px 16px rgba(124,92,255,.22);
  }
  .m22sq-coach-k{
    flex:0 0 auto; font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:#fff; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    padding:4px 10px; border-radius:999px; white-space:nowrap;
  }
  .m22sq-coach-t{ font-size:13.5px; font-weight:700; line-height:1.32; color:#6D28D9; }
  .m22sq-coach-t b{ color:var(--ink,#0E1326); }
  .m22sq-coach-t .m22sq-coach-cd{
    font-family:var(--font-mono,"JetBrains Mono",monospace); font-weight:800;
    color:var(--violet,#7C5CFF); font-variant-numeric:tabular-nums;
  }

  .m22sq-panelcard{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
    padding:10px 14px 6px; flex:1 1 auto; min-height:0; display:flex; flex-direction:column;
  }
  .m22sq-panelhead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:2px; flex:0 0 auto; }
  .m22sq-paneltitle{ font-weight:800; font-size:13.5px; color:var(--ink,#0E1326); display:flex; align-items:center; gap:14px; }
  .m22sq-lampwrap{ display:flex; align-items:center; gap:6px;
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted,#6B7488); }
  .m22sq-lamp{
    width:13px; height:13px; border-radius:50%; background:#D3D9E6; border:2px solid #AEB7C9;
    box-shadow:inset 0 1px 2px rgba(0,0,0,.2); transition:all .12s ease;
  }
  .m22sq-lamp.lit{ background:#4ADE80; border-color:#16A34A; box-shadow:0 0 12px 3px rgba(74,222,128,.8), inset 0 1px 2px rgba(0,0,0,.12); }
  .m22sq-badge{
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.08em; text-transform:uppercase;
    color:var(--muted,#6B7488); background:var(--bg,#F6F8FC); border:1px solid var(--border,#E6EAF3);
    padding:4px 9px; border-radius:999px;
  }
  .m22sq-panelsvgwrap{ flex:1 1 auto; min-height:0; }
  .m22sq-panelsvgwrap svg{ width:100%; height:100%; display:block; }

  .m22sq-chartcard{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
    padding:8px 14px 4px; flex:0 0 208px; min-height:0; display:flex; flex-direction:column;
  }
  .m22sq-charthead{ display:flex; align-items:center; justify-content:space-between; flex:0 0 auto; margin-bottom:2px; gap:10px; }
  .m22sq-charttitle{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted,#6B7488); font-weight:700; white-space:nowrap; }
  .m22sq-legend{ display:flex; gap:10px; font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.02em; color:var(--muted,#6B7488); white-space:nowrap; }
  .m22sq-legend i{ display:inline-block; width:14px; height:3px; border-radius:2px; margin-right:5px; vertical-align:middle; }
  .m22sq-chartsvgwrap{ flex:1 1 auto; min-height:0; }
  .m22sq-chartsvgwrap svg{ width:100%; height:100%; display:block; }

  .m22sq-grid{ stroke:var(--border,#E6EAF3); stroke-width:1; }
  .m22sq-axislabel{ font-family:var(--font-mono,monospace); font-size:15px; fill:var(--muted,#6B7488); }
  .m22sq-tracelabel{ font-family:var(--font-mono,monospace); font-size:15px; font-weight:700; }
  .m22sq-trace-fan{ fill:none; stroke:var(--blue,#3B82F6); stroke-width:2.6; stroke-linejoin:round; }
  .m22sq-trace-conv{ fill:none; stroke:var(--violet,#7C5CFF); stroke-width:2.6; stroke-linejoin:round; }
  .m22sq-playhead{ stroke:var(--live,#EF4444); stroke-width:1.4; stroke-dasharray:3 3; opacity:.75; }
  .m22sq-band-conv{ fill:rgba(124,92,255,.12); }
  .m22sq-band-fan{ fill:rgba(59,130,246,.12); }
  .m22sq-band-edge{ stroke-width:1.4; stroke-dasharray:4 3; opacity:.7; }

  /* Narrow stage (small window / squeezed center pane): stack the three zones
     full-width so every SVG keeps a readable scale; the root scrolls. */
  @container (max-width: 719px){
    .m22sq-body{ flex-direction:column; }
    .m22sq-leftcol{ flex:0 0 auto; width:100%; }
    .m22sq-laddercard{ flex:0 0 auto; height:380px; }
    .m22sq-rightcol{ flex:0 0 auto; }
    .m22sq-panelcard{ flex:0 0 auto; }
    .m22sq-panelsvgwrap{ flex:0 0 auto; height:300px; }
    .m22sq-chartcard{ flex:0 0 auto; height:208px; }
  }
  `;
  host.appendChild(style);

  // ---------------------------------------------------------------- DOM scaffold
  const root = document.createElement("div");
  root.className = "m22sq-root";
  host.appendChild(root);

  root.innerHTML = `
    <div class="m22sq-head">
      <div class="m22sq-kicker">Advanced &middot; timed sequence build</div>
      <h2 class="m22sq-title">The Fan + Conveyor Timed Sequence</h2>
      <div class="m22sq-sub">One latch, two timers. Press <b>START</b>: the fan leads instantly, the conveyor follows after the on-delay. Press <b>STOP</b>: the conveyor quits <b>instantly</b> while the off-delay keeps the fan clearing dust. Try interrupting mid-sequence.</div>
    </div>
    <div class="m22sq-body">
      <div class="m22sq-leftcol">
        <div class="m22sq-station">
          <div class="m22sq-pushrow">
            <button class="m22sq-push m22sq-push-start" id="m22sq-start">
              <span class="m22sq-cap"></span><b>START</b><span>NO &middot; momentary</span>
            </button>
            <button class="m22sq-push m22sq-push-stop" id="m22sq-stop">
              <span class="m22sq-cap"></span><b>STOP</b><span>NC &middot; momentary</span>
            </button>
          </div>
        </div>
        <div class="m22sq-sliders">
          <div class="m22sq-slidewrap">
            <div class="m22sq-slidehead">
              <span class="m22sq-slidehead-l"><b>TMR2</b> on-delay &middot; conveyor start</span>
              <span class="m22sq-slidehead-v m22sq-v-conv" id="m22sq-conv-v">5.0s</span>
            </div>
            <input type="range" class="m22sq-slider" id="m22sq-conv-sl" min="1" max="10" step="0.5" value="5">
          </div>
          <div class="m22sq-slidewrap">
            <div class="m22sq-slidehead">
              <span class="m22sq-slidehead-l"><b>TMR3</b> off-delay &middot; fan clear-out</span>
              <span class="m22sq-slidehead-v m22sq-v-fan" id="m22sq-fan-v">5.0s</span>
            </div>
            <input type="range" class="m22sq-slider m22sq-sl-fan" id="m22sq-fan-sl" min="1" max="10" step="0.5" value="5">
          </div>
        </div>
        <div class="m22sq-laddercard">
          <div class="m22sq-ladderlabel">Live ladder &middot; watch the power flow</div>
          <div id="m22sq-laddersvgwrap"></div>
        </div>
      </div>
      <div class="m22sq-rightcol">
        <div class="m22sq-coach" id="m22sq-coach"><span class="m22sq-coach-k">Next step</span><span class="m22sq-coach-t" id="m22sq-coach-t"></span></div>
        <div class="m22sq-panelcard">
          <div class="m22sq-panelhead">
            <div class="m22sq-paneltitle">
              <span>Machine Panel</span>
              <span class="m22sq-lampwrap"><span class="m22sq-lamp" id="m22sq-lamp-fan"></span>Fan</span>
              <span class="m22sq-lampwrap"><span class="m22sq-lamp" id="m22sq-lamp-conv"></span>Conveyor</span>
            </div>
            <div class="m22sq-badge" id="m22sq-badge">t = 0.0s</div>
          </div>
          <div class="m22sq-panelsvgwrap" id="m22sq-panelsvgwrap"></div>
        </div>
        <div class="m22sq-chartcard">
          <div class="m22sq-charthead">
            <span class="m22sq-charttitle">Timing chart</span>
            <span class="m22sq-legend">
              <span><i style="background:var(--blue,#3B82F6)"></i>FAN &middot; TMR3 holds</span>
              <span><i style="background:var(--violet,#7C5CFF)"></i>CONVEYOR &middot; TMR2 gates</span>
            </span>
          </div>
          <div class="m22sq-chartsvgwrap" id="m22sq-chartsvgwrap"></div>
        </div>
      </div>
    </div>
  `;

  // =================================================================
  // STATE
  // =================================================================
  let cr1 = false;              // master latch relay
  let fanOn = false;            // fan motor energized (via TMR3 off-delay contact)
  let convOn = false;           // conveyor motor energized (via TMR2 on-delay contact)
  let convDelay = 5.0;          // TMR2 setting (s)
  let fanDelay = 5.0;           // TMR3 setting (s)
  let tmr2StartWall = null, tmr2StartSim = null;   // on-delay timing since START
  let tmr3StartWall = null, tmr3StartSim = null;   // off-delay hold since STOP
  let simT = 0;                 // running chart clock
  let history = [];             // [{t, fan, conv}]
  const WINDOW = 22;            // seconds visible on the chart
  let rafId = null, lastFrameMs = null, lastStepMs = null;
  let fanSpeed = 0, fanAngle = 0;         // animation (0..1 speed, degrees)
  let convSpeed = 0, beltOffset = 0, pulleyAngle = 0;
  let startFlashUntil = 0, stopFlashUntil = 0;     // momentary-button visual actuation
  let everStarted = false, shutdownDone = false, shutdownCancelled = false;
  let transientMsg = "", transientUntil = 0;       // short coach interjections (no-op presses)

  const fmt = (t) => `${t.toFixed(1)}s`;

  // =================================================================
  // MINI LADDER (SVG) — 5 rungs + seal-in branch, live-highlighted
  // =================================================================
  const ladSvg = E("svg", { viewBox: "0 0 260 262", preserveAspectRatio: "xMidYMid meet" });
  root.querySelector("#m22sq-laddersvgwrap").appendChild(ladSvg);
  root.querySelector("#m22sq-laddersvgwrap").style.cssText = "flex:1 1 auto; min-height:0;";

  const WIRE = "#A6B0C3", HOT = "#3B82F6", BAR = "#475569";
  const L1X = 16, L2X = 244;
  // rails
  ladSvg.appendChild(E("line", { x1: L1X, y1: 18, x2: L1X, y2: 252, stroke: BAR, "stroke-width": 2.4 }));
  ladSvg.appendChild(E("line", { x1: L2X, y1: 18, x2: L2X, y2: 252, stroke: BAR, "stroke-width": 2.4 }));
  ladSvg.appendChild(E("text", { x: L1X, y: 13, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 700, fill: "#5A6478" }, "L1"));
  ladSvg.appendChild(E("text", { x: L2X, y: 13, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 700, fill: "#5A6478" }, "L2"));

  const wireGroup = E("g", { stroke: WIRE, "stroke-width": 1.7, fill: "none", "stroke-linecap": "round" });
  const hotGroups = {};   // name -> <g> overlay
  ladSvg.appendChild(wireGroup);

  function wires(hotName, segs) {
    // segs: array of point-arrays [[x,y],[x,y],...] — draws base + a hot overlay
    let hg = hotGroups[hotName];
    if (!hg) {
      hg = E("g", { stroke: HOT, "stroke-width": 2.6, fill: "none", "stroke-linecap": "round", opacity: 0 });
      hg.style.transition = "opacity .15s ease";
      hotGroups[hotName] = hg;
    }
    for (const pts of segs) {
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
      wireGroup.appendChild(E("path", { d }));
      hg.appendChild(E("path", { d }));
    }
  }

  const contacts = [];
  function mkContact(x, y, label, opts = {}) {
    // opts: nc (normally-closed slash), timed ("on"|"off" arc), hotName
    const g = E("g");
    const mk = (a) => { const l = E("line", a); g.appendChild(l); return l; };
    const lead1 = mk({ x1: x - 13, y1: y, x2: x - 5, y2: y, stroke: WIRE, "stroke-width": 1.7 });
    const lead2 = mk({ x1: x + 5, y1: y, x2: x + 13, y2: y, stroke: WIRE, "stroke-width": 1.7 });
    const bar1 = mk({ x1: x - 5, y1: y - 7, x2: x - 5, y2: y + 7, stroke: BAR, "stroke-width": 2 });
    const bar2 = mk({ x1: x + 5, y1: y - 7, x2: x + 5, y2: y + 7, stroke: BAR, "stroke-width": 2 });
    const bridge = mk({ x1: x - 5, y1: y, x2: x + 5, y2: y, stroke: BAR, "stroke-width": 2.4 });
    bridge.style.transition = "opacity .12s ease";
    let slash = null;
    if (opts.nc) slash = mk({ x1: x - 9, y1: y + 9, x2: x + 9, y2: y - 9, stroke: BAR, "stroke-width": 1.7 });
    if (opts.timed === "on")  g.appendChild(E("path", { d: `M ${x - 7},${y + 10} Q ${x},${y + 16} ${x + 7},${y + 10}`, stroke: BAR, "stroke-width": 1.3, fill: "none" }));
    if (opts.timed === "off") g.appendChild(E("path", { d: `M ${x - 7},${y + 15} Q ${x},${y + 9} ${x + 7},${y + 15}`, stroke: BAR, "stroke-width": 1.3, fill: "none" }));
    g.appendChild(E("text", { x, y: y - 13, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11.5, "font-weight": 700, fill: "#3D4557" }, label));
    ladSvg.appendChild(g);
    const c = {
      set(closed, hot) {
        bridge.style.opacity = closed ? "1" : "0";
        const col = hot ? HOT : BAR;
        bar1.setAttribute("stroke", col); bar2.setAttribute("stroke", col);
        bridge.setAttribute("stroke", col);
        if (slash) slash.setAttribute("stroke", col);
        lead1.setAttribute("stroke", hot ? HOT : WIRE); lead2.setAttribute("stroke", hot ? HOT : WIRE);
        lead1.setAttribute("stroke-width", hot ? 2.6 : 1.7); lead2.setAttribute("stroke-width", hot ? 2.6 : 1.7);
      },
    };
    contacts.push(c);
    return c;
  }

  const coils = [];
  function mkCoil(x, y, txt, tag, color, motor = false) {
    const g = E("g");
    const circ = E("circle", { cx: x, cy: y, r: 14, fill: "#FFFFFF", stroke: "#64748B", "stroke-width": 1.8 });
    circ.style.transition = "all .15s ease";
    g.appendChild(circ);
    const t = E("text", { x, y: y + (motor ? 4.4 : 3.8), "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": motor ? 13 : 11, "font-weight": 800, fill: "#334155" }, txt);
    g.appendChild(t);
    g.appendChild(E("text", { x, y: y + 26, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11.5, "letter-spacing": ".02em", "font-weight": 700, fill: "#5A6478" }, tag));
    ladSvg.appendChild(g);
    const c = {
      set(on) {
        circ.setAttribute("stroke", on ? color : "#64748B");
        circ.setAttribute("fill", on ? color + "22" : "#FFFFFF");
        circ.style.filter = on ? `drop-shadow(0 0 4px ${color}88)` : "none";
        t.setAttribute("fill", on ? "#0E1326" : "#334155");
      },
    };
    coils.push(c);
    return c;
  }

  // ---- geometry: contact centers x=52 (and 108 for STOP), coils at x=200
  const R1 = 40, RB = 70, R2 = 112, R3 = 152, R4 = 192, R5 = 232;
  // rung 1: START || seal → STOP(NC) → (CR1)
  wires("r1", [
    [[L1X, R1], [39, R1]], [[65, R1], [95, R1]], [[121, R1], [187, R1]], [[213, R1], [L2X, R1]],
  ]);
  wires("rb", [
    [[28, R1], [28, RB], [39, RB]], [[65, RB], [82, RB], [82, R1]],
  ]);
  ladSvg.appendChild(E("circle", { cx: 28, cy: R1, r: 2, fill: BAR }));
  ladSvg.appendChild(E("circle", { cx: 82, cy: R1, r: 2, fill: BAR }));
  // rungs 2/3: CR1 → (TMR2), CR1 → (TMR3)
  wires("r2", [[[L1X, R2], [39, R2]], [[65, R2], [187, R2]], [[213, R2], [L2X, R2]]]);
  wires("r3", [[[L1X, R3], [39, R3]], [[65, R3], [187, R3]], [[213, R3], [L2X, R3]]]);
  // rungs 4/5: TMR2·t → (CONV M), TMR3·t → (FAN M)
  wires("r4", [[[L1X, R4], [39, R4]], [[65, R4], [187, R4]], [[213, R4], [L2X, R4]]]);
  wires("r5", [[[L1X, R5], [39, R5]], [[65, R5], [187, R5]], [[213, R5], [L2X, R5]]]);
  for (const hg of Object.values(hotGroups)) ladSvg.appendChild(hg);

  const cStart = mkContact(52, R1, "START");
  const cStop  = mkContact(108, R1, "STOP", { nc: true });
  const cSeal  = mkContact(52, RB, "CR1");
  const cCr1a  = mkContact(52, R2, "CR1");
  const cCr1b  = mkContact(52, R3, "CR1");
  const cT2    = mkContact(52, R4, "TMR2·t", { timed: "on" });
  const cT3    = mkContact(52, R5, "TMR3·t", { timed: "off" });

  const koCR1  = mkCoil(200, R1, "CR1", "LATCH", "#10B981");
  const koT2   = mkCoil(200, R2, "TMR2", "ON-DELAY", "#7C5CFF");
  const koT3   = mkCoil(200, R3, "TMR3", "OFF-DELAY", "#3B82F6");
  const koConv = mkCoil(200, R4, "M", "CONVEYOR", "#7C5CFF", true);
  const koFan  = mkCoil(200, R5, "M", "FAN", "#3B82F6", true);

  // countdown readouts beside the timer coils
  const t2cd = E("text", { x: 200, y: R2 - 18, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11.5, "font-weight": 800, fill: "#6D28D9", opacity: 0 }, "");
  const t3cd = E("text", { x: 200, y: R3 - 18, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11.5, "font-weight": 800, fill: "#2563EB", opacity: 0 }, "");
  ladSvg.appendChild(t2cd);
  ladSvg.appendChild(t3cd);

  function updateLadder(now, conRemain, fanRemain) {
    const startFlash = now < startFlashUntil;
    const stopFlash = now < stopFlashUntil;
    hotGroups.r1.style.opacity = cr1 ? 1 : 0;
    hotGroups.rb.style.opacity = cr1 ? 1 : 0;
    hotGroups.r2.style.opacity = cr1 ? 1 : 0;
    hotGroups.r3.style.opacity = cr1 ? 1 : 0;
    hotGroups.r4.style.opacity = convOn ? 1 : 0;
    hotGroups.r5.style.opacity = fanOn ? 1 : 0;
    cStart.set(startFlash, startFlash && cr1);
    cStop.set(!stopFlash, cr1);                 // NC: held closed unless being pressed
    cSeal.set(cr1, cr1);
    cCr1a.set(cr1, cr1);
    cCr1b.set(cr1, cr1);
    cT2.set(convOn, convOn);
    cT3.set(fanOn, fanOn);
    koCR1.set(cr1);
    koT2.set(cr1);
    koT3.set(cr1);
    koConv.set(convOn);
    koFan.set(fanOn);
    const t2on = cr1 && !convOn && tmr2StartWall != null;
    t2cd.style.opacity = t2on ? 1 : 0;
    if (t2on) t2cd.textContent = fmt(conRemain);
    const t3on = !cr1 && fanOn && tmr3StartWall != null;
    t3cd.style.opacity = t3on ? 1 : 0;
    if (t3on) t3cd.textContent = fmt(fanRemain);
  }

  // =================================================================
  // MACHINE PANEL (SVG) — animated fan + conveyor
  // =================================================================
  const panSvg = E("svg", { viewBox: "44 10 592 298", preserveAspectRatio: "xMidYMid meet" });
  root.querySelector("#m22sq-panelsvgwrap").appendChild(panSvg);

  const panDefs = E("defs");
  panDefs.innerHTML = `
    <linearGradient id="m22sq-houseGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E2E7F1"/>
    </linearGradient>
    <radialGradient id="m22sq-ductGrad" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#C7D2E5"/><stop offset="0.8" stop-color="#DCE4F2"/><stop offset="1" stop-color="#C2CBDD"/>
    </radialGradient>
    <linearGradient id="m22sq-beltGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4B5468"/><stop offset="1" stop-color="#2B3242"/>
    </linearGradient>
  `;
  panSvg.appendChild(panDefs);

  panSvg.appendChild(E("line", { x1: 305, y1: 30, x2: 305, y2: 262, stroke: "#E6EAF3", "stroke-width": 1.5, "stroke-dasharray": "4 5" }));

  // ---------------- FAN (left) ----------------
  const FCX = 148, FCY = 152;
  panSvg.appendChild(E("text", { x: FCX, y: 33, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 15, "font-weight": 800, "letter-spacing": ".08em", fill: "#0E1326" }, "EXHAUST FAN"));
  panSvg.appendChild(E("text", { x: FCX, y: 52, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 14, "font-weight": 700, "letter-spacing": ".02em", fill: "#5A6478" }, "LEADS · HELD BY TMR3"));
  panSvg.appendChild(E("rect", { x: FCX - 92, y: FCY - 92, width: 184, height: 184, rx: 16, fill: "url(#m22sq-houseGrad)", stroke: "#C7CEDD", "stroke-width": 1.5 }));
  panSvg.appendChild(E("circle", { cx: FCX, cy: FCY, r: 72, fill: "url(#m22sq-ductGrad)", stroke: "#AEB7C9", "stroke-width": 2 }));

  // dust particles (visible while the fan clears the duct)
  const dustG = E("g");
  panSvg.appendChild(dustG);
  const DUST = [];
  for (let i = 0; i < 11; i++) {
    const c = E("circle", { r: 1.6 + Math.random() * 2.2, fill: "#8A93A8", opacity: 0 });
    dustG.appendChild(c);
    DUST.push({ el: c, a: Math.random() * Math.PI * 2, r: 30 + Math.random() * 70, wob: Math.random() * 6 });
  }

  // blades
  const bladeG = E("g");
  const bladeInner = E("g");
  bladeG.setAttribute("transform", `translate(${FCX},${FCY})`);
  for (let i = 0; i < 5; i++) {
    const b = E("path", {
      d: "M 0,-10 C 16,-16 22,-38 13,-58 C 7,-66 -9,-61 -11,-45 C -13,-27 -9,-16 0,-10 Z",
      fill: "#5B6B8C", stroke: "#46536F", "stroke-width": 1, transform: `rotate(${i * 72})`,
    });
    bladeInner.appendChild(b);
  }
  bladeG.appendChild(bladeInner);
  panSvg.appendChild(bladeG);
  panSvg.appendChild(E("circle", { cx: FCX, cy: FCY, r: 12, fill: "#2B3242", stroke: "#14161C", "stroke-width": 1.5 }));
  panSvg.appendChild(E("circle", { cx: FCX, cy: FCY, r: 4, fill: "#8A93A8" }));
  // guard rings + struts (over the blades)
  const guard = E("g", { stroke: "#AEB7C9", "stroke-width": 1.1, fill: "none", opacity: .65 });
  [24, 42, 60].forEach((r) => guard.appendChild(E("circle", { cx: FCX, cy: FCY, r })));
  for (let i = 0; i < 4; i++) {
    const a = (i * 90 + 45) * Math.PI / 180;
    guard.appendChild(E("line", { x1: FCX + Math.cos(a) * 13, y1: FCY + Math.sin(a) * 13, x2: FCX + Math.cos(a) * 70, y2: FCY + Math.sin(a) * 70 }));
  }
  panSvg.appendChild(guard);

  // ---------------- CONVEYOR (right) ----------------
  const BX0 = 356, BX1 = 624, BY = 176, BH = 34;
  panSvg.appendChild(E("text", { x: 490, y: 33, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 15, "font-weight": 800, "letter-spacing": ".08em", fill: "#0E1326" }, "CONVEYOR"));
  panSvg.appendChild(E("text", { x: 490, y: 52, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 14, "font-weight": 700, "letter-spacing": ".02em", fill: "#5A6478" }, "FOLLOWS · DELAYED BY TMR2"));
  // legs + base
  panSvg.appendChild(E("line", { x1: 398, y1: BY + BH, x2: 388, y2: 258, stroke: "#8A93A8", "stroke-width": 5, "stroke-linecap": "round" }));
  panSvg.appendChild(E("line", { x1: 582, y1: BY + BH, x2: 592, y2: 258, stroke: "#8A93A8", "stroke-width": 5, "stroke-linecap": "round" }));
  panSvg.appendChild(E("line", { x1: 372, y1: 259, x2: 608, y2: 259, stroke: "#C7CEDD", "stroke-width": 3, "stroke-linecap": "round" }));

  // boxes riding the belt (drawn behind the belt front edge, above belt top)
  const boxG = E("g");
  panSvg.appendChild(boxG);
  const BOXES = [
    { x: 380, w: 30, h: 26, fill: "#D9B98A" },
    { x: 470, w: 22, h: 19, fill: "#CFA875" },
    { x: 545, w: 34, h: 23, fill: "#E0C49B" },
  ].map((b) => {
    const g = E("g");
    g.appendChild(E("rect", { x: 0, y: BY - b.h, width: b.w, height: b.h, rx: 2.5, fill: b.fill, stroke: "#A9855C", "stroke-width": 1.3 }));
    g.appendChild(E("line", { x1: b.w / 2, y1: BY - b.h, x2: b.w / 2, y2: BY, stroke: "#A9855C", "stroke-width": 1 }));
    boxG.appendChild(g);
    return { g, ...b };
  });

  // belt loop
  const beltPath = E("rect", { x: BX0, y: BY, width: BX1 - BX0, height: BH, rx: BH / 2, fill: "url(#m22sq-beltGrad)", stroke: "#14161C", "stroke-width": 2 });
  panSvg.appendChild(beltPath);
  const beltDash = E("rect", { x: BX0 + 3, y: BY + 3, width: BX1 - BX0 - 6, height: BH - 6, rx: (BH - 6) / 2, fill: "none", stroke: "#8A93A8", "stroke-width": 2, "stroke-dasharray": "9 9" });
  panSvg.appendChild(beltDash);
  // pulleys
  const pulleys = [BX0 + BH / 2, BX1 - BH / 2].map((cx) => {
    panSvg.appendChild(E("circle", { cx, cy: BY + BH / 2, r: 10.5, fill: "#DCE4F2", stroke: "#4B5468", "stroke-width": 2 }));
    const sp = E("g");
    sp.appendChild(E("line", { x1: -7, y1: 0, x2: 7, y2: 0, stroke: "#4B5468", "stroke-width": 2 }));
    sp.appendChild(E("line", { x1: 0, y1: -7, x2: 0, y2: 7, stroke: "#4B5468", "stroke-width": 2 }));
    panSvg.appendChild(sp);
    return { sp, cx, cy: BY + BH / 2 };
  });

  // ---------------- status pills ----------------
  function mkPill(cx, cy) {
    const g = E("g");
    const rect = E("rect", { x: cx - 100, y: cy - 13.5, width: 200, height: 27, rx: 13.5, fill: "#EEF2FB", stroke: "#D6DDEC", "stroke-width": 1.3 });
    const txt = E("text", { x: cx, y: cy + 3.5, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 14, "font-weight": 800, "letter-spacing": ".02em", fill: "#4B5468" }, "STOPPED");
    g.appendChild(rect); g.appendChild(txt);
    panSvg.appendChild(g);
    const THEMES = {
      run:  { fill: "#DCFCE7", stroke: "#22C55E", col: "#15803D" },
      wait: { fill: "#F0ECFF", stroke: "#7C5CFF", col: "#6D28D9" },
      hold: { fill: "#DBEAFE", stroke: "#3B82F6", col: "#1D4ED8" },
      off:  { fill: "#EEF2FB", stroke: "#D6DDEC", col: "#4B5468" },
    };
    return {
      set(label, type) {
        const th = THEMES[type] || THEMES.off;
        rect.setAttribute("fill", th.fill); rect.setAttribute("stroke", th.stroke);
        txt.setAttribute("fill", th.col);
        if (txt.textContent !== label) txt.textContent = label;
      },
    };
  }
  const fanPill = mkPill(FCX, 288);
  const convPill = mkPill(490, 288);

  function updateMachines(dt, conRemain, fanRemain) {
    // fan: eased spin-up / longer coast-down
    const fT = fanOn ? 1 : 0;
    fanSpeed += (fT - fanSpeed) * Math.min(1, dt * (fT > fanSpeed ? 2.6 : 1.4));
    if (Math.abs(fT - fanSpeed) < 0.004) fanSpeed = fT;
    fanAngle = (fanAngle + fanSpeed * 540 * dt) % 360;
    bladeInner.setAttribute("transform", `rotate(${fanAngle.toFixed(2)})`);

    // conveyor: quick start/stop (motor + load)
    const cT = convOn ? 1 : 0;
    convSpeed += (cT - convSpeed) * Math.min(1, dt * 6);
    if (Math.abs(cT - convSpeed) < 0.004) convSpeed = cT;
    const adv = convSpeed * 78 * dt;
    beltOffset = (beltOffset + adv) % 18;
    beltDash.setAttribute("stroke-dashoffset", (-beltOffset).toFixed(2));
    pulleyAngle = (pulleyAngle + convSpeed * 260 * dt) % 360;
    for (const p of pulleys) p.sp.setAttribute("transform", `translate(${p.cx},${p.cy}) rotate(${pulleyAngle.toFixed(2)})`);
    for (const b of BOXES) {
      b.x += adv;
      if (b.x + b.w > BX1 - 20) b.x = BX0 - 8;
      b.g.setAttribute("transform", `translate(${b.x.toFixed(2)},0)`);
    }

    // dust: drawn into the fan; bold during the clear-out hold, faint while running
    const holding = !cr1 && fanOn;
    const dustVis = fanSpeed * (holding ? 0.9 : 0.22);
    for (const d of DUST) {
      d.r -= (26 + 130 * fanSpeed) * dt;
      d.a += dt * 0.9;
      if (d.r < 15) { d.r = 62 + Math.random() * 40; d.a = Math.random() * Math.PI * 2; }
      const wob = Math.sin(d.a * 3 + d.wob) * 4;
      d.el.setAttribute("cx", (FCX + Math.cos(d.a) * (d.r + wob)).toFixed(1));
      d.el.setAttribute("cy", (FCY + Math.sin(d.a) * (d.r + wob)).toFixed(1));
      d.el.setAttribute("opacity", (dustVis * (0.35 + 0.65 * Math.min(1, d.r / 70))).toFixed(2));
    }

    // pills + lamps
    if (fanOn && cr1) fanPill.set("RUNNING", "run");
    else if (fanOn) fanPill.set(`CLEARING DUST · ${fmt(fanRemain)}`, "hold");
    else fanPill.set("STOPPED", "off");
    if (convOn) convPill.set("RUNNING", "run");
    else if (cr1 && tmr2StartWall != null) convPill.set(`STARTS IN ${fmt(conRemain)}`, "wait");
    else convPill.set("STOPPED", "off");
    lampFan.classList.toggle("lit", fanOn);
    lampConv.classList.toggle("lit", convOn);
  }

  // =================================================================
  // TIMING CHART (SVG) — 2 tracks, scrolling live sweep (m21 pattern)
  // =================================================================
  const CH_W = 640, CH_H = 184;
  const chSvg = E("svg", { viewBox: `0 0 ${CH_W} ${CH_H}` });
  root.querySelector("#m22sq-chartsvgwrap").appendChild(chSvg);

  const padL = 96, padR = 14, padT = 12;
  const plotW = CH_W - padL - padR;
  const rowH = 58, rowGap = 28;
  const fanY0 = padT, convY0 = padT + rowH + rowGap;
  const chBottom = convY0 + rowH;

  const chGrid = E("g");
  chSvg.appendChild(chGrid);
  for (let i = 0; i <= 8; i++) {
    const x = padL + (i / 8) * plotW;
    chGrid.appendChild(E("line", { class: "m22sq-grid", x1: x, y1: padT - 4, x2: x, y2: chBottom + 4 }));
  }
  chSvg.appendChild(E("text", { class: "m22sq-tracelabel", x: 8, y: fanY0 + rowH * 0.5 + 5, fill: "var(--blue-deep,#2563EB)" }, "FAN"));
  chSvg.appendChild(E("text", { class: "m22sq-tracelabel", x: 8, y: convY0 + rowH * 0.5 + 5, fill: "#6D28D9" }, "CONVEYOR"));
  [fanY0, convY0].forEach((y0) => {
    chSvg.appendChild(E("line", { class: "m22sq-grid", x1: padL, y1: y0, x2: padL + plotW, y2: y0 }));
    chSvg.appendChild(E("line", { class: "m22sq-grid", x1: padL, y1: y0 + rowH, x2: padL + plotW, y2: y0 + rowH }));
  });

  // per-row timing bands (TMR2 wait on the conveyor row, TMR3 hold on the fan row)
  const convBand = E("rect", { class: "m22sq-band-conv", x: 0, y: convY0, width: 0, height: rowH });
  const fanBand = E("rect", { class: "m22sq-band-fan", x: 0, y: fanY0, width: 0, height: rowH });
  const convBandEdge = E("line", { class: "m22sq-band-edge", stroke: "var(--violet,#7C5CFF)", y1: convY0, y2: convY0 + rowH, opacity: 0 });
  const fanBandEdge = E("line", { class: "m22sq-band-edge", stroke: "var(--blue,#3B82F6)", y1: fanY0, y2: fanY0 + rowH, opacity: 0 });
  chSvg.appendChild(convBand); chSvg.appendChild(fanBand);
  chSvg.appendChild(convBandEdge); chSvg.appendChild(fanBandEdge);

  const traceFan = E("path", { class: "m22sq-trace-fan" });
  const traceConv = E("path", { class: "m22sq-trace-conv" });
  chSvg.appendChild(traceFan); chSvg.appendChild(traceConv);
  const playhead = E("line", { class: "m22sq-playhead", x1: padL, y1: padT - 4, x2: padL, y2: chBottom + 4 });
  chSvg.appendChild(playhead);
  const axisGroup = E("g");
  chSvg.appendChild(axisGroup);

  const levelY = (y0, lvl) => y0 + rowH - lvl * rowH;

  let scrollOffset = 0;
  const xForT = (t) => padL + ((t - scrollOffset) / WINDOW) * plotW;

  function rebuildAxis() {
    while (axisGroup.firstChild) axisGroup.removeChild(axisGroup.firstChild);
    const stepS = 2;
    const startTick = Math.ceil(scrollOffset / stepS) * stepS;
    for (let s = startTick; s <= scrollOffset + WINDOW; s += stepS) {
      const x = xForT(s);
      if (x < padL - 1 || x > padL + plotW + 1) continue;
      axisGroup.appendChild(E("text", { class: "m22sq-axislabel", x, y: chBottom + 21, "text-anchor": "middle" }, `${s.toFixed(0)}s`));
    }
  }

  function bandUpdate(band, edge, startSim, delay) {
    if (startSim == null) { band.setAttribute("width", "0"); edge.style.opacity = "0"; return; }
    const x0 = Math.max(padL, xForT(startSim));
    const x1 = Math.min(xForT(Math.min(simT, startSim + delay)), padL + plotW);
    band.setAttribute("x", x0);
    band.setAttribute("width", Math.max(0, x1 - x0));
    const ex = xForT(startSim + delay);
    edge.setAttribute("x1", ex); edge.setAttribute("x2", ex);
    edge.style.opacity = (ex < padL || ex > padL + plotW) ? "0" : "0.7";
  }

  function rebuildTraces() {
    const visible = history.filter((s) => s.t >= scrollOffset - 0.5 && s.t <= scrollOffset + WINDOW + 0.5);
    if (visible.length === 0) {
      traceFan.setAttribute("d", ""); traceConv.setAttribute("d", "");
      playhead.setAttribute("x1", padL); playhead.setAttribute("x2", padL);
      bandUpdate(convBand, convBandEdge, null, 0); bandUpdate(fanBand, fanBandEdge, null, 0);
      return;
    }
    let dF = "", dC = "";
    visible.forEach((s, i) => {
      const x = xForT(s.t);
      dF += (i === 0 ? "M" : "L") + `${x},${levelY(fanY0, s.fan ? 1 : 0)} `;
      dC += (i === 0 ? "M" : "L") + `${x},${levelY(convY0, s.conv ? 1 : 0)} `;
    });
    const xNow = xForT(simT);
    const last = visible[visible.length - 1];
    dF += `L ${xNow},${levelY(fanY0, last.fan ? 1 : 0)} `;
    dC += `L ${xNow},${levelY(convY0, last.conv ? 1 : 0)} `;
    traceFan.setAttribute("d", dF.trim());
    traceConv.setAttribute("d", dC.trim());
    playhead.setAttribute("x1", xNow); playhead.setAttribute("x2", xNow);
    bandUpdate(convBand, convBandEdge, (cr1 && !convOn) ? tmr2StartSim : null, convDelay);
    bandUpdate(fanBand, fanBandEdge, (!cr1 && fanOn) ? tmr3StartSim : null, fanDelay);
  }

  function applyScroll(viewStart) {
    scrollOffset = viewStart;
    rebuildAxis();
    rebuildTraces();
  }

  // =================================================================
  // COACH BAR — narrates every state (the guided "next step" line)
  // =================================================================
  const coachTxt = root.querySelector("#m22sq-coach-t");
  let lastCoachMsg = "";
  function updateCoach(now, conRemain, fanRemain) {
    const cd = (v) => `<span class="m22sq-coach-cd">${v.toFixed(1)}s</span>`;
    let msg;
    if (now < transientUntil) {
      msg = transientMsg;
    } else if (cr1 && !convOn) {
      msg = shutdownCancelled
        ? `Shutdown <b>CANCELLED</b> &mdash; CR1 re-latched, the fan never stopped. Conveyor re-starts in ${cd(conRemain)}.`
        : `CR1 latched &mdash; <b>FAN up instantly</b>. TMR2 is timing: conveyor starts in ${cd(conRemain)}. (Try STOP before it does.)`;
    } else if (cr1 && convOn) {
      msg = `Full sequence running &mdash; fan + conveyor. Now press <b>STOP</b> and watch which machine quits instantly&hellip; and which lingers.`;
    } else if (!cr1 && fanOn) {
      msg = `STOP dropped CR1 &mdash; <b>conveyor halted instantly</b>. Fan clearing dust&hellip; ${cd(fanRemain)}. Press <b>START</b> now to cancel the shutdown.`;
    } else if (shutdownDone) {
      msg = `Fan stopped &mdash; air cleared, cycle complete. Run it again: this time press <b>START during the fan-hold</b> and watch the shutdown cancel.`;
    } else {
      msg = `1 &middot; Set your two delays, then press <b>START</b>. Watch which machine leads &mdash; and which one follows.`;
    }
    if (msg !== lastCoachMsg) { lastCoachMsg = msg; coachTxt.innerHTML = msg; }
  }

  // =================================================================
  // CONTROLS
  // =================================================================
  const startBtn = root.querySelector("#m22sq-start");
  const stopBtn = root.querySelector("#m22sq-stop");
  const convSl = root.querySelector("#m22sq-conv-sl");
  const fanSl = root.querySelector("#m22sq-fan-sl");
  const convV = root.querySelector("#m22sq-conv-v");
  const fanV = root.querySelector("#m22sq-fan-v");
  const lampFan = root.querySelector("#m22sq-lamp-fan");
  const lampConv = root.querySelector("#m22sq-lamp-conv");
  const badge = root.querySelector("#m22sq-badge");

  convSl.addEventListener("input", () => {
    convDelay = parseFloat(convSl.value);
    convV.textContent = fmt(convDelay);
    step(0); ensureLoop();
  });
  fanSl.addEventListener("input", () => {
    fanDelay = parseFloat(fanSl.value);
    fanV.textContent = fmt(fanDelay);
    step(0); ensureLoop();
  });

  function pressStart() {
    const now = performance.now();
    everStarted = true;
    startFlashUntil = now + 380;
    if (cr1) {
      transientMsg = `Already latched &mdash; CR1's seal-in contact is holding the rung. Press <b>STOP</b> to begin the shutdown.`;
      transientUntil = now + 1900;
      step(0); ensureLoop();
      return;
    }
    const wasHolding = fanOn;              // START during the clear-out hold?
    cr1 = true;
    shutdownDone = false;
    shutdownCancelled = wasHolding;
    fanOn = true;                          // TMR3 off-delay contact closes the instant its coil sees power
    tmr3StartWall = null; tmr3StartSim = null;   // cancel any pending release — shutdown aborted
    tmr2StartWall = now; tmr2StartSim = simT;    // TMR2 on-delay starts timing toward the conveyor
    convOn = false;
    step(0);        // synchronous redraw — panel/ladder/coach react on the press itself
    ensureLoop();
  }

  function pressStop() {
    const now = performance.now();
    stopFlashUntil = now + 380;
    if (!cr1 && !fanOn && !convOn) {
      transientMsg = `Nothing to stop &mdash; the panel is dead. Press <b>START</b> first.`;
      transientUntil = now + 1900;
      step(0); ensureLoop();
      return;
    }
    if (!cr1 && fanOn) {
      transientMsg = `Already shutting down &mdash; the fan is clearing. (START would cancel it.)`;
      transientUntil = now + 1900;
      step(0); ensureLoop();
      return;
    }
    cr1 = false;
    shutdownCancelled = false;
    convOn = false;                        // conveyor drops the instant CR1 unlatches
    tmr2StartWall = null; tmr2StartSim = null;
    if (fanOn) { tmr3StartWall = now; tmr3StartSim = simT; }   // TMR3 hold begins
    step(0);
    ensureLoop();
  }

  startBtn.addEventListener("click", pressStart);
  stopBtn.addEventListener("click", pressStop);

  // =================================================================
  // SIMULATION LOOP (m21 pattern: rAF + wall-clock decisions + watchdog)
  // =================================================================
  function ensureLoop() {
    if (rafId == null) {
      lastFrameMs = null;
      rafId = requestAnimationFrame(tick);
    }
  }

  function sample() {
    history.push({ t: simT, fan: fanOn, conv: convOn });
    const cutoff = simT - WINDOW - 2;
    while (history.length && history[0].t < cutoff) history.shift();
  }

  // core step — callable from rAF, the watchdog, or synchronously with dt=0
  function step(dt) {
    simT += dt;
    lastStepMs = performance.now();
    const now = lastStepMs;

    // ---- timing decisions on WALL clock (honest even when rAF starves) ----
    let conRemain = 0, fanRemain = 0;
    if (cr1 && !convOn && tmr2StartWall != null) {
      const el = (now - tmr2StartWall) / 1000;
      conRemain = Math.max(0, convDelay - el);
      if (el >= convDelay) {
        convOn = true;                              // TMR2 timed out — conveyor joins
        tmr2StartWall = null; tmr2StartSim = null;
        shutdownCancelled = false;
      }
    }
    if (!cr1 && fanOn && tmr3StartWall != null) {
      const el = (now - tmr3StartWall) / 1000;
      fanRemain = Math.max(0, fanDelay - el);
      if (el >= fanDelay) {
        fanOn = false;                              // TMR3 released — duct is clear
        tmr3StartWall = null; tmr3StartSim = null;
        shutdownDone = true;
      }
    }

    sample();
    updateMachines(dt, conRemain, fanRemain);
    updateLadder(now, conRemain, fanRemain);
    updateCoach(now, conRemain, fanRemain);
    badge.textContent = `t = ${simT.toFixed(1)}s`;
    startBtn.classList.toggle("is-latched", cr1);
    // machine-readable state for QA: cr1 / fan / conveyor / holding
    root.setAttribute("data-state", `${cr1 ? 1 : 0}${fanOn ? 1 : 0}${convOn ? 1 : 0}${(!cr1 && fanOn) ? 1 : 0}`);

    let viewStart = 0;
    if (simT > WINDOW * 0.72) viewStart = simT - WINDOW * 0.72;
    applyScroll(viewStart);

    return cr1 || fanOn || convOn ||
      tmr2StartWall != null || tmr3StartWall != null ||
      fanSpeed > 0.004 || convSpeed > 0.004 ||
      now < startFlashUntil || now < stopFlashUntil || now < transientUntil + 250;
  }

  function tick(nowMs) {
    if (!root.isConnected) { rafId = null; return; }
    if (lastFrameMs == null) lastFrameMs = nowMs;
    const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.25);
    lastFrameMs = nowMs;
    let cont = false;
    try { cont = step(dt); }
    finally { rafId = cont ? requestAnimationFrame(tick) : null; }
  }

  // WATCHDOG: hidden tabs / Energy Saver throttle rAF to a stop — the countdown
  // must keep stepping anyway, or "press STOP and wait" appears to do nothing.
  const watchdog = setInterval(() => {
    if (!root.isConnected) { clearInterval(watchdog); return; }
    const active = cr1 || fanOn || convOn || tmr2StartWall != null || tmr3StartWall != null;
    if (!active) return;
    const now = performance.now();
    if (lastStepMs == null || now - lastStepMs > 400) {
      const dt = lastStepMs == null ? 0 : Math.min((now - lastStepMs) / 1000, 1.2);
      lastFrameMs = null;             // rAF resumes with a fresh delta, no double-count
      step(dt);
    }
  }, 300);

  // ---------------------------------------------------------------- init
  step(0);
  applyScroll(0);

  // QA hook (mirrors m21's ?timer= family): ?seq=start | ?seq=demo
  //   start -> press START immediately
  //   demo  -> 2s delays, START at 0.3s, STOP at 3.4s (full cycle in ~7s)
  const qaSeq = new URLSearchParams(location.search).get("seq");
  if (qaSeq === "start") {
    pressStart();
  } else if (qaSeq === "demo") {
    convSl.value = "2"; convSl.dispatchEvent(new Event("input"));
    fanSl.value = "2"; fanSl.dispatchEvent(new Event("input"));
    setTimeout(() => pressStart(), 300);
    setTimeout(() => pressStop(), 3400);
  }
}
