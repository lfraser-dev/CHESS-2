/* Inkmate game screen: board rendering, turns, card effects, shop, recycling, pack opening, the Ink Baron. */
(() => {
'use strict';
const I = window.INK;
const { N, U, CARDS, PACKS, SETS, RARITY_LABEL, SCRAP, other, rc, inB } = I;
const { INK: K, PAPER, RED, GOLD, BLUE, SOFT, GREEN } = I.COL;
const $ = s => document.querySelector(s);
const FILES = 'abcdefghij';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const lerp = (a, b, k) => a + (b - a) * k;

let G = null;
const NAMES = { ai: { w: 'You', b: 'The Ink Baron' }, pvp: { w: 'Paper', b: 'Ink' } };
const who = s => NAMES[G.mode][s];
const colName = c => c < 26 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[c] : 'A' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[c - 26];
const sqName = i => { const [r, c] = rc(i); return colName(c) + (N - r); };
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
  if (sizeBoard.done) { cam.cell = MINZOOM(); clampCam(); }
  snap();
  addLog(mode === 'ai' ? 'New game against the Ink Baron. You play Paper and move first.' : 'New game. Paper moves first.');
  refresh();
}
function addLog(text, cls = '') { G.log.unshift({ text, cls }); if (G.log.length > 50) G.log.pop(); }

// ===================================================================== effects & turn flow
function evToFx(ev, cardKey) {
  const lines = [];
  for (const e of ev) {
    if (e.type === 'destroy') { const a = Math.random() * Math.PI * 2; addFx({ kind: 'fling', p: e.p, sq: e.sq, dir: [Math.cos(a), Math.sin(a) - .6], delay: 300, dur: 850, s: e.sq }); addFx({ kind: 'impact', sq: e.sq, delay: 280, dur: 320 }); addFx({ kind: 'splat', sq: e.sq, delay: 300, dur: 9000, s: e.sq * 7 }); }
    else if (e.type === 'summon') addFx({ kind: 'summon', sq: e.sq, dur: e.big ? 900 : 700, big: e.big });
    else if (e.type === 'spell') { if (!(e.hidden && G.mode === 'ai' && G.turn === 'b')) addFx({ kind: 'spell', key: cardKey, sq: e.sq, sq2: e.sq2, dur: 900 }); }
    else if (e.type === 'shell') { addFx({ kind: 'boom', sq: e.sq, delay: Math.random() * 500, dur: 700 }); shakeT = performance.now() + 900; }
    else if (e.type === 'nuke') { addFx({ kind: 'boom', sq: e.sq, dur: 1400, big: true }); addFx({ kind: 'mushroom', sq: e.sq, dur: 3200 }); }
    else if (e.type === 'field') { addFx({ kind: 'field', key: e.key, dur: 1100 }); if (e.key === 'quake' || e.key === 'mirror') shakeT = performance.now() + 600; }
    else if (e.type === 'msg') lines.push(e.text);
    else if (e.type === 'coins') lines.push(`+${e.n} coins`);
  }
  return lines;
}
function killReal(sq, delay = 300) {
  const p = G.board[sq]; if (!p || p.t === 'K') return null;
  G.board[sq] = null; G.grave[p.s].push(p.t);
  const a = Math.random() * Math.PI * 2;
  addFx({ kind: 'fling', p, sq, dir: [Math.cos(a), Math.sin(a) - .6], delay, dur: 850, s: sq }); addFx({ kind: 'splat', sq, delay, dur: 9000, s: sq * 3 + 1 });
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
  for (const r of I.homeRows(p.s)) for (const c of I.CENTRE_COLS) {
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

function battleCamMode() { try { return localStorage.getItem('inkmate.battlecam') || 'big'; } catch (e) { return 'big'; } }
function wantsBattleCam(mover, cap, m) {
  const mode = battleCamMode();
  if (mode === 'off' || !cap || m.sw || !I.Battle) return false;
  if (mode === 'all') return true;
  return U[cap.t].val >= 3 || U[mover.t].val >= 6 || !!cap.bomb || !!cap.bounty || (m.arm && U[mover.t].val >= 5);
}
async function playMove(side, m) {
  G.lock = true; G.sel = -1; I.setEnv(G);
  const mover = G.board[m.f], cap = m.cap, mu = U[mover.t];
  const rangedHit = !!(m.r || (m.arm && isShooter(mover.t) && !(mu.sl || mu.leap)));
  if (wantsBattleCam(mover, cap, m)) {
    focusOn(m.t); refresh();
    let est = U[cap.t].val ? Math.max(1, Math.ceil(U[cap.t].val / 2)) : 0;
    if (cap.bounty) est += 5; if (U[cap.t].cow) est += 4; if (mu.plunder) est += mu.plunder;
    await I.Battle.play($('#duel'), { att: mover, def: cap, armour: !!m.arm, ranged: rangedHit, gain: m.arm ? 0 : est, snd, names: NAMES[G.mode] });
  }
  const swapped = m.sw ? G.board[m.t] : null;
  I.makeMove(G.board, m);
  G.last = { f: m.f, t: m.t };
  focusOn(m.t);
  const name = mu.name;
  let line = `${who(side)}: ${name} ${sqName(m.f)} `;
  if (m.sw) {
    addAnim({ kind: 'move', p: mover, f: m.f, t: m.t, dur: 320, fly: true }); addAnim({ kind: 'move', p: swapped, f: m.t, t: m.f, dur: 320, fly: true });
    line += `swaps places with the ${U[swapped.t].name} on ${sqName(m.t)}`; snd('spell');
  } else if (rangedHit) {
    const stl = I.Battle ? I.Battle.style(mover.t, true).kind : 'arrow';
    const proj = { lob: 'rock', shell: 'shell', grab: 'grab', hex: 'hex', flame: 'flame', scream: 'scream', shot: 'bullet', strike: 'dagger' }[stl] || 'arrow';
    addAnim({ kind: 'shot', f: m.f, t: m.t, dur: proj === 'bullet' ? 220 : 420, proj });
    addFx({ kind: 'muzzle', sq: m.f, to: m.t, dur: 160, proj });
    addFx({ kind: 'impact', sq: m.t, from: m.f, delay: proj === 'bullet' ? 200 : 400, dur: 380, big: proj === 'rock' || proj === 'shell' });
    snd(proj === 'rock' || proj === 'shell' ? 'boom' : proj === 'grab' ? 'hit' : 'twang');
    line += `${proj === 'grab' ? 'grabs' : 'shoots'} ${sqName(m.t)}`;
  } else if (m.arm) {
    addAnim({ kind: 'lunge', p: mover, f: m.f, t: m.t, dur: 460, back: true }); snd('whoosh');
    addFx({ kind: 'impact', sq: m.t, from: m.f, delay: 270, dur: 380 });
    line += `attacks ${sqName(m.t)}`;
  } else if (cap) {
    addAnim({ kind: 'lunge', p: G.board[m.t], f: m.f, t: m.t, dur: 460, fly: !!(mu.fly || mu.leap) });
    addFx({ kind: 'impact', sq: m.t, from: m.f, delay: 270, dur: 380 });
    snd('whoosh');
    line += `→ ${sqName(m.t)}`;
  } else {
    const far = Math.abs(m.t - m.f) > 3 * N || Math.abs((m.t % N) - (m.f % N)) > 3;
    addAnim({ kind: 'move', p: G.board[m.t], f: m.f, t: m.t, dur: mover.t === 'J' || far ? 480 : 260, fly: !!(mu.fly || mu.leap), jet: mover.t === 'J' });
    snd(mover.t === 'J' ? 'jet' : 'tap');
    line += `→ ${sqName(m.t)}`;
  }
  if (m.arm) { line += `, cracking its armour`; addFx({ kind: 'text', sq: m.t, str: 'clang!', col: K, delay: 250, dur: 1000 }); setTimeout(() => snd('clang'), 250); }
  if (cap && !m.arm && !m.sw) {
    G.grave[cap.s].push(cap.t);
    { const [fr, fc] = rc(m.f), [tr, tc] = rc(m.t), d = Math.hypot(tr - fr, tc - fc) || 1;
      addFx({ kind: 'fling', p: cap, sq: m.t, dir: [(tc - fc) / d, (tr - fr) / d], delay: m.r ? 400 : 270, dur: 820, s: Math.random() * 99 }); }
    addFx({ kind: 'splat', sq: m.t, delay: m.r ? 400 : 270, dur: 9000, s: Math.random() * 99 });
    setTimeout(() => snd('hit'), m.r ? 400 : 270);
    let gain = U[cap.t].val ? Math.max(1, Math.ceil(U[cap.t].val / 2)) : 0;
    const extras = [];
    if (cap.bounty) { gain += 5; extras.push('claims the bounty'); }
    if (U[cap.t].cow) { gain += 4; extras.push('sells the cow for 4 coins'); }
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
    if (cap.t === 'duck' || U[cap.t].squeak) { const at = m.r ? m.f : m.t; const mv = G.board[at]; if (mv && mv.t !== 'K') { G.board[at] = { ...mv, fz: 2 }; line += '. SQUEAK! The attacker is stunned'; addFx({ kind: 'text', sq: at, str: 'SQUEAK!', col: RED, delay: 300, dur: 1100 }); } }
    if (mu.ignite && m.r && !G.terr[m.t]) { G.terr[m.t] = { k: 'fire', n: 4 }; line += ', leaving it in flames'; }
    if (mu.drain && !m.r && G.board[m.t] === mover) { G.board[m.t] = { ...mover, ar: mover.ar + 1 }; line += ', and drinks up 1 armour'; }
    if (mu.abduct && !m.r && !G.board[m.f]) { G.board[m.f] = I.mkPiece('cow', cap.s); addFx({ kind: 'summon', sq: m.f, delay: 250, dur: 700 }); line += ' and beams it up, leaving a cow behind'; }
    if (mu.split && !m.r && !G.board[m.f]) { G.board[m.f] = I.mkPiece('blob', side); addFx({ kind: 'summon', sq: m.f, delay: 200, dur: 700 }); line += ', and splits in two'; }
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
    const t2 = G.terr[m.t], lp = G.board[m.t];
    if (lp && t2 && t2.k === 'banana') {
      G.terr[m.t] = null;
      if (lp.t !== 'K') { G.board[m.t] = { ...lp, fz: 2 }; line += `. It slips on a banana peel and is stuck for a turn`; }
      else line += '. The king wobbles on a banana peel';
      addFx({ kind: 'text', sq: m.t, str: 'whoops!', col: '#8a6510', delay: 250, dur: 1100 });
    }
    if (lp && t2 && t2.k === 'rad' && lp.t !== 'K' && !lp.curse && G.board[m.t]) { G.board[m.t] = { ...G.board[m.t], curse: 2 }; line += '. It glows a bit. Cursed by radiation'; }
    if (lp && lp.t === 'pigeon') {
      const near = I.area(m.t).some(j => j !== m.t && G.board[j] && G.board[j].s !== side);
      if (near && G.coins[other(side)] > 0) { G.coins[other(side)]--; G.coins[side]++; line += ', and nicks a coin'; addFx({ kind: 'text', sq: m.t, str: '+1', col: GOLD, delay: 250, dur: 1000 }); }
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
  if (o && o.a >= 0) focusOn(o.a);
  if (sim && key === 'nuke') { refresh(); await nukeCutscene(); shakeT = performance.now() + 1400; }
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
  for (let i = 0; i < N * N; i++) {
    const pc = G.board[i]; if (!pc || pc.s !== side) continue;
    if (U[pc.t].medic) for (const j of I.area(i)) { const q = G.board[j]; if (j !== i && q && q.s === side && (q.fz > 0 || q.curse)) { G.board[j] = { ...q, fz: 0, curse: 0 }; notes.push(`The Field Medic patches up a ${U[q.t].name}`); } }
    if (U[pc.t].raise && G.grave[side].length) {
      const spot = I.area(i).find(j => !G.board[j] && !(G.terr[j] && (G.terr[j].k === 'pit' || G.terr[j].k === 'fire')));
      if (spot != null) { G.grave[side].pop(); G.board[spot] = I.mkPiece('skeleton', side); addFx({ kind: 'summon', sq: spot, dur: 800 }); notes.push('A Skeleton claws its way out of the ground'); }
    }
  }
  for (let i = 0; i < N * N; i++) {
    const pg = G.board[i]; if (!pg || pg.s !== side || !U[pg.t].scream) continue;
    const [r, c] = rc(i); let hits = 0;
    for (const [dr, dc] of I.DIR8) {
      const r1 = r + dr, c1 = c + dc; if (!inB(r1, c1)) continue;
      const j = r1 * N + c1, q = G.board[j];
      if (!q || q.s === side || q.t === 'K' || U[q.t].untouchable || q.sh > 0) continue;
      hits++;
      const r2 = r1 + dr, c2 = c1 + dc, k = r2 * N + c2;
      const tk = inB(r2, c2) ? G.terr[k] : null;
      if (inB(r2, c2) && !G.board[k] && !(tk && (tk.k === 'pit' || tk.k === 'fire'))) { G.board[k] = q; G.board[j] = null; addAnim({ kind: 'move', p: q, f: j, t: k, dur: 300 }); }
      else killReal(j, 200);
    }
    addFx({ kind: 'scream', sq: i, dur: 900 });
    if (hits) { notes.push(`The Screaming Pagoda SCREAMS at ${hits} enem${hits === 1 ? 'y' : 'ies'}`); shakeT = performance.now() + 500; snd('scream'); }
  }
  for (let i = 0; i < N * N; i++) { const t = G.terr[i]; if (t && (t.k === 'fire' || t.k === 'rad')) { const n = t.n - 1; G.terr[i] = n > 0 ? { ...t, n } : null; } }
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
    const income = G.board.reduce((n, p) => n + (p && p.s === G.turn && U[p.t].income ? U[p.t].income : 0), 0);
    if (income) { G.coins[G.turn] += income; addLog(`Geese and vending machines pay ${who(G.turn)} ${income} coins.`, 'played'); }
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
      addLog(`The Ink Baron opened an ${PACKS[pk].name}${cash ? ' and pocketed some coins' : ''}.`, 'played');
      toast(`The Ink Baron opened an ${PACKS[pk].name}`); snd('rip'); refresh();
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
let BS = 600, CELL = 30, DPR = 1, hover = -1, shakeT = 0;
// camera: (x, y) is the board coordinate at the top-left of the view, cell is pixels per square
const cam = { x: 13.5, y: 13.5, cell: 30, tx: null, ty: null };
function sizeBoard() {
  const wrap = $('#boardWrap');
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  const wide = window.innerWidth >= 900;
  const oldBS = BS;
  BS = Math.floor(Math.max(280, Math.min(wrap.clientWidth, wide ? window.innerHeight - 170 : 9999, 900)));
  bc.style.width = BS + 'px'; bc.style.height = BS + 'px';
  { const d = $('#duel'); if (d) { d.style.width = BS + 'px'; d.style.height = BS + 'px'; } }
  bc.width = BS * DPR; bc.height = BS * DPR;
  if (!sizeBoard.done) { cam.cell = BS / (N + .4); cam.x = -.2; cam.y = -.2; sizeBoard.done = true; }
  else { const cx = cam.x + oldBS / cam.cell / 2, cy = cam.y + oldBS / cam.cell / 2; cam.cell *= BS / oldBS; cam.x = cx - BS / cam.cell / 2; cam.y = cy - BS / cam.cell / 2; }
  clampCam();
}
function buildLayer() { /* the board is drawn live now */ }
const MINZOOM = () => BS / (N + .4), MAXZOOM = () => BS / 5;
function clampCam() {
  cam.cell = Math.max(MINZOOM(), Math.min(MAXZOOM(), cam.cell));
  const vis = BS / cam.cell;
  cam.x = Math.max(-.2, Math.min(N + .2 - vis, cam.x)); cam.y = Math.max(-.2, Math.min(N + .2 - vis, cam.y));
  if (vis > N - .01) { cam.x = (N - vis) / 2; cam.y = (N - vis) / 2; }
}
function zoomAt(px, py, f) {
  const bx = px / cam.cell + cam.x, by = py / cam.cell + cam.y;
  cam.cell *= f; clampCam();
  cam.x = bx - px / cam.cell; cam.y = by - py / cam.cell; cam.tx = null; clampCam();
}
function centreOn(r, c, smooth = true) {
  const vis = BS / cam.cell, x = c + .5 - vis / 2, y = r + .5 - vis / 2;
  if (smooth) { cam.tx = x; cam.ty = y; } else { cam.x = x; cam.y = y; clampCam(); }
}
function focusOn(sq) {
  if (sq == null || sq < 0) return;
  const [r, c] = rc(sq), vis = BS / cam.cell;
  if (c < cam.x + 1.5 || c > cam.x + vis - 2.5 || r < cam.y + 1.5 || r > cam.y + vis - 2.5) centreOn(r, c);
}
const sqXY = sq => { const [r, c] = rc(sq); return [(c - cam.x + .5) * cam.cell, (r - cam.y + .5) * cam.cell]; };
function sqAt(px, py) { const c = Math.floor(px / cam.cell + cam.x), r = Math.floor(py / cam.cell + cam.y); return inB(r, c) ? r * N + c : -1; }
const boardRect = () => [-cam.x * cam.cell, -cam.y * cam.cell, (N - cam.x) * cam.cell, (N - cam.y) * cam.cell];
const miniBox = () => { const m = Math.round(Math.min(130, BS * .24)); return [BS - m - 8, 8, m]; };
function visibleRange() {
  const vis = BS / cam.cell;
  return [Math.max(0, Math.floor(cam.y)), Math.min(N - 1, Math.ceil(cam.y + vis)), Math.max(0, Math.floor(cam.x)), Math.min(N - 1, Math.ceil(cam.x + vis))];
}
function drawGrid(c) {
  const [r0, r1, c0, c1] = visibleRange(), cell = cam.cell;
  c.fillStyle = 'rgba(242,238,226,0.9)'; const [bx0, by0, bx1, by1] = boardRect(); c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  // dark squares
  if (cell >= 14) {
    c.strokeStyle = 'rgba(30,28,36,0.17)'; c.lineWidth = 1; c.beginPath();
    const gap = Math.max(4, cell / 7);
    for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) {
      if ((r + col) % 2 === 0) continue;
      const x = (col - cam.x) * cell, y = (r - cam.y) * cell;
      for (let k = gap / 2; k < cell * 2; k += gap) {
        const ax = x + Math.max(0, k - cell), ay = y + Math.min(cell, k), bx = x + Math.min(cell, k), by = y + Math.max(0, k - cell);
        c.moveTo(ax + 1, ay - 1); c.lineTo(bx - 1, by + 1);
      }
    }
    c.stroke();
  } else {
    c.fillStyle = 'rgba(30,28,36,0.07)';
    for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) if ((r + col) % 2) c.fillRect((col - cam.x) * cell, (r - cam.y) * cell, cell, cell);
  }
  // halfway line and starting zones
  c.strokeStyle = 'rgba(179,50,43,0.25)'; c.lineWidth = 2; c.setLineDash([8, 8]);
  c.beginPath(); c.moveTo(bx0, (N / 2 - cam.y) * cell); c.lineTo(bx1, (N / 2 - cam.y) * cell); c.stroke(); c.setLineDash([]);
  // grid lines
  c.strokeStyle = cell >= 14 ? 'rgba(30,28,36,0.75)' : 'rgba(30,28,36,0.35)'; c.lineWidth = Math.max(.6, Math.min(1.6, cell / 30));
  c.beginPath();
  for (let r = r0; r <= r1 + 1; r++) { const y = (r - cam.y) * cell + (I.hash(r) - .5) * .8; c.moveTo((c0 - cam.x) * cell, y); c.lineTo((c1 + 1 - cam.x) * cell, y + (I.hash(r + 7) - .5)); }
  for (let col = c0; col <= c1 + 1; col++) { const x = (col - cam.x) * cell + (I.hash(col + 3) - .5) * .8; c.moveTo(x, (r0 - cam.y) * cell); c.lineTo(x + (I.hash(col + 9) - .5), (r1 + 1 - cam.y) * cell); }
  c.stroke();
  c.strokeStyle = K; c.lineWidth = 3; c.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
  // coordinates along the top and left edges of the view
  if (cell >= 16) {
    c.fillStyle = SOFT; c.font = `${Math.round(Math.min(13, cell * .32))}px 'Patrick Hand', cursive`; c.textAlign = 'left'; c.textBaseline = 'top';
    for (let col = c0; col <= c1; col++) if (col % 2 === 0) c.fillText(colName(col), (col - cam.x) * cell + 2, Math.max(by0, 0) + 1);
    c.textBaseline = 'bottom';
    for (let r = r0; r <= r1; r++) if (r % 2 === 0) c.fillText(String(N - r), Math.max(bx0, 0) + 2, (r + 1 - cam.y) * cell - 1);
  }
}
function drawMinimap(c) {
  const [mx, my, m] = miniBox(), k = m / N;
  c.fillStyle = 'rgba(242,238,226,0.94)'; c.fillRect(mx, my, m, m);
  c.strokeStyle = K; c.lineWidth = 1.5; c.strokeRect(mx, my, m, m);
  c.fillStyle = 'rgba(179,50,43,0.2)'; c.fillRect(mx, my + m / 2 - .5, m, 1);
  for (let i = 0; i < N * N; i++) {
    const t = G.terr[i]; if (t && (t.k === 'pit' || t.k === 'rad' || t.k === 'fire')) { const [r, col] = rc(i); c.fillStyle = t.k === 'rad' ? 'rgba(111,143,58,.5)' : t.k === 'fire' ? 'rgba(232,137,43,.7)' : K; c.fillRect(mx + col * k, my + r * k, k, k); }
    const p = G.board[i]; if (!p) continue;
    const [r, col] = rc(i), big = p.t === 'K' ? 2.2 : 1;
    c.fillStyle = p.s === 'w' ? GOLD : K;
    c.fillRect(mx + col * k - (big - 1) * k / 2, my + r * k - (big - 1) * k / 2, k * big + .4, k * big + .4);
  }
  const vis = BS / cam.cell;
  c.strokeStyle = RED; c.lineWidth = 1.5; c.strokeRect(mx + Math.max(0, cam.x) * k, my + Math.max(0, cam.y) * k, Math.min(N, vis) * k, Math.min(N, vis) * k);
}
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
  if (cam.tx != null) { cam.x += (cam.tx - cam.x) * .15; cam.y += (cam.ty - cam.y) * .15; if (Math.abs(cam.tx - cam.x) < .02 && Math.abs(cam.ty - cam.y) < .02) { cam.x = cam.tx; cam.y = cam.ty; cam.tx = null; } clampCam(); }
  CELL = cam.cell;
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, bc.width, bc.height);
  let sx = 0, sy = 0;
  if (now < shakeT) { sx = (Math.random() - .5) * 8 * DPR; sy = (Math.random() - .5) * 6 * DPR; }
  for (const f of fx) if (f.kind === 'impact' && now >= f.start && now < f.start + 200) { const a = (1 - (now - f.start) / 200) * (f.big ? 9 : 5) * DPR; sx += (Math.random() - .5) * a; sy += (Math.random() - .5) * a; }
  c.setTransform(DPR, 0, 0, DPR, sx, sy);
  c.lineCap = 'round'; c.lineJoin = 'round';
  if (!G) return;
  drawGrid(c);
  const [vr0, vr1, vc0, vc1] = visibleRange();
  const visible = sq => { const [r, cc] = rc(sq); return r >= vr0 - 1 && r <= vr1 + 1 && cc >= vc0 - 1 && cc <= vc1 + 1; };
  if (G.fields.wrap > 0) {
    const [bx0, by0, bx1, by1] = boardRect();
    c.strokeStyle = BLUE; c.lineWidth = 2; c.setLineDash([5, 5]);
    for (const x of [bx0 - 3, bx1 + 3]) { c.beginPath(); c.moveTo(x, by0); c.lineTo(x, by1); c.stroke(); }
    c.setLineDash([]);
  }
  const showMine = s => G.mode === 'pvp' || s === 'w';
  for (let i = 0; i < N * N; i++) { const t = G.terr[i]; if (!t || !visible(i)) continue; const [x, y] = sqXY(i); I.drawTerrain(c, t, x, y, CELL, i, t.k !== 'mine' || showMine(t.s)); }
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
  const moving = new Set(anims.filter(a => (a.kind === 'move' || a.kind === 'bump' || a.kind === 'lunge') && now < a.start + a.dur).map(a => a.p));
  for (let r = vr0; r <= vr1; r++) for (let cc = vc0; cc <= vc1; cc++) {
    const sq = r * N + cc;
    const p = G.board[sq]; if (!p || moving.has(p)) continue;
    const [x, y] = sqXY(sq);
    let alpha = 1;
    const sm = fx.find(f => f.kind === 'summon' && f.sq === sq && now < f.start + f.dur);
    if (sm) alpha = now < sm.start ? 0 : Math.min(1, (now - sm.start) / (sm.dur * 0.6));
    I.drawPiece(c, p.t, p.s, x, y, CELL * .82, p.id * 3.7, alpha);
    I.drawBadges(c, p, x, y, CELL);
  }
  for (const f of fx) {
    if (f.kind !== 'fling' || now > f.start + f.dur) continue;
    const [x, y] = sqXY(f.sq);
    if (now < f.start) { I.drawPiece(c, f.p.t, f.p.s, x, y, CELL * .82, f.p.id * 3.7); continue; }
    const k = (now - f.start) / f.dur, e = 1 - Math.pow(1 - k, 2.2);
    const px = x + f.dir[0] * CELL * 1.7 * e, py = y + f.dir[1] * CELL * 1.2 * e - Math.sin(Math.min(1, k * 1.5) * Math.PI) * CELL * .9 + k * k * CELL * .4;
    // ink droplets thrown off the hit
    c.fillStyle = f.p.s === 'w' ? K : RED;
    for (let i = 0; i < 9; i++) {
      const a = Math.atan2(f.dir[1], f.dir[0]) + (I.hash(f.s + i) - .5) * 2.2, sp = .6 + I.hash(f.s + i + 5) * 1.6;
      const dx = Math.cos(a) * CELL * sp * e, dy = Math.sin(a) * CELL * sp * e - Math.sin(Math.min(1, k * 1.8) * Math.PI) * CELL * .5 + k * k * CELL * .6;
      c.globalAlpha = Math.max(0, 1 - k * 1.2); c.beginPath(); c.arc(x + dx, y + dy, CELL * (.025 + .03 * I.hash(f.s + i + 9)) * (1 - k * .5), 0, 7); c.fill();
    }
    c.globalAlpha = 1;
    c.save(); c.translate(px, py); c.rotate((f.dir[0] >= 0 ? 1 : -1) * e * 4.5);
    I.drawPiece(c, f.p.t, f.p.s, 0, 0, CELL * .82 * (1 - k * .15), f.p.id * 3.7, Math.max(0, 1 - Math.max(0, k - .55) / .45));
    if (k > .02) { c.strokeStyle = f.p.s === 'b' ? '#ffe2a8' : K; c.lineWidth = Math.max(1, CELL / 30); c.globalAlpha = Math.max(0, 1 - Math.max(0, k - .55) / .45);
      for (let j = 0; j < 3; j++) { let qx = (I.hash(f.s + j) - .5) * CELL * .25, qy = -CELL * (.1 + .25 * I.hash(f.s + j + 3)); c.beginPath(); c.moveTo(qx, qy); for (let z = 0; z < 3; z++) { qx += (I.hash(f.s + j * 7 + z) - .5) * CELL * .18; qy += CELL * .07; c.lineTo(qx, qy); } c.stroke(); } }
    c.restore(); c.globalAlpha = 1;
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
    } else if (a.kind === 'lunge') {
      // wind up, dash in with a trail, then settle (or bounce back off armour)
      const raw = (now - a.start) / a.dur, dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      let px, py, rot = 0, sc = 1;
      const hit = a.back ? .9 : 1;
      if (raw < .35) { const q = raw / .35, e = 1 - Math.pow(1 - q, 2); px = x1 - ux * CELL * .2 * e; py = y1 - uy * CELL * .2 * e; rot = -ux * .18 * e; sc = 1 - .08 * e; }
      else if (raw < .6) { const q = (raw - .35) / .25, e = q * q * q; px = lerp(x1 - ux * CELL * .2, x1 + dx * hit, e); py = lerp(y1 - uy * CELL * .2, y1 + dy * hit, e) - (a.fly ? Math.sin(q * Math.PI) * CELL * .4 : 0); rot = ux * .12; sc = 1.08;
        for (let g = 1; g <= 3; g++) { const qq = Math.max(0, e - g * .12); I.drawPiece(c, a.p.t, a.p.s, lerp(x1, x1 + dx * hit, qq), lerp(y1, y1 + dy * hit, qq), CELL * .82, a.p.id * 3.7, .22 / g); }
        c.strokeStyle = 'rgba(30,28,36,.45)'; c.lineWidth = 1.5; for (let i = -1; i <= 1; i++) { const ox = -uy * i * CELL * .18, oy = ux * i * CELL * .18; c.beginPath(); c.moveTo(px - ux * CELL * .9 + ox, py - uy * CELL * .9 + oy); c.lineTo(px - ux * CELL * .35 + ox, py - uy * CELL * .35 + oy); c.stroke(); } }
      else { const q = (raw - .6) / .4, e = 1 - Math.pow(1 - q, 3);
        if (a.back) { px = lerp(x1 + dx * hit, x1, e); py = lerp(y1 + dy * hit, y1, e) - Math.sin(q * Math.PI) * CELL * .15; }
        else { const over = Math.sin(q * Math.PI) * CELL * .08; px = x2 + ux * over; py = y2 + uy * over; }
        sc = 1 - .1 * Math.sin(q * Math.PI); rot = ux * .12 * (1 - e); }
      c.save(); c.translate(px, py); c.rotate(rot); c.scale(1 / sc, sc); I.drawPiece(c, a.p.t, a.p.s, 0, 0, CELL * .82, a.p.id * 3.7); c.restore();
    } else if (a.kind === 'bump') {
      const b = Math.sin(k * Math.PI) * .45;
      I.drawPiece(c, a.p.t, a.p.s, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b, CELL * .82, a.p.id * 3.7);
    } else if (a.kind === 'shot') {
      const arc = a.proj === 'rock' ? 1.3 : a.proj === 'arrow' ? .5 : 0;
      const x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k - Math.sin(k * Math.PI) * CELL * arc;
      if (a.proj === 'rock' || a.proj === 'shell') { c.strokeStyle = 'rgba(30,28,36,.3)'; c.lineWidth = 1.2; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(x1, y1); for (let j = 1; j <= 12; j++) { const kk = k * j / 12; c.lineTo(x1 + (x2 - x1) * kk, y1 + (y2 - y1) * kk - Math.sin(kk * Math.PI) * CELL * arc); } c.stroke(); c.setLineDash([]); c.strokeStyle = K; c.lineWidth = 1.6; I.circ(c, x, y, CELL * .09, 3, .6, 8); I.fs(c, K); }
      else if (a.proj === 'bullet') { const g = c.createLinearGradient(x1, y1, x, y); g.addColorStop(0, 'rgba(255,230,140,0)'); g.addColorStop(1, '#ffe27a'); c.strokeStyle = g; c.lineWidth = Math.max(2, CELL * .07); c.beginPath(); c.moveTo(x1 + (x2 - x1) * Math.max(0, k - .5), y1 + (y2 - y1) * Math.max(0, k - .5)); c.lineTo(x, y); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, CELL * .04, 0, 7); c.fill(); }
      else if (a.proj === 'flame') { for (let i = 0; i < 10; i++) { const kk = Math.max(0, k * 1.2 - i * .04); const xx = x1 + (x2 - x1) * kk, yy = y1 + (y2 - y1) * kk; c.fillStyle = i % 3 ? 'rgba(232,137,43,.75)' : 'rgba(243,213,91,.9)'; c.beginPath(); c.arc(xx, yy, CELL * (.05 + .12 * kk), 0, 7); c.fill(); } }
      else if (a.proj === 'hex') { c.strokeStyle = GREEN; c.lineWidth = Math.max(2, CELL * .06); c.beginPath(); for (let j = 0; j <= 8; j++) { const kk = k * j / 8; c.lineTo(x1 + (x2 - x1) * kk + Math.sin(j * 2) * CELL * .08, y1 + (y2 - y1) * kk); } c.stroke(); }
      else if (a.proj === 'scream') { c.strokeStyle = RED; c.lineWidth = 2.5; for (let r = 0; r < 3; r++) { const kk = Math.max(0, k - r * .15); c.beginPath(); c.arc(x1 + (x2 - x1) * kk, y1 + (y2 - y1) * kk, CELL * (.15 + .25 * kk), 0, 7); c.stroke(); } }
      else if (a.proj === 'bolt') { c.strokeStyle = BLUE; c.lineWidth = 4; c.beginPath(); c.moveTo(x1 + (x2 - x1) * Math.max(0, k - .2), y1 + (y2 - y1) * Math.max(0, k - .2)); c.lineTo(x, y); c.stroke(); }
      else if (a.proj === 'grab') { c.strokeStyle = K; c.lineWidth = CELL * .12; c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2 + CELL * .4, (y1 + y2) / 2 - CELL * .4, x, y); c.stroke(); c.strokeStyle = PAPER; c.lineWidth = CELL * .06; c.stroke(); }
      else { const dy = (y2 - y1) - Math.cos(k * Math.PI) * CELL * Math.PI * arc, ang = Math.atan2(dy, x2 - x1), cs = Math.cos(ang), sn = Math.sin(ang), L = CELL * .3; c.strokeStyle = K; c.lineWidth = 2; c.beginPath(); c.moveTo(x - cs * L, y - sn * L); c.lineTo(x, y); c.stroke(); }
    }
  }
  for (const f of fx) {
    if (now < f.start || now > f.start + f.dur) continue;
    const k = (now - f.start) / f.dur;
    if (f.kind === 'impact') {
      const [x, y] = sqXY(f.sq), e = 1 - Math.pow(1 - k, 2), seed = f.sq * 3 + Math.floor(f.start);
      if (k < .18) { c.fillStyle = 'rgba(255,248,220,.9)'; c.beginPath(); for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2, rr = CELL * (i % 2 ? .22 : .45) * (f.big ? 1.5 : 1); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); c.strokeStyle = K; c.lineWidth = 2; c.stroke(); }
      c.strokeStyle = K; c.globalAlpha = 1 - k; c.lineWidth = Math.max(1.5, CELL / 22);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + I.hash(seed + i) * .4, r0 = CELL * (.3 + .3 * e), r1 = CELL * (.55 + .7 * e) * (f.big ? 1.4 : 1); c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke(); }
      c.fillStyle = GOLD; for (let i = 0; i < 6; i++) { const a = I.hash(seed + i + 20) * Math.PI * 2, d = CELL * (.3 + 1.1 * e) * (.5 + I.hash(seed + i + 30)); c.fillRect(x + Math.cos(a) * d - 2, y + Math.sin(a) * d - 2 + k * k * CELL * .5, 4, 4); }
      c.globalAlpha = 1;
    } else if (f.kind === 'muzzle') {
      const [x, y] = sqXY(f.sq), [tx, ty] = sqXY(f.to), a = Math.atan2(ty - y, tx - x);
      c.save(); c.translate(x + Math.cos(a) * CELL * .35, y + Math.sin(a) * CELL * .35); c.rotate(a); c.globalAlpha = 1 - k;
      c.fillStyle = f.proj === 'flame' ? 'rgba(232,137,43,.9)' : '#fff2a8'; c.strokeStyle = K; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, -CELL * .12); c.lineTo(CELL * .35, 0); c.lineTo(0, CELL * .12); c.lineTo(CELL * .08, 0); c.closePath(); c.fill(); c.stroke(); c.restore();
    } else if (f.kind === 'summon') {
      const [x, y] = sqXY(f.sq); c.strokeStyle = f.big ? RED : K; c.globalAlpha = 1 - k; c.lineWidth = 1.6; const R = f.big ? 1.6 : 1;
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; I.ln(c, x + Math.cos(a) * CELL * (.25 + k * .3) * R, y + Math.sin(a) * CELL * (.25 + k * .3) * R, x + Math.cos(a) * CELL * (.38 + k * .35) * R, y + Math.sin(a) * CELL * (.38 + k * .35) * R, i, .5); }
      c.globalAlpha = 1;
    } else if (f.kind === 'scream') {
      const [x, y] = sqXY(f.sq); c.strokeStyle = RED; c.globalAlpha = 1 - k; c.lineWidth = 2.2;
      for (let r = 1; r <= 3; r++) { c.beginPath(); c.arc(x, y - CELL * .1, CELL * (.3 + k * .9) * r * .6, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = 1;
    } else if (f.kind === 'mushroom') {
      const [x, y] = sqXY(f.sq), g = Math.min(1, k * 2.5), a = k < .7 ? 1 : 1 - (k - .7) / .3;
      c.globalAlpha = a * .9; c.strokeStyle = K; c.lineWidth = 2;
      c.fillStyle = 'rgba(232,137,43,0.55)'; c.beginPath(); c.moveTo(x - CELL * .25, y); c.lineTo(x - CELL * .18, y - CELL * 1.6 * g); c.lineTo(x + CELL * .18, y - CELL * 1.6 * g); c.lineTo(x + CELL * .25, y); c.closePath(); c.fill(); c.stroke();
      for (let i = 0; i < 7; i++) { const ang = i / 7 * Math.PI * 2; I.circ(c, x + Math.cos(ang) * CELL * .7 * g, y - CELL * 1.9 * g + Math.sin(ang) * CELL * .35 * g, CELL * .45 * g, i, 1, 10); I.fs(c, i % 2 ? '#e8892b' : PAPER); }
      c.globalAlpha = 1;
    } else if (f.kind === 'boom') {
      const [x, y] = sqXY(f.sq); const R = CELL * (f.big ? 3 : 1.5) * (0.3 + k);
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
      c.strokeStyle = col; c.lineWidth = 6; c.strokeRect(6, 6, BS - 12, BS - 12);
      if (f.key === 'rewind') { c.fillStyle = 'rgba(201,154,28,0.12)'; c.fillRect(0, 0, BS, BS); }
      c.globalAlpha = 1;
    }
  }
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (BS / cam.cell < N - 1.5) drawMinimap(c);
  for (let i = anims.length - 1; i >= 0; i--) if (now > anims[i].start + anims[i].dur + 50) anims.splice(i, 1);
  for (let i = fx.length - 1; i >= 0; i--) if (now > fx[i].start + fx[i].dur + 50) fx.splice(i, 1);
}
function drawSpellFx(c, f, k) {
  const [x, y] = f.sq >= 0 ? sqXY(f.sq) : [BS / 2, BS / 2];
  c.globalAlpha = Math.min(1, (1 - k) * 2);
  const key = f.key;
  const burst = (col, R, n = 12) => { c.strokeStyle = col; c.lineWidth = 2.2; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; I.ln(c, x + Math.cos(a) * R * .4, y + Math.sin(a) * R * .4, x + Math.cos(a) * R, y + Math.sin(a) * R, i + k * 3, 2); } };
  if (key === 'freeze') I.snowflake(c, x, y, CELL * (.25 + k * .35), 3);
  else if (key === 'execute') {
    const drop = Math.min(1, k * 3); c.strokeStyle = K; c.lineWidth = 2.4;
    I.ln(c, x - CELL * .45, y + CELL * .4, x - CELL * .45, y - CELL * 1.2, 1, .3); I.ln(c, x + CELL * .45, y + CELL * .4, x + CELL * .45, y - CELL * 1.2, 2, .3);
    const by = y - CELL * 1.1 + drop * CELL * 1.1; I.poly(c, [[x - CELL * .42, by], [x + CELL * .42, by - CELL * .2], [x + CELL * .42, by - CELL * .5], [x - CELL * .42, by - CELL * .35]], 3, .4); I.fs(c, '#cfd4da');
    if (drop >= 1 && k < .5) { c.strokeStyle = RED; I.ln(c, x - CELL * .5, y, x + CELL * .5, y, 4, .5); }
  }
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
const pointers = new Map(); let drag = null, pinch = null;
bc.addEventListener('pointerdown', e => {
  unlockAudio();
  bc.setPointerCapture(e.pointerId);
  const pt = boardPoint(e); pointers.set(e.pointerId, pt);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), cell: cam.cell, mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; drag = null; return; }
  drag = { x: pt[0], y: pt[1], cx: cam.x, cy: cam.y, moved: false };
});
bc.addEventListener('pointermove', e => {
  const pt = boardPoint(e);
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, pt);
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    zoomAt(pinch.mid[0], pinch.mid[1], (pinch.cell * d / pinch.d) / cam.cell); return;
  }
  if (drag) {
    const dx = pt[0] - drag.x, dy = pt[1] - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
    if (drag.moved) { cam.tx = null; cam.x = drag.cx - dx / cam.cell; cam.y = drag.cy - dy / cam.cell; clampCam(); bc.style.cursor = 'grabbing'; }
  }
  hover = sqAt(...pt);
});
const endPointer = e => {
  const wasDrag = drag, pt = boardPoint(e);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinch = null;
  if (wasDrag && !wasDrag.moved && pointers.size === 0) boardClick(pt[0], pt[1]);
  if (pointers.size === 0) drag = null;
  bc.style.cursor = '';
};
bc.addEventListener('pointerup', endPointer);
bc.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); drag = null; pinch = null; });
bc.addEventListener('pointerleave', () => { hover = -1; });
bc.addEventListener('wheel', e => { e.preventDefault(); const [x, y] = boardPoint(e); zoomAt(x, y, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
function boardClick(px, py) {
  const [mx, my, m] = miniBox();
  if (BS / cam.cell < N - 1.5 && px >= mx && px <= mx + m && py >= my && py <= my + m) { centreOn((py - my) / m * N - .5, (px - mx) / m * N - .5); return; }
  if (!humanTurn() || G.lock || G.recycle) return;
  const sq = sqAt(px, py); if (sq < 0) return;
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
}
window.addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  const k = e.key.toLowerCase(), step = 3;
  if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', '+', '=', '-', '_'].includes(k) && $('#packOverlay').hidden && $('#unitsOverlay').hidden && $('#startOverlay').hidden) {
    e.preventDefault(); cam.tx = null;
    if (k === 'arrowleft') cam.x -= step; if (k === 'arrowright') cam.x += step; if (k === 'arrowup') cam.y -= step; if (k === 'arrowdown') cam.y += step;
    if (k === '+' || k === '=') zoomAt(BS / 2, BS / 2, 1.2); if (k === '-' || k === '_') zoomAt(BS / 2, BS / 2, 1 / 1.2);
    clampCam();
  }
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
  el.innerHTML = `<div class="card-name">${card.name}</div><canvas class="card-art" aria-hidden="true"></canvas><div class="card-text">${card.text}</div><div class="card-foot"><span>${card.kind === 'unit' ? 'Unit' : card.kind === 'coin' ? 'Coins' : 'Spell'}</span><span class="rar">${RARITY_LABEL[card.rarity]}</span></div>`;
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
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pack-btn single'; b.dataset.pack = k;
      b.title = pk.blurb; b.setAttribute('aria-label', `Buy ${pk.name} pack for ${pk.cost} coins. ${pk.blurb}`);
      b.innerHTML = `<canvas aria-hidden="true"></canvas><span class="pack-label"><b>${pk.name}</b><span class="blurb">${pk.blurb}</span></span><span class="price"><span class="coin-ico" aria-hidden="true"></span>${pk.cost}</span>`;
      I.drawPackArt(b.querySelector('canvas'), 46, 64, k);
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
  const nukeBtn = document.createElement('button'); nukeBtn.type = 'button'; nukeBtn.className = 'btn'; nukeBtn.textContent = 'Watch the NUKE cutscene';
  nukeBtn.onclick = () => { unlockAudio(); nukeCutscene(); }; grid.appendChild(nukeBtn);
  const unitBlock = (title, list) => {
    const h = document.createElement('h3'); h.textContent = title; grid.appendChild(h);
    const wrap = document.createElement('div'); wrap.className = 'unit-list'; grid.appendChild(wrap);
    for (const t of list) {
      const u = U[t], card = Object.values(CARDS).find(c => c.unit === t);
      const el = document.createElement('article'); el.className = 'unit';
      el.innerHTML = `<div class="unit-pics"><canvas class="u-art"></canvas><canvas class="u-diag"></canvas></div><div class="unit-body"><h4>${u.name} <span class="val">${t === 'K' ? 'priceless' : 'worth ' + u.val}</span></h4><p>${u.rules}</p>${card ? `<p class="from">In packs: <span class="rar-${card.rarity}">${RARITY_LABEL[card.rarity]}</span></p>` : ''}</div>`;
      I.drawUnitArt(el.querySelector('.u-art'), t, 84); I.drawMoveDiagram(el.querySelector('.u-diag'), t);
      wrap.appendChild(el);
    }
  };
  unitBlock('On the board from the start', START);
  for (const r of I.RARITIES) {
    const list = [...new Set(Object.values(CARDS).filter(c => c.kind === 'unit' && c.rarity === r && !START.includes(c.unit)).map(c => c.unit))];
    if (list.length) unitBlock(`${RARITY_LABEL[r]} units`, list);
  }
  for (const r of I.RARITIES) {
    const list = Object.values(CARDS).filter(c => c.kind !== 'unit' && c.rarity === r);
    if (!list.length) continue;
    const h = document.createElement('h3'); h.textContent = `${RARITY_LABEL[r]} spells and coins`; grid.appendChild(h);
    const sp = document.createElement('div'); sp.className = 'spell-list'; grid.appendChild(sp);
    for (const c of list) sp.appendChild(cardEl(c.key, { cls: 'mini' }));
  }
}
function openStart() { $('#startOverlay').hidden = false; $('#startAi').focus(); }

// ===================================================================== NUKE cutscene
// Music: a file the player picked (kept in this browser), else assets/nuke-theme.mp3 next to the page, else a synth drone.
const MUSIC_DB = 'inkmate', MUSIC_KEY = 'nukeMusic';
function idb() { return new Promise((res, rej) => { try { const r = indexedDB.open(MUSIC_DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } }); }
async function idbGet(k) { try { const db = await idb(); return await new Promise(res => { const t = db.transaction('files').objectStore('files').get(k); t.onsuccess = () => res(t.result || null); t.onerror = () => res(null); }); } catch (e) { return null; } }
async function idbSet(k, v) { try { const db = await idb(); await new Promise(res => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put(v, k); t.oncomplete = res; t.onerror = res; }); return true; } catch (e) { return false; } }
let musicURL = null;
idbGet(MUSIC_KEY).then(b => { if (b) { musicURL = URL.createObjectURL(b); updateMusicLabel(b.name); } });
function updateMusicLabel(name) { const el = $('#musicName'); if (el) el.textContent = name ? `Nuke music: ${name}` : 'Nuke music: not set'; }
// Captions shown beside the falling bomb. They're placeholders: swap in your own words here.
const NUKE_LINES = [
  'ONE MOVE LEFT',
  'THE BOARD FALLS SILENT',
  'EVERY PIECE LOOKS UP',
  'THERE IS NO TAKING IT BACK',
];
function startNukeMusic() {
  let audio = null, synth = null;
  const fallback = () => {
    if (synth || !AC || muted) return;
    const now = AC.currentTime, g = AC.createGain(); g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(.08, now + 1.5); g.connect(AC.destination);
    const oscs = [55, 82.5, 110].map(f => { const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(g); o.start(); return o; });
    synth = { g, oscs };
  };
  if (!muted) {
    audio = new Audio(musicURL || 'assets/nuke-theme.mp3');
    audio.volume = .9;
    audio.addEventListener('error', fallback, { once: true });
    const pr = audio.play(); if (pr && pr.catch) pr.catch(() => fallback());
  }
  let fadeIv = null;
  const fadeTo = (v, ms) => {
    if (audio) { clearInterval(fadeIv); const v0 = audio.volume, steps = Math.max(1, Math.round(ms / 50)); let i = 0; fadeIv = setInterval(() => { i++; audio.volume = Math.max(0, Math.min(1, v0 + (v - v0) * i / steps)); if (i >= steps) clearInterval(fadeIv); }, 50); }
    if (synth && AC) synth.g.gain.setTargetAtTime(Math.max(0.0001, v * .09), AC.currentTime, ms / 3000);
  };
  return {
    fadeTo,
    stop() {
      fadeTo(0, 900);
      setTimeout(() => { if (audio) audio.pause(); if (synth) synth.oscs.forEach(o => { try { o.stop(); } catch (e) {} }); }, 1000);
    },
  };
}
// the cast for the cutscene: one of every unit in the game, spread over a 12×12 board
function cutsceneCast() {
  const types = Object.keys(U);
  const cells = [];
  for (let r = 0; r < 12; r++) for (let c = 0; c < 12; c++) if (Math.abs(r - 5.5) > 1.2 || Math.abs(c - 5.5) > 1.2) cells.push([r, c]);
  cells.sort((a, b) => I.hash(a[0] * 31 + a[1] * 7) - I.hash(b[0] * 31 + b[1] * 7));
  return types.slice(0, cells.length).map((t, i) => ({ t, s: i % 2 ? 'b' : 'w', r: cells[i][0], c: cells[i][1], id: i + 1 }));
}
let castCache = null;
const NUKE_T = 22;
function cineQuality() { let q = 'movie'; try { q = localStorage.getItem('inkmate.cine.quality') || 'movie'; } catch (e) {} return q === '2d' ? '2d' : (q === 'live' || q === 'full' || q === 'light') ? 'live' : 'movie'; }
function nukeCutscene() {
  const ov = $('#cutscene'), cv = $('#cutscene2D');
  ov.hidden = false;
  castCache = castCache || cutsceneCast();
  const music = startNukeMusic();
  let skip = null;
  const quality = cineQuality();
  const p = I.runNukeCinematic(cv, { glCanvas: $('#cutsceneGL'), video: $('#cutsceneVideo'), videoSrc: 'assets/nuke-cinematic.mp4', quality, music, sfx: snd, lines: NUKE_LINES, cast: castCache, onSkip: fn => { skip = fn; },
    onFallback: why => toast(why === 'movie' ? 'The cutscene movie couldn\'t load, so the simple version played' : 'Your device was struggling, so the cutscene switched to the simple version') });
  const finish = () => { if (skip) skip(); };
  ov.onclick = finish; $('#cutSkip').onclick = e => { e.stopPropagation(); finish(); };
  return p.then(() => { music.stop(); ov.hidden = true; ov.onclick = null; });
}
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
    case 'whoosh': noise(.22, .18, 1800, 0, 'bandpass'); break;
    case 'scream': tone('sawtooth', 900, 1500, .5, .05); tone('square', 600, 1300, .5, .03); noise(.5, .15, 3000, 0, 'bandpass'); break;
    case 'nukeboom': noise(3.5, .9, 160); tone('sine', 60, 18, 3.2, .35); noise(.4, .5, 4000, 0, 'highpass'); break;
    case 'nukeroar': noise(4.5, .35, 420, .3); noise(4.8, .25, 90, .8); break;
    case 'rumble': noise(3.5, .12, 120); tone('sine', 45, 38, 3.5, .08); break;
    case 'whistle': tone('sine', 2200, 420, 1.3, .05); tone('triangle', 1100, 210, 1.3, .03); break;
    case 'tinnitus': tone('sine', 4100, 4000, 4.5, .025); break;
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
$('#btnMusic').addEventListener('click', () => $('#musicFile').click());
$('#btnNukeTest').addEventListener('click', () => { unlockAudio(); nukeCutscene(); });
{
  const bsel = $('#battleQ');
  bsel.value = battleCamMode();
  bsel.addEventListener('change', () => { try { localStorage.setItem('inkmate.battlecam', bsel.value); } catch (e) {} toast(bsel.value === 'off' ? 'Battle cam off' : bsel.value === 'all' ? 'Battle cam on for every capture' : 'Battle cam on for big captures'); });
}
{
  const sel = $('#cineQ');
  sel.value = cineQuality();
  sel.addEventListener('change', () => {
    try { localStorage.setItem('inkmate.cine.quality', sel.value); } catch (e) {}
    toast(sel.value === 'live' ? 'Live 3D needs a strong graphics card. It drops to simple if it lags.' : 'Cutscene quality saved');
  });
}
$('#zIn').addEventListener('click', () => zoomAt(BS / 2, BS / 2, 1.3));
$('#zOut').addEventListener('click', () => zoomAt(BS / 2, BS / 2, 1 / 1.3));
$('#zFit').addEventListener('click', () => { cam.cell = MINZOOM(); clampCam(); cam.tx = null; });
$('#zKing').addEventListener('click', () => { const k = I.kingSq(G.board, viewer()); if (k >= 0) { if (cam.cell < BS / 9) cam.cell = BS / 8; const [r, c] = rc(k); centreOn(r, c); } });
$('#musicFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  if (musicURL) URL.revokeObjectURL(musicURL);
  musicURL = URL.createObjectURL(f); updateMusicLabel(f.name);
  const saved = await idbSet(MUSIC_KEY, f);
  toast(saved ? 'Nuke music saved on this device' : 'Nuke music set for this session');
  e.target.value = '';
});
$('#rcTrade').addEventListener('click', tradePicked);
for (const ov of ['#packOverlay', '#unitsOverlay']) $(ov).addEventListener('pointerdown', e => { if (e.target === $(ov) && (ov === '#unitsOverlay' || !$('#packDone').hidden)) closeOverlays(); });

window.__inkmate = { get G() { return G; }, playMove, playCard, newGame, refresh, I, cast: () => (castCache = castCache || cutsceneCast()), lines: () => NUKE_LINES };
window.addEventListener('resize', sizeBoard);
sizeBoard();
newGame('ai');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildLayer(); $('#hand').dataset.sig = ''; document.querySelectorAll('#shop .pack-btn').forEach(b => I.drawPackArt(b.querySelector('canvas'), 46, 64, b.dataset.pack)); refresh(); });
let lastBoil = 0;
function loop(now) { if (now - lastBoil > 150) { I.boil = (I.boil + 1) % 4; lastBoil = now; } drawBoard(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
})();
