// =============================================================================
// test_center.js — the dedicated Test Center: a full-stage exam hub.
// One exam per curriculum level (question pool = that level's verified quiz
// banks in data/quizzes/) plus a Final Exam sampled across ALL modules.
// Flow: hub → config card (question count + order) → one-question-at-a-time
// full-width cards (progress bar, prev/next, flag-for-review) → grade screen
// with pass/fail (≥80%), per-question review, and retake (fresh random deal).
// Best scores persist in localStorage ("relay_exams_v1") — deliberately
// separate from lesson progress ("relay_progress_v1").
// Quiz items may carry a `visual` spec — a read-only schematic rendered above
// the options (and, smaller, in the grade review) via exam_visual.js, so a
// question can put the actual print in front of the learner like a real exam.
// All classes are tc- prefixed; styling lives in css/app.css (ev- styles are
// injected by exam_visual.js).
// =============================================================================

import { buildExamVisual } from "./exam_visual.js";

const EXAMS_KEY = "relay_exams_v1";
const PASS_PCT = 80;

let HOST = null;        // the stage-overlay element we render into
let EXAMS = null;       // exam definitions, built once per page load
let S = null;           // live attempt state (null = not mid-exam)

let curriculum = null;              // data/curriculum.json
const banks = new Map();            // moduleId -> quiz bank json (or null)
const modOrder = new Map();         // moduleId -> curriculum index (course order)

// ---------------------------------------------------------------- tiny utils
function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

// Async-fill a placeholder with the question's schematic. renderExam/gradeExam
// stay synchronous; the figure pops in when ready. The isConnected guard drops
// the fill if the learner has already navigated away (stale-render race).
function mountVisual(slot, visual, opts) {
  buildExamVisual(visual, opts).then((fig) => {
    if (!fig || !slot.isConnected) return;
    slot.appendChild(fig);
    fitVisual(slot, fig);
  });
}

// The exam contract: with a print on the card, the question text AND at least
// the first two answer options must still be on screen (checked at 980x820 and
// 1600x900). The CSS vh-cap covers most cases, but a tall print under a
// three-line question over a multi-row dot strip can push option 2 below the
// fold — so after mounting we measure the real overflow and shrink the print
// by exactly that much (never below 150px, still a perfectly readable sheet).
function fitVisual(slot, fig) {
  const card = slot.closest(".tc-qcard");
  const svg = fig.querySelector("svg");
  if (!card || !svg) return;                      // grade-review prints keep the compact cap
  const fit = () => {
    if (!slot.isConnected) return;
    const opts = card.querySelectorAll(".tc-opt");
    const target = opts[1] || opts[0];
    if (!target) return;
    const over = target.getBoundingClientRect().bottom - (window.innerHeight - 8);
    if (over > 1) {
      const h = svg.getBoundingClientRect().height;
      const want = Math.round(h - over);
      const next = Math.max(150, want);
      if (next < h) svg.style.maxHeight = next + "px";
      // floor reached and still over? shave the figure's chrome, not the drawing
      if (want < 150) fig.classList.add("ev-tight");
    }
  };
  fit();
  // mounting the print can flip the overlay into scrolling mode — the scrollbar
  // narrows the column, the question text rewraps, and the options shift down
  // AFTER the first measurement. Settle over the next couple of frames.
  requestAnimationFrame(() => { fit(); requestAnimationFrame(fit); });
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`fetch ${path} -> ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- data
async function loadData() {
  if (curriculum) return;
  curriculum = await fetchJSON("data/curriculum.json");
  curriculum.forEach((m, i) => modOrder.set(m.id, i));
  await Promise.all(curriculum.map(async (m) => {
    if (banks.has(m.id)) return;
    try {
      const r = await fetch(`data/quizzes/${m.id}.json`);
      banks.set(m.id, r.ok ? await r.json() : null);
    } catch { banks.set(m.id, null); }
  }));
}

const hasBank = (id) => {
  const b = banks.get(id);
  return b && Array.isArray(b.questions) && b.questions.length > 0;
};

function buildExams() {
  const levels = [];
  for (const m of curriculum) if (!levels.includes(m.level)) levels.push(m.level);
  const exams = levels.map((lv) => {
    const ids = curriculum.filter((m) => m.level === lv && hasBank(m.id)).map((m) => m.id);
    return {
      id: "level-" + lv.toLowerCase().replace(/\s+/g, "-"),
      name: lv + " Exam",
      level: lv,
      kind: "level",
      moduleIds: ids,
      defaultCount: 10,
    };
  }).filter((e) => e.moduleIds.length);
  exams.push({
    id: "final",
    name: "Final Exam",
    level: "All levels",
    kind: "final",
    moduleIds: curriculum.filter((m) => hasBank(m.id)).map((m) => m.id),
    defaultCount: 25,
  });
  return exams;
}

const poolSize = (exam) =>
  exam.moduleIds.reduce((n, id) => n + (banks.get(id)?.questions.length || 0), 0);

const titleOf = (id) => curriculum.find((m) => m.id === id)?.title || id;

// question-count choices for the config card
function countChoices(exam) {
  const pool = poolSize(exam);
  if (exam.kind === "final") return [10, 25, 50].filter((c) => c <= pool);
  const base = [5, 10, 15, 20].filter((c) => c < pool);
  base.push(pool);                          // "All N" — the whole pool
  return base;
}

// ---------------------------------------------------------------- sampling
// Round-robin across shuffled banks so a sample SPREADS over the level's
// modules (the 25-question final touches 25 different lessons). Option order
// is also shuffled per attempt (same idea as quiz.js) so the correct answer
// never sits in a fixed slot.
function sampleQuestions(exam, n, shuffleOrder) {
  const pools = shuffle(exam.moduleIds.map((id) => ({
    id,
    title: titleOf(id),
    qs: shuffle(banks.get(id).questions.map((q, qi) => ({ q, qi }))),
  })));
  const picked = [];
  let hop = 0;
  while (picked.length < n && pools.some((p) => p.qs.length)) {
    const p = pools[hop++ % pools.length];
    if (!p.qs.length) continue;
    const { q, qi } = p.qs.pop();
    picked.push({ ...q, moduleId: p.id, moduleTitle: p.title, srcIdx: qi });
  }
  if (shuffleOrder) shuffle(picked);
  else picked.sort((a, b) =>
    (modOrder.get(a.moduleId) - modOrder.get(b.moduleId)) || (a.srcIdx - b.srcIdx));
  for (const it of picked) {
    it.order = shuffle(it.options.map((_, i) => i));   // slot -> original index
    it.correctSlot = it.order.indexOf(it.correct);
    it.sel = null;                                     // selected slot
    it.flag = false;                                   // flagged for review
  }
  return picked;
}

// ---------------------------------------------------------------- best scores
function getScores() {
  try { return JSON.parse(localStorage.getItem(EXAMS_KEY) || "{}") || {}; }
  catch { return {}; }
}
function recordScore(examId, pct) {
  const s = getScores();
  const e = s[examId] || { best: -1, attempts: 0 };
  e.attempts = (e.attempts | 0) + 1;
  e.last = pct;
  e.date = new Date().toISOString().slice(0, 10);
  const isBest = pct > (e.best ?? -1);
  if (isBest) e.best = pct;
  s[examId] = e;
  try { localStorage.setItem(EXAMS_KEY, JSON.stringify(s)); } catch { /* storage full/blocked — score just won't persist */ }
  return isBest;
}

// ---------------------------------------------------------------- entry point
export async function renderTestCenter(host) {
  HOST = host;
  host.innerHTML = `<div class="tc-hub"><p class="tc-sub">Loading exam banks…</p></div>`;
  try { await loadData(); }
  catch (e) {
    console.error(e);
    host.innerHTML = `<div class="tc-hub"><p class="tc-sub">Could not load the quiz banks. Make sure you launched with the training server.</p></div>`;
    return;
  }
  if (!EXAMS) EXAMS = buildExams();
  S = null;
  renderHub();
}

// ---------------------------------------------------------------- hub
const LEVEL_CHIP = {
  "Baby Steps": "tc-chip-baby",
  "Beginner": "tc-chip-beginner",
  "Intermediate": "tc-chip-intermediate",
  "Advanced": "tc-chip-advanced",
  "Expert": "tc-chip-expert",
  "All levels": "tc-chip-final",
};

function renderHub() {
  const scores = getScores();
  const passed = EXAMS.filter((e) => (scores[e.id]?.best ?? -1) >= PASS_PCT).length;

  const root = el("div", "tc-hub");
  const head = el("div", "tc-head");
  head.appendChild(el("div", "tc-eyebrow", "TEST CENTER"));
  head.appendChild(el("h1", "tc-h1", "Prove what you know."));
  const sub = el("p", "tc-sub");
  sub.textContent = `Every exam deals a fresh random hand from the lesson quiz banks. Score ${PASS_PCT}% or better to pass — your best score is saved.`;
  head.appendChild(sub);
  const tally = el("div", "tc-tally");
  tally.innerHTML = `<b>${passed}</b> of <b>${EXAMS.length}</b> exams passed`;
  head.appendChild(tally);
  root.appendChild(head);

  const grid = el("div", "tc-grid");
  for (const exam of EXAMS) {
    const sc = scores[exam.id];
    const best = sc?.best ?? -1;
    const card = el("div", "tc-card" + (exam.kind === "final" ? " tc-final" : ""));

    card.appendChild(el("span", "tc-chip " + (LEVEL_CHIP[exam.level] || ""), exam.level));
    card.appendChild(el("h3", "tc-card-title", exam.name));
    card.appendChild(el("p", "tc-card-meta",
      exam.kind === "final"
        ? `${exam.defaultCount} randomized questions drawn from every lesson in the course — the whole ladder, top to bottom.`
        : `${exam.moduleIds.length} lesson${exam.moduleIds.length > 1 ? "s" : ""} · ${poolSize(exam)}-question pool`));

    const bestRow = el("div", "tc-best");
    if (best >= 0) {
      bestRow.innerHTML = `<span class="tc-best-label">Best</span> <b>${best}%</b>` +
        (best >= PASS_PCT
          ? ` <span class="tc-pill tc-pill-pass">✓ PASSED</span>`
          : ` <span class="tc-pill tc-pill-retry">keep training</span>`) +
        (sc.attempts ? ` <span class="tc-attempts">${sc.attempts} attempt${sc.attempts > 1 ? "s" : ""}</span>` : "");
    } else {
      bestRow.innerHTML = `<span class="tc-best-label">Not attempted yet</span>`;
    }
    card.appendChild(bestRow);

    const start = el("button", "btn btn-accent tc-start", best >= 0 ? "Retake exam" : "Start exam");
    start.addEventListener("click", () => renderConfig(exam));
    card.appendChild(start);
    grid.appendChild(card);
  }
  root.appendChild(grid);

  HOST.innerHTML = "";
  HOST.appendChild(root);
  HOST.scrollTop = 0;
}

// ---------------------------------------------------------------- config card
function renderConfig(exam) {
  const choices = countChoices(exam);
  const pool = poolSize(exam);
  let count = choices.includes(exam.defaultCount) ? exam.defaultCount : choices[0];
  let shuffleOrder = true;

  const root = el("div", "tc-config");
  const back = el("button", "tc-back", "‹ All exams");
  back.addEventListener("click", renderHub);
  root.appendChild(back);

  root.appendChild(el("span", "tc-chip " + (LEVEL_CHIP[exam.level] || ""), exam.level));
  root.appendChild(el("h2", "tc-h2", exam.name));
  root.appendChild(el("p", "tc-sub",
    exam.kind === "final"
      ? `Questions are sampled across all ${exam.moduleIds.length} lesson banks (${pool} questions total). Pass mark: ${PASS_PCT}%.`
      : `Questions are sampled from the ${exam.moduleIds.length} ${exam.level} lesson${exam.moduleIds.length > 1 ? "s" : ""} (${pool}-question pool). Pass mark: ${PASS_PCT}%.`));

  const card = el("div", "tc-config-card");

  card.appendChild(el("div", "tc-field-label", "How many questions?"));
  const seg = el("div", "tc-seg");
  choices.forEach((c) => {
    const label = (exam.kind !== "final" && c === pool) ? `All ${c}` : String(c);
    const b = el("button", "tc-seg-btn" + (c === count ? " active" : ""), label);
    b.addEventListener("click", () => {
      count = c;
      seg.querySelectorAll(".tc-seg-btn").forEach((x) => x.classList.toggle("active", x === b));
    });
    seg.appendChild(b);
  });
  card.appendChild(seg);

  card.appendChild(el("div", "tc-field-label", "Question order"));
  const ord = el("div", "tc-seg");
  [["Shuffled", true], ["Course order", false]].forEach(([label, val]) => {
    const b = el("button", "tc-seg-btn" + (val === shuffleOrder ? " active" : ""), label);
    b.addEventListener("click", () => {
      shuffleOrder = val;
      ord.querySelectorAll(".tc-seg-btn").forEach((x) => x.classList.toggle("active", x === b));
    });
    ord.appendChild(b);
  });
  card.appendChild(ord);

  card.appendChild(el("p", "tc-config-note",
    "Answer options are shuffled every attempt. Flag any question with 🚩 and come back to it before you finish."));

  const begin = el("button", "btn btn-accent tc-begin", "Begin exam ▶");
  begin.addEventListener("click", () => startExam(exam, count, shuffleOrder));
  card.appendChild(begin);

  root.appendChild(card);
  HOST.innerHTML = "";
  HOST.appendChild(root);
  HOST.scrollTop = 0;
}

// ---------------------------------------------------------------- exam runner
function startExam(exam, count, shuffleOrder) {
  S = {
    exam, count, shuffleOrder,
    questions: sampleQuestions(exam, count, shuffleOrder),
    idx: 0,
    confirmFinish: false,
  };
  renderExam();
}

function renderExam() {
  const total = S.questions.length;
  const q = S.questions[S.idx];
  const answered = S.questions.filter((x) => x.sel != null).length;

  const root = el("div", "tc-exam");

  // top bar: exit · exam name · position
  const top = el("div", "tc-topbar");
  const exit = el("button", "tc-back", "✕ Exit exam");
  exit.title = "Leave without grading — nothing is saved";
  exit.addEventListener("click", renderHub);
  top.appendChild(exit);
  top.appendChild(el("div", "tc-topbar-name", S.exam.name));
  top.appendChild(el("div", "tc-topbar-pos", `Question ${S.idx + 1} / ${total}`));
  root.appendChild(top);

  // progress bar
  const track = el("div", "tc-progress-track");
  const fill = el("div", "tc-progress-fill");
  fill.style.width = Math.round(((S.idx + 1) / total) * 100) + "%";
  track.appendChild(fill);
  root.appendChild(track);

  // question dots — jump anywhere; shows answered / flagged / current
  const dots = el("div", "tc-dots");
  S.questions.forEach((x, i) => {
    const d = el("button",
      "tc-dot" + (i === S.idx ? " cur" : "") + (x.sel != null ? " done" : "") + (x.flag ? " flag" : ""),
      String(i + 1));
    d.title = (x.flag ? "🚩 flagged — " : "") + (x.sel != null ? "answered" : "unanswered");
    d.addEventListener("click", () => { S.idx = i; S.confirmFinish = false; renderExam(); });
    dots.appendChild(d);
  });
  root.appendChild(dots);

  // the question card
  const card = el("div", "tc-qcard");
  const eyebrow = el("div", "tc-qsrc");
  eyebrow.innerHTML = `<span class="tc-qsrc-label">FROM</span> ${q.moduleTitle}` +
    (q.flag ? ` <span class="tc-qflagged">🚩 flagged</span>` : "");
  card.appendChild(eyebrow);
  card.appendChild(el("p", "tc-qtext", q.q));

  // the print: a read-only schematic between the question and its options
  if (q.visual) {
    const slot = el("div", "tc-visual-slot");
    card.appendChild(slot);
    mountVisual(slot, q.visual);
  }

  const opts = el("div", "tc-opts");
  q.order.forEach((origIdx, slot) => {
    const b = el("button", "tc-opt" + (q.sel === slot ? " sel" : ""), q.options[origIdx]);
    b.addEventListener("click", () => {
      q.sel = slot;
      S.confirmFinish = false;
      opts.querySelectorAll(".tc-opt").forEach((x, xi) => x.classList.toggle("sel", xi === slot));
      dots.children[S.idx].classList.add("done");
      const n = S.questions.filter((x) => x.sel != null).length;
      const cnt = root.querySelector(".tc-answered");
      if (cnt) cnt.textContent = `${n} / ${total} answered`;
    });
    opts.appendChild(b);
  });
  card.appendChild(opts);
  root.appendChild(card);

  // controls: prev · flag · next / finish
  const ctl = el("div", "tc-controls");
  const prev = el("button", "btn btn-ghost tc-prev", "‹ Prev");
  prev.disabled = S.idx === 0;
  prev.addEventListener("click", () => { S.idx--; S.confirmFinish = false; renderExam(); });
  ctl.appendChild(prev);

  const flag = el("button", "btn btn-ghost tc-flag" + (q.flag ? " active" : ""),
    q.flag ? "🚩 Flagged" : "🚩 Flag for review");
  flag.addEventListener("click", () => { q.flag = !q.flag; renderExam(); });
  ctl.appendChild(flag);

  const spacer = el("div", "tc-ctl-spacer");
  spacer.innerHTML = `<span class="tc-answered">${answered} / ${total} answered</span>`;
  ctl.appendChild(spacer);

  if (S.idx < total - 1) {
    const next = el("button", "btn btn-accent tc-next", "Next ›");
    next.addEventListener("click", () => { S.idx++; S.confirmFinish = false; renderExam(); });
    ctl.appendChild(next);
  } else {
    const unanswered = total - answered;
    const fin = el("button", "btn btn-accent tc-finish",
      S.confirmFinish ? `Finish with ${unanswered} blank?` : "Finish exam ✓");
    fin.addEventListener("click", () => {
      // recount NOW — the learner may have just answered this question without
      // a re-render, and a stale closure count would wrongly demand a confirm
      const blank = S.questions.filter((x) => x.sel == null).length;
      if (blank > 0 && !S.confirmFinish) { S.confirmFinish = true; renderExam(); return; }
      gradeExam();
    });
    ctl.appendChild(fin);
  }
  root.appendChild(ctl);

  if (S.confirmFinish) {
    root.appendChild(el("p", "tc-warn",
      `You still have ${total - answered} unanswered question${total - answered > 1 ? "s" : ""} — use the numbered dots above to jump to them, or click Finish again to grade as-is.`));
  }

  HOST.innerHTML = "";
  HOST.appendChild(root);
  HOST.scrollTop = 0;
}

// ---------------------------------------------------------------- grading
function gradeExam() {
  const total = S.questions.length;
  const correct = S.questions.filter((q) => q.sel != null && q.sel === q.correctSlot).length;
  const pct = Math.round((correct / total) * 100);
  const passed = pct >= PASS_PCT;
  const isBest = recordScore(S.exam.id, pct);
  const best = getScores()[S.exam.id]?.best ?? pct;

  const root = el("div", "tc-grade");

  const head = el("div", "tc-grade-head " + (passed ? "pass" : "fail"));
  head.appendChild(el("div", "tc-grade-pct", pct + "%"));
  const verdict = el("div", "tc-grade-verdict");
  verdict.innerHTML = passed
    ? `<span class="tc-pill tc-pill-pass">✓ PASSED</span>`
    : `<span class="tc-pill tc-pill-retry">below ${PASS_PCT}% — keep training</span>`;
  if (isBest) verdict.innerHTML += ` <span class="tc-pill tc-pill-best">★ new personal best</span>`;
  head.appendChild(verdict);
  head.appendChild(el("p", "tc-grade-stats",
    `${correct} of ${total} correct · pass mark ${PASS_PCT}% · your best on this exam: ${best}%`));
  root.appendChild(head);

  const row = el("div", "tc-grade-actions");
  const retake = el("button", "btn btn-accent", "↻ Retake — new questions");
  retake.addEventListener("click", () => startExam(S.exam, S.count, S.shuffleOrder));
  row.appendChild(retake);
  const backBtn = el("button", "btn btn-ghost", "‹ Back to Test Center");
  backBtn.addEventListener("click", renderHub);
  row.appendChild(backBtn);
  root.appendChild(row);

  root.appendChild(el("h3", "tc-rev-head", "Review every question"));
  const list = el("div", "tc-rev-list");
  S.questions.forEach((q, i) => {
    const right = q.sel != null && q.sel === q.correctSlot;
    const item = el("div", "tc-rev-item " + (right ? "ok" : "bad"));

    const ihead = el("div", "tc-rev-meta");
    ihead.innerHTML = `<span class="tc-rev-num">${right ? "✓" : "✕"} Q${i + 1}</span>` +
      `<span class="tc-rev-src">${q.moduleTitle}</span>` +
      (q.flag ? `<span class="tc-qflagged">🚩</span>` : "");
    item.appendChild(ihead);

    item.appendChild(el("p", "tc-rev-q", q.q));

    // visual questions keep their print in the review (smaller)
    if (q.visual) {
      const slot = el("div", "tc-visual-slot");
      item.appendChild(slot);
      mountVisual(slot, q.visual, { compact: true });
    }

    const you = el("p", "tc-rev-ans " + (right ? "ok" : "bad"));
    you.innerHTML = `<span class="tc-rev-ans-label">Your answer</span> ${q.sel != null ? q.options[q.order[q.sel]] : "— skipped"}`;
    item.appendChild(you);

    if (!right) {
      const cor = el("p", "tc-rev-ans ok");
      cor.innerHTML = `<span class="tc-rev-ans-label">Correct answer</span> ${q.options[q.correct]}`;
      item.appendChild(cor);
    }

    item.appendChild(el("p", "tc-rev-why", q.why));
    list.appendChild(item);
  });
  root.appendChild(list);

  const bottom = el("div", "tc-grade-actions");
  const retake2 = el("button", "btn btn-accent", "↻ Retake — new questions");
  retake2.addEventListener("click", () => startExam(S.exam, S.count, S.shuffleOrder));
  bottom.appendChild(retake2);
  const back2 = el("button", "btn btn-ghost", "‹ Back to Test Center");
  back2.addEventListener("click", renderHub);
  bottom.appendChild(back2);
  root.appendChild(bottom);

  HOST.innerHTML = "";
  HOST.appendChild(root);
  HOST.scrollTop = 0;
}
