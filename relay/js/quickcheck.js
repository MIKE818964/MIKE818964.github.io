// =============================================================================
// quickcheck.js — a single DIAGNOSTIC reasoning check embedded in every lesson
// (not a recall quiz — a "given this symptom, what do you conclude / do next"
// decision, exactly like the meter would show a tech on the floor). Distinct
// from quiz.js (retrieval practice) — this is Gemini rubric dimension #2
// ("troubleshooting integration"), made pervasive across all 29 modules
// instead of only the capstone.
// =============================================================================

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

/** Render m.quickCheck into `container`. Returns true if one was rendered. */
export function renderQuickCheck(container, m) {
  const qc = m.quickCheck;
  if (!qc || !qc.symptom || !Array.isArray(qc.options) || qc.options.length < 2) return false;

  container.innerHTML = "";
  container.classList.add("qc-box");
  container.appendChild(el("div", "mini-label qc-label", "Quick check — what's your read?"));
  container.appendChild(el("p", "qc-symptom", qc.symptom));

  const opts = el("div", "qc-opts");
  container.appendChild(opts);

  // shuffle so the correct answer isn't always in the same slot
  const order = qc.options.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  let answered = false;
  order.forEach((idx) => {
    const o = qc.options[idx];
    const b = el("button", "qc-opt", o.label);
    b.addEventListener("click", () => {
      if (answered) return;
      answered = true;
      b.classList.add(o.correct ? "correct" : "wrong");
      [...opts.children].forEach((x) => x.classList.add("locked"));
      if (!o.correct) {
        const correctSlot = order.findIndex((oi) => qc.options[oi].correct);
        opts.children[correctSlot].classList.add("correct");
      }
      container.appendChild(el("div", "qc-why", o.why));
    });
    opts.appendChild(b);
  });

  return true;
}
