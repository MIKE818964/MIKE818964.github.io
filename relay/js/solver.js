// =============================================================================
// solver.js — the electrical engine. PURE FUNCTIONS, no DOM, unit-testable.
//
// Models IDEAL SWITCHING (full source voltage across the series load; we do NOT
// solve resistor networks — exactly how relay control logic behaves, BUILD_SPEC §5).
//
// solve(circuit, input) -> {
//   coilEnergized : Map coilId   -> bool
//   contactClosed : Map compId   -> bool   (every contact/button, for rendering)
//   loadOn        : Map compId   -> bool   (bulbs, motors lit)
//   damaged       : Map compId   -> bool   ("let the smoke out")
//   posSet,negSet : Set nodeId            (flood from source +/-)
//   flowNodes     : Set nodeId            (nodes on a real current-carrying path)
//   flowEdges     : Set compId            (components carrying current — bright glow)
//   potential     : Map nodeId   -> volts (for the virtual multimeter)
//   converged     : bool
// }
// input = { pressed:Set<compId>, timers?:Map<compId,bool> }
// =============================================================================

import { TWO_TERM, isLoad, edgeNodes, indexCircuit, normalizeCircuit } from "./model.js";

const MAX_ITERS = 8;

function faultKind(comp) {
  return comp.fault && comp.fault.kind ? comp.fault.kind : null;
}

// Is this component's edge a conductor right now? `loadAsWire` lets the
// current-path pass treat energized loads as conductors.
function conducts(comp, ctx, loadAsWire) {
  const fk = faultKind(comp);
  if (fk === "broken_wire" || fk === "loose_terminal") return false;

  switch (comp.type) {
    case "fuse":
      return fk !== "blown_fuse";
    case "pushbutton": {
      if (fk === "welded_closed") return true;   // contacts welded shut
      if (fk === "stuck_open") return false;      // contacts stuck open / not making
      const pressed = ctx.pressed.has(comp.id);
      let contact = comp.contact === "NC" ? "NC" : "NO";
      if (fk === "swapped_no_nc") contact = contact === "NC" ? "NO" : "NC";  // wired backwards
      return contact === "NO" ? pressed : !pressed;
    }
    case "contact_no":
    case "contact_nc": {
      let type = comp.type;
      if (fk === "swapped_no_nc") type = type === "contact_no" ? "contact_nc" : "contact_no";
      if (fk === "welded_closed") return true;
      if (fk === "stuck_open") return false;
      const energized = comp.coil ? !!ctx.coilEnergized.get(comp.coil) : false;
      return type === "contact_no" ? energized : !energized;
    }
    case "coil":
    case "timer_coil":
    case "bulb":
    case "motor":
    case "motor_starter":
      // A load: only conductive when we are tracing real current loops.
      return !!loadAsWire;
    case "source":
      return false; // the EMF boundary; never trace through it
    default:
      return false;
  }
}

// Flood-fill node ids reachable from `start` using only currently-conductive
// edges. `loadAsWire` includes energized loads as conductors.
function flood(start, circuit, ctx, loadAsWire) {
  const adj = buildAdj(circuit, ctx, loadAsWire);
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const n = stack.pop();
    for (const m of adj.get(n) || []) {
      if (!seen.has(m)) {
        seen.add(m);
        stack.push(m);
      }
    }
  }
  return seen;
}

function buildAdj(circuit, ctx, loadAsWire) {
  const adj = new Map();
  const add = (a, b) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push(b);
  };
  for (const n of circuit.nodes) if (!adj.has(n.id)) adj.set(n.id, []);
  for (const comp of circuit.components) {
    if (comp.type === "source") continue;
    const en = edgeNodes(comp);
    if (!en) continue;
    if (conducts(comp, ctx, loadAsWire)) {
      add(en[0], en[1]);
      add(en[1], en[0]);
    }
  }
  return adj;
}

function voltageMatch(coil, source) {
  if (!source) return false;
  const want = coil.ratedVolts;
  const wantType = coil.ratedCurrent || "DC";
  if (source.current !== wantType) return false;          // DC vs AC mismatch: won't pull in
  if (want == null) return true;
  return Math.abs(source.volts - want) <= want * 0.25;    // within 25%
}

export function solve(circuit, input) {
  const c = normalizeCircuit(circuit);
  const { compById, source } = indexCircuit(c);
  const pressed = (input && input.pressed) || new Set();
  const srcPos = source ? source.terminals.pos : null;
  const srcNeg = source ? source.terminals.neg : null;

  // Seed coil states from the PREVIOUS tick so a seal-in latch holds after the
  // Start button is released (the circuit is bistable; history picks the branch).
  const prevCoil = input && input.prevCoil ? new Map(input.prevCoil) : new Map();
  const ctx = { pressed, coilEnergized: prevCoil };
  const damaged = input && input.prevDamaged ? new Map(input.prevDamaged) : new Map();

  // ---- STEP 3: coil -> contact feedback, resolved by fixed-point iteration ----
  let converged = false;
  let posSet = new Set(), negSet = new Set();
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    posSet = srcPos ? flood(srcPos, c, ctx, false) : new Set();
    negSet = srcNeg ? flood(srcNeg, c, ctx, false) : new Set();

    const next = new Map();
    for (const comp of c.components) {
      if (comp.type !== "coil" && comp.type !== "timer_coil") continue;
      if (damaged.get(comp.id)) { next.set(comp.id, false); continue; }
      const en = edgeNodes(comp);
      const bridges =
        (posSet.has(en[0]) && negSet.has(en[1])) ||
        (posSet.has(en[1]) && negSet.has(en[0]));
      let on = bridges;
      // an open winding (open_coil -> broken_wire, or a loose coil terminal) cannot
      // pull in even with full voltage present across it — the classic "24V at the
      // coil but it won't actuate" fault.
      const cfk = faultKind(comp);
      if (cfk === "broken_wire" || cfk === "loose_terminal") on = false;
      if (on && !voltageMatch(comp, source)) {
        // too-high control voltage (wrong_coil_voltage over-volt) => smoke, dead forever
        if (faultKind(comp) === "wrong_coil_voltage" && source && comp.ratedVolts != null &&
            source.volts > comp.ratedVolts * 1.25) {
          damaged.set(comp.id, true);
        }
        on = false; // mismatch never actuates
      }
      // associate by coil id: a coil's "coilId" used by contacts is its own component id
      next.set(comp.id, on);
    }
    // settle: compare to previous
    let same = next.size === ctx.coilEnergized.size;
    if (same) for (const [k, v] of next) if (ctx.coilEnergized.get(k) !== v) { same = false; break; }
    ctx.coilEnergized = next;
    if (same) { converged = true; break; }
  }

  // ---- Final contact states (for rendering blades) ----
  const contactClosed = new Map();
  for (const comp of c.components) {
    if (comp.type === "contact_no" || comp.type === "contact_nc" || comp.type === "pushbutton") {
      contactClosed.set(comp.id, conducts(comp, ctx, false));
    }
  }

  // ---- STEP 2: which loads are energized (bridge pos <-> neg) ----
  const loadOn = new Map();
  for (const comp of c.components) {
    if (!isLoad(comp)) continue;
    if (comp.type === "coil" || comp.type === "timer_coil") {
      loadOn.set(comp.id, !!ctx.coilEnergized.get(comp.id));
      continue;
    }
    const en = edgeNodes(comp);
    if (!en) { loadOn.set(comp.id, false); continue; }
    const on =
      (posSet.has(en[0]) && negSet.has(en[1])) ||
      (posSet.has(en[1]) && negSet.has(en[0]));
    loadOn.set(comp.id, on);
  }

  // ---- Current-carrying edges (bright glow + flow): an edge is on a real
  // srcPos->srcNeg loop through an energized load. We test each conductive edge:
  // does srcPos reach one end and srcNeg reach the other WITHOUT using that edge,
  // in the graph that includes energized loads as conductors? ----
  const flowEdges = new Set();
  const flowNodes = new Set();
  if (srcPos && srcNeg) {
    const ctxFlow = { pressed, coilEnergized: ctx.coilEnergized };
    for (const comp of c.components) {
      if (comp.type === "source") continue;
      const en = edgeNodes(comp);
      if (!en) continue;
      // load conducts only if energized; switch conducts per state
      const cond = isLoad(comp) ? !!loadOn.get(comp.id) : conducts(comp, ctxFlow, false);
      if (!cond) continue;
      if (edgeOnLoop(c, ctxFlow, comp, en, srcPos, srcNeg, loadOn)) {
        flowEdges.add(comp.id);
        flowNodes.add(en[0]);
        flowNodes.add(en[1]);
      }
    }
  }

  // ---- Node potentials for the meter ----
  // Real-meter physics: a branch carrying NO current has NO drop across its
  // load, so a de-energized winding passes rail potential like plain wire
  // (that is why hopscotch reads full volts across a broken return wire).
  // Energized loads DO drop the whole supply, so they block the spread. A
  // metallic tie to the negative rail always pins a node to 0.
  const potential = new Map();
  const v = source ? source.volts : 0;
  let hotSet = posSet;
  if (srcPos) {
    const adj = new Map();
    const add = (a, b) => { if (!adj.has(a)) adj.set(a, []); adj.get(a).push(b); };
    for (const n of c.nodes) if (!adj.has(n.id)) adj.set(n.id, []);
    for (const comp of c.components) {
      if (comp.type === "source") continue;
      const en = edgeNodes(comp);
      if (!en) continue;
      const cond = isLoad(comp)
        ? (!loadOn.get(comp.id) && conducts(comp, ctx, true))
        : conducts(comp, ctx, false);
      if (!cond) continue;
      add(en[0], en[1]); add(en[1], en[0]);
    }
    hotSet = new Set([srcPos]);
    const stack = [srcPos];
    while (stack.length) {
      const n = stack.pop();
      for (const m of adj.get(n) || []) {
        if (hotSet.has(m) || negSet.has(m)) continue;
        hotSet.add(m); stack.push(m);
      }
    }
  }
  for (const n of c.nodes) potential.set(n.id, !negSet.has(n.id) && hotSet.has(n.id) ? v : 0);

  return {
    coilEnergized: ctx.coilEnergized,
    contactClosed,
    loadOn,
    damaged,
    posSet,
    negSet,
    flowNodes,
    flowEdges,
    potential,
    converged,
    sourceVolts: v,
    sourceType: source ? source.current : "DC",
  };
}

// Graph with energized loads + closed switches as conductors, minus one edge.
function buildFlowAdjExcluding(circuit, ctx, exclude, loadOn) {
  const adj = new Map();
  const add = (a, b) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); };
  for (const n of circuit.nodes) adj.set(n.id, []);
  for (const comp of circuit.components) {
    if (comp.type === "source" || comp.id === exclude.id) continue;
    const en = edgeNodes(comp);
    if (!en) continue;
    const cond = isLoad(comp) ? !!loadOn.get(comp.id) : conducts(comp, ctx, false);
    if (!cond) continue;
    add(en[0], en[1]);
    add(en[1], en[0]);
  }
  return adj;
}

function reachable(adj, start, goal) {
  if (start === goal) return true;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const n = stack.pop();
    for (const m of adj.get(n) || []) {
      if (m === goal) return true;
      if (!seen.has(m)) { seen.add(m); stack.push(m); }
    }
  }
  return false;
}

// Continuity test (meter ohms/beep): are two nodes connected through conductive
// paths (loads count as wires), ignoring the source? Honors open/blown faults.
export function continuity(circuit, input, aNode, bNode) {
  const c = normalizeCircuit(circuit);
  const prevCoil = input && input.prevCoil ? new Map(input.prevCoil) : new Map();
  const ctx = { pressed: (input && input.pressed) || new Set(), coilEnergized: prevCoil };
  const seen = flood(aNode, c, ctx, true);
  return seen.has(bNode);
}

function edgeOnLoop(circuit, ctx, comp, en, srcPos, srcNeg, loadOn) {
  const adj = buildFlowAdjExcluding(circuit, ctx, comp, loadOn);
  const [u, w] = en;
  return (
    (reachable(adj, srcPos, u) && reachable(adj, w, srcNeg)) ||
    (reachable(adj, srcPos, w) && reachable(adj, u, srcNeg))
  );
}
