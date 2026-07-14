// =============================================================================
// views.js — the "realistic" (non-schematic) lesson views: real-part photo,
// exploded view, failure-photo grid, manufacturer cut sheet (PDF), real 3D
// model, and a straight-from-course-deck slide. Each renders into the stage
// overlay. The schematic, cutaway (relay_anatomy) and gallery views are wired
// in main.js; these are the media-backed ones.
// =============================================================================

import { initRelay3D } from "./relay3d.js";

const REL = "assets/relays/";
const CUT = "assets/cutsheets/";
const SLIDE = "assets/slides/";

// page-count manifest for the rasterized cut sheets (fetched once, cached)
let _manifest = null;
async function cutManifest() {
  if (_manifest) return _manifest;
  try { _manifest = await (await fetch(CUT + "manifest.json")).json(); }
  catch { _manifest = {}; }
  return _manifest;
}

// take over the overlay as a plain scrolling block
function host(overlay, pad = "0") {
  document.getElementById("stage").classList.add("hidden");
  overlay.classList.remove("hidden", "rg-wrap");
  overlay.style.cssText = `display:block; overflow-y:auto; padding:${pad};`;
  overlay.innerHTML = "";
  return overlay;
}

// single hero photo + caption + bullet callouts (real part / exploded view)
export function renderPhotoView(overlay, v) {
  const o = host(overlay);
  const pts = (v.points || []).map((p) => `<li>${p}</li>`).join("");
  o.innerHTML = `
    <div class="media-view">
      <figure class="media-figure${v.light ? " slide" : ""}">
        <img class="media-photo" src="${REL}${v.img}" alt="${esc(v.title || "")}" />
        ${v.badge ? `<figcaption class="media-badge">${esc(v.badge)}</figcaption>` : ""}
      </figure>
      <div class="media-info">
        <div class="media-eyebrow">${esc(v.eyebrow || "REAL PART · ON THE PANEL")}</div>
        <h3 class="media-title">${v.title || ""}</h3>
        ${v.caption ? `<p class="media-caption">${v.caption}</p>` : ""}
        ${pts ? `<ul class="media-points">${pts}</ul>` : ""}
      </div>
    </div>`;
}

// grid of photos with captions (e.g. "what failure looks like")
export function renderPhotoGrid(overlay, v) {
  const o = host(overlay, "22px 26px");
  const cards = (v.images || []).map((im) => `
    <figure class="pg-card">
      <img src="${REL}${im.img}" alt="${esc(im.title || "")}" />
      <figcaption><strong>${im.title || ""}</strong>${im.note ? `<span>${im.note}</span>` : ""}</figcaption>
    </figure>`).join("");
  o.innerHTML = `
    <div class="media-head">
      <div class="media-eyebrow">${esc(v.eyebrow || "REAL PARTS")}</div>
      <h3 class="media-title">${v.title || ""}</h3>
      ${v.caption ? `<p class="media-caption">${v.caption}</p>` : ""}
    </div>
    <div class="pg-grid">${cards}</div>`;
}

// manufacturer cut sheet — rasterized page images in a scrollable, zoomable
// document viewer (an embedded PDF rendered dark/tiny and was unreadable).
export async function renderCutSheet(overlay, v) {
  const o = host(overlay, "0");
  const stem = v.pdf.replace(/\.pdf$/, "");
  const n = (await cutManifest())[stem] || 1;
  const pages = Array.from({ length: n }, (_, i) =>
    `<img class="cs-page" src="${CUT}${stem}/p${i + 1}.png" alt="${esc(v.title || stem)} — page ${i + 1}" loading="lazy" draggable="false" />`
  ).join("");
  o.innerHTML = `
    <div class="cutsheet-doc">
      <div class="cutsheet-bar">
        <div>
          <div class="media-eyebrow">MANUFACTURER CUT SHEET</div>
          <h3 class="media-title">${v.title || ""}</h3>
        </div>
        <div class="cutsheet-actions">
          <span class="cs-count">${n} page${n > 1 ? "s" : ""} · click to zoom</span>
          <a class="btn btn-ghost" href="${CUT}${v.pdf}" target="_blank" rel="noopener">Open full PDF ↗</a>
        </div>
      </div>
      <div class="cutsheet-pages">${pages}</div>
    </div>`;
  o.querySelectorAll(".cs-page").forEach((img) =>
    img.addEventListener("click", () => img.classList.toggle("zoomed")));
}

// real 3D model — grab and spin
export function renderModel3D(overlay, v) {
  const o = host(overlay);
  o.innerHTML = `<div class="model3d-host"></div>
    <div class="model3d-cap">${(v && v.caption) || "Grab and spin — the real AutomationDirect 784-4C-24D CAD."}</div>`;
  const h = o.querySelector(".model3d-host");
  requestAnimationFrame(() => initRelay3D(h, (v && v.stl) || undefined));
}

// real-parts strip — family-filtered grid from the parts catalog (54 verified
// AutomationDirect product photos in assets/parts/). v = { families:[...], title, caption? }
let _catalog = null;
async function partsCatalog() {
  if (_catalog) return _catalog;
  try { _catalog = await (await fetch("data/parts_catalog.json")).json(); }
  catch { _catalog = []; }
  return _catalog;
}

export async function renderPartsStrip(overlay, v) {
  const o = host(overlay, "22px 26px");
  const cat = await partsCatalog();
  const fams = new Set(v.families || []);
  const parts = cat.filter((p) => fams.has(p.family));
  const cards = parts.map((p) => `
    <figure class="pg-card parts-card">
      <img src="assets/parts/${p.file}" alt="${esc(p.name)}" loading="lazy" />
      <figcaption><strong>${esc(p.name)}</strong><span>${esc(p.fact)}</span></figcaption>
    </figure>`).join("");
  o.innerHTML = `
    <div class="media-head">
      <div class="media-eyebrow">${esc(v.eyebrow || "REAL HARDWARE · WHAT YOU'LL ACTUALLY HANDLE")}</div>
      <h3 class="media-title">${v.title || "The real parts"}</h3>
      ${v.caption ? `<p class="media-caption">${v.caption}</p>` : ""}
    </div>
    <div class="pg-grid">${cards}</div>
    ${parts.length === 0 ? '<p class="media-caption">No parts in this family yet.</p>' : ""}`;
}

// interactive photo — clickable hotspots pinned to the REAL photograph.
// v = { img, title, caption?, eyebrow?, spots: [{ x, y (percent), label, note }] }
export function renderHotPhoto(overlay, v) {
  const o = host(overlay, "22px 26px");
  const spots = (v.spots || []).map((s, i) => `
    <button class="hp-spot" style="left:${s.x}%; top:${s.y}%" data-i="${i}" aria-label="${esc(s.label)}">
      <span class="hp-dot"></span><span class="hp-num">${i + 1}</span>
    </button>`).join("");
  const legend = (v.spots || []).map((s, i) => `
    <li class="hp-leg" data-i="${i}"><span class="hp-leg-num">${i + 1}</span>
      <div><b>${esc(s.label)}</b><span>${s.note || ""}</span></div></li>`).join("");
  o.innerHTML = `
    <div class="media-head">
      <div class="media-eyebrow">${esc(v.eyebrow || "REAL PART · CLICK THE NUMBERED POINTS")}</div>
      <h3 class="media-title">${v.title || ""}</h3>
      ${v.caption ? `<p class="media-caption">${v.caption}</p>` : ""}
    </div>
    <div class="hp-wrap">
      <div class="hp-stage"><img class="hp-img" src="${REL}${v.img}" alt="${esc(v.title || "")}" draggable="false" />${spots}</div>
      <ul class="hp-legend">${legend}</ul>
    </div>
    <div class="hp-callout hidden"></div>`;
  const callout = o.querySelector(".hp-callout");
  const select = (i) => {
    o.querySelectorAll(".hp-spot").forEach((b) => b.classList.toggle("active", +b.dataset.i === i));
    o.querySelectorAll(".hp-leg").forEach((l) => l.classList.toggle("active", +l.dataset.i === i));
    const s = v.spots[i];
    callout.classList.remove("hidden");
    callout.innerHTML = `<span class="hp-co-num">${i + 1}</span><div><b>${esc(s.label)}</b><p>${s.note || ""}</p></div>`;
  };
  o.querySelectorAll(".hp-spot, .hp-leg").forEach((el2) =>
    el2.addEventListener("click", () => select(+el2.dataset.i)));
  // QA hook: ?spot=<n> pre-selects a hotspot for headless verification
  const qa = new URLSearchParams(location.search).get("spot");
  if (qa != null && v.spots[+qa]) select(+qa);
}

// straight from the original course deck — supports one slide (v.n) or a paged set
// (v.slides = [{ n, caption }, ...]) when a lesson draws on several slides.
export function renderSlide(overlay, v) {
  const o = host(overlay);
  const set = Array.isArray(v.slides) && v.slides.length
    ? v.slides
    : [{ n: v.n, caption: v.caption }];
  let idx = 0;
  const qa = new URLSearchParams(location.search).get("deckslide");
  if (qa != null && set[+qa]) idx = +qa;

  const draw = () => {
    const s = set[idx];
    const n = String(s.n).padStart(2, "0");
    const pager = set.length > 1 ? `
      <div class="slide-pager">
        <button class="btn btn-ghost slide-prev" ${idx === 0 ? "disabled" : ""}>‹ Prev</button>
        <span class="slide-count">${idx + 1} / ${set.length}</span>
        <button class="btn btn-ghost slide-next" ${idx === set.length - 1 ? "disabled" : ""}>Next ›</button>
      </div>` : "";
    o.innerHTML = `
      <div class="media-view">
        <figure class="media-figure slide">
          <img class="media-photo" src="${SLIDE}slide${n}.png" alt="The slide ${s.n}" />
        </figure>
        <div class="media-info">
          <div class="media-eyebrow">FROM THE ORIGINAL COURSE DECK · SLIDE ${s.n} OF 22</div>
          <h3 class="media-title">${v.title || "Straight from the original course"}</h3>
          ${s.caption ? `<p class="media-caption">${s.caption}</p>` : ""}
          ${pager}
        </div>
      </div>`;
    const prev = o.querySelector(".slide-prev"), next = o.querySelector(".slide-next");
    if (prev) prev.addEventListener("click", () => { idx = Math.max(0, idx - 1); draw(); });
    if (next) next.addEventListener("click", () => { idx = Math.min(set.length - 1, idx + 1); draw(); });
  };
  draw();
}

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
