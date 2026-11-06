/* Chess 2: the finale bosses. MEGA HORSEY, THE SCREAMING PAWN, KING CLUCK and THE SENTIENT POMEGRANATE: each takes up 2x2 squares.
   It belongs to nobody. Both sides can hit it, and every round it attacks whoever is nearby.
   Its squares are 'boss' terrain, so pieces can't move through it. Nothing it does can leave a king hanging:
   every attack is tried on a copy first and skipped if it would. */
(() => {
'use strict';
const I = window.INK;
const { N, U, rc, inB, other } = I;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
// ---------------------------------------------------------------- the bosses
// moves: the attack it does each round, in order (looping). say: what the attacks are called for each boss
const TYPES = {
  horsey: { name: 'MEGA HORSEY', hp: 18, blurb: 'a giant crowned horse with laser eyes', moves: ['stomp', 'laser', 'roar', 'stomp', 'charge'],
    say: { stomp: 'stomps the ground', laser: 'fires EYE LASERS', roar: 'NEIGHS SO LOUD everyone freezes', charge: 'charges forward' } },
  pawn: { name: 'THE SCREAMING PAWN', hp: 14, blurb: 'a pawn the size of a house that has not stopped screaming since it was born', moves: ['scream', 'laserCol', 'stomp', 'scream', 'charge'],
    say: { scream: 'SCREAMS so hard everyone gets blown back', laserCol: 'screams a beam straight down the board', stomp: 'falls over onto people', charge: 'waddles forward, still screaming' } },
  chicken: { name: 'KING CLUCK', hp: 16, blurb: 'a king made of about 100 chickens standing on each other', moves: ['peck', 'feathers', 'peck', 'charge', 'peck'],
    say: { peck: 'sends out the pecking squad', feathers: 'explodes into a FEATHER STORM', charge: 'stampedes forward' } },
  pom: { name: 'THE SENTIENT POMEGRANATE', hp: 20, blurb: 'a pomegranate that gained consciousness and chose violence', moves: ['seeds', 'roll', 'juice', 'seeds'],
    say: { seeds: 'fires a SEED BARRAGE', roll: 'rolls across the board', juice: 'squirts JUICE everywhere' } },
};
const TYPE_KEYS = Object.keys(TYPES);
const typeOf = B => TYPES[(B && B.type) || 'horsey'] || TYPES.horsey;
const nameOf = B => typeOf(B).name;
const NAME = 'MEGA HORSEY', MAX_HP = 18;

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
function place(G, at, type) {
  const squashed = [];
  for (const i of squares(at)) {
    const p = G.board[i]; if (p) { G.board[i] = null; G.grave[p.s].push(p.t); squashed.push({ sq: i, p }); }
    if (G.items) G.items[i] = null;
  }
  const T = TYPES[type] ? type : pick(TYPE_KEYS), hp = TYPES[T].hp;
  G.boss = { type: T, at, hp, max: hp, turn: 0, dmg: { w: 0, b: 0 }, hitT: 0 };
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

// the boss's turn. Returns what happened: { kind, verb, react, killed: [{sq, p}], frozen: [sq], laser: [sq], row/col,
// moved: {from, to}, pushed: [{p, f, t}], shots: [sq] } or null
const REACT = {
  stomp: ['FLATTENED', 'STOMPED', 'pancake'], laser: ['EYE LASERS', 'PEW PEW', 'it has LASERS??'], laserCol: ['AAAAAAAAAA', 'SCREAM BEAM', 'my ears'],
  roar: ['NEEEEIGH'], scream: ['AAAAAAAAAAAA', 'SOMEBODY STOP IT', 'blown away'], peck: ['PECKED', 'bawk bawk BAWK', 'death by chickens'],
  feathers: ['FEATHERS EVERYWHERE', 'I can\'t see', 'achoo'], seeds: ['SEED BARRAGE', 'it\'s raining seeds', 'fruit violence'],
  juice: ['STICKY', 'so juicy', 'everyone is stuck'], roll: ['IT\'S ROLLING', 'run!!', 'rolling rolling rolling'], charge: ['IT\'S COMING', 'run!!'],
};
function act(G, toMove) {
  const B = G.boss; if (!B) return null;
  const T = typeOf(B), kind = T.moves[B.turn++ % T.moves.length];
  const res = { kind, killed: [], frozen: [], laser: [], moved: null, pushed: [], shots: [] };
  const victim = (st, i) => { const p = st.board[i]; return p && p.t !== 'K' && !(p.sh > 0) && !U[p.t].untouchable; };
  const tryKill = (i) => { if (!victim(G, i)) return false; const st = safe(G, toMove, s => { s.board[i] = null; }); if (!st) return false; const p = G.board[i]; G.board[i] = null; G.grave[p.s].push(p.t); res.killed.push({ sq: i, p }); return true; };
  const freezeAround = d => { for (const i of ring(B.at, d)) { const p = G.board[i]; if (p && p.t !== 'K' && !(p.sh > 0)) { G.board[i] = { ...p, fz: Math.max(p.fz || 0, 1) }; res.frozen.push(i); } } };
  const [r, c] = rc(B.at);
  if (kind === 'stomp') {
    for (const i of ring(B.at, 1).filter(i => victim(G, i)).sort(() => Math.random() - .5).slice(0, 2)) tryKill(i);
  } else if (kind === 'laser' || kind === 'laserCol') {
    // a beam out of both sides, along a row (or a column for the pawn)
    const col = kind === 'laserCol', line = col ? c + rnd(2) : r + rnd(2);
    const steps = col ? [[-1, r - 1], [1, r + 2]] : [[-1, c - 1], [1, c + 2]];
    for (const [d, start] of steps) {
      let k = start;
      while (col ? inB(k, line) : inB(line, k)) { const i = col ? k * N + line : line * N + k; res.laser.push(i); if (G.board[i]) { tryKill(i); break; } if (I.solid(G.terr[i])) break; k += d; }
    }
    if (col) res.col = line; else res.row = line;
  } else if (kind === 'roar' || kind === 'feathers' || kind === 'juice') {
    freezeAround(kind === 'roar' ? 2 : 3);
  } else if (kind === 'scream') {
    // freeze nearby pieces and blast the ones right next to it 1 square away
    freezeAround(2);
    const [cr, cc] = [r + .5, c + .5];
    for (const i of ring(B.at, 1)) {
      const p = G.board[i]; if (!p || p.t === 'K' || p.sh > 0) continue;
      const [pr, pc] = rc(i), dr = Math.sign(Math.round(pr - cr)) || Math.sign(pr - cr), dc = Math.sign(Math.round(pc - cc)) || Math.sign(pc - cc);
      const tr = pr + dr, tc = pc + dc; if (!inB(tr, tc)) continue;
      const t = tr * N + tc; if (G.board[t] || I.solid(G.terr[t])) continue;
      const st = safe(G, toMove, s => { s.board[t] = s.board[i]; s.board[i] = null; }); if (!st) continue;
      G.board[t] = G.board[i]; G.board[i] = null; res.pushed.push({ p: G.board[t], f: i, t });
    }
  } else if (kind === 'peck') {
    const near = ring(B.at, 2).filter(i => victim(G, i)).sort(() => Math.random() - .5);
    for (const i of near) { if (res.killed.length >= 2) break; tryKill(i); }
  } else if (kind === 'seeds') {
    const near = ring(B.at, 4).filter(i => victim(G, i)).sort(() => Math.random() - .5);
    for (const i of near) { if (res.shots.length >= 3) break; if (tryKill(i)) res.shots.push(i); }
  } else {
    // charge (or roll) towards the biggest crowd: 1 square, or 2 for the rolling pomegranate
    const steps = kind === 'roll' ? 2 : 1;
    for (let n = 0; n < steps; n++) {
      let best = null, bestN = -1;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const [rr, cc2] = rc(B.at), nr = rr + dr, nc = cc2 + dc;
        if (nr < 1 || nc < 1 || nr > N - 3 || nc > N - 3) continue;
        const to = nr * N + nc, sq2 = squares(to), old = squares(B.at);
        if (!sq2.every(i => old.includes(i) || free(G, i))) continue;
        const cnt = ring(to, 2).filter(i => G.board[i]).length + Math.random();
        if (cnt > bestN) { bestN = cnt; best = to; }
      }
      if (best == null) break;
      const from = B.at;
      const st = safe(G, toMove, s => { for (const i of squares(from)) s.terr[i] = null; for (const i of squares(best)) s.terr[i] = { k: 'boss' }; });
      if (!st) break;
      for (const i of squares(from)) G.terr[i] = null; B.at = best; for (const i of squares(best)) G.terr[i] = { k: 'boss' };
      if (G.items) for (const i of squares(best)) G.items[i] = null;
      res.moved = { from: res.moved ? res.moved.from : from, to: best };
    }
  }
  const did = res.killed.length || res.frozen.length || res.moved || res.pushed.length;
  res.verb = (kind === 'charge' || kind === 'roll') && !res.moved ? 'tries to move but is stuck' : T.say[kind] || kind;
  res.react = did ? pick(REACT[kind] || ['WHAT']) : pick(['missed lol', 'nothing happened', 'skill issue (boss)']);
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
function drawHorsey(c, cell, now) {
  I.drawPiece(c, 'N', 'b', 0, -cell * .05, cell * 2.1, 77);
  const ex = cell * .02, ey = -cell * .52, blink = (now % 3200) < 120 ? .15 : 1;
  c.fillStyle = '#ff3b2e'; c.shadowColor = '#ff3b2e'; c.shadowBlur = cell * .25;
  c.beginPath(); c.ellipse(ex, ey, cell * .09, cell * .06 * blink, 0, 0, 7); c.fill();
  c.shadowBlur = 0; c.strokeStyle = '#ff3b2e'; c.lineWidth = cell * .05;
  c.beginPath(); c.moveTo(ex - cell * .16, ey - cell * .14); c.lineTo(ex + cell * .1, ey - cell * .07); c.stroke();
  crown(c, -cell * .05, -cell * .98, cell);
}
function drawPawn(c, cell, now) {
  const wob = Math.sin(now / 45) * cell * .02, lw = Math.max(2, cell * .06);
  c.save(); c.translate(wob, 0);
  c.fillStyle = '#f2eee2'; c.strokeStyle = INK; c.lineWidth = lw; c.lineJoin = 'round';
  // base, body, collar and a big round head, like a pawn piece
  c.beginPath(); c.ellipse(0, cell * .78, cell * .78, cell * .14, 0, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.moveTo(-cell * .62, cell * .74); c.quadraticCurveTo(-cell * .3, cell * .1, -cell * .22, -cell * .12); c.lineTo(cell * .22, -cell * .12); c.quadraticCurveTo(cell * .3, cell * .1, cell * .62, cell * .74); c.closePath(); c.fill(); c.stroke();
  c.beginPath(); c.ellipse(0, -cell * .14, cell * .4, cell * .1, 0, 0, 7); c.fill(); c.stroke();
  c.beginPath(); c.arc(0, -cell * .58, cell * .42, 0, 7); c.fill(); c.stroke();
  // hatching on the body
  c.lineWidth = 1; c.globalAlpha = .35; for (let k = 0; k < 6; k++) { const y = cell * (.05 + k * .11); c.beginPath(); c.moveTo(-cell * (.24 + k * .06), y); c.lineTo(-cell * (.1 + k * .05), y + cell * .08); c.stroke(); } c.globalAlpha = 1;
  // wild eyes and a huge screaming mouth
  c.lineWidth = Math.max(1.5, cell * .035);
  for (const ex of [-cell * .15, cell * .15]) { c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, -cell * .72, cell * .1, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(ex + Math.sin(now / 70) * cell * .03, -cell * .72, cell * .035, 0, 7); c.fill(); }
  const open = .75 + Math.sin(now / 60) * .25;
  c.fillStyle = '#3a0f0f'; c.beginPath(); c.ellipse(0, -cell * .45, cell * .15, cell * .16 * open, 0, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#c0392b'; c.beginPath(); c.ellipse(0, -cell * .38, cell * .09, cell * .06 * open, 0, 0, 7); c.fill();
  // scream lines
  c.strokeStyle = 'rgba(179,50,43,.7)'; c.lineWidth = Math.max(1.5, cell * .04);
  for (let k = 0; k < 3; k++) { const ph = ((now / 260) + k / 3) % 1, rr = cell * (.5 + ph * .9); c.globalAlpha = 1 - ph; for (const sgn of [-1, 1]) { c.beginPath(); c.arc(0, -cell * .5, rr, sgn < 0 ? Math.PI * .8 : -Math.PI * .2, sgn < 0 ? Math.PI * 1.2 : Math.PI * .2); c.stroke(); } }
  c.globalAlpha = 1; c.restore();
}
function drawChickenKing(c, cell, now) {
  // a wobbly pyramid of chickens
  const rows = [[-.6, .45], [0, .45], [.6, .45], [-.3, -.05], [.3, -.05], [0, -.55]];
  rows.forEach(([dx, dy], k) => { const j = Math.sin(now / 120 + k * 1.7) * cell * .03; I.drawPiece(c, 'chicken', k % 2 ? 'w' : 'b', dx * cell + j, dy * cell, cell * 1.05, 300 + k); });
  for (let k = 0; k < 4; k++) { const a = now / 400 + k * 1.6, fx = Math.cos(a) * cell * .9, fy = Math.sin(a * 1.3) * cell * .5 - cell * .1; c.save(); c.translate(fx, fy); c.rotate(a); c.fillStyle = '#f2eee2'; c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.ellipse(0, 0, cell * .07, cell * .025, 0, 0, 7); c.fill(); c.stroke(); c.restore(); }
  crown(c, 0, -cell * .98, cell * .9);
}
function drawPomegranate(c, cell, now) {
  const R = cell * .88, sq = 1 + Math.sin(now / 300) * .03;
  c.save(); c.scale(sq, 1 / sq);
  const g = c.createRadialGradient(-R * .35, -R * .35, R * .1, 0, 0, R); g.addColorStop(0, '#e2574b'); g.addColorStop(1, '#8e1f18');
  c.fillStyle = g; c.strokeStyle = INK; c.lineWidth = Math.max(2, cell * .05);
  c.beginPath(); c.arc(0, cell * .05, R, 0, 7); c.fill(); c.stroke();
  // leafy crown
  c.fillStyle = '#6e1a14'; c.beginPath(); c.moveTo(-R * .35, -R * .85); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .33; c.lineTo(Math.cos(a) * R * .5, -R * .95 + Math.sin(a) * R * .5 - R * .25 * (i % 2)); } c.lineTo(R * .35, -R * .85); c.closePath(); c.fill(); c.stroke();
  // seeds peeking through a crack
  c.fillStyle = '#ffb3a8'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(R * .35 + (i % 3) * R * .12, R * .25 + Math.floor(i / 3) * R * .13, R * .045, R * .06, .4, 0, 7); c.fill(); }
  // angry face
  const blink = (now % 2800) < 110 ? .15 : 1;
  c.fillStyle = '#fff';
  for (const ex of [-R * .32, R * .08]) { c.beginPath(); c.ellipse(ex, -R * .12, R * .14, R * .14 * blink, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(ex + R * .03, -R * .1, R * .05 * blink, 0, 7); c.fill(); c.fillStyle = '#fff'; }
  c.lineWidth = Math.max(2, cell * .06); c.beginPath(); c.moveTo(-R * .5, -R * .36); c.lineTo(-R * .2, -R * .26); c.moveTo(R * .25, -R * .36); c.lineTo(-R * .02, -R * .26); c.stroke();
  c.fillStyle = '#fff'; c.lineWidth = Math.max(1.5, cell * .035); c.beginPath(); c.moveTo(-R * .4, R * .2); c.quadraticCurveTo(-R * .1, R * .5, R * .2, R * .2); c.closePath(); c.fill(); c.stroke();
  for (let i = 1; i < 4; i++) { const tx = -R * .4 + i * R * .15; c.beginPath(); c.moveTo(tx, R * .2); c.lineTo(tx, R * .32); c.stroke(); }
  c.restore();
}
function crown(c, cx, cy, cell) {
  c.fillStyle = '#e2b53a'; c.strokeStyle = INK; c.lineWidth = Math.max(1.5, cell * .04);
  c.beginPath(); c.moveTo(cx - cell * .28, cy + cell * .14); c.lineTo(cx - cell * .3, cy - cell * .12); c.lineTo(cx - cell * .15, cy); c.lineTo(cx, cy - cell * .18); c.lineTo(cx + cell * .15, cy); c.lineTo(cx + cell * .3, cy - cell * .12); c.lineTo(cx + cell * .28, cy + cell * .14); c.closePath(); c.fill(); c.stroke();
}
const ART = { horsey: drawHorsey, pawn: drawPawn, chicken: drawChickenKing, pom: drawPomegranate };
function draw(c, B, x, y, cell, now) {
  // x, y = centre of the 2x2 block
  const hurt = now - (B.hitT || 0) < 400, sh = hurt ? Math.sin(now / 25) * cell * .06 : 0;
  const breathe = 1 + Math.sin(now / 420) * .025;
  c.save(); c.translate(x + sh, y);
  c.fillStyle = 'rgba(179,50,43,.12)'; c.beginPath(); c.ellipse(0, cell * .1, cell * 1.15, cell * 1.05, 0, 0, 7); c.fill();
  c.fillStyle = 'rgba(30,28,36,.25)'; c.beginPath(); c.ellipse(0, cell * .88, cell * .85, cell * .16, 0, 0, 7); c.fill();
  c.scale(breathe, 1 / breathe);
  (ART[B.type] || drawHorsey)(c, cell, now);
  c.restore();
  // health bar + name
  const name = nameOf(B), w = cell * 1.9, bx = x - w / 2, by = y - cell * 1.32, k = B.hp / B.max;
  c.fillStyle = INK; c.fillRect(bx - 2, by - 2, w + 4, cell * .2 + 4);
  c.fillStyle = '#3a2f2f'; c.fillRect(bx, by, w, cell * .2);
  c.fillStyle = k > .5 ? '#c0392b' : k > .25 ? '#e8892b' : '#f3d55b'; c.fillRect(bx, by, w * k, cell * .2);
  c.font = `400 ${Math.max(11, Math.round(cell * .24))}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'bottom';
  c.lineWidth = 3; c.strokeStyle = '#f2eee2'; c.strokeText(`${name}  ${B.hp}/${B.max}`, x, by - 3); c.fillStyle = INK; c.fillText(`${name}  ${B.hp}/${B.max}`, x, by - 3);
}

I.BOSS = { NAME, MAX_HP, TYPES, TYPE_KEYS, typeOf, nameOf, squares, ring, spawnSpot, place, ensure, remove, canHit, damageOf, act, hit, draw };
})();
