// =============================================================================
// m26_voltage_drop.js — "Voltage Is a Liar: The Voltage-Drop-Under-Load Trap"
// Attached as an extra view on m26 (multimeter safety / live measurement).
//
// THE LESSON (Gemini's #1 green-tech gap): a meter across an OPEN circuit (no
// current flowing) reads clean full supply voltage even with a badly corroded
// or loose connection in the path — because with zero current, V=I*R gives
// zero drop no matter how bad R is. Only once the load actually DRAWS current
// does that same connection reveal itself: I*R_fault steals real volts from
// the coil. This is why "I read 24V, it must be fine" is the rookie mistake —
// you must measure UNDER LOAD, never trust an open-circuit reading alone.
//
// Self-contained ES module. Every class is prefixed `m26vd-`.
// =============================================================================

export function render(host) {
  const SLUG = "m26vd";
  const SVGNS = "http://www.w3.org/2000/svg";
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const S = (tag, attrs = {}, txt) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (txt != null) n.textContent = txt;
    return n;
  };

  const style = document.createElement("style");
  style.textContent = `
  .${SLUG}-root { padding: 24px 28px; font-family: var(--font-body, 'Inter', sans-serif); color: var(--text, #303749); }
  .${SLUG}-eyebrow { font-family: var(--font-mono, monospace); font-size: 11px; letter-spacing: .18em; text-transform: uppercase; color: var(--blue-deep, #2563EB); font-weight: 700; }
  .${SLUG}-title { font-size: 22px; font-weight: 800; color: var(--ink, #0E1326); margin: 6px 0 8px; }
  .${SLUG}-sub { font-size: 14px; line-height: 1.6; color: var(--text, #303749); max-width: 760px; margin: 0 0 20px; }
  .${SLUG}-sub b { color: var(--blue-deep, #2563EB); }

  .${SLUG}-stage { background: var(--surface, #fff); border: 1px solid var(--border, #E6EAF3); border-radius: 16px; box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,.05)); padding: 20px 24px; margin-bottom: 18px; }
  .${SLUG}-circuit { width: 100%; height: auto; display: block; margin-bottom: 8px; }
  .${SLUG}-wire { stroke: #6B7689; stroke-width: 3; fill: none; }
  .${SLUG}-wire.live { stroke: #EF4444; filter: drop-shadow(0 0 3px rgba(239,68,68,.5)); }
  .${SLUG}-wire.dead { stroke: #C7CEDA; }
  .${SLUG}-src-body { fill: #EAF1FE; stroke: #2563EB; stroke-width: 2; }
  .${SLUG}-src-text { fill: var(--ink, #0E1326); font-size: 12px; font-weight: 700; font-family: var(--font-mono, monospace); }
  .${SLUG}-coil-body { fill: #fff; stroke: #475569; stroke-width: 2; }
  .${SLUG}-coil-body.starved { stroke: #DC2626; fill: #FEF2F2; }
  .${SLUG}-coil-body.healthy { stroke: #10B981; fill: #ECFDF5; }
  .${SLUG}-coil-text { fill: var(--ink, #0E1326); font-size: 11px; font-weight: 700; text-anchor: middle; }
  .${SLUG}-fault-body { stroke-width: 2; transition: fill .25s ease, stroke .25s ease; }
  .${SLUG}-fault-label { font-size: 12px; font-weight: 700; text-anchor: middle; fill: var(--muted, #6B7488); }
  .${SLUG}-probe { fill: none; stroke: #7C5CFF; stroke-width: 2; stroke-dasharray: 4 3; }
  .${SLUG}-probe-tip { fill: #7C5CFF; }

  .${SLUG}-controls { display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap; margin-top: 16px; }
  .${SLUG}-toggle-row { display: flex; gap: 8px; }
  .${SLUG}-toggle { padding: 10px 16px; border-radius: 10px; font-size: 13px; font-weight: 700; border: 1.5px solid var(--border, #E6EAF3); background: #fff; color: var(--muted, #6B7488); cursor: pointer; transition: all .15s ease; }
  .${SLUG}-toggle.active { cursor: default; border-color: var(--blue, #3B82F6); background: var(--blue-soft, #EAF1FE); color: var(--blue-deep, #2563EB); }
  .${SLUG}-slider-wrap { flex: 1; min-width: 240px; }
  .${SLUG}-slider-lab { font-size: 12.5px; font-weight: 700; color: var(--ink, #0E1326); margin-bottom: 6px; display: block; }
  .${SLUG}-slider-lab span { font-family: var(--font-mono, monospace); color: var(--blue-deep, #2563EB); }
  .${SLUG}-range { width: 100%; accent-color: #7C5CFF; }

  .${SLUG}-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-top: 20px; }
  .${SLUG}-card { border-radius: 12px; padding: 14px 16px; border: 1.5px solid var(--border, #E6EAF3); background: var(--bg, #F6F8FC); }
  .${SLUG}-card-lab { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted, #6B7488); margin-bottom: 6px; }
  .${SLUG}-card-val { font-family: var(--font-mono, monospace); font-size: 24px; font-weight: 700; color: var(--ink, #0E1326); }
  .${SLUG}-card-note { font-size: 11.5px; color: var(--muted, #6B7488); margin-top: 4px; line-height: 1.4; }
  .${SLUG}-card.trap { border-color: #F59E0B; background: #FFFBEB; }
  .${SLUG}-card.trap .${SLUG}-card-val { color: #B45309; }
  .${SLUG}-card.good { border-color: #10B981; background: #ECFDF5; }
  .${SLUG}-card.good .${SLUG}-card-val { color: #047857; }
  .${SLUG}-card.bad { border-color: #EF4444; background: #FEF2F2; }
  .${SLUG}-card.bad .${SLUG}-card-val { color: #B91C1C; }

  .${SLUG}-verdict { margin-top: 16px; padding: 14px 16px; border-radius: 12px; font-size: 13.5px; line-height: 1.55; }
  .${SLUG}-verdict.ok { background: #ECFDF5; border: 1px solid #A7F3D0; color: #065F46; }
  .${SLUG}-verdict.warn { background: #FEF2F2; border: 1px solid #FCA5A5; color: #7F1D1D; }
  .${SLUG}-verdict b { font-weight: 800; }
  `;
  host.appendChild(style);

  const root = el("div", `${SLUG}-root`);
  host.appendChild(root);

  root.appendChild(el("div", `${SLUG}-eyebrow`, "THE ROOKIE TRAP"));
  root.appendChild(el("div", `${SLUG}-title`, "Voltage Is a Liar: Read It OPEN, and It'll Fool You"));
  const sub = el("p", `${SLUG}-sub`);
  sub.innerHTML = "A meter across an <b>open</b> point reads clean supply voltage no matter how bad the connection is — zero current means zero drop, even through a badly corroded terminal. The lie only breaks the moment the load actually <b>draws current</b>. Drag the corrosion slider, then flip between the two tests below.";
  root.appendChild(sub);

  const stage = el("div", `${SLUG}-stage`);
  root.appendChild(stage);

  // ---- circuit SVG ----
  const svg = S("svg", { class: `${SLUG}-circuit`, viewBox: "0 0 720 200", "aria-label": "24VDC supply through a corroded connection to a relay coil" });
  stage.appendChild(svg);

  const wireA = S("path", { class: `${SLUG}-wire`, d: "M 90 100 L 260 100" });
  const wireB = S("path", { class: `${SLUG}-wire`, d: "M 340 100 L 480 100" });
  const wireRet = S("path", { class: `${SLUG}-wire`, d: "M 90 100 L 90 160 L 620 160 L 620 100 L 560 100" });
  svg.appendChild(wireRet); svg.appendChild(wireA); svg.appendChild(wireB);

  // source
  svg.appendChild(S("rect", { class: `${SLUG}-src-body`, x: 30, y: 76, width: 60, height: 48, rx: 8 }));
  svg.appendChild(S("text", { class: `${SLUG}-src-text`, x: 60, y: 104, "text-anchor": "middle" }, "24VDC"));

  // fault / connection (screw terminal glyph)
  const faultBody = S("rect", { class: `${SLUG}-fault-body`, x: 260, y: 84, width: 80, height: 32, rx: 6 });
  svg.appendChild(faultBody);
  svg.appendChild(S("circle", { cx: 280, cy: 100, r: 4, fill: "#475569" }));
  svg.appendChild(S("circle", { cx: 320, cy: 100, r: 4, fill: "#475569" }));
  const faultLabel = S("text", { class: `${SLUG}-fault-label`, x: 300, y: 132 }, "");
  svg.appendChild(faultLabel);
  svg.appendChild(S("text", { class: `${SLUG}-fault-label`, x: 300, y: 68 }, "SUSPECT TERMINAL"));

  // coil
  const coilBody = S("rect", { class: `${SLUG}-coil-body`, x: 480, y: 76, width: 80, height: 48, rx: 8 });
  svg.appendChild(coilBody);
  svg.appendChild(S("text", { class: `${SLUG}-coil-text`, x: 520, y: 96 }, "CR1 COIL"));
  const coilVText = S("text", { class: `${SLUG}-coil-text`, x: 520, y: 112, fill: "#6B7488" }, "240Ω rated");
  svg.appendChild(coilVText);

  // meter probes (shown at either the open test point or across the coil, per mode)
  const probeOpen = S("g", { class: `${SLUG}-probe-g` });
  probeOpen.appendChild(S("path", { class: `${SLUG}-probe`, d: "M 175 100 L 175 40" }));
  probeOpen.appendChild(S("circle", { class: `${SLUG}-probe-tip`, cx: 175, cy: 40, r: 4 }));
  probeOpen.appendChild(S("text", { x: 175, y: 28, "text-anchor": "middle", class: `${SLUG}-fault-label`, fill: "#7C5CFF" }, "TEST A"));
  svg.appendChild(probeOpen);

  const probeLoad = S("g", { class: `${SLUG}-probe-g` });
  probeLoad.appendChild(S("path", { class: `${SLUG}-probe`, d: "M 520 76 L 520 30" }));
  probeLoad.appendChild(S("circle", { class: `${SLUG}-probe-tip`, cx: 520, cy: 30, r: 4 }));
  probeLoad.appendChild(S("text", { x: 520, y: 18, "text-anchor": "middle", class: `${SLUG}-fault-label`, fill: "#7C5CFF" }, "TEST B"));
  svg.appendChild(probeLoad);

  // ---- controls ----
  const controls = el("div", `${SLUG}-controls`);
  stage.appendChild(controls);

  const toggleRow = el("div", `${SLUG}-toggle-row`);
  const btnOpen = el("button", `${SLUG}-toggle`, "🔌 TEST A — Load disconnected (open)");
  const btnLoad = el("button", `${SLUG}-toggle`, "⚡ TEST B — Load connected & energized");
  toggleRow.appendChild(btnOpen); toggleRow.appendChild(btnLoad);
  controls.appendChild(toggleRow);

  const sliderWrap = el("div", `${SLUG}-slider-wrap`);
  const sliderLab = el("label", `${SLUG}-slider-lab`);
  sliderWrap.appendChild(sliderLab);
  const range = el("input", `${SLUG}-range`);
  range.type = "range"; range.min = "0"; range.max = "60"; range.step = "1"; range.value = "2";
  sliderWrap.appendChild(range);
  controls.appendChild(sliderWrap);

  // ---- readout cards ----
  const cards = el("div", `${SLUG}-cards`);
  root.appendChild(cards);
  const cardOpen = el("div", `${SLUG}-card`);
  const cardCoil = el("div", `${SLUG}-card`);
  const cardDrop = el("div", `${SLUG}-card`);
  cards.appendChild(cardOpen); cards.appendChild(cardCoil); cards.appendChild(cardDrop);

  const verdict = el("div", `${SLUG}-verdict`);
  root.appendChild(verdict);

  // ---- physics + state ----
  const R_COIL = 240;      // ohms, a typical 24VDC relay coil (~0.1A sealed)
  const V_SRC = 24;
  let mode = "open";       // "open" | "load"

  function compute() {
    const rFault = +range.value;
    const iLoad = V_SRC / (rFault + R_COIL);     // amps, when the load path IS complete
    const vCoilUnderLoad = iLoad * R_COIL;
    const vDropUnderLoad = iLoad * rFault;
    return { rFault, iLoad, vCoilUnderLoad, vDropUnderLoad };
  }

  function faultColor(r) {
    if (r < 5) return "#10B981";
    if (r < 20) return "#F59E0B";
    return "#EF4444";
  }

  function render_() {
    const { rFault, iLoad, vCoilUnderLoad, vDropUnderLoad } = compute();
    sliderLab.innerHTML = `Connection resistance (corrosion / loose screw) — <span>${rFault} Ω</span>`;
    faultBody.style.fill = mode === "load" ? faultColor(rFault) + "22" : "#F1F5F9";
    faultBody.style.stroke = mode === "load" ? faultColor(rFault) : "#94A3B8";
    faultLabel.textContent = rFault === 0 ? "clean" : rFault < 5 ? "slightly loose" : rFault < 20 ? "corroded" : "badly corroded";

    btnOpen.classList.toggle("active", mode === "open");
    btnLoad.classList.toggle("active", mode === "load");
    probeOpen.style.display = mode === "open" ? "" : "none";
    probeLoad.style.display = mode === "load" ? "" : "none";

    [wireA, wireB, wireRet].forEach((w) => {
      w.classList.toggle("live", mode === "load");
      w.classList.toggle("dead", mode === "open");
    });

    const healthy = vCoilUnderLoad >= V_SRC * 0.85;   // 85% rule, matches m01/relay field notes
    coilBody.classList.toggle("healthy", mode === "load" && healthy);
    coilBody.classList.toggle("starved", mode === "load" && !healthy);

    // TEST A: open-circuit reading — ALWAYS full supply voltage, no matter rFault.
    // This is the lie: zero current flowing means zero I*R drop, so the meter
    // reports a perfectly clean 24.0V even through a badly corroded connection.
    cardOpen.className = `${SLUG}-card` + (mode === "open" ? " trap" : "");
    cardOpen.innerHTML = `<div class="${SLUG}-card-lab">Test A · Open-circuit reading</div>
      <div class="${SLUG}-card-val">24.0 V</div>
      <div class="${SLUG}-card-note">Reads clean every time — no current flowing, so no I×R drop shows up. This is the trap.</div>`;

    cardCoil.className = `${SLUG}-card` + (mode === "load" ? (healthy ? " good" : " bad") : "");
    cardCoil.innerHTML = `<div class="${SLUG}-card-lab">Test B · Voltage AT the coil (under load)</div>
      <div class="${SLUG}-card-val">${mode === "load" ? vCoilUnderLoad.toFixed(1) : "—"} V</div>
      <div class="${SLUG}-card-note">${mode === "load" ? (healthy ? "Above the 85% floor (20.4V) — coil pulls in reliably." : "Below the 85% floor (20.4V) — coil may chatter or fail to pull in.") : "Connect the load (Test B) to see the real number."}</div>`;

    cardDrop.className = `${SLUG}-card` + (mode === "load" && rFault >= 20 ? " trap" : "");
    cardDrop.innerHTML = `<div class="${SLUG}-card-lab">Drop across the suspect terminal</div>
      <div class="${SLUG}-card-val">${mode === "load" ? vDropUnderLoad.toFixed(1) : "0.0"} V</div>
      <div class="${SLUG}-card-note">${mode === "load" ? `I = ${(iLoad*1000).toFixed(0)} mA through ${rFault}Ω = ${vDropUnderLoad.toFixed(1)}V lost right here.` : "No current flowing — nothing to drop yet."}</div>`;

    if (mode === "open") {
      verdict.className = `${SLUG}-verdict warn`;
      verdict.innerHTML = `<b>This is exactly how a bad connection hides.</b> You just read a perfect 24.0V with the load disconnected — but that connection has ${rFault}Ω of hidden resistance sitting in the path. Flip to <b>Test B</b> to see what happens the instant real current has to flow through it.`;
    } else if (healthy) {
      verdict.className = `${SLUG}-verdict ok`;
      verdict.innerHTML = `<b>Under load, the coil sees ${vCoilUnderLoad.toFixed(1)}V</b> — healthy. At ${rFault}Ω this connection isn't costing you enough to matter yet. Drag the slider up and watch it change.`;
    } else {
      verdict.className = `${SLUG}-verdict warn`;
      verdict.innerHTML = `<b>Caught it.</b> Under real load, ${(iLoad*1000).toFixed(0)}mA flowing through ${rFault}Ω of corrosion steals ${vDropUnderLoad.toFixed(1)}V — leaving the coil starved at ${vCoilUnderLoad.toFixed(1)}V. Rule one: never trust an open-circuit reading. Always measure with the load actually pulling current.`;
    }
  }

  btnOpen.addEventListener("click", () => { mode = "open"; render_(); });
  btnLoad.addEventListener("click", () => { mode = "load"; render_(); });
  range.addEventListener("input", render_);

  // QA hook (mirrors ?energize=1 elsewhere): ?vdload=<ohms> jumps straight to
  // Test B at a given resistance, for headless verification of the physics.
  const qaR = new URLSearchParams(location.search).get("vdload");
  if (qaR != null) { mode = "load"; range.value = qaR; }

  render_();
}
