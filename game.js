/* Inkhold — build your village by day, hold the wall by night, march on the Black Keep.
   Everything is drawn live with wobbly "boiling" ink lines on a canvas. */
(() => {
'use strict';

// ------------------------------------------------------------------ setup
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const nc = document.createElement('canvas');
const nctx = nc.getContext('2d');

const INK = '#1d1c22', RED = '#b8322a', GOLD = '#d9a521', PAPER = '#f3efe3';
const RULE = 'rgba(84,128,196,0.30)', MARGIN = 'rgba(206,70,70,0.45)';
const FONT = "'Patrick Hand','Comic Sans MS','Chalkboard SE',cursive";
const WORLD = 4400, GRAV = 620, SPAWN_X = 3450;

let W = 960, H = 540, DPR = 1, SCALE = 1, VW = 960, VHt = 540, GY = 380, camX = 0;

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = cv.clientWidth || window.innerWidth || 960;
  H = cv.clientHeight || window.innerHeight || 540;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  nc.width = cv.width; nc.height = cv.height;
  SCALE = Math.max(0.42, Math.min(H / 500, W / 640));
  VW = W / SCALE; VHt = H / SCALE; GY = VHt * 0.7;
}
window.addEventListener('resize', resize);
resize();

// ------------------------------------------------------------------ helpers
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
let boil = 0;
const jt = (s, a) => (hash(s * 1.31 + boil * 7.77) - 0.5) * 2 * a;
const gy = x => Math.sin(x * 0.0042) * 5 + Math.sin(x * 0.013 + 1) * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
let uid = 1;

// ink drawing primitives (world space, y up is negative)
function ln(x1, y1, x2, y2, s = 0, a = 0.8) {
  ctx.beginPath();
  ctx.moveTo(x1 + jt(s, a), y1 + jt(s + .1, a));
  ctx.quadraticCurveTo((x1 + x2) / 2 + jt(s + .2, a * 1.2), (y1 + y2) / 2 + jt(s + .3, a * 1.2), x2 + jt(s + .4, a), y2 + jt(s + .5, a));
  ctx.stroke();
}
function path(pts, s = 0, a = 0.7, close = false) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0] + jt(s + i * .7, a), y = pts[i][1] + jt(s + i * .7 + .35, a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  if (close) ctx.closePath();
}
function circle(x, y, r, s = 0, a = 0.5, n = 12) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n * Math.PI * 2, rr = r + (i === n ? jt(s, a) : jt(s + i * .9, a));
    const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.closePath();
}
function cloud(x, y, rx, ry, s, n = 8) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n * Math.PI * 2, px = x + Math.cos(t) * rx, py = y + Math.sin(t) * ry;
    if (!i) { ctx.moveTo(px, py); continue; }
    const tm = (i - 0.5) / n * Math.PI * 2, k = 1.4 + hash(s + i) * 0.3;
    ctx.quadraticCurveTo(x + Math.cos(tm) * rx * k + jt(s + i, .8), y + Math.sin(tm) * ry * k + jt(s + i + .5, .8), px, py);
  }
  ctx.closePath();
}
const fillStroke = (fill = PAPER) => { ctx.fillStyle = fill; ctx.fill(); ctx.stroke(); };
function bricks(x0, y0, w, h, s, rowH = 9) {
  ctx.lineWidth = 1.2;
  let r = 0;
  for (let y = y0 + rowH * 0.7; y < y0 + h - 3; y += rowH, r++) {
    for (let x = x0 + 3 + (r % 2) * 6; x < x0 + w - 6; x += 12) {
      if (hash(s + x * 0.37 + y * 0.11) < 0.25) continue;
      ln(x, y, x + 6 + hash(s + x + y) * 2, y, s + x + y, 0.4);
    }
  }
}
function crenels(x0, top, w, s, m = 8) {
  const pts = [[x0, top + m]]; let up = true;
  for (let x = x0; x < x0 + w - 0.5; x += m) {
    const nx = Math.min(x0 + w, x + m);
    const yy = up ? top : top + m;
    pts.push([x, yy], [nx, yy]); up = !up;
  }
  pts.push([x0 + w, top + m]);
  return pts;
}

// ------------------------------------------------------------------ audio
let AC = null, muted = false, noiseBuf = null; const lastSnd = {};
function unlockAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.5, AC.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { AC = null; }
}
function snd(type, x) {
  if (!AC || muted) return;
  if (x !== undefined && (x < camX - 150 || x > camX + VW + 150)) return;
  const now = AC.currentTime;
  if (lastSnd[type] && now - lastSnd[type] < 0.06) return;
  lastSnd[type] = now;
  const g = AC.createGain(); g.connect(AC.destination);
  const osc = (wave, f1, f2, dur, vol) => {
    const o = AC.createOscillator(); o.type = wave;
    o.frequency.setValueAtTime(f1, now); o.frequency.exponentialRampToValueAtTime(f2, now + dur);
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); o.start(now); o.stop(now + dur + 0.02);
  };
  const noise = (dur, vol, freq) => {
    const n = AC.createBufferSource(); n.buffer = noiseBuf;
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, now); g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    n.connect(f); f.connect(g); n.start(now); n.stop(now + dur);
  };
  switch (type) {
    case 'twang': osc('triangle', 700, 220, 0.09, 0.05); break;
    case 'hit': noise(0.07, 0.10, 1800); break;
    case 'coin': osc('sine', 1300, 1900, 0.11, 0.06); break;
    case 'build': osc('square', 190, 120, 0.12, 0.05); break;
    case 'boom': noise(0.45, 0.22, 380); break;
    case 'die': osc('sawtooth', 300, 90, 0.18, 0.025); break;
    case 'horn': osc('sawtooth', 150, 118, 1.3, 0.05); break;
    case 'bell': osc('sine', 880, 870, 1.0, 0.07); break;
    case 'deny': osc('square', 140, 110, 0.12, 0.03); break;
  }
}

// ------------------------------------------------------------------ definitions
const UDEF = {
  sword:   { team: 1, name: 'Swordsman', hp: 70,  dmg: 12, cd: 0.8, speed: 58, reach: 22, aggro: 210, h: 37 },
  archer:  { team: 1, name: 'Archer',    hp: 32,  dmg: 10, cd: 1.5, speed: 58, range: 360, aggro: 380, h: 37 },
  cata:    { team: 1, name: 'Catapult',  hp: 150, dmg: 22, bdmg: 85, cd: 4.5, speed: 26, range: 640, aggro: 660, h: 44, splash: 52 },
  raider:  { team: 2, hp: 36,  dmg: 7,  cd: 1.0, speed: 50, reach: 22, aggro: 230, h: 33, bounty: 1 },
  brute:   { team: 2, hp: 160, dmg: 22, cd: 1.7, speed: 34, reach: 28, aggro: 210, h: 54, bmul: 2.2, bounty: 3 },
  earcher: { team: 2, hp: 26,  dmg: 6,  cd: 1.8, speed: 50, range: 320, aggro: 340, h: 33, bounty: 1 },
};
const BDEF = {
  keep:     { name: 'Keep',          w: 92,  h: [0, 130, 160, 190], hp: [0, 520, 900, 1400], cost: [0, 0, 16, 32], income: [0, 4, 6, 8], shoot: [0, 1, 2, 3] },
  house:    { name: 'House',         w: 58,  h: [0, 52, 66],  hp: [0, 120, 220], cost: [0, 5, 10], income: [0, 3, 5] },
  farm:     { name: 'Farm',          w: 110, h: [0, 22, 26],  hp: [0, 90, 150],  cost: [0, 4, 9],  income: [0, 2, 3], drip: [0, 15, 9] },
  wall:     { name: 'Wall',          w: 26,  h: [0, 58, 88, 118], hp: [0, 170, 400, 700], cost: [0, 4, 9, 16], block: true },
  tower:    { name: 'Archer Tower',  w: 40,  h: [0, 108, 138], hp: [0, 210, 400], cost: [0, 6, 13], shoot: [0, 1, 2] },
  barracks: { name: 'Barracks',      w: 82,  h: [0, 62], hp: [0, 190], cost: [0, 8],  recruit: 'sword',  rcost: 3 },
  range:    { name: 'Archery Range', w: 82,  h: [0, 56], hp: [0, 170], cost: [0, 8],  recruit: 'archer', rcost: 4 },
  workshop: { name: 'Siege Workshop', w: 92, h: [0, 66], hp: [0, 220], cost: [0, 14], recruit: 'cata',   rcost: 10 },
  ewall:    { name: 'Black Wall',    w: 32,  h: [0, 140], hp: [0, 850], block: true, reward: 10 },
  etower:   { name: 'Black Tower',   w: 46,  h: [0, 170], hp: [0, 560], shoot: [0, 2], reward: 8 },
  ekeep:    { name: 'The Black Keep', w: 124, h: [0, 232], hp: [0, 1700], shoot: [0, 2] },
};
const PLOTS = [
  ['farm', 140], ['house', 290], ['keep', 480], ['house', 660], ['farm', 800],
  ['barracks', 960], ['range', 1090], ['workshop', 1228], ['tower', 1360], ['wall', 1450],
  ['farm', 1610], ['tower', 1790], ['wall', 1880],
];
const ENEMY_BUILDINGS = [['ewall', 3800], ['etower', 3890], ['etower', 4040], ['ekeep', 4220]];

// ------------------------------------------------------------------ state
const S = {};
let units = [], buildings = [], projs = [], fx = [], decals = [], coins = [], peasants = [];
let king;

function mkB(kind, x, team, lvl) {
  const b = { id: uid++, isB: true, kind, x, team, lvl: 0, hp: 0, maxhp: 0, cool: rnd(0, 1), hurt: 0, dead: false, w: BDEF[kind].w, h: 0 };
  setLvl(b, lvl);
  return b;
}
function setLvl(b, l) {
  const d = BDEF[b.kind];
  b.lvl = l; b.dead = false;
  b.maxhp = d.hp[l] || 0; b.hp = b.maxhp; b.h = d.h[l] || 0;
}
const aliveB = b => b.lvl > 0 && !b.dead;

function spawnUnit(kind, x, opts = {}) {
  const d = UDEF[kind];
  const u = { id: uid++, kind, team: d.team, x, vx: 0, hp: d.hp, maxhp: d.hp, cool: rnd(0, 0.6), atk: 0, face: d.team === 1 ? 1 : -1,
    anim: rnd(0, 6), moving: false, slot: 0, dead: false, deadT: 0, hurt: 0, wave: false, garrison: false, ...opts };
  units.push(u);
  return u;
}

function newGame() {
  units = []; buildings = []; projs = []; fx = []; decals = []; coins = []; peasants = [];
  Object.assign(S, { gold: 25, day: 1, phase: 'day', t: 0, dayLen: 95, dark: 0, waveQ: [], spawnT: 0, mode: 'defend',
    over: null, overT: 0, banner: null, garT: 6, time: 0, paused: false, kills: 0 });
  for (const [k, x] of PLOTS) buildings.push(mkB(k, x, 1, k === 'keep' ? 1 : 0));
  for (const [k, x] of ENEMY_BUILDINGS) buildings.push(mkB(k, x, 2, 1));
  king = { x: 520, vx: 0, face: 1, anim: 0 };
  spawnUnit('sword', 600); spawnUnit('sword', 620); spawnUnit('archer', 560);
  const ew = buildings.find(b => b.kind === 'ewall');
  for (let i = 0; i < 4; i++) spawnUnit(i % 2 ? 'earcher' : 'raider', ew.x + 40 + i * 14, { garrison: true });
  camX = king.x - VW * 0.45;
  banner('Day 1', 'Build up your village. The raiders come at nightfall.');
}

function banner(text, sub = '', dur = 4) { S.banner = { text, sub, t: dur, dur }; }
function floatText(x, y, str, col = INK) { fx.push({ type: 'text', x, y, str, col, t: 0, life: 1.6 }); }

// ------------------------------------------------------------------ input
const keys = {}; let pressed = {};
const KEYMAP = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'act', e: 'act', enter: 'act',
  f: 'march', n: 'night', p: 'pause', escape: 'pause', m: 'mute', shift: 'run' };
window.addEventListener('keydown', e => {
  const k = KEYMAP[e.key.toLowerCase()]; unlockAudio();
  if (!k) return;
  if (!keys[k]) pressed[k] = true;
  keys[k] = true;
  e.preventDefault();
});
window.addEventListener('keyup', e => { const k = KEYMAP[e.key.toLowerCase()]; if (k) keys[k] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const touchEl = document.getElementById('touch');
if (touchEl) {
  if ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0) document.body.classList.add('touch');
  touchEl.querySelectorAll('button[data-k]').forEach(btn => {
    const k = btn.dataset.k;
    const down = e => { e.preventDefault(); unlockAudio(); if (!keys[k]) pressed[k] = true; keys[k] = true; btn.classList.add('on'); };
    const up = e => { e.preventDefault(); keys[k] = false; btn.classList.remove('on'); };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
  });
}
cv.addEventListener('pointerdown', () => { unlockAudio(); if (state !== 'play') pressed.act = true; });

// ------------------------------------------------------------------ game logic
function nearestPlot() {
  let best = null, bd = 46;
  for (const b of buildings) {
    if (b.team !== 1) continue;
    const d = Math.abs(b.x - king.x);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function plotOffer(b) {
  const d = BDEF[b.kind];
  if (b.lvl === 0 || b.dead) return { verb: b.dead ? 'Rebuild' : 'Build', what: d.name, cost: d.cost[1], act: 'build' };
  if (d.recruit) return { verb: 'Recruit', what: UDEF[d.recruit].name, cost: d.rcost, act: 'recruit' };
  if (b.lvl < d.hp.length - 1) return { verb: 'Upgrade', what: d.name + ' ' + 'I'.repeat(b.lvl + 1).replace('III', 'III'), cost: d.cost[b.lvl + 1], act: 'up' };
  return { verb: '', what: d.name + ' (max)', cost: 0, act: null };
}
function interact() {
  const b = nearestPlot(); if (!b) return;
  const o = plotOffer(b); if (!o.act) return;
  if (S.gold < o.cost) { snd('deny'); floatText(b.x, gy(b.x) - Math.max(40, b.h) - 30, 'need ' + o.cost + ' gold', RED); return; }
  S.gold -= o.cost;
  for (let i = 0; i < Math.min(o.cost, 8); i++) fx.push({ type: 'fly', x0: king.x, y0: gy(king.x) - 40, x1: b.x, y1: gy(b.x) - 20, t: -i * 0.05, life: 0.4 });
  if (o.act === 'recruit') {
    const kind = BDEF[b.kind].recruit;
    spawnUnit(kind, b.x + rnd(-10, 10));
    floatText(b.x, gy(b.x) - b.h - 24, '+1 ' + UDEF[kind].name);
    snd('bell', b.x);
  } else {
    setLvl(b, o.act === 'build' ? 1 : b.lvl + 1);
    puff(b.x, gy(b.x) - b.h / 2, 3, b.w * 0.4);
    snd('build', b.x);
    if (b.kind === 'house') syncPeasants();
  }
}
function syncPeasants() {
  const want = [];
  for (const b of buildings) if (b.kind === 'house' && aliveB(b)) for (let i = 0; i < b.lvl; i++) want.push(b);
  for (const b of buildings) if (b.kind === 'keep' && aliveB(b)) want.push(b);
  peasants = want.map((home, i) => peasants.find(p => p.home === home && p.i === i) || { home, i, x: home.x + rnd(-30, 30), tx: home.x, t: rnd(0, 3), anim: 0, face: 1 });
}

function puff(x, y, n = 4, spread = 20) {
  for (let i = 0; i < n; i++) fx.push({ type: 'puff', x: x + rnd(-spread, spread), y: y + rnd(-spread * .4, spread * .4), r: rnd(8, 14), t: 0, life: rnd(0.8, 1.4), s: rnd(0, 99), vy: rnd(-22, -10) });
}
function splat(x, col) { decals.push({ x, r: rnd(5, 10), s: rnd(0, 999), col, t: 0 }); }

function hostileWallBetween(team, x1, x2, exclude) {
  const lo = Math.min(x1, x2), hi = Math.max(x1, x2);
  for (const b of buildings) {
    if (b === exclude || b.team === team || !aliveB(b) || !BDEF[b.kind].block) continue;
    if (b.x > lo && b.x < hi) return true;
  }
  return false;
}
const distTo = (u, t) => t.isB ? Math.max(0, Math.abs(t.x - u.x) - t.w / 2) : Math.abs(t.x - u.x);

function findTarget(u, d) {
  let best = null, bd = d.aggro;
  const ranged = !!d.range, preferB = u.kind === 'cata';
  for (const o of units) {
    if (o.dead || o.team === u.team) continue;
    let dd = Math.abs(o.x - u.x);
    if (preferB) dd += 120;
    if (dd < bd && (ranged || !hostileWallBetween(u.team, u.x, o.x, null))) { best = o; bd = dd; }
  }
  for (const b of buildings) {
    if (b.team === u.team || !aliveB(b)) continue;
    const dd = distTo(u, b);
    // archers only bother with buildings they're standing next to (they hack at them)
    if (ranged && !preferB && dd > 30) continue;
    if (dd < bd && (ranged || !hostileWallBetween(u.team, u.x, b.x, b))) { best = b; bd = dd; }
  }
  return best;
}

function damage(t, amt) {
  if (t.isB) {
    if (!aliveB(t)) return;
    t.hp -= amt; t.hurt = 0.2;
    if (t.hp <= 0) destroyB(t);
  } else {
    if (t.dead) return;
    t.hp -= amt; t.hurt = 0.2;
    if (t.hp <= 0) killU(t);
  }
}
function killU(u) {
  u.dead = true; u.deadT = 0; u.hp = 0;
  splat(u.x + rnd(-6, 6), Math.random() < 0.6 ? RED : INK);
  snd('die', u.x);
  if (u.team === 2) {
    S.kills++;
    const n = UDEF[u.kind].bounty || 0;
    for (let i = 0; i < n; i++) dropCoin(u.x, gy(u.x) - 20);
  }
}
function dropCoin(x, y) { coins.push({ x, y, vx: rnd(-50, 50), vy: rnd(-220, -140), t: 0 }); }
function destroyB(b) {
  b.dead = true; b.hp = 0;
  puff(b.x, gy(b.x) - b.h * 0.5, 7, b.w * 0.5);
  for (let i = 0; i < 10; i++) fx.push({ type: 'debris', x: b.x + rnd(-b.w / 2, b.w / 2), y: gy(b.x) - rnd(0, b.h), vx: rnd(-120, 120), vy: rnd(-260, -80), rot: rnd(0, 6), t: 0, life: 1.5 });
  snd('boom', b.x);
  const d = BDEF[b.kind];
  if (d.reward) { for (let i = 0; i < d.reward; i++) dropCoin(b.x + rnd(-10, 10), gy(b.x) - 40); banner(d.name + ' destroyed!', 'Gold spills out of the rubble.', 3); }
  if (b.kind === 'house') syncPeasants();
  if (b.kind === 'keep' && !S.over) { S.over = 'lose'; S.overT = 0; snd('horn'); }
  if (b.kind === 'ekeep' && !S.over) { S.over = 'win'; S.overT = 0; snd('bell'); }
}

function shoot(x, y, team, target, dmg, kind, extra = {}) {
  const tx0 = target.x, dx0 = tx0 - x;
  let t = kind === 'rock' ? clamp(Math.abs(dx0) / 280, 0.9, 2.3) : clamp(Math.abs(dx0) / 330, 0.45, 1.3);
  const tx = tx0 + (target.vx || 0) * t * 0.9 + rnd(-6, 6);
  const ty = gy(tx) - (target.isB ? Math.min(target.h * 0.6, 60) : 18);
  const dx = tx - x, dy = ty - y;
  projs.push({ x, y, vx: dx / t, vy: (dy - 0.5 * GRAV * t * t) / t, team, dmg, kind, life: 5, ...extra });
  snd(kind === 'rock' ? 'build' : 'twang', x);
}

function rallyX() {
  let w = null;
  for (const b of buildings) if (b.team === 1 && b.kind === 'wall' && aliveB(b) && (!w || b.x > w.x)) w = b;
  if (w) return w.x;
  const keep = buildings.find(b => b.kind === 'keep');
  return keep.x + 180;
}
function goalX(u, rx) {
  if (u.team === 1) {
    if (S.mode === 'attack') return WORLD + 400;
    if (u.kind === 'sword') return rx - 20 - (u.slot % 6) * 9;
    if (u.kind === 'archer') return rx - 70 - (u.slot % 6) * 11;
    return rx - 170 - (u.slot % 3) * 34;
  }
  if (u.flee) return SPAWN_X + 700;
  if (u.garrison) {
    const ew = buildings.find(b => b.kind === 'ewall');
    const base = aliveB(ew) ? ew.x + 34 : ew.x - 30;
    return base + (u.slot % 8) * 12;
  }
  return -1000;
}

function updateUnit(u, dt, rx) {
  if (u.dead) { u.deadT += dt; return; }
  const d = UDEF[u.kind];
  u.cool -= dt; u.atk = Math.max(0, u.atk - dt); u.hurt = Math.max(0, u.hurt - dt);
  let goal = goalX(u, rx), moveTo = goal;
  let tgt = findTarget(u, d);
  // leashes: defenders and garrison don't chase far
  if (u.flee) {
    tgt = null;
    if (u.x > SPAWN_X + 600) { u.dead = true; u.deadT = 99; return; }
  }
  if (tgt) {
    if (u.team === 1 && S.mode === 'defend' && !d.range && tgt.x > rx + 170) tgt = null;
    else if (u.garrison && Math.abs(tgt.x - goal) > 300) tgt = null;
  }
  if (tgt) {
    const dist = distTo(u, tgt);
    u.face = Math.sign(tgt.x - u.x) || u.face;
    if (d.range && tgt.isB && u.kind !== 'cata') {
      // archer hacking at a building it is standing next to
      moveTo = u.x;
      if (u.cool <= 0) { u.cool = d.cd; u.atk = 0.3; damage(tgt, d.dmg * 0.8); snd('hit', u.x); }
    } else if (d.range) {
      if (dist <= d.range) {
        moveTo = u.x;
        if (u.cool <= 0) {
          u.cool = d.cd * rnd(0.9, 1.15); u.atk = 0.35;
          if (u.kind === 'cata') shoot(u.x, gy(u.x) - 46, u.team, tgt, d.dmg, 'rock', { bdmg: d.bdmg, splash: d.splash });
          else shoot(u.x + u.face * 8, gy(u.x) - 24, u.team, tgt, d.dmg, 'arrow');
        }
      } else if (u.team === 2 || S.mode === 'attack') moveTo = tgt.x;
    } else {
      const reach = d.reach;
      if (dist <= reach) {
        moveTo = u.x;
        if (u.cool <= 0) {
          u.cool = d.cd * rnd(0.9, 1.1); u.atk = 0.25;
          damage(tgt, d.dmg * (tgt.isB ? (d.bmul || 1) : 1) * rnd(0.85, 1.15));
          snd('hit', u.x);
          if (Math.random() < 0.4) fx.push({ type: 'slash', x: u.x + u.face * 14, y: gy(u.x) - 20, t: 0, life: 0.18, f: u.face });
        }
      } else moveTo = tgt.x;
    }
  }
  const diff = moveTo - u.x;
  const prev = u.x;
  if (Math.abs(diff) > 3) {
    const sp = d.speed * (u.team === 2 && u.wave && S.phase === 'night' ? 1.15 : 1);
    u.x += Math.sign(diff) * Math.min(Math.abs(diff), sp * dt);
    if (!tgt) u.face = Math.sign(diff);
    u.moving = true;
  } else u.moving = false;
  // hostile walls block movement
  for (const b of buildings) {
    if (b.team === u.team || !aliveB(b) || !BDEF[b.kind].block) continue;
    const edge = b.w / 2 + 5;
    if (prev <= b.x && u.x > b.x - edge) u.x = Math.min(u.x, b.x - edge);
    else if (prev >= b.x && u.x < b.x + edge) u.x = Math.max(u.x, b.x + edge);
  }
  u.x = clamp(u.x, 10, WORLD - 10);
  u.vx = (u.x - prev) / Math.max(dt, 1e-4);
  if (u.moving) u.anim += dt * d.speed * 0.17;
}

function updateBuilding(b, dt) {
  b.hurt = Math.max(0, b.hurt - dt);
  const d = BDEF[b.kind];
  if (d.drip && aliveB(b) && S.phase === 'day' && !S.over) {
    b.drip = (b.drip || 0) + dt;
    if (b.drip >= d.drip[b.lvl]) { b.drip = 0; dropCoin(b.x + rnd(-20, 20), gy(b.x) - 26); }
  }
  if (!d.shoot || !aliveB(b)) return;
  b.cool -= dt;
  if (b.cool > 0) return;
  const range = b.team === 1 ? 430 : 400;
  let best = null, bd = range;
  for (const u of units) {
    if (u.dead || u.team === b.team) continue;
    const dd = Math.abs(u.x - b.x);
    if (dd < bd) { bd = dd; best = u; }
  }
  if (!best) { b.cool = 0.3; return; }
  const n = d.shoot[b.lvl];
  for (let i = 0; i < n; i++) shoot(b.x + rnd(-b.w * .3, b.w * .3), gy(b.x) - b.h + 6, b.team, best, b.team === 1 ? 8 : 7, 'arrow');
  b.cool = 1.45 * rnd(0.9, 1.1);
}

function updateProj(p, dt) {
  p.vy += GRAV * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
  const ground = gy(p.x);
  if (p.kind === 'arrow') {
    if (p.y > ground - 70) {
      for (const u of units) {
        if (u.dead || u.team === p.team) continue;
        if (Math.abs(u.x - p.x) < 7 && p.y > gy(u.x) - UDEF[u.kind].h) { damage(u, p.dmg); p.life = -1; splat(u.x, RED); return; }
      }
    }
    for (const b of buildings) {
      if (b.team === p.team || !aliveB(b)) continue;
      if (Math.abs(b.x - p.x) < b.w / 2 && p.y > gy(b.x) - b.h) { damage(b, p.dmg * 0.3); p.life = -1; return; }
    }
    if (p.y >= ground) { fx.push({ type: 'stuck', x: p.x, y: ground, ang: Math.atan2(p.vy, p.vx), t: 0, life: 5 }); p.life = -1; }
  } else {
    let hit = p.y >= ground;
    for (const b of buildings) {
      if (b.team === p.team || !aliveB(b)) continue;
      if (Math.abs(b.x - p.x) < b.w / 2 && p.y > gy(b.x) - b.h) hit = true;
    }
    if (hit) {
      for (const b of buildings) if (b.team !== p.team && aliveB(b) && Math.abs(b.x - p.x) - b.w / 2 < p.splash) damage(b, p.bdmg);
      for (const u of units) if (!u.dead && u.team !== p.team && Math.abs(u.x - p.x) < p.splash) damage(u, p.dmg);
      puff(p.x, Math.min(p.y, ground) - 8, 4, 16); snd('boom', p.x);
      for (let i = 0; i < 5; i++) fx.push({ type: 'debris', x: p.x, y: Math.min(p.y, ground), vx: rnd(-140, 140), vy: rnd(-220, -60), rot: rnd(0, 6), t: 0, life: 1 });
      p.life = -1;
    }
  }
}

function startNight() {
  S.phase = 'night'; S.t = 0;
  const n = S.day, q = [];
  const raiders = Math.min(1 + n * 2, 34), archers = Math.max(0, n - 2), brutes = Math.floor(n / 4) + Math.max(0, n - 6);
  for (let i = 0; i < raiders; i++) q.push('raider');
  for (let i = 0; i < archers; i++) q.splice(Math.floor(Math.random() * (q.length + 1)), 0, 'earcher');
  for (let i = 0; i < brutes; i++) q.push('brute');
  S.waveQ = q; S.spawnT = 1.5; S.waveSize = q.length;
  banner('Night ' + n, q.length + ' raiders are coming from the east.');
  snd('horn');
}
function startDay() {
  S.phase = 'day'; S.t = 0; S.day++; S.dayLen = 75;
  let income = 0;
  for (const b of buildings) {
    if (b.team === 1 && aliveB(b)) {
      const inc = (BDEF[b.kind].income || [])[b.lvl] || 0;
      if (inc) { income += inc; floatText(b.x, gy(b.x) - b.h - 20, '+' + inc, GOLD); }
      b.hp = Math.min(b.maxhp, b.hp + (b.maxhp - b.hp) * 0.6);
    } else if (b.team === 2 && aliveB(b)) b.hp = Math.min(b.maxhp, b.hp + (b.maxhp - b.hp) * 0.25);
  }
  for (const u of units) if (!u.dead && u.team === 1) u.hp = u.maxhp;
  S.gold += income;
  banner('Day ' + S.day, 'Dawn. Your village earned ' + income + ' gold.');
  snd('bell');
}

function updatePhase(dt) {
  S.t += dt;
  if (S.phase === 'day') {
    if (S.t >= S.dayLen || pressed.night) startNight();
    const dusk = clamp((S.t - (S.dayLen - 12)) / 12, 0, 1);
    S.dark += (dusk * 0.7 - S.dark) * Math.min(1, dt * 2);
  } else {
    S.dark += (1 - S.dark) * Math.min(1, dt * 1.2);
    if (S.waveQ.length) {
      S.spawnT -= dt;
      if (S.spawnT <= 0) { spawnUnit(S.waveQ.shift(), SPAWN_X + rnd(-30, 30), { wave: true }); S.spawnT = rnd(0.6, 1.1); }
    } else if (S.t > 10 && !units.some(u => u.wave && !u.dead)) startDay();
    else if (S.t > 150) {
      // the sun comes up regardless; stragglers run back to their camp
      for (const u of units) if (u.wave && !u.dead) { u.wave = false; u.flee = true; }
      startDay();
    }
  }
  // the Black Keep sends out guards while your army is close
  const ek = buildings.find(b => b.kind === 'ekeep');
  if (aliveB(ek)) {
    S.garT -= dt;
    const threat = units.some(u => !u.dead && u.team === 1 && u.x > ek.x - 1100);
    const gar = units.filter(u => u.garrison && !u.dead).length;
    if (S.garT <= 0 && gar < 4 + S.day) {
      if (threat || gar < 3) {
        const r = Math.random(), kind = r < 0.2 && S.day > 2 ? 'brute' : r < 0.6 ? 'earcher' : 'raider';
        spawnUnit(kind, ek.x - 50, { garrison: true });
      }
      S.garT = threat ? 6 : 20;
    }
  }
}

function updateKing(dt) {
  const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const sp = keys.run ? 250 : 175;
  king.vx = dir * sp;
  king.x = clamp(king.x + king.vx * dt, 20, WORLD - 20);
  if (dir) { king.face = dir; king.anim += dt * sp * 0.08; }
  if (pressed.act) interact();
  if (pressed.march) {
    S.mode = S.mode === 'attack' ? 'defend' : 'attack';
    banner(S.mode === 'attack' ? 'March!' : 'Fall back!', S.mode === 'attack' ? 'Your army advances on the Black Keep.' : 'Your army returns to the outer wall.', 2.2);
    snd(S.mode === 'attack' ? 'horn' : 'bell');
  }
  for (const c of coins) {
    if (c.t > 0.35 && Math.abs(c.x - king.x) < 26 && c.y > gy(c.x) - 30) { c.got = true; S.gold++; snd('coin'); floatText(c.x, gy(c.x) - 50, '+1', GOLD); }
  }
}

function updatePeasants(dt) {
  for (const p of peasants) {
    p.t -= dt;
    if (p.t <= 0) { p.tx = p.home.x + rnd(-110, 110); p.t = rnd(2, 6); }
    const d = p.tx - p.x;
    if (Math.abs(d) > 2) { p.x += Math.sign(d) * Math.min(Math.abs(d), 28 * dt); p.face = Math.sign(d); p.anim += dt * 5; p.moving = true; } else p.moving = false;
  }
}

function update(dt) {
  S.time += dt;
  if (pressed.mute) muted = !muted;
  if (pressed.pause) S.paused = !S.paused;
  if (S.paused) return;
  if (S.over) { S.overT += dt; if (S.overT > 1.5 && pressed.act) { newGame(); } }
  updateKing(dt);
  if (!S.over) updatePhase(dt);
  const rx = rallyX();
  const cnt = {};
  for (const u of units) if (!u.dead) { const key = u.kind + (u.garrison ? 'g' : ''); u.slot = cnt[key] = (cnt[key] || 0) + 1; }
  for (const b of buildings) updateBuilding(b, dt);
  for (const u of units) updateUnit(u, dt, rx);
  for (const p of projs) updateProj(p, dt);
  for (const c of coins) {
    c.t += dt; c.vy += GRAV * dt; c.x += c.vx * dt; c.y += c.vy * dt;
    const g = gy(c.x) - 4;
    if (c.y > g) { c.y = g; c.vy *= -0.35; c.vx *= 0.6; if (Math.abs(c.vy) < 30) c.vy = 0; }
  }
  for (const f of fx) {
    f.t += dt;
    if (f.type === 'puff') { f.y += f.vy * dt; f.r += dt * 8; }
    if (f.type === 'debris') { f.vy += GRAV * dt; f.x += f.vx * dt; f.y = Math.min(f.y + f.vy * dt, gy(f.x)); f.rot += dt * 8; if (f.y >= gy(f.x)) { f.vx *= 0.8; } }
    if (f.type === 'text') f.y -= dt * 30;
  }
  for (const d of decals) d.t += dt;
  updatePeasants(dt);
  units = units.filter(u => !u.dead || u.deadT < 7);
  projs = projs.filter(p => p.life > 0 && p.x > -200 && p.x < WORLD + 200);
  coins = coins.filter(c => !c.got && c.t < 90);
  fx = fx.filter(f => f.t < f.life);
  decals = decals.filter(d => d.t < 40);
  if (decals.length > 160) decals.splice(0, decals.length - 160);
  if (S.banner) { S.banner.t -= dt; if (S.banner.t <= 0) S.banner = null; }
}

// ------------------------------------------------------------------ drawing: figures (local, feet at 0,0, facing right)
function drawLegs(u, s, spread = 3, top = -9) {
  const w = u.moving ? Math.sin(u.anim) : 0;
  ln(-spread, top, -spread - w * 4, 0, s, 0.3);
  ln(spread, top, spread + w * 4, 0, s + 1, 0.3);
}
function drawKnightBody(u, s) {
  ctx.lineWidth = 2;
  drawLegs(u, s);
  path([[-7, -9], [7, -9], [5, -25], [-5, -25]], s + 2, 0.45, true); fillStroke();
  path([[-6, -25], [6, -25], [0, -38]], s + 3, 0.45, true); fillStroke();
  ctx.lineWidth = 1.4; ln(1, -30, 4, -30, s + 4, 0.2);
}
function figSword(u) {
  const s = u.id * 3.1;
  drawKnightBody(u, s);
  ctx.lineWidth = 1.4; ln(-4, -11, 3, -23, s + 5, 0.3);
  // shield
  ctx.lineWidth = 1.8; circle(6, -16, 6.2, s + 6, 0.4, 10); fillStroke();
  ctx.lineWidth = 1.2; ln(6, -21, 6, -11, s + 7, 0.3); ln(2, -16, 10, -16, s + 8, 0.3);
  // sword
  const a = u.atk > 0 ? -1.7 + (1 - u.atk / 0.25) * 2.4 : -0.5;
  const hx = 4, hy = -19;
  ctx.lineWidth = 2; ln(hx, hy, hx + Math.cos(a) * 18, hy + Math.sin(a) * 18, s + 9, 0.3);
  ln(hx + Math.cos(a + 1.57) * 3, hy + Math.sin(a + 1.57) * 3, hx - Math.cos(a + 1.57) * 3, hy - Math.sin(a + 1.57) * 3, s + 10, 0.2);
}
function figArcher(u) {
  const s = u.id * 3.1;
  drawKnightBody(u, s);
  ctx.lineWidth = 1.4; ln(0, -22, 0, -12, s + 5, 0.3); ln(-3, -18, 3, -18, s + 6, 0.3);
  // bow
  ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(5, -19, 12, -1.15, 1.15); ctx.stroke();
  const pull = u.atk > 0 ? 0 : (u.cool < 0.8 ? 6 : 0);
  ctx.lineWidth = 1; path([[5 + Math.cos(-1.15) * 12, -19 + Math.sin(-1.15) * 12], [5 - pull, -19], [5 + Math.cos(1.15) * 12, -19 + Math.sin(1.15) * 12]], s + 7, 0.2); ctx.stroke();
  if (pull) { ctx.lineWidth = 1.3; ln(5 - pull, -19, 19, -19, s + 8, 0.2); }
  // quiver
  ctx.lineWidth = 1.2; ln(-6, -24, -9, -30, s + 9, .2); ln(-4, -24, -6, -31, s + 10, .2);
}
function figCata(u) {
  const s = u.id * 3.1;
  ctx.lineWidth = 2;
  ln(-26, -12, 26, -12, s, 0.5);
  for (const wx of [-16, 16]) { circle(wx, -8, 8, s + wx, 0.4, 10); fillStroke(); ctx.lineWidth = 1; ln(wx - 6, -8, wx + 6, -8, s + wx + 1, .2); ln(wx, -14, wx, -2, s + wx + 2, .2); ctx.lineWidth = 2; }
  ln(-8, -12, 0, -34, s + 3, 0.4); ln(8, -12, 0, -34, s + 4, 0.4);
  const fire = u.atk > 0 ? u.atk / 0.35 : 0;
  const a = fire > 0 ? -0.25 - (1 - fire) * 0.4 : -2.6 + (u.cool > 1 ? 0 : 0);
  const ang = fire > 0 ? -1.2 + (fire - 1) * 1.5 : 2.75;
  const ax = Math.cos(ang) * 30, ay = Math.sin(ang) * 30;
  ctx.lineWidth = 2.6; ln(0 - ax * 0.35, -34 - ay * 0.35, ax, -34 + ay, s + 5, 0.3);
  if (u.cool > 0.5 && !fire) { circle(ax, -34 + ay - 4, 5, s + 6, .5, 8); fillStroke(INK); }
  void a;
  // operator
  ctx.lineWidth = 1.6; ctx.save(); ctx.translate(-32, 0); drawKnightBody(u, s + 20); ctx.restore();
}
function figRaider(u) {
  const s = u.id * 3.1;
  ctx.lineWidth = 2;
  drawLegs(u, s, 2.5, -11);
  ln(0, -11, 1.5, -25, s + 2, 0.4);
  circle(2, -29, 4.6, s + 3, 0.6, 9); fillStroke(INK);
  ctx.lineWidth = 1; ln(-1, -33, -4, -36, s + 3.5, 1); ln(1, -34, 0, -37, s + 3.6, 1);
  ctx.fillStyle = RED; ctx.fillRect(3.4, -30.5, 2, 1.6);
  ctx.lineWidth = 1.8; ln(1, -21, -6, -15, s + 4, .4);
  const a = u.atk > 0 ? -1.9 + (1 - u.atk / 0.25) * 2.6 : -0.9;
  const ex = 2 + Math.cos(a) * 15, ey = -21 + Math.sin(a) * 15;
  ln(2, -21, ex, ey, s + 5, .3);
  ctx.strokeStyle = RED; ctx.fillStyle = RED;
  path([[ex - Math.cos(a) * 4, ey - Math.sin(a) * 4], [ex + Math.cos(a + 1.57) * 6, ey + Math.sin(a + 1.57) * 6], [ex, ey]], s + 6, .4, true); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK;
}
function figEArcher(u) {
  const s = u.id * 3.1;
  ctx.lineWidth = 2;
  drawLegs(u, s, 2.5, -11);
  ln(0, -11, 0.5, -24, s + 2, 0.4);
  path([[-5, -24], [6, -24], [0, -36]], s + 3, 0.5, true); fillStroke(INK);
  ctx.fillStyle = RED; ctx.fillRect(2.5, -28.5, 2, 1.5);
  ctx.strokeStyle = RED; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(4, -19, 11, -1.1, 1.1); ctx.stroke(); ctx.strokeStyle = INK;
  ctx.lineWidth = 1; ln(4 + Math.cos(-1.1) * 11, -19 + Math.sin(-1.1) * 11, 4 + Math.cos(1.1) * 11, -19 + Math.sin(1.1) * 11, s + 4, .2);
}
function figBrute(u) {
  const s = u.id * 3.1;
  ctx.lineWidth = 3;
  drawLegs(u, s, 6, -14);
  const pts = []; for (let i = 0; i < 14; i++) { const t = i / 14 * Math.PI * 2; pts.push([Math.cos(t) * 15 * (1 + hash(s + i) * .15), -32 + Math.sin(t) * 20 * (1 + hash(s + i + 9) * .1)]); }
  path(pts, s + 1, 1.1, true); fillStroke(INK);
  ctx.lineWidth = 2; ln(-6, -50, -10, -58, s + 2, .5); ln(6, -50, 10, -58, s + 3, .5);
  ctx.fillStyle = RED; ctx.fillRect(3, -43, 3, 2); ctx.fillRect(9, -42, 3, 2);
  const a = u.atk > 0 ? -2.2 + (1 - u.atk / 0.25) * 2.9 : -1.1;
  ctx.lineWidth = 3.4; ln(10, -34, 10 + Math.cos(a) * 24, -34 + Math.sin(a) * 24, s + 4, .4);
  circle(10 + Math.cos(a) * 24, -34 + Math.sin(a) * 24, 5, s + 5, .8, 8); fillStroke(INK);
}
function figKing() {
  const u = { moving: king.vx !== 0, anim: king.anim, id: 7 };
  const s = 70;
  const sway = Math.sin(S.time * 3 + king.x * 0.02) * 2 + (u.moving ? -5 : 0);
  // cape
  ctx.lineWidth = 1.8; path([[-1, -32], [-12 + sway, -8], [-3 + sway * 0.4, -10], [2, -30]], s, .6, true); fillStroke(PAPER);
  ctx.strokeStyle = RED; ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) ln(-2 - i * 2.2, -27 + i * 4, -6 - i * 2 + sway * 0.5, -12 + i * 1.5, s + i, .3);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  drawLegs(u, s + 10, 3, -12);
  ln(0, -12, 0, -32, s + 11, .4);
  ln(0, -27, 8, -20 + (u.moving ? Math.sin(u.anim) * 2 : 0), s + 12, .3);
  ctx.lineWidth = 1.6; ln(8, -20, 9, -36, s + 13, .3); circle(9, -38, 2.4, s + 14, .3, 7); fillStroke(GOLD);
  ctx.lineWidth = 2; circle(1, -38, 6, s + 15, .4, 11); fillStroke();
  ctx.fillStyle = INK; ctx.fillRect(3, -39.5, 1.6, 1.6);
  path([[-5, -43], [-5, -50], [-2, -46], [1, -52], [4, -46], [7, -50], [7, -43]], s + 16, .3, true); ctx.lineWidth = 1.5; fillStroke(GOLD);
}
function figPeasant(p) {
  const s = p.home.id * 11 + p.i * 5;
  ctx.lineWidth = 1.7;
  drawLegs(p, s, 2, -9);
  ln(0, -9, 0, -21, s + 2, .3);
  ln(0, -17, 5, -12, s + 3, .3); ln(0, -17, -4, -12, s + 4, .3);
  circle(0, -25, 4, s + 5, .3, 9); fillStroke();
  ctx.lineWidth = 1.4; ln(-6, -28, 6, -28, s + 6, .3);
}

// ------------------------------------------------------------------ drawing: buildings (local, base at 0,0)
function drawPlot(b) {
  const s = b.id * 13;
  ctx.lineWidth = 1.3; ctx.setLineDash([4, 5]);
  ctx.strokeStyle = 'rgba(29,28,34,0.45)';
  ctx.strokeRect(-b.w / 2, -BDEF[b.kind].h[1], b.w, BDEF[b.kind].h[1]);
  ctx.setLineDash([]); ctx.strokeStyle = INK;
  ctx.lineWidth = 2; ln(0, 0, 0, -26, s, .4);
  path([[0, -26], [12, -22], [0, -18]], s + 1, .4, true); fillStroke(b.dead ? INK : PAPER);
  if (b.dead) drawRubble(b);
}
function drawRubble(b) {
  const s = b.id * 17;
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 7; i++) {
    const x = (hash(s + i) - 0.5) * b.w * 0.8, r = 4 + hash(s + i + 3) * 6;
    path([[x - r, 0], [x - r * .6, -r], [x + r * .5, -r * 1.1], [x + r, 0]], s + i, .3, true); fillStroke();
  }
}
function cracks(b) {
  if (b.hp > b.maxhp * 0.55) return;
  ctx.lineWidth = 1.2; const s = b.id * 5;
  path([[-b.w * .2, -b.h * .8], [-b.w * .1, -b.h * .65], [-b.w * .25, -b.h * .5], [-b.w * .12, -b.h * .38]], s, .4); ctx.stroke();
  if (b.hp < b.maxhp * 0.3) { path([[b.w * .25, -b.h * .5], [b.w * .1, -b.h * .35], [b.w * .2, -b.h * .2]], s + 4, .4); ctx.stroke(); }
}
function towerTorch(x, y, s) {
  if (S.dark < 0.3) return;
  ctx.lineWidth = 1.4; ln(x, y, x, y - 10, s, .2);
  const f = Math.sin(S.time * 14 + s) * 1.5;
  ctx.fillStyle = '#e8892b'; ctx.strokeStyle = RED;
  path([[x - 3, y - 10], [x + f, y - 19], [x + 3, y - 10]], s + 1, .5, true); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = INK;
}
function drawKeep(b) {
  const s = b.id * 7, h = b.h, w = b.w;
  ctx.lineWidth = 2.2;
  // side walls
  path(crenels(-w / 2 - 22, -h * 0.5, 30, s, 7).concat([[-w / 2 + 8, 0], [-w / 2 - 22, 0]]), s, .4, true); fillStroke();
  path(crenels(w / 2 - 8, -h * 0.5, 30, s + 1, 7).concat([[w / 2 + 22, 0], [w / 2 - 8, 0]]), s + 1, .4, true); fillStroke();
  bricks(-w / 2 - 22, -h * 0.5 + 7, 30, h * 0.5 - 7, s + 2); bricks(w / 2 - 8, -h * 0.5 + 7, 30, h * 0.5 - 7, s + 3);
  // central tower
  ctx.lineWidth = 2.4;
  path(crenels(-w / 2 + 8, -h, w - 16, s + 4, 9).concat([[w / 2 - 8, 0], [-w / 2 + 8, 0]]), s + 4, .5, true); fillStroke();
  bricks(-w / 2 + 8, -h + 9, w - 16, h - 9, s + 5);
  // door
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-10, -18); ctx.arc(0, -18, 10, Math.PI, 0); ctx.lineTo(10, 0); ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
  ctx.lineWidth = 1; for (let x = -6; x <= 6; x += 4) ln(x, -2, x, -24 + Math.abs(x) * .5, s + x, .2);
  // windows
  ctx.lineWidth = 1.6; ln(-14, -h * .65, -14, -h * .55, s + 6, .2); ln(14, -h * .65, 14, -h * .55, s + 7, .2);
  ln(0, -h * .8, 0, -h * .7, s + 8, .2); ln(-4, -h * .75, 4, -h * .75, s + 9, .2);
  // flag
  ctx.lineWidth = 2; ln(0, -h, 0, -h - 46, s + 10, .3);
  const wv = S.time * 4;
  ctx.beginPath(); ctx.moveTo(0, -h - 46);
  for (let i = 1; i <= 6; i++) ctx.lineTo(i * 6, -h - 46 + Math.sin(wv + i * .9) * 3 + jt(s + i, .4));
  for (let i = 6; i >= 0; i--) ctx.lineTo(i * 6, -h - 30 + Math.sin(wv + i * .9) * 3 + jt(s + i + 9, .4));
  ctx.closePath(); fillStroke();
  ctx.lineWidth = 1; for (let k = 0; k < 3; k++) { ctx.beginPath(); for (let i = 0; i <= 6; i++) { const yy = -h - 42 + k * 4 + Math.sin(wv + i * .9) * 3; i ? ctx.lineTo(i * 6, yy) : ctx.moveTo(1, yy); } ctx.strokeStyle = RED; ctx.stroke(); } ctx.strokeStyle = INK;
  // tiny guard on battlement
  ctx.save(); ctx.translate(-w / 2 - 8, -h * 0.5); ctx.scale(0.8, 0.8); drawKnightBody({ moving: false, anim: 0 }, s + 30); ctx.restore();
  towerTorch(w / 2 - 14, -h, s + 40);
}
function drawHouse(b) {
  const s = b.id * 7, w = b.w, h = b.h, wall = h * 0.55;
  ctx.lineWidth = 2;
  // chimney + smoke
  ln(w * .2, -h * .75, w * .2, -h - 6, s, .3); ln(w * .32, -h * .62, w * .32, -h - 6, s + 1, .3); ln(w * .2, -h - 6, w * .32, -h - 6, s + 2, .2);
  for (let i = 0; i < 2 + b.lvl; i++) {
    const k = ((S.time * 0.25 + i / (2 + b.lvl)) % 1);
    ctx.globalAlpha = 1 - k; ctx.lineWidth = 1.4;
    cloud(w * .26 + k * 14 + Math.sin(k * 6) * 3, -h - 14 - k * 46, 5 + k * 6, 4 + k * 5, s + i); fillStroke();
    ctx.globalAlpha = 1;
  }
  ctx.lineWidth = 2;
  path([[-w / 2, 0], [-w / 2, -wall], [w / 2, -wall], [w / 2, 0]], s + 3, .4, true); fillStroke();
  path([[-w / 2 - 6, -wall], [0, -h], [w / 2 + 6, -wall]], s + 4, .5, true); fillStroke();
  ctx.lineWidth = 1; for (let i = 1; i < 6; i++) ln(-w / 2 + i * w / 6 - 2, -wall - 2, -w * .05 + i * 3 - 8, -h + 8, s + 10 + i, .3);
  ctx.lineWidth = 1.8; path([[-6, 0], [-6, -wall * .6], [6, -wall * .6], [6, 0]], s + 5, .3); ctx.stroke();
  ctx.strokeRect(-w / 2 + 6, -wall * .75, 9, 8); ctx.strokeRect(w / 2 - 15, -wall * .75, 9, 8);
  if (b.lvl > 1) { ctx.lineWidth = 1; ln(-w / 2 + 4, -wall * .3, -w / 2 + 14, -wall * .3, s + 20, .3); ln(w / 2 - 14, -wall * .3, w / 2 - 4, -wall * .3, s + 21, .3); }
  if (S.dark > 0.4) { ctx.fillStyle = 'rgba(232,170,60,0.75)'; ctx.fillRect(-w / 2 + 7, -wall * .75 + 1, 7, 6); ctx.fillRect(w / 2 - 14, -wall * .75 + 1, 7, 6); }
}
function drawFarm(b) {
  const s = b.id * 7, w = b.w;
  ctx.lineWidth = 1.4;
  const rows = 3 + b.lvl;
  for (let r = 0; r < rows; r++) for (let x = -w / 2 + 8; x < w / 2 - 22; x += 9) {
    const yy = -3 - r * 4;
    ln(x + r * 2, yy, x + r * 2 + 1, yy - 5 - hash(s + x + r) * 3, s + x + r * 7, .3);
  }
  ctx.lineWidth = 1.8;
  for (let i = 0; i < b.lvl; i++) {
    const hx = w / 2 - 14 - i * 14;
    ctx.beginPath(); ctx.moveTo(hx - 10, 0); ctx.quadraticCurveTo(hx - 9, -24, hx, -24 + jt(s + i, .6)); ctx.quadraticCurveTo(hx + 9, -24, hx + 10, 0); ctx.closePath(); fillStroke();
    ctx.lineWidth = 1; for (let k = -6; k <= 6; k += 4) ln(hx + k, -2, hx + k * 0.6, -16, s + k + i, .3); ctx.lineWidth = 1.8;
  }
  // fence
  ctx.lineWidth = 1.4; for (const fxp of [-w / 2, w / 2]) { ln(fxp, 0, fxp, -14, s + fxp, .3); }
  ln(-w / 2, -9, -w / 2 + 14, -10, s + 30, .3); ln(w / 2 - 6, -10, w / 2, -9, s + 31, .3);
  // farmer
  if (S.dark < 0.5) {
    ctx.save(); ctx.translate(-w * .15 + Math.sin(S.time * 0.3 + s) * 20, 0);
    const bob = Math.sin(S.time * 4 + s) * 0.3;
    figPeasant({ home: b, i: 9, moving: false, anim: 0 });
    ctx.lineWidth = 1.6; ln(4, -15, 12, -2 + bob * 10, s + 50, .3);
    ctx.restore();
  }
}
function drawWall(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2.2;
  if (b.lvl === 1) {
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 3 + i * (w - 6) / 3, hh = h - (i % 2) * 6;
      path([[x - 3, 0], [x - 3, -hh + 6], [x, -hh], [x + 3, -hh + 6], [x + 3, 0]], s + i, .4); fillStroke();
    }
    ctx.lineWidth = 1.6; ln(-w / 2 - 2, -h * .3, w / 2 + 2, -h * .35, s + 9, .5); ln(-w / 2 - 2, -h * .65, w / 2 + 2, -h * .62, s + 10, .5);
  } else {
    path(crenels(-w / 2, -h, w, s, 6.5).concat([[w / 2 + 2, 0], [-w / 2 - 2, 0]]), s, .4, true); fillStroke();
    bricks(-w / 2, -h + 7, w, h - 7, s, 8);
    ctx.lineWidth = 1.6; ln(-w / 2 + 2, 0, -w / 2 + 2, -h + 7, s + 3, .3);
    if (b.lvl === 3) { ctx.save(); ctx.translate(0, -h); ctx.scale(0.75, 0.75); drawKnightBody({ moving: false, anim: 0 }, s + 4); ctx.restore(); }
  }
  cracks(b);
}
function drawTower(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2.2;
  path(crenels(-w / 2 - 4, -h, w + 8, s, 8).concat([[w / 2 + 4, -h + 18], [w / 2, -h + 22], [w / 2, 0], [-w / 2, 0], [-w / 2, -h + 22], [-w / 2 - 4, -h + 18]]), s, .4, true); fillStroke();
  bricks(-w / 2, -h + 24, w, h - 24, s + 1, 9);
  ctx.lineWidth = 1.8; ln(0, -h * .6, 0, -h * .45, s + 2, .2); ln(-4, -h * .55, 4, -h * .55, s + 3, .2);
  ctx.save(); ctx.translate(0, -h); ctx.scale(0.8, 0.8);
  figArcher({ id: b.id + 100, moving: false, anim: 0, atk: b.cool > 1.2 ? 0.2 : 0, cool: b.cool });
  ctx.restore();
  if (b.lvl > 1) { ctx.save(); ctx.translate(-12, -h); ctx.scale(-0.8, 0.8); figArcher({ id: b.id + 200, moving: false, anim: 0, atk: 0, cool: 2 }); ctx.restore(); }
  towerTorch(w / 2, -h + 18, s + 5);
  cracks(b);
}
function drawBarracks(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2.2;
  path([[-w / 2, 0], [-w * .3, -h * .55], [0, -h], [w * .3, -h * .55], [w / 2, 0]], s, .5, true); fillStroke();
  ctx.lineWidth = 1.2; for (let i = -2; i <= 2; i++) ln(0, -h + 4, i * w * .2, -2, s + i, .4);
  ctx.lineWidth = 2; path([[-10, 0], [0, -h * .45], [10, 0]], s + 5, .4, true); fillStroke(INK);
  ln(0, -h, 0, -h - 24, s + 6, .3);
  const wv = S.time * 4;
  ctx.beginPath(); ctx.moveTo(0, -h - 24); ctx.lineTo(18, -h - 22 + Math.sin(wv) * 2); ctx.lineTo(0, -h - 15); ctx.closePath(); ctx.fillStyle = RED; ctx.fill(); ctx.stroke();
  // weapon rack
  ctx.lineWidth = 1.6; ln(w / 2 + 4, 0, w / 2 + 4, -24, s + 7, .3); ln(w / 2 + 12, 0, w / 2 + 12, -24, s + 8, .3); ln(w / 2 + 1, -18, w / 2 + 15, -18, s + 9, .3);
  ln(w / 2 + 6, -2, w / 2 + 9, -32, s + 10, .3); ln(w / 2 + 10, -2, w / 2 + 7, -30, s + 11, .3);
}
function drawRange(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2;
  path([[-w / 2, 0], [-w / 2, -h * .7], [w * .1, -h * .7], [w * .1, 0]], s, .4, true); fillStroke();
  path([[-w / 2 - 6, -h * .7], [-w * .2, -h], [w * .1 + 6, -h * .7]], s + 1, .5, true); fillStroke();
  ctx.lineWidth = 1; for (let x = -w / 2 + 6; x < w * .1; x += 6) ln(x, -2, x, -h * .7 + 3, s + x, .2);
  // target
  ctx.lineWidth = 1.8; ln(w * .35, 0, w * .32, -30, s + 2, .3); ln(w * .45, 0, w * .48, -30, s + 3, .3);
  for (const r of [13, 8, 3]) { circle(w * .4, -34, r, s + r, .4, 10); r === 3 ? fillStroke(RED) : fillStroke(); }
  ctx.lineWidth = 1.4; ln(w * .4 - 2, -36, w * .4 - 14, -42, s + 4, .2);
}
function drawWorkshop(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2;
  path([[-w / 2, 0], [-w / 2, -h * .65], [w * .15, -h], [w * .15, 0]], s, .4, true); fillStroke();
  ctx.lineWidth = 1; for (let y = -8; y > -h * .6; y -= 8) ln(-w / 2 + 2, y, w * .15 - 2, y - 3, s + y, .3);
  ctx.lineWidth = 2; circle(w * .35, -14, 14, s + 1, .5, 12); fillStroke();
  ctx.lineWidth = 1.2; for (let a = 0; a < 3; a++) ln(w * .35 + Math.cos(a) * 13, -14 + Math.sin(a) * 13, w * .35 - Math.cos(a) * 13, -14 - Math.sin(a) * 13, s + a, .2);
  ctx.lineWidth = 2.4; ln(w * .05, -h * .9, w * .55, -h * .4, s + 9, .4);
  ctx.lineWidth = 1.6; ln(-12, 0, -12, -16, s + 10, .3); ln(-2, 0, -2, -16, s + 11, .3); ln(-12, -16, -2, -16, s + 12, .3);
}
function drawEWall(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2.6;
  const top = [[-w / 2, -h + 8]];
  for (let i = 0; i <= 4; i++) { const x = -w / 2 + i * w / 4; top.push([x, -h - (i % 2 ? 10 : 0)]); }
  path(top.concat([[w / 2, -h + 8], [w / 2 + 3, 0], [-w / 2 - 3, 0]]), s, .5, true); fillStroke();
  ctx.lineWidth = 1.2;
  for (let y = -h + 10; y < -4; y += 7) ln(-w / 2 + 2, y, w / 2 - 2, y + 9, s + y, .5);
  ctx.lineWidth = 2; for (let i = 0; i < 3; i++) ln(-w / 2 - 2, -h * (0.3 + i * .2), -w / 2 - 14, -h * (0.3 + i * .2) - 4, s + 30 + i, .3);
  cracks(b);
}
function drawETower(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2.6;
  const pts = [[-w / 2 - 6, -h + 22], [-w / 2 - 6, -h]];
  for (let i = 0; i <= 5; i++) pts.push([-w / 2 - 6 + i * (w + 12) / 5, -h - (i % 2 ? 0 : 12)]);
  path(pts.concat([[w / 2 + 6, -h + 22], [w / 2, -h + 26], [w / 2, 0], [-w / 2, 0], [-w / 2, -h + 26]]), s, .5, true); fillStroke();
  ctx.lineWidth = 1.2;
  for (let y = -h + 30; y < -4; y += 6) ln(-w / 2 + 2, y, w / 2 - 2, y + 10, s + y, .5);
  ctx.fillStyle = RED; ctx.fillRect(-2, -h * .62, 4, 12);
  ctx.save(); ctx.translate(0, -h); ctx.scale(-0.85, 0.85); figEArcher({ id: b.id + 300, moving: false, anim: 0 }); ctx.restore();
  towerTorch(-w / 2 - 2, -h + 18, s + 6);
  cracks(b);
}
function drawEKeep(b) {
  const s = b.id * 7, w = b.w, h = b.h;
  ctx.lineWidth = 2.8;
  const pts = [[-w / 2, 0], [-w / 2, -h * .62]];
  for (let i = 0; i <= 8; i++) pts.push([-w / 2 + i * w / 8, -h * .62 - (i % 2 ? 12 : 0)]);
  path(pts.concat([[w / 2, 0]]), s, .5, true); fillStroke();
  const tp = [[-w * .22, -h * .62], [-w * .22, -h]];
  for (let i = 0; i <= 4; i++) tp.push([-w * .22 + i * w * .11, -h - (i % 2 ? 0 : 14)]);
  path(tp.concat([[w * .22, -h * .62]]), s + 1, .5, true); fillStroke();
  ctx.lineWidth = 1.1;
  for (let y = -h * .6; y < -4; y += 6) ln(-w / 2 + 3, y, w / 2 - 3, y + 14, s + y, .6);
  for (let y = -h + 16; y < -h * .62; y += 6) ln(-w * .2, y, w * .2, y + 8, s + y + 3, .5);
  ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, -30); ctx.lineTo(0, -44); ctx.lineTo(16, -30); ctx.lineTo(16, 0); fillStroke(INK);
  ctx.strokeStyle = PAPER; ctx.lineWidth = 1.3; for (let x = -10; x <= 10; x += 5) ln(x, -2, x, -34 + Math.abs(x), s + x, .2);
  ctx.strokeStyle = INK;
  ctx.fillStyle = RED; ctx.fillRect(-w * .1 - 2, -h * .85, 4, 14); ctx.fillRect(w * .1 - 2, -h * .85, 4, 14);
  ctx.lineWidth = 2; ln(0, -h - 14, 0, -h - 60, s + 9, .3);
  const wv = S.time * 3.4;
  ctx.beginPath(); ctx.moveTo(0, -h - 60);
  for (let i = 1; i <= 7; i++) ctx.lineTo(i * 6, -h - 60 + Math.sin(wv + i) * 3);
  for (let i = 7; i >= 0; i--) ctx.lineTo(i * 6 - (i === 7 ? 6 : 0), -h - 42 + Math.sin(wv + i) * 3);
  ctx.closePath(); ctx.fillStyle = RED; ctx.fill(); ctx.stroke();
  towerTorch(-w / 2 + 6, -h * .62, s + 12); towerTorch(w / 2 - 6, -h * .62, s + 13);
  cracks(b);
}
const BDRAW = { keep: drawKeep, house: drawHouse, farm: drawFarm, wall: drawWall, tower: drawTower, barracks: drawBarracks, range: drawRange, workshop: drawWorkshop, ewall: drawEWall, etower: drawETower, ekeep: drawEKeep };

function hpBar(x, y, w, frac, col) {
  ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.fillStyle = PAPER;
  ctx.fillRect(x - w / 2, y, w, 4); ctx.strokeRect(x - w / 2, y, w, 4);
  ctx.fillStyle = col; ctx.fillRect(x - w / 2 + 1, y + 1, Math.max(0, (w - 2) * frac), 2);
}

// ------------------------------------------------------------------ drawing: world
function drawPaper() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = RULE; ctx.lineWidth = 1;
  const step = Math.max(22, 28 * SCALE);
  ctx.beginPath(); for (let y = step * 2; y < H; y += step) { ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); } ctx.stroke();
  ctx.strokeStyle = MARGIN; ctx.beginPath(); ctx.moveTo(Math.min(72, W * .08), 0); ctx.lineTo(Math.min(72, W * .08), H); ctx.stroke();
}
function worldTransform(par = 1) {
  const k = DPR * SCALE;
  ctx.setTransform(k, 0, 0, k, -camX * par * k, GY * k);
}
function drawBackdrop() {
  // far hills
  worldTransform(0.35);
  ctx.strokeStyle = 'rgba(29,28,34,0.22)'; ctx.lineWidth = 1.4;
  const x0 = camX * 0.35 - 100, x1 = x0 + VW + 300;
  ctx.beginPath();
  for (let x = Math.floor(x0 / 20) * 20; x < x1; x += 20) {
    const y = -60 - Math.sin(x * 0.006) * 30 - Math.sin(x * 0.017 + 2) * 12 - (x > 1150 ? (x - 1150) * 0.05 : 0);
    x === Math.floor(x0 / 20) * 20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  // distant scribble trees
  worldTransform(0.6);
  ctx.strokeStyle = 'rgba(29,28,34,0.28)';
  const t0 = camX * 0.6 - 100, t1 = t0 + VW + 200;
  for (let i = Math.floor(t0 / 90); i < t1 / 90; i++) {
    if (hash(i * 3.3) < 0.45) continue;
    const x = i * 90 + hash(i) * 50, r = 12 + hash(i + 1) * 14;
    ctx.lineWidth = 1.2; ln(x, -16, x, -16 - r, i * 7, .4);
    cloud(x, -20 - r * 1.4, r, r * 0.8, i, 7); ctx.fillStyle = PAPER; ctx.fill(); ctx.stroke();
  }
  // dark lands hatching (world layer)
  worldTransform(1);
  const hx0 = Math.max(2700, camX - 50), hx1 = Math.min(WORLD + 200, camX + VW + 50);
  if (hx1 > hx0) {
    ctx.lineWidth = 1;
    for (let x = Math.floor(hx0 / 10) * 10; x < hx1; x += 10) {
      const k = clamp((x - 2700) / 900, 0, 1);
      if (hash(x * 0.71) > k) continue;
      ctx.strokeStyle = `rgba(29,28,34,${0.06 + k * 0.1})`;
      const top = -360 + hash(x) * 60;
      ln(x, -6, x + 70, top * (0.5 + k * 0.5), x, 1.2);
    }
  }
  ctx.strokeStyle = INK;
}
function drawWoods() {
  const x0 = Math.max(2050, camX - 80), x1 = Math.min(3700, camX + VW + 80);
  for (let i = Math.floor(x0 / 46); i < x1 / 46; i++) {
    if (hash(i * 9.1) < 0.35) continue;
    const x = i * 46 + hash(i * 2) * 30, dead = x > 3050;
    const h = 40 + hash(i * 5) * 50;
    ctx.save(); ctx.translate(x, gy(x)); ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2; ctx.strokeStyle = INK;
    ln(0, 0, 0, -h, i, .6);
    if (dead) {
      ctx.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) { const y = -h * (0.4 + k * .15), d = hash(i + k) > .5 ? 1 : -1; ln(0, y, d * (10 + k * 2), y - 12, i + k, .5); }
    } else {
      ctx.lineWidth = 1.6; cloud(0, -h - 8, 16 + hash(i) * 8, 14 + hash(i + 3) * 6, i, 8); fillStroke();
      ctx.lineWidth = 1; for (let k = 0; k < 4; k++) ln(-8 + k * 5, -h - 4 + hash(i + k) * 8, -4 + k * 5, -h - 6 + hash(i + k) * 8, i + k * 3, .3);
    }
    ctx.restore();
  }
  // war camp
  for (const cx of [3380, 3520]) {
    if (cx < camX - 100 || cx > camX + VW + 100) continue;
    ctx.save(); ctx.translate(cx, gy(cx)); ctx.lineWidth = 2;
    path([[-24, 0], [0, -34], [24, 0]], cx, .5, true); fillStroke(INK);
    ctx.lineWidth = 1.6; ln(0, -34, -4, -44, cx + 1, .3); ln(0, -34, 5, -42, cx + 2, .3);
    ctx.restore();
  }
  const fireX = 3450;
  if (fireX > camX - 60 && fireX < camX + VW + 60) {
    ctx.save(); ctx.translate(fireX, gy(fireX));
    ctx.lineWidth = 1.6; ln(-10, 0, 10, -4, 1, .3); ln(-10, -4, 10, 0, 2, .3);
    const f = Math.sin(S.time * 12) * 2;
    ctx.fillStyle = '#e8892b'; ctx.strokeStyle = RED;
    path([[-7, -2], [-3 + f, -16], [0, -8], [3 - f, -20], [7, -2]], 3, .8, true); ctx.fill(); ctx.stroke();
    ctx.restore(); ctx.strokeStyle = INK;
  }
}
function drawGround() {
  const x0 = camX - 60, x1 = camX + VW + 60;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let x = Math.floor(x0 / 18) * 18; x < x1; x += 18) {
    const y = gy(x) + jt(x * 0.1, 0.6);
    x === Math.floor(x0 / 18) * 18 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineWidth = 1.3;
  for (let x = Math.floor(x0 / 31) * 31; x < x1; x += 31) {
    const h1 = hash(x * 0.37);
    const y = 14 + h1 * 90, len = 6 + hash(x) * 12;
    if (y < VHt - GY - 4) ln(x + hash(x * 2) * 20, y, x + hash(x * 2) * 20 + len, y, x, .4);
    if (hash(x * 1.7) > 0.55) { const gx = x + hash(x * 3) * 25, g0 = gy(gx); ln(gx, g0, gx - 2, g0 - 5, x + 1, .3); ln(gx + 2, g0, gx + 4, g0 - 6, x + 2, .3); }
  }
  // cliff + sea at the far west
  if (camX < 120) {
    ctx.lineWidth = 2.2; path([[0, gy(0)], [-12, 30], [-6, 70], [-20, 140]], 5, 1); ctx.stroke();
    ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) ln(-140 + i * 20, 60 + i * 8, -120 + i * 20, 60 + i * 8, i, .5);
  }
}
function drawBuildings(team) {
  for (const b of buildings) {
    if (b.team !== team) continue;
    if (b.x + b.w + 60 < camX || b.x - b.w - 60 > camX + VW) continue;
    ctx.save();
    const shake = b.hurt > 0 ? jt(S.time * 50, 1.6) : 0;
    ctx.translate(b.x + shake, gy(b.x));
    ctx.strokeStyle = INK;
    if (!aliveB(b)) drawPlot(b); else BDRAW[b.kind](b);
    ctx.restore();
    if (aliveB(b) && b.hp < b.maxhp) hpBar(b.x, gy(b.x) - b.h - (b.kind === 'keep' ? 64 : 18), Math.min(54, b.w + 10), b.hp / b.maxhp, b.team === 1 ? INK : RED);
  }
}
const FIG = { sword: figSword, archer: figArcher, cata: figCata, raider: figRaider, earcher: figEArcher, brute: figBrute };
function drawUnits() {
  for (const u of units) {
    if (u.x < camX - 60 || u.x > camX + VW + 60) continue;
    ctx.save();
    ctx.translate(u.x, gy(u.x));
    if (u.dead) {
      const k = Math.min(1, u.deadT / 0.3);
      ctx.globalAlpha = clamp(1 - (u.deadT - 5) / 2, 0, 1);
      ctx.rotate(-u.face * k * Math.PI / 2 * 0.95);
    }
    if (u.hurt > 0) ctx.translate(jt(S.time * 40 + u.id, 1.5), 0);
    ctx.scale(u.face, 1);
    ctx.strokeStyle = INK;
    FIG[u.kind](u);
    ctx.restore();
    if (!u.dead && u.hp < u.maxhp) hpBar(u.x, gy(u.x) - UDEF[u.kind].h - 10, 20, u.hp / u.maxhp, u.team === 1 ? INK : RED);
  }
}
function drawPeasants() {
  if (S.dark > 0.6) return;
  ctx.globalAlpha = 1 - S.dark / 0.6;
  for (const p of peasants) {
    if (p.x < camX - 40 || p.x > camX + VW + 40) continue;
    ctx.save(); ctx.translate(p.x, gy(p.x)); ctx.scale(p.face || 1, 1); ctx.strokeStyle = INK; figPeasant(p); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function drawKingSprite() {
  ctx.save(); ctx.translate(king.x, gy(king.x)); ctx.scale(king.face, 1); ctx.strokeStyle = INK; figKing(); ctx.restore();
}
function drawDecals() {
  for (const d of decals) {
    if (d.x < camX - 30 || d.x > camX + VW + 30) continue;
    ctx.globalAlpha = clamp(1 - (d.t - 30) / 10, 0, 1) * 0.8;
    ctx.fillStyle = d.col; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2, r = d.r * (0.6 + hash(d.s + i) * 0.6); ctx.lineTo(d.x + Math.cos(t) * r * 1.6, gy(d.x) + 2 + Math.sin(t) * r * 0.35); }
    ctx.fill();
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(d.x + (hash(d.s + i * 9) - .5) * d.r * 5, gy(d.x) + 1, 1.2 + hash(d.s + i) * 1.5, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawCoin(x, y, s, r = 4.5) { ctx.lineWidth = 1.4; ctx.strokeStyle = INK; circle(x, y, r, s, .3, 9); fillStroke(GOLD); ctx.lineWidth = 1; ln(x - 1, y - 2, x - 1, y + 2, s + 1, .2); }
function drawCoins() {
  for (const c of coins) {
    if (c.t > 80 && Math.floor(S.time * 6) % 2) continue;
    drawCoin(c.x, c.y, c.x);
  }
}
function drawProjectiles() {
  for (const p of projs) {
    if (p.x < camX - 40 || p.x > camX + VW + 40) continue;
    if (p.kind === 'arrow') {
      const a = Math.atan2(p.vy, p.vx), c = Math.cos(a), s = Math.sin(a);
      ctx.strokeStyle = p.team === 2 ? RED : INK; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x - c * 10, p.y - s * 10); ctx.lineTo(p.x + c * 4, p.y + s * 4); ctx.stroke();
      ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x - c * 10, p.y - s * 10); ctx.lineTo(p.x - c * 13 - s * 3, p.y - s * 13 + c * 3); ctx.moveTo(p.x - c * 10, p.y - s * 10); ctx.lineTo(p.x - c * 13 + s * 3, p.y - s * 13 - c * 3); ctx.stroke();
      ctx.strokeStyle = 'rgba(29,28,34,0.25)'; ctx.beginPath(); ctx.moveTo(p.x - c * 12, p.y - s * 12); ctx.lineTo(p.x - p.vx * 0.08, p.y - p.vy * 0.08); ctx.stroke();
    } else {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; circle(p.x, p.y, 6, p.x * .1, 1, 8); fillStroke(INK);
      ctx.strokeStyle = 'rgba(29,28,34,0.3)'; ctx.lineWidth = 1; ln(p.x - p.vx * .1, p.y - p.vy * .1, p.x - p.vx * .02, p.y - p.vy * .02, 1, .5);
    }
  }
  ctx.strokeStyle = INK;
}
function drawFx() {
  for (const f of fx) {
    const k = f.t / f.life;
    if (f.type === 'puff') {
      ctx.globalAlpha = Math.max(0, 1 - k); ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
      cloud(f.x, f.y, f.r, f.r * .75, f.s, 7); fillStroke();
    } else if (f.type === 'debris') {
      ctx.globalAlpha = Math.max(0, 1 - k * k); ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
      ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.strokeRect(-3, -2, 6, 4); ctx.restore();
    } else if (f.type === 'stuck') {
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, k - .7) / .3); ctx.lineWidth = 1.3; ctx.strokeStyle = INK;
      const c = Math.cos(f.ang), s = Math.sin(f.ang);
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - c * 11, f.y - s * 11); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(f.x - c * 11, f.y - s * 11); ctx.lineTo(f.x - c * 13 - s * 3, f.y - s * 13 + c * 3); ctx.stroke();
    } else if (f.type === 'slash') {
      ctx.globalAlpha = 1 - k; ctx.strokeStyle = RED; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(f.x, f.y, 10, -1.2 * f.f, 0.9 * f.f, f.f < 0); ctx.stroke();
    } else if (f.type === 'text') {
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.font = `20px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = f.col === GOLD ? '#9a6f0c' : f.col;
      ctx.fillText(f.str, f.x, f.y);
    } else if (f.type === 'fly') {
      if (f.t < 0) continue;
      const x = f.x0 + (f.x1 - f.x0) * k, y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 40;
      ctx.globalAlpha = 1; drawCoin(x, y, f.x0 + f.t, 3.5);
    }
  }
  ctx.globalAlpha = 1; ctx.strokeStyle = INK;
}
function drawPrompt() {
  if (S.over) return;
  const b = nearestPlot(); if (!b) return;
  const o = plotOffer(b);
  const y = gy(b.x) - Math.max(b.h, BDEF[b.kind].h[1]) - (b.kind === 'keep' ? 84 : 36);
  ctx.font = `17px ${FONT}`; ctx.textAlign = 'center';
  const label = o.act ? `${o.verb} ${o.what}` : o.what;
  const tw = ctx.measureText(label).width + (o.act ? 46 : 16);
  ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
  path([[b.x - tw / 2, y - 16], [b.x + tw / 2, y - 16], [b.x + tw / 2, y + 7], [b.x + 6, y + 7], [b.x, y + 14], [b.x - 6, y + 7], [b.x - tw / 2, y + 7]], b.id + 1, .6, true); fillStroke();
  ctx.fillStyle = INK; ctx.fillText(label, b.x - (o.act ? 18 : 0), y + 1);
  if (o.act) {
    const can = S.gold >= o.cost;
    drawCoin(b.x + tw / 2 - 30, y - 4, 3, 5);
    ctx.fillStyle = can ? INK : RED; ctx.textAlign = 'left'; ctx.fillText(String(o.cost), b.x + tw / 2 - 23, y + 1);
  }
}
function drawNight() {
  if (S.dark < 0.02) return;
  nctx.setTransform(1, 0, 0, 1, 0, 0);
  nctx.globalCompositeOperation = 'source-over';
  nctx.clearRect(0, 0, nc.width, nc.height);
  nctx.fillStyle = `rgba(14,17,40,${0.72 * S.dark})`;
  nctx.fillRect(0, 0, nc.width, nc.height);
  nctx.globalCompositeOperation = 'destination-out';
  const k = DPR * SCALE;
  const light = (wx, wy, r) => {
    const sx = (wx - camX) * k, sy = (GY + wy) * k, rr = r * k;
    if (sx < -rr || sx > nc.width + rr) return;
    const g = nctx.createRadialGradient(sx, sy, 0, sx, sy, rr);
    g.addColorStop(0, 'rgba(0,0,0,0.9)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = g; nctx.beginPath(); nctx.arc(sx, sy, rr, 0, 7); nctx.fill();
  };
  light(king.x, gy(king.x) - 30, 120);
  for (const b of buildings) {
    if (!aliveB(b)) continue;
    if (b.kind === 'keep') light(b.x, -b.h * .6, 190);
    else if (b.kind === 'tower' || b.kind === 'etower') light(b.x, -b.h + 10, 110);
    else if (b.kind === 'house') light(b.x, -20, 90);
    else if (b.kind === 'ekeep') light(b.x, -b.h * .6, 160);
  }
  light(3450, -10, 110);
  for (const p of projs) if (p.kind === 'rock') light(p.x, p.y, 40);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(nc, 0, 0);
}

// ------------------------------------------------------------------ UI
function txt(str, x, y, size, align = 'left', col = INK) { ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.fillStyle = col; ctx.fillText(str, x, y); }
function drawSky() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const k = S.phase === 'day' ? clamp(S.t / S.dayLen, 0, 1) : 0.5;
  const cx = W * (0.15 + k * 0.7), cy = Math.min(150, H * 0.28) - Math.sin(k * Math.PI) * Math.min(80, H * 0.12);
  ctx.strokeStyle = INK;
  if (S.phase === 'day') {
    ctx.lineWidth = 1.8; circle(cx, cy, 16, 900, .6, 12); fillStroke();
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + S.time * 0.1; ln(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30, i * 3 + 900, .4); }
  } else {
    const mx = W * 0.78, my = Math.min(110, H * .2);
    ctx.lineWidth = 1.8; circle(mx, my, 18, 800, .5, 14); fillStroke();
    ctx.lineWidth = 1; circle(mx - 5, my - 4, 4, 801, .3, 8); ctx.stroke(); circle(mx + 6, my + 5, 3, 802, .3, 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(243,239,227,0.9)';
    for (let i = 0; i < 26; i++) { const sx = hash(i * 3.1) * W, sy = hash(i * 7.7) * H * 0.4 + 10; ln(sx - 3, sy, sx + 3, sy, i, .3); ln(sx, sy - 3, sx, sy + 3, i + .5, .3); }
    ctx.strokeStyle = INK;
  }
}
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const pad = 16, top = 30;
  const night = S.dark > 0.5;
  const fg = night ? PAPER : INK;
  ctx.strokeStyle = fg;
  ctx.save(); ctx.translate(0, 0);
  drawCoin(pad + 14, top, 1, 11);
  txt(String(S.gold), pad + 32, top + 10, 30, 'left', fg);
  txt((S.phase === 'day' ? 'Day ' : 'Night ') + S.day, pad + 2, top + 40, 22, 'left', fg);
  let sub;
  if (S.phase === 'day') sub = `nightfall in ${Math.max(0, Math.ceil(S.dayLen - S.t))}s`;
  else { const left = S.waveQ.length + units.filter(u => u.wave && !u.dead).length; sub = `${left} raider${left === 1 ? '' : 's'} left`; }
  txt(sub, pad + 2, top + 62, 17, 'left', fg);
  ctx.restore();
  // army panel
  const c = { sword: 0, archer: 0, cata: 0 };
  for (const u of units) if (!u.dead && u.team === 1) c[u.kind]++;
  const rx = W - pad;
  txt(S.mode === 'attack' ? 'Army: marching' : 'Army: holding the wall', rx, top + 6, 20, 'right', S.mode === 'attack' ? RED : fg);
  txt(`${c.sword} swords · ${c.archer} archers · ${c.cata} catapults`, rx, top + 28, 16, 'right', fg);
  if (!document.body.classList.contains('touch') && W > 700) {
    txt('A/D move · Shift run · Space build · F march/fall back · N call the night · M mute', W / 2, H - 46, 15, 'center', night ? 'rgba(243,239,227,0.8)' : 'rgba(29,28,34,0.65)');
  }
  drawMinimap(night);
  if (S.banner) {
    const b = S.banner, a = clamp(Math.min(b.t, b.dur - b.t + 0.3) / 0.5, 0, 1);
    ctx.globalAlpha = a;
    txt(b.text, W / 2, Math.min(110, H * 0.2), Math.min(54, W * 0.11), 'center', fg);
    if (b.sub) txt(b.sub, W / 2, Math.min(110, H * 0.2) + 30, Math.min(20, W * 0.05), 'center', fg);
    ctx.globalAlpha = 1;
  }
  if (S.paused) { txt('Paused', W / 2, H / 2, 48, 'center', fg); txt('press P to carry on', W / 2, H / 2 + 30, 20, 'center', fg); }
}
function drawMinimap(night) {
  const w = Math.min(520, W * 0.7), x0 = (W - w) / 2;
  const y = document.body.classList.contains('touch') ? H - 92 : H - 20;
  const col = night ? 'rgba(243,239,227,0.85)' : 'rgba(29,28,34,0.7)';
  ctx.strokeStyle = col; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
  const mx = x => x0 + x / WORLD * w;
  for (const b of buildings) {
    if (!aliveB(b)) continue;
    ctx.fillStyle = b.team === 1 ? col : RED;
    const hh = b.kind === 'keep' || b.kind === 'ekeep' ? 9 : b.kind.includes('wall') ? 7 : 4;
    ctx.fillRect(mx(b.x) - 1.5, y - hh, 3, hh);
  }
  for (const u of units) { if (u.dead) continue; ctx.fillStyle = u.team === 1 ? col : RED; ctx.fillRect(mx(u.x) - 1, y + 3, 2, 2); }
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(mx(king.x), y - 4, 3.2, 0, 7); ctx.fill();
  ctx.strokeStyle = col; ctx.strokeRect(mx(camX), y - 12, VW / WORLD * w, 20);
}
function drawCard(lines) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const w = Math.min(560, W - 40), h = 60 + lines.length * 30, x = (W - w) / 2, y = Math.max(20, (H - h) / 2 - 20);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  path([[x, y], [x + w, y + 3], [x + w - 3, y + h], [x + 2, y + h - 2]], 4242, 1.2, true); fillStroke();
  let yy = y + 50;
  for (const [t, size, col] of lines) { txt(t, W / 2, yy, Math.min(size, w / Math.max(8, t.length) * 1.9), 'center', col || INK); yy += size > 30 ? 40 : 28; }
}

// ------------------------------------------------------------------ main loop
let state = 'title';
let last = performance.now(), boilT = 0;
function render() {
  drawPaper();
  drawSky();
  drawBackdrop();
  worldTransform(1);
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  drawWoods();
  drawBuildings(2);
  drawBuildings(1);
  drawDecals();
  drawGround();
  drawPeasants();
  drawCoins();
  drawUnits();
  drawKingSprite();
  drawProjectiles();
  drawFx();
  drawNight();
  worldTransform(1);
  if (state !== 'title') { drawPrompt(); drawHUD(); }
  if (state === 'title') {
    drawCard([
      ['INKHOLD', 64],
      ['Build your village by day. Hold the wall by night.', 21],
      ['Then march on the Black Keep and burn it down.', 21],
      ['A / D or arrows to walk · Space to build and recruit', 18, '#55515c'],
      ['F to march or fall back · N to call the night early', 18, '#55515c'],
      ['press Space or tap to begin', 22, RED],
    ]);
  } else if (S.over && S.overT > 0.8) {
    drawCard(S.over === 'win'
      ? [['The Black Keep has fallen', 40], [`You won on day ${S.day} with ${S.kills} raiders slain.`, 20], ['press Space or tap to play again', 20, RED]]
      : [['Your keep has fallen', 40], [`You held out for ${S.day} day${S.day === 1 ? '' : 's'}.`, 20], ['press Space or tap to try again', 20, RED]]);
  }
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  boilT += dt; if (boilT > 0.13) { boilT = 0; boil = (boil + 1) % 5; }
  if (state === 'title') { if (pressed.act) { state = 'play'; newGame(); } S.time += dt; }
  else update(dt);
  const target = clamp(king.x - VW * 0.42 + king.face * VW * 0.06, 0, Math.max(0, WORLD - VW));
  camX += (target - camX) * Math.min(1, dt * 4);
  if (VW > WORLD) camX = (WORLD - VW) / 2;
  render();
  pressed = {};
  requestAnimationFrame(frame);
}
newGame();
S.banner = null;
camX = clamp(king.x - VW * 0.42, 0, Math.max(0, WORLD - VW));
requestAnimationFrame(frame);

// test hook (used by the headless check; harmless in the browser)
window.__inkhold = { S, get units() { return units; }, get buildings() { return buildings; }, get king() { return king; }, coins: () => coins.filter(c => c.x < 2000),  update, render, newGame, keys, setPressed: k => { pressed[k] = true; }, clearPressed: () => { pressed = {}; }, start: () => { state = 'play'; newGame(); } };
})();
