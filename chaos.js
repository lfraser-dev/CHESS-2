/* Chess 2: chaos events. Every round something absurd happens to the board.
   INK.CHAOS.roll(state, side) -> { ev, st } : picks an event, applies it to a copy of the state,
   and only accepts it if it doesn't leave the side that isn't moving in check. */
(() => {
'use strict';
const I = window.INK;
const { N, U, DIR8, ORTH, rc, inB, other } = I;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const blocked = (st, i) => { const t = st.terr[i]; return !!t && (t.k === 'pit' || t.k === 'fire'); };
const empties = (st, rows) => { const out = []; for (let i = 0; i < N * N; i++) { const r = i / N | 0; if ((!rows || (r >= rows[0] && r <= rows[1])) && !st.board[i] && !blocked(st, i) && !(st.terr[i] && st.terr[i].k === 'portal')) out.push(i); } return out; };
const pieces = (st, f) => { const out = []; for (let i = 0; i < N * N; i++) { const p = st.board[i]; if (p && f(p, i)) out.push(i); } return out; };
const kill = (st, i) => { const p = st.board[i]; if (!p || p.t === 'K') return; st.board[i] = null; st.grave[p.s].push(p.t); };
const remap = (st, fn) => { const b = st.board.slice(), t = st.terr.slice(); for (let i = 0; i < N * N; i++) { const [r, c] = rc(i); const j = fn(r, c); st.board[i] = b[j]; st.terr[i] = t[j]; } };
function gravity(st, dr, dc) {
  // every piece slides as far as it can in one direction, stacking up against the edge
  const nb = new Array(N * N).fill(null);
  const lines = [];
  for (let k = 0; k < N; k++) {
    const line = [];
    for (let j = 0; j < N; j++) {
      // walk from the far edge back so pieces stack in order
      let r, c;
      if (dr) { c = k; r = dr > 0 ? N - 1 - j : j; } else { r = k; c = dc > 0 ? N - 1 - j : j; }
      line.push(r * N + c);
    }
    lines.push(line);
  }
  for (const line of lines) {
    const ps = line.map(i => st.board[i]).filter(Boolean);
    let slot = 0;
    for (const p of ps) { while (slot < line.length && blocked(st, line[slot])) slot++; if (slot < line.length) nb[line[slot++]] = p; }
  }
  st.board = nb;
}
const STRONG = ['Q', 'D', 'T', 'Z', 'samurai', 'ninja', 'werewolf', 'golem', 'mech', 'siegetank', 'sniper', 'vampire', 'ufo', 'J', 'heli', 'grandma', 'R'];

const EVENTS = [
  { key: 'gravDown', name: 'GRAVITY TURNED ON', text: 'Every piece falls to the bottom of the board.', run: st => gravity(st, 1, 0) },
  { key: 'gravUp', name: 'GRAVITY REVERSED', text: 'Every piece falls UP to the top of the board.', run: st => gravity(st, -1, 0) },
  { key: 'tilt', name: 'THE BOARD TILTS', text: 'Everything slides off to one side.', run: st => gravity(st, 0, Math.random() < .5 ? 1 : -1) },
  { key: 'spin', name: 'THE BOARD SPINS', text: 'The whole board turns 180°. Good luck.', run: st => remap(st, (r, c) => (N - 1 - r) * N + (N - 1 - c)) },
  { key: 'sideways', name: 'SIDEWAYS', text: 'The board rotates a quarter turn.', run: st => remap(st, (r, c) => c * N + (N - 1 - r)) },
  { key: 'mirror', name: 'MIRROR WORLD', text: 'Left is right. Right is left.', run: st => remap(st, (r, c) => r * N + (N - 1 - c)) },
  { key: 'kingswap', name: 'KINGS SWAP PLACES', text: 'The two kings trade thrones.', run: st => {
    const a = pieces(st, p => p.t === 'K' && p.s === 'w')[0], b = pieces(st, p => p.t === 'K' && p.s === 'b')[0];
    if (a == null || b == null) return false; const t = st.board[a]; st.board[a] = st.board[b]; st.board[b] = t; } },
  { key: 'traitors', name: 'TRAITORS!', text: 'Two pieces on each side switch teams.', run: st => {
    for (const s of ['w', 'b']) for (const i of shuffle(pieces(st, p => p.s === s && p.t !== 'K')).slice(0, 2)) st.board[i] = { ...st.board[i], s: other(s) }; } },
  { key: 'ducks', name: "IT'S RAINING DUCKS", text: 'Rubber ducks fall from the sky. Squeak.', run: st => {
    const e = shuffle(empties(st, [3, N - 4])); if (e.length < 4) return false;
    e.slice(0, 6).forEach((i, k) => { st.board[i] = I.mkPiece('duck', k % 2 ? 'b' : 'w'); }); } },
  { key: 'chickens', name: 'CHICKEN STAMPEDE', text: 'Chickens. Everywhere.', run: st => {
    const e = shuffle(empties(st, [2, N - 3])); if (e.length < 4) return false;
    e.slice(0, 7).forEach((i, k) => { st.board[i] = I.mkPiece('chicken', k % 2 ? 'b' : 'w'); }); } },
  { key: 'glowup', name: 'GLOW-UP', text: 'A random pawn on each side turns into something terrifying.', run: st => {
    let n = 0; for (const s of ['w', 'b']) { const ps = pieces(st, p => p.s === s && p.t === 'P'); if (!ps.length) continue; const i = pick(ps), t = pick(STRONG); st.board[i] = { ...I.mkPiece(t, s), id: st.board[i].id }; n++; }
    if (!n) return false; } },
  { key: 'budget', name: 'BUDGET CUTS', text: "Each side's best piece gets demoted to a pawn.", run: st => {
    let n = 0; for (const s of ['w', 'b']) { const ps = pieces(st, p => p.s === s && p.t !== 'K' && p.t !== 'P'); if (!ps.length) continue; ps.sort((a, b) => U[st.board[b].t].val - U[st.board[a].t].val); const i = ps[0]; st.board[i] = { ...I.mkPiece('P', s), id: st.board[i].id }; n++; }
    if (!n) return false; } },
  { key: 'clone', name: 'CLONING ACCIDENT', text: 'One piece on each side gets copied.', run: st => {
    let n = 0; for (const s of ['w', 'b']) { for (const i of shuffle(pieces(st, p => p.s === s && p.t !== 'K'))) { const spot = shuffle(I.area(i).filter(j => !st.board[j] && !blocked(st, j)))[0]; if (spot != null) { st.board[spot] = { ...I.mkPiece(st.board[i].t, s), mut: st.board[i].mut }; n++; break; } } }
    if (!n) return false; } },
  { key: 'tornado', name: 'TORNADO', text: 'A tornado scrambles part of the board.', run: st => {
    const r0 = 2 + rnd(N - 8), c0 = rnd(N - 5), sq = [];
    for (let r = r0; r < r0 + 5; r++) for (let c = c0; c < c0 + 5; c++) if (!blocked(st, r * N + c)) sq.push(r * N + c);
    const ps = sq.map(i => st.board[i]); if (ps.filter(Boolean).length < 2) return false;
    shuffle(ps); sq.forEach((i, k) => { st.board[i] = ps[k]; }); } },
  { key: 'lava', name: 'THE FLOOR IS LAVA', text: 'Squares burst into flames for a couple of turns.', run: st => {
    const e = shuffle(empties(st, [3, N - 4])); if (e.length < 6) return false; e.slice(0, 8).forEach(i => { st.terr[i] = { k: 'fire', n: 4 }; }); } },
  { key: 'crumble', name: 'THE BOARD IS CRUMBLING', text: 'Holes open up in the board. For good.', run: st => {
    const e = shuffle(empties(st)); if (e.length < 6) return false; e.slice(0, 6).forEach(i => { st.terr[i] = { k: 'pit' }; }); } },
  { key: 'portals', name: 'PORTALS OPEN', text: 'Step on a portal and you come out of its twin.', run: st => {
    const e = shuffle(empties(st, [2, N - 3])); if (e.length < 4) return false;
    for (let k = 0; k < 2; k++) { const a = e[k * 2], b = e[k * 2 + 1], id = Math.random(); st.terr[a] = { k: 'portal', to: b, id, n: 8 }; st.terr[b] = { k: 'portal', to: a, id, n: 8 }; } } },
  { key: 'allkn', name: 'EVERYTHING IS A KNIGHT', text: 'For a round, every piece can also jump like a knight.', run: st => { st.fields.allkn = 2; } },
  { key: 'flip', name: 'AUSTRALIA MODE', text: 'Every piece is upside down for a round. No other effect. Just vibes.', run: st => { st.fields.flip = 2; } },
  { key: 'bighead', name: 'BIG HEAD MODE', text: 'Everyone is enormous for a round.', run: st => { st.fields.bighead = 2; } },
  { key: 'tiny', name: 'HONEY, I SHRUNK THE PIECES', text: 'Everyone is tiny for a round.', run: st => { st.fields.tiny = 2; } },
  { key: 'mutate', name: 'MUTATION SEASON', text: 'Two pieces on each side mutate and gain new powers.', run: st => {
    const keys = Object.keys(I.MUTATIONS);
    for (const s of ['w', 'b']) for (const i of shuffle(pieces(st, p => p.s === s && p.t !== 'K')).slice(0, 2)) { const p = st.board[i], have = p.mut || []; const m = pick(keys.filter(k => !have.includes(k))); if (m) st.board[i] = { ...p, mut: have.concat(m) }; } } },
  { key: 'storm', name: 'PAWN STORM', text: 'Every pawn charges one square forward.', run: st => {
    const ord = pieces(st, p => p.t === 'P'); let n = 0;
    ord.sort((a, b) => st.board[a].s === 'w' ? a - b : b - a);
    for (const i of ord) { const p = st.board[i]; if (!p || p.t !== 'P') continue; const j = i + (p.s === 'w' ? -N : N); if (j >= 0 && j < N * N && !st.board[j] && !blocked(st, j)) { st.board[j] = p; st.board[i] = null; n++; } }
    if (!n) return false; } },
  { key: 'gust', name: 'GUST OF WIND', text: 'Everything gets blown one square.', run: st => {
    const [dr, dc] = pick(DIR8), nb = st.board.slice(), ids = pieces(st, () => true);
    ids.sort((a, b) => { const [ra, ca] = rc(a), [rb, cb] = rc(b); return (rb * dr + cb * dc) - (ra * dr + ca * dc); });
    let n = 0; for (const i of ids) { const [r, c] = rc(i); if (!inB(r + dr, c + dc)) continue; const j = (r + dr) * N + c + dc; if (!nb[j] && !blocked(st, j)) { nb[j] = nb[i]; nb[i] = null; n++; } }
    if (!n) return false; st.board = nb; } },
  { key: 'chairs', name: 'MUSICAL CHAIRS', text: 'Random pieces swap places.', run: st => {
    const ps = shuffle(pieces(st, () => true)); for (let k = 0; k + 1 < Math.min(ps.length, 10); k += 2) { const a = ps[k], b = ps[k + 1]; const t = st.board[a]; st.board[a] = st.board[b]; st.board[b] = t; } } },
  { key: 'bombs', name: 'BOMB SQUAD', text: 'Two pieces on each side get bombs strapped to them.', run: st => {
    for (const s of ['w', 'b']) for (const i of shuffle(pieces(st, p => p.s === s && p.t !== 'K' && !p.bomb)).slice(0, 2)) st.board[i] = { ...st.board[i], bomb: 1 }; } },
  { key: 'meteors', name: 'METEOR SHOWER', text: 'Rocks fall from the sky. Kings are fine. Probably.', run: st => {
    const sq = []; for (let k = 0; k < 5; k++) sq.push((3 + rnd(N - 6)) * N + rnd(N));
    let n = 0; for (const i of sq) { if (st.board[i] && st.board[i].t !== 'K') { kill(st, i); n++; } if (!st.board[i]) st.terr[i] = { k: 'fire', n: 2 }; }
    st._marks = sq; } },
  { key: 'dance', name: 'THE KINGS DO A LITTLE DANCE', text: 'Each king hops to a random square next to it.', run: st => {
    let n = 0; for (const s of ['w', 'b']) { const k = pieces(st, p => p.t === 'K' && p.s === s)[0]; if (k == null) continue; const spot = shuffle(I.area(k).filter(j => !st.board[j] && !blocked(st, j)))[0]; if (spot != null) { st.board[spot] = st.board[k]; st.board[k] = null; n++; } }
    if (!n) return false; } },
  { key: 'inflation', name: 'INFLATION', text: "Everyone's coins are doubled.", run: st => { st.coins.w *= 2; st.coins.b *= 2; } },
  { key: 'crash', name: 'MARKET CRASH', text: "Everyone's coins are halved.", run: st => { st.coins.w = Math.floor(st.coins.w / 2); st.coins.b = Math.floor(st.coins.b / 2); } },
  { key: 'lottery', name: 'LOTTERY WINNER', text: 'Someone just won 10 coins.', run: st => { const s = Math.random() < .5 ? 'w' : 'b'; st.coins[s] += 10; st._winner = s; } },
  { key: 'freecards', name: 'FREE CARDS', text: 'Everybody gets a random card.', run: st => { for (const s of ['w', 'b']) I.addToHand(st, s, I.rollCard('all', 1)); } },
  { key: 'handswap', name: 'HANDS SWAPPED', text: 'You get their cards. They get yours.', run: st => { if (!st.hand.w.length && !st.hand.b.length) return false; const t = st.hand.w; st.hand.w = st.hand.b; st.hand.b = t; } },
  { key: 'nothing', name: 'NOTHING HAPPENED', text: '...suspicious.', weight: .4, run: () => {} },
];

function cloneSt(st) { const c = I.cloneState(st); c.terr = st.terr.slice(); return c; }
function roll(st, side, avoid) {
  const pool = EVENTS.filter(e => e.key !== avoid);
  const total = pool.reduce((s, e) => s + (e.weight || 1), 0);
  for (let tries = 0; tries < 20; tries++) {
    let x = Math.random() * total, ev = pool[0];
    for (const e of pool) { x -= e.weight || 1; if (x < 0) { ev = e; break; } }
    const sim = cloneSt(st);
    if (ev.run(sim, side) === false) continue;
    I.setEnv(sim);
    // never leave the side that just moved with its king hanging
    if (I.inCheck(sim.board, other(side))) continue;
    I.setEnv(st);
    return { ev, st: sim };
  }
  I.setEnv(st);
  return { ev: EVENTS.find(e => e.key === 'nothing'), st: cloneSt(st) };
}
I.CHAOS = { EVENTS, roll };
})();
