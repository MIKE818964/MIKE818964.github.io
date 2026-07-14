// =============================================================================
// symbols.js — registry mapping a component TYPE to its inline <symbol> id,
// drawn size, and terminal offsets (anchor-relative, in schematic units).
//
// The renderer places each symbol CENTERED on the component's (x,y) anchor and
// draws an orthogonal "lead" from each terminal point to the node it binds to.
// Keeping terminals on a 20px grid keeps leads clean (BUILD_SPEC risk #2).
// =============================================================================

// size = side of the square cell the <symbol> is drawn into (viewBox 0 0 100 100).
// terminals = { name: {dx, dy} } offset from the anchor center, in schematic px.
export const SYMBOLS = {
  source: {
    symbol: "sym-source", w: 70, h: 70,
    terminals: { pos: { dx: 0, dy: -34 }, neg: { dx: 0, dy: 34 } },
  },
  fuse: {
    symbol: "sym-fuse", w: 64, h: 32,
    terminals: { a: { dx: -32, dy: 0 }, b: { dx: 32, dy: 0 } },
  },
  pushbutton: {
    symbol: "sym-pushbutton", w: 64, h: 56,
    terminals: { in: { dx: -32, dy: 0 }, out: { dx: 32, dy: 0 } },
  },
  contact_no: {
    symbol: "sym-contact-no", w: 64, h: 48,
    terminals: { in: { dx: -32, dy: 0 }, out: { dx: 32, dy: 0 } },
  },
  contact_nc: {
    symbol: "sym-contact-nc", w: 64, h: 48,
    terminals: { in: { dx: -32, dy: 0 }, out: { dx: 32, dy: 0 } },
  },
  coil: {
    symbol: "sym-coil", w: 64, h: 56,
    terminals: { a: { dx: -32, dy: 0 }, b: { dx: 32, dy: 0 } },
  },
  timer_coil: {
    symbol: "sym-timer-coil", w: 64, h: 56,
    terminals: { a: { dx: -32, dy: 0 }, b: { dx: 32, dy: 0 } },
  },
  bulb: {
    symbol: "sym-bulb", w: 56, h: 56,
    terminals: { a: { dx: -28, dy: 0 }, b: { dx: 28, dy: 0 } },
  },
  motor: {
    symbol: "sym-motor", w: 56, h: 56,
    terminals: { a: { dx: -28, dy: 0 }, b: { dx: 28, dy: 0 } },
  },
  test_point: {
    symbol: "sym-test-point", w: 26, h: 26,
    terminals: { p: { dx: 0, dy: 0 } },
  },
};

/** Absolute point of a named terminal on a placed component. */
export function terminalPoint(comp, termName) {
  const def = SYMBOLS[comp.type];
  if (!def) return { x: comp.x, y: comp.y };
  const off = def.terminals[termName] || { dx: 0, dy: 0 };
  return { x: comp.x + off.dx, y: comp.y + off.dy };
}

/** All { name, x, y, nodeId } terminal points for a component. */
export function componentTerminals(comp) {
  const def = SYMBOLS[comp.type];
  if (!def) return [];
  return Object.keys(def.terminals).map((name) => {
    const p = terminalPoint(comp, name);
    return { name, x: p.x, y: p.y, nodeId: comp.terminals[name] };
  });
}
