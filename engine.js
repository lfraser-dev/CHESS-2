/* Inkmate engine: units, terrain, board-wide effects, cards, packs and the computer opponent.
   Exposes everything on window.INK so art.js and game.js can use it. */
(() => {
'use strict';
const INK = window.INK = window.INK || {};
const N = 10;
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = DIR8.slice(0, 4), DIAG = DIR8.slice(4), ROW = [[0, 1], [0, -1]];
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const RING2 = []; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (dr || dc) RING2.push([dr, dc]);
const other = s => s === 'w' ? 'b' : 'w';
const rc = sq => [sq / N | 0, sq % N];
const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const mod = v => ((v % N) + N) % N;

// ===================================================================== units
// sl: [[dirs, max], ...] move-or-capture slides · quiet: 1-step moves to empty squares · leap: jumps
// shoot: [dirs, max] first piece along the line, captured from range · lob: [dirs, [dists]] ranged, over pieces
// strike: offsets, ranged · swap: trade places with adjacent piece · fly: ignores blockers when sliding
const U = {
  P: { name: 'Pawn', val: 1, pawn: 1, rules: 'Steps forward 1, or 2 from its starting row. Captures one square diagonally forward. Becomes a Queen on the far side.' },
  N: { name: 'Knight', val: 3, leap: KN, rules: 'Jumps in an L: two squares one way, one to the side. Leaps over anything.' },
  B: { name: 'Bishop', val: 3, sl: [[DIAG, 9]], rules: 'Slides any distance diagonally.' },
  R: { name: 'Rook', val: 5, sl: [[ORTH, 9]], rules: 'Slides any distance in straight lines.' },
  Q: { name: 'Queen', val: 9, sl: [[DIR8, 9]], rules: 'Slides any distance in any of the 8 directions.' },
  K: { name: 'King', val: 0, sl: [[DIR8, 1]], rules: 'Steps 1 square any way. If he is in check and can\'t escape, you lose.' },
  A: { name: 'Archer', val: 3, quiet: DIR8, shoot: [DIR8, 2], rules: 'Steps 1 square any way but can\'t capture by moving. Shoots the first enemy within 2 squares in any direction and stays put.' },
  W: { name: 'Stone Wall', val: 1, rules: 'Never moves, never captures. Just gets in the way.' },
  C: { name: 'Catapult', val: 4, quiet: ORTH, lob: [ORTH, [2, 3]], rules: 'Rolls 1 square straight. Lobs a rock over anything at an enemy exactly 2 or 3 squares away in a straight line (a king only if the line is clear).' },
  T: { name: 'Tank', val: 5, sl: [[ORTH, 3]], pawnProof: 1, rules: 'Drives up to 3 squares in straight lines. Pawns can\'t capture it.' },
  Z: { name: 'Wizard', val: 4, leap: KN, sl: [[DIAG, 2]], rules: 'Jumps like a knight, or glides up to 2 squares diagonally.' },
  D: { name: 'Dragon', val: 7, sl: [[DIR8, 3]], fly: 1, rules: 'Flies up to 3 squares in any direction, right over other pieces. It can only attack a king along a clear line.' },
  J: { name: 'F-15 Fighter Jet', val: 10, sl: [[DIR8, 9]], fly: 1, rules: 'Flies any distance in any of the 8 directions, straight over everything. It can only attack a king along a clear line.' },
  chicken: { name: 'Chicken', val: 0, sl: [[DIR8, 1]], noCap: 1, rules: 'Wanders 1 square any way. Can\'t capture. It\'s a chicken.' },
  keg: { name: 'Powder Keg', val: 2, boom: 1, rules: 'Doesn\'t move. When it\'s captured it explodes, wiping out everything next to it (kings survive).' },
  ghost: { name: 'Ghost', val: 2, sl: [[DIR8, 2]], fly: 1, noCap: 1, untouchable: 1, rules: 'Drifts up to 2 squares through anything. Can\'t capture, and only spells can hurt it.' },
  jester: { name: 'Jester', val: 3, sl: [[DIR8, 1]], swap: DIR8, rules: 'Steps 1 square any way, or swaps places with any piece next to it, friend or foe (not kings).' },
  assassin: { name: 'Assassin', val: 4, quiet: DIR8, strike: KN, rules: 'Steps 1 square to empty squares. Strikes an enemy a knight\'s jump away without moving.' },
  golem: { name: 'Stone Golem', val: 4, sl: [[ORTH, 1]], armor: 2, rules: 'Plods 1 square straight. Starts with 2 armour: each hit cracks one off instead of capturing it.' },
  heli: { name: 'Helicopter', val: 5, sl: [[DIR8, 4]], fly: 1, capMax: 3, rules: 'Flies up to 4 squares over anything, but can only capture pieces worth 3 or less.' },
  phoenix: { name: 'Phoenix', val: 6, sl: [[DIAG, 3]], fly: 1, reborn: 1, rules: 'Flies up to 3 squares diagonally. The first time it\'s captured it rises again on your back row.' },
  serpent: { name: 'Ouroboros Serpent', val: 6, sl: [[ORTH, 9]], wrapAll: 1, rules: 'Slides like a rook, and slithers off any edge to come back on the opposite side.' },
  egg: { name: 'Dragon Egg', val: 2, hatch: 3, rules: 'Can\'t move. Hatches into a Dragon after 3 of your turns.' },
  goose: { name: 'Golden Goose', val: 2, quiet: DIR8, noCap: 1, income: 3, rules: 'Waddles 1 square, can\'t capture. Lays 3 extra coins at the start of each of your turns.' },
  voidknight: { name: 'Void Knight', val: 6, sl: [[DIR8, 1], [ORTH, 2]], armor: 1, set: 'crusade', rules: 'Stomps 1 square any way or 2 straight. Wears 1 armour.' },
  plasma: { name: 'Plasma Trooper', val: 4, quiet: DIR8, shoot: [ORTH, 3], set: 'crusade', rules: 'Steps 1 square to empty squares. Fires down straight lines at the first enemy up to 3 squares away.' },
  titan: { name: 'Titan Walker', val: 12, sl: [[DIR8, 2]], armor: 2, shoot: [ORTH, 4], set: 'crusade', rules: 'Strides 2 squares any way, fires up to 4 squares in straight lines, and wears 2 armour.' },
  tumbleweed: { name: 'Tumbleweed', val: 1, sl: [[ROW, 3]], fly: 1, noCap: 1, set: 'west', rules: 'Blows up to 3 squares sideways, over anything. Can\'t capture. Gets in the way.' },
  bandit: { name: 'Bandit', val: 3, leap: KN, steal: 2, set: 'west', rules: 'Jumps like a knight. Every capture also steals 2 coins.' },
  sheriff: { name: 'Sheriff', val: 5, quiet: DIR8, shoot: [ROW, 9], set: 'west', rules: 'Steps 1 square to empty squares. Quick-draws on the first enemy anywhere along its row.' },
  stranger: { name: 'The Stranger', val: 11, sl: [[DIR8, 9]], shoot: [ORTH, 9], set: 'west', rules: 'Moves like a queen, and can also shoot the first enemy along any row or column without moving.' },
  tentacle: { name: 'Swamp Tentacle', val: 2, shoot: [ORTH, 1], set: 'monster', rules: 'Rooted to the spot. Grabs any enemy that ends up right next to it (not diagonally).' },
  moth: { name: 'Giant Moth', val: 5, sl: [[DIAG, 2]], fly: 1, dust: 1, set: 'monster', rules: 'Flutters up to 2 squares diagonally. Wherever it lands, enemies next to it are frozen for a turn.' },
  lizard: { name: 'Lizard King', val: 11, leap: RING2, stomp: 1, set: 'monster', rules: 'Leaps to any square within 2. When it captures, it stomps every enemy next to where it lands (kings survive).' },
  parrot: { name: 'Parrot', val: 1, sl: [[DIAG, 3]], fly: 1, noCap: 1, set: 'plunder', rules: 'Flies up to 3 squares diagonally. Can\'t capture, but it\'s great at getting in the way.' },
  cannon: { name: 'Ship\'s Cannon', val: 4, shoot: [ROW, 4], set: 'plunder', rules: 'Can\'t move. Blasts the first enemy up to 4 squares left or right.' },
  captain: { name: 'Pirate Captain', val: 6, sl: [[DIR8, 2]], plunder: 2, set: 'plunder', rules: 'Moves up to 2 squares any way. Every capture earns 2 extra coins.' },
  kraken: { name: 'Kraken', val: 9, ring: RING2, set: 'plunder', rules: 'Can\'t move. Drags under any enemy within 2 squares, over anything in between. Kings only if they\'re right next to it.' },
};
const VAL = t => U[t].val;

// ===================================================================== environment for move generation
const ENV = { terr: new Array(N * N).fill(null), wrap: false, truce: false, km: false, bp: false };
function setEnv(st) {
  ENV.terr = st.terr; ENV.wrap = st.fields.wrap > 0; ENV.truce = st.fields.truce > 0; ENV.km = st.fields.km > 0; ENV.bp = st.fields.bp > 0;
}
const blockedSq = i => { const t = ENV.terr[i]; return !!t && (t.k === 'pit' || t.k === 'fire'); };

function canCap(p, u, q, qsq) {
  if (!q || q.s === p.s || q.sh > 0 || ENV.truce || u.noCap) return false;
  const qu = U[q.t];
  if (qu.untouchable) return false;
  if (qu.pawnProof && u.pawn) return false;
  if (u.capMax && qu.val > u.capMax) return false;
  const t = ENV.terr[qsq];
  if (t && t.k === 'holy' && q.t !== 'K') return false;
  return true;
}

function genMoves(bd, side, out = []) {
  for (let sq = 0; sq < N * N; sq++) {
    const p = bd[sq];
    if (!p || p.s !== side || p.fz > 0) continue;
    const u = U[p.t]; const r = sq / N | 0, c = sq % N;
    const to = (rr, cc) => {
      if (u.wrapAll) { rr = mod(rr); cc = mod(cc); } else if (ENV.wrap) cc = mod(cc);
      return inB(rr, cc) ? rr * N + cc : -1;
    };
    const addCap = (t, ranged) => { const q = bd[t]; if (q.ar > 0) out.push({ f: sq, t, cap: q, arm: true }); else out.push({ f: sq, t, cap: q, r: !!ranged }); };
    const addMove = (t, pr) => out.push({ f: sq, t, cap: null, pr });
    if (u.pawn) {
      const d = side === 'w' ? -1 : 1, last = side === 'w' ? 0 : N - 1, start = side === 'w' ? N - 2 : 1;
      const t1 = to(r + d, c);
      if (t1 >= 0 && !bd[t1] && !blockedSq(t1)) {
        addMove(t1, (r + d) === last ? 'Q' : undefined);
        const t2 = to(r + 2 * d, c);
        if (r === start && t2 >= 0 && !bd[t2] && !blockedSq(t2)) addMove(t2);
      }
      for (const dc of [-1, 1]) {
        const t = to(r + d, c + dc);
        if (t >= 0 && canCap(p, u, bd[t], t)) {
          if (bd[t].ar > 0) out.push({ f: sq, t, cap: bd[t], arm: true });
          else out.push({ f: sq, t, cap: bd[t], pr: (r + d) === last ? 'Q' : undefined });
        }
      }
      if (ENV.km) for (const [dr, dc] of KN) { const t = to(r + dr, c + dc); if (t < 0) continue; if (!bd[t]) { if (!blockedSq(t)) addMove(t); } else if (canCap(p, u, bd[t], t)) addCap(t); }
      if (ENV.bp) { const t = to(r - d, c); if (t >= 0 && !bd[t] && !blockedSq(t)) addMove(t); }
      continue;
    }
    if (u.sl) for (const [dirs, max] of u.sl) for (const [dr, dc] of dirs) {
      let over = false; // fliers can't attack a king they have to fly over
      for (let k = 1; k <= max; k++) {
        const t = to(r + dr * k, c + dc * k);
        if (t < 0 || t === sq) break;
        const q = bd[t];
        if (!q) { if (blockedSq(t)) { if (u.fly) continue; break; } addMove(t); continue; }
        if (canCap(p, u, q, t) && !(over && q.t === 'K')) addCap(t);
        if (!u.fly) break;
        over = true;
      }
    }
    if (u.quiet) for (const [dr, dc] of u.quiet) { const t = to(r + dr, c + dc); if (t >= 0 && !bd[t] && !blockedSq(t)) addMove(t); }
    if (u.leap) for (const [dr, dc] of u.leap) {
      const t = to(r + dr, c + dc); if (t < 0) continue;
      if (!bd[t]) { if (!blockedSq(t)) addMove(t); } else if (canCap(p, u, bd[t], t)) addCap(t);
    }
    if (u.shoot) for (const [dr, dc] of u.shoot[0]) for (let k = 1; k <= u.shoot[1]; k++) {
      const t = to(r + dr * k, c + dc * k);
      if (t < 0 || t === sq) break;
      const q = bd[t]; if (!q) continue;
      if (canCap(p, u, q, t)) addCap(t, true);
      break;
    }
    if (u.lob) for (const [dr, dc] of u.lob[0]) for (const k of u.lob[1]) {
      const t = to(r + dr * k, c + dc * k); if (t < 0 || !canCap(p, u, bd[t], t)) continue;
      if (bd[t].t === 'K') { let clear = true; for (let j = 1; j < k; j++) { const m = to(r + dr * j, c + dc * j); if (m >= 0 && bd[m]) clear = false; } if (!clear) continue; }
      addCap(t, true);
    }
    if (u.strike) for (const [dr, dc] of u.strike) { const t = to(r + dr, c + dc); if (t >= 0 && canCap(p, u, bd[t], t)) addCap(t, true); }
    if (u.ring) for (const [dr, dc] of u.ring) { const t = to(r + dr, c + dc); if (t >= 0 && canCap(p, u, bd[t], t) && !(bd[t].t === 'K' && Math.max(Math.abs(dr), Math.abs(dc)) > 1)) addCap(t, true); }
    if (u.swap) for (const [dr, dc] of u.swap) {
      const t = to(r + dr, c + dc); if (t < 0) continue;
      const q = bd[t];
      if (q && q.t !== 'K' && !U[q.t].untouchable && q.sh <= 0) out.push({ f: sq, t, cap: null, sw: true });
    }
  }
  return out;
}
function makeMove(bd, m) {
  const sv = [bd[m.f], bd[m.t]];
  if (m.sw) { bd[m.f] = sv[1]; bd[m.t] = sv[0]; }
  else if (m.arm) bd[m.t] = { ...sv[1], ar: sv[1].ar - 1 };
  else if (m.r) bd[m.t] = null;
  else { bd[m.t] = m.pr ? { ...sv[0], t: m.pr } : sv[0]; bd[m.f] = null; }
  return sv;
}
function unmake(bd, m, sv) { bd[m.f] = sv[0]; bd[m.t] = sv[1]; }
function kingSq(bd, side) { for (let i = 0; i < N * N; i++) { const p = bd[i]; if (p && p.t === 'K' && p.s === side) return i; } return -1; }
function attacked(bd, sq, by) { if (sq < 0) return false; const ms = genMoves(bd, by); for (const m of ms) if (m.t === sq && m.cap && !m.sw) return true; return false; }
const inCheck = (bd, side) => attacked(bd, kingSq(bd, side), other(side));
function legalMoves(bd, side) {
  return genMoves(bd, side).filter(m => { const sv = makeMove(bd, m); const ok = !inCheck(bd, side); unmake(bd, m, sv); return ok; });
}

// ===================================================================== state
let pid = 1;
function mkPiece(t, s) {
  const u = U[t];
  return { t, s, id: pid++, fz: 0, sh: 0, ar: u.armor || 0, reb: u.reborn ? 1 : 0, hatch: u.hatch || 0, curse: 0, bomb: 0, bounty: 0 };
}
function newState(mode) {
  pid = 1;
  const bd = new Array(N * N).fill(null);
  const back = ['R', 'N', 'B', 'A', 'Q', 'K', 'A', 'B', 'N', 'R'];
  for (let c = 0; c < N; c++) {
    bd[c] = mkPiece(back[c], 'b'); bd[N + c] = mkPiece('P', 'b');
    bd[8 * N + c] = mkPiece('P', 'w'); bd[9 * N + c] = mkPiece(back[c], 'w');
  }
  return {
    mode, board: bd, terr: new Array(N * N).fill(null), fields: { wrap: 0, truce: 0, km: 0, bp: 0 },
    turn: 'w', coins: { w: 5, b: 5 }, hand: { w: [], b: [] }, grave: { w: [], b: [] }, snaps: [], extra: false,
    ply: 0, quiet: 0, over: null, last: null, log: [],
  };
}
function cloneState(st) {
  return {
    mode: st.mode, board: st.board.slice(), terr: st.terr.slice(), fields: { ...st.fields }, turn: st.turn,
    coins: { ...st.coins }, hand: { w: st.hand.w.slice(), b: st.hand.b.slice() }, grave: { w: st.grave.w.slice(), b: st.grave.b.slice() },
    snaps: st.snaps, extra: false, ply: st.ply, quiet: st.quiet,
  };
}
const homeRows = side => side === 'w' ? [9, 8, 7] : [0, 1, 2];
const halfRows = side => side === 'w' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];

// ===================================================================== cards
const SETS = {
  classic: { name: 'Inkmate Classic', short: '' },
  crusade: { name: 'Iron Crusade', short: 'Iron Crusade' },
  west: { name: 'Dust & Daring', short: 'Dust & Daring' },
  monster: { name: 'Monster Mayhem', short: 'Monster Mayhem' },
  plunder: { name: 'Plunder', short: 'Plunder' },
};
const notKing = p => p.t !== 'K';
const hittable = p => notKing(p) && p.sh <= 0;
function kill(st, sq, ev) {
  const p = st.board[sq];
  if (!p || p.t === 'K') return false;
  st.board[sq] = null; st.grave[p.s].push(p.t);
  ev.push({ type: 'destroy', sq, p });
  return true;
}
function area(sq, rad = 1) { const [r, c] = rc(sq), out = []; for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) if (inB(r + dr, c + dc)) out.push((r + dr) * N + c + dc); return out; }
function plus(sq) { const [r, c] = rc(sq), out = [sq]; for (const [dr, dc] of ORTH) if (inB(r + dr, c + dc)) out.push((r + dr) * N + c + dc); return out; }
const randOf = a => a[Math.floor(Math.random() * a.length)];
const emptyOk = (st, i) => !st.board[i] && !(st.terr[i] && (st.terr[i].k === 'pit' || st.terr[i].k === 'fire'));

// target types: home | empty | square | enemy | own | none | pair
const CARDS = {
  // ---------- Classic: units
  pawn: { name: 'Pawn', kind: 'unit', unit: 'P', rarity: 'common' },
  knight: { name: 'Knight', kind: 'unit', unit: 'N', rarity: 'common' },
  wall: { name: 'Stone Wall', kind: 'unit', unit: 'W', rarity: 'common' },
  chicken: { name: 'Chicken', kind: 'unit', unit: 'chicken', rarity: 'common' },
  bishop: { name: 'Bishop', kind: 'unit', unit: 'B', rarity: 'uncommon' },
  archer: { name: 'Archer', kind: 'unit', unit: 'A', rarity: 'uncommon' },
  wizard: { name: 'Wizard', kind: 'unit', unit: 'Z', rarity: 'uncommon' },
  keg: { name: 'Powder Keg', kind: 'unit', unit: 'keg', rarity: 'uncommon' },
  ghost: { name: 'Ghost', kind: 'unit', unit: 'ghost', rarity: 'uncommon' },
  rook: { name: 'Rook', kind: 'unit', unit: 'R', rarity: 'rare' },
  catapult: { name: 'Catapult', kind: 'unit', unit: 'C', rarity: 'rare' },
  tank: { name: 'Tank', kind: 'unit', unit: 'T', rarity: 'rare' },
  jester: { name: 'Jester', kind: 'unit', unit: 'jester', rarity: 'rare' },
  assassin: { name: 'Assassin', kind: 'unit', unit: 'assassin', rarity: 'rare' },
  golem: { name: 'Stone Golem', kind: 'unit', unit: 'golem', rarity: 'rare' },
  heli: { name: 'Helicopter', kind: 'unit', unit: 'heli', rarity: 'rare' },
  queen: { name: 'Queen', kind: 'unit', unit: 'Q', rarity: 'epic' },
  dragon: { name: 'Dragon', kind: 'unit', unit: 'D', rarity: 'epic' },
  phoenix: { name: 'Phoenix', kind: 'unit', unit: 'phoenix', rarity: 'epic' },
  serpent: { name: 'Ouroboros Serpent', kind: 'unit', unit: 'serpent', rarity: 'epic' },
  jet: { name: 'F-15 Fighter Jet', kind: 'unit', unit: 'J', rarity: 'legendary' },
  goose: { name: 'Golden Goose', kind: 'unit', unit: 'goose', rarity: 'legendary' },

  // ---------- Classic: spells
  freeze: { name: 'Freeze', rarity: 'common', text: 'Freeze an enemy piece (not the king). It can\'t move or capture for its next 2 turns.',
    target: { t: 'enemy', f: p => hittable(p) && p.fz <= 0 }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], fz: 2 }; ev.push({ type: 'spell', sq: o.a }); } },
  shield: { name: 'Shield', rarity: 'common', text: 'Protect one of your pieces (not the king) until your next turn.',
    target: { t: 'own', f: p => notKing(p) && p.sh <= 0 }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], sh: 1 }; ev.push({ type: 'spell', sq: o.a }); } },
  pit: { name: 'Dig a Pit', rarity: 'common', text: 'Turn an empty square into a pit for good. Nothing can stop on it, and only fliers can cross it.',
    target: { t: 'empty', f: (st, i) => !st.terr[i] }, fx: (st, s, o, ev) => { st.terr[o.a] = { k: 'pit' }; ev.push({ type: 'spell', sq: o.a }); } },
  truce: { name: 'White Flag', rarity: 'common', text: 'Nobody can capture anything until the end of your next turn.', ai: 5,
    target: { t: 'none' }, fx: (st, s, o, ev) => { st.fields.truce = 3; ev.push({ type: 'field', key: 'truce' }); } },
  pickpocket: { name: 'Pickpocket', rarity: 'common', text: 'Steal 3 coins from your opponent.', ai: 28,
    target: { t: 'none', can: (st, s) => st.coins[other(s)] > 0 }, fx: (st, s, o, ev) => { const n = Math.min(3, st.coins[other(s)]); st.coins[other(s)] -= n; st.coins[s] += n; ev.push({ type: 'msg', text: `stole ${n} coin${n === 1 ? '' : 's'}` }); } },
  shuffle: { name: 'Swap Spots', rarity: 'common', text: 'Two of your pieces swap places.',
    target: { t: 'pair', first: (st, s) => sqs(st, (p) => p.s === s && p.fz <= 0), second: (st, s, a) => sqs(st, (p, i) => p.s === s && i !== a && p.fz <= 0) },
    fx: (st, s, o, ev) => { const t = st.board[o.a]; st.board[o.a] = st.board[o.b]; st.board[o.b] = t; ev.push({ type: 'spell', sq: o.a, sq2: o.b }); } },
  levy: { name: 'Call to Arms', rarity: 'uncommon', text: 'Two new pawns join your second row.',
    target: { t: 'none', can: (st, s) => { const r = homeRows(s)[1]; for (let c = 0; c < N; c++) if (emptyOk(st, r * N + c)) return true; return false; } },
    fx: (st, s, o, ev) => { const r = homeRows(s)[1]; [4, 5, 3, 6, 2, 7, 1, 8, 0, 9].filter(c => emptyOk(st, r * N + c)).slice(0, 2).forEach(c => { st.board[r * N + c] = mkPiece('P', s); ev.push({ type: 'summon', sq: r * N + c }); }); } },
  knighted: { name: 'Knighted', rarity: 'uncommon', text: 'Turn one of your pawns into a knight.',
    target: { t: 'own', f: p => p.t === 'P' }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], t: 'N' }; ev.push({ type: 'spell', sq: o.a }); } },
  armor: { name: 'Plate Armour', rarity: 'uncommon', text: 'Give one of your pieces (not the king) 1 armour. The next hit cracks the armour instead.',
    target: { t: 'own', f: p => notKing(p) }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], ar: st.board[o.a].ar + 1 }; ev.push({ type: 'spell', sq: o.a }); } },
  bombvest: { name: 'Strap on a Bomb', rarity: 'uncommon', text: 'If this piece of yours gets captured, it explodes and takes out everything next to it.', ai: 22,
    target: { t: 'own', f: p => notKing(p) && !p.bomb }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], bomb: 1 }; ev.push({ type: 'spell', sq: o.a }); } },
  curse: { name: 'Curse', rarity: 'uncommon', text: 'Curse an enemy piece (not the king). It crumbles to dust after 3 of its turns.',
    target: { t: 'enemy', f: p => hittable(p) && !p.curse }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], curse: 3 }; ev.push({ type: 'spell', sq: o.a }); } },
  mine: { name: 'Landmine', rarity: 'uncommon', text: 'Bury a mine on an empty square. The first enemy to stop there is blown up (kings just get singed). Your opponent can\'t see it.', ai: 18,
    target: { t: 'empty', f: (st, i) => !st.terr[i] }, fx: (st, s, o, ev) => { st.terr[o.a] = { k: 'mine', s }; ev.push({ type: 'spell', sq: o.a, hidden: true }); } },
  firewall: { name: 'Wall of Fire', rarity: 'uncommon', text: 'Set a row of 3 empty squares alight for 3 turns each. Nothing can enter, and only fliers can cross.',
    target: { t: 'empty', f: (st, i) => !st.terr[i] }, fx: (st, s, o, ev) => { const [r, c] = rc(o.a); for (const dc of [-1, 0, 1]) { const i = r * N + c + dc; if (inB(r, c + dc) && emptyOk(st, i) && !st.terr[i]) st.terr[i] = { k: 'fire', n: 6 }; } ev.push({ type: 'spell', sq: o.a }); } },
  sketch: { name: 'Quick Sketch', rarity: 'uncommon', text: 'Draw 2 random cards.', ai: 45,
    target: { t: 'none' }, fx: (st, s, o, ev) => { const got = [rollCard('classic', 0), rollCard('classic', 0)]; for (const k of got) addToHand(st, s, k, ev); ev.push({ type: 'draw', keys: got }); } },
  spill: { name: 'Spilled Ink', rarity: 'uncommon', text: 'Your opponent loses a random card from their hand.', ai: 32,
    target: { t: 'none', can: (st, s) => st.hand[other(s)].length > 0 }, fx: (st, s, o, ev) => { const h = st.hand[other(s)]; const i = Math.floor(Math.random() * h.length); const k = h.splice(i, 1)[0]; ev.push({ type: 'msg', text: `ruined their ${CARDS[k].name}` }); } },
  backpedal: { name: 'Backpedal', rarity: 'uncommon', text: 'For 4 turns each, every pawn can also step 1 square backwards.', ai: 4,
    target: { t: 'none' }, fx: (st, s, o, ev) => { st.fields.bp = 8; ev.push({ type: 'field', key: 'bp' }); } },
  fireball: { name: 'Fireball', rarity: 'rare', text: 'Burn up an enemy piece worth 3 or less (not the king).',
    target: { t: 'enemy', f: p => hittable(p) && VAL(p.t) <= 3 }, fx: (st, s, o, ev) => { ev.push({ type: 'spell', sq: o.a }); kill(st, o.a, ev); } },
  teleport: { name: 'Teleport', rarity: 'rare', text: 'Move one of your pieces (not the king) to any empty square on your half.',
    target: { t: 'pair', first: (st, s) => sqs(st, p => p.s === s && notKing(p) && p.fz <= 0), second: (st, s) => halfRows(s).flatMap(r => [...Array(N).keys()].map(c => r * N + c)).filter(i => emptyOk(st, i)) },
    fx: (st, s, o, ev) => { st.board[o.b] = st.board[o.a]; st.board[o.a] = null; ev.push({ type: 'spell', sq: o.a, sq2: o.b }); } },
  polymorph: { name: 'Chicken Curse', rarity: 'rare', text: 'Turn an enemy piece worth 5 or less (not the king) into a chicken.',
    target: { t: 'enemy', f: p => hittable(p) && VAL(p.t) <= 5 && p.t !== 'chicken' }, fx: (st, s, o, ev) => { const p = st.board[o.a]; st.board[o.a] = { ...mkPiece('chicken', p.s), id: p.id }; ev.push({ type: 'spell', sq: o.a }); } },
  resurrect: { name: 'Raise the Fallen', rarity: 'rare', text: 'Your most valuable captured piece comes back, onto an empty square in your back three rows.',
    target: { t: 'home', can: (st, s) => st.grave[s].some(t => t !== 'K') }, fx: (st, s, o, ev) => {
      const g = st.grave[s]; let bi = -1; g.forEach((t, i) => { if (bi < 0 || VAL(t) > VAL(g[bi])) bi = i; });
      const t = g.splice(bi, 1)[0]; st.board[o.a] = mkPiece(t, s); ev.push({ type: 'summon', sq: o.a }); ev.push({ type: 'msg', text: `brought back a ${U[t].name}` }); } },
  sanctuary: { name: 'Holy Ground', rarity: 'rare', text: 'Bless a square for good. No piece standing on it can be captured (except kings).',
    target: { t: 'square', f: (st, i) => !st.terr[i] && (!st.board[i] || notKing(st.board[i])) }, fx: (st, s, o, ev) => { st.terr[o.a] = { k: 'holy' }; ev.push({ type: 'spell', sq: o.a }); } },
  thief: { name: 'Sticky Fingers', rarity: 'rare', text: 'Steal a random card from your opponent\'s hand.', ai: 50,
    target: { t: 'none', can: (st, s) => st.hand[other(s)].length > 0 }, fx: (st, s, o, ev) => { const h = st.hand[other(s)]; const k = h.splice(Math.floor(Math.random() * h.length), 1)[0]; addToHand(st, s, k, ev); ev.push({ type: 'msg', text: `stole ${CARDS[k].name}` }); } },
  rewind: { name: 'Rewind', rarity: 'rare', text: 'Undo your opponent\'s last turn. Everything on the board goes back to how it was.',
    target: { t: 'none', can: (st, s) => !!lastSnap(st, other(s)) }, fx: (st, s, o, ev) => { const sn = lastSnap(st, other(s)); st.board = sn.board.slice(); st.terr = sn.terr.slice(); ev.push({ type: 'field', key: 'rewind' }); } },
  knightmare: { name: 'Knightmare', rarity: 'rare', text: 'For 4 turns each, every pawn can also jump like a knight.', ai: 4,
    target: { t: 'none' }, fx: (st, s, o, ev) => { st.fields.km = 8; ev.push({ type: 'field', key: 'km' }); } },
  mirror: { name: 'Mirror, Mirror', rarity: 'rare', text: 'Flip the whole board left to right.', ai: -10,
    target: { t: 'none' }, fx: (st, s, o, ev) => { const b = st.board.slice(), t = st.terr.slice(); for (let i = 0; i < N * N; i++) { const [r, c] = rc(i); st.board[i] = b[r * N + (N - 1 - c)]; st.terr[i] = t[r * N + (N - 1 - c)]; } ev.push({ type: 'field', key: 'mirror' }); } },
  earthquake: { name: 'Earthquake', rarity: 'rare', text: 'The ground shakes: every enemy piece (not the king) gets shoved 1 square in a random direction, if there\'s room.', ai: 10, random: 1,
    target: { t: 'none' }, fx: (st, s, o, ev) => {
      const list = sqs(st, p => p.s !== s && notKing(p)); list.sort(() => Math.random() - .5);
      for (const i of list) { const [r, c] = rc(i); const opts = DIR8.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => inB(rr, cc) && emptyOk(st, rr * N + cc)); if (!opts.length) continue; const [rr, cc] = randOf(opts); st.board[rr * N + cc] = st.board[i]; st.board[i] = null; }
      ev.push({ type: 'field', key: 'quake' }); } },
  lightning: { name: 'Lightning Strike', rarity: 'epic', text: 'Destroy any enemy piece except the king.',
    target: { t: 'enemy', f: hittable }, fx: (st, s, o, ev) => { ev.push({ type: 'spell', sq: o.a }); kill(st, o.a, ev); } },
  decree: { name: 'Royal Decree', rarity: 'epic', text: 'Turn one of your pawns into a queen.',
    target: { t: 'own', f: p => p.t === 'P' }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], t: 'Q' }; ev.push({ type: 'spell', sq: o.a }); } },
  doubletime: { name: 'Double Time', rarity: 'epic', text: 'Take another turn straight after this one.', ai: 110,
    target: { t: 'none' }, fx: (st, s, o, ev) => { st.extra = true; ev.push({ type: 'field', key: 'double' }); } },
  mindcontrol: { name: 'Mind Control', rarity: 'epic', text: 'Take control of an enemy piece worth 5 or less (not the king) for good.',
    target: { t: 'enemy', f: p => hittable(p) && VAL(p.t) <= 5 }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], s, fz: 0, curse: 0, bounty: 0 }; ev.push({ type: 'spell', sq: o.a }); } },
  clone: { name: 'Ink Clone', rarity: 'epic', text: 'Copy one of your pieces worth 5 or less onto an empty square next to it.',
    target: { t: 'pair', first: (st, s) => sqs(st, p => p.s === s && notKing(p) && VAL(p.t) <= 5).filter(i => area(i).some(j => emptyOk(st, j))), second: (st, s, a) => area(a).filter(j => emptyOk(st, j)) },
    fx: (st, s, o, ev) => { st.board[o.b] = mkPiece(st.board[o.a].t, s); ev.push({ type: 'summon', sq: o.b }); } },
  ouroboros: { name: 'Ouroboros', rarity: 'epic', text: 'For 5 turns each, the left and right edges of the board join up. Pieces can slide off one side and come back on the other.', ai: 6,
    target: { t: 'none' }, fx: (st, s, o, ev) => { st.fields.wrap = 10; ev.push({ type: 'field', key: 'wrap' }); } },
  swaphands: { name: 'Swap Hands', rarity: 'epic', text: 'You and your opponent swap every card in your hands.',
    ai: (st, s) => (st.hand[other(s)].length - (st.hand[s].length - 1)) * 40 - 10,
    target: { t: 'none' }, fx: (st, s, o, ev) => { const a = st.hand[s]; st.hand[s] = st.hand[other(s)]; st.hand[other(s)] = a; ev.push({ type: 'msg', text: 'swapped hands' }); } },
  meteor: { name: 'Meteor', rarity: 'legendary', text: 'Smash a 3×3 area. Every enemy piece in it is destroyed (except the king).',
    target: { t: 'square', f: (st, i, s) => area(i).some(j => st.board[j] && st.board[j].s !== s && hittable(st.board[j])) },
    fx: (st, s, o, ev) => { ev.push({ type: 'spell', sq: o.a }); for (const j of area(o.a)) if (st.board[j] && st.board[j].s !== s && st.board[j].sh <= 0) kill(st, j, ev); } },
  pouch: { name: 'Coin Pouch', kind: 'coin', amount: 3, rarity: 'common', text: '+3 coins, straight away.' },
  purse: { name: 'Fat Purse', kind: 'coin', amount: 5, rarity: 'uncommon', text: '+5 coins, straight away.' },
  chest: { name: 'Treasure Chest', kind: 'coin', amount: 8, rarity: 'rare', text: '+8 coins, straight away.' },

  // ---------- Iron Crusade
  hymn: { set: 'crusade', name: 'Battle Hymn', rarity: 'common', text: 'All your pawns are shielded until your next turn.',
    target: { t: 'none', can: (st, s) => st.board.some(p => p && p.s === s && p.t === 'P') }, fx: (st, s, o, ev) => { st.board.forEach((p, i) => { if (p && p.s === s && p.t === 'P') st.board[i] = { ...p, sh: 1 }; }); ev.push({ type: 'field', key: 'hymn' }); } },
  crate: { set: 'crusade', name: 'Supply Drop', kind: 'coin', amount: 4, rarity: 'common', text: '+4 coins, straight away.' },
  plasmaC: { set: 'crusade', name: 'Plasma Trooper', kind: 'unit', unit: 'plasma', rarity: 'uncommon' },
  repairs: { set: 'crusade', name: 'Field Repairs', rarity: 'uncommon', text: 'Bolt 2 armour onto one of your pieces (not the king).',
    target: { t: 'own', f: p => notKing(p) }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], ar: st.board[o.a].ar + 2 }; ev.push({ type: 'spell', sq: o.a }); } },
  voidC: { set: 'crusade', name: 'Void Knight', kind: 'unit', unit: 'voidknight', rarity: 'rare' },
  droppod: { set: 'crusade', name: 'Drop Pod', rarity: 'epic', text: 'Slam a Void Knight down onto ANY empty square on the board.',
    target: { t: 'empty' }, fx: (st, s, o, ev) => { st.board[o.a] = mkPiece('voidknight', s); ev.push({ type: 'summon', sq: o.a, big: true }); } },
  orbital: { set: 'crusade', name: 'Orbital Strike', rarity: 'epic', text: 'Blast a square and the 4 squares touching its sides. Everything there is destroyed, yours too (kings survive).',
    target: { t: 'square', f: (st, i, s) => plus(i).some(j => st.board[j] && st.board[j].s !== s && notKing(st.board[j])) },
    fx: (st, s, o, ev) => { ev.push({ type: 'spell', sq: o.a }); for (const j of plus(o.a)) kill(st, j, ev); } },
  titanC: { set: 'crusade', name: 'Titan Walker', kind: 'unit', unit: 'titan', rarity: 'legendary' },

  // ---------- Dust & Daring (Wild West)
  tumbleC: { set: 'west', name: 'Tumbleweed', kind: 'unit', unit: 'tumbleweed', rarity: 'common' },
  poker: { set: 'west', name: 'Poker Winnings', kind: 'coin', amount: 4, rarity: 'common', text: '+4 coins, straight away.' },
  banditC: { set: 'west', name: 'Bandit', kind: 'unit', unit: 'bandit', rarity: 'uncommon' },
  wanted: { set: 'west', name: 'Wanted Poster', rarity: 'uncommon', text: 'Put a bounty on an enemy piece (not the king). Whoever captures it gets 5 extra coins.', ai: 15,
    target: { t: 'enemy', f: p => notKing(p) && !p.bounty }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], bounty: 1 }; ev.push({ type: 'spell', sq: o.a }); } },
  sheriffC: { set: 'west', name: 'Sheriff', kind: 'unit', unit: 'sheriff', rarity: 'rare' },
  lasso: { set: 'west', name: 'Lasso', rarity: 'rare', text: 'Rope an enemy piece (not the king) and drag it 2 squares towards you, if the way is clear.',
    target: { t: 'enemy', f: (p, i, st) => { if (!hittable(p)) return false; const d = p.s === 'w' ? -1 : 1; const [r, c] = rc(i); return inB(r - d, c) && emptyOk(st, (r - d) * N + c); } },
    fx: (st, s, o, ev) => { const p = st.board[o.a]; const d = p.s === 'w' ? -1 : 1; const [r, c] = rc(o.a); let to = (r - d) * N + c; if (inB(r - 2 * d, c) && emptyOk(st, (r - 2 * d) * N + c)) to = (r - 2 * d) * N + c; st.board[to] = p; st.board[o.a] = null; ev.push({ type: 'spell', sq: o.a, sq2: to }); } },
  goldrush: { set: 'west', name: 'Gold Rush', kind: 'coin', amount: (st, s) => 2 + 2 * st.board.filter(p => p && p.s === s && p.t === 'P').length, rarity: 'rare', text: '+2 coins, plus 2 more for every pawn you have.' },
  stagecoach: { set: 'west', name: 'Stagecoach Robbery', rarity: 'epic', text: 'Steal 6 coins AND a random card from your opponent.', ai: 80,
    target: { t: 'none', can: (st, s) => st.coins[other(s)] > 0 || st.hand[other(s)].length > 0 }, fx: (st, s, o, ev) => {
      const n = Math.min(6, st.coins[other(s)]); st.coins[other(s)] -= n; st.coins[s] += n;
      const h = st.hand[other(s)]; let txt = `stole ${n} coins`;
      if (h.length) { const k = h.splice(Math.floor(Math.random() * h.length), 1)[0]; addToHand(st, s, k, ev); txt += ` and ${CARDS[k].name}`; }
      ev.push({ type: 'msg', text: txt }); } },
  strangerC: { set: 'west', name: 'The Stranger', kind: 'unit', unit: 'stranger', rarity: 'legendary' },

  // ---------- Monster Mayhem
  tentacleC: { set: 'monster', name: 'Swamp Tentacle', kind: 'unit', unit: 'tentacle', rarity: 'common' },
  goo: { set: 'monster', name: 'Toxic Spill', rarity: 'common', text: 'Slime a 2×2 patch. Enemy pieces in it (not the king) are cursed and rot away after 2 of their turns.',
    target: { t: 'square', f: (st, i, s) => { const [r, c] = rc(i); if (r >= N - 1 || c >= N - 1) return false; return [i, i + 1, i + N, i + N + 1].some(j => st.board[j] && st.board[j].s !== s && hittable(st.board[j])); } },
    fx: (st, s, o, ev) => { for (const j of [o.a, o.a + 1, o.a + N, o.a + N + 1]) { const p = st.board[j]; if (p && p.s !== s && hittable(p)) st.board[j] = { ...p, curse: p.curse ? Math.min(p.curse, 2) : 2 }; } ev.push({ type: 'spell', sq: o.a }); } },
  mutate: { set: 'monster', name: 'Mutate', rarity: 'uncommon', text: 'One of your pawns mutates into something random and nastier.', random: 1,
    target: { t: 'own', f: p => p.t === 'P' }, fx: (st, s, o, ev) => { const t = randOf(['N', 'B', 'Z', 'A', 'C', 'T', 'jester', 'assassin', 'golem', 'heli', 'moth']); st.board[o.a] = { ...st.board[o.a], t, ar: U[t].armor || st.board[o.a].ar }; ev.push({ type: 'spell', sq: o.a }); ev.push({ type: 'msg', text: `mutated a pawn into a ${U[t].name}` }); } },
  eggC: { set: 'monster', name: 'Dragon Egg', kind: 'unit', unit: 'egg', rarity: 'uncommon' },
  mothC: { set: 'monster', name: 'Giant Moth', kind: 'unit', unit: 'moth', rarity: 'rare' },
  stomp: { set: 'monster', name: 'Giant Footprint', rarity: 'rare', text: 'Something huge steps on a 3×3 area. Every enemy pawn and chicken in it is squashed.',
    target: { t: 'square', f: (st, i, s) => area(i).some(j => st.board[j] && st.board[j].s !== s && (st.board[j].t === 'P' || st.board[j].t === 'chicken') && st.board[j].sh <= 0) },
    fx: (st, s, o, ev) => { ev.push({ type: 'spell', sq: o.a }); for (const j of area(o.a)) { const p = st.board[j]; if (p && p.s !== s && (p.t === 'P' || p.t === 'chicken') && p.sh <= 0) kill(st, j, ev); } } },
  siren: { set: 'monster', name: 'Monster Siren', rarity: 'epic', text: 'The air-raid siren wails. Every enemy pawn freezes for 1 turn.',
    target: { t: 'none' }, fx: (st, s, o, ev) => { st.board.forEach((p, i) => { if (p && p.s !== s && p.t === 'P') st.board[i] = { ...p, fz: Math.max(p.fz, 1) }; }); ev.push({ type: 'field', key: 'siren' }); } },
  lizardC: { set: 'monster', name: 'Lizard King', kind: 'unit', unit: 'lizard', rarity: 'legendary' },

  // ---------- Plunder (pirates)
  parrotC: { set: 'plunder', name: 'Parrot', kind: 'unit', unit: 'parrot', rarity: 'common' },
  bottle: { set: 'plunder', name: 'Message in a Bottle', rarity: 'common', text: 'Draw 1 random card. Could be anything.', ai: 25,
    target: { t: 'none' }, fx: (st, s, o, ev) => { const k = rollCard(Math.random() < .5 ? 'plunder' : 'classic', 2); addToHand(st, s, k, ev); ev.push({ type: 'draw', keys: [k] }); } },
  cannonC: { set: 'plunder', name: 'Ship\'s Cannon', kind: 'unit', unit: 'cannon', rarity: 'uncommon' },
  plank: { set: 'plunder', name: 'Walk the Plank', rarity: 'uncommon', text: 'Any enemy piece (not the king) standing on the left or right edge of the board walks the plank.',
    target: { t: 'enemy', f: (p, i) => hittable(p) && (i % N === 0 || i % N === N - 1) }, fx: (st, s, o, ev) => { ev.push({ type: 'spell', sq: o.a }); kill(st, o.a, ev); } },
  captainC: { set: 'plunder', name: 'Pirate Captain', kind: 'unit', unit: 'captain', rarity: 'rare' },
  mutiny: { set: 'plunder', name: 'Mutiny', rarity: 'rare', text: 'An enemy pawn switches sides and joins your crew.',
    target: { t: 'enemy', f: p => p.t === 'P' && p.sh <= 0 }, fx: (st, s, o, ev) => { st.board[o.a] = { ...st.board[o.a], s, fz: 0 }; ev.push({ type: 'spell', sq: o.a }); } },
  treasure: { set: 'plunder', name: 'Buried Treasure', kind: 'coin', amount: 12, rarity: 'epic', text: '+12 coins, straight away. X marks the spot.' },
  krakenC: { set: 'plunder', name: 'Kraken', kind: 'unit', unit: 'kraken', rarity: 'legendary' },
};
for (const [k, c] of Object.entries(CARDS)) {
  c.key = k; c.set = c.set || 'classic'; c.kind = c.kind || 'spell';
  if (c.kind === 'unit') { c.text = (c.unit === 'P' ? '' : '') + U[c.unit].rules; c.target = c.target || { t: 'home' }; }
}
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const SCRAP = { common: 1, uncommon: 2, rare: 3, epic: 5, legendary: 8 };
const PACKS = {
  classic: { name: 'Inkmate Classic', set: 'classic', cost: 5, badge: 'J', blurb: 'Units, spells and coins. The core set.' },
  crusade: { name: 'Iron Crusade', set: 'crusade', cost: 7, badge: 'titan', band: '#b3322b', blurb: 'Grimdark space knights. Armour, drop pods, orbital strikes.' },
  west: { name: 'Dust & Daring', set: 'west', cost: 6, badge: 'stranger', band: '#c99a1c', blurb: 'Wild West. Sheriffs, bandits, bounties and heists.' },
  monster: { name: 'Monster Mayhem', set: 'monster', cost: 7, badge: 'lizard', band: '#4a6fb0', blurb: 'B-movie monsters. Eggs, tentacles, toxic goo.' },
  plunder: { name: 'Plunder', set: 'plunder', cost: 6, badge: 'kraken', band: '#1e1c24', blurb: 'Pirates. Cannons, mutiny, buried treasure.' },
};

function pool(set, rarity) { return Object.values(CARDS).filter(c => c.set === set && c.rarity === rarity).map(c => c.key); }
function rollRarity(boost) {
  const w = boost === 2 ? [0, 58, 27, 10, 5] : boost === 1 ? [40, 32, 18, 7, 3] : [52, 28, 13, 5, 2];
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) { x -= w[i]; if (x < 0) return RARITIES[i]; }
  return 'common';
}
function rollCard(set, boost) {
  let ri = RARITIES.indexOf(rollRarity(boost));
  for (; ri >= 0; ri--) { const p = pool(set, RARITIES[ri]); if (p.length) return randOf(p); }
  return randOf(pool('classic', 'common'));
}
function rollPack(packKey) {
  const pk = PACKS[packKey];
  if (pk.set === 'classic') return [rollCard('classic', 0), rollCard('classic', 0), rollCard('classic', 2)];
  return [rollCard(pk.set, 1), rollCard(pk.set, 1), rollCard(Math.random() < .5 ? pk.set : 'classic', 2)];
}
function tradeUp(rarity) {
  const next = RARITIES[Math.min(4, RARITIES.indexOf(rarity) + 1)];
  return randOf(Object.values(CARDS).filter(c => c.rarity === next).map(c => c.key));
}
const HAND_MAX = 7;
function coinValue(st, side, key) { const a = CARDS[key].amount; return typeof a === 'function' ? a(st, side) : a; }
function addToHand(st, side, key, ev) {
  if (CARDS[key].kind === 'coin') { const n = coinValue(st, side, key); st.coins[side] += n; ev && ev.push({ type: 'coins', n }); return 'cash'; }
  if (st.hand[side].length >= HAND_MAX) { st.coins[side] += SCRAP[CARDS[key].rarity]; ev && ev.push({ type: 'coins', n: SCRAP[CARDS[key].rarity] }); return 'full'; }
  st.hand[side].push(key); return 'kept';
}
function sqs(st, f) { const out = []; for (let i = 0; i < N * N; i++) { const p = st.board[i]; if (p && f(p, i)) out.push(i); } return out; }
function lastSnap(st, side) { for (let i = st.snaps.length - 1; i >= 0; i--) if (st.snaps[i].side === side) return st.snaps[i]; return null; }

function cardOptions(st, side, key) {
  const card = CARDS[key], T = card.target, enemy = other(side), opts = [];
  if (T.can && !T.can(st, side)) return opts;
  switch (T.t) {
    case 'home': for (const r of homeRows(side)) for (let c = 0; c < N; c++) { const i = r * N + c; if (emptyOk(st, i)) opts.push({ a: i }); } break;
    case 'empty': for (let i = 0; i < N * N; i++) if (emptyOk(st, i) && (!T.f || T.f(st, i, side))) opts.push({ a: i }); break;
    case 'square': for (let i = 0; i < N * N; i++) if (!T.f || T.f(st, i, side)) opts.push({ a: i }); break;
    case 'enemy': for (let i = 0; i < N * N; i++) { const p = st.board[i]; if (p && p.s === enemy && (T.f ? T.f(p, i, st) : hittable(p))) opts.push({ a: i }); } break;
    case 'own': for (let i = 0; i < N * N; i++) { const p = st.board[i]; if (p && p.s === side && (T.f ? T.f(p, i, st) : notKing(p))) opts.push({ a: i }); } break;
    case 'none': opts.push({ a: -1 }); break;
    case 'pair': for (const a of T.first(st, side)) for (const b of T.second(st, side, a)) if (a !== b) opts.push({ a, b }); break;
  }
  return opts;
}
function applyCard(st, side, key, o, ev = []) {
  const card = CARDS[key];
  if (card.kind === 'unit') { st.board[o.a] = mkPiece(card.unit, side); ev.push({ type: 'summon', sq: o.a }); }
  else card.fx(st, side, o, ev);
  return ev;
}
function stateLegal(st, side) { setEnv(st); return !inCheck(st.board, side); }
function legalCardOptions(st, side, key) {
  const saved = { ...ENV };
  const out = cardOptions(st, side, key).filter(o => {
    const sim = cloneState(st);
    applyCard(sim, side, key, o);
    return CARDS[key].random || stateLegal(sim, side);
  });
  Object.assign(ENV, saved);
  return out;
}

// ===================================================================== search (the Ink Baron)
function evalB(bd, side) {
  let s = 0;
  for (let i = 0; i < N * N; i++) {
    const p = bd[i]; if (!p) continue;
    const r = i / N | 0, c = i % N, u = U[p.t];
    let v = u.val * 100 + p.ar * 45 + (p.reb ? 120 : 0) + (u.income ? 70 : 0) + (p.hatch ? 120 : 0) + (p.bomb ? 25 : 0);
    const centre = 9 - (Math.abs(4.5 - r) + Math.abs(4.5 - c));
    if (p.t === 'P') v += (p.s === 'w' ? (N - 2 - r) : (r - 1)) * 7 + (c > 2 && c < 7 ? 4 : 0);
    else if (p.t === 'K') v += (p.s === 'w' ? (r - 7) : (2 - r)) * 6;
    else if (!u.noCap && u.val) v += centre * 2;
    if (p.fz > 0) v *= 0.85;
    if (p.curse) v *= 0.35;
    s += p.s === side ? v : -v;
  }
  return s;
}
let deadline = 0, nodes = 0;
const TIMEOUT = {};
function orderMoves(ms) { for (const m of ms) m.o = (m.cap ? VAL(m.cap.t) * 10 + 5 : 0) + (m.pr ? 80 : 0); ms.sort((a, b) => b.o - a.o); return ms; }
function qsearch(bd, side, alpha, beta, qd) {
  const stand = evalB(bd, side);
  if (stand >= beta || qd <= 0) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of orderMoves(genMoves(bd, side).filter(m => m.cap))) {
    if (m.cap.t === 'K') return 50000;
    const sv = makeMove(bd, m); const sc = -qsearch(bd, other(side), -beta, -alpha, qd - 1); unmake(bd, m, sv);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}
function negamax(bd, side, depth, alpha, beta) {
  if ((++nodes & 1023) === 0 && performance.now() > deadline) throw TIMEOUT;
  if (depth <= 0) return qsearch(bd, side, alpha, beta, 3);
  const ms = orderMoves(genMoves(bd, side));
  if (!ms.length) return evalB(bd, side);
  let best = -1e9;
  for (const m of ms) {
    if (m.cap && m.cap.t === 'K') return 50000 + depth;
    const sv = makeMove(bd, m); const sc = -negamax(bd, other(side), depth - 1, -beta, -alpha); unmake(bd, m, sv);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function searchRoot(bd0, side, roots, budget) {
  const bd = bd0.slice(); deadline = performance.now() + budget;
  let best = roots[0], bestScore = -1e9, done = 0;
  for (let depth = 1; depth <= 4; depth++) {
    try {
      let a = -1e9, cur = null, curScore = -1e9;
      for (const m of best ? [best, ...roots.filter(x => x !== best)] : roots) {
        const sv = makeMove(bd, m); const sc = -negamax(bd, other(side), depth - 1, -1e9, -a); unmake(bd, m, sv);
        if (sc > curScore) { curScore = sc; cur = m; }
        if (sc > a) a = sc;
      }
      best = cur; bestScore = curScore; done = depth;
    } catch (e) { if (e !== TIMEOUT) throw e; break; }
  }
  return { move: best, score: bestScore, depth: done };
}
function scoreAfter(st, side, depth, budget) {
  setEnv(st); deadline = performance.now() + budget;
  try { return -negamax(st.board.slice(), other(side), depth, -1e9, 1e9); } catch (e) { if (e !== TIMEOUT) throw e; return evalB(st.board, side); }
}
// decide the computer's turn: returns {type:'move', m} or {type:'card', idx, o}
function aiDecide(st, side) {
  setEnv(st);
  const roots = legalMoves(st.board, side);
  let plan = null;
  if (roots.length) { const r = searchRoot(st.board, side, roots, 750); plan = { type: 'move', m: r.move, score: r.score }; }
  const t0 = performance.now();
  for (let i = 0; i < st.hand[side].length && performance.now() - t0 < 1300; i++) {
    const key = st.hand[side][i], card = CARDS[key];
    let opts = legalCardOptions(st, side, key);
    if (!opts.length) continue;
    if (key === 'mine') { setEnv(st); const hot = new Set(genMoves(st.board, other(side)).map(m => m.t)); opts = opts.filter(o => hot.has(o.a)); if (!opts.length) continue; }
    const bonus = typeof card.ai === 'function' ? card.ai(st, side) : (card.ai || 0);
    const quick = opts.map(o => { const sim = cloneState(st); applyCard(sim, side, key, o); setEnv(sim); return { o, sim, q: evalB(sim.board, side) }; }).sort((a, b) => b.q - a.q).slice(0, card.random ? 1 : 5);
    for (const { o, sim } of quick) {
      if (!stateLegal(sim, side)) continue;
      let sc = scoreAfter(sim, side, 1, 110) + bonus;
      if (sim.extra) sc += 0;
      if (!plan || sc > plan.score + 30) plan = { type: 'card', idx: i, o, score: sc };
    }
  }
  setEnv(st);
  return plan;
}

Object.assign(INK, {
  N, DIR8, ORTH, DIAG, KN, U, VAL, ENV, setEnv, genMoves, makeMove, unmake, kingSq, inCheck, legalMoves, other, rc, inB,
  mkPiece, newState, cloneState, homeRows, SETS, CARDS, RARITIES, RARITY_LABEL, SCRAP, PACKS, HAND_MAX, rollPack, rollCard, tradeUp,
  addToHand, coinValue, cardOptions, applyCard, legalCardOptions, stateLegal, aiDecide, area, kill, lastSnap,
});
})();
