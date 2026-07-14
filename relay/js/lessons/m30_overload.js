// =============================================================================
// m30_overload.js — "THE OVERLOAD RELAY — the motor's bodyguard" trip lab.
//
// THE LESSON (grounded in the RW27-2D3-D063 cut sheet, app/assets/cutsheets/):
//   A thermal overload is MOTOR protection, not circuit protection. Motor
//   current flows through its heater elements; the heat bends a bi-metal
//   strip (the RW27 is bi-metallic, Trip Class 10, FLA dial 4.0–6.3 A,
//   aux contacts 1 N.O. + 1 N.C., local reset, phase-loss sensitive).
//   THE PUNCHLINE: when it trips, the overload does NOT break the motor
//   current. Its little 95-96 NC contact — wired IN SERIES WITH THE
//   CONTACTOR COIL — opens, the coil drops, and the CONTACTOR's main
//   contacts stop the motor. The 97-98 NO aux closes to light a TRIP lamp.
//
// WHAT THE LEARNER OPERATES:
//   • motor-load slider (× nameplate FLA) + the RW27's FLA dial (4.0–6.3 A)
//   • trip-class pick (10/20/30 — the real RW27-2D3-D063 is Class 10)
//   • live bimetal HEAT meter with a time-to-trip readout
//   • trip → 95-96 opens → coil drops → motor stops → RESET re-arms after
//     a cool-down (sim-compressed; a real bimetal can take minutes)
//   • manual vs AUTO reset × 3-wire vs 2-wire control — the auto-restart
//     hazard is demonstrated, not just described
//   • "lose phase L2" — single-phasing: two legs jump ~1.73×, and the
//     phase-loss-sensitive mechanism trips harder than current alone says
//   • a live "what the meter says" strip fed by the REAL solver — after a
//     trip, hold START and watch 24 V appear ACROSS the open 95-96 (the
//     hopscotch method from the troubleshooting lessons).
//
// SOLVER INTEGRATION (not a fake): every step runs solve() from solver.js on
// the same 3-wire circuit as this lesson's Schematic tab; a tripped OL is
// injected as fault {kind:"stuck_open"} on the 95-96 contact and
// {kind:"welded_closed"} on the 97-98 aux — the exact fault mechanics the
// troubleshooting labs use. Coil/latch/motor/lamp states and all the meter
// readings come straight out of the solver, never hand-animated logic.
//
// Engineering notes (m21/m22 patterns):
//   - timing decisions on WALL clock (performance.now); a watchdog interval
//     keeps stepping when rAF starves (hidden tab / Energy Saver);
//   - both loops self-clean once the view leaves the DOM;
//   - QA hooks: ?ol=trip  → 6× load, auto-START, pre-heated → deterministic
//                trip within ~1 s;  ?ol=run → auto-START at normal load.
//   - root exposes data-state = idle|running|overload|tripped|cooling and
//     data-tripped / data-heat for test assertions.
// Self-contained ES module. Every CSS class prefixed `m30ol-`.
// =============================================================================

import { solve } from "../solver.js";

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
  .m30ol-root{
    position:absolute; inset:0; display:flex; flex-direction:column;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--text,#303749);
    background:
      radial-gradient(1000px 440px at 88% -8%, rgba(245,158,11,.07), transparent 60%),
      radial-gradient(900px 420px at 4% 110%, rgba(59,130,246,.08), transparent 60%),
      var(--bg,#F6F8FC);
    overflow:auto;
    container-type:inline-size;
  }
  .m30ol-head{ padding:16px 24px 8px; flex:0 0 auto; }
  .m30ol-kicker{
    font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--blue-deep,#2563EB); display:flex; align-items:center; gap:9px;
  }
  .m30ol-kicker::before{ content:""; width:26px; height:2px; border-radius:2px;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); }
  .m30ol-title{
    margin:5px 0 2px; font-weight:800; font-size:21px; letter-spacing:-.02em;
    line-height:1.1; color:var(--ink,#0E1326);
  }
  .m30ol-sub{ font-size:13px; color:var(--muted,#6B7488); max-width:760px; line-height:1.4; }

  /* NO min-height:0 on the body: on a SHORT stage (980x820 app window keeps
     this overlay ~360px tall) the columns must keep their content height and
     the ROOT scrolls — never crush cards over each other. */
  .m30ol-body{ flex:1 1 auto; display:flex; gap:14px; padding:6px 24px 14px; }
  .m30ol-leftcol{ flex:0 0 302px; display:flex; flex-direction:column; gap:10px; }
  .m30ol-rightcol{ flex:1 1 auto; display:flex; flex-direction:column; gap:10px; min-width:0; }

  /* sticky guidance strip: the coach (and the hazard banner) stay pinned in
     the viewport while the tall content scrolls — feedback lands where the
     user is looking, at every window size. */
  .m30ol-pin{
    position:sticky; top:0; z-index:6; display:flex; flex-direction:column; gap:8px;
    padding:4px 24px 8px;
    background:linear-gradient(180deg, var(--bg,#F6F8FC) 78%, rgba(246,248,252,0));
    pointer-events:none;              /* the strip itself must never shield clicks… */
  }
  .m30ol-pin > *{ pointer-events:auto; }  /* …only its visible cards are solid */

  .m30ol-card{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:14px; box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.04));
    padding:10px 12px;
  }

  /* ---------------- station ---------------- */
  .m30ol-pushrow{ display:flex; gap:8px; }
  .m30ol-push{
    flex:1 1 0; border-radius:12px; padding:8px 4px 7px; cursor:pointer;
    border:1.5px solid var(--border-strong,#D6DDEC); background:var(--surface-2,#FBFCFE);
    display:flex; flex-direction:column; align-items:center; gap:4px;
    font-family:var(--font-display,sans-serif);
    transition:all .16s cubic-bezier(.2,.8,.25,1);
  }
  .m30ol-push > *{ pointer-events:none; }
  .m30ol-push:hover{ transform:translateY(-1px); }
  .m30ol-push:active .m30ol-cap{ transform:translateY(1.5px) scale(.93); }
  .m30ol-cap{
    width:32px; height:32px; border-radius:50%; transition:transform .08s ease;
    box-shadow:inset 0 -3px 5px rgba(0,0,0,.28), 0 3px 8px rgba(16,19,38,.25);
    border:3px solid #E3E8F2;
  }
  .m30ol-push-start .m30ol-cap{ background:radial-gradient(circle at 35% 30%, #4ADE80, #16A34A 75%); }
  .m30ol-push-stop  .m30ol-cap{ width:38px; background:radial-gradient(circle at 35% 30%, #F87171, #DC2626 75%); border-radius:50%/58%; }
  .m30ol-push-reset .m30ol-cap{ background:radial-gradient(circle at 35% 30%, #93C5FD, #2563EB 75%); border-radius:6px; width:30px; height:30px; }
  .m30ol-push b{ font-size:12px; letter-spacing:.05em; color:var(--ink,#0E1326); }
  .m30ol-push span{ font-family:var(--font-mono,monospace); font-size:10px; color:var(--muted,#6B7488); text-transform:uppercase; }
  .m30ol-push-start.is-latched{
    border-color:transparent; background:linear-gradient(135deg,#DCFCE7,#F0FDF4);
    box-shadow:0 0 0 2px rgba(34,197,94,.35), 0 8px 18px rgba(34,197,94,.2);
  }
  .m30ol-push-reset.is-dim{ opacity:.5; }
  .m30ol-push-reset.is-ready{
    border-color:transparent; background:linear-gradient(135deg,#DBEAFE,#EFF6FF);
    box-shadow:0 0 0 2px rgba(59,130,246,.4), 0 8px 18px rgba(59,130,246,.2);
  }
  .m30ol-push-reset.deny{ animation:m30ol-shake .3s; }
  @keyframes m30ol-shake{ 25%{transform:translateX(-3px)} 75%{transform:translateX(3px)} }

  /* ---------------- controls ---------------- */
  .m30ol-slidewrap{ margin-bottom:7px; }
  .m30ol-slidehead{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:3px; }
  .m30ol-slidehead-l{ font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.02em;
    text-transform:uppercase; color:var(--muted,#6B7488); }
  .m30ol-slidehead-l b{ color:var(--ink,#0E1326); }
  .m30ol-slidehead-v{ font-family:var(--font-mono,monospace); font-size:13px; font-weight:700; color:var(--amber-deep,#B45309); }
  .m30ol-slidehead-v.dial{ color:var(--blue-deep,#2563EB); }
  .m30ol-slider{
    -webkit-appearance:none; appearance:none; width:100%; height:6px; border-radius:4px;
    background:linear-gradient(90deg,#22C55E,#F59E0B 55%,#EF4444); outline:none; cursor:pointer;
  }
  .m30ol-slider.dial{ background:linear-gradient(90deg,#93C5FD,#2563EB); }
  .m30ol-slider::-webkit-slider-thumb{
    -webkit-appearance:none; appearance:none; width:17px; height:17px; border-radius:50%;
    background:#fff; border:3px solid #B45309; box-shadow:0 2px 8px rgba(20,30,60,.25); cursor:grab;
  }
  .m30ol-slider.dial::-webkit-slider-thumb{ border-color:#2563EB; }
  .m30ol-slider::-moz-range-thumb{
    width:17px; height:17px; border-radius:50%; background:#fff; border:3px solid #B45309;
    box-shadow:0 2px 8px rgba(20,30,60,.25); cursor:grab;
  }
  .m30ol-slider.dial::-moz-range-thumb{ border-color:#2563EB; }

  .m30ol-optrow{ display:flex; align-items:center; gap:6px; margin:7px 0 0; flex-wrap:wrap; }
  .m30ol-optlabel{ font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.02em;
    text-transform:uppercase; color:var(--muted,#6B7488); flex:0 0 auto; min-width:84px; }
  .m30ol-chipbtn{
    font-family:var(--font-mono,monospace); font-size:11.5px; font-weight:700; cursor:pointer;
    padding:4px 9px; border-radius:999px; border:1.5px solid var(--border-strong,#D6DDEC);
    background:var(--surface-2,#FBFCFE); color:var(--muted,#6B7488); transition:all .14s ease;
  }
  .m30ol-chipbtn:hover{ border-color:#AEB7C9; }
  .m30ol-chipbtn.active{ background:#EFF6FF; border-color:var(--blue,#3B82F6); color:var(--blue-deep,#2563EB); }
  .m30ol-chipbtn.active.warn{ background:#FEF2F2; border-color:#EF4444; color:#B91C1C; }
  .m30ol-note{ font-size:11px; color:var(--muted,#6B7488); margin-top:6px; line-height:1.35; }

  /* ---------------- ladder ---------------- */
  .m30ol-laddercard{ flex:1 1 auto; min-height:284px; display:flex; flex-direction:column; padding:8px 10px 6px; }
  .m30ol-ladderlabel{
    font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.06em;
    text-transform:uppercase; color:var(--muted,#6B7488); text-align:center; padding:1px 0 3px;
  }
  .m30ol-laddercard svg{ width:100%; height:100%; flex:1 1 auto; min-height:0; display:block; }

  /* ---------------- coach ---------------- */
  .m30ol-coach{
    display:flex; align-items:center; gap:10px; flex:0 0 auto;
    padding:9px 13px; border-radius:12px;
    background:linear-gradient(135deg, rgba(245,158,11,.14), rgba(59,130,246,.10));
    border:1.5px solid #F59E0B;
    box-shadow:0 4px 16px rgba(245,158,11,.18);
  }
  .m30ol-coach-k{
    flex:0 0 auto; font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:#fff; background:linear-gradient(135deg,#F59E0B,#EF4444);
    padding:4px 10px; border-radius:999px; white-space:nowrap;
  }
  .m30ol-coach-t{ font-size:13px; font-weight:700; line-height:1.32; color:#92400E; }
  .m30ol-coach-t b{ color:var(--ink,#0E1326); }
  .m30ol-coach-cd{ font-family:var(--font-mono,monospace); font-weight:800; color:#B45309; font-variant-numeric:tabular-nums; }

  .m30ol-banner{
    display:none; align-items:center; gap:10px; padding:9px 13px; border-radius:12px;
    background:#FEF2F2; border:2px solid #EF4444; color:#991B1B;
    font-size:13px; font-weight:800; line-height:1.3;
    box-shadow:0 6px 18px rgba(239,68,68,.25);
  }
  .m30ol-banner.show{ display:flex; animation:m30ol-bpulse 1s ease 2; }
  @keyframes m30ol-bpulse{ 50%{ box-shadow:0 0 0 5px rgba(239,68,68,.25);} }

  /* ---------------- overload device panel ---------------- */
  .m30ol-olrow{ display:flex; gap:12px; flex:1 1 auto; min-height:296px; }
  .m30ol-olcard{ flex:1.25 1 0; display:flex; flex-direction:column; min-width:0; }
  .m30ol-mcard{ flex:1 1 0; display:flex; flex-direction:column; min-width:0; }
  .m30ol-cardtitle{ display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .m30ol-cardtitle b{ font-size:13px; color:var(--ink,#0E1326); }
  .m30ol-statuschip{
    font-family:var(--font-mono,monospace); font-size:10.5px; font-weight:700; letter-spacing:.06em;
    text-transform:uppercase; padding:3px 9px; border-radius:999px;
    background:#EEF2FB; border:1px solid #D6DDEC; color:#4B5468;
  }
  .m30ol-statuschip.run{ background:#DCFCE7; border-color:#22C55E; color:#15803D; }
  .m30ol-statuschip.hot{ background:#FEF3C7; border-color:#F59E0B; color:#92400E; }
  .m30ol-statuschip.trip{ background:#FEE2E2; border-color:#EF4444; color:#B91C1C; }
  .m30ol-olsvgwrap{ flex:1 1 auto; min-height:158px; }
  .m30ol-olsvgwrap svg, .m30ol-msvgwrap svg{ width:100%; height:100%; display:block; }
  .m30ol-msvgwrap{ flex:1 1 auto; min-height:138px; }

  .m30ol-heatwrap{ margin-top:6px; }
  .m30ol-heathead{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:3px; }
  .m30ol-heathead span{ font-family:var(--font-mono,monospace); font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; color:var(--muted,#6B7488); }
  .m30ol-heathead b{ font-family:var(--font-mono,monospace); font-size:13px; color:#B45309; font-variant-numeric:tabular-nums; }
  .m30ol-heatbar{ position:relative; height:14px; border-radius:8px; background:#EEF2FB; border:1px solid #D6DDEC; overflow:hidden; }
  .m30ol-heatfill{ position:absolute; inset:0 auto 0 0; width:0%; border-radius:8px 0 0 8px;
    background:linear-gradient(90deg,#22C55E,#F59E0B 62%,#EF4444); transition:width .12s linear; }
  .m30ol-heatmark{ position:absolute; top:-3px; bottom:-3px; width:2px; background:#B91C1C; left:100%; }
  .m30ol-heatmark.cool{ background:#2563EB; }
  .m30ol-heatlegend{ display:flex; justify-content:space-between; font-family:var(--font-mono,monospace); font-size:10px; color:var(--muted,#6B7488); margin-top:2px; }
  .m30ol-ttt{ font-family:var(--font-mono,monospace); font-size:11.5px; font-weight:700; color:#B45309; margin-top:4px; min-height:15px; }

  .m30ol-legchips{ display:flex; gap:6px; margin-top:6px; }
  .m30ol-legchip{ flex:1 1 0; text-align:center; font-family:var(--font-mono,monospace); font-size:11px; font-weight:700;
    padding:4px 2px; border-radius:8px; background:#EEF2FB; border:1px solid #D6DDEC; color:#334155; }
  .m30ol-legchip.dead{ background:#FEE2E2; border-color:#EF4444; color:#B91C1C; }
  .m30ol-legchip.hi{ background:#FEF3C7; border-color:#F59E0B; color:#92400E; }
  .m30ol-legchip small{ display:block; font-size:9px; font-weight:700; letter-spacing:.08em; color:var(--muted,#6B7488); }

  /* ---------------- meter strip ---------------- */
  .m30ol-metercard{ flex:0 0 auto; }
  .m30ol-meterrows{ display:grid; grid-template-columns:1fr 1fr; gap:5px 10px; margin-top:4px; }
  .m30ol-mrow{
    display:flex; justify-content:space-between; align-items:center; gap:8px;
    font-family:var(--font-mono,monospace); font-size:11.5px; color:#334155;
    background:#F8FAFF; border:1px solid #E6EAF3; border-radius:8px; padding:4px 9px;
  }
  .m30ol-mrow b{ font-size:13px; font-variant-numeric:tabular-nums; color:var(--ink,#0E1326); }
  .m30ol-mrow.tell{ background:#FEF3C7; border-color:#F59E0B; }
  .m30ol-mrow.tell b{ color:#B45309; }
  .m30ol-meternote{ font-size:11px; color:var(--muted,#6B7488); margin-top:5px; line-height:1.35; }

  /* short shells (the 980x820 --app window leaves this stage ~360px tall):
     compact the chrome so the lab itself owns the scrollport */
  @media (max-height: 880px){
    .m30ol-head{ padding:10px 24px 3px; }
    .m30ol-sub{ display:none; }
    .m30ol-title{ font-size:17px; }
    .m30ol-pin{ padding:2px 24px 6px; }
    .m30ol-coach{ padding:6px 11px; }
    .m30ol-coach-t{ font-size:12px; }
  }

  @container (max-width: 739px){
    .m30ol-body{ flex-direction:column; }
    .m30ol-leftcol{ flex:0 0 auto; width:100%; }
    .m30ol-laddercard{ flex:0 0 auto; height:330px; }
    .m30ol-rightcol{ flex:0 0 auto; }
    .m30ol-olrow{ flex-direction:column; }
    .m30ol-olsvgwrap{ height:240px; flex:0 0 auto; }
    .m30ol-msvgwrap{ height:210px; flex:0 0 auto; }
  }
  `;
  host.appendChild(style);

  // ---------------------------------------------------------------- scaffold
  const root = document.createElement("div");
  root.className = "m30ol-root";
  host.appendChild(root);

  root.innerHTML = `
    <div class="m30ol-head">
      <div class="m30ol-kicker">Intermediate &middot; the motor's bodyguard</div>
      <h2 class="m30ol-title">Trip the Overload &mdash; and See What It Actually Opens</h2>
      <div class="m30ol-sub">Load the motor past the dial and the heaters warm the bimetal until it TRIPS. Watch what opens:
        not the motor wires &mdash; the little <b>95-96</b> contact in the <b>coil</b> rung. The contactor does the stopping.
        Then meter the string, let it cool, and <b>RESET</b>.</div>
    </div>
    <div class="m30ol-pin">
      <div class="m30ol-coach"><span class="m30ol-coach-k">Next step</span><span class="m30ol-coach-t" id="m30ol-coach-t"></span></div>
      <div class="m30ol-banner" id="m30ol-banner">THE MOTOR JUST RESTARTED BY ITSELF &mdash; nobody pressed anything. AUTO reset + 2-wire control re-closes the circuit as soon as the bimetal cools. If someone had their hands in that machine&hellip; This is why auto reset on an attended machine is a hazard.</div>
    </div>
    <div class="m30ol-body">
      <div class="m30ol-leftcol">
        <div class="m30ol-card">
          <div class="m30ol-pushrow">
            <button class="m30ol-push m30ol-push-start" id="m30ol-start">
              <span class="m30ol-cap"></span><b id="m30ol-start-b">START</b><span id="m30ol-start-s">NO &middot; momentary</span>
            </button>
            <button class="m30ol-push m30ol-push-stop" id="m30ol-stop">
              <span class="m30ol-cap"></span><b>STOP</b><span>NC &middot; momentary</span>
            </button>
            <button class="m30ol-push m30ol-push-reset is-dim" id="m30ol-reset">
              <span class="m30ol-cap"></span><b>RESET OL</b><span>local &middot; on the RW27</span>
            </button>
          </div>
        </div>
        <div class="m30ol-card">
          <div class="m30ol-slidewrap">
            <div class="m30ol-slidehead">
              <span class="m30ol-slidehead-l"><b>Motor load</b> &middot; nameplate FLA 6.1&thinsp;A</span>
              <span class="m30ol-slidehead-v" id="m30ol-load-v">1.0&times; &middot; 6.1&thinsp;A</span>
            </div>
            <input type="range" class="m30ol-slider" id="m30ol-load-sl" min="0.5" max="8" step="0.1" value="1">
          </div>
          <div class="m30ol-slidewrap">
            <div class="m30ol-slidehead">
              <span class="m30ol-slidehead-l"><b>RW27 FLA dial</b> &middot; 4.0&ndash;6.3&thinsp;A adjustable</span>
              <span class="m30ol-slidehead-v dial" id="m30ol-dial-v">6.1&thinsp;A</span>
            </div>
            <input type="range" class="m30ol-slider dial" id="m30ol-dial-sl" min="4" max="6.3" step="0.1" value="6.1">
          </div>
          <div class="m30ol-optrow">
            <span class="m30ol-optlabel">Trip class</span>
            <button class="m30ol-chipbtn active" data-class="10">10</button>
            <button class="m30ol-chipbtn" data-class="20">20</button>
            <button class="m30ol-chipbtn" data-class="30">30</button>
          </div>
          <div class="m30ol-optrow">
            <span class="m30ol-optlabel">Reset mode</span>
            <button class="m30ol-chipbtn active" data-reset="manual">MANUAL</button>
            <button class="m30ol-chipbtn" data-reset="auto">AUTO</button>
          </div>
          <div class="m30ol-optrow">
            <span class="m30ol-optlabel">Control</span>
            <button class="m30ol-chipbtn active" data-scheme="3wire">3-WIRE</button>
            <button class="m30ol-chipbtn" data-scheme="2wire">2-WIRE</button>
            <button class="m30ol-chipbtn" id="m30ol-phase">DROP PHASE L2</button>
          </div>
          <div class="m30ol-note" id="m30ol-optnote">The real RW27-2D3-D063 is <b>Class 10</b> with a local reset &mdash; class 20/30 are here so you can feel the difference (higher class = more start time before trip, for high-inertia loads).</div>
        </div>
        <div class="m30ol-card m30ol-laddercard">
          <div class="m30ol-ladderlabel">Live ladder &middot; the coil rung vs the power path</div>
          <div id="m30ol-laddersvgwrap" style="flex:1 1 auto; min-height:0;"></div>
        </div>
      </div>
      <div class="m30ol-rightcol">
        <div class="m30ol-olrow">
          <div class="m30ol-card m30ol-olcard">
            <div class="m30ol-cardtitle"><b>RW27 thermal overload &middot; bi-metallic</b><span class="m30ol-statuschip" id="m30ol-olchip">COLD</span></div>
            <div class="m30ol-olsvgwrap" id="m30ol-olsvgwrap"></div>
            <div class="m30ol-heatwrap">
              <div class="m30ol-heathead"><span>Bimetal heat</span><b id="m30ol-heat-v">0%</b></div>
              <div class="m30ol-heatbar">
                <div class="m30ol-heatfill" id="m30ol-heatfill"></div>
                <div class="m30ol-heatmark cool" style="left:35%" title="cool enough to reset"></div>
                <div class="m30ol-heatmark" style="left:calc(100% - 2px)" title="TRIP"></div>
              </div>
              <div class="m30ol-heatlegend"><span>cold</span><span>reset-ready 35%</span><span>TRIP 100%</span></div>
              <div class="m30ol-ttt" id="m30ol-ttt"></div>
            </div>
          </div>
          <div class="m30ol-card m30ol-mcard">
            <div class="m30ol-cardtitle"><b>Motor &middot; through the heaters</b><span class="m30ol-statuschip" id="m30ol-mchip">STOPPED</span></div>
            <div class="m30ol-msvgwrap" id="m30ol-msvgwrap"></div>
            <div class="m30ol-legchips">
              <span class="m30ol-legchip" id="m30ol-leg1"><small>L1</small>0.0 A</span>
              <span class="m30ol-legchip" id="m30ol-leg2"><small>L2</small>0.0 A</span>
              <span class="m30ol-legchip" id="m30ol-leg3"><small>L3</small>0.0 A</span>
            </div>
          </div>
        </div>
        <div class="m30ol-card m30ol-metercard">
          <div class="m30ol-cardtitle"><b>What the meter says right now</b><span class="m30ol-statuschip" id="m30ol-meterchip">LIVE &middot; from the solver</span></div>
          <div class="m30ol-meterrows">
            <div class="m30ol-mrow" id="m30ol-r-stop"><span>across S1 STOP</span><b>0.0 V</b></div>
            <div class="m30ol-mrow" id="m30ol-r-start"><span>across S2 START</span><b>0.0 V</b></div>
            <div class="m30ol-mrow" id="m30ol-r-coil"><span>across M1 coil A1&rarr;A2</span><b>0.0 V</b></div>
            <div class="m30ol-mrow" id="m30ol-r-ol"><span>across OL1 95&rarr;96</span><b>0.0 V</b></div>
          </div>
          <div class="m30ol-meternote" id="m30ol-meternote">Hopscotch rule: a closed contact reads ~0&thinsp;V across it; the FULL supply appears across whatever is open in the string.</div>
        </div>
      </div>
    </div>
  `;

  // =================================================================
  // THE CIRCUIT — same topology as this lesson's Schematic tab
  // (data/lessons/30_overload.json). solve() runs on THIS object; a trip is
  // injected as real fault objects, exactly like the troubleshooting labs.
  // =================================================================
  const circuit = {
    id: "m30_trip_lab",
    nodes: [
      { id: "L", x: 0, y: 0 }, { id: "n1", x: 0, y: 0 }, { id: "n2", x: 0, y: 0 },
      { id: "n3", x: 0, y: 0 }, { id: "n95", x: 0, y: 0 }, { id: "nMtr", x: 0, y: 0 },
      { id: "nTL", x: 0, y: 0 }, { id: "N", x: 0, y: 0 },
    ],
    components: [
      { id: "SRC", type: "source", current: "DC", volts: 24, terminals: { pos: "L", neg: "N" } },
      { id: "FU1", type: "fuse", ratingA: 1, terminals: { a: "L", b: "n1" } },
      { id: "S1", type: "pushbutton", mode: "momentary", contact: "NC", terminals: { in: "n1", out: "n2" } },
      { id: "S2", type: "pushbutton", mode: "momentary", contact: "NO", terminals: { in: "n2", out: "n3" } },
      { id: "SEAL", type: "contact_no", coil: "M1", terminals: { in: "n2", out: "n3" } },
      { id: "M1", type: "coil", ratedVolts: 24, ratedCurrent: "DC", terminals: { a: "n3", b: "n95" } },
      { id: "OL9596", type: "contact_nc", coil: null, terminals: { in: "n95", out: "N" } },
      { id: "M1MAIN", type: "contact_no", coil: "M1", terminals: { in: "n2", out: "nMtr" } },
      { id: "MTR", type: "motor", terminals: { a: "nMtr", b: "N" } },
      { id: "OL9798", type: "contact_no", coil: null, terminals: { in: "n1", out: "nTL" } },
      { id: "PL1", type: "bulb", terminals: { a: "nTL", b: "N" } },
    ],
  };
  const comp = (id) => circuit.components.find((c) => c.id === id);

  // =================================================================
  // STATE + the thermal model
  //
  // Bi-metal heat is first-order: dh/dt = (h_inf - h)/tau.
  //   h_inf = 0.72 * (I / dial)^2  while the motor runs, 0 when stopped.
  //     -> at 100% of dial the strip settles at 72% heat: warm, never trips.
  //     -> crosses trip (h_inf = 1.0) just under 1.2x dial — the classic
  //        "ultimate trip around 120%" behavior of a thermal OL.
  //   tau_heat = classSec / ln(h6/(h6-1)) with h6 = 0.72*36 = 25.92, so a
  //     6x-dial overload trips in EXACTLY the class time (Class 10 -> 10 s at
  //     6x FLA — the definition of trip class).
  //   Cool-down is sim-compressed (tau 6 s; a real bimetal can take minutes —
  //     said out loud in the coach so nobody expects a 6-second reset on the floor).
  // =================================================================
  const FLA_NAMEPLATE = 6.1;          // our example motor's nameplate FLA (A)
  const K_EQ = 0.72;
  const RESET_OK = 0.35;
  const TAU_COOL = 6;
  let loadMult = 1.0;                 // motor load, x nameplate FLA
  let dialA = 6.1;                    // RW27 dial setting (4.0–6.3 A)
  let classSec = 10;                  // trip class (10/20/30)
  let resetMode = "manual";
  let scheme = "3wire";
  let phaseLoss = false;
  let tripped = false;
  let heat = 0;                       // 0..1  (1 = trip)
  let pressed = new Set();            // solver input (S1/S2 held)
  let prevCoil = new Map();           // solver latch memory
  let maintainedOn = false;           // 2-wire RUN switch state
  let solved = null;
  let tripCount = 0;
  let lastResetWasAuto = false;
  let bannerUntil = 0;
  let transientMsg = "", transientUntil = 0;
  let everStarted = false;
  let rafId = null, lastFrameMs = null, lastStepMs = null;
  let motorSpin = 0, motorSpeed = 0;

  const tauHeat = () => {
    const h6 = K_EQ * 36;
    return classSec / Math.log(h6 / (h6 - 1));     // ≈ 25.4 x classSec
  };
  const legAmps = () => {
    const on = solved && solved.loadOn.get("MTR");
    if (!on) return [0, 0, 0];
    const base = loadMult * FLA_NAMEPLATE;
    return phaseLoss ? [base * 1.73, 0, base * 1.73] : [base, base, base];
  };

  function runSolver() {
    comp("OL9596").fault = tripped ? { kind: "stuck_open" } : undefined;
    comp("OL9798").fault = tripped ? { kind: "welded_closed" } : undefined;
    solved = solve(circuit, { pressed, prevCoil });
    prevCoil = solved.coilEnergized;
  }

  // =================================================================
  // LADDER (SVG) — coil rung with 95-96, POWER path with real heater
  // elements, and the 97-98 trip-light rung.
  // =================================================================
  const ladSvg = E("svg", { viewBox: "0 0 264 232", preserveAspectRatio: "xMidYMid meet" });
  root.querySelector("#m30ol-laddersvgwrap").appendChild(ladSvg);

  const WIRE = "#A6B0C3", HOT = "#3B82F6", BAR = "#475569", PWR = "#B45309";
  const L1X = 14, L2X = 250;
  ladSvg.appendChild(E("line", { x1: L1X, y1: 16, x2: L1X, y2: 222, stroke: BAR, "stroke-width": 2.4 }));
  ladSvg.appendChild(E("line", { x1: L2X, y1: 16, x2: L2X, y2: 222, stroke: BAR, "stroke-width": 2.4 }));
  ladSvg.appendChild(E("text", { x: L1X, y: 11, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 10, "font-weight": 700, fill: "#5A6478" }, "L1"));
  ladSvg.appendChild(E("text", { x: L2X, y: 11, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 10, "font-weight": 700, fill: "#5A6478" }, "L2"));

  const wireGroup = E("g", { stroke: WIRE, "stroke-width": 1.6, fill: "none", "stroke-linecap": "round" });
  const hotGroups = {};
  ladSvg.appendChild(wireGroup);
  function wires(hotName, segs, hotColor) {
    let hg = hotGroups[hotName];
    if (!hg) {
      hg = E("g", { stroke: hotColor || HOT, "stroke-width": 2.5, fill: "none", "stroke-linecap": "round", opacity: 0 });
      hg.style.transition = "opacity .15s ease";
      hotGroups[hotName] = hg;
    }
    for (const pts of segs) {
      const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
      wireGroup.appendChild(E("path", { d }));
      hg.appendChild(E("path", { d }));
    }
  }
  function mkContact(x, y, label, opts = {}) {
    const g = E("g");
    const mk = (a) => { const l = E("line", a); g.appendChild(l); return l; };
    const lead1 = mk({ x1: x - 12, y1: y, x2: x - 5, y2: y, stroke: WIRE, "stroke-width": 1.6 });
    const lead2 = mk({ x1: x + 5, y1: y, x2: x + 12, y2: y, stroke: WIRE, "stroke-width": 1.6 });
    const bar1 = mk({ x1: x - 5, y1: y - 7, x2: x - 5, y2: y + 7, stroke: BAR, "stroke-width": 2 });
    const bar2 = mk({ x1: x + 5, y1: y - 7, x2: x + 5, y2: y + 7, stroke: BAR, "stroke-width": 2 });
    const bridge = mk({ x1: x - 5, y1: y, x2: x + 5, y2: y, stroke: BAR, "stroke-width": 2.3 });
    bridge.style.transition = "opacity .12s ease";
    let slash = null;
    if (opts.nc) slash = mk({ x1: x - 9, y1: y + 9, x2: x + 9, y2: y - 9, stroke: BAR, "stroke-width": 1.6 });
    const lab = E("text", { x, y: y - 12, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 10.5, "font-weight": 700, fill: "#3D4557" }, label);
    g.appendChild(lab);
    ladSvg.appendChild(g);
    return {
      g, lab,
      set(closed, hot) {
        bridge.style.opacity = closed ? "1" : "0";
        const col = hot ? (opts.hotColor || HOT) : BAR;
        bar1.setAttribute("stroke", col); bar2.setAttribute("stroke", col);
        bridge.setAttribute("stroke", col);
        if (slash) slash.setAttribute("stroke", col);
        const wcol = hot ? (opts.hotColor || HOT) : WIRE;
        lead1.setAttribute("stroke", wcol); lead2.setAttribute("stroke", wcol);
      },
    };
  }
  function mkCoil(x, y, txt, tag, color, motor = false) {
    const g = E("g");
    const circ = E("circle", { cx: x, cy: y, r: 12, fill: "#FFFFFF", stroke: "#64748B", "stroke-width": 1.7 });
    circ.style.transition = "all .15s ease";
    g.appendChild(circ);
    const t = E("text", { x, y: y + (motor ? 4 : 3.4), "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": motor ? 11.5 : 9.5, "font-weight": 800, fill: "#334155" }, txt);
    g.appendChild(t);
    g.appendChild(E("text", { x, y: y + 23, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 10, "font-weight": 700, fill: "#5A6478" }, tag));
    ladSvg.appendChild(g);
    return {
      set(on) {
        circ.setAttribute("stroke", on ? color : "#64748B");
        circ.setAttribute("fill", on ? color + "22" : "#FFFFFF");
        circ.style.filter = on ? `drop-shadow(0 0 4px ${color}88)` : "none";
      },
    };
  }
  // heater element: the proper zigzag thermal-element symbol, drawn hot-orange
  function mkHeater(x, y) {
    const g = E("g");
    const zig = E("path", {
      d: `M ${x - 14},${y} l 4,0 l 3,-6 l 5,12 l 5,-12 l 5,12 l 3,-6 l 3,0`,
      stroke: PWR, "stroke-width": 2, fill: "none", "stroke-linejoin": "round",
    });
    zig.style.transition = "all .2s ease";
    g.appendChild(zig);
    g.appendChild(E("text", { x, y: y - 12, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 10.5, "font-weight": 700, fill: "#92400E" }, "OL1 heaters"));
    ladSvg.appendChild(g);
    return {
      set(glow) {
        zig.setAttribute("stroke", glow > 0.55 ? "#EF4444" : PWR);
        zig.style.filter = glow > 0.15 ? `drop-shadow(0 0 ${(glow * 5).toFixed(1)}px rgba(239,68,68,${Math.min(0.9, glow).toFixed(2)}))` : "none";
      },
    };
  }

  const R1 = 42, RB = 72, R2 = 128, R3 = 192;
  // rung 1 (coil): STOP — START(∥seal) — (M1) — OL 95-96 — L2
  wires("r1", [
    [[L1X, R1], [30, R1]], [[54, R1], [84, R1]], [[110, R1], [136, R1]],
    [[160, R1], [186, R1]], [[210, R1], [L2X, R1]],
  ]);
  wires("rb", [[[64, R1], [64, RB], [84, RB]], [[110, RB], [124, RB], [124, R1]]]);
  ladSvg.appendChild(E("circle", { cx: 64, cy: R1, r: 2, fill: BAR }));
  ladSvg.appendChild(E("circle", { cx: 124, cy: R1, r: 2, fill: BAR }));
  // rung 2 (POWER): M1 main — heaters — (MOTOR)
  wires("r2", [[[L1X, R2], [46, R2]], [[70, R2], [96, R2]], [[124, R2], [186, R2]], [[210, R2], [L2X, R2]]], PWR);
  // rung 3 (trip light): OL 97-98 — (TRIP lamp)
  wires("r3", [[[L1X, R3], [46, R3]], [[70, R3], [186, R3]], [[210, R3], [L2X, R3]]], "#D97706");
  for (const hg of Object.values(hotGroups)) ladSvg.appendChild(hg);

  const cStop = mkContact(42, R1, "STOP", { nc: true });
  const cStart = mkContact(97, R1, "START");
  const cSeal = mkContact(97, RB, "M1");
  const cOL = mkContact(198, R1, "OL1 95-96", { nc: true, hotColor: HOT });
  const koM1 = mkCoil(148, R1, "M1", "COIL", "#10B981");
  const cMain = mkContact(58, R2, "M1 main", { hotColor: PWR });
  const htr = mkHeater(110, R2);
  const koMtr = mkCoil(198, R2, "M", "MOTOR", "#B45309", true);
  const cAux = mkContact(58, R3, "OL1 97-98");
  const koTrip = mkCoil(198, R3, "TL", "TRIP LAMP", "#F59E0B");
  ladSvg.appendChild(E("text", { x: 110, y: R2 + 36, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 9.5, fill: "#8A93A8" }, "heaters carry the MOTOR current"));
  // the 24V-across-the-open callout chip (appears on a trip)
  const olVoltTag = E("text", { x: 198, y: R1 + 24, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 10.5, "font-weight": 800, fill: "#B91C1C", opacity: 0 }, "");
  ladSvg.appendChild(olVoltTag);

  // =================================================================
  // OVERLOAD DEVICE (SVG) — heaters, bending bimetal, latch, 95-96 & 97-98
  // =================================================================
  const olSvg = E("svg", { viewBox: "0 0 300 224", preserveAspectRatio: "xMidYMid meet" });
  root.querySelector("#m30ol-olsvgwrap").appendChild(olSvg);
  olSvg.appendChild(E("rect", { x: 8, y: 8, width: 284, height: 208, rx: 12, fill: "#F2F5FB", stroke: "#C7CEDD", "stroke-width": 1.5 }));
  olSvg.appendChild(E("text", { x: 20, y: 28, "font-family": "var(--font-mono,monospace)", "font-size": 11, "font-weight": 800, fill: "#0E1326" }, "RW27-2D3-D063"));
  olSvg.appendChild(E("text", { x: 20, y: 42, "font-family": "var(--font-mono,monospace)", "font-size": 9.5, fill: "#5A6478" }, "4.0–6.3 A · Class 10 · bi-metallic"));

  // three heater elements (T1/T2/T3 power path, drawn vertically)
  const devHeaters = [];
  [70, 120, 170].forEach((hx, i) => {
    olSvg.appendChild(E("text", { x: hx, y: 62, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 9, fill: "#5A6478" }, ["2/T1", "4/T2", "6/T3"][i]));
    const z = E("path", {
      d: `M ${hx},66 l 0,6 l -6,4 l 12,7 l -12,7 l 12,7 l -6,4 l 0,6`,
      stroke: "#B45309", "stroke-width": 2.4, fill: "none", "stroke-linejoin": "round",
    });
    z.style.transition = "all .2s ease";
    olSvg.appendChild(z);
    devHeaters.push(z);
  });
  // bimetal strip: anchored at left, bends toward the latch as heat rises
  const biG = E("g");
  const biStrip = E("path", { d: "", stroke: "#64748B", "stroke-width": 5, fill: "none", "stroke-linecap": "round" });
  biG.appendChild(biStrip);
  olSvg.appendChild(biG);
  olSvg.appendChild(E("text", { x: 64, y: 136, "font-family": "var(--font-mono,monospace)", "font-size": 9.5, fill: "#5A6478" }, "bimetal strip"));
  // trip latch + moving contact bars
  const latch = E("rect", { x: 216, y: 108, width: 8, height: 26, rx: 2, fill: "#475569" });
  olSvg.appendChild(latch);
  olSvg.appendChild(E("text", { x: 246, y: 104, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 9.5, fill: "#5A6478" }, "latch"));

  // 95-96 (NC) and 97-98 (NO) contact pairs at the bottom
  function devContact(x, y, lbl, nc) {
    const g = E("g");
    g.appendChild(E("circle", { cx: x - 12, cy: y, r: 3, fill: "#334155" }));
    g.appendChild(E("circle", { cx: x + 12, cy: y, r: 3, fill: "#334155" }));
    const bar = E("line", { x1: x - 12, y1: y, x2: x + 12, y2: y, stroke: "#334155", "stroke-width": 3, "stroke-linecap": "round" });
    bar.style.transition = "transform .14s ease, opacity .14s ease";
    bar.style.transformOrigin = `${x - 12}px ${y}px`;
    g.appendChild(bar);
    g.appendChild(E("text", { x, y: y + 18, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 10, "font-weight": 700, fill: "#3D4557" }, lbl));
    olSvg.appendChild(g);
    return {
      set(closed) { bar.style.transform = closed ? "rotate(0deg)" : "rotate(-22deg)"; bar.setAttribute("stroke", closed ? "#334155" : "#B91C1C"); },
    };
  }
  const dev9596 = devContact(80, 176, "95–96 NC → coil rung", true);
  const dev9798 = devContact(220, 176, "97–98 NO → trip light", false);
  const devTripTxt = E("text", { x: 150, y: 210, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 9.5, "font-weight": 800, fill: "#B91C1C", opacity: 0 }, "TRIPPED — the COIL rung opened, not the motor wires");
  olSvg.appendChild(devTripTxt);

  function updateDevice(mult, running) {
    const glow = running ? Math.min(1, Math.max(0, (mult - 0.4) / 3)) : 0;
    for (const z of devHeaters) {
      z.setAttribute("stroke", glow > 0.5 ? "#EF4444" : "#B45309");
      z.style.filter = glow > 0.12 ? `drop-shadow(0 0 ${(glow * 6).toFixed(1)}px rgba(239,68,68,${Math.min(0.9, glow)}))` : "none";
    }
    // strip bends right with heat; at trip it pushes the latch over
    const bend = 42 * Math.min(1.04, heat);
    biStrip.setAttribute("d", `M 30,122 C 90,122 150,${122} ${175 + bend * 0.35},${122 - bend * 0.12}`);
    biStrip.setAttribute("stroke", heat > 0.75 ? "#B45309" : heat > 0.4 ? "#8A7550" : "#64748B");
    latch.setAttribute("x", tripped ? 232 : 216);
    latch.setAttribute("fill", tripped ? "#B91C1C" : "#475569");
    dev9596.set(!tripped);
    dev9798.set(tripped);
    devTripTxt.setAttribute("opacity", tripped ? 1 : 0);
  }

  // =================================================================
  // MOTOR PANEL (SVG) — spinning rotor + shaft load
  // =================================================================
  const mSvg = E("svg", { viewBox: "0 0 260 200", preserveAspectRatio: "xMidYMid meet" });
  root.querySelector("#m30ol-msvgwrap").appendChild(mSvg);
  mSvg.appendChild(E("rect", { x: 30, y: 46, width: 130, height: 104, rx: 14, fill: "#E2E7F1", stroke: "#AEB7C9", "stroke-width": 2 }));
  for (let i = 0; i < 5; i++) mSvg.appendChild(E("line", { x1: 40 + i * 22, y1: 46, x2: 34 + i * 22, y2: 36, stroke: "#AEB7C9", "stroke-width": 3, "stroke-linecap": "round" }));
  mSvg.appendChild(E("rect", { x: 160, y: 90, width: 34, height: 16, rx: 4, fill: "#8A93A8" }));
  const rotor = E("g");
  rotor.appendChild(E("circle", { cx: 216, cy: 98, r: 26, fill: "#DCE4F2", stroke: "#4B5468", "stroke-width": 2.5 }));
  const spokes = E("g", { stroke: "#4B5468", "stroke-width": 3, "stroke-linecap": "round" });
  spokes.appendChild(E("line", { x1: 216 - 18, y1: 98, x2: 216 + 18, y2: 98 }));
  spokes.appendChild(E("line", { x1: 216, y1: 98 - 18, x2: 216, y2: 98 + 18 }));
  rotor.appendChild(spokes);
  mSvg.appendChild(rotor);
  mSvg.appendChild(E("text", { x: 95, y: 105, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 22, "font-weight": 800, fill: "#334155" }, "M"));
  mSvg.appendChild(E("text", { x: 95, y: 126, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 9.5, fill: "#5A6478" }, "nameplate FLA 6.1 A"));
  const runLamp = E("circle", { cx: 46, cy: 26, r: 8, fill: "#D3D9E6", stroke: "#AEB7C9", "stroke-width": 2 });
  mSvg.appendChild(runLamp);
  mSvg.appendChild(E("text", { x: 60, y: 30, "font-family": "var(--font-mono,monospace)", "font-size": 10, "font-weight": 700, fill: "#5A6478" }, "RUN"));
  const tripLampEl = E("circle", { cx: 130, cy: 26, r: 8, fill: "#D3D9E6", stroke: "#AEB7C9", "stroke-width": 2 });
  mSvg.appendChild(tripLampEl);
  mSvg.appendChild(E("text", { x: 144, y: 30, "font-family": "var(--font-mono,monospace)", "font-size": 10, "font-weight": 700, fill: "#5A6478" }, "OL TRIP"));
  const ampTxt = E("text", { x: 130, y: 182, "text-anchor": "middle", "font-family": "var(--font-mono,monospace)", "font-size": 15, "font-weight": 800, fill: "#0E1326" }, "0.0 A");
  mSvg.appendChild(ampTxt);

  // =================================================================
  // DOM refs + inputs
  // =================================================================
  const $ = (s) => root.querySelector(s);
  const startBtn = $("#m30ol-start"), stopBtn = $("#m30ol-stop"), resetBtn = $("#m30ol-reset");
  const loadSl = $("#m30ol-load-sl"), dialSl = $("#m30ol-dial-sl");
  const loadV = $("#m30ol-load-v"), dialV = $("#m30ol-dial-v");
  const coachTxt = $("#m30ol-coach-t"), banner = $("#m30ol-banner");
  const olChip = $("#m30ol-olchip"), mChip = $("#m30ol-mchip");
  const heatFill = $("#m30ol-heatfill"), heatV = $("#m30ol-heat-v"), tttEl = $("#m30ol-ttt");
  const legs = [$("#m30ol-leg1"), $("#m30ol-leg2"), $("#m30ol-leg3")];
  const rows = { stop: $("#m30ol-r-stop"), start: $("#m30ol-r-start"), coil: $("#m30ol-r-coil"), ol: $("#m30ol-r-ol") };
  const phaseBtn = $("#m30ol-phase"), optNote = $("#m30ol-optnote");
  const startB = $("#m30ol-start-b"), startS = $("#m30ol-start-s");

  const say = (msg, ms = 2200) => { transientMsg = msg; transientUntil = performance.now() + ms; };

  loadSl.addEventListener("input", () => {
    loadMult = parseFloat(loadSl.value);
    step(0); ensureLoop();
  });
  dialSl.addEventListener("input", () => {
    dialA = parseFloat(dialSl.value);
    step(0); ensureLoop();
  });
  root.querySelectorAll("[data-class]").forEach((b) => b.addEventListener("click", () => {
    classSec = parseInt(b.dataset.class, 10);
    root.querySelectorAll("[data-class]").forEach((x) => x.classList.toggle("active", x === b));
    say(classSec === 10
      ? "Class 10 — trips within 10 s at 6× the dial. The real RW27-2D3-D063 is this class: right for pumps and compressors that start fast."
      : classSec === 20
        ? "Class 20 — tolerates 20 s at 6× dial. The common pick when a normal start would nuisance-trip a Class 10."
        : "Class 30 — tolerates 30 s at 6× dial, for high-inertia loads: big fans, loaded conveyors, centrifuges that start slow and heavy.");
    step(0); ensureLoop();
  }));
  root.querySelectorAll("[data-reset]").forEach((b) => b.addEventListener("click", () => {
    resetMode = b.dataset.reset;
    root.querySelectorAll("[data-reset]").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.classList.toggle("warn", x === b && resetMode === "auto");
    });
    say(resetMode === "auto"
      ? "AUTO reset: the OL re-closes 95-96 by itself once the bimetal cools. Pair that with 2-WIRE control and watch what happens after a trip…"
      : "MANUAL reset: after a trip, somebody has to walk to the panel and press the button. On attended machines, that somebody is the safety feature.");
    step(0); ensureLoop();
  }));
  root.querySelectorAll("[data-scheme]").forEach((b) => b.addEventListener("click", () => {
    const next = b.dataset.scheme;
    if (next === scheme) {   // re-click: no silent no-op — restate what this mode means
      say(scheme === "3wire"
        ? "Already in 3-WIRE: momentary START + seal-in. The safe default — after any drop-out, a human must press START."
        : "Already in 2-WIRE: one maintained switch, no seal-in. Watch what that means after a trip with AUTO reset…");
      step(0); ensureLoop(); return;
    }
    scheme = next;
    root.querySelectorAll("[data-scheme]").forEach((x) => x.classList.toggle("active", x === b));
    // rewire the station for the chosen scheme
    pressed.delete("S2"); maintainedOn = false; prevCoil = new Map();
    if (scheme === "2wire") {
      startB.textContent = "RUN SW"; startS.textContent = "maintained · toggles";
      cStart.lab.textContent = "RUN SW";
      say("2-WIRE: the momentary buttons are now ONE maintained switch — no seal-in. Note the STOP button only stops while you hold it.");
    } else {
      startB.textContent = "START"; startS.textContent = "NO · momentary";
      cStart.lab.textContent = "START";
      say("3-WIRE: momentary START with a seal-in. After any drop-out, the motor stays OFF until a human presses START again.");
    }
    step(0); ensureLoop();
  }));
  phaseBtn.addEventListener("click", () => {
    phaseLoss = !phaseLoss;
    phaseBtn.textContent = phaseLoss ? "RESTORE L2" : "DROP PHASE L2";
    phaseBtn.classList.toggle("active", phaseLoss);
    phaseBtn.classList.toggle("warn", phaseLoss);
    say(phaseLoss
      ? "L2 is gone — single-phasing. The two live legs jump to ~1.73× current, and the RW27's phase-loss-sensitive lever trips harder than the current alone says."
      : "L2 restored — all three legs share the load again.");
    step(0); ensureLoop();
  });

  // ---- station buttons: real hold semantics + click fallback --------------
  // pointerdown/up = hold (hopscotch needs a held START on a tripped string);
  // a bare synthetic click (keyboard, QA) becomes a momentary pulse instead.
  let sawPointer = 0;
  function bindHold(btn, id) {
    btn.addEventListener("pointerdown", () => {
      sawPointer = performance.now();
      if (scheme === "2wire" && id === "S2") return;    // 2-wire handled on click
      pressed.add(id); step(0); ensureLoop();
    });
    const release = () => {
      if (scheme === "2wire" && id === "S2") return;
      if (pressed.has(id)) { pressed.delete(id); step(0); ensureLoop(); }
    };
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("click", () => {
      if (scheme === "2wire" && id === "S2") {          // maintained RUN switch
        maintainedOn = !maintainedOn;
        if (maintainedOn) pressed.add("S2"); else pressed.delete("S2");
        everStarted = true;
        step(0); ensureLoop();
        return;
      }
      if (performance.now() - sawPointer < 600) { if (id === "S2") everStarted = true; return; } // real press already handled
      // synthetic click → momentary pulse through the solver (latch still works)
      pressed.add(id); step(0); pressed.delete(id); step(0);
      if (id === "S2") everStarted = true;
      ensureLoop();
    });
  }
  bindHold(startBtn, "S2");
  bindHold(stopBtn, "S1");

  // NEVER disabled: a first-time user's press must always answer (DoD: a
  // silent no-op is a failure). Not-tripped and still-hot both explain themselves.
  resetBtn.addEventListener("click", () => {
    if (!tripped) {
      resetBtn.classList.add("deny");
      setTimeout(() => resetBtn.classList.remove("deny"), 350);
      say("Nothing to reset — the overload hasn't tripped. Load the motor past the dial first.");
      step(0); ensureLoop(); return;
    }
    if (heat > RESET_OK) {
      resetBtn.classList.add("deny");
      setTimeout(() => resetBtn.classList.remove("deny"), 350);
      say("Bimetal's still hot — the reset won't take yet. Real overloads are the same: if it won't reset, let it cool, don't force it.");
      step(0); ensureLoop(); return;
    }
    doReset(false);
  });

  function doReset(auto) {
    tripped = false;
    lastResetWasAuto = auto;
    if (auto && scheme === "2wire" && pressed.has("S2")) bannerUntil = performance.now() + 8000;
    say(auto
      ? "AUTO reset just re-closed 95-96 on its own."
      : (scheme === "3wire"
        ? "Reset — 95-96 is closed again. Notice the motor did NOT restart: the 3-wire seal-in dropped, so it waits for a human. Press START."
        : "Reset — 95-96 closed again. In 2-wire control, if the switch is still ON the motor comes right back."), 3600);
    step(0); ensureLoop();
  }

  // =================================================================
  // COACH
  // =================================================================
  let lastCoachMsg = "";
  function updateCoach(now, mult, ttt) {
    const cd = (v) => `<span class="m30ol-coach-cd">${v}</span>`;
    let msg;
    const motorOn = solved && solved.loadOn.get("MTR");
    if (now < transientUntil) msg = transientMsg;
    else if (tripped && heat > RESET_OK) {
      msg = `<b>TRIPPED.</b> 95-96 opened and dropped the M1 coil — the CONTACTOR stopped the motor, the OL never touched the motor wires. Now <b>hold START</b> and watch the meter row: ${cd("24 V across 95-96")} — full supply across the open. Cooling&hellip;`;
    } else if (tripped) {
      msg = resetMode === "auto"
        ? `Cool enough — AUTO reset is about to re-close 95-96 <b>by itself</b>. Watch the motor${scheme === "2wire" ? " — the RUN switch is still made&hellip;" : ""}`
        : `Cool enough — press <b>RESET OL</b>. (Sim cools in seconds; a real bimetal can take minutes. If a real one won't reset, it's still hot.)`;
    } else if (motorOn && phaseLoss) {
      msg = `Single-phasing: L2 dead, the two live legs at ~1.73× — the phase-loss-sensitive mechanism is racing to trip. This is the fault that cooks unprotected motors.`;
    } else if (motorOn && ttt != null) {
      msg = `Motor pulling <b>${(mult * 100).toFixed(0)}%</b> of the dial — bimetal heating, trip in about ${cd("~" + ttt.toFixed(0) + " s")}. The bodyguard is doing thermal math the fuse never could.`;
    } else if (motorOn) {
      msg = `Running at <b>${(loadMult * FLA_NAMEPLATE).toFixed(1)} A</b> — ${(mult * 100).toFixed(0)}% of the ${dialA.toFixed(1)} A dial. Warm but safe: it settles below trip. Now drag the <b>Motor load</b> slider past the dial.`;
    } else if (everStarted) {
      msg = scheme === "2wire"
        ? `Switch is OFF. Flip <b>RUN SW</b> to run — and remember there's no seal-in to protect anyone after a trip.`
        : `Motor stopped. Press <b>START</b> to latch it in again.`;
    } else {
      msg = `1 · Press <b>START</b>. Then drag <b>Motor load</b> past the dial setting and watch the bimetal heat toward TRIP.`;
    }
    if (msg !== lastCoachMsg) { lastCoachMsg = msg; coachTxt.innerHTML = msg; }
  }

  // =================================================================
  // STEP — solver + thermal model + all readouts
  // =================================================================
  function step(dt) {
    lastStepMs = performance.now();
    const now = lastStepMs;

    runSolver();
    const motorOn = !!solved.loadOn.get("MTR");
    const coilOn = !!solved.coilEnergized.get("M1");
    const lampOn = !!solved.loadOn.get("PL1");
    const amps = legAmps();
    const maxLeg = Math.max(...amps);
    const multRaw = maxLeg / dialA;
    const mult = multRaw * (phaseLoss && motorOn ? 1.15 : 1);   // phase-loss-sensitive lever

    // thermal integration (wall-clock dt fed in by tick/watchdog)
    const hInf = motorOn ? K_EQ * mult * mult : 0;
    const tau = hInf > heat ? tauHeat() : TAU_COOL;
    if (dt > 0) heat += (hInf - heat) * Math.min(1, dt / tau);
    heat = Math.max(0, Math.min(1.06, heat));
    if (!tripped && heat >= 1) {
      tripped = true; tripCount++;
      heat = 1;
      say(`TRIP #${tripCount} — the bimetal pushed the latch over. 95-96 just OPENED.`, 2600);
      runSolver();                                  // re-solve with the fault in
    }
    if (tripped && resetMode === "auto" && heat <= RESET_OK) doReset(true);

    // time-to-trip estimate (only meaningful while overloaded)
    let ttt = null;
    if (motorOn && !tripped && hInf > 1 && heat < 1) {
      ttt = tauHeat() * Math.log((hInf - heat) / (hInf - 1));
    }

    // ---- readouts ----
    loadV.innerHTML = `${loadMult.toFixed(1)}&times; &middot; ${(loadMult * FLA_NAMEPLATE).toFixed(1)}&thinsp;A`;
    dialV.innerHTML = `${dialA.toFixed(1)}&thinsp;A`;
    heatFill.style.width = `${(heat * 100).toFixed(1)}%`;
    heatV.textContent = `${(heat * 100).toFixed(0)}%`;
    tttEl.textContent = tripped
      ? (heat > RESET_OK ? `cooling — reset unlocks at ${(RESET_OK * 100) | 0}%` : `cool — ready to reset`)
      : ttt != null ? `time to trip ≈ ${ttt.toFixed(0)} s (Class ${classSec})`
      : motorOn && mult > 0.9 ? `holding — settles below trip at this load` : "";
    amps.forEach((a, i) => {
      legs[i].innerHTML = `<small>L${i + 1}</small>${a.toFixed(1)} A`;
      legs[i].classList.toggle("dead", motorOn && phaseLoss && i === 1);
      legs[i].classList.toggle("hi", motorOn && a > dialA * 1.05);
    });
    ampTxt.textContent = `${maxLeg.toFixed(1)} A`;
    ampTxt.setAttribute("fill", maxLeg > dialA * 1.05 ? "#B91C1C" : "#0E1326");

    olChip.textContent = tripped ? "TRIPPED" : heat > 0.85 ? "NEAR TRIP" : heat > 0.45 ? "HEATING" : motorOn ? "MONITORING" : "COLD";
    olChip.className = "m30ol-statuschip " + (tripped ? "trip" : heat > 0.45 ? "hot" : motorOn ? "run" : "");
    mChip.textContent = motorOn ? (phaseLoss ? "SINGLE-PHASING" : mult > 1.05 ? "OVERLOADED" : "RUNNING") : "STOPPED";
    mChip.className = "m30ol-statuschip " + (motorOn ? (mult > 1.05 || phaseLoss ? "hot" : "run") : "");

    // ---- meter rows straight from the solver's node potentials ----
    const p = (n) => solved.potential.get(n) || 0;
    const across = (a, b) => Math.abs(p(a) - p(b));
    const vStop = across("n1", "n2"), vStart = across("n2", "n3");
    const vCoil = across("n3", "n95"), vOL = across("n95", "N");
    const setRow = (row, v, tell) => {
      row.querySelector("b").textContent = `${v.toFixed(1)} V`;
      row.classList.toggle("tell", !!tell);
    };
    setRow(rows.stop, vStop, false);
    setRow(rows.start, vStart, false);
    setRow(rows.coil, vCoil, false);
    setRow(rows.ol, vOL, vOL > 20);                  // the punchline row
    $("#m30ol-meternote").innerHTML = vOL > 20
      ? `<b>There it is:</b> 24&thinsp;V ACROSS 95-96 — the full supply across the open contact. The coil reads 0&thinsp;V across itself (no current, no drop). The OL is your open. Reset it.`
      : tripped
        ? `Tripped and idle every wire past STOP is dead — <b>hold START</b> to push 24&thinsp;V down the string, then read across 95&rarr;96.`
        : `Hopscotch rule: a closed contact reads ~0&thinsp;V across it; the FULL supply appears across whatever is open in the string.`;

    // ---- ladder ----
    const stopHeld = pressed.has("S1");
    const startHeld = pressed.has("S2");
    hotGroups.r1.style.opacity = coilOn ? 1 : 0;
    hotGroups.rb.style.opacity = coilOn && scheme === "3wire" ? 1 : 0;
    hotGroups.r2.style.opacity = motorOn ? 1 : 0;
    hotGroups.r3.style.opacity = lampOn ? 1 : 0;
    cStop.set(!stopHeld, coilOn);
    cStart.set(scheme === "2wire" ? startHeld : startHeld, startHeld && coilOn);
    cSeal.g.style.opacity = scheme === "2wire" ? 0.22 : 1;
    cSeal.set(scheme === "3wire" && !!solved.contactClosed.get("SEAL"), coilOn && scheme === "3wire");
    cOL.set(!tripped, coilOn);
    koM1.set(coilOn);
    cMain.set(!!solved.contactClosed.get("M1MAIN"), motorOn);
    htr.set(motorOn ? Math.min(1, mult / 3) : 0);
    koMtr.set(motorOn);
    cAux.set(tripped, lampOn);
    koTrip.set(lampOn);
    olVoltTag.textContent = vOL > 20 ? `${vOL.toFixed(0)} V across the open` : "";
    olVoltTag.setAttribute("opacity", vOL > 20 ? 1 : 0);

    // ---- device + motor animation ----
    updateDevice(mult, motorOn);
    const target = motorOn ? Math.min(1.25, 0.55 + mult * 0.25) : 0;
    motorSpeed += (target - motorSpeed) * Math.min(1, dt * (target > motorSpeed ? 3 : 1.6));
    if (Math.abs(target - motorSpeed) < 0.004) motorSpeed = target;
    motorSpin = (motorSpin + motorSpeed * 460 * dt) % 360;
    spokes.setAttribute("transform", `rotate(${motorSpin.toFixed(1)} 216 98)`);
    runLamp.setAttribute("fill", motorOn ? "#4ADE80" : "#D3D9E6");
    runLamp.setAttribute("stroke", motorOn ? "#16A34A" : "#AEB7C9");
    runLamp.style.filter = motorOn ? "drop-shadow(0 0 6px rgba(74,222,128,.8))" : "none";
    tripLampEl.setAttribute("fill", lampOn ? "#FBBF24" : "#D3D9E6");
    tripLampEl.setAttribute("stroke", lampOn ? "#D97706" : "#AEB7C9");
    tripLampEl.style.filter = lampOn ? "drop-shadow(0 0 6px rgba(251,191,36,.85))" : "none";

    startBtn.classList.toggle("is-latched", coilOn);
    resetBtn.classList.toggle("is-dim", !tripped);
    resetBtn.classList.toggle("is-ready", tripped && heat <= RESET_OK && resetMode === "manual");
    banner.classList.toggle("show", now < bannerUntil);

    updateCoach(now, mult, ttt);

    // machine-readable state for QA
    const stateName = tripped ? (heat > RESET_OK ? "tripped" : "cooling")
      : motorOn ? (hInf > 1 ? "overload" : "running") : "idle";
    root.setAttribute("data-state", stateName);
    root.setAttribute("data-tripped", tripped ? "1" : "0");
    root.setAttribute("data-heat", (heat * 100).toFixed(0));
    root.setAttribute("data-motor", motorOn ? "1" : "0");

    return motorOn || coilOn || tripped || heat > 0.005 || motorSpeed > 0.004 ||
      now < transientUntil + 250 || now < bannerUntil;
  }

  // =================================================================
  // LOOP (m22 pattern: rAF + wall-clock + watchdog)
  // =================================================================
  function ensureLoop() {
    if (rafId == null) { lastFrameMs = null; rafId = requestAnimationFrame(tick); }
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
  const watchdog = setInterval(() => {
    if (!root.isConnected) { clearInterval(watchdog); return; }
    const active = heat > 0.005 || tripped || (solved && solved.loadOn.get("MTR"));
    if (!active) return;
    const now = performance.now();
    if (lastStepMs == null || now - lastStepMs > 400) {
      const dt = lastStepMs == null ? 0 : Math.min((now - lastStepMs) / 1000, 1.2);
      lastFrameMs = null;
      step(dt);
    }
  }, 300);

  // ---------------------------------------------------------------- init + QA
  function pulseStart() {
    everStarted = true;
    pressed.add("S2"); step(0); pressed.delete("S2"); step(0);
  }
  step(0);
  const qa = new URLSearchParams(location.search).get("ol");
  if (qa === "run") {
    pulseStart(); ensureLoop();
  } else if (qa === "trip") {
    // deterministic trip within ~1 s: 6x load, latched, bimetal pre-heated
    loadSl.value = "6"; loadSl.dispatchEvent(new Event("input"));
    pulseStart();
    heat = 0.995;
    ensureLoop();
  }
}
