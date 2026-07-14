// =============================================================================
// m21_timer_mechanism.js — "Timer Mechanism" interactive.
//
// A realistic octal TIMER RELAY face (mode / range / set-time dials, flag
// indicator — modeled on the AutomationDirect ProSense TRS-TD series shown in
// timer_trs_td_face_view.jpg) sits next to a LIVE timing diagram. The learner:
//   1. Picks the mode: ON-DELAY (TDON) or OFF-DELAY (TDOF)
//   2. Sets the delay time with a slider (0.5 - 10s)
//   3. Flips a POWER toggle feeding the coil
// A real-time sweep draws the INPUT POWER trace and the OUTPUT CONTACT trace
// left-to-right, the timer's progress arc / flag fills, and a wired pilot lamp
// fires the instant the timed contact transfers. The learner can interrupt
// mid-cycle (drop power before timeout) to feel the #1 point of confusion:
//   ON-DELAY : power on -> wait t -> contact transfers. Drop power any time -> instant reset.
//   OFF-DELAY: power on -> contact transfers IMMEDIATELY. Power off -> contact HOLDS for t, then releases.
//
// Self-contained ES module. Every CSS class prefixed `m21tm-`. No imports.
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
  .m21tm-root{
    position:absolute; inset:0; display:flex; flex-direction:column;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--text,#303749);
    background:
      radial-gradient(1000px 440px at 85% -8%, rgba(124,92,255,.07), transparent 60%),
      radial-gradient(900px 420px at 5% 110%, rgba(59,130,246,.08), transparent 60%),
      var(--bg,#F6F8FC);
    overflow:auto;                 /* narrow stages stack + scroll (see @container below) */
    container-type:inline-size;    /* respond to the STAGE width, not the window */
  }
  .m21tm-head{ padding:18px 24px 10px; flex:0 0 auto; }
  .m21tm-kicker{
    font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--blue-deep,#2563EB); display:flex; align-items:center; gap:9px;
  }
  .m21tm-kicker::before{ content:""; width:26px; height:2px; border-radius:2px;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); }
  .m21tm-title{
    margin:6px 0 2px; font-weight:800; font-size:22px; letter-spacing:-.02em;
    line-height:1.1; color:var(--ink,#0E1326);
  }
  .m21tm-sub{ font-size:12.5px; color:var(--muted,#6B7488); max-width:680px; line-height:1.42; }

  .m21tm-body{ flex:1 1 auto; display:flex; gap:16px; padding:6px 24px 16px; min-height:0; }

  /* ============================ LEFT: timer face ============================ */
  .m21tm-facecol{ flex:0 0 300px; display:flex; flex-direction:column; gap:8px; min-height:0; }
  .m21tm-facecard{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
    padding:10px 10px 4px; flex:0 0 auto; min-height:0; display:flex; flex-direction:column;
  }
  .m21tm-facecard svg{ width:100%; height:100%; flex:1 1 auto; min-height:0; display:block; overflow:visible; }
  .m21tm-facelabel{
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.04em;
    text-transform:uppercase; color:var(--muted,#6B7488); text-align:center; padding-top:3px;
  }

  /* controls under the face */
  .m21tm-ctrl{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.04));
    padding:10px 13px; flex:1 1 auto; min-height:0; display:flex; flex-direction:column;
  }
  .m21tm-modes{ display:flex; gap:8px; margin-bottom:8px; }
  .m21tm-modebtn{
    flex:1 1 0; border:1.5px solid var(--border,#E6EAF3); background:var(--surface-2,#FBFCFE);
    border-radius:11px; padding:7px 6px; cursor:pointer; text-align:center;
    font-family:var(--font-display,sans-serif); transition:all .18s cubic-bezier(.2,.8,.25,1);
  }
  .m21tm-modebtn b{ display:block; font-size:13px; color:var(--ink,#0E1326); }
  .m21tm-modebtn span{ display:block; font-size:11px; color:var(--muted,#6B7488); margin-top:1px; }
  .m21tm-modebtn:hover{ border-color:var(--border-strong,#D6DDEC); transform:translateY(-1px); }
  .m21tm-modebtn.active{
    cursor:default;
    border-color:transparent; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    box-shadow:0 8px 18px rgba(59,130,246,.32); transform:translateY(-1px);
  }
  .m21tm-modebtn.active b, .m21tm-modebtn.active span{ color:#fff; }

  .m21tm-slidewrap{ margin-bottom:8px; }
  .m21tm-slidehead{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:5px; }
  .m21tm-slidehead-l{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.04em;
    text-transform:uppercase; color:var(--muted,#6B7488); }
  .m21tm-slidehead-v{ font-family:var(--font-mono,monospace); font-size:15px; font-weight:700; color:var(--violet,#7C5CFF); }
  .m21tm-slider{
    -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:4px;
    background:linear-gradient(90deg,var(--blue,#3B82F6),var(--violet,#7C5CFF)); outline:none; cursor:pointer;
  }
  .m21tm-slider::-webkit-slider-thumb{
    -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%;
    background:#fff; border:3px solid var(--violet,#7C5CFF); box-shadow:0 2px 8px rgba(20,30,60,.25); cursor:grab;
  }
  .m21tm-slider::-moz-range-thumb{
    width:18px; height:18px; border-radius:50%; background:#fff; border:3px solid var(--violet,#7C5CFF);
    box-shadow:0 2px 8px rgba(20,30,60,.25); cursor:grab;
  }

  .m21tm-power{
    width:100%; border:none; cursor:pointer; border-radius:13px; padding:11px 14px;
    display:flex; align-items:center; justify-content:center; gap:10px;
    font-family:var(--font-display,sans-serif); font-weight:800; font-size:13.5px; letter-spacing:.02em;
    background:var(--surface-2,#FBFCFE); border:1.5px solid var(--border-strong,#D6DDEC); color:var(--ink,#0E1326);
    transition:all .18s cubic-bezier(.2,.8,.25,1); flex:0 0 auto;
  }
  .m21tm-power:hover{ transform:translateY(-1px); }
  .m21tm-power .m21tm-pwdot{ width:11px; height:11px; border-radius:50%; background:#C3CAD9; transition:all .18s ease; flex:0 0 auto; }
  .m21tm-power.is-on{
    background:linear-gradient(135deg,#EF4444,#DC2626); border-color:transparent; color:#fff;
    box-shadow:0 10px 24px rgba(239,68,68,.35);
  }
  .m21tm-power.is-on .m21tm-pwdot{ background:#fff; box-shadow:0 0 10px rgba(255,255,255,.9); }

  .m21tm-interrupt-hint{
    margin-top:auto; font-size:11px; line-height:1.35; color:var(--muted,#6B7488);
    background:var(--blue-soft,#EAF1FE); border:1px dashed var(--border-strong,#D6DDEC);
    border-radius:10px; padding:7px 9px; flex:0 0 auto;
  }
  .m21tm-interrupt-hint b{ color:var(--blue-deep,#2563EB); }

  /* ============================ RIGHT: scope + facts ============================ */
  .m21tm-rightcol{ flex:1 1 auto; display:flex; flex-direction:column; gap:12px; min-width:0; min-height:0; }

  .m21tm-scopecard{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
    padding:14px 16px 10px; flex:1 1 auto; min-height:0; display:flex; flex-direction:column;
  }
  .m21tm-scopehead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; }
  .m21tm-scopetitle{ font-weight:800; font-size:13px; color:var(--ink,#0E1326); display:flex; align-items:center; gap:8px; }
  .m21tm-lamp{
    width:15px; height:15px; border-radius:50%; background:#F1D9AE; border:2px solid #C9A968;
    box-shadow:inset 0 1px 2px rgba(0,0,0,.2); transition:all .12s ease;
  }
  .m21tm-lamp.lit{ background:#FFD34D; border-color:#E8A800; box-shadow:0 0 14px 4px rgba(255,211,77,.85), inset 0 1px 2px rgba(0,0,0,.15); }
  .m21tm-lamplabel{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted,#6B7488); }
  .m21tm-scopebadge{
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.08em; text-transform:uppercase;
    color:var(--muted,#6B7488); background:var(--bg,#F6F8FC); border:1px solid var(--border,#E6EAF3);
    padding:4px 9px; border-radius:999px;
  }
  /* ---- NEXT STEP coach line (guided prompt — updates with the state machine) ---- */
  .m21tm-coach{
    display:flex; align-items:center; gap:10px; flex:0 0 auto; margin:0 0 8px;
    padding:9px 13px; border-radius:12px;
    background:linear-gradient(135deg, rgba(124,92,255,.16), rgba(59,130,246,.10));
    border:1.5px solid var(--violet,#7C5CFF);
    box-shadow:0 4px 16px rgba(124,92,255,.22);
  }
  .m21tm-coach-k{
    flex:0 0 auto; font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:#fff; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    padding:4px 10px; border-radius:999px; white-space:nowrap;
  }
  .m21tm-coach-t{ font-size:13.5px; font-weight:700; line-height:1.35; color:#6D28D9; }
  .m21tm-coach-t b{ color:var(--ink,#0E1326); }
  .m21tm-coach-t .m21tm-coach-cd{
    font-family:var(--font-mono,"JetBrains Mono",monospace); font-weight:800;
    color:var(--violet,#7C5CFF); font-variant-numeric:tabular-nums;
  }

  .m21tm-scopesvgwrap{ flex:1 1 auto; min-height:0; }
  .m21tm-scopesvgwrap svg{ width:100%; height:100%; display:block; }

  .m21tm-grid{ stroke:var(--border,#E6EAF3); stroke-width:1; }
  .m21tm-axislabel{ font-family:var(--font-mono,monospace); font-size:15.5px; fill:var(--muted,#6B7488); }
  .m21tm-tracelabel{ font-family:var(--font-mono,monospace); font-size:15.5px; font-weight:700; }
  .m21tm-trace-in{ fill:none; stroke:var(--blue,#3B82F6); stroke-width:2.6; stroke-linejoin:round; }
  .m21tm-trace-out{ fill:none; stroke:var(--live,#EF4444); stroke-width:2.6; stroke-linejoin:round; }
  .m21tm-playhead{ stroke:var(--violet,#7C5CFF); stroke-width:1.6; stroke-dasharray:3 3; opacity:.85; }
  .m21tm-timerband{ fill:rgba(124,92,255,.10); }
  .m21tm-timerband-edge{ stroke:var(--violet,#7C5CFF); stroke-width:1.4; stroke-dasharray:4 3; opacity:.7; }

  /* ---- fact cards row ---- */
  .m21tm-facts{ display:flex; gap:10px; flex:0 0 auto; }
  .m21tm-fact{
    flex:1 1 0; background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:13px; padding:10px 12px; box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.04));
    transition:border-color .2s ease, box-shadow .2s ease;
  }
  .m21tm-fact-k{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.06em;
    text-transform:uppercase; color:var(--muted,#6B7488); margin-bottom:4px; }
  .m21tm-fact-v{ font-size:12.5px; line-height:1.4; color:var(--text,#303749); }
  .m21tm-fact-v b{ color:var(--ink,#0E1326); }
  .m21tm-fact.flash{ border-color:var(--violet,#7C5CFF); box-shadow:0 0 0 3px rgba(124,92,255,.15); }

  /* Narrow stage: stack the face column above the scope so both keep a
     readable scale; the root scrolls. */
  @container (max-width: 719px){
    .m21tm-body{ flex-direction:column; }
    .m21tm-facecol{ flex:0 0 auto; width:100%; }
    /* keep the timer face near its designed scale when stacked full-width —
       an uncapped face blows past its card and gets covered by the controls */
    .m21tm-svgwrap{ max-width:330px; margin:0 auto; width:100%; }
    .m21tm-rightcol{ flex:0 0 auto; }
    .m21tm-scopecard{ flex:0 0 auto; }
    .m21tm-scopesvgwrap{ flex:0 0 auto; height:240px; }
    .m21tm-facts{ flex-wrap:wrap; }
    .m21tm-fact{ flex:1 1 220px; }
  }
  `;
  host.appendChild(style);

  // ---------------------------------------------------------------- DOM scaffold
  const root = document.createElement("div");
  root.className = "m21tm-root";
  host.appendChild(root);

  root.innerHTML = `
    <div class="m21tm-head">
      <div class="m21tm-kicker">Advanced &middot; timer relay mechanism</div>
      <h2 class="m21tm-title">Timer Mechanism: On-Delay vs Off-Delay</h2>
      <div class="m21tm-sub">Pick a mode, set the delay, then flip power. Watch the input trace and the timed <b>output contact</b> trace draw in real time &mdash; and try dropping power <b>mid-cycle</b> to feel the one difference that matters most.</div>
    </div>
    <div class="m21tm-body">
      <div class="m21tm-facecol">
        <div class="m21tm-facecard">
          <div class="m21tm-svgwrap" id="m21tm-facesvgwrap"></div>
          <div class="m21tm-facelabel">TRS-TD Off-Delay Timer &middot; octal 8-pin &middot; ProSense</div>
        </div>
        <div class="m21tm-ctrl">
          <div class="m21tm-modes">
            <button class="m21tm-modebtn active" id="m21tm-mode-on" data-mode="on">
              <b>ON-DELAY</b><span>TDON &middot; wait, then act</span>
            </button>
            <button class="m21tm-modebtn" id="m21tm-mode-off" data-mode="off">
              <b>OFF-DELAY</b><span>TDOF &middot; act, then hold</span>
            </button>
          </div>
          <div class="m21tm-slidewrap">
            <div class="m21tm-slidehead">
              <span class="m21tm-slidehead-l">Set time (Range C)</span>
              <span class="m21tm-slidehead-v" id="m21tm-time-v">3.0s</span>
            </div>
            <input type="range" class="m21tm-slider" id="m21tm-slider" min="0.5" max="10" step="0.5" value="3">
          </div>
          <button class="m21tm-power" id="m21tm-power"><span class="m21tm-pwdot"></span><span id="m21tm-power-lbl">APPLY COIL POWER</span></button>
          <div class="m21tm-interrupt-hint" id="m21tm-hint"><b>Try this:</b> start the timer, then hit power OFF before the flag finishes. On-delay resets instantly. Off-delay keeps holding until the time runs out.</div>
        </div>
      </div>
      <div class="m21tm-rightcol">
        <div class="m21tm-scopecard">
          <div class="m21tm-scopehead">
            <div class="m21tm-scopetitle"><span class="m21tm-lamp" id="m21tm-pilotlamp"></span><span class="m21tm-lamplabel" id="m21tm-lamplbl">Pilot Lamp &middot; off</span></div>
            <div class="m21tm-scopebadge" id="m21tm-scopebadge">t = 0.0s</div>
          </div>
          <div class="m21tm-coach" id="m21tm-coach"><span class="m21tm-coach-k">Next step</span><span class="m21tm-coach-t" id="m21tm-coach-t"></span></div>
          <div class="m21tm-scopesvgwrap" id="m21tm-scopesvgwrap"></div>
        </div>
        <div class="m21tm-facts">
          <div class="m21tm-fact" id="m21tm-fact-mode">
            <div class="m21tm-fact-k">Mode dial</div>
            <div class="m21tm-fact-v" id="m21tm-fact-mode-v"></div>
          </div>
          <div class="m21tm-fact" id="m21tm-fact-range">
            <div class="m21tm-fact-k">Range dial (A&ndash;H)</div>
            <div class="m21tm-fact-v"><b>C = 0.3&ndash;30 sec.</b> 8 rotary ranges span 0.05s to 30 min; MIN/MAX slide sets the exact point inside the chosen range.</div>
          </div>
          <div class="m21tm-fact" id="m21tm-fact-flag">
            <div class="m21tm-fact-k">Flag indicator</div>
            <div class="m21tm-fact-v" id="m21tm-fact-flag-v">White flag rides the arc: it fills as the internal RC/counter circuit times &mdash; a mechanical progress bar you can see from across the panel.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // =================================================================
  // STATE
  // =================================================================
  let mode = "on";           // "on" = TDON, "off" = TDOF
  let setTime = 3.0;         // seconds
  let powered = false;
  let timerStartT = null;    // sim-time when timing began (coil-on for TDON, coil-off for TDOF) — for drawing the scope band
  let timerStartWall = null; // WALL-clock ms when timing began — timing DECISIONS use this, so throttled tabs/Energy-Saver can't stall the countdown
  let contactTimed = false;  // is the timed contact in its TIMED (transferred) position?
  let simT = 0;              // running sim clock while scope is "recording"
  let history = [];          // [{t, power, contact}] samples for the scope trace
  const WINDOW = 16;         // seconds visible on the scope sweep
  let rafId = null;
  let lastFrameMs = null;

  // ---------------------------------------------------------------- timer FACE (SVG)
  // compact viewBox tuned to the facecard's fixed 224px-tall box (no clipping)
  const faceSvg = E("svg", { viewBox: "0 0 260 226", preserveAspectRatio: "xMidYMid meet" });
  root.querySelector("#m21tm-facesvgwrap").appendChild(faceSvg);
  faceSvg.style.width = "100%";
  faceSvg.style.height = "100%";
  faceSvg.style.flex = "1 1 auto";
  faceSvg.style.minHeight = "0";

  const faceDefs = E("defs");
  faceDefs.innerHTML = `
    <linearGradient id="m21tm-caseGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.55" stop-color="#F1F3F8"/>
      <stop offset="1" stop-color="#DCE1EC"/>
    </linearGradient>
    <linearGradient id="m21tm-knobGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3A3F4C"/>
      <stop offset="1" stop-color="#14161C"/>
    </linearGradient>
    <radialGradient id="m21tm-flagGlow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#7C5CFF" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#7C5CFF" stop-opacity="0"/>
    </radialGradient>
  `;
  faceSvg.appendChild(faceDefs);

  // case body — matches the reference photo's proportions (rectangular
  // octal timer body, black side strip, white top face)
  faceSvg.appendChild(E("rect", { x: 14, y: 6, width: 232, height: 214, rx: 16, fill: "url(#m21tm-caseGrad)", stroke: "#C7CEDD", "stroke-width": 1.5 }));
  faceSvg.appendChild(E("rect", { x: 14, y: 6, width: 14, height: 214, rx: 7, fill: "#22252E" })); // black edge strip (left, like the photo)
  faceSvg.appendChild(E("rect", { x: 26, y: 10, width: 214, height: 20, rx: 8, fill: "#EDEFF5" }));
  faceSvg.appendChild(E("text", { x: 133, y: 24.5, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11.5, "font-weight": 700, fill: "#3D4557" }, "TRS-TD-D-24AD"));

  // ---- FLAG / progress arc indicator (top area, most prominent — teaches state) ----
  const flagCx = 133, flagCy = 76, flagR = 36;
  faceSvg.appendChild(E("circle", { cx: flagCx, cy: flagCy, r: flagR + 12, fill: "url(#m21tm-flagGlow)", class: "m21tm-flagglow" }));
  faceSvg.appendChild(E("circle", { cx: flagCx, cy: flagCy, r: flagR, fill: "#FBFCFE", stroke: "#D6DDEC", "stroke-width": 2 }));
  // background track
  const trackPath = describeArc(flagCx, flagCy, flagR - 7, -90, 269.9);
  faceSvg.appendChild(E("path", { d: trackPath, fill: "none", stroke: "#E6EAF3", "stroke-width": 7, "stroke-linecap": "round" }));
  const progressArc = E("path", { d: "", fill: "none", stroke: "#7C5CFF", "stroke-width": 7, "stroke-linecap": "round" });
  faceSvg.appendChild(progressArc);
  // white flag pip that travels the arc
  const flagPip = E("g");
  const flagPipTri = E("path", { d: "M -6,-8 L 6,-8 L 0,6 Z", fill: "#FFFFFF", stroke: "#8A93A8", "stroke-width": 1.1 });
  flagPip.appendChild(flagPipTri);
  faceSvg.appendChild(flagPip);
  faceSvg.appendChild(E("text", { x: flagCx, y: flagCy + 4, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 13, "font-weight": 800, fill: "#0E1326", id: "m21tm-flagpct" }, "0%"));
  faceSvg.appendChild(E("text", { x: flagCx, y: flagCy + 18, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "letter-spacing": "0.04em", "font-weight": 700, fill: "#5A6478" }, "FLAG"));

  // state pill under the flag (READY / TIMING / TIMED)
  const statePill = E("g", { transform: `translate(${flagCx},${flagCy + flagR + 17})` });
  const statePillRect = E("rect", { x: -70, y: -11.5, width: 140, height: 23, rx: 11.5, fill: "#EEF2FB", stroke: "#D6DDEC" });
  const statePillText = E("text", { x: 0, y: 4, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 700, fill: "#4B5468" }, "READY");
  statePill.appendChild(statePillRect);
  statePill.appendChild(statePillText);
  faceSvg.appendChild(statePill);

  // ---- MIN/MAX slide dial (set-time knob, mirrors the reference photo) ----
  const slideY = 138;
  faceSvg.appendChild(E("line", { x1: 40, y1: slideY, x2: 226, y2: slideY, stroke: "#B9C2D6", "stroke-width": 3, "stroke-linecap": "round" }));
  for (let i = 0; i <= 6; i++) {
    const x = 40 + (i / 6) * 186;
    faceSvg.appendChild(E("line", { x1: x, y1: slideY - 7, x2: x, y2: slideY - 2, stroke: "#8A93A8", "stroke-width": 1.4 }));
  }
  faceSvg.appendChild(E("text", { x: 40, y: slideY - 12, "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 700, fill: "#5A6478" }, "MIN"));
  faceSvg.appendChild(E("text", { x: 226, y: slideY - 12, "text-anchor": "end", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 700, fill: "#0E1326" }, "MAX"));
  const slideKnob = E("g");
  slideKnob.appendChild(E("rect", { x: -13, y: slideY - 11, width: 26, height: 22, rx: 6, fill: "url(#m21tm-knobGrad)" }));
  slideKnob.appendChild(E("rect", { x: -13, y: slideY - 1, width: 26, height: 4, fill: "#EDEFF5" }));
  faceSvg.appendChild(slideKnob);

  // ---- rotary RANGE selector A–H (bottom-left, mirrors the photo) ----
  const rangeCx = 62, rangeCy = 186, rangeR = 18;
  const RANGE_LETTERS = ["H", "A", "B", "C", "D", "E", "F", "G"]; // arranged like the photo (H top-left, going clockwise)
  faceSvg.appendChild(E("circle", { cx: rangeCx, cy: rangeCy, r: rangeR + 9, fill: "#FBFCFE", stroke: "#D6DDEC", "stroke-width": 1.3 }));
  RANGE_LETTERS.forEach((L, i) => {
    const ang = -150 + i * (300 / (RANGE_LETTERS.length - 1));
    const rad = (ang * Math.PI) / 180;
    const lx = rangeCx + Math.cos(rad) * (rangeR + 15);
    const ly = rangeCy + Math.sin(rad) * (rangeR + 15);
    faceSvg.appendChild(E("text", { x: lx, y: ly + 3.5, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": L === "C" ? 800 : 700, fill: L === "C" ? "#6D28D9" : "#5A6478" }, L));
  });
  const rangePointerAngle = -150 + 3 * (300 / (RANGE_LETTERS.length - 1)); // points at "C"
  const rangeKnob = E("g", { transform: `translate(${rangeCx},${rangeCy}) rotate(${rangePointerAngle})` });
  rangeKnob.appendChild(E("circle", { cx: 0, cy: 0, r: rangeR, fill: "url(#m21tm-knobGrad)" }));
  rangeKnob.appendChild(E("path", { d: `M 0,-${rangeR * 0.62} L ${rangeR * 0.34},${rangeR * 0.5} L -${rangeR * 0.34},${rangeR * 0.5} Z`, fill: "#EDEFF5" }));
  faceSvg.appendChild(rangeKnob);
  // ("SELECT TIME RANGE" engraving cut for legibility — the A–H letters + the
  //  "Range dial (A–H)" fact card already identify this dial.)

  // ---- MODE toggle (right side, small pill switch: TDON / TDOF) ----
  const modeSwGroup = E("g", { transform: "translate(190,178)" });
  modeSwGroup.appendChild(E("rect", { x: -26, y: -26, width: 52, height: 50, rx: 10, fill: "#FBFCFE", stroke: "#D6DDEC" }));
  modeSwGroup.appendChild(E("text", { x: 0, y: -14, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "letter-spacing": "0.03em", "font-weight": 700, fill: "#5A6478" }, "MODE"));
  const modeSwTonText = E("text", { x: 2, y: -1, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 800 }, "TDON");
  const modeSwToffText = E("text", { x: 2, y: 13, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 800 }, "TDOF");
  modeSwGroup.appendChild(modeSwTonText);
  modeSwGroup.appendChild(modeSwToffText);
  const modeSwDot = E("circle", { cx: -19, cy: -1, r: 3.5, fill: "#7C5CFF" });
  modeSwGroup.appendChild(modeSwDot);
  faceSvg.appendChild(modeSwGroup);
  // the pill LOOKS like a switch, so it must BE one — clicking it (or either
  // label) flips the mode, same as the big ON-DELAY / OFF-DELAY buttons.
  modeSwGroup.style.cursor = "pointer";
  modeSwGroup.addEventListener("click", () => setMode(mode === "on" ? "off" : "on"));

  // ---- coil terminal indicators A1/A2 (bottom edge, mirrors octal pinout) ----
  faceSvg.appendChild(E("text", { x: 133, y: 216, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 700, fill: "#5A6478" }, "A1(+)  V~  A2(–)"));

  function describeArc(cx, cy, r, startDeg, sweepDeg) {
    const s = polar(cx, cy, r, startDeg);
    const e = polar(cx, cy, r, startDeg + sweepDeg);
    const large = sweepDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }
  function polar(cx, cy, r, deg) {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function updateFace(pct, timing, contactOn) {
    const sweep = 269.9 * Math.max(0, Math.min(1, pct));
    progressArc.setAttribute("d", pct > 0.002 ? describeArc(flagCx, flagCy, flagR - 8, -90, sweep) : "");
    const pipDeg = -90 + sweep;
    const pipPos = polar(flagCx, flagCy, flagR - 8, pipDeg);
    flagPip.setAttribute("transform", `translate(${pipPos.x},${pipPos.y}) rotate(${pipDeg + 90})`);
    faceSvg.querySelector("#m21tm-flagpct").textContent = `${Math.round(pct * 100)}%`;
    faceSvg.querySelector(".m21tm-flagglow").style.opacity = timing ? "1" : "0";
    progressArc.style.stroke = contactOn ? "#EF4444" : "#7C5CFF";

    let label = "READY", fill = "#EEF2FB", stroke = "#D6DDEC", txtColor = "#4B5468";
    if (timing) { label = "TIMING…"; fill = "#F0ECFF"; stroke = "#7C5CFF"; txtColor = "#6D28D9"; }
    else if (contactOn) { label = "TIMED / TRANSFERRED"; fill = "#FEE2E2"; stroke = "#EF4444"; txtColor = "#B91C1C"; }
    statePillRect.setAttribute("fill", fill);
    statePillRect.setAttribute("stroke", stroke);
    statePillText.setAttribute("fill", txtColor);
    statePillText.textContent = label;

    // slide knob position reflects setTime within 0.5-10 range
    const frac = (setTime - 0.5) / (10 - 0.5);
    slideKnob.setAttribute("transform", `translate(${40 + frac * 186},0)`);

    // mode switch dot position
    modeSwDot.setAttribute("cy", mode === "on" ? -3 : 15);
    modeSwTonText.style.fill = mode === "on" ? "#0E1326" : "#6B7488";
    modeSwToffText.style.fill = mode === "off" ? "#0E1326" : "#6B7488";
  }

  // ---------------------------------------------------------------- SCOPE (timing diagram)
  const SCOPE_VB_W = 640, SCOPE_VB_H = 260;
  const scopeSvg = E("svg", { viewBox: `0 0 ${SCOPE_VB_W} ${SCOPE_VB_H}` });
  root.querySelector("#m21tm-scopesvgwrap").appendChild(scopeSvg);

  const padL = 74, padR = 16, padT = 20, padB = 34;
  const plotW = SCOPE_VB_W - padL - padR;
  const rowH = 70, rowGap = 24;
  const inY0 = padT, outY0 = padT + rowH + rowGap;

  // grid
  const gridGroup = E("g");
  scopeSvg.appendChild(gridGroup);
  for (let i = 0; i <= 8; i++) {
    const x = padL + (i / 8) * plotW;
    gridGroup.appendChild(E("line", { class: "m21tm-grid", x1: x, y1: padT - 4, x2: x, y2: outY0 + rowH + 4 }));
  }
  // row labels — one clean label per track ("(input)"/"(timed NO)" captions cut
  // for legibility; the coach line + fact cards carry that explanation)
  scopeSvg.appendChild(E("text", { class: "m21tm-tracelabel", x: 8, y: inY0 + rowH * 0.5 + 5, fill: "var(--blue-deep,#2563EB)" }, "COIL"));
  scopeSvg.appendChild(E("text", { class: "m21tm-tracelabel", x: 8, y: outY0 + rowH * 0.5 + 5, fill: "#DC2626" }, "CONTACT"));

  // baselines (HIGH / LOW reference)
  [inY0, outY0].forEach((y0) => {
    scopeSvg.appendChild(E("line", { class: "m21tm-grid", x1: padL, y1: y0, x2: padL + plotW, y2: y0 }));
    scopeSvg.appendChild(E("line", { class: "m21tm-grid", x1: padL, y1: y0 + rowH, x2: padL + plotW, y2: y0 + rowH }));
  });

  // timer-band highlight (shows during timing window) — drawn under traces
  const timerBand = E("rect", { class: "m21tm-timerband", x: 0, y: padT - 4, width: 0, height: (outY0 + rowH) - (padT - 4) });
  scopeSvg.appendChild(timerBand);
  const timerBandEdge = E("line", { class: "m21tm-timerband-edge", x1: 0, y1: padT - 4, x2: 0, y2: outY0 + rowH });
  scopeSvg.appendChild(timerBandEdge);

  const tracePathIn = E("path", { class: "m21tm-trace-in" });
  const tracePathOut = E("path", { class: "m21tm-trace-out" });
  scopeSvg.appendChild(tracePathIn);
  scopeSvg.appendChild(tracePathOut);

  const playhead = E("line", { class: "m21tm-playhead", x1: padL, y1: padT - 4, x2: padL, y2: outY0 + rowH + 4 });
  scopeSvg.appendChild(playhead);

  // x-axis ticks (seconds) — rebuilt each frame by rebuildAxisScrolled() below
  const axisGroup = E("g");
  scopeSvg.appendChild(axisGroup);

  function levelY(y0, level) { return y0 + rowH - level * rowH; } // level 0..1

  // ---------------------------------------------------------------- pilot lamp + badge
  const pilotLamp = root.querySelector("#m21tm-pilotlamp");
  const lampLbl = root.querySelector("#m21tm-lamplbl");
  const scopeBadge = root.querySelector("#m21tm-scopebadge");

  function setLamp(on) {
    pilotLamp.classList.toggle("lit", on);
    lampLbl.textContent = `Pilot Lamp · ${on ? "ON — wired to timed contact" : "off"}`;
  }

  // ---------------------------------------------------------------- fact cards
  const factModeV = root.querySelector("#m21tm-fact-mode-v");
  const factModeCard = root.querySelector("#m21tm-fact-mode");
  function renderFactCards() {
    if (mode === "on") {
      factModeV.innerHTML = `<b>ON-DELAY (TDON).</b> Power applied &rarr; wait <b>${fmt(setTime)}</b> &rarr; contact transfers. Drop power any time before or after timeout &rarr; instant reset, no wait.`;
    } else {
      factModeV.innerHTML = `<b>OFF-DELAY (TDOF).</b> Power applied &rarr; contact transfers <b>immediately</b>. Power removed &rarr; contact HOLDS for <b>${fmt(setTime)}</b>, then releases.`;
    }
  }
  function fmt(t) { return `${t.toFixed(1)}s`; }

  // ---------------------------------------------------------------- NEXT STEP coach line
  // One persistent guided prompt that always tells the learner what to do next.
  // Exists because OFF-DELAY silently waits forever for the learner to REMOVE
  // power — without this line, "nothing changes" and the whole point is missed.
  const coachTxt = root.querySelector("#m21tm-coach-t");
  let offReleased = false;   // an off-delay hold just completed (drives the "run it again" line)
  let lastCoachMsg = "";
  function updateCoach(timing, wallElapsed) {
    const remain = Math.max(0, setTime - wallElapsed);
    const cd = `<span class="m21tm-coach-cd">${remain.toFixed(1)}s</span>`;
    let msg;
    if (mode === "on") {
      if (powered && !contactTimed) {
        msg = `Timing&hellip; contact transfers in ${cd}. Try cutting power early &mdash; on-delay resets instantly.`;
      } else if (contactTimed) {
        msg = `Contact made. Remove power &rarr; drops instantly.`;
      } else {
        msg = `1 &middot; Pick a mode, set the time, then <b>APPLY COIL POWER</b>.`;
      }
    } else {
      if (powered) {
        msg = `Contact made INSTANTLY. &#10230; Now click <b>REMOVE COIL POWER</b> &mdash; the contact will HOLD <b>${fmt(setTime)}</b> (your set time), THEN drop. That's the off-delay.`;
      } else if (contactTimed) {
        msg = `Power is OFF but the contact is HOLDING &mdash; releasing in ${cd}&hellip;`;
      } else if (offReleased) {
        msg = `Dropped, right on time. Run it again and interrupt the hold by re-applying power.`;
      } else {
        msg = `1 &middot; Pick a mode, set the time, then <b>APPLY COIL POWER</b>.`;
      }
    }
    if (msg !== lastCoachMsg) { lastCoachMsg = msg; coachTxt.innerHTML = msg; }
  }

  // ---------------------------------------------------------------- controls wiring
  const modeOnBtn = root.querySelector("#m21tm-mode-on");
  const modeOffBtn = root.querySelector("#m21tm-mode-off");
  const slider = root.querySelector("#m21tm-slider");
  const timeVEl = root.querySelector("#m21tm-time-v");
  const powerBtn = root.querySelector("#m21tm-power");
  const powerLbl = root.querySelector("#m21tm-power-lbl");

  function setMode(m) {
    if (m === mode) { flashFact(factModeCard); return; }   // re-click on the active mode: visible "yes, that one" ack (m03/m22 pattern) instead of a silent reset
    mode = m;
    modeOnBtn.classList.toggle("active", m === "on");
    modeOffBtn.classList.toggle("active", m === "off");
    resetCycle();
    renderFactCards();
  }
  modeOnBtn.addEventListener("click", () => setMode("on"));
  modeOffBtn.addEventListener("click", () => setMode("off"));

  slider.addEventListener("input", () => {
    setTime = parseFloat(slider.value);
    timeVEl.textContent = fmt(setTime);
    renderFactCards();
    flashFact(factModeCard);
  });

  function flashFact(el) {
    el.classList.add("flash");
    clearTimeout(el._flashT);
    el._flashT = setTimeout(() => el.classList.remove("flash"), 550);
  }

  powerBtn.addEventListener("click", () => {
    setPower(!powered);
  });

  function setPower(on) {
    if (powered === on) return;
    powered = on;
    powerBtn.classList.toggle("is-on", on);
    powerLbl.textContent = on ? "REMOVE COIL POWER" : "APPLY COIL POWER";

    if (mode === "on") {
      if (on) {
        // start (or restart) timing toward transfer
        timerStartT = simT;
        timerStartWall = performance.now();
      } else {
        // ON-DELAY: dropping power at any point = instant reset
        timerStartT = null;
        timerStartWall = null;
        contactTimed = false;
      }
    } else {
      if (on) {
        // OFF-DELAY: contact transfers immediately; cancel any pending release timer
        contactTimed = true;
        timerStartT = null;
        timerStartWall = null;
      } else {
        // OFF-DELAY: start the release timer; contact HOLDS until it elapses
        timerStartT = simT;
        timerStartWall = performance.now();
      }
    }
    step(0);        // redraw NOW — lamp/flag/scope must react even if rAF is throttled
    ensureLoop();
  }

  // ---------------------------------------------------------------- reset / simulation loop
  function resetCycle() {
    powered = false;
    timerStartT = null;
    timerStartWall = null;
    contactTimed = false;
    simT = 0;
    history = [];
    powerBtn.classList.remove("is-on");
    powerLbl.textContent = "APPLY COIL POWER";
    setLamp(false);
    updateFace(0, false, false);
    offReleased = false;
    updateCoach(false, 0);
    scopeBadge.textContent = "t = 0.0s";
    applyScroll(0);
  }

  function ensureLoop() {
    if (rafId == null) {
      lastFrameMs = null;
      rafId = requestAnimationFrame(tick);
    }
  }

  function sample(contactOn) {
    history.push({ t: simT, power: powered, contact: contactOn });
    // keep memory bounded — drop samples that scrolled fully off-window a while ago
    const cutoff = simT - WINDOW - 2;
    while (history.length && history[0].t < cutoff) history.shift();
  }

  // core simulation step, callable from rAF, the watchdog, OR synchronously
  // with dt=0 (recompute + redraw current state with no time advance).
  // Returns true while the loop should keep running.
  let lastStepMs = null;
  function step(dt) {
    simT += dt;
    lastStepMs = performance.now();

    let timing = false;
    let pct = 0;

    // timing decisions use WALL-clock elapsed — a throttled/hidden tab may
    // starve animation frames, but the countdown itself must stay honest.
    const wallElapsed = timerStartWall != null ? (performance.now() - timerStartWall) / 1000 : 0;

    if (mode === "on") {
      if (powered && !contactTimed) {
        timing = true;
        pct = Math.min(1, wallElapsed / setTime);
        if (wallElapsed >= setTime) {
          contactTimed = true;
          timerStartT = null;
          timerStartWall = null;
          timing = false;
          pct = 1;
        }
      } else if (contactTimed) {
        pct = 1;
      }
    } else {
      // off-delay
      if (!powered && contactTimed && timerStartWall != null) {
        timing = true;
        pct = Math.min(1, wallElapsed / setTime);
        if (wallElapsed >= setTime) {
          contactTimed = false;
          timerStartT = null;
          timerStartWall = null;
          timing = false;
          pct = 0;
          offReleased = true;   // hold completed — coach line celebrates + invites a re-run
        }
      } else if (contactTimed) {
        pct = 1;
      }
    }

    sample(contactTimed);
    updateFace(pct, timing, contactTimed);
    setLamp(contactTimed);
    updateCoach(timing, wallElapsed);
    scopeBadge.textContent = `t = ${simT.toFixed(1)}s`;

    // scroll the visible window: keep playhead near the right edge once past WINDOW
    let viewStart = 0;
    if (simT > WINDOW * 0.72) viewStart = simT - WINDOW * 0.72;
    applyScroll(viewStart);

    return timing || powered || contactTimed;
  }

  function tick(nowMs) {
    if (lastFrameMs == null) lastFrameMs = nowMs;
    // clamp: smooth at 60fps, but still makes real progress after a stall
    const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.25);
    lastFrameMs = nowMs;
    let cont = false;
    try { cont = step(dt); }
    finally { rafId = cont ? requestAnimationFrame(tick) : null; }
  }

  // WATCHDOG: requestAnimationFrame is throttled to a stop in hidden tabs and
  // under Chrome's Energy Saver (laptops on battery) — without this, the lamp,
  // flag, and scope all freeze and the timer "does nothing" even though the
  // state machine is fine. The interval keeps the simulation stepping whenever
  // rAF is starved, and cleans itself up once the view leaves the DOM.
  const watchdog = setInterval(() => {
    if (!root.isConnected) { clearInterval(watchdog); return; }
    const active = powered || contactTimed || timerStartT != null;
    if (!active) return;
    const now = performance.now();
    if (lastStepMs == null || now - lastStepMs > 400) {
      const dt = lastStepMs == null ? 0 : Math.min((now - lastStepMs) / 1000, 1.2);
      lastFrameMs = null;             // rAF resumes with a fresh delta, no double-count
      step(dt);
    }
  }, 300);

  // scrolling window support: redefine xForT to include an offset, rebuild axis+traces
  let scrollOffset = 0;
  function applyScroll(viewStart) {
    scrollOffset = viewStart;
    rebuildAxisScrolled();
    rebuildTracesScrolled();
  }
  function xForTScrolled(t) { return padL + ((t - scrollOffset) / WINDOW) * plotW; }
  function rebuildAxisScrolled() {
    while (axisGroup.firstChild) axisGroup.removeChild(axisGroup.firstChild);
    const step = 2;
    const startTick = Math.ceil(scrollOffset / step) * step;
    for (let s = startTick; s <= scrollOffset + WINDOW; s += step) {
      const x = xForTScrolled(s);
      if (x < padL - 1 || x > padL + plotW + 1) continue;
      axisGroup.appendChild(E("text", { class: "m21tm-axislabel", x, y: outY0 + rowH + 20, "text-anchor": "middle" }, `${s.toFixed(0)}s`));
    }
  }
  function rebuildTracesScrolled() {
    const visible = history.filter((s) => s.t >= scrollOffset - 0.5 && s.t <= scrollOffset + WINDOW + 0.5);
    if (visible.length === 0) {
      tracePathIn.setAttribute("d", "");
      tracePathOut.setAttribute("d", "");
      timerBand.setAttribute("width", "0");
      timerBandEdge.style.opacity = "0";
      playhead.setAttribute("x1", padL); playhead.setAttribute("x2", padL);
      return;
    }
    let dIn = "", dOut = "";
    visible.forEach((s, i) => {
      const x = xForTScrolled(s.t);
      const yIn = levelY(inY0, s.power ? 1 : 0);
      const yOut = levelY(outY0, s.contact ? 1 : 0);
      dIn += (i === 0 ? "M" : "L") + `${x},${yIn} `;
      dOut += (i === 0 ? "M" : "L") + `${x},${yOut} `;
    });
    // extend the last point to the current playhead (simT) for a "live sweep" feel
    const xNow = xForTScrolled(simT);
    const lastIn = visible[visible.length - 1];
    dIn += `L ${xNow},${levelY(inY0, lastIn.power ? 1 : 0)} `;
    dOut += `L ${xNow},${levelY(outY0, lastIn.contact ? 1 : 0)} `;
    tracePathIn.setAttribute("d", dIn.trim());
    tracePathOut.setAttribute("d", dOut.trim());
    playhead.setAttribute("x1", xNow); playhead.setAttribute("x2", xNow);

    if (timerStartT != null) {
      const x0 = xForTScrolled(timerStartT);
      const xEndTime = Math.min(simT, timerStartT + setTime);
      const x1 = xForTScrolled(xEndTime);
      timerBand.setAttribute("x", Math.max(padL, x0));
      timerBand.setAttribute("width", Math.max(0, x1 - Math.max(padL, x0)));
      const edgeX = xForTScrolled(timerStartT + setTime);
      timerBandEdge.setAttribute("x1", edgeX);
      timerBandEdge.setAttribute("x2", edgeX);
      timerBandEdge.style.opacity = (simT >= timerStartT + setTime || edgeX < padL || edgeX > padL + plotW) ? "0" : "0.7";
    } else {
      timerBand.setAttribute("width", "0");
      timerBandEdge.style.opacity = "0";
    }
  }

  // ---------------------------------------------------------------- init
  renderFactCards();
  resetCycle();
  applyScroll(0);

  // QA hook (mirrors the app's ?energize=1 / ?spot=N family):
  //   ?timer=off,demo  -> switch to OFF-DELAY, power ON at 0.3s, OFF at 1.5s
  //   ?timer=off,power -> switch to OFF-DELAY and apply power immediately
  // Lets headless verification drive the state machine without pointer events.
  const qaTimer = new URLSearchParams(location.search).get("timer");
  if (qaTimer) {
    const [qm, qs] = qaTimer.split(",");
    if (qm === "on" || qm === "off") setMode(qm);
    if (qs === "power") setPower(true);
    else if (qs === "demo") {
      setTimeout(() => setPower(true), 300);
      setTimeout(() => setPower(false), 1500);
    } else if (qs === "clicktest") {
      // diagnostic: exercise the REAL click path (hit-testing + listeners)
      setTimeout(() => {
        const report = {};
        const hit = (el) => {
          const r = el.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return at === el || el.contains(at) ? "self" : (at ? at.className || at.tagName : "null");
        };
        report.offBtnHit = hit(modeOffBtn);
        modeOffBtn.click();
        report.modeAfterClick = mode;
        report.powerBtnHit = hit(powerBtn);
        powerBtn.click();
        report.poweredAfterClick = powered;
        report.contactAfterPower = contactTimed;
        powerBtn.click();
        report.poweredAfterSecondClick = powered;
        report.holdingAfterDrop = contactTimed;
        document.title = "QA:" + JSON.stringify(report);
      }, 600);
    }
  }
}
