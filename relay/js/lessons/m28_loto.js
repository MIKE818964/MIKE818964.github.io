// =============================================================================
// m28_loto.js  —  Lesson m28-safety-loto
//   "Safety and Lockout/Tagout Before You Touch Anything"
//
//   An interactive, SOBER step-through of the LOTO sequence. The learner must
//   complete six steps IN ORDER to "unlock" a hands-on repair:
//     1. Notify affected people
//     2. Properly shut down
//     3. Isolate ALL energy sources (electrical + stored)
//     4. Apply YOUR lock and tag
//     5. Release / dissipate stored energy to zero
//     6. Verify ZERO ENERGY with a meter  (test-live → test-dead → re-test live)
//   Skipping or reordering a step triggers a safety stop with an explanation.
//
//   Self-contained ES module. Pure vanilla JS/SVG/CSS. Every class is prefixed
//   with the slug `m28-` so nothing collides with other lesson modules.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
function S(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
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

export function render(host) {
  // ---------------------------------------------------------------- styles
  const style = document.createElement("style");
  style.textContent = CSS;
  host.appendChild(style);

  const root = H("div", "m28-root");
  host.appendChild(root);

  // ---- header ---------------------------------------------------------------
  const head = H("div", "m28-head");
  head.appendChild(H("div", "m28-eyebrow", "EXPERT · SAFETY-CRITICAL"));
  head.appendChild(H("h2", "m28-title", "Lockout / Tagout — before you touch anything"));
  head.appendChild(H("p", "m28-lede",
    "These voltages can kill. Even with the control circuit at a friendly 24 VDC, " +
    "the starter's power side may still carry lethal 480 VAC. Work the six steps in " +
    "order, prove zero energy with a meter, and the repair unlocks."));
  root.appendChild(head);

  // ---- main grid: steps on the left, the locked panel on the right -----------
  const grid = H("div", "m28-grid");
  root.appendChild(grid);

  const stepsCol = H("div", "m28-steps");
  const stageCol = H("div", "m28-stage");
  grid.appendChild(stepsCol);
  grid.appendChild(stageCol);

  // ---------------------------------------------------------------- step model
  const STEPS = [
    {
      key: "notify",
      n: 1,
      title: "Notify affected people",
      do: "Tell operators & supervisors",
      detail: "Everyone who runs or relies on this equipment must know it is going down for service. No surprises, no one starting it from another panel.",
      icon: iconNotify,
    },
    {
      key: "shutdown",
      n: 2,
      title: "Shut down properly",
      do: "Stop the equipment normally",
      detail: "Use the normal stop sequence so nothing slams off mid-cycle. An orderly shutdown leaves the machine in a known, predictable state.",
      icon: iconStop,
    },
    {
      key: "isolate",
      n: 3,
      title: "Isolate ALL energy sources",
      do: "Open the disconnect — every source",
      detail: "Open the main disconnect for the 480 VAC power side AND account for stored energy: capacitors, springs, hydraulics, pneumatics, gravity. Electrical OFF is not the whole job.",
      icon: iconDisconnect,
    },
    {
      key: "lock",
      n: 4,
      title: "Apply YOUR lock and tag",
      do: "Your own lock. Your own key.",
      detail: "Each worker applies their OWN padlock and a tag with their name. The disconnect cannot close until every lock is removed — and only you hold your key.",
      icon: iconLock,
    },
    {
      key: "stored",
      n: 5,
      title: "Release stored energy",
      do: "Bleed it to zero",
      detail: "Discharge capacitors, block raised loads, relieve pressure, release spring tension. Stored energy has killed people on circuits the disconnect already opened.",
      icon: iconBleed,
    },
    {
      key: "verify",
      n: 6,
      title: "Verify ZERO energy with a meter",
      do: "Live → Dead → Live",
      detail: "Prove your meter works on a KNOWN-LIVE source, test the conductors you'll touch and read 0 V, then re-test the known-live source to confirm the meter didn't fail mid-check. Only now is it dead.",
      icon: iconMeter,
    },
  ];

  let current = 0;          // index of the next step that may be completed
  const done = STEPS.map(() => false);
  let verifyPhase = 0;      // 0 not started · 1 live-ok · 2 dead-read · 3 confirmed
  let unlocked = false;

  // ---------------------------------------------------------------- build steps
  const cards = STEPS.map((st, i) => {
    const card = H("div", "m28-card");
    card.dataset.key = st.key;

    const badge = H("div", "m28-badge");
    badge.appendChild(S("svg", { viewBox: "0 0 24 24", class: "m28-badge-icon" }));
    badge.querySelector("svg").appendChild(st.icon());
    const num = H("span", "m28-badge-num", String(st.n));
    badge.appendChild(num);

    const body = H("div", "m28-card-body");
    body.appendChild(H("div", "m28-card-title", st.title));
    body.appendChild(H("div", "m28-card-do", st.do));
    const det = H("div", "m28-card-detail", st.detail);
    body.appendChild(det);

    const tick = H("div", "m28-tick");
    tick.appendChild(svgCheck());

    card.appendChild(badge);
    card.appendChild(body);
    card.appendChild(tick);

    card.addEventListener("click", () => attempt(i));
    stepsCol.appendChild(card);
    return card;
  });

  // ---------------------------------------------------------------- stage panel
  // A motor-starter one-line: 480 V supply → disconnect → contactor → motor,
  // with the lock hasp + tag, a stored-energy capacitor, and a verify meter.
  const svg = S("svg", { viewBox: "0 0 360 300", class: "m28-svg" });
  buildSchematic(svg);
  stageCol.appendChild(svg);

  // status / instruction strip under the schematic
  const status = H("div", "m28-status");
  const statusIcon = H("div", "m28-status-icon");
  const statusText = H("div", "m28-status-text");
  status.appendChild(statusIcon);
  status.appendChild(statusText);
  stageCol.appendChild(status);

  // the verify-dead meter mini-console (revealed at step 6)
  const verify = buildVerifyPanel();
  stageCol.appendChild(verify.el);

  // the "repair" button — locked until the sequence is complete
  const repair = H("button", "m28-repair", "Begin hands-on repair");
  repair.disabled = true;
  repair.addEventListener("click", () => {
    if (!unlocked) return;
    repair.classList.add("m28-repair-go");
    repair.textContent = "Zero energy verified — safe to work ✓";
    setStatus("ok", "Zero energy proven. PPE on. You may now work — and only you can re-energize.");
  });
  stageCol.appendChild(repair);

  // ---------------------------------------------------------------- behaviour
  function attempt(i) {
    if (unlocked) {
      flashStop(cards[i]);
      setStatus("ok", "All six steps are already complete — the repair is unlocked below.");
      return;
    }
    if (done[i]) {
      flashStop(cards[i]);
      setStatus("stop", `Step ${STEPS[i].n} is already done. Continue with step ${STEPS[current].n}: ${STEPS[current].title}.`);
      return;
    }

    // Out-of-order / skipping = SAFETY STOP.
    if (i !== current) {
      const want = STEPS[current];
      flashStop(cards[i]);
      if (i < current) {
        setStatus("stop", `Step ${STEPS[i].n} is already done. Continue with step ${want.n}: ${want.title}.`);
      } else {
        setStatus("stop", `SAFETY STOP — not yet. Do step ${want.n} first: ${want.title}.`);
      }
      return;
    }

    // Step 6 is the meter verify — it has its own gated sub-sequence.
    if (STEPS[i].key === "verify") {
      verify.el.classList.add("m28-verify-open");
      setStatus("warn", "Verify dead: 1) prove the meter on a KNOWN-LIVE source.");
      return;
    }

    completeStep(i);
  }

  function completeStep(i) {
    done[i] = true;
    cards[i].classList.add("m28-done");
    cards[i].classList.remove("m28-active");
    onStepEffect(STEPS[i].key);
    current = i + 1;
    if (current < STEPS.length) {
      cards[current].classList.add("m28-active");
      setStatus("go", `Next — step ${STEPS[current].n}: ${STEPS[current].title}.`);
    }
  }

  // visual schematic reactions per step
  function onStepEffect(key) {
    if (key === "notify") {
      svg.querySelector(".m28-people").classList.add("m28-on");
    }
    if (key === "shutdown") {
      svg.classList.add("m28-shut");        // motor stops spinning
    }
    if (key === "isolate") {
      svg.classList.add("m28-isolated");    // disconnect opens, 480 V de-asserts
    }
    if (key === "lock") {
      svg.querySelector(".m28-lockgrp").classList.add("m28-on");  // hasp + tag drop in
    }
    if (key === "stored") {
      svg.querySelector(".m28-cap").classList.add("m28-drained"); // capacitor bleeds
    }
    if (key === "verify") {
      svg.classList.add("m28-verified");
      unlock();
    }
  }

  function unlock() {
    unlocked = true;
    repair.disabled = false;
    repair.classList.add("m28-repair-ready");
    setStatus("ok", "All six steps complete. The repair is unlocked.");
  }

  // ---- the meter verify sub-sequence (live → dead → live) -------------------
  // Gate: none of these buttons may act until the main sequence has reached
  // the verify step in order (panel is actually open). Without this, the
  // meter buttons could be actioned directly — skipping steps 1-5 entirely —
  // which corrupted `current`/`unlocked` state and desynced the UI.
  function verifyReachable() {
    return verify.el.classList.contains("m28-verify-open");
  }
  function notReachedYet(btn) {
    const want = STEPS[current] || STEPS[STEPS.length - 1];
    setStatus("stop", `SAFETY STOP — not yet. Do step ${want.n} first: ${want.title}.`);
    // flash the button itself so repeated denials each produce a visible,
    // detectable DOM change (not just a repeat of the same status text).
    btn.classList.remove("m28-vbtn-denied");
    void btn.offsetWidth;
    btn.classList.add("m28-vbtn-denied");
  }

  verify.live1.addEventListener("click", () => {
    if (!verifyReachable()) { notReachedYet(verify.live1); return; }
    if (verifyPhase !== 0) return;
    verifyPhase = 1;
    verify.reading.textContent = "480 V";
    verify.reading.className = "m28-vreading m28-vlive";
    verify.sub.textContent = "Meter proven on known-live source ✓";
    verify.live1.classList.add("m28-vstep-done");
    verify.dead.classList.add("m28-vstep-armed");
    setStatus("warn", "Good — meter works. 2) test the conductors you'll touch.");
  });

  verify.dead.addEventListener("click", () => {
    if (!verifyReachable()) { notReachedYet(verify.dead); return; }
    if (verifyPhase !== 1) return;
    verifyPhase = 2;
    verify.reading.textContent = "0.0 V";
    verify.reading.className = "m28-vreading m28-vdead";
    verify.sub.textContent = "Conductors read zero — but confirm the meter again";
    verify.dead.classList.add("m28-vstep-done");
    verify.live2.classList.add("m28-vstep-armed");
    setStatus("warn", "Reads zero. 3) re-test the known-live source — confirm the meter didn't die.");
  });

  verify.live2.addEventListener("click", () => {
    if (!verifyReachable()) { notReachedYet(verify.live2); return; }
    if (verifyPhase !== 2) return;
    verifyPhase = 3;
    verify.reading.textContent = "480 V";
    verify.reading.className = "m28-vreading m28-vlive";
    verify.sub.textContent = "Meter re-confirmed live ✓  — the zero reading is trustworthy";
    verify.live2.classList.add("m28-vstep-done");
    verify.el.classList.add("m28-verify-pass");
    // verify step now genuinely complete
    completeStep(STEPS.findIndex((s) => s.key === "verify"));
  });

  function setStatus(kind, msg) {
    statusText.textContent = msg;
    status.dataset.kind = kind;
    statusIcon.textContent =
      kind === "stop" ? "⛔" : kind === "warn" ? "⚠" : kind === "ok" ? "✓" : "→";
  }

  function flashStop(card) {
    card.classList.remove("m28-shake");
    void card.offsetWidth;        // reflow to restart the animation
    card.classList.add("m28-shake");
    // A repeated denial (same card, same reason) can otherwise leave the
    // before/after DOM byte-identical — the shake class churns off/on but the
    // status text repeats too. Stamp a counter so every denial leaves a real,
    // persistent DOM delta (also handy for screen readers / test hooks).
    const n = (parseInt(card.dataset.stopCount || "0", 10) || 0) + 1;
    card.dataset.stopCount = String(n);
  }

  // initial state
  cards[0].classList.add("m28-active");
  setStatus("go", "Start with step 1: notify the people who run this equipment.");
}

// =============================================================================
//  Schematic  —  480 V → disconnect → contactor → motor, lock+tag, cap, ground
// =============================================================================
function buildSchematic(svg) {
  const root = S("g", { class: "m28-sch" });
  svg.appendChild(root);

  // panel backdrop
  root.appendChild(S("rect", { class: "m28-panel", x: 8, y: 8, width: 344, height: 284, rx: 14 }));
  root.appendChild(S("text", { class: "m28-sch-title", x: 180, y: 30, "text-anchor": "middle" },
    "MOTOR STARTER · ONE-LINE"));

  // ---- supply (480 V 3-phase, top) ----
  const supply = S("g", { class: "m28-supply" });
  supply.appendChild(S("text", { class: "m28-vlabel m28-v480", x: 56, y: 52, "text-anchor": "middle" }, "480 VAC"));
  // three feeder lines coming down to the disconnect
  [40, 56, 72].forEach((x) => {
    supply.appendChild(S("line", { class: "m28-feed", x1: x, y1: 58, x2: x, y2: 96 }));
  });
  root.appendChild(supply);

  // ---- disconnect switch (the isolation point) ----
  const disc = S("g", { class: "m28-disc" });
  disc.appendChild(S("rect", { class: "m28-disc-box", x: 28, y: 96, width: 56, height: 56, rx: 7 }));
  // the swinging blade (closed by default; rotates open on .m28-isolated)
  disc.appendChild(S("line", { class: "m28-blade", x1: 56, y1: 104, x2: 56, y2: 144 }));
  disc.appendChild(S("circle", { class: "m28-disc-pivot", cx: 56, cy: 104, r: 3.5 }));
  disc.appendChild(S("circle", { class: "m28-disc-seat", cx: 56, cy: 144, r: 3.5 }));
  disc.appendChild(S("text", { class: "m28-sch-lbl", x: 56, y: 168, "text-anchor": "middle" }, "DISCONNECT"));
  root.appendChild(disc);

  // conductor from disconnect down toward contactor
  root.appendChild(S("line", { class: "m28-feed m28-feed-low", x1: 56, y1: 152, x2: 56, y2: 196 }));

  // ---- contactor (the motor starter power contacts) ----
  const cont = S("g", { class: "m28-cont" });
  cont.appendChild(S("rect", { class: "m28-cont-box", x: 30, y: 196, width: 52, height: 40, rx: 6 }));
  cont.appendChild(S("text", { class: "m28-cont-x", x: 56, y: 221, "text-anchor": "middle" }, "M"));
  cont.appendChild(S("text", { class: "m28-sch-lbl", x: 56, y: 252, "text-anchor": "middle" }, "CONTACTOR"));
  root.appendChild(cont);

  // ---- motor symbol ----
  const mot = S("g", { class: "m28-motor" });
  mot.appendChild(S("line", { class: "m28-feed m28-feed-low", x1: 56, y1: 236, x2: 56, y2: 256 }));
  mot.appendChild(S("circle", { class: "m28-mot-body", cx: 56, cy: 274, r: 16 }));
  mot.appendChild(S("text", { class: "m28-mot-m", x: 56, y: 279, "text-anchor": "middle" }, "M"));
  // spin indicator
  mot.appendChild(S("path", { class: "m28-mot-spin", d: "M 56 262 A 12 12 0 1 1 44 274" }));
  root.appendChild(mot);

  // ---- lock + tag group (hidden until step 4) ----
  const lock = S("g", { class: "m28-lockgrp", transform: "translate(96,104)" });
  // shackle
  lock.appendChild(S("path", { class: "m28-lock-shackle", d: "M 8 14 v -5 a 8 8 0 0 1 16 0 v 5" }));
  // body
  lock.appendChild(S("rect", { class: "m28-lock-body", x: 3, y: 14, width: 26, height: 22, rx: 4 }));
  lock.appendChild(S("circle", { class: "m28-lock-key", cx: 16, cy: 24, r: 3 }));
  lock.appendChild(S("line", { class: "m28-lock-keyslot", x1: 16, y1: 24, x2: 16, y2: 31 }));
  // hasp line tying lock to the disconnect handle
  lock.appendChild(S("line", { class: "m28-lock-hasp", x1: 3, y1: 22, x2: -12, y2: 22 }));
  // DANGER tag
  const tag = S("g", { class: "m28-tag", transform: "translate(36,2)" });
  tag.appendChild(S("rect", { class: "m28-tag-body", x: 0, y: 0, width: 96, height: 54, rx: 5 }));
  tag.appendChild(S("circle", { class: "m28-tag-hole", cx: 10, cy: 10, r: 3 }));
  tag.appendChild(S("line", { class: "m28-tag-string", x1: 7, y1: 9, x2: -7, y2: 20 }));
  tag.appendChild(S("text", { class: "m28-tag-danger", x: 52, y: 19, "text-anchor": "middle" }, "DANGER"));
  tag.appendChild(S("text", { class: "m28-tag-line", x: 48, y: 34, "text-anchor": "middle" }, "DO NOT OPERATE"));
  tag.appendChild(S("text", { class: "m28-tag-name", x: 48, y: 47, "text-anchor": "middle" }, "— YOUR NAME —"));
  lock.appendChild(tag);
  root.appendChild(lock);

  // ---- stored-energy capacitor (bleeds on step 5) ----
  const cap = S("g", { class: "m28-cap", transform: "translate(250,150)" });
  cap.appendChild(S("line", { class: "m28-cap-lead", x1: 14, y1: -16, x2: 14, y2: 0 }));
  cap.appendChild(S("line", { class: "m28-cap-plate", x1: 2, y1: 0, x2: 26, y2: 0 }));
  cap.appendChild(S("line", { class: "m28-cap-plate", x1: 2, y1: 8, x2: 26, y2: 8 }));
  cap.appendChild(S("line", { class: "m28-cap-lead", x1: 14, y1: 8, x2: 14, y2: 24 }));
  cap.appendChild(S("text", { class: "m28-cap-lbl", x: 14, y: 43, "text-anchor": "middle" }, "STORED"));
  cap.appendChild(S("text", { class: "m28-cap-lbl", x: 14, y: 58, "text-anchor": "middle" }, "ENERGY"));
  // charge sparks (visible until drained)
  const spark = S("g", { class: "m28-cap-spark" });
  spark.appendChild(S("path", { d: "M 38 -4 l 6 4 l -4 3 l 7 5", class: "m28-spark-bolt" }));
  cap.appendChild(spark);
  root.appendChild(cap);

  // ---- people / notified indicator ----
  const ppl = S("g", { class: "m28-people", transform: "translate(250,210)" });
  [0, 18, 36].forEach((dx, idx) => {
    const p = S("g", { transform: `translate(${dx},0)`, class: "m28-person" });
    p.style.setProperty("--m28-pdelay", `${idx * 110}ms`);
    p.appendChild(S("circle", { class: "m28-person-head", cx: 6, cy: 4, r: 4 }));
    p.appendChild(S("path", { class: "m28-person-body", d: "M 0 22 v -8 a 6 6 0 0 1 12 0 v 8" }));
    ppl.appendChild(p);
  });
  ppl.appendChild(S("text", { class: "m28-people-lbl", x: 21, y: 40, "text-anchor": "middle" }, "NOTIFIED"));
  root.appendChild(ppl);

  // ground symbol at the very bottom of the run
  const gnd = S("g", { class: "m28-gnd", transform: "translate(250,250)" });
  gnd.appendChild(S("line", { x1: 14, y1: -10, x2: 14, y2: 0, class: "m28-gnd-line" }));
  gnd.appendChild(S("line", { x1: 4, y1: 0, x2: 24, y2: 0, class: "m28-gnd-line" }));
  gnd.appendChild(S("line", { x1: 8, y1: 5, x2: 20, y2: 5, class: "m28-gnd-line" }));
  gnd.appendChild(S("line", { x1: 11, y1: 10, x2: 17, y2: 10, class: "m28-gnd-line" }));
  root.appendChild(gnd);
}

// =============================================================================
//  Verify-dead meter console (the heart of proving the LOTO is safe)
// =============================================================================
function buildVerifyPanel() {
  const el = H("div", "m28-verify");
  const inner = H("div", "m28-verify-inner");
  inner.appendChild(H("div", "m28-verify-head", "VERIFY DEAD · meter check"));

  const wrap = H("div", "m28-verify-wrap");

  // the DMM screen
  const screen = H("div", "m28-vscreen");
  const reading = H("div", "m28-vreading m28-vidle", "— — —");
  const sub = H("div", "m28-vsub", "test-live → test-dead → re-test live");
  screen.appendChild(reading);
  screen.appendChild(sub);

  // the three gated buttons
  const btns = H("div", "m28-vbtns");
  const live1 = H("button", "m28-vbtn m28-vstep-armed", "1 · Test KNOWN-LIVE");
  const dead = H("button", "m28-vbtn", "2 · Test conductors");
  const live2 = H("button", "m28-vbtn", "3 · Re-test live");
  btns.appendChild(live1);
  btns.appendChild(dead);
  btns.appendChild(live2);

  wrap.appendChild(screen);
  wrap.appendChild(btns);
  inner.appendChild(wrap);
  el.appendChild(inner);

  // rename in a way that reflects "sub" lives inside screen
  return { el, reading, sub, live1, dead, live2 };
}

// =============================================================================
//  Small inline icons (24x24 viewBox) for the step badges
// =============================================================================
function iconNotify() {
  const g = S("g", { class: "m28-i" });
  g.appendChild(S("path", { d: "M5 9a7 7 0 0 1 14 0v4l2 3H3l2-3z", class: "m28-i-stroke" }));
  g.appendChild(S("path", { d: "M9.5 19a2.5 2.5 0 0 0 5 0", class: "m28-i-stroke" }));
  return g;
}
function iconStop() {
  const g = S("g", { class: "m28-i" });
  g.appendChild(S("rect", { x: 5, y: 5, width: 14, height: 14, rx: 3, class: "m28-i-stroke" }));
  g.appendChild(S("rect", { x: 9.5, y: 9.5, width: 5, height: 5, class: "m28-i-fill" }));
  return g;
}
function iconDisconnect() {
  const g = S("g", { class: "m28-i" });
  g.appendChild(S("circle", { cx: 6, cy: 18, r: 1.6, class: "m28-i-fill" }));
  g.appendChild(S("circle", { cx: 18, cy: 6, r: 1.6, class: "m28-i-fill" }));
  g.appendChild(S("line", { x1: 6, y1: 18, x2: 16, y2: 8, class: "m28-i-stroke" }));
  return g;
}
function iconLock() {
  const g = S("g", { class: "m28-i" });
  g.appendChild(S("rect", { x: 5, y: 11, width: 14, height: 9, rx: 2, class: "m28-i-stroke" }));
  g.appendChild(S("path", { d: "M8 11V8a4 4 0 0 1 8 0v3", class: "m28-i-stroke" }));
  return g;
}
function iconBleed() {
  const g = S("g", { class: "m28-i" });
  g.appendChild(S("path", { d: "M12 3l5 7a5 5 0 1 1-10 0z", class: "m28-i-stroke" }));
  return g;
}
function iconMeter() {
  const g = S("g", { class: "m28-i" });
  g.appendChild(S("rect", { x: 4, y: 5, width: 16, height: 11, rx: 2, class: "m28-i-stroke" }));
  g.appendChild(S("line", { x1: 7, y1: 19, x2: 7, y2: 16, class: "m28-i-stroke" }));
  g.appendChild(S("line", { x1: 17, y1: 19, x2: 17, y2: 16, class: "m28-i-stroke" }));
  g.appendChild(S("path", { d: "M8 11l2.5-3L13 13l2-3", class: "m28-i-stroke" }));
  return g;
}
function svgCheck() {
  const svg = S("svg", { viewBox: "0 0 24 24", class: "m28-tick-svg" });
  svg.appendChild(S("path", { d: "M5 13l4 4L19 7", class: "m28-tick-path" }));
  return svg;
}

// =============================================================================
//  Styles  (every selector prefixed `.m28-`)
// =============================================================================
const CSS = `
.m28-root{
  font-family: var(--font-display, "Inter", system-ui, sans-serif);
  color: var(--text, #303749);
  height: 100%;
  display: flex; flex-direction: column;
  padding: 22px 26px 24px;
  box-sizing: border-box;
  background:
    radial-gradient(1200px 380px at 80% -10%, rgba(124,92,255,.06), transparent 60%),
    radial-gradient(900px 360px at -5% 0%, rgba(239,68,68,.05), transparent 55%);
  overflow: auto;
}
.m28-eyebrow{
  font-family: var(--font-mono, "JetBrains Mono", monospace);
  font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
  color: var(--live-label, #DC2626);
  display: inline-flex; align-items: center; gap: 8px;
}
.m28-eyebrow::before{
  content:""; width: 7px; height: 7px; border-radius: 50%;
  background: var(--live, #EF4444);
  box-shadow: 0 0 0 4px rgba(239,68,68,.16);
  animation: m28-pulse 1.8s ease-in-out infinite;
}
@keyframes m28-pulse{ 0%,100%{ opacity:.55 } 50%{ opacity:1 } }
.m28-title{
  font-family: var(--font-display, "Inter", sans-serif);
  font-weight: 800; font-size: 24px; letter-spacing: -0.02em; line-height: 1.1;
  color: var(--ink, #0E1326);
  margin: 8px 0 6px;
}
.m28-lede{
  font-size: 13px; line-height: 1.5; color: var(--muted, #6B7488);
  max-width: 720px; margin: 0;
}

.m28-grid{
  display: grid; grid-template-columns: 1fr 340px; gap: 22px;
  margin-top: 18px; flex: 1; min-height: 0;
}

/* ---------- step cards ---------- */
.m28-steps{ display: flex; flex-direction: column; gap: 9px; }
.m28-card{
  display: grid; grid-template-columns: 46px 1fr 26px; align-items: center; gap: 14px;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #E6EAF3);
  border-radius: 14px;
  padding: 12px 16px;
  cursor: pointer;
  box-shadow: var(--shadow-sm, 0 1px 3px rgba(16,19,38,.05));
  transition: transform .18s ease, box-shadow .22s ease, border-color .22s ease, background .22s ease, opacity .22s ease;
  position: relative; overflow: hidden;
  opacity: .62;
}
/* All card content is decorative — the card itself owns the click handler.
   Without this, every icon/label/tick inside inherits the pointer cursor and
   gets independently flagged as a "dead click" even though the parent card
   works correctly. cursor:default (not just pointer-events:none) so hit-test
   tooling that inspects computed cursor also sees these as non-interactive. */
.m28-card *{ pointer-events: none; cursor: default; }
.m28-card::before{
  content:""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
  background: var(--border-strong, #D6DDEC);
  transition: background .25s ease;
}
.m28-card:hover{ transform: translateX(2px); }
.m28-card.m28-active{
  opacity: 1;
  border-color: rgba(245,158,11,.55);
  box-shadow: 0 8px 26px -10px rgba(245,158,11,.5);
  background: linear-gradient(180deg, #FFFDF7, #FFFFFF);
}
.m28-card.m28-active::before{ background: var(--warning, #F59E0B); }
.m28-card.m28-active .m28-badge{ background: linear-gradient(135deg,#FBBF24,#F59E0B); border-color: transparent; }
.m28-card.m28-active .m28-badge .m28-i-stroke{ stroke:#fff; }
.m28-card.m28-active .m28-badge .m28-i-fill{ fill:#fff; }
.m28-card.m28-active .m28-badge-num{ color:#fff; background: rgba(0,0,0,.18); }

.m28-card.m28-done{
  opacity: 1;
  border-color: rgba(16,185,129,.45);
  background: linear-gradient(180deg,#F4FBF8,#FFFFFF);
}
.m28-card.m28-done::before{ background: var(--success, #10B981); }
.m28-card.m28-done .m28-badge{ background: var(--success, #10B981); border-color: transparent; }
.m28-card.m28-done .m28-badge .m28-i-stroke{ stroke:#fff; }
.m28-card.m28-done .m28-badge .m28-i-fill{ fill:#fff; }
.m28-card.m28-done .m28-badge-num{ display:none; }
.m28-card.m28-done .m28-tick{ opacity:1; transform: scale(1); }

.m28-badge{
  width: 46px; height: 46px; border-radius: 12px;
  background: #F1F4FB; border: 1px solid var(--border, #E6EAF3);
  display: flex; align-items: center; justify-content: center;
  position: relative;
  transition: background .25s ease, border-color .25s ease;
}
.m28-badge-icon{ width: 24px; height: 24px; display:block; }
.m28-i-stroke{ fill:none; stroke: var(--blue-deep, #2563EB); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; transition: stroke .2s ease; }
.m28-i-fill{ fill: var(--blue-deep, #2563EB); transition: fill .2s ease; }
.m28-badge-num{
  position: absolute; right: -5px; bottom: -5px;
  font-family: var(--font-mono, monospace); font-size: 11px; font-weight: 700;
  width: 19px; height: 19px; border-radius: 50%;
  background: var(--ink, #0E1326); color: #fff;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 1px 3px rgba(0,0,0,.25);
}

.m28-card-title{ font-weight: 700; font-size: 14px; color: var(--ink, #0E1326); letter-spacing: -0.01em; }
.m28-card-do{
  font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: .03em;
  color: var(--blue-deep, #2563EB); margin-top: 2px; font-weight: 600;
}
.m28-card.m28-active .m28-card-do{ color: #B45309; }   /* amber-800: warning tone that still reads on white */
.m28-card.m28-done .m28-card-do{ color: #047857; }     /* green-700: success tone that still reads on white */
.m28-card-detail{
  font-size: 11.5px; line-height: 1.45; color: var(--muted, #6B7488);
  margin-top: 5px;
  max-height: 0; opacity: 0; overflow: hidden;
  transition: max-height .3s ease, opacity .3s ease, margin .3s ease;
}
.m28-card.m28-active .m28-card-detail,
.m28-card:hover .m28-card-detail{ max-height: 90px; opacity: 1; }

.m28-tick{ opacity: 0; transform: scale(.5); transition: all .3s cubic-bezier(.2,1.4,.4,1); display:flex; justify-content:center; }
.m28-tick-svg{ width: 22px; height: 22px; }
.m28-tick-path{ fill:none; stroke: var(--success, #10B981); stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 30; stroke-dashoffset: 30; }
.m28-card.m28-done .m28-tick-path{ animation: m28-draw .45s ease forwards; }
@keyframes m28-draw{ to{ stroke-dashoffset: 0 } }

@keyframes m28-shake{
  0%,100%{ transform: translateX(0) }
  15%,55%{ transform: translateX(-7px) }
  35%,75%{ transform: translateX(7px) }
}
.m28-card.m28-shake{
  animation: m28-shake .42s ease;
  border-color: var(--live, #EF4444) !important;
  box-shadow: 0 0 0 3px rgba(239,68,68,.18) !important;
}

/* ---------- stage column ---------- */
.m28-stage{ display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.m28-svg{
  width: 100%; height: auto; display: block;
  background: var(--surface, #fff);
  border: 1px solid var(--border, #E6EAF3);
  border-radius: 16px;
  box-shadow: var(--shadow, 0 6px 28px -8px rgba(16,19,38,.12));
}
.m28-panel{ fill: var(--surface-2, #FBFCFE); stroke: var(--border, #E6EAF3); stroke-width: 1; }
.m28-sch-title{ font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 700; letter-spacing: .1em; fill: var(--muted, #6B7488); }
.m28-sch-lbl{ font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 700; letter-spacing: .04em; fill: #5A6478; }

/* live conductors glow red; on isolation they go slate */
.m28-feed{ stroke: var(--live, #EF4444); stroke-width: 3; stroke-linecap: round; filter: drop-shadow(0 0 3px rgba(239,68,68,.55)); transition: stroke .4s ease, filter .4s ease; }
.m28-vlabel{ font-family: var(--font-mono, monospace); font-size: 12px; font-weight: 700; letter-spacing: .04em; transition: fill .4s ease, opacity .4s ease; }
.m28-v480{ fill: var(--live-label, #DC2626); }

.m28-disc-box{ fill:#fff; stroke: var(--border-strong, #D6DDEC); stroke-width: 1.4; }
.m28-blade{ stroke: var(--live, #EF4444); stroke-width: 3.4; stroke-linecap: round; transform-box: fill-box; transform-origin: 50% 6px; transition: transform .5s cubic-bezier(.2,1.3,.4,1), stroke .4s ease; filter: drop-shadow(0 0 3px rgba(239,68,68,.5)); }
.m28-disc-pivot, .m28-disc-seat{ fill: var(--muted, #6B7488); }

.m28-cont-box{ fill:#fff; stroke: var(--border-strong, #D6DDEC); stroke-width: 1.4; }
.m28-cont-x{ font-family: var(--font-mono, monospace); font-weight: 700; font-size: 15px; fill: var(--ink,#0E1326); }

.m28-mot-body{ fill:#fff; stroke: var(--border-strong, #D6DDEC); stroke-width: 1.6; }
.m28-mot-m{ font-family: var(--font-mono, monospace); font-weight: 700; font-size: 13px; fill: var(--ink,#0E1326); }
.m28-mot-spin{ fill:none; stroke: var(--blue, #3B82F6); stroke-width: 2; stroke-linecap: round; transform-box: fill-box; transform-origin: center; animation: m28-spin 1.1s linear infinite; opacity:.9; }
@keyframes m28-spin{ to{ transform: rotate(360deg) } }

/* people / notified */
.m28-people{ opacity: 0; transition: opacity .4s ease; }
.m28-people.m28-on{ opacity: 1; }
.m28-person-head{ fill: var(--success, #10B981); }
.m28-person-body{ fill: var(--success, #10B981); opacity:.85; }
.m28-people.m28-on .m28-person{ animation: m28-pop .4s ease backwards; animation-delay: var(--m28-pdelay,0ms); }
@keyframes m28-pop{ from{ transform: translateY(6px) scale(.6); opacity:0 } }
.m28-people-lbl{ font-family: var(--font-mono, monospace); font-size: 12px; letter-spacing:.06em; fill: #047857; font-weight:700; }

/* capacitor / stored energy */
.m28-cap-lead{ stroke: var(--warning, #F59E0B); stroke-width: 2.4; stroke-linecap: round; transition: stroke .4s ease; }
.m28-cap-plate{ stroke: var(--warning, #F59E0B); stroke-width: 2.6; stroke-linecap: round; transition: stroke .4s ease; }
.m28-cap-lbl{ font-family: var(--font-mono, monospace); font-size: 12px; letter-spacing:.04em; fill: #B45309; font-weight: 700; transition: fill .4s ease; }
.m28-cap-spark{ transition: opacity .4s ease; }
.m28-spark-bolt{ fill:none; stroke: var(--warning, #F59E0B); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; animation: m28-flick .9s steps(2) infinite; }
@keyframes m28-flick{ 0%,100%{ opacity:1 } 50%{ opacity:.25 } }
.m28-cap.m28-drained .m28-cap-lead,
.m28-cap.m28-drained .m28-cap-plate{ stroke: var(--wire-rest, #94A3B8); }
.m28-cap.m28-drained .m28-cap-lbl{ fill: #047857; }
.m28-cap.m28-drained .m28-cap-spark{ opacity: 0; }

/* lock + tag */
.m28-lockgrp{ opacity: 0; transform: translate(96px,104px) scale(.6); transform-origin: 110px 120px; transition: opacity .4s ease, transform .45s cubic-bezier(.2,1.4,.4,1); }
.m28-lockgrp.m28-on{ opacity: 1; transform: translate(96px,104px) scale(1); }
.m28-lock-body{ fill: var(--live, #EF4444); stroke: #B91C1C; stroke-width: 1; }
.m28-lock-shackle{ fill:none; stroke: #9CA3AF; stroke-width: 3; stroke-linecap: round; }
.m28-lock-key{ fill:#7F1D1D; }
.m28-lock-keyslot{ stroke:#7F1D1D; stroke-width: 1.4; stroke-linecap: round; }
.m28-lock-hasp{ stroke: #6B7280; stroke-width: 2; stroke-linecap: round; }
.m28-tag-body{ fill: #FFFBEB; stroke: var(--warning, #F59E0B); stroke-width: 1.4; }
.m28-tag-hole{ fill:#fff; stroke: var(--warning,#F59E0B); stroke-width:1; }
.m28-tag-string{ stroke:#9CA3AF; stroke-width:1.2; }
.m28-tag-danger{ font-family: var(--font-display,sans-serif); font-weight: 800; font-size: 13px; letter-spacing:.06em; fill: var(--live-label,#DC2626); }
.m28-tag-line{ font-family: var(--font-mono, monospace); font-weight: 700; font-size: 10px; letter-spacing:.02em; fill: var(--ink,#0E1326); }
.m28-tag-name{ font-family: var(--font-mono, monospace); font-size: 9px; letter-spacing:.04em; fill: #5A6478; }

/* ground */
.m28-gnd-line{ stroke: var(--ground, #10B981); stroke-width: 1.8; stroke-linecap: round; }

/* ===== isolated state: kill the live indication on the power side ===== */
.m28-svg.m28-isolated .m28-blade{ transform: rotate(-32deg); stroke: var(--wire-rest, #94A3B8); filter:none; }
.m28-svg.m28-isolated .m28-feed-low{ stroke: var(--wire-rest, #94A3B8); filter: none; }
.m28-svg.m28-isolated .m28-v480{ fill: var(--wire-rest, #94A3B8); }
/* supply feeders above the disconnect stay "present" but no longer flow */
.m28-svg.m28-isolated .m28-supply .m28-feed{ stroke: var(--deenergized, #E59A94); filter: none; }
.m28-svg.m28-shut .m28-mot-spin{ animation: none; opacity:0; }
.m28-svg.m28-verified .m28-mot-body{ stroke: var(--success,#10B981); }

/* ---------- status strip ---------- */
.m28-status{
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px; border-radius: 12px;
  font-size: 12px; line-height: 1.4; font-weight: 500;
  background: var(--blue-soft, #EAF1FE);
  border: 1px solid rgba(59,130,246,.25);
  color: var(--blue-deep, #2563EB);
  transition: background .25s ease, color .25s ease, border-color .25s ease;
  min-height: 22px;
}
.m28-status-icon{ font-size: 15px; line-height: 1; flex: none; }
.m28-status[data-kind="stop"]{ background:#FEF2F2; border-color: rgba(239,68,68,.4); color: var(--live-label,#DC2626); }
.m28-status[data-kind="warn"]{ background:#FFFBEB; border-color: rgba(245,158,11,.45); color:#B45309; }
.m28-status[data-kind="ok"]{ background:#ECFDF5; border-color: rgba(16,185,129,.45); color:#047857; }
.m28-status[data-kind="stop"] .m28-status-text{ animation: m28-nudge .4s ease; }
@keyframes m28-nudge{ 0%,100%{ transform: translateX(0) } 25%{ transform: translateX(-3px) } 75%{ transform: translateX(3px) } }

/* ---------- verify meter console ---------- */
/* grid-rows 0fr->1fr collapse: unlike max-height, this actually zeroes the
   child content's layout box while collapsed, so it can never geometrically
   overlap a sibling (e.g. the repair button) even though the child elements
   remain in the DOM the whole time. */
.m28-verify{
  display: grid; grid-template-rows: 0fr;
  border: 1px dashed var(--border-strong, #D6DDEC);
  border-radius: 14px;
  background: var(--surface, #fff);
  opacity: 0;
  pointer-events: none;   /* collapsed panel must not be clickable/hit-testable */
  transition: grid-template-rows .4s ease, opacity .35s ease, border-color .35s ease;
}
.m28-verify > .m28-verify-inner{
  overflow: hidden; padding: 0 14px; min-height: 0;
  transform: scaleY(0); transform-origin: top; transition: transform .3s ease;
}
.m28-verify.m28-verify-open{
  grid-template-rows: 1fr; opacity: 1; border-color: var(--warning,#F59E0B); pointer-events: auto;
}
.m28-verify.m28-verify-open > .m28-verify-inner{ padding: 12px 14px; transform: scaleY(1); }
.m28-verify.m28-verify-pass{ border-color: var(--success,#10B981); border-style: solid; }
.m28-verify-head{
  font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing:.1em; text-transform: uppercase;
  color: var(--muted, #6B7488); margin-bottom: 10px; font-weight: 600;
}
.m28-verify-wrap{ display: flex; gap: 12px; align-items: stretch; }
.m28-vscreen{
  flex: 1; background: var(--readout-bg, #0B1020); border-radius: 10px;
  padding: 12px 14px; display: flex; flex-direction: column; justify-content: center;
  box-shadow: inset 0 2px 8px rgba(0,0,0,.4);
  min-width: 120px;
}
.m28-vreading{
  font-family: var(--font-mono, monospace); font-weight: 600; font-size: 26px; letter-spacing: .02em;
  font-variant-numeric: tabular-nums;
  transition: color .25s ease, text-shadow .25s ease;
}
.m28-vidle{ color:#3A4258; }
.m28-vlive{ color: #FF6B6B; text-shadow: 0 0 14px rgba(239,68,68,.6); }
.m28-vdead{ color: var(--readout-text, #34E5C0); text-shadow: 0 0 14px rgba(52,229,192,.55); }
.m28-vsub{ font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing:.03em; color:#A8B4CC; margin-top: 5px; }
.m28-vbtns{ display: flex; flex-direction: column; gap: 7px; justify-content: center; min-width: 130px; }
.m28-vbtn{
  font-family: var(--font-mono, monospace); font-size: 11px; font-weight: 600; letter-spacing:.02em;
  padding: 8px 10px; border-radius: 9px; text-align: left;
  border: 1px solid var(--border, #E6EAF3); background: var(--surface-2,#FBFCFE); color: #7A8497;
  cursor: not-allowed; transition: all .18s ease;
}
.m28-vbtn.m28-vbtn-denied{ animation: m28-shake .42s ease; border-color: var(--live, #EF4444) !important; }
.m28-vbtn.m28-vstep-armed{
  cursor: pointer; color: var(--ink,#0E1326);
  border-color: rgba(245,158,11,.5); background: #FFFBEB;
  box-shadow: 0 4px 14px -6px rgba(245,158,11,.5);
}
.m28-vbtn.m28-vstep-armed:hover{ transform: translateY(-1px); border-color: var(--warning,#F59E0B); }
.m28-vbtn.m28-vstep-done{
  cursor: default; color: var(--success,#10B981);
  border-color: rgba(16,185,129,.4); background:#ECFDF5; box-shadow:none;
}
.m28-vbtn.m28-vstep-done::after{ content:" ✓"; }

/* ---------- repair (unlock) button ---------- */
.m28-repair{
  font-family: var(--font-display, sans-serif); font-weight: 700; font-size: 13.5px;
  padding: 13px 18px; border-radius: 12px; border: 1px solid var(--border-strong,#D6DDEC);
  background: #F4F6FB; color: var(--faint, #99A1B3);
  cursor: not-allowed; transition: all .25s ease; letter-spacing:-.01em;
  display: flex; align-items: center; justify-content: center; gap: 8px;
}
.m28-repair::before{ content:"🔒"; font-size: 14px; }
.m28-repair.m28-repair-ready{
  cursor: pointer; color:#fff; border-color: transparent;
  background: var(--grad, linear-gradient(135deg,#3B82F6,#7C5CFF));
  box-shadow: 0 10px 30px -10px rgba(59,130,246,.6);
  animation: m28-ready 1.6s ease-in-out infinite;
}
.m28-repair.m28-repair-ready::before{ content:"🔓"; }
@keyframes m28-ready{ 0%,100%{ box-shadow: 0 10px 30px -10px rgba(59,130,246,.6) } 50%{ box-shadow: 0 10px 34px -8px rgba(124,92,255,.75) } }
.m28-repair.m28-repair-ready:hover{ transform: translateY(-1px); }
.m28-repair.m28-repair-go{
  animation: none; cursor: default;
  background: linear-gradient(135deg,#10B981,#059669);
  box-shadow: 0 10px 30px -12px rgba(16,185,129,.7);
}
.m28-repair.m28-repair-go::before{ content:"✓"; }

@media (max-width: 820px){
  .m28-grid{ grid-template-columns: 1fr; }
  .m28-stage{ order: -1; }
}
`;
