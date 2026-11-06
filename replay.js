/* Chess 2: the end-of-game highlights reel, like a YouTube Short.
   Every clip actually plays out: pieces move with motion trails, victims get knocked flying,
   meteors fall and explode, nukes flash and mushroom, boss lasers fire, kings topple.
   Slow-mo at the moment of impact, screen shake, impact words, letterbox, captions and reactions. */
(() => {
'use strict';
const I = window.INK;
const { N } = I;
const PAPER = '#f2eee2', INK = '#1e1c24', RED = '#b3322b', GOLD = '#f3d55b';
const CLIP = 3600;
const WORDS = {
  capture: ['BONK!', 'CRUNCH!', 'YEET!', 'BAM!', 'OOF!', 'SMACK!', 'WHAM!'], shot: ['BANG!', 'PEW!', 'BLAM!', 'THWACK!'],
  meteor: ['KABOOM!', 'SPLAT!', 'BOOM!'], nuke: ['KA-BOOOOM'], special: ['SHEESH!', 'WHAT?!', 'NO WAY!', 'POW!'],
  item: ['YOINK!', 'SHINY!', 'OOOH!'], card: ['ZAP!', 'SHAZAM!', 'WHOOSH!'], bosshit: ['CRIT!', 'POW!', 'SMASH!'],
  bossatk: ['STOMP!', 'NEEEIGH!', 'ZZZAP!'], check: ['CHECK!'], move: ['WHOOSH'], mate: ['CHECKMATE'],
};
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function choose(all, max = 6) {
  if (!all.length) return [];
  const last = all[all.length - 1];
  const rest = all.slice(0, -1).map((c, i) => ({ c, i })).sort((a, b) => b.c.score - a.c.score).slice(0, max - 1).sort((a, b) => a.i - b.i).map(x => x.c);
  return [...rest, last];
}

// work out what happened in a clip by comparing the board before and after
function analyse(clip) {
  if (clip._a) return clip._a;
  const before = new Map(), after = new Map();
  clip.before.forEach((p, i) => { if (p) before.set(p.id, { p, i }); });
  clip.after.forEach((p, i) => { if (p) after.set(p.id, { p, i }); });
  const movers = [], victims = [], born = [], changed = [];
  for (const [id, b] of before) { const a = after.get(id); if (!a) victims.push(b); else if (a.i !== b.i) movers.push({ p: a.p, f: b.i, t: a.i }); else if (a.p.t !== b.p.t || a.p.s !== b.p.s) changed.push(a); }
  for (const [id, a] of after) if (!before.has(id)) born.push(a);
  // where the hit lands: the target square, or the middle of the victims
  let hit = clip.t;
  if ((hit == null || hit < 0) && victims.length) hit = victims[0].i;
  const kind = clip.kind || (victims.length ? 'capture' : 'move');
  const word = clip.mate != null ? 'CHECKMATE' : kind === 'bossatk' ? ({ laser: 'ZZZAP!', stomp: 'STOMP!', roar: 'NEEEIGH!', charge: 'CHARGE!' }[clip.attack] || 'NEEEIGH!') : (WORDS[kind] || WORDS.capture)[Math.floor(hash(clip.t + clip.before.length) * (WORDS[kind] || WORDS.capture).length)];
  const shot = kind === 'shot' || (kind === 'capture' && !movers.length && clip.f >= 0 && clip.f !== clip.t);
  return (clip._a = { movers, victims, born, changed, hit, kind, word, shot, before, after });
}

function play(canvas, clips, opts = {}) {
  const c = canvas.getContext('2d');
  let stop = false, raf = 0;
  const done = new Promise(resolve => {
    const t0 = performance.now(), total = clips.length * CLIP + 2800;
    const frame = now => {
      if (stop) { resolve(); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = Math.max(0, now - t0);
      if (t >= total) { resolve(); return; }
      const idx = Math.floor(t / CLIP);
      if (idx < clips.length) drawClip(c, W, H, clips[idx], (t % CLIP) / CLIP, idx, clips.length, now);
      else drawEnd(c, W, H, (t - clips.length * CLIP) / 2800, opts, now);
      grain(c, W, H, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  return { done, stop: () => { stop = true; cancelAnimationFrame(raf); } };
}

// clip timeline (0..1): set-up, action, IMPACT (slow-mo), aftermath
const T_ACT = .26, T_HIT = .46, T_SLOW = .62;
function sceneTime(k) {
  // slow motion just after impact: the real clip time from T_HIT to T_SLOW covers only a short slice of scene time
  if (k < T_HIT) return k;
  if (k < T_SLOW) return T_HIT + (k - T_HIT) * .25;
  return T_HIT + (T_SLOW - T_HIT) * .25 + (k - T_SLOW) * ((1 - T_HIT - (T_SLOW - T_HIT) * .25) / (1 - T_SLOW));
}

function drawClip(c, W, H, clip, k, idx, n, now) {
  const A = analyse(clip), kind = A.kind, big = kind === 'nuke' || kind === 'meteor';
  const s = sceneTime(k);
  const hit = A.hit >= 0 ? A.hit : 112, [hr, hc] = [hit / N | 0, hit % N];
  // camera: wide on the set-up, punches in at the impact, drifts out in the aftermath
  const S = big ? 9 : 7;
  const zIn = k < T_HIT ? 1 + k * .25 : k < T_SLOW ? 1.45 + (k - T_HIT) * .4 : 1.5 - (k - T_SLOW) * .5;
  const cell = Math.min(W, H * .72) / S * zIn;
  let shake = 0;
  if (k > T_HIT && k < T_HIT + .2) shake = (1 - (k - T_HIT) / .2) * cell * (big ? .35 : .12);
  const sx = (hash(now * .05) - .5) * shake * 2, sy = (hash(now * .05 + 9) - .5) * shake * 2;
  const tilt = kind === 'mate' || clip.mate != null ? -.05 : (k > T_ACT && k < T_SLOW ? Math.sin(idx * 2.3) * .04 : 0);
  let fx = (hc + .5) * cell, fy = (hr + .5) * cell;
  if (kind === 'bossatk' && clip.bossBefore) { const b = clip.bossBefore.at; fx = (fx + ((b % N) + 1) * cell) / 2; fy = (fy + ((b / N | 0) + 1) * cell) / 2; }
  const xy = sq => [((sq % N) + .5) * cell - fx, ((sq / N | 0) + .5) * cell - fy];

  c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  c.save();
  c.translate(W / 2 + sx, H * .46 + sy); c.rotate(tilt);
  // board squares (only the ones that could be on screen)
  const span = Math.ceil(Math.hypot(W, H) / cell / 2) + 1;
  for (let r = hr - span; r <= hr + span; r++) for (let cc = hc - span; cc <= hc + span; cc++) {
    if (r < 0 || cc < 0 || r >= N || cc >= N) continue;
    const x = (cc + .5) * cell - fx - cell / 2, y = (r + .5) * cell - fy - cell / 2;
    if ((r + cc) % 2) { c.fillStyle = 'rgba(30,28,36,.06)'; c.fillRect(x, y, cell, cell); }
    c.strokeStyle = 'rgba(30,28,36,.3)'; c.lineWidth = 1; c.strokeRect(x, y, cell, cell);
  }
  const vis = sq => { const [x, y] = xy(sq); return Math.abs(x) < W && Math.abs(y) < H; };
  const after = s >= T_HIT;
  // terrain and items
  const terr = after ? clip.terrAfter : clip.terrBefore;
  if (terr) for (let i = 0; i < N * N; i++) { const t = terr[i]; if (t && t.k !== 'boss' && vis(i)) { const [x, y] = xy(i); try { I.drawTerrain(c, t, x, y, cell, i, t.k !== 'mine'); } catch (e) { /* ignore odd terrain */ } } }
  const items = after ? clip.itemsAfter : clip.itemsBefore;
  const board = after ? clip.after : clip.before;
  if (items && I.ITEMS) for (let i = 0; i < N * N; i++) if (items[i] && !board[i] && vis(i)) { const [x, y] = xy(i); I.ITEMS.drawItem(c, items[i].k, x, y, cell, now, i); }
  // the boss, if it was there
  const boss = after ? clip.bossAfter : clip.bossBefore;
  if (boss && I.BOSS) { const [x, y] = xy(boss.at); const hitT = kind === 'bosshit' && k > T_HIT && k < T_HIT + .15 ? now : 0; I.BOSS.draw(c, { ...boss, hitT }, x + cell / 2, y + cell / 2, cell, now); }

  // pieces that just sit there
  const moverIds = new Set(A.movers.map(m => m.p.id)), victimIds = new Set(A.victims.map(v => v.p.id)), bornIds = new Set(A.born.map(b => b.p.id));
  const mateK = clip.mate;
  for (let i = 0; i < N * N; i++) {
    const p = board[i]; if (!p || !vis(i)) continue;
    if (moverIds.has(p.id) || victimIds.has(p.id) || (after && bornIds.has(p.id)) || i === mateK) continue;
    const [x, y] = xy(i);
    let sc = 1;
    if (after && A.changed.some(ch => ch.i === i)) sc = 1 + .4 * Math.max(0, 1 - (s - T_HIT) / .1);
    I.drawPiece(c, p.t, p.s, x, y, cell * .82 * sc, p.id * 3.7);
  }
  // charge-up glow before specials, cards and items
  if (!after && (kind === 'special' || kind === 'card') && clip.f >= 0) { const [x, y] = xy(clip.f), q = s / T_HIT; c.strokeStyle = '#7a3fb8'; c.lineWidth = 3; for (let r = 0; r < 3; r++) { c.globalAlpha = .7 * (1 - r / 3); c.beginPath(); c.arc(x, y, cell * (.4 + r * .25) * (1 + Math.sin(now / 90 + r) * .1) * q, 0, 7); c.stroke(); } c.globalAlpha = 1; }

  // movers: wind up, dash with a motion trail, squash on landing
  for (const m of A.movers) {
    const [x1, y1] = xy(m.f), [x2, y2] = xy(m.t);
    let q = clamp((s - T_ACT) / (T_HIT - T_ACT), 0, 1);
    if (s < T_ACT) { const w = s / T_ACT; I.drawPiece(c, m.p.t, m.p.s, x1 - (x2 - x1) * .04 * w, y1 - (y2 - y1) * .04 * w, cell * .82 * (1 + .06 * w), m.p.id * 3.7); continue; }
    const e = q * q * (3 - 2 * q), arc = Math.sin(e * Math.PI) * cell * .5;
    for (let g = 4; g >= 1; g--) { const qq = Math.max(0, e - g * .07); I.drawPiece(c, m.p.t, m.p.s, x1 + (x2 - x1) * qq, y1 + (y2 - y1) * qq - Math.sin(qq * Math.PI) * cell * .5, cell * .82, m.p.id * 3.7, .12 * (5 - g) / 4); }
    if (q > 0 && q < 1) { c.strokeStyle = 'rgba(30,28,36,.4)'; c.lineWidth = 2; const ang = Math.atan2(y2 - y1, x2 - x1); for (let l = -1; l <= 1; l++) { const ox = -Math.sin(ang) * l * cell * .2, oy = Math.cos(ang) * l * cell * .2, px = x1 + (x2 - x1) * e, py = y1 + (y2 - y1) * e - arc; c.beginPath(); c.moveTo(px - Math.cos(ang) * cell * 1.2 + ox, py - Math.sin(ang) * cell * 1.2 + oy); c.lineTo(px - Math.cos(ang) * cell * .4 + ox, py - Math.sin(ang) * cell * .4 + oy); c.stroke(); } }
    const land = s > T_HIT ? Math.sin(clamp((s - T_HIT) / .12, 0, 1) * Math.PI) * .35 : 0;
    c.save(); c.translate(x1 + (x2 - x1) * e, y1 + (y2 - y1) * e - arc + cell * .38); c.scale(1 + land * .6, 1 - land * .5);
    I.drawPiece(c, m.p.t, m.p.s, 0, -cell * .38, cell * .82 * (q > 0 && q < 1 ? 1.12 : 1), m.p.id * 3.7); c.restore();
  }

  // projectiles and things falling from the sky
  if (A.shot && clip.f >= 0 && s > T_ACT && s < T_HIT) {
    const q = (s - T_ACT) / (T_HIT - T_ACT), [x1, y1] = xy(clip.f), [x2, y2] = xy(hit), x = x1 + (x2 - x1) * q, y = y1 + (y2 - y1) * q;
    c.strokeStyle = GOLD; c.lineWidth = cell * .1; c.beginPath(); c.moveTo(x1 + (x2 - x1) * Math.max(0, q - .35), y1 + (y2 - y1) * Math.max(0, q - .35)); c.lineTo(x, y); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, cell * .08, 0, 7); c.fill();
  }
  if (kind === 'meteor' && s < T_HIT + .02) {
    const q = clamp((s - .05) / (T_HIT - .05), 0, 1), [tx, ty] = xy(hit), x = tx + (1 - q) * W * .8, y = ty - (1 - q) * H * .9;
    for (let i = 0; i < 14; i++) { const b = i / 14; c.fillStyle = i % 3 ? 'rgba(232,137,43,.6)' : 'rgba(243,213,91,.8)'; c.beginPath(); c.arc(x + b * W * .25, y - b * H * .28, cell * (.45 - b * .28), 0, 7); c.fill(); }
    c.fillStyle = '#4a3b33'; c.strokeStyle = INK; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = cell * (.42 + hash(i) * .12); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.fill(); c.stroke();
  }
  if (kind === 'nuke' && s < T_HIT) {
    const q = clamp((s - .05) / (T_HIT - .05), 0, 1), [tx, ty] = xy(hit), y = ty - (1 - q * q) * H;
    c.save(); c.translate(tx, y); c.rotate(Math.sin(now / 60) * .05);
    if (I.drawNukeBomb) I.drawNukeBomb(c, 0, 0, cell * 2.2, Math.PI / 2, INK, '#3b3a42', 3); else { c.fillStyle = '#333'; c.beginPath(); c.ellipse(0, 0, cell * .3, cell * .7, 0, 0, 7); c.fill(); }
    c.restore();
  }
  if (kind === 'bossatk' && clip.attack === 'laser' && clip.row != null && s > T_ACT && s < T_SLOW + .1 && clip.bossBefore) {
    const [bx, by] = xy(clip.bossBefore.at), [, ly] = xy(clip.row * N), w = cell * .35 * Math.sin(clamp((s - T_ACT) / (T_SLOW + .1 - T_ACT), 0, 1) * Math.PI);
    c.fillStyle = '#ff3b2e'; c.fillRect(-W, ly - w / 2, W * 2, w); c.fillStyle = '#fff3ea'; c.fillRect(-W, ly - w / 6, W * 2, w / 3);
    c.fillStyle = 'rgba(255,59,46,.5)'; c.beginPath(); c.arc(bx + cell * .5, by + cell * .1, w, 0, 7); c.fill();
  }
  if (kind === 'bosshit' && clip.f >= 0 && clip.bossBefore && s < T_HIT) {
    const p = clip.before[clip.f]; if (p) { const q = clamp((s - T_ACT) / (T_HIT - T_ACT), 0, 1), [x1, y1] = xy(clip.f), [x2, y2] = xy(hit), e = q < .7 ? q / .7 : 1 - (q - .7) / .3 * .3; I.drawPiece(c, p.t, p.s, x1 + (x2 - x1) * e * .7, y1 + (y2 - y1) * e * .7, cell * .9, p.id * 3.7); }
  } else if (kind === 'bosshit' && clip.f >= 0 && clip.before[clip.f]) { const p = clip.before[clip.f], [x, y] = xy(clip.f); I.drawPiece(c, p.t, p.s, x, y, cell * .82, p.id * 3.7); }

  // victims: stand there, then get launched with cracks, spin and ink splatter
  const [ix, iy] = xy(hit);
  A.victims.forEach((v, n2) => {
    const [x, y] = xy(v.i);
    if (s < T_HIT) { const fear = s > T_ACT ? Math.sin(now / 30 + n2) * cell * .03 : 0; I.drawPiece(c, v.p.t, v.p.s, x + fear, y, cell * .82, v.p.id * 3.7); return; }
    const q = clamp((s - T_HIT) / (1 - T_HIT), 0, 1), e = 1 - Math.pow(1 - q, 2);
    let dx = x - ix, dy = y - iy; const d = Math.hypot(dx, dy) || 1; if (d < 2) { dx = hash(v.p.id) - .5; dy = -1; } else { dx /= d; dy /= d; }
    const power = big ? 3.5 : 2.2, px = x + dx * cell * power * e * 2.2, py = y + dy * cell * power * e * 1.6 - Math.sin(Math.min(1, q * 1.6) * Math.PI) * cell * 1.4 + q * q * cell * 2;
    c.fillStyle = v.p.s === 'w' ? INK : RED;
    for (let i = 0; i < 10; i++) { const a = Math.atan2(dy, dx) + (hash(v.p.id + i) - .5) * 2.4, sp = .5 + hash(v.p.id + i + 7) * 2; c.globalAlpha = Math.max(0, 1 - q * 1.4); c.beginPath(); c.arc(x + Math.cos(a) * cell * sp * e * 1.5, y + Math.sin(a) * cell * sp * e - Math.sin(Math.min(1, q * 2) * Math.PI) * cell * .6 + q * q * cell, cell * .05, 0, 7); c.fill(); }
    c.globalAlpha = Math.max(0, 1 - Math.max(0, q - .6) / .4);
    c.save(); c.translate(px, py); c.rotate((dx >= 0 ? 1 : -1) * e * 7);
    I.drawPiece(c, v.p.t, v.p.s, 0, 0, cell * .82, v.p.id * 3.7);
    c.strokeStyle = v.p.s === 'b' ? '#ffe2a8' : INK; c.lineWidth = 1.6;
    for (let j = 0; j < 3; j++) { let qx = (hash(v.p.id + j) - .5) * cell * .3, qy = -cell * .3; c.beginPath(); c.moveTo(qx, qy); for (let z = 0; z < 3; z++) { qx += (hash(v.p.id * 3 + j * 7 + z) - .5) * cell * .2; qy += cell * .12; c.lineTo(qx, qy); } c.stroke(); }
    c.restore(); c.globalAlpha = 1;
  });
  // newborn pieces pop in
  if (after) for (const b of A.born) { if (!vis(b.i)) continue; const [x, y] = xy(b.i), q = clamp((s - T_HIT) / .08, 0, 1), sc = q < 1 ? q * 1.3 : 1 + .3 * Math.max(0, 1 - (s - T_HIT - .08) / .06); I.drawPiece(c, b.p.t, b.p.s, x, y, cell * .82 * Math.min(1.3, sc), b.p.id * 3.7); }
  // the checkmated king wobbles, then topples over in slow motion
  if (mateK != null && mateK >= 0) {
    const p = clip.after[mateK] || clip.before[mateK]; if (p) {
      const [x, y] = xy(mateK), q = clamp((k - .3) / .5, 0, 1), rot = k < .3 ? Math.sin(now / 40) * .08 : ease(q) * 1.45;
      c.save(); c.translate(x + cell * .3, y + cell * .38); c.rotate(rot); I.drawPiece(c, p.t, p.s, -cell * .3, -cell * .38, cell * .82, p.id * 3.7); c.restore();
      if (q > .95) { c.fillStyle = 'rgba(120,110,95,.5)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.arc(x + cell * (.2 + hash(i) * .8), y + cell * .4, cell * .08 * (1 + hash(i + 3)), 0, 7); c.fill(); } }
    }
  }

  // IMPACT: flash, fireballs, shockwaves, starburst and a big word
  if (s >= T_HIT) {
    const q = clamp((s - T_HIT) / (1 - T_HIT), 0, 1);
    if (kind === 'nuke') {
      const R = cell * (1 + q * 9);
      c.strokeStyle = `rgba(255,255,255,${1 - q})`; c.lineWidth = cell * .5 * (1 - q); c.beginPath(); c.arc(ix, iy, R, 0, 7); c.stroke();
      // mushroom cloud
      const g = clamp(q * 1.6, 0, 1), top = iy - cell * 4.5 * g;
      c.fillStyle = 'rgba(90,70,60,.85)'; c.fillRect(ix - cell * .55, top + cell * .6, cell * 1.1, iy - top);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, rr = cell * (1.2 + .4 * Math.sin(now / 200 + i)) * g; c.fillStyle = i % 2 ? 'rgba(232,137,43,.85)' : 'rgba(120,90,70,.9)'; c.beginPath(); c.arc(ix + Math.cos(a) * rr * 1.2, top + Math.sin(a) * rr * .45, cell * .9 * g, 0, 7); c.fill(); }
      const glow = c.createRadialGradient(ix, top, 0, ix, top, cell * 2.6 * g + 1); glow.addColorStop(0, 'rgba(255,240,180,.95)'); glow.addColorStop(.35, 'rgba(255,150,40,.75)'); glow.addColorStop(1, 'rgba(255,90,20,0)');
      c.fillStyle = glow; c.beginPath(); c.arc(ix, top, cell * 2.6 * g + 1, 0, 7); c.fill();
      const fb = c.createRadialGradient(ix, iy, 0, ix, iy, cell * 3 * (1 - q * .5)); fb.addColorStop(0, `rgba(255,230,150,${.9 * (1 - q)})`); fb.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = fb; c.beginPath(); c.arc(ix, iy, cell * 3, 0, 7); c.fill();
      c.fillStyle = 'rgba(90,70,60,.8)'; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; c.beginPath(); c.arc(ix + Math.cos(a) * cell * 2.4 * g, iy + Math.sin(a) * cell * .6 * g, cell * .5 * g, 0, 7); c.fill(); }
    } else if (kind === 'meteor' || (kind === 'bossatk' && clip.attack === 'stomp') || kind === 'special' || kind === 'card') {
      const fire = kind === 'meteor', R = cell * (fire ? 1.6 : 1.1) * Math.min(1, q * 4);
      if (fire) for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, rr = R * (.6 + hash(i) * .5) * (1 + q); c.fillStyle = `rgba(${i % 2 ? '232,137,43' : '243,213,91'},${Math.max(0, .9 - q)})`; c.beginPath(); c.arc(ix + Math.cos(a) * rr * .5, iy + Math.sin(a) * rr * .4 - q * cell, R * .55, 0, 7); c.fill(); }
      c.strokeStyle = fire ? `rgba(179,50,43,${1 - q})` : `rgba(122,63,184,${1 - q})`; c.lineWidth = cell * .15 * (1 - q); c.beginPath(); c.arc(ix, iy, cell * (.5 + q * 3.5), 0, 7); c.stroke();
      if (fire) { c.fillStyle = `rgba(80,70,65,${.5 * (1 - q)})`; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(ix + (hash(i + 4) - .5) * cell * 2, iy - q * cell * 2 - hash(i) * cell, cell * (.4 + q), 0, 7); c.fill(); } }
    } else if (kind === 'item') {
      for (let i = 0; i < 30; i++) { const a = hash(i) * Math.PI * 2, sp = .8 + hash(i + 40) * 2.2; c.globalAlpha = Math.max(0, 1 - q); c.fillStyle = ['#e86ad6', GOLD, '#5bd1f3', '#7be06a', RED][i % 5]; c.save(); c.translate(ix + Math.cos(a) * cell * sp * Math.min(1, q * 3), iy + Math.sin(a) * cell * sp * .7 * Math.min(1, q * 3) - cell * Math.sin(Math.min(1, q * 2) * Math.PI / 2) + q * q * cell * 2); c.rotate(q * 14 + i); c.fillRect(-cell * .06, -cell * .03, cell * .12, cell * .06); c.restore(); }
      c.globalAlpha = 1;
    }
    if (q < .35 && kind !== 'move') {
      const e = q / .35, R = cell * (big ? 1.3 : .8) * (1 + e);
      c.fillStyle = `rgba(255,248,220,${.45 * (1 - e)})`; c.strokeStyle = INK; c.lineWidth = 2;
      c.beginPath(); for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = R * (i % 2 ? .45 : 1); const px = ix + Math.cos(a) * rr, py = iy + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); c.fill(); c.globalAlpha = 1 - e; c.stroke(); c.globalAlpha = 1;
    }
    if (kind === 'bosshit' && clip.dmg) { c.font = `400 ${cell * .9}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.lineWidth = cell * .1; c.strokeStyle = INK; c.fillStyle = RED; const y = iy - cell * (.8 + q * 1.2); c.globalAlpha = 1 - q; c.strokeText(`-${clip.dmg}`, ix, y); c.fillText(`-${clip.dmg}`, ix, y); c.globalAlpha = 1; }
  }
  c.restore();

  // speed lines and flash at the moment of impact
  if (k > T_HIT && k < T_SLOW) {
    const q = (k - T_HIT) / (T_SLOW - T_HIT);
    c.strokeStyle = `rgba(30,28,36,${.35 * (1 - q)})`; c.lineWidth = 2;
    for (let i = 0; i < 28; i++) { const a = hash(i + idx) * Math.PI * 2, r0 = Math.min(W, H) * (.3 + hash(i + 50) * .1); c.beginPath(); c.moveTo(W / 2 + Math.cos(a) * r0, H * .46 + Math.sin(a) * r0); c.lineTo(W / 2 + Math.cos(a) * W, H * .46 + Math.sin(a) * W); c.stroke(); }
  }
  if (k > T_HIT && k < T_HIT + .06) { c.fillStyle = `rgba(255,255,255,${(1 - (k - T_HIT) / .06) * (kind === 'nuke' ? 1 : .85)})`; c.fillRect(0, 0, W, H); }
  if (kind === 'nuke' && k > T_HIT + .06 && k < T_HIT + .2) { c.fillStyle = `rgba(255,236,190,${.6 * (1 - (k - T_HIT - .06) / .14)})`; c.fillRect(0, 0, W, H); }
  // the big impact word
  if (k > T_HIT && kind !== 'move') {
    const q = clamp((k - T_HIT) / .1, 0, 1), sz = Math.min(W / 5, 90) * (kind === 'nuke' ? 1.3 : 1), sc = 2.6 - 1.6 * (1 - Math.pow(1 - q, 3));
    c.save(); c.translate(W / 2 + (hash(idx) - .5) * W * .2, H * .2); c.rotate((hash(idx + 3) - .5) * .3); c.scale(sc, sc);
    c.globalAlpha = Math.min(1, q * 2) * (k > .9 ? (1 - k) / .1 : 1);
    c.font = `400 ${sz}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.lineWidth = sz * .18; c.strokeStyle = INK; c.strokeText(A.word, 0, 0, W * .9);
    c.fillStyle = kind === 'nuke' || kind === 'meteor' ? '#ff7a2b' : clip.mate != null ? RED : GOLD; c.fillText(A.word, 0, 0, W * .9);
    c.restore(); c.globalAlpha = 1;
  }

  // letterbox, vignette, header, caption, reaction
  const bar = H * .07 * Math.min(1, k * 8);
  c.fillStyle = INK; c.fillRect(0, 0, W, bar + 34); c.fillRect(0, H - bar, W, bar);
  const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${clip.mate != null ? .55 : .3})`); c.fillStyle = vg; c.fillRect(0, 0, W, H);
  c.fillStyle = (now / 500 | 0) % 2 ? RED : '#7a1f1a'; c.beginPath(); c.arc(18, 19, 6, 0, 7); c.fill();
  c.font = `400 18px Anton, Impact, sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(`REPLAY  ${idx + 1}/${n}`, 32, 20);
  c.textAlign = 'right'; c.fillStyle = GOLD; c.fillText(clip.label || 'HIGHLIGHT', W - 14, 20);
  if (k > T_HIT && k < T_SLOW) { c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = `400 14px Anton, Impact, sans-serif`; c.fillText('SLOW-MO', 32, 44); }
  const cap = clip.caption || '', fs = Math.max(18, Math.min(30, W / 18));
  c.font = `400 ${fs}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.lineWidth = fs * .18; c.strokeStyle = '#000'; c.fillStyle = '#fff'; c.lineJoin = 'round';
  wrap(c, cap, W - 36).forEach((ln, i, a) => { const y = H - bar - 14 - (a.length - 1 - i) * fs * 1.12; c.strokeText(ln, W / 2, y); c.fillText(ln, W / 2, y); });
  if (clip.react && k > T_SLOW) {
    const e = Math.min(1, (k - T_SLOW) / .07), s2 = 1 + (1 - e) * 1.8, rf = Math.max(26, Math.min(56, W / 10));
    c.save(); c.translate(W / 2, H * .66); c.rotate(-.07); c.scale(s2, s2); c.globalAlpha = Math.min(1, e * 1.5);
    c.font = `400 ${rf}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = rf * .16; c.strokeStyle = INK; c.strokeText(clip.react.toUpperCase(), 0, 0, W * .9);
    c.fillStyle = '#fff'; c.fillText(clip.react.toUpperCase(), 0, 0, W * .9); c.restore();
  }
  // whip-pan transition between clips
  if (k < .05) { const q = k / .05; c.fillStyle = INK; c.fillRect(W * q, 0, W, H); c.strokeStyle = '#fff'; c.lineWidth = 3; for (let i = 0; i < 6; i++) { const y = H * (i + .5) / 6; c.beginPath(); c.moveTo(W * q, y); c.lineTo(W * q + W * .4, y); c.stroke(); } }
}

function drawEnd(c, W, H, k, opts, now) {
  c.fillStyle = INK; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + now / 3000; c.fillStyle = i % 2 ? 'rgba(243,213,91,.08)' : 'rgba(255,255,255,.03)'; c.beginPath(); c.moveTo(W / 2, H * .42); c.arc(W / 2, H * .42, Math.max(W, H), a, a + Math.PI / 40); c.closePath(); c.fill(); }
  const s = 1 + Math.max(0, 1 - k * 4) * 2;
  c.save(); c.translate(W / 2, H * .42); c.scale(s, s); c.rotate(Math.sin(now / 300) * .03);
  c.font = `400 ${Math.min(110, W / 4.5)}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineWidth = 10; c.strokeStyle = '#000'; c.strokeText(opts.title || 'GG', 0, 0, W * .9);
  c.fillStyle = GOLD; c.fillText(opts.title || 'GG', 0, 0, W * .9); c.restore();
  c.font = `20px 'Patrick Hand', cursive`; c.fillStyle = '#e9e1cf'; c.textAlign = 'center';
  c.fillText(opts.sub || 'thanks for watching', W / 2, H * .6);
  if (k > .3) { c.font = `400 16px Anton, Impact, sans-serif`; c.fillStyle = RED; c.fillText('LIKE AND SUBSCRIBE (there is nothing to subscribe to)', W / 2, H * .7, W - 30); }
}
function grain(c, W, H, now) {
  c.fillStyle = 'rgba(0,0,0,.05)';
  for (let y = (now / 40) % 4; y < H; y += 4) c.fillRect(0, y, W, 1);
  c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 40; i++) c.fillRect(hash(now * .01 + i) * W, hash(now * .013 + i * 3) * H, 1.5, 1.5);
}
function wrap(c, text, max) {
  const words = text.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out.slice(-3);
}

I.Replay = { choose, play, CLIP, T_HIT };
})();
