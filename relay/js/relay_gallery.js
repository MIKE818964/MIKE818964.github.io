// =============================================================================
// relay_gallery.js — "real hardware" gallery. Actual relay photos on flip cards
// that tilt in 3D on hover and flip to reveal type / pinout / specs. Builds
// HTML into the stage overlay (the schematic SVG is hidden for this view).
// =============================================================================

import { initRelay3D } from "./relay3d.js";

const RELAYS = [
  { img: "plugin-relay.jpg", name: "Plug-in “ice-cube” relay", tag: "8 / 11 / 14-pin",
    back: ["Pulls out of a DIN-rail socket — swap in seconds.",
           "Common: DPDT 8-pin (2 coil + 6 contacts) or 3PDT/4PDT.",
           "Read the coil voltage off the case (e.g. 24VDC)."] },
  { img: "timer-relay-octal.jpg", name: "Octal time-delay relay", tag: "8-pin octal",
    back: ["Adds a delay before or after it switches.",
           "On-delay: waits, then acts. Off-delay: acts, then holds.",
           "Plugs into the same octal base as an ice-cube relay."] },
  { img: "pcb-relay-ratings.jpg", name: "PCB power relay", tag: "contact rating printed",
    back: ["Soldered onto a board inside the equipment.",
           "The case prints the contact rating — e.g. 10A 250VAC.",
           "Never load a relay past its printed rating."] },
  { img: "contactor-modern.jpg", name: "Contactor (motor starter)", tag: "3-phase + aux",
    back: ["A heavy-duty relay for motor-size loads.",
           "3 main poles carry L1/L2/L3; aux contacts for control.",
           "One coil pulls in all the poles at once."] },
  { img: "contactor-exploded.jpg", name: "Inside a contactor", tag: "exploded view",
    back: ["The same parts as the cutaway — full size.",
           "Coil (electromagnet) → armature → main contacts → spring.",
           "Energize the coil and every pole snaps closed together."] },
  { img: "contactor-din.jpg", name: "DIN-rail contactor", tag: "panel-mount",
    back: ["Snaps onto the DIN rail in the control cabinet.",
           "Control side switches the coil; power side switches the load.",
           "Small safe signal controls a big dangerous circuit."] },
];

const FAULTS = [
  { img: "fault-worn-contacts.jpg", name: "Arc-eroded contacts",
    note: "Years of arcing pit the silver contacts — the relay stops making good contact." },
  { img: "fault-burned-contactor.jpg", name: "Burned-out contactor",
    note: "Overcurrent or a stuck contact cooks it — a classic field failure." },
];

const ASSET = "assets/relays/";

export function renderRelayGallery(container) {
  container.classList.remove("hidden");
  container.classList.add("rg-wrap");
  // inline styles win over the overlay's placeholder grid-centering
  Object.assign(container.style, {
    display: "block", placeItems: "initial", overflowY: "auto", padding: "22px 24px",
    background: "#F6F8FC",
  });
  container.innerHTML = "";

  // 3D hero — the real 784-4C-24D you can grab and spin
  const hero = document.createElement("div");
  hero.className = "rg-hero";
  hero.innerHTML = `
    <div class="rg-hero-3d" id="rg-3d"><div class="r3d-loading">loading 3D model…</div></div>
    <div class="rg-hero-info">
      <span class="rg-eyebrow">Spin it — your actual part</span>
      <h3 class="rg-hero-title">784-4C-24D</h3>
      <p class="rg-hero-desc">AutomationDirect ice-cube control relay — <b>4PDT</b>, <b>14-pin</b>, 24VDC coil, 15A. The real CAD model: drag to rotate it, let go and it keeps spinning.</p>
    </div>`;
  container.appendChild(hero);

  const head = document.createElement("div");
  head.className = "rg-head";
  head.innerHTML = `<span class="rg-eyebrow">Real hardware</span>
    <p class="rg-sub">The relays you'll actually meet on the floor. Move over a card to tilt it; click to flip it and read the pinout.</p>`;
  container.appendChild(head);

  const grid = document.createElement("div");
  grid.className = "rg-grid";
  for (const r of RELAYS) grid.appendChild(card(r));
  container.appendChild(grid);

  const fh = document.createElement("div");
  fh.className = "rg-eyebrow rg-eyebrow-2";
  fh.textContent = "What failure looks like";
  container.appendChild(fh);

  const frow = document.createElement("div");
  frow.className = "rg-fault-row";
  for (const f of FAULTS) {
    const c = document.createElement("div");
    c.className = "rg-fault";
    c.innerHTML = `<img class="rg-fault-img" src="${ASSET}${f.img}" alt="${f.name}" loading="lazy">
      <div class="rg-fault-cap"><div class="rg-fault-name">${f.name}</div><div class="rg-fault-note">${f.note}</div></div>`;
    frow.appendChild(c);
  }
  container.appendChild(frow);

  setupTilt(container);

  const el3d = container.querySelector("#rg-3d");
  if (el3d) requestAnimationFrame(() => { el3d.querySelector(".r3d-loading")?.remove(); initRelay3D(el3d); });

  if (new URLSearchParams(location.search).get("flip") === "1") {
    const first = container.querySelector(".rg-inner");
    if (first) first.classList.add("flipped");   // QA: preview the back
  }
}

function card(r) {
  const card = document.createElement("div");
  card.className = "rg-card";
  const inner = document.createElement("div");
  inner.className = "rg-inner";
  inner.innerHTML = `
    <div class="rg-front">
      <img class="rg-photo" src="${ASSET}${r.img}" alt="${r.name}" loading="lazy">
      <div class="rg-cap">
        <div class="rg-name">${r.name}</div>
        <div class="rg-badge">${r.tag}</div>
      </div>
      <div class="rg-fliphint">flip ⟳</div>
    </div>
    <div class="rg-back">
      <div class="rg-back-name">${r.name}</div>
      <ul class="rg-back-list">${r.back.map((b) => `<li>${b}</li>`).join("")}</ul>
      <div class="rg-fliphint">⟲ back</div>
    </div>`;
  card.appendChild(inner);
  card.addEventListener("click", () => inner.classList.toggle("flipped"));
  return card;
}

// cursor-tracking 3D tilt on each card
function setupTilt(container) {
  container.querySelectorAll(".rg-card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateX(${(-py * 9).toFixed(2)}deg) rotateY(${(px * 11).toFixed(2)}deg) translateZ(6px)`;
    });
    card.addEventListener("pointerleave", () => { card.style.transform = ""; });
  });
}
