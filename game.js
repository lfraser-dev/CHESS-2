/* Inkmate game screen: board rendering, turns, card effects, shop, recycling, pack opening, the Ink Baron. */
(() => {
'use strict';
const I = window.INK;
const { N, U, CARDS, PACKS, SETS, RARITY_LABEL, SCRAP, other, rc, inB } = I;
const { INK: K, PAPER, RED, GOLD, BLUE, SOFT, GREEN } = I.COL;
const $ = s => document.querySelector(s);
const FILES = 'abcdefghij';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let G = null;
const NAMES = { ai: { w: 'You', b: 'The Ink Baron' }, pvp: { w: 'Paper', b: 'Ink' } };
const who = s => NAMES[G.mode][s];
const sqName = i => { const [r, c] = rc(i); return FILES[c] + (N - r); };
const viewer = () => G.mode === 'ai' ? 'w' : G.turn;
const humanTurn = () => G && !G.over && (G.mode === 'pvp' || G.turn === 'w');
const FIELD_INFO = {
  wrap: ['Ouroboros', 'the left and right edges are joined'],
  truce: ['White Flag', 'nobody can capture'],
  km: ['Knightmare', 'pawns can also jump like knights'],
  bp: ['Backpedal', 'pawns can also step backwards'],
};

function snap() { G.snaps.push({ board: G.board.slice(), terr: G.terr.slice(), side: G.turn }); if (G.snaps.length > 12) G.snaps.shift(); }
function newGame(mode) {
  G = I.newState(mode);
  Object.assign(G, { sel: -1, pend: null, lock: false, recycle: null });
  anims.length = 0; fx.length = 0;
  snap();
  addLog(mode === 'ai' ? 'New game against the Ink Baron. You play Paper and move first.' : 'New game. Paper moves first.');
  refresh();
}
function addLog(text, cls = '') { G.log.unshift({ text, cls }); if (G.log.length > 50) G.log.pop(); }

// ===================================================================== effects & turn flow
function evToFx(ev, cardKey) {
  const lines = [];
  for (const e of ev) {
    if (e.type === 'destroy') { addFx({ kind: 'cross', p: e.p, sq: e.sq, delay: 300, dur: 750 }); addFx({ kind: 'splat', sq: e.sq, delay: 300, dur: 9000, s: e.sq * 7 }); }
    else if (e.type === 'summon') addFx({ kind: 'summon', sq: e.sq, dur: e.big ? 900 : 700, big: e.big });
    else if (e.type === 'spell') { if (!(e.hidden && G.mode === 'ai' && G.turn === 'b')) addFx({ kind: 'spell', key: cardKey, sq: e.sq, sq2: e.sq2, dur: 900 }); }
    else if (e.type === 'field') { addFx({ kind: 'field', key: e.key, dur: 1100 }); if (e.key === 'quake' || e.key === 'mirror') shakeT = performance.now() + 600; }
    else if (e.type === 'msg') lines.push(e.text);
    else if (e.type === 'coins') lines.push(`+${e.n} coins`);
  }
  return lines;
}
function killReal(sq, delay = 300) {
  const p = G.board[sq]; if (!p || p.t === 'K') return null;
  G.board[sq] = null; G.grave[p.s].push(p.t);
  addFx({ kind: 'cross', p, sq, delay, dur: 750 }); addFx({ kind: 'splat', sq, delay, dur: 9000, s: sq * 3 + 1 });
  return p;
}
function explode(center, delay) {
  addFx({ kind: 'boom', sq: center, delay, dur: 800 }); shakeT = performance.now() + delay + 500;
  setTimeout(() => snd('boom'), delay);
  const lost = [];
  for (const j of I.area(center)) { const p = killReal(j, delay + 100); if (p) lost.push(p); }
  return lost;
}
function reborn(p) {
  for (const r of I.homeRows(p.s)) for (const c of [4, 5, 3, 6, 2, 7, 1, 8, 0, 9]) {
    const i = r * N + c;
    if (!G.board[i] && !(G.terr[i] && (G.terr[i].k === 'pit' || G.terr[i].k === 'fire'))) {
      G.board[i] = { ...I.mkPiece(p.t, p.s), reb: 0 }; G.grave[p.s].pop();
      addFx({ kind: 'summon', sq: i, delay: 700, dur: 900, big: true });
      return i;
    }
  }
  return -1;
}
const isShooter = t => { const u = U[t]; return !!(u.shoot || u.lob || u.strike || u.ring); };

async function playMove(side, m) {
  G.lock = true; G.sel = -1; I.setEnv(G);
  const mover = G.board[m.f], cap = m.cap, mu = U[mover.t];
  const swapped = m.sw ? G.board[m.t] : null;
  I.makeMove(G.board, m);
  G.last = { f: m.f, t: m.t };
  const name = mu.name;
  let line = `${who(side)}: ${name} ${sqName(m.f)} `;
  if (m.sw) {
    addAnim({ kind: 'move', p: mover, f: m.f, t: m.t, dur: 320, fly: true }); addAnim({ kind: 'move', p: swapped, f: m.t, t: m.f, dur: 320, fly: true });
    line += `swaps places with the ${U[swapped.t].name} on ${sqName(m.t)}`; snd('spell');
  } else if (m.r || (m.arm && isShooter(mover.t) && !(mu.sl || mu.leap))) {
    const proj = ['C', 'cannon', 'titan'].includes(mover.t) ? 'rock' : ['kraken', 'tentacle'].includes(mover.t) ? 'grab' : mover.t === 'plasma' ? 'bolt' : 'arrow';
    addAnim({ kind: 'shot', f: m.f, t: m.t, dur: 420, proj });
    snd(proj === 'rock' ? 'boom' : proj === 'grab' ? 'hit' : 'twang');
    line += `${proj === 'grab' ? 'grabs' : 'shoots'} ${sqName(m.t)}`;
  } else if (m.arm) {
    addAnim({ kind: 'bump', p: mover, f: m.f, t: m.t, dur: 360 }); snd('tap');
    line += `attacks ${sqName(m.t)}`;
  } else {
    const far = Math.abs(m.t - m.f) > 3 * N || Math.abs((m.t % N) - (m.f % N)) > 3;
    addAnim({ kind: 'move', p: G.board[m.t], f: m.f, t: m.t, dur: mover.t === 'J' || far ? 480 : 260, fly: !!(mu.fly || mu.leap), jet: mover.t === 'J' });
    snd(mover.t === 'J' ? 'jet' : 'tap');
    line += `→ ${sqName(m.t)}`;
  }
  if (m.arm) { line += `, cracking its armour`; addFx({ kind: 'text', sq: m.t, str: 'clang!', col: K, delay: 250, dur: 1000 }); setTimeout(() => snd('clang'), 250); }
  if (cap && !m.arm && !m.sw) {
    G.grave[cap.s].push(cap.t);
    addFx({ kind: 'cross', p: cap, sq: m.t, delay: m.r ? 380 : 0, dur: 700 });
    addFx({ kind: 'splat', sq: m.t, delay: m.r ? 380 : 200, dur: 9000, s: Math.random() * 99 });
    setTimeout(() => snd('hit'), m.r ? 380 : 200);
    let gain = U[cap.t].val ? Math.max(1, Math.ceil(U[cap.t].val / 2)) : 0;
    const extras = [];
    if (cap.bounty) { gain += 5; extras.push('claims the bounty'); }
    if (mu.plunder) gain += mu.plunder;
    if (mu.steal) { const n = Math.min(mu.steal, G.coins[other(side)]); G.coins[other(side)] -= n; gain += n; if (n) extras.push(`steals ${n} coins`); }
    G.coins[side] += gain;
    line += `, takes ${U[cap.t].name}${gain ? ` (+${gain})` : ''}`;
    if (extras.length) line += ', ' + extras.join(', ');
    if (gain) addFx({ kind: 'text', sq: m.t, str: `+${gain}`, col: GOLD, delay: 250, dur: 1100 });
    G.quiet = 0;
    if (cap.bomb || U[cap.t].boom) { const lost = explode(m.t, m.r ? 450 : 300); line += `. BOOM! The ${U[cap.t].name} explodes${lost.length ? `, taking out ${lost.map(p => U[p.t].name).join(', ')}` : ''}`; }
    if (cap.reb) { const at = reborn(cap); if (at >= 0) line += `. The ${U[cap.t].name} rises again on ${sqName(at)}!`; }
    if (mover.t === 'lizard' && !m.r && G.board[m.t] === mover) {
      const crushed = []; for (const j of I.area(m.t)) { const p = G.board[j]; if (j !== m.t && p && p.s !== side && p.t !== 'K' && p.sh <= 0) { killReal(j, 350); crushed.push(U[p.t].name); } }
      if (crushed.length) { line += `, and stomps ${crushed.join(', ')}`; shakeT = performance.now() + 700; }
    }
  } else if (!m.arm && !m.sw) G.quiet++;
  if (m.pr) { line += ', promoted to Queen'; addFx({ kind: 'text', sq: m.t, str: 'Queen!', col: RED, delay: 250, dur: 1200 }); }
  // landing effects
  if (!m.r && !m.arm && !m.sw && G.board[m.t]) {
    const t = G.terr[m.t];
    if (t && t.k === 'mine' && t.s !== side) {
      G.terr[m.t] = null;
      addFx({ kind: 'boom', sq: m.t, delay: 260, dur: 800 }); setTimeout(() => snd('boom'), 260); shakeT = performance.now() + 700;
      if (G.board[m.t].t === 'K') line += '. A landmine goes off under the king, who just gets singed';
      else { killReal(m.t, 300); line += `. LANDMINE! The ${name} is blown up`; }
    }
    if (G.board[m.t] && G.board[m.t].t === 'moth') {
      let n = 0; for (const j of I.area(m.t)) { const p = G.board[j]; if (p && p.s !== side && p.t !== 'K' && p.sh <= 0) { G.board[j] = { ...p, fz: Math.max(p.fz, 1) }; n++; } }
      if (n) { line += `, dusting ${n} enem${n === 1 ? 'y' : 'ies'} frozen`; addFx({ kind: 'spell', key: 'freeze', sq: m.t, dur: 800 }); }
    }
  }
  addLog(line);
  refresh();
  await waitAnims();
  finishTurn(side);
}

async function playCard(side, idx, o) {
  G.lock = true;
  const key = G.hand[side][idx], card = CARDS[key];
  G.hand[side].splice(idx, 1);
  G.pend = null; G.sel = -1; G.last = null;
  let sim = null, ev = [];
  for (let tries = 0; tries < 12; tries++) {
    const s2 = I.cloneState(G); const e2 = [];
    I.applyCard(s2, side, key, o, e2);
    if (!card.random || I.stateLegal(s2, side)) { sim = s2; ev = e2; break; }
  }
  I.setEnv(G);
  if (!sim) addLog(`${who(side)} played ${card.name}, but nothing happened.`, 'played');
  else {
    Object.assign(G, { board: sim.board, terr: sim.terr, fields: sim.fields, coins: sim.coins, hand: sim.hand, grave: sim.grave, extra: sim.extra });
    const extra = evToFx(ev, key);
    let line = `${who(side)} played ${card.name}`;
    const hidden = key === 'mine' && G.mode === 'ai' && side === 'b';
    if (card.kind === 'unit') line += ` on ${sqName(o.a)}`;
    else if (o.a >= 0 && !hidden) line += ` on ${sqName(o.a)}${o.b != null ? ' → ' + sqName(o.b) : ''}`;
    if (extra.length) line += ` and ${extra.join(', ')}`;
    const destroyed = ev.filter(e => e.type === 'destroy');
    if (destroyed.length) line += `. Destroyed: ${destroyed.map(e => U[e.p.t].name).join(', ')}`;
    addLog(line + '.', 'played');
    snd({ freeze: 'freeze', meteor: 'boom', orbital: 'boom', lightning: 'boom', earthquake: 'boom', mine: 'tap', pit: 'tap' }[key] || (card.kind === 'unit' ? 'summon' : 'spell'));
    if (ev.some(e => e.type === 'field')) toast(card.name + '!');
  }
  G.quiet = 0;
  refresh();
  await waitAnims(); await sleep(card.kind === 'spell' ? 350 : 150);
  finishTurn(side);
}

function endOfTurnEffects(side) {
  const notes = [];
  for (let i = 0; i < N * N; i++) {
    let p = G.board[i]; if (!p) continue;
    if (p.s === side) {
      if (p.fz > 0) p = { ...p, fz: p.fz - 1 };
      if (p.curse) { p = { ...p, curse: p.curse - 1 }; if (p.curse <= 0) { G.board[i] = p; killReal(i, 100); notes.push(`${who(side)}'s cursed ${U[p.t].name} crumbles to dust`); continue; } }
      if (p.hatch) { p = { ...p, hatch: p.hatch - 1 }; if (p.hatch <= 0) { p = { ...p, t: 'D', hatch: 0 }; addFx({ kind: 'summon', sq: i, dur: 900, big: true }); notes.push(`${who(side)}'s Dragon Egg hatches!`); } }
    } else if (p.sh > 0) p = { ...p, sh: p.sh - 1 };
    G.board[i] = p;
  }
  for (let i = 0; i < N * N; i++) { const t = G.terr[i]; if (t && t.k === 'fire') { const n = t.n - 1; G.terr[i] = n > 0 ? { ...t, n } : null; } }
  for (const k in G.fields) if (G.fields[k] > 0) { G.fields[k]--; if (!G.fields[k] && FIELD_INFO[k]) notes.push(`${FIELD_INFO[k][0]} wears off`); }
  for (const n of notes) addLog(n + '.', 'warn');
}
function canAct(side) {
  I.setEnv(G);
  if (I.legalMoves(G.board, side).length) return true;
  return G.hand[side].some(k => I.legalCardOptions(G, side, k).length);
}
function finishTurn(side) {
  endOfTurnEffects(side);
  G.sel = -1; G.pend = null; G.ply++;
  if (G.extra) { G.extra = false; addLog(`${who(side)} take${G.mode === 'ai' && side === 'w' ? '' : 's'} another turn.`, 'played'); }
  else {
    G.turn = other(side);
    G.coins[G.turn] += 1;
    const geese = G.board.filter(p => p && p.s === G.turn && U[p.t].income).length;
    if (geese) { G.coins[G.turn] += 3 * geese; addLog(`The Golden Goose lays ${3 * geese} coins for ${who(G.turn)}.`, 'played'); }
  }
  snap();
  I.setEnv(G);
  const t = G.turn;
  if (!canAct(t)) {
    if (I.inCheck(G.board, t)) { G.over = { winner: other(t), why: 'checkmate' }; addLog(`Checkmate! ${G.mode === 'ai' ? (other(t) === 'w' ? 'You win.' : 'The Ink Baron wins.') : who(other(t)) + ' wins.'}`, 'big'); snd('win'); }
    else { G.over = { winner: null, why: 'stalemate' }; addLog('Stalemate. Nobody can move, so it\'s a draw.', 'big'); }
  } else if (G.quiet >= 120) { G.over = { winner: null, why: 'quiet' }; addLog('Sixty moves each with nothing captured. It\'s a draw.', 'big'); }
  else if (I.inCheck(G.board, t)) { addLog(`${who(t)} ${G.mode === 'ai' && t === 'w' ? 'are' : 'is'} in check!`, 'warn'); snd('check'); }
  G.lock = false;
  refresh();
  if (G.over) { const ov = G.over, msg = ov.winner ? (G.mode === 'ai' ? (ov.winner === 'w' ? 'Checkmate. You win!' : 'Checkmate. The Ink Baron wins.') : `Checkmate. ${who(ov.winner)} wins!`) : 'Draw'; setTimeout(() => toast(msg), 900); return; }
  if (G.mode === 'ai' && G.turn === 'b') { G.lock = true; refresh(); setTimeout(aiTurn, 450); }
}

// ---- the Ink Baron
async function aiTurn() {
  if (G.over || G.turn !== 'b') return;
  G.lock = true; refresh();
  await sleep(150);
  while (G.hand.b.length >= 6) {
    let worst = 0; G.hand.b.forEach((k, i) => { if (SCRAP[CARDS[k].rarity] < SCRAP[CARDS[G.hand.b[worst]].rarity]) worst = i; });
    const k = G.hand.b.splice(worst, 1)[0]; G.coins.b += SCRAP[CARDS[k].rarity];
    addLog(`The Ink Baron recycled ${CARDS[k].name} for ${SCRAP[CARDS[k].rarity]} coin${SCRAP[CARDS[k].rarity] > 1 ? 's' : ''}.`, 'played');
  }
  if (G.hand.b.length <= 4) {
    const afford = Object.keys(PACKS).filter(k => PACKS[k].cost <= G.coins.b);
    if (afford.length) {
      const pk = afford.length > 1 && Math.random() < .6 ? afford[1 + Math.floor(Math.random() * (afford.length - 1))] : afford[0];
      G.coins.b -= PACKS[pk].cost;
      let cash = 0;
      for (const k of I.rollPack(pk)) if (I.addToHand(G, 'b', k) !== 'kept') cash++;
      addLog(`The Ink Baron opened a ${PACKS[pk].name} pack${cash ? ' and pocketed some coins' : ''}.`, 'played');
      toast(`The Ink Baron opened a ${PACKS[pk].name} pack`); snd('rip'); refresh();
      await sleep(650);
    }
  }
  const plan = I.aiDecide(G, 'b');
  I.setEnv(G);
  if (!plan) return;
  if (plan.type === 'move') await playMove('b', plan.m);
  else { toast(`The Ink Baron plays ${CARDS[G.hand.b[plan.idx]].name}!`); await sleep(450); await playCard('b', plan.idx, plan.o); }
}

// ===================================================================== board canvas
const bc = $('#board'), bctx = bc.getContext('2d');
const layer = document.createElement('canvas');
let BS = 600, PADB = 20, CELL = 56, DPR = 1, hover = -1, shakeT = 0;
function sizeBoard() {
  const wrap = $('#boardWrap');
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const wide = window.innerWidth >= 900;
  BS = Math.floor(Math.max(280, Math.min(wrap.clientWidth, wide ? window.innerHeight - 170 : 9999, 860)));
  bc.style.width = BS + 'px'; bc.style.height = BS + 'px';
  bc.width = BS * DPR; bc.height = BS * DPR;
  PADB = Math.round(BS * 0.045); CELL = (BS - PADB * 2) / N;
  buildLayer();
}
function buildLayer() {
  layer.width = bc.width; layer.height = bc.height;
  const c = layer.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
  const saved = I.boil; I.boil = 0; c.lineCap = 'round';
  c.fillStyle = 'rgba(242,238,226,0.85)'; c.fillRect(0, 0, BS, BS);
  for (let r = 0; r < N; r++) for (let col = 0; col < N; col++) {
    if ((r + col) % 2 === 0) continue;
    const x = PADB + col * CELL, y = PADB + r * CELL;
    c.save(); c.beginPath(); c.rect(x + 1, y + 1, CELL - 2, CELL - 2); c.clip();
    c.strokeStyle = 'rgba(30,28,36,0.2)'; c.lineWidth = 1;
    const gap = Math.max(4, CELL / 8);
    for (let k = -CELL; k < CELL * 2; k += gap) I.ln(c, x + k, y + CELL + 2, x + k + CELL + 4, y - 2, r * 31 + col * 7 + k, .8);
    c.restore();
  }
  c.strokeStyle = K; c.lineWidth = Math.max(1, CELL / 40);
  for (let i = 0; i <= N; i++) { const p = PADB + i * CELL; I.ln(c, PADB - 3, p, PADB + N * CELL + 3, p, i * 13, .9); I.ln(c, p, PADB - 3, p, PADB + N * CELL + 3, i * 17 + 5, .9); }
  c.lineWidth = Math.max(2, CELL / 22);
  I.poly(c, [[PADB - 5, PADB - 5], [PADB + N * CELL + 5, PADB - 5], [PADB + N * CELL + 5, PADB + N * CELL + 5], [PADB - 5, PADB + N * CELL + 5]], 99, 1.5); c.stroke();
  c.fillStyle = SOFT; c.font = `${Math.max(11, PADB * 0.62)}px 'Patrick Hand', cursive`; c.textAlign = 'center'; c.textBaseline = 'middle';
  for (let i = 0; i < N; i++) { c.fillText(FILES[i], PADB + i * CELL + CELL / 2, BS - PADB / 2 + 1); c.fillText(String(N - i), PADB / 2, PADB + i * CELL + CELL / 2); }
  I.boil = saved;
}
const sqXY = sq => { const [r, c] = rc(sq); return [PADB + c * CELL + CELL / 2, PADB + r * CELL + CELL / 2]; };
function sqAt(px, py) { const c = Math.floor((px - PADB) / CELL), r = Math.floor((py - PADB) / CELL); return inB(r, c) ? r * N + c : -1; }

const anims = [], fx = [];
function addAnim(a) { a.start = performance.now() + (a.delay || 0); anims.push(a); }
function addFx(f) { f.start = performance.now() + (f.delay || 0); fx.push(f); }
function waitAnims() {
  return new Promise(res => {
    const check = () => { const now = performance.now(); const busy = anims.some(a => now < a.start + a.dur) || fx.some(f => f.kind !== 'splat' && now < f.start + f.dur); busy ? setTimeout(check, 40) : res(); };
    check();
  });
}
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

let checkKey = '', checkVal = { w: false, b: false };
function inCheckCached(s) {
  const key = G.ply + ':' + G.board.map(p => p ? p.id + p.t + p.fz + p.sh : '-').join('') + JSON.stringify(G.fields);
  if (key !== checkKey) { I.setEnv(G); checkVal = { w: I.inCheck(G.board, 'w'), b: I.inCheck(G.board, 'b') }; checkKey = key; }
  return checkVal[s];
}
let tKey = null, tList = [];
function currentTargets() {
  if (!humanTurn() || G.lock || G.recycle) return [];
  const key = G.ply + ':' + G.sel + ':' + (G.pend ? G.pend.idx + '/' + G.pend.first : '') + ':' + G.turn;
  if (tKey === key) return tList;
  let list = [];
  if (G.pend) {
    const card = CARDS[G.pend.key], T = card.target;
    if (T.t === 'pair') {
      if (G.pend.first == null) list = [...new Set(G.pend.opts.map(o => o.a))].map(sq => ({ sq, type: 'spell' }));
      else list = G.pend.opts.filter(o => o.a === G.pend.first).map(o => ({ sq: o.b, type: 'place' }));
    } else if (T.t !== 'none') list = G.pend.opts.map(o => ({ sq: o.a, type: card.kind === 'unit' || T.t === 'empty' || T.t === 'home' ? 'place' : 'spell' }));
  } else if (G.sel >= 0) {
    I.setEnv(G);
    const pt = G.board[G.sel] && G.board[G.sel].t;
    list = I.legalMoves(G.board, G.turn).filter(m => m.f === G.sel).map(m => ({ sq: m.t, type: m.sw ? 'swap' : (m.r || (m.arm && isShooter(pt))) ? 'shoot' : m.cap ? 'cap' : 'move', m }));
  }
  tKey = key; tList = list; return list;
}

function drawBoard(now) {
  const c = bctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bc.width, bc.height);
  let sx = 0, sy = 0;
  if (now < shakeT) { sx = (Math.random() - .5) * 8 * DPR; sy = (Math.random() - .5) * 6 * DPR; }
  c.setTransform(1, 0, 0, 1, sx, sy);
  c.drawImage(layer, 0, 0);
  c.setTransform(DPR, 0, 0, DPR, sx, sy);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (!G) return;
  if (G.fields.wrap > 0) {
    c.strokeStyle = BLUE; c.lineWidth = 2; c.setLineDash([5, 5]);
    for (const x of [PADB - 3, PADB + N * CELL + 3]) { c.beginPath(); c.moveTo(x, PADB); c.lineTo(x, PADB + N * CELL); c.stroke(); }
    c.setLineDash([]);
  }
  const showMine = s => G.mode === 'pvp' || s === 'w';
  for (let i = 0; i < N * N; i++) { const t = G.terr[i]; if (!t) continue; const [x, y] = sqXY(i); I.drawTerrain(c, t, x, y, CELL, i, t.k !== 'mine' || showMine(t.s)); }
  for (const f of fx) if (f.kind === 'splat' && now >= f.start) {
    const k = (now - f.start) / f.dur, [x, y] = sqXY(f.sq);
    c.globalAlpha = Math.min(1, (1 - k) * 3) * 0.5; c.fillStyle = RED; c.beginPath();
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = CELL * (.18 + I.hash(f.s + i) * .14); c.lineTo(x + Math.cos(a) * r, y + CELL * .3 + Math.sin(a) * r * .35); }
    c.fill(); c.globalAlpha = 1;
  }
  if (G.last) for (const sq of [G.last.f, G.last.t]) { const [x, y] = sqXY(sq); c.fillStyle = 'rgba(236,200,70,0.32)'; I.poly(c, [[x - CELL * .47, y - CELL * .44], [x + CELL * .46, y - CELL * .47], [x + CELL * .47, y + CELL * .45], [x - CELL * .45, y + CELL * .47]], sq, 1.2); c.fill(); }
  for (const s of ['w', 'b']) if (inCheckCached(s)) { const ks = I.kingSq(G.board, s); if (ks >= 0) { const [x, y] = sqXY(ks); c.strokeStyle = RED; c.lineWidth = 2.6; I.circ(c, x, y, CELL * .44, 77, 1.5, 14); c.stroke(); } }
  const targets = currentTargets();
  if (G.sel >= 0) { const [x, y] = sqXY(G.sel); c.strokeStyle = RED; c.lineWidth = 2.4; I.circ(c, x, y, CELL * .42, 5, 1.2, 12); c.stroke(); }
  if (G.pend && G.pend.first != null) { const [x, y] = sqXY(G.pend.first); c.strokeStyle = BLUE; c.lineWidth = 2.4; I.circ(c, x, y, CELL * .42, 6, 1.2, 12); c.stroke(); }
  for (const t of targets) {
    const [x, y] = sqXY(t.sq);
    if (t.type === 'move') { c.fillStyle = 'rgba(30,28,36,0.55)'; I.circ(c, x, y, CELL * .1, t.sq, .8, 7); c.fill(); }
    else if (t.type === 'cap') { c.strokeStyle = RED; c.lineWidth = 2; I.circ(c, x, y, CELL * .4, t.sq, 1, 12); c.stroke(); }
    else if (t.type === 'shoot') { c.strokeStyle = RED; c.lineWidth = 1.8; I.circ(c, x, y, CELL * .36, t.sq, .8, 12); c.stroke(); for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) I.ln(c, x + a * CELL * .2, y + b * CELL * .2, x + a * CELL * .45, y + b * CELL * .45, t.sq + a + b * 3, .3); }
    else if (t.type === 'swap') { c.strokeStyle = BLUE; c.lineWidth = 2; c.beginPath(); c.arc(x, y, CELL * .36, -2.6, -0.5); c.stroke(); c.beginPath(); c.arc(x, y, CELL * .36, 0.5, 2.6); c.stroke(); }
    else if (t.type === 'place') { c.strokeStyle = BLUE; c.lineWidth = 1.6; c.setLineDash([4, 4]); c.strokeRect(x - CELL * .38, y - CELL * .38, CELL * .76, CELL * .76); c.setLineDash([]); }
    else if (t.type === 'spell') { c.strokeStyle = BLUE; c.lineWidth = 2.2; I.circ(c, x, y, CELL * .42, t.sq, 1, 12); c.stroke(); }
  }
  if (hover >= 0 && humanTurn() && !G.lock) {
    const [x, y] = sqXY(hover); c.strokeStyle = 'rgba(30,28,36,0.25)'; c.lineWidth = 1.5; c.strokeRect(x - CELL / 2 + 3, y - CELL / 2 + 3, CELL - 6, CELL - 6);
    if (G.pend && targets.some(t => t.sq === hover)) {
      const k = G.pend.key; let sqs = null; const [hr, hc] = rc(hover);
      if (k === 'meteor' || k === 'stomp') sqs = I.area(hover);
      else if (k === 'orbital') sqs = [[0, 0], [0, 1], [0, -1], [1, 0], [-1, 0]].filter(([a, b]) => inB(hr + a, hc + b)).map(([a, b]) => (hr + a) * N + hc + b);
      else if (k === 'goo') sqs = [hover, hover + 1, hover + N, hover + N + 1];
      else if (k === 'firewall') sqs = [-1, 0, 1].filter(d => inB(hr, hc + d)).map(d => hover + d);
      if (sqs) { c.fillStyle = k === 'goo' ? 'rgba(111,143,58,0.2)' : 'rgba(179,50,43,0.14)'; for (const s of sqs) { const [a, b] = sqXY(s); c.fillRect(a - CELL / 2, b - CELL / 2, CELL, CELL); } }
    }
  }
  const moving = new Set(anims.filter(a => (a.kind === 'move' || a.kind === 'bump') && now < a.start + a.dur).map(a => a.p));
  for (let sq = 0; sq < N * N; sq++) {
    const p = G.board[sq]; if (!p || moving.has(p)) continue;
    const [x, y] = sqXY(sq);
    let alpha = 1;
    const sm = fx.find(f => f.kind === 'summon' && f.sq === sq && now < f.start + f.dur);
    if (sm) alpha = now < sm.start ? 0 : Math.min(1, (now - sm.start) / (sm.dur * 0.6));
    I.drawPiece(c, p.t, p.s, x, y, CELL * .82, p.id * 3.7, alpha);
    I.drawBadges(c, p, x, y, CELL);
  }
  for (const f of fx) {
    if (f.kind !== 'cross' || now > f.start + f.dur) continue;
    const [x, y] = sqXY(f.sq);
    if (now < f.start) { I.drawPiece(c, f.p.t, f.p.s, x, y, CELL * .82, f.p.id * 3.7); continue; }
    const k = (now - f.start) / f.dur;
    I.drawPiece(c, f.p.t, f.p.s, x, y, CELL * .82, f.p.id * 3.7, Math.max(0, 1 - k * 1.3));
    c.strokeStyle = RED; c.lineWidth = 3; c.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4);
    const d1 = Math.min(1, k * 4), d2 = Math.min(1, Math.max(0, k * 4 - 1)), r = CELL * .34;
    c.beginPath(); c.moveTo(x - r, y - r); c.lineTo(x - r + 2 * r * d1, y - r + 2 * r * d1); c.stroke();
    if (d2 > 0) { c.beginPath(); c.moveTo(x + r, y - r); c.lineTo(x + r - 2 * r * d2, y - r + 2 * r * d2); c.stroke(); }
    c.globalAlpha = 1;
  }
  for (const a of anims) {
    if (now < a.start || now > a.start + a.dur) continue;
    const k = ease((now - a.start) / a.dur);
    const [x1, y1] = sqXY(a.f), [x2, y2] = sqXY(a.t);
    if (a.kind === 'move') {
      const lift = a.fly ? Math.sin(k * Math.PI) * CELL * (a.jet ? .9 : .45) : 0;
      if (a.jet) { c.strokeStyle = 'rgba(30,28,36,0.35)'; c.lineWidth = 1.5; c.setLineDash([5, 6]); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k - lift); c.stroke(); c.setLineDash([]); }
      I.drawPiece(c, a.p.t, a.p.s, x1 + (x2 - x1) * k, y1 + (y2 - y1) * k - lift, CELL * .82, a.p.id * 3.7);
    } else if (a.kind === 'bump') {
      const b = Math.sin(k * Math.PI) * .45;
      I.drawPiece(c, a.p.t, a.p.s, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, CELL * .82, a.p.id * 3.7);
    } else if (a.kind === 'shot') {
      const arc = a.proj === 'rock' ? 1.3 : a.proj === 'arrow' ? .5 : 0;
      const x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k - Math.sin(k * Math.PI) * CELL * arc;
      if (a.proj === 'rock') { c.strokeStyle = K; c.lineWidth = 1.6; I.circ(c, x, y, CELL * .09, 3, .6, 8); I.fs(c, K); }
      else if (a.proj === 'bolt') { c.strokeStyle = BLUE; c.lineWidth = 4; c.beginPath(); c.moveTo(x1 + (x2 - x1) * Math.max(0, k - .2), y1 + (y2 - y1) * Math.max(0, k - .2)); c.lineTo(x, y); c.stroke(); }
      else if (a.proj === 'grab') { c.strokeStyle = K; c.lineWidth = CELL * .12; c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2 + CELL * .4, (y1 + y2) / 2 - CELL * .4, x, y); c.stroke(); c.strokeStyle = PAPER; c.lineWidth = CELL * .06; c.stroke(); }
      else { const dy = (y2 - y1) - Math.cos(k * Math.PI) * CELL * Math.PI * arc, ang = Math.atan2(dy, x2 - x1), cs = Math.cos(ang), sn = Math.sin(ang), L = CELL * .3; c.strokeStyle = K; c.lineWidth = 2; c.beginPath(); c.moveTo(x - cs * L, y - sn * L); c.lineTo(x, y); c.stroke(); }
    }
  }
  for (const f of fx) {
    if (now < f.start || now > f.start + f.dur) continue;
    const k = (now - f.start) / f.dur;
    if (f.kind === 'summon') {
      const [x, y] = sqXY(f.sq); c.strokeStyle = f.big ? RED : K; c.globalAlpha = 1 - k; c.lineWidth = 1.6; const R = f.big ? 1.6 : 1;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; I.ln(c, x + Math.cos(a) * CELL * (.25 + k * .3) * R, y + Math.sin(a) * CELL * (.25 + k * .3) * R, x + Math.cos(a) * CELL * (.38 + k * .35) * R, y + Math.sin(a) * CELL * (.38 + k * .35) * R, i, .5); }
      c.globalAlpha = 1;
    } else if (f.kind === 'boom') {
      const [x, y] = sqXY(f.sq); const R = CELL * 1.5 * (0.3 + k);
      c.globalAlpha = 1 - k; c.fillStyle = 'rgba(232,137,43,0.35)'; c.beginPath(); c.arc(x, y, R * .8, 0, 7); c.fill();
      c.strokeStyle = RED; c.lineWidth = 2.4; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; I.ln(c, x + Math.cos(a) * R * .4, y + Math.sin(a) * R * .4, x + Math.cos(a) * R, y + Math.sin(a) * R, i + 3, 2); }
      c.globalAlpha = 1;
    } else if (f.kind === 'text') {
      const [x, y] = sqXY(f.sq); c.globalAlpha = 1 - k * k;
      c.font = `${Math.round(CELL * .42)}px 'Permanent Marker', 'Patrick Hand', cursive`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.lineWidth = 4; c.strokeStyle = PAPER; c.strokeText(f.str, x, y - CELL * .55 - k * CELL * .5);
      c.fillStyle = f.col === GOLD ? '#9a6f0c' : f.col; c.fillText(f.str, x, y - CELL * .55 - k * CELL * .5); c.globalAlpha = 1;
    } else if (f.kind === 'spell') drawSpellFx(c, f, k);
    else if (f.kind === 'field') {
      c.globalAlpha = Math.sin(k * Math.PI) * .6;
      const col = { quake: K, mirror: BLUE, rewind: '#8a6510', wrap: BLUE, truce: SOFT, double: GOLD, hymn: GOLD, siren: RED }[f.key] || K;
      c.strokeStyle = col; c.lineWidth = 4; I.poly(c, [[PADB, PADB], [PADB + N * CELL, PADB], [PADB + N * CELL, PADB + N * CELL], [PADB, PADB + N * CELL]], 4, 3); c.stroke();
      if (f.key === 'rewind') { c.fillStyle = 'rgba(201,154,28,0.12)'; c.fillRect(PADB, PADB, N * CELL, N * CELL); }
      c.globalAlpha = 1;
    }
  }
  for (let i = anims.length - 1; i >= 0; i--) if (now > anims[i].start + anims[i].dur + 50) anims.splice(i, 1);
  for (let i = fx.length - 1; i >= 0; i--) if (now > fx[i].start + fx[i].dur + 50) fx.splice(i, 1);
}
function drawSpellFx(c, f, k) {
  const [x, y] = f.sq >= 0 ? sqXY(f.sq) : [BS / 2, BS / 2];
  c.globalAlpha = Math.min(1, (1 - k) * 2);
  const key = f.key;
  const burst = (col, R, n = 12) => { c.strokeStyle = col; c.lineWidth = 2.2; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; I.ln(c, x + Math.cos(a) * R * .4, y + Math.sin(a) * R * .4, x + Math.cos(a) * R, y + Math.sin(a) * R, i + k * 3, 2); } };
  if (key === 'freeze') I.snowflake(c, x, y, CELL * (.25 + k * .35), 3);
  else if (['fireball', 'meteor', 'orbital', 'stomp', 'plank'].includes(key)) {
    burst(RED, CELL * (key === 'meteor' ? 1.5 : key === 'orbital' ? 1.1 : .55) * (0.3 + k));
    if (key === 'orbital' && k < .5) { c.fillStyle = 'rgba(179,50,43,0.25)'; c.fillRect(x - CELL * .3, 0, CELL * .6, y); }
    if (key === 'meteor' && k < .4) { c.strokeStyle = K; c.lineWidth = 2; I.circ(c, x - (1 - k / .4) * CELL * 3, y - (1 - k / .4) * CELL * 4, CELL * .25, 1, 1, 10); I.fs(c, K); }
  } else if (key === 'lightning') { if (k < .5) { c.strokeStyle = GOLD; c.lineWidth = 4; c.beginPath(); c.moveTo(x, 0); for (let i = 1; i <= 6; i++) c.lineTo(x + (i < 6 ? (I.hash(i + I.boil) - .5) * CELL : 0), y * i / 6); c.stroke(); } }
  else if (['curse', 'goo'].includes(key)) { c.strokeStyle = GREEN; c.lineWidth = 1.6; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (I.hash(i) - .5) * CELL, y - k * CELL * .8 + I.hash(i + 4) * CELL * .3, 3 + i % 3, 0, 7); c.stroke(); } }
  else if (['teleport', 'lasso', 'shuffle'].includes(key)) { c.strokeStyle = BLUE; c.lineWidth = 2; for (const s of [f.sq, f.sq2]) { if (s == null || s < 0) continue; const [px, py] = sqXY(s); for (let r = 1; r <= 3; r++) { c.beginPath(); c.ellipse(px, py + CELL * .3, CELL * .14 * r * (1 + k), CELL * .05 * r * (1 + k), 0, 0, 7); c.stroke(); } } }
  else if (['mindcontrol', 'mutiny'].includes(key)) { c.strokeStyle = BLUE; c.lineWidth = 2; c.beginPath(); for (let a = 0; a < 14; a += .3) c.lineTo(x + Math.cos(a + k * 8) * a * CELL * .03, y + Math.sin(a + k * 8) * a * CELL * .03); c.stroke(); }
  else if (['shield', 'armor', 'repairs', 'bombvest'].includes(key)) { c.strokeStyle = K; c.lineWidth = 2.4; I.circ(c, x, y, CELL * (.3 + k * .3), 4, 1, 14); c.stroke(); }
  else if (['pit', 'firewall', 'sanctuary', 'mine'].includes(key)) burst(K, CELL * .6 * (0.4 + k), 8);
  else burst(GOLD, CELL * .55 * (0.3 + k), 10);
  c.globalAlpha = 1;
}

// ---- input on the board
function boardPoint(e) { const r = bc.getBoundingClientRect(); return [(e.clientX - r.left) * BS / r.width, (e.clientY - r.top) * BS / r.height]; }
bc.addEventListener('pointermove', e => { hover = sqAt(...boardPoint(e)); });
bc.addEventListener('pointerleave', () => { hover = -1; });
bc.addEventListener('pointerdown', e => {
  unlockAudio();
  if (!humanTurn() || G.lock || G.recycle) return;
  const sq = sqAt(...boardPoint(e)); if (sq < 0) return;
  hover = sq;
  const side = G.turn, hit = currentTargets().find(t => t.sq === sq);
  if (G.pend) {
    if (!hit) { if (G.pend.first != null) { G.pend.first = null; tKey = null; refresh(); } return; }
    if (CARDS[G.pend.key].target.t === 'pair') {
      if (G.pend.first == null) { G.pend.first = sq; tKey = null; refresh(); return; }
      playCard(side, G.pend.idx, { a: G.pend.first, b: sq }); return;
    }
    playCard(side, G.pend.idx, G.pend.opts.find(o => o.a === sq)); return;
  }
  if (hit && hit.m) { playMove(side, hit.m); return; }
  const p = G.board[sq];
  G.sel = p && p.s === side ? (G.sel === sq ? -1 : sq) : -1;
  if (G.sel >= 0 && p.fz > 0) { toast(`That ${U[p.t].name} is frozen`); G.sel = -1; }
  else if (G.sel >= 0) { snd('pick'); I.setEnv(G); if (!I.legalMoves(G.board, side).some(m => m.f === sq)) toast(`That ${U[p.t].name} can't move right now`); }
  tKey = null; refresh();
});
window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#unitsOverlay').hidden) { closeOverlays(); return; }
  if (!$('#packOverlay').hidden) { if (!$('#packDone').hidden) closeOverlays(); return; }
  if (G.recycle) { G.recycle = null; refresh(); return; }
  G.sel = -1; G.pend = null; tKey = null; refresh();
});

// ===================================================================== HTML panels
function cardEl(key, opts = {}) {
  const card = CARDS[key];
  const el = document.createElement(opts.tag || 'div');
  el.className = `card ${card.rarity}` + (opts.cls ? ' ' + opts.cls : '');
  const setName = card.set !== 'classic' ? `<div class="card-set set-${card.set}">${SETS[card.set].name} collab</div>` : '';
  el.innerHTML = `${setName}<div class="card-name">${card.name}</div><canvas class="card-art" aria-hidden="true"></canvas><div class="card-text">${card.text}</div><div class="card-foot"><span>${card.kind === 'unit' ? 'Unit' : card.kind === 'coin' ? 'Coins' : 'Spell'}</span><span class="rar">${RARITY_LABEL[card.rarity]}</span></div>`;
  I.drawCardArt(el.querySelector('canvas'), key);
  return el;
}
function setStatus() {
  const st = $('#status');
  let html = '';
  if (G.over) {
    html = G.over.winner ? `<b>${G.over.why === 'checkmate' ? 'Checkmate.' : ''} ${G.mode === 'ai' ? (G.over.winner === 'w' ? 'You win!' : 'The Ink Baron wins.') : who(G.over.winner) + ' wins!'}</b>` : '<b>Draw.</b>';
    html += ' <button class="btn small" id="stAgain" type="button">Play again</button>';
  } else if (G.mode === 'ai' && G.turn === 'b') html = '<span class="thinking">The Ink Baron is thinking</span>';
  else if (G.lock) html = '…';
  else if (G.recycle) html = 'Recycling: tap cards in your hand to pick them, then scrap them for coins or trade 3 of the same rarity up.';
  else if (G.pend) {
    const card = CARDS[G.pend.key], T = card.target;
    let ins;
    if (T.t === 'none') ins = `Play <b>${card.name}</b>?`;
    else if (T.t === 'pair') ins = G.pend.first == null ? `<b>${card.name}</b>: pick the first piece.` : `<b>${card.name}</b>: now pick the second square.`;
    else if (card.kind === 'unit') ins = `Pick an empty square in your back three rows for your <b>${card.name}</b>.`;
    else ins = `Pick a target for <b>${card.name}</b>.`;
    html = ins + (T.t === 'none' ? ' <button class="btn small" id="stPlay" type="button">Play it</button>' : '') + ' <button class="btn small ghost" id="stCancel" type="button">Cancel</button>';
  } else {
    I.setEnv(G);
    const chk = I.inCheck(G.board, G.turn), name = G.mode === 'ai' ? 'Your' : who(G.turn) + '\'s';
    html = chk ? `<b class="warn">Check!</b> ${name} king is under attack. Move it, block, capture, or play a card that helps.` : `${name} move. Move a piece or play a card.`;
  }
  st.innerHTML = html;
  const again = $('#stAgain'); if (again) again.onclick = openStart;
  const cancel = $('#stCancel'); if (cancel) cancel.onclick = () => { G.pend = null; tKey = null; refresh(); };
  const play = $('#stPlay'); if (play) play.onclick = () => playCard(G.turn, G.pend.idx, G.pend.opts[0]);
}
function renderBar(el, side) {
  const isTurn = G.turn === side && !G.over, hand = G.hand[side].length;
  el.classList.toggle('active', isTurn);
  el.innerHTML = `<span class="who"><span class="dot ${side}"></span>${who(side)}</span><span class="meta"><span class="coin-ico" aria-hidden="true"></span>${G.coins[side]}<span class="sep">·</span>${hand} card${hand === 1 ? '' : 's'}</span>`;
}
function renderFields() {
  const el = $('#fields'), chips = [];
  for (const k in FIELD_INFO) if (G.fields[k] > 0) { const t = Math.ceil(G.fields[k] / 2); chips.push(`<span class="chip"><b>${FIELD_INFO[k][0]}</b>: ${FIELD_INFO[k][1]} · ${t} turn${t === 1 ? '' : 's'} left</span>`); }
  const fires = G.terr.filter(t => t && t.k === 'fire').length;
  if (fires) chips.push(`<span class="chip"><b>Fire</b>: ${fires} square${fires > 1 ? 's' : ''} burning</span>`);
  if (G.mode === 'ai' && G.terr.some(t => t && t.k === 'mine' && t.s === 'b')) chips.push('<span class="chip warn"><b>Careful</b>: the Baron has buried a landmine somewhere</span>');
  el.innerHTML = chips.join('');
  el.hidden = !chips.length;
}
function renderShop() {
  const side = viewer(), myTurn = humanTurn() && !G.lock;
  const shop = $('#shop');
  if (!shop.dataset.built) {
    shop.dataset.built = '1';
    for (const [k, pk] of Object.entries(PACKS)) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pack-btn' + (pk.set !== 'classic' ? ' collab' : ''); b.dataset.pack = k;
      b.title = pk.blurb; b.setAttribute('aria-label', `Buy ${pk.name} pack for ${pk.cost} coins. ${pk.blurb}`);
      b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="pack-label"><b>${pk.name}</b><span class="price"><span class="coin-ico" aria-hidden="true"></span>${pk.cost}</span></span>`;
      I.drawPackArt(b.querySelector('canvas'), 40, 56, k);
      b.addEventListener('click', () => { unlockAudio(); openPackUI(k); });
      shop.appendChild(b);
    }
  }
  shop.querySelectorAll('.pack-btn').forEach(b => { b.disabled = !myTurn || !!G.recycle || G.coins[side] < PACKS[b.dataset.pack].cost; });
  $('#coins').textContent = G.coins[side];
}
function renderHand() {
  const side = viewer(), myTurn = humanTurn() && !G.lock;
  $('#handTitle').textContent = (G.mode === 'ai' ? 'Your hand' : `${who(side)}'s hand`) + ` (${G.hand[side].length}/${I.HAND_MAX})`;
  const rb = $('#btnRecycle'); rb.disabled = !myTurn || (!G.hand[side].length && !G.recycle); rb.textContent = G.recycle ? 'Done recycling' : 'Recycle cards';
  rb.setAttribute('aria-pressed', String(!!G.recycle));
  const hand = $('#hand'), picked = G.recycle ? G.recycle.picked : null;
  const sig = side + ':' + G.hand[side].join(',') + ':' + (G.pend ? G.pend.idx : -1) + ':' + myTurn + ':' + (picked ? [...picked].join('.') : 'x');
  if (hand.dataset.sig !== sig) {
    hand.dataset.sig = sig; hand.innerHTML = '';
    if (!G.hand[side].length) hand.innerHTML = '<p class="empty">No cards yet. Buy a pack from the shop to get units, spells and coins.</p>';
    G.hand[side].forEach((key, idx) => {
      const cls = [(G.pend && G.pend.idx === idx) ? 'selected' : '', picked && picked.has(idx) ? 'picked' : '', picked ? 'recycling' : ''].join(' ').trim();
      const el = cardEl(key, { tag: 'button', cls });
      el.type = 'button'; el.disabled = !myTurn;
      el.setAttribute('aria-label', `${CARDS[key].name}: ${CARDS[key].text}`);
      if (picked) el.setAttribute('aria-pressed', String(picked.has(idx)));
      el.onclick = () => picked ? togglePick(idx) : selectCard(idx);
      hand.appendChild(el);
    });
  }
  const bar = $('#recycleBar');
  bar.hidden = !G.recycle;
  if (G.recycle) {
    const keys = [...picked].map(i => G.hand[side][i]).filter(Boolean);
    const value = keys.reduce((s, k) => s + SCRAP[CARDS[k].rarity], 0);
    const sameR = keys.length === 3 && keys.every(k => CARDS[k].rarity === CARDS[keys[0]].rarity) && CARDS[keys[0]].rarity !== 'legendary';
    const nextR = sameR ? I.RARITIES[I.RARITIES.indexOf(CARDS[keys[0]].rarity) + 1] : null;
    $('#rcScrap').disabled = !keys.length; $('#rcScrap').textContent = keys.length ? `Scrap ${keys.length} for ${value} coin${value === 1 ? '' : 's'}` : 'Scrap for coins';
    $('#rcTrade').disabled = !sameR; $('#rcTrade').textContent = sameR ? `Trade 3 for 1 ${RARITY_LABEL[nextR]}` : 'Trade 3 same rarity up';
  }
}
function refresh() {
  if (!G) return;
  renderBar($('#oppBar'), G.mode === 'ai' ? 'b' : other(G.turn));
  renderBar($('#meBar'), G.mode === 'ai' ? 'w' : G.turn);
  renderFields(); renderShop(); renderHand();
  $('#log').innerHTML = G.log.slice(0, 16).map(l => `<li class="${l.cls}">${l.text}</li>`).join('');
  setStatus();
  tKey = null;
}
function selectCard(idx) {
  if (!humanTurn() || G.lock) return;
  const side = G.turn;
  if (G.pend && G.pend.idx === idx) { G.pend = null; tKey = null; refresh(); return; }
  const key = G.hand[side][idx];
  const opts = I.legalCardOptions(G, side, key);
  I.setEnv(G);
  if (!opts.length) { toast(I.inCheck(G.board, side) ? 'That card can\'t get you out of check' : `No way to play ${CARDS[key].name} right now`); return; }
  G.sel = -1; G.pend = { idx, key, opts, first: null };
  snd('pick'); tKey = null; refresh();
}
function togglePick(idx) { const p = G.recycle.picked; p.has(idx) ? p.delete(idx) : p.add(idx); snd('pick'); refresh(); }
function scrapPicked() {
  const side = viewer(), idxs = [...G.recycle.picked].sort((a, b) => b - a);
  let value = 0; const names = [];
  for (const i of idxs) { const k = G.hand[side].splice(i, 1)[0]; value += SCRAP[CARDS[k].rarity]; names.push(CARDS[k].name); }
  G.coins[side] += value; G.recycle = G.hand[side].length ? { picked: new Set() } : null;
  addLog(`${who(side)} recycled ${names.join(', ')} for ${value} coin${value === 1 ? '' : 's'}.`, 'played');
  snd('coin'); toast(`+${value} coin${value === 1 ? '' : 's'}`); refresh();
}
function tradePicked() {
  const side = viewer(), idxs = [...G.recycle.picked].sort((a, b) => b - a);
  const r = CARDS[G.hand[side][idxs[0]]].rarity;
  const names = idxs.map(i => G.hand[side].splice(i, 1)[0]).map(k => CARDS[k].name);
  const got = I.tradeUp(r);
  G.recycle = null;
  addLog(`${who(side)} traded ${names.join(', ')} up.`, 'played');
  refresh();
  $('#packOverlay').hidden = false; $('#packDone').hidden = true;
  revealCards(side, [got], `Trade-up result`);
}
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }

// ---- pack opening
function openPackUI(packKey) {
  const side = viewer(), pk = PACKS[packKey];
  if (!humanTurn() || G.lock || G.coins[side] < pk.cost) return;
  G.pend = null; G.sel = -1;
  G.coins[side] -= pk.cost;
  const keys = I.rollPack(packKey);
  refresh();
  const ov = $('#packOverlay'), stage = $('#packStage');
  ov.hidden = false; stage.innerHTML = '';
  const pack = document.createElement('button'); pack.type = 'button'; pack.className = 'pack-big'; pack.setAttribute('aria-label', 'Rip the pack open');
  const pc = document.createElement('canvas'); pack.appendChild(pc);
  const w = Math.min(220, window.innerWidth * .55); I.drawPackArt(pc, w, w * 1.4, packKey);
  stage.appendChild(pack);
  $('#packMsg').textContent = `${pk.name}: tap the pack to rip it open.`;
  $('#packDone').hidden = true; snd('pick');
  pack.onclick = () => { pack.classList.add('rip'); snd('rip'); setTimeout(() => revealCards(side, keys, `${who(side)} opened ${pk.name}`), 520); };
  pack.focus();
}
function revealCards(side, keys, title) {
  const stage = $('#packStage'); stage.innerHTML = '';
  const row = document.createElement('div'); row.className = 'reveal-row'; stage.appendChild(row);
  let flipped = 0;
  $('#packMsg').textContent = keys.length > 1 ? 'Tap each card to flip it.' : 'Tap the card to flip it.';
  keys.forEach((key, i) => {
    const wrap = document.createElement('button'); wrap.type = 'button'; wrap.className = 'flip'; wrap.style.animationDelay = (i * 120) + 'ms';
    wrap.setAttribute('aria-label', 'Flip card ' + (i + 1));
    const inner = document.createElement('div'); inner.className = 'flip-inner';
    const back = document.createElement('div'); back.className = 'face back'; const bcv = document.createElement('canvas'); back.appendChild(bcv); I.drawCardBack(bcv);
    const front = document.createElement('div'); front.className = 'face front'; front.appendChild(cardEl(key));
    inner.append(back, front); wrap.appendChild(inner); row.appendChild(wrap);
    wrap.onclick = () => {
      if (wrap.classList.contains('flipped')) return;
      const r = CARDS[key].rarity;
      wrap.classList.add('flipped', 'r-' + r); flipped++;
      snd(r === 'legendary' ? 'legend' : r === 'epic' ? 'epic' : 'flip');
      if (r === 'legendary') { $('#packMsg').textContent = `LEGENDARY! ${CARDS[key].name}!`; const ov = $('#packOverlay'); ov.classList.add('shake'); setTimeout(() => ov.classList.remove('shake'), 600); }
      wrap.setAttribute('aria-label', CARDS[key].name);
      if (flipped === keys.length) finishReveal(side, keys, title);
    };
  });
}
function finishReveal(side, keys, title) {
  let coins = 0, full = 0;
  for (const k of keys) { const before = G.coins[side]; const r = I.addToHand(G, side, k); if (r !== 'kept') { coins += G.coins[side] - before; if (r === 'full') full++; } }
  const legend = keys.some(k => CARDS[k].rarity === 'legendary') ? $('#packMsg').textContent + ' ' : '';
  let msg = legend + (coins ? `+${coins} coins. ` : '') + (keys.some(k => CARDS[k].kind !== 'coin') ? 'Added to your hand.' : '');
  if (full) msg += ` Your hand was full, so ${full} card${full > 1 ? 's were' : ' was'} recycled for coins.`;
  $('#packMsg').textContent = msg;
  addLog(`${title}: ${keys.map(k => CARDS[k].name).join(', ')}.`, 'played');
  const done = $('#packDone'); done.hidden = false; done.focus();
  refresh();
}
function closeOverlays() { $('#packOverlay').hidden = true; $('#unitsOverlay').hidden = true; refresh(); }

// ---- units & cards guide
function buildGuide() {
  const grid = $('#unitsGrid'); if (grid.dataset.built) return; grid.dataset.built = '1';
  const START = ['K', 'Q', 'R', 'B', 'N', 'A', 'P'];
  const groups = [['On the board from the start', START]];
  for (const s of Object.keys(SETS)) {
    const list = Object.values(CARDS).filter(c => c.kind === 'unit' && c.set === s && !START.includes(c.unit)).map(c => c.unit);
    if (list.length) groups.push([s === 'classic' ? 'New units from Classic packs' : `${SETS[s].name} collab units`, [...new Set(list)]]);
  }
  for (const [title, list] of groups) {
    const h = document.createElement('h3'); h.textContent = title; grid.appendChild(h);
    const wrap = document.createElement('div'); wrap.className = 'unit-list'; grid.appendChild(wrap);
    for (const t of list) {
      const u = U[t], card = Object.values(CARDS).find(c => c.unit === t);
      const el = document.createElement('article'); el.className = 'unit';
      el.innerHTML = `<div class="unit-pics"><canvas class="u-art"></canvas><canvas class="u-diag"></canvas></div><div class="unit-body"><h4>${u.name} <span class="val">${t === 'K' ? 'priceless' : 'worth ' + u.val}</span></h4><p>${u.rules}</p>${card ? `<p class="from">In packs: <span class="rar-${card.rarity}">${RARITY_LABEL[card.rarity]}</span></p>` : ''}</div>`;
      I.drawUnitArt(el.querySelector('.u-art'), t, 84); I.drawMoveDiagram(el.querySelector('.u-diag'), t);
      wrap.appendChild(el);
    }
  }
  for (const s of Object.keys(SETS)) {
    const list = Object.values(CARDS).filter(c => c.kind !== 'unit' && c.set === s);
    const h = document.createElement('h3'); h.textContent = s === 'classic' ? 'Classic spells and coins' : `${SETS[s].name} spells and coins`; grid.appendChild(h);
    const sp = document.createElement('div'); sp.className = 'spell-list'; grid.appendChild(sp);
    for (const c of list) sp.appendChild(cardEl(c.key, { cls: 'mini' }));
  }
}
function openStart() { $('#startOverlay').hidden = false; $('#startAi').focus(); }

// ===================================================================== audio
let AC = null, muted = false, noiseBuf = null;
function unlockAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); noiseBuf = AC.createBuffer(1, AC.sampleRate * .6, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; }
}
function snd(type) {
  if (!AC || muted) return;
  const now = AC.currentTime;
  const tone = (wave, f1, f2, dur, vol, at = 0) => { const g = AC.createGain(), o = AC.createOscillator(); o.type = wave; o.frequency.setValueAtTime(f1, now + at); o.frequency.exponentialRampToValueAtTime(f2, now + at + dur); g.gain.setValueAtTime(0.0001, now); g.gain.setValueAtTime(vol, now + at); g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur); o.connect(g); g.connect(AC.destination); o.start(now + at); o.stop(now + at + dur + .02); };
  const noise = (dur, vol, freq, at = 0, type = 'lowpass') => { const g = AC.createGain(), n = AC.createBufferSource(), f = AC.createBiquadFilter(); n.buffer = noiseBuf; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, now + at); g.gain.exponentialRampToValueAtTime(0.0001, now + at + dur); n.connect(f); f.connect(g); g.connect(AC.destination); n.start(now + at); n.stop(now + at + dur); };
  switch (type) {
    case 'tap': noise(.06, .25, 900); tone('sine', 180, 120, .08, .06); break;
    case 'pick': tone('triangle', 500, 640, .06, .04); break;
    case 'hit': noise(.12, .3, 1400); tone('square', 120, 60, .12, .04); break;
    case 'clang': tone('square', 900, 700, .15, .04); tone('triangle', 1400, 1100, .2, .04); break;
    case 'twang': tone('triangle', 800, 240, .12, .06); break;
    case 'boom': noise(.6, .45, 300); tone('sine', 90, 40, .5, .1); break;
    case 'jet': noise(.7, .18, 2400, 0, 'bandpass'); tone('sawtooth', 300, 900, .6, .02); break;
    case 'summon': tone('sine', 440, 660, .15, .05); tone('sine', 660, 880, .15, .05, .1); break;
    case 'spell': tone('sine', 700, 1400, .3, .05); tone('triangle', 350, 700, .3, .03, .05); break;
    case 'freeze': tone('sine', 1800, 1200, .4, .04); tone('sine', 2400, 1600, .3, .03, .08); break;
    case 'coin': tone('sine', 1300, 1900, .1, .06); tone('sine', 1700, 2400, .1, .05, .08); break;
    case 'rip': noise(.35, .25, 3000, 0, 'highpass'); break;
    case 'flip': noise(.08, .15, 2000); break;
    case 'epic': tone('triangle', 523, 523, .2, .05); tone('triangle', 784, 784, .3, .05, .12); break;
    case 'legend': [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, .35, .06, i * .1)); noise(.6, .08, 5000, .3, 'highpass'); break;
    case 'check': tone('square', 330, 330, .1, .03); tone('square', 330, 330, .1, .03, .15); break;
    case 'win': [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, .4, .06, i * .14)); break;
  }
}

// ===================================================================== wiring
$('#packDone').addEventListener('click', closeOverlays);
const openGuide = () => { buildGuide(); $('#unitsOverlay').hidden = false; $('#unitsClose').focus(); };
$('#btnUnits').addEventListener('click', openGuide);
$('#startUnits').addEventListener('click', openGuide);
$('#unitsClose').addEventListener('click', () => { $('#unitsOverlay').hidden = true; });
$('#btnNew').addEventListener('click', openStart);
$('#btnMute').addEventListener('click', () => { muted = !muted; $('#btnMute').textContent = muted ? 'Sound off' : 'Sound on'; $('#btnMute').setAttribute('aria-pressed', String(!muted)); });
$('#startAi').addEventListener('click', () => { unlockAudio(); $('#startOverlay').hidden = true; newGame('ai'); });
$('#startPvp').addEventListener('click', () => { unlockAudio(); $('#startOverlay').hidden = true; newGame('pvp'); });
$('#btnRecycle').addEventListener('click', () => { if (!humanTurn() || G.lock) return; G.recycle = G.recycle ? null : { picked: new Set() }; G.pend = null; G.sel = -1; refresh(); });
$('#rcScrap').addEventListener('click', scrapPicked);
$('#rcTrade').addEventListener('click', tradePicked);
for (const ov of ['#packOverlay', '#unitsOverlay']) $(ov).addEventListener('pointerdown', e => { if (e.target === $(ov) && (ov === '#unitsOverlay' || !$('#packDone').hidden)) closeOverlays(); });

window.__inkmate = { get G() { return G; }, playMove, playCard, newGame, refresh, I };
window.addEventListener('resize', sizeBoard);
sizeBoard();
newGame('ai');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildLayer(); $('#hand').dataset.sig = ''; document.querySelectorAll('#shop .pack-btn').forEach(b => I.drawPackArt(b.querySelector('canvas'), 40, 56, b.dataset.pack)); refresh(); });
let lastBoil = 0;
function loop(now) { if (now - lastBoil > 150) { I.boil = (I.boil + 1) % 4; lastBoil = now; } drawBoard(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
})();
