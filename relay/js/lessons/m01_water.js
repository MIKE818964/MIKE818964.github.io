// =============================================================================
// m01_water.js — "Electricity Is Just Water in Pipes" (module m01-what-is-electricity)
//
// A closed water-pipe loop the learner controls:
//   PUMP  = battery / voltage  = pressure
//   VALVE = switch             (drag/click to open -> water flows)
//   WHEEL = load               (spins when water flows)
//   narrow neck = resistance
// Open the valve and animated droplets visibly circulate the loop and spin the
// paddle-wheel; close it and flow stops. A pressure slider speeds the flow. A
// live mapping panel pairs each water-world part with its electrical twin.
//
// Self-contained ES module. Theme: "The Well-Lit Workbench" (bright, vivid).
// Exports render(host); first child appended is a slug-prefixed <style>.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";

function svg(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}
function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

export function render(host) {
  // ---- scoped styles (every class prefixed m01w-) -------------------------
  const style = el("style");
  style.textContent = `
  .m01w-root{
    --m01w-blue:var(--blue,#3B82F6);
    --m01w-blue-deep:var(--blue-deep,#2563EB);
    --m01w-blue-soft:var(--blue-soft,#EAF1FE);
    --m01w-violet:var(--violet,#7C5CFF);
    --m01w-ink:var(--ink,#0E1326);
    --m01w-text:var(--text,#303749);
    --m01w-muted:var(--muted,#6B7488);
    --m01w-border:var(--border,#E6EAF3);
    --m01w-surface:var(--surface,#FFFFFF);
    --m01w-water:#22A7F0;
    --m01w-water-deep:#0E76C4;
    box-sizing:border-box; width:100%; height:100%;
    display:flex; flex-direction:column; gap:14px;
    padding:18px 20px;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--m01w-text);
    background:
      radial-gradient(120% 90% at 12% -10%, #FFFFFF 0%, rgba(255,255,255,0) 60%),
      linear-gradient(180deg,#FAFCFF 0%, var(--bg,#F6F8FC) 100%);
    overflow:auto;
  }
  .m01w-root *{box-sizing:border-box;}
  .m01w-head{display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap;}
  .m01w-title{margin:0; font-size:21px; font-weight:800; letter-spacing:-.02em; color:var(--m01w-ink);}
  .m01w-title .m01w-pill{
    display:inline-block; vertical-align:middle; margin-left:10px;
    font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; font-weight:700; letter-spacing:.06em;
    color:var(--m01w-blue-deep); background:var(--m01w-blue-soft);
    border:1px solid #D6E4FE; border-radius:999px; padding:3px 9px; text-transform:uppercase;
  }
  .m01w-sub{margin:5px 0 0; font-size:12.5px; color:var(--m01w-muted); max-width:560px; line-height:1.45;}

  .m01w-grid{display:grid; grid-template-columns:1.55fr 1fr; gap:16px; align-items:stretch; min-height:0;}
  @media (max-width:760px){ .m01w-grid{grid-template-columns:1fr;} }

  .m01w-card{
    background:var(--m01w-surface); border:1px solid var(--m01w-border);
    border-radius:16px; box-shadow:0 10px 30px -18px rgba(20,40,90,.30), 0 2px 6px -3px rgba(20,40,90,.10);
    padding:14px 15px; display:flex; flex-direction:column; min-width:0;
  }
  .m01w-card.m01w-stage{padding:10px 12px 8px; overflow:hidden;}

  .m01w-stage svg{display:block; width:100%; height:auto;}

  /* ---- water + flow animation ---- */
  .m01w-pipe-bore{fill:none; stroke:#EAF0F8; stroke-width:26; stroke-linecap:round; stroke-linejoin:round;}
  .m01w-pipe-wall{fill:none; stroke:#C6D2E4; stroke-width:30; stroke-linecap:round; stroke-linejoin:round; opacity:.55;}
  .m01w-water-fill{
    fill:none; stroke:url(#m01w-watergrad); stroke-width:18; stroke-linecap:round; stroke-linejoin:round;
    opacity:0; transition:opacity .55s ease;
  }
  .m01w-flowing .m01w-water-fill{opacity:1;}
  .m01w-flow-dash{
    fill:none; stroke:rgba(255,255,255,.85); stroke-width:5.5; stroke-linecap:round;
    stroke-dasharray:2 30; opacity:0; transition:opacity .4s ease;
  }
  .m01w-flowing .m01w-flow-dash{opacity:1; animation:m01w-flow 1.6s linear infinite;}
  @keyframes m01w-flow{ to{ stroke-dashoffset:-160; } }

  .m01w-pump-body{fill:url(#m01w-pumpgrad); stroke:var(--m01w-blue-deep); stroke-width:2.5;}
  .m01w-pump-ring{fill:none; stroke:rgba(255,255,255,.55); stroke-width:2;}
  .m01w-pump-blade{fill:#fff; opacity:.92;}
  .m01w-flowing .m01w-pump-rotor{animation:m01w-spin 1.4s linear infinite; transform-origin:center; transform-box:fill-box;}
  @keyframes m01w-spin{ to{ transform:rotate(360deg); } }

  .m01w-wheel-hub{fill:#fff; stroke:var(--m01w-water-deep); stroke-width:2.5;}
  .m01w-paddle{fill:url(#m01w-pumpgrad); stroke:var(--m01w-water-deep); stroke-width:1.6;}
  .m01w-wheel{transform-origin:center; transform-box:fill-box;}
  .m01w-flowing .m01w-wheel{animation:m01w-spin var(--m01w-wheelspd,1.1s) linear infinite;}

  .m01w-glow{opacity:0; transition:opacity .5s ease;}
  .m01w-flowing .m01w-glow{opacity:1;}

  /* stage svg renders at ~0.9x of its 520-unit viewBox — pre-compensated ≥ ~11px effective */
  .m01w-label{font-family:var(--font-mono,"JetBrains Mono",monospace); font-size:12.5px; font-weight:700; fill:var(--m01w-ink); letter-spacing:.02em;}
  .m01w-sublabel{font-family:var(--font-display,"Inter",sans-serif); font-size:12.5px; fill:var(--m01w-muted); font-weight:600;}
  .m01w-eq{font-family:var(--font-mono,"JetBrains Mono",monospace); font-size:12.5px; font-weight:700; fill:var(--m01w-blue-deep);}

  .m01w-callout{fill:#fff; stroke:var(--m01w-border); stroke-width:1.4;}
  .m01w-lead{stroke:#B9C5DA; stroke-width:1.4; stroke-dasharray:3 3;}

  /* ---- valve handle ---- */
  .m01w-valve-hit{cursor:grab; fill:transparent;}
  .m01w-valve-hit:active{cursor:grabbing;}
  .m01w-valve-housing{fill:#F2F5FB; stroke:#AEBBD2; stroke-width:2;}
  .m01w-valve-handle{transition:transform .45s cubic-bezier(.34,1.4,.5,1); transform-origin:center; transform-box:fill-box;}
  .m01w-valve-stem{fill:#9FB0CC;}
  .m01w-valve-knob{fill:url(#m01w-valvegrad); stroke:#fff; stroke-width:2;}
  .m01w-valve-gate{fill:#CDD8EC; stroke:#9FB0CC; stroke-width:1.5; transition:transform .45s cubic-bezier(.34,1.4,.5,1);}

  /* ---- controls ---- */
  .m01w-controls{display:flex; align-items:center; gap:14px; flex-wrap:wrap; margin-top:6px;}
  .m01w-valvebtn{
    appearance:none; border:none; cursor:pointer; font-family:inherit; font-weight:750;
    font-size:13px; letter-spacing:.01em; color:#fff; padding:11px 18px; border-radius:11px;
    display:inline-flex; align-items:center; gap:9px;
    background:linear-gradient(135deg,#CBD5E6,#AEBBD2); box-shadow:0 6px 16px -8px rgba(40,60,110,.5);
    transition:transform .12s ease, box-shadow .2s ease, background .35s ease;
  }
  .m01w-valvebtn:hover{transform:translateY(-1px);}
  .m01w-valvebtn:active{transform:translateY(0);}
  .m01w-valvebtn.m01w-on{background:linear-gradient(135deg,var(--m01w-blue),var(--m01w-violet)); box-shadow:0 8px 22px -8px rgba(59,130,246,.6);}
  .m01w-valvedot{width:9px; height:9px; border-radius:50%; background:#fff; opacity:.55; transition:opacity .3s, box-shadow .3s;}
  .m01w-valvebtn.m01w-on .m01w-valvedot{opacity:1; box-shadow:0 0 0 4px rgba(255,255,255,.35);}

  .m01w-slider{flex:1; min-width:180px; display:flex; flex-direction:column; gap:4px;}
  .m01w-slider-row{display:flex; align-items:center; gap:10px;}
  .m01w-slider-lab{font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; color:var(--m01w-muted); text-transform:uppercase; letter-spacing:.05em; white-space:nowrap;}
  .m01w-slider-val{font-family:var(--font-mono,monospace); font-size:12px; font-weight:800; color:var(--m01w-blue-deep); min-width:54px; text-align:right;}
  .m01w-range{ -webkit-appearance:none; appearance:none; width:100%; height:7px; border-radius:6px; outline:none; cursor:pointer;
    background:linear-gradient(90deg,var(--m01w-blue-soft),var(--m01w-blue)); }
  .m01w-range::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:20px; height:20px; border-radius:50%;
    background:#fff; border:3px solid var(--m01w-blue-deep); box-shadow:0 3px 8px -2px rgba(37,99,235,.6); cursor:pointer; transition:transform .12s; }
  .m01w-range::-webkit-slider-thumb:hover{transform:scale(1.12);}
  .m01w-range::-moz-range-thumb{ width:20px; height:20px; border-radius:50%; background:#fff; border:3px solid var(--m01w-blue-deep); box-shadow:0 3px 8px -2px rgba(37,99,235,.6); cursor:pointer; }

  /* ---- mapping panel ---- */
  .m01w-maptitle{font-size:13px; font-weight:800; color:var(--m01w-ink); margin:0 0 3px; display:flex; align-items:center; gap:7px;}
  .m01w-maptitle::before{content:""; width:7px; height:18px; border-radius:3px; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));}
  .m01w-mapsub{font-size:11px; color:var(--m01w-muted); margin:0 0 10px;}
  .m01w-maprow{
    display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:8px;
    padding:9px 10px; border-radius:11px; border:1px solid var(--m01w-border);
    background:linear-gradient(180deg,#FFF,#FBFCFF); margin-bottom:8px;
    transition:border-color .25s, box-shadow .25s, transform .25s, background .25s;
  }
  .m01w-maprow:last-child{margin-bottom:0;}
  .m01w-maprow.m01w-hot{
    border-color:#BFD6FF; box-shadow:0 8px 20px -12px rgba(59,130,246,.55);
    background:linear-gradient(180deg,#FFFFFF,var(--m01w-blue-soft)); transform:translateX(2px);
  }
  .m01w-side{display:flex; flex-direction:column; gap:1px; min-width:0;}
  .m01w-side .m01w-tag{font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase;}
  .m01w-water-tag{color:var(--m01w-water-deep);}
  .m01w-elec-tag{color:var(--violet-deep,#6D28D9);}
  .m01w-side .m01w-name{font-size:12px; font-weight:750; color:var(--m01w-ink); line-height:1.15;}
  .m01w-elec .m01w-name{text-align:right;}
  .m01w-elec{align-items:flex-end;}
  .m01w-arrow{display:flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%;
    background:var(--m01w-blue-soft); color:var(--m01w-blue-deep); flex:0 0 auto;}
  .m01w-arrow svg{width:14px; height:14px; display:block;}

  /* ---- readout chips ---- */
  .m01w-readout{display:flex; gap:9px; margin-top:11px;}
  .m01w-chip{flex:1; border-radius:12px; padding:9px 10px; border:1px solid var(--m01w-border); background:#fff; text-align:center;
    transition:border-color .3s, background .3s;}
  .m01w-chip.m01w-live{border-color:#BFD6FF; background:linear-gradient(180deg,#fff,var(--m01w-blue-soft));}
  .m01w-chip .m01w-ck{font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--m01w-muted);}
  .m01w-chip .m01w-cv{font-family:var(--font-mono,monospace); font-size:17px; font-weight:800; color:var(--m01w-ink); line-height:1.1; margin-top:2px;}
  .m01w-chip.m01w-live .m01w-cv{color:var(--m01w-blue-deep);}
  .m01w-cv.m01w-flowoff{color:#B5BDCC !important;}

  .m01w-key{margin-top:11px; font-size:11.5px; line-height:1.5; color:var(--m01w-text);
    background:linear-gradient(180deg,#FFFDF4,#FFF8E6); border:1px solid #F2E3B8; border-radius:11px; padding:9px 11px;}
  .m01w-key b{color:#9A6B00;}
  .m01w-key .m01w-kk{font-family:var(--font-mono,monospace); font-weight:800;}
  `;
  host.appendChild(style);

  const root = el("div", "m01w-root");
  host.appendChild(root);

  // ---- header ------------------------------------------------------------
  const head = el("div", "m01w-head");
  const htxt = el("div");
  const title = el("h2", "m01w-title");
  title.innerHTML = `Electricity Is Just Water in Pipes <span class="m01w-pill">Water Analogy</span>`;
  const sub = el("p", "m01w-sub",
    "Open the valve to send water around the loop — the pump pushes, the paddle-wheel spins. Voltage is the pressure, current is how much water flows, and nothing moves until the loop is closed.");
  htxt.appendChild(title); htxt.appendChild(sub);
  head.appendChild(htxt);
  root.appendChild(head);

  // ---- main grid ---------------------------------------------------------
  const grid = el("div", "m01w-grid");
  root.appendChild(grid);

  // ===== LEFT: the animated water loop ===================================
  const stage = el("div", "m01w-card m01w-stage");
  grid.appendChild(stage);

  const s = svg("svg", { viewBox: "0 0 520 380", preserveAspectRatio: "xMidYMid meet", role: "img" });
  s.setAttribute("aria-label", "Closed water-pipe loop with a pump, a valve and a paddle-wheel");
  stage.appendChild(s);

  // defs (gradients)
  const defs = svg("defs");
  s.appendChild(defs);
  const wg = svg("linearGradient", { id: "m01w-watergrad", x1: "0", y1: "0", x2: "1", y2: "1" });
  wg.appendChild(svg("stop", { offset: "0", "stop-color": "#3DC6FF" }));
  wg.appendChild(svg("stop", { offset: "1", "stop-color": "#0E76C4" }));
  defs.appendChild(wg);
  const pg = svg("linearGradient", { id: "m01w-pumpgrad", x1: "0", y1: "0", x2: "1", y2: "1" });
  pg.appendChild(svg("stop", { offset: "0", "stop-color": "#5B9DFF" }));
  pg.appendChild(svg("stop", { offset: "1", "stop-color": "#2563EB" }));
  defs.appendChild(pg);
  const vg = svg("linearGradient", { id: "m01w-valvegrad", x1: "0", y1: "0", x2: "1", y2: "1" });
  vg.appendChild(svg("stop", { offset: "0", "stop-color": "#7C5CFF" }));
  vg.appendChild(svg("stop", { offset: "1", "stop-color": "#4F32D6" }));
  defs.appendChild(vg);
  const gl = svg("radialGradient", { id: "m01w-wheelglow" });
  gl.appendChild(svg("stop", { offset: "0", "stop-color": "rgba(34,167,240,.45)" }));
  gl.appendChild(svg("stop", { offset: "1", "stop-color": "rgba(34,167,240,0)" }));
  defs.appendChild(gl);

  // The loop path. A rounded rectangle the water travels around.
  // Geometry: pump bottom-left, valve along the top, wheel right side.
  // Start at pump outlet -> up -> right (through valve) -> down (through wheel) -> back along bottom -> pump.
  const LOOP =
    "M 96 270 " +            // pump outlet
    "L 96 130 " +            // rise to top-left
    "Q 96 96 130 96 " +      // top-left corner
    "L 250 96 " +            // top run toward valve  (valve sits ~ x=250)
    "L 390 96 " +            // continue past valve
    "Q 424 96 424 130 " +    // top-right corner
    "L 424 250 " +           // down the right side (wheel ~ y=210)
    "Q 424 284 390 284 " +   // bottom-right corner
    "L 130 284 " +           // bottom run
    "Q 96 284 96 270 ";      // back into pump (close loop)

  // pipe wall + bore (the empty pipe always visible)
  s.appendChild(svg("path", { class: "m01w-pipe-wall", d: LOOP }));
  s.appendChild(svg("path", { class: "m01w-pipe-bore", d: LOOP }));

  // resistance: a narrowed neck on the bottom run (teaches resistance)
  // drawn as a small constriction graphic with label
  const neckX = 235;
  s.appendChild(svg("path", { class: "m01w-pipe-wall", d: `M ${neckX-26} 284 L ${neckX+26} 284`, stroke: "#C6D2E4", "stroke-width": "30" }));
  // two pinch wedges
  s.appendChild(svg("path", { d: `M ${neckX-22} 271 L ${neckX} 280 L ${neckX-22} 280 Z`, fill: "#AEBBD2" }));
  s.appendChild(svg("path", { d: `M ${neckX+22} 271 L ${neckX} 280 L ${neckX+22} 280 Z`, fill: "#AEBBD2" }));
  s.appendChild(svg("path", { d: `M ${neckX-22} 297 L ${neckX} 288 L ${neckX-22} 288 Z`, fill: "#AEBBD2" }));
  s.appendChild(svg("path", { d: `M ${neckX+22} 297 L ${neckX} 288 L ${neckX+22} 288 Z`, fill: "#AEBBD2" }));
  // narrow-neck (resistance) label
  s.appendChild(svg("text", { class: "m01w-label", x: neckX, y: 326, "text-anchor": "middle" }, "NARROW PIPE"));
  s.appendChild(svg("text", { class: "m01w-eq", x: neckX, y: 339, "text-anchor": "middle" }, "= resistance"));

  // water fill + moving dashes (toggled via .m01w-flowing on the svg)
  const waterFill = svg("path", { class: "m01w-water-fill", d: LOOP });
  s.appendChild(waterFill);
  const flowDash = svg("path", { class: "m01w-flow-dash", d: LOOP });
  s.appendChild(flowDash);

  // ---- PUMP (battery) bottom-left -----------------------------------------
  const pump = svg("g", { transform: "translate(96,270)" });
  pump.appendChild(svg("circle", { class: "m01w-glow", cx: 0, cy: 0, r: 46, fill: "url(#m01w-wheelglow)" }));
  pump.appendChild(svg("circle", { class: "m01w-pump-body", cx: 0, cy: 0, r: 32 }));
  pump.appendChild(svg("circle", { class: "m01w-pump-ring", cx: 0, cy: 0, r: 24 }));
  // impeller rotor
  const rotor = svg("g", { class: "m01w-pump-rotor" });
  for (let i = 0; i < 6; i++) {
    const a = (i * 60) * Math.PI / 180;
    rotor.appendChild(svg("path", {
      class: "m01w-pump-blade",
      d: `M 0 0 Q ${Math.cos(a)*9} ${Math.sin(a)*9} ${Math.cos(a+0.5)*22} ${Math.sin(a+0.5)*22} Q ${Math.cos(a+0.2)*16} ${Math.sin(a+0.2)*16} 0 0 Z`
    }));
  }
  rotor.appendChild(svg("circle", { cx: 0, cy: 0, r: 5, fill: "#fff" }));
  pump.appendChild(rotor);
  s.appendChild(pump);

  // pump label callout
  pumpLabel(s, 18, 318, "PUMP", "pushes the water", "= battery (voltage)");

  // ---- VALVE (switch) on the top run --------------------------------------
  const valveX = 320, valveY = 96;
  const valve = svg("g", { transform: `translate(${valveX},${valveY})` });
  // housing (a gate-valve body straddling the pipe)
  valve.appendChild(svg("rect", { class: "m01w-valve-housing", x: -22, y: -16, width: 44, height: 32, rx: 7 }));
  // gate that drops into the pipe when closed
  const gate = svg("rect", { class: "m01w-valve-gate", x: -7, y: -15, width: 14, height: 30, rx: 3 });
  valve.appendChild(gate);
  // stem up to handle
  valve.appendChild(svg("rect", { class: "m01w-valve-stem", x: -3.5, y: -44, width: 7, height: 30, rx: 3 }));
  // handwheel handle (rotates open/closed)
  const handle = svg("g", { class: "m01w-valve-handle", transform: "translate(0,-50)" });
  handle.appendChild(svg("circle", { class: "m01w-valve-knob", cx: 0, cy: 0, r: 15 }));
  handle.appendChild(svg("line", { x1: -15, y1: 0, x2: 15, y2: 0, stroke: "#fff", "stroke-width": "3", "stroke-linecap": "round" }));
  handle.appendChild(svg("line", { x1: 0, y1: -15, x2: 0, y2: 15, stroke: "#fff", "stroke-width": "3", "stroke-linecap": "round" }));
  handle.appendChild(svg("circle", { cx: 0, cy: 0, r: 4, fill: "#fff" }));
  valve.appendChild(handle);
  // generous invisible hit target for click/drag
  const hit = svg("circle", { class: "m01w-valve-hit", cx: 0, cy: -50, r: 30 });
  valve.appendChild(hit);
  s.appendChild(valve);

  valveLabel(s, valveX, valveY);

  // ---- PADDLE-WHEEL (load) on the right run -------------------------------
  const wheelX = 424, wheelY = 200;
  const wheel = svg("g", { transform: `translate(${wheelX},${wheelY})` });
  wheel.appendChild(svg("circle", { class: "m01w-glow", cx: 0, cy: 0, r: 50, fill: "url(#m01w-wheelglow)" }));
  const spinner = svg("g", { class: "m01w-wheel" });
  for (let i = 0; i < 8; i++) {
    const a = (i * 45) * Math.PI / 180;
    spinner.appendChild(svg("rect", {
      class: "m01w-paddle", x: -4, y: -34, width: 8, height: 22, rx: 2,
      transform: `rotate(${i*45})`
    }));
  }
  spinner.appendChild(svg("circle", { class: "m01w-wheel-hub", cx: 0, cy: 0, r: 13 }));
  spinner.appendChild(svg("circle", { cx: 0, cy: 0, r: 4, fill: "#0E76C4" }));
  wheel.appendChild(spinner);
  s.appendChild(wheel);

  wheelLabel(s, wheelX, wheelY);

  // ===== RIGHT: mapping + controls =======================================
  const panel = el("div", "m01w-card");
  grid.appendChild(panel);

  panel.appendChild(el("p", "m01w-maptitle", "Two worlds, same idea"));
  panel.appendChild(el("p", "m01w-mapsub", "Every part of the water rig has an exact electrical twin."));

  const MAP = [
    { key: "pump",  wtag: "WATER",  wname: "Pump pressure", etag: "ELECTRICAL", ename: "Voltage" },
    { key: "flow",  wtag: "WATER",  wname: "Flow rate",     etag: "ELECTRICAL", ename: "Current (amps)" },
    { key: "valve", wtag: "WATER",  wname: "Valve",         etag: "ELECTRICAL", ename: "Switch" },
    { key: "neck",  wtag: "WATER",  wname: "Narrow pipe",   etag: "ELECTRICAL", ename: "Resistance" },
    { key: "wheel", wtag: "WATER",  wname: "Paddle-wheel",  etag: "ELECTRICAL", ename: "Load" },
  ];
  const mapRows = {};
  for (const m of MAP) {
    const row = el("div", "m01w-maprow");
    const wside = el("div", "m01w-side m01w-water");
    wside.appendChild(el("span", "m01w-tag m01w-water-tag", m.wtag));
    wside.appendChild(el("span", "m01w-name", m.wname));
    const arrow = el("div", "m01w-arrow");
    arrow.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
    const eside = el("div", "m01w-side m01w-elec");
    eside.appendChild(el("span", "m01w-tag m01w-elec-tag", m.etag));
    eside.appendChild(el("span", "m01w-name", m.ename));
    row.appendChild(wside); row.appendChild(arrow); row.appendChild(eside);
    panel.appendChild(row);
    mapRows[m.key] = row;
  }

  // live readout chips
  const readout = el("div", "m01w-readout");
  const chipPressure = chip("Pressure (V)", "9 V");
  const chipFlow = chip("Flow (I)", "0 A");
  const chipLoop = chip("Loop", "CLOSED");
  readout.appendChild(chipPressure.box);
  readout.appendChild(chipFlow.box);
  readout.appendChild(chipLoop.box);
  panel.appendChild(readout);

  // teaching key (the check-question takeaway)
  const key = el("div", "m01w-key");
  key.innerHTML = `<b>Remember:</b> <span class="m01w-kk">VOLTAGE = pressure</span> pushing the water; <span class="m01w-kk">CURRENT</span> is how much actually flows. You need <i>both</i> pressure <i>and</i> a closed loop before anything moves.`;
  panel.appendChild(key);

  // ===== CONTROLS (under the stage) ======================================
  const controls = el("div", "m01w-controls");
  stage.appendChild(controls);

  const valveBtn = el("button", "m01w-valvebtn");
  valveBtn.appendChild(el("span", "m01w-valvedot"));
  const valveBtnTxt = el("span", "m01w-valvebtn-txt", "OPEN THE VALVE");
  valveBtn.appendChild(valveBtnTxt);
  controls.appendChild(valveBtn);

  const sliderWrap = el("div", "m01w-slider");
  const srow = el("div", "m01w-slider-row");
  srow.appendChild(el("span", "m01w-slider-lab", "Pressure"));
  const range = el("input", "m01w-range");
  range.type = "range"; range.min = "1"; range.max = "24"; range.step = "1"; range.value = "9";
  range.setAttribute("aria-label", "Pump pressure (voltage)");
  const sval = el("span", "m01w-slider-val", "9 V");
  srow.appendChild(range); srow.appendChild(sval);
  sliderWrap.appendChild(srow);
  controls.appendChild(sliderWrap);

  // ---- STATE + behavior --------------------------------------------------
  let open = false;
  let pressure = 9;

  function flowAmps() {
    // current = pressure / resistance (narrow neck = fixed R). Scaled for display.
    return open ? +(pressure / 3.2).toFixed(1) : 0;
  }

  function speedFor() {
    // higher pressure -> faster dash + wheel. Map 1..24V to durations.
    const t = (pressure - 1) / 23;                  // 0..1
    return {
      dash: (2.6 - t * 1.9).toFixed(2) + "s",       // 2.6s slow -> 0.7s fast
      wheel: (1.9 - t * 1.35).toFixed(2) + "s",
    };
  }

  function apply() {
    s.classList.toggle("m01w-flowing", open);
    // valve graphics: handle rotates 90deg, gate lifts out of bore when open
    handle.style.transform = open ? "translate(0,-50px) rotate(90deg)" : "translate(0,-50px) rotate(0deg)";
    gate.style.transform = open ? "translateY(-22px)" : "translateY(0)";

    // animation speed from pressure
    const sp = speedFor();
    flowDash.style.animationDuration = sp.dash;
    s.style.setProperty("--m01w-wheelspd", sp.wheel);
    // pump rotor matches dash speed
    rotor.style.animationDuration = (parseFloat(sp.dash) * 0.85) + "s";

    // button look + label
    valveBtn.classList.toggle("m01w-on", open);
    valveBtnTxt.textContent = open ? "CLOSE THE VALVE" : "OPEN THE VALVE";

    // readout chips
    const amps = flowAmps();
    chipPressure.set(pressure + " V");
    chipPressure.box.classList.toggle("m01w-live", true);
    chipFlow.set(amps + " A");
    chipFlow.box.classList.toggle("m01w-live", open);
    chipFlow.val.classList.toggle("m01w-flowoff", !open);
    // valve open = complete (closed) loop -> current flows; valve shut = open loop -> none.
    // This is the exact electrical parallel: closed switch = closed circuit = current.
    chipLoop.set(open ? "CLOSED" : "OPEN");
    chipLoop.box.classList.toggle("m01w-live", open);

    // highlight the parts that are "live" in the mapping panel
    mapRows.pump.classList.toggle("m01w-hot", true);     // pressure always present
    mapRows.flow.classList.toggle("m01w-hot", open);
    mapRows.valve.classList.toggle("m01w-hot", true);
    mapRows.neck.classList.toggle("m01w-hot", open);
    mapRows.wheel.classList.toggle("m01w-hot", open);
  }

  function toggle() { open = !open; apply(); }

  valveBtn.addEventListener("click", toggle);
  hit.addEventListener("click", toggle);

  range.addEventListener("input", () => {
    pressure = +range.value;
    sval.textContent = pressure + " V";
    apply();
  });

  // initial paint
  apply();

  return root;

  // ---------- small helpers (label callouts + chips) ----------------------
  function chip(k, v) {
    const box = el("div", "m01w-chip");
    box.appendChild(el("div", "m01w-ck", k));
    const val = el("div", "m01w-cv", v);
    box.appendChild(val);
    return { box, val, set: (t) => { val.textContent = t; } };
  }
}

// ---- SVG label callouts (pump / valve / wheel) ---------------------------
function pumpLabel(s, x, y) {
  s.appendChild(svg("line", { class: "m01w-lead", x1: 78, y1: 282, x2: x + 42, y2: y - 8 }));
  s.appendChild(svg("text", { class: "m01w-label", x: x, y: y }, "PUMP"));
  s.appendChild(svg("text", { class: "m01w-sublabel", x: x, y: y + 13 }, "pushes the water"));
  s.appendChild(svg("text", { class: "m01w-eq", x: x, y: y + 27 }, "= battery / voltage"));
}
function valveLabel(s, vx, vy) {
  // labels sit to the right of the handwheel so they never overlap the knob
  const lx = vx + 30;
  s.appendChild(svg("text", { class: "m01w-label", x: lx, y: vy - 54, "text-anchor": "start" }, "VALVE"));
  s.appendChild(svg("text", { class: "m01w-sublabel", x: lx, y: vy - 41, "text-anchor": "start" }, "open it → water flows"));
  s.appendChild(svg("text", { class: "m01w-eq", x: lx, y: vy - 28, "text-anchor": "start" }, "= switch"));
}
function wheelLabel(s, wx, wy) {
  s.appendChild(svg("line", { class: "m01w-lead", x1: wx + 38, y1: wy - 6, x2: 470, y2: 150 }));
  s.appendChild(svg("text", { class: "m01w-label", x: 516, y: 138, "text-anchor": "end" }, "PADDLE-WHEEL"));
  s.appendChild(svg("text", { class: "m01w-sublabel", x: 516, y: 151, "text-anchor": "end" }, "spins when water moves"));
  s.appendChild(svg("text", { class: "m01w-eq", x: 516, y: 165, "text-anchor": "end" }, "= load"));
}
