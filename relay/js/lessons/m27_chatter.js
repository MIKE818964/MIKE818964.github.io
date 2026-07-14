// =============================================================================
// m27_chatter.js — "Chattering Relay" interactive (m27 · common real faults).
//
// THE LESSON: a 24VDC coil needs ~85% of nominal (20.4V) to pull in and SEAL.
// Feed it less and it doesn't just quit — in a narrow band (~17–20.4V here)
// it CHATTERS: the magnet grabs, the marginal voltage can't hold the armature
// against the return spring, it drops, the gap closes the magnetic circuit
// math again, it re-pulls… 10–60 times a second. Every re-make slams the
// load's inrush (6–10× run current for motor/solenoid loads) through the
// contacts and every break draws an arc — a relay rated 100,000 operations
// can burn its whole electrical life in under an hour of this.
//
// One coil-voltage slider (10–28V), a live side-cutaway relay that visibly
// buzzes in the chatter band, spiking current + cumulative contact-damage
// readouts, a coach bar, causes + "why it kills relays" cards.
//
// Engineering notes (m21 patterns):
//   - Chatter timing runs on WALL-clock dt inside a rAF loop; a watchdog
//     interval keeps the sim stepping when rAF is throttled (hidden tab /
//     Energy Saver), and both self-clean once the view leaves the DOM.
//   - QA hook: ?chatter=<volts> jumps the slider for headless verification.
//   - Armature exposes data-pulled (toggles every half-cycle) and the root
//     exposes data-state = pulled|chatter|dropout for test assertions.
//
// Self-contained ES module. Every CSS class prefixed `m27ch-`. No imports.
// =============================================================================

export function render(host) {
  const SVGNS = "http://www.w3.org/2000/svg";
  const E = (n, a = {}, txt) => {
    const e = document.createElementNS(SVGNS, n);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, v);
    if (txt != null) e.textContent = txt;
    return e;
  };

  // ---------------------------------------------------------------- style
  const style = document.createElement("style");
  style.textContent = `
  .m27ch-root{
    position:absolute; inset:0; display:flex; flex-direction:column;
    font-family:var(--font-display,"Inter",system-ui,sans-serif);
    color:var(--text,#303749);
    background:
      radial-gradient(1000px 440px at 88% -8%, rgba(239,68,68,.06), transparent 60%),
      radial-gradient(900px 420px at 4% 110%, rgba(59,130,246,.08), transparent 60%),
      var(--bg,#F6F8FC);
    overflow:auto;
    container-type:inline-size;
  }
  .m27ch-head{ padding:18px 24px 8px; flex:0 0 auto; }
  .m27ch-kicker{
    font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; letter-spacing:.2em; text-transform:uppercase;
    color:var(--blue-deep,#2563EB); display:flex; align-items:center; gap:9px;
  }
  .m27ch-kicker::before{ content:""; width:26px; height:2px; border-radius:2px;
    background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF)); }
  .m27ch-title{
    margin:6px 0 2px; font-weight:800; font-size:22px; letter-spacing:-.02em;
    line-height:1.1; color:var(--ink,#0E1326);
  }
  .m27ch-sub{ font-size:12.5px; color:var(--muted,#6B7488); max-width:720px; line-height:1.45; }
  .m27ch-sub b{ color:var(--ink,#0E1326); }

  .m27ch-body{ flex:1 1 auto; display:flex; gap:14px; padding:6px 24px 16px; min-height:0; }

  /* ===================== LEFT: cutaway + slider ===================== */
  .m27ch-leftcol{ flex:0 0 330px; display:flex; flex-direction:column; gap:10px; min-height:0; }
  .m27ch-facecard{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow,0 6px 28px -8px rgba(16,19,38,.12));
    padding:8px 8px 4px; flex:0 0 auto;
  }
  .m27ch-svgwrap{ max-width:330px; margin:0 auto; }
  .m27ch-svgwrap svg{ width:100%; height:auto; display:block; overflow:visible; }
  .m27ch-facelabel{
    font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.04em;
    text-transform:uppercase; color:var(--muted,#6B7488); text-align:center; padding:2px 0 4px;
  }

  .m27ch-ctrl{
    background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:16px; box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.04));
    padding:12px 14px 10px; flex:0 0 auto;
  }
  .m27ch-slidehead{ display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; }
  .m27ch-slidehead-l{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.04em;
    text-transform:uppercase; color:var(--muted,#6B7488); }
  .m27ch-slidehead-v{ font-family:var(--font-mono,monospace); font-size:16px; font-weight:800;
    color:var(--blue-deep,#2563EB); font-variant-numeric:tabular-nums; }
  .m27ch-slider{
    -webkit-appearance:none; appearance:none; width:100%; height:8px; border-radius:5px;
    outline:none; cursor:pointer;
    /* zone bands: 10-17 dropout (red) · 17-20.4 chatter (amber) · 20.4-28 healthy (green) */
    background:linear-gradient(90deg,
      #F87171 0%, #F87171 38.9%,
      #F59E0B 38.9%, #F59E0B 57.8%,
      #34D399 57.8%, #34D399 100%);
  }
  .m27ch-slider::-webkit-slider-thumb{
    -webkit-appearance:none; appearance:none; width:20px; height:20px; border-radius:50%;
    background:#fff; border:3px solid var(--ink,#0E1326); box-shadow:0 2px 8px rgba(20,30,60,.3); cursor:grab;
  }
  .m27ch-slider::-moz-range-thumb{
    width:20px; height:20px; border-radius:50%; background:#fff; border:3px solid var(--ink,#0E1326);
    box-shadow:0 2px 8px rgba(20,30,60,.3); cursor:grab;
  }
  .m27ch-scale{ position:relative; height:34px; margin-top:4px;
    font-family:var(--font-mono,monospace); font-size:11px; color:var(--muted,#6B7488); }
  .m27ch-scale span{ position:absolute; top:0; transform:translateX(-50%); white-space:nowrap; }
  .m27ch-scale .m27ch-row2{ top:17px; }   /* staggered rows so labels never collide */
  .m27ch-scale .m27ch-tick-drop{ color:#B91C1C; font-weight:700; }
  .m27ch-scale .m27ch-tick-pull{ color:#047857; font-weight:700; }
  .m27ch-zonenote{ margin-top:6px; font-size:11.5px; line-height:1.4; color:var(--muted,#6B7488);
    border-top:1px dashed var(--border,#E6EAF3); padding-top:7px; }
  .m27ch-zonenote b{ color:var(--ink,#0E1326); }

  /* ===================== RIGHT: coach + readouts + facts ===================== */
  .m27ch-rightcol{ flex:1 1 auto; display:flex; flex-direction:column; gap:10px; min-width:0; min-height:0; }

  .m27ch-coach{
    display:flex; align-items:center; gap:10px; flex:0 0 auto;
    padding:10px 13px; border-radius:12px;
    background:linear-gradient(135deg, rgba(124,92,255,.16), rgba(59,130,246,.10));
    border:1.5px solid var(--violet,#7C5CFF);
    box-shadow:0 4px 16px rgba(124,92,255,.22);
    transition:border-color .25s ease, background .25s ease;
  }
  .m27ch-root[data-state="chatter"] .m27ch-coach{
    border-color:#EF4444;
    background:linear-gradient(135deg, rgba(239,68,68,.14), rgba(245,158,11,.10));
    box-shadow:0 4px 16px rgba(239,68,68,.22);
  }
  .m27ch-coach-k{
    flex:0 0 auto; font-family:var(--font-mono,"JetBrains Mono",monospace);
    font-size:11px; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    color:#fff; background:var(--grad,linear-gradient(135deg,#3B82F6,#7C5CFF));
    padding:4px 10px; border-radius:999px; white-space:nowrap;
  }
  .m27ch-root[data-state="chatter"] .m27ch-coach-k{ background:linear-gradient(135deg,#EF4444,#F59E0B); }
  .m27ch-coach-t{ font-size:13px; font-weight:600; line-height:1.4; color:var(--text,#303749); }
  .m27ch-coach-t b{ color:var(--ink,#0E1326); font-weight:800; }

  .m27ch-reads{ display:flex; gap:10px; flex:0 0 auto; }
  .m27ch-read{
    flex:1 1 0; min-width:0; background:var(--surface,#fff); border:1.5px solid var(--border,#E6EAF3);
    border-radius:13px; padding:10px 12px; box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.04));
    transition:border-color .25s ease, background .25s ease;
  }
  .m27ch-read-k{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.05em;
    text-transform:uppercase; color:var(--muted,#6B7488); margin-bottom:4px; }
  .m27ch-read-v{ font-family:var(--font-mono,monospace); font-size:23px; font-weight:800;
    color:var(--ink,#0E1326); font-variant-numeric:tabular-nums; line-height:1.1; }
  .m27ch-read-v small{ font-size:12px; font-weight:700; color:var(--muted,#6B7488); }
  .m27ch-read-n{ font-size:11.5px; color:var(--muted,#6B7488); margin-top:4px; line-height:1.35; }
  .m27ch-read.good{ border-color:#10B981; background:#ECFDF5; }
  .m27ch-read.good .m27ch-read-v{ color:#047857; }
  .m27ch-read.warn{ border-color:#F59E0B; background:#FFFBEB; }
  .m27ch-read.warn .m27ch-read-v{ color:#B45309; }
  .m27ch-read.bad{ border-color:#EF4444; background:#FEF2F2; }
  .m27ch-read.bad .m27ch-read-v{ color:#B91C1C; }

  .m27ch-pill{
    display:inline-block; margin-top:5px; padding:2.5px 9px; border-radius:999px;
    font-family:var(--font-mono,monospace); font-size:11px; font-weight:700; letter-spacing:.06em;
  }
  .m27ch-pill.good{ background:#D1FAE5; color:#065F46; }
  .m27ch-pill.warn{ background:#FEF3C7; color:#92400E; }
  .m27ch-pill.bad{ background:#FEE2E2; color:#991B1B; }

  .m27ch-dmgbar{ height:9px; border-radius:5px; background:#EEF1F7; margin-top:6px; overflow:hidden; }
  .m27ch-dmgfill{ height:100%; width:0%; border-radius:5px; background:#34D399; transition:background .3s ease; }
  .m27ch-newrelay{
    margin-top:7px; border:1.5px solid var(--border-strong,#D6DDEC); background:var(--surface-2,#FBFCFE);
    color:var(--ink,#0E1326); font-family:var(--font-display,sans-serif); font-size:11.5px; font-weight:700;
    padding:5px 10px; border-radius:9px; cursor:pointer; transition:all .15s ease;
  }
  .m27ch-newrelay:hover{ border-color:var(--blue,#3B82F6); background:var(--blue-soft,#EAF1FE); }
  .m27ch-read.flash{ box-shadow:0 0 0 3px rgba(59,130,246,.28); }

  .m27ch-facts{ display:flex; gap:10px; flex:1 0 auto; align-items:stretch; }
  .m27ch-fact{
    flex:1 1 0; min-width:0; background:var(--surface,#fff); border:1px solid var(--border,#E6EAF3);
    border-radius:13px; padding:11px 13px; box-shadow:var(--shadow-sm,0 1px 2px rgba(16,19,38,.04));
  }
  .m27ch-fact-k{ font-family:var(--font-mono,monospace); font-size:11px; letter-spacing:.06em;
    text-transform:uppercase; color:var(--muted,#6B7488); margin-bottom:6px; font-weight:700; }
  .m27ch-fact ul{ margin:0; padding:0 0 0 16px; }
  .m27ch-fact li{ font-size:12px; line-height:1.45; color:var(--text,#303749); margin-bottom:6px; }
  .m27ch-fact li b{ color:var(--ink,#0E1326); }
  .m27ch-fact a{ color:var(--blue-deep,#2563EB); font-weight:700; text-decoration:none; border-bottom:1px dashed var(--blue,#3B82F6); }
  .m27ch-fact a:hover{ color:var(--violet-deep,#6D28D9); border-bottom-style:solid; }
  .m27ch-fact-foot{ font-size:11.5px; color:var(--muted,#6B7488); border-top:1px dashed var(--border,#E6EAF3);
    padding-top:6px; margin-top:2px; line-height:1.4; }
  .m27ch-fact-foot b{ color:var(--ink,#0E1326); }

  /* ===================== SVG cutaway pieces =====================
     viewBox is 360 wide, rendered at ~300-314px inside the 330px card
     (≈0.85x) — all SVG text is 14px+ so the EFFECTIVE size stays ≥ ~11.9px. */
  .m27ch-cut text{ font-family:var(--font-mono,"JetBrains Mono",monospace); }
  .m27ch-case{ fill:#FBFCFE; stroke:#B7C0D0; stroke-width:2; stroke-dasharray:7 5; }
  .m27ch-lab{ fill:var(--muted,#6B7488); font-size:14px; font-weight:600; letter-spacing:.04em; }
  .m27ch-tag{ font-size:15px; font-weight:700; fill:#64748B; }  /* neutral — the contact LINES carry the live color */
  .m27ch-vbadge-v{ fill:var(--ink,#0E1326); font-size:21px; font-weight:800; font-variant-numeric:tabular-nums; }
  .m27ch-vbadge-l{ fill:var(--muted,#6B7488); font-size:12.5px; font-weight:600; letter-spacing:.05em; }
  .m27ch-coilbody{ fill:#EEF1F7; stroke:#64748B; stroke-width:1.8; transition:all .2s ease; }
  .m27ch-coilturn{ stroke:#94A3B8; stroke-width:2; transition:stroke .2s ease; }
  .m27ch-core{ fill:#C4CBD8; stroke:#64748B; stroke-width:1.4; transition:all .2s ease; }
  .m27ch-coiltextbg{ fill:#EEF1F7; }
  .m27ch-coiltext{ fill:var(--muted,#6B7488); font-size:14px; font-weight:800; letter-spacing:.08em; transition:fill .2s ease; }
  .m27ch-root[data-coil="on"] .m27ch-coilbody{ stroke:var(--violet,#7C5CFF); fill:#F3EFFF; filter:drop-shadow(0 0 10px rgba(124,92,255,.55)); }
  .m27ch-root[data-coil="on"] .m27ch-coilturn{ stroke:var(--violet,#7C5CFF); }
  .m27ch-root[data-coil="on"] .m27ch-core{ fill:#C9B6FF; stroke:var(--violet-deep,#6D28D9); }
  .m27ch-root[data-coil="on"] .m27ch-coiltextbg{ fill:#F3EFFF; }
  .m27ch-root[data-coil="on"] .m27ch-coiltext{ fill:var(--violet-deep,#6D28D9); }
  .m27ch-field{ opacity:0; transition:opacity .2s ease; }
  .m27ch-root[data-coil="on"] .m27ch-field{ opacity:1; }
  .m27ch-fieldarc{ fill:none; stroke:var(--violet,#7C5CFF); stroke-width:1.6; stroke-linecap:round; opacity:.5; }
  .m27ch-arm{
    transform-box:view-box; transform-origin:70px 132px;
    transition:transform .2s cubic-bezier(.3,1.4,.4,1);
  }
  .m27ch-root[data-state="chatter"] .m27ch-arm{ transition:none; }  /* JS drives the buzz directly */
  .m27ch-armbar{ fill:#DDE3EE; stroke:#5B6678; stroke-width:1.6; }
  .m27ch-pivot{ fill:#5B6678; }
  .m27ch-moving{ fill:#B7C0D0; stroke:#5B6678; stroke-width:1.4; transition:fill .2s ease; }
  .m27ch-root[data-coil="on"] .m27ch-moving{ fill:#FBB9B4; stroke:#DC2626; }
  .m27ch-spring{ fill:none; stroke:#8A93A6; stroke-width:2.2; stroke-linejoin:round; }
  .m27ch-fixed{ stroke-width:4; stroke-linecap:round; transition:stroke .2s ease; }
  .m27ch-fixed.nc{ stroke:#DC2626; }
  .m27ch-fixed.no{ stroke:#94A3B8; }
  .m27ch-root[data-coil="on"] .m27ch-fixed.nc{ stroke:#94A3B8; }
  .m27ch-root[data-coil="on"] .m27ch-fixed.no{ stroke:#DC2626; }
  .m27ch-lead{ stroke:#64748B; stroke-width:2.2; stroke-linecap:round; }
  .m27ch-term{ fill:var(--ink,#0E1326); font-size:14px; font-weight:700; }

  /* arc-flash burst at the NO contact gap (shown per-frame while chattering) */
  .m27ch-arc{ fill:#FDE047; stroke:#F59E0B; stroke-width:1.2; opacity:0;
    filter:drop-shadow(0 0 6px rgba(245,158,11,.9)); }
  /* "bzzz" vibration arcs to the right of the contact stack */
  .m27ch-buzz{ fill:none; stroke:#F59E0B; stroke-width:2; stroke-linecap:round; opacity:0; }
  .m27ch-root[data-state="chatter"] .m27ch-buzz{ animation:m27chBuzz .14s steps(2,jump-none) infinite; }
  .m27ch-root[data-state="chatter"] .m27ch-buzz.b2{ animation-delay:.05s; }
  .m27ch-root[data-state="chatter"] .m27ch-buzz.b3{ animation-delay:.09s; }
  @keyframes m27chBuzz{ 0%{opacity:.15;} 100%{opacity:.95;} }

  /* narrow stage: stack columns, keep the cutaway near design scale */
  @container (max-width: 739px){
    .m27ch-body{ flex-direction:column; }
    .m27ch-leftcol{ flex:0 0 auto; width:100%; }
    .m27ch-rightcol{ flex:0 0 auto; }
    .m27ch-reads{ flex-wrap:wrap; }
    .m27ch-read{ flex:1 1 200px; }
    .m27ch-facts{ flex-wrap:wrap; }
    .m27ch-fact{ flex:1 1 260px; }
  }
  `;
  host.appendChild(style);

  // ---------------------------------------------------------------- DOM scaffold
  const root = document.createElement("div");
  root.className = "m27ch-root";
  root.dataset.state = "pulled";
  root.dataset.coil = "on";
  host.appendChild(root);

  root.innerHTML = `
    <div class="m27ch-head">
      <div class="m27ch-kicker">Common real faults &middot; chattering relay</div>
      <h2 class="m27ch-title">Chattering Relay: The Buzz That Kills Contacts</h2>
      <div class="m27ch-sub">A 24VDC coil needs about <b>85% of nominal (20.4V)</b> to pull in and seal. Feed it less and it doesn't just quit &mdash; in a narrow band it <b>buzzes</b>: pull in, lose grip, drop out, re-pull&hellip; dozens of times a second. Drag the coil-voltage slider and find what lives between &ldquo;works&rdquo; and &ldquo;dead&rdquo;.</div>
    </div>
    <div class="m27ch-body">
      <div class="m27ch-leftcol">
        <div class="m27ch-facecard">
          <div class="m27ch-svgwrap" id="m27ch-svgwrap"></div>
          <div class="m27ch-facelabel">Side cutaway &middot; 24VDC ice-cube relay</div>
        </div>
        <div class="m27ch-ctrl">
          <div class="m27ch-slidehead">
            <span class="m27ch-slidehead-l">Coil supply voltage</span>
            <span class="m27ch-slidehead-v" id="m27ch-volts-v">24.0 V</span>
          </div>
          <input type="range" class="m27ch-slider" id="m27ch-slider" min="10" max="28" step="0.1" value="24"
                 aria-label="Coil supply voltage, 10 to 28 volts on a 24 volt DC coil">
          <div class="m27ch-scale">
            <span style="left:0%; transform:none">10V</span>
            <span class="m27ch-tick-pull" style="left:57.8%">20.4V pull-in</span>
            <span style="left:100%; transform:translateX(-100%)">28V</span>
            <span class="m27ch-tick-drop m27ch-row2" style="left:38.9%">17V drop-out</span>
            <span class="m27ch-row2" style="left:77.8%">24V nominal</span>
          </div>
          <div class="m27ch-zonenote"><b>Green</b> = seals clean &middot; <b>amber</b> = CHATTER band &middot; <b>red</b> = won't pull in at all. The amber band is the killer &mdash; the relay still &ldquo;works&rdquo;, so nobody looks at it while it eats itself.</div>
        </div>
      </div>
      <div class="m27ch-rightcol">
        <div class="m27ch-coach"><span class="m27ch-coach-k">Coach</span><span class="m27ch-coach-t" id="m27ch-coach-t"></span></div>
        <div class="m27ch-reads">
          <div class="m27ch-read" id="m27ch-read-v">
            <div class="m27ch-read-k">At the coil (A1&ndash;A2)</div>
            <div class="m27ch-read-v" id="m27ch-rv-volts">24.0<small> V</small></div>
            <div class="m27ch-read-n" id="m27ch-rv-pct">100% of 24V nominal</div>
            <span class="m27ch-pill good" id="m27ch-rv-pill">PULLED IN</span>
          </div>
          <div class="m27ch-read" id="m27ch-read-i">
            <div class="m27ch-read-k">Load current thru contacts</div>
            <div class="m27ch-read-v" id="m27ch-ri-amps">1.0<small> A</small></div>
            <div class="m27ch-read-n" id="m27ch-ri-note">Steady 1.0A run current &mdash; one inrush at first make, then quiet.</div>
          </div>
          <div class="m27ch-read" id="m27ch-read-d">
            <div class="m27ch-read-k">Contact damage</div>
            <div class="m27ch-read-v" id="m27ch-rd-pct">0.0<small> %</small></div>
            <div class="m27ch-dmgbar"><div class="m27ch-dmgfill" id="m27ch-rd-fill"></div></div>
            <div class="m27ch-read-n" id="m27ch-rd-note">Chatter cycles: 0 &middot; rated life 100,000 ops</div>
            <button class="m27ch-newrelay" id="m27ch-newrelay">FIT NEW RELAY</button>
          </div>
        </div>
        <div class="m27ch-facts">
          <div class="m27ch-fact">
            <div class="m27ch-fact-k">What puts you in the chatter band</div>
            <ul>
              <li><b>Undervoltage supply</b> &mdash; a sagging control transformer or a 24V supply loaded past its rating.</li>
              <li><b>Voltage drop under load</b> &mdash; a corroded or loose connection reads a clean 24V open-circuit, then steals volts the instant the coil draws current. That trap is <a href="?lesson=m26-meter-basics-safe-measurement&view=1" id="m27ch-m26link">Lesson 26: Voltage Is a Liar</a>.</li>
              <li><b>Loose coil terminal</b> &mdash; vibration wiggles the screw; the resistance (and the drop) comes and goes with it, so the buzz comes and goes too.</li>
            </ul>
            <div class="m27ch-fact-foot"><b>Field fix:</b> measure at A1&ndash;A2 <b>with the coil energized</b>, then chase the missing volts upstream connection by connection.</div>
          </div>
          <div class="m27ch-fact">
            <div class="m27ch-fact-k">Why it kills relays</div>
            <ul>
              <li><b>Inrush &times;6&ndash;10.</b> Motor and solenoid loads pull 6&ndash;10&times; run current at every start &mdash; a chattering contact restarts the load on <b>every re-make</b>, dozens of times a second.</li>
              <li><b>10&ndash;60 cycles/sec.</b> Typical chatter rate. A contact rated 100,000 electrical operations burns its whole life in <b>under an hour</b> at 30 chatters/sec.</li>
              <li><b>An arc on every break.</b> Each drop-out draws an arc that melts and transfers contact metal &mdash; pitting, then welding. The end state is a contact stuck shut or one that never makes again.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;

  // ---------------------------------------------------------------- cutaway SVG
  const svg = E("svg", { class: "m27ch-cut", viewBox: "0 0 360 340", preserveAspectRatio: "xMidYMid meet",
    "aria-label": "Cutaway relay: coil, armature, spring, and contacts, buzzing when the coil voltage is marginal" });
  root.querySelector("#m27ch-svgwrap").appendChild(svg);

  // case
  svg.appendChild(E("rect", { class: "m27ch-case", x: 18, y: 12, width: 324, height: 296, rx: 12 }));

  // live volts badge (top-left, inside the case)
  const vbadgeV = E("text", { class: "m27ch-vbadge-v", x: 34, y: 46 }, "24.0 V");
  svg.appendChild(vbadgeV);
  svg.appendChild(E("text", { class: "m27ch-vbadge-l", x: 34, y: 62 }, "at the coil"));

  // coil + core
  const coilG = E("g");
  coilG.appendChild(E("rect", { class: "m27ch-coilbody", x: 150, y: 208, width: 110, height: 84, rx: 6 }));
  for (let i = 0; i < 6; i++)
    coilG.appendChild(E("line", { class: "m27ch-coilturn", x1: 150, y1: 220 + i * 12, x2: 260, y2: 220 + i * 12 }));
  coilG.appendChild(E("rect", { class: "m27ch-core", x: 196, y: 170, width: 18, height: 38, rx: 2 }));
  coilG.appendChild(E("rect", { class: "m27ch-coiltextbg", x: 181, y: 242, width: 48, height: 18, rx: 3 }));
  coilG.appendChild(E("text", { class: "m27ch-coiltext", x: 205, y: 256, "text-anchor": "middle" }, "COIL"));
  svg.appendChild(coilG);
  svg.appendChild(E("text", { class: "m27ch-lab", x: 205, y: 163, "text-anchor": "middle" }, "iron core"));

  // magnetic field arcs (opacity driven by data-coil)
  const fieldG = E("g", { class: "m27ch-field" });
  [20, 32, 44].forEach((r) => {
    fieldG.appendChild(E("path", { class: "m27ch-fieldarc", d: `M ${205 - r} 182 A ${r} ${r} 0 0 1 ${205 + r} 182` }));
  });
  svg.appendChild(fieldG);

  // fixed contacts (right side): NC up, NO down
  svg.appendChild(E("line", { class: "m27ch-fixed nc", x1: 262, y1: 106, x2: 296, y2: 106 }));
  svg.appendChild(E("text", { class: "m27ch-tag nc", x: 279, y: 94, "text-anchor": "middle" }, "NC"));
  svg.appendChild(E("line", { class: "m27ch-fixed no", x1: 262, y1: 146, x2: 296, y2: 146 }));
  svg.appendChild(E("text", { class: "m27ch-tag no", x: 279, y: 170, "text-anchor": "middle" }, "NO"));

  // return spring (decorative, above the bar) + label
  svg.appendChild(E("path", { class: "m27ch-spring", d: "M 228 64 l 8 6 l -16 7 l 16 7 l -16 7 l 16 7 l -8 6" }));
  svg.appendChild(E("text", { class: "m27ch-lab", x: 228, y: 56, "text-anchor": "middle" }, "SPRING"));

  // armature: pivot at (70,132), bar to x=262, moving contact block at the free end
  const arm = E("g", { class: "m27ch-arm", "data-pulled": "1" });
  arm.appendChild(E("rect", { class: "m27ch-armbar", x: 70, y: 126, width: 192, height: 12, rx: 4 }));
  arm.appendChild(E("circle", { class: "m27ch-pivot", cx: 70, cy: 132, r: 6 }));
  arm.appendChild(E("rect", { class: "m27ch-moving", x: 244, y: 122, width: 13, height: 22, rx: 2 }));
  svg.appendChild(arm);
  svg.appendChild(E("text", { class: "m27ch-lab", x: 112, y: 112, "text-anchor": "middle" }, "ARMATURE"));

  // arc-flash burst at the NO gap (transform/opacity driven per-frame)
  const arcFlash = E("path", { class: "m27ch-arc",
    d: "M 0 -11 L 3 -3 L 11 -4 L 5 1 L 9 9 L 1 5 L -4 11 L -4 3 L -12 2 L -5 -3 Z" });
  svg.appendChild(arcFlash);

  // "bzzz" vibration arcs to the right of the contact stack
  [[30, ""], [40, "b2"], [50, "b3"]].forEach(([r, extra]) => {
    const y0 = 126 - r * 0.57, y1 = 126 + r * 0.57, x = 294 + r * 0.82;
    svg.appendChild(E("path", { class: `m27ch-buzz ${extra}`.trim(),
      d: `M ${x} ${y0} A ${r} ${r} 0 0 1 ${x} ${y1}` }));
  });

  // coil leads + terminals
  svg.appendChild(E("line", { class: "m27ch-lead", x1: 165, y1: 292, x2: 165, y2: 312 }));
  svg.appendChild(E("line", { class: "m27ch-lead", x1: 245, y1: 292, x2: 245, y2: 312 }));
  svg.appendChild(E("text", { class: "m27ch-term", x: 165, y: 330, "text-anchor": "middle" }, "A1(+)"));
  svg.appendChild(E("text", { class: "m27ch-term", x: 245, y: 330, "text-anchor": "middle" }, "A2(–)"));

  // =================================================================
  // PHYSICS + STATE
  // =================================================================
  const V_NOM = 24, V_PULLIN = 20.4, V_DROPOUT = 17.0;  // 85% pull-in floor
  const I_RUN = 1.0, I_INRUSH = 6.5;                    // load amps through the contacts
  const WEAR_PER_CYCLE = 0.045;                         // % contact damage per chatter cycle
  const PULL_DUTY = 0.55;                               // fraction of each chatter cycle spent pulled

  let volts = 24.0;
  let state = "pulled";        // "pulled" | "chatter" | "dropout"
  let phase = 0;               // chatter cycles (fractional), advances on wall-clock dt
  let armPulled = true;
  let damage = 0;              // cumulative %, persists across states (damage is permanent)
  let cycles = 0;              // total chatter re-strikes
  let dispI = I_RUN;           // displayed amps (peak-hold with fast decay, so spikes read)
  let graceUntil = 0;          // keep the loop alive briefly after leaving chatter (decay anim)
  let rafId = null, lastFrameMs = null, lastStepMs = null;

  const zoneOf = (v) => (v >= V_PULLIN ? "pulled" : v >= V_DROPOUT ? "chatter" : "dropout");
  // chatter rate: harsher buzz the deeper the sag (12 → ~46 cycles/sec)
  const hzOf = (v) => 12 + ((V_PULLIN - Math.min(Math.max(v, V_DROPOUT), V_PULLIN)) / (V_PULLIN - V_DROPOUT)) * 34;

  // ---------------------------------------------------------------- element refs
  const slider = root.querySelector("#m27ch-slider");
  const voltsV = root.querySelector("#m27ch-volts-v");
  const coachT = root.querySelector("#m27ch-coach-t");
  const readV = root.querySelector("#m27ch-read-v");
  const rvVolts = root.querySelector("#m27ch-rv-volts");
  const rvPct = root.querySelector("#m27ch-rv-pct");
  const rvPill = root.querySelector("#m27ch-rv-pill");
  const readI = root.querySelector("#m27ch-read-i");
  const riAmps = root.querySelector("#m27ch-ri-amps");
  const riNote = root.querySelector("#m27ch-ri-note");
  const readD = root.querySelector("#m27ch-read-d");
  const rdPct = root.querySelector("#m27ch-rd-pct");
  const rdFill = root.querySelector("#m27ch-rd-fill");
  const rdNote = root.querySelector("#m27ch-rd-note");
  const newRelayBtn = root.querySelector("#m27ch-newrelay");

  // ---------------------------------------------------------------- static (per-slider) UI
  let lastCoachMsg = "";
  function renderStatic() {
    const pct = Math.round((volts / V_NOM) * 100);
    const vTxt = `${volts.toFixed(1)} V`;
    voltsV.textContent = vTxt;
    vbadgeV.textContent = vTxt;
    rvVolts.innerHTML = `${volts.toFixed(1)}<small> V</small>`;
    rvPct.textContent = `${pct}% of 24V nominal`;

    root.dataset.state = state;
    let msg;
    if (state === "pulled") {
      readV.className = "m27ch-read good";
      rvPill.className = "m27ch-pill good"; rvPill.textContent = "PULLED IN";
      readI.className = "m27ch-read good";
      riNote.textContent = "Steady 1.0A run current — one inrush at first make, then quiet.";
      msg = `<b>Healthy pull-in.</b> ${volts.toFixed(1)}V is ${pct}% of nominal — at or above the 85% floor (20.4V) the armature seals in one clean stroke and the contact sits solid. This is what "quiet" sounds like.`;
    } else if (state === "chatter") {
      const hz = Math.round(hzOf(volts));
      readV.className = "m27ch-read warn";
      rvPill.className = "m27ch-pill warn"; rvPill.textContent = "CHATTERING";
      readI.className = "m27ch-read bad";
      riNote.innerHTML = `⚡ spiking to <b>${I_INRUSH.toFixed(1)}A (${(I_INRUSH / I_RUN).toFixed(1)}×)</b> on every re-make — inrush, over and over.`;
      msg = `<b>CHATTERING at ~${hz} cycles/sec</b> — the magnet grabs, ${volts.toFixed(1)}V can't hold it, the spring rips it back, it re-pulls&hellip; Every cycle is a fresh <b>inrush spike</b> through the contacts and an <b>arc</b> on the break. The contacts are cooking.`;
    } else {
      readV.className = "m27ch-read bad";
      rvPill.className = "m27ch-pill bad"; rvPill.textContent = "DROPPED OUT";
      readI.className = "m27ch-read";
      riNote.textContent = "0.0A — contact open, load off.";
      msg = `<b>Dropped out.</b> At ${volts.toFixed(1)}V (${pct}%) the coil can't out-pull the return spring at all. The load is simply OFF — annoying, but honest. The sneaky killer is the amber chatter band just above this.`;
    }
    if (msg !== lastCoachMsg) { lastCoachMsg = msg; coachT.innerHTML = msg; }
  }

  // ---------------------------------------------------------------- per-frame UI
  function setArm(pulled, jitter) {
    armPulled = pulled;
    arm.dataset.pulled = pulled ? "1" : "0";
    root.dataset.coil = pulled ? "on" : "off";
    const jx = jitter ? (Math.random() - 0.5) * 1.8 : 0;
    const jy = jitter ? (Math.random() - 0.5) * 1.4 : 0;
    arm.style.transform = `translate(${jx.toFixed(2)}px,${jy.toFixed(2)}px) rotate(${pulled ? 3.5 : -7}deg)`;
  }

  function renderDamage() {
    damage = Math.min(100, damage);
    rdPct.innerHTML = `${damage.toFixed(1)}<small> %</small>`;
    rdFill.style.width = `${damage}%`;
    rdFill.style.background = damage < 40 ? "#34D399" : damage < 75 ? "#F59E0B" : "#EF4444";
    readD.className = "m27ch-read" + (damage >= 75 ? " bad" : damage >= 40 ? " warn" : "");
    rdNote.innerHTML = damage >= 100
      ? `<b>COOKED</b> — ${cycles.toLocaleString()} chatter cycles. This relay is scrap.`
      : `Chatter cycles: ${cycles.toLocaleString()} &middot; rated life 100,000 ops`;
  }

  function renderAmps(instant) {
    riAmps.innerHTML = `${dispI.toFixed(1)}<small> A</small>`;
    // arc flash: show on the break and on the re-make bounce, flickery
    if (state === "chatter") {
      const frac = phase % 1;
      const arcing = (frac >= PULL_DUTY && frac < PULL_DUTY + 0.14) || frac < 0.06;
      if (arcing) {
        const s = 0.8 + Math.random() * 0.9;
        arcFlash.style.opacity = (0.65 + Math.random() * 0.35).toFixed(2);
        arcFlash.setAttribute("transform", `translate(259,144) rotate(${Math.round(Math.random() * 360)}) scale(${s.toFixed(2)})`);
      } else {
        arcFlash.style.opacity = "0";
      }
    } else {
      arcFlash.style.opacity = "0";
    }
  }

  // ---------------------------------------------------------------- simulation loop
  // Timing decisions run on WALL-clock dt (m21 pattern) so throttled tabs
  // can't stall the buzz; the watchdog below covers rAF starvation.
  function step(dt) {
    lastStepMs = performance.now();
    let instant;
    if (state === "chatter") {
      const before = Math.floor(phase);
      phase += dt * hzOf(volts);
      const wraps = Math.floor(phase) - before;
      if (wraps > 0) { cycles += wraps; damage += wraps * WEAR_PER_CYCLE; renderDamage(); }
      const frac = phase % 1;
      setArm(frac < PULL_DUTY, true);
      // load restarts on every re-make: inrush decaying toward run current
      instant = armPulled ? I_RUN + (I_INRUSH - I_RUN) * Math.exp(-frac / 0.12) : 0;
    } else if (state === "pulled") {
      setArm(true, false);
      instant = I_RUN;
    } else {
      setArm(false, false);
      instant = 0;
    }
    // peak-hold ammeter: spikes register, then decay fast enough to read the next one
    dispI = Math.max(instant, dispI * Math.exp(-dt * 9));
    if (Math.abs(dispI - instant) < 0.03) dispI = instant;
    renderAmps(instant);
    return state === "chatter" || performance.now() < graceUntil;
  }

  function tick(nowMs) {
    if (lastFrameMs == null) lastFrameMs = nowMs;
    const dt = Math.min((nowMs - lastFrameMs) / 1000, 0.2);   // clamp: no giant catch-up jump
    lastFrameMs = nowMs;
    let cont = false;
    try { cont = step(dt); }
    finally { rafId = cont ? requestAnimationFrame(tick) : null; }
  }

  function ensureLoop() {
    if (rafId == null) { lastFrameMs = null; rafId = requestAnimationFrame(tick); }
  }

  // WATCHDOG: rAF is throttled to a stop in hidden tabs / Energy Saver.
  // Keep the sim stepping when starved; self-cleans once the view unmounts.
  const watchdog = setInterval(() => {
    if (!root.isConnected) { clearInterval(watchdog); if (rafId != null) cancelAnimationFrame(rafId); return; }
    if (state !== "chatter") return;
    const now = performance.now();
    if (lastStepMs == null || now - lastStepMs > 400) {
      const dt = lastStepMs == null ? 0 : Math.min((now - lastStepMs) / 1000, 1.0);
      lastFrameMs = null;              // rAF resumes with a fresh delta, no double-count
      step(dt);
    }
  }, 300);

  // ---------------------------------------------------------------- control wiring
  function setVolts(v) {
    volts = Math.min(28, Math.max(10, v));
    const z = zoneOf(volts);
    if (z !== state) {
      state = z;
      phase = 0;
      if (z === "pulled") dispI = I_INRUSH;         // the one honest inrush of a clean pull-in
      graceUntil = performance.now() + 900;         // let the ammeter decay play out
    }
    renderStatic();
    step(0);                                        // redraw NOW, even if rAF is idle
    ensureLoop();
  }

  slider.addEventListener("input", () => setVolts(parseFloat(slider.value)));

  newRelayBtn.addEventListener("click", () => {
    damage = 0; cycles = 0;
    renderDamage();
    rdNote.innerHTML = `Fresh contacts fitted &middot; rated life 100,000 ops`;
    readD.classList.add("flash");
    clearTimeout(readD._flashT);
    readD._flashT = setTimeout(() => readD.classList.remove("flash"), 550);
  });

  // ---------------------------------------------------------------- init + QA hook
  // ?chatter=<volts> jumps straight to a given coil voltage (headless verify),
  // mirroring the app's ?energize=1 / ?vdload=<ohms> / ?timer=... family.
  const qaV = parseFloat(new URLSearchParams(location.search).get("chatter"));
  if (!Number.isNaN(qaV)) slider.value = String(Math.min(28, Math.max(10, qaV)));
  setVolts(parseFloat(slider.value));
  renderDamage();
}
