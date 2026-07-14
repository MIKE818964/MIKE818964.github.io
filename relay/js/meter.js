// =============================================================================
// meter.js — virtual multimeter. Reads true node potentials from the solver
// state. Teaches the key habit: voltage PRESENT across an open device in a
// powered circuit (24V across an open fuse) = open downstream.
// =============================================================================

import { continuity } from "./solver.js";

export const METER_MODES = ["VDC", "VAC", "CONT"];

export class Meter {
  constructor() {
    this.mode = "VDC";
    this.probeA = null; // nodeId
    this.probeB = null; // nodeId
  }

  setMode(m) { if (METER_MODES.includes(m)) this.mode = m; this.probeA = this.probeB = null; }

  // Click a test point's node; first click sets A, second sets B, third resets.
  probe(nodeId) {
    if (this.probeA == null) { this.probeA = nodeId; this.probeB = null; }
    else if (this.probeB == null && nodeId !== this.probeA) { this.probeB = nodeId; }
    else { this.probeA = nodeId; this.probeB = null; }
  }

  reset() { this.probeA = this.probeB = null; }

  // Returns { display, sub } for the readout. `state` is a solver result; `circuit`
  // + `input` are needed for the continuity (ohms) mode.
  read(state, circuit, input) {
    if (this.probeA == null || this.probeB == null) {
      return { display: "--.--", sub: this.mode === "CONT" ? "probe two points" : "probe two points" };
    }
    // reachability checks must see the coil states the solver JUST settled on,
    // not last tick's (input.prevCoil) — else a contact that closed this tick
    // still looks open to continuity/anchoring
    const inputNow = { pressed: (input && input.pressed) || new Set(), prevCoil: state.coilEnergized };
    if (this.mode === "CONT") {
      const c = continuity(circuit, inputNow, this.probeA, this.probeB);
      return c
        ? { display: "0.0 Ω", sub: "BEEP — continuous" }
        : { display: "O.L", sub: "open — no path" };
    }
    // both leads on the SAME node: 0 V by definition — teach node identity,
    // not "dead circuit" (every point stamped with one wire number is one node).
    if (this.probeA === this.probeB) {
      return { display: "0.0 V", sub: "same node — both leads on one wire number" };
    }
    const va = state.potential.get(this.probeA) || 0;
    const vb = state.potential.get(this.probeB) || 0;
    const srcIsDC = state.sourceType === "DC";
    if (this.mode === "VDC" && !srcIsDC) return { display: "0.0 V", sub: "DC range on an AC circuit" };
    if (this.mode === "VAC" && srcIsDC) return { display: "0.0 V", sub: "AC range on a DC circuit" };
    // A probed point with no conductive path back to either supply rail is
    // FLOATING: the meter's 10 MΩ input just pulls it to the other lead, so a
    // real DVM shows ~0 V there (the "two opens" trap), not full supply.
    const src = (circuit.components || []).find((k) => k.type === "source");
    if (src && src.terminals) {
      const anchored = (n) =>
        continuity(circuit, inputNow, n, src.terminals.pos) ||
        continuity(circuit, inputNow, n, src.terminals.neg);
      if (!anchored(this.probeA) || !anchored(this.probeB)) {
        return { display: "0.0 V", sub: "floating point — no path back to the source (real meters show ghost volts here)" };
      }
    }
    // Signed like a real DVM: display = V(red) − V(COM). Red on the lower
    // potential reads negative on DC; AC ranges show unsigned RMS.
    const reading = va - vb;
    if (this.mode === "VDC") {
      const sub = reading < 0 ? "VDC — negative: red lead is on the LOWER-potential side" : "VDC";
      return { display: `${reading.toFixed(1)} V`, sub };
    }
    return { display: `${Math.abs(reading).toFixed(1)} V`, sub: "VAC" };
  }
}
