// =============================================================================
// m26_mastery.js — "MULTIMETER MASTERY" — the meter module built straight from
// docs/METER_MASTERY_SPEC.md (itself synthesized from the four
// docs/research_meter_*.md files). Six interactive sections, stepped:
//
//   1  MEET THE METER   — live DMM face: dial modes, jacks, the amps-jack trap
//   2  TWO POINTS       — every reading is a DIFFERENCE; wire numbers = nodes
//   3  HOPSCOTCH LAB    — black parked on L2, walk red down a faulted rung
//   4  DROP TEST        — mV across closed contacts under load; 50 mV vs 300 mV
//   5  GHOST & LoZ      — dead wire reads ~85% of nominal on Hi-Z; LoZ kills it
//   6  SAFETY           — live-dead-live ritual + CAT-rating mini-picker
//
// Each section = one do-it interaction + one check question. A coach bar
// narrates the next step; tabs tick ✓ when a section is mastered. Numbers are
// cited inline to the research files ([FUND §3] = research_meter_fundamentals
// §3, [METH] methodology, [PED] pedagogy, [PRINT] prints).
//
// Self-contained ES module. Every CSS class prefixed `m26mm-`.
// =============================================================================

export function render(host) {
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  const SVGNS = "http://www.w3.org/2000/svg";
  const S = (tag, attrs = {}, txt) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (txt != null) n.textContent = txt;
    return n;
  };

  // ---------------------------------------------------------------- style
  const style = document.createElement("style");
  style.textContent = `
  .m26mm-root{
    position:absolute; inset:0; overflow:auto; padding:18px 24px 26px;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--text,#303749);
    background:
      radial-gradient(1000px 440px at 88% -8%, rgba(124,92,255,.07), transparent 60%),
      radial-gradient(900px 420px at 4% 110%, rgba(59,130,246,.08), transparent 60%),
      var(--bg,#F6F8FC);
    container-type:inline-size;
  }
  .m26mm-kicker{
    font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--blue-deep,#2563EB); display:flex; align-items:center; gap:9px; font-weight:700;
  }
  .m26mm-kicker::before{ content:""; width:26px; height:2px; border-radius:2px;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); }
  .m26mm-title{ margin:6px 0 2px; font-weight:800; font-size:22px; letter-spacing:-.02em;
    line-height:1.1; color:var(--ink,#0E1326); }
  .m26mm-sub{ font-size:12.5px; color:var(--muted,#6B7488); max-width:760px; line-height:1.45; margin-bottom:12px; }
  .m26mm-sub b{ color:var(--ink,#0E1326); }

  /* ---- coach bar ---- */
  .m26mm-coach{
    display:flex; align-items:center; gap:10px; margin:0 0 12px;
    padding:9px 13px; border-radius:12px;
    background:linear-gradient(135deg, rgba(124,92,255,.16), rgba(59,130,246,.10));
    border:1.5px solid var(--violet,#7C5CFF);
    box-shadow:0 4px 16px rgba(124,92,255,.18);
  }
  .m26mm-coach-k{
    flex:0 0 auto; font-family:var(--font-mono,monospace);
    font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:#fff; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    padding:4px 10px; border-radius:999px; white-space:nowrap;
  }
  .m26mm-coach-t{ font-size:13px; font-weight:700; line-height:1.35; color:#6D28D9; }
  .m26mm-coach-t b{ color:var(--ink,#0E1326); }

  /* ---- section tabs ---- */
  .m26mm-tabs{ display:flex; gap:7px; flex-wrap:wrap; margin-bottom:14px; }
  .m26mm-tab{
    display:flex; align-items:center; gap:7px; padding:7px 12px 7px 8px; cursor:pointer;
    border:1.5px solid var(--border,#E6EAF3); border-radius:999px; background:var(--surface,#fff);
    font-size:12px; font-weight:700; color:var(--muted,#6B7488);
    transition:all .16s cubic-bezier(.2,.8,.25,1);
  }
  .m26mm-tab:hover{ border-color:var(--border-strong,#D6DDEC); transform:translateY(-1px); }
  .m26mm-tab .n{
    width:19px; height:19px; border-radius:50%; display:grid; place-items:center;
    background:var(--bg,#F6F8FC); border:1px solid var(--border,#E6EAF3);
    font-family:var(--font-mono,monospace); font-size:11px; font-weight:800; color:var(--muted,#6B7488);
  }
  .m26mm-tab.active{
    border-color:transparent; color:#fff;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    box-shadow:0 7px 16px rgba(59,130,246,.30);
  }
  .m26mm-tab.active .n{ background:rgba(255,255,255,.22); border-color:transparent; color:#fff; }
  .m26mm-tab.done .n{ background:#ECFDF5; border-color:#10B981; color:#047857; }
  .m26mm-tab.done.active .n{ background:rgba(255,255,255,.25); color:#fff; }

  /* ---- generic cards / layout ---- */
  .m26mm-row{ display:flex; gap:14px; align-items:stretch; }
  .m26mm-col{ display:flex; flex-direction:column; gap:12px; min-width:0; }
  .m26mm-card{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow-sm,0 2px 10px rgba(16,19,38,.06));
    padding:14px 16px;
  }
  .m26mm-card-k{
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.07em;
    text-transform:uppercase; color:var(--muted,#6B7488); font-weight:700; margin-bottom:7px;
  }
  .m26mm-note{ font-size:12px; line-height:1.5; color:var(--text,#303749); }
  .m26mm-note b{ color:var(--ink,#0E1326); }
  .m26mm-cite{ color:var(--blue-deep,#2563EB); font-family:var(--font-mono,monospace); font-size:11px; }
  .m26mm-warn{ background:#FFF7ED; border-color:#FDBA74; }
  .m26mm-good{ background:#ECFDF5; border-color:#6EE7B7; }
  .m26mm-bad{ background:#FEF2F2; border-color:#FCA5A5; }

  .m26mm-btn{
    border:1.5px solid var(--border-strong,#D6DDEC); background:var(--surface,#fff);
    border-radius:11px; padding:8px 13px; cursor:pointer; font-weight:700; font-size:12.5px;
    color:var(--ink,#0E1326); transition:all .15s ease; font-family:inherit;
  }
  .m26mm-btn:hover{ border-color:var(--violet,#7C5CFF); transform:translateY(-1px); }
  .m26mm-btn.primary{
    border-color:transparent; color:#fff;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    box-shadow:0 7px 16px rgba(59,130,246,.28);
  }
  .m26mm-btn.hot{ border-color:transparent; color:#fff;
    background:linear-gradient(135deg,#F59E0B,#EF4444); box-shadow:0 7px 16px rgba(239,68,68,.28); }
  .m26mm-btn.on{ border-color:transparent; color:#fff;
    background:linear-gradient(135deg,#10B981,#059669); box-shadow:0 6px 14px rgba(16,185,129,.3); }
  .m26mm-btn:disabled{ opacity:.45; cursor:default; transform:none; }

  /* checklist pills */
  .m26mm-tasks{ display:flex; flex-direction:column; gap:6px; }
  .m26mm-task{ display:flex; gap:8px; align-items:center; font-size:12px; font-weight:600; color:var(--muted,#6B7488); }
  .m26mm-task .tk{ width:17px; height:17px; border-radius:50%; border:1.6px solid var(--border-strong,#D6DDEC);
    display:grid; place-items:center; font-size:11px; color:#fff; flex:0 0 auto; }
  .m26mm-task.done{ color:#047857; }
  .m26mm-task.done .tk{ background:#10B981; border-color:#10B981; }

  /* ---- check question ---- */
  .m26mm-quiz{ margin-top:2px; }
  .m26mm-quiz-q{ font-size:13px; font-weight:700; color:var(--ink,#0E1326); line-height:1.45; margin-bottom:9px; }
  .m26mm-quiz-opt{
    display:block; width:100%; text-align:left; margin-bottom:7px; padding:9px 12px;
    border:1.5px solid var(--border,#E6EAF3); border-radius:11px; background:var(--surface-2,#FBFCFE);
    font-size:12.5px; line-height:1.4; cursor:pointer; color:var(--text,#303749); font-weight:600;
    transition:all .14s ease; font-family:inherit;
  }
  .m26mm-quiz-opt:hover{ border-color:var(--violet,#7C5CFF); }
  .m26mm-quiz-opt.right{ border-color:#10B981; background:#ECFDF5; color:#065F46; }
  .m26mm-quiz-opt.wrong{ border-color:#EF4444; background:#FEF2F2; color:#7F1D1D; }
  .m26mm-quiz-x{ font-size:12px; line-height:1.5; margin-top:6px; padding:9px 12px; border-radius:10px; display:none; }
  .m26mm-quiz-x.show{ display:block; }
  .m26mm-quiz-x.ok{ background:#ECFDF5; border:1px solid #A7F3D0; color:#065F46; }
  .m26mm-quiz-x.no{ background:#FEF2F2; border:1px solid #FCA5A5; color:#7F1D1D; }

  /* ---- big DMM readout ---- */
  .m26mm-lcd{
    background:#10141F; border-radius:12px; padding:10px 16px;
    font-family:var(--font-mono,monospace); border:1px solid #2A3040;
    box-shadow:inset 0 2px 8px rgba(0,0,0,.5);
  }
  .m26mm-lcd .v{ font-size:27px; font-weight:700; color:#B4F3D4; letter-spacing:.02em;
    font-variant-numeric:tabular-nums; text-shadow:0 0 12px rgba(90,255,170,.35); }
  .m26mm-lcd .a{ font-size:11px; color:#5F98717A; color:#6FA786; letter-spacing:.09em; text-transform:uppercase; font-weight:700; margin-top:2px; }
  .m26mm-lcd.alarm .v{ color:#FF9E9E; text-shadow:0 0 12px rgba(255,110,110,.4); }

  svg.m26mm-svg{ width:100%; height:auto; display:block; }
  .m26mm-svg text{ font-family:var(--font-mono,monospace); }

  /* meter face bits */
  .m26mm-dial-pos{ cursor:pointer; }
  .m26mm-dial-pos text{ font-size:13px; font-weight:700; fill:#3A4256; }
  .m26mm-dial-pos:hover text{ fill:var(--violet,#7C5CFF); }
  .m26mm-dial-pos.sel text{ fill:var(--blue-deep,#2563EB); }
  .m26mm-dial-pos .hitc{ fill:transparent; }
  .m26mm-dial-pos:hover .hitc{ fill:rgba(124,92,255,.12); }
  .m26mm-jack{ cursor:pointer; }
  .m26mm-jack:hover .jring{ stroke-width:4; }
  .m26mm-jack text{ font-size:12px; font-weight:700; fill:#3A4256; }

  /* rung scene shared bits */
  .m26mm-railtxt{ font-size:14px; font-weight:800; fill:#3A4256; }
  .m26mm-wire{ stroke:#6B7689; stroke-width:2.6; fill:none; stroke-linecap:round; }
  .m26mm-wire.live{ stroke:#EF4444; filter:drop-shadow(0 0 2.5px rgba(239,68,68,.5)); }
  .m26mm-dev{ fill:#fff; stroke:#475569; stroke-width:1.9; }
  .m26mm-devlbl{ font-size:12px; font-weight:700; fill:#4B5568; text-anchor:middle; }
  .m26mm-wnum{ font-size:12.5px; font-weight:800; fill:#2563EB; text-anchor:middle; }
  .m26mm-chip{ cursor:pointer; }
  .m26mm-chip .cring{ fill:#fff; stroke:#2563EB; stroke-width:1.9; }
  .m26mm-chip:hover .cring{ stroke:var(--violet,#7C5CFF); stroke-width:3; }
  .m26mm-chip .cdot{ fill:#2563EB; }
  .m26mm-chip.probed .cring{ stroke:#EF4444; stroke-width:3; }
  .m26mm-chip.probed .cdot{ fill:#EF4444; }
  .m26mm-chiplbl{ font-size:11.5px; font-weight:700; fill:#5A6478; text-anchor:middle; }
  .m26mm-readtag{ font-size:13px; font-weight:800; text-anchor:middle; }
  .m26mm-readtag.hotv{ fill:#B91C1C; } .m26mm-readtag.deadv{ fill:#334155; }

  /* drop-test element cards */
  .m26mm-elgrid{ display:grid; grid-template-columns:repeat(5,1fr); gap:10px; }
  .m26mm-elcard{ border:1.5px solid var(--border,#E6EAF3); border-radius:13px; padding:10px 11px;
    background:var(--surface-2,#FBFCFE); display:flex; flex-direction:column; gap:7px; }
  .m26mm-elcard.hi{ border-color:#F59E0B; background:#FFFBEB; }
  .m26mm-elcard.condemned{ border-color:#10B981; background:#ECFDF5; }
  .m26mm-elname{ font-size:12.5px; font-weight:800; color:var(--ink,#0E1326); }
  .m26mm-elval{ font-family:var(--font-mono,monospace); font-size:17px; font-weight:700; color:#334155; min-height:22px; }
  .m26mm-elval.bad{ color:#B91C1C; }
  .m26mm-elbeep{ font-size:11px; font-weight:700; color:var(--muted,#6B7488); min-height:15px; }
  .m26mm-limits td, .m26mm-limits th{ font-size:11.5px; padding:4px 8px; text-align:left; border-bottom:1px solid var(--border,#E6EAF3); }
  .m26mm-limits th{ color:var(--muted,#6B7488); text-transform:uppercase; font-size:10.5px; letter-spacing:.05em; }
  .m26mm-limits td b{ font-family:var(--font-mono,monospace); }

  /* impedance toggle */
  .m26mm-zrow{ display:flex; gap:8px; }
  .m26mm-zbtn{ flex:1; padding:9px 8px; border-radius:11px; border:1.5px solid var(--border,#E6EAF3);
    background:var(--surface-2,#FBFCFE); cursor:pointer; text-align:center; font-family:inherit; transition:all .15s ease; }
  .m26mm-zbtn b{ display:block; font-size:13px; color:var(--ink,#0E1326); }
  .m26mm-zbtn span{ display:block; font-size:11px; color:var(--muted,#6B7488); }
  .m26mm-zbtn.active{ border-color:transparent; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); }
  .m26mm-zbtn.active b, .m26mm-zbtn.active span{ color:#fff; }

  /* LDL stepper */
  .m26mm-ldl{ display:flex; flex-direction:column; gap:9px; }
  .m26mm-ldl-step{ display:flex; gap:10px; align-items:flex-start; padding:10px 12px;
    border:1.5px solid var(--border,#E6EAF3); border-radius:12px; background:var(--surface-2,#FBFCFE); }
  .m26mm-ldl-step .sn{ width:22px; height:22px; border-radius:50%; flex:0 0 auto; display:grid; place-items:center;
    font-family:var(--font-mono,monospace); font-size:12px; font-weight:800; color:#fff; background:#94A3B8; }
  .m26mm-ldl-step.now{ border-color:var(--violet,#7C5CFF); box-shadow:0 0 0 3px rgba(124,92,255,.14); }
  .m26mm-ldl-step.done{ border-color:#10B981; background:#ECFDF5; }
  .m26mm-ldl-step.done .sn{ background:#10B981; }
  .m26mm-ldl-body{ flex:1; }
  .m26mm-ldl-t{ font-size:12.5px; font-weight:800; color:var(--ink,#0E1326); margin-bottom:3px; }
  .m26mm-ldl-d{ font-size:11.5px; line-height:1.45; color:var(--muted,#6B7488); margin-bottom:7px; }
  .m26mm-pairrow{ display:flex; gap:7px; flex-wrap:wrap; }

  /* CAT picker */
  .m26mm-cats{ display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
  .m26mm-cat{ border:1.5px solid var(--border,#E6EAF3); border-radius:13px; padding:11px 12px; cursor:pointer;
    background:var(--surface-2,#FBFCFE); transition:all .15s ease; font-family:inherit; text-align:left; }
  .m26mm-cat:hover{ border-color:var(--violet,#7C5CFF); transform:translateY(-1px); }
  .m26mm-cat b{ display:block; font-size:13px; color:var(--ink,#0E1326); margin-bottom:3px; }
  .m26mm-cat span{ font-size:11.5px; line-height:1.4; color:var(--muted,#6B7488); display:block; }
  .m26mm-cat.right{ border-color:#10B981; background:#ECFDF5; }
  .m26mm-cat.wrong{ border-color:#EF4444; background:#FEF2F2; }

  .m26mm-foot{ margin-top:14px; font-size:12px; font-weight:700; color:var(--muted,#6B7488);
    display:flex; align-items:center; gap:10px; }
  .m26mm-foot .bar{ flex:0 0 180px; height:7px; border-radius:5px; background:var(--border,#E6EAF3); overflow:hidden; }
  .m26mm-foot .fill{ height:100%; border-radius:5px; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); transition:width .3s ease; }

  .m26mm-flash{ animation:m26mmFlash .5s ease; }
  @keyframes m26mmFlash{ 0%{ box-shadow:0 0 0 6px rgba(239,68,68,.4);} 100%{ box-shadow:none;} }

  @container (max-width: 860px){
    .m26mm-row{ flex-direction:column; }
    .m26mm-elgrid{ grid-template-columns:repeat(2,1fr); }
    .m26mm-cats{ grid-template-columns:1fr; }
  }
  `;
  host.appendChild(style);

  // ---------------------------------------------------------------- scaffold
  const root = el("div", "m26mm-root");
  host.appendChild(root);
  root.appendChild(el("div", "m26mm-kicker", "Intermediate · multimeter mastery"));
  root.appendChild(el("div", "m26mm-title", "Multimeter Mastery: the meter is a circuit element, not an oracle"));
  const sub = el("p", "m26mm-sub");
  sub.innerHTML = `Six short labs, one habit: know what the meter <b>IS</b> before trusting what it says. ` +
    `Work them in order — each ends with a check question. <span class="m26mm-cite">Built from METER_MASTERY_SPEC + the four research_meter files.</span>`;
  root.appendChild(sub);

  const coach = el("div", "m26mm-coach");
  const coachK = el("span", "m26mm-coach-k", "Next step");
  const coachT = el("span", "m26mm-coach-t");
  coach.appendChild(coachK); coach.appendChild(coachT);
  root.appendChild(coach);
  const setCoach = (html) => { coachT.innerHTML = html; };
  // no-op presses still talk (m21/m22 convention): a click that changes no
  // state nudges the coach line instead of dying silently
  let nudgeN = 0;
  const nudgeCoach = (html) => { nudgeN++; coachT.innerHTML = html + " " + "·".repeat((nudgeN % 3) + 1); };

  const tabs = el("div", "m26mm-tabs");
  root.appendChild(tabs);
  const content = el("div", "m26mm-content");
  root.appendChild(content);

  const foot = el("div", "m26mm-foot");
  const bar = el("div", "bar"); const fill = el("div", "fill");
  bar.appendChild(fill);
  const footTxt = el("span", null, "");
  foot.appendChild(bar); foot.appendChild(footTxt);
  root.appendChild(foot);

  // ---------------------------------------------------------------- progress
  const PKEY = "relay_m26mm_v1";
  let PROG;
  try { PROG = JSON.parse(localStorage.getItem(PKEY) || "{}"); } catch { PROG = {}; }
  for (let i = 1; i <= 6; i++) if (!PROG["s" + i]) PROG["s" + i] = { did: false, quiz: false };
  function save() { try { localStorage.setItem(PKEY, JSON.stringify(PROG)); } catch { /* private mode */ } }
  function secDone(k) { return PROG[k].did && PROG[k].quiz; }
  function refreshMeta() {
    const n = [1, 2, 3, 4, 5, 6].filter((i) => secDone("s" + i)).length;
    fill.style.width = (n / 6 * 100) + "%";
    footTxt.textContent = n < 6
      ? `${n} / 6 sections mastered — a section counts when its lab AND its check question are done.`
      : `6 / 6 — mastered. (Practice, not a certification — even Fluke says so.)`;
    tabs.querySelectorAll(".m26mm-tab").forEach((t, i) => {
      t.classList.toggle("done", secDone("s" + (i + 1)));
      const nEl = t.querySelector(".n");
      nEl.textContent = secDone("s" + (i + 1)) ? "✓" : String(i + 1);
    });
  }
  function mark(k, what) { PROG[k][what] = true; save(); refreshMeta(); }

  // ---------------------------------------------------------------- check-question widget
  function quizBlock(secKey, q, options, correctIdx, explainOk, explainNo) {
    const card = el("div", "m26mm-card m26mm-quiz");
    card.appendChild(el("div", "m26mm-card-k", "Check question"));
    const qEl = el("div", "m26mm-quiz-q"); qEl.innerHTML = q; card.appendChild(qEl);
    const x = el("div", "m26mm-quiz-x");
    let answered = false;
    const btns = options.map((o, i) => {
      const b = el("button", "m26mm-quiz-opt"); b.innerHTML = o;
      b.addEventListener("click", () => {
        if (answered) { nudgeCoach("This one's answered — the next section is waiting."); return; }
        if (i === correctIdx) {
          answered = true;
          b.classList.add("right");
          x.className = "m26mm-quiz-x show ok"; x.innerHTML = "✓ " + explainOk;
          mark(secKey, "quiz");
        } else {
          b.classList.add("wrong");
          x.className = "m26mm-quiz-x show no"; x.innerHTML = "✗ " + (explainNo || "Not it — try again.");
        }
      });
      card.appendChild(b);
      return b;
    });
    card.appendChild(x);
    if (PROG[secKey].quiz) {  // already answered in a past visit
      answered = true;
      btns[correctIdx].classList.add("right");
      x.className = "m26mm-quiz-x show ok"; x.innerHTML = "✓ " + explainOk;
    }
    return card;
  }

  function taskList(items) {
    const wrap = el("div", "m26mm-tasks");
    const rows = items.map((t) => {
      const r = el("div", "m26mm-task");
      const tk = el("span", "tk", "");
      r.appendChild(tk); r.appendChild(el("span", null, t));
      wrap.appendChild(r);
      return r;
    });
    return { wrap, tick: (i) => { rows[i].classList.add("done"); rows[i].querySelector(".tk").textContent = "✓"; },
             allDone: () => rows.every((r) => r.classList.contains("done")) };
  }

  // cleanup for per-section timers
  let activeTimer = null;
  function clearTimer() { if (activeTimer) { clearInterval(activeTimer); activeTimer = null; } }

  // =====================================================================
  // SECTION 1 — MEET THE METER
  // =====================================================================
  function buildS1(hostEl) {
    const row = el("div", "m26mm-row");
    hostEl.appendChild(row);

    // ---- left: the meter face ----
    const face = el("div", "m26mm-card m26mm-col"); face.style.flex = "0 0 330px";
    face.appendChild(el("div", "m26mm-card-k", "87-class DMM — dial, jacks, display are all live"));
    const svg = S("svg", { class: "m26mm-svg", viewBox: "0 0 320 400" });
    face.appendChild(svg);
    row.appendChild(face);

    // body
    svg.appendChild(S("rect", { x: 10, y: 6, width: 300, height: 388, rx: 22, fill: "#FDB813", stroke: "#B97E06", "stroke-width": 2 }));
    svg.appendChild(S("rect", { x: 24, y: 20, width: 272, height: 360, rx: 16, fill: "#2E3440", stroke: "#171B24", "stroke-width": 1.5 }));
    // LCD
    svg.appendChild(S("rect", { x: 44, y: 36, width: 232, height: 64, rx: 8, fill: "#C7D4BE", stroke: "#171B24", "stroke-width": 1.5 }));
    const lcdMain = S("text", { x: 264, y: 78, "text-anchor": "end", "font-size": 30, "font-weight": 700, fill: "#1E2A18" }, "0.000");
    const lcdAnn = S("text", { x: 52, y: 52, "font-size": 11.5, "font-weight": 700, fill: "#39502F" }, "AUTO  V⎓");
    svg.appendChild(lcdMain); svg.appendChild(lcdAnn);

    // dial
    const DCX = 160, DCY = 210, DR = 62;
    svg.appendChild(S("circle", { cx: DCX, cy: DCY, r: DR, fill: "#3B4252", stroke: "#171B24", "stroke-width": 2 }));
    svg.appendChild(S("circle", { cx: DCX, cy: DCY, r: 26, fill: "#4C566A", stroke: "#171B24", "stroke-width": 1.5 }));
    const pointer = S("path", { d: `M ${DCX - 7} ${DCY} L ${DCX} ${DCY - DR + 10} L ${DCX + 7} ${DCY} Z`, fill: "#ECEFF4", stroke: "#171B24", "stroke-width": 1 });
    const pointerG = S("g", {}); pointerG.appendChild(pointer); svg.appendChild(pointerG);

    const MODES = [
      { id: "OFF",  lbl: "OFF",  ang: -150 },
      { id: "VAC",  lbl: "V~",   ang: -100 },
      { id: "VDC",  lbl: "V⎓",   ang: -50  },
      { id: "OHM",  lbl: "Ω",    ang: 0    },
      { id: "CONT", lbl: "•)))", ang: 50   },
      { id: "LOZ",  lbl: "LoZ",  ang: 100  },
      { id: "AMP",  lbl: "A",    ang: 150  },
    ];
    const MODE_FACTS = {
      OFF:  `<b>OFF — pre-flight.</b> Inspect leads for cracks (OSHA 1910.334(c): damaged = out of service). Black lead into <b>COM</b> first, out last. <span class="m26mm-cite">[FUND §1, §10; PRINT §6]</span>`,
      VAC:  `<b>V~ — AC volts.</b> The circuit sees <b>10 MΩ ∥ &lt;100 pF</b>: the meter sips almost nothing. That's why a dead-but-coupled wire can still show GHOST voltage (§5). <span class="m26mm-cite">[FUND §3]</span>`,
      VDC:  `<b>V⎓ — DC volts.</b> Same 10 MΩ input. Reversed leads just read minus — autopolarity, no harm. Watch the annunciators: an autorange flip to <b>mV</b> misread as V is a classic error. <span class="m26mm-cite">[FUND §1, §7; PED §4.8]</span>`,
      OHM:  `<b>Ω — resistance.</b> The meter becomes a small current source (&lt;1.3 V open, &lt;200 µA short). <b>POWER OFF ONLY</b> — on a live rung you get garbage plus possible damage. Zero your leads first: 0.2–0.5 Ω is the leads, not the part. <span class="m26mm-cite">[FUND §2; METH §6]</span>`,
      CONT: `<b>•))) — continuity.</b> The beep threshold is range-dependent: &lt;20 Ω (Fluke 117), <b>&lt;40 Ω</b> on the 87's 400 Ω range. A 40 Ω <i>burned</i> contact still beeps. Read the NUMBER — good contact/fuse/wire is <b>&lt;1 Ω</b>. <span class="m26mm-cite">[FUND §2; METH §6.3; PED §3.5]</span>`,
      LOZ:  `<b>LoZ — low-impedance volts (≈3 kΩ input).</b> A deliberate small load: collapses ghost voltage to ~0. But NEVER across electronics — across a PLC input, 3 kΩ looks like a closed switch and can turn the output ON. Trips GFCIs too. <span class="m26mm-cite">[FUND §3]</span>`,
      AMP:  `<b>A — current.</b> The meter becomes a <b>≈0.03 Ω shunt behind a fuse</b>. SERIES ONLY. In parallel across a source it's a bolted short — the #1 meter destroyer. Input Alert beeps when leads sit in a current jack with the dial elsewhere. <span class="m26mm-cite">[FUND §6]</span>`,
    };
    let dialMode = "VDC";
    let redJack = "V";           // "V" | "A"
    let fuseBlown = false;
    const modesSeen = new Set(["VDC"]);

    const posEls = new Map();
    for (const m of MODES) {
      const a = (m.ang - 90) * Math.PI / 180;
      const lx = DCX + Math.cos(a) * (DR + 24), ly = DCY + Math.sin(a) * (DR + 24);
      const g = S("g", { class: "m26mm-dial-pos" + (m.id === dialMode ? " sel" : ""), "data-mode": m.id });
      g.appendChild(S("circle", { class: "hitc", cx: lx, cy: ly, r: 17 }));
      g.appendChild(S("text", { x: lx, y: ly + 4, "text-anchor": "middle", fill: m.id === "AMP" ? "#FDB813" : undefined }, m.lbl));
      svg.appendChild(g);
      posEls.set(m.id, g);
      g.addEventListener("click", () => {
        if (dialMode === m.id) { nudgeCoach(`Dial is already on <b>${m.lbl}</b> — try another position.`); return; }
        dialMode = m.id; modesSeen.add(m.id); redraw();
      });
    }

    // jacks
    const JY = 350;
    const jackDefs = [
      { id: "A",   x: 70,  lbl: "A",   ring: "#FDB813" },
      { id: "COM", x: 160, lbl: "COM", ring: "#0F1115" },
      { id: "V",   x: 250, lbl: "VΩ",  ring: "#D64545" },
    ];
    const jackEls = new Map();
    for (const j of jackDefs) {
      const g = S("g", { class: "m26mm-jack", "data-jack": j.id });
      g.appendChild(S("circle", { class: "jring", cx: j.x, cy: JY, r: 13, fill: "#11151D", stroke: j.ring, "stroke-width": 3 }));
      g.appendChild(S("text", { x: j.x, y: JY - 20, "text-anchor": "middle", fill: "#D8DEE9" }, j.lbl));
      const plug = S("circle", { cx: j.x, cy: JY, r: 6, fill: j.id === "COM" ? "#0F1115" : "#D64545", stroke: "#fff", "stroke-width": 1.4, opacity: 0 });
      g.appendChild(plug);
      svg.appendChild(g);
      jackEls.set(j.id, { g, plug });
      if (j.id !== "COM") g.addEventListener("click", () => {
        if (redJack === j.id) { nudgeCoach(`Red lead is already in the <b>${j.lbl}</b> jack.`); return; }
        redJack = j.id; redraw();
      });
    }
    jackEls.get("COM").plug.setAttribute("opacity", 1);   // black lead lives in COM
    svg.appendChild(S("text", { x: 160, y: 385, "text-anchor": "middle", "font-size": 11.5, fill: "#8A93A6" },
      "black in COM always · click A or VΩ to park the RED lead"));

    // ---- right: fact card + trap drill ----
    const right = el("div", "m26mm-col"); right.style.flex = "1 1 auto";
    row.appendChild(right);
    const factCard = el("div", "m26mm-card");
    factCard.appendChild(el("div", "m26mm-card-k", "What the circuit sees right now"));
    const factBody = el("div", "m26mm-note");
    factCard.appendChild(factBody);
    right.appendChild(factCard);

    const drill = el("div", "m26mm-card");
    drill.appendChild(el("div", "m26mm-card-k", "The drill — a live 120 VAC receptacle sits in front of you"));
    const lcdBig = el("div", "m26mm-lcd");
    const lcdV = el("div", "v", "-- -- --"); const lcdA = el("div", "a", "meter display");
    lcdBig.appendChild(lcdV); lcdBig.appendChild(lcdA);
    drill.appendChild(lcdBig);
    const drillRow = el("div", null); drillRow.style.cssText = "display:flex; gap:9px; margin-top:10px; flex-wrap:wrap;";
    const probeBtn = el("button", "m26mm-btn hot", "⚡ PROBE THE RECEPTACLE");
    const fixBtn = el("button", "m26mm-btn", "🔧 Replace the 440 mA fuse");
    fixBtn.style.display = "none";
    drillRow.appendChild(probeBtn); drillRow.appendChild(fixBtn);
    drill.appendChild(drillRow);
    const drillNote = el("div", "m26mm-note"); drillNote.style.marginTop = "10px";
    drill.appendChild(drillNote);
    right.appendChild(drill);

    const tl = taskList([
      "Visit at least 4 dial positions and read what each makes the meter look like",
      "Fire the amps-jack trap (red lead in A, probe the receptacle)",
      "Take a clean, correct reading: red in VΩ, dial V~, probe again",
    ]);
    const tCard = el("div", "m26mm-card");
    tCard.appendChild(el("div", "m26mm-card-k", "Do these"));
    tCard.appendChild(tl.wrap);
    right.appendChild(tCard);
    let trapFired = PROG.s1.did, cleanRead = PROG.s1.did;
    if (PROG.s1.did) { tl.tick(0); tl.tick(1); tl.tick(2); }

    function redraw() {
      for (const [id, g] of posEls) g.classList.toggle("sel", id === dialMode);
      const m = MODES.find((x) => x.id === dialMode);
      pointerG.setAttribute("transform", `rotate(${m.ang} ${DCX} ${DCY})`);
      jackEls.get("A").plug.setAttribute("opacity", redJack === "A" ? 1 : 0);
      jackEls.get("V").plug.setAttribute("opacity", redJack === "V" ? 1 : 0);
      factBody.innerHTML = MODE_FACTS[dialMode] +
        (redJack === "A" && dialMode !== "AMP"
          ? `<div style="margin-top:8px; color:#B45309; font-weight:700;">🔊 INPUT ALERT is beeping: leads are in a current jack but the dial isn't on A. It's warning you about exactly the trap below. <span class="m26mm-cite">[FUND §6]</span></div>`
          : "");
      lcdAnn.textContent = { OFF: "", VAC: "AUTO  V~", VDC: "AUTO  V⎓", OHM: "AUTO  Ω", CONT: "•)))  Ω", LOZ: "LoZ  V", AMP: fuseBlown ? "A  FUSE?" : "A" }[dialMode] || "";
      lcdMain.textContent = dialMode === "OFF" ? "" : (dialMode === "OHM" || dialMode === "CONT") ? "OL" : "0.000";
      if (tl && modesSeen.size >= 4) tl.tick(0);
      maybeDone();
    }

    function maybeDone() {
      if (modesSeen.size >= 4 && trapFired && cleanRead && !PROG.s1.did) {
        mark("s1", "did");
        setCoach(`Trap survived. Answer the <b>check question</b> below, then move to section 2 — every reading is a difference between two points.`);
      }
    }

    probeBtn.addEventListener("click", () => {
      if (dialMode === "OFF") {
        lcdV.textContent = ""; lcdA.textContent = "meter is off";
        drillNote.innerHTML = `Turn the dial first. The habit: select the function <b>before</b> the probes touch anything. <span class="m26mm-cite">[FUND §2]</span>`;
        return;
      }
      if (redJack === "A") {
        lcdBig.classList.add("alarm"); lcdBig.classList.add("m26mm-flash");
        setTimeout(() => lcdBig.classList.remove("m26mm-flash"), 600);
        fuseBlown = true; trapFired = true; tl.tick(1);
        lcdV.textContent = "0.00"; lcdA.textContent = "A — fuse open";
        drillNote.innerHTML = `<b style="color:#B91C1C;">BANG.</b> With the red lead in the A jack the circuit saw a <b>≈0.03 Ω shunt straight across 120 V</b> — a bolted short. ` +
          `The internal fuse blew in milliseconds; in a panel that's an arc-flash event, not a beep. Input Alert had been warning you the whole time. ` +
          `Every current reading now shows 0.00 A until you replace the fuse (self-test: dial Ω, probe into the A jack — a good 440 mA fuse reads ≈1.0 kΩ). <span class="m26mm-cite">[FUND §6]</span>`;
        fixBtn.style.display = "";
        maybeDone();
        return;
      }
      // red in V jack
      if (dialMode === "AMP") {
        lcdV.textContent = fuseBlown ? "0.00" : "0.00"; lcdA.textContent = "A — leads not in A jack";
        drillNote.innerHTML = `Dial says amps but the red lead is in VΩ — the meter reads nothing. Current is measured in <b>series</b>, never across a source.`;
        return;
      }
      if (dialMode === "OHM" || dialMode === "CONT") {
        lcdBig.classList.add("alarm");
        lcdV.textContent = "1.2 .8 --"; lcdA.textContent = "Ω on a LIVE circuit";
        drillNote.innerHTML = `<b style="color:#B45309;">Garbage.</b> Ω and continuity push the meter's own test current into the circuit — on a live source the numbers mean nothing and the meter can be damaged. De-energize + verify dead first (§6). <span class="m26mm-cite">[METH §6]</span>`;
        return;
      }
      lcdBig.classList.remove("alarm");
      if (dialMode === "VDC") {
        lcdV.textContent = "0.012"; lcdA.textContent = "V⎓ on an AC source";
        drillNote.innerHTML = `Near zero — DC range on an AC receptacle averages the sine to ~0. Right jack, wrong function. Flip to <b>V~</b>.`;
        return;
      }
      // VAC or LOZ: correct
      lcdV.textContent = dialMode === "LOZ" ? "119.8" : "120.4";
      lcdA.textContent = dialMode === "LOZ" ? "LoZ V — under a 3 kΩ load" : "V~  AUTO";
      cleanRead = true; tl.tick(2);
      drillNote.innerHTML = `✓ Clean read: <b>${lcdV.textContent} VAC</b>. Source verified — on a real call this is your FIRST measurement (X1→X2) before touching the rung. ` +
        `${fuseBlown ? "Note the voltage functions still work with a blown amps fuse — one more reason the fuse hides. " : ""}<span class="m26mm-cite">[METH §2D; PED §3.1]</span>`;
      maybeDone();
    });

    fixBtn.addEventListener("click", () => {
      fuseBlown = false; fixBtn.style.display = "none"; lcdBig.classList.remove("alarm");
      drillNote.innerHTML = `Fuse replaced (HRC 440 mA/1000 V — never wire or a glass fuse; the interrupt rating IS the safety device). Now take the clean V~ reading. <span class="m26mm-cite">[FUND §6]</span>`;
      redraw();
    });

    hostEl.appendChild(quizBlock("s1",
      `You inherit a meter with the leads parked in the <b>A jack</b> from a previous tech. Dial is on V~. You probe L1–L2 in a live panel. What does the circuit see?`,
      [
        "A 10 MΩ voltmeter — harmless, the dial decides",
        "A ≈0.03 Ω short across the line — blown fuse, possible arc event",
        "A 3 kΩ load — the reading just comes out a little low",
        "Nothing — modern meters disconnect unused jacks",
      ],
      1,
      `The JACKS decide what's between the tips, not the dial. Leads in A = a ~0.03 Ω shunt across whatever you touch — a bolted short across a source. That's why Input Alert exists, and why you never park leads in a current jack after amp work. [FUND §6]`,
      `Look at where the leads are plugged, not where the dial points. [FUND §6]`
    ));

    redraw();
  }

  // =====================================================================
  // SECTION 2 — TWO POINTS OR NOTHING (reference points on a mini rung)
  // =====================================================================
  function buildS2(hostEl) {
    const row = el("div", "m26mm-row");
    hostEl.appendChild(row);

    const left = el("div", "m26mm-card"); left.style.flex = "1 1 auto";
    left.appendChild(el("div", "m26mm-card-k", "Live mini-rung · 120 VAC · STOP closed, lamp lit — click dots to place leads"));
    const svg = S("svg", { class: "m26mm-svg", viewBox: "0 0 660 200" });
    left.appendChild(svg);
    row.appendChild(left);

    // rails
    svg.appendChild(S("line", { class: "m26mm-wire live", x1: 40, y1: 30, x2: 40, y2: 170 }));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 620, y1: 30, x2: 620, y2: 170 }));
    svg.appendChild(S("text", { class: "m26mm-railtxt", x: 40, y: 20, "text-anchor": "middle" }, "L1"));
    svg.appendChild(S("text", { class: "m26mm-railtxt", x: 620, y: 20, "text-anchor": "middle" }, "L2"));
    // rung wires: L1 -(wire1)- STOP -(wire2)- LAMP - L2
    svg.appendChild(S("line", { class: "m26mm-wire live", x1: 40, y1: 100, x2: 255, y2: 100 }));
    svg.appendChild(S("line", { class: "m26mm-wire live", x1: 289, y1: 100, x2: 465, y2: 100 }));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 505, y1: 100, x2: 620, y2: 100 }));
    // STOP (closed NC ladder contact)
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 255, y1: 88, x2: 255, y2: 112 }));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 289, y1: 88, x2: 289, y2: 112 }));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 255, y1: 100, x2: 289, y2: 100 }));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 249, y1: 114, x2: 295, y2: 86 }));
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 272, y: 132 }, "STOP (NC, closed)"));
    // lamp
    svg.appendChild(S("circle", { class: "m26mm-dev", cx: 485, cy: 100, r: 20, fill: "#FFE7A0", stroke: "#E0992A" }));
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 485, y: 105 }, "PL1"));
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 485, y: 138 }, "lamp · LIT"));
    // wire numbers
    svg.appendChild(S("text", { class: "m26mm-wnum", x: 110, y: 88 }, "1"));
    svg.appendChild(S("text", { class: "m26mm-wnum", x: 225, y: 88 }, "1"));
    svg.appendChild(S("text", { class: "m26mm-wnum", x: 380, y: 88 }, "2"));

    // probe dots: id, node, x — wire 1 gets TWO dots (same node, different spots)
    const DOTS = [
      { id: "p1a", node: "1",  x: 110, lbl: "wire 1" },
      { id: "p1b", node: "1",  x: 225, lbl: "wire 1 (STOP line side)" },
      { id: "p2",  node: "2",  x: 380, lbl: "wire 2 (STOP load side)" },
      { id: "pl2", node: "L2", x: 560, lbl: "L2 · common" },
    ];
    const V = { "1": 120, "2": 120, "L2": 0 };
    const dotEls = new Map();
    for (const d of DOTS) {
      const g = S("g", { class: "m26mm-chip", "data-dot": d.id });
      g.appendChild(S("circle", { class: "cring", cx: d.x, cy: 100, r: 9 }));
      g.appendChild(S("circle", { class: "cdot", cx: d.x, cy: 100, r: 3 }));
      svg.appendChild(g);
      dotEls.set(d.id, g);
      g.addEventListener("click", () => clickDot(d));
    }

    const right = el("div", "m26mm-col"); right.style.flex = "0 0 320px";
    row.appendChild(right);
    const rd = el("div", "m26mm-card");
    rd.appendChild(el("div", "m26mm-card-k", "Meter"));
    const lcd = el("div", "m26mm-lcd");
    const lcdV = el("div", "v", "-- -- --"); const lcdA = el("div", "a", "place two leads");
    lcd.appendChild(lcdV); lcd.appendChild(lcdA);
    rd.appendChild(lcd);
    const interp = el("div", "m26mm-note"); interp.style.marginTop = "9px";
    rd.appendChild(interp);
    right.appendChild(rd);

    const tl = taskList([
      "Source check: wire 1 → L2 reads full line (120 V)",
      "Node identity: BOTH leads on wire 1 → 0 V (not dead!)",
      "Across the closed STOP: wire 1 → wire 2 reads ~0 V",
    ]);
    const tCard = el("div", "m26mm-card");
    tCard.appendChild(el("div", "m26mm-card-k", "Take these three readings"));
    tCard.appendChild(tl.wrap);
    right.appendChild(tCard);
    if (PROG.s2.did) { tl.tick(0); tl.tick(1); tl.tick(2); }

    let A = null, B = null;   // dots
    function clickDot(d) {
      if (!A) A = d;
      else if (!B) B = d;
      else A = d;                     // both placed: red walks
      for (const [id, g] of dotEls) g.classList.toggle("probed", (A && A.id === id) || (B && B.id === id));
      if (!A || !B) {
        lcdV.textContent = "-- -- --"; lcdA.textContent = A ? "red placed — now black" : "place two leads";
        interp.innerHTML = A ? `Red (V+) on <b>${A.lbl}</b>. Click a second dot for black (COM).` : "";
        return;
      }
      const diff = Math.abs(V[A.node] - V[B.node]);
      lcdV.textContent = diff.toFixed(1); lcdA.textContent = "V~  AUTO";
      if (A.node === B.node) {
        interp.innerHTML = `<b>0 V — but NOT dead.</b> Both leads sit on points stamped <b>wire ${A.node}</b>: one node, one potential. ` +
          `Two probes on the same wire number must read ~0 V live (or beep dead) — anything else means a broken conductor INSIDE that node. <span class="m26mm-cite">[PRINT §1; PED §4.4]</span>`;
        tl.tick(1);
      } else if (diff >= 100) {
        if ((A.node === "1" && B.node === "L2") || (A.node === "L2" && B.node === "1")) {
          interp.innerHTML = `<b>120 V — the source check.</b> Wire 1 to L2 is the circuit's OWN reference pair (L1→L2), and it's the FIRST reading of any job. ` +
            `Measure against the circuit's own reference — not earth ground; floating control circuits show meaningless half-supply phantoms to ground. <span class="m26mm-cite">[METH §2C–D]</span>`;
          tl.tick(0);
        } else {
          interp.innerHTML = `<b>120 V across the energized load side.</b> Wire 2 to L2 carries the full source: the whole 120 V lands across the lamp — correct voltage across a working load. <span class="m26mm-cite">[METH §1]</span>`;
        }
      } else {
        interp.innerHTML = `<b>~0 V across the closed STOP.</b> A healthy closed contact drops essentially nothing. ` +
          `Master axiom #1: "If you measure a voltage ACROSS a switch, the switch is open." (And remember the converse is FALSE — 0 V does not prove it closed.) <span class="m26mm-cite">[METH §1]</span>`;
        tl.tick(2);
      }
      if (tl.allDone() && !PROG.s2.did) {
        mark("s2", "did");
        setCoach(`All three reference moves done. Take the check question, then on to the centerpiece: <b>the hopscotch lab</b>.`);
      }
    }

    hostEl.appendChild(quizBlock("s2",
      `On a LIVE machine, both your leads land on points stamped <b>wire 6</b> and the meter reads 0 V. What did you actually learn?`,
      [
        "The circuit is dead — lock it out",
        "Nothing about the circuit — you measured one node against itself; a reading is a DIFFERENCE between two nodes",
        "The meter fuse is blown",
        "Wire 6 is shorted to ground",
      ],
      1,
      `Every point with the same wire number is the same node. Same node → 0 V by definition, live or dead. The naive read of "0 V = dead" is one of the most common field mistakes. [PRINT §1; PED §4.4]`,
      `Check what the wire numbers tell you about those two points first. [PRINT §1]`
    ));
  }

  // =====================================================================
  // SECTION 3 — HOPSCOTCH LAB (the centerpiece)
  // =====================================================================
  function buildS3(hostEl) {
    const FAULTS = [
      { id: "fuse",  name: "Control fuse FU1",  human: "FU1 has blown" },
      { id: "stop",  name: "STOP button",        human: "the STOP contact is open (failed)" },
      { id: "start", name: "START button",       human: "the START contact isn't making when pressed" },
      { id: "ol",    name: "Overload 95-96",     human: "the overload is tripped — 95-96 open" },
      { id: "coil",  name: "Coil M1",            human: "the M1 coil winding is open" },
    ];
    let fault = FAULTS[Math.floor(Math.random() * FAULTS.length)];
    let startHeld = false;
    let reads = 0, firstRead = true, solved = PROG.s3.did, warned = false;

    const axioms = el("div", "m26mm-card m26mm-warn");
    axioms.appendChild(el("div", "m26mm-card-k", "The two master axioms — everything in this lab is one of these"));
    const ax = el("div", "m26mm-note");
    ax.innerHTML = `<b>1.</b> "If you measure a voltage across a switch, the switch is open." &nbsp; <b>2.</b> "If you measure correct voltage across a load and the load doesn't work, the load has failed." ` +
      `<br>⚠ The converse of #1 is FALSE: 0 V across a switch does NOT prove it closed — a second open kills all drops everywhere (the two-opens trap). <span class="m26mm-cite">[METH §1, §11.1]</span>`;
    axioms.appendChild(ax);
    hostEl.appendChild(axioms);

    const stageCard = el("div", "m26mm-card");
    stageCard.appendChild(el("div", "m26mm-card-k", "120 VAC start rung · black lead CLIPPED to L2 · click a terminal to land the red lead"));
    const svg = S("svg", { class: "m26mm-svg", viewBox: "0 0 740 250" });
    stageCard.appendChild(svg);
    hostEl.appendChild(stageCard);

    // rails
    svg.appendChild(S("line", { class: "m26mm-wire live", x1: 30, y1: 40, x2: 30, y2: 210 }));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 710, y1: 40, x2: 710, y2: 210 }));
    svg.appendChild(S("text", { class: "m26mm-railtxt", x: 30, y: 28 }, "L1"));
    svg.appendChild(S("text", { class: "m26mm-railtxt", x: 698, y: 28 }, "L2"));
    const RY = 110;
    // wire segments (redrawn live/dead on state change)
    const segs = [];
    const seg = (x1, x2, node) => { const l = S("line", { class: "m26mm-wire", x1, y1: RY, x2, y2: RY }); svg.appendChild(l); segs.push({ l, node }); };
    seg(30, 90, "S");          // X1 → fuse
    seg(130, 205, "1");        // fuse → STOP
    seg(239, 315, "2");        // STOP → START
    seg(349, 435, "3");        // START → OL
    seg(469, 540, "4");        // OL → coil
    seg(576, 710, "X2");       // coil → L2
    // FU1
    svg.appendChild(S("rect", { class: "m26mm-dev", x: 90, y: RY - 8, width: 40, height: 16, rx: 2 }));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 90, y1: RY, x2: 130, y2: RY, "stroke-width": 1.8 }));
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 110, y: RY + 30 }, "FU1"));
    // STOP (NC)
    const mkContact = (cx, nc) => {
      svg.appendChild(S("line", { class: "m26mm-wire", x1: cx - 17, y1: RY - 11, x2: cx - 17, y2: RY + 11 }));
      svg.appendChild(S("line", { class: "m26mm-wire", x1: cx + 17, y1: RY - 11, x2: cx + 17, y2: RY + 11 }));
      if (nc) svg.appendChild(S("line", { class: "m26mm-wire", x1: cx - 20, y1: RY + 13, x2: cx + 20, y2: RY - 13 }));
    };
    mkContact(222, true);
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 222, y: RY + 34 }, "STOP (NC)"));
    mkContact(332, false);
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 332, y: RY + 34 }, "START (NO)"));
    mkContact(452, true);
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 452, y: RY + 34 }, "OL 95-96"));
    // coil M1
    const coilBody = S("rect", { class: "m26mm-dev", x: 540, y: RY - 13, width: 36, height: 26, rx: 3 });
    svg.appendChild(coilBody);
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 558, y: RY + 34 }, "M1 coil"));
    svg.appendChild(S("text", { class: "m26mm-devlbl", x: 558, y: RY + 4, "font-size": 11.5 }, "M1"));
    // black alligator clip on L2
    svg.appendChild(S("path", { d: "M 710 178 l 14 10 l -6 4 l 8 6 l -16 -6 l 6 -4 Z", fill: "#1F2937" }));
    svg.appendChild(S("text", { x: 700, y: 232, "text-anchor": "end", "font-size": 12, "font-weight": 700, fill: "#1F2937" },
      "BLACK clipped to L2 — one hand free [PED §3.3]"));

    // terminal chips (walk order) — labels stagger above the rung
    const CHIPS = [
      { id: "S",  x: 62,  node: "S",  lbl: "X1 · source",        sub: "line side FU1" },
      { id: "1",  x: 168, node: "1",  lbl: "1 · FU1 load",       sub: "STOP line side" },
      { id: "2",  x: 277, node: "2",  lbl: "2 · STOP load",      sub: "START line side" },
      { id: "3",  x: 392, node: "3",  lbl: "3 · START load",     sub: "OL 95" },
      { id: "4",  x: 505, node: "4",  lbl: "4 · OL 96",          sub: "coil A1" },
      { id: "X2", x: 610, node: "X2", lbl: "A2 · coil return",   sub: "wire to L2" },
    ];
    const chipEls = new Map();
    const readTag = S("text", { class: "m26mm-readtag", x: -50, y: RY - 80 }, "");
    for (const c of CHIPS) {
      const g = S("g", { class: "m26mm-chip", "data-chip": c.id });
      g.appendChild(S("circle", { class: "cring", cx: c.x, cy: RY, r: 9.5 }));
      g.appendChild(S("circle", { class: "cdot", cx: c.x, cy: RY, r: 3.2 }));
      g.appendChild(S("text", { class: "m26mm-chiplbl", x: c.x, y: RY - 55 }, c.lbl));
      g.appendChild(S("text", { class: "m26mm-chiplbl", x: c.x, y: RY - 42, "font-size": 10.5, fill: "#8A93A6" }, c.sub));
      svg.appendChild(g);
      chipEls.set(c.id, g);
      g.addEventListener("click", () => probeChip(c));
    }
    svg.appendChild(readTag);
    // red probe glyph
    const redLead = S("g", { opacity: 0 });
    redLead.appendChild(S("line", { x1: 0, y1: 0, x2: 12, y2: -20, stroke: "#B9BFCC", "stroke-width": 3, "stroke-linecap": "round" }));
    redLead.appendChild(S("line", { x1: 12, y1: -20, x2: 26, y2: -40, stroke: "#EF4444", "stroke-width": 6.5, "stroke-linecap": "round" }));
    svg.appendChild(redLead);

    // controls + readout row
    const ctlRow = el("div", "m26mm-row"); hostEl.appendChild(ctlRow);
    const ctlCard = el("div", "m26mm-card m26mm-col"); ctlCard.style.flex = "0 0 300px";
    ctlCard.appendChild(el("div", "m26mm-card-k", "Controls"));
    const holdBtn = el("button", "m26mm-btn", "👆 HOLD START (click to latch your thumb)");
    ctlCard.appendChild(holdBtn);
    const dealBtn = el("button", "m26mm-btn", "🎲 New fault — re-deal the ticket");
    ctlCard.appendChild(dealBtn);
    const statusLine = el("div", "m26mm-note");
    ctlCard.appendChild(statusLine);
    ctlRow.appendChild(ctlCard);

    const readCard = el("div", "m26mm-card"); readCard.style.flex = "1 1 auto";
    readCard.appendChild(el("div", "m26mm-card-k", "Meter · V~ · black on L2"));
    const lcd = el("div", "m26mm-lcd");
    const lcdV = el("div", "v", "-- -- --"); const lcdA = el("div", "a", "probe a terminal");
    lcd.appendChild(lcdV); lcd.appendChild(lcdA);
    readCard.appendChild(lcd);
    const interp = el("div", "m26mm-note"); interp.style.marginTop = "9px";
    readCard.appendChild(interp);
    ctlRow.appendChild(readCard);

    // diagnosis
    const dxCard = el("div", "m26mm-card");
    dxCard.appendChild(el("div", "m26mm-card-k", "Name the open device — winning = naming the DEVICE, not just finding 0 V [PED §6.5]"));
    const dxRow = el("div", null); dxRow.style.cssText = "display:flex; gap:8px; flex-wrap:wrap;";
    dxCard.appendChild(dxRow);
    const dxOut = el("div", "m26mm-note"); dxOut.style.marginTop = "9px";
    dxCard.appendChild(dxOut);
    hostEl.appendChild(dxCard);
    for (const f of FAULTS) {
      const b = el("button", "m26mm-btn", f.name);
      b.addEventListener("click", () => diagnose(f.id, b));
      dxRow.appendChild(b);
    }

    function nodeLive(n) {
      const okFU = fault.id !== "fuse", okStop = fault.id !== "stop",
            okStart = fault.id !== "start", okOL = fault.id !== "ol";
      switch (n) {
        case "S":  return true;
        case "1":  return okFU;
        case "2":  return okFU && okStop;
        case "3":  return okFU && okStop && startHeld && okStart;
        case "4":  return okFU && okStop && startHeld && okStart && okOL;
        default:   return false;    // X2 side is the common — 0 V to itself
      }
    }
    function coilPulled() { return nodeLive("4") && fault.id !== "coil"; }

    function repaint() {
      for (const { l, node } of segs) l.classList.toggle("live", nodeLive(node));
      coilBody.style.fill = coilPulled() ? "#F3EFFF" : "#fff";
      coilBody.style.stroke = coilPulled() ? "#7C5CFF" : "#475569";
      statusLine.innerHTML = `START: <b>${startHeld ? "HELD" : "released"}</b> · M1 coil: <b>${coilPulled() ? "PULLED IN ✓ (while held)" : "not pulled in"}</b>` +
        (solved ? "" : ` · symptom: <b>M1 won't pull in</b>`);
      holdBtn.classList.toggle("on", startHeld);
      holdBtn.textContent = startHeld ? "👆 START HELD — click to release" : "👆 HOLD START (click to latch your thumb)";
    }

    function probeChip(c) {
      reads++;
      for (const [id, g] of chipEls) g.classList.toggle("probed", id === c.id);
      redLead.setAttribute("opacity", 1);
      redLead.setAttribute("transform", `translate(${c.x} ${RY - 10})`);
      const live = nodeLive(c.node);
      const v = c.node === "X2" ? 0 : (live ? 120 : 0);
      lcdV.textContent = v.toFixed(1); lcdA.textContent = `V~ · ${c.lbl} → L2`;
      readTag.setAttribute("x", c.x); readTag.setAttribute("y", RY - 80);
      readTag.setAttribute("class", "m26mm-readtag " + (v > 0 ? "hotv" : "deadv"));
      readTag.textContent = v > 0 ? "120 V" : "0 V";
      if (firstRead) {
        firstRead = false;
        if (c.id !== "S" && !warned) {
          warned = true;
          interp.innerHTML = `<b style="color:#B45309;">Efficiency flag:</b> you skipped the source check. Prove X1 FIRST — the classic waste is "20 minutes hopscotching a rung fed by a blown control fuse." <span class="m26mm-cite">[METH §11.10]</span>`;
          return;
        }
      }
      if (c.id === "S") {
        interp.innerHTML = live ? `<b>120 V at X1</b> — control power is real. Now walk downstream, following the wire numbers.` : ``;
      } else if (c.node === "X2") {
        interp.innerHTML = `<b>0 V at A2</b> — as it must be: A2 is bonded to L2, your COM reference. If A1 shows 120 V while A2 shows 0 V, the full source is sitting ACROSS the coil.`;
      } else if ((c.node === "3" || c.node === "4") && !startHeld && fault.id !== "stop" && fault.id !== "fuse") {
        interp.innerHTML = `<b>0 V — but is that the fault?</b> START is a momentary NO contact and you're not holding it. <b>Hold START</b>, then re-probe: reading past an un-actuated switch proves nothing. `;
      } else if (live) {
        interp.innerHTML = `<b>120 V at ${c.lbl}</b> — line voltage made it this far. The open is downstream. Keep hopping.`;
      } else {
        interp.innerHTML = `<b>0 V at ${c.lbl}</b> — the open is between here and the last point that read 120 V. Bracket it, then name the device below.`;
      }
    }

    function diagnose(id, btn) {
      if (solved) return;
      if (id === fault.id) {
        solved = true;
        btn.classList.add("on");
        const optimal = { fuse: 2, stop: 3, start: 4, ol: 5, coil: 6 }[fault.id];
        dxOut.innerHTML = `<b style="color:#047857;">Correct — ${fault.human}.</b> ` +
          (fault.id === "coil"
            ? `Every terminal read 120 V with START held, A2 read 0 V — full voltage ACROSS the coil and no pull-in. That's Axiom 2: the load has failed. <span class="m26mm-cite">[METH §1]</span> `
            : `120 V walked in and died at that device — Axiom 1: voltage across a switch = open switch. <span class="m26mm-cite">[METH §1]</span> `) +
          `You used <b>${reads}</b> reading${reads === 1 ? "" : "s"}; a tight source-first walk finds this one in about <b>${optimal}</b>. Every reading costs downtime — hit 🎲 and beat it. <span class="m26mm-cite">[PED §1.2, §5]</span>`;
        if (!PROG.s3.did) {
          mark("s3", "did");
          setCoach(`Fault named. Deal a couple more (🎲) until the walk feels automatic, then take the check question.`);
        }
      } else {
        dxOut.innerHTML = `<b style="color:#B91C1C;">Not it — that device tested good.</b> Where exactly did 120 V become 0 V? The open lives between those two probe points. (Parts-cannon swaps cost real money on a Simutech scorecard.) <span class="m26mm-cite">[PED §1.2]</span>`;
      }
    }

    holdBtn.addEventListener("click", () => { startHeld = !startHeld; repaint(); });
    dealBtn.addEventListener("click", () => {
      fault = FAULTS[Math.floor(Math.random() * FAULTS.length)];
      solved = false; reads = 0; firstRead = true; warned = false; startHeld = false;
      lcdV.textContent = "-- -- --"; lcdA.textContent = "probe a terminal";
      interp.innerHTML = ""; dxOut.innerHTML = "";
      readTag.textContent = ""; redLead.setAttribute("opacity", 0);
      for (const [, g] of chipEls) g.classList.remove("probed");
      dxRow.querySelectorAll("button").forEach((b) => b.classList.remove("on"));
      repaint();
      setCoach(`New fault dealt. Source first (<b>X1</b>), then walk: 1 → 2 → 3 (hold START) → 4 → A2.`);
    });

    hostEl.appendChild(quizBlock("s3",
      `With START held, you read <b>120 V</b> at wire 2 (STOP load side) and <b>0 V</b> at wire 3 (START load side). The open is…`,
      [
        "The STOP button — it's first in line",
        "The START contact — voltage died crossing it while it was actuated",
        "The overload 95-96",
        "The coil — Axiom 2",
      ],
      1,
      `The open always lives between the last-live and first-dead points. Wire 2 was hot, wire 3 was dead WITH the START held — the contact between them isn't making. (Un-held, that same 0 V would prove nothing.) [METH §2A; PRINT §4A]`,
      `Bracket it: last 120 V point … first 0 V point. What single device sits between wires 2 and 3? [METH §2A]`
    ));

    repaint();
  }

  // =====================================================================
  // SECTION 4 — VOLTAGE DROP UNDER LOAD
  // =====================================================================
  function buildS4(hostEl) {
    const ELS = [
      { id: "fu",   name: "FU1 fuse",        good: 8 },
      { id: "stop", name: "STOP (closed)",   good: 52 },
      { id: "seal", name: "Seal-in 13-14",   good: 61 },
      { id: "ol",   name: "OL 95-96",        good: 12 },
      { id: "wire", name: "Wire run L1→panel", good: 90 },
    ];
    const badIdx = 1 + Math.floor(Math.random() * 3);   // stop/seal/ol get burned
    const BAD_MV = 19800;                                // 19.8 V under load [PED §6.6]
    let measured = new Set(), beeped = false, condemned = PROG.s4.did;

    const symptom = el("div", "m26mm-card m26mm-warn");
    symptom.appendChild(el("div", "m26mm-card-k", "Work order"));
    const sy = el("div", "m26mm-note");
    sy.innerHTML = `M1 pulls in but <b>chatters</b>; motor runs weak. Continuity checks (power off) all <b>beeped fine</b>. ` +
      `Voltage drop only exists when current flows — so this test runs <b>energized, under load</b>. <span class="m26mm-cite">[METH §5; FUND §4]</span>`;
    symptom.appendChild(sy);
    hostEl.appendChild(symptom);

    const grid = el("div", "m26mm-elgrid");
    hostEl.appendChild(grid);
    const cards = ELS.map((e, i) => {
      const c = el("div", "m26mm-elcard");
      c.appendChild(el("div", "m26mm-elname", e.name));
      const val = el("div", "m26mm-elval", "— mV");
      c.appendChild(val);
      const beep = el("div", "m26mm-elbeep", "");
      c.appendChild(beep);
      const mBtn = el("button", "m26mm-btn", "📏 measure across (mV)");
      const bBtn = el("button", "m26mm-btn", "🔊 beep test (off)");
      const kBtn = el("button", "m26mm-btn", "❌ condemn");
      c.appendChild(mBtn); c.appendChild(bBtn); c.appendChild(kBtn);
      grid.appendChild(c);

      const mv = i === badIdx ? BAD_MV : e.good;
      mBtn.addEventListener("click", () => {
        measured.add(e.id);
        val.textContent = mv >= 1000 ? (mv / 1000).toFixed(1) + " V !" : mv + " mV";
        val.classList.toggle("bad", mv >= 300);
        c.classList.toggle("hi", mv >= 300);
        verdict();
      });
      bBtn.addEventListener("click", () => {
        beeped = true;
        beep.textContent = i === badIdx
          ? "BEEP ✓ … (it's ~40 Ω — under the 40 Ω beep threshold. The beep lied.)"
          : "BEEP ✓ (0.3 Ω)";
        verdict();
      });
      kBtn.addEventListener("click", () => {
        if (condemned) {
          nudgeCoach(`Ticket's closed — ${e.name} ${i === badIdx ? "was the burned one" : `measured ${e.good} mV, in spec`}.`);
          return;
        }
        if (i === badIdx) {
          condemned = true;
          c.classList.add("condemned");
          out.className = "m26mm-card m26mm-good";
          outB.innerHTML = `<b>Correct — condemned by the number, under load.</b> ${e.name} drops <b>${(BAD_MV / 1000).toFixed(1)} V</b> while everything else drops millivolts. ` +
            `The coil only sees ~${(120 - BAD_MV / 1000).toFixed(0)} V during pull-in — below the <b>85% (102 V)</b> floor an IEC contactor needs, hence the chatter. ` +
            `And note the beep test passed it: ~40 Ω still beeps, but a healthy closed contact is &lt;1 Ω and drops 50–60 mV new, ~100–150 mV worn, <b>300 mV absolute max</b>. <span class="m26mm-cite">[METH §5; PRINT §5; PED §6.6]</span>`;
          if (!PROG.s4.did) mark("s4", "did");
          setCoach(`"Ohmmeters will lie to you — voltage-drop test instead." Take the check question.`);
        } else {
          out.className = "m26mm-card m26mm-bad";
          outB.innerHTML = `<b>Parts cannon.</b> ${e.name} measured ${e.good} mV — inside every limit in the table. Replacing un-condemned parts costs sim dollars (and real ones). Measure them all first. <span class="m26mm-cite">[PED §1.2]</span>`;
        }
      });
      return c;
    });

    function verdict() {
      if (measured.size >= 3 && !condemned) {
        setCoach(`You have numbers. Compare them to the limits table and <b>condemn</b> exactly one element.`);
      }
    }

    const row = el("div", "m26mm-row"); row.style.marginTop = "12px";
    hostEl.appendChild(row);
    const limits = el("div", "m26mm-card"); limits.style.flex = "1 1 auto";
    limits.appendChild(el("div", "m26mm-card-k", "Pass / fail numbers — hard-coded from the research [METH §5; PRINT §5]"));
    const tbl = el("table", "m26mm-limits");
    tbl.innerHTML = `<tr><th>Element under load</th><th>Acceptable</th><th>Replace / investigate</th></tr>
      <tr><td>Single connection / terminal</td><td><b>~0 mV</b> (a few mV)</td><td>anything visible on the V range</td></tr>
      <tr><td>Wire / cable run</td><td><b>≤ 0.20 V</b></td><td>&gt; 0.2 V</td></tr>
      <tr><td>Switch</td><td><b>≤ 0.30 V</b></td><td>&gt; 0.3 V</td></tr>
      <tr><td>Ground / return bond</td><td><b>≤ 0.10 V</b></td><td>&gt; 0.1 V</td></tr>
      <tr><td>Relay / contactor closed contact</td><td><b>50–60 mV</b> new · 100–150 mV worn</td><td><b>300 mV max</b> · ≥1 V severe</td></tr>`;
    limits.appendChild(tbl);
    row.appendChild(limits);

    const out = el("div", "m26mm-card"); out.style.flex = "1 1 auto";
    out.appendChild(el("div", "m26mm-card-k", "Verdict"));
    const outB = el("div", "m26mm-note", "Measure at least three elements, then condemn one.");
    out.appendChild(outB);
    row.appendChild(out);
    if (PROG.s4.did) { outB.innerHTML = "Solved on a previous visit — re-measure freely."; }

    hostEl.appendChild(quizBlock("s4",
      `A closed contactor contact reads <b>320 mV</b> across it under load (and it beeps fine on continuity). Verdict?`,
      [
        "Fine — it beeped, so the path is good",
        "Replace it — 300 mV is the accepted absolute max for any relay/switch contact",
        "Fine until it reads a full volt",
        "Re-test unloaded to confirm first",
      ],
      1,
      `300 mV across a closed contact is the accepted absolute maximum; new contacts run 50–60 mV. The beep threshold (~20–40 Ω) is orders of magnitude above a healthy sub-1 Ω contact — the beep can't catch this. And unloaded it would read 0 V and "pass." [METH §5; FUND §4]`,
      `The beep threshold is ~20–40 Ω. What does a healthy closed contact actually measure? [METH §5]`
    ));
    void cards;
  }

  // =====================================================================
  // SECTION 5 — GHOST VOLTAGE & LoZ
  // =====================================================================
  function buildS5(hostEl) {
    const row = el("div", "m26mm-row");
    hostEl.appendChild(row);

    const scene = el("div", "m26mm-card"); scene.style.flex = "1 1 auto";
    scene.appendChild(el("div", "m26mm-card-k", "Shared raceway · 120 VAC feeder + abandoned conductor"));
    const svg = S("svg", { class: "m26mm-svg", viewBox: "0 0 620 170" });
    scene.appendChild(svg);
    row.appendChild(scene);

    svg.appendChild(S("rect", { x: 30, y: 30, width: 560, height: 110, rx: 12, fill: "#EEF1F7", stroke: "#B7C0D0", "stroke-width": 1.6, "stroke-dasharray": "7 5" }));
    svg.appendChild(S("text", { x: 44, y: 22, "font-size": 12, "font-weight": 700, fill: "#8A93A6" }, "CONDUIT (cross-run)"));
    svg.appendChild(S("line", { class: "m26mm-wire live", x1: 50, y1: 65, x2: 570, y2: 65 }));
    svg.appendChild(S("text", { x: 60, y: 55, "font-size": 13, "font-weight": 800, fill: "#B91C1C" }, "WIRE B — live feeder, 120 V"));
    svg.appendChild(S("line", { class: "m26mm-wire", x1: 50, y1: 112, x2: 570, y2: 112, "stroke-dasharray": "1 0" }));
    svg.appendChild(S("text", { x: 60, y: 136, "font-size": 13, "font-weight": 800, fill: "#334155" }, "WIRE A — abandoned, disconnected both ends"));
    // coupling field arcs
    for (let x = 110; x <= 510; x += 80) {
      svg.appendChild(S("path", { d: `M ${x} 70 Q ${x + 12} 88 ${x} 106`, fill: "none", stroke: "#7C5CFF", "stroke-width": 1.4, "stroke-dasharray": "3 3", opacity: .6 }));
    }
    svg.appendChild(S("text", { x: 310, y: 93, "text-anchor": "middle", "font-size": 11.5, "font-weight": 700, fill: "#6D28D9" }, "capacitive coupling"));

    const right = el("div", "m26mm-col"); right.style.flex = "0 0 330px";
    row.appendChild(right);

    const zCard = el("div", "m26mm-card");
    zCard.appendChild(el("div", "m26mm-card-k", "Meter input impedance"));
    const zRow = el("div", "m26mm-zrow");
    const zHi = el("button", "m26mm-zbtn active"); zHi.innerHTML = "<b>Hi-Z</b><span>10 MΩ ∥ &lt;100 pF</span>";
    const zLo = el("button", "m26mm-zbtn"); zLo.innerHTML = "<b>LoZ</b><span>≈3 kΩ</span>";
    zRow.appendChild(zHi); zRow.appendChild(zLo);
    zCard.appendChild(zRow);
    right.appendChild(zCard);

    const rd = el("div", "m26mm-card");
    rd.appendChild(el("div", "m26mm-card-k", "Reading (to neutral)"));
    const lcd = el("div", "m26mm-lcd");
    const lcdV = el("div", "v", "-- -- --"); const lcdA = el("div", "a", "pick a wire");
    lcd.appendChild(lcdV); lcd.appendChild(lcdA);
    rd.appendChild(lcd);
    const pr = el("div", null); pr.style.cssText = "display:flex; gap:8px; margin-top:9px;";
    const bA = el("button", "m26mm-btn", "probe WIRE A");
    const bB = el("button", "m26mm-btn", "probe WIRE B");
    pr.appendChild(bA); pr.appendChild(bB);
    rd.appendChild(pr);
    const interp = el("div", "m26mm-note"); interp.style.marginTop = "9px";
    rd.appendChild(interp);
    right.appendChild(rd);

    const caution = el("div", "m26mm-card m26mm-warn");
    caution.appendChild(el("div", "m26mm-card-k", "When LoZ is FORBIDDEN"));
    const cb = el("div", "m26mm-note");
    cb.innerHTML = `Across a <b>PLC input</b>, the meter's 3 kΩ looks like a <b>closed switch</b> — the input turns on and output Q1 fires: the machine MOVES with your leads in the cabinet. LoZ also trips GFCIs. Ghost-check with LoZ on <b>distribution wiring</b>, never on electronics. <span class="m26mm-cite">[FUND §3]</span>`;
    caution.appendChild(cb);
    right.appendChild(caution);

    const tl = taskList([
      "Wire A on Hi-Z (the ghost)", "Wire B on Hi-Z (the real thing)",
      "Wire A on LoZ (ghost collapses)", "Wire B on LoZ (hard source holds)",
    ]);
    const tCard = el("div", "m26mm-card");
    tCard.appendChild(el("div", "m26mm-card-k", "Take all four readings"));
    tCard.appendChild(tl.wrap);
    scene.appendChild(tCard);
    if (PROG.s5.did) { [0, 1, 2, 3].forEach((i) => tl.tick(i)); }

    let loz = false, sel = null;
    let jbase = 0;
    clearTimer();
    activeTimer = setInterval(() => {
      if (!lcd.isConnected) { clearTimer(); return; }
      if (sel === "A" && !loz) {          // ghost jitters — nothing is holding it up
        jbase = 101.8 + (Math.random() - 0.5) * 3.4;
        lcdV.textContent = jbase.toFixed(1);
      }
    }, 300);

    function show() {
      zHi.classList.toggle("active", !loz);
      zLo.classList.toggle("active", loz);
      if (!sel) return;
      if (sel === "A") {
        if (!loz) {
          lcdV.textContent = "101.8"; lcdA.textContent = "V~ · Hi-Z · wire A → N";
          interp.innerHTML = `<b>~102 V on a wire that's connected to NOTHING.</b> That's a ghost: coupling capacitance + your 10 MΩ input form a voltage divider — ghosts commonly read <b>80–85% of nominal</b>. Note the unstable last digits: no energy is holding this up. <span class="m26mm-cite">[FUND §3; METH §9]</span>`;
          tl.tick(0);
        } else {
          lcdV.textContent = "0.4"; lcdA.textContent = "LoZ · wire A → N";
          interp.innerHTML = `<b>Collapsed to 0.4 V.</b> The 3 kΩ input asked the "source" for a real current and it had none to give — pure capacitive phantom. The wire is <b>dead</b>. <span class="m26mm-cite">[FUND §3; PRINT §5]</span>`;
          tl.tick(2);
        }
      } else {
        if (!loz) {
          lcdV.textContent = "120.2"; lcdA.textContent = "V~ · Hi-Z · wire B → N";
          interp.innerHTML = `<b>120.2 V, rock steady.</b> On Hi-Z alone you can't tell this from the ghost next door — that's the whole problem.`;
          tl.tick(1);
        } else {
          lcdV.textContent = "119.8"; lcdA.textContent = "LoZ · wire B → N";
          interp.innerHTML = `<b>119.8 V — a hard source holds under the 3 kΩ load.</b> LoZ separates the liar from the live: collapse = ghost, hold = real. <span class="m26mm-cite">[FUND §3]</span>`;
          tl.tick(3);
        }
      }
      if (tl.allDone() && !PROG.s5.did) {
        mark("s5", "did");
        setCoach(`Ghost busted. Remember the tagline: the meter never lies about the number — it lies about what the number MEANS. Check question below.`);
      }
    }
    zHi.addEventListener("click", () => {
      if (!loz) { nudgeCoach("Already on Hi-Z (10 MΩ)."); return; }
      loz = false; show();
    });
    zLo.addEventListener("click", () => {
      if (loz) { nudgeCoach("Already on LoZ (≈3 kΩ)."); return; }
      loz = true; show();
    });
    bA.addEventListener("click", () => { sel = "A"; show(); });
    bB.addEventListener("click", () => { sel = "B"; show(); });

    hostEl.appendChild(quizBlock("s5",
      `A conductor reads <b>102 V</b> on your 10 MΩ meter and <b>0.4 V</b> the moment you flip to LoZ. Verdict?`,
      [
        "It's live — treat 102 V as real",
        "It's dead — a capacitive ghost with no energy behind it collapsed under the 3 kΩ load",
        "The meter's fuse is blown",
        "It's live, but only at 0.4 V",
      ],
      1,
      `A hard source holds its voltage under LoZ's 3 kΩ; a ghost — capacitive coupling into a 10 MΩ input — collapses to ~0. (Flip side: a reading that HOLDS on LoZ is real. And never LoZ across electronics.) [FUND §3; METH §9]`,
      `What happens to a capacitively-coupled phantom when you ask it for real current? [FUND §3]`
    ));
  }

  // =====================================================================
  // SECTION 6 — SAFETY: LIVE-DEAD-LIVE + CAT PICKER
  // =====================================================================
  function buildS6(hostEl) {
    const row = el("div", "m26mm-row");
    hostEl.appendChild(row);

    const ldlCard = el("div", "m26mm-card"); ldlCard.style.flex = "1 1 auto";
    ldlCard.appendChild(el("div", "m26mm-card-k", "Live-dead-live drill — the locked-out feed you're about to work on [FUND §10; METH §3]"));
    const lcd = el("div", "m26mm-lcd");
    const lcdV = el("div", "v", "-- -- --"); const lcdA = el("div", "a", "V~");
    lcd.appendChild(lcdV); lcd.appendChild(lcdA);
    ldlCard.appendChild(lcd);
    const ldl = el("div", "m26mm-ldl"); ldl.style.marginTop = "10px";
    ldlCard.appendChild(ldl);
    const ldlOut = el("div", "m26mm-note"); ldlOut.style.marginTop = "8px";
    ldlCard.appendChild(ldlOut);
    const killerBtn = el("button", "m26mm-btn hot", "🎲 Deal the killer scenario");
    killerBtn.style.marginTop = "10px";
    ldlCard.appendChild(killerBtn);
    row.appendChild(ldlCard);

    let step = 0, killer = false, violations = 0;
    const pairsDone = new Set();

    // step 1
    const st1 = el("div", "m26mm-ldl-step now");
    st1.innerHTML = `<span class="sn">1</span>`;
    const st1b = el("div", "m26mm-ldl-body");
    st1b.appendChild(el("div", "m26mm-ldl-t", "LIVE — prove the meter on the known-live receptacle"));
    st1b.appendChild(el("div", "m26mm-ldl-d", "Proves meter, leads, range and the internal fuse — before you bet your life on a 0."));
    const st1btn = el("button", "m26mm-btn", "⚡ probe the known-live source");
    st1b.appendChild(st1btn);
    st1.appendChild(st1b); ldl.appendChild(st1);
    // step 2
    const st2 = el("div", "m26mm-ldl-step");
    st2.innerHTML = `<span class="sn">2</span>`;
    const st2b = el("div", "m26mm-ldl-body");
    st2b.appendChild(el("div", "m26mm-ldl-t", "DEAD — test the locked-out circuit, EVERY pair"));
    st2b.appendChild(el("div", "m26mm-ldl-d", "Phase-to-phase AND phase-to-ground, at the point of work. An NCV pen is NOT acceptable sole verification ≤1000 V."));
    const pairRow = el("div", "m26mm-pairrow");
    const pairBtns = ["L1–L2", "L1–GND", "L2–GND"].map((p) => {
      const b = el("button", "m26mm-btn", p);
      b.addEventListener("click", () => doPair(p, b));
      pairRow.appendChild(b);
      return b;
    });
    st2b.appendChild(pairRow);
    st2.appendChild(st2b); ldl.appendChild(st2);
    // step 3
    const st3 = el("div", "m26mm-ldl-step");
    st3.innerHTML = `<span class="sn">3</span>`;
    const st3b = el("div", "m26mm-ldl-body");
    st3b.appendChild(el("div", "m26mm-ldl-t", "LIVE — re-prove the meter on the known-live source"));
    st3b.appendChild(el("div", "m26mm-ldl-d", "A meter that died mid-test would have just reported a live circuit as dead."));
    const st3btn = el("button", "m26mm-btn", "⚡ re-probe the known-live source");
    st3b.appendChild(st3btn);
    st3.appendChild(st3b); ldl.appendChild(st3);

    // killer decision buttons (hidden until dealt)
    const kRow = el("div", "m26mm-pairrow"); kRow.style.marginTop = "8px"; kRow.style.display = "none";
    const kGo = el("button", "m26mm-btn", "It read 0 — the receptacle must be dead too. Continue.");
    const kStop = el("button", "m26mm-btn primary", "STOP — the METER failed its live test. Swap meter/leads.");
    kRow.appendChild(kStop); kRow.appendChild(kGo);
    ldlCard.appendChild(kRow);

    function violation(msg) {
      violations++;
      ldlOut.innerHTML = `<b style="color:#B91C1C;">Logged safety violation (${violations}):</b> ${msg} Simutech-style sims log every skipped step — so do we. <span class="m26mm-cite">[PED §3.2]</span>`;
    }
    function setNow(n) {
      [st1, st2, st3].forEach((s, i) => s.classList.toggle("now", i === n - 1));
    }
    st1btn.addEventListener("click", () => {
      if (killer) {
        lcdV.textContent = "0.00"; lcdA.textContent = "V~ … on a KNOWN-LIVE source";
        kRow.style.display = "flex";
        ldlOut.innerHTML = `The known-live receptacle reads <b>0.00 V</b>. Something is wrong. Decide ↓`;
        return;
      }
      lcdV.textContent = "120.1"; lcdA.textContent = "V~ · known-live ✓";
      step = Math.max(step, 1);
      st1.classList.add("done"); setNow(2);
      ldlOut.innerHTML = `Meter proven. Now the dead test — all three pairs.`;
    });
    function doPair(p, b) {
      if (step < 1) { violation(`You tested the "dead" circuit before proving the meter (step 1).`); return; }
      lcdV.textContent = "0.0"; lcdA.textContent = `V~ · ${p} · locked-out feed`;
      pairsDone.add(p); b.classList.add("on");
      if (pairsDone.size === 3) {
        step = Math.max(step, 2);
        st2.classList.add("done"); setNow(3);
        ldlOut.innerHTML = `All pairs read 0. NOT done — re-prove the meter (step 3).`;
      }
    }
    st3btn.addEventListener("click", () => {
      if (step < 2) {
        violation(pairsDone.size ? `You skipped ${3 - pairsDone.size} conductor pair(s) in the dead test.` : `You skipped the dead test entirely.`);
        return;
      }
      lcdV.textContent = "120.0"; lcdA.textContent = "V~ · known-live ✓";
      st3.classList.add("done"); setNow(0);
      ldlOut.innerHTML = `<b style="color:#047857;">Verified DEAD — three-point sequence complete${violations ? ` (with ${violations} logged violation${violations > 1 ? "s" : ""} — run it clean next time)` : ", zero violations"}.</b> ` +
        `Now the discipline extras: one hand out of the circuit (clip that black lead), PPE above 50 V, eyes on the probe tips. <span class="m26mm-cite">[FUND §10; PED §4.9]</span>`;
      if (!violations && !PROG.s6.did) {
        mark("s6", "did");
        setCoach(`Ritual clean. Finish with the CAT-rating picker — it's this section's check question.`);
      } else if (violations) {
        setCoach(`Sequence completed but with logged violations — hit the steps again 1 → 2 (all pairs) → 3, clean.`);
      }
    });
    killerBtn.addEventListener("click", () => {
      killer = true; step = 0; pairsDone.clear(); violations = 0;
      [st1, st2, st3].forEach((s) => s.classList.remove("done")); setNow(1);
      pairBtns.forEach((b) => b.classList.remove("on"));
      lcdV.textContent = "-- -- --"; lcdA.textContent = "V~";
      ldlOut.innerHTML = `Killer scenario dealt: something about your test setup has silently failed. Start at step 1.`;
      setCoach(`The killer variant: run step 1 and <b>believe the meter's live test</b>, not your assumptions.`);
    });
    kGo.addEventListener("click", () => {
      kRow.style.display = "none"; killer = false;
      ldlOut.innerHTML = `<b style="color:#B91C1C;">⚡ Simulated shock event.</b> The circuit was LIVE — your meter's internal fuse had silently blown, so it read 0 V on a hot bus. ` +
        `Step 1 exists precisely to catch this: a meter that fails its live test can't clear anything. This one scenario justifies the whole ritual. <span class="m26mm-cite">[METH §11.18; PED §4.7]</span>`;
    });
    kStop.addEventListener("click", () => {
      kRow.style.display = "none"; killer = false;
      ldlOut.innerHTML = `<b style="color:#047857;">Correct.</b> The meter failed its LIVE proof — it can't verify anything. Swap meter/leads, then restart the sequence from step 1. ` +
        `(Fuse self-test: Ω mode, probe the A jack — a good 440 mA fuse reads ≈1.0 kΩ.) <span class="m26mm-cite">[METH §11.18; FUND §6]</span>`;
      if (!PROG.s6.did) {
        mark("s6", "did");
        setCoach(`You caught the dead meter. Finish with the CAT picker below.`);
      }
    });

    // ---- CAT picker (the section's check question) ----
    const catCard = el("div", "m26mm-card"); catCard.style.flex = "0 0 380px";
    catCard.appendChild(el("div", "m26mm-card-k", "Check question — pick your meter for a 480 V MCC bucket [FUND §5; PRINT §6]"));
    const cats = el("div", "m26mm-cats"); cats.style.gridTemplateColumns = "1fr";
    catCard.appendChild(cats);
    const catOut = el("div", "m26mm-note"); catOut.style.marginTop = "9px";
    catCard.appendChild(catOut);
    row.appendChild(catCard);

    const CATS = [
      { ok: false, t: "CAT II · 1000 V · UL listed",
        d: "Big voltage number! Rated for receptacle-connected loads.",
        why: `Category beats voltage: CAT III 600 V is tested with a 6 kV impulse behind 2 Ω; CAT II 1000 V gets 6 kV behind 12 Ω — about 6× LESS delivered energy. A panel is a CAT III location no matter the meter's volts number.` },
      { ok: true, t: "CAT III · 600 V · UL listed (meter AND leads)",
        d: "Rated for panels, MCCs, feeders — with an independent listing mark.",
        why: `480 V panel minimum = CAT III-600 V, and the SYSTEM rating is the lowest of meter and leads — both carry the mark here.` },
      { ok: false, t: "“Designed to meet CAT III-1000 V” — no listing mark",
        d: "Manufacturer's own claim, bargain price.",
        why: `"Designed to meet" is marketing, not third-party testing. Require an independent mark (UL/CSA/TÜV/VDE). No mark, no panel.` },
    ];
    CATS.forEach((c) => {
      const b = el("button", "m26mm-cat");
      b.innerHTML = `<b>${c.t}</b><span>${c.d}</span>`;
      b.addEventListener("click", () => {
        if (c.ok) {
          b.classList.add("right");
          catOut.innerHTML = `✓ <b>Correct.</b> ${c.why} <span class="m26mm-cite">[FUND §5]</span>`;
          mark("s6", "quiz");
        } else {
          b.classList.add("wrong");
          catOut.innerHTML = `✗ ${c.why} <span class="m26mm-cite">[FUND §5]</span>`;
        }
      });
      cats.appendChild(b);
    });
    if (PROG.s6.quiz) {
      cats.children[1].classList.add("right");
      catOut.innerHTML = `✓ Answered on a previous visit: CAT III 600 V, independently listed, meter AND leads.`;
    }
  }

  // ---------------------------------------------------------------- sections + tabs
  const SECTIONS = [
    { key: "s1", lbl: "Meet the Meter", build: buildS1,
      coach: `Spin the <b>dial</b> through the modes and read what the circuit sees each time. Then park the red lead in the <b>A jack</b> and probe the receptacle — feel the classic trap. Finish with a clean V~ read.` },
    { key: "s2", lbl: "Two Points", build: buildS2,
      coach: `A voltage reading means <b>nothing</b> until you can answer "relative to WHAT?" Click two probe dots on the mini-rung — do all three tasks. Wire numbers are nodes: every point stamped "1" is one electrical point.` },
    { key: "s3", lbl: "Hopscotch Lab", build: buildS3,
      coach: `Ticket: <b>M1 won't pull in.</b> Black lead is clipped to L2 (one hand free). ① Prove the source at <b>X1</b> first, then hop the red lead down the print: STOP → START (hold it!) → OL 95 → coil A1. The open is between the last 120 V and the first 0 V.` },
    { key: "s4", lbl: "Drop Test", build: buildS4,
      coach: `The starter <b>chatters</b> — but everything "has voltage." Meter is on <b>mV</b>. Measure ACROSS each series element while it runs; condemn the one the NUMBERS convict. Try the beep test too — it will lie to you.` },
    { key: "s5", lbl: "Ghost & LoZ", build: buildS5,
      coach: `Two conductors share a raceway. One is abandoned — disconnected at BOTH ends — yet your meter says it's hot. Read both wires on <b>Hi-Z</b>, then flip to <b>LoZ</b> and read them again.` },
    { key: "s6", lbl: "Safety", build: buildS6,
      coach: `Before hands touch conductors: <b>LIVE → DEAD → LIVE</b>, per NFPA 70E 120.5(7). Prove the METER first — then the circuit — then the meter again. Run the ritual, survive the killer variant, then pick the right meter for a 480 V MCC.` },
  ];
  SECTIONS.forEach((sec, i) => {
    const t = el("button", "m26mm-tab");
    const n = el("span", "n", String(i + 1));
    t.appendChild(n);
    t.appendChild(el("span", null, sec.lbl));
    t.addEventListener("click", () => select(i));
    tabs.appendChild(t);
  });

  // Build EVERY section once, up front, and show/hide on tab switch — controls
  // keep their state (and their event listeners) across tab flips.
  const secHosts = SECTIONS.map((sec) => {
    const body = el("div", "m26mm-col");
    body.style.display = "none";
    content.appendChild(body);
    sec.build(body);
    return body;
  });

  let current = -1;
  function select(i) {
    if (i === current) {
      nudgeCoach(`You're on <b>${SECTIONS[i].lbl}</b> already — work the panel below.`);
      return;
    }
    current = i;
    tabs.querySelectorAll(".m26mm-tab").forEach((t, ti) => t.classList.toggle("active", ti === i));
    secHosts.forEach((h, hi) => { h.style.display = hi === i ? "" : "none"; });
    setCoach(SECTIONS[i].coach);
    refreshMeta();
  }

  refreshMeta();
  // QA hook: ?mmsec=N deep-links a section for headless verification
  const qa = parseInt(new URLSearchParams(location.search).get("mmsec") || "1", 10);
  select(Math.min(6, Math.max(1, qa)) - 1);
}
