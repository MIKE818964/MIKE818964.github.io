// =============================================================================
// faults.js — fault model + troubleshooting session (decision tree coupled to
// real meter measurements) + diagnosis scoring. Pure logic; main.js renders it.
// =============================================================================

import { cloneCircuit, indexCircuit } from "./model.js";

export const FAULT_KINDS = [
  "open_coil", "wrong_coil_voltage", "welded_closed", "stuck_open",
  "blown_fuse", "broken_wire", "swapped_no_nc", "loose_terminal",
];

export const FAULT_LABEL = {
  open_coil: "Open (burned-out) coil",
  wrong_coil_voltage: "Wrong coil voltage",
  welded_closed: "Welded / stuck-closed contact",
  stuck_open: "Stuck-open contact",
  blown_fuse: "Blown fuse",
  broken_wire: "Broken / open wire",
  swapped_no_nc: "Wired NO/NC backwards",
  loose_terminal: "Loose terminal",
};

// open_coil acts like a broken wire through the coil (never energizes).
function normalizeFault(kind) {
  return kind === "open_coil" ? "broken_wire" : kind;
}

/** Return a deep copy of the circuit with the scenario's faults written on. */
export function applyFaults(circuit, faultList) {
  const c = cloneCircuit(circuit);
  const { compById } = indexCircuit(c);
  for (const f of faultList || []) {
    const comp = compById.get(f.component);
    if (comp) comp.fault = { kind: normalizeFault(f.kind), original: f.kind, ...f.params };
  }
  return c;
}

/** Remove all faults (the "fix" applied after a correct diagnosis). */
export function clearFaults(circuit) {
  const c = cloneCircuit(circuit);
  for (const comp of c.components) delete comp.fault;
  return c;
}

export class TroubleshootSession {
  constructor(scenario) {
    this.scenario = scenario;
    this.deductive = scenario.mode === "deductive";
    this.partSwaps = 0;          // wrong "it's this part" calls — the parts cannon
    this.measurementsTaken = 0;
    this.usedMeter = false;
    this.lotoApplied = false;
    this.history = [];
    this.solved = false;

    if (this.deductive) {
      // Pick ONE fault at random from the candidate list. Different every play,
      // so the learner must actually deduce it from meter readings — not memorize.
      const faults = scenario.faults || [];
      this.activeFault = faults.length
        ? faults[Math.floor(Math.random() * faults.length)]
        : null;
      this.tree = null;
    } else {
      this.tree = scenario.tree || null;
      this.nodeKey = this.tree ? "start" : null;
    }
  }

  /** The fault(s) to write onto the circuit for THIS play. */
  activeFaults() {
    if (this.deductive) return this.activeFault ? [this.activeFault] : [];
    return this.scenario.faults || [];
  }

  applyLoto() { this.lotoApplied = true; }

  node() {
    return this.tree ? this.tree[this.nodeKey] : null;
  }

  /** Learner clicks an option on the current tree node. Returns feedback text. */
  chooseOption(index) {
    const n = this.node();
    if (!n || !n.options) return null;
    const opt = n.options[index];
    if (!opt) return null;
    this.history.push(opt.label);
    if (opt.good === false) {
      if (opt.partSwap) this.partSwaps++;
      return { advanced: false, feedback: opt.feedback || "That's a guess — narrow it down with a measurement first." };
    }
    if (opt.goto) this.nodeKey = opt.goto;
    return { advanced: true, feedback: opt.feedback || null };
  }

  /**
   * Called whenever the learner takes a meter reading. If the current tree node
   * REQUIRES a specific measurement and it matches, auto-advance.
   * meterState = { mode, probeA, probeB, value } ; returns {advanced, feedback}.
   */
  onMeasurement(meterState) {
    this.usedMeter = true;
    this.measurementsTaken++;
    const n = this.node();
    if (!n || !n.expect) return { advanced: false };
    const e = n.expect;
    const pts = new Set([meterState.probeA, meterState.probeB]);
    const want = new Set(e.probe);
    const samePts = pts.size === want.size && [...want].every((p) => pts.has(p));
    const modeOk = !e.mode || e.mode === meterState.mode;
    // magnitude match: the sign flips with lead order (red-first vs black-first)
    // and techs quote troubleshooting readings as magnitudes
    const valOk = e.reads == null || Math.abs(Math.abs(meterState.value) - e.reads) < 0.5;
    if (samePts && modeOk && valOk) {
      if (n.ifMatch) this.nodeKey = n.ifMatch;
      return { advanced: true, feedback: n.onMatch || null };
    }
    return { advanced: false, feedback: n.hint || null };
  }

  /** Submit a final diagnosis. Deductive scenarios score it like the job:
   *  a wrong call is a wasted part (parts-cannon), heavy probing costs, LOTO matters. */
  submitDiagnosis(component, kind) {
    const tgtComp = this.deductive
      ? (this.activeFault && this.activeFault.component)
      : this.scenario.answer.faultedComponent;
    const tgtKind = this.deductive
      ? (this.activeFault && this.activeFault.kind)
      : (this.scenario.answer.faultKind || this.scenario.answer.kind);

    const compOk = component === tgtComp;
    const kindOk = kind === tgtKind;
    const correct = compOk && kindOk;
    if (correct) this.solved = true;
    else this.partSwaps++;                    // wrong "replace this" = a part off the shelf

    let score = correct ? 100 : compOk ? 65 : 30;
    score -= this.partSwaps * 20;                              // parts-cannon
    score -= Math.max(0, this.measurementsTaken - 8) * 2;     // some free probes, then it costs
    score = Math.max(0, Math.min(100, score));

    return {
      correct, partial: compOk && !kindOk, score,
      partSwaps: this.partSwaps, usedMeter: this.usedMeter,
      measurements: this.measurementsTaken, loto: this.lotoApplied,
      faultComponent: tgtComp, faultKind: tgtKind,
      explanation: this._explain(tgtComp, tgtKind),
    };
  }

  _explain(comp, kind) {
    const key = `${comp}:${kind}`;
    if (this.scenario.explains && this.scenario.explains[key]) return this.scenario.explains[key];
    return this.scenario.explanation ||
      `The fault was ${FAULT_LABEL[kind] || kind} on ${comp}.`;
  }
}
