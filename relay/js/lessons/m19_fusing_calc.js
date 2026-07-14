// =============================================================================
// m19_fusing_calc.js — "The Fusing Math: Why High Voltage Is Hard to Protect"
// module id: m19-fusing-math-amps-watts-volts
//
// An interactive calculator for the whole point of the voltage ladder:
//        Amps = Watts / Volts
// Set a POWER (watts) and pick a VOLTAGE (24 / 120 / 240 / 480). The big
// readout shows the current; a fuse bar shrinks as voltage rises for the SAME
// power, and a "fuse availability" verdict goes RED at tiny high-voltage amps
// and GREEN at the fat, easy-to-fuse low-voltage amps. Three worked examples
// (100 W across the ladder) drive the lesson home.
//
// Self-contained ES module. Every class is prefixed `m19fc-`.
// =============================================================================

export function render(host) {
  const SLUG = "m19fc";
  const SVGNS = "http://www.w3.org/2000/svg";

  // ---- tiny DOM helpers ----------------------------------------------------
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const S = (tag, attrs = {}, txt) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (txt != null) n.textContent = txt;
    return n;
  };

  // ---- style (MUST be first child) ----------------------------------------
  const style = el("style");
  style.textContent = `
  .${SLUG}-wrap{
    box-sizing:border-box; width:100%; height:100%;
    display:flex; flex-direction:column; gap:14px;
    padding:20px 22px;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--text,#303749);
    background:
      radial-gradient(900px 360px at 85% -10%, rgba(124,92,255,.06), transparent 60%),
      radial-gradient(700px 320px at -5% 110%, rgba(59,130,246,.07), transparent 60%),
      var(--bg,#F6F8FC);
    overflow:auto;
  }
  .${SLUG}-head{display:flex; align-items:flex-end; justify-content:space-between; gap:16px; flex-wrap:wrap;}
  .${SLUG}-title{font-size:21px; font-weight:800; color:var(--ink,#0E1326); letter-spacing:-.01em; line-height:1.1;}
  .${SLUG}-sub{font-size:12.5px; color:var(--muted,#6B7488); margin-top:4px; max-width:560px; line-height:1.45;}
  .${SLUG}-eq{
    font-family:var(--font-mono,"JetBrains Mono",monospace); font-size:12px; font-weight:600;
    padding:7px 13px; border-radius:999px; white-space:nowrap;
    color:#fff; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    box-shadow:0 6px 16px rgba(124,92,255,.28);
  }
  .${SLUG}-eq b{font-weight:800;}

  .${SLUG}-grid{display:grid; grid-template-columns:1.05fr 1.25fr; gap:14px; align-items:stretch;}
  @media (max-width:760px){.${SLUG}-grid{grid-template-columns:1fr;}}

  .${SLUG}-card{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; padding:18px; box-shadow:0 4px 18px rgba(14,19,38,.05);
  }
  .${SLUG}-card-h{
    font-family:var(--font-mono,monospace); font-size:11px; font-weight:600;
    letter-spacing:.16em; text-transform:uppercase; color:var(--muted,#6B7488); margin-bottom:14px;
    display:flex; align-items:center; gap:8px;
  }
  .${SLUG}-card-h::before{content:""; width:7px; height:7px; border-radius:50%; background:var(--blue,#3B82F6);
    box-shadow:0 0 0 4px var(--blue-soft,#EAF1FE);}

  /* ---- power slider ---- */
  .${SLUG}-row{margin-bottom:18px;}
  .${SLUG}-lbl{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:9px;}
  .${SLUG}-lbl-name{font-size:12.5px; font-weight:700; color:var(--ink,#0E1326);}
  .${SLUG}-lbl-val{font-family:var(--font-mono,monospace); font-size:18px; font-weight:600; color:var(--blue-deep,#2563EB); font-variant-numeric:tabular-nums;}
  .${SLUG}-lbl-val span{font-size:11px; color:var(--muted,#6B7488); font-weight:500; margin-left:2px;}
  .${SLUG}-slider{
    -webkit-appearance:none; appearance:none; width:100%; height:7px; border-radius:999px;
    background:linear-gradient(90deg,var(--blue,#3B82F6),var(--violet,#7C5CFF));
    outline:none; cursor:pointer; margin:2px 0;
  }
  .${SLUG}-slider::-webkit-slider-thumb{
    -webkit-appearance:none; appearance:none; width:22px; height:22px; border-radius:50%;
    background:#fff; border:3px solid var(--blue-deep,#2563EB); cursor:grab;
    box-shadow:0 3px 8px rgba(37,99,235,.35); transition:transform .12s ease, box-shadow .12s ease;
  }
  .${SLUG}-slider::-webkit-slider-thumb:active{transform:scale(1.12); cursor:grabbing;}
  .${SLUG}-slider::-moz-range-thumb{
    width:22px; height:22px; border-radius:50%; background:#fff; border:3px solid var(--blue-deep,#2563EB);
    cursor:grab; box-shadow:0 3px 8px rgba(37,99,235,.35);
  }
  .${SLUG}-ticks{display:flex; justify-content:space-between; font-family:var(--font-mono,monospace);
    font-size:11px; color:var(--muted,#6B7488); margin-top:6px;}

  /* ---- voltage picker ---- */
  .${SLUG}-volts{display:grid; grid-template-columns:repeat(4,1fr); gap:8px;}
  .${SLUG}-vbtn{
    position:relative; border:1.5px solid var(--border,#E6EAF3); background:var(--surface,#fff);
    border-radius:12px; padding:11px 4px 9px; cursor:pointer; text-align:center;
    transition:all .16s cubic-bezier(.2,.7,.3,1); font-family:inherit;
  }
  .${SLUG}-vbtn:hover{border-color:var(--blue,#3B82F6); transform:translateY(-2px);}
  .${SLUG}-vbtn .${SLUG}-vnum{display:block; font-family:var(--font-mono,monospace); font-size:19px; font-weight:700; color:var(--ink,#0E1326); line-height:1;}
  .${SLUG}-vbtn .${SLUG}-vunit{display:block; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted,#6B7488); margin-top:4px;}
  .${SLUG}-vbtn.${SLUG}-on{
    border-color:var(--blue-deep,#2563EB);
    background:var(--blue-soft,#EAF1FE);
    box-shadow:0 6px 16px rgba(37,99,235,.2);
    transform:translateY(-2px);
    cursor:default;
  }
  .${SLUG}-vbtn.${SLUG}-on .${SLUG}-vnum{color:var(--blue-deep,#2563EB);}

  /* ---- big readout ---- */
  .${SLUG}-readout{
    margin-top:4px; border-radius:14px; padding:16px 18px;
    background:linear-gradient(135deg,#0E1326,#1c2545); color:#fff; position:relative; overflow:hidden;
  }
  .${SLUG}-readout::after{content:""; position:absolute; inset:0;
    background:radial-gradient(220px 120px at 88% 20%, rgba(124,92,255,.4), transparent 70%); pointer-events:none;}
  .${SLUG}-ro-top{font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.18em; text-transform:uppercase; color:#B9C7E8;}
  .${SLUG}-ro-amps{display:flex; align-items:baseline; gap:8px; margin-top:2px;}
  .${SLUG}-ro-num{font-family:var(--font-mono,monospace); font-size:46px; font-weight:700; line-height:1; font-variant-numeric:tabular-nums; letter-spacing:-.02em;}
  .${SLUG}-ro-unit{font-size:18px; font-weight:600; color:#c7d3f0;}
  .${SLUG}-ro-math{font-family:var(--font-mono,monospace); font-size:11.5px; color:#aebada; margin-top:6px; position:relative; z-index:1;}
  .${SLUG}-ro-math b{color:#fff;}

  /* ---- amp bar + fuse verdict ---- */
  .${SLUG}-barwrap{margin-top:16px;}
  .${SLUG}-bar-h{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:8px;}
  .${SLUG}-bar-h .${SLUG}-bar-cap{font-size:11.5px; font-weight:700; color:var(--ink,#0E1326);}
  .${SLUG}-bar-h .${SLUG}-bar-note{font-family:var(--font-mono,monospace); font-size:11px; color:var(--muted,#6B7488);}
  .${SLUG}-track{height:34px; border-radius:10px; background:#EEF2FB; border:1px solid var(--border,#E6EAF3); position:relative; overflow:hidden;}
  .${SLUG}-fill{height:100%; border-radius:9px 0 0 9px; width:0%;
    transition:width .55s cubic-bezier(.25,.8,.3,1), background .35s ease;
    display:flex; align-items:center; justify-content:flex-end; padding-right:10px;}
  .${SLUG}-fill-amps{font-family:var(--font-mono,monospace); font-size:12px; font-weight:700; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.25); white-space:nowrap;}
  .${SLUG}-scale{display:flex; justify-content:space-between; font-family:var(--font-mono,monospace); font-size:11px; color:var(--muted,#6B7488); margin-top:5px;}

  .${SLUG}-verdict{
    margin-top:14px; display:flex; gap:12px; align-items:center;
    border-radius:13px; padding:13px 15px; border:1.5px solid;
    transition:background .35s ease, border-color .35s ease;
  }
  .${SLUG}-vchip{flex:0 0 auto; width:46px; height:46px; border-radius:50%;
    display:flex; align-items:center; justify-content:center;}
  .${SLUG}-vchip svg{display:block;}
  .${SLUG}-vbody{min-width:0;}
  .${SLUG}-vhead{font-size:13px; font-weight:800; line-height:1.15;}
  .${SLUG}-vtext{font-size:11.5px; color:var(--text,#303749); margin-top:3px; line-height:1.4;}
  .${SLUG}-vfuse{font-family:var(--font-mono,monospace); font-weight:700;}

  .${SLUG}-good{background:#ECFDF5; border-color:#A7F3D0;}
  .${SLUG}-good .${SLUG}-vhead{color:#047857;} .${SLUG}-good .${SLUG}-vchip{background:#10B981;}
  .${SLUG}-ok{background:#FEFCE8; border-color:#FDE68A;}
  .${SLUG}-ok .${SLUG}-vhead{color:#B45309;} .${SLUG}-ok .${SLUG}-vchip{background:#F59E0B;}
  .${SLUG}-bad{background:#FEF2F2; border-color:#FECACA;}
  .${SLUG}-bad .${SLUG}-vhead{color:#B91C1C;} .${SLUG}-bad .${SLUG}-vchip{background:var(--live,#EF4444);}

  /* ---- worked examples ---- */
  .${SLUG}-ex-h{font-family:var(--font-mono,monospace); font-size:11px; font-weight:600; letter-spacing:.16em;
    text-transform:uppercase; color:var(--muted,#6B7488); margin:4px 0 11px; display:flex; align-items:center; gap:8px;}
  .${SLUG}-ex-h b{color:var(--ink,#0E1326); font-weight:700;}
  .${SLUG}-ex-grid{display:grid; grid-template-columns:repeat(3,1fr); gap:10px;}
  @media (max-width:520px){.${SLUG}-ex-grid{grid-template-columns:1fr;}}
  .${SLUG}-ex{
    border:1px solid var(--border,#E6EAF3); border-radius:13px; padding:13px 13px 12px;
    background:var(--surface,#fff); position:relative; overflow:hidden; cursor:pointer;
    transition:transform .16s ease, box-shadow .16s ease, border-color .16s ease;
  }
  .${SLUG}-ex:hover{transform:translateY(-3px); box-shadow:0 10px 22px rgba(14,19,38,.09); border-color:var(--blue,#3B82F6);}
  .${SLUG}-ex.${SLUG}-current{cursor:default;}
  .${SLUG}-ex.${SLUG}-current:hover{transform:none; box-shadow:none; border-color:var(--border,#E6EAF3);}
  .${SLUG}-ex::before{content:""; position:absolute; left:0; top:0; bottom:0; width:4px;}
  .${SLUG}-ex.${SLUG}-eGood::before{background:#10B981;}
  .${SLUG}-ex.${SLUG}-eOk::before{background:#F59E0B;}
  .${SLUG}-ex.${SLUG}-eBad::before{background:var(--live,#EF4444);}
  .${SLUG}-ex-v{font-family:var(--font-mono,monospace); font-size:13px; font-weight:700; color:var(--ink,#0E1326); pointer-events:none; cursor:default;}
  .${SLUG}-ex-a{font-family:var(--font-mono,monospace); font-size:27px; font-weight:700; line-height:1.05; margin:5px 0 2px; font-variant-numeric:tabular-nums; pointer-events:none; cursor:default;}
  .${SLUG}-ex.${SLUG}-eGood .${SLUG}-ex-a{color:#047857;}
  .${SLUG}-ex.${SLUG}-eOk .${SLUG}-ex-a{color:#B45309;}
  .${SLUG}-ex.${SLUG}-eBad .${SLUG}-ex-a{color:#B91C1C;}
  .${SLUG}-ex-calc{font-family:var(--font-mono,monospace); font-size:11px; color:var(--muted,#6B7488); pointer-events:none; cursor:default;}
  .${SLUG}-ex-tag{font-size:11px; font-weight:700; margin-top:7px; pointer-events:none; cursor:default;}
  .${SLUG}-ex-tag .${SLUG}-ex-cur{font-weight:600; opacity:.7; text-transform:none; letter-spacing:0;}
  .${SLUG}-ex.${SLUG}-eGood .${SLUG}-ex-tag{color:#047857;}
  .${SLUG}-ex.${SLUG}-eOk .${SLUG}-ex-tag{color:#B45309;}
  .${SLUG}-ex.${SLUG}-eBad .${SLUG}-ex-tag{color:#B91C1C;}

  .${SLUG}-takeaway{
    font-size:12px; line-height:1.5; color:var(--text,#303749);
    background:var(--blue-soft,#EAF1FE); border:1px solid rgba(59,130,246,.25);
    border-radius:12px; padding:12px 14px; margin-top:13px;
  }
  .${SLUG}-takeaway b{color:var(--blue-deep,#2563EB);}
  `;
  host.appendChild(style);

  // ---- scaffold ------------------------------------------------------------
  const wrap = el("div", `${SLUG}-wrap`);
  host.appendChild(wrap);

  const head = el("div", `${SLUG}-head`);
  const headL = el("div");
  headL.appendChild(el("div", `${SLUG}-title`, "The Fusing Math"));
  headL.appendChild(el("div", `${SLUG}-sub`,
    "Same power, different voltage. Watch the current — and how protectable it is — change as you climb the voltage ladder."));
  head.appendChild(headL);
  const eq = el("div", `${SLUG}-eq`);
  eq.innerHTML = "Amps&nbsp;=&nbsp;<b>Watts&nbsp;÷&nbsp;Volts</b>";
  head.appendChild(eq);
  wrap.appendChild(head);

  const grid = el("div", `${SLUG}-grid`);
  wrap.appendChild(grid);

  // ===================== LEFT: inputs =====================
  const inCard = el("div", `${SLUG}-card`);
  inCard.appendChild(el("div", `${SLUG}-card-h`, "Set the load"));

  // power slider row
  const pRow = el("div", `${SLUG}-row`);
  const pLbl = el("div", `${SLUG}-lbl`);
  pLbl.appendChild(el("div", `${SLUG}-lbl-name`, "Power draw"));
  const pVal = el("div", `${SLUG}-lbl-val`);
  pRow.appendChild(pLbl);
  pLbl.appendChild(pVal);
  const slider = el("input", `${SLUG}-slider`);
  slider.type = "range";
  slider.min = "100";
  slider.max = "50000";
  slider.step = "100";
  slider.value = "100";
  pRow.appendChild(slider);
  const ticks = el("div", `${SLUG}-ticks`);
  ["100 W", "10 kW", "25 kW", "50 kW"].forEach((t) => ticks.appendChild(el("span", null, t)));
  pRow.appendChild(ticks);
  inCard.appendChild(pRow);

  // voltage picker
  const vRow = el("div", `${SLUG}-row`);
  const vLbl = el("div", `${SLUG}-lbl`);
  vLbl.appendChild(el("div", `${SLUG}-lbl-name`, "Circuit voltage"));
  vRow.appendChild(vLbl);
  const voltGrid = el("div", `${SLUG}-volts`);
  const VOLTS = [24, 120, 240, 480];
  const vBtns = {};
  VOLTS.forEach((v) => {
    const b = el("button", `${SLUG}-vbtn`);
    b.type = "button";
    b.appendChild(el("span", `${SLUG}-vnum`, String(v)));
    b.appendChild(el("span", `${SLUG}-vunit`, "volts"));
    b.addEventListener("click", () => {
      if (state.volts === v) {
        // already the active voltage — re-click re-confirms it with a quick flash
        // instead of silently doing nothing
        b.animate(
          [{ boxShadow: "0 0 0 0 rgba(37,99,235,.45)" }, { boxShadow: "0 0 0 10px rgba(37,99,235,0)" }],
          { duration: 450, easing: "ease-out" }
        );
        return;
      }
      state.volts = v;
      update();
    });
    voltGrid.appendChild(b);
    vBtns[v] = b;
  });
  vRow.appendChild(voltGrid);
  inCard.appendChild(vRow);

  // big readout
  const ro = el("div", `${SLUG}-readout`);
  ro.appendChild(el("div", `${SLUG}-ro-top`, "Current through the circuit"));
  const roAmps = el("div", `${SLUG}-ro-amps`);
  const roNum = el("span", `${SLUG}-ro-num`, "0.21");
  const roUnit = el("span", `${SLUG}-ro-unit`, "amps");
  roAmps.appendChild(roNum);
  roAmps.appendChild(roUnit);
  ro.appendChild(roAmps);
  const roMath = el("div", `${SLUG}-ro-math`);
  ro.appendChild(roMath);
  inCard.appendChild(ro);

  grid.appendChild(inCard);

  // ===================== RIGHT: bar + verdict =====================
  const outCard = el("div", `${SLUG}-card`);
  outCard.appendChild(el("div", `${SLUG}-card-h`, "How hard is it to fuse?"));

  const barWrap = el("div", `${SLUG}-barwrap`);
  const barH = el("div", `${SLUG}-bar-h`);
  barH.appendChild(el("span", `${SLUG}-bar-cap`, "Amps to interrupt"));
  const barNote = el("span", `${SLUG}-bar-note`, "");
  barH.appendChild(barNote);
  barWrap.appendChild(barH);
  const track = el("div", `${SLUG}-track`);
  const fill = el("div", `${SLUG}-fill`);
  const fillAmps = el("span", `${SLUG}-fill-amps`, "");
  fill.appendChild(fillAmps);
  track.appendChild(fill);
  barWrap.appendChild(track);
  const scale = el("div", `${SLUG}-scale`);
  scale.appendChild(el("span", null, "0 A"));
  scale.appendChild(el("span", null, "← bigger amps are EASIER to fuse"));
  barWrap.appendChild(scale);
  outCard.appendChild(barWrap);

  // verdict
  const verdict = el("div", `${SLUG}-verdict`);
  const vchip = el("div", `${SLUG}-vchip`);
  const vbody = el("div", `${SLUG}-vbody`);
  const vhead = el("div", `${SLUG}-vhead`, "");
  const vtext = el("div", `${SLUG}-vtext`);
  vbody.appendChild(vhead);
  vbody.appendChild(vtext);
  verdict.appendChild(vchip);
  verdict.appendChild(vbody);
  outCard.appendChild(verdict);

  grid.appendChild(outCard);

  // ===================== worked examples (full width) =====================
  const exCard = el("div", `${SLUG}-card`);
  const exH = el("div", `${SLUG}-ex-h`);
  exH.innerHTML = "Worked example &nbsp;·&nbsp; <b>a small 100&nbsp;W load up the whole ladder</b>";
  exCard.appendChild(exH);
  const exGrid = el("div", `${SLUG}-ex-grid`);
  // pick three voltages that tell the story: 24 (easy), 240 (borderline), 480 (impossible)
  const EXAMPLES = [
    { v: 24,  tag: "Cheap common fuse",  cls: "eGood" },
    { v: 240, tag: "Nuisance-trip zone", cls: "eOk" },
    { v: 480, tag: "Almost unfindable",  cls: "eBad" },
  ];
  const exCards = [];
  EXAMPLES.forEach((ex) => {
    const a = 100 / ex.v;
    const card = el("div", `${SLUG}-ex ${SLUG}-${ex.cls}`);
    card.appendChild(el("div", `${SLUG}-ex-v`, `100 W @ ${ex.v} V`));
    card.appendChild(el("div", `${SLUG}-ex-a`, fmtA(a)));
    card.appendChild(el("div", `${SLUG}-ex-calc`, `100 ÷ ${ex.v} = ${a.toFixed(a < 1 ? 3 : 2)} A`));
    const exTag = el("div", `${SLUG}-ex-tag`, ex.tag);
    card.appendChild(exTag);
    // clicking an example loads it into the calculator (re-clicking the
    // already-loaded example is a legitimate no-op — see markExActive())
    card.addEventListener("click", () => {
      if (state.watts === 100 && state.volts === ex.v) return; // already showing this example
      state.watts = 100;
      slider.value = "100";
      state.volts = ex.v;
      update();
      ro.animate(
        [{ boxShadow: "0 0 0 0 rgba(124,92,255,.55)" }, { boxShadow: "0 0 0 14px rgba(124,92,255,0)" }],
        { duration: 600, easing: "ease-out" }
      );
    });
    exGrid.appendChild(card);
    exCards.push({ v: ex.v, card, tag: exTag, tagText: ex.tag });
  });
  exCard.appendChild(exGrid);

  const takeaway = el("div", `${SLUG}-takeaway`);
  takeaway.innerHTML =
    "The same 100 W draws <b>20× more current at 24 V than at 480 V</b>. A fuse must blow at the load's tiny operating amps yet still safely interrupt the line voltage — and quarter-amp fuses rated for 480 V barely exist. That fusing pain is a big reason control circuits moved down to <b>120 V and especially 24 V</b>, and why transmission steps voltage <i>up</i> to move power with fewer amps.";
  exCard.appendChild(takeaway);

  wrap.appendChild(exCard);

  // ---- icons for verdict chip ---------------------------------------------
  function checkIcon() {
    const svg = S("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none" });
    svg.appendChild(S("path", { d: "M5 12.5l4 4 10-10", stroke: "#fff", "stroke-width": 2.6, "stroke-linecap": "round", "stroke-linejoin": "round" }));
    return svg;
  }
  function warnIcon() {
    const svg = S("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none" });
    svg.appendChild(S("path", { d: "M12 5v8", stroke: "#fff", "stroke-width": 2.6, "stroke-linecap": "round" }));
    svg.appendChild(S("circle", { cx: 12, cy: 18, r: 1.5, fill: "#fff" }));
    return svg;
  }
  function crossIcon() {
    const svg = S("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none" });
    svg.appendChild(S("path", { d: "M7 7l10 10M17 7L7 17", stroke: "#fff", "stroke-width": 2.6, "stroke-linecap": "round" }));
    return svg;
  }

  // ---- formatting ----------------------------------------------------------
  function fmtA(a) {
    if (a >= 100) return a.toFixed(0);
    if (a >= 10) return a.toFixed(1);
    if (a >= 1) return a.toFixed(2);
    return a.toFixed(3);
  }
  function fmtW(w) {
    return w >= 1000 ? (w / 1000).toFixed(w % 1000 === 0 ? 0 : 1) + " kW" : w + " W";
  }
  // next standard fuse size up (common UL/Class-CC ladder, amps)
  const FUSE_SIZES = [0.1, 0.125, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10,
    15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 600];
  function nextFuse(a) {
    // size at ~125% of load (a common rule of thumb for protecting a continuous load)
    const target = a * 1.25;
    for (const f of FUSE_SIZES) if (f >= target) return f;
    return null; // off the chart
  }

  // ---- state + the single update() chokepoint -----------------------------
  const state = { watts: 100, volts: 480 };

  function update() {
    const W = state.watts;
    const V = state.volts;
    const A = W / V;

    // inputs reflect state
    pVal.innerHTML = `${fmtW(W)}`;
    for (const v of VOLTS) vBtns[v].classList.toggle(`${SLUG}-on`, v === V);

    // big readout
    roNum.textContent = fmtA(A);
    roMath.innerHTML = `${W} W ÷ ${V} V = <b>${fmtA(A)} A</b>`;

    // amp bar — log scale so the 0.2 A → 2000 A span is legible.
    // map 0.05 A .. 2500 A onto 0..100%.
    const lo = Math.log10(0.05), hi = Math.log10(2500);
    const pct = Math.max(2, Math.min(100, ((Math.log10(Math.max(A, 0.05)) - lo) / (hi - lo)) * 100));
    fill.style.width = pct.toFixed(1) + "%";
    fillAmps.textContent = fmtA(A) + " A";

    // fuse + verdict thresholds, by absolute current
    const fuse = nextFuse(A);
    let cls, headTxt, bodyHtml, icon, fillColor, note;
    if (A < 0.5) {
      cls = `${SLUG}-bad`; icon = crossIcon();
      fillColor = "linear-gradient(90deg,#EF4444,#F97316)";
      headTxt = "Nearly impossible to protect";
      note = "tiny current";
      bodyHtml = `You'd need a fuse rated for <b>${V} V</b> that opens at only ` +
        `<span class="${SLUG}-vfuse">~${fmtA(A)} A</span>. ` +
        (fuse ? `Nearest size: <span class="${SLUG}-vfuse">${fuse} A</span> — ` : "") +
        `fractional-amp fuses at high voltage barely exist on the shelf.`;
    } else if (A < 5) {
      cls = `${SLUG}-ok`; icon = warnIcon();
      fillColor = "linear-gradient(90deg,#F59E0B,#FBBF24)";
      headTxt = "Touchy — nuisance-trip zone";
      note = "small current";
      bodyHtml = `About <span class="${SLUG}-vfuse">${fmtA(A)} A</span>. A small voltage dip pushes the ` +
        `amps up and a tight fuse will nuisance-trip. Workable, but fussy. ` +
        (fuse ? `Try a <span class="${SLUG}-vfuse">${fuse} A</span> fuse.` : "");
    } else {
      cls = `${SLUG}-good`; icon = checkIcon();
      fillColor = "linear-gradient(90deg,#10B981,#34D399)";
      headTxt = "Easy to fuse — fat, common amps";
      note = "healthy current";
      bodyHtml = `A solid <span class="${SLUG}-vfuse">${fmtA(A)} A</span>. ` +
        (fuse ? `A cheap, ordinary <span class="${SLUG}-vfuse">${fuse} A</span> fuse protects this cleanly.` : "") +
        ` This is why control gear loves low voltage.`;
    }

    fill.style.background = fillColor;
    barNote.textContent = note;
    verdict.className = `${SLUG}-verdict ${cls}`;
    vchip.innerHTML = "";
    vchip.appendChild(icon);
    vhead.textContent = headTxt;
    vtext.innerHTML = bodyHtml;

    // mark whichever worked-example card (if any) matches the live calculator
    // so it stops inviting a click that would legitimately do nothing
    for (const ec of exCards) {
      const isCurrent = W === 100 && V === ec.v;
      ec.card.classList.toggle(`${SLUG}-current`, isCurrent);
      ec.tag.innerHTML = isCurrent ? `${ec.tagText} <span class="${SLUG}-ex-cur">— shown above</span>` : ec.tagText;
    }
  }

  // ---- wire inputs ---------------------------------------------------------
  slider.addEventListener("input", () => { state.watts = parseInt(slider.value, 10); update(); });

  // initial paint (start at the lesson's headline case: 100 W @ 480 V)
  update();
}
