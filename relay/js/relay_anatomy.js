// =============================================================================
// relay_anatomy.js — the "how a relay works" centerpiece. Two realistic views
// side by side, one Energize toggle:
//   LEFT  : cutaway side-view (coil -> armature -> spring -> moving contact)
//   RIGHT : top-down octal view (after the AutomationDirect 750R print:
//           numbered 8 pins, A1+/A2- coil in the center, 2 poles' NO/NC)
// Self-contained: builds into the #stage <svg>, owns its own energize state.
// =============================================================================

const SVGNS = "http://www.w3.org/2000/svg";
function E(name, attrs = {}, txt) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (txt != null) e.textContent = txt;
  return e;
}

export function renderRelayAnatomy(svg) {
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  svg.setAttribute("viewBox", "0 0 940 560");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const root = E("g", { id: "ra-root" });
  svg.appendChild(root);

  // ---- shared Energize toggle ----
  const toggle = E("g", { class: "ra-toggle clickable", transform: "translate(330,18)" });
  toggle.appendChild(E("rect", { class: "ra-tg-bg", x: 0, y: 0, width: 280, height: 46, rx: 23 }));
  toggle.appendChild(E("circle", { class: "ra-tg-led", cx: 26, cy: 23, r: 8 }));
  toggle.appendChild(E("text", { class: "ra-tg-text", x: 150, y: 29, "text-anchor": "middle" }, "ENERGIZE COIL"));
  root.appendChild(toggle);

  buildCutaway(root);
  buildOctal(root);

  let energized = new URLSearchParams(location.search).get("energize") === "1";
  const apply = () => {
    root.classList.toggle("energized", energized);
    toggle.querySelector(".ra-tg-text").textContent = energized ? "COIL ENERGIZED" : "ENERGIZE COIL";
    root.querySelectorAll(".ra-octal-blade").forEach((bl) => {
      bl.setAttribute("x2", bl.getAttribute(energized ? "data-no-x" : "data-nc-x"));
      bl.setAttribute("y2", bl.getAttribute(energized ? "data-no-y" : "data-nc-y"));
    });
  };
  toggle.addEventListener("click", () => { energized = !energized; apply(); });
  apply();
}

// ---------------------------------------------------------------- cutaway
function buildCutaway(root) {
  const g = E("g", { class: "ra-cutaway" });
  root.appendChild(g);

  g.appendChild(E("text", { class: "ra-title", x: 235, y: 96, "text-anchor": "middle" }, "Inside the relay  ·  cutaway"));

  // housing (cutaway case)
  g.appendChild(E("rect", { class: "ra-case", x: 70, y: 120, width: 340, height: 380, rx: 14 }));

  // ---- coil / electromagnet (bottom center) ----
  const coil = E("g", { class: "ra-coil" });
  coil.appendChild(E("rect", { class: "ra-coil-body", x: 175, y: 360, width: 120, height: 110, rx: 6 }));
  for (let i = 0; i < 7; i++)
    coil.appendChild(E("line", { class: "ra-coil-turn", x1: 175, y1: 372 + i * 15, x2: 295, y2: 372 + i * 15 }));
  // iron core sticking up (the pole face the armature is pulled to)
  coil.appendChild(E("rect", { class: "ra-core", x: 226, y: 320, width: 18, height: 45, rx: 2 }));
  coil.appendChild(E("text", { class: "ra-part-label", x: 235, y: 530, "text-anchor": "middle" }, "COIL (electromagnet)"));
  g.appendChild(coil);

  // ---- magnetic-field arcs (only show when energized) ----
  const field = E("g", { class: "ra-field" });
  [26, 40, 54].forEach((r) => {
    field.appendChild(E("path", { class: "ra-field-arc", d: `M ${235 - r} 330 A ${r} ${r} 0 0 1 ${235 + r} 330` }));
  });
  g.appendChild(field);

  // ---- fixed contacts on the right (NC上 / NO下) ----
  // NC fixed contact (made at rest, up position)
  g.appendChild(E("line", { class: "ra-fixed nc", x1: 338, y1: 224, x2: 378, y2: 224 }));
  g.appendChild(E("text", { class: "ra-tag", x: 390, y: 228 }, "NC"));
  // NO fixed contact (made when energized, down position)
  g.appendChild(E("line", { class: "ra-fixed no", x1: 338, y1: 264, x2: 378, y2: 264 }));
  g.appendChild(E("text", { class: "ra-tag", x: 390, y: 268 }, "NO"));

  // ---- spring (pulls the armature back up) ----
  g.appendChild(E("path", { class: "ra-spring",
    d: "M 300 150 l 8 6 l -16 6 l 16 6 l -16 6 l 16 6 l -8 6" }));
  g.appendChild(E("text", { class: "ra-part-label", x: 300, y: 140, "text-anchor": "middle" }, "SPRING"));

  // ---- armature (pivots at left, free end over the core) ----
  // drawn in LOCAL coords with pivot at (0,0); positioned + rotated via CSS.
  const arm = E("g", { class: "ra-armature" });   // absolute coords; pivots at (130,250)
  arm.appendChild(E("rect", { class: "ra-arm-bar", x: 130, y: 243, width: 205, height: 14, rx: 5 }));
  arm.appendChild(E("circle", { class: "ra-pivot", cx: 130, cy: 250, r: 7 }));
  arm.appendChild(E("rect", { class: "ra-moving", x: 320, y: 240, width: 16, height: 22, rx: 3 }));
  g.appendChild(arm);
  g.appendChild(E("text", { class: "ra-part-label", x: 150, y: 240, "text-anchor": "middle" }, "ARMATURE"));
  g.appendChild(E("text", { class: "ra-part-label small", x: 235, y: 312, "text-anchor": "middle" }, "iron core"));

  // ---- coil leads + polarity ----
  g.appendChild(E("line", { class: "ra-lead", x1: 185, y1: 470, x2: 185, y2: 502 }));
  g.appendChild(E("line", { class: "ra-lead", x1: 285, y1: 470, x2: 285, y2: 502 }));
  g.appendChild(E("text", { class: "ra-term", x: 150, y: 498 }, "A1"));
  g.appendChild(E("text", { class: "ra-term plus", x: 150, y: 482 }, "+"));
  g.appendChild(E("text", { class: "ra-term", x: 322, y: 498 }, "A2"));
  g.appendChild(E("text", { class: "ra-term minus", x: 322, y: 482 }, "–"));
}

// ---------------------------------------------------------------- top-down octal
function buildOctal(root) {
  const g = E("g", { class: "ra-octal" });
  root.appendChild(g);
  const cx = 705, cy = 320, R = 150;

  g.appendChild(E("text", { class: "ra-title", x: cx, y: 96, "text-anchor": "middle" }, "Top-down  ·  8-pin octal (DPDT)"));
  g.appendChild(E("circle", { class: "ra-octal-body", cx, cy, r: R }));
  g.appendChild(E("circle", { class: "ra-octal-inner", cx, cy, r: R - 26 }));

  // 8 pins around the ring (octal layout; gap/keyway at the top)
  const pins = [
    { n: 1, a: 145 }, { n: 2, a: 180, lbl: "A1", pol: "+" }, { n: 3, a: 215 },
    { n: 4, a: 250 }, { n: 5, a: 290 }, { n: 6, a: 325 },
    { n: 7, a: 0, lbl: "A2", pol: "–" }, { n: 8, a: 35 },
  ];
  const pos = {};
  for (const p of pins) {
    const rad = (p.a * Math.PI) / 180;
    const px = cx + Math.cos(rad) * R, py = cy + Math.sin(rad) * R;
    pos[p.n] = { x: px, y: py };
    g.appendChild(E("circle", { class: "ra-pin", cx: px, cy: py, r: 13 }));
    g.appendChild(E("text", { class: "ra-pin-num", x: px, y: py + 6, "text-anchor": "middle" }, String(p.n)));
    // pin label outside the ring
    const lx = cx + Math.cos(rad) * (R + 30), ly = cy + Math.sin(rad) * (R + 30);
    if (p.lbl) g.appendChild(E("text", { class: "ra-pin-lbl", x: lx, y: ly + 6, "text-anchor": "middle" }, p.lbl));
    // polarity sign goes on the side AWAY from the pin ring so it never rides a pin circle
    if (p.pol) g.appendChild(E("text", { class: `ra-pin-lbl ${p.pol === "+" ? "plus" : "minus"}`, x: lx + (Math.cos(rad) < -0.5 ? -36 : 22), y: ly + 6 }, p.pol));
  }

  // ---- coil in the center (A1 pin2 -> coil -> A2 pin7) ----
  const coil = E("g", { class: "ra-octal-coil" });
  coil.appendChild(E("line", { class: "ra-octal-wire", x1: pos[2].x, y1: pos[2].y, x2: cx - 30, y2: cy }));
  coil.appendChild(E("line", { class: "ra-octal-wire", x1: pos[7].x, y1: pos[7].y, x2: cx + 30, y2: cy }));
  coil.appendChild(E("rect", { class: "ra-octal-coilbody", x: cx - 30, y: cy - 16, width: 60, height: 32, rx: 4 }));
  coil.appendChild(E("text", { class: "ra-octal-coiltext", x: cx, y: cy + 5, "text-anchor": "middle" }, "COIL"));
  g.appendChild(coil);

  // ---- two SPDT poles: common -> blade -> NO / NC ----
  // pole 1: common pin1, NO pin3, NC pin4 ; pole 2: common pin8, NO pin6, NC pin5
  octalPole(g, pos, 1, 4, 3, cx, cy);
  octalPole(g, pos, 8, 5, 6, cx, cy);

  // (the old "contacts + coil shown internal…" micro-note was cut for
  //  legibility — the Energize toggle + lesson text already carry it)
}

function octalPole(g, pos, commonN, ncN, noN, cx, cy) {
  const c = pos[commonN], nc = pos[ncN], no = pos[noN];
  const grp = E("g", { class: "ra-pole" });
  // leads from NC and NO pins toward the center contact zone
  const midX = (c.x + cx) / 2, midY = (c.y + cy) / 2;
  grp.appendChild(E("line", { class: "ra-octal-wire", x1: c.x, y1: c.y, x2: midX, y2: midY }));
  grp.appendChild(E("circle", { class: "ra-octal-common", cx: midX, cy: midY, r: 3 }));
  // NC contact lead (closed at rest) and NO contact lead
  grp.appendChild(E("line", { class: "ra-octal-wire nc-lead", x1: nc.x, y1: nc.y, x2: midX + (nc.x - midX) * 0.4, y2: midY + (nc.y - midY) * 0.4 }));
  grp.appendChild(E("line", { class: "ra-octal-wire no-lead", x1: no.x, y1: no.y, x2: midX + (no.x - midX) * 0.4, y2: midY + (no.y - midY) * 0.4 }));
  // moving blade: rests on NC, swings to NO when energized
  const blade = E("line", { class: "ra-octal-blade",
    x1: midX, y1: midY,
    x2: midX + (nc.x - midX) * 0.4, y2: midY + (nc.y - midY) * 0.4 });
  blade.setAttribute("data-no-x", midX + (no.x - midX) * 0.4);
  blade.setAttribute("data-no-y", midY + (no.y - midY) * 0.4);
  blade.setAttribute("data-nc-x", midX + (nc.x - midX) * 0.4);
  blade.setAttribute("data-nc-y", midY + (nc.y - midY) * 0.4);
  grp.appendChild(blade);
  g.appendChild(grp);
}
