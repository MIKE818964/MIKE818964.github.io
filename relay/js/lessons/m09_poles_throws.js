// =============================================================================
// m09_poles_throws.js — "Putting It Together: SPST, SPDT, DPST, DPDT"
//
// An interactive POLES x THROWS naming matrix. The learner sets:
//   POLES  : 1 (Single) or 2 (Double)  -> how many independent switch lanes
//   THROWS : 1 (Single) or 2 (Double)  -> how many destinations each lane has
// The schematic redraws live (ganged poles move together), and the NAME is
// printed letter-by-letter: SP/DP + ST/DT  ->  SPST / SPDT / DPST / DPDT,
// with the spelled-out expansion and a one-line "what it's for".
//
// Self-contained ES module. Pure vanilla JS + inline SVG. Every class is
// prefixed `m09-` so nothing collides with sibling modules.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
function S(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
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

// the four cells of the naming matrix, keyed "<poles><throws>"
const FACTS = {
  "11": {
    abbr: "SPST",
    expand: "Single Pole, Single Throw",
    poleWord: "Single Pole", throwWord: "Single Throw",
    use: "A plain on/off switch — one lane, one destination. The basic make-or-break.",
    example: "Light switch · simple coil enable",
  },
  "12": {
    abbr: "SPDT",
    expand: "Single Pole, Double Throw",
    poleWord: "Single Pole", throwWord: "Double Throw",
    use: "One switch that selects between two outputs — one is always live.",
    example: "The Stopped-light / Running-light selector",
  },
  "21": {
    abbr: "DPST",
    expand: "Double Pole, Single Throw",
    poleWord: "Double Pole", throwWord: "Single Throw",
    use: "Two independent on/off switches that flip together — switch both legs at once.",
    example: "Break both line conductors of a 240 V load",
  },
  "22": {
    abbr: "DPDT",
    expand: "Double Pole, Double Throw",
    poleWord: "Double Pole", throwWord: "Double Throw",
    use: "Two selectors ganged together — route two circuits at once. Most common control relay.",
    example: "Reversing / cross-over · the 8-pin octal relay",
  },
};

export function render(host) {
  host.innerHTML = "";

  // ---------------------------------------------------------------- styles
  const style = H("style");
  style.textContent = css();
  host.appendChild(style);

  const root = H("div", { class: "m09-root" });
  host.appendChild(root);

  // ---- header ----
  const head = H("div", { class: "m09-head" });
  head.appendChild(H("div", { class: "m09-kicker" }, "NAMING MATRIX"));
  head.appendChild(H("h2", { class: "m09-title" }, "Poles × Throws — decode any relay name"));
  head.appendChild(H("p", { class: "m09-sub" },
    "First letters = how many POLES (lanes). Last letters = how many THROWS (destinations). Read it left-to-right."));
  root.appendChild(head);

  // ---- main grid: controls + name on the left, schematic on the right ----
  const grid = H("div", { class: "m09-grid" });
  root.appendChild(grid);

  // ===== LEFT column =====
  const left = H("div", { class: "m09-left" });
  grid.appendChild(left);

  // POLES control
  left.appendChild(controlBlock(
    "poles", "POLES", "lanes — independent switches",
    [["1", "1 — Single", "SP"], ["2", "2 — Double", "DP"]]
  ));
  // THROWS control
  left.appendChild(controlBlock(
    "throws", "THROWS", "destinations per lane",
    [["1", "1 — Single", "ST"], ["2", "2 — Double", "DT"]]
  ));

  // NAME readout card (built programmatically; refs kept for live updates)
  const name = H("div", { class: "m09-name" });
  const abbr = H("div", { class: "m09-name-abbr" });
  const segPole = H("span", { class: "m09-seg", "data-seg": "pole" }, "SP");
  const segThrow = H("span", { class: "m09-seg", "data-seg": "throw" }, "ST");
  abbr.appendChild(segPole); abbr.appendChild(segThrow);

  const expand = H("div", { class: "m09-name-expand" });
  const exPole = H("span", { class: "m09-ex-pole" }, "Single Pole");
  const exThrow = H("span", { class: "m09-ex-throw" }, "Single Throw");
  expand.appendChild(exPole);
  expand.appendChild(H("span", { class: "m09-ex-dot" }, "·"));
  expand.appendChild(exThrow);

  const useLine = H("div", { class: "m09-name-use" });
  const exRow = H("div", { class: "m09-name-ex" });
  const exTxt = H("span", { class: "m09-ex-txt" });
  exRow.appendChild(H("span", { class: "m09-ex-tag" }, "e.g."));
  exRow.appendChild(exTxt);

  name.appendChild(abbr);
  name.appendChild(expand);
  name.appendChild(useLine);
  name.appendChild(exRow);
  left.appendChild(name);

  // ===== RIGHT column: the schematic =====
  const right = H("div", { class: "m09-right" });
  grid.appendChild(right);
  const svg = S("svg", {
    class: "m09-svg",
    viewBox: "0 0 460 470",
    preserveAspectRatio: "xMidYMid meet",
  });
  right.appendChild(svg);

  const cap = H("div", { class: "m09-cap" });
  cap.appendChild(H("span", { class: "m09-cap-dot" }));
  const capTxt = H("span", { class: "m09-cap-txt" }, "Click the gang bar — watch both poles throw together");
  cap.appendChild(capTxt);
  right.appendChild(cap);

  // ---------------------------------------------------------------- state
  let poles = 1;     // 1 | 2
  let throws = 1;    // 1 | 2
  let target = 0;    // which throw the blade rests on: 0 = throw A (NC side), 1 = throw B (NO side)

  // wire up the segmented controls
  root.querySelectorAll(".m09-seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const group = btn.getAttribute("data-group");
      const val = parseInt(btn.getAttribute("data-val"), 10);
      if (group === "poles") poles = val;
      else throws = val;
      if (throws === 1) target = 0; // single-throw has only one rest spot
      paint();
    });
  });

  function paint() {
    // sync control active states
    root.querySelectorAll(".m09-seg-btn").forEach((btn) => {
      const group = btn.getAttribute("data-group");
      const val = parseInt(btn.getAttribute("data-val"), 10);
      const on = (group === "poles" ? poles : throws) === val;
      btn.classList.toggle("on", on);
    });

    const key = `${poles}${throws}`;
    const f = FACTS[key];

    // ---- update the NAME readout (animate each segment swap) ----
    swapSeg(segPole, poles === 1 ? "SP" : "DP");
    swapSeg(segThrow, throws === 1 ? "ST" : "DT");
    exPole.textContent = f.poleWord;
    exThrow.textContent = f.throwWord;
    useLine.textContent = f.use;
    exTxt.textContent = f.example;

    drawSchematic(svg, poles, throws, target);

    // caption adapts
    if (throws === 1) {
      capTxt.textContent = poles === 2
        ? "Two lanes, one destination each — click to break/make both at once"
        : "One lane, one destination — click to break / make the single contact";
    } else {
      capTxt.textContent = poles === 2
        ? "Click either common — both poles throw together to the other destination"
        : "Click the common — the blade selects between destination A and B";
    }
  }

  // clicking a moving blade / common throws the contacts (ganged)
  svg.addEventListener("click", (ev) => {
    if (ev.target.closest(".m09-throwable")) {
      if (throws === 2) target = target === 0 ? 1 : 0;
      else target = target === 0 ? 1 : 0; // single-throw toggles open<->made
      drawSchematic(svg, poles, throws, target);
    }
  });

  paint();
}

// segmented control factory
function controlBlock(group, label, hint, options) {
  const wrap = H("div", { class: "m09-ctrl" });
  const top = H("div", { class: "m09-ctrl-top" });
  top.appendChild(H("span", { class: "m09-ctrl-label" }, label));
  top.appendChild(H("span", { class: "m09-ctrl-hint" }, hint));
  wrap.appendChild(top);
  const seg = H("div", { class: "m09-seg-row" });
  options.forEach(([val, text, tag]) => {
    const b = H("button", { class: "m09-seg-btn", "data-group": group, "data-val": val, type: "button" });
    b.appendChild(H("span", { class: "m09-seg-tag" }, tag));
    b.appendChild(H("span", { class: "m09-seg-text" }, text));
    seg.appendChild(b);
  });
  wrap.appendChild(seg);
  return wrap;
}

// animate a 2-letter segment swapping value
function swapSeg(el, val) {
  if (el.textContent === val) return;
  el.classList.remove("m09-pop");
  // force reflow so the animation restarts
  void el.offsetWidth;
  el.textContent = val;
  el.classList.add("m09-pop");
}

// =============================================================================
// SVG schematic — draws `poles` lanes; each lane is a switch with `throws`
// destinations. The moving blade rests on destination index `target`.
// Standard schematic style: a hinged blade (common) swinging to fixed terminals.
// =============================================================================
function drawSchematic(svg, poles, throws, target) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // defs: soft glow for the live destination
  const defs = S("defs");
  const glow = S("filter", { id: "m09-glow", x: "-60%", y: "-60%", width: "220%", height: "220%" });
  glow.appendChild(S("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "3.4", result: "b" }));
  const mg = S("feMerge");
  mg.appendChild(S("feMergeNode", { in: "b" }));
  mg.appendChild(S("feMergeNode", { in: "SourceGraphic" }));
  glow.appendChild(mg);
  defs.appendChild(glow);
  svg.appendChild(defs);

  // layout geometry
  const laneH = 178;                 // vertical space per pole
  const topY = 56;
  const lanes = [];
  for (let i = 0; i < poles; i++) lanes.push(topY + i * (laneH + 20));

  const commonX = 96;                // x of the pivot/common terminal
  const destX = 320;                 // x of fixed destination terminals
  const destA_dy = -42;              // throw A sits high
  const destB_dy = 42;               // throw B sits low
  const restCenterOffset = throws === 1 ? 0 : (target === 0 ? destA_dy : destB_dy);

  // ---- the GANG bar tying poles together (only meaningful for 2 poles, but
  //      we draw a subtle dashed mechanical link to teach "they move together")
  if (poles === 2) {
    const yMid0 = lanes[0] + laneH / 2 + restCenterOffset;
    const yMid1 = lanes[1] + laneH / 2 + restCenterOffset;
    // dashed insulated tie bar between the two blades' tips
    const bx = (commonX + (throws === 1 && target === 0 ? commonX + 150 : destX)) / 2 + 28;
    const tie = S("line", {
      class: "m09-tie", x1: bx, y1: yMid0, x2: bx, y2: yMid1,
    });
    svg.appendChild(tie);
    // little tie-bar end caps
    [yMid0, yMid1].forEach((yy) => svg.appendChild(S("rect", {
      class: "m09-tie-cap", x: bx - 5, y: yy - 4, width: 10, height: 8, rx: 2,
    })));
    svg.appendChild(S("text", {
      class: "m09-tie-lbl", x: bx + 14, y: (yMid0 + yMid1) / 2 + 4,
    }, "ganged"));
  }

  // ---- draw each pole lane ----
  lanes.forEach((laneY, li) => {
    const midY = laneY + laneH / 2;
    const g = S("g", { class: "m09-lane" });
    svg.appendChild(g);

    // lane plate / label
    g.appendChild(S("rect", {
      class: "m09-lane-plate", x: 28, y: laneY, width: 404, height: laneH, rx: 14,
    }));
    g.appendChild(S("text", { class: "m09-lane-tag", x: 44, y: laneY + 24 },
      poles === 1 ? "POLE" : `POLE ${li + 1}`));

    // COMMON terminal + lead in
    g.appendChild(S("line", { class: "m09-wire", x1: 44, y1: midY, x2: commonX, y2: midY }));
    g.appendChild(S("circle", { class: "m09-term m09-common-term", cx: commonX, cy: midY, r: 6 }));
    g.appendChild(S("text", { class: "m09-term-lbl", x: commonX, y: laneY + laneH - 16, "text-anchor": "middle" }, "COM"));

    // ---- destination terminals ----
    // throw A always present; throw B only if throws===2
    const dests = [];
    dests.push({ dy: throws === 1 ? 0 : destA_dy, label: throws === 1 ? "OUT" : "A", idx: 0 });
    if (throws === 2) dests.push({ dy: destB_dy, label: "B", idx: 1 });

    dests.forEach((d) => {
      const dy = midY + d.dy;
      const live = (throws === 1 ? target === 0 : target === d.idx);
      // fixed destination lead out
      const w = S("line", {
        class: "m09-wire" + (live ? " m09-live" : ""),
        x1: destX, y1: dy, x2: 410, y2: dy,
      });
      svg.appendChild(w);
      // fixed contact terminal (small open circle = schematic fixed point)
      svg.appendChild(S("circle", {
        class: "m09-term m09-dest-term" + (live ? " m09-live" : ""),
        cx: destX, cy: dy, r: 6, filter: live ? "url(#m09-glow)" : null,
      }));
      svg.appendChild(S("text", {
        class: "m09-term-lbl", x: destX + 22, y: dy + 4,
      }, d.label));
    });

    // ---- the moving blade (common pivots, swings to chosen destination) ----
    // resting endpoint:
    let bx, by;
    if (throws === 1) {
      // single throw: target 0 = made (touches OUT), target 1 = open (lifted up)
      if (target === 0) { bx = destX - 8; by = midY; }
      else { bx = commonX + 150; by = midY - 56; } // lifted open
    } else {
      const chosen = target === 0 ? destA_dy : destB_dy;
      bx = destX - 8; by = midY + chosen;
    }

    const blade = S("line", {
      class: "m09-blade m09-throwable" + ((throws === 1 && target !== 0) ? " m09-open" : " m09-made"),
      x1: commonX, y1: midY, x2: bx, y2: by,
    });
    g.appendChild(blade);
    // pivot knuckle
    g.appendChild(S("circle", { class: "m09-pivot m09-throwable", cx: commonX, cy: midY, r: 7 }));
    // blade tip
    g.appendChild(S("circle", { class: "m09-blade-tip m09-throwable", cx: bx, cy: by, r: 4.5 }));

    // arrow hint that the blade is clickable (only on the blade region)
    g.appendChild(S("circle", { class: "m09-hint-ring m09-throwable", cx: commonX, cy: midY, r: 13 }));
  });
}

// =============================================================================
function css() {
  return `
.m09-root{
  box-sizing:border-box; width:100%; height:100%;
  padding:22px 26px; display:flex; flex-direction:column; gap:16px;
  font-family:var(--font-display,"Inter",system-ui,sans-serif);
  color:var(--text,#303749);
}
.m09-root *{box-sizing:border-box;}

.m09-head{flex:0 0 auto;}
.m09-kicker{
  font-family:var(--font-mono,"JetBrains Mono",monospace);
  font-size:11px; letter-spacing:.18em; font-weight:600;
  color:var(--blue-deep,#2563EB);
  background:var(--blue-soft,#EAF1FE);
  display:inline-block; padding:4px 10px; border-radius:999px; margin-bottom:8px;
}
.m09-title{
  margin:0 0 4px; font-size:23px; font-weight:800; letter-spacing:-.01em;
  color:var(--ink,#0E1326);
}
.m09-sub{margin:0; font-size:13.5px; line-height:1.45; color:var(--muted,#6B7488); max-width:760px;}

.m09-grid{
  flex:1 1 auto; display:grid; grid-template-columns:340px 1fr; gap:20px; min-height:0;
}

/* ---------- left column ---------- */
.m09-left{display:flex; flex-direction:column; gap:14px; min-height:0;}

.m09-ctrl{
  background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
  border-radius:14px; padding:12px 14px; box-shadow:var(--shadow-sm,0 1px 3px rgba(16,19,38,.05));
}
.m09-ctrl-top{display:flex; align-items:baseline; justify-content:space-between; margin-bottom:9px;}
.m09-ctrl-label{
  font-family:var(--font-mono,monospace); font-size:12.5px; font-weight:700;
  letter-spacing:.12em; color:var(--ink,#0E1326);
}
.m09-ctrl-hint{font-size:11px; color:var(--muted,#6B7488);}

.m09-seg-row{display:grid; grid-template-columns:1fr 1fr; gap:8px;}
.m09-seg-btn{
  appearance:none; cursor:pointer; border:1.5px solid var(--border-strong,#D6DDEC);
  background:var(--surface-2,#FBFCFE); border-radius:11px; padding:9px 8px 8px;
  display:flex; flex-direction:column; align-items:center; gap:3px;
  transition:border-color .18s ease, background .18s ease, box-shadow .18s ease, transform .12s ease;
  font-family:var(--font-display,"Inter",sans-serif);
}
.m09-seg-btn:hover{border-color:var(--blue,#3B82F6); transform:translateY(-1px);}
.m09-seg-btn:active{transform:translateY(0);}
.m09-seg-tag{
  font-family:var(--font-mono,monospace); font-size:15px; font-weight:800;
  letter-spacing:.06em; color:var(--muted,#6B7488); transition:color .18s ease;
}
.m09-seg-text{font-size:12px; color:var(--muted,#6B7488); transition:color .18s ease;}
.m09-seg-btn.on{
  cursor:default;
  border-color:transparent;
  background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
  box-shadow:var(--shadow-blue,0 10px 34px -10px rgba(59,130,246,.40));
}
.m09-seg-btn.on .m09-seg-tag,
.m09-seg-btn.on .m09-seg-text{color:#fff;}

/* ---------- name readout ---------- */
.m09-name{
  margin-top:auto;
  background:var(--surface,#fff);
  border:1px solid var(--border,#E6EAF3); border-radius:16px;
  padding:16px 18px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
  position:relative; overflow:hidden;
}
.m09-name::before{
  content:""; position:absolute; left:0; top:0; bottom:0; width:5px;
  background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
}
.m09-name-abbr{
  font-family:var(--font-mono,monospace); font-weight:800; font-size:42px;
  letter-spacing:.04em; color:var(--ink,#0E1326); line-height:1; margin-bottom:6px;
  display:flex; gap:2px;
}
.m09-seg[data-seg]{display:inline-block;}
.m09-seg[data-seg="pole"]{color:var(--blue-deep,#2563EB);}
.m09-seg[data-seg="throw"]{color:var(--violet,#7C5CFF);}
.m09-pop{animation:m09-pop .26s cubic-bezier(.34,1.56,.64,1);}
@keyframes m09-pop{
  0%{transform:translateY(-7px) scale(.8); opacity:0;}
  60%{transform:translateY(0) scale(1.08); opacity:1;}
  100%{transform:translateY(0) scale(1);}
}
.m09-name-expand{
  font-size:13.5px; font-weight:600; color:var(--text,#303749);
  display:flex; gap:8px; align-items:center; margin-bottom:10px;
}
.m09-ex-pole{color:var(--blue-deep,#2563EB);}
.m09-ex-throw{color:var(--violet-deep,#6D28D9);}
.m09-ex-dot{color:var(--faint,#99A1B3);}
.m09-name-use{font-size:13px; line-height:1.45; color:var(--text,#303749); margin-bottom:9px;}
.m09-name-ex{
  font-size:12px; color:var(--muted,#6B7488);
  display:flex; gap:7px; align-items:baseline;
  border-top:1px dashed var(--border,#E6EAF3); padding-top:9px;
}
.m09-ex-tag{
  font-family:var(--font-mono,monospace); font-size:11px; font-weight:700;
  color:var(--blue-deep,#2563EB); background:var(--blue-soft,#EAF1FE);
  padding:2px 6px; border-radius:6px; letter-spacing:.04em;
}
.m09-ex-txt{font-style:italic;}

/* ---------- right column / schematic ---------- */
.m09-right{
  background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
  border-radius:16px; padding:10px 12px 8px;
  box-shadow:var(--shadow-sm,0 1px 3px rgba(16,19,38,.05));
  display:flex; flex-direction:column; min-height:0;
}
.m09-svg{flex:1 1 auto; width:100%; height:100%; min-height:0; display:block;}
.m09-cap{
  flex:0 0 auto; display:flex; align-items:center; gap:8px;
  font-size:12px; color:var(--muted,#6B7488); padding:4px 6px 2px;
}
.m09-cap-dot{
  width:8px; height:8px; border-radius:50%;
  background:var(--blue,#3B82F6); box-shadow:0 0 0 4px var(--blue-soft,#EAF1FE);
  animation:m09-pulse 1.6s ease-in-out infinite;
}
@keyframes m09-pulse{0%,100%{opacity:.55;}50%{opacity:1;}}

/* ---- svg primitives ---- */
.m09-lane-plate{fill:var(--surface-2,#FBFCFE); stroke:var(--border,#E6EAF3); stroke-width:1.5;}
.m09-lane-tag{
  font-family:var(--font-mono,monospace); font-size:12.5px; font-weight:700;
  letter-spacing:.12em; fill:var(--muted,#6B7488);
}
.m09-wire{
  stroke:var(--wire-rest,#94A3B8); stroke-width:3; stroke-linecap:round;
  transition:stroke .25s ease;
}
.m09-wire.m09-live{stroke:var(--live,#EF4444);}
.m09-term{fill:var(--surface,#fff); stroke:var(--contact-closed,#64748B); stroke-width:2.4;}
.m09-common-term{fill:var(--contact-closed,#64748B);}
.m09-dest-term{stroke:var(--wire-rest,#94A3B8); transition:stroke .25s ease, fill .25s ease;}
.m09-dest-term.m09-live{stroke:var(--live,#EF4444); fill:#FFE9E7;}
.m09-term-lbl{
  font-family:var(--font-mono,monospace); font-size:12px; font-weight:700;
  fill:var(--muted,#6B7488);
}

.m09-blade{
  stroke:var(--ink,#0E1326); stroke-width:4.5; stroke-linecap:round;
  transition:all .34s cubic-bezier(.34,1.3,.5,1);
}
.m09-blade.m09-made{stroke:var(--contact-closed,#475569);}
.m09-blade.m09-open{stroke:var(--contact-open,#94A3B8);}
.m09-pivot{fill:var(--ink,#0E1326); stroke:#fff; stroke-width:2;}
.m09-blade-tip{
  fill:var(--ink,#0E1326);
  transition:cx .34s cubic-bezier(.34,1.3,.5,1), cy .34s cubic-bezier(.34,1.3,.5,1);
}
.m09-throwable{cursor:pointer;}
.m09-hint-ring{
  fill:none; stroke:var(--blue,#3B82F6); stroke-width:2; opacity:0;
  transition:opacity .2s ease; pointer-events:none;
}
.m09-lane:hover .m09-hint-ring{opacity:.55; animation:m09-ring 1.4s ease-out infinite;}
@keyframes m09-ring{
  0%{r:13; opacity:.6;}
  100%{r:21; opacity:0;}
}

/* ---- ganging tie bar ---- */
.m09-tie{
  stroke:var(--violet,#7C5CFF); stroke-width:2.5; stroke-dasharray:5 5;
  opacity:.85; transition:all .34s cubic-bezier(.34,1.3,.5,1);
}
.m09-tie-cap{fill:var(--violet,#7C5CFF); transition:all .34s cubic-bezier(.34,1.3,.5,1);}
.m09-tie-lbl{
  font-family:var(--font-mono,monospace); font-size:12px; font-weight:700;
  letter-spacing:.08em; fill:var(--violet-deep,#6D28D9);
}
`;
}
