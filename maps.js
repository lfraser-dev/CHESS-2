/* Chess 2: maps. Each map carves water, chasms or lava ("void" squares) into the middle of the 15x15 board.
   Nothing can walk onto a void square, but knights and other jumpers leap over it and fliers fly across.
   Two maps move: on Drifting Islands the islands float about and crash into each other, and on Volcano
   lava keeps spilling out of the crater. Both armies' starting rows (0-2 and 12-14) are always solid ground. */
(() => {
'use strict';
const I = window.INK;
const { N, rc, other } = I;
const sq = (r, c) => r * N + c;
const mirror = i => { const [r, c] = rc(i); return sq(N - 1 - r, N - 1 - c); };

const MAPS = {
  classic: { name: 'Classic', blurb: 'The plain 15×15 board.', style: 'abyss', build: () => [] },
  river: { name: 'The River', blurb: 'A river across the middle with three narrow bridges.', style: 'water',
    build: () => { const v = []; for (let r = 6; r <= 8; r++) for (let c = 0; c < N; c++) if (![2, 7, 12].includes(c)) v.push(sq(r, c)); return v; } },
  islands: { name: 'Drifting Islands', blurb: 'Five islands in the sea. They drift around and crash into each other.', style: 'water', moving: true,
    build: G => {
      const isl = [[3, 1], [3, 9], [6, 5], [9, 1], [9, 9]].map(([r0, c0], n) => { const cells = []; for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 5; c++) cells.push(sq(r, c)); return { id: n, cells }; });
      G.islands = isl;
      const land = new Set(isl.flatMap(x => x.cells)), v = [];
      for (let r = 3; r <= 11; r++) for (let c = 0; c < N; c++) if (!land.has(sq(r, c))) v.push(sq(r, c));
      return v;
    } },
  donut: { name: 'The Donut', blurb: 'A giant hole in the middle. Fight around the edges.', style: 'abyss',
    build: () => { const v = []; for (let r = 5; r <= 9; r++) for (let c = 4; c <= 10; c++) if (!((r === 5 || r === 9) && (c === 4 || c === 10))) v.push(sq(r, c)); return v; } },
  hourglass: { name: 'Hourglass', blurb: 'The board pinches into a narrow gap in the middle.', style: 'abyss',
    build: () => { const v = [], w = { 4: 1, 5: 3, 6: 5, 7: 6, 8: 5, 9: 3, 10: 1 }; for (const r in w) for (let k = 0; k < w[r]; k++) v.push(sq(+r, k), sq(+r, N - 1 - k)); return v; } },
  cheese: { name: 'Swiss Cheese', blurb: 'Holes everywhere. Mind your step.', style: 'abyss',
    build: () => { const v = new Set(); let n = 0; while (v.size < 22 && n++ < 400) { const r = 3 + Math.floor(Math.random() * 5), c = Math.floor(Math.random() * N); const i = sq(r, c); if (r === 7 && c === 7) continue; v.add(i); v.add(mirror(i)); } return [...v]; } },
  volcano: { name: 'Volcano', blurb: 'A crater in the middle keeps spilling lava. The middle gets more dangerous every few turns.', style: 'lava', moving: true,
    build: () => { const v = []; for (let r = 6; r <= 8; r++) for (let c = 6; c <= 8; c++) v.push(sq(r, c)); return v; } },
};
const KEYS = Object.keys(MAPS);

function apply(G, id) {
  if (id === 'random') id = KEYS[1 + Math.floor(Math.random() * (KEYS.length - 1))];
  const m = MAPS[id] ? id : 'classic';
  G.map = m; G.islands = null;
  for (const i of MAPS[m].build(G)) { if (G.board[i] && G.board[i].t !== 'K') G.board[i] = null; G.terr[i] = { k: 'void' }; }
  return m;
}

// try a change on a copy: fine as long as the side that isn't moving isn't left in check
function safe(G, toMove, edit) {
  const st = I.cloneState(G); st.islands = G.islands; edit(st);
  I.setEnv(st); const ok = !I.inCheck(st.board, other(toMove)); I.setEnv(G);
  return ok;
}

// moving maps: called at the end of each turn. Returns a short description of what happened, or null
function tick(G, toMove) {
  if (G.map === 'islands' && G.islands && G.ply % 3 === 0) return drift(G, toMove);
  if (G.map === 'volcano' && G.ply % 4 === 0) return erupt(G, toMove);
  return null;
}
function drift(G, toMove) {
  const order = G.islands.map((x, i) => i).sort(() => Math.random() - .5);
  for (const idx of order) {
    const isl = G.islands[idx];
    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].sort(() => Math.random() - .5);
    for (const [dr, dc] of dirs) {
      const moved = isl.cells.map(i => { const [r, c] = rc(i); return [r + dr, c + dc]; });
      if (moved.some(([r, c]) => r < 3 || r > 11 || c < 0 || c >= N)) continue;
      const to = moved.map(([r, c]) => sq(r, c)), own = new Set(isl.cells);
      // it can only drift into open water (or squares it already covers)
      if (!to.every(i => own.has(i) || (G.terr[i] && G.terr[i].k === 'void'))) continue;
      const shift = st => {
        const pieces = isl.cells.map(i => st.board[i]), items = st.items ? isl.cells.map(i => st.items[i]) : null, terrs = isl.cells.map(i => st.terr[i]);
        for (const i of isl.cells) { st.board[i] = null; st.terr[i] = { k: 'void' }; if (st.items) st.items[i] = null; }
        to.forEach((i, n) => { st.board[i] = pieces[n]; st.terr[i] = terrs[n]; if (st.items) st.items[i] = items[n]; });
      };
      if (!safe(G, toMove, shift)) continue;
      const before = isl.cells.slice();
      shift(G); isl.cells = to;
      const touching = cells => G.islands.filter(o => o !== isl && cells.some(i => { const [r, c] = rc(i); return o.cells.some(j => { const [r2, c2] = rc(j); return Math.abs(r - r2) + Math.abs(c - c2) === 1; }); })).map(o => o.id);
      const was = new Set(touching(before)), crash = touching(to).some(id => !was.has(id));
      return { kind: 'drift', from: before, to, dir: [dr, dc], crash };
    }
  }
  return null;
}
function erupt(G, toMove) {
  // lava pours onto empty squares next to the crater or existing lava
  const hot = new Set(); for (let i = 0; i < N * N; i++) { const t = G.terr[i]; if (t && (t.k === 'void' || (t.k === 'fire' && t.lava))) hot.add(i); }
  const edge = [];
  for (const i of hot) { const [r, c] = rc(i); for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const r2 = r + dr, c2 = c + dc; if (r2 < 3 || r2 > 11 || c2 < 0 || c2 >= N) continue; const j = sq(r2, c2); if (!G.terr[j] && !G.board[j] && !(G.items && G.items[j])) edge.push(j); } }
  const picks = [...new Set(edge)].sort(() => Math.random() - .5).slice(0, 3);
  for (const j of picks) G.terr[j] = { k: 'fire', n: 8, lava: true };
  return picks.length ? { kind: 'lava', squares: picks } : null;
}

// ---------------------------------------------------------------- drawing the void squares
function drawVoid(c, style, x, y, cell, i, now, neighbours) {
  const h = cell / 2;
  if (style === 'water') {
    const wg = c.createLinearGradient(x, y - h, x, y + h); wg.addColorStop(0, '#2f7fc4'); wg.addColorStop(1, '#1d5a96'); c.fillStyle = wg; c.fillRect(x - h, y - h, cell, cell);
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, cell * .04);
    for (let k = 0; k < 2; k++) { const yy = y - h * .4 + k * h * .8, ph = now / 500 + i * .7 + k; c.beginPath(); for (let t = 0; t <= 6; t++) { const xx = x - h * .7 + t * h * .23; const w = Math.sin(ph + t * 1.1) * cell * .04; t ? c.lineTo(xx, yy + w) : c.moveTo(xx, yy + w); } c.stroke(); }
    // foam where the water touches land
    c.fillStyle = 'rgba(255,255,255,.5)';
    if (!neighbours[0]) c.fillRect(x - h, y - h, cell, cell * .07);
    if (!neighbours[1]) c.fillRect(x - h, y + h - cell * .07, cell, cell * .07);
    if (!neighbours[2]) c.fillRect(x - h, y - h, cell * .07, cell);
    if (!neighbours[3]) c.fillRect(x + h - cell * .07, y - h, cell * .07, cell);
  } else if (style === 'lava') {
    const g = c.createRadialGradient(x, y, 0, x, y, cell * .75); g.addColorStop(0, '#ffd36b'); g.addColorStop(.5, '#ef7d22'); g.addColorStop(1, '#a8261b');
    c.fillStyle = g; c.fillRect(x - h, y - h, cell, cell);
    c.fillStyle = 'rgba(80,20,10,.5)'; for (let k = 0; k < 3; k++) { const a = now / 900 + i + k * 2.1; c.beginPath(); c.arc(x + Math.cos(a) * h * .5, y + Math.sin(a * 1.3) * h * .5, cell * (.06 + .04 * Math.sin(now / 300 + k)), 0, 7); c.fill(); }
  } else {
    // a deep chasm: pitch black falling away into purple fog, with a lit rock edge where it meets solid ground
    const g = c.createLinearGradient(x, y - h, x, y + h); g.addColorStop(0, '#07060a'); g.addColorStop(1, '#1a0f26');
    c.fillStyle = g; c.fillRect(x - h, y - h, cell, cell);
    c.fillStyle = `rgba(140,80,220,${.08 + .05 * Math.sin(now / 900 + i)})`; c.fillRect(x - h, y - h * .2, cell, h * 1.2);
    if (I.hash(i * 3) > .6) { c.fillStyle = 'rgba(200,170,255,.35)'; c.fillRect(x + (I.hash(i) - .5) * cell * .6, y + (I.hash(i + 9) - .5) * cell * .6, 1.5, 1.5); }
    const e = Math.max(2, cell * .09);
    c.fillStyle = '#6a6272';
    if (!neighbours[0]) c.fillRect(x - h, y - h, cell, e);
    if (!neighbours[2]) c.fillRect(x - h, y - h, e * .6, cell);
    if (!neighbours[3]) c.fillRect(x + h - e * .6, y - h, e * .6, cell);
    c.fillStyle = 'rgba(0,0,0,.6)'; if (!neighbours[0]) c.fillRect(x - h, y - h + e, cell, e);
  }
}

I.MAPS = { MAPS, KEYS, apply, tick, drawVoid };
})();
