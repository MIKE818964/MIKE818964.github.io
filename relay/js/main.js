// =============================================================================
// main.js — bootstrap + the single update() chokepoint (solve -> render -> meter).
// Builds the level-grouped nav, the teachable right panel, and the troubleshooting
// flow. All behavior lives here + the engine; lessons/scenarios stay pure data.
// =============================================================================

import { CircuitView } from "./renderer.js";
import { solve } from "./solver.js";
import { Meter } from "./meter.js";
import { bindButtons } from "./interact.js";
import { applyFaults, clearFaults, TroubleshootSession, FAULT_LABEL } from "./faults.js";
import { renderRelayAnatomy } from "./relay_anatomy.js";
import { renderRelayGallery } from "./relay_gallery.js";
import { renderQuiz } from "./quiz.js";
import { renderQuickCheck } from "./quickcheck.js";
import { renderTestCenter } from "./test_center.js";
import { renderBuilder } from "./builder.js";
import { renderPhotoView, renderPhotoGrid, renderCutSheet, renderModel3D, renderSlide, renderHotPhoto, renderPartsStrip } from "./views.js";
import { renderDualView } from "./dual_view.js";
import { renderFieldWiring } from "./wiring_view.js";
import { buildContactorIllustration } from "./realistic_contactor.js";
import { buildRelayPinout } from "./realistic_relay_octal.js";
// bespoke self-contained interactive lesson modules
import { render as wM01 } from "./lessons/m01_water.js";
import { render as wM07 } from "./lessons/m07_selector.js";
import { render as wM09 } from "./lessons/m09_poles_throws.js";
import { render as wM18 } from "./lessons/m18_voltages.js";
import { render as wM19 } from "./lessons/m19_fusing_calc.js";
import { render as wM20 } from "./lessons/m20_voltage_ladder.js";
import { render as wM24 } from "./lessons/m24_ladder_reader.js";
import { render as wM25 } from "./lessons/m25_troubleshooting_method.js";
import { render as wM28 } from "./lessons/m28_loto.js";
import { render as wM26vd } from "./lessons/m26_voltage_drop.js";
import { render as wM26mm } from "./lessons/m26_mastery.js";
import { render as wM14x } from "./lessons/m14_exploded_contactor.js";
import { render as wM03bc } from "./lessons/m03_button_cutaway.js";
import { render as wM21tm } from "./lessons/m21_timer_mechanism.js";
import { render as wM22sq } from "./lessons/m22_sequence.js";
import { render as wM27ch } from "./lessons/m27_chatter.js";
import { render as wM30ol } from "./lessons/m30_overload.js";

// Phase 0: which modules have a live interactive circuit / scenario yet.
const LESSON_CIRCUITS = {
  "m02-circuit-source-load-path": "02_source_path_load",
  "m03-switch-is-a-drawbridge": "03_drawbridge",
  "m04-normally-open-normally-closed": "04_no_vs_nc",
  "m05-dc-supply-24v": "05_supply_24v",
  "m06-single-throw-one-destination": "06_single_throw",
  "m08-what-is-a-pole": "08_what_is_a_pole",
  "m11-momentary-button-problem": "11_momentary_button",
  "m12-seal-in-latch": "12_seal_in",
  "m13-stop-button-3wire": "13_seal_in_latch",
  "m14-swap-bulb-for-motor-starter": "14_motor_starter",
  "m30-overload-relay": "30_overload",
  "m15-poles-for-3phase": "15_poles_3phase",
  "m26-meter-basics-safe-measurement": "26_meter_safety",
};
// A troubleshooting-lab module carries several deductive tickets; each ticket
// randomizes its own fault. The learner picks a ticket, works it with the meter.
const SCENARIO_LAB = {
  "m29-capstone-diagnose-dead-motor": [
    { file: "tsg_dead_motor",        label: "Dead Start/Stop Station" },
    { file: "sc_starter_wont_start", label: "Starter Won't Start" },
    { file: "sc_wont_stop",          label: "The Runaway (Won't Stop)" },
    { file: "sc_interlock",          label: "Interlock Won't Sequence" },
    { file: "sc_pilot_lights",       label: "Which Light Is Lying?" },
    { file: "sc_rebuild_miswired",   label: "The Rebuild Gone Wrong" },
  ],
};
const SCENARIOS = SCENARIO_LAB;   // presence of a lab = this module is a scenario
// custom realistic interactive views (not the data-driven circuit engine)
const ANATOMY = {
  "m10-the-coil-electromagnet": true,
};
const GALLERY = {
  "m17-identify-by-pin-count": true,
};

// ----------------------------------------------------------------------------
// VIEWS — every lesson can carry MULTIPLE views (the user's "lots of views per
// lesson"). The schematic is the abstract drawing; the rest are the REAL thing:
// a field photo of the actual part, an exploded view, the cutaway, the
// manufacturer cut sheet, the 3D model. Kinds:
//   schematic | cutaway | gallery | photo | photogrid | cutsheet | model3d | slide
// When a lesson has a VIEWS entry it is authoritative (ordered tabs). Lessons
// without one fall back to their single built view (schematic/cutaway/gallery).
// ----------------------------------------------------------------------------
const VIEWS = {
  "m03-switch-is-a-drawbridge": [
    { kind: "schematic", label: "Schematic" },
    { kind: "custom", label: "Button Cutaway", render: wM03bc },
  ],
  "m04-normally-open-normally-closed": [
    { kind: "schematic", label: "Schematic" },
    { kind: "dual", label: "Linked View", partType: "relay",
      caption: "CR1's ONE pole gives you both a NO and an NC output at the same time — click either contact to see the exact pin pair on the real relay base.",
      linkMap: { CR1: "coil", CR1NO: "pole1", CR1NC: "pole1" } },
  ],

  // ---- bespoke self-contained interactive lessons ----
  "m01-what-is-electricity":          [{ kind: "custom", label: "Water Analogy",  render: wM01 }],
  "m07-double-throw-two-destinations":[
    { kind: "custom", label: "Selector", render: wM07 },
    { kind: "illustration", label: "Real Relay", partType: "spdt5",
      caption: "The selector you just threw IS a real single-pole relay: a 5-blade SPDT base — common blade 9, NC blade 1, NO blade 5, coil on 13/14. Hit ENERGIZE and watch it pick the other destination." },
  ],
  "m09-naming-spst-spdt-dpst-dpdt":   [
    { kind: "custom", label: "Switch Types", render: wM09 },
    { kind: "illustration", label: "Real Relay", partType: "relay-family",
      caption: "Same ice-cube idea, four real bases: SPDT (5 blades), DPDT (8-pin octal), 3PDT (11-pin), 4PDT (14 blades). Pick a layout, count its poles, then energize it — every pole swings NC → NO together." },
  ],
  "m18-why-a-voltage-hierarchy":      [{ kind: "custom", label: "Voltage Map",    render: wM18 }],
  "m19-fusing-math-amps-watts-volts": [{ kind: "custom", label: "Fuse Math",      render: wM19 }],
  "m20-walking-down-the-ladder":      [{ kind: "custom", label: "Voltage Ladder", render: wM20 }],
  "m24-ladder-symbols-reading-a-rung":[{ kind: "custom", label: "Read a Rung",    render: wM24 }],
  "m25-troubleshooting-method":       [{ kind: "custom", label: "The Method",     render: wM25 }],
  "m28-safety-loto":                  [{ kind: "custom", label: "LOTO Steps",     render: wM28 }],
  "m26-meter-basics-safe-measurement": [
    { kind: "custom", label: "Multimeter Mastery", render: wM26mm },
    { kind: "schematic", label: "Schematic" },
    { kind: "custom", label: "Voltage Is a Liar", render: wM26vd },
  ],

  // ---- the coil / relay itself ----
  "m10-the-coil-electromagnet": [
    { kind: "cutaway", label: "Cutaway" },
    { kind: "model3d", label: "3D Relay", stl: "assets/models/750r-2c-24d.stl",
      caption: "The real 750R ice-cube relay from manufacturer CAD — the coil you're studying lives in the lower half of that case." },
    { kind: "photo", label: "Real Relay", img: "plugin-relay.jpg",
      eyebrow: "REAL PART · IN YOUR HAND", title: "Plug-in “ice-cube” relay",
      caption: "That electromagnet coil from the cutaway lives inside this case. Pins A1/A2 on the socket feed it.",
      points: ["Coil voltage is printed right on the case (e.g. 24VDC).",
               "Energize A1–A2 and you hear the contacts snap over.",
               "Pulls out of its socket — a 10-second swap on the floor."] },
    { kind: "model3d", label: "3D", caption: "The real AutomationDirect 784-4C-24D, straight from their CAD. Drag to spin." },
    { kind: "cutsheet", label: "Cut Sheet", pdf: "750R_series_relays.pdf", title: "AutomationDirect 750R-series relay" },
  ],
  "m11-momentary-button-problem": [
    { kind: "schematic", label: "Schematic" },
    { kind: "model3d", label: "3D Button", stl: "assets/models/gcx1100.stl",
      caption: "The real 22mm GCX pushbutton from manufacturer CAD — the operator head; NO/NC contact blocks snap onto the back." },
    { kind: "cutsheet", label: "Button Sheet", pdf: "GCX1100_pushbutton_cutsheet.pdf", title: "GCX 22mm pushbutton — cut sheet" },
    { kind: "dual", label: "Linked View", partType: "relay",
      caption: "CR1 in the print is ONE physical 8-pin relay. Click its coil or either contact — see exactly which pin you'd probe on the real base.",
      linkMap: { CR1: "coil", RUNC: "pole1", STPC: "pole1" } },
    { kind: "photo", label: "Real Relay", img: "plugin-relay.jpg",
      title: "The relay you're wiring (CR1)",
      caption: "On the schematic CR1 is a coil plus its contacts. In the panel it's this one physical part.",
      points: ["The Start button energizes this coil.", "Its contacts are the NO/NC you switch in the rung."] },
    { kind: "cutaway", label: "Cutaway" },
  ],
  "m12-seal-in-latch": [
    { kind: "schematic", label: "Schematic" },
    // Field Wiring: pin numbers are the verified dpdt8 map (coil A1=2/A2=7,
    // pole1 1/4/3) — see wiring_view.js header. Seal rides pole 1 here.
    { kind: "wiring", label: "Field Wiring",
      spec: { device: "octal8", relayLabel: "CR1", start: "S1", seal: "CR1-SI", coil: "CR1", fuse: "FU1",
        sealPole: 1, poleNote: ["pole 2 — spare", "(free for a pilot light)"],
        tags: { nPos: "L", nFused: "1", nCoil: "2", nNeg: "N" } },
      caption: "Two wires make the latch. Pin 1 (COM) taps wire 1 on the hot side of the Start button; pin 3 (NO) lands back on the wire-2 junction feeding coil pin 2 (A1). When CR1 pulls in, pins 1–3 close and bypass the button — let go of Start and the coil keeps feeding itself through its own pole." },
    { kind: "dual", label: "Linked View", partType: "relay",
      caption: "The seal-in contact is CR1's OWN pole, feeding back into its own coil. Click the coil or the seal-in contact — see the exact pin pair on the real relay base.",
      linkMap: { CR1: "coil", "CR1-SI": "pole1", "CR1-R": "pole1", "CR1-S": "pole1" } },
    { kind: "photo", label: "Real Relay", img: "plugin-relay.jpg",
      title: "The relay that seals itself in",
      caption: "One of CR1's own NO contacts feeds its coil — that's the seal-in. Same physical relay.",
      points: ["Coil pulls in → its NO contact closes → keeps the coil fed.",
               "Drop power to the coil and the seal-in releases."] },
    { kind: "cutaway", label: "Cutaway" },
  ],
  "m13-stop-button-3wire": [
    { kind: "schematic", label: "Schematic" },
    // Seal rides pole 2 (pins 8/5/6) — pole 1 drives the lamps, matching this
    // lesson's Linked View mapping. Pin truth: wiring_view.js header.
    { kind: "wiring", label: "Field Wiring",
      spec: { device: "octal8", relayLabel: "CR1", start: "START", stop: "STOP", seal: "SEAL", coil: "CR1", fuse: "FU1",
        sealPole: 2, poleNote: ["pole 1 — runs the", "Running / Stopped lamps"],
        tags: { L: "L", n1: "1", n2: "2", n3: "3", N: "N" } },
      caption: "The classic 3-wire station: wire 2 leaves the Stop button's load side, feeds Start terminal 13 AND pin 8 (COM) — the seal tap. Wire 3 leaves Start terminal 14 for coil pin 2 (A1), and pin 6 (NO) jumpers back onto it. CR1 pulls in, pins 8–6 close, and the button is bypassed; Stop breaks wire 2 and drops the whole thing." },
    { kind: "dual", label: "Linked View", partType: "relay",
      caption: "CR1 uses BOTH poles here: pole 1 (NO+NC) drives the Running/Stopped lamps, pole 2 (NO) is the seal-in. Click any contact to see its exact pin pair on the real relay base.",
      linkMap: { CR1: "coil", SEAL: "pole2", RUNC: "pole1", STPC: "pole1" } },
    { kind: "photo", label: "Real Relay", img: "plugin-relay.jpg",
      title: "CR1 in the classic 3-wire start/stop",
      caption: "The classic latch you just built lives in this ice-cube relay on the DIN rail.",
      points: ["Stop (NC) in series breaks the seal-in.", "Start (NO) pulls the coil in.", "CR1's own NO contact holds it."] },
    { kind: "cutaway", label: "Cutaway" },
    { kind: "cutsheet", label: "Cut Sheet", pdf: "750R_series_relays.pdf", title: "AutomationDirect 750R-series relay" },
  ],

  // ---- contactor / motor-starter family (no circuit yet → the real photos ARE the lesson) ----
  "m14-swap-bulb-for-motor-starter": [
    { kind: "schematic", label: "Schematic" },
    // Contactor hardware: seal = aux 13-14, coil = A1/A2; the main poles are
    // the grayed power section (this lesson wires pole 1/L1-2/T1 to the motor).
    { kind: "wiring", label: "Field Wiring",
      spec: { device: "contactor", relayLabel: "M1", start: "S2", stop: "S1", seal: "SEAL", coil: "M1", fuse: "FU1",
        mains: ["M1MAIN"], motors: ["MTR"], bodyNote: "poles 3/L2 & 5/L3 — spare here",
        tags: { L: "L", n1: "1", nodeA: "2", nodeB: "3", N: "N", nRun: "T1" } },
      caption: "Same 3-wire circuit, contactor hardware: aux contact 13–14 bridges the Start button and A1/A2 is the coil — that little aux is control-sized on purpose. The fat poles (1/L1 → 2/T1) never touch your control wiring; they just follow the armature and carry the motor current." },
    { kind: "custom", label: "Teardown", render: wM14x },
    { kind: "hotphoto", label: "Click the Part", img: "contactor-modern.jpg",
      title: "Find your way around a real contactor",
      caption: "This is the actual part — click each numbered point (or the legend) and learn what you'd be touching in the panel.",
      spots: [
        { x: 35, y: 15, label: "A1 — coil terminal (+)", note: "One side of the 24VDC coil. Your control circuit's switched hot lands here — this is what the Start/Stop rung actually feeds." },
        { x: 66, y: 13, label: "A2 — coil terminal (−)", note: "The other coil terminal, back to control common. A1-to-A2 is the ONLY part of this device your 24V control circuit touches." },
        { x: 50, y: 33, label: "1/L1 — line side, pole 1", note: "Incoming power lands on the L terminals (1/L1, 3/L2, 5/L3). Line side is HOT whenever the feeder is on — even with the coil dead." },
        { x: 79, y: 29, label: "13 — aux contact (NO)", note: "A small pilot-duty contact that moves with the main poles. 13-14 is your seal-in / Running-light contact — control-sized, not motor-sized." },
        { x: 52, y: 47, label: "Nameplate — ratings", note: "Coil voltage, contact rating (e.g. 25A AC-3), and part number. Read it BEFORE you wire it — the coil voltage printed here must match your control voltage." },
        { x: 60, y: 58, label: "Contact carrier windows", note: "The moving carrier behind these windows pulls in when the coil energizes — on many contactors you can see (or press) it to check operation." },
        { x: 50, y: 80, label: "2/T1 — load side, pole 1", note: "The T terminals (2/T1, 4/T2, 6/T3) go out to the motor. Dead when the contactor is open — unless a pole is welded, which is exactly what you meter for." },
      ] },
    { kind: "dual", label: "Linked View",
      caption: "M1 in the print is ONE physical contactor. Click its coil, its seal-in contact, or its main power contact — see exactly which real terminal you'd be working on in the panel.",
      linkMap: { M1: "coil", SEAL: "auxNO", M1MAIN: "pole1" } },
    { kind: "model3d", label: "3D Contactor", stl: "assets/models/cwb25-11-30d15.stl",
      caption: "The real WEG CWB25 contactor, straight from the manufacturer's CAD. Drag to spin — find A1/A2 and the line/load terminals." },
    { kind: "model3d", label: "Photo-Real 3D", stl: "assets/models/cjx2_contactor_photoreal.glb",
      caption: "Photo-real 3D of a CJX2-family contactor (the classic LC1-D pattern) — grab and spin it like it's on your bench. Molded text on a scan can blur: the print and the cut sheet always carry the true terminal numbers." },
    { kind: "photo", label: "Contactor", img: "contactor-modern.jpg",
      eyebrow: "REAL PART · MOTOR STARTER", title: "A contactor is just a big relay",
      caption: "Swap the indicator bulb for a motor and your relay grows up into a contactor — same coil-pulls-contacts idea, motor-sized.",
      points: ["One coil pulls in 3 main poles at once (L1/L2/L3).",
               "Aux contacts handle the control-side seal-in.",
               "A small 24V signal switches a big 480V load."] },
    { kind: "photo", label: "DIN-mount", img: "contactor-din.jpg",
      title: "Contactor on the DIN rail",
      caption: "Control side switches the coil; power side switches the motor.",
      points: ["Snaps onto the rail in the cabinet.", "Coil terminals are still A1/A2."] },
    { kind: "photo", label: "Exploded", img: "contactor-exploded.jpg",
      eyebrow: "EXPLODED VIEW", title: "Inside the contactor",
      caption: "The very same parts as the relay cutaway — full size: coil → armature → main contacts → spring.",
      points: ["Energize the coil and every pole snaps closed together.",
               "The spring drops them open when the coil de-energizes."] },
    { kind: "cutsheet", label: "Cut Sheet", pdf: "CWB25_contactor_cutsheet.pdf", title: "WEG CWB25 contactor — the real cut sheet" },
  ],
  "m15-poles-for-3phase": [
    { kind: "schematic", label: "Schematic" },
    { kind: "wiring", label: "Field Wiring",
      spec: { device: "contactor", relayLabel: "M1", start: "S2", stop: "S1", seal: "M1_SEAL", coil: "M1", fuse: "FU1", ac: true,
        mains: ["M1_P2", "M1_P3", "M1_P4"], motors: ["L1", "L2", "L3"], threePhase: true,
        bodyNote: "three poles = three phases",
        tags: { L: "L", n1: "1", n2: "2", n3: "3", N: "N", nL1: "T1", nL2: "T2", nL3: "T3" } },
      caption: "One coil, four contacts moving together: aux 13–14 seals the control circuit while poles 1/L1–2/T1, 3/L2–4/T2 and 5/L3–6/T3 each carry their own phase down to the motor. Kill A1–A2 and every pole opens at once — that's why one Stop button stops all three phases." },
    { kind: "dual", label: "Linked View",
      caption: "One coil (M1), FOUR poles: the seal-in latches control, and three more poles each feed their own phase (L1/L2/L3). Click any pole in the print — see exactly which real terminal pair on the contactor carries that phase.",
      linkMap: { M1: "coil", M1_SEAL: "auxNO", M1_P2: "pole1", M1_P3: "pole2", M1_P4: "pole3" } },
    { kind: "photo", label: "Contactor", img: "contactor-modern.jpg",
      title: "1 pole to latch, 3 to run the motor",
      caption: "Same multi-pole idea: one coil, several independent poles. Use one for the seal-in and three for the 3-phase motor.",
      points: ["Each pole is its own isolated switch.", "All poles move together when the coil pulls in."] },
    { kind: "photo", label: "Exploded", img: "contactor-exploded.jpg",
      eyebrow: "EXPLODED VIEW", title: "Where the three poles live",
      caption: "Three sets of main contacts, one armature bar pulling all of them together." },
  ],
  // ---- the overload relay: the motor's bodyguard ----
  "m30-overload-relay": [
    { kind: "custom", label: "Trip Lab", render: wM30ol },
    { kind: "schematic", label: "Schematic" },
    { kind: "model3d", label: "3D Overload", stl: "assets/models/rw27-2d3-d063.stl",
      caption: "The real WEG RW27 thermal overload from manufacturer CAD. Find the three things you just used in the Trip Lab: the FLA dial (set it to the motor's nameplate amps, 4.0–6.3 A on this one), the reset button, and the 95/96–97/98 aux terminals. The three fat lugs on top plug straight onto a CWB contactor's load side — that's the 'direct mount' on the cut sheet." },
    { kind: "cutsheet", label: "Cut Sheet", pdf: "RW27_overload_cutsheet.pdf", title: "RW27-2D3-D063 thermal overload — the specs you just operated: 4.0–6.3 A dial, Class 10, bi-metallic, 1 N.O. + 1 N.C. aux, phase-loss sensitive" },
  ],
  "m16-match-coil-voltage": [
    { kind: "photo", label: "Read the Coil", img: "plugin-relay.jpg",
      title: "Match the control voltage to the coil",
      caption: "The coil voltage is printed on the relay. Feed a 24VDC coil with 24VDC — not 120VAC.",
      points: ["Wrong coil voltage = no pull-in, or a cooked coil.", "Check the case stamp before you wire A1/A2."] },
    { kind: "cutsheet", label: "Cut Sheet", pdf: "750R_series_relays.pdf", title: "Coil voltage options — 750R series" },
  ],

  // ---- identify by pins ----
  "m17-identify-by-pin-count": [
    { kind: "gallery", label: "Real Parts" },
    { kind: "illustration", label: "Pin Diagram", partType: "octal-relay",
      caption: "The exact 8 pins you'd count on a real octal base — A1/A2 coil, two SPDT poles (common/NC/NO each)." },
    { kind: "illustration", label: "Pin Layouts", partType: "relay-family",
      caption: "Count pins to identify the relay: 5 blades = SPDT, 8-pin octal = DPDT, 11-pin octal = 3PDT, 14 blades = 4PDT. Every layout here matches a real AutomationDirect base — click a zone or energize the coil." },
    { kind: "model3d", label: "3D", caption: "Count the pins on the real 784-4C-24D. Drag to spin." },
    { kind: "cutsheet", label: "Buying Guide", pdf: "RL-Relays-Overview_buyingguide.pdf", title: "Relay overview / buying guide" },
  ],

  // ---- timers ----
  "m21-timer-on-delay-off-delay": [
    { kind: "custom", label: "Run the Timer", render: wM21tm },
    { kind: "photo", label: "Timer Relay", img: "timer-relay-octal.jpg",
      eyebrow: "REAL PART · TIME-DELAY RELAY", title: "Octal time-delay relay",
      caption: "Looks like an ice-cube relay but adds a delay before or after it switches.",
      points: ["On-delay: waits, then acts.", "Off-delay: acts, then holds for the set time.", "Plugs into the same octal base."] },
    { kind: "illustration", label: "Pin Diagram", partType: "octal-relay",
      caption: "Same 8-pin octal base as a plain ice-cube relay — the timer sits in the same socket, on the same pins. (Bigger multi-pole timers use an 11-pin octal base — see Pin Layouts in Lesson 17.)" },
    { kind: "cutsheet", label: "Cut Sheet", pdf: "TRS-TD_offdelay_timers.pdf", title: "TRS-TD off-delay timer data" },
  ],
  "m22-timer-sequence-build": [
    { kind: "custom", label: "Run the Sequence", render: wM22sq },
    { kind: "photo", label: "Timer Relay", img: "timer-relay-octal.jpg",
      title: "The timers in the fan + conveyor sequence",
      caption: "Two octal timers stage the start: fan first, conveyor after the delay.",
      points: ["Each timer's contact gates the next step.", "Set the dial for the delay you need."] },
    { kind: "illustration", label: "Pin Diagram", partType: "octal-relay",
      caption: "Each timer in the sequence plugs into this same 8-pin base. (Some timer models need the 11-pin version — count the pins before you socket one.)" },
    { kind: "cutsheet", label: "Cut Sheet", pdf: "TRS-TD_offdelay_timers.pdf", title: "Timer relay data" },
  ],

  // ---- datasheets / part numbers ----
  "m23-reading-datasheets-part-numbers": [
    { kind: "cutsheet", label: "784-4C-24D", pdf: "784-4C-24D_cutsheet.pdf", title: "Decode it: 784-4C-24D cut sheet" },
    { kind: "cutsheet", label: "Buying Guide", pdf: "RL-Relays-Overview_buyingguide.pdf", title: "Relay family overview" },
    { kind: "photo", label: "Real Part", img: "pcb-relay-ratings.jpg",
      title: "The ratings are printed on the part",
      caption: "Part number, coil voltage, and contact rating are all stamped on the case — learn to read them.",
      points: ["e.g. 10A 250VAC = the contact limit.", "Never load a relay past its printed rating."] },
  ],

  // ---- common faults ----
  "m27-common-real-faults": [
    { kind: "photogrid", label: "Failure Photos", eyebrow: "WHAT FAILURE LOOKS LIKE",
      title: "Common real-world relay & control faults",
      caption: "Learn to recognize these on sight — it saves hours of meter work.",
      images: [
        { img: "fault-worn-contacts.jpg", title: "Arc-eroded contacts", note: "Years of arcing pit the silver — the relay stops making good contact." },
        { img: "fault-burned-contactor.jpg", title: "Burned-out contactor", note: "Overcurrent or a stuck contact cooks it — a classic field failure." },
        { img: "contactor-exploded.jpg", title: "Know the good parts", note: "Compare against a healthy contactor's contacts and coil." },
      ] },
    { kind: "custom", label: "Chattering Relay", render: wM27ch },
    { kind: "model3d", label: "3D Overload", stl: "assets/models/rw27-2d3-d063.stl",
      caption: "The real RW27 thermal overload relay from manufacturer CAD — the tripped overload is behind ~40% of \"dead motor\" calls. Spin it: trip dial, reset, 95/96 NC contact. Full lesson (trip it, meter it, reset it): The Overload Relay, in the Intermediate track right after the motor-starter lesson." },
    { kind: "cutsheet", label: "Overload Sheet", pdf: "RW27_overload_cutsheet.pdf", title: "RW27 thermal overload — cut sheet · full lesson: The Overload Relay (Intermediate track)" },
  ],
};

// Slide-deck map -- EMPTY in the public build (the original scanned
// classroom deck is not distributed). When populated, auto-appends a
// "Course Deck" tab to every module listed here.
const DECK_SLIDES = {};

// Real-parts strips: which catalog families belong on which lesson. Auto-adds
// a "Parts Wall" tab pulling from data/parts_catalog.json (54 verified photos).
const PARTS_VIEWS = {
  "m03-switch-is-a-drawbridge":        { families: ["pushbutton", "contactblock"], title: "The contacts you'll actually push", caption: "Real 22mm operators and the NO/NC contact blocks that snap on behind them — every one is a drawbridge." },
  "m04-normally-open-normally-closed": { families: ["contactblock", "pilot"], title: "NO and NC in the flesh", caption: "Contact blocks are stamped with their type — find the NO (green, 13-14/23-24 style numbers) vs NC (red, 11-12/21-22)." },
  "m05-dc-supply-24v":                 { families: ["supply", "protection"], title: "Where 24VDC actually comes from", caption: "RHINO DIN-rail supplies make the 24VDC; fuses and breakers protect it." },
  "m07-double-throw-two-destinations": { families: ["relay"], title: "Double-throw relays on the shelf", caption: "Every one of these cube relays is a stack of double-throw poles — common, NC, NO." },
  "m09-naming-spst-spdt-dpst-dpdt":    { families: ["relay"], title: "The whole naming family, in hardware", caption: "SPDT (781), DPDT (782/750R-2C), 3PDT (783/750R-3C), 4PDT (784/QM4X1) — count the poles right on the labels." },
  "m10-the-coil-electromagnet":        { families: ["relay", "socket"], title: "Coils and the sockets they ride in", caption: "Every relay here is wrapped around the same electromagnet you just studied." },
  "m12-seal-in-latch":                 { families: ["relay", "socket"], title: "The hardware that latches", caption: "Seal-in circuits live inside cube relays like these, plugged into DIN-rail sockets." },
  "m13-stop-button-3wire":             { families: ["pushbutton", "estop", "pilot"], title: "Start, Stop, and the lights that tell the story", caption: "Real operators: momentary starts, the red mushroom E-stop, and the pilot lights your circuit drives." },
  "m14-swap-bulb-for-motor-starter":   { families: ["contactor", "overload", "starter"], title: "Contactors, overloads, and assembled starters", caption: "The heavy-duty family: contactors in three frame sizes, the thermal overloads that ride on them, and complete enclosed starters. The overload gets its own full lesson next — The Overload Relay: the Motor's Bodyguard." },
  "m30-overload-relay":                { families: ["overload", "starter"], title: "Overloads and the starters they ride on", caption: "Thermal overloads in the flesh: FLA dial, reset button, 95/96 and 97/98 terminals — and complete starters where the overload mounts directly under its contactor." },
  "m15-poles-for-3phase":              { families: ["contactor", "starter"], title: "Three-pole power hardware", caption: "Every contactor here has three main poles for the three phases — plus aux contacts for control." },
  "m16-match-coil-voltage":            { families: ["relay"], title: "Same relay, different coils", caption: "Look close at the labels: 750R-2C-24D (24VDC coil) vs 750R-2C-120A (120VAC coil). Same body, same contacts — the COIL is what must match your control voltage." },
  "m17-identify-by-pin-count":         { families: ["socket", "relay"], title: "Count pins on real sockets", caption: "8-blade, 11-pin, 14-blade — the socket tells you the relay type before you even read the label." },
  "m19-fusing-math-amps-watts-volts":  { families: ["protection"], title: "The protection you're sizing", caption: "Class CC fuses (fast and time-delay), DIN-rail fuse holders, and miniature circuit breakers — the hardware your I=P/V math picks." },
  "m21-timer-on-delay-off-delay":      { families: ["timer", "socket"], title: "Timer relays on the shelf", caption: "TRS octal timers and TRM multifunction timers — note the dials: mode, range, and set-point." },
  "m22-timer-sequence-build":          { families: ["timer"], title: "The timers in your sequence", caption: "Two of these staged in series is exactly the fan-then-conveyor build." },
  "m23-reading-datasheets-part-numbers": { families: ["relay", "timer"], title: "Decode these off the shelf", caption: "Every part number here follows the pattern you just learned — family, poles, coil voltage." },
  "m27-common-real-faults":            { families: ["contactor", "overload"], title: "The usual suspects", caption: "When these fail, you get the symptoms in this lesson — meter them before you swap them." },
  "m28-safety-loto":                   { families: ["estop", "protection", "panel"], title: "Safety hardware", caption: "E-stops, breakers, and the panel hardware your lock actually goes on." },
};

// the ordered view list for a lesson (VIEWS entry wins; else the single built
// view). Returns a FRESH array each call so the auto-appended tabs never
// mutate the shared VIEWS entries.
function composeViews(id) {
  let base;
  if (VIEWS[id]) base = VIEWS[id];
  else if (LESSON_CIRCUITS[id]) base = [{ kind: "schematic", label: "Schematic" }];
  else if (ANATOMY[id]) base = [{ kind: "cutaway", label: "Cutaway" }];
  else if (GALLERY[id]) base = [{ kind: "gallery", label: "Real Parts" }];
  else base = [];
  const views = [...base];
  if (PARTS_VIEWS[id]) views.push({ kind: "parts", label: "Parts Wall", ...PARTS_VIEWS[id] });
  if (DECK_SLIDES[id]) views.push({ kind: "slide", label: "Course Deck", slides: DECK_SLIDES[id] });
  return views;
}

const isPlayable = (id) => composeViews(id).length > 0 || SCENARIOS[id];

const LEVELS = ["Baby Steps", "Beginner", "Intermediate", "Advanced", "Expert"];
const PROGRESS_KEY = "relay_progress_v1";
// The Test Center is a 30th nav destination, NOT a module: it renders into the
// stage overlay like the custom views and keeps its own score storage
// (relay_exams_v1) — completely separate from lesson progress above.
const TEST_CENTER_ID = "test-center";
// The Circuit Builder is the 31st: design-your-own circuits on the live engine.
// Its designs live in localStorage "relay_builder_v1" — separate from everything.
const BUILDER_ID = "circuit-builder";

const App = {
  curriculum: [],
  byId: new Map(),
  current: null,
  circuit: null,
  view: null,
  meter: new Meter(),
  pressed: new Set(),
  prevCoil: new Map(),
  lastState: null,
  tsession: null,
  views: [],
  viewIndex: 0,
};

const $ = (sel) => document.querySelector(sel);
const elh = (tag, cls, txt) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};

// ---------------------------------------------------------------- progress
function getProgress() {
  try { return new Set(JSON.parse(localStorage.getItem(PROGRESS_KEY) || "[]")); }
  catch { return new Set(); }
}
function markComplete(id) {
  const p = getProgress(); p.add(id);
  localStorage.setItem(PROGRESS_KEY, JSON.stringify([...p]));
  refreshProgressUI();
}
function refreshProgressUI() {
  const done = getProgress();
  const pct = App.curriculum.length ? Math.round((done.size / App.curriculum.length) * 100) : 0;
  $("#progress-fill").style.width = pct + "%";
  $("#progress-label").textContent = `${done.size} / ${App.curriculum.length} complete`;
  document.querySelectorAll(".nav-item").forEach((it) => {
    it.classList.toggle("done", done.has(it.dataset.id));
  });
}

// ---------------------------------------------------------------- nav
function buildNav() {
  const nav = $("#nav");
  nav.innerHTML = "";
  for (const level of LEVELS) {
    const mods = App.curriculum.filter((m) => m.level === level);
    if (!mods.length) continue;
    const section = elh("div", "nav-section");
    const head = elh("button", "nav-head");
    head.innerHTML = `<span class="nav-head-title">${level}</span><span class="nav-head-count">${mods.length}</span>`;
    const list = elh("div", "nav-list");
    head.addEventListener("click", () => section.classList.toggle("collapsed"));
    section.appendChild(head);
    mods.forEach((m, i) => {
      const item = elh("button", "nav-item");
      item.dataset.id = m.id;
      const playable = isPlayable(m.id);
      // display index = position within the level (array order), NOT the mXX id —
      // ids are stable keys for quizzes/views/circuits and no longer match order.
      item.innerHTML =
        `<span class="nav-tick"></span><span class="nav-title">${i + 1} · ${m.title}</span>` +
        (playable ? `<span class="nav-live" title="interactive">●</span>` : "");
      item.addEventListener("click", () => loadModule(m.id));
      list.appendChild(item);
    });
    section.appendChild(list);
    nav.appendChild(section);
  }

  // "Practice & Testing" section — fixed entries, pinned (sticky) at the bottom
  // of the nav. NOT curriculum modules: each renders into the stage overlay and
  // never touches the 29-module lesson flow.
  const tsec = elh("div", "nav-section tc-nav-section");
  const thead = elh("button", "nav-head");
  thead.innerHTML = `<span class="nav-head-title">Practice &amp; Testing</span><span class="nav-head-count">2</span>`;
  thead.addEventListener("click", () => tsec.classList.toggle("collapsed"));
  const tlist = elh("div", "nav-list");
  const bitem = elh("button", "nav-item tc-nav-item");
  bitem.dataset.id = BUILDER_ID;
  bitem.innerHTML = `<span class="nav-tick"></span><span class="nav-title">🔧 Circuit Builder</span><span class="nav-live" title="interactive">●</span>`;
  bitem.addEventListener("click", openCircuitBuilder);
  tlist.appendChild(bitem);
  const titem = elh("button", "nav-item tc-nav-item");
  titem.dataset.id = TEST_CENTER_ID;
  titem.innerHTML = `<span class="nav-tick"></span><span class="nav-title">🎓 Test Center</span><span class="nav-live" title="interactive">●</span>`;
  titem.addEventListener("click", openTestCenter);
  tlist.appendChild(titem);
  tsec.appendChild(thead);
  tsec.appendChild(tlist);
  nav.appendChild(tsec);

  refreshProgressUI();
}

function setActiveNav(id) {
  document.querySelectorAll(".nav-item").forEach((it) =>
    it.classList.toggle("active", it.dataset.id === id));
}

// Shared depth block (deepDive / failureModes / warStory / quickCheck) — used
// by BOTH the normal teach panel AND the troubleshooting-lab panel, since a
// scenario module (like the capstone) has this content too but renders
// through a different path (renderTroubleshoot, not renderTeach).
function renderDepthSections(t, m) {
  if (m.deepDive) {
    const dd = elh("div", "deep-dive");
    dd.appendChild(elh("div", "mini-label", "Go deeper"));
    (Array.isArray(m.deepDive) ? m.deepDive : [m.deepDive]).forEach((p) =>
      dd.appendChild(elh("p", "dd-p", p)));
    t.appendChild(dd);
  }
  if (Array.isArray(m.failureModes) && m.failureModes.length) {
    const fm = elh("div", "fail-modes");
    fm.appendChild(elh("div", "mini-label", "When it fails on the floor"));
    const ul = elh("ul", "fm-list");
    m.failureModes.forEach((f) => {
      const li = elh("li", "fm-item");
      if (typeof f === "string") li.textContent = f;
      else li.innerHTML = `<b>${f.symptom || f.mode || ""}</b>${(f.catch || f.find) ? " — " + (f.catch || f.find) : ""}`;
      ul.appendChild(li);
    });
    fm.appendChild(ul);
    t.appendChild(fm);
  }
  if (m.warStory) {
    const ws = elh("div", "war-story");
    ws.innerHTML = `<span class="ws-tag">From the floor</span> ${m.warStory}`;
    t.appendChild(ws);
  }
  if (m.quickCheck) {
    const qcBox = elh("div", "");
    t.appendChild(qcBox);
    renderQuickCheck(qcBox, m);
  }
}

// ---------------------------------------------------------------- teach panel
function renderTeach(m) {
  const t = $("#teach");
  t.innerHTML = "";
  t.appendChild(elh("div", "level-badge level-" + m.level.replace(/\s+/g, "-").toLowerCase(), m.level));
  t.appendChild(elh("h2", "lesson-title", m.title));

  const obj = elh("p", "lesson-objective");
  obj.innerHTML = `<span class="mini-label">Goal</span> ${m.objective}`;
  t.appendChild(obj);

  const expl = elh("p", "lesson-explain", m.plainExplanation);
  t.appendChild(expl);

  renderDepthSections(t, m);

  if (m.interactiveElement && isPlayable(m.id)) {
    const tryit = elh("div", "tryit");
    tryit.innerHTML = `<span class="mini-label">Try it</span> ${m.interactiveElement}`;
    t.appendChild(tryit);
  }

  // Quiz (verified bank). Falls back to the single check question if no quiz
  // file exists. Troubleshoot panel is rendered separately.
  if (!SCENARIOS[m.id]) {
    const quizBox = elh("div", "");
    t.appendChild(quizBox);
    renderQuiz(quizBox, m.id, () => markComplete(m.id)).then((ok) => {
      if (ok) return;
      const check = elh("div", "check-block");
      check.appendChild(elh("div", "mini-label", "Check your understanding"));
      check.appendChild(elh("p", "check-q", m.checkQuestion));
      const btn = elh("button", "btn btn-ghost", "Show answer");
      const ans = elh("p", "check-a hidden", m.checkAnswer);
      btn.addEventListener("click", () => {
        ans.classList.remove("hidden"); btn.classList.add("hidden"); markComplete(m.id);
      });
      check.appendChild(btn); check.appendChild(ans);
      quizBox.appendChild(check);
    });
  }

  // prev / next
  const navRow = elh("div", "lesson-nav-row");
  const idx = App.curriculum.findIndex((x) => x.id === m.id);
  const prev = elh("button", "btn btn-ghost", "‹ Prev");
  const next = elh("button", "btn btn-accent", "Next ›");
  prev.disabled = idx <= 0;
  next.disabled = idx >= App.curriculum.length - 1;
  prev.addEventListener("click", () => loadModule(App.curriculum[idx - 1].id));
  next.addEventListener("click", () => loadModule(App.curriculum[idx + 1].id));
  navRow.appendChild(prev); navRow.appendChild(next);
  t.appendChild(navRow);
}

// ---------------------------------------------------------------- stage
function showPlaceholder(msg) {
  $("#stage").classList.add("hidden");
  const ov = $("#stage-overlay");
  ov.classList.remove("hidden", "rg-wrap");
  ov.style.cssText = "";
  ov.innerHTML = `<div class="placeholder"><div class="ph-icon">⚡</div><p>${msg}</p></div>`;
}
function showStage() {
  const ov = $("#stage-overlay");
  ov.classList.add("hidden");
  ov.classList.remove("rg-wrap");
  ov.style.cssText = "";
  ov.innerHTML = "";
  $("#stage").classList.remove("hidden");
}

// place a meter lead at an exact spot on a conductor. Lead lifecycle:
//   ① first click lands RED (V+)  ② second click lands BLACK (COM)
//   ③ with both placed, the next click WALKS the red lead (hopscotch: black
//     stays parked on common) — and clicking a placed lead's glyph LIFTS it.
// Same-node placements are allowed on purpose: two leads on one wire number
// reading 0 V is the "node identity" lesson, not a bug.
function placeProbe(nodeId, pt) {
  const m = App.meter;
  if (m.probeA == null)      { m.probeA = nodeId; App.probePtA = pt || null; }
  else if (m.probeB == null) { m.probeB = nodeId; App.probePtB = pt || null; }
  else                       { m.probeA = nodeId; App.probePtA = pt || null; }  // red walks
  update();
}

// clicking a placed lead glyph lifts JUST that lead (renderer.onProbeClear)
function clearProbe(kind) {
  if (kind === "a") { App.meter.probeA = null; App.probePtA = null; }
  else              { App.meter.probeB = null; App.probePtB = null; }
  update();
}

function clearProbePts() { App.probePtA = App.probePtB = null; }

function buildStage(circuit) {
  showStage();
  App.circuit = circuit;
  App.view = new CircuitView($("#stage"));
  App.view.enableLeadChip = true;             // lead-status chip, top-left of sheet
  App.view.build(circuit);
  App.view.onTestPointClick = (comp) => {
    const tp = App.view.testPoints.find((t) => t.compId === comp.id);
    placeProbe(comp.terminals.p, tp ? { x: tp.x, y: tp.y } : null);
    App.view.pulseTestPoint(comp.id);
  };
  // probe ANY wire, junction, or component terminal, right on the schematic
  App.view.onWireProbe = (nodeId, pt) => placeProbe(nodeId, pt);
  App.view.onProbeClear = (kind) => clearProbe(kind);
  bindButtons(App.view, {
    onPress: (id) => { App.pressed.add(id); update(); },
    onRelease: (id) => { App.pressed.delete(id); update(); },
  });
}

// ---------------------------------------------------------------- the chokepoint
function update() {
  if (!App.circuit || !App.view) return;
  const input = { pressed: App.pressed, prevCoil: App.prevCoil };
  const st = solve(App.circuit, input);
  App.prevCoil = st.coilEnergized;     // persist coil state so the latch holds
  App.lastState = st;
  App.view.applyState(st);
  App.view.setProbes(App.meter.probeA, App.meter.probeB);
  App.view.setProbeMarkers?.(App.probePtA, App.probePtB);
  App.view.setLeadState?.(App.meter.probeA != null, App.meter.probeB != null);

  const r = App.meter.read(st, App.circuit, input);
  $("#meter-value").textContent = r.display;
  $("#meter-sub").textContent = r.sub;

  // troubleshooting: feed real measurements into the decision tree
  if (App.tsession && App.meter.probeA != null && App.meter.probeB != null) {
    const value = parseFloat(r.display);
    const res = App.tsession.onMeasurement({
      mode: App.meter.mode, probeA: App.meter.probeA, probeB: App.meter.probeB,
      value: isNaN(value) ? null : value,
    });
    if (res.advanced || res.feedback) renderTroubleshoot();
  }
}

// ---------------------------------------------------------------- troubleshooting UI
async function loadScenario(file) {
  App.currentTicketFile = file;
  $("#view-tabs").classList.add("hidden");
  setToolbar(true);
  App.pressed.clear(); App.prevCoil = new Map(); App.meter.reset(); clearProbePts();
  try {
    const sc = await fetchJSON(`data/scenarios/${file}.json`);
    App.tsession = new TroubleshootSession(sc);
    buildStage(applyFaults(sc.circuit, App.tsession.activeFaults()));
    renderTroubleshoot();
    update();
  } catch (e) { console.error(e); }
}

function renderTroubleshoot() {
  const ts = App.tsession;
  const sc = ts.scenario;
  const t = $("#teach");
  t.innerHTML = "";
  t.appendChild(elh("div", "level-badge level-expert", "Troubleshooting Lab"));
  if (App.lab && App.lab.length > 1) {
    const picker = elh("div", "ts-tickets");
    App.lab.forEach((tk) => {
      const active = App.currentTicketFile === tk.file;
      const b = elh("button", "ts-ticket" + (active ? " active" : ""), tk.label);
      // re-clicking the open ticket deals a NEW random fault — say so visibly
      b.title = active ? "Click again: same ticket, new random fault" : "Open this ticket";
      b.addEventListener("click", async () => {
        await loadScenario(tk.file);
        const note = elh("div", "ts-redeal", active ? "🎲 New fault dealt — same ticket, different problem." : "");
        if (active) { $("#teach").insertBefore(note, $("#teach").children[2] || null); setTimeout(() => note.remove(), 3500); }
      });
      picker.appendChild(b);
    });
    t.appendChild(picker);
  }
  t.appendChild(elh("h2", "lesson-title", sc.title));

  const sym = elh("div", "symptom");
  sym.innerHTML = `<span class="mini-label">${ts.deductive ? "Work order" : "Reported symptom"}</span> ${ts.deductive ? (sc.workOrder || sc.symptom) : sc.symptom}`;
  t.appendChild(sym);
  if (ts.deductive) {
    const guide = elh("div", "ts-guide");
    guide.innerHTML = `${sc.symptom} The station is <b>LIVE</b> — press Start, watch the lamps, probe the test points with the meter, then make the call below.`;
    t.appendChild(guide);
  }

  const node = ts.node();
  if (node && !ts.solved) {
    if (node.say) t.appendChild(elh("p", "ts-say", node.say));
    if (node.expect) {
      const m = elh("div", "ts-measure");
      m.innerHTML = `<span class="mini-label">Take a measurement</span> Probe the two points this step asks about with the meter below.`;
      t.appendChild(m);
      if (node.hint) t.appendChild(elh("p", "ts-hint", "Hint: " + node.hint));
    }
    if (node.options) {
      const opts = elh("div", "ts-options");
      node.options.forEach((o, i) => {
        const b = elh("button", "btn btn-ghost ts-opt", o.label);
        b.addEventListener("click", () => {
          const r = ts.chooseOption(i);
          if (r && r.feedback) showTSFeedback(r.feedback, r.advanced);
          renderTroubleshoot();
        });
        opts.appendChild(b);
      });
      t.appendChild(opts);
    }
  }

  // diagnosis submission
  const dx = elh("div", "ts-diagnose");
  dx.appendChild(elh("div", "mini-label", "Submit your diagnosis"));
  const compSel = elh("select", "ts-select");
  compSel.id = "dx-comp";
  for (const o of sc.diagnosisOptions || []) {
    const opt = elh("option", null, `${o.component} — ${FAULT_LABEL[o.kind] || o.kind}`);
    opt.value = JSON.stringify(o);
    compSel.appendChild(opt);
  }
  dx.appendChild(compSel);
  const submit = elh("button", "btn btn-accent", "Check my diagnosis");
  submit.addEventListener("click", () => {
    const pick = JSON.parse($("#dx-comp").value);
    const res = ts.submitDiagnosis(pick.component, pick.kind);
    showDiagnosisResult(res);
  });
  dx.appendChild(submit);
  t.appendChild(dx);
  t.appendChild(elh("div", "ts-feedback", ""));

  // curriculum depth (deepDive/failureModes/warStory/quickCheck) lives on the
  // MODULE (App.current), not the scenario JSON — show it below the live ticket.
  if (App.current) renderDepthSections(t, App.current);
}

function showTSFeedback(msg, good) {
  const fb = $(".ts-feedback");
  if (fb) { fb.textContent = msg; fb.className = "ts-feedback " + (good ? "good" : "warn"); }
}

function showDiagnosisResult(res) {
  const t = $("#teach");
  const ts = App.tsession;
  const box = elh("div", "dx-result " + (res.correct ? "ok" : res.partial ? "partial" : "bad"));
  box.appendChild(elh("div", "dx-score", `${res.score}%`));
  box.appendChild(elh("p", null,
    res.correct ? "Correct — you found it." :
    res.partial ? "Right component, wrong failure mode. Keep going." :
    "Not it — that part tested good. Back to the meter."));
  box.appendChild(elh("p", "dx-explain", res.explanation));

  // scorecard — how the tech worked the call
  const card = elh("div", "dx-card");
  card.innerHTML =
    `<span>Measurements <b>${res.measurements | 0}</b></span>` +
    `<span>Wrong calls <b>${res.partSwaps | 0}</b></span>` +
    `<span>LOTO <b>${res.loto ? "✓" : "—"}</b></span>`;
  box.appendChild(card);

  if (res.correct) {
    const fix = elh("button", "btn btn-accent", "Apply the fix ▶ watch it run");
    fix.disabled = !ts.lotoApplied;
    if (!ts.lotoApplied) {
      box.appendChild(elh("p", "dx-note", "You don't put hands on a part while it's hot. Lock it out first."));
      const loto = elh("button", "btn btn-ghost", "🔒 Apply Lock & Tag");
      loto.addEventListener("click", () => {
        ts.applyLoto();
        loto.disabled = true; loto.textContent = "🔒 Locked & Tagged";
        fix.disabled = false;
      });
      box.appendChild(loto);
    }
    fix.addEventListener("click", () => {
      App.circuit = clearFaults(App.circuit);
      App.prevCoil = new Map();
      buildStage(App.circuit);
      update();
      markComplete(App.current.id);
      box.appendChild(elh("p", "dx-fixed", "Fixed — press Start, the station comes back to life. Now go find WHY it failed."));
      const again = elh("button", "btn btn-ghost", "↻ New fault — run the ticket again");
      again.addEventListener("click", () => loadScenario(App.currentTicketFile));
      box.appendChild(again);
      fix.disabled = true;
    });
    box.appendChild(fix);
  } else {
    box.appendChild(elh("p", "dx-note", "Take another reading and submit again when you're sure."));
  }
  const old = $(".dx-result"); if (old) old.remove();
  // the verdict must land where the user is LOOKING — right under the Check
  // button — not at the bottom of the teach panel below all the Go Deeper
  // prose (that rendered ~4000px out of view and read as "nothing happened")
  const dxBox = t.querySelector(".ts-diagnose");
  if (dxBox) t.insertBefore(box, dxBox.nextSibling);
  else t.appendChild(box);
  box.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

// ---------------------------------------------------------------- view switcher
function setToolbar(show) {
  const tb = document.querySelector(".toolbar");
  if (tb) tb.style.display = show ? "" : "none";
}

function renderViewTabs(views, activeIdx) {
  const bar = $("#view-tabs");
  bar.innerHTML = "";
  bar.classList.toggle("hidden", views.length <= 1);
  views.forEach((v, i) => {
    const b = elh("button", "view-tab" + (i === activeIdx ? " active" : ""), v.label || v.kind);
    b.addEventListener("click", () => selectView(i));
    bar.appendChild(b);
  });
}

async function selectView(i) {
  if (!App.views || !App.views[i]) return;
  App.viewIndex = i;
  document.querySelectorAll("#view-tabs .view-tab")
    .forEach((b, bi) => b.classList.toggle("active", bi === i));
  await showView(App.views[i]);
}

// render one view into the stage. schematic uses the circuit engine; everything
// else is a media view (photo / cutaway / cut sheet / 3D / gallery / slide).
async function showView(view) {
  const ov = $("#stage-overlay");
  // Field Wiring is a full-stage experience on narrow shells (same rule as
  // Builder/Test Center): its explainer lives inside the view, so the teach
  // band yields its height there. Inert at wide widths; other tabs restore it.
  document.body.classList.toggle("overlay-max", view.kind === "wiring");
  switch (view.kind) {
    case "schematic":
      setToolbar(true);
      App.pressed.clear(); App.prevCoil = new Map(); App.meter.reset(); clearProbePts();
      buildStage(view.circuit);                 // showStage() runs inside
      update();
      break;
    case "cutaway":
      setToolbar(false);
      showStage();                              // svg visible, overlay cleared
      App.circuit = null; App.view = null;
      renderRelayAnatomy($("#stage"));
      break;
    case "gallery":
      setToolbar(false);
      App.circuit = null; App.view = null;
      $("#stage").classList.add("hidden");
      renderRelayGallery(ov);
      break;
    case "custom": {  // self-contained interactive lesson module: render(host)
      setToolbar(false); App.circuit = null; App.view = null;
      $("#stage").classList.add("hidden");
      ov.classList.remove("hidden", "rg-wrap");
      ov.style.cssText = "display:block; overflow:auto;";
      ov.innerHTML = "";
      try { view.render(ov); }
      catch (e) { console.error("custom view error", e); ov.innerHTML = '<div class="placeholder"><div class="ph-icon">⚡</div><p>This interactive failed to load.</p></div>'; }
      break;
    }
    case "wiring": {  // the print + the physical panel wiring, one live engine
      setToolbar(true);                       // meter + reset stay fully usable
      App.pressed.clear(); App.prevCoil = new Map(); App.meter.reset(); clearProbePts();
      App.tsession = null;
      $("#stage").classList.add("hidden");
      ov.classList.remove("hidden", "rg-wrap");
      ov.style.cssText = "display:block; overflow:auto; padding:0;";
      ov.innerHTML = "";
      if (!view.circuit && LESSON_CIRCUITS[App.current.id]) {
        try { view.circuit = (await fetchJSON(`data/lessons/${LESSON_CIRCUITS[App.current.id]}.json`)).circuit; }
        catch (e) { console.error(e); }
      }
      const press = (id) => { App.pressed.add(id); update(); };
      const release = (id) => { App.pressed.delete(id); update(); };
      const fw = renderFieldWiring(ov, {
        circuit: view.circuit, spec: view.spec, caption: view.caption,
        onPress: press, onRelease: release,          // panel buttons drive solve() too
      });
      // schematic pane = a full CircuitView on the SAME chokepoint as the
      // normal schematic view: probing feeds the meter, buttons feed update().
      App.circuit = view.circuit;
      App.view = new CircuitView(fw.schemSvg);
      App.view.enableLeadChip = true;
      App.view.build(view.circuit);
      App.view.onTestPointClick = (comp) => {
        const tp = App.view.testPoints.find((t) => t.compId === comp.id);
        placeProbe(comp.terminals.p, tp ? { x: tp.x, y: tp.y } : null);
        App.view.pulseTestPoint(comp.id);
      };
      App.view.onWireProbe = (nodeId, pt) => placeProbe(nodeId, pt);
      App.view.onProbeClear = (kind) => clearProbe(kind);
      bindButtons(App.view, { onPress: press, onRelease: release });
      // every solve() lights BOTH panes: wrap applyState so update() needs no
      // wiring-specific branch of its own
      const baseApply = App.view.applyState.bind(App.view);
      App.view.applyState = (st) => { baseApply(st); fw.applyState(st); };
      update();
      break;
    }
    case "dual": {    // realistic part + schematic, click-linked (Phase C)
      setToolbar(false); App.circuit = null; App.view = null;
      $("#stage").classList.add("hidden");
      ov.classList.remove("hidden", "rg-wrap");
      ov.style.cssText = "display:block; overflow:auto; padding:0;";
      ov.innerHTML = "";
      if (!view.circuit && LESSON_CIRCUITS[App.current.id]) {
        try { view.circuit = (await fetchJSON(`data/lessons/${LESSON_CIRCUITS[App.current.id]}.json`)).circuit; }
        catch (e) { console.error(e); }
      }
      renderDualView(ov, view);
      break;
    }
    case "illustration": {  // standalone labeled real-part diagram — no schematic to pair with
      setToolbar(false); App.circuit = null; App.view = null;
      $("#stage").classList.add("hidden");
      ov.classList.remove("hidden", "rg-wrap");
      ov.style.cssText = "display:block; overflow:auto; padding:0;";
      // per-layout facts — pin numbers verified against the AutomationDirect
      // cut sheets (78 series tREL-20 wiring diagrams + 750R tREL-29 sockets)
      const RELAY_FACTS = {
        spdt5: {
          coil: "A1(+) blade 13 to A2(−) blade 14 — the electromagnet gets its own two blades at the bottom of the 5-blade base.",
          pole1: "The one pole: common blade 9 (IEC 11) rides the NC blade 1 (12) at rest; energize the coil and it swings to NO blade 5 (14). One pole, two destinations.",
        },
        dpdt8: {
          coil: "A1(+) to A2(−), pins 2 and 7 — the electromagnet. Feed it rated voltage and every pole below snaps over at once.",
          pole1: "Pole 1: common pin 1, NC pin 4, NO pin 3. At rest the common rides the NC; energize the coil and it swings to the NO.",
          pole2: "Pole 2: common pin 8, NC pin 5, NO pin 6 — an independent, isolated copy of pole 1, moved by the same armature.",
        },
        "3pdt11": {
          coil: "A1(+) pin 2 to A2(−) pin 10 — same electromagnet idea, 11-pin octal base. One coil throws all three poles together.",
          pole1: "Pole 1: common pin 1, NC pin 4, NO pin 3 — the same trio you know from the 8-pin base.",
          pole2: "Pole 2: common pin 6, NC pin 5, NO pin 7 — an isolated copy moved by the same armature.",
          pole3: "Pole 3: common pin 11, NC pin 8, NO pin 9 — three poles = three separate circuits switched at once.",
        },
        "4pdt14": {
          coil: "A1(+) blade 13 to A2(−) blade 14 — one coil at the bottom of the 14-blade base drives all four poles.",
          pole1: "Pole 1: NC blade 1, NO blade 5, common blade 9 — read the rows: NC across the top, NO in the middle, commons below.",
          pole2: "Pole 2: NC blade 2, NO blade 6, common blade 10 — second isolated circuit on the same armature.",
          pole3: "Pole 3: NC blade 3, NO blade 7, common blade 11 — third isolated circuit.",
          pole4: "Pole 4: NC blade 4, NO blade 8, common blade 12. Four poles × 3 contacts + 2 coil blades = why this base needs 14.",
        },
      };
      const CONTACTOR_FACTS = {
        coil: "A1/A2 — the 24VDC coil terminals. The ONLY part of this device your control circuit touches.",
        pole1: "Pole 1 — line 1/L1 in, load 2/T1 out. One of three main power poles that close together.",
        pole2: "Pole 2 — 3/L2 over 4/T2. Same armature, isolated circuit.",
        pole3: "Pole 3 — 5/L3 over 6/T3. Three poles = three phases switched at once.",
        auxNO: "13-14 — the auxiliary NO contact. Pilot-duty: your seal-in and Running light live here, not motor current.",
      };
      const LAYOUTS = [
        ["spdt5", "SPDT · 5 blades"],
        ["dpdt8", "DPDT · 8-pin octal"],
        ["3pdt11", "3PDT · 11-pin"],
        ["4pdt14", "4PDT · 14 blades"],
      ];
      const family = view.partType === "relay-family";
      ov.innerHTML = `<div class="dv-root"><div class="dv-head"><span class="dv-eyebrow">REAL PART · LABELED</span>
        <p class="dv-sub">${view.caption || ""}</p></div>
        ${family ? `<div class="view-tabs" style="margin:0 18px 12px; align-self:flex-start;">${LAYOUTS.map(([k, l]) =>
          `<button class="view-tab il-lay-btn" data-layout="${k}">${l}</button>`).join("")}</div>` : ""}
        <div class="dv-pane" style="height:560px"><div class="dv-pane-label">Real Part</div><svg class="dv-real-svg"></svg></div></div>`;
      const svgHost = ov.querySelector(".dv-real-svg");
      const factBox = document.createElement("div");
      factBox.className = "dv-sub";
      factBox.style.cssText = "margin:10px 18px 16px; padding:10px 14px; background:var(--violet-soft,#F3EFFF); border:1px solid #D9CCFF; border-radius:10px;";
      ov.querySelector(".dv-root").appendChild(factBox);
      const PART_LAYOUT = { "octal-relay": "dpdt8", spdt5: "spdt5", "3pdt11": "3pdt11", "4pdt14": "4pdt14" };
      if (family) {
        // build ALL four layouts once and swap visibility — every hotspot and
        // energize toggle stays alive (and each base keeps its own state)
        const pane = ov.querySelector(".dv-pane");
        const svgs = {};
        for (const [k] of LAYOUTS) {
          const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          s.setAttribute("class", "dv-real-svg");
          s.style.display = "none";
          pane.appendChild(s);
          svgs[k] = s;
          const FACTS = RELAY_FACTS[k];
          let ill;
          const onKey = (key) => { ill.clearAll(); ill.setHighlight(key, true); factBox.textContent = FACTS[key] || key; };
          ill = buildRelayPinout(s, onKey, { layout: k });
        }
        svgHost.remove();
        const INTRO = {
          spdt5: "SPDT · 5 blades — one pole: common 9, NC 1, NO 5; coil on 13/14.",
          dpdt8: "DPDT · 8-pin octal — two poles: 1/4/3 and 8/5/6; coil on pins 2/7.",
          "3pdt11": "3PDT · 11-pin octal — three poles: 1/4/3, 6/5/7, 11/8/9; coil on pins 2/10.",
          "4pdt14": "4PDT · 14 blades — four pole columns: NC 1-4, NO 5-8, commons 9-12; coil on 13/14.",
        };
        const pick = (k) => {
          for (const kk in svgs) svgs[kk].style.display = kk === k ? "" : "none";
          factBox.textContent = `${INTRO[k]} Click a zone to identify it, or hit ENERGIZE.`;
          ov.querySelectorAll(".il-lay-btn").forEach((b) => b.classList.toggle("active", b.dataset.layout === k));
        };
        const def = view.layout || "spdt5";
        for (const kk in svgs) svgs[kk].style.display = kk === def ? "" : "none";
        ov.querySelectorAll(".il-lay-btn").forEach((b) => {
          b.classList.toggle("active", b.dataset.layout === def);
          b.addEventListener("click", () => pick(b.dataset.layout));
        });
        factBox.textContent = "Pick a base above — click any highlighted zone to identify it, or hit ENERGIZE and watch the blades swing NC → NO.";
      } else {
        const layout = PART_LAYOUT[view.partType] || "contactor";
        const isContactor = layout === "contactor";
        const FACTS = isContactor ? CONTACTOR_FACTS : RELAY_FACTS[layout];
        factBox.textContent = isContactor
          ? "Click any highlighted zone on the part to identify it."
          : "Click any highlighted zone to identify it — then hit ENERGIZE and watch the blades swing NC → NO.";
        let ill;
        const onKey = (key) => { ill.clearAll(); ill.setHighlight(key, true); factBox.textContent = FACTS[key] || key; };
        ill = isContactor ? buildContactorIllustration(svgHost, onKey)
                          : buildRelayPinout(svgHost, onKey, { layout });
      }
      break;
    }
    case "photo":     setToolbar(false); App.circuit = null; App.view = null; renderPhotoView(ov, view); break;
    case "hotphoto":  setToolbar(false); App.circuit = null; App.view = null; renderHotPhoto(ov, view); break;
    case "parts":     setToolbar(false); App.circuit = null; App.view = null; await renderPartsStrip(ov, view); break;
    case "photogrid": setToolbar(false); App.circuit = null; App.view = null; renderPhotoGrid(ov, view); break;
    case "cutsheet":  setToolbar(false); App.circuit = null; App.view = null; await renderCutSheet(ov, view); break;
    case "model3d":   setToolbar(false); App.circuit = null; App.view = null; renderModel3D(ov, view); break;
    case "slide":     setToolbar(false); App.circuit = null; App.view = null; renderSlide(ov, view); break;
  }
}

// ---------------------------------------------------------------- test center
// Renders the exam hub into the stage overlay (same pattern as the "custom"
// views) and a short "how exams work" card into the teach panel. Deliberately
// does NOT go through loadModule/composeViews — the lesson flow stays intact.
function openTestCenter() {
  App.current = null;
  App.tsession = null;
  App.circuit = null;
  App.view = null;
  App.pressed.clear(); App.prevCoil = new Map(); App.meter.reset(); clearProbePts();
  setActiveNav(TEST_CENTER_ID);
  document.body.classList.add("overlay-max");   // narrow shells: full-height stage
  $("#view-tabs").classList.add("hidden");
  setToolbar(false);
  $("#stage").classList.add("hidden");
  const ov = $("#stage-overlay");
  ov.classList.remove("hidden", "rg-wrap");
  ov.style.cssText = "display:block; overflow:auto;";
  ov.innerHTML = "";
  renderTestCenter(ov);
  renderTestCenterTeach();
}

function renderTestCenterTeach() {
  const t = $("#teach");
  t.innerHTML = "";
  t.appendChild(elh("div", "level-badge tc-lbl12", "Testing"));
  t.appendChild(elh("h2", "lesson-title", "How exams work"));
  const obj = elh("p", "lesson-objective");
  obj.innerHTML = `<span class="mini-label tc-lbl12">Goal</span> Prove a level under exam conditions — no answer reveals until you finish.`;
  t.appendChild(obj);
  const ul = elh("ul", "tc-teach-list");
  [
    "Each level has its own exam; questions are dealt at random from that level's lesson quizzes. The Final Exam samples the whole course.",
    "One question at a time. Move with Prev / Next, jump with the numbered dots, and 🚩 flag anything you want to revisit before finishing.",
    "80% or better passes. The grade screen shows every question — your answer vs the correct one, and why.",
    "Retake deals a fresh random set. Only your BEST score per exam is kept (saved on this computer).",
  ].forEach((s) => ul.appendChild(elh("li", "tc-teach-item", s)));
  t.appendChild(ul);
}

// ---------------------------------------------------------------- circuit builder
// Renders the design-your-own-circuit studio into the stage overlay (exact
// same pattern as openTestCenter) plus a "how it works" card in the teach
// panel. The lesson flow stays untouched.
function openCircuitBuilder() {
  App.current = null;
  App.tsession = null;
  App.circuit = null;
  App.view = null;
  App.pressed.clear(); App.prevCoil = new Map(); App.meter.reset(); clearProbePts();
  setActiveNav(BUILDER_ID);
  document.body.classList.add("overlay-max");   // narrow shells: full-height stage
  $("#view-tabs").classList.add("hidden");
  setToolbar(false);
  $("#stage").classList.add("hidden");
  const ov = $("#stage-overlay");
  ov.classList.remove("hidden", "rg-wrap");
  ov.style.cssText = "display:block; overflow:hidden;";
  ov.innerHTML = "";
  renderBuilder(ov);
  renderBuilderTeach();
}

function renderBuilderTeach() {
  const t = $("#teach");
  t.innerHTML = "";
  t.appendChild(elh("div", "level-badge tc-lbl12", "Practice"));
  t.appendChild(elh("h2", "lesson-title", "Design your own circuit"));
  const obj = elh("p", "lesson-objective");
  obj.innerHTML = `<span class="mini-label tc-lbl12">Goal</span> Go from reading prints to DRAWING them — build any control circuit from parts and watch it run on the real engine.`;
  t.appendChild(obj);
  const ul = elh("ul", "tc-teach-list");
  [
    "PLACE: click a part in the left palette, then click the canvas grid. Parts auto-label like a real print (S1, CR1, PL1…).",
    "WIRE: click one terminal dot, then another — that's a wire. Amber dots are still unwired. Click any wire to disconnect a leg.",
    "CONTACTS: every NO/NC contact carries a violet coil chip — click it to pick which relay coil drives that contact.",
    "EDIT: drag parts to move them, click to select (Delete key or ✕ removes), double-click to rename.",
    "The LIVE CHECKS panel re-inspects after every edit: shorts across the source, unwired terminals, dead loads, missing coils. All green = ready.",
    "Flip to ▶ RUN and it's a live circuit: press your buttons, latches latch, and the meter probes any wire, junction, or terminal.",
    "Prove it with the three CHALLENGES — the grader runs your circuit through the real solver, requirement by requirement.",
    "Designs save on this computer automatically; Export/Import moves them as JSON.",
  ].forEach((s) => ul.appendChild(elh("li", "tc-teach-item", s)));
  t.appendChild(ul);
}

// ---------------------------------------------------------------- load a module
async function loadModule(id, startView = 0) {
  const m = App.byId.get(id);
  if (!m) return;
  document.body.classList.remove("overlay-max");   // lessons show the teach band again
  App.current = m;
  App.pressed.clear();
  App.prevCoil = new Map();
  App.meter.reset(); clearProbePts();
  App.tsession = null;
  setActiveNav(id);

  // Troubleshooting Lab: open on a random ticket; the learner can switch tickets.
  if (SCENARIO_LAB[id]) {
    App.lab = SCENARIO_LAB[id];
    const want = App._wantTicket; App._wantTicket = null;   // one-shot deep-link
    const tk = (want && App.lab.find((x) => x.file === want))
      || App.lab[Math.floor(Math.random() * App.lab.length)];
    await loadScenario(tk.file);
    return;
  }

  renderTeach(m);

  const views = composeViews(id);
  // preload the schematic circuit so flipping back to it is instant
  for (const v of views) {
    if (v.kind === "schematic" && !v.circuit && LESSON_CIRCUITS[id]) {
      try { v.circuit = (await fetchJSON(`data/lessons/${LESSON_CIRCUITS[id]}.json`)).circuit; }
      catch (e) { console.error(e); }
    }
  }
  App.views = views;
  const start = Math.max(0, Math.min(startView | 0, views.length - 1));
  App.viewIndex = start;

  if (!views.length) {
    $("#view-tabs").classList.add("hidden");
    setToolbar(false);
    showPlaceholder("The interactive views for this lesson arrive in the next build. The full teaching text is on the right — read it, then hit Next.");
    return;
  }
  renderViewTabs(views, start);
  await showView(views[start]);
}

// ---------------------------------------------------------------- toolbar
function wireToolbar() {
  document.querySelectorAll(".meter-mode").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".meter-mode").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      App.meter.setMode(b.dataset.mode);   // mode change lifts both leads…
      clearProbePts();                     // …so the glyphs must lift too
      update();
    });
  });
  $("#btn-reset").addEventListener("click", () => {
    App.pressed.clear(); App.prevCoil = new Map(); App.meter.reset(); clearProbePts();
    if (App.current) loadModule(App.current.id);
  });
}

async function fetchJSON(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`fetch ${path} -> ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- boot
async function init() {
  if (location.protocol === "file:") {
    $("#filewarn").classList.remove("hidden");
    $("#app").classList.add("hidden");
    return;
  }
  try {
    App.curriculum = await fetchJSON("data/curriculum.json");
  } catch (e) {
    showPlaceholder("Could not load the course data. Make sure you launched with run_training.bat.");
    console.error(e);
    return;
  }
  for (const m of App.curriculum) App.byId.set(m.id, m);
  buildNav();
  wireToolbar();
  // open a deep-linked lesson (?lesson=<id>) or the first interactive one
  const firstLive = App.curriculum.find((m) => LESSON_CIRCUITS[m.id]) || App.curriculum[0];
  const params = new URLSearchParams(location.search);
  const want = params.get("lesson");
  const startView = parseInt(params.get("view") || "0", 10) || 0;
  App._wantTicket = params.get("ticket") || null;
  if (want === TEST_CENTER_ID) { openTestCenter(); return; }   // ?lesson=test-center deep link
  if (want === BUILDER_ID) { openCircuitBuilder(); return; }   // ?lesson=circuit-builder deep link
  loadModule(want && App.byId.has(want) ? want : firstLive.id, startView);
}

document.addEventListener("DOMContentLoaded", init);
