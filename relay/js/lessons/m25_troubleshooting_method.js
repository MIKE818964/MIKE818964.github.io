// =============================================================================
// m25_troubleshooting_method.js — "A Systematic Troubleshooting Method"
// Interactive STEPPER through the 5-step method, applied to the 3-wire latch:
//   1. Know NORMAL          2. Identify the SYMPTOM      3. DIVIDE & CONQUER
//   4. MEASURE to localize  5. FIND, FIX & VERIFY
// The centerpiece is a divide-and-conquer "half-split" simulator on the latch:
// a hidden break sits somewhere along the control rung, and the learner is
// forced to pick the NEXT best measurement point. The app scores whether each
// choice halves the remaining search space, shows the live meter reading, and
// coaches toward measuring the MIDDLE (the coil) first.
//
// Self-contained ES module. Vanilla JS + inline SVG + scoped CSS (slug-prefixed).
// =============================================================================

const SLUG = "m25";

export function render(host) {
  // ----- scoped stylesheet (FIRST child, every class prefixed) ----------------
  const style = document.createElement("style");
  style.textContent = CSS;
  host.appendChild(style);

  const root = document.createElement("div");
  root.className = `${SLUG}-root`;
  host.appendChild(root);

  // ---------------------------------------------------------------- 5 steps ---
  const STEPS = [
    {
      k: "normal",
      n: 1,
      tag: "Step 1",
      title: "Know how it works NORMALLY",
      body:
        "Before you touch anything, read the print and picture the working circuit. " +
        "In our 3-wire latch, power flows L1 → NC Stop → Start/seal-in → the coil. " +
        "If you don't know what RIGHT looks like, you can't recognize WRONG.",
      tip: "Pull up the ladder print first. The print is your map for everything that follows.",
    },
    {
      k: "symptom",
      n: 2,
      tag: "Step 2",
      title: "Identify the exact SYMPTOM",
      body:
        "Pin the complaint down precisely: what works, what doesn't, and when it started. " +
        "“Motor won't start” is vague. “Press Start, nothing happens, no click at the contactor” " +
        "is a symptom you can chase.",
      tip: "Make the fault happen yourself once. A symptom you can reproduce is a symptom you can corner.",
    },
    {
      k: "divide",
      n: 3,
      tag: "Step 3",
      title: "DIVIDE & conquer — half-split it",
      body:
        "Don't walk the wire end to end. Test the MIDDLE and throw away half the circuit. " +
        "The natural midpoint of a control rung is the coil: is control voltage reaching it, or not? " +
        "One reading at the middle cuts the problem in two.",
      tip: "Every good measurement should eliminate roughly half of what's left. That's the whole game.",
    },
    {
      k: "measure",
      n: 4,
      tag: "Step 4",
      title: "MEASURE to localize the break",
      body:
        "Now follow the trail into the bad half. Voltage present up to here but gone past there? " +
        "The break is between those two probes. Keep halving until two adjacent points disagree — " +
        "that gap is your fault.",
      tip: "Voltage where you expect it = good upstream. Missing where you expect it = the break is just before you.",
    },
    {
      k: "verify",
      n: 5,
      tag: "Step 5",
      title: "Find the break, fix it — and VERIFY",
      body:
        "Repair the one bad component, then prove it. Run the full sequence: Start latches, release holds, " +
        "Stop drops out. Confirm you didn't break anything else and the original symptom is truly gone.",
      tip: "A repair isn't done until you've watched it work correctly with your own eyes.",
    },
  ];

  // build the persistent shell
  root.appendChild(buildHeader());
  const railWrap = buildRail(STEPS);
  root.appendChild(railWrap.el);
  const body = document.createElement("div");
  body.className = `${SLUG}-body`;
  root.appendChild(body);

  // state
  let cur = 0;

  // ----- panes (one per step) -------------------------------------------------
  const card = document.createElement("div");
  card.className = `${SLUG}-card`;
  body.appendChild(card);

  // the half-split sim lives in its own panel, shown on step 3+, fed live
  const sim = buildSplitSim();
  body.appendChild(sim.el);

  function show(i) {
    cur = Math.max(0, Math.min(STEPS.length - 1, i));
    const s = STEPS[cur];

    // rail highlight
    railWrap.dots.forEach((d, idx) => {
      d.classList.toggle("active", idx === cur);
      d.classList.toggle("done", idx < cur);
    });
    railWrap.fill.style.width = `${(cur / (STEPS.length - 1)) * 100}%`;

    // card content (animate in)
    card.classList.remove("in");
    void card.offsetWidth; // reflow to restart animation
    card.innerHTML =
      `<div class="${SLUG}-tag">${s.tag} of 5 · ${s.title}</div>` +
      `<h2 class="${SLUG}-h">${s.title}</h2>` +
      `<p class="${SLUG}-p">${s.body}</p>` +
      `<div class="${SLUG}-tip"><span class="${SLUG}-tip-l">PRACTICAL TIP</span>${s.tip}</div>`;
    card.classList.add("in");

    // the sim is the headline interaction; it activates from the DIVIDE step on
    const active = s.k === "divide" || s.k === "measure" || s.k === "verify";
    sim.setMode(s.k);
    sim.el.classList.toggle("dim", !active);

    btnPrev.disabled = cur === 0;
    btnNext.textContent = cur === STEPS.length - 1 ? "Restart ↺" : "Next step →";
  }

  // ----- footer nav -----------------------------------------------------------
  const nav = document.createElement("div");
  nav.className = `${SLUG}-nav`;
  const btnPrev = mkBtn("← Back", "ghost");
  const btnNext = mkBtn("Next step →", "solid");
  nav.appendChild(btnPrev);
  nav.appendChild(btnNext);
  root.appendChild(nav);

  btnPrev.addEventListener("click", () => show(cur - 1));
  btnNext.addEventListener("click", () => {
    if (cur === STEPS.length - 1) { sim.reset(); show(0); }
    else show(cur + 1);
  });

  // clicking a rail dot jumps to that step
  railWrap.dots.forEach((d, idx) => d.addEventListener("click", () => show(idx)));

  show(0);

  // ===========================================================================
  // helpers
  // ===========================================================================
  function buildHeader() {
    const h = document.createElement("div");
    h.className = `${SLUG}-head`;
    h.innerHTML =
      `<div class="${SLUG}-eyebrow">EXPERT · DIAGNOSTIC DISCIPLINE</div>` +
      `<h1 class="${SLUG}-title">A Systematic Troubleshooting Method</h1>` +
      `<p class="${SLUG}-sub">Good troubleshooters don't poke randomly — they follow a repeatable ` +
      `method. Click through the five steps, then half-split the live latch below.</p>`;
    return h;
  }

  function buildRail(steps) {
    const el = document.createElement("div");
    el.className = `${SLUG}-rail`;
    const track = document.createElement("div");
    track.className = `${SLUG}-track`;
    const fill = document.createElement("div");
    fill.className = `${SLUG}-track-fill`;
    track.appendChild(fill);
    el.appendChild(track);

    const dots = steps.map((s) => {
      const d = document.createElement("button");
      d.className = `${SLUG}-dot`;
      d.innerHTML =
        `<span class="${SLUG}-dot-n">${s.n}</span>` +
        `<span class="${SLUG}-dot-l">${shortLabel(s.k)}</span>`;
      el.appendChild(d);
      return d;
    });
    return { el, dots, fill };
  }

  function buildSplitSim() {
    // SVG schematic of the 3-wire latch laid out left-to-right as a single rung,
    // with 5 numbered TEST POINTS the learner can probe. A hidden break lives
    // between two adjacent points; voltage is present up to the break, gone past.
    const el = document.createElement("div");
    el.className = `${SLUG}-sim`;

    const head = document.createElement("div");
    head.className = `${SLUG}-sim-head`;
    head.innerHTML =
      `<div class="${SLUG}-sim-ttl">HALF-SPLIT THE LATCH · motor won’t start</div>` +
      `<div class="${SLUG}-sim-sub">Pick the NEXT best place to put your meter. ` +
      `Aim to eliminate half the circuit with every reading.</div>`;
    el.appendChild(head);

    // test points along the control rung (x positions match the SVG)
    // TP1 = after L1 (source) ... TP5 = at the coil (the load end / the MIDDLE)
    const TPS = [
      { id: 1, x: 96, label: "L1", desc: "incoming control power" },
      { id: 2, x: 230, label: "after STOP", desc: "past the NC Stop button" },
      { id: 3, x: 372, label: "after START", desc: "past Start / seal-in node" },
      { id: 4, x: 512, label: "coil A1", desc: "the coil's hot terminal — the MIDDLE" },
      { id: 5, x: 636, label: "coil A2", desc: "the coil's return terminal" },
    ];

    // The hidden fault: break sits BETWEEN tp `breakAfter` and the next one.
    // Voltage is present at any TP whose id <= breakAfter, and 0V beyond it.
    // (Plus A2 should read 0 relative to L1 only if the path never completes;
    // for teaching we model "voltage present along the rung up to the break".)
    let breakAfter = 2; // default scenario: open Start/seal-in node (after STOP)
    const probed = new Set();
    let firstProbe = null;

    const svg = mkSplitSVG(TPS);
    el.appendChild(svg.node);

    // verdict / coaching readout
    const read = document.createElement("div");
    read.className = `${SLUG}-readout`;
    read.innerHTML = `<div class="${SLUG}-rd-line">Probe a test point to take a reading.</div>`;
    el.appendChild(read);

    // half-split idea mini-diagram + score
    const foot = document.createElement("div");
    foot.className = `${SLUG}-sim-foot`;
    const score = document.createElement("div");
    score.className = `${SLUG}-score`;
    score.innerHTML = scoreHTML(0, "—");
    foot.appendChild(buildHalfSplitMini());
    foot.appendChild(score);
    el.appendChild(foot);

    let mode = "divide";
    let halfSplitHits = 0;
    let totalProbes = 0;

    function expectedVolt(tpId) {
      // present (24V) up to and including the break point; 0V after it
      return tpId <= breakAfter ? 24 : 0;
    }

    function rateChoice(tpId) {
      // Reward measuring the MIDDLE first (the coil, TP4) — the textbook
      // divide-and-conquer move that halves a 5-point rung in one reading.
      if (firstProbe === null) {
        if (tpId === 4) return { good: true, msg: "Textbook. Measuring the coil (the middle) first splits the rung clean in half." };
        if (tpId === 1 || tpId === 5) return { good: false, msg: "That's an end, not the middle — it barely narrows anything. Test the COIL first to halve the search." };
        return { good: true, msg: "Reasonable — but the coil is the true midpoint; that single reading would have eliminated the most." };
      }
      // after the first probe, reward narrowing toward the known-bad half
      return { good: true, msg: "Good follow-up — you're closing in on the gap between good and bad." };
    }

    function probe(tpId) {
      if (mode === "verify") return; // verify step uses the run-sequence, not probing
      const tp = TPS.find((t) => t.id === tpId);
      const v = expectedVolt(tpId);
      const rated = rateChoice(tpId);
      if (firstProbe === null) firstProbe = tpId;
      probed.add(tpId);
      totalProbes++;
      if (rated.good && (tpId === 4 || firstProbe !== tpId)) halfSplitHits++;
      else if (rated.good) halfSplitHits++;

      svg.markProbe(tpId, v);

      const verdict =
        v > 0
          ? `<b class="${SLUG}-good">24&nbsp;VDC present</b> at ${tp.label} — everything UPSTREAM of here is good.`
          : `<b class="${SLUG}-bad">0&nbsp;V</b> at ${tp.label} — the break is somewhere BEFORE this point.`;

      read.innerHTML =
        `<div class="${SLUG}-rd-meter">${v.toFixed(1)}<span>VDC</span></div>` +
        `<div class="${SLUG}-rd-body">` +
        `<div class="${SLUG}-rd-line">${verdict}</div>` +
        `<div class="${SLUG}-rd-coach ${rated.good ? "ok" : "warn"}">${rated.good ? "✓ " : "⚠ "}${rated.msg}</div>` +
        `</div>`;

      // if learner has bracketed the break (a present TP immediately followed by
      // a 0V TP), reveal the localized fault
      maybeLocalize();

      const pct = totalProbes ? Math.round((halfSplitHits / totalProbes) * 100) : 0;
      score.innerHTML = scoreHTML(pct, `${totalProbes} reading${totalProbes === 1 ? "" : "s"}`);
    }

    function maybeLocalize() {
      const present = [...probed].filter((id) => expectedVolt(id) > 0).sort((a, b) => a - b);
      const dead = [...probed].filter((id) => expectedVolt(id) === 0).sort((a, b) => a - b);
      if (!present.length || !dead.length) return;
      const lastGood = Math.max(...present);
      const firstDead = Math.min(...dead);
      if (firstDead === lastGood + 1) {
        const a = TPS.find((t) => t.id === lastGood);
        const b = TPS.find((t) => t.id === firstDead);
        svg.showBreakBetween(lastGood, firstDead);
        read.innerHTML +=
          `<div class="${SLUG}-localized">⚡ FAULT LOCALIZED: voltage is good at ` +
          `<b>${a.label}</b> but gone by <b>${b.label}</b>. The open is in the ` +
          `component between them. Fix it — then VERIFY.</div>`;
      }
    }

    function setMode(k) {
      mode = k;
      svg.node.classList.toggle(`${SLUG}-svg-verify`, k === "verify");
      svg.setProbeEnabled(k !== "verify");
      if (k === "verify") {
        // verify mode: show the "run the sequence" confirm strip
        svg.setVerify(true);
      } else {
        svg.setVerify(false);
      }
    }

    function reset() {
      probed.clear();
      firstProbe = null;
      totalProbes = 0;
      halfSplitHits = 0;
      svg.clearProbes();
      read.innerHTML = `<div class="${SLUG}-rd-line">Probe a test point to take a reading.</div>`;
      score.innerHTML = scoreHTML(0, "—");
    }

    // wire up clickable test points + verify-run button
    svg.onProbe(probe);
    svg.onVerify(() => {
      read.innerHTML =
        `<div class="${SLUG}-rd-body"><div class="${SLUG}-rd-line ${SLUG}-good">` +
        `✓ Sequence verified: Start latches, release holds, Stop drops out. ` +
        `The original symptom is gone and nothing else broke. Job done.</div></div>`;
      svg.runVerify();
    });

    return { el, setMode, reset };
  }

  // ---- the half-split idea mini-graphic --------------------------------------
  function buildHalfSplitMini() {
    const wrap = document.createElement("div");
    wrap.className = `${SLUG}-mini`;
    wrap.innerHTML =
      `<div class="${SLUG}-mini-ttl">THE HALF-SPLIT IDEA</div>` +
      `<svg viewBox="0 -12 240 102" class="${SLUG}-mini-svg" aria-hidden="true">` +
      // full bar
      `<rect x="8" y="10" width="224" height="14" rx="7" class="${SLUG}-mini-full"/>` +
      `<text x="120" y="3" text-anchor="middle" class="${SLUG}-mini-cap">whole circuit</text>` +
      // arrow to the middle
      `<line x1="120" y1="26" x2="120" y2="40" class="${SLUG}-mini-tick"/>` +
      `<text x="120" y="50" text-anchor="middle" class="${SLUG}-mini-mid">test the MIDDLE</text>` +
      // two halves, one eliminated
      `<rect x="8" y="58" width="108" height="14" rx="7" class="${SLUG}-mini-gone"/>` +
      `<rect x="124" y="58" width="108" height="14" rx="7" class="${SLUG}-mini-keep"/>` +
      `<text x="62" y="86" text-anchor="middle" class="${SLUG}-mini-x">✕ eliminated</text>` +
      `<text x="178" y="86" text-anchor="middle" class="${SLUG}-mini-k">keep hunting</text>` +
      `</svg>`;
    return wrap;
  }

  // ---- the latch SVG with clickable test points ------------------------------
  function mkSplitSVG(TPS) {
    const NS = "http://www.w3.org/2000/svg";
    const node = document.createElementNS(NS, "svg");
    node.setAttribute("viewBox", "0 0 720 220");
    node.setAttribute("class", `${SLUG}-svg`);
    node.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const el = (n, a = {}, t) => {
      const e = document.createElementNS(NS, n);
      for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
      if (t != null) e.textContent = t;
      return e;
    };

    // left + right rails (the rung runs between them, drawn horizontally)
    const railY = 92;
    // raised from y=30 so the bigger label clears TP1's "L1" label row below it
    node.appendChild(el("text", { x: 20, y: 16, class: `${SLUG}-sv-rail-l` }, "L1 (+24VDC)"));
    // right-aligned + raised above the TP5 ("coil A2") label row so the two
    // never collide — the rail runs to x=636 (TP5), so anchoring "end" at x=636
    // grows the text leftward, clear of the TP5 dot/number/label stack below it.
    node.appendChild(el("text", { x: 636, y: 16, "text-anchor": "end", class: `${SLUG}-sv-rail-l` }, "L2 / common"));

    // main conductor (animated dashed energized line lives on top)
    node.appendChild(el("line", { x1: 96, y1: railY, x2: 636, y2: railY, class: `${SLUG}-sv-wire` }));
    const flow = el("line", { x1: 96, y1: railY, x2: 636, y2: railY, class: `${SLUG}-sv-flow` });
    node.appendChild(flow);

    // source terminal (left)
    node.appendChild(el("circle", { cx: 96, cy: railY, r: 6, class: `${SLUG}-sv-src` }));

    // --- NC Stop button (between TP1 and TP2) : -|/|-  ------------------------
    drawNC(node, el, 150, railY, "STOP (NC)");
    // --- Start + seal-in node (between TP2 and TP3) : -| |- with parallel  ----
    drawStartSeal(node, el, 290, railY);
    // --- coil (rectangle) at the right end (between TP3 and TP4/A1) ----------
    drawCoil(node, el, 470, railY);

    // --- numbered test points (clickable) ------------------------------------
    const tpEls = {};
    const cbProbe = { fn: null };
    for (const tp of TPS) {
      const g = el("g", { class: `${SLUG}-sv-tp clickable`, tabindex: "0", role: "button" });
      g.appendChild(el("line", { x1: tp.x, y1: railY, x2: tp.x, y2: railY - 34, class: `${SLUG}-sv-tplead` }));
      const dot = el("circle", { cx: tp.x, cy: railY - 42, r: 13, class: `${SLUG}-sv-tpdot` });
      g.appendChild(dot);
      g.appendChild(el("text", { x: tp.x, y: railY - 38, "text-anchor": "middle", class: `${SLUG}-sv-tpn` }, String(tp.id)));
      g.appendChild(el("text", { x: tp.x, y: railY - 60, "text-anchor": "middle", class: `${SLUG}-sv-tplbl` }, tp.label));
      const click = () => cbProbe.fn && cbProbe.fn(tp.id);
      g.addEventListener("click", click);
      g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); click(); } });
      node.appendChild(g);
      tpEls[tp.id] = { g, dot };
    }

    // a floating meter chip that hops to the probed point
    const meter = el("g", { class: `${SLUG}-sv-meter`, opacity: "0" });
    meter.appendChild(el("rect", { x: -34, y: 120, width: 68, height: 30, rx: 8, class: `${SLUG}-sv-meterbg` }));
    const meterTxt = el("text", { x: 0, y: 140, "text-anchor": "middle", class: `${SLUG}-sv-metertxt` }, "");
    meter.appendChild(meterTxt);
    meter.appendChild(el("path", { d: "M 0 116 l -6 -8 l 12 0 z", class: `${SLUG}-sv-meterpt` }));
    node.appendChild(meter);

    // break marker (hidden until localized)
    const brk = el("g", { class: `${SLUG}-sv-break`, opacity: "0" });
    brk.appendChild(el("text", { x: 0, y: railY + 4, "text-anchor": "middle", class: `${SLUG}-sv-breaktxt` }, "✕"));
    node.appendChild(brk);

    // verify confirm strip (hidden unless verify mode)
    const verify = el("g", { class: `${SLUG}-sv-verifyg`, opacity: "0" });
    const vbtn = el("g", { class: `${SLUG}-sv-runbtn clickable`, role: "button", tabindex: "0" });
    vbtn.appendChild(el("rect", { x: 250, y: 168, width: 220, height: 38, rx: 19, class: `${SLUG}-sv-runbg` }));
    vbtn.appendChild(el("text", { x: 360, y: 192, "text-anchor": "middle", class: `${SLUG}-sv-runtxt` }, "▶  RUN THE SEQUENCE"));
    verify.appendChild(vbtn);
    node.appendChild(verify);
    const cbVerify = { fn: null };
    const fireV = () => cbVerify.fn && cbVerify.fn();
    vbtn.addEventListener("click", fireV);
    vbtn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fireV(); } });

    function markProbe(tpId, volts) {
      // color the dot by reading; hop meter chip to it
      Object.values(tpEls).forEach((t) => t.dot.classList.remove("good", "bad"));
      const t = tpEls[tpId];
      t.dot.classList.add(volts > 0 ? "good" : "bad");
      const tp = TPS.find((p) => p.id === tpId);
      meter.setAttribute("transform", `translate(${tp.x},0)`);
      meter.setAttribute("opacity", "1");
      meterTxt.textContent = `${volts.toFixed(0)} V`;
      meterTxt.setAttribute("class", `${SLUG}-sv-metertxt ${volts > 0 ? "good" : "bad"}`);
      // energize the conductor visually up to the last good point
      flow.classList.add("on");
    }

    function showBreakBetween(goodId, deadId) {
      const a = TPS.find((t) => t.id === goodId), b = TPS.find((t) => t.id === deadId);
      const mid = (a.x + b.x) / 2;
      brk.setAttribute("transform", `translate(${mid},0)`);
      brk.setAttribute("opacity", "1");
    }

    function clearProbes() {
      Object.values(tpEls).forEach((t) => t.dot.classList.remove("good", "bad"));
      meter.setAttribute("opacity", "0");
      brk.setAttribute("opacity", "0");
      flow.classList.remove("on", "verified");
    }

    function setVerify(on) {
      verify.setAttribute("opacity", on ? "1" : "0");
    }
    function runVerify() {
      flow.classList.add("on", "verified");
    }

    // Step 5 (Verify) disables probe() entirely (see probe()'s early-return in
    // the outer scope) — so the test points must also stop LOOKING and ACTING
    // like buttons: drop role/tabindex so screen readers and focus order agree
    // with the (already CSS-disabled) visual state.
    function setProbeEnabled(on) {
      Object.values(tpEls).forEach(({ g }) => {
        if (on) {
          g.setAttribute("role", "button");
          g.setAttribute("tabindex", "0");
        } else {
          g.removeAttribute("role");
          g.setAttribute("tabindex", "-1");
        }
      });
    }

    return {
      node,
      onProbe(fn) { cbProbe.fn = fn; },
      onVerify(fn) { cbVerify.fn = fn; },
      markProbe, showBreakBetween, clearProbes, setVerify, runVerify, setProbeEnabled,
    };

    // ---- schematic symbol drawers ----
    function drawNC(svg, el, x, y, label) {
      // normally-closed contact: two terminals + slashed bar  -|/|-
      svg.appendChild(el("line", { x1: x - 22, y1: y, x2: x - 14, y2: y, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("line", { x1: x + 14, y1: y, x2: x + 22, y2: y, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("line", { x1: x - 14, y1: y - 14, x2: x - 14, y2: y + 14, class: `${SLUG}-sv-sym` }));
      svg.appendChild(el("line", { x1: x + 14, y1: y - 14, x2: x + 14, y2: y + 14, class: `${SLUG}-sv-sym` }));
      svg.appendChild(el("line", { x1: x - 16, y1: y + 14, x2: x + 16, y2: y - 14, class: `${SLUG}-sv-sym` })); // slash = NC
      svg.appendChild(el("text", { x, y: y + 34, "text-anchor": "middle", class: `${SLUG}-sv-syml` }, label));
    }

    function drawStartSeal(svg, el, x, y) {
      // start NO contact -| |-  with a parallel seal-in branch below it
      svg.appendChild(el("line", { x1: x - 30, y1: y, x2: x - 14, y2: y, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("line", { x1: x + 14, y1: y, x2: x + 30, y2: y, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("line", { x1: x - 14, y1: y - 14, x2: x - 14, y2: y + 14, class: `${SLUG}-sv-sym` }));
      svg.appendChild(el("line", { x1: x + 14, y1: y - 14, x2: x + 14, y2: y + 14, class: `${SLUG}-sv-sym` }));
      svg.appendChild(el("text", { x, y: y - 22, "text-anchor": "middle", class: `${SLUG}-sv-syml` }, "START (NO)"));
      // parallel seal-in branch
      const yb = y + 32;
      svg.appendChild(el("path", { d: `M ${x - 30} ${y} L ${x - 30} ${yb} L ${x - 14} ${yb}`, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("path", { d: `M ${x + 14} ${yb} L ${x + 30} ${yb} L ${x + 30} ${y}`, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("line", { x1: x - 14, y1: yb - 11, x2: x - 14, y2: yb + 11, class: `${SLUG}-sv-sym` }));
      svg.appendChild(el("line", { x1: x + 14, y1: yb - 11, x2: x + 14, y2: yb + 11, class: `${SLUG}-sv-sym` }));
      svg.appendChild(el("text", { x, y: yb + 26, "text-anchor": "middle", class: `${SLUG}-sv-syml dim` }, "seal-in"));
    }

    function drawCoil(svg, el, x, y) {
      // coil as a rectangle (relay/coil symbol) in the rung, labeled A1/A2
      svg.appendChild(el("line", { x1: x - 40, y1: y, x2: x - 24, y2: y, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("line", { x1: x + 24, y1: y, x2: x + 40, y2: y, class: `${SLUG}-sv-wire` }));
      svg.appendChild(el("rect", { x: x - 24, y: y - 16, width: 48, height: 32, rx: 5, class: `${SLUG}-sv-coil` }));
      svg.appendChild(el("text", { x, y: y + 5, "text-anchor": "middle", class: `${SLUG}-sv-coiltxt` }, "CR"));
      svg.appendChild(el("text", { x: x - 30, y: y - 22, "text-anchor": "middle", class: `${SLUG}-sv-syml dim` }, "A1"));
      svg.appendChild(el("text", { x: x + 30, y: y - 22, "text-anchor": "middle", class: `${SLUG}-sv-syml dim` }, "A2"));
    }
  }

  function scoreHTML(pct, sub) {
    const grade = pct >= 80 ? "great" : pct >= 50 ? "ok" : "low";
    return (
      `<div class="${SLUG}-score-lbl">DIVIDE-&-CONQUER SCORE</div>` +
      `<div class="${SLUG}-score-row">` +
      `<div class="${SLUG}-score-pct ${grade}">${pct}%</div>` +
      `<div class="${SLUG}-score-sub">${sub}<br><span>readings that halved the search</span></div>` +
      `</div>`
    );
  }

  function shortLabel(k) {
    return { normal: "Normal", symptom: "Symptom", divide: "Divide", measure: "Measure", verify: "Verify" }[k];
  }

  function mkBtn(txt, kind) {
    const b = document.createElement("button");
    b.className = `${SLUG}-btn ${SLUG}-btn-${kind}`;
    b.textContent = txt;
    return b;
  }
}

// =============================================================================
// scoped CSS — every selector prefixed with .m25- (or [class].m25-...)
// =============================================================================
const CSS = `
.m25-root{
  --m25-blue: var(--blue, #3B82F6);
  --m25-blue-deep: var(--blue-deep, #2563EB);
  --m25-blue-soft: var(--blue-soft, #EAF1FE);
  --m25-violet: var(--violet, #7C5CFF);
  --m25-ink: var(--ink, #0E1326);
  --m25-text: var(--text, #303749);
  --m25-muted: var(--muted, #6B7488);
  --m25-surface: var(--surface, #FFFFFF);
  --m25-border: var(--border, #E6EAF3);
  --m25-live: var(--live, #EF4444);
  --m25-good: #16A34A;
  --m25-grad: var(--grad, linear-gradient(135deg,#3B82F6,#7C5CFF));
  font-family: var(--font-display, "Inter", system-ui, sans-serif);
  color: var(--m25-text);
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  padding: 22px 26px 18px;
  box-sizing: border-box;
  overflow: auto;
  container-type: inline-size;   /* respond to the STAGE width, not the window */
}

/* ---- header ---- */
.m25-head{ flex: 0 0 auto; }
.m25-eyebrow{
  display:inline-flex; align-items:center; gap:8px;
  font-family: var(--font-mono, "JetBrains Mono", monospace);
  font-size: 11px; font-weight: 700; letter-spacing: .14em;
  color: var(--m25-blue-deep); margin-bottom: 8px;
}
.m25-eyebrow::before{ content:""; width:24px; height:2px; border-radius:2px; background:var(--m25-grad); }
.m25-title{
  font-size: 27px; font-weight: 800; letter-spacing: -0.025em;
  color: var(--m25-ink); line-height: 1.06; margin: 0 0 6px;
}
.m25-sub{ font-size: 13.5px; line-height: 1.55; color: var(--m25-muted); max-width: 760px; margin:0; }

/* ---- step rail ---- */
.m25-rail{
  position: relative; flex: 0 0 auto;
  display: flex; justify-content: space-between; align-items: flex-start;
  margin: 20px 6px 16px; padding: 0 4px;
}
.m25-track{
  position:absolute; left: 26px; right: 26px; top: 18px; height: 4px;
  background: var(--m25-border); border-radius: 4px; overflow: hidden;
}
.m25-track-fill{
  height: 100%; width: 0; background: var(--m25-grad);
  border-radius: 4px; transition: width .45s cubic-bezier(.4,0,.2,1);
  box-shadow: 0 0 10px rgba(124,92,255,.45);
}
.m25-dot{
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 7px;
  background: none; border: none; cursor: pointer; padding: 0;
  font-family: inherit;
}
.m25-dot.active{ cursor: default; }
.m25-dot-n{
  width: 38px; height: 38px; border-radius: 50%;
  display: grid; place-items: center;
  font-size: 15px; font-weight: 800;
  background: var(--m25-surface); color: var(--m25-muted);
  border: 2px solid var(--m25-border);
  transition: all .3s cubic-bezier(.4,0,.2,1);
  box-shadow: 0 1px 3px rgba(14,19,38,.06);
}
.m25-dot-l{
  font-family: var(--font-mono, monospace);
  font-size: 11px; font-weight: 600; letter-spacing: .06em;
  color: var(--m25-muted); text-transform: uppercase;
  transition: color .25s ease;
}
.m25-dot:hover .m25-dot-n{ border-color: var(--m25-blue); color: var(--m25-blue-deep); }
.m25-dot.done .m25-dot-n{
  background: var(--m25-violet); color: #fff; border-color: transparent;
  box-shadow: 0 0 10px rgba(124,92,255,.5);
}
.m25-dot.active .m25-dot-n{
  background: var(--m25-grad); color:#fff; border-color: transparent;
  transform: scale(1.14);
  box-shadow: 0 4px 16px rgba(59,130,246,.5);
}
.m25-dot.active .m25-dot-l{ color: var(--m25-blue-deep); font-weight: 800; }

/* ---- body: card + sim ---- */
.m25-body{
  flex: 1 1 auto;
  display: grid; grid-template-columns: 0.86fr 1.14fr; gap: 18px;
  min-height: 0;
}
.m25-card{
  background: var(--m25-surface);
  border: 1px solid var(--m25-border);
  border-radius: 16px;
  padding: 22px 22px 20px;
  box-shadow: 0 4px 18px rgba(14,19,38,.05);
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
}
.m25-card::before{
  content:""; position:absolute; left:0; top:0; bottom:0; width:5px;
  background: var(--m25-grad);
}
.m25-card.in{ animation: m25-slidein .42s cubic-bezier(.2,.7,.2,1); }
@keyframes m25-slidein{
  from{ opacity:0; transform: translateY(10px); }
  to{ opacity:1; transform:none; }
}
.m25-tag{
  font-family: var(--font-mono, monospace);
  font-size: 11px; font-weight: 700; letter-spacing:.1em;
  text-transform: uppercase; color: var(--m25-blue-deep);
  margin-bottom: 10px; padding-left: 4px;
}
.m25-h{
  font-size: 20px; font-weight: 800; letter-spacing:-0.02em;
  color: var(--m25-ink); line-height:1.12; margin: 0 0 12px; padding-left:4px;
}
.m25-p{
  font-size: 14.5px; line-height: 1.62; color: var(--m25-text);
  margin: 0 0 16px; padding-left:4px;
}
.m25-tip{
  margin-top: auto;
  background: var(--m25-blue-soft);
  border: 1px solid rgba(59,130,246,.22);
  border-radius: 12px; padding: 13px 15px;
  font-size: 13.5px; line-height:1.5; color: var(--m25-text);
}
.m25-tip-l{
  display:block;
  font-family: var(--font-mono, monospace);
  font-size: 11px; font-weight:700; letter-spacing:.12em;
  color: var(--m25-blue-deep); margin-bottom: 5px;
}

/* ---- the half-split sim panel ---- */
.m25-sim{
  background: var(--m25-surface);
  border: 1px solid var(--m25-border);
  border-radius: 16px;
  padding: 16px 18px 14px;
  box-shadow: 0 4px 18px rgba(14,19,38,.05);
  display: flex; flex-direction: column; gap: 10px;
  transition: opacity .35s ease, filter .35s ease;
  min-height: 0;
}
.m25-sim.dim{ opacity: .55; filter: saturate(.5); }
.m25-sim-head{ flex:0 0 auto; }
.m25-sim-ttl{
  font-family: var(--font-mono, monospace);
  font-size: 11px; font-weight:700; letter-spacing:.08em;
  text-transform: uppercase; color: var(--m25-ink);
}
.m25-sim-sub{ font-size: 12.5px; line-height:1.45; color: var(--m25-muted); margin-top:3px; }

.m25-svg{ width:100%; height:auto; display:block; flex:0 0 auto; }
/* sim svg renders at ~0.58x of its 720-unit viewBox — sizes pre-compensated ≥ ~11px effective */
.m25-sv-rail-l{ font-family: var(--font-mono, monospace); font-size: 19px; font-weight:700; fill: var(--m25-muted); }
.m25-sv-wire{ stroke: var(--m25-ink); stroke-width: 2.4; stroke-linecap: round; fill:none; }
.m25-sv-sym{ stroke: var(--m25-ink); stroke-width: 2.6; stroke-linecap: round; }
.m25-sv-src{ fill: var(--m25-blue); }
.m25-sv-coil{ fill: var(--m25-surface); stroke: var(--m25-violet); stroke-width: 2.6; }
.m25-sv-coiltxt{ font-family: var(--font-mono, monospace); font-size: 20px; font-weight:800; fill: var(--violet-deep,#6D28D9); }
.m25-sv-syml{ font-family: var(--font-mono, monospace); font-size: 19px; font-weight:700; fill: var(--m25-text); }
.m25-sv-syml.dim{ fill: var(--m25-muted); font-weight: 600; }

.m25-sv-flow{
  stroke: var(--m25-blue); stroke-width: 3.4; stroke-linecap: round; fill:none;
  stroke-dasharray: 9 11; stroke-dashoffset: 0; opacity: 0;
  transition: opacity .3s ease;
}
.m25-sv-flow.on{ opacity: .9; animation: m25-flow 0.7s linear infinite; }
.m25-sv-flow.verified{ stroke: var(--m25-good); }
@keyframes m25-flow{ to{ stroke-dashoffset: -40; } }

/* test points */
.m25-sv-tplead{ stroke: var(--m25-border); stroke-width: 2; }
.m25-sv-tpdot{
  fill: var(--m25-surface); stroke: var(--m25-blue); stroke-width: 2.4;
  transition: all .2s ease; cursor: pointer;
}
.m25-sv-tp:hover .m25-sv-tpdot{ fill: var(--m25-blue-soft); transform-box: fill-box; }
.m25-sv-tp:hover .m25-sv-tpdot{ r: 14.5; }
.m25-sv-tpdot.good{ fill: var(--m25-good); stroke: var(--m25-good); }
.m25-sv-tpdot.bad{ fill: var(--m25-live); stroke: var(--m25-live); }
.m25-sv-tpn{ font-family: var(--font-mono, monospace); font-size: 19px; font-weight:800; fill: var(--m25-blue-deep); pointer-events:none; }
.m25-sv-tpdot.good + .m25-sv-tpn, .m25-sv-tp .m25-sv-tpdot.good ~ .m25-sv-tpn{ fill:#fff; }
.m25-sv-tplbl{ font-family: var(--font-mono, monospace); font-size: 19px; font-weight:700; fill: var(--m25-muted); pointer-events:none; }
.m25-sv-tp:focus{ outline: none; }
.m25-sv-tp:focus-visible .m25-sv-tpdot{ stroke: var(--m25-violet); stroke-width: 3.4; }

/* Step 5 (Verify): probing is disabled (see probe()'s early-return) — the test
   points must stop LOOKING clickable, or the cursor lies to the learner. */
.m25-svg-verify .m25-sv-tp{ cursor: default; pointer-events: none; opacity: .45; }

/* floating meter chip */
.m25-sv-meter{ transition: opacity .25s ease; }
.m25-sv-meterbg{ fill: var(--m25-ink); }
.m25-sv-metertxt{ font-family: var(--font-mono, monospace); font-size: 14px; font-weight:800; fill:#fff; }
.m25-sv-metertxt.good{ fill: #6EE7A8; }
.m25-sv-metertxt.bad{ fill: #FCA5A5; }
.m25-sv-meterpt{ fill: var(--m25-ink); }

.m25-sv-break{ transition: opacity .3s ease; }
.m25-sv-breaktxt{ font-size: 26px; font-weight:800; fill: var(--m25-live); }

.m25-sv-runbg{ fill: var(--m25-violet); }
.m25-sv-runtxt{ font-family: var(--font-mono, monospace); font-size: 13px; font-weight:800; fill:#fff; letter-spacing:.04em; }
.m25-sv-runbtn{ cursor:pointer; transition: opacity .2s ease; }
.m25-sv-runbtn:hover .m25-sv-runbg{ fill: var(--m25-blue-deep); }
.m25-sv-verifyg{ transition: opacity .3s ease; }

/* readout */
.m25-readout{
  flex: 0 0 auto;
  background: var(--m25-blue-soft);
  border: 1px solid rgba(59,130,246,.22);
  border-radius: 12px; padding: 12px 14px;
  display: flex; align-items: center; gap: 14px;
  min-height: 60px;
}
.m25-rd-meter{
  font-family: var(--font-mono, monospace);
  font-size: 30px; font-weight: 800; color: var(--m25-blue-deep);
  line-height:1; flex:0 0 auto;
}
.m25-rd-meter span{ font-size: 12px; margin-left: 3px; color: var(--m25-muted); }
.m25-rd-body{ flex:1 1 auto; }
.m25-rd-line{ font-size: 13.5px; line-height:1.5; color: var(--m25-text); }
.m25-rd-coach{ font-size: 12.5px; line-height:1.45; margin-top: 6px; font-weight:600; }
.m25-rd-coach.ok{ color: var(--m25-good); }
.m25-rd-coach.warn{ color: var(--m25-blue-deep); }
.m25-good{ color: var(--m25-good); }
.m25-bad{ color: var(--m25-live); }
.m25-localized{
  margin-top: 10px; padding: 11px 13px;
  background: rgba(124,92,255,.08);
  border: 1px solid rgba(124,92,255,.3);
  border-radius: 10px; font-size: 13px; line-height:1.5; color: var(--m25-text);
  animation: m25-pop .35s cubic-bezier(.2,.8,.2,1);
}
@keyframes m25-pop{ from{opacity:0; transform: scale(.97);} to{opacity:1; transform:none;} }

/* footer of sim: mini half-split + score */
.m25-sim-foot{
  flex: 0 0 auto;
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  align-items: stretch;
}
.m25-mini, .m25-score{
  background: var(--m25-surface);
  border: 1px solid var(--m25-border);
  border-radius: 12px; padding: 10px 12px;
}
.m25-mini-ttl, .m25-score-lbl{
  font-family: var(--font-mono, monospace);
  font-size: 11px; font-weight:700; letter-spacing:.1em;
  text-transform: uppercase; color: var(--m25-muted); margin-bottom: 6px;
}
.m25-mini-svg{ width:100%; height:auto; display:block; }
.m25-mini-full{ fill: var(--m25-blue-soft); stroke: var(--m25-blue); stroke-width:1.4; }
.m25-mini-cap{ font-family: var(--font-mono, monospace); font-size: 15px; fill: var(--m25-muted); }
.m25-mini-tick{ stroke: var(--m25-violet); stroke-width: 2; stroke-dasharray: 2 2; }
.m25-mini-mid{ font-family: var(--font-mono, monospace); font-size: 15.5px; font-weight:700; fill: var(--violet-deep,#6D28D9); }
.m25-mini-gone{ fill: #F1F2F6; stroke: var(--m25-border); stroke-width:1.4; }
.m25-mini-keep{ fill: var(--m25-blue-soft); stroke: var(--m25-blue); stroke-width:1.4; }
.m25-mini-x{ font-family: var(--font-mono, monospace); font-size: 15px; fill: var(--m25-muted); }
.m25-mini-k{ font-family: var(--font-mono, monospace); font-size: 15px; font-weight:700; fill: var(--m25-blue-deep); }

.m25-score-row{ display:flex; align-items:center; gap:10px; }
.m25-score-pct{ font-family: var(--font-mono, monospace); font-size: 30px; font-weight:800; line-height:1; }
.m25-score-pct.great{ color: var(--m25-good); }
.m25-score-pct.ok{ color: var(--m25-blue-deep); }
.m25-score-pct.low{ color: var(--m25-muted); }
.m25-score-sub{ font-size: 11px; line-height:1.35; color: var(--m25-text); }
.m25-score-sub span{ color: var(--m25-muted); }

/* footer nav */
.m25-nav{
  flex: 0 0 auto;
  display: flex; justify-content: space-between; gap: 12px;
  margin-top: 16px;
}
.m25-btn{
  padding: 11px 22px; border-radius: 999px;
  font-size: 13.5px; font-weight: 700; font-family: inherit;
  cursor: pointer; transition: all .18s ease;
  border: 1px solid var(--m25-border);
}
.m25-btn-ghost{ background: var(--m25-surface); color: var(--m25-text); }
.m25-btn-ghost:hover:not(:disabled){ color: var(--m25-blue-deep); border-color: rgba(59,130,246,.4); background: var(--m25-blue-soft); }
.m25-btn-solid{ color:#fff; border-color: transparent; background: var(--m25-grad); box-shadow: 0 4px 14px rgba(59,130,246,.32); }
.m25-btn-solid:hover{ filter: brightness(1.06); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(59,130,246,.4); }
.m25-btn:disabled{ opacity:.4; cursor: default; }

@media (max-width: 820px){
  .m25-body{ grid-template-columns: 1fr; }
}
/* narrow STAGE (e.g. 980px app windows → ~746px stage): the two columns get so
   skinny the step text can collide with the footer buttons — stack instead.
   Stacked content is taller than the stage, so the body must stop flex-shrinking
   (which squashed the cards into each other) and let the root scroll. */
@container (max-width: 760px){
  .m25-body{ grid-template-columns: 1fr; flex: 0 0 auto; min-height: auto; }
  .m25-card, .m25-sim{ min-height: auto; }
}
`;
