// =============================================================================
// landing.js — landing-page interactivity layer.
// Layers: hero signal-flow, LIVE circuit card (real solver), hover-meter,
// chattering-relay vignette, ticket cycler, parts marquee, 3D tilt + sheen,
// magnetic CTA, sticky scroll-story. All continuous anims are transform/opacity
// and pause offscreen; everything degrades under prefers-reduced-motion.
// =============================================================================

import { initRelay3D } from "./relay3d.js";
import { CircuitView } from "./renderer.js";
import { solve } from "./solver.js";
import { bindButtons } from "./interact.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ================= offscreen pause manager =================
   Sections tagged [data-pause] get .offscreen when out of view;
   CSS pauses their loops, JS tickers check the class. */
const pauser = new IntersectionObserver((es) => {
  for (const en of es) en.target.classList.toggle("offscreen", !en.isIntersecting);
}, { rootMargin: "140px" });
$$("[data-pause]").forEach((el) => pauser.observe(el));
const paused = (el) => el.closest(".offscreen") !== null;

/* ================= intro boot sequence (≤2.1s, skippable) ==================
   body.preboot (set inline pre-render) hides the hero; .booted plays the
   staged title-sequence reveal. Reduced motion / JS-off never see the veil. */
const intro = $("#intro");
function endIntro() {
  document.body.classList.remove("preboot");
  document.body.classList.add("booted");
  if (intro) { intro.classList.add("done"); setTimeout(() => intro.remove(), 750); }
}
if (reduceMotion || !intro || !document.body.classList.contains("preboot")) {
  endIntro();
} else {
  const t = setTimeout(endIntro, 2050);
  const skip = () => { clearTimeout(t); endIntro(); };
  intro.addEventListener("pointerdown", skip);
  window.addEventListener("keydown", skip, { once: true });
}

/* ================= hero 3D — cinematic scroll-driven rig ====================
   Own Three.js rig (relay3d.js stays untouched for the course): auto-rotate +
   drag like before, PLUS the camera dollies and the part pitches/yaws as you
   scroll through the opening viewport — a title-sequence camera move. */
function initCinematicRelay(container, stlPath) {
  const THREE = window.THREE;
  if (!THREE || !THREE.STLLoader) { initRelay3D(container, stlPath); return; }
  const size = () => ({ w: container.clientWidth || 360, h: container.clientHeight || 320 });
  let { w, h } = size();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 5000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xaab4c8, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);  key.position.set(3, 4, 5);   scene.add(key);
  const fil = new THREE.DirectionalLight(0xdce6fb, 0.35); fil.position.set(-4, 1, -2); scene.add(fil);
  const rim = new THREE.DirectionalLight(0x9fb6ff, 0.75); rim.position.set(-1, -2, -4); scene.add(rim);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.autoRotate = !reduceMotion; controls.autoRotateSpeed = 1.4;

  const group = new THREE.Group(); scene.add(group);
  const DIR = new THREE.Vector3(0.55, 0.4, 1).normalize();
  let radius = 0;
  function frame() {
    const s = size(); w = s.w; h = s.h;
    camera.aspect = w / h; renderer.setSize(w, h);
    if (radius) {
      const vFov = camera.fov * Math.PI / 180;
      const distH = radius / Math.sin(vFov / 2);
      const distW = radius / Math.sin(Math.atan(Math.tan(vFov / 2) * camera.aspect));
      const dist = Math.max(distH, distW) * 1.3;
      camera.near = dist / 100; camera.far = dist * 100;
      camera.position.copy(DIR).multiplyScalar(dist);
      controls.target.set(0, 0, 0);
      controls.minDistance = dist * 0.5; controls.maxDistance = dist * 2.5;
    }
    camera.updateProjectionMatrix(); controls.update();
  }
  new THREE.STLLoader().load(stlPath, (geo) => {
    geo.computeVertexNormals(); geo.center(); geo.computeBoundingSphere();
    radius = geo.boundingSphere.radius;
    const mat = new THREE.MeshStandardMaterial({ color: 0x767f90, metalness: 0.25, roughness: 0.5 });
    group.add(new THREE.Mesh(geo, mat));
    frame();
    container.classList.add("r3d-ready");
  }, undefined, (err) => {
    console.error("STL load error", err);
    container.innerHTML = '<div class="r3d-fallback">Could not load the 3D model.</div>';
  });

  // scroll progress across the opening viewport drives the camera move
  let prog = 0;
  const onScroll = () => { prog = Math.min(1, Math.max(0, window.scrollY / (innerHeight * 0.92))); };
  if (!reduceMotion) { window.addEventListener("scroll", onScroll, { passive: true }); onScroll(); }

  function animate() {
    if (!renderer.domElement.isConnected) { window.removeEventListener("resize", frame); renderer.dispose(); return; }
    // the dolly/pitch move: yaw 77°, pitch down, sink + pull back slightly
    const e = prog * prog * (3 - 2 * prog);            // smoothstep
    group.rotation.y = e * 1.35;
    group.rotation.x = e * 0.30;
    group.position.y = -e * radius * 0.55;
    const sc = 1 - e * 0.16;
    group.scale.set(sc, sc, sc);
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }
  window.addEventListener("resize", frame);
  requestAnimationFrame(() => { frame(); animate(); });
}
const hero3d = $("#hero3d");
if (hero3d) {
  initCinematicRelay(hero3d, "assets/models/750r-2c-24d.stl");
  hero3d.addEventListener("wheel", (e) => e.stopPropagation(), { capture: true, passive: true });
}

/* depth-layered hero parallax: chips + flow strip drift at different rates */
if (!reduceMotion) {
  const layers = $$("[data-depth]");
  let pRaf = 0;
  const applyDepth = () => {
    pRaf = 0;
    const y = window.scrollY;
    for (const el of layers) el.style.translate = `0px ${(y * +el.dataset.depth).toFixed(1)}px`;
  };
  if (layers.length) window.addEventListener("scroll", () => { if (!pRaf) pRaf = requestAnimationFrame(applyDepth); }, { passive: true });
}

/* ================= bento 3D (784-4C-24D) — lazy init on first sight ========= */
const bento3d = $("#bento3d");
if (bento3d) {
  const io3d = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      io3d.disconnect();
      bento3d.querySelector(".r3d-loading")?.remove();
      initRelay3D(bento3d, "assets/models/784-4c-24d.stl");
      bento3d.addEventListener("wheel", (e) => e.stopPropagation(), { capture: true, passive: true });
    }
  }, { rootMargin: "200px" });
  io3d.observe(bento3d);
}

/* ================= top bar / reveals / count-up / orbs (kept) ============== */
const topbar = $("#topbar");
const onScrollBar = () => topbar.classList.toggle("scrolled", window.scrollY > 24);
window.addEventListener("scroll", onScrollBar, { passive: true });
onScrollBar();

const io = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
}, { threshold: 0.14, rootMargin: "0px 0px -5% 0px" });
$$(".reveal").forEach((el) => io.observe(el));

function countUp(el) {
  const target = +el.dataset.count;
  if (reduceMotion) { el.textContent = target; return; }
  const dur = 1500, t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}
const statsIO = new IntersectionObserver((entries) => {
  for (const en of entries) if (en.isIntersecting) {
    en.target.querySelectorAll(".stat-num").forEach(countUp);
    statsIO.unobserve(en.target);
  }
}, { threshold: 0.4 });
statsIO.observe($("#stats"));

const orbs = $$(".orb");
let mx = 0, my = 0, orbRaf = 0;
function applyParallax() {
  orbRaf = 0;
  const y = window.scrollY;
  for (const o of orbs) {
    const f = +o.dataset.par;
    o.style.translate = `${(mx * 26 * f).toFixed(1)}px ${(y * -f + my * 22 * f).toFixed(1)}px`;
  }
}
function queueOrbs() { if (!orbRaf) orbRaf = requestAnimationFrame(applyParallax); }
if (!reduceMotion) {
  window.addEventListener("scroll", queueOrbs, { passive: true });
  window.addEventListener("pointermove", (e) => {
    mx = (e.clientX / innerWidth - 0.5) * 2;
    my = (e.clientY / innerHeight - 0.5) * 2;
    queueOrbs();
  }, { passive: true });
}

/* ================= 1 · HERO SIGNAL FLOW =====================================
   Start → CR1 → contactor → motor. Ambient beams loop; hovering/clicking a
   node energizes the chain up to it (glow + tooltip label). */
const sigflow = $("#sigflow");
if (sigflow) {
  const nodes = $$(".sf-node", sigflow);
  const segs = $$(".sf-wire, .sf-beam", sigflow);
  let stuck = 0; // click latches (0 = none)
  const setHot = (level) => {
    for (const s of segs) s.classList.toggle("hot", +s.dataset.seg <= level - 1);
    for (const n of nodes) {
      const on = +n.dataset.idx <= level;
      n.classList.toggle("hot", on);
      n.querySelector(".sf-tip").classList.toggle("show", +n.dataset.idx === level);
    }
    sigflow.classList.toggle("energized", level > 0);
  };
  for (const n of nodes) {
    const idx = +n.dataset.idx;
    n.addEventListener("pointerenter", () => setHot(idx));
    n.addEventListener("pointerleave", () => setHot(stuck));
    n.addEventListener("click", () => { stuck = (stuck === idx) ? 0 : idx; setHot(stuck || idx); });
    n.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); stuck = (stuck === idx) ? 0 : idx; setHot(stuck); }
    });
  }
}

/* ================= 2 · LIVE CIRCUIT CARD ====================================
   The actual course engine: CircuitView + solve() + bindButtons on the real
   lesson JSON. Pressing START latches the seal-in; STOP drops it. */
async function initLiveCircuit() {
  const svg = $("#live-stage");
  if (!svg) return;
  try {
    const res = await fetch("data/lessons/13_seal_in_latch.json");
    const lesson = await res.json();
    const view = new CircuitView(svg);
    view.build(lesson.circuit);
    // size: keep the sheet's aspect so height follows width
    const vb = svg.viewBox.baseVal;
    svg.style.aspectRatio = `${vb.width} / ${vb.height}`;

    const S = { pressed: new Set(), prevCoil: new Map(), cycles: 0, wasOn: false,
                probeNode: null, probePt: null };
    const stCoil = $("#st-coil"), stRun = $("#st-run"), stCyc = $("#st-cycles"), stProbe = $("#st-probe");

    function update() {
      const st = solve(lesson.circuit, { pressed: S.pressed, prevCoil: S.prevCoil });
      S.prevCoil = st.coilEnergized;
      view.applyState(st);
      const on = !!st.coilEnergized.get("CR1");
      const run = !!st.loadOn.get("RUN");
      if (on && !S.wasOn) { S.cycles++; }
      S.wasOn = on;
      stCoil.classList.toggle("on", on);
      stCoil.querySelector("b").textContent = on ? "latched" : "de-energized";
      stRun.classList.toggle("on", run);
      stRun.querySelector("b").textContent = run ? "ON" : "off";
      stCyc.querySelector("b").textContent = String(S.cycles);
      // wire-probe readout: V+ where you clicked, COM pinned on N
      if (S.probeNode) {
        const volts = st.potential.get(S.probeNode) ?? 0;
        const com = view.nodeById.get("N");
        view.setProbeMarkers(S.probePt, com ? { x: com.x, y: com.y } : null);
        stProbe.classList.add("live");
        stProbe.querySelector("b").textContent = `${volts.toFixed(1)} VDC`;
      }
    }
    bindButtons(view, {
      onPress: (id) => { S.pressed.add(id); update(); },
      onRelease: (id) => { S.pressed.delete(id); update(); },
    });
    view.onWireProbe = (nodeId, pt) => { S.probeNode = nodeId; S.probePt = pt; update(); };
    update();
  } catch (err) {
    console.warn("live circuit init failed", err);
    svg.outerHTML = `<p class="live-fallback">Live demo needs the local server — open the course instead.</p>`;
  }
}
initLiveCircuit();

/* ================= 3 · HOVER-METER CARD =====================================
   Mouse over a copper segment → the DMM slews toward that segment's potential
   (a real meter never jumps; it tracks). */
const hm = $("#hovermeter");
if (hm) {
  const val = $("#hm-val"), note = $("#hm-note");
  let target = 0, shown = 0, raf = 0, activeZone = null;
  const step = () => {
    raf = 0;
    shown += (target - shown) * 0.14;
    const jitter = (!reduceMotion && Math.abs(target - shown) < 0.4 && target > 1) ? (Math.random() - 0.5) * 0.12 : 0;
    val.textContent = Math.max(0, shown + jitter).toFixed(1);
    if (Math.abs(target - shown) > 0.04) raf = requestAnimationFrame(step);
    else { shown = target; val.textContent = target.toFixed(1); }
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  for (const z of $$(".hm-zone", hm)) {
    z.addEventListener("pointerenter", () => {
      activeZone = z;
      target = +z.dataset.volts;
      note.textContent = z.dataset.note;
      hm.classList.add("probing");
      $$(".hm-seg", hm).forEach((s) => s.classList.toggle("probed", s.dataset.zone === z.dataset.zone));
      if (reduceMotion) { shown = target; val.textContent = target.toFixed(1); } else go();
    });
    z.addEventListener("pointerleave", () => {
      if (activeZone !== z) return;
      activeZone = null; target = 0;
      note.textContent = "idle — touch a wire segment";
      hm.classList.remove("probing");
      $$(".hm-seg", hm).forEach((s) => s.classList.remove("probed"));
      if (reduceMotion) { shown = 0; val.textContent = "0.0"; } else go();
    });
  }
}

/* ================= 4 · CHATTERING RELAY vignette ============================ */
const chatCard = $("#b-chatter");
if (chatCard) {
  const cyc = $("#chat-cycles"), life = $("#chat-life"), bar = $("#chat-bar"), swaps = $("#chat-swaps");
  let cycles = 12438, pct = 87.4, replaced = 2;
  const paint = () => {
    cyc.textContent = cycles.toLocaleString("en-US");
    life.textContent = pct.toFixed(1) + "%";
    bar.style.transform = `scaleX(${(pct / 100).toFixed(3)})`;
    life.classList.toggle("crit", pct < 55);
    swaps.textContent = String(replaced);
  };
  paint();
  if (!reduceMotion) {
    setInterval(() => {
      if (paused(chatCard) || document.hidden) return;
      cycles += 2 + Math.floor(Math.random() * 3);
      pct -= 0.05 + Math.random() * 0.06;
      if (pct <= 38) { pct = 96 + Math.random() * 3; replaced++; }
      paint();
    }, 120);
  }
}

/* ================= 5 · FAULT-TICKET auto-cycling stack ====================== */
const tstack = $("#tstack");
if (tstack && !reduceMotion) {
  const cards = $$(".ticket2", tstack);
  setInterval(() => {
    if (paused(tstack) || document.hidden || tstack.matches(":hover")) return;
    const front = cards.find((c) => c.dataset.pos === "0");
    front.classList.add("leaving");
    setTimeout(() => {
      for (const c of cards) c.dataset.pos = String((+c.dataset.pos + cards.length - 1) % cards.length);
      front.classList.remove("leaving");
    }, 640);
  }, 4200);
}

/* ================= 6 · PARTS MARQUEE (two counter-scrolling rows) =========== */
const MQ_A = [
  ["relay_784_4c_24d.jpg", "784-4C-24D", "4PDT relay"],
  ["contactor_cwb25_11_30c03_front.jpg", "CWB25-11", "contactor"],
  ["timer_trm_16_face_view.jpg", "TRM-16", "timer relay"],
  ["estop_gcx1131_red_mushroom.jpg", "GCX1131", "E-stop"],
  ["pilot_ecx2052_24l_green.jpg", "ECX2052", "pilot · green"],
  ["psu_rhino_psl24-030.jpg", "PSL24-030", "24VDC PSU"],
  ["relay_750r_2c_24d.jpg", "750R-2C-24D", "DPDT relay"],
  ["fuse_hclr5_class_cc.jpg", "HCLR5", "class CC fuse"],
  ["socket_784_4c_skt.jpg", "784-4C-SKT", "14-pin socket"],
  ["overload_rw27_2d3_u004.jpg", "RW27-2D3", "overload"],
  ["selector_gcx1310_2pos_knob.jpg", "GCX1310", "selector"],
  ["contact_block_ecx1040_no.jpg", "ECX1040", "NO block"],
  ["breaker_wmzt1c10_1pole.jpg", "WMZT1C10", "breaker"],
  ["relay_ql2x1_d24.jpg", "QL2X1-D24", "slim relay"],
  ["starter_esw_b18d39a_r32_enclosed.jpg", "ESW-B18", "starter"],
  ["timer_trs_td_face_view.jpg", "TRS-TD", "timer relay"],
  ["pushbutton_gcx1102_green_flush.jpg", "GCX1102", "start PB"],
  ["dinrail_35mm_dn-r35s1.jpg", "DN-R35S1", "DIN rail"],
];
const MQ_B = [
  ["relay_750r_3c_24d.jpg", "750R-3C-24D", "3PDT relay"],
  ["contactor_gh15dn_3_01b_16a.jpg", "GH15DN", "contactor"],
  ["relay_781_1c_24d.jpg", "781-1C-24D", "SPDT relay"],
  ["contact_block_ecx1030_nc.jpg", "ECX1030", "NC block"],
  ["pilot_ecx2051_24l_red.jpg", "ECX2051", "pilot · red"],
  ["socket_70169d_8pin.jpg", "70169-D", "octal socket"],
  ["timer_trm_16_d_24ad.jpg", "TRM-16-D", "timer 24V"],
  ["relay_782_2c_24d.jpg", "782-2C-24D", "DPDT relay"],
  ["fuseholder_konnectit_kn-f10.jpg", "KN-F10", "fuse holder"],
  ["contactor_cwb65_11_30d15_front.jpg", "CWB65-11", "contactor"],
  ["relay_783_3c_24d.jpg", "783-3C-24D", "3PDT relay"],
  ["psu_rhino_psb24-060s.jpg", "PSB24-060S", "24VDC PSU"],
  ["terminal_dinnector_dn-t10a.jpg", "DN-T10A", "terminal"],
  ["selector_gcx1320_22_3pos_knob.jpg", "GCX1320", "3-pos selector"],
  ["breaker_wmzt2c20_2pole.jpg", "WMZT2C20", "2-pole breaker"],
  ["socket_sql08d_8pin.jpg", "SQL08D", "8-pin socket"],
  ["aux_contact_gh15s11.jpg", "GH15-S11", "aux contact"],
  ["pushbutton_gcx1100_black_flush.jpg", "GCX1100", "pushbutton"],
];
function buildMarquee(trackId, items) {
  const track = $(trackId);
  if (!track) return;
  // NOTE: eager, not lazy — lazy imgs inside a horizontally-masked marquee
  // never fire and scroll past as blank cards
  const html = items.map(([f, pn, kind]) =>
    `<figure class="mq-item"><img src="assets/parts/${f}" alt="${pn} ${kind}" decoding="async"/><figcaption><b>${pn}</b><span>${kind}</span></figcaption></figure>`
  ).join("");
  track.innerHTML = html + html;   // duplicate for a seamless -50% loop
}
buildMarquee("#mq-a", MQ_A);
buildMarquee("#mq-b", MQ_B);

/* ================= 7 · CURSOR-REACTIVE 3D TILT + SHEEN ====================== */
if (!reduceMotion && matchMedia("(pointer: fine)").matches) {
  for (const card of $$(".bento-card[data-tilt]")) {
    const inner = $(".b-inner", card);
    const max = +(card.dataset.tiltMax || 5);
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      inner.classList.add("tilting");
      inner.style.transform =
        `perspective(1100px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateZ(4px)`;
      inner.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
      inner.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => {
      inner.classList.remove("tilting");
      inner.style.transform = "";
    });
  }
}

/* ================= 8 · MAGNETIC CTA ========================================= */
const magBtn = $("#cta-enter");
if (magBtn && !reduceMotion && matchMedia("(pointer: fine)").matches) {
  let magRaf = 0, lastE = null;
  const apply = () => {
    magRaf = 0;
    const e = lastE; if (!e) return;
    const r = magBtn.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const range = Math.max(r.width, r.height) / 2 + 80;   // 80px reach past the edge
    if (dist < range) {
      const pull = 1 - dist / range;
      magBtn.classList.add("magnet");
      magBtn.style.transform =
        `translate(${(dx * 0.24 * pull).toFixed(1)}px, ${(dy * 0.24 * pull).toFixed(1)}px) scale(${(1 + 0.03 * pull).toFixed(3)})`;
    } else if (magBtn.classList.contains("magnet")) {
      magBtn.classList.remove("magnet");
      magBtn.style.transform = "";   // spring-back transition takes it home
    }
  };
  window.addEventListener("mousemove", (e) => { lastE = e; if (!magRaf) magRaf = requestAnimationFrame(apply); }, { passive: true });
}

/* ================= 9 · STICKY SCROLL-STORY ================================== */
const storyWrap = $("#story");
const storyPanel = $("#story-panel");
if (storyWrap && storyPanel) {
  const steps = $$(".story-step", storyPanel);
  const dots = $$(".story-dot", storyPanel);
  const fill = $("#story-fill");
  let raf = 0;
  const setStep = (s, p) => {
    if (storyPanel.dataset.step !== String(s)) {
      storyPanel.dataset.step = String(s);
      steps.forEach((el, i) => el.classList.toggle("active", i === s));
      dots.forEach((el, i) => el.classList.toggle("on", i <= s));
    }
    if (fill) fill.style.transform = `scaleY(${p.toFixed(4)})`;
  };
  const onStory = () => {
    raf = 0;
    const total = storyWrap.offsetHeight - innerHeight;
    if (total <= 0) return;
    const p = Math.min(1, Math.max(0, -storyWrap.getBoundingClientRect().top / total));
    setStep(Math.min(3, Math.floor(p * 4)), p);
  };
  window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(onStory); }, { passive: true });
  onStory();
  const jump = (i) => {
    const top = storyWrap.getBoundingClientRect().top + scrollY;
    const total = storyWrap.offsetHeight - innerHeight;
    window.scrollTo({ top: top + ((i + 0.5) / 4) * total, behavior: reduceMotion ? "auto" : "smooth" });
  };
  dots.forEach((d, i) => d.addEventListener("click", () => jump(i)));
  steps.forEach((s, i) => s.addEventListener("click", () => jump(i)));
}
