// =============================================================================
// quiz.js — interactive multiple-choice quiz per module. Loads the verified
// quiz bank (data/quizzes/<moduleId>.json) and runs it as retrieval practice:
// the learner must pick before any answer is revealed, then sees why.
// Questions that carry a `visual` spec (print-reading questions) get their
// read-only schematic rendered above the options via exam_visual.js — the same
// print the Test Center shows, compact-sized for the teach panel.
// =============================================================================

import { buildExamVisual } from "./exam_visual.js";

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

// Returns true if a quiz was loaded + rendered, false if none exists.
export async function renderQuiz(container, moduleId, onComplete) {
  let data;
  try {
    const r = await fetch(`data/quizzes/${moduleId}.json`);
    if (!r.ok) return false;
    data = await r.json();
  } catch { return false; }
  if (!data || !Array.isArray(data.questions) || !data.questions.length) return false;

  container.innerHTML = "";
  container.classList.add("quiz-box");
  container.appendChild(el("div", "mini-label", "Check yourself"));

  const total = data.questions.length;
  let answered = 0, correct = 0;
  const score = el("div", "quiz-score");

  data.questions.forEach((q, qi) => {
    const card = el("div", "quiz-q");
    card.appendChild(el("p", "quiz-qtext", `${qi + 1}. ${q.q}`));
    if (q.visual) {
      const slot = el("div", "quiz-visual-slot");
      card.appendChild(slot);
      buildExamVisual(q.visual, { compact: true }).then((fig) => {
        if (fig && slot.isConnected) slot.appendChild(fig);
      });
    }
    const opts = el("div", "quiz-opts");

    // Shuffle the option order per render so the correct answer isn't always in
    // the same slot (learners were passing by always picking the first option).
    const order = q.options.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const correctSlot = order.indexOf(q.correct);

    order.forEach((origIdx, slot) => {
      const b = el("button", "quiz-opt", q.options[origIdx]);
      b.addEventListener("click", () => {
        if (card.classList.contains("done")) return;
        card.classList.add("done");
        const right = slot === correctSlot;
        b.classList.add(right ? "correct" : "wrong");
        if (!right) opts.children[correctSlot].classList.add("correct");
        [...opts.children].forEach((x) => x.classList.add("locked"));
        card.appendChild(el("div", "quiz-why", q.why));

        answered++; if (right) correct++;
        if (answered === total) {
          const pct = Math.round((correct / total) * 100);
          score.textContent = `${correct} / ${total} correct · ${pct}%`;
          score.classList.add("show", pct >= 50 ? "pass" : "low");
          onComplete && onComplete();
        }
      });
      opts.appendChild(b);
    });

    card.appendChild(opts);
    container.appendChild(card);
  });

  container.appendChild(score);
  return true;
}
