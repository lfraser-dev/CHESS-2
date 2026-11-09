/* Chess 2 game screen: board rendering, turns, card effects, shop, recycling, pack opening, the Ink Baron. */
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
// online: you are G.me, the other side is your friend (spectators see Paper and Ink)
const namesNow = () => G.mode === 'online' ? (G.me ? { [G.me]: 'You', [other(G.me)]: 'Your friend' } : NAMES.pvp) : NAMES[G.mode];
const who = s => namesNow()[s];
const winText = w => who(w) === 'You' ? 'You win!' : `${who(w)} wins!`;
const solo = () => G.mode !== 'pvp';   // there's a "you" (vs the Baron, or online)
const poss = s => who(s) === 'You' ? 'Your' : who(s) + '\'s';
const colName = c => c < 26 ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[c] : 'A' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[c - 26];
const sqName = i => { const [r, c] = rc(i); return colName(c) + (N - r); };
const viewer = () => G.mode === 'ai' ? 'w' : G.mode === 'online' ? (G.me || 'w') : G.turn;
const humanTurn = () => G && !G.over && (G.mode === 'pvp' || G.turn === (G.mode === 'online' ? G.me : 'w'));
const FIELD_INFO = {
  wrap: ['Ouroboros', 'the left and right edges are joined'],
  truce: ['White Flag', 'nobody can capture'],
  km: ['Knightmare', 'pawns can also jump like knights'],
  bp: ['Backpedal', 'pawns can also step backwards'],
  allkn: ['Everything is a knight', 'every piece can also jump like a knight'],
  flip: ['Australia mode', 'everything is upside down'],
  bighead: ['Big head mode', 'everyone is enormous'],
  tiny: ['Tiny mode', 'everyone is tiny'],
};

function snap() { G.snaps.push({ board: G.board.slice(), terr: G.terr.slice(), side: G.turn }); if (G.snaps.length > 12) G.snaps.shift(); }
function chaosLevel() { try { return localStorage.getItem('chess2.chaos') || 'wild'; } catch (e) { return 'wild'; } }
const ITEM_EVERY = { calm: 0, mild: 6, wild: 3, unhinged: 2 };
const MUTATE_CHANCE = { calm: 0, mild: .15, wild: .3, unhinged: .55 };
const M = I.MEMES;
const LK = I.LOCKER;
let TH = LK.theme(LK.load().eq.theme);   // your board theme (only on your screen)
// what you are: the side your coins and cosmetics belong to
const mySide = () => G.mode === 'online' ? G.me : G.mode === 'ai' ? 'w' : null;
// leftover coins go to the Locker when the game ends (+25 for a win, +5 for playing, +10 per boss you finished off)
function bankAtEnd() {
  if (!G.over || G.banked) return; G.banked = true;
  const me = mySide() || G.over.winner || 'w', won = G.over.winner === me;
  const n = G.coins[me] + (won ? 25 : 5) + (G.bossKills ? G.bossKills[me] * 10 : 0);
  const total = LK.bank(n, won);
  G.bankedNow = n;
  addLog(`+${n} coins banked in your Locker (${total} total). Spend them on hats, boards and more.`, 'itemlog');
  setTimeout(() => toast(`+${n} coins banked in your Locker`), 2200);
}
const SPECIAL_CD = { calm: 99, mild: 3, wild: 2, unhinged: 1 };
const tier = () => G.chaos === 'calm' ? 0 : M.tierOf(G.rot || 0);
function addRot(n) { if (G.chaos === 'calm') return; G.rot = Math.min(100, (G.rot || 0) + n * (M.RATE[G.chaos] || 1)); }
function newGame(mode) {
  const level = chaosLevel();
  G = I.newState(mode, { chaosStart: level !== 'calm' });
  G.chaos = level;
  Object.assign(G, { sel: -1, pend: null, spec: null, lock: false, recycle: null, rot: level === 'unhinged' ? 20 : 0, limbo: [], items: new Array(N * N).fill(null), gems: { w: 0, b: 0 }, hl: [], lastClip: null, boss: null, banked: false, bossKills: { w: 0, b: 0 },
    cos: { w: LK.look(), b: mode === 'ai' ? { hat: 'tophat', fx: 'ink', title: 'none' } : mode === 'pvp' ? LK.look() : null }, spcd: { w: 0, b: 0 }, finale: false });
  G.actShown = level === 'calm' ? 0 : M.tierOf(G.rot);
  if (level !== 'calm') for (let k = 0; k < (level === 'unhinged' ? 5 : 3); k++) IT.spawn(G);
  anims.length = 0; fx.length = 0;
  if (sizeBoard.done) { cam.cell = MINZOOM(); clampCam(); }
  snap();
  addLog(mode === 'ai' ? 'New game of Chess 2 against the Ink Baron. You play Paper and move first. Good luck.' : 'New game. Paper moves first.');
  refresh();
  
  if (newGame.started) setTimeout(() => comment('start', {}, { big: true, barry: .7 }), 700);
  newGame.started = true;
}
let logN = 0;
function addLog(text, cls = '') { G.log.unshift({ text, cls, n: ++logN }); if (G.log.length > 50) G.log.pop(); }

// ===================================================================== effects & turn flow
function evToFx(ev, cardKey) {
  const lines = [];
  for (const e of ev) {
    if (e.type === 'destroy') { const a = Math.random() * Math.PI * 2; addFx({ kind: 'fling', p: e.p, sq: e.sq, dir: [Math.cos(a), Math.sin(a) - .6], delay: 300, dur: 850, s: e.sq }); addFx({ kind: 'impact', sq: e.sq, delay: 280, dur: 320 }); addFx({ kind: 'splat', sq: e.sq, delay: 300, dur: 9000, s: e.sq * 7 }); }
    else if (e.type === 'summon') addFx({ kind: 'summon', sq: e.sq, dur: e.big ? 900 : 700, big: e.big });
    else if (e.type === 'spell') { if (!(e.hidden && G.mode !== 'pvp' && G.turn !== viewer())) addFx({ kind: 'spell', key: cardKey, sq: e.sq, sq2: e.sq2, dur: 900 }); }
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
    if (!G.board[i] && !I.solid(G.terr[i])) {
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
  markPre(); const hb = G.board.slice(), hi = G.items ? G.items.slice() : null;
  const rangedHit = !!(m.r || (m.arm && isShooter(mover.t) && !(mu.sl || mu.leap)));
  if (wantsBattleCam(mover, cap, m)) {
    focusOn(m.t); refresh();
    let est = U[cap.t].val ? Math.max(1, Math.ceil(U[cap.t].val / 2)) : 0;
    if (cap.bounty) est += 5; if (U[cap.t].cow) est += 4; if (mu.plunder) est += mu.plunder;
    await I.Battle.play($('#duel'), { att: mover, def: cap, armour: !!m.arm, ranged: rangedHit, gain: m.arm ? 0 : est, snd, names: namesNow() });
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
    { const [fr, fc] = vrc(m.f), [tr, tc] = vrc(m.t), d = Math.hypot(tr - fr, tc - fc) || 1;
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
  if (cap && !m.arm && !m.sw && G.chaos && Math.random() < (MUTATE_CHANCE[G.chaos] || 0)) {
    const at = m.r ? m.f : m.t, pc = G.board[at];
    if (pc && pc.t !== 'K') {
      const keys = Object.keys(I.MUTATIONS).filter(k => !(pc.mut || []).includes(k));
      if (keys.length) { const mk = keys[Math.floor(Math.random() * keys.length)]; G.board[at] = { ...pc, mut: (pc.mut || []).concat(mk) }; line += `. It MUTATES and ${I.MUTATIONS[mk].name}`; addFx({ kind: 'text', sq: at, str: 'MUTATED!', col: GREEN, delay: 500, dur: 1300 }); addFx({ kind: 'spell', key: 'mutate', sq: at, dur: 800, delay: 450 }); }
    }
  }
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
    const pt = G.terr[m.t];
    if (pt && pt.k === 'portal' && G.board[m.t] && !G.board[pt.to] && !I.solid(G.terr[pt.to])) {
      const pc = G.board[m.t]; G.board[pt.to] = pc; G.board[m.t] = null;
      addAnim({ kind: 'move', p: pc, f: m.t, t: pt.to, dur: 380, delay: 300, fly: true });
      addFx({ kind: 'spell', key: 'teleport', sq: m.t, sq2: pt.to, dur: 700, delay: 250 });
      line += ` and falls through a portal to ${sqName(pt.to)}`;
      m = { ...m, t: pt.to };
    }
    if (G.board[m.t] && G.board[m.t].t === 'moth') {
      let n = 0; for (const j of I.area(m.t)) { const p = G.board[j]; if (p && p.s !== side && p.t !== 'K' && p.sh <= 0) { G.board[j] = { ...p, fz: Math.max(p.fz, 1) }; n++; } }
      if (n) { line += `, dusting ${n} enem${n === 1 ? 'y' : 'ies'} frozen`; addFx({ kind: 'spell', key: 'freeze', sq: m.t, dur: 800 }); }
    }
  }
  addLog(line);
  const got = !m.r && !m.arm && !m.sw ? pickUpItem(side, m.t) : null;
  if (cap && !m.arm && !m.sw && G.cos && G.cos[side] && G.cos[side].fx && G.cos[side].fx !== 'ink') addFx({ kind: 'cfx', style: G.cos[side].fx, sq: m.t, dur: 1200, delay: m.r ? 300 : 250, s: Math.random() * 99 });
  { I.setEnv(G); const chk = I.inCheck(G.board, other(side)), atk = G.board[m.t] || mover;
    const mc = got ? { ...got, annot: null } : M.moveCaption(side, atk, cap && !m.sw ? cap : null, tier(), chk);
    if (got) { punch(m.t, .8, 1200); addFx({ kind: 'confetti', sq: m.t, dur: 1600, s: Math.random() * 99 }); }
    // the pieces talk
    const me = G.board[m.t] ? m.t : m.f;
    if (cap && !m.arm && !m.sw) { say(m.t, 'dying', { p: cap, dead: true, delay: 250 }); if (Math.random() < .5) say(me, 'capture', { delay: 1100 }); }
    else if (m.arm) say(m.t, 'armour', { delay: 400 });
    else if (got) say(me, 'item', { delay: 200 });
    else if (Math.random() < .3 + tier() * .06) say(me, 'move', { delay: 300 });
    if (chk) { const ks = I.kingSq(G.board, other(side)); if (ks >= 0) say(ks, 'check', { loud: true, delay: 600 }); }
    { const ctx = { A: team(side), V: team(other(side)), a: U[mover.t].name, v: cap ? U[cap.t].name : '' };
      if (got) { /* the item already got a comment */ }
      else if (cap && !m.sw && !m.arm) { const blunder = G.lastMoved && G.lastMoved[other(side)] === cap.id && U[cap.t].val >= 3; const bigCap = U[cap.t].val >= 5 || cap.t === 'Q', clipKey = blunder ? null : (bigCap || Math.random() < .25) ? (rangedHit ? 'shot' : 'strike') : null;
        comment(blunder ? 'blunder' : bigCap ? 'bigcapture' : 'capture', ctx, { big: bigCap || blunder || !!clipKey, clip: clipKey }); }
      else if (chk) comment('check', ctx, { big: true });
      else if (Math.random() < .22) comment('move', ctx, { barry: .25 });
      G.lastMoved = { ...(G.lastMoved || {}), [side]: mover.id }; }
    { let sc = 0; if (cap && !m.sw) sc += (U[cap.t].val || 1) * (m.arm ? .5 : 1) + (cap.t === 'Q' ? 4 : 0); if (chk) sc += 2; if (got) sc += 4; if (mc.react) sc += 1;
      clip(sc, hb, hi, m.f, m.t, mc.text, mc.react, got ? 'RANDOM ITEM' : cap ? 'CAPTURE' : chk ? 'CHECK' : 'MOVE', got ? 'item' : cap && !m.sw ? (rangedHit ? 'shot' : 'capture') : chk ? 'check' : 'move'); }
    meme(mc.text, { react: mc.react, sq: m.t, big: !!(cap && U[cap.t].val >= 5) || (chk && tier() >= 2) });
    if (mc.annot) addFx({ kind: 'annot', sq: m.t, a: mc.annot, delay: 250, dur: 1800 });
    if (cap && !m.arm && !m.sw) addRot(4); }
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
  markPre(); const hb = G.board.slice(), hi = G.items ? G.items.slice() : null;
  if (sim && key !== 'nuke') comment('card', { A: team(side), card: card.name }, { big: card.rarity === 'legendary', clip: card.rarity === 'legendary' ? 'incredible' : null });
  if (sim && key === 'nuke') { refresh(); await nukeCutscene(); shakeT = performance.now() + 1400; comment('nuke', { A: team(side) }, { big: true, clip: 'incredible' }); }
  if (!sim) addLog(`${who(side)} played ${card.name}, but nothing happened.`, 'played');
  else {
    Object.assign(G, { board: sim.board, terr: sim.terr, fields: sim.fields, coins: sim.coins, hand: sim.hand, grave: sim.grave, extra: sim.extra });
    if (G.boss && BO.ensure(G)) {
      const r = BO.hit(G, side, -1, key === 'nuke' ? 12 : 4);
      addFx({ kind: 'text', sq: G.boss.at, str: `-${r.dmg}`, col: RED, delay: 300, dur: 1400 });
      addLog(`The ${card.name} hits ${bossName()} for ${r.dmg}!`, 'special');
      if (r.dead) await bossDefeated(side, null);
    }
    const extra = evToFx(ev, key);
    let line = `${who(side)} played ${card.name}`;
    const hidden = key === 'mine' && G.mode !== 'pvp' && side !== viewer();
    if (card.kind === 'unit') line += ` on ${sqName(o.a)}`;
    else if (o.a >= 0 && !hidden) line += ` on ${sqName(o.a)}${o.b != null ? ' → ' + sqName(o.b) : ''}`;
    if (extra.length) line += ` and ${extra.join(', ')}`;
    const destroyed = ev.filter(e => e.type === 'destroy');
    if (destroyed.length) line += `. Destroyed: ${destroyed.map(e => U[e.p.t].name).join(', ')}`;
    addLog(line + '.', 'played');
    { const big = { epic: 4, legendary: 9 }[card.rarity] || (destroyed.length ? 3 : 0);
      clip(big + destroyed.length * 2, hb, hi, -1, o && o.a >= 0 ? o.a : (I.kingSq(G.board, other(side)) >= 0 ? I.kingSq(G.board, other(side)) : 112), `${M.SIDE(side)}: *plays ${card.name}*`, key === 'nuke' ? 'NUCLEAR OPTION' : destroyed.length >= 2 ? 'OBLITERATED' : null, 'CARD', key === 'nuke' ? 'nuke' : 'card'); }
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
      if (p.curse) { p = { ...p, curse: p.curse - 1 }; if (p.curse <= 0) { G.board[i] = p; killReal(i, 100); notes.push(`${poss(side)} cursed ${U[p.t].name} crumbles to dust`); continue; } }
      if (p.hatch) { p = { ...p, hatch: p.hatch - 1 }; if (p.hatch <= 0) { p = { ...p, t: 'D', hatch: 0 }; addFx({ kind: 'summon', sq: i, dur: 900, big: true }); notes.push(`${poss(side)} Dragon Egg hatches!`); } }
    } else if (p.sh > 0) p = { ...p, sh: p.sh - 1 };
    G.board[i] = p;
  }
  for (let i = 0; i < N * N; i++) {
    const pc = G.board[i]; if (!pc || pc.s !== side) continue;
    if (U[pc.t].medic) for (const j of I.area(i)) { const q = G.board[j]; if (j !== i && q && q.s === side && (q.fz > 0 || q.curse)) { G.board[j] = { ...q, fz: 0, curse: 0 }; notes.push(`The Field Medic patches up a ${U[q.t].name}`); } }
    if (U[pc.t].raise && G.grave[side].length) {
      const spot = I.area(i).find(j => !G.board[j] && !I.solid(G.terr[j]));
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
      if (inB(r2, c2) && !G.board[k] && !I.solid(tk)) { G.board[k] = q; G.board[j] = null; addAnim({ kind: 'move', p: q, f: j, t: k, dur: 300 }); }
      else killReal(j, 200);
    }
    addFx({ kind: 'scream', sq: i, dur: 900 });
    if (hits) { notes.push(`The Screaming Pagoda SCREAMS at ${hits} enem${hits === 1 ? 'y' : 'ies'}`); shakeT = performance.now() + 500; snd('scream'); }
  }
  for (let i = 0; i < N * N; i++) { const t = G.terr[i]; if (t && (t.k === 'fire' || t.k === 'rad' || t.k === 'portal')) { const n = t.n - 1; G.terr[i] = n > 0 ? { ...t, n } : null; } }
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
  if (G.extra) { G.extra = false; addLog(`${who(side)} take${who(side) === 'You' ? '' : 's'} another turn.`, 'played'); }
  else {
    G.turn = other(side);
    G.coins[G.turn] += 1;
    const income = G.board.reduce((n, p) => n + (p && p.s === G.turn && U[p.t].income ? U[p.t].income : 0), 0);
    if (income) { G.coins[G.turn] += income; addLog(`Geese and vending machines pay ${who(G.turn)} ${income} coins.`, 'played'); }
  }
  snap();
  addRot(2.5);
  if (G.quiet === 24) comment('boring', {}, { barry: .7 });
  returnFromLimbo();
  let every = ITEM_EVERY[G.chaos] || 0;
  if (every > 1 && tier() >= 3) every = Math.max(1, every - 1);
  const steps = [];
  if (G.finale && !G.over) steps.push(finaleMeteor);
  if (G.boss && !G.over && G.ply % 2 === 0) steps.push(bossTurn);
  if (every && G.ply % every === 0 && !G.over) steps.push(spawnItems);
  if (G.chaos !== 'calm' && tier() > (G.actShown || 0) && !G.over) steps.push(nextAct);
  if (!steps.length) { startTurn(); return; }
  G.lock = true; refresh();
  (async () => { for (const f of steps) await f(); startTurn(); })();
}
// pieces that walked off the board come back when it's the other side's move (so they can give check but never leave a king hanging)
function returnFromLimbo() {
  if (!G.limbo || !G.limbo.length) return;
  for (const e of G.limbo.slice()) {
    if (G.ply < e.back || G.turn === e.p.s) continue;
    const rows = e.why === 'snacks' ? I.homeRows(e.p.s) : I.halfRows(other(e.p.s));
    let at = -1; const opts = [];
    for (let i = 0; i < N * N; i++) { const r = i / N | 0; const t = G.terr[i]; if (rows.includes(r) && !G.board[i] && !(t && (I.solid(t) || t.k === 'portal'))) opts.push(i); }
    if (!opts.length) continue;
    at = opts[Math.floor(Math.random() * opts.length)];
    G.board[at] = { ...e.p, fz: 0 };
    G.limbo.splice(G.limbo.indexOf(e), 1);
    addFx({ kind: 'summon', sq: at, dur: 900, big: true }); addFx({ kind: 'spell', key: 'teleport', sq: at, dur: 800 });
    if (e.why === 'snacks') { G.coins[e.p.s] += 3; addFx({ kind: 'text', sq: at, str: '+3 snacks', col: GOLD, delay: 300, dur: 1300 }); }
    addLog(e.why === 'snacks' ? `${poss(e.p.s)} ${U[e.p.t].name} is back from the shop on ${sqName(at)} with 3 coins.` : `${poss(e.p.s)} ${U[e.p.t].name} falls out of another dimension onto ${sqName(at)}!`, 'special');
    meme(`${M.SIDE(e.p.s)}: *${U[e.p.t].name} ${e.why === 'snacks' ? 'is back with snacks' : 'returns from another dimension'}*`, { react: e.why === 'snacks' ? 'he\'s back' : 'HE\'S BACK', sq: at, big: e.why !== 'snacks' });
    focusOn(at);
  }
}
async function nextAct() {
  const t = tier();
  G.actShown = t;
  if (t >= 5 && !G.finale) { await runFinale(); return; }
  await showAct(M.TIERS[t]);
  comment('act', { act: `${M.TIERS[t].act}, ${M.TIERS[t].name}` }, { big: true });
  addLog(`${M.TIERS[t].act}: ${M.TIERS[t].name}. New special moves unlocked.`, 'actlog');
}
async function runFinale() {
  await showAct(M.TIERS[5]);
  G.finale = true;
  for (const s of ['w', 'b']) I.addToHand(G, s, 'nuke');
  comment('finale', {}, { big: true, barry: .9 });
  addLog('THE FINALE: both sides get a NUKE card, a meteor lands every turn, and anything can self-destruct.', 'actlog');
  snd('airhorn'); slam('FINAL BOSS MUSIC', true);
  refresh(); await sleep(900);
  await spawnBoss();
}
async function finaleMeteor() {
  const hit = M.meteor(G, G.turn);
  if (!hit) return;
  focusOn(hit.sq);
  markPre(); const hb = G.board.slice(), hi = G.items.slice();
  Object.assign(G, { board: hit.st.board, terr: hit.st.terr, grave: hit.st.grave });
  if (hit.p) { comment('meteor', { v: U[hit.p.t].name }, { big: true, clip: U[hit.p.t].val >= 5 ? 'shot' : null }); say(hit.sq, 'dying', { p: hit.p, dead: true, delay: 300 }); clip(4 + (U[hit.p.t].val || 0) / 2, hb, hi, -1, hit.sq, `The sky: *drops a meteor on the ${U[hit.p.t].name}*`, 'UNLUCKY', 'METEOR', 'meteor'); }
  addFx({ kind: 'spell', key: 'meteor', sq: hit.sq, dur: 900 }); addFx({ kind: 'boom', sq: hit.sq, delay: 350, dur: 800 });
  if (hit.p) { const a = Math.random() * Math.PI * 2; addFx({ kind: 'fling', p: hit.p, sq: hit.sq, dir: [Math.cos(a), Math.sin(a) - .6], delay: 380, dur: 850, s: hit.p.id }); }
  setTimeout(() => snd('boom'), 350); shakeT = performance.now() + 900;
  addLog(`A meteor lands on ${sqName(hit.sq)}${hit.p ? `, flattening ${poss(hit.p.s)} ${U[hit.p.t].name}` : ''}.`, 'chaoslog');
  meme(`The sky: *drops a meteor${hit.p ? ` on the ${U[hit.p.t].name}` : ''}*`, { react: hit.p ? M.pick(['UNLUCKY', 'skill issue (cosmic)', 'GG']) : null, sq: hit.sq });
  refresh(); await waitAnims();
}
let bossQueued = false;
function startTurn() {
  I.setEnv(G);
  const t = G.turn;
  if (bossQueued && !G.boss && humanTurn()) { bossQueued = false; setTimeout(summonBossNow, 300); }
  if (G.spcd && G.spcd[t] > 0) G.spcd[t]--;
  if (!canAct(t)) {
    if (I.inCheck(G.board, t)) { G.over = { winner: other(t), why: 'checkmate' }; addLog(`Checkmate! ${winText(other(t))}`, 'big');
      const lost = solo() && other(t) !== viewer(); snd(lost ? 'trombone' : 'win');
      const mateReact = lost ? 'it\'s so over' : M.pick(['GG EZ', 'WE\'RE SO BACK', 'absolute cinema']);
      comment('mate', { A: team(other(t)) }, { big: true, barry: .9, clip: 'goal' });
      meme(`${M.SIDE(other(t))}: *checkmates*`, { react: mateReact, big: true, sq: I.kingSq(G.board, t) });
      say(I.kingSq(G.board, t), 'lose', { loud: true, delay: 500, dur: 4000 });
      const wk = I.kingSq(G.board, other(t)); if (wk >= 0) say(wk, 'win', { delay: 1300, dur: 4000 });
      if (G.lastClip) { const lc = { ...G.lastClip, score: 99, caption: `${M.SIDE(other(t))}: *checkmates*`, react: 'CHECKMATE', label: 'THE ENDING', mate: I.kingSq(G.board, t) }; G.hl = G.hl.filter(x => x !== G.lastClip); G.hl.push(lc); }
      setTimeout(offerReplay, 3800); }
    else { G.over = { winner: null, why: 'stalemate' }; addLog('Stalemate. Nobody can move, so it\'s a draw.', 'big'); comment('draw', {}, { big: true }); }
  } else if (G.quiet >= 120) { G.over = { winner: null, why: 'quiet' }; addLog('Sixty moves each with nothing captured. It\'s a draw.', 'big'); }
  else if (I.inCheck(G.board, t)) { addLog(`${who(t)} ${who(t) === 'You' ? 'are' : 'is'} in check!`, 'warn'); snd('check'); }
  G.lock = false;
  refresh();
  if (G.over) {
    const ov = G.over, msg = ov.winner ? `Checkmate. ${winText(ov.winner)}` : 'Draw'; setTimeout(() => toast(msg), 900);
    bankAtEnd();
    if (G.mode === 'online' && G.me && !NET.applying) netPublish();
    if (!ov.winner) setTimeout(offerReplay, 2500);
    return;
  }
  if (G.mode === 'ai' && G.turn === 'b') { G.lock = true; refresh(); setTimeout(aiTurn, 450); }
  if (G.mode === 'online' && G.me && !NET.applying) netPublish();
}

// ---- random things on the board (pomegranates, markers, gems, rings, disco balls, cakes)
const IT = I.ITEMS;
async function spawnItems() {
  if (G.items.filter(Boolean).length >= 6) return;
  const n = G.chaos === 'unhinged' && Math.random() < .4 ? 2 : 1;
  for (let k = 0; k < n; k++) {
    const at = IT.spawn(G); if (at < 0) return;
    const it = IT.ITEMS[G.items[at].k];
    addFx({ kind: 'drop', sq: at, dur: 700 });
    addLog(`A ${it.name} appears on ${sqName(at)}. Walk a piece onto it.`, 'itemlog');
    if (k === 0) meme(`The board: *spawns a ${it.name.toLowerCase()}*`, { sq: at });
    setTimeout(() => snd('boing'), 450);
  }
  refresh(); await sleep(500);
}
// a piece just landed on an item: use it. Returns the meme caption, or null
function pickUpItem(side, at) {
  const item = G.items[at], p = G.board[at];
  if (!item || !p || p.s !== side) return null;
  G.items[at] = null;
  const it = IT.ITEMS[item.k];
  const h = {
    fx: f => addFx(f),
    summon: j => addFx({ kind: 'summon', sq: j, dur: 900, big: true, delay: 300 }),
    slam: (t, big) => setTimeout(() => slam(t, big), 900),
    coins: (s2, n, j) => { G.coins[s2] += n; addFx({ kind: 'text', sq: j, str: `+${n}`, col: GOLD, delay: 400, dur: 1200 }); },
  };
  const text = it.use(G, side, at, h);
  comment('item', { A: team(side), a: U[p.t].name, item: it.name.toLowerCase() }, { big: true });
  addFx({ kind: 'spell', key: 'mutate', sq: at, dur: 700 });
  addLog(`${poss(side)} ${U[p.t].name} ${text}.`, 'itemlog');
  addRot(5);
  snd(item.k === 'disco' ? 'airhorn' : item.k === 'ring' ? 'brilliant' : 'vboom');
  return { text: `${M.SIDE(side)}: *${U[p.t].name} ${it.verb}*`, react: M.pick(it.react) };
}

// ---- the finale boss
const BO = I.BOSS;
function bossHittable(side, sq) {
  if (!G.boss || !humanTurnFor(side)) return false;
  I.setEnv(G);
  return !I.inCheck(G.board, side) && BO.canHit(G, sq) && G.board[sq] && G.board[sq].s === side;
}
const humanTurnFor = side => G.turn === side;
const bossName = () => G && G.boss ? BO.nameOf(G.boss) : 'the boss';
let lastBossType = null;
const bossCentre = () => { const [x1, y1] = sqXY(G.boss.at), [x2, y2] = sqXY(G.boss.at + N + 1); return [(x1 + x2) / 2, (y1 + y2) / 2]; };
async function spawnBoss(type) {
  if (!type) { const opts = BO.TYPE_KEYS.filter(k => k !== lastBossType); type = opts[Math.floor(Math.random() * opts.length)]; }
  lastBossType = type;
  const at = BO.spawnSpot(G, G.turn); if (at < 0) { addLog(`${bossName()} looked for somewhere to land but the board is too full.`, 'chaoslog'); return; }
  const squashed = BO.place(G, at, type);
  for (const { sq, p } of squashed) addFx({ kind: 'fling', p, sq, dir: [Math.random() - .5, -1], delay: 100, dur: 900, s: p.id });
  focusOn(at); refresh();
  shakeT = performance.now() + 1400; addFx({ kind: 'flash', dur: 500 });
  for (const b of BO.squares(at)) addFx({ kind: 'boom', sq: b, delay: 100, dur: 900 });
  snd('nukeboom'); setTimeout(() => snd('vboom'), 500); setTimeout(() => snd(G.boss && G.boss.type === 'chicken' ? 'cluck' : G.boss && G.boss.type === 'pawn' ? 'scream' : 'dun'), 900);
  punch(at, .9, 1800);
  meme(`${bossName()}: *has entered the chat*`, { react: 'BOSS FIGHT', big: true, sq: at });
  comment('boss', { boss: bossName() }, { big: true, barry: .8 });
  addLog(`BOSS FIGHT! ${bossName()} (${BO.typeOf(G.boss).blurb}) lands in the middle of the board with ${G.boss.max} health. Both sides can hit it: select a piece next to it (or a shooter within 3) and click the boss. Whoever lands the final blow gets 15 coins.`, 'actlog');
  const near = BO.ring(at, 3).filter(i => G.board[i]).slice(0, 3);
  near.forEach((i, n) => say(i, 'boss', { delay: 900 + n * 500, loud: n === 0 }));
  await sleep(1800);
}
async function bossAttack(side, sq) {
  G.lock = true; G.sel = -1; tKey = null;
  markPre();
  const p = G.board[sq], hb = G.board.slice(), hi = G.items.slice();
  const [bx, by] = bossCentre(), [px, py] = sqXY(sq);
  const near = BO.squares(G.boss.at).sort((a, b) => { const [ax, ay] = sqXY(a), [cx, cy] = sqXY(b); return Math.hypot(ax - px, ay - py) - Math.hypot(cx - px, cy - py); })[0];
  const ranged = !BO.ring(G.boss.at, 1).includes(sq);
  if (ranged) { addAnim({ kind: 'shot', f: sq, t: near, dur: 380, proj: 'bullet' }); addFx({ kind: 'muzzle', sq, to: near, dur: 160, proj: 'bullet' }); snd('twang'); }
  else { addAnim({ kind: 'lunge', p, f: sq, t: near, dur: 460, back: true }); snd('whoosh'); }
  const r = BO.hit(G, side, sq);
  setTimeout(() => { snd('hit'); shakeT = performance.now() + 300; if (G.boss) G.boss.hitT = performance.now(); }, ranged ? 360 : 280);
  addFx({ kind: 'impact', sq: near, from: sq, delay: ranged ? 360 : 280, dur: 380, big: true });
  addFx({ kind: 'text', sq: near, str: `-${r.dmg}`, col: RED, delay: 300, dur: 1300 });
  const cap = `${M.SIDE(side)}: *${U[p.t].name} ${M.pick(['bonks', 'slaps', 'punches', 'pokes', 'roundhouse kicks', 'headbutts'])} ${bossName()}*`;
  meme(cap, { react: r.dead ? null : M.pick(['DAMAGE', 'it felt that', 'GET HIM', 'crit!!']), sq: near });
  say(sq, 'special', { delay: 100 });
  if (!r.dead) comment('bosshit', { A: team(side), a: U[p.t].name, boss: bossName() }, { big: r.dmg >= 4, clip: r.dmg >= 4 ? (ranged ? 'shot' : 'strike') : null });
  addLog(`${poss(side)} ${U[p.t].name} hits ${bossName()} for ${r.dmg} (${G.boss.hp} health left).`, 'special');
  addRot(3);
  refresh(); await waitAnims();
  clip(r.dead ? 15 : 3 + r.dmg, hb, hi, sq, near, cap, r.dead ? 'BOSS DEFEATED' : 'DAMAGE', 'BOSS FIGHT', 'bosshit', { dmg: r.dmg, dead: r.dead });
  if (r.dead) await bossDefeated(side, sq);
  finishTurn(side);
}
async function bossDefeated(side, sq) {
  const at = G.boss.at, dmg = G.boss.dmg, bname = bossName();
  for (const b of BO.squares(at)) addFx({ kind: 'boom', sq: b, delay: Math.random() * 300, dur: 900 });
  addFx({ kind: 'flash', dur: 700 }); shakeT = performance.now() + 1500; snd('nukeboom'); setTimeout(() => snd('airhorn'), 600);
  BO.remove(G);
  G.coins[side] += 15; if (G.bossKills) G.bossKills[side]++;
  if (sq != null && G.board[sq] && G.board[sq].s === side) { const q = G.board[sq]; G.board[sq] = { ...q, ar: (q.ar || 0) + 2, mut: [...(q.mut || []), 'zoom'] }; addFx({ kind: 'spell', key: 'mutate', sq, delay: 500, dur: 1000 }); }
  for (const b of BO.squares(at)) addFx({ kind: 'confetti', sq: b, dur: 1800, s: b });
  meme(`${M.SIDE(side)}: *defeats ${bname}*`, { react: 'BOSS DEFEATED', big: true, sq: at });
  comment('bossdead', { A: team(side), boss: bname }, { big: true, barry: .8, clip: 'incredible' });
  const mvp = dmg.w === dmg.b ? 'a tie' : dmg.w > dmg.b ? who('w') : who('b');
  addLog(`${bname} IS DEFEATED! ${who(side)} landed the final blow: +15 coins, and the hero gets 2 armour and super speed. Damage dealt: ${who('w')} ${dmg.w}, ${who('b')} ${dmg.b} (MVP: ${mvp}).`, 'actlog');
  refresh(); await waitAnims(); await sleep(400);
}
async function bossTurn() {
  if (!G.boss) return;
  markPre();
  const toMove = G.turn, hb = G.board.slice(), hi = G.items.slice();
  focusOn(G.boss.at);
  const res = BO.act(G, toMove); if (!res) return;
  const [bx, by] = bossCentre();
  const cap = `${bossName()}: *${res.verb}*`;
  meme(cap, { react: res.react, big: res.killed.length > 0, sq: G.boss.at });
  if (res.killed.length || Math.random() < .3) comment('bossattack', { boss: bossName() }, { big: res.killed.length > 0 });
  if (res.kind === 'stomp') { shakeT = performance.now() + 700; snd('rumble'); for (const b of BO.ring(G.boss.at, 1)) addFx({ kind: 'dust', sq: b, dur: 600, s: b }); }
  if (res.kind === 'laser' || res.kind === 'laserCol') { addFx({ kind: 'laser', row: res.row, col: res.col, sqs: res.laser, from: G.boss.at, dur: 900 }); snd(res.kind === 'laserCol' ? 'scream' : 'laser'); }
  if (res.kind === 'roar' || res.kind === 'scream') { addFx({ kind: 'scream', sq: G.boss.at, dur: 900 }); addFx({ kind: 'scream', sq: G.boss.at + N + 1, dur: 900, delay: 150 }); snd(res.kind === 'scream' ? 'scream' : 'neigh'); for (const i of res.frozen.slice(0, 2)) say(i, 'boss', { delay: 400 }); }
  if (res.kind === 'feathers') { for (const i of BO.ring(G.boss.at, 3)) if (Math.random() < .5) addFx({ kind: 'confetti', sq: i, dur: 1400, s: i }); snd('cluck'); setTimeout(() => snd('whoosh'), 200); }
  if (res.kind === 'peck') { snd('cluck'); for (const k of res.killed) addFx({ kind: 'impact', sq: k.sq, dur: 300, delay: 150 }); }
  if (res.kind === 'juice') { for (const i of BO.ring(G.boss.at, 3)) if (Math.random() < .6) addFx({ kind: 'splat', sq: i, dur: 9000, s: i * 3 }); snd('splat'); }
  if (res.kind === 'seeds') { res.shots.forEach((t, n) => { addAnim({ kind: 'shot', f: G.boss.at, t, dur: 380, delay: n * 120, proj: 'bullet' }); addFx({ kind: 'splat', sq: t, dur: 9000, s: t, delay: 350 + n * 120 }); }); snd('pew'); }
  for (const pu of res.pushed) addAnim({ kind: 'move', p: pu.p, f: pu.f, t: pu.t, dur: 300, fly: true });
  if (res.moved && G.boss.type === 'pom') snd('rumble');
  if (res.moved) { shakeT = performance.now() + 600; snd('rumble'); }
  for (const { sq, p } of res.killed) {
    const a = Math.atan2(sqXY(sq)[1] - by, sqXY(sq)[0] - bx);
    addFx({ kind: 'fling', p, sq, dir: [Math.cos(a), Math.sin(a) - .5], delay: 250, dur: 900, s: p.id });
    say(sq, 'dying', { p, dead: true, delay: 300 });
  }
  if (res.killed.length) { setTimeout(() => snd('bonk'), 250); clip(4 + res.killed.length * 2, hb, hi, -1, res.killed[0].sq, cap, res.react, 'BOSS ATTACK', 'bossatk', { attack: res.kind, row: res.row, col: res.col }); }
  const lost = res.killed.map(k => `${poss(k.p.s)} ${U[k.p.t].name}`);
  addLog(`${bossName()} ${res.verb}${lost.length ? `, destroying ${lost.join(', ')}` : ''}${res.frozen.length ? ` (${res.frozen.length} pieces frozen)` : ''}.`, 'chaoslog');
  refresh(); await waitAnims(); await sleep(250);
}

// ---- the commentators (Jim and Barry)
const CM = I.COMM;
let commMode = 'voice'; try { commMode = localStorage.getItem('chess2.comm') || 'voice'; } catch (e) { /* default */ }
let commT = 0, commTyping = 0, barryT = 0;
const team = s => G.mode === 'ai' ? (s === 'w' ? 'Paper' : 'the Baron') : (s === 'w' ? 'Paper' : 'Ink');
// real commentator clips (assets/commentary): the big moments get an actual football commentator
const CLIPS = {
  incredible: { src: 'assets/commentary/incredible.mp3', text: 'THAT IS NOTHING BUT INCREDIBLE!' },
  shot: { src: 'assets/commentary/amazing-shot.mp3', text: 'WHAT AN AMAZING SHOT!' },
  strike: { src: 'assets/commentary/sweet-strike.mp3', text: 'OH, WHAT A SWEET STRIKE!' },
  goal: { src: 'assets/commentary/goal.mp3', text: null },
};
const clipLast = {}; let clipAudio = null, clipPlaying = false;
for (const k in CLIPS) { const a = new Audio(); a.preload = 'auto'; a.src = CLIPS[k].src; CLIPS[k].el = a; }
function playClip(key) {
  const cl = CLIPS[key]; if (!cl || commMode !== 'voice' || muted) return false;
  const now = performance.now();
  if (clipPlaying || (clipLast[key] && now - clipLast[key] < (key === 'goal' ? 0 : 25000))) return false;   // don't spam the same line
  clipLast[key] = now;
  const a = cl.el; try { a.currentTime = 0; } catch (e) { /* not loaded yet */ }
  a.volume = .95; clipPlaying = true; CM.hush();
  if (I.Music) I.Music.duck(true);
  const done = () => { clipPlaying = false; if (I.Music && $('#cutscene').hidden) I.Music.duck(false); };
  a.onended = done; a.onerror = done;
  const pr = a.play(); if (pr && pr.catch) pr.catch(done);
  return true;
}
function comment(ev, ctx = {}, o = {}) {
  if (commMode === 'off' || !G) return;
  const now = performance.now();
  if (!o.big && now - commT < 1800) return;            // don't talk over a big moment with small stuff
  // a real clip for the biggest moments (the text box shows what he says)
  if (o.clip && playClip(o.clip)) {
    const t = CLIPS[o.clip].text, ln0 = CM.line(ev, ctx);
    commT = now; showComment({ who: 'JIM', text: t || (ln0 ? ln0.text : 'GOOOOOAL!') }, false, true);
    clearTimeout(barryT);
    if (Math.random() < .5) barryT = setTimeout(() => { const b = CM.line(ev, ctx, true); if (b) { commT = performance.now(); showComment(b, false); } }, o.clip === 'goal' ? 9000 : 4600);
    return;
  }
  const ln = CM.line(ev, ctx); if (!ln) return;
  commT = now; showComment(ln, o.big);
  clearTimeout(barryT);
  if (Math.random() < (o.barry != null ? o.barry : .45)) barryT = setTimeout(() => { const b = CM.line(ev, ctx, true); if (b) { commT = performance.now(); showComment(b, false); } }, 2600 + ln.text.length * 25);
}
function showComment(ln, urgent, silent) {
  const el = $('#comm'); if (!el) return;
  el.hidden = false;
  el.querySelector('.comm-who').textContent = ln.who + ':';
  el.querySelector('.comm-who').className = 'comm-who ' + ln.who.toLowerCase();
  const tx = el.querySelector('.comm-text'); let i = 0;
  clearInterval(commTyping);
  commTyping = setInterval(() => { i = Math.min(ln.text.length, i + 2); tx.textContent = ln.text.slice(0, i); if (i >= ln.text.length) clearInterval(commTyping); }, 18);
  if (commMode === 'voice' && !muted && !silent && !clipPlaying) CM.speak(ln.who, ln.text, urgent);
}
function renderCommBox() { const el = $('#comm'); if (el && commMode === 'off') el.hidden = true; }

// ---- talking pieces
const TK = I.TALK;
function say(sq, kind, o = {}) {
  const p = o.p || G.board[sq]; if (!p && !o.text) return;
  const text = o.text || TK.line(kind, p.t);
  const id = p ? p.id : null;
  for (let i = fx.length - 1; i >= 0; i--) if (fx[i].kind === 'say' && ((id && fx[i].id === id) || fx[i].sq === sq)) fx.splice(i, 1);
  const talking = fx.filter(f => f.kind === 'say');
  if (talking.length >= 3) fx.splice(fx.indexOf(talking[0]), 1);
  addFx({ kind: 'say', id: o.dead ? null : id, sq, text, loud: !!o.loud, delay: o.delay || 0, dur: o.dur || 2300 });
}
let idleT = 0;
function idleChatter(now) {
  if (!G || G.over || G.lock || !humanTurn() || now < idleT) return;
  idleT = now + 5500 + Math.random() * 5000;
  if (fx.some(f => f.kind === 'say')) return;
  const [vr0, vr1, vc0, vc1] = visibleRange(), opts = [];
  for (let r = vr0; r <= vr1; r++) for (let cc = vc0; cc <= vc1; cc++) { const q = G.board[r * N + cc]; if (q) opts.push(r * N + cc); }
  if (opts.length) say(opts[Math.floor(Math.random() * opts.length)], 'idle');
}

// ---- highlights: remember the big moments for the replay at the end
let pre = { terr: null, boss: null };
function markPre() { pre = { terr: G.terr.slice(), boss: G.boss ? { ...G.boss } : null }; }
function clip(score, before, itemsBefore, f, t, caption, react, label, kind = 'move', extra = {}) {
  const c = { score, before, itemsBefore, after: G.board.slice(), itemsAfter: G.items ? G.items.slice() : null, f, t, caption, react, label, kind, ...extra,
    terrBefore: pre.terr || G.terr.slice(), terrAfter: G.terr.slice(), bossBefore: pre.boss, bossAfter: G.boss ? { ...G.boss } : null };
  G.lastClip = c;
  if (score >= 3) { G.hl.push(c); if (G.hl.length > 40) G.hl.splice(G.hl.reduce((m, x, i, a) => x.score < a[m].score ? i : m, 0), 1); }
}

// ---- special moves
async function doSpecial(side, at, key, tg) {
  const res = M.trySpecial(G, side, at, key, tg);
  G.spec = null; G.sel = -1; tKey = null;
  if (!res) { toast('That special move isn\'t allowed right now'); refresh(); return; }
  G.lock = true;
  const p = G.board[at], sp = res.sp, name = U[p.t].name;
  focusOn(at); refresh();
  punch(at, 1.0, 1300);
  markPre(); const spReact = M.pick(sp.react), hb = G.board.slice(), hi = G.items ? G.items.slice() : null;
  meme(`${M.SIDE(side)}: *${sp.verb}*`, { react: spReact, sq: tg >= 0 ? tg : at, big: true, sound: false });
  say(at, 'special', { loud: true });
  comment('special', { A: team(side), a: name, verb: sp.verb }, { big: true, clip: Math.random() < .6 ? 'incredible' : null });
  addFx({ kind: 'flash', dur: 260, delay: 600 });
  snd(sp.tier >= 3 ? 'airhorn' : 'vboom');
  await sleep(650);
  const before = new Map(); G.board.forEach((q, i) => { if (q) before.set(q.id, { p: q, i }); });
  const st = res.st;
  Object.assign(G, { board: st.board, terr: st.terr, fields: st.fields, coins: st.coins, hand: st.hand, grave: st.grave });
  evToFx(res.ev, sp.key === 'airstrike' ? 'orbital' : sp.key === 'convert' ? 'mindcontrol' : sp.key);
  const killed = new Set(res.ev.filter(e => e.type === 'destroy').map(e => e.p.id));
  G.board.forEach((q, i) => { if (!q) return; const b = before.get(q.id); if (b && b.i !== i) addAnim({ kind: 'move', p: q, f: b.i, t: i, dur: 480, fly: true }); else if (b && b.p.s !== q.s) addFx({ kind: 'spell', key: 'mutate', sq: i, dur: 900 }); });
  if (res.out.limbo) {
    G.limbo.push({ p: res.out.limbo.p, back: G.ply + 4, why: res.out.limbo.why });
    addFx({ kind: 'warp', p: res.out.limbo.p, sq: at, dur: 1000 });
  }
  if (res.ev.some(e => e.type === 'shell')) snd('boom');
  else if (killed.size) setTimeout(() => snd('hit'), 200);
  G.last = { f: at, t: tg >= 0 ? tg : at };
  addLog(`${poss(side)} ${name} ${res.text}.`, 'special');
  for (const e of res.ev) if (e.type === 'destroy' && e.p.s !== side && Math.random() < .6) { say(e.sq, 'dying', { p: e.p, dead: true, delay: 200 }); break; }
  clip(6 + killed.size * 2, hb, hi, at, tg >= 0 ? tg : at, `${M.SIDE(side)}: *${sp.verb}*`, spReact, 'SPECIAL MOVE', 'special');
  G.spcd[side] = SPECIAL_CD[G.chaos] || 2;
  addRot(6);
  if (res.out.extra) G.extra = true;
  refresh();
  await waitAnims();
  if (sp.free) { G.lock = false; refresh(); if (G.mode === 'ai' && side === 'b') setTimeout(aiTurn, 300); return; }
  finishTurn(side);
}
// the Ink Baron picks the special that wins the most material (or a random harmless one now and then)
function aiSpecial() {
  const all = M.allSpecials(G, 'b'); if (!all.length) return null;
  const worth = st => st.board.reduce((n, p) => n + (p ? (p.s === 'b' ? 1 : -1) * (U[p.t].val || 0) : 0), 0);
  const base = worth(G);
  let best = null, bestSc = -1e9;
  for (const o of all) {
    const r = M.trySpecial(G, 'b', o.at, o.key, o.tg); if (!r) continue;
    let sc = worth(r.st) - base + Math.random() * 1.5;
    if (r.out.limbo) sc -= U[G.board[o.at].t].val * .4;
    if (o.key === 'selfdestruct' && sc < 3) continue;
    if (o.key === 'snack' && G.coins.b > 10) sc -= 3;
    if (sc > bestSc) { bestSc = sc; best = o; }
  }
  return bestSc >= .8 || (best && Math.random() < .25) ? best : null;
}

// ---- meme presentation
let memeT = 0;
function meme(text, o = {}) {
  if (G && G.mode === 'online' && G.me && !NET.applying && !o.remote) { NET.caps.push({ text, react: o.react || null, sq: o.sq != null ? o.sq : -1, big: !!o.big }); if (NET.caps.length > 5) NET.caps.shift(); }
  const el = $('#memeCap');
  el.textContent = text; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); el.hidden = false;
  clearTimeout(memeT); memeT = setTimeout(() => { el.hidden = true; }, 2300);
  if (o.react) setTimeout(() => slam(o.react, o.big), 380);
  if (o.big && o.sq != null && o.sq >= 0) punch(o.sq, .55, 900);
}
let slamT = 0;
function slam(text, big) {
  const el = $('#memeReact');
  el.textContent = text;
  el.style.setProperty('--rot', ((Math.random() - .5) * 18).toFixed(1) + 'deg');
  el.style.setProperty('--x', ((Math.random() - .5) * 30).toFixed(0) + '%');
  el.classList.toggle('big', !!big);
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show'); el.hidden = false;
  if (big) { const fr = bc.parentElement; fr.classList.remove('fried'); void fr.offsetWidth; fr.classList.add('fried'); shakeT = performance.now() + 350; }
  snd(big ? M.pick(['vboom', 'vboom', 'ooh']) : M.pick(['scratch', 'boing', 'brilliant', 'bonk', 'pew']));
  clearTimeout(slamT); slamT = setTimeout(() => { el.hidden = true; }, 1500);
}
// act changes no longer cover the board: just a quick toast and a sting
function showAct(t) {
  toast(`${t.act}: ${t.name}${t.act === 'THE FINALE' ? '' : '. New special moves unlocked'}`);
  snd(t.act === 'THE FINALE' ? 'airhorn' : 'dun');
  return Promise.resolve();
}
let punchFx = null;
function punch(sq, amt, dur) { punchFx = { sq, amt, start: performance.now(), dur }; }

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
  if (G.chaos !== 'calm' && !G.spcd.b && tier() >= 1 && Math.random() < .45) {
    const sp = aiSpecial();
    if (sp) { await sleep(250); await doSpecial('b', sp.at, sp.key, sp.tg); return; }
  }
  if (G.boss && Math.random() < .55) {
    I.setEnv(G);
    if (!I.inCheck(G.board, 'b')) {
      let best = -1, bd = 0;
      for (let i = 0; i < N * N; i++) { const q = G.board[i]; if (q && q.s === 'b' && BO.canHit(G, i)) { const d = BO.damageOf(q) + (q.t === 'K' ? -5 : 0) + Math.random(); if (d > bd) { bd = d; best = i; } } }
      if (best >= 0) { await sleep(200); await bossAttack('b', best); return; }
    }
  }
  if (G.items && Math.random() < .5) {
    I.setEnv(G);
    const grab = I.legalMoves(G.board, 'b').filter(m => G.items[m.t] && !m.r && !m.arm && !m.sw && G.board[m.f].t !== 'K');
    if (grab.length) { await playMove('b', grab[Math.floor(Math.random() * grab.length)]); return; }
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
// the board is turned round for whoever plays Ink online, so their army is at the bottom.
// "view" rows/cols are what's on screen; everything else uses real squares.
const FLIP = () => !!(G && G.mode === 'online' && G.me === 'b');
const vrc = sq => { const [r, c] = rc(sq); return FLIP() ? [N - 1 - r, N - 1 - c] : [r, c]; };
const unview = (r, c) => FLIP() ? (N - 1 - r) * N + (N - 1 - c) : r * N + c;
function focusOn(sq) {
  if (sq == null || sq < 0) return;
  const [r, c] = vrc(sq), vis = BS / cam.cell;
  if (c < cam.x + 1.5 || c > cam.x + vis - 2.5 || r < cam.y + 1.5 || r > cam.y + vis - 2.5) centreOn(r, c);
}
const sqXY = sq => { const [r, c] = vrc(sq); return [(c - cam.x + .5) * cam.cell, (r - cam.y + .5) * cam.cell]; };
function sqAt(px, py) { const c = Math.floor(px / cam.cell + cam.x), r = Math.floor(py / cam.cell + cam.y); return inB(r, c) ? unview(r, c) : -1; }
const boardRect = () => [-cam.x * cam.cell, -cam.y * cam.cell, (N - cam.x) * cam.cell, (N - cam.y) * cam.cell];
const miniBox = () => { const m = Math.round(Math.min(130, BS * .24)); return [BS - m - 8, 8, m]; };
// on-screen rows/cols (view = true), or the real squares they cover
function visibleRange(view = false) {
  const vis = BS / cam.cell;
  const r0 = Math.max(0, Math.floor(cam.y)), r1 = Math.min(N - 1, Math.ceil(cam.y + vis)), c0 = Math.max(0, Math.floor(cam.x)), c1 = Math.min(N - 1, Math.ceil(cam.x + vis));
  return view || !FLIP() ? [r0, r1, c0, c1] : [N - 1 - r1, N - 1 - r0, N - 1 - c1, N - 1 - c0];
}
function drawGrid(c) {
  const [r0, r1, c0, c1] = visibleRange(true), cell = cam.cell, fl = FLIP(), th = TH, now = performance.now();
  c.fillStyle = th.base; const [bx0, by0, bx1, by1] = boardRect(); c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
  if (th.disco || th.stars || th.stripes || th.shells) for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) LK.decorate(c, th, r, col, (col - cam.x) * cell, (r - cam.y) * cell, cell, now);
  // dark squares
  if (!th.hatch) { if (th.darkFill) { c.fillStyle = th.darkFill; for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) if ((r + col) % 2) c.fillRect((col - cam.x) * cell, (r - cam.y) * cell, cell, cell); } }
  else if (cell >= 14) {
    c.strokeStyle = th.dark; c.lineWidth = 1; c.beginPath();
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
    c.fillStyle = th.darkFill;
    for (let r = r0; r <= r1; r++) for (let col = c0; col <= c1; col++) if ((r + col) % 2) c.fillRect((col - cam.x) * cell, (r - cam.y) * cell, cell, cell);
  }
  // halfway line and starting zones
  c.strokeStyle = 'rgba(179,50,43,0.25)'; c.lineWidth = 2; c.setLineDash([8, 8]);
  c.beginPath(); c.moveTo(bx0, (N / 2 - cam.y) * cell); c.lineTo(bx1, (N / 2 - cam.y) * cell); c.stroke(); c.setLineDash([]);
  // grid lines
  c.strokeStyle = th.line; c.globalAlpha = cell >= 14 ? 1 : .5; c.lineWidth = Math.max(.6, Math.min(1.6, cell / 30));
  c.beginPath();
  for (let r = r0; r <= r1 + 1; r++) { const y = (r - cam.y) * cell + (I.hash(r) - .5) * .8; c.moveTo((c0 - cam.x) * cell, y); c.lineTo((c1 + 1 - cam.x) * cell, y + (I.hash(r + 7) - .5)); }
  for (let col = c0; col <= c1 + 1; col++) { const x = (col - cam.x) * cell + (I.hash(col + 3) - .5) * .8; c.moveTo(x, (r0 - cam.y) * cell); c.lineTo(x + (I.hash(col + 9) - .5), (r1 + 1 - cam.y) * cell); }
  c.stroke(); c.globalAlpha = 1;
  c.strokeStyle = K; c.lineWidth = 3; c.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
  // coordinates along the top and left edges of the view
  if (cell >= 16) {
    c.fillStyle = th.glow ? 'rgba(220,225,255,.7)' : SOFT; c.font = `${Math.round(Math.min(13, cell * .32))}px 'Patrick Hand', cursive`; c.textAlign = 'left'; c.textBaseline = 'top';
    for (let col = c0; col <= c1; col++) if (col % 2 === 0) c.fillText(colName(fl ? N - 1 - col : col), (col - cam.x) * cell + 2, Math.max(by0, 0) + 1);
    c.textBaseline = 'bottom';
    for (let r = r0; r <= r1; r++) if (r % 2 === 0) c.fillText(String(fl ? r + 1 : N - r), Math.max(bx0, 0) + 2, (r + 1 - cam.y) * cell - 1);
  }
}
function drawMinimap(c) {
  const [mx, my, m] = miniBox(), k = m / N;
  c.fillStyle = 'rgba(242,238,226,0.94)'; c.fillRect(mx, my, m, m);
  c.strokeStyle = K; c.lineWidth = 1.5; c.strokeRect(mx, my, m, m);
  c.fillStyle = 'rgba(179,50,43,0.2)'; c.fillRect(mx, my + m / 2 - .5, m, 1);
  for (let i = 0; i < N * N; i++) {
    const t = G.terr[i]; if (t && (t.k === 'pit' || t.k === 'rad' || t.k === 'fire')) { const [r, col] = vrc(i); c.fillStyle = t.k === 'rad' ? 'rgba(111,143,58,.5)' : t.k === 'fire' ? 'rgba(232,137,43,.7)' : K; c.fillRect(mx + col * k, my + r * k, k, k); }
    const p = G.board[i]; if (!p) continue;
    const [r, col] = vrc(i), big = p.t === 'K' ? 2.2 : 1;
    c.fillStyle = p.s === 'w' ? GOLD : K;
    c.fillRect(mx + col * k - (big - 1) * k / 2, my + r * k - (big - 1) * k / 2, k * big + .4, k * big + .4);
  }
  const vis = BS / cam.cell;
  c.strokeStyle = RED; c.lineWidth = 1.5; c.strokeRect(mx + Math.max(0, cam.x) * k, my + Math.max(0, cam.y) * k, Math.min(N, vis) * k, Math.min(N, vis) * k);
}
const anims = [], fx = [];
const LAZY_FX = new Set(['splat', 'say', 'dance', 'confetti', 'land', 'dust']);
function addAnim(a) {
  a.start = performance.now() + (a.delay || 0); anims.push(a);
  // pieces squash when they land and kick up a little dust
  if (a.kind === 'move' || (a.kind === 'lunge' && !a.back)) { const at = (a.delay || 0) + a.dur * (a.kind === 'lunge' ? .62 : 1); addFx({ kind: 'land', sq: a.t, delay: at, dur: 260 }); addFx({ kind: 'dust', sq: a.t, delay: at, dur: 450, s: Math.random() * 99 }); }
}
function addFx(f) { f.start = performance.now() + (f.delay || 0); fx.push(f); }
function waitAnims() {
  return new Promise(res => {
    const check = () => { const now = performance.now(); const busy = anims.some(a => now < a.start + a.dur) || fx.some(f => !LAZY_FX.has(f.kind) && now < f.start + f.dur); busy ? setTimeout(check, 40) : res(); };
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
  const key = G.ply + ':' + G.sel + ':' + (G.pend ? G.pend.idx + '/' + G.pend.first : '') + ':' + G.turn + ':' + (G.spec ? G.spec.key : '');
  if (tKey === key) return tList;
  let list = [];
  if (G.spec) list = G.spec.opts.filter(o => o >= 0).map(o => ({ sq: o, type: 'special' }));
  else if (G.pend) {
    const card = CARDS[G.pend.key], T = card.target;
    if (T.t === 'pair') {
      if (G.pend.first == null) list = [...new Set(G.pend.opts.map(o => o.a))].map(sq => ({ sq, type: 'spell' }));
      else list = G.pend.opts.filter(o => o.a === G.pend.first).map(o => ({ sq: o.b, type: 'place' }));
    } else if (T.t !== 'none') list = G.pend.opts.map(o => ({ sq: o.a, type: card.kind === 'unit' || T.t === 'empty' || T.t === 'home' ? 'place' : 'spell' }));
  } else if (G.sel >= 0) {
    I.setEnv(G);
    const pt = G.board[G.sel] && G.board[G.sel].t;
    list = I.legalMoves(G.board, G.turn).filter(m => m.f === G.sel).map(m => ({ sq: m.t, type: m.sw ? 'swap' : (m.r || (m.arm && isShooter(pt))) ? 'shoot' : m.cap ? 'cap' : 'move', m }));
    if (bossHittable(G.turn, G.sel)) for (const b of BO.squares(G.boss.at)) list.push({ sq: b, type: 'boss' });
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
  let z = 1, zx = 0, zy = 0;
  if (punchFx && G) {
    const k = (now - punchFx.start) / punchFx.dur;
    if (k >= 1) punchFx = null;
    else { const env = k < .15 ? 1 - Math.pow(1 - k / .15, 3) : k < .7 ? 1 : 1 - ease((k - .7) / .3); z = 1 + punchFx.amt * env; const [px, py] = sqXY(punchFx.sq); const fx0 = Math.max(BS * .2, Math.min(BS * .8, px)), fy0 = Math.max(BS * .2, Math.min(BS * .8, py)); zx = (BS / 2 - fx0 * z) * env + (1 - env) * (fx0 - fx0 * z); zy = (BS / 2 - fy0 * z) * env + (1 - env) * (fy0 - fy0 * z); }
  }
  c.setTransform(DPR * z, 0, 0, DPR * z, sx + zx * DPR, sy + zy * DPR);
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
  const showMine = s => G.mode === 'pvp' || s === viewer();
  for (let i = 0; i < N * N; i++) { const t = G.terr[i]; if (!t || !visible(i)) continue; const [x, y] = sqXY(i); I.drawTerrain(c, t, x, y, CELL, i, t.k !== 'mine' || showMine(t.s)); }
  if (G.items) for (let i = 0; i < N * N; i++) { const it = G.items[i]; if (!it || !visible(i) || G.board[i]) continue; const [x, y] = sqXY(i); const dk = fx.find(f => f.kind === 'drop' && f.sq === i); let yo = 0; if (dk) { const k = Math.max(0, Math.min(1, (now - dk.start) / dk.dur)); yo = -(1 - k * k) * CELL * 3; } IT.drawItem(c, it.k, x, y + yo, CELL, now, i); }
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
    else if (t.type === 'boss') { c.fillStyle = 'rgba(179,50,43,0.18)'; c.fillRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4); }
    else if (t.type === 'special') { c.fillStyle = 'rgba(122,63,184,0.16)'; c.fillRect(x - CELL / 2 + 2, y - CELL / 2 + 2, CELL - 4, CELL - 4); c.strokeStyle = '#7a3fb8'; c.lineWidth = 2.2; I.circ(c, x, y, CELL * .4, t.sq + 9, 1.2, 12); c.stroke(); }
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
    const fsz = CELL * .82 * (G.fields.bighead > 0 ? 1.55 : G.fields.tiny > 0 ? .45 : 1);
    if (TH.glow) { const gl = c.createRadialGradient(x, y, 0, x, y, CELL * .5); gl.addColorStop(0, 'rgba(242,238,226,.85)'); gl.addColorStop(1, 'rgba(242,238,226,0)'); c.fillStyle = gl; c.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL); }
    if (G.fields.flip > 0) { c.save(); c.translate(x, y); c.rotate(Math.PI); I.drawPiece(c, p.t, p.s, 0, 0, fsz, p.id * 3.7, alpha); c.restore(); }
    else {
      const ld = fx.find(f => f.kind === 'land' && f.sq === sq && now >= f.start && now < f.start + f.dur);
      if (ld) { const q = (now - ld.start) / ld.dur, sq2 = Math.sin(q * Math.PI) * (1 - q) * .5; c.save(); c.translate(x, y + CELL * .38); c.scale(1 + sq2 * .55, 1 - sq2 * .45); I.drawPiece(c, p.t, p.s, 0, -CELL * .38, fsz, p.id * 3.7, alpha); c.restore(); }
      else I.drawPiece(c, p.t, p.s, x, y, fsz, p.id * 3.7, alpha);
    }
    const hat = G.cos && G.cos[p.s] && G.cos[p.s].hat;
    if (hat && hat !== 'none' && G.fields.flip <= 0 && CELL >= 16) LK.drawHat(c, hat, x, y, fsz, now);
    I.drawBadges(c, p, x, y, CELL);
  }
  if (G.boss) { const [bx, by] = bossCentre(); BO.draw(c, G.boss, bx, by, CELL, now); }
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
    else if (f.kind === 'laser') {
      const [bx, by] = G.boss ? bossCentre() : sqXY(f.from), w = (1 - k) * CELL * .28 + 2;
      c.globalAlpha = Math.min(1, (1 - k) * 2);
      if (f.col != null) {
        const ex = sqXY(f.col)[0], ys = f.sqs.map(i => sqXY(i)[1]), lo = Math.min(...ys, by), hi = Math.max(...ys, by);
        c.fillStyle = '#ff3b2e'; c.fillRect(ex - w / 2, lo - CELL / 2, w, hi - lo + CELL);
        c.fillStyle = '#fff3ea'; c.fillRect(ex - w / 6, lo - CELL / 2, w / 3, hi - lo + CELL);
      } else {
        const ey = sqXY(f.row * N)[1], xs = f.sqs.map(i => sqXY(i)[0]), lo = Math.min(...xs, bx), hi = Math.max(...xs, bx);
        c.fillStyle = '#ff3b2e'; c.fillRect(lo - CELL / 2, ey - w / 2, hi - lo + CELL, w);
        c.fillStyle = '#fff3ea'; c.fillRect(lo - CELL / 2, ey - w / 6, hi - lo + CELL, w / 3);
      }
      c.globalAlpha = 1;
    } else if (f.kind === 'cfx') { const [x, y] = sqXY(f.sq); LK.drawCaptureFx(c, f.style, x, y, CELL, k, f.s);
    } else if (f.kind === 'dust') {
      const [x, y] = sqXY(f.sq); c.fillStyle = 'rgba(120,110,95,.5)'; c.globalAlpha = 1 - k;
      for (let i = 0; i < 6; i++) { const side = i % 2 ? 1 : -1, d = CELL * (.2 + k * .35 + I.hash(f.s + i) * .1); c.beginPath(); c.arc(x + side * d, y + CELL * .36 - k * CELL * .08 * (1 + i % 3), CELL * (.05 + .05 * I.hash(f.s + i + 3)) * (1 + k), 0, 7); c.fill(); }
      c.globalAlpha = 1;
    } else if (f.kind === 'confetti') {
      const [x, y] = sqXY(f.sq);
      for (let i = 0; i < 26; i++) { const a = I.hash(f.s + i) * Math.PI * 2, sp = .8 + I.hash(f.s + i + 40) * 1.8, px = x + Math.cos(a) * CELL * sp * Math.min(1, k * 3), py = y + Math.sin(a) * CELL * sp * .7 * Math.min(1, k * 3) - CELL * .6 * Math.sin(Math.min(1, k * 2) * Math.PI / 2) + k * k * CELL * 1.6;
        c.globalAlpha = Math.max(0, 1 - Math.max(0, k - .6) / .4); c.fillStyle = ['#e86ad6', '#f3d55b', '#5bd1f3', '#7be06a', '#b3322b'][i % 5];
        c.save(); c.translate(px, py); c.rotate(k * 12 + i); c.fillRect(-CELL * .04, -CELL * .02, CELL * .08, CELL * .04); c.restore(); }
      c.globalAlpha = 1;
    } else if (f.kind === 'flash') {
      c.fillStyle = `rgba(255,252,240,${(1 - k) * .75})`; c.fillRect(-BS, -BS, BS * 3, BS * 3);
    } else if (f.kind === 'dance') {
      const [x, y] = sqXY(f.sq); c.font = `${Math.round(CELL * .32)}px serif`; c.textAlign = 'center'; c.fillStyle = ['#7a3fb8', '#c0392b', '#1aa7a1'][f.sq % 3];
      for (let n = 0; n < 2; n++) { const kk = (k * 2 + n * .5) % 1; c.globalAlpha = 1 - kk; c.fillText(n ? '♫' : '♪', x + Math.sin((kk + n) * 6) * CELL * .25, y - CELL * .3 - kk * CELL * .5); }
      c.globalAlpha = 1;
    } else if (f.kind === 'annot') {
      const [x, y] = sqXY(f.sq), R = Math.max(9, CELL * .24), pop = k < .1 ? k / .1 : 1, bx = x + CELL * .38, by = y - CELL * .38;
      c.globalAlpha = k > .8 ? (1 - k) / .2 : 1;
      c.save(); c.translate(bx, by); c.scale(pop * (1 + .25 * Math.sin(Math.min(1, k * 6) * Math.PI)), pop);
      c.fillStyle = f.a[2]; c.strokeStyle = PAPER; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#fff'; c.font = `${Math.round(R * 1.1)}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(f.a[0], 0, R * .06);
      c.restore();
      c.font = `${Math.round(Math.max(11, CELL * .2))}px 'Patrick Hand', cursive`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.lineWidth = 3; c.strokeStyle = PAPER; c.strokeText(f.a[1], bx + R + 3, by); c.fillStyle = f.a[2]; c.fillText(f.a[1], bx + R + 3, by);
      c.globalAlpha = 1;
    } else if (f.kind === 'warp') {
      // the piece spins and shrinks into a little portal
      const [x, y] = sqXY(f.sq);
      c.strokeStyle = '#7a3fb8'; c.lineWidth = 2.2; c.globalAlpha = 1 - Math.max(0, k - .7) / .3;
      for (let r = 1; r <= 3; r++) { c.beginPath(); c.ellipse(x, y + CELL * .2, CELL * .16 * r * (.4 + k), CELL * .06 * r * (.4 + k), 0, 0, 7); c.stroke(); }
      c.save(); c.translate(x, y - k * CELL * .4); c.rotate(k * 9); I.drawPiece(c, f.p.t, f.p.s, 0, 0, CELL * .82 * Math.max(0, 1 - k), f.p.id * 3.7); c.restore();
      c.globalAlpha = 1;
    }
    else if (f.kind === 'field') {
      c.globalAlpha = Math.sin(k * Math.PI) * .6;
      const col = { quake: K, mirror: BLUE, rewind: '#8a6510', wrap: BLUE, truce: SOFT, double: GOLD, hymn: GOLD, siren: RED }[f.key] || K;
      c.strokeStyle = col; c.lineWidth = 6; c.strokeRect(6, 6, BS - 12, BS - 12);
      if (f.key === 'rewind') { c.fillStyle = 'rgba(201,154,28,0.12)'; c.fillRect(0, 0, BS, BS); }
      c.globalAlpha = 1;
    }
  }
  // speech bubbles on top of everything
  for (const f of fx) {
    if (f.kind !== 'say' || now < f.start || now > f.start + f.dur) continue;
    let sq = f.sq;
    if (f.id) { const j = G.board.findIndex(q => q && q.id === f.id); if (j >= 0) sq = j; else if (!anims.some(a => a.p && a.p.id === f.id)) continue; }
    if (!visible(sq)) continue;
    const k = (now - f.start) / f.dur, [x, y] = sqXY(sq), pop = Math.min(1, (now - f.start) / 140);
    c.save(); c.translate(x, y); c.scale(.6 + .4 * pop, .6 + .4 * pop); c.translate(-x, -y);
    TK.drawBubble(c, f.text, x, y + (f.loud ? Math.sin(now / 40) * 1.5 : 0), CELL, k > .85 ? (1 - k) / .15 : 1, [0, 0, BS, BS], f.loud);
    c.restore();
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
  else if (['curse', 'goo', 'mutate'].includes(key)) { c.strokeStyle = GREEN; c.lineWidth = 1.6; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x + (I.hash(i) - .5) * CELL, y - k * CELL * .8 + I.hash(i + 4) * CELL * .3, 3 + i % 3, 0, 7); c.stroke(); } }
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
  if (G.spec) {
    if (hit) { doSpecial(side, G.spec.at, G.spec.key, sq); return; }
    G.spec = null; tKey = null; refresh(); return;
  }
  if (G.pend) {
    if (!hit) { if (G.pend.first != null) { G.pend.first = null; tKey = null; refresh(); } return; }
    if (CARDS[G.pend.key].target.t === 'pair') {
      if (G.pend.first == null) { G.pend.first = sq; tKey = null; refresh(); return; }
      playCard(side, G.pend.idx, { a: G.pend.first, b: sq }); return;
    }
    playCard(side, G.pend.idx, G.pend.opts.find(o => o.a === sq)); return;
  }
  if (hit && hit.m) { playMove(side, hit.m); return; }
  if (hit && hit.type === 'boss') { bossAttack(side, G.sel); return; }
  const p = G.board[sq];
  G.sel = p && p.s === side ? (G.sel === sq ? -1 : sq) : -1;
  if (G.sel >= 0 && p.fz > 0) { toast(`That ${U[p.t].name} is frozen`); G.sel = -1; }
  else if (G.sel >= 0) { snd('pick'); I.setEnv(G); if (!I.legalMoves(G.board, side).some(m => m.f === sq) && !bossHittable(side, sq)) toast(`That ${U[p.t].name} can't move right now`); }
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
  G.sel = -1; G.pend = null; G.spec = null; tKey = null; refresh();
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
    html = G.over.winner ? `<b>${G.over.why === 'checkmate' ? 'Checkmate.' : ''} ${winText(G.over.winner)}</b>` : '<b>Draw.</b>';
    html += ' <button class="btn small" id="stAgain" type="button">Play again</button>';
  } else if (G.mode === 'ai' && G.turn === 'b') html = '<span class="thinking">The Ink Baron is thinking</span>';
  else if (G.mode === 'online' && G.turn !== G.me) html = G.me ? `<span class="thinking">Your friend is playing</span>${NET.friendHere ? '' : ' <b class="warn">(your friend has left: they can rejoin with code <code>' + NET.code + '</code>)</b>'}` : `<span class="thinking">Watching: ${who(G.turn)} to move</span>`;
  else if (G.lock) html = '…';
  else if (G.spec) html = `<b class="spx">${M.BY_KEY[G.spec.key].name}</b>: pick a purple square. <button class="btn small ghost" id="stCancel" type="button">Cancel</button>`;
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
    const chk = I.inCheck(G.board, G.turn), name = G.mode === 'pvp' ? who(G.turn) + '\'s' : 'Your';
    html = chk ? `<b class="warn">Check!</b> ${name} king is under attack. Move it, block, capture, or play a card that helps.` : `${name} move. Move a piece or play a card.`;
  }
  st.innerHTML = html;
  const again = $('#stAgain'); if (again) again.onclick = openStart;
  const cancel = $('#stCancel'); if (cancel) cancel.onclick = () => { G.pend = null; G.spec = null; tKey = null; refresh(); };
  const play = $('#stPlay'); if (play) play.onclick = () => playCard(G.turn, G.pend.idx, G.pend.opts[0]);
}
function renderBar(el, side) {
  const isTurn = G.turn === side && !G.over, hand = G.hand[side].length;
  el.classList.toggle('active', isTurn);
  const ttl = G.cos ? LK.titleText(G.cos[side]) : '';
  el.innerHTML = `<span class="who"><span class="dot ${side}"></span>${who(side)}${ttl ? ` <i class="title">${ttl}</i>` : ''}</span><span class="meta"><span class="coin-ico" aria-hidden="true"></span>${G.coins[side]}<span class="sep">·</span>${hand} card${hand === 1 ? '' : 's'}</span>`;
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
function renderRot() {
  const el = $('#rot'); if (!el) return;
  const on = G.chaos !== 'calm'; el.hidden = !on; if (!on) return;
  const t = M.TIERS[tier()], v = Math.round(G.rot || 0);
  el.querySelector('i').style.width = v + '%';
  el.querySelector('.rot-act').textContent = `${t.act}: ${t.name}`;
  el.querySelector('.rot-n').textContent = v >= 100 ? 'MAX' : v + '%';
  el.classList.toggle('hot', v >= 75);
}
function renderSpecials() {
  const el = $('#specials'); if (!el) return;
  const side = G.turn, myTurn = humanTurn() && !G.lock && !G.recycle;
  const p = G.sel >= 0 ? G.board[G.sel] : null;
  if (!myTurn || !p || p.s !== side || G.chaos === 'calm') {
    const nxt = M.SPECIALS.filter(s => s.tier > tier() && s.tier < 6);
    el.innerHTML = G.chaos === 'calm' || !myTurn ? '' : `<p class="hint">Tap one of your pieces to see its <b>special moves</b>.${nxt.length && tier() < 5 ? ` More unlock as the Brainrot meter fills.` : ''}${G.spcd[side] ? ` Specials recharge in ${G.spcd[side]} turn${G.spcd[side] > 1 ? 's' : ''}.` : ''}</p>`;
    el.hidden = !el.innerHTML; return;
  }
  const list = M.specialsFor(G, G.sel, side);
  const locked = M.SPECIALS.filter(s => s.who(p.t) && (s.tier > tier() || (s.tier >= 5 && !G.finale)));
  const cd = G.spcd[side];
  let html = `<div class="sp-head">Special moves: ${U[p.t].name}${cd ? ` <span class="sp-cd">recharging, ${cd} turn${cd > 1 ? 's' : ''}</span>` : ''}</div><div class="sp-list">`;
  for (const { sp, opts } of list) html += `<button type="button" class="sp-btn${G.spec && G.spec.key === sp.key ? ' on' : ''}" data-k="${sp.key}" ${cd ? 'disabled' : ''}><b>${sp.name}</b>${sp.free ? '<span class="sp-free">free</span>' : ''}<span>${opts[0] < 0 ? 'no target' : opts.length + ' target' + (opts.length > 1 ? 's' : '')}</span></button>`;
  for (const sp of locked.slice(0, 3)) html += `<span class="sp-lock">🔒 ${sp.name} <i>(${sp.tier >= 5 ? 'finale' : M.TIERS[sp.tier].act})</i></span>`;
  if (!list.length && !locked.length) html += '<span class="sp-lock">Nothing it can do right now</span>';
  else if (!list.length) html += '<span class="sp-lock">No specials it can use from here</span>';
  html += '</div>';
  el.innerHTML = html; el.hidden = false;
  el.querySelectorAll('.sp-btn').forEach(b => b.onclick = () => {
    const it = list.find(x => x.sp.key === b.dataset.k); if (!it || G.lock) return;
    unlockAudio();
    if (it.opts[0] < 0) { doSpecial(side, G.sel, it.sp.key, -1); return; }
    G.spec = G.spec && G.spec.key === it.sp.key ? null : { at: G.sel, key: it.sp.key, opts: it.opts };
    G.pend = null; tKey = null; snd('pick'); refresh();
  });
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
  $('#handTitle').textContent = (G.mode !== 'pvp' ? 'Your hand' : `${poss(side)} hand`) + ` (${G.hand[side].length}/${I.HAND_MAX})`;
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
  // the bars sit next to their army: online, your own army is always at the bottom
  renderBar($('#oppBar'), G.mode === 'pvp' ? other(G.turn) : other(viewer()));
  renderBar($('#meBar'), G.mode === 'pvp' ? G.turn : viewer());
  renderFields(); renderShop(); renderHand(); renderSpecials(); renderRot();
  if (I.Music) I.Music.setLevel(G.over ? 0 : tier(), !!G.boss && !G.over);
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
  G.sel = -1; G.spec = null; G.pend = { idx, key, opts, first: null };
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

// ===================================================================== online
// Two Chromebooks, one game: both open this game page (shared through Claude's Share menu) and use the same code.
// At the end of each turn the player who moved sends the whole game (compressed, ~1 KB) as their "presence" in a
// named room; the other page animates the difference and carries on. Presence is re-sent automatically if the
// connection blips, and late joiners get it straight away, so reloading or spectating just works.
const NET = { api: null, room: null, code: null, seq: 0, applied: 0, caps: [], logSent: 0, applying: false, friendHere: false, started: false, unsub: null, queue: Promise.resolve() };
const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
// inside Claude: the page's live room. Anywhere else (GitHub Pages, a downloaded copy): PeerJS (netpeer.js)
// outside Claude: a public MQTT server (works on most networks), falling back to direct PeerJS connections
const PEER_API = { kind: 'peer', async join(name) {
  try { return await I.MqttRoom.join(name); }
  catch (e) { console.warn('[chess2] MQTT failed, trying PeerJS', e); try { return await I.PeerRoom.join(name); } catch (e2) { console.warn('[chess2] PeerJS failed', e2); throw e; } }
} };
const netErr = (e, fallback) => (e && e.message && /library|online server/.test(e.message)) ? e.message.replace(/ \(.*\)$/, '') : fallback;
NET.api = window.claude && window.claude.use ? null : PEER_API;
(async () => {
  if (!window.claude || !window.claude.use) { renderOnlinePanel(); return; }
  let room = null; try { room = await window.claude.use('room'); } catch (e) { room = null; }
  NET.api = room || PEER_API;
  renderOnlinePanel();
})();
async function packState(extra) {
  const keep = ['board', 'terr', 'items', 'coins', 'hand', 'grave', 'fields', 'extra', 'turn', 'ply', 'quiet', 'over', 'rot', 'actShown', 'limbo', 'spcd', 'finale', 'gems', 'boss', 'chaos', 'last', 'cos'];
  const st = {}; for (const k of keep) st[k] = G[k];
  const body = JSON.stringify({ st, ...extra });
  const cs = new Blob([body]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const buf = new Uint8Array(await new Response(cs).arrayBuffer());
  let bin = ''; for (let i = 0; i < buf.length; i += 4096) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 4096));
  return btoa(bin);
}
async function unpackState(z) {
  const bin = atob(z), buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return JSON.parse(await new Response(ds).text());
}
async function netPublish(kind = 'turn') {
  if (!NET.room || !G.me) return;
  NET.seq = Math.max(NET.seq, NET.applied) + 1;
  const logs = G.log.filter(l => l.n > NET.logSent).slice(0, 10).reverse().map(l => ({ text: l.text.slice(0, 220), cls: l.cls }));
  NET.logSent = logN;
  const caps = NET.caps.splice(0);
  let z = await packState({ seq: NET.seq, kind, caps, logs, by: G.me });
  if (z.length > 3600) z = await packState({ seq: NET.seq, kind, caps: caps.slice(-1), logs: logs.slice(-2), by: G.me });
  if (z.length > 3800) { toast('The game got too big to send. Try a new game.'); return; }
  try { await NET.room.presence({ side: G.me, seq: NET.seq, z }); } catch (e) { toast('Couldn\'t reach your friend. Retrying...'); setTimeout(() => NET.room && NET.room.presence({ side: G.me, seq: NET.seq, z }).catch(() => {}), 2000); }
  refresh();
}
function onlineSides(peers) { const taken = new Set(); for (const p of peers) if (!p.sameTab && p.presence && p.presence.side) taken.add(p.presence.side); return taken; }
async function joinRoom(code) {
  if (!NET.api) return null;
  if (NET.room) { try { NET.unsub && NET.unsub(); await NET.room.leave(); } catch (e) { /* already gone */ } }
  NET.room = await NET.api.join('chess2-' + code);
  NET.code = code;
  NET.unsub = NET.room.onPeers(ch => { NET.queue = NET.queue.then(() => onPeersChange(ch)).catch(err => console.warn('[chess2] online', err)); });
  return NET.room;
}
async function onPeersChange(ch) {
  const others = ch.peers.filter(p => !p.sameTab);
  const mine = NET.mySide, friend = mine ? others.find(p => p.presence && p.presence.side === other(mine)) : null;
  const was = NET.friendHere; NET.friendHere = !!friend;
  if (G && G.mode === 'online' && G.me && was !== NET.friendHere) { toast(NET.friendHere ? 'Your friend is here' : 'Your friend left the game'); refresh(); }
  // host: a friend took the other seat and no game has started yet -> start one
  if (NET.role === 'host' && !NET.started && friend) { NET.started = true; startOnlineGame(); return; }
  // anybody: apply the newest game state someone else is showing
  let best = null;
  for (const p of others) { const pr = p.presence || {}; if (typeof pr.seq === 'number' && typeof pr.z === 'string' && pr.seq > NET.applied && (!best || pr.seq > best.presence.seq)) best = p; }
  if (best) await applyRemote(best.presence);
  renderOnlinePanel();
}
function startOnlineGame() {
  const keepMe = G && G.me;
  newGame('online');
  G.me = NET.mySide || 'w';
  G.cos = { w: LK.look(), b: null };
  NET.applied = NET.seq; NET.caps.length = 0; NET.logSent = logN;
  addLog(`Online game started with code ${NET.code}. You play ${G.me === 'w' ? 'Paper (you move first)' : 'Ink'}.`, 'actlog');
  $('#startOverlay').hidden = true; closeReplay();
  focusOn(I.kingSq(G.board, G.me));
  refresh(); netPublish('start');
}
function onlineRematch() {
  if (NET.mySide !== 'w') { toast('Ask whoever plays Paper to start the rematch'); return; }
  startOnlineGame();
}
async function applyRemote(pr) {
  let data; try { data = await unpackState(pr.z); } catch (e) { console.warn('[chess2] bad state', e); return; }
  if (data.seq <= NET.applied) return;
  NET.applying = true;
  try {
    const fresh = !G || G.mode !== 'online' || data.kind === 'start';
    const before = fresh ? null : G.board.slice(), beforeItems = fresh ? null : (G.items || []).slice();
    if (fresh) {
      newGame('online');
      G.me = NET.mySide || null;
      $('#startOverlay').hidden = true; closeReplay();
      if (G.me) addLog(`Joined online game ${NET.code}. You play ${G.me === 'w' ? 'Paper' : 'Ink'}.`, 'actlog');
      else addLog(`Watching online game ${NET.code}.`, 'actlog');
    }
    // the NUKE gets its cutscene on both screens
    if (!fresh && data.caps && data.caps.some(c => /plays NUKE/.test(c.text))) { refresh(); await nukeCutscene(); }
    Object.assign(G, data.st);
    if (G.me) { G.cos = { ...(G.cos || {}), [G.me]: LK.look() }; }
    G.sel = -1; G.pend = null; G.spec = null; G.recycle = null; G.lock = false; tKey = null;
    let maxId = 0; for (const p of G.board) if (p && p.id > maxId) maxId = p.id; for (const e of G.limbo || []) if (e.p && e.p.id > maxId) maxId = e.p.id; I.bumpPid(maxId);
    NET.applied = data.seq; NET.seq = Math.max(NET.seq, data.seq);
    for (const l of data.logs || []) addLog(G.me ? flipYou(l.text) : l.text.replace(/\bYour friend's\b/g, 'X\'s').replace(/\bYour friend\b/g, 'X').replace(/\bYour\b/g, `${data.by === 'w' ? 'Paper' : 'Ink'}'s`).replace(/\bYou\b/g, data.by === 'w' ? 'Paper' : 'Ink').replace(/\bX('s)?\b/g, (m, a) => (data.by === 'w' ? 'Ink' : 'Paper') + (a || '')), l.cls);
    NET.logSent = logN;
    I.setEnv(G);
    if (before) animateDiff(before);
    // replay their captions one after another
    (data.caps || []).forEach((c, i) => setTimeout(() => { meme(c.text, { react: c.react, sq: c.sq, big: c.big, remote: true }); }, i * 1300));
    if (!fresh && G.me && (G.over || Math.random() < .5)) setTimeout(() => comment(G.over ? 'mate' : 'friend', { A: team(data.by) }, { big: !!G.over, clip: G.over ? 'goal' : null }), 900);
    const last = (data.caps || [])[data.caps.length - 1];
    if (before && last) clip((last.big ? 5 : 2) + (last.react ? 1 : 0), before, beforeItems, -1, last.sq >= 0 ? last.sq : (G.last ? G.last.t : 112), last.text, last.react, 'FRIEND');
    if (G.last) focusOn(G.last.t);
    refresh();
    if (G.over) { snd(G.over.winner && G.over.winner === G.me ? 'win' : 'trombone'); bankAtEnd(); setTimeout(offerReplay, 3200); }
    else if (G.me && G.turn === G.me) { snd('ding'); toast('Your turn'); if (I.inCheck(G.board, G.me)) { addLog('You are in check!', 'warn'); snd('check'); } }
  } finally { NET.applying = false; }
}
// the sender wrote the log from their side: swap "You" and "Your friend"
function flipYou(t) {
  return t.replace(/Your friend's/g, '\u0001').replace(/Your friend/g, '\u0002')
    .replace(/\bYour\b/g, 'Your friend\'s').replace(/\bYou are\b/g, 'Your friend is').replace(/\bYou take\b/g, 'Your friend takes').replace(/\bYou win\b/g, 'Your friend wins').replace(/\bYou\b/g, 'Your friend')
    .replace(/\u0001/g, 'Your').replace(/\u0002 is\b/g, 'You are').replace(/\u0002 takes\b/g, 'You take').replace(/\u0002 wins\b/g, 'You win').replace(/\u0002/g, 'You');
}
// slide pieces that moved, knock away pieces that vanished, pop in new ones
function animateDiff(beforeBoard) {
  const before = new Map(); beforeBoard.forEach((p, i) => { if (p) before.set(p.id, { p, i }); });
  const after = new Map(); G.board.forEach((p, i) => { if (p) after.set(p.id, { p, i }); });
  for (const [id, a] of after) {
    const b = before.get(id);
    if (!b) addFx({ kind: 'summon', sq: a.i, dur: 700, big: true });
    else if (b.i !== a.i) addAnim({ kind: 'move', p: a.p, f: b.i, t: a.i, dur: 420, fly: true });
    else if (b.p.t !== a.p.t || b.p.s !== a.p.s) addFx({ kind: 'spell', key: 'mutate', sq: a.i, dur: 800 });
  }
  let n = 0;
  for (const [id, b] of before) if (!after.has(id)) { const a = Math.random() * Math.PI * 2; addFx({ kind: 'fling', p: b.p, sq: b.i, dir: [Math.cos(a), Math.sin(a) - .6], delay: 300, dur: 850, s: id }); if (n++ < 1) say(b.i, 'dying', { p: b.p, dead: true, delay: 350 }); }
  if (n) setTimeout(() => snd('hit'), 300); else snd('tap');
}
// ---- online panel on the start screen
function renderOnlinePanel() {
  const el = $('#onlinePanel'); if (!el) return;
  const avail = !!NET.api, peer = NET.api === PEER_API;
  $('#onlineOff').hidden = avail; $('#onlineOn').hidden = !avail;
  $('#onlineHintClaude').hidden = peer; $('#onlineHintWeb').hidden = !peer;
  const st = $('#onlineStatus');
  if (!avail || !st) return;
  if (!NET.room) st.textContent = '';
  else if (NET.role === 'host' && !NET.started) st.innerHTML = `Your code is <b class="code">${NET.code}</b>. Send it to your friend: they open this same game page, press <b>Play online</b> and type it in. Waiting for them to join...`;
  else if (NET.mySide === null && NET.role === 'join') st.textContent = 'Both seats are taken, so you\'re watching.';
}
async function hostOnline() {
  unlockAudio();
  let code = ''; for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  NET.role = 'host'; NET.mySide = 'w'; NET.started = false; NET.seq = 0; NET.applied = 0;
  $('#onlineStatus').textContent = 'Connecting to the online server...';
  try { await joinRoom(code); await NET.room.presence({ side: 'w', seq: 0 }); }
  catch (e) { console.warn('[chess2] host', e); $('#onlineStatus').textContent = netErr(e, 'Couldn\'t open an online game. Check your internet connection and try again.'); return; }
  renderOnlinePanel();
}
async function joinOnline() {
  unlockAudio();
  const code = ($('#onlineCode').value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (code.length < 4) { $('#onlineStatus').textContent = 'Type the code your friend gave you.'; return; }
  NET.role = 'join'; NET.seq = 0; NET.applied = 0; NET.started = true;
  $('#onlineStatus').textContent = 'Connecting to the online server...';
  try { await joinRoom(code); } catch (e) { console.warn('[chess2] join', e); $('#onlineStatus').textContent = netErr(e, 'Couldn\'t join that game. Check the code and your internet connection, then try again.'); return; }
  // wait a moment for everyone already there to show up, then take a free seat
  $('#onlineStatus').textContent = `Looking for game ${code}...`;
  for (let t = 0; t < 30 && onlineSides(NET.room.peers()).size === 0; t++) await sleep(t < 8 ? 200 : 300);
  await sleep(300);
  const taken = onlineSides(NET.room.peers());
  if (!taken.size) { $('#onlineStatus').textContent = `Game ${code} wasn't found. Check the code (it's 5 letters and numbers), and make sure your friend pressed Host a game and still has that screen open.`; await NET.room.leave(); NET.room = null; return; }
  NET.mySide = !taken.has('b') ? 'b' : !taken.has('w') ? 'w' : null;
  await NET.room.presence({ side: NET.mySide, seq: 0 });
  if (G && G.mode === 'online') G.me = NET.mySide;
  renderOnlinePanel();
  // pick up the current game from whoever is there
  NET.queue = NET.queue.then(() => onPeersChange({ peers: NET.room.peers() }));
}
$('#btnOnline').addEventListener('click', () => { const p = $('#onlinePanel'); p.hidden = !p.hidden; renderOnlinePanel(); if (!p.hidden && NET.api) $('#onlineCode').focus(); });
$('#onlineHost').addEventListener('click', hostOnline);
$('#onlineJoin').addEventListener('click', joinOnline);
$('#onlineCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinOnline(); });

// ===================================================================== the Locker (cosmetics shop)
let lockerTab = 'hat';
function openLocker() { unlockAudio(); $('#lockerOverlay').hidden = false; renderLocker(); $('#lockerClose').focus(); }
function renderLocker() {
  const p = LK.load();
  $('#lockerBank').textContent = p.bank;
  $('#lockerTabs').innerHTML = LK.TABS.map(([k, label]) => `<button type="button" class="btn small${k === lockerTab ? ' primary' : ''}" data-tab="${k}" aria-pressed="${k === lockerTab}">${label}</button>`).join('');
  $('#lockerTabs').querySelectorAll('button').forEach(b => b.onclick = () => { lockerTab = b.dataset.tab; renderLocker(); });
  const grid = $('#lockerGrid'); grid.innerHTML = '';
  for (const it of LK.CATALOG[lockerTab]) {
    const owned = LK.owns(lockerTab, it.id), on = p.eq[lockerTab] === it.id;
    const card = document.createElement('div'); card.className = 'lk-item' + (on ? ' on' : '');
    const cv = document.createElement('canvas'); cv.width = 180; cv.height = 120; cv.className = 'lk-prev';
    const label = document.createElement('b'); label.textContent = it.name;
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn small' + (owned ? '' : ' primary');
    btn.textContent = on ? 'Equipped' : owned ? 'Equip' : `Buy · ${it.price}`;
    btn.disabled = on || (!owned && p.bank < it.price);
    btn.onclick = () => {
      if (!owned) { const r = LK.buy(lockerTab, it.id); if (!r.ok) { toast(r.why); return; } snd('legend'); toast(`${it.name} unlocked!`); }
      else { LK.equip(lockerTab, it.id); snd('pick'); }
      applyLook(); renderLocker();
    };
    card.append(cv, label, btn); grid.appendChild(card);
    drawLockerPreview(cv, lockerTab, it.id);
  }
}
function drawLockerPreview(cv, kind, id) {
  const c = cv.getContext('2d'), W = cv.width, H = cv.height, now = performance.now();
  c.fillStyle = '#f2eee2'; c.fillRect(0, 0, W, H);
  if (kind === 'theme') {
    const th = LK.theme(id), cell = 30;
    c.fillStyle = th.base; c.fillRect(0, 0, W, H);
    for (let r = 0; r < 4; r++) for (let col = 0; col < 6; col++) { LK.decorate(c, th, r, col, col * cell, r * cell, cell, now); if ((r + col) % 2 && (th.darkFill || th.dark)) { c.fillStyle = th.darkFill || th.dark; c.fillRect(col * cell, r * cell, cell, cell); } }
    c.strokeStyle = th.line; c.lineWidth = 1; for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(i * cell, 0); c.lineTo(i * cell, H); c.stroke(); } for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * cell); c.lineTo(W, i * cell); c.stroke(); }
    if (th.glow) { const gl = c.createRadialGradient(75, 75, 0, 75, 75, 18); gl.addColorStop(0, 'rgba(242,238,226,.85)'); gl.addColorStop(1, 'rgba(242,238,226,0)'); c.fillStyle = gl; c.fillRect(57, 57, 36, 36); }
    I.drawPiece(c, 'N', 'w', 75, 75, 26, 3); I.drawPiece(c, 'Q', 'b', 105, 45, 26, 5);
  } else if (kind === 'hat') {
    I.drawPiece(c, 'P', 'w', 60, 70, 64, 1); I.drawPiece(c, 'K', 'w', 125, 70, 64, 2);
    LK.drawHat(c, id, 60, 70, 64, now); LK.drawHat(c, id, 125, 70, 64, now);
  } else if (kind === 'fx') {
    I.drawPiece(c, 'R', 'w', 90, 70, 60, 4);
    if (id === 'ink') { c.fillStyle = '#1e1c24'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(90 + Math.cos(i) * 40, 60 + Math.sin(i * 1.7) * 25, 3 + (i % 3) * 2, 0, 7); c.fill(); } }
    else LK.drawCaptureFx(c, id, 90, 60, 50, .3, 7);
  } else {
    c.font = '18px "Patrick Hand", cursive'; c.fillStyle = '#1e1c24'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('You', W / 2, H * .38);
    c.font = 'italic 17px "Patrick Hand", cursive'; c.fillStyle = '#7a3fb8'; c.fillText(id === 'none' ? '(no title)' : LK.find('title', id).name, W / 2, H * .62, W - 12);
  }
}
// put on what you just bought / equipped: your board, and your pieces in this game
function applyLook() {
  TH = LK.theme(LK.load().eq.theme);
  if (G && G.cos) { const me = mySide() || 'w'; G.cos[me] = LK.look(); if (G.mode === 'pvp') G.cos.b = LK.look(); }
  refresh();
}
$('#btnLocker').addEventListener('click', openLocker);
$('#startLocker').addEventListener('click', openLocker);
$('#replayLocker').addEventListener('click', () => { closeReplay(); openLocker(); });
$('#lockerClose').addEventListener('click', () => { $('#lockerOverlay').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lockerOverlay').hidden) $('#lockerOverlay').hidden = true; });

async function summonBossNow() {
    unlockAudio();
    $('#unitsOverlay').hidden = true;
    if (G.boss) { toast(`${bossName()} is already here`); focusOn(G.boss.at); return; }
    if (G.over) { toast('Start a new game first'); return; }
    if (G.mode === 'online' && !humanTurn()) { toast(`${bossName()} can only be summoned on your turn`); return; }
    if (G.lock) { toast(`${bossName()} will land when it's your turn`); bossQueued = true; return; }
    G.lock = true; await spawnBoss(); G.lock = false; refresh();
    if (!G.boss) toast(`${bossName()} couldn't find anywhere to land`);
    if (G.mode === 'ai' && G.turn === 'b') aiTurn();
}
// ---- units & cards guide
function buildGuide() {
  const grid = $('#unitsGrid'); if (grid.dataset.built) return; grid.dataset.built = '1';
  const START = ['K', 'Q', 'R', 'B', 'N', 'A', 'P'];
  const nukeBtn = document.createElement('button'); nukeBtn.type = 'button'; nukeBtn.className = 'btn'; nukeBtn.textContent = 'Watch the NUKE cutscene';
  nukeBtn.onclick = () => { unlockAudio(); nukeCutscene(); }; grid.appendChild(nukeBtn);
  const bossBtn = document.createElement('button'); bossBtn.className = 'btn'; bossBtn.type = 'button'; bossBtn.style.marginLeft = '8px';
  bossBtn.textContent = 'Summon a boss now';
  bossBtn.onclick = () => summonBossNow();
  grid.appendChild(bossBtn);
  { const h = document.createElement('h3'); h.textContent = 'Special moves (unlocked by the Brainrot meter)'; grid.appendChild(h);
    const ul = document.createElement('ul'); ul.className = 'sp-guide'; grid.appendChild(ul);
    for (const sp of M.SPECIALS) { const li = document.createElement('li'); li.innerHTML = `<b>${sp.name}</b> <i>(${sp.tier >= 5 ? 'Finale' : M.TIERS[sp.tier].act})</i>: ${sp.desc}`; ul.appendChild(li); } }
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
  if (I.Music) I.Music.duck(true);
  const music = startNukeMusic();
  let skip = null;
  const quality = cineQuality();
  const p = I.runNukeCinematic(cv, { glCanvas: $('#cutsceneGL'), video: $('#cutsceneVideo'), videoSrc: 'assets/nuke-cinematic.mp4', quality, music, sfx: snd, lines: NUKE_LINES, cast: castCache, onSkip: fn => { skip = fn; },
    onFallback: why => toast(why === 'movie' ? 'The cutscene movie couldn\'t load, so the simple version played' : 'Your device was struggling, so the cutscene switched to the simple version') });
  const finish = () => { if (skip) skip(); };
  ov.onclick = finish; $('#cutSkip').onclick = e => { e.stopPropagation(); finish(); };
  return p.then(() => { music.stop(); ov.hidden = true; ov.onclick = null; if (I.Music) setTimeout(() => I.Music.duck(false), 1200); });
}
// ===================================================================== audio
let AC = null, muted = false, noiseBuf = null;
function unlockAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); noiseBuf = AC.createBuffer(1, AC.sampleRate * .6, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } catch (e) { AC = null; }
  if (AC && I.Music) { I.Music.start(AC); I.Music.setOn(musicOn && !muted); }
}
// background music: on unless you turned it off (remembered)
let musicOn = true; try { musicOn = localStorage.getItem('chess2.music') !== 'off'; } catch (e) { /* default on */ }
function renderMusicBtn() { const b = $('#btnMusicOn'); if (!b) return; b.textContent = musicOn ? 'Music on' : 'Music off'; b.setAttribute('aria-pressed', String(musicOn)); }
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
    case 'spin': noise(.08, .05, 3000, 0, 'highpass'); break;
    case 'tick': tone('square', 1200, 1100, .03, .02); break;
    case 'ding': [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, .25, .05, i * .07)); break;
    case 'whoosh': noise(.22, .18, 1800, 0, 'bandpass'); break;
    case 'scream': tone('sawtooth', 900, 1500, .5, .05); tone('square', 600, 1300, .5, .03); noise(.5, .15, 3000, 0, 'bandpass'); break;
    case 'nukeboom': noise(3.5, .9, 160); tone('sine', 60, 18, 3.2, .35); noise(.4, .5, 4000, 0, 'highpass'); break;
    case 'nukeroar': noise(4.5, .35, 420, .3); noise(4.8, .25, 90, .8); break;
    case 'laser': tone('sawtooth', 1400, 180, .7, .06); tone('square', 700, 120, .7, .03); break;
    case 'rumble': noise(3.5, .12, 120); tone('sine', 45, 38, 3.5, .08); break;
    case 'whistle': tone('sine', 2200, 420, 1.3, .05); tone('triangle', 1100, 210, 1.3, .03); break;
    case 'tinnitus': tone('sine', 4100, 4000, 4.5, .025); break;
    case 'vboom': { // deep dramatic boom with a fake echo
      for (const [at, v] of [[0, .32], [.16, .12], [.34, .05]]) { tone('sine', 120, 38, 1.1, v, at); noise(.5, v * .8, 220, at); }
      break; }
    case 'airhorn': for (let k = 0; k < 3; k++) { const at = k * .2, d = k === 2 ? .55 : .14; for (const f of [466, 587, 698]) tone('sawtooth', f, f * .985, d, .025, at); } break;
    case 'trombone': [392, 370, 349].forEach((f, i) => tone('sawtooth', f, f * .99, .32, .035, i * .36)); { const g = AC.createGain(), o = AC.createOscillator(), l = AC.createOscillator(), lg = AC.createGain(); o.type = 'sawtooth'; o.frequency.value = 330; l.frequency.value = 6; lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(.035, now + 1.08); g.gain.exponentialRampToValueAtTime(.0001, now + 2.2); o.connect(g); g.connect(AC.destination); o.start(now + 1.08); l.start(now + 1.08); o.stop(now + 2.25); l.stop(now + 2.25); } break;
    case 'dun': tone('sawtooth', 196, 194, .22, .05); tone('sawtooth', 185, 183, .22, .05, .3); tone('sawtooth', 156, 150, 1.1, .06, .62); tone('sine', 78, 70, 1.2, .12, .62); break;
    case 'scratch': noise(.09, .3, 1400, 0, 'bandpass'); noise(.12, .3, 800, .1, 'bandpass'); break;
    case 'boing': tone('sine', 180, 520, .09, .08); tone('sine', 520, 260, .3, .06, .09); break;
    case 'brilliant': [784, 988, 1175, 1568].forEach((f, i) => tone('triangle', f, f, .18, .045, i * .06)); break;
    case 'win': [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, .4, .06, i * .14)); break;
    case 'cluck': for (let k = 0; k < 3; k++) { tone('square', 700 + k * 60, 380, .07, .05, k * .11); noise(.05, .12, 2200, k * .11, 'bandpass'); } tone('square', 900, 500, .2, .05, .36); break;
    case 'neigh': { const g = AC.createGain(), o = AC.createOscillator(), l = AC.createOscillator(), lg = AC.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900, now); o.frequency.exponentialRampToValueAtTime(420, now + .9); l.frequency.value = 18; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(.05, now + .05); g.gain.exponentialRampToValueAtTime(.0001, now + 1); o.connect(g); g.connect(AC.destination); o.start(now); l.start(now); o.stop(now + 1.05); l.stop(now + 1.05); } break;
    case 'splat': noise(.25, .4, 600); tone('sine', 220, 60, .2, .1); noise(.15, .15, 2500, .05, 'bandpass'); break;
    case 'pew': for (let k = 0; k < 3; k++) tone('square', 1600, 300, .12, .035, k * .12); break;
    case 'bonk': tone('triangle', 700, 340, .09, .14); noise(.03, .3, 3000, 0, 'highpass'); tone('sine', 160, 120, .12, .08); break;
    case 'ooh': { // a cheesy crowd "ooooh": a few detuned voices swooping down through a vowel filter
      for (const [f, d] of [[220, 0], [262, .01], [330, .02], [196, .015]]) { const g = AC.createGain(), o = AC.createOscillator(), fl = AC.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.05, now + d); o.frequency.exponentialRampToValueAtTime(f * .85, now + 1.1); fl.type = 'bandpass'; fl.Q.value = 6; fl.frequency.setValueAtTime(700, now); fl.frequency.exponentialRampToValueAtTime(400, now + 1.1); g.gain.setValueAtTime(.0001, now); g.gain.exponentialRampToValueAtTime(.05, now + .15); g.gain.exponentialRampToValueAtTime(.0001, now + 1.2); o.connect(fl); fl.connect(g); g.connect(AC.destination); o.start(now + d); o.stop(now + 1.25); }
      noise(1.1, .04, 900, 0, 'bandpass'); break; }
  }
}

// ===================================================================== wiring
$('#packDone').addEventListener('click', closeOverlays);
const openGuide = () => { buildGuide(); $('#unitsOverlay').hidden = false; $('#unitsClose').focus(); };
$('#btnUnits').addEventListener('click', openGuide);
$('#startUnits').addEventListener('click', openGuide);
$('#unitsClose').addEventListener('click', () => { $('#unitsOverlay').hidden = true; });
$('#btnNew').addEventListener('click', () => { if (G && G.mode === 'online' && NET.room && !G.over && !confirmLeave()) return; openStart(); });
function confirmLeave() { toast('You\'re in an online game. Pick a mode on the start screen to leave it.'); return true; }
$('#btnMute').addEventListener('click', () => { muted = !muted; if (muted) { CM.hush(); for (const k in CLIPS) try { CLIPS[k].el.pause(); } catch (e) { /* ignore */ } } $('#btnMute').textContent = muted ? 'Sound off' : 'Sound on'; $('#btnMute').setAttribute('aria-pressed', String(!muted)); if (I.Music) I.Music.setOn(musicOn && !muted); });
{ const cq = $('#commQ'); cq.value = commMode; cq.addEventListener('change', () => { commMode = cq.value; try { localStorage.setItem('chess2.comm', commMode); } catch (e) { /* not saved */ } if (commMode !== 'voice') CM.hush(); renderCommBox(); if (commMode !== 'off') comment('start', {}, { big: true, barry: 0 }); }); }
$('#btnMusicOn').addEventListener('click', () => { unlockAudio(); musicOn = !musicOn; try { localStorage.setItem('chess2.music', musicOn ? 'on' : 'off'); } catch (e) { /* not saved */ } renderMusicBtn(); if (I.Music) I.Music.setOn(musicOn && !muted); });
renderMusicBtn();
{
  const cs = $('#chaosQ'); cs.value = chaosLevel();
  cs.addEventListener('change', () => { try { localStorage.setItem('chess2.chaos', cs.value); } catch (e) {} });
}
async function leaveOnline() { if (!NET.room) return; try { NET.unsub && NET.unsub(); await NET.room.leave(); } catch (e) { /* gone */ } NET.room = null; NET.role = null; NET.mySide = null; NET.started = false; renderOnlinePanel(); }
$('#startAi').addEventListener('click', () => { unlockAudio(); leaveOnline(); $('#startOverlay').hidden = true; newGame('ai'); });
$('#startPvp').addEventListener('click', () => { unlockAudio(); leaveOnline(); $('#startOverlay').hidden = true; newGame('pvp'); });
$('#btnRecycle').addEventListener('click', () => { if (!humanTurn() || G.lock) return; G.recycle = G.recycle ? null : { picked: new Set() }; G.pend = null; G.sel = -1; refresh(); });
$('#rcScrap').addEventListener('click', scrapPicked);
$('#btnMusic').addEventListener('click', () => $('#musicFile').click());
$('#btnBoss').onclick = () => summonBossNow();
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
$('#zKing').addEventListener('click', () => { const k = I.kingSq(G.board, viewer()); if (k >= 0) { if (cam.cell < BS / 9) cam.cell = BS / 8; const [r, c] = vrc(k); centreOn(r, c); } });
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

window.__inkmate = { get G() { return G; }, playMove, playCard, doSpecial, newGame, refresh, addRot, meme, slam, offerReplay, watchReplay, spawnBoss, bossAttack, NET, hostOnline, joinOnline, I, cast: () => (castCache = castCache || cutsceneCast()), lines: () => NUKE_LINES };
window.addEventListener('resize', sizeBoard);
sizeBoard();
newGame('ai');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { buildLayer(); $('#hand').dataset.sig = ''; document.querySelectorAll('#shop .pack-btn').forEach(b => I.drawPackArt(b.querySelector('canvas'), 46, 64, b.dataset.pack)); refresh(); });
let lastBoil = 0;
// ---- highlights replay
let replayRun = null;
function offerReplay() {
  if (!G.over || !$('#replayOverlay').hidden) return;
  const ov = $('#replayOverlay');
  ov.hidden = false; $('#replayStart').hidden = false; $('#replayCanvas').hidden = true;
  const win = G.over.winner, tit = win ? (who(win) === 'You' ? 'You won!' : `${who(win)} won`) : 'It\'s a draw';
  $('#replayTitle').textContent = tit;
  $('#replayCount').textContent = `${Math.min(6, G.hl.length)} big moment${G.hl.length > 1 ? 's' : ''} this game${G.bankedNow ? ` · +${G.bankedNow} coins banked in your Locker` : ''}`;
  $('#replayWatch').focus();
}
function watchReplay() {
  const clips = I.Replay.choose(G.hl, 6);
  $('#replayStart').hidden = true; const cv = $('#replayCanvas'); cv.hidden = false;
  const win = G.over && G.over.winner;
  if (replayRun) replayRun.stop();
  snd('dun');
  replayRun = I.Replay.play(cv, clips, { title: win ? (who(win) === 'You' ? 'YOU WIN' : G.mode === 'ai' ? 'BARON WINS' : G.mode === 'online' && G.me ? 'FRIEND WINS' : (win === 'w' ? 'WHITE WINS' : 'BLACK WINS')) : 'DRAW', sub: `${G.ply} moves of pure chaos` });
  // sound for each clip: a whoosh as the action starts, then the impact
  const HIT_SND = { nuke: 'nukeboom', meteor: 'boom', capture: 'hit', shot: 'twang', special: 'vboom', item: 'brilliant', card: 'spell', bosshit: 'hit', bossatk: 'boom', check: 'check', move: 'whoosh' };
  let n = -1; const tick = setInterval(() => { const i = Math.floor((performance.now() - t0) / I.Replay.CLIP); if (i !== n && i < clips.length) { n = i; const cl = clips[i], kd = cl.kind || 'move';
    setTimeout(() => snd(kd === 'nuke' ? 'whistle' : 'whoosh'), I.Replay.CLIP * .27);
    setTimeout(() => { snd(HIT_SND[kd] || 'hit'); if (cl.mate != null || i === clips.length - 1) setTimeout(() => snd('airhorn'), 500); else if (cl.react) setTimeout(() => snd('vboom'), 450); }, I.Replay.CLIP * I.Replay.T_HIT); } }, 100), t0 = performance.now();
  replayRun.done.then(() => { clearInterval(tick); $('#replayStart').hidden = false; cv.hidden = true; $('#replayCount').textContent = 'Watch it again?'; });
}
function closeReplay() { if (replayRun) replayRun.stop(); $('#replayOverlay').hidden = true; }
$('#replayWatch').onclick = () => { unlockAudio(); watchReplay(); };
$('#replayNew').onclick = () => { closeReplay(); if (G.mode === 'online') onlineRematch(); else newGame(G.mode); };
$('#replayClose').onclick = closeReplay;
$('#replayCanvas').onclick = () => { if (replayRun) replayRun.stop(); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#replayOverlay').hidden) closeReplay(); });

function loop(now) { if (now - lastBoil > 150) { I.boil = (I.boil + 1) % 4; lastBoil = now; } drawBoard(now); idleChatter(now); requestAnimationFrame(loop); }
requestAnimationFrame(loop);
})();
