/* Inkmate — chess on a 10x10 notebook page, with card packs.
   Engine, computer opponent, cards and hand-drawn rendering all live here. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const INK = '#1e1c24', PAPER = '#f2eee2', RED = '#b3322b', GOLD = '#c99a1c', BLUE = '#4a6fb0', SOFT = '#5a5560';
const N = 10, PACK_COST = 5, HAND_MAX = 5, START_COINS = 5;
const FILES = 'abcdefghij';

// ===================================================================== ink helpers
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
let boil = 0;
const jt = (s, a) => (hash(s * 1.31 + boil * 7.77) - 0.5) * 2 * a;
function ln(c, x1, y1, x2, y2, s = 0, a = 0.7) {
  c.beginPath();
  c.moveTo(x1 + jt(s, a), y1 + jt(s + .1, a));
  c.quadraticCurveTo((x1 + x2) / 2 + jt(s + .2, a), (y1 + y2) / 2 + jt(s + .3, a), x2 + jt(s + .4, a), y2 + jt(s + .5, a));
  c.stroke();
}
function poly(c, pts, s = 0, a = 0.6, close = true) {
  c.beginPath();
  pts.forEach((p, i) => { const x = p[0] + jt(s + i * .7, a), y = p[1] + jt(s + i * .7 + .35, a); i ? c.lineTo(x, y) : c.moveTo(x, y); });
  if (close) c.closePath();
}
function circ(c, x, y, r, s = 0, a = 0.5, n = 12) {
  c.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n * Math.PI * 2, rr = r + jt(s + (i % n) * .9, a);
    const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr;
    i ? c.lineTo(px, py) : c.moveTo(px, py);
  }
  c.closePath();
}
const fs = (c, fill) => { c.fillStyle = fill; c.fill(); c.stroke(); };
function detail(c, col, fn) { const o = c.strokeStyle; c.strokeStyle = col; fn(); c.strokeStyle = o; }

// ===================================================================== units & cards
const UNITS = {
  P: { name: 'Pawn', val: 1, rules: 'Steps forward 1, or 2 from its starting row. Captures one square diagonally forward. Becomes a Queen on the far side.' },
  N: { name: 'Knight', val: 3, rules: 'Jumps in an L: two squares one way, one to the side. Leaps over anything.' },
  B: { name: 'Bishop', val: 3, rules: 'Slides any distance diagonally.' },
  R: { name: 'Rook', val: 5, rules: 'Slides any distance in straight lines.' },
  Q: { name: 'Queen', val: 9, rules: 'Slides any distance in any of the 8 directions.' },
  K: { name: 'King', val: 0, rules: 'Steps 1 square any way. If he is in check and can\'t escape, you lose.' },
  A: { name: 'Archer', val: 3, rules: 'Steps 1 square any way, but can\'t capture by moving. Shoots the first enemy within 2 squares in any direction and stays put.' },
  W: { name: 'Stone Wall', val: 1, rules: 'Never moves, never captures. Just gets in the way.' },
  C: { name: 'Catapult', val: 4, rules: 'Rolls 1 square straight. Lobs a rock over anything at an enemy exactly 2 or 3 squares away in a straight line, and stays put.' },
  T: { name: 'Tank', val: 5, rules: 'Drives up to 3 squares in straight lines. Pawns can\'t capture it.' },
  Z: { name: 'Wizard', val: 4, rules: 'Jumps like a knight, or glides up to 2 squares diagonally.' },
  D: { name: 'Dragon', val: 7, rules: 'Flies up to 3 squares in any direction, right over other pieces.' },
  J: { name: 'F-15 Fighter Jet', val: 10, rules: 'Flies any distance in any of the 8 directions, straight over everything.' },
};
const VAL = Object.fromEntries(Object.entries(UNITS).map(([k, u]) => [k, u.val]));

const CARDS = {
  pawn:      { name: 'Pawn', kind: 'unit', unit: 'P', rarity: 'common' },
  knight:    { name: 'Knight', kind: 'unit', unit: 'N', rarity: 'common' },
  wall:      { name: 'Stone Wall', kind: 'unit', unit: 'W', rarity: 'common' },
  freeze:    { name: 'Freeze', kind: 'spell', rarity: 'common', text: 'Freeze an enemy piece (not the king). It can\'t move or capture for its next 2 turns.' },
  shield:    { name: 'Shield', kind: 'spell', rarity: 'common', text: 'Protect one of your pieces (not the king) until your next turn.' },
  pouch:     { name: 'Coin Pouch', kind: 'coin', amount: 3, rarity: 'common', text: '+3 coins, straight away.' },
  bishop:    { name: 'Bishop', kind: 'unit', unit: 'B', rarity: 'uncommon' },
  archer:    { name: 'Archer', kind: 'unit', unit: 'A', rarity: 'uncommon' },
  wizard:    { name: 'Wizard', kind: 'unit', unit: 'Z', rarity: 'uncommon' },
  levy:      { name: 'Call to Arms', kind: 'spell', rarity: 'uncommon', text: 'Two new pawns join your second row.' },
  knighted:  { name: 'Knighted', kind: 'spell', rarity: 'uncommon', text: 'Turn one of your pawns into a knight.' },
  purse:     { name: 'Fat Purse', kind: 'coin', amount: 5, rarity: 'uncommon', text: '+5 coins, straight away.' },
  rook:      { name: 'Rook', kind: 'unit', unit: 'R', rarity: 'rare' },
  catapult:  { name: 'Catapult', kind: 'unit', unit: 'C', rarity: 'rare' },
  tank:      { name: 'Tank', kind: 'unit', unit: 'T', rarity: 'rare' },
  fireball:  { name: 'Fireball', kind: 'spell', rarity: 'rare', text: 'Burn up an enemy piece worth 3 or less (not the king).' },
  teleport:  { name: 'Teleport', kind: 'spell', rarity: 'rare', text: 'Move one of your pieces (not the king) to any empty square on your half.' },
  chest:     { name: 'Treasure Chest', kind: 'coin', amount: 8, rarity: 'rare', text: '+8 coins, straight away.' },
  queen:     { name: 'Queen', kind: 'unit', unit: 'Q', rarity: 'epic' },
  dragon:    { name: 'Dragon', kind: 'unit', unit: 'D', rarity: 'epic' },
  lightning: { name: 'Lightning Strike', kind: 'spell', rarity: 'epic', text: 'Destroy any enemy piece except the king.' },
  decree:    { name: 'Royal Decree', kind: 'spell', rarity: 'epic', text: 'Turn one of your pawns into a queen.' },
  jet:       { name: 'F-15 Fighter Jet', kind: 'unit', unit: 'J', rarity: 'legendary' },
  meteor:    { name: 'Meteor', kind: 'spell', rarity: 'legendary', text: 'Smash a 3×3 area. Every enemy piece in it is destroyed, except the king.' },
};
for (const [k, c] of Object.entries(CARDS)) { c.key = k; if (c.kind === 'unit') c.text = 'Summon onto an empty square in your back three rows. ' + UNITS[c.unit].rules; }
const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_LABEL = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
const BY_RARITY = Object.fromEntries(RARITIES.map(r => [r, Object.values(CARDS).filter(c => c.rarity === r).map(c => c.key)]));

function rollRarity(slot) {
  const w = slot < 2 ? [52, 28, 13, 5, 2] : [0, 58, 27, 10, 5];
  let x = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 5; i++) { x -= w[i]; if (x < 0) return RARITIES[i]; }
  return 'common';
}
function rollPack() {
  const out = [];
  for (let i = 0; i < 3; i++) { const pool = BY_RARITY[rollRarity(i)]; out.push(pool[Math.floor(Math.random() * pool.length)]); }
  return out;
}

// ===================================================================== engine
const other = s => s === 'w' ? 'b' : 'w';
const rc = sq => [sq / N | 0, sq % N];
const inB = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTH = DIR8.slice(0, 4), DIAG = DIR8.slice(4);
const KN = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
let pid = 1;
const mk = (t, s) => ({ t, s, id: pid++, fz: 0, sh: 0 });

function newBoard() {
  const bd = new Array(N * N).fill(null);
  const back = ['R', 'N', 'B', 'A', 'Q', 'K', 'A', 'B', 'N', 'R'];
  for (let c = 0; c < N; c++) {
    bd[c] = mk(back[c], 'b'); bd[N + c] = mk('P', 'b');
    bd[8 * N + c] = mk('P', 'w'); bd[9 * N + c] = mk(back[c], 'w');
  }
  return bd;
}

function genMoves(bd, side, out = []) {
  for (let sq = 0; sq < N * N; sq++) {
    const p = bd[sq];
    if (!p || p.s !== side || p.fz > 0) continue;
    const r = sq / N | 0, c = sq % N, t = p.t;
    const canCap = q => q && q.s !== side && q.sh <= 0 && !(q.t === 'T' && t === 'P');
    const push = (to, ranged, pr) => out.push({ f: sq, t: to, cap: bd[to], r: !!ranged, pr });
    const quiet = (rr, cc) => { if (inB(rr, cc) && !bd[rr * N + cc]) push(rr * N + cc); };
    const step = (rr, cc) => { if (!inB(rr, cc)) return; const q = bd[rr * N + cc]; if (!q || canCap(q)) push(rr * N + cc); };
    const slide = (dirs, max, fly) => {
      for (const [dr, dc] of dirs) for (let k = 1; k <= max; k++) {
        const rr = r + dr * k, cc = c + dc * k;
        if (!inB(rr, cc)) break;
        const q = bd[rr * N + cc];
        if (!q) { push(rr * N + cc); continue; }
        if (canCap(q)) push(rr * N + cc);
        if (!fly) break;
      }
    };
    switch (t) {
      case 'P': {
        const d = side === 'w' ? -1 : 1, last = side === 'w' ? 0 : N - 1, start = side === 'w' ? N - 2 : 1;
        const r1 = r + d;
        if (inB(r1, c) && !bd[r1 * N + c]) {
          push(r1 * N + c, false, r1 === last ? 'Q' : undefined);
          if (r === start && inB(r + 2 * d, c) && !bd[(r + 2 * d) * N + c]) push((r + 2 * d) * N + c);
        }
        for (const dc of [-1, 1]) if (inB(r1, c + dc) && canCap(bd[r1 * N + c + dc])) push(r1 * N + c + dc, false, r1 === last ? 'Q' : undefined);
        break;
      }
      case 'N': for (const [dr, dc] of KN) step(r + dr, c + dc); break;
      case 'B': slide(DIAG, 9); break;
      case 'R': slide(ORTH, 9); break;
      case 'Q': slide(DIR8, 9); break;
      case 'K': for (const [dr, dc] of DIR8) step(r + dr, c + dc); break;
      case 'A':
        for (const [dr, dc] of DIR8) {
          quiet(r + dr, c + dc);
          for (let k = 1; k <= 2; k++) {
            const rr = r + dr * k, cc = c + dc * k;
            if (!inB(rr, cc)) break;
            const q = bd[rr * N + cc];
            if (!q) continue;
            if (canCap(q)) push(rr * N + cc, true);
            break;
          }
        }
        break;
      case 'C':
        for (const [dr, dc] of ORTH) {
          quiet(r + dr, c + dc);
          for (const k of [2, 3]) { const rr = r + dr * k, cc = c + dc * k; if (inB(rr, cc) && canCap(bd[rr * N + cc])) push(rr * N + cc, true); }
        }
        break;
      case 'T': slide(ORTH, 3); break;
      case 'Z': for (const [dr, dc] of KN) step(r + dr, c + dc); slide(DIAG, 2); break;
      case 'D': slide(DIR8, 3, true); break;
      case 'J': slide(DIR8, 9, true); break;
    }
  }
  return out;
}
function makeMove(bd, m) {
  const sv = [bd[m.f], bd[m.t]];
  if (m.r) bd[m.t] = null;
  else { bd[m.t] = m.pr ? { ...bd[m.f], t: m.pr } : bd[m.f]; bd[m.f] = null; }
  return sv;
}
function unmake(bd, m, sv) { bd[m.f] = sv[0]; bd[m.t] = sv[1]; }
function kingSq(bd, side) { for (let i = 0; i < N * N; i++) { const p = bd[i]; if (p && p.t === 'K' && p.s === side) return i; } return -1; }
function attacked(bd, sq, by) { if (sq < 0) return false; return genMoves(bd, by).some(m => m.t === sq && m.cap); }
const inCheck = (bd, side) => attacked(bd, kingSq(bd, side), other(side));
function legalMoves(bd, side) {
  return genMoves(bd, side).filter(m => { const sv = makeMove(bd, m); const ok = !inCheck(bd, side); unmake(bd, m, sv); return ok; });
}

// ---- cards on the board
const homeRows = side => side === 'w' ? [N - 1, N - 2, N - 3] : [0, 1, 2];
const halfRows = side => side === 'w' ? [5, 6, 7, 8, 9] : [0, 1, 2, 3, 4];
function cardOptions(bd, side, key) {
  const card = CARDS[key], opts = [], enemy = other(side);
  const each = fn => { for (let i = 0; i < N * N; i++) fn(i, bd[i]); };
  if (card.kind === 'unit') {
    for (const r of homeRows(side)) for (let c = 0; c < N; c++) if (!bd[r * N + c]) opts.push({ a: r * N + c });
  } else switch (key) {
    case 'freeze': each((i, p) => { if (p && p.s === enemy && p.t !== 'K' && p.sh <= 0 && p.fz <= 0) opts.push({ a: i }); }); break;
    case 'shield': each((i, p) => { if (p && p.s === side && p.t !== 'K' && p.sh <= 0) opts.push({ a: i }); }); break;
    case 'fireball': each((i, p) => { if (p && p.s === enemy && p.t !== 'K' && p.sh <= 0 && VAL[p.t] <= 3) opts.push({ a: i }); }); break;
    case 'lightning': each((i, p) => { if (p && p.s === enemy && p.t !== 'K' && p.sh <= 0) opts.push({ a: i }); }); break;
    case 'knighted': case 'decree': each((i, p) => { if (p && p.s === side && p.t === 'P') opts.push({ a: i }); }); break;
    case 'levy': { const r = homeRows(side)[1]; let n = 0; for (let c = 0; c < N; c++) if (!bd[r * N + c]) n++; if (n) opts.push({ a: -1 }); break; }
    case 'teleport': {
      const empties = []; for (const r of halfRows(side)) for (let c = 0; c < N; c++) if (!bd[r * N + c]) empties.push(r * N + c);
      each((i, p) => { if (p && p.s === side && p.t !== 'K' && p.fz <= 0) for (const e of empties) opts.push({ a: i, b: e }); });
      break;
    }
    case 'meteor':
      for (let i = 0; i < N * N; i++) {
        const [r, c] = rc(i); let hit = false;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!inB(r + dr, c + dc)) continue;
          const q = bd[(r + dr) * N + c + dc];
          if (q && q.s === enemy && q.t !== 'K' && q.sh <= 0) hit = true;
        }
        if (hit) opts.push({ a: i });
      }
      break;
  }
  return opts;
}
// returns a new board (pieces that change are copied)
function applyCard(bd0, side, key, o) {
  const bd = bd0.slice(), card = CARDS[key];
  if (card.kind === 'unit') { bd[o.a] = mk(card.unit, side); return bd; }
  switch (key) {
    case 'freeze': bd[o.a] = { ...bd[o.a], fz: 2 }; break;
    case 'shield': bd[o.a] = { ...bd[o.a], sh: 1 }; break;
    case 'fireball': case 'lightning': bd[o.a] = null; break;
    case 'knighted': bd[o.a] = { ...bd[o.a], t: 'N' }; break;
    case 'decree': bd[o.a] = { ...bd[o.a], t: 'Q' }; break;
    case 'levy': {
      const r = homeRows(side)[1];
      const cols = [4, 5, 3, 6, 2, 7, 1, 8, 0, 9].filter(c => !bd[r * N + c]).slice(0, 2);
      for (const c of cols) bd[r * N + c] = mk('P', side);
      break;
    }
    case 'teleport': bd[o.b] = bd[o.a]; bd[o.a] = null; break;
    case 'meteor': {
      const [r, c] = rc(o.a);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!inB(r + dr, c + dc)) continue;
        const i = (r + dr) * N + c + dc, q = bd[i];
        if (q && q.s !== side && q.t !== 'K' && q.sh <= 0) bd[i] = null;
      }
      break;
    }
  }
  return bd;
}
function legalCardOptions(bd, side, key) {
  return cardOptions(bd, side, key).filter(o => !inCheck(applyCard(bd, side, key, o), side));
}

// ---- evaluation & search (computer opponent)
function evalB(bd, side) {
  let s = 0;
  for (let i = 0; i < N * N; i++) {
    const p = bd[i]; if (!p) continue;
    const r = i / N | 0, c = i % N;
    let v = VAL[p.t] * 100;
    const centre = 9 - (Math.abs(4.5 - r) + Math.abs(4.5 - c));
    if (p.t === 'P') v += (p.s === 'w' ? (N - 2 - r) : (r - 1)) * 7 + (c > 2 && c < 7 ? 4 : 0);
    else if (p.t === 'K') v += (p.s === 'w' ? (r - 7) : (2 - r)) * 6;
    else if (p.t !== 'W') v += centre * (p.t === 'N' || p.t === 'Z' || p.t === 'A' ? 3 : 1.5);
    if (p.fz > 0) v *= 0.85;
    s += p.s === side ? v : -v;
  }
  return s;
}
let deadline = 0;
const TIMEOUT = {};
function orderMoves(ms) {
  for (const m of ms) m.o = (m.cap ? VAL[m.cap.t] * 10 + 5 : 0) + (m.pr ? 80 : 0) - (m.cap ? 0 : 0);
  ms.sort((a, b) => b.o - a.o);
  return ms;
}
function qsearch(bd, side, alpha, beta, qd) {
  const stand = evalB(bd, side);
  if (stand >= beta || qd <= 0) return stand;
  if (stand > alpha) alpha = stand;
  const ms = orderMoves(genMoves(bd, side).filter(m => m.cap));
  for (const m of ms) {
    if (m.cap.t === 'K') return 50000;
    const sv = makeMove(bd, m);
    const sc = -qsearch(bd, other(side), -beta, -alpha, qd - 1);
    unmake(bd, m, sv);
    if (sc >= beta) return sc;
    if (sc > alpha) alpha = sc;
  }
  return alpha;
}
let nodes = 0;
function negamax(bd, side, depth, alpha, beta) {
  if ((++nodes & 1023) === 0 && performance.now() > deadline) throw TIMEOUT;
  if (depth <= 0) return qsearch(bd, side, alpha, beta, 3);
  const ms = orderMoves(genMoves(bd, side));
  if (!ms.length) return evalB(bd, side);
  let best = -1e9;
  for (const m of ms) {
    if (m.cap && m.cap.t === 'K') return 50000 + depth;
    const sv = makeMove(bd, m);
    const sc = -negamax(bd, other(side), depth - 1, -beta, -alpha);
    unmake(bd, m, sv);
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
function searchRoot(bd0, side, roots, budget) {
  const bd = bd0.slice();
  deadline = performance.now() + budget;
  let best = roots[0], bestScore = -1e9, done = 0;
  for (let depth = 1; depth <= 4; depth++) {
    try {
      let a = -1e9, cur = null, curScore = -1e9;
      const ordered = best ? [best, ...roots.filter(m => m !== best)] : roots;
      for (const m of ordered) {
        const sv = makeMove(bd, m);
        const sc = -negamax(bd, other(side), depth - 1, -1e9, -a);
        unmake(bd, m, sv);
        if (sc > curScore) { curScore = sc; cur = m; }
        if (sc > a) a = sc;
      }
      best = cur; bestScore = curScore; done = depth;
    } catch (e) { if (e !== TIMEOUT) throw e; break; }
  }
  return { move: best, score: bestScore, depth: done };
}
function scoreBoard(bd, side, depth, budget) {
  // score of a position where `side` has just acted (opponent to move)
  deadline = performance.now() + budget;
  try { return -negamax(bd.slice(), other(side), depth, -1e9, 1e9); } catch (e) { if (e !== TIMEOUT) throw e; return evalB(bd, side); }
}

// ===================================================================== game state
const G = {};
const NAMES = { ai: { w: 'You', b: 'The Ink Baron' }, pvp: { w: 'Paper', b: 'Ink' } };
function sqName(i) { const [r, c] = rc(i); return FILES[c] + (N - r); }
function who(side) { return NAMES[G.mode][side]; }

function newGame(mode) {
  pid = 1;
  Object.assign(G, {
    mode, board: newBoard(), turn: 'w', coins: { w: START_COINS, b: START_COINS }, hand: { w: [], b: [] },
    last: null, over: null, ply: 0, log: [], sel: -1, pend: null, lock: false, quiet: 0, packs: { w: 0, b: 0 },
  });
  anims.length = 0; fx.length = 0;
  addLog(mode === 'ai' ? 'New game against the Ink Baron. You play Paper and move first.' : 'New game. Paper moves first.');
  refresh();
}
function addLog(text, cls = '') { G.log.unshift({ text, cls }); if (G.log.length > 40) G.log.pop(); }
function humanTurn() { return !G.over && (G.mode === 'pvp' || G.turn === 'w'); }

function giveCards(side, keys) {
  const kept = [], cash = [];
  for (const k of keys) {
    const c = CARDS[k];
    if (c.kind === 'coin') { G.coins[side] += c.amount; cash.push(k); continue; }
    if (G.hand[side].length >= HAND_MAX) { G.coins[side] += 1; cash.push(k); continue; }
    G.hand[side].push(k); kept.push(k);
  }
  return { kept, cash };
}
function buyPack(side) {
  if (G.coins[side] < PACK_COST) return null;
  G.coins[side] -= PACK_COST; G.packs[side]++;
  return rollPack();
}

function endOfTurnEffects(side) {
  for (let i = 0; i < N * N; i++) {
    const p = G.board[i]; if (!p) continue;
    if (p.s === side && p.fz > 0) G.board[i] = { ...p, fz: p.fz - 1 };
    if (p.s !== side && p.sh > 0) G.board[i] = { ...G.board[i], sh: G.board[i].sh - 1 };
  }
}
function canAct(side) {
  if (legalMoves(G.board, side).length) return true;
  return G.hand[side].some(k => legalCardOptions(G.board, side, k).length);
}
function finishTurn(side) {
  endOfTurnEffects(side);
  G.turn = other(side); G.ply++; G.sel = -1; G.pend = null;
  G.coins[G.turn] += 1;
  const t = G.turn;
  if (!canAct(t)) {
    if (inCheck(G.board, t)) { G.over = { winner: side, why: 'checkmate' }; addLog(`Checkmate! ${who(side)} win${G.mode === 'ai' && side === 'w' ? '' : 's'}.`, 'big'); snd('win'); }
    else { G.over = { winner: null, why: 'stalemate' }; addLog('Stalemate. Nobody can move, so it\'s a draw.', 'big'); }
  } else if (G.quiet >= 120) { G.over = { winner: null, why: 'quiet' }; addLog('Sixty moves each with no captures. It\'s a draw.', 'big'); }
  else if (inCheck(G.board, t)) { addLog(`${who(t)} ${G.mode === 'ai' && t === 'w' ? 'are' : 'is'} in check!`, 'warn'); snd('check'); }
  G.lock = false;
  refresh();
  if (G.over) { setTimeout(showEnd, 900); return; }
  if (G.mode === 'ai' && G.turn === 'b') { G.lock = true; refresh(); setTimeout(aiTurn, 450); }
}

async function playMove(side, m) {
  G.lock = true;
  const p = G.board[m.f], cap = m.cap;
  makeMove(G.board, m);
  G.last = { f: m.f, t: m.t };
  const name = UNITS[p.t].name;
  if (m.r) {
    addAnim({ kind: 'shot', f: m.f, t: m.t, dur: 420, proj: p.t === 'C' ? 'rock' : 'arrow' });
    addFx({ kind: 'cross', p: cap, sq: m.t, delay: 380, dur: 700 });
    addFx({ kind: 'splat', sq: m.t, delay: 380, dur: 9000, s: Math.random() * 99 });
    snd(p.t === 'C' ? 'boom' : 'twang');
    setTimeout(() => snd('hit'), 380);
  } else {
    const fly = p.t === 'D' || p.t === 'J' || p.t === 'N' || p.t === 'Z';
    addAnim({ kind: 'move', p: G.board[m.t], f: m.f, t: m.t, dur: p.t === 'J' ? 520 : 260, fly, jet: p.t === 'J' });
    if (cap) { addFx({ kind: 'cross', p: cap, sq: m.t, delay: 0, dur: 620 }); addFx({ kind: 'splat', sq: m.t, delay: 200, dur: 9000, s: Math.random() * 99 }); }
    snd(p.t === 'J' ? 'jet' : 'tap');
    if (cap) setTimeout(() => snd('hit'), 200);
  }
  let line = `${who(side)}: ${name} ${sqName(m.f)} → ${m.r ? 'shoots ' : ''}${sqName(m.t)}`;
  if (cap) {
    const gain = Math.max(1, Math.ceil(VAL[cap.t] / 2));
    G.coins[side] += gain;
    line += `, takes ${UNITS[cap.t].name} (+${gain} coin${gain > 1 ? 's' : ''})`;
    addFx({ kind: 'text', sq: m.t, str: `+${gain}`, col: GOLD, delay: 250, dur: 1100 });
    G.quiet = 0;
  } else G.quiet++;
  if (m.pr) { line += ', promoted to Queen'; addFx({ kind: 'text', sq: m.t, str: 'Queen!', col: RED, delay: 250, dur: 1200 }); }
  addLog(line);
  refresh();
  await waitAnims();
  finishTurn(side);
}

async function playCard(side, idx, o) {
  G.lock = true;
  const key = G.hand[side][idx], card = CARDS[key];
  G.hand[side].splice(idx, 1);
  const before = G.board;
  G.board = applyCard(G.board, side, key, o);
  G.last = null; G.pend = null; G.sel = -1;
  let line = `${who(side)} played ${card.name}`;
  if (card.kind === 'unit') { addFx({ kind: 'summon', sq: o.a, dur: 700 }); line += ` on ${sqName(o.a)}`; snd('summon'); }
  else {
    addFx({ kind: 'spell', key, sq: o.a, sq2: o.b, dur: 900 });
    if (key === 'fireball' || key === 'lightning') { addFx({ kind: 'cross', p: before[o.a], sq: o.a, delay: 350, dur: 700 }); line += ` on ${UNITS[before[o.a].t].name} ${sqName(o.a)}`; }
    else if (key === 'meteor') {
      const [r, c] = rc(o.a);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!inB(r + dr, c + dc)) continue; const i = (r + dr) * N + c + dc;
        if (before[i] && !G.board[i]) { addFx({ kind: 'cross', p: before[i], sq: i, delay: 500, dur: 800 }); addFx({ kind: 'splat', sq: i, delay: 500, dur: 9000, s: i }); }
      }
      line += ` on ${sqName(o.a)}`;
    } else if (key === 'teleport') line += `: ${UNITS[before[o.a].t].name} ${sqName(o.a)} → ${sqName(o.b)}`;
    else if (o.a >= 0) line += ` on ${sqName(o.a)}`;
    snd(key === 'meteor' || key === 'lightning' ? 'boom' : key === 'freeze' ? 'freeze' : 'spell');
  }
  addLog(line, 'played');
  G.quiet = 0;
  refresh();
  await waitAnims(); await sleep(card.kind === 'spell' ? 500 : 250);
  finishTurn(side);
}

// ---- the Ink Baron
async function aiTurn() {
  if (G.over || G.turn !== 'b') return;
  G.lock = true; refresh();
  await sleep(200);
  if (G.coins.b >= PACK_COST && G.hand.b.length <= 3) {
    const keys = buyPack('b');
    const { cash } = giveCards('b', keys);
    addLog(`The Ink Baron opened a pack${cash.length ? ' and pocketed some coins' : ''}.`, 'played');
    toast('The Ink Baron opened a pack');
    snd('rip'); refresh();
    await sleep(700);
  }
  const roots = legalMoves(G.board, 'b');
  let plan = null;
  if (roots.length) {
    const res = searchRoot(G.board, 'b', roots, 800);
    plan = { type: 'move', m: res.move, score: res.score };
    const cd = Math.max(0, res.depth - 2);
    // consider cards
    const t0 = performance.now();
    for (let i = 0; i < G.hand.b.length && performance.now() - t0 < 900; i++) {
      const key = G.hand.b[i];
      let opts = legalCardOptions(G.board, 'b', key);
      if (!opts.length) continue;
      opts = opts.map(o => ({ o, s: evalB(applyCard(G.board, 'b', key, o), 'b') })).sort((a, b) => b.s - a.s).slice(0, 6);
      for (const { o } of opts) {
        const sc = scoreBoard(applyCard(G.board, 'b', key, o), 'b', cd + 1, 150);
        if (sc > plan.score + 25) plan = { type: 'card', idx: i, o, score: sc };
      }
    }
  } else {
    for (let i = 0; i < G.hand.b.length && !plan; i++) { const o = legalCardOptions(G.board, 'b', G.hand.b[i])[0]; if (o) plan = { type: 'card', idx: i, o }; }
  }
  if (!plan) return;
  if (plan.type === 'move') await playMove('b', plan.m);
  else { toast(`The Ink Baron plays ${CARDS[G.hand.b[plan.idx]].name}!`); await sleep(500); await playCard('b', plan.idx, plan.o); }
}

// ===================================================================== drawing: pieces
const ART = {
  P(c, F, D, s) {
    ln(c, -4, -10, -5, 0, s, .4); ln(c, 4, -10, 5, 0, s + 1, .4);
    poly(c, [[-9, -10], [9, -10], [6, -27], [-6, -27]], s + 2, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.6; ln(c, -6, -12, 5, -25, s + 3, .4); });
    c.lineWidth = 2.4; poly(c, [[-7.5, -27], [7.5, -27], [0, -42]], s + 4, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.6; ln(c, 1, -31, 5, -31, s + 5, .2); });
  },
  N(c, F, D, s) {
    poly(c, [[-13, 0], [13, 0], [11, -9], [2, -15], [7, -22], [17, -26], [19, -31], [12, -40], [4, -44], [2, -51], [-2, -45], [-8, -42], [-13, -31], [-15, -17], [-12, -8]], s, .6); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.6; circ(c, 7, -35, 1.6, s + 1, .2, 6); c.fillStyle = D; c.fill(); ln(c, 15, -29, 16, -29, s + 2, .2); ln(c, -6, -10, 8, -10, s + 3, .3); });
    c.lineWidth = 1.8; ln(c, -10, -38, -16, -35, s + 4, .4); ln(c, -12, -30, -18, -27, s + 5, .4); ln(c, -14, -21, -19, -18, s + 6, .4);
  },
  B(c, F, D, s) {
    c.lineWidth = 2; ln(c, 15, 0, 15, -40, s, .4); ln(c, 11, -35, 19, -35, s + 1, .3);
    c.lineWidth = 2.4;
    poly(c, [[-12, 0], [12, 0], [6, -28], [-6, -28]], s + 2, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.6; ln(c, -8, -13, 8, -13, s + 3, .3); ln(c, 0, -26, 0, -14, s + 4, .3); });
    c.lineWidth = 2.2; circ(c, 0, -33, 5, s + 5, .4, 10); fs(c, F);
    poly(c, [[-6, -37], [0, -53], [6, -37]], s + 6, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.5; ln(c, -2, -42, 3, -47, s + 7, .2); });
  },
  R(c, F, D, s) {
    poly(c, [[-12, 0], [-12, -34], [-15, -34], [-15, -45], [-9, -45], [-9, -40], [-3, -40], [-3, -45], [3, -45], [3, -40], [9, -40], [9, -45], [15, -45], [15, -34], [12, -34], [12, 0]], s, .5); fs(c, F);
    detail(c, D, () => {
      c.lineWidth = 1.4;
      for (let y = -29, k = 0; y < -8; y += 7, k++) for (let x = -9 + (k % 2) * 4; x < 8; x += 8) ln(c, x, y, x + 4, y, s + x + y, .3);
      c.lineWidth = 1.8; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-4, -6); c.arc(0, -6, 4, Math.PI, 0); c.lineTo(4, 0); c.stroke();
    });
  },
  Q(c, F, D, s) {
    ln(c, -5, -22, -12, -12, s, .4);
    poly(c, [[-14, 0], [14, 0], [5, -27], [-5, -27]], s + 1, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.5; ln(c, -9, -6, 9, -6, s + 2, .4); ln(c, -4, -21, 4, -21, s + 3, .3); });
    c.lineWidth = 2.2; circ(c, 0, -32, 5, s + 4, .4, 10); fs(c, F);
    c.lineWidth = 1.8; poly(c, [[-6, -36], [-7.5, -46], [-3.5, -40], [0, -48], [3.5, -40], [7.5, -46], [6, -36]], s + 5, .4); fs(c, GOLD);
  },
  K(c, F, D, s) {
    c.lineWidth = 2; ln(c, 10, -16, 13, -40, s, .3); circ(c, 13, -42, 2.6, s + 1, .3, 7); fs(c, GOLD);
    c.lineWidth = 2.4;
    poly(c, [[-13, 0], [13, 0], [7, -28], [-7, -28]], s + 2, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.5; ln(c, -10, -5, 10, -5, s + 3, .4); ln(c, 0, -26, 0, -6, s + 4, .3); });
    c.lineWidth = 2.2; circ(c, 0, -33, 5.5, s + 5, .4, 10); fs(c, F);
    c.lineWidth = 1.8; poly(c, [[-7, -37], [-7.5, -47], [-3.5, -42], [0, -48], [3.5, -42], [7.5, -47], [7, -37]], s + 6, .4); fs(c, GOLD);
    c.lineWidth = 2; ln(c, 0, -48, 0, -56, s + 7, .2); ln(c, -3, -53, 3, -53, s + 8, .2);
  },
  A(c, F, D, s) {
    c.lineWidth = 1.8; ln(c, -8, -24, -12, -33, s, .3); ln(c, -6, -24, -9, -34, s + 1, .3);
    c.lineWidth = 2.4; ln(c, -4, -10, -5, 0, s + 2, .4); ln(c, 4, -10, 5, 0, s + 3, .4);
    poly(c, [[-8, -10], [8, -10], [6, -26], [-6, -26]], s + 4, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.5; ln(c, 0, -23, 0, -13, s + 5, .3); ln(c, -3, -19, 3, -19, s + 6, .3); });
    c.lineWidth = 2.2; poly(c, [[-8, -25], [8, -25], [3, -41], [-5, -38]], s + 7, .5); fs(c, F);
    c.lineWidth = 2; c.beginPath(); c.arc(9, -22, 14, -1.15, 1.15); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.moveTo(9 + Math.cos(-1.15) * 14, -22 + Math.sin(-1.15) * 14); c.lineTo(3, -22); c.lineTo(9 + Math.cos(1.15) * 14, -22 + Math.sin(1.15) * 14); c.stroke();
    c.lineWidth = 1.6; ln(c, 3, -22, 25, -22, s + 8, .2); ln(c, 25, -22, 21, -25, s + 9, .1); ln(c, 25, -22, 21, -19, s + 10, .1);
  },
  W(c, F, D, s) {
    poly(c, [[-19, 0], [-19, -24], [-15, -24], [-15, -30], [-8, -30], [-8, -24], [-3, -24], [-3, -30], [4, -30], [4, -24], [9, -24], [9, -30], [16, -30], [16, -24], [19, -24], [19, 0]], s, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.4; for (let y = -19, k = 0; y < -2; y += 6, k++) for (let x = -16 + (k % 2) * 5; x < 15; x += 10) ln(c, x, y, x + 6, y, s + x * 3 + y, .3); });
  },
  C(c, F, D, s) {
    c.lineWidth = 2.6; ln(c, -20, -9, 20, -9, s, .4);
    c.lineWidth = 2.2; ln(c, -6, -9, 2, -32, s + 1, .4); ln(c, 10, -9, 2, -32, s + 2, .4);
    c.lineWidth = 3; ln(c, -22, -40, 16, -26, s + 3, .4);
    c.lineWidth = 2; circ(c, -22, -44, 5, s + 4, .5, 8); fs(c, INK);
    for (const wx of [-12, 12]) { c.lineWidth = 2.2; circ(c, wx, -7, 7, s + wx, .4, 10); fs(c, F); detail(c, D, () => { c.lineWidth = 1.3; ln(c, wx - 5, -7, wx + 5, -7, s + wx + 1, .2); ln(c, wx, -12, wx, -2, s + wx + 2, .2); }); }
  },
  T(c, F, D, s) {
    c.lineWidth = 3.4; ln(c, 4, -27, 26, -32, s, .3);
    c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-17, 0); c.lineTo(17, 0); c.arc(17, -6, 6, Math.PI / 2, -Math.PI / 2, true); c.lineTo(-17, -12); c.arc(-17, -6, 6, -Math.PI / 2, Math.PI / 2, true); c.closePath(); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.5; for (let x = -16; x <= 16; x += 8) { circ(c, x, -6, 3, s + x, .2, 8); c.stroke(); } });
    poly(c, [[-18, -12], [18, -12], [14, -21], [-15, -21]], s + 1, .5); fs(c, F);
    c.beginPath(); c.moveTo(-9, -21); c.quadraticCurveTo(-8, -32, 1, -32 + jt(s + 2, .5)); c.quadraticCurveTo(10, -32, 10, -21); c.closePath(); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.4; ln(c, -3, -30, 4, -30, s + 3, .2); circ(c, -10, -16.5, 2, s + 4, .2, 6); c.stroke(); });
  },
  Z(c, F, D, s) {
    c.lineWidth = 2; ln(c, 14, 0, 14, -42, s, .4);
    detail(c, RED, () => { c.lineWidth = 1.6; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + boil * .3; ln(c, 14 - Math.cos(a) * 5, -46 - Math.sin(a) * 5, 14 + Math.cos(a) * 5, -46 + Math.sin(a) * 5, s + k, .2); } });
    c.lineWidth = 2.4;
    poly(c, [[-13, 0], [13, 0], [3, -30], [-3, -30]], s + 1, .5); fs(c, F);
    detail(c, D, () => { c.lineWidth = 1.3; ln(c, -6, -8, -2, -8, s + 2, .2); ln(c, -4, -10, -4, -6, s + 3, .2); ln(c, 3, -16, 7, -16, s + 4, .2); ln(c, 5, -18, 5, -14, s + 5, .2); });
    c.lineWidth = 2.2; circ(c, 0, -33, 4.5, s + 6, .4, 10); fs(c, F);
    c.lineWidth = 1.8; poly(c, [[-3.5, -32], [3.5, -32], [1, -21], [-1, -21]], s + 7, .4); fs(c, PAPER);
    c.lineWidth = 2.2; poly(c, [[-10, -36], [10, -36], [3, -43], [-6, -57], [-2, -44]], s + 8, .5); fs(c, F);
  },
  D(c, F, D, s) {
    c.lineWidth = 2; ln(c, -6, -4, -8, 0, s, .3); ln(c, 6, -4, 7, 0, s + 1, .3);
    c.beginPath(); c.moveTo(-13, -8); c.quadraticCurveTo(-24, -10, -26, -20 + jt(s + 2, .6)); c.stroke();
    poly(c, [[-26, -20], [-29, -15], [-23, -16]], s + 3, .3); fs(c, F);
    c.lineWidth = 2.2; poly(c, [[-3, -18], [-15, -44], [-9, -36], [-4, -41], [3, -24]], s + 4, .6); fs(c, F);
    poly(c, [[-15, -7], [-6, -19], [7, -20], [13, -12], [9, -4], [-7, -3]], s + 5, .6); fs(c, F);
    poly(c, [[6, -18], [11, -31], [16, -31], [12, -15]], s + 6, .5); fs(c, F);
    poly(c, [[11, -31], [22, -36], [25, -32], [15, -27]], s + 7, .5); fs(c, F);
    c.fillStyle = RED; c.fillRect(17, -34, 2, 2);
    detail(c, RED, () => { c.lineWidth = 1.4; ln(c, 26, -33, 32, -36, s + 8, .8); ln(c, 26, -32, 33, -31, s + 9, .8); ln(c, 26, -31, 31, -27, s + 10, .8); });
    detail(c, D, () => { c.lineWidth = 1.3; ln(c, -4, -16, 2, -10, s + 11, .3); ln(c, 0, -17, 5, -12, s + 12, .3); });
  },
  J(c, F, D, s) {
    c.fillStyle = 'rgba(30,28,36,0.15)'; c.beginPath(); c.ellipse(0, 0, 22, 3, 0, 0, 7); c.fill();
    c.save(); c.translate(0, -18); c.rotate(-0.12);
    detail(c, RED, () => { c.lineWidth = 1.6; ln(c, -30, -1, -38, -2, s, .8); ln(c, -30, 1, -36, 2, s + 1, .8); });
    c.lineWidth = 2.2;
    poly(c, [[-26, -14], [-20, -14], [-12, -4], [-28, -4]], s + 2, .4); fs(c, F);
    poly(c, [[-28, -4], [10, -5], [22, -3], [32, 0], [22, 3], [-28, 4]], s + 3, .4); fs(c, F);
    poly(c, [[-6, 1], [8, 1], [-12, 11], [-18, 11]], s + 4, .4); fs(c, F);
    poly(c, [[6, -5], [12, -10], [20, -4]], s + 5, .3); fs(c, '#9db3d6');
    detail(c, D, () => { c.lineWidth = 1.2; ln(c, -22, 0, 4, 0, s + 6, .3); ln(c, -20, -2, -20, 2, s + 7, .2); });
    c.restore();
  },
};
function drawPiece(c, t, side, x, y, sz, seed = 0, alpha = 1) {
  c.save();
  c.globalAlpha *= alpha;
  c.translate(x, y + sz * 0.36);
  const k = sz / 62;
  c.scale(side === 'b' ? -k : k, k);
  c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 2.4;
  if (t !== 'J') { c.fillStyle = 'rgba(30,28,36,0.13)'; c.beginPath(); c.ellipse(0, 1, 15, 3.4, 0, 0, 7); c.fill(); }
  ART[t](c, side === 'w' ? PAPER : INK, side === 'w' ? INK : PAPER, seed);
  c.restore();
}

// ---- spell / card art
function snowflake(c, x, y, r, s) {
  c.strokeStyle = BLUE; c.lineWidth = Math.max(1.4, r / 9);
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3;
    ln(c, x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r, s + k, r / 20);
    for (const sgn of [-1, 1]) {
      const bx = x + Math.cos(a) * r * .6 * sgn, by = y + Math.sin(a) * r * .6 * sgn;
      ln(c, bx, by, bx + Math.cos(a + 2.5 * sgn) * r * .3, by + Math.sin(a + 2.5 * sgn) * r * .3, s + k + 5, r / 30);
      ln(c, bx, by, bx + Math.cos(a - 2.5 * sgn) * r * .3, by + Math.sin(a - 2.5 * sgn) * r * .3, s + k + 9, r / 30);
    }
  }
  c.strokeStyle = INK;
}
function coinStack(c, x, y, n, s) {
  c.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const cx = x + (hash(s + i) - .5) * 30, cy = y - i * 5 + (i > n / 2 ? -6 : 0);
    c.beginPath(); c.ellipse(cx, cy, 13, 5, 0, 0, 7); fs(c, GOLD);
  }
  c.beginPath(); c.ellipse(x + 26, y - 6, 9, 9, 0, 0, 7); fs(c, GOLD); ln(c, x + 25, y - 10, x + 25, y - 2, s + 30, .3);
}
const SPELL_ART = {
  freeze(c, w, h) { snowflake(c, w / 2, h / 2, h * .36, 3); },
  shield(c, w, h) {
    c.lineWidth = 2.6; const x = w / 2, y = h / 2;
    poly(c, [[x - 22, y - 26], [x + 22, y - 26], [x + 20, y + 4], [x, y + 28], [x - 20, y + 4]], 5, .8); fs(c, PAPER);
    c.lineWidth = 2; ln(c, x, y - 20, x, y + 18, 6, .5); ln(c, x - 15, y - 6, x + 15, y - 6, 7, .5);
    c.setLineDash([3, 4]); c.beginPath(); c.arc(x, y, 38, 0, 7); c.stroke(); c.setLineDash([]);
  },
  pouch(c, w, h) { coinStack(c, w / 2 - 6, h / 2 + 14, 3, 1); },
  purse(c, w, h) { coinStack(c, w / 2 - 6, h / 2 + 18, 5, 2); },
  chest(c, w, h) {
    const x = w / 2, y = h / 2 + 18; c.lineWidth = 2.4;
    coinStack(c, x - 4, y - 26, 3, 9);
    poly(c, [[x - 28, y], [x + 28, y], [x + 28, y - 24], [x - 28, y - 24]], 3, .6); fs(c, PAPER);
    poly(c, [[x - 28, y - 24], [x - 22, y - 38], [x - 30, y - 36]], 4, .6, false); c.stroke();
    c.lineWidth = 1.6; for (let k = -18; k <= 18; k += 12) ln(c, x + k, y - 22, x + k, y - 2, 5 + k, .3);
    c.lineWidth = 2; poly(c, [[x - 4, y - 16], [x + 4, y - 16], [x + 4, y - 8], [x - 4, y - 8]], 6, .3); fs(c, GOLD);
  },
  fireball(c, w, h) {
    const x = w / 2, y = h / 2 + 4;
    c.strokeStyle = RED; c.lineWidth = 2.2;
    for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .45; ln(c, x + Math.cos(a) * 14, y + Math.sin(a) * 14, x + Math.cos(a) * (28 + hash(i) * 10), y + Math.sin(a) * (28 + hash(i) * 10) - 6, i, 1.5); }
    c.strokeStyle = INK; c.lineWidth = 2.4; circ(c, x, y, 15, 9, 1.2, 12); fs(c, '#e8892b');
    c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, 8, 0, 4.5); c.stroke();
  },
  lightning(c, w, h) {
    const x = w / 2, y = h / 2; c.lineWidth = 2.4;
    poly(c, [[x + 4, y - 34], [x - 14, y + 2], [x - 2, y + 2], [x - 8, y + 34], [x + 14, y - 6], [x + 2, y - 6], [x + 10, y - 34]], 3, .8); fs(c, GOLD);
    c.lineWidth = 1.4; for (let i = 0; i < 4; i++) ln(c, x - 30 + i * 4, y - 26 + i * 16, x - 22 + i * 4, y - 22 + i * 16, i, .5);
  },
  teleport(c, w, h) {
    const y = h / 2 + 6; c.lineWidth = 2;
    for (const [x, s] of [[w / 2 - 30, 1], [w / 2 + 30, 2]]) for (let k = 1; k <= 3; k++) { c.beginPath(); c.ellipse(x, y + 8, 6 * k, 2.5 * k, 0, 0, 7); c.stroke(); }
    drawPiece(c, 'P', 'w', w / 2 - 30, y - 14, 40, 3);
    c.setLineDash([3, 4]); c.beginPath(); c.moveTo(w / 2 - 22, y - 26); c.quadraticCurveTo(w / 2, y - 48, w / 2 + 24, y - 20); c.stroke(); c.setLineDash([]);
    ln(c, w / 2 + 24, y - 20, w / 2 + 16, y - 22, 5, .3); ln(c, w / 2 + 24, y - 20, w / 2 + 22, y - 28, 6, .3);
  },
  levy(c, w, h) { drawPiece(c, 'P', 'w', w / 2 - 16, h / 2 - 4, 46, 1); drawPiece(c, 'P', 'w', w / 2 + 16, h / 2 - 2, 46, 2); c.lineWidth = 2; ln(c, w / 2 + 36, h / 2 - 30, w / 2 + 36, h / 2 - 16, 3, .3); ln(c, w / 2 + 29, h / 2 - 23, w / 2 + 43, h / 2 - 23, 4, .3); },
  knighted(c, w, h) {
    drawPiece(c, 'P', 'w', w / 2 - 28, h / 2 - 2, 44, 1); drawPiece(c, 'N', 'w', w / 2 + 28, h / 2 - 2, 48, 2);
    c.lineWidth = 2; ln(c, w / 2 - 10, h / 2, w / 2 + 8, h / 2, 3, .3); ln(c, w / 2 + 8, h / 2, w / 2 + 2, h / 2 - 5, 4, .2); ln(c, w / 2 + 8, h / 2, w / 2 + 2, h / 2 + 5, 5, .2);
  },
  decree(c, w, h) {
    const x = w / 2, y = h / 2; c.lineWidth = 2.2;
    poly(c, [[x - 26, y - 14], [x + 26, y - 14], [x + 22, y + 26], [x - 30, y + 26]], 1, .8); fs(c, PAPER);
    c.lineWidth = 1.3; for (let k = 0; k < 4; k++) ln(c, x - 20, y - 4 + k * 7, x + 16 - (k === 3 ? 18 : 0), y - 4 + k * 7, k + 3, .4);
    c.lineWidth = 2; poly(c, [[x - 14, y - 16], [x - 16, y - 34], [x - 7, y - 25], [x, y - 38], [x + 7, y - 25], [x + 16, y - 34], [x + 14, y - 16]], 9, .5); fs(c, GOLD);
    circ(c, x + 18, y + 24, 6, 10, .5, 9); fs(c, RED);
  },
  meteor(c, w, h) {
    const x = w / 2 + 10, y = h / 2 - 2; c.lineWidth = 1.6;
    for (let i = 0; i < 5; i++) ln(c, x - 12 - i * 3, y - 12 + i * 5, x - 50 - i * 2, y - 36 + i * 4, i, 1);
    c.strokeStyle = RED; for (let i = 0; i < 3; i++) ln(c, x - 14, y - 6 + i * 5, x - 30, y - 16 + i * 6, i + 9, 1); c.strokeStyle = INK;
    c.lineWidth = 2.4; circ(c, x, y, 15, 4, 2, 11); fs(c, INK);
    c.lineWidth = 1.6; ln(c, x - 40, y + 30, x + 34, y + 30, 6, .5); ln(c, x - 6, y + 22, x - 12, y + 28, 7, .3); ln(c, x + 8, y + 22, x + 14, y + 28, 8, .3);
  },
};
function drawCardArt(cv, key, size = [120, 84]) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = size[0] * dpr; cv.height = size[1] * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
  const card = CARDS[key];
  const saved = boil; boil = 0;
  if (card.rarity === 'legendary' || card.rarity === 'epic') {
    c.strokeStyle = card.rarity === 'legendary' ? 'rgba(201,154,28,0.55)' : 'rgba(179,50,43,0.35)'; c.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ln(c, size[0] / 2 + Math.cos(a) * 18, size[1] / 2 + Math.sin(a) * 14, size[0] / 2 + Math.cos(a) * 70, size[1] / 2 + Math.sin(a) * 50, i, .5); }
    c.strokeStyle = INK;
  }
  if (card.kind === 'unit') drawPiece(c, card.unit, 'w', size[0] / 2, size[1] / 2 - 2, size[1] * 0.92, 11);
  else SPELL_ART[key](c, size[0], size[1]);
  boil = saved;
}
function drawUnitArt(cv, t, side, size = 90) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = size * dpr; cv.height = size * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const saved = boil; boil = 0;
  drawPiece(c, t, side, size / 2, size / 2, size * 0.86, 21);
  boil = saved;
}
function drawMoveDiagram(cv, t) {
  // 7x7 window around a piece in the middle of an empty board, plus ranged/capture marks
  const dpr = Math.min(window.devicePixelRatio || 1, 2), S = 98, cell = S / 7;
  cv.width = S * dpr; cv.height = S * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const saved = boil; boil = 0;
  const centre = 5 * N + 4, [cr, cc] = rc(centre);
  const empty = new Array(N * N).fill(null); empty[centre] = mk(t, 'w');
  const full = new Array(N * N).fill(null).map((_, i) => i === centre ? null : mk('Q', 'b')); full[centre] = empty[centre];
  const moves = new Set(genMoves(empty, 'w').map(m => m.t));
  const caps = genMoves(full, 'w');
  for (let r = 0; r < 7; r++) for (let col = 0; col < 7; col++) {
    if ((r + col) % 2) { c.fillStyle = 'rgba(30,28,36,0.07)'; c.fillRect(col * cell, r * cell, cell, cell); }
  }
  c.strokeStyle = 'rgba(30,28,36,0.35)'; c.lineWidth = 1; c.strokeRect(.5, .5, S - 1, S - 1);
  const pos = sq => { const [r, cl] = rc(sq); return [r - cr + 3, cl - cc + 3]; };
  for (const sq of moves) { const [r, cl] = pos(sq); if (r < 0 || r > 6 || cl < 0 || cl > 6) continue; c.fillStyle = INK; c.beginPath(); c.arc(cl * cell + cell / 2, r * cell + cell / 2, cell * .16, 0, 7); c.fill(); }
  for (const m of caps) {
    if (!m.r && moves.has(m.t)) continue;
    const [r, cl] = pos(m.t); if (r < 0 || r > 6 || cl < 0 || cl > 6) continue;
    const x = cl * cell + cell / 2, y = r * cell + cell / 2;
    c.strokeStyle = RED; c.lineWidth = 1.6;
    if (m.r) { c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x + 4, y + 4); c.moveTo(x + 4, y - 4); c.lineTo(x - 4, y + 4); c.stroke(); }
    else { c.beginPath(); c.arc(x, y, cell * .3, 0, 7); c.stroke(); }
  }
  drawPiece(c, t, 'w', 3 * cell + cell / 2, 3 * cell + cell / 2 - 1, cell * 1.05, 4);
  boil = saved;
}

// ===================================================================== board canvas
const bc = $('#board'), bctx = bc.getContext('2d');
const layer = document.createElement('canvas');
let BS = 600, PADB = 20, CELL = 56, DPR = 1, hover = -1;
function sizeBoard() {
  const wrap = $('#boardWrap');
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const wide = window.innerWidth >= 900;
  const availH = window.innerHeight - (wide ? 150 : 170);
  BS = Math.floor(Math.max(280, Math.min(wrap.clientWidth, wide ? availH : 9999, 860)));
  bc.style.width = BS + 'px'; bc.style.height = BS + 'px';
  bc.width = BS * DPR; bc.height = BS * DPR;
  PADB = Math.round(BS * 0.045); CELL = (BS - PADB * 2) / N;
  buildLayer();
}
function buildLayer() {
  layer.width = bc.width; layer.height = bc.height;
  const c = layer.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const saved = boil; boil = 0;
  c.lineCap = 'round';
  c.fillStyle = 'rgba(242,238,226,0.85)'; c.fillRect(0, 0, BS, BS);
  // hatched dark squares
  for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) {
    if ((r + col) % 2 === 0) continue;
    const x = PADB + col * CELL, y = PADB + r * CELL;
    c.save(); c.beginPath(); c.rect(x + 1, y + 1, CELL - 2, CELL - 2); c.clip();
    c.strokeStyle = 'rgba(30,28,36,0.2)'; c.lineWidth = 1;
    const gap = Math.max(4, CELL / 8);
    for (let k = -CELL; k < CELL * 2; k += gap) ln(c, x + k, y + CELL + 2, x + k + CELL + 4, y - 2, r * 31 + col * 7 + k, .8);
    c.restore();
  }
  // grid
  c.strokeStyle = INK; c.lineWidth = Math.max(1, CELL / 40);
  for (let i = 0; i <= N; i++) {
    const p = PADB + i * CELL;
    ln(c, PADB - 3, p, PADB + N * CELL + 3, p, i * 13, .9);
    ln(c, p, PADB - 3, p, PADB + N * CELL + 3, i * 17 + 5, .9);
  }
  c.lineWidth = Math.max(2, CELL / 22);
  poly(c, [[PADB - 5, PADB - 5], [PADB + N * CELL + 5, PADB - 5], [PADB + N * CELL + 5, PADB + N * CELL + 5], [PADB - 5, PADB + N * CELL + 5]], 99, 1.5); c.stroke();
  c.fillStyle = SOFT; c.font = `${Math.max(11, PADB * 0.62)}px 'Patrick Hand', cursive`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    c.fillText(FILES[i], PADB + i * CELL + CELL / 2, BS - PADB / 2 + 1);
    c.fillText(String(N - i), PADB / 2, PADB + i * CELL + CELL / 2);
  }
  boil = saved;
}
const sqXY = sq => { const [r, c] = rc(sq); return [PADB + c * CELL + CELL / 2, PADB + r * CELL + CELL / 2]; };
function sqAt(px, py) {
  const c = Math.floor((px - PADB) / CELL), r = Math.floor((py - PADB) / CELL);
  return inB(r, c) ? r * N + c : -1;
}

// ---- animations & effects
const anims = [], fx = [];
function addAnim(a) { a.start = performance.now() + (a.delay || 0); anims.push(a); }
function addFx(f) { f.start = performance.now() + (f.delay || 0); fx.push(f); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function waitAnims() {
  return new Promise(res => {
    const check = () => {
      const now = performance.now();
      const busy = anims.some(a => now < a.start + a.dur) || fx.some(f => f.kind !== 'splat' && now < f.start + f.dur);
      busy ? setTimeout(check, 40) : res();
    };
    check();
  });
}
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function drawBoard(now) {
  const c = bctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bc.width, bc.height);
  c.drawImage(layer, 0, 0);
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  c.lineCap = 'round'; c.lineJoin = 'round';
  // splats under pieces
  for (const f of fx) if (f.kind === 'splat' && now >= f.start) {
    const k = (now - f.start) / f.dur; const [x, y] = sqXY(f.sq);
    c.globalAlpha = Math.min(1, (1 - k) * 3) * 0.55; c.fillStyle = RED; c.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = CELL * (.18 + hash(f.s + i) * .14); c.lineTo(x + Math.cos(a) * r, y + CELL * .3 + Math.sin(a) * r * .35); }
    c.fill();
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(x + (hash(f.s + i * 9) - .5) * CELL * .8, y + CELL * .32, CELL * .03, 0, 7); c.fill(); }
    c.globalAlpha = 1;
  }
  // last move highlighter
  if (G.last) for (const sq of [G.last.f, G.last.t]) {
    const [x, y] = sqXY(sq); c.fillStyle = 'rgba(236,200,70,0.32)';
    poly(c, [[x - CELL * .47, y - CELL * .44], [x + CELL * .46, y - CELL * .47], [x + CELL * .47, y + CELL * .45], [x - CELL * .45, y + CELL * .47]], sq, 1.2); c.fill();
  }
  // check ring
  if (!G.over || G.over.why === 'checkmate') for (const s of ['w', 'b']) if (inCheckCached(s)) {
    const [x, y] = sqXY(kingSq(G.board, s)); c.strokeStyle = RED; c.lineWidth = 2.6; circ(c, x, y, CELL * .44, 77, 1.5, 14); c.stroke();
  }
  // selection & targets
  const targets = currentTargets();
  if (G.sel >= 0) { const [x, y] = sqXY(G.sel); c.strokeStyle = RED; c.lineWidth = 2.4; circ(c, x, y, CELL * .42, 5, 1.2, 12); c.stroke(); }
  if (G.pend && G.pend.first != null) { const [x, y] = sqXY(G.pend.first); c.strokeStyle = BLUE; c.lineWidth = 2.4; circ(c, x, y, CELL * .42, 6, 1.2, 12); c.stroke(); }
  for (const t of targets) {
    const [x, y] = sqXY(t.sq);
    if (t.type === 'move') { c.fillStyle = 'rgba(30,28,36,0.55)'; circ(c, x, y, CELL * .1, t.sq, .8, 7); c.fill(); }
    else if (t.type === 'cap') { c.strokeStyle = RED; c.lineWidth = 2; circ(c, x, y, CELL * .4, t.sq, 1, 12); c.stroke(); }
    else if (t.type === 'shoot') {
      c.strokeStyle = RED; c.lineWidth = 1.8; circ(c, x, y, CELL * .36, t.sq, .8, 12); c.stroke();
      ln(c, x - CELL * .45, y, x - CELL * .2, y, t.sq, .4); ln(c, x + CELL * .2, y, x + CELL * .45, y, t.sq + 1, .4);
      ln(c, x, y - CELL * .45, x, y - CELL * .2, t.sq + 2, .4); ln(c, x, y + CELL * .2, x, y + CELL * .45, t.sq + 3, .4);
    }
    else if (t.type === 'place') { c.strokeStyle = BLUE; c.lineWidth = 1.6; c.setLineDash([4, 4]); c.strokeRect(x - CELL * .38, y - CELL * .38, CELL * .76, CELL * .76); c.setLineDash([]); }
    else if (t.type === 'spell') { c.strokeStyle = BLUE; c.lineWidth = 2.2; circ(c, x, y, CELL * .42, t.sq, 1, 12); c.stroke(); }
  }
  if (hover >= 0 && humanTurn() && !G.lock) { const [x, y] = sqXY(hover); c.strokeStyle = 'rgba(30,28,36,0.25)'; c.lineWidth = 1.5; c.strokeRect(x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6); }
  if (G.pend && G.pend.key === 'meteor' && hover >= 0 && targets.some(t => t.sq === hover)) {
    const [x, y] = sqXY(hover); c.fillStyle = 'rgba(179,50,43,0.12)'; c.fillRect(x - CELL * 1.5, y - CELL * 1.5, CELL * 3, CELL * 3);
  }
  // pieces
  const moving = new Set(anims.filter(a => a.kind === 'move' && now < a.start + a.dur).map(a => a.p));
  const crossing = fx.filter(f => f.kind === 'cross' && now < f.start + f.dur);
  for (let sq = 0; sq < N * N; sq++) {
    const p = G.board[sq]; if (!p || moving.has(p)) continue;
    const [x, y] = sqXY(sq);
    let alpha = 1;
    const sm = fx.find(f => f.kind === 'summon' && f.sq === sq && now < f.start + f.dur);
    if (sm) alpha = Math.min(1, Math.max(0, (now - sm.start) / (sm.dur * 0.6)));
    drawPiece(c, p.t, p.s, x, y, CELL * .82, p.id * 3.7, alpha);
    if (p.fz > 0) { snowflake(c, x + CELL * .3, y - CELL * .3, CELL * .13, p.id); }
    if (p.sh > 0) { c.strokeStyle = INK; c.lineWidth = 1.6; c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, CELL * .45, 0, 7); c.stroke(); c.setLineDash([]); }
  }
  // dying pieces get crossed out
  for (const f of crossing) {
    if (now < f.start && f.delay) { const [x, y] = sqXY(f.sq); drawPiece(c, f.p.t, f.p.s, x, y, CELL * .82, f.p.id * 3.7); continue; }
    const k = Math.max(0, (now - f.start) / f.dur), [x, y] = sqXY(f.sq);
    drawPiece(c, f.p.t, f.p.s, x, y, CELL * .82, f.p.id * 3.7, Math.max(0, 1 - k * 1.3));
    c.strokeStyle = RED; c.lineWidth = 3; c.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4);
    const d1 = Math.min(1, k * 4), d2 = Math.min(1, Math.max(0, k * 4 - 1));
    const r = CELL * .34;
    c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x - r + 2 * r * d1, y - r + 2 * r * d1); c.stroke();
    if (d2 > 0) { c.beginPath(); c.moveTo(x + r, y - r); c.lineTo(x + r - 2 * r * d2, y - r + 2 * r * d2); c.stroke(); }
    c.globalAlpha = 1;
  }
  // moving pieces
  for (const a of anims) {
    if (now < a.start || now > a.start + a.dur) continue;
    const k = ease((now - a.start) / a.dur);
    const [x1, y1] = sqXY(a.f), [x2, y2] = sqXY(a.t);
    if (a.kind === 'move') {
      const lift = a.fly ? Math.sin(k * Math.PI) * CELL * (a.jet ? .9 : .45) : 0;
      if (a.jet) { c.strokeStyle = 'rgba(30,28,36,0.35)'; c.lineWidth = 1.5; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k - lift); c.stroke(); c.setLineDash([]); }
      drawPiece(c, a.p.t, a.p.s, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k - lift, CELL * .82 * (1 + lift / CELL * .2), a.p.id * 3.7);
    } else if (a.kind === 'shot') {
      const lift = Math.sin(k * Math.PI) * CELL * (a.proj === 'rock' ? 1.4 : .5);
      const x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k - lift;
      const dx = (x2 - x1), dy = (y2 - y1) - Math.cos(k * Math.PI) * CELL * Math.PI * (a.proj === 'rock' ? 1.4 : .5);
      if (a.proj === 'rock') { c.strokeStyle = INK; c.lineWidth = 1.6; circ(c, x, y, CELL * .09, 3, .6, 8); fs(c, INK); }
      else { const ang = Math.atan2(dy, dx), cs = Math.cos(ang), sn = Math.sin(ang), L = CELL * .3; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); c.moveTo(x - cs * L, y - sn * L); c.lineTo(x, y); c.stroke(); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x - cs * L, y - sn * L); c.lineTo(x - cs * L * 1.2 - sn * 5, y - sn * L * 1.2 + cs * 5); c.stroke(); }
    }
  }
  // spell effects & text
  for (const f of fx) {
    if (now < f.start || now > f.start + f.dur) continue;
    const k = (now - f.start) / f.dur;
    if (f.kind === 'summon') {
      const [x, y] = sqXY(f.sq); c.strokeStyle = INK; c.globalAlpha = 1 - k; c.lineWidth = 1.6;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ln(c, x + Math.cos(a) * CELL * (.25 + k * .3), y + Math.sin(a) * CELL * (.25 + k * .3), x + Math.cos(a) * CELL * (.38 + k * .35), y + Math.sin(a) * CELL * (.38 + k * .35), i, .5); }
      c.globalAlpha = 1;
    } else if (f.kind === 'text') {
      const [x, y] = sqXY(f.sq); c.globalAlpha = 1 - k * k;
      c.font = `${Math.round(CELL * .42)}px 'Permanent Marker', 'Patrick Hand', cursive`; c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = PAPER; c.strokeText(f.str, x, y - CELL * .55 - k * CELL * .5);
      c.fillStyle = f.col === GOLD ? '#9a6f0c' : f.col; c.fillText(f.str, x, y - CELL * .55 - k * CELL * .5); c.globalAlpha = 1;
    } else if (f.kind === 'spell') {
      const [x, y] = f.sq >= 0 ? sqXY(f.sq) : [BS / 2, BS / 2];
      c.globalAlpha = Math.min(1, (1 - k) * 2);
      if (f.key === 'freeze') snowflake(c, x, y, CELL * (.25 + k * .35), 3);
      else if (f.key === 'shield') { c.strokeStyle = INK; c.lineWidth = 2.4; circ(c, x, y, CELL * (.3 + k * .3), 4, 1, 14); c.stroke(); }
      else if (f.key === 'fireball' || f.key === 'meteor') {
        const R = CELL * (f.key === 'meteor' ? 1.5 : .5) * (0.3 + k);
        c.strokeStyle = RED; c.lineWidth = 2.2;
        for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ln(c, x + Math.cos(a) * R * .4, y + Math.sin(a) * R * .4, x + Math.cos(a) * R, y + Math.sin(a) * R, i + k * 3, 2); }
        if (k < .4 && f.key === 'meteor') { c.strokeStyle = INK; c.lineWidth = 2; circ(c, x - (1 - k / .4) * CELL * 3, y - (1 - k / .4) * CELL * 4, CELL * .25, 1, 1, 10); fs(c, INK); }
      } else if (f.key === 'lightning') {
        if (k < .5) { c.strokeStyle = GOLD; c.lineWidth = 4; let px = x, py = 0; c.beginPath(); c.moveTo(px, py); for (let i = 1; i <= 6; i++) { px = x + (i < 6 ? (hash(i + boil) - .5) * CELL : 0); py = y * i / 6; c.lineTo(px, py); } c.stroke(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); }
      } else if (f.key === 'teleport') {
        const [x2, y2] = sqXY(f.sq2); c.strokeStyle = BLUE; c.lineWidth = 2;
        for (const [px, py] of [[x, y], [x2, y2]]) for (let r = 1; r <= 3; r++) { c.beginPath(); c.ellipse(px, py + CELL * .3, CELL * .14 * r * (1 + k), CELL * .05 * r * (1 + k), 0, 0, 7); c.stroke(); }
      } else if (f.key === 'knighted' || f.key === 'decree' || f.key === 'levy') {
        c.strokeStyle = GOLD; c.lineWidth = 2;
        const pts = f.key === 'levy' ? [] : [[x, y]];
        for (const [px, py] of pts) for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ln(c, px + Math.cos(a) * CELL * .3, py + Math.sin(a) * CELL * .3, px + Math.cos(a) * CELL * (.4 + k * .3), py + Math.sin(a) * CELL * (.4 + k * .3), i, .4); }
      }
      c.globalAlpha = 1;
    }
  }
  // tidy finished
  for (let i = anims.length - 1; i >= 0; i--) if (now > anims[i].start + anims[i].dur + 50) anims.splice(i, 1);
  for (let i = fx.length - 1; i >= 0; i--) if (now > fx[i].start + fx[i].dur + 50) fx.splice(i, 1);
}
let checkCache = { key: null, w: false, b: false };
function inCheckCached(s) {
  const key = G.ply + ':' + G.board.map(p => p ? p.id + p.t + p.fz + p.sh : '-').join('');
  if (checkCache.key !== key) checkCache = { key, w: inCheck(G.board, 'w'), b: inCheck(G.board, 'b') };
  return checkCache[s];
}
let targetCache = { key: null, list: [] };
function currentTargets() {
  if (!humanTurn() || G.lock) return [];
  const key = G.ply + ':' + G.sel + ':' + (G.pend ? G.pend.idx + '/' + G.pend.first : '');
  if (targetCache.key === key) return targetCache.list;
  let list = [];
  if (G.pend) {
    const card = CARDS[G.pend.key];
    if (G.pend.key === 'teleport') {
      if (G.pend.first == null) list = [...new Set(G.pend.opts.map(o => o.a))].map(sq => ({ sq, type: 'spell' }));
      else list = G.pend.opts.filter(o => o.a === G.pend.first).map(o => ({ sq: o.b, type: 'place' }));
    } else if (G.pend.key !== 'levy') list = G.pend.opts.map(o => ({ sq: o.a, type: card.kind === 'unit' ? 'place' : 'spell' }));
  } else if (G.sel >= 0) {
    list = legalMoves(G.board, G.turn).filter(m => m.f === G.sel).map(m => ({ sq: m.t, type: m.r ? 'shoot' : m.cap ? 'cap' : 'move', m }));
  }
  targetCache = { key, list };
  return list;
}

// ---- input on the board
function boardPoint(e) { const r = bc.getBoundingClientRect(); return [(e.clientX - r.left) * BS / r.width, (e.clientY - r.top) * BS / r.height]; }
bc.addEventListener('pointermove', e => { hover = sqAt(...boardPoint(e)); });
bc.addEventListener('pointerleave', () => { hover = -1; });
bc.addEventListener('pointerdown', e => {
  unlockAudio();
  if (!humanTurn() || G.lock) return;
  const sq = sqAt(...boardPoint(e)); if (sq < 0) return;
  hover = sq;
  const side = G.turn, targets = currentTargets();
  const hit = targets.find(t => t.sq === sq);
  if (G.pend) {
    if (!hit) { if (G.pend.first != null) { G.pend.first = null; refresh(); } return; }
    if (G.pend.key === 'teleport') {
      if (G.pend.first == null) { G.pend.first = sq; refresh(); return; }
      playCard(side, G.pend.idx, { a: G.pend.first, b: sq }); return;
    }
    playCard(side, G.pend.idx, G.pend.opts.find(o => o.a === sq)); return;
  }
  if (hit && hit.m) { playMove(side, hit.m); return; }
  const p = G.board[sq];
  G.sel = p && p.s === side ? (G.sel === sq ? -1 : sq) : -1;
  if (G.sel >= 0 && p.fz > 0) { toast(`That ${UNITS[p.t].name} is frozen`); G.sel = -1; }
  else if (G.sel >= 0) snd('pick');
  refresh();
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('#packOverlay').hidden || !$('#unitsOverlay').hidden) { closeOverlays(); return; }
    G.sel = -1; G.pend = null; refresh();
  }
});

// ===================================================================== HTML panels
function cardEl(key, opts = {}) {
  const card = CARDS[key];
  const el = document.createElement(opts.tag || 'div');
  el.className = `card ${card.rarity}` + (opts.cls ? ' ' + opts.cls : '');
  el.innerHTML = `<div class="card-name">${card.name}</div><canvas class="card-art" aria-hidden="true"></canvas><div class="card-text">${card.text}</div><div class="card-foot"><span>${card.kind === 'unit' ? 'Unit' : card.kind === 'coin' ? 'Coins' : 'Spell'}</span><span class="rar">${RARITY_LABEL[card.rarity]}</span></div>`;
  drawCardArt(el.querySelector('canvas'), key);
  return el;
}
function setStatus() {
  const st = $('#status');
  let html = '';
  if (G.over) {
    html = G.over.winner ? `<b>${G.over.why === 'checkmate' ? 'Checkmate.' : ''} ${G.mode === 'ai' ? (G.over.winner === 'w' ? 'You win!' : 'The Ink Baron wins.') : who(G.over.winner) + ' wins!'}</b>` : '<b>Draw.</b>';
    html += ' <button class="btn small" id="stAgain">Play again</button>';
  } else if (G.mode === 'ai' && G.turn === 'b') html = '<span class="thinking">The Ink Baron is thinking</span>';
  else if (G.lock) html = '…';
  else if (G.pend) {
    const card = CARDS[G.pend.key];
    let ins;
    if (G.pend.key === 'levy') ins = `Play <b>${card.name}</b>?`;
    else if (G.pend.key === 'teleport') ins = G.pend.first == null ? 'Pick the piece to teleport.' : 'Pick an empty square on your half.';
    else if (card.kind === 'unit') ins = `Pick an empty square in your back three rows for your <b>${card.name}</b>.`;
    else if (G.pend.key === 'meteor') ins = 'Pick where the meteor lands (it hits the 3×3 around it).';
    else ins = `Pick a target for <b>${card.name}</b>.`;
    html = ins + (G.pend.key === 'levy' ? ' <button class="btn small" id="stPlay">Play it</button>' : '') + ' <button class="btn small ghost" id="stCancel">Cancel</button>';
  } else {
    const chk = inCheck(G.board, G.turn);
    const name = G.mode === 'ai' ? 'Your' : who(G.turn) + '\'s';
    html = chk ? `<b class="warn">Check!</b> ${name} king is under attack. Move it, block, or capture.` : `${name} move. Move a piece or play a card.`;
  }
  st.innerHTML = html;
  const again = $('#stAgain'); if (again) again.onclick = () => openStart();
  const cancel = $('#stCancel'); if (cancel) cancel.onclick = () => { G.pend = null; refresh(); };
  const play = $('#stPlay'); if (play) play.onclick = () => playCard(G.turn, G.pend.idx, G.pend.opts[0]);
}
function renderBar(el, side) {
  const name = who(side);
  const isTurn = G.turn === side && !G.over;
  const hand = G.hand[side].length;
  el.classList.toggle('active', isTurn);
  el.innerHTML = `<span class="who"><span class="dot ${side}"></span>${name}</span>` +
    `<span class="meta"><span class="coin-ico" aria-hidden="true"></span>${G.coins[side]}<span class="sep">·</span>${hand} card${hand === 1 ? '' : 's'}</span>`;
}
function refresh() {
  if (!G.board) return;
  renderBar($('#oppBar'), G.mode === 'ai' ? 'b' : other(G.turn));
  renderBar($('#meBar'), G.mode === 'ai' ? 'w' : G.turn);
  const side = G.mode === 'ai' ? 'w' : G.turn;
  $('#coins').textContent = G.coins[side];
  $('#handTitle').textContent = G.mode === 'ai' ? 'Your hand' : `${who(side)}'s hand`;
  const myTurn = humanTurn() && !G.lock;
  const pb = $('#btnPack');
  pb.disabled = !myTurn || G.coins[side] < PACK_COST;
  $('#packHint').textContent = G.coins[side] >= PACK_COST ? 'Opening a pack doesn\'t use your turn.' : `${PACK_COST - G.coins[side]} more coin${PACK_COST - G.coins[side] === 1 ? '' : 's'} for a pack. You get +1 a turn, more for captures.`;
  // hand
  const hand = $('#hand');
  const sig = side + ':' + G.hand[side].join(',') + ':' + (G.pend ? G.pend.idx : -1) + ':' + myTurn;
  if (hand.dataset.sig !== sig) {
    hand.dataset.sig = sig; hand.innerHTML = '';
    if (!G.hand[side].length) hand.innerHTML = '<p class="empty">No cards yet. Open a pack to get units, spells and coins.</p>';
    G.hand[side].forEach((key, idx) => {
      const el = cardEl(key, { tag: 'button', cls: (G.pend && G.pend.idx === idx ? 'selected' : '') });
      el.type = 'button';
      el.disabled = !myTurn;
      el.setAttribute('aria-label', `${CARDS[key].name}: ${CARDS[key].text}`);
      el.onclick = () => selectCard(idx);
      hand.appendChild(el);
    });
  }
  // log
  const log = $('#log');
  log.innerHTML = G.log.slice(0, 14).map(l => `<li class="${l.cls}">${l.text}</li>`).join('');
  setStatus();
  targetCache.key = null;
}
function selectCard(idx) {
  if (!humanTurn() || G.lock) return;
  const side = G.turn;
  if (G.pend && G.pend.idx === idx) { G.pend = null; refresh(); return; }
  const key = G.hand[side][idx];
  const opts = legalCardOptions(G.board, side, key);
  if (!opts.length) { toast(inCheck(G.board, side) ? 'That card can\'t get you out of check' : `No way to play ${CARDS[key].name} right now`); return; }
  G.sel = -1; G.pend = { idx, key, opts, first: null };
  snd('pick');
  refresh();
}
let toastT = 0;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---- pack opening
function drawPackArt(cv, w, h, ripped = 0) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
  const m = w * 0.08;
  c.lineWidth = Math.max(2, w / 70);
  // foil wrapper with crimped ends
  c.beginPath();
  c.moveTo(m, m * 1.4);
  for (let x = m; x <= w - m; x += w / 18) c.lineTo(x, m * (1.1 + ((x / (w / 18)) % 2 ? .4 : 0)));
  c.lineTo(w - m, h - m * 1.4);
  for (let x = w - m; x >= m; x -= w / 18) c.lineTo(x, h - m * (1.1 + ((x / (w / 18)) % 2 ? .4 : 0)));
  c.closePath(); c.fillStyle = PAPER; c.fill(); c.stroke();
  c.save(); c.clip();
  c.strokeStyle = 'rgba(30,28,36,0.16)'; c.lineWidth = 1;
  for (let k = -h; k < w + h; k += 7) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k - h * .6, h); c.stroke(); }
  c.restore();
  c.strokeStyle = INK; c.lineWidth = Math.max(1.5, w / 90);
  ln(c, m, m * 2.6, w - m, m * 2.6, 1, 1); ln(c, m, h - m * 2.6, w - m, h - m * 2.6, 2, 1);
  // badge
  c.fillStyle = PAPER; c.beginPath(); c.ellipse(w / 2, h * .47, w * .33, h * .25, 0, 0, 7); c.fill(); c.stroke();
  const saved = boil; boil = 0;
  drawPiece(c, 'J', 'w', w / 2, h * .44, w * .45, 3);
  boil = saved;
  c.fillStyle = INK; c.textAlign = 'center';
  c.font = `${Math.round(w * .13)}px 'Permanent Marker', 'Patrick Hand', cursive`; c.fillText('INKMATE', w / 2, m * 2.6 + w * .15);
  c.font = `${Math.round(w * .085)}px 'Patrick Hand', cursive`; c.fillText('3 cards · could be anything', w / 2, h - m * 2.6 - w * .06);
  c.fillStyle = RED; c.font = `${Math.round(w * .075)}px 'Patrick Hand', cursive`; c.fillText('chance of a LEGENDARY', w / 2, h * .76);
}
function drawCardBack(cv) {
  const w = 132, h = 184, dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr;
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = INK; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(242,238,226,0.25)'; c.lineWidth = 1;
  for (let k = -h; k < w + h; k += 8) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke(); c.beginPath(); c.moveTo(k + h, 0); c.lineTo(k, h); c.stroke(); }
  c.fillStyle = INK; c.beginPath(); c.arc(w / 2, h / 2, 34, 0, 7); c.fill();
  c.strokeStyle = PAPER; c.lineWidth = 2; c.beginPath(); c.arc(w / 2, h / 2, 34, 0, 7); c.stroke();
  const saved = boil; boil = 0;
  c.save(); c.translate(w / 2, h / 2 + 10); c.scale(.9, .9);
  c.strokeStyle = PAPER; c.lineWidth = 2.4; c.lineJoin = 'round';
  poly(c, [[-13, 0], [13, 0], [7, -28], [-7, -28]], 2, .5); c.fillStyle = INK; c.fill(); c.stroke();
  circ(c, 0, -33, 5.5, 5, .4, 10); c.fill(); c.stroke();
  poly(c, [[-7, -37], [-7.5, -47], [-3.5, -42], [0, -48], [3.5, -42], [7.5, -47], [7, -37]], 6, .4); c.fillStyle = GOLD; c.fill(); c.stroke();
  c.restore();
  boil = saved;
}
function openPackUI() {
  const side = G.mode === 'ai' ? 'w' : G.turn;
  if (!humanTurn() || G.lock || G.coins[side] < PACK_COST) return;
  G.pend = null; G.sel = -1;
  const keys = buyPack(side);
  refresh();
  const ov = $('#packOverlay'), stage = $('#packStage');
  ov.hidden = false; ov.dataset.side = side;
  stage.innerHTML = '';
  const pack = document.createElement('button');
  pack.type = 'button'; pack.className = 'pack-big'; pack.setAttribute('aria-label', 'Rip the pack open');
  const pc = document.createElement('canvas'); pack.appendChild(pc);
  const w = Math.min(220, window.innerWidth * .55); pc.style.width = w + 'px'; pc.style.height = w * 1.4 + 'px';
  drawPackArt(pc, w, w * 1.4);
  stage.appendChild(pack);
  $('#packMsg').textContent = 'Tap the pack to rip it open.';
  $('#packDone').hidden = true;
  snd('pick');
  pack.onclick = () => {
    pack.classList.add('rip'); snd('rip');
    setTimeout(() => revealCards(side, keys), 520);
  };
  pack.focus();
}
function revealCards(side, keys) {
  const stage = $('#packStage'); stage.innerHTML = '';
  const row = document.createElement('div'); row.className = 'reveal-row'; stage.appendChild(row);
  let flipped = 0;
  $('#packMsg').textContent = 'Tap each card to flip it.';
  keys.forEach((key, i) => {
    const wrap = document.createElement('button'); wrap.type = 'button';
    wrap.className = 'flip'; wrap.style.animationDelay = (i * 120) + 'ms';
    wrap.setAttribute('aria-label', 'Flip card ' + (i + 1));
    const inner = document.createElement('div'); inner.className = 'flip-inner';
    const back = document.createElement('div'); back.className = 'face back'; const bcv = document.createElement('canvas'); back.appendChild(bcv); drawCardBack(bcv);
    const front = document.createElement('div'); front.className = 'face front'; front.appendChild(cardEl(key));
    inner.append(back, front); wrap.appendChild(inner); row.appendChild(wrap);
    wrap.onclick = () => {
      if (wrap.classList.contains('flipped')) return;
      wrap.classList.add('flipped', 'r-' + CARDS[key].rarity); flipped++;
      const r = CARDS[key].rarity;
      snd(r === 'legendary' ? 'legend' : r === 'epic' ? 'epic' : 'flip');
      if (r === 'legendary') { $('#packMsg').textContent = `LEGENDARY! ${CARDS[key].name}!`; ov().classList.add('shake'); setTimeout(() => ov().classList.remove('shake'), 600); }
      if (flipped === keys.length) finishReveal(side, keys);
      wrap.setAttribute('aria-label', CARDS[key].name);
    };
  });
  const ov = () => $('#packOverlay');
}
function finishReveal(side, keys) {
  const { cash } = giveCards(side, keys);
  const coinsGot = cash.reduce((s, k) => s + (CARDS[k].kind === 'coin' ? CARDS[k].amount : 1), 0);
  const overflow = cash.filter(k => CARDS[k].kind !== 'coin').length;
  let msg = keys.some(k => CARDS[k].rarity === 'legendary') ? $('#packMsg').textContent + ' ' : '';
  msg += coinsGot ? `+${coinsGot} coins.` : 'Cards added to your hand.';
  if (overflow) msg += ` Your hand was full, so ${overflow} card${overflow > 1 ? 's were' : ' was'} swapped for coins.`;
  $('#packMsg').textContent = msg;
  addLog(`${who(side)} opened a pack: ${keys.map(k => CARDS[k].name).join(', ')}.`, 'played');
  const done = $('#packDone'); done.hidden = false; done.focus();
  refresh();
}
function closeOverlays() { $('#packOverlay').hidden = true; $('#unitsOverlay').hidden = true; refresh(); }

// ---- units guide
function buildUnitsGuide() {
  const grid = $('#unitsGrid'); if (grid.dataset.built) return; grid.dataset.built = '1';
  const groups = [['On the board from the start', ['K', 'Q', 'R', 'B', 'N', 'A', 'P']], ['Only from packs', ['W', 'C', 'T', 'Z', 'D', 'J']]];
  for (const [title, list] of groups) {
    const h = document.createElement('h3'); h.textContent = title; grid.appendChild(h);
    const wrap = document.createElement('div'); wrap.className = 'unit-list'; grid.appendChild(wrap);
    for (const t of list) {
      const u = UNITS[t];
      const card = Object.values(CARDS).find(c => c.unit === t);
      const el = document.createElement('article'); el.className = 'unit';
      el.innerHTML = `<div class="unit-pics"><canvas class="u-art"></canvas><canvas class="u-diag"></canvas></div><div class="unit-body"><h4>${u.name} <span class="val">${t === 'K' ? 'priceless' : 'worth ' + u.val}</span></h4><p>${u.rules}</p>${card ? `<p class="from">In packs: <span class="rar-${card.rarity}">${RARITY_LABEL[card.rarity]}</span></p>` : ''}</div>`;
      drawUnitArt(el.querySelector('.u-art'), t, 'w', 84);
      drawMoveDiagram(el.querySelector('.u-diag'), t);
      wrap.appendChild(el);
    }
  }
  const h = document.createElement('h3'); h.textContent = 'Spells and coins'; grid.appendChild(h);
  const sp = document.createElement('div'); sp.className = 'spell-list'; grid.appendChild(sp);
  for (const c of Object.values(CARDS)) if (c.kind !== 'unit') sp.appendChild(cardEl(c.key, { cls: 'mini' }));
}

// ---- start / end screens
function openStart() { $('#startOverlay').hidden = false; $('#startAi').focus(); }
function showEnd() {
  if (!G.over) return;
  toast(G.over.winner ? (G.mode === 'ai' ? (G.over.winner === 'w' ? 'Checkmate. You win!' : 'Checkmate. The Ink Baron wins.') : `Checkmate. ${who(G.over.winner)} wins!`) : 'Draw');
}

// ===================================================================== audio
let AC = null, muted = false, noiseBuf = null;
function unlockAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * .6, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function snd(type) {
  if (!AC || muted) return;
  const now = AC.currentTime;
  const tone = (wave, f1, f2, dur, vol, at = 0) => {
    const g = AC.createGain(), o = AC.createOscillator(); o.type = wave;
    o.frequency.setValueAtTime(f1, now + at); o.frequency.exponentialRampToValueAtTime(f2, now + at + dur);
    g.gain.setValueAtTime(0.0001, now); g.gain.setValueAtTime(vol, now + at); g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    o.connect(g); g.connect(AC.destination); o.start(now + at); o.stop(now + at + dur + .02);
  };
  const noise = (dur, vol, freq, at = 0, type = 'lowpass') => {
    const g = AC.createGain(), n = AC.createBufferSource(), f = AC.createBiquadFilter();
    n.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, now + at); g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    n.connect(f); f.connect(g); g.connect(AC.destination); n.start(now + at); n.stop(now + at + dur);
  };
  switch (type) {
    case 'tap': noise(.06, .25, 900); tone('sine', 180, 120, .08, .06); break;
    case 'pick': tone('triangle', 500, 640, .06, .04); break;
    case 'hit': noise(.12, .3, 1400); tone('square', 120, 60, .12, .04); break;
    case 'twang': tone('triangle', 800, 240, .12, .06); break;
    case 'boom': noise(.5, .4, 320); break;
    case 'jet': noise(.7, .18, 2400, 0, 'bandpass'); tone('sawtooth', 300, 900, .6, .02); break;
    case 'summon': tone('sine', 440, 660, .15, .05); tone('sine', 660, 880, .15, .05, .1); break;
    case 'spell': tone('sine', 700, 1400, .3, .05); tone('triangle', 350, 700, .3, .03, .05); break;
    case 'freeze': tone('sine', 1800, 1200, .4, .04); tone('sine', 2400, 1600, .3, .03, .08); break;
    case 'rip': noise(.35, .25, 3000, 0, 'highpass'); break;
    case 'flip': noise(.08, .15, 2000); break;
    case 'epic': tone('triangle', 523, 523, .2, .05); tone('triangle', 784, 784, .3, .05, .12); break;
    case 'legend': [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .35, .06, i * .1)); noise(.6, .08, 5000, .3, 'highpass'); break;
    case 'check': tone('square', 330, 330, .1, .03); tone('square', 330, 330, .1, .03, .15); break;
    case 'win': [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, .4, .06, i * .14)); break;
  }
}

// ===================================================================== wiring & loop
$('#btnPack').addEventListener('click', () => { unlockAudio(); openPackUI(); });
$('#packDone').addEventListener('click', closeOverlays);
$('#btnUnits').addEventListener('click', () => { buildUnitsGuide(); $('#unitsOverlay').hidden = false; $('#unitsClose').focus(); });
$('#startUnits').addEventListener('click', () => { buildUnitsGuide(); $('#unitsOverlay').hidden = false; $('#unitsClose').focus(); });
$('#unitsClose').addEventListener('click', () => { $('#unitsOverlay').hidden = true; });
$('#btnNew').addEventListener('click', openStart);
$('#btnMute').addEventListener('click', () => { muted = !muted; $('#btnMute').textContent = muted ? 'Sound off' : 'Sound on'; $('#btnMute').setAttribute('aria-pressed', String(!muted)); });
$('#startAi').addEventListener('click', () => { unlockAudio(); $('#startOverlay').hidden = true; newGame('ai'); });
$('#startPvp').addEventListener('click', () => { unlockAudio(); $('#startOverlay').hidden = true; newGame('pvp'); });
for (const ov of ['#packOverlay', '#unitsOverlay']) $(ov).addEventListener('pointerdown', e => { if (e.target === $(ov) && (ov === '#unitsOverlay' || !$('#packDone').hidden)) closeOverlays(); });

drawPackArt($('#packMini'), 46, 64);
window.addEventListener('resize', () => { sizeBoard(); });
sizeBoard();
newGame('ai');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildLayer(); drawPackArt($('#packMini'), 46, 64); $('#hand').dataset.sig = ''; refresh(); });

let lastBoil = 0;
function loop(now) {
  if (now - lastBoil > 150) { boil = (boil + 1) % 4; lastBoil = now; }
  drawBoard(now);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// hook for automated checks
window.__inkmate = { G, legalMoves, legalCardOptions, playMove, playCard, giveCards, CARDS, UNITS, newGame, searchRoot, cardOptions, applyCard, inCheck };
})();
