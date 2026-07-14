// =============================================================================
// model.js — Circuit DATA MODEL + validation. PURE DATA, NO DOM.
//
// A circuit JSON has two authored arrays:
//   nodes      : junction points with coordinates  { id, x, y }
//   components : parts that reference the nodes they connect to
//
// Wires are IMPLICIT: any two terminals bound to the same nodeId are connected.
// `nets`/energization are DERIVED by solver.js — never authored.
//
// Component shape:
//   { id, type, x, y, rot?, label?, terminals:{ name:nodeId, ... }, ...typeFields, fault? }
//
// Types (see BUILD_SPEC §4):
//   source      { current:"DC"|"AC", volts:24, terminals:{ pos, neg } }
//   fuse        { ratingA, terminals:{ a, b } }
//   contact_no  { coil:coilId|null, terminals:{ in, out } }   open until coil energizes
//   contact_nc  { coil:coilId|null, terminals:{ in, out } }   closed until coil energizes
//   pushbutton  { mode:"momentary", contact:"NO"|"NC", terminals:{ in, out } }
//   coil        { ratedVolts, ratedCurrent:"DC"|"AC", terminals:{ a, b } }      LOAD
//   timer_coil  { mode:"on_delay"|"off_delay", delayMs, ratedVolts, terminals:{ a, b } } LOAD
//   bulb        { terminals:{ a, b } }                                          LOAD
//   motor_starter { coil:coilId, poles, terminals:{ coilA, coilB, p1in, p1out,... } }
//   test_point  { id?, terminals:{ p } }
//
// Fault (injected by the troubleshooting engine, honored by the solver):
//   fault:{ kind:"open_coil"|"welded_closed"|"stuck_open"|"blown_fuse"|"broken_wire"
//           |"swapped_no_nc"|"wrong_coil_voltage"|"loose_terminal", ... }
// =============================================================================

export const LOAD_TYPES = new Set(["coil", "timer_coil", "bulb", "motor", "motor_starter"]);
export const TWO_TERM = {
  source: ["pos", "neg"],
  fuse: ["a", "b"],
  contact_no: ["in", "out"],
  contact_nc: ["in", "out"],
  pushbutton: ["in", "out"],
  coil: ["a", "b"],
  timer_coil: ["a", "b"],
  bulb: ["a", "b"],
  motor: ["a", "b"],
};

/** Deep-clone a circuit so we never mutate the loaded JSON. */
export function cloneCircuit(c) {
  return JSON.parse(JSON.stringify(c));
}

/** Merge any `extraNodes` array into `nodes` (authoring convenience). */
export function normalizeCircuit(circuit) {
  const c = cloneCircuit(circuit);
  c.nodes = c.nodes || [];
  if (Array.isArray(c.extraNodes)) {
    for (const n of c.extraNodes) c.nodes.push(n);
    delete c.extraNodes;
  }
  c.components = c.components || [];
  return c;
}

/** Build quick lookup maps. Returns { nodeById, compById, source }. */
export function indexCircuit(c) {
  const nodeById = new Map();
  for (const n of c.nodes) nodeById.set(n.id, n);
  const compById = new Map();
  let source = null;
  for (const comp of c.components) {
    compById.set(comp.id, comp);
    if (comp.type === "source") source = comp;
  }
  return { nodeById, compById, source };
}

/** The two nodeIds a 2-terminal component bridges, or null for others. */
export function edgeNodes(comp) {
  const names = TWO_TERM[comp.type];
  if (!names) return null;
  const a = comp.terminals[names[0]];
  const b = comp.terminals[names[1]];
  if (a == null || b == null) return null;
  return [a, b];
}

export function isLoad(comp) {
  return LOAD_TYPES.has(comp.type);
}

/**
 * Validate a circuit. Returns { ok, errors:[...] }. Catches the authoring
 * mistakes that would otherwise show as a silent blank stage.
 */
export function validateCircuit(circuit) {
  const errors = [];
  if (!circuit || typeof circuit !== "object") {
    return { ok: false, errors: ["circuit is not an object"] };
  }
  const c = normalizeCircuit(circuit);
  if (!Array.isArray(c.nodes) || c.nodes.length === 0) errors.push("no nodes[]");
  if (!Array.isArray(c.components) || c.components.length === 0) errors.push("no components[]");

  const nodeIds = new Set((c.nodes || []).map((n) => n.id));
  for (const n of c.nodes || []) {
    if (typeof n.x !== "number" || typeof n.y !== "number")
      errors.push(`node ${n.id} missing numeric x/y`);
  }
  let sources = 0;
  const ids = new Set();
  for (const comp of c.components || []) {
    if (!comp.id) errors.push("component with no id");
    if (ids.has(comp.id)) errors.push(`duplicate component id ${comp.id}`);
    ids.add(comp.id);
    if (comp.type === "source") sources++;
    if (!comp.terminals) {
      errors.push(`${comp.id} has no terminals`);
      continue;
    }
    for (const [tname, nid] of Object.entries(comp.terminals)) {
      if (!nodeIds.has(nid))
        errors.push(`${comp.id}.${tname} → unknown node "${nid}"`);
    }
  }
  if (sources === 0) errors.push("no source component");
  return { ok: errors.length === 0, errors };
}
