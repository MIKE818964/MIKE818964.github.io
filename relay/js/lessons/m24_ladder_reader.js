// =============================================================================
// m24_ladder_reader.js — "Ladder Diagrams: Symbols and Reading a Rung"
//
// LEFT  : a legend of the standard ladder symbols (NO / NC contact, coil,
//         pushbutton, OL, lamp) each drawn as a real schematic glyph + name.
// RIGHT : ONE ladder rung strung between the L1 (power) and L2 (neutral) rails:
//             [ Stop NC ] --+-- [ Start NO ] --+-- ( M )   coil
//                           |                  |
//                           +-- [ M  seal-in]--+
//         "Energize / Read the rung" traces power LEFT-TO-RIGHT, evaluating each
//         contact (conducting vs blocked), and pulls in the coil if a complete
//         path exists. The learner can FLIP any contact and re-read.
//
// Self-contained ES module. Every CSS class is prefixed with the slug so nothing
// collides with sibling lesson modules.  export function render(host) { ... }
// =============================================================================

const NS = "http://www.w3.org/2000/svg";
const P = "m24"; // slug prefix

function svg(name, attrs = {}, txt) {
  const e = document.createElementNS(NS, name);
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
  host.appendChild(styleEl());

  const root = el("div", `${P}-root`);
  host.appendChild(root);

  // ---- header -------------------------------------------------------------
  const head = el("div", `${P}-head`);
  head.appendChild(el("div", `${P}-eyebrow`, "READING THE PRINT · LADDER LOGIC"));
  head.appendChild(el("h2", `${P}-title`, "Reading a Rung"));
  head.appendChild(el(
    "p", `${P}-sub`,
    "Power enters at the left rail (L1) and must pass through every contact to reach the coil at the right rail (L2). Read it left-to-right, like a sentence."
  ));
  root.appendChild(head);

  // ---- two-column body ----------------------------------------------------
  const body = el("div", `${P}-body`);
  root.appendChild(body);

  body.appendChild(buildLegend());

  const rungPanel = el("div", `${P}-panel ${P}-rungpanel`);
  body.appendChild(rungPanel);
  buildRung(rungPanel);
}

// =============================================================================
// LEFT — symbol legend
// =============================================================================
function buildLegend() {
  const panel = el("div", `${P}-panel ${P}-legend`);
  panel.appendChild(el("div", `${P}-panel-label`, "SYMBOL LEGEND"));

  const items = [
    { key: "no",  name: "NO Contact",  sub: "open at rest",     glyph: glyphNO },
    { key: "nc",  name: "NC Contact",  sub: "closed at rest",   glyph: glyphNC },
    { key: "coil",name: "Coil / Output",sub: "energizes load",  glyph: glyphCoil },
    { key: "pb",  name: "Pushbutton",  sub: "momentary NO",     glyph: glyphPB },
    { key: "ol",  name: "Overload",    sub: "OL trip contact",  glyph: glyphOL },
    { key: "lamp",name: "Pilot Lamp",  sub: "indicator output", glyph: glyphLamp },
  ];

  const list = el("div", `${P}-legend-list`);
  for (const it of items) {
    const row = el("div", `${P}-leg-row`);
    const s = svg("svg", { viewBox: "0 0 120 56", class: `${P}-leg-svg` });
    it.glyph(s);
    row.appendChild(s);
    const txt = el("div", `${P}-leg-txt`);
    txt.appendChild(el("div", `${P}-leg-name`, it.name));
    txt.appendChild(el("div", `${P}-leg-sub`, it.sub));
    row.appendChild(txt);
    list.appendChild(row);
  }
  panel.appendChild(list);

  const tip = el("div", `${P}-leg-tip`);
  tip.innerHTML =
    `<strong>Tell them apart:</strong> a Normally-Open contact is two plain ` +
    `parallel bars <span class="${P}-mono">-| |-</span>; a Normally-Closed one ` +
    `has a diagonal slash <span class="${P}-mono">-|/|-</span>.`;
  panel.appendChild(tip);

  return panel;
}

// ----- legend glyphs (schematic-accurate, centered in 120x56) -----
function glyphNO(s) {
  const y = 28;
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 8, y1: y, x2: 44, y2: y }));
  s.appendChild(svg("line", { class: `${P}-g-bar`,  x1: 50, y1: 12, x2: 50, y2: 44 }));
  s.appendChild(svg("line", { class: `${P}-g-bar`,  x1: 70, y1: 12, x2: 70, y2: 44 }));
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 76, y1: y, x2: 112, y2: y }));
}
function glyphNC(s) {
  const y = 28;
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 8, y1: y, x2: 44, y2: y }));
  s.appendChild(svg("line", { class: `${P}-g-bar`,  x1: 50, y1: 12, x2: 50, y2: 44 }));
  s.appendChild(svg("line", { class: `${P}-g-bar`,  x1: 70, y1: 12, x2: 70, y2: 44 }));
  s.appendChild(svg("line", { class: `${P}-g-slash`, x1: 46, y1: 46, x2: 74, y2: 10 }));
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 76, y1: y, x2: 112, y2: y }));
}
function glyphCoil(s) {
  const y = 28;
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 8, y1: y, x2: 40, y2: y }));
  s.appendChild(svg("path", { class: `${P}-g-coilL`, d: "M40 12 A 18 18 0 0 0 40 44" }));
  s.appendChild(svg("path", { class: `${P}-g-coilR`, d: "M80 12 A 18 18 0 0 1 80 44" }));
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 80, y1: y, x2: 112, y2: y }));
}
function glyphPB(s) {
  const y = 28;
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 8, y1: y, x2: 44, y2: y }));
  s.appendChild(svg("line", { class: `${P}-g-bar`,  x1: 50, y1: 12, x2: 50, y2: 44 }));
  s.appendChild(svg("line", { class: `${P}-g-bar`,  x1: 70, y1: 12, x2: 70, y2: 44 }));
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 76, y1: y, x2: 112, y2: y }));
  // plunger
  s.appendChild(svg("line", { class: `${P}-g-stem`, x1: 60, y1: 6, x2: 60, y2: 12 }));
  s.appendChild(svg("rect", { class: `${P}-g-cap`, x: 52, y: 1, width: 16, height: 6, rx: 2 }));
}
function glyphOL(s) {
  const y = 28;
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 8, y1: y, x2: 38, y2: y }));
  // heater loop (overload) as a back-and-forth zigzag
  s.appendChild(svg("path", {
    class: `${P}-g-heat`,
    d: "M38 28 q 6 -14 12 0 q 6 14 12 0 q 6 -14 12 0 q 6 14 12 0",
    fill: "none"
  }));
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 86, y1: y, x2: 112, y2: y }));
}
function glyphLamp(s) {
  const y = 28, cx = 60;
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: 8, y1: y, x2: cx - 16, y2: y }));
  s.appendChild(svg("circle", { class: `${P}-g-lampC`, cx, cy: y, r: 16 }));
  s.appendChild(svg("line", { class: `${P}-g-lampX`, x1: cx - 11, y1: y - 11, x2: cx + 11, y2: y + 11 }));
  s.appendChild(svg("line", { class: `${P}-g-lampX`, x1: cx - 11, y1: y + 11, x2: cx + 11, y2: y - 11 }));
  s.appendChild(svg("line", { class: `${P}-g-wire`, x1: cx + 16, y1: y, x2: 112, y2: y }));
}

// =============================================================================
// RIGHT — the live, traceable rung
// =============================================================================
function buildRung(panel) {
  panel.appendChild(el("div", `${P}-panel-label`, "THE LATCH, AS ONE RUNG"));

  // geometry (viewBox units)
  const VB = { w: 520, h: 360 };
  const L1 = 56;            // left power rail x
  const L2 = 472;          // right neutral rail x (L2)
  const yTop = 56;         // top of frame
  const yBot = 312;        // bottom of frame
  const yMain = 120;       // main rung line
  const ySeal = 196;       // seal-in branch line

  // contact state model. 'made' = currently conducting.
  //  - stop  (NC): made (closed) at rest -> conducts. Pressing STOP opens it.
  //  - start (NO): open at rest -> conducts only while held / latched.
  //  - seal  (NO, M aux): follows the coil (latch). user can't flip directly;
  //                       it mirrors coil after a successful read.
  const state = {
    stop:  { type: "nc", made: true,  x: 150 },
    start: { type: "no", made: false, x: 300 },
    seal:  { type: "no", made: false, x: 300 },
    coil:  { energized: false },
  };

  const s = svg("svg", { viewBox: `0 0 ${VB.w} ${VB.h}`, class: `${P}-rung-svg` });
  panel.appendChild(s);

  // glow filter for live wires
  const defs = svg("defs");
  const f = svg("filter", { id: `${P}-glow`, x: "-40%", y: "-40%", width: "180%", height: "180%" });
  f.appendChild(svg("feGaussianBlur", { stdDeviation: "3.2", result: "b" }));
  const merge = svg("feMerge");
  merge.appendChild(svg("feMergeNode", { in: "b" }));
  merge.appendChild(svg("feMergeNode", { in: "SourceGraphic" }));
  f.appendChild(merge);
  defs.appendChild(f);
  s.appendChild(defs);

  // ---- power rails --------------------------------------------------------
  s.appendChild(svg("line", { class: `${P}-rail`, x1: L1, y1: yTop, x2: L1, y2: yBot }));
  s.appendChild(svg("line", { class: `${P}-rail`, x1: L2, y1: yTop, x2: L2, y2: yBot }));
  s.appendChild(svg("text", { class: `${P}-rail-lbl`, x: L1, y: yTop - 12, "text-anchor": "middle" }, "L1"));
  s.appendChild(svg("text", { class: `${P}-rail-lbl`, x: L2, y: yTop - 12, "text-anchor": "middle" }, "L2"));

  // ---- wire SEGMENTS (each can light up live) -----------------------------
  // We name segments so the trace can energize them in sequence.
  const seg = {};
  function wire(name, x1, y1, x2, y2) {
    const ln = svg("line", { class: `${P}-wire`, x1, y1, x2, y2 });
    s.appendChild(ln);
    seg[name] = ln;
    return ln;
  }
  // node A: L1 -> stop contact in
  wire("a", L1, yMain, state.stop.x - 30, yMain);
  // node B: stop out -> junction (where start & seal split)
  const jLeft = 270;
  wire("b", state.stop.x + 30, yMain, jLeft, yMain);
  // start branch: junction -> start in (main line)
  wire("c", jLeft, yMain, state.start.x - 30, yMain);
  // junction C: start out -> right join
  const jRight = 392;
  wire("d", state.start.x + 30, yMain, jRight, yMain);
  // seal branch down + along + up
  wire("e_down", jLeft, yMain, jLeft, ySeal);
  wire("e", jLeft, ySeal, state.seal.x - 30, ySeal);
  wire("f", state.seal.x + 30, ySeal, jRight, ySeal);
  wire("f_up", jRight, ySeal, jRight, yMain);
  // join -> coil in
  const coilX = 432;
  wire("g", jRight, yMain, coilX - 16, yMain);
  // coil out -> L2
  wire("h", coilX + 16, yMain, L2, yMain);

  // junction dots
  s.appendChild(svg("circle", { class: `${P}-node`, cx: jLeft, cy: yMain, r: 4 }));
  s.appendChild(svg("circle", { class: `${P}-node`, cx: jRight, cy: yMain, r: 4 }));

  // ---- contacts (interactive) --------------------------------------------
  const contactEls = {};
  contactEls.stop  = makeContact(s, state.stop,  state.stop.x,  yMain, "Stop",  "NC");
  contactEls.start = makeContact(s, state.start, state.start.x, yMain, "Start", "NO");
  contactEls.seal  = makeContact(s, state.seal,  state.seal.x,  ySeal, "M",     "seal-in");

  // ---- coil ---------------------------------------------------------------
  const coilG = svg("g", { class: `${P}-coilg` });
  coilG.appendChild(svg("path", { class: `${P}-coil-arc l`, d: `M${coilX - 16} ${yMain - 18} A 18 18 0 0 0 ${coilX - 16} ${yMain + 18}` }));
  coilG.appendChild(svg("path", { class: `${P}-coil-arc r`, d: `M${coilX + 16} ${yMain - 18} A 18 18 0 0 1 ${coilX + 16} ${yMain + 18}` }));
  coilG.appendChild(svg("text", { class: `${P}-coil-txt`, x: coilX, y: yMain + 5, "text-anchor": "middle" }, "M"));
  coilG.appendChild(svg("text", { class: `${P}-coil-lbl`, x: coilX, y: yMain + 40, "text-anchor": "middle" }, "MOTOR COIL"));
  s.appendChild(coilG);

  // status banner under the rung
  const banner = el("div", `${P}-banner`);
  panel.appendChild(banner);

  // controls
  const controls = el("div", `${P}-controls`);
  const readBtn = el("button", `${P}-btn ${P}-btn-primary`, "Energize · Read the rung");
  const resetBtn = el("button", `${P}-btn ${P}-btn-ghost`, "Reset");
  controls.appendChild(readBtn);
  controls.appendChild(resetBtn);
  panel.appendChild(controls);

  const hint = el("div", `${P}-hint`,
    "Tip: click a contact to flip its state, then re-read. Open the NC Stop (or leave Start open) and watch the path break.");
  panel.appendChild(hint);

  // ---- ordered trace path (segment, then contact gate) --------------------
  // Each step lights a wire, then (if it's a contact) checks conduction.
  // The rung is: L1 -> stop -> [start OR seal] -> coil -> L2.
  let reading = false;

  function setBanner(kind, html) {
    banner.className = `${P}-banner ${P}-banner-${kind}`;
    banner.innerHTML = html;
  }

  function clearLive() {
    Object.values(seg).forEach((w) => w.classList.remove(`${P}-live`));
    s.classList.remove(`${P}-energized`);
    coilG.classList.remove(`${P}-coil-on`);
    Object.values(contactEls).forEach((c) => c.g.classList.remove(`${P}-c-conducting`, `${P}-c-tracing`));
  }

  function refreshContactVisual(key) {
    const c = contactEls[key];
    const st = state[key];
    c.g.classList.toggle(`${P}-c-closed`, st.made);
    c.g.classList.toggle(`${P}-c-open`, !st.made);
  }

  // Animate the trace. Returns nothing; updates banner + coil at the end.
  function readRung() {
    if (reading) return;
    reading = true;
    clearLive();
    readBtn.disabled = true;
    setBanner("trace", `<span class="${P}-dot"></span> Tracing from L1…`);

    // Build the live sequence. The two parallel branches are evaluated:
    // power reaches the right join if EITHER (start made) OR (seal made).
    const startPath = state.start.made;
    const sealPath = state.seal.made;
    const stopOk = state.stop.made;

    // step list: [segments to light together, optional gate text]
    const steps = [];
    steps.push({ segs: ["a"], label: "L1 reaches Stop" });
    steps.push({ contact: "stop", pass: stopOk, label: stopOk ? "Stop (NC) is closed — power passes" : "Stop (NC) is OPEN — path blocked" });
    if (!stopOk) {
      runSteps(steps, false);
      return;
    }
    steps.push({ segs: ["b"], label: "to the branch junction" });

    // parallel branches
    if (startPath) {
      steps.push({ segs: ["c"] });
      steps.push({ contact: "start", pass: true, label: "Start (NO) is held closed — power passes" });
      steps.push({ segs: ["d"] });
    } else if (sealPath) {
      steps.push({ segs: ["e_down", "e"] });
      steps.push({ contact: "seal", pass: true, label: "Seal-in M (NO) is latched — power passes" });
      steps.push({ segs: ["f", "f_up"] });
    } else {
      // neither branch conducts
      steps.push({ contact: "start", pass: false, label: "Start is open AND seal is open — no path to the coil" });
      runSteps(steps, false);
      return;
    }

    steps.push({ segs: ["g"], label: "to the coil" });
    steps.push({ segs: ["h"], coil: true, label: "Coil energizes — circuit complete to L2" });

    runSteps(steps, true);
  }

  function runSteps(steps, success) {
    let i = 0;
    const tick = () => {
      if (i >= steps.length) {
        finish(success);
        return;
      }
      const stp = steps[i];
      if (stp.segs) stp.segs.forEach((nm) => seg[nm] && seg[nm].classList.add(`${P}-live`));
      if (stp.contact) {
        const c = contactEls[stp.contact];
        c.g.classList.add(`${P}-c-tracing`);
        if (stp.pass) {
          c.g.classList.add(`${P}-c-conducting`);
        } else {
          c.g.classList.add(`${P}-c-blocked`);
        }
      }
      if (stp.coil) {
        coilG.classList.add(`${P}-coil-on`);
        s.classList.add(`${P}-energized`);
      }
      if (stp.label) {
        const cls = (stp.pass === false) ? "blocked" : "trace";
        setBanner(cls, `<span class="${P}-dot"></span> ${stp.label}`);
      }
      i++;
      window.setTimeout(tick, 480);
    };
    tick();
  }

  function finish(success) {
    reading = false;
    readBtn.disabled = false;
    if (success) {
      state.coil.energized = true;
      // latch the seal-in: once the coil pulls in, its aux M contact closes.
      state.seal.made = true;
      refreshContactVisual("seal");
      coilG.classList.add(`${P}-coil-on`);
      s.classList.add(`${P}-energized`);
      setBanner("ok",
        `<strong>Coil energized.</strong> Power found a complete path L1 → coil → L2. ` +
        `The seal-in M contact is now latched — Start can be released and the motor stays on.`);
    } else {
      state.coil.energized = false;
      state.seal.made = false;
      refreshContactVisual("seal");
      coilG.classList.remove(`${P}-coil-on`);
      s.classList.remove(`${P}-energized`);
      Object.values(seg).forEach((w) => w.classList.remove(`${P}-live`));
      setBanner("blocked",
        `<strong>Coil stays off.</strong> The path is broken before it reaches the coil — ` +
        `no current can flow, so the output never pulls in.`);
    }
  }

  // ---- contact flipping ---------------------------------------------------
  function flip(key) {
    if (reading) return;
    if (key === "seal") return; // seal-in mirrors the coil; not directly user-flippable
    state[key].made = !state[key].made;
    refreshContactVisual(key);

    // The latch lives in the SEAL. We model real behavior so the learner can
    // see WHY the seal-in matters:
    //   • Opening Stop (NC) always drops the coil and unlatches the seal.
    //   • Releasing Start AFTER the coil pulled in keeps the seal latched —
    //     the whole point of the seal-in branch — so power still has a path.
    if (key === "stop" && !state.stop.made) {
      state.coil.energized = false;
      state.seal.made = false;
    } else if (!state.coil.energized) {
      // no live latch yet: any change just invalidates the pending read
      state.seal.made = false;
    }
    refreshContactVisual("seal");
    clearLive();

    const c = state[key];
    const verb = c.made ? "closed (conducting)" : "open (blocked)";
    let extra = "Press “Read the rung” to trace power again.";
    if (key === "start" && !state.start.made && state.seal.made) {
      extra = "But the coil stays latched through the seal-in M contact — re-read to confirm the path still holds.";
    } else if (key === "stop" && !state.stop.made) {
      extra = "Opening the NC Stop breaks the rung at the source — re-read and the coil drops out.";
    }
    setBanner("idle", `${cap(key)} contact is now <strong>${verb}</strong>. ${extra}`);
  }
  contactEls.stop.hit.addEventListener("click", () => flip("stop"));
  contactEls.start.hit.addEventListener("click", () => flip("start"));

  // ---- buttons ------------------------------------------------------------
  readBtn.addEventListener("click", readRung);
  resetBtn.addEventListener("click", () => {
    if (reading) return;
    state.stop.made = true;
    state.start.made = false;
    state.seal.made = false;
    state.coil.energized = false;
    ["stop", "start", "seal"].forEach(refreshContactVisual);
    clearLive();
    setBanner("idle",
      `Reset to rest: Stop is closed (NC), Start is open (NO). ` +
      `Hold Start (click it closed) then read — the seal-in latches the coil on.`);
  });

  // initial paint
  ["stop", "start", "seal"].forEach(refreshContactVisual);
  setBanner("idle",
    `At rest: <strong>Stop NC is closed</strong>, <strong>Start NO is open</strong>. ` +
    `Click Start to hold it closed, then read the rung.`);
}

// build one interactive contact glyph centered at (x,y). returns {g, hit}.
function makeContact(s, st, x, y, label, tag) {
  const g = svg("g", { class: `${P}-contact`, "data-type": st.type });
  // incoming/outgoing stubs into the contact bars are part of the wire segs;
  // here we draw the two bars + (for NC) the slash.
  const barTop = y - 18, barBot = y + 18;
  // left bar
  g.appendChild(svg("line", { class: `${P}-c-bar`, x1: x - 12, y1: barTop, x2: x - 12, y2: barBot }));
  // right bar
  g.appendChild(svg("line", { class: `${P}-c-bar`, x1: x + 12, y1: barTop, x2: x + 12, y2: barBot }));
  // short connector stubs from wire end to bars
  g.appendChild(svg("line", { class: `${P}-c-stub`, x1: x - 30, y1: y, x2: x - 12, y2: y }));
  g.appendChild(svg("line", { class: `${P}-c-stub`, x1: x + 12, y1: y, x2: x + 30, y2: y }));
  // NC slash
  if (st.type === "nc") {
    g.appendChild(svg("line", { class: `${P}-c-slash`, x1: x - 16, y1: barBot + 2, x2: x + 16, y2: barTop - 2 }));
  }
  // label
  g.appendChild(svg("text", { class: `${P}-c-name`, x, y: barTop - 12, "text-anchor": "middle" }, label));
  g.appendChild(svg("text", { class: `${P}-c-tag`, x, y: barBot + 18, "text-anchor": "middle" }, tag));
  // invisible hit target (big, for easy clicking). The seal-in (M aux) contact
  // isn't user-flippable — it mirrors the coil (see flip()) — so its hit target
  // must NOT look clickable, or the cursor lies to the learner.
  const isFlippable = tag !== "seal-in";
  const hit = svg("rect", {
    class: `${P}-c-hit` + (isFlippable ? "" : ` ${P}-c-hit-inert`), x: x - 34, y: barTop - 22, width: 68, height: 76, rx: 8,
  });
  g.appendChild(hit);
  s.appendChild(g);
  return { g, hit, st };
}

function cap(k) {
  if (k === "stop") return "Stop";
  if (k === "start") return "Start";
  return k.charAt(0).toUpperCase() + k.slice(1);
}

// =============================================================================
// styles — every class prefixed with the slug
// =============================================================================
function styleEl() {
  const st = document.createElement("style");
  st.textContent = `
.${P}-root{
  font-family: var(--font-display, "Inter", system-ui, sans-serif);
  color: var(--text, #303749);
  width: 100%; height: 100%;
  box-sizing: border-box; padding: 22px 24px;
  display: flex; flex-direction: column; gap: 16px;
  background:
    radial-gradient(1100px 460px at 78% -8%, rgba(124,92,255,.06), transparent 60%),
    radial-gradient(900px 420px at -6% 110%, rgba(59,130,246,.07), transparent 60%);
}
.${P}-root *{ box-sizing: border-box; }

.${P}-head{ flex: 0 0 auto; }
.${P}-eyebrow{
  font-family: var(--font-mono, monospace);
  font-size: 11px; letter-spacing: .16em; font-weight: 600;
  color: var(--violet-deep, #6D28D9); margin-bottom: 4px;
}
.${P}-title{
  margin: 0 0 4px; font-size: 26px; font-weight: 800; letter-spacing: -.02em;
  color: var(--ink, #0E1326);
}
.${P}-sub{ margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--muted, #6B7488); max-width: 760px; }

.${P}-body{
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 268px 1fr; gap: 18px;
}

/* ---- panels ---- */
.${P}-panel{
  background: var(--surface, #fff);
  border: 1px solid var(--border, #E6EAF3);
  border-radius: 16px;
  box-shadow: 0 6px 28px -10px rgba(16,19,38,.12), 0 1px 3px rgba(16,19,38,.05);
  padding: 16px 16px 14px;
  display: flex; flex-direction: column; min-height: 0;
}
.${P}-panel-label{
  font-family: var(--font-mono, monospace);
  font-size: 11px; letter-spacing: .14em; font-weight: 600;
  color: var(--muted, #6B7488); margin-bottom: 12px; text-transform: uppercase;
}

/* ---- legend ---- */
.${P}-legend-list{ display: flex; flex-direction: column; gap: 6px; }
.${P}-leg-row{
  display: flex; align-items: center; gap: 10px;
  padding: 7px 9px; border-radius: 11px;
  border: 1px solid transparent;
  transition: background .18s ease, border-color .18s ease, transform .18s ease;
}
.${P}-leg-row:hover{
  background: var(--blue-soft, #EAF1FE);
  border-color: var(--border, #E6EAF3);
  transform: translateX(2px);
}
.${P}-leg-svg{ width: 78px; height: 38px; flex: 0 0 auto; }
.${P}-leg-name{ font-size: 13px; font-weight: 700; color: var(--ink, #0E1326); line-height: 1.1; }
.${P}-leg-sub{ font-size: 11px; color: var(--muted, #6B7488); margin-top: 1px; }

.${P}-g-wire{ stroke: var(--wire-rest, #94A3B8); stroke-width: 2.2; stroke-linecap: round; }
.${P}-g-bar{ stroke: var(--ink, #0E1326); stroke-width: 2.6; stroke-linecap: round; }
.${P}-g-slash{ stroke: var(--ink, #0E1326); stroke-width: 2.6; stroke-linecap: round; }
.${P}-g-coilL,.${P}-g-coilR{ stroke: var(--violet, #7C5CFF); stroke-width: 2.6; fill: none; }
.${P}-g-stem{ stroke: var(--ink,#0E1326); stroke-width: 2; }
.${P}-g-cap{ fill: var(--blue, #3B82F6); }
.${P}-g-heat{ stroke: var(--warning, #F59E0B); stroke-width: 2.6; stroke-linecap: round; }
.${P}-g-lampC{ stroke: var(--blue-deep, #2563EB); stroke-width: 2.4; fill: none; }
.${P}-g-lampX{ stroke: var(--blue-deep, #2563EB); stroke-width: 2.2; stroke-linecap: round; }

.${P}-leg-tip{
  margin-top: auto; padding-top: 12px;
  font-size: 11.5px; line-height: 1.5; color: var(--text, #303749);
}
.${P}-leg-tip strong{ color: var(--ink, #0E1326); }
.${P}-mono,.${P}-leg-tip .${P}-mono{
  font-family: var(--font-mono, monospace); font-weight: 600;
  color: var(--blue-deep, #2563EB);
  background: var(--blue-soft, #EAF1FE);
  padding: 1px 5px; border-radius: 5px; white-space: nowrap;
}

/* ---- rung panel ---- */
.${P}-rungpanel{ padding-bottom: 12px; }
.${P}-rung-svg{
  width: 100%; flex: 1 1 auto; min-height: 0;
  display: block;
}

.${P}-rail{ stroke: var(--ink, #0E1326); stroke-width: 4; stroke-linecap: round; }
.${P}-rail-lbl{
  font-family: var(--font-mono, monospace); font-size: 13px; font-weight: 700;
  fill: var(--ink, #0E1326);
}

.${P}-wire{
  stroke: var(--wire-rest, #94A3B8); stroke-width: 3; stroke-linecap: round;
  transition: stroke .2s ease;
}
.${P}-wire.${P}-live{
  stroke: var(--live, #EF4444); stroke-width: 3.4;
  filter: url(#${P}-glow);
  animation: ${P}-flow .9s linear infinite;
  stroke-dasharray: 9 7;
}
@keyframes ${P}-flow{ to{ stroke-dashoffset: -16; } }

.${P}-node{ fill: var(--wire-rest, #94A3B8); transition: fill .2s ease; }
.${P}-energized .${P}-node{ fill: var(--live, #EF4444); }

/* ---- contacts ---- */
.${P}-c-bar{ stroke: var(--ink, #0E1326); stroke-width: 3.4; stroke-linecap: round; transition: transform .2s ease; }
.${P}-c-stub{ stroke: var(--wire-rest, #94A3B8); stroke-width: 3; stroke-linecap: round; transition: stroke .2s ease; }
.${P}-c-slash{ stroke: var(--ink, #0E1326); stroke-width: 3; stroke-linecap: round; }
.${P}-c-name{ font-family: var(--font-mono, monospace); font-size: 13px; font-weight: 700; fill: var(--ink, #0E1326); }
.${P}-c-tag{ font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 600; fill: var(--muted, #6B7488); letter-spacing: .04em; }
.${P}-c-hit{ fill: transparent; cursor: pointer; }
.${P}-c-hit-inert{ cursor: default; }
.${P}-contact:hover .${P}-c-name{ fill: var(--blue-deep, #2563EB); }
.${P}-contact:hover .${P}-c-bar{ stroke: var(--blue-deep, #2563EB); }

/* open contact: bars splayed apart (gap), stubs go slate */
.${P}-c-open .${P}-c-bar{ stroke: var(--contact-open, #94A3B8); }
.${P}-c-open.${P}-contact .${P}-c-bar:first-of-type{ transform: translateX(-3px); }
.${P}-c-open .${P}-c-slash{ stroke: var(--contact-open, #94A3B8); }
/* closed contact: bars tight, firm ink */
.${P}-c-closed .${P}-c-bar{ stroke: var(--ink, #0E1326); }

/* tracing highlight */
.${P}-c-tracing .${P}-c-stub{ stroke: var(--live, #EF4444); }
.${P}-c-conducting .${P}-c-bar{ stroke: var(--live, #EF4444); filter: url(#${P}-glow); }
.${P}-c-conducting .${P}-c-stub{ stroke: var(--live, #EF4444); filter: url(#${P}-glow); }
.${P}-c-blocked .${P}-c-bar{ stroke: var(--live-label, #DC2626); }
.${P}-c-blocked .${P}-c-name{ fill: var(--live-label, #DC2626); }

/* ---- coil ---- */
.${P}-coil-arc{ stroke: var(--coil-idle, #C3CAD9); stroke-width: 3.4; fill: none; transition: stroke .25s ease; }
.${P}-coil-txt{ font-family: var(--font-mono, monospace); font-size: 16px; font-weight: 800; fill: var(--muted, #6B7488); transition: fill .25s ease; }
.${P}-coil-lbl{ font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 600; letter-spacing: .08em; fill: var(--muted, #6B7488); }
.${P}-coil-on .${P}-coil-arc{ stroke: var(--coil-energized, #7C5CFF); filter: url(#${P}-glow); }
.${P}-coil-on .${P}-coil-txt{ fill: var(--violet-deep, #6D28D9); }
.${P}-coil-on{ animation: ${P}-pulse 1.1s ease-in-out infinite; transform-origin: center; }
@keyframes ${P}-pulse{ 0%,100%{ opacity: 1; } 50%{ opacity: .82; } }

/* ---- banner ---- */
.${P}-banner{
  margin-top: 4px; padding: 10px 13px; border-radius: 11px;
  font-size: 12.5px; line-height: 1.45; min-height: 42px;
  display: flex; align-items: center;
  border: 1px solid var(--border, #E6EAF3);
  transition: background .2s ease, border-color .2s ease, color .2s ease;
}
.${P}-banner strong{ color: inherit; font-weight: 700; }
.${P}-banner-idle{ background: var(--surface-2, #FBFCFE); color: var(--muted, #6B7488); }
.${P}-banner-trace{ background: #FFF1F0; border-color: #FECACA; color: var(--live-label, #DC2626); }
.${P}-banner-blocked{ background: #FFF7ED; border-color: #FED7AA; color: #B45309; }
.${P}-banner-ok{ background: #ECFDF5; border-color: #A7F3D0; color: #047857; }
.${P}-dot{
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  margin-right: 9px; flex: 0 0 auto;
  background: currentColor; box-shadow: 0 0 0 0 currentColor;
  animation: ${P}-blip 1s ease-out infinite;
}
@keyframes ${P}-blip{ 0%{ box-shadow: 0 0 0 0 rgba(239,68,68,.5);} 100%{ box-shadow: 0 0 0 7px rgba(239,68,68,0);} }

/* ---- controls ---- */
.${P}-controls{ display: flex; gap: 10px; margin-top: 10px; }
.${P}-btn{
  font-family: var(--font-display, "Inter", sans-serif);
  font-size: 13px; font-weight: 700;
  padding: 10px 16px; border-radius: 11px; cursor: pointer;
  border: 1px solid transparent; transition: all .18s ease;
}
.${P}-btn:disabled{ opacity: .55; cursor: progress; }
.${P}-btn-primary{
  color: #fff; border: none;
  background: var(--grad, linear-gradient(135deg,#3B82F6,#7C5CFF));
  box-shadow: 0 10px 24px -10px rgba(59,130,246,.55);
}
.${P}-btn-primary:hover:not(:disabled){ transform: translateY(-1px); box-shadow: 0 14px 30px -10px rgba(59,130,246,.65); }
.${P}-btn-primary:active:not(:disabled){ transform: translateY(0); }
.${P}-btn-ghost{
  background: var(--surface, #fff); color: var(--text, #303749);
  border: 1px solid var(--border-strong, #D6DDEC);
}
.${P}-btn-ghost:hover:not(:disabled){ background: var(--blue-soft, #EAF1FE); border-color: var(--blue, #3B82F6); color: var(--blue-deep, #2563EB); }

.${P}-hint{ margin-top: 9px; font-size: 11px; line-height: 1.4; color: var(--muted, #6B7488); }

@media (prefers-reduced-motion: reduce){
  .${P}-wire.${P}-live{ animation: none; }
  .${P}-coil-on{ animation: none; }
  .${P}-dot{ animation: none; }
}
`;
  return st;
}
