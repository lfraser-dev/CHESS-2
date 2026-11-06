/* Chess 2: the finale boss. MEGA HORSEY, a giant knight that takes up 2x2 squares.
   It belongs to nobody. Both sides can hit it, and every round it attacks whoever is nearby.
   Its squares are 'boss' terrain, so pieces can't move through it. Nothing it does can leave a king hanging:
   every attack is tried on a copy first and skipped if it would. */
(() => {
'use strict';
const I = window.INK;
const { N, U, rc, inB, other } = I;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const NAME = 'MEGA HORSEY';
const MAX_HP = 18;

const squares = at => [at, at + 1, at + N, at + N + 1];
// the ring of squares around the 2x2 body (distance 1)
function ring(at, d = 1) {
  const [r, c] = rc(at), out = [];
  for (let rr = r - d; rr <= r + 1 + d; rr++) for (let cc = c - d; cc <= c + 1 + d; cc++) {
    if (!inB(rr, cc)) continue;
    if (rr >= r && rr <= r + 1 && cc >= c && cc <= c + 1) continue;
    out.push(rr * N + cc);
  }
  return out;
}
const free = (G, i) => !G.board[i] && !G.terr[i] && !(G.items && G.items[i]);

// find a 2x2 spot as close to the middle as possible: a clear one if there is one, otherwise it lands on
// whatever is there (squashing anything but kings), as long as that doesn't leave a king hanging
function spawnSpot(G, toMove) {
  const cands = [];
  for (let r = 1; r <= N - 3; r++) for (let c = 1; c <= N - 3; c++) {
    const at = r * N + c, sq = squares(at);
    if (sq.some(i => G.board[i] && G.board[i].t === 'K')) continue;
    const clear = sq.every(i => free(G, i));
    const d = Math.abs(r + .5 - (N - 1) / 2) + Math.abs(c + .5 - (N - 1) / 2) + Math.random() * .5 + (clear ? 0 : 6) + sq.filter(i => G.board[i]).length * 2;
    cands.push({ at, d, clear });
  }
  cands.sort((a, b) => a.d - b.d);
  for (const { at, clear } of cands) {
    if (clear) return at;
    if (safe(G, toMove, s => { for (const i of squares(at)) s.board[i] = null; })) return at;
  }
  return -1;
}
function place(G, at) {
  const squashed = [];
  for (const i of squares(at)) {
    const p = G.board[i]; if (p) { G.board[i] = null; G.grave[p.s].push(p.t); squashed.push({ sq: i, p }); }
    if (G.items) G.items[i] = null;
  }
  G.boss = { at, hp: MAX_HP, max: MAX_HP, turn: 0, dmg: { w: 0, b: 0 }, hitT: 0 };
  for (const i of squares(at)) G.terr[i] = { k: 'boss' };
  return squashed;
}
// make sure the boss's squares are still solid (spells like the NUKE overwrite terrain)
function ensure(G) {
  const B = G.boss; if (!B) return false;
  let hit = false;
  for (const i of squares(B.at)) {
    if (!G.terr[i] || G.terr[i].k !== 'boss') { hit = true; G.terr[i] = { k: 'boss' }; }
    const p = G.board[i]; if (p && p.t !== 'K') { G.board[i] = null; G.grave[p.s].push(p.t); }
  }
  return hit;
}
function remove(G) {
  const B = G.boss; if (!B) return;
  for (const i of squares(B.at)) if (G.terr[i] && G.terr[i].k === 'boss') G.terr[i] = null;
  G.boss = null;
}

// can this piece hit the boss from where it stands? (next to it, or within 3 for shooters)
function canHit(G, sq) {
  const B = G.boss, p = G.board[sq]; if (!B || !p || p.fz > 0) return false;
  const u = U[p.t];
  if (u.noCap && p.t !== 'K') return false;
  if (ring(B.at, 1).includes(sq)) return true;
  const ranged = u.shoot || u.lob || u.strike || u.ring;
  return !!ranged && ring(B.at, 3).includes(sq);
}
const damageOf = p => p.t === 'K' ? 1 : Math.max(1, Math.ceil((U[p.t].val || 1) / 2));

// try removing pieces / moving the boss on a copy; returns true if nobody's king would be left in check for the side not to move
function safe(G, toMove, edit) {
  const st = I.cloneState(G); st.boss = G.boss ? { ...G.boss } : null;
  edit(st);
  I.setEnv(st);
  const ok = !I.inCheck(st.board, other(toMove));
  I.setEnv(G);
  return ok ? st : null;
}

// the boss's turn. Returns { name, verb, react, killed: [{sq, p}], frozen: [sq], moved: {from, to}, laser: [sq...] } or null
const MOVES = ['stomp', 'laser', 'roar', 'stomp', 'charge'];
function act(G, toMove) {
  const B = G.boss; if (!B) return null;
  const kind = MOVES[B.turn++ % MOVES.length];
  const res = { kind, killed: [], frozen: [], laser: [], moved: null };
  const victim = (st, i) => { const p = st.board[i]; return p && p.t !== 'K' && !(p.sh > 0) && !U[p.t].untouchable; };
  const tryKill = (i) => { const st = safe(G, toMove, s => { s.board[i] = null; }); if (!st) return false; const p = G.board[i]; G.board[i] = null; G.grave[p.s].push(p.t); res.killed.push({ sq: i, p }); return true; };
  if (kind === 'stomp') {
    const near = ring(B.at, 1).filter(i => victim(G, i));
    for (const i of near.sort(() => Math.random() - .5).slice(0, 2)) tryKill(i);
    res.verb = 'stomps the ground'; res.react = res.killed.length ? pick(['FLATTENED', 'STOMPED', 'pancake']) : 'missed lol';
  } else if (kind === 'laser') {
    const [r, c] = rc(B.at), row = r + rnd(2), dirs = [[0, -1], [0, 1]];
    for (const [dr, dc] of dirs) {
      let cc = dc < 0 ? c - 1 : c + 2;
      while (inB(row, cc)) { const i = row * N + cc; res.laser.push(i); if (G.board[i]) { if (victim(G, i)) tryKill(i); break; } if (I.solid(G.terr[i])) break; cc += dc; }
    }
    res.row = row;
    res.verb = 'fires EYE LASERS'; res.react = res.killed.length ? pick(['EYE LASERS', 'PEW PEW', 'it has LASERS??']) : 'lasers missed';
  } else if (kind === 'roar') {
    for (const i of ring(B.at, 2)) { const p = G.board[i]; if (p && p.t !== 'K' && !(p.sh > 0)) { G.board[i] = { ...p, fz: Math.max(p.fz || 0, 1) }; res.frozen.push(i); } }
    res.verb = 'NEIGHS SO LOUD everyone freezes'; res.react = 'NEEEEIGH';
  } else {
    // charge one square towards the biggest crowd
    let best = null, bestN = -1;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const [r, c] = rc(B.at), nr = r + dr, nc = c + dc;
      if (nr < 1 || nc < 1 || nr > N - 3 || nc > N - 3) continue;
      const to = nr * N + nc, sq2 = squares(to), old = squares(B.at);
      if (!sq2.every(i => old.includes(i) || free(G, i))) continue;
      const n = ring(to, 2).filter(i => G.board[i]).length + Math.random();
      if (n > bestN) { bestN = n; best = to; }
    }
    if (best != null) {
      const from = B.at;
      const st = safe(G, toMove, s => { for (const i of squares(from)) s.terr[i] = null; for (const i of squares(best)) s.terr[i] = { k: 'boss' }; });
      if (st) { for (const i of squares(from)) G.terr[i] = null; B.at = best; for (const i of squares(best)) G.terr[i] = { k: 'boss' }; res.moved = { from, to: best }; if (G.items) for (const i of squares(best)) G.items[i] = null; }
    }
    res.verb = res.moved ? 'charges forward' : 'tries to charge but is stuck'; res.react = res.moved ? 'IT\'S COMING' : 'lmao stuck';
  }
  return res;
}

// a piece hits the boss. Returns { dmg, dead }
function hit(G, side, sq, dmg) {
  const B = G.boss; if (!B) return null;
  const p = G.board[sq], d = dmg != null ? dmg : damageOf(p);
  B.hp = Math.max(0, B.hp - d); B.dmg[side] += d; B.hitT = performance.now();
  return { dmg: d, dead: B.hp <= 0 };
}

// ---------------------------------------------------------------- art
const INK = '#1e1c24';
function draw(c, B, x, y, cell, now) {
  // x, y = centre of the 2x2 block
  const hurt = now - (B.hitT || 0) < 400, sh = hurt ? Math.sin(now / 25) * cell * .06 : 0;
  const breathe = 1 + Math.sin(now / 420) * .025;
  c.save(); c.translate(x + sh, y);
  // shadow + angry aura
  c.fillStyle = 'rgba(179,50,43,.12)'; c.beginPath(); c.ellipse(0, cell * .1, cell * 1.15, cell * 1.05, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(30,28,36,.25)'; c.beginPath(); c.ellipse(0, cell * .88, cell * .85, cell * .16, 0, 0, 7); c.fill();
  c.scale(breathe, 1 / breathe);
  I.drawPiece(c, 'N', 'b', 0, -cell * .05, cell * 2.1, 77);
  // glowing red eyes and angry brow
  const ex = cell * .02, ey = -cell * .52, blink = (now % 3200) < 120 ? .15 : 1;
  c.fillStyle = '#ff3b2e'; c.shadowColor = '#ff3b2e'; c.shadowBlur = cell * .25;
  c.beginPath(); c.ellipse(ex, ey, cell * .09, cell * .06 * blink, 0, 0, 7); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#ff3b2e'; c.lineWidth = cell * .05;
  c.beginPath(); c.moveTo(ex - cell * .16, ey - cell * .14); c.lineTo(ex + cell * .1, ey - cell * .07); c.stroke();
  // crown
  c.fillStyle = '#e2b53a'; c.strokeStyle = INK; c.lineWidth = Math.max(1.5, cell * .04);
  const cx = -cell * .05, cy = -cell * .98;
  c.beginPath(); c.moveTo(cx - cell * .28, cy + cell * .14); c.lineTo(cx - cell * .3, cy - cell * .12); c.lineTo(cx - cell * .15, cy); c.lineTo(cx, cy - cell * .18); c.lineTo(cx + cell * .15, cy); c.lineTo(cx + cell * .3, cy - cell * .12); c.lineTo(cx + cell * .28, cy + cell * .14); c.closePath(); c.fill(); c.stroke();
  c.restore();
  // health bar + name
  const w = cell * 1.9, bx = x - w / 2, by = y - cell * 1.32, k = B.hp / B.max;
  c.fillStyle = INK; c.fillRect(bx - 2, by - 2, w + 4, cell * .2 + 4);
  c.fillStyle = '#3a2f2f'; c.fillRect(bx, by, w, cell * .2);
  c.fillStyle = k > .5 ? '#c0392b' : k > .25 ? '#e8892b' : '#f3d55b'; c.fillRect(bx, by, w * k, cell * .2);
  c.font = `400 ${Math.max(11, Math.round(cell * .24))}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
  c.lineWidth = 3; c.strokeStyle = '#f2eee2'; c.strokeText(`${NAME}  ${B.hp}/${B.max}`, x, by - 3); c.fillStyle = INK; c.fillText(`${NAME}  ${B.hp}/${B.max}`, x, by - 3);
}

I.BOSS = { NAME, MAX_HP, squares, ring, spawnSpot, place, ensure, remove, canHit, damageOf, act, hit, draw };
})();
