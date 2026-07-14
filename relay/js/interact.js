// =============================================================================
// interact.js — input layer. Wires press-and-hold pushbuttons and forwards
// events to main's update() chokepoint. Never touches the schematic DOM itself
// (except toggling the .pressed visual class).
// =============================================================================

// view: CircuitView. handlers: { onPress(id), onRelease(id) }.
// Binds BOTH the schematic symbol group and, when present, its real-part
// photo chip (rec.chipEl) — the big photo is a full proxy for the tiny button.
export function bindButtons(view, handlers) {
  for (const [id, rec] of view.compEls) {
    if (rec.type !== "pushbutton") continue;
    const g = rec.g;
    const chip = rec.chipEl || null;
    const targets = chip ? [g, chip] : [g];
    g.classList.add("clickable", "pushbtn");
    if (chip) chip.classList.add("clickable", "chip-pushbtn");

    let lastPointerTs = -1e9;   // real pointer activity guards the click fallback

    const press = (e) => {
      if (e && e.preventDefault) e.preventDefault();
      g.classList.add("pressed");
      if (chip) chip.classList.add("pressed");
      handlers.onPress(id);
    };
    const release = () => {
      if (!g.classList.contains("pressed")) return;
      g.classList.remove("pressed");
      if (chip) chip.classList.remove("pressed");
      handlers.onRelease(id);
    };

    for (const t of targets) {
      t.addEventListener("pointerdown", (e) => { lastPointerTs = performance.now(); press(e); });
      t.addEventListener("pointerup", () => { lastPointerTs = performance.now(); release(); });
      t.addEventListener("pointerleave", () => { lastPointerTs = performance.now(); release(); });
      t.addEventListener("pointercancel", () => { lastPointerTs = performance.now(); release(); });
      // keyboard a11y: space/enter = momentary tap
      t.setAttribute("tabindex", "0");
      t.setAttribute("role", "button");
      t.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); press(e); }
      });
      t.addEventListener("keyup", (e) => {
        if (e.key === " " || e.key === "Enter") release();
      });
      // synthetic clicks (assistive tech, dispatched events) carry no pointer
      // sequence — treat them as a short momentary tap so the button still works
      t.addEventListener("click", () => {
        if (performance.now() - lastPointerTs < 900) return;   // real pointer already handled it
        press(null);
        setTimeout(release, 450);
      });
    }
  }
}
