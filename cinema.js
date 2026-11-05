/* Inkmate: the NUKE cinematic.
   Rendered live on a canvas: letterbox, film grain, grading, camera moves and cuts.
   runNukeCinematic(canvas, { music, sfx, lines, cast }) -> Promise (resolves when it ends or is skipped).

   Timeline (seconds)
   0.0  fade to black, bars slide in, low rumble
   1.3  title card
   4.4  SHOT A  dusk sky: the bomb tumbles toward camera, the camera pulls back, captions either side
   12.2 SHOT B  establishing: the board at dusk, every unit on it, the bomb streaks down
   14.3 SHOT C  low angle: pieces look up as the bomb fills the sky
   15.5 SHOT B  impact
   16.0 silence
   17.0 FLASH, fireball, condensation ring, mushroom cloud, shockwave
   21.9 the wave hits the camera, white-out
   22.2 hard cut to black, ringing ears, "nuclear option chosen"
   28.8 fade back to the board                                                   */
(() => {
'use strict';
const I = window.INK;
const PAPER = '#f2eee2', INKC = '#1e1c24';
const DUR = 30;
I.NUKE_DURATION = DUR;

let A = null;
function makeSprite(size, stops) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d'), g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  c.fillStyle = g; c.fillRect(0, 0, size, size);
  return cv;
}
const puffSprite = rgb => makeSprite(128, [[0, `rgba(${rgb},1)`], [.35, `rgba(${rgb},.85)`], [.7, `rgba(${rgb},.35)`], [1, `rgba(${rgb},0)`]]);
function assets() {
  if (A) return A;
  const grains = [0, 1, 2].map(() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256;
    const g = cv.getContext('2d'), id = g.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = Math.random() < .55 ? 46 : 0; }
    g.putImageData(id, 0, 0); return cv;
  });
  A = {
    grains,
    hot: puffSprite('255,250,232'), yellow: puffSprite('255,214,96'), orange: puffSprite('255,140,46'), red: puffSprite('196,58,30'),
    smoke: puffSprite('96,80,74'), dark: puffSprite('42,36,40'), dust: puffSprite('170,140,104'), cloud: puffSprite('255,236,224'), cloudShade: puffSprite('120,96,120'),
    glow: makeSprite(256, [[0, 'rgba(255,255,240,1)'], [.2, 'rgba(255,230,170,.8)'], [.5, 'rgba(255,150,60,.25)'], [1, 'rgba(255,120,40,0)']]),
  };
  return A;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const easeIn = k => Math.pow(clamp(k, 0, 1), 2.2);
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const h = I.hash;
function blob(c, img, x, y, r, a) { if (a <= 0.005 || r <= 0) return; c.globalAlpha = Math.min(1, a); c.drawImage(img, x - r, y - r, r * 2, r * 2); }

// ------------------------------------------------------------------ the bomb, lit
function bomb(c, x, y, len, rot, spin, light = 1) {
  c.save(); c.translate(x, y); c.rotate(rot);
  const L = len, R = len * .19;
  for (const sg of [-1, 1]) {
    c.beginPath(); c.moveTo(-L * .34, sg * R * .45); c.lineTo(-L * .6, sg * R * (1.5 + .12 * Math.sin(spin + sg))); c.lineTo(-L * .5, sg * R * 1.62); c.lineTo(-L * .18, sg * R * .72); c.closePath();
    const gf = c.createLinearGradient(0, sg * R * .4, 0, sg * R * 1.6); gf.addColorStop(0, '#4a4c58'); gf.addColorStop(1, '#141419');
    c.fillStyle = gf; c.fill(); c.lineWidth = L / 140; c.strokeStyle = '#08080b'; c.stroke();
  }
  c.fillStyle = '#1b1c22'; c.fillRect(-L * .64, -R * .58, L * .14, R * 1.16);
  c.strokeStyle = 'rgba(255,255,255,.15)'; c.lineWidth = L / 220; c.strokeRect(-L * .64, -R * .58, L * .14, R * 1.16);
  c.beginPath(); c.moveTo(-L * .46, -R * .74); c.lineTo(L * .2, -R); c.quadraticCurveTo(L * .54, -R * .92, L * .53, 0); c.quadraticCurveTo(L * .54, R * .92, L * .2, R); c.lineTo(-L * .46, R * .74); c.closePath();
  const gb = c.createLinearGradient(0, -R, 0, R);
  gb.addColorStop(0, `rgb(${150 + 60 * light},${140 + 40 * light},${140 + 20 * light})`); gb.addColorStop(.16, '#5b5f6c'); gb.addColorStop(.55, '#2a2d36'); gb.addColorStop(1, '#0d0e12');
  c.fillStyle = gb; c.fill(); c.lineWidth = L / 100; c.strokeStyle = '#060608'; c.stroke();
  // panel lines that slide round as it spins
  c.save(); c.clip();
  c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = L / 260;
  for (let k = 0; k < 6; k++) { const yy = Math.sin(spin + k * 1.05) * R; if (Math.cos(spin + k * 1.05) < 0) continue; c.beginPath(); c.moveTo(-L * .45, yy * .75); c.lineTo(L * .22, yy); c.stroke(); }
  c.strokeStyle = `rgba(255,236,210,${.35 + .3 * light})`; c.lineWidth = L / 70;
  c.beginPath(); c.moveTo(-L * .42, -R * .52); c.lineTo(L * .26, -R * .74); c.stroke();
  c.restore();
  const gy = c.createLinearGradient(0, -R, 0, R); gy.addColorStop(0, '#f6da7a'); gy.addColorStop(.45, '#b8901e'); gy.addColorStop(1, '#4a380a');
  c.fillStyle = gy; c.fillRect(-L * .07, -R * .99, L * .1, R * 1.98);
  c.save(); c.translate(L * .3, Math.sin(spin) * R * .25); c.scale(1, Math.max(.25, Math.abs(Math.cos(spin * .5)))); I.trefoil(c, 0, 0, R * .5, '#d9b23a'); c.restore();
  c.fillStyle = 'rgba(235,235,235,.55)'; c.font = `${Math.max(6, Math.round(R * .38))}px 'Special Elite', monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('INK-1', -L * .24, Math.sin(spin * .7) * R * .2);
  c.restore();
}

// ------------------------------------------------------------------ post effects
function letterbox(c, W, H, k) {
  const target = Math.max(H * .09, (H - W / 2.39) / 2), bh = target * k;
  c.globalAlpha = 1; c.fillStyle = '#000';
  c.fillRect(0, 0, W, bh); c.fillRect(0, H - bh, W, bh);
  return bh;
}
function grain(c, W, H, t, a = .08) {
  const g = A.grains[Math.floor(t * 24) % 3];
  c.save(); c.globalAlpha = a; c.globalCompositeOperation = 'overlay';
  const ox = Math.floor(h(Math.floor(t * 24)) * 256), oy = Math.floor(h(Math.floor(t * 24) + 9) * 256);
  for (let x = -ox; x < W; x += 256) for (let y = -oy; y < H; y += 256) c.drawImage(g, x, y);
  c.restore();
}
function vignette(c, W, H, a = .55) {
  const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.hypot(W, H) * .6);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  c.globalAlpha = 1; c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function grade(c, W, H, col, a, op = 'soft-light') { c.save(); c.globalCompositeOperation = op; c.globalAlpha = a; c.fillStyle = col; c.fillRect(0, 0, W, H); c.restore(); }
function anamorphic(c, W, y, a, x = W / 2) {
  if (a <= 0) return;
  c.save(); c.globalCompositeOperation = 'lighter';
  const g = c.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(120,170,255,0)'); g.addColorStop(clamp(x / W - .3, .01, .98), 'rgba(140,190,255,0)');
  g.addColorStop(clamp(x / W, .02, .98), `rgba(220,235,255,${a})`); g.addColorStop(clamp(x / W + .3, .03, .99), 'rgba(140,190,255,0)'); g.addColorStop(1, 'rgba(120,170,255,0)');
  c.fillStyle = g; c.fillRect(0, y - 3, W, 6);
  c.globalAlpha = a * .5; c.fillRect(0, y - 14, W, 28);
  c.restore();
}

// ------------------------------------------------------------------ sky
function sky(c, W, H, horizon, warm = 1) {
  const g = c.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#070a16'); g.addColorStop(.45, '#1d2140'); g.addColorStop(.8, `rgb(${110 + 60 * warm},${70 + 20 * warm},${80})`); g.addColorStop(1, `rgb(${220 + 30 * warm},${130 + 40 * warm},${80 + 10 * warm})`);
  c.globalAlpha = 1; c.fillStyle = g; c.fillRect(0, 0, W, horizon + 2);
}
function stars(c, W, H, t, a) { c.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { c.globalAlpha = a * (.3 + .7 * h(i + 3)) * (.7 + .3 * Math.sin(t * 2 + i)); c.fillRect(h(i) * W, h(i + 50) * H * .5, 1.5, 1.5); } c.globalAlpha = 1; }

// ------------------------------------------------------------------ shots
function titleCard(c, W, H, S, t) {
  const k = seg(t, 1.5, 2.6) * (1 - seg(t, 3.6, 4.3));
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  c.save(); c.globalAlpha = k; c.fillStyle = '#e9e1d0'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const sc = 1 + (t - 1.5) * .015;
  c.translate(W / 2, H / 2); c.scale(sc, sc);
  try { c.letterSpacing = `${Math.round(S * .018)}px`; } catch (e) {}
  c.font = `600 ${Math.round(S * .055)}px 'Cinzel', 'Times New Roman', serif`; c.fillText('THE NUCLEAR OPTION', 0, 0);
  try { c.letterSpacing = `${Math.round(S * .01)}px`; } catch (e) {}
  c.globalAlpha = k * .6; c.font = `${Math.round(S * .02)}px 'Cinzel', serif`; c.fillText('AN INKMATE PICTURE', 0, -S * .07);
  c.restore();
  try { c.letterSpacing = '0px'; } catch (e) {}
}

function shotSky(c, W, H, S, t, lines) {
  const u = t - 4.4, D = 7.8, k = u / D;
  const horizon = H * 1.15 - k * H * .28;
  sky(c, W, H, horizon, 1);
  stars(c, W, H, t, .6 * (1 - k));
  // sun just under the horizon
  const sunX = W * .22, sunY = horizon - H * .02;
  c.save(); c.globalCompositeOperation = 'lighter'; blob(c, A.glow, sunX, sunY, S * .5, .55); c.restore();
  // clouds rushing up past the camera (we're falling with the bomb)
  for (let i = 0; i < 26; i++) {
    const depth = .3 + h(i + 7) * 1.2, x = (h(i) * 1.4 - .2) * W, size = S * (.12 + h(i + 2) * .25) * depth;
    const y = ((h(i + 4) * 2 * H - u * H * .35 * depth) % (2 * H) + 2 * H) % (2 * H) - H * .4;
    blob(c, A.cloudShade, x, y + size * .2, size * 1.1, .35 * depth);
    blob(c, A.cloud, x, y, size, .4 * depth * (1 - k * .3));
  }
  c.globalAlpha = 1;
  // the bomb: starts filling the frame, the camera pulls back
  const zoom = lerp(1.25, .3, easeOut(k * 1.05));
  const len = S * zoom, roll = Math.sin(u * .35) * .04;
  const bx = W / 2 + Math.sin(u * .6) * S * .02, by = H * .5 + Math.cos(u * .8) * S * .01;
  c.save(); c.translate(W / 2, H / 2); c.rotate(roll); c.translate(-W / 2, -H / 2);
  // trailing vapour from the tail
  for (let i = 0; i < 18; i++) { const a = (i + (u * 6 % 1)) / 18; blob(c, A.cloud, bx + Math.sin(i + u) * len * .04, by - len * (.55 + a * 1.4), len * (.05 + a * .12), .22 * (1 - a)); }
  c.globalAlpha = 1;
  bomb(c, bx, by, len, Math.PI / 2 + Math.sin(u * 1.1) * .12, u * 2.6, 1);
  // speed streaks
  c.strokeStyle = 'rgba(255,240,230,.18)'; c.lineWidth = 1.2;
  for (let i = 0; i < 30; i++) { const x = h(i * 3.3) * W, yy = ((h(i) * H * 1.5 - u * H * 2.6 * (.5 + h(i + 1))) % (H * 1.5) + H * 1.5) % (H * 1.5) - H * .25; c.beginPath(); c.moveTo(x, yy); c.lineTo(x, yy + H * .12 * (.4 + h(i + 2))); c.stroke(); }
  c.restore();
  // captions
  const cs = Math.round(S * .034);
  c.font = `600 ${cs}px 'Cinzel', 'Times New Roman', serif`; c.textBaseline = 'middle';
  try { c.letterSpacing = `${Math.round(cs * .22)}px`; } catch (e) {}
  lines.forEach((line, i) => {
    const st = 5.0 + i * 1.75, a = ease(seg(t, st, st + .9)) * (1 - ease(seg(t, st + 2.4, st + 3.1)));
    if (a <= 0) return;
    const left = i % 2 === 0, drift = (t - st) * S * .006;
    const x = left ? W * .5 - Math.max(len * .5, S * .2) - S * .05 + drift : W * .5 + Math.max(len * .5, S * .2) + S * .05 - drift;
    const y = H * (.32 + (i % 2) * .3) + (i > 1 ? S * .06 : 0);
    c.textAlign = left ? 'right' : 'left';
    c.save(); c.shadowColor = 'rgba(255,190,140,.6)'; c.shadowBlur = cs * .8;
    c.globalAlpha = a; c.fillStyle = '#fbf3e6';
    const words = line.split(' '), rows = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (c.measureText(test).width > W * .3 && cur) { rows.push(cur); cur = w; } else cur = test; }
    rows.push(cur); rows.forEach((r, j) => c.fillText(r, x, y + j * cs * 1.4));
    c.restore();
  });
  try { c.letterSpacing = '0px'; } catch (e) {}
  // cut out: a quick dip
  if (t > 11.9) { c.globalAlpha = seg(t, 11.9, 12.2); c.fillStyle = '#000'; c.fillRect(0, 0, W, H); c.globalAlpha = 1; }
}

// board world: 12x12 squares centred on (0, Zc), x right, z away from camera, y up
const B = 6, Z0 = 4, ZC = Z0 + B, CAM_END = -3.2;
function makeCam(t, W, H, S) {
  // slow dolly in and crane down during the establishing shot; static from impact
  const u = ease(seg(t, 12.2, 16));
  let camZ = lerp(-3.5, -.6, u), camH = lerp(5.2, 3.0, u), tilt = lerp(.2, .26, u);
  if (t > 17) { const k = easeOut(seg(t, 17, 20)); camZ = lerp(-.6, CAM_END, k); camH = lerp(3.0, 2.2, k); tilt = lerp(.26, .6, k); }
  const f = H * 1.05, hor = H * tilt;
  return { camZ, camH, f, hor, P: (X, Z, Y = 0) => { const d = Math.max(.05, Z - camZ); return [W / 2 + X * f / d, hor + (camH - Y) * f / d, f / d]; } };
}
function drawWorld(c, W, H, S, t, cast, ex) {
  const cam = makeCam(t, W, H, S), P = cam.P;
  const flashLit = ex ? ex.light : 0;
  sky(c, W, H, cam.hor + 4, 1 + flashLit);
  stars(c, W, H, t, .25 * (1 - flashLit));
  // distant hills
  c.fillStyle = `rgb(${30 + 120 * flashLit},${24 + 60 * flashLit},${34 + 20 * flashLit})`; c.beginPath(); c.moveTo(0, cam.hor + 4);
  for (let x = 0; x <= W; x += W / 40) c.lineTo(x, cam.hor - S * (.02 + .05 * Math.abs(Math.sin(x / W * 7 + 1)) * h(Math.floor(x / W * 40))));
  c.lineTo(W, cam.hor + 4); c.fill();
  // ground
  const gg = c.createLinearGradient(0, cam.hor, 0, H); gg.addColorStop(0, `rgb(${70 + 120 * flashLit},${50 + 60 * flashLit},${46})`); gg.addColorStop(1, '#1c1714');
  c.fillStyle = gg; c.fillRect(0, cam.hor, W, H - cam.hor);
  // board squares, far to near, with fog
  for (let r = 0; r < 12; r++) for (let col = 0; col < 12; col++) {
    const z1 = Z0 + 2 * B - r, z2 = z1 - 1, x1 = -B + col, x2 = x1 + 1;
    if (z2 - cam.camZ < .1) continue;
    const q = [P(x1, z1), P(x2, z1), P(x2, z2), P(x1, z2)];
    c.beginPath(); q.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    const fog = clamp((z1 - cam.camZ) / 22, 0, 1), dark = (r + col) % 2;
    const base = dark ? [168, 150, 128] : [232, 224, 206];
    const lit = ex ? Math.max(0, 1 - Math.hypot((x1 + .5), (z1 - .5 - ZC)) / 9) * ex.light : 0;
    const cr = lerp(base[0] * .55, 210, fog * .5) + 80 * lit, cg = lerp(base[1] * .5, 120, fog * .5) + 50 * lit, cb = lerp(base[2] * .5, 90, fog * .5) + 10 * lit;
    c.fillStyle = `rgb(${cr | 0},${cg | 0},${cb | 0})`; c.fill();
    c.strokeStyle = 'rgba(20,16,14,.35)'; c.lineWidth = 1; c.stroke();
  }
  const frame = [P(-B, Z0 + 2 * B), P(B, Z0 + 2 * B), P(B, Z0), P(-B, Z0)];
  c.strokeStyle = '#120f0d'; c.lineWidth = 3; c.beginPath(); frame.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.stroke();
  return cam;
}
function drawCast(c, cam, cast, t, ex, S) {
  const P = cam.P;
  const R = ex ? ex.ring : 0;
  const list = cast.map(u => {
    const X = -B + u.c + .5, Z = Z0 + 2 * B - u.r - .5, dx = X, dz = Z - ZC, d = Math.hypot(dx, dz) || .01;
    let x = X, z = Z, y = 0, rot = 0, hit = false, vx = 0, vz = 0;
    if (ex && R > d) {
      hit = true; const tt = (R - d) / ex.speed;
      const v = 2.6 + h(u.id) * 2.2;
      vx = dx / d * v; vz = dz / d * v;
      x = X + vx * tt; z = Z + vz * tt; y = Math.max(0, Math.sin(Math.min(Math.PI * .85, tt * 2.2)) * (1 + h(u.id + 3) * 1.8) + tt * .6);
      rot = tt * (3 + h(u.id + 5) * 5) * (h(u.id + 7) > .5 ? 1 : -1);
    }
    return { u, X, Z, x, z, y, rot, hit, vx, vz, d };
  }).filter(o => o.z - cam.camZ > .25).sort((a, b) => b.z - a.z);
  for (const o of list) {
    const [sx, sy, sc] = P(o.x, o.z, o.y), sz = sc * .95;
    if (sz > S * 2.4 || sx < -sz * 2 || sx > c.canvas.width * 2) continue;
    // shadow: long and away from the fireball once it's lit, toward the camera before
    if (!o.hit) {
      c.save(); c.globalAlpha = .45;
      if (ex && ex.light > .05) {
        const len = 2.5 + 3 * ex.light, ux = o.X / (o.d || 1), uz = (o.Z - ZC) / (o.d || 1);
        const a1 = P(o.X - uz * .25, o.Z + ux * .25), a2 = P(o.X + uz * .25, o.Z - ux * .25), b1 = P(o.X + ux * len - uz * .1, o.Z + uz * len + ux * .1), b2 = P(o.X + ux * len + uz * .1, o.Z + uz * len - ux * .1);
        c.fillStyle = '#0c0807'; c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(b1[0], b1[1]); c.lineTo(b2[0], b2[1]); c.lineTo(a2[0], a2[1]); c.closePath(); c.fill();
      } else { c.fillStyle = '#0c0807'; c.beginPath(); c.ellipse(sx, sy + sz * .02, sz * .28, sz * .08, 0, 0, 7); c.fill(); }
      c.restore();
    }
    if (o.hit) {
      // motion trail toward where it came from
      for (let k = 3; k >= 1; k--) {
        const [tx, ty, ts] = P(o.x - o.vx * .035 * k, o.z - o.vz * .035 * k, o.y);
        c.save(); c.globalAlpha = .12; c.translate(tx, ty); c.rotate(o.rot - .2 * k); I.drawPiece(c, o.u.t, o.u.s, 0, -ts * .34, ts * .95, o.u.id); c.restore();
      }
    }
    c.save(); c.globalAlpha = 1; c.translate(sx, sy); c.rotate(o.rot);
    I.drawPiece(c, o.u.t, o.u.s, 0, -sz * .34, sz, o.u.id);
    if (o.hit) cracks(c, sz, o.u.id * 13, o.u.s);
    c.restore();
  }
}
function cracks(c, sz, seed, side) {
  c.save(); c.strokeStyle = side === 'b' ? '#ffd9a0' : '#1e1c24'; c.lineWidth = Math.max(1, sz / 26);
  for (let k = 0; k < 4; k++) {
    let px = (h(seed + k) - .5) * sz * .32, py = -sz * (.12 + h(seed + k + 4) * .45);
    c.beginPath(); c.moveTo(px, py);
    for (let j = 0; j < 4; j++) { px += (h(seed + k * 9 + j) - .5) * sz * .26; py += sz * .08; c.lineTo(px, py); }
    c.stroke();
  }
  c.restore();
}
function shotEstablish(c, W, H, S, t, cast) {
  const cam = drawWorld(c, W, H, S, t, cast, null);
  drawCast(c, cam, cast, t, null, S);
  // the bomb streaking down out of the sky onto the centre
  const k = seg(t, 12.2, 16.0), Y = lerp(26, 0, easeIn(k));
  const [bx, by, sc] = cam.P(0, ZC, Y), len = sc * 1.6;
  if (k < 1) {
    const [tx, ty] = cam.P(0, ZC, Y + 9);
    const g = c.createLinearGradient(tx, ty, bx, by); g.addColorStop(0, 'rgba(255,240,220,0)'); g.addColorStop(1, 'rgba(255,240,220,.7)');
    c.strokeStyle = g; c.lineWidth = Math.max(2, len * .12); c.beginPath(); c.moveTo(tx, ty); c.lineTo(bx, by - len * .4); c.stroke();
    bomb(c, bx, by - len * .45, len, Math.PI / 2, t * 3, .6);
  }
  grade(c, W, H, '#ff9a5a', .35);
  return cam;
}
function shotLowAngle(c, W, H, S, t) {
  const u = t - 14.3, k = u / 1.2;
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b0d1c'); g.addColorStop(.6, '#5a3c52'); g.addColorStop(1, '#f0a368');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  stars(c, W, H, t, .5);
  // the bomb overhead, growing
  const len = S * lerp(.12, .55, easeIn(k)), bx = W * .58, by = H * lerp(.08, .26, k);
  c.save(); c.globalCompositeOperation = 'lighter'; blob(c, A.glow, bx, by - len * .5, len * 1.2, .25); c.restore();
  bomb(c, bx, by, len, Math.PI / 2 + .1, t * 3, .5);
  // silhouettes looking up
  const tilt = lerp(-.04, .02, k);
  c.save(); c.translate(W / 2, H); c.rotate(tilt); c.translate(-W / 2, -H);
  const figs = [['K', W * .2, S * .75], ['P', W * .42, S * .5], ['N', W * .78, S * .7], ['P', W * .95, S * .45], ['Q', W * .03, S * .55]];
  for (const [ty, x, sz] of figs) {
    c.save(); c.translate(x, H + sz * .08); c.rotate(-.06);
    c.filter = 'brightness(0)';
    I.drawPiece(c, ty, 'b', 0, -sz * .36, sz, x | 0);
    c.filter = 'none'; c.restore();
  }
  c.restore();
  // rim light on the silhouettes' edges, cheap: a warm haze at the bottom
  const hz = c.createLinearGradient(0, H * .7, 0, H); hz.addColorStop(0, 'rgba(255,150,80,0)'); hz.addColorStop(1, 'rgba(255,150,80,.18)');
  c.fillStyle = hz; c.fillRect(0, H * .7, W, H * .3);
}
function shotBlast(c, W, H, S, t, cast) {
  const k = t - 17;                                     // seconds since the flash
  const light = k < 0 ? 0 : clamp(1.1 - k * .12, .45, 1);
  const speed = (ZC - CAM_END) / Math.pow(4.65, 1.18);   // the wave reaches the camera at about 21.9s
  const ring = k > .25 ? Math.pow(k - .25, 1.18) * speed : 0;
  const ex = k >= 0 ? { light, ring, speed } : null;
  const cam = drawWorld(c, W, H, S, t, cast, ex);
  const [gx, gy, gsc] = cam.P(0, ZC, 0);
  if (k < 0) {
    // the silence: a single bright point on the board, nothing else moves
    drawCast(c, cam, cast, t, null, S);
    c.save(); c.globalCompositeOperation = 'lighter'; blob(c, A.glow, gx, gy, S * (.02 + .01 * Math.sin(t * 40)), 1); c.restore();
    grade(c, W, H, '#7a8090', .5, 'saturation');
    grade(c, W, H, '#ff9a5a', .2);
    return cam;
  }
  // god rays
  c.save(); c.globalCompositeOperation = 'lighter';
  const fbY = gy - gsc * lerp(.8, 6.5, easeOut(k / 5));
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + k * .05, w = .03 + h(i) * .05, L = S * (1.2 + h(i + 2));
    c.globalAlpha = .045 * light; c.fillStyle = '#ffcf90';
    c.beginPath(); c.moveTo(gx, fbY); c.lineTo(gx + Math.cos(a - w) * L, fbY + Math.sin(a - w) * L); c.lineTo(gx + Math.cos(a + w) * L, fbY + Math.sin(a + w) * L); c.closePath(); c.fill();
  }
  c.restore();
  // stem rising from the board
  const stemTop = fbY, stemW = gsc * lerp(.45, 1.2, easeOut(k / 4));
  for (let i = 0; i < 18; i++) {
    const a = i / 18, y = lerp(gy, stemTop, a), wob = Math.sin(k * 3 + i) * stemW * .15;
    blob(c, i < 4 ? A.orange : A.smoke, gx + wob, y, stemW * (1.1 - a * .35), .85);
    if (i % 3 === 0) { c.save(); c.globalCompositeOperation = 'lighter'; blob(c, A.orange, gx + wob, y, stemW * .5, .25); c.restore(); }
  }
  // mushroom cap: a rolling torus of puffs, lit from below
  const capR = gsc * lerp(.6, 3.4, easeOut(k / 4.2)), capH = capR * .45;
  for (let layer = 0; layer < 2; layer++) for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + k * .6 * (layer ? -1 : 1);
    const x = gx + Math.cos(a) * capR * (layer ? .7 : 1), y = fbY + Math.sin(a) * capH * (layer ? .6 : 1) - capH * .3 * layer;
    const front = Math.sin(a) > 0;
    const r = capR * (.34 + h(i + layer * 30) * .14);
    const heat = clamp(1.2 - k * .25, 0, 1);
    blob(c, front ? (heat > .6 ? A.orange : heat > .3 ? A.red : A.smoke) : A.dark, x, y, r, .9);
    if (front && heat > .2) { c.save(); c.globalCompositeOperation = 'lighter'; blob(c, A.yellow, x, y + r * .25, r * .6, .35 * heat); c.restore(); }
  }
  // the fireball itself
  const fr = gsc * lerp(.3, 1.9, easeOut(k / 2.2)), cool = clamp(1 - k / 3.2, 0, 1);
  c.save(); c.globalCompositeOperation = 'lighter';
  blob(c, A.glow, gx, fbY, fr * lerp(1.6, 3.2, cool), lerp(.35, .95, cool));
  for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + k; blob(c, i % 3 ? A.yellow : A.hot, gx + Math.cos(a) * fr * .55, fbY + Math.sin(a) * fr * .35, fr * (.45 + h(i) * .25), .55 * lerp(.25, 1, cool)); }
  blob(c, A.hot, gx, fbY, fr * .75, lerp(.3, 1, cool));
  c.restore();
  // the cap rolls over the top of the fireball as it cools
  if (k > 1.2) {
    const cc = seg(k, 1.2, 3.5);
    for (let i = 0; i < 16; i++) { const a = Math.PI + i / 15 * Math.PI, rr = fr * (1.05 + .1 * Math.sin(k * 2 + i)); blob(c, i % 2 ? A.smoke : A.dark, gx + Math.cos(a) * rr, fbY + Math.sin(a) * rr * .75 - fr * .1, fr * (.45 + h(i + 60) * .2), .8 * cc); }
    c.save(); c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI; blob(c, A.orange, gx + Math.cos(a) * fr * .8, fbY + Math.sin(a) * fr * .5, fr * .35, .35 * cc * (1 - cool * .5)); }
    c.restore();
  }
  // condensation ring
  const cr = seg(k, .5, 2.6);
  if (cr > 0 && cr < 1) {
    c.save(); c.strokeStyle = `rgba(255,255,255,${.6 * (1 - cr)})`; c.lineWidth = gsc * .25 * (1 - cr) + 1;
    c.beginPath(); c.ellipse(gx, lerp(gy, stemTop, .55), capR * (1 + cr * 2.2), capR * (1 + cr * 2.2) * .22, 0, 0, Math.PI * 2); c.stroke(); c.restore();
  }
  // shockwave: a wall of dust racing out across the board, then the units it carries
  if (ring > 0) {
    const pts = [];
    for (let i = 0; i < 90; i++) { const a = i / 90 * Math.PI * 2; const X = Math.cos(a) * ring, Z = ZC + Math.sin(a) * ring; if (Z - cam.camZ > .3) pts.push([X, Z, a, i]); }
    pts.sort((p1, p2) => p2[1] - p1[1]);
    // ground scorch inside the ring
    c.save(); c.globalAlpha = .35; c.fillStyle = '#ff8a3a'; c.beginPath();
    for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2; const Z = Math.max(cam.camZ + .35, ZC + Math.sin(a) * ring); const [x, y] = cam.P(Math.cos(a) * ring, Z); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); c.fill(); c.restore();
    drawCast(c, cam, cast, t, ex, S);
    for (const [X, Z, a, i] of pts) {
      const [x, y, sc] = cam.P(X, Z, 0);
      const r = sc * (.45 + h(i) * .35), roll = Math.sin(k * 4 + i) * r * .15;
      blob(c, A.dust, x + roll, y - r * .5, r * 1.1, .42);
      blob(c, A.smoke, x - roll, y - r * 1.2, r * .75, .28);
      c.save(); c.globalCompositeOperation = 'lighter'; blob(c, A.orange, x, y - r * .35, r * .55, .18 * light); c.restore();
    }
    // debris flung at the camera
    c.fillStyle = '#16110f';
    for (let i = 0; i < 45; i++) {
      const a = h(i) * Math.PI * 2, d = ring - h(i + 4) * 1.5; if (d <= 0) continue;
      const X = Math.cos(a) * d, Z = ZC + Math.sin(a) * d, Y = Math.sin(clamp(d / 3, 0, 1) * Math.PI) * (1 + h(i + 2) * 2);
      if (Z - cam.camZ < .3) continue;
      const [x, y, sc] = cam.P(X, Z, Y); const s2 = sc * .05 * (.5 + h(i + 7));
      c.save(); c.translate(x, y); c.rotate(k * 6 + i); c.globalAlpha = .85; c.fillRect(-s2, -s2 * .6, s2 * 2, s2 * 1.2); c.restore();
    }
  } else drawCast(c, cam, cast, t, ex, S);
  grade(c, W, H, '#ff7a30', .25 + .25 * light);
  return cam;
}

// ------------------------------------------------------------------ the whole thing
function captions(c, W, H, S, t, lines) {
  const cs = Math.round(S * .034), len = S * .35;
  c.font = `600 ${cs}px 'Cinzel', 'Times New Roman', serif`; c.textBaseline = 'middle';
  try { c.letterSpacing = `${Math.round(cs * .22)}px`; } catch (e) {}
  lines.forEach((line, i) => {
    const st = 5.0 + i * 1.75, a = ease(seg(t, st, st + .9)) * (1 - ease(seg(t, st + 2.4, st + 3.1)));
    if (a <= 0) return;
    const left = i % 2 === 0, drift = (t - st) * S * .006;
    const x = left ? W * .5 - len - drift * -1 : W * .5 + len - drift;
    const y = H * (.34 + (i % 2) * .28) + (i > 1 ? S * .05 : 0);
    c.textAlign = left ? 'right' : 'left';
    c.save(); c.shadowColor = 'rgba(0,0,0,.65)'; c.shadowBlur = cs * .7;
    c.globalAlpha = a; c.fillStyle = '#fbf3e6';
    const words = line.split(' '), rows = []; let cur = '';
    for (const w of words) { const test = cur ? cur + ' ' + w : w; if (c.measureText(test).width > W * .28 && cur) { rows.push(cur); cur = w; } else cur = test; }
    rows.push(cur); rows.forEach((r, j) => c.fillText(r, x, y + j * cs * 1.4));
    c.restore();
  });
  try { c.letterSpacing = '0px'; } catch (e) {}
}
function render(c, W, H, t, opts) {
  const S = Math.min(W, H), cast = opts.cast;
  if (opts.gl && t >= 4.4 && t < 22.2) {
    c.clearRect(0, 0, W, H);
    if (t < 4.9) { c.fillStyle = `rgba(0,0,0,${1 - seg(t, 4.4, 4.9)})`; c.fillRect(0, 0, W, H); }
    if (t < 12.2) captions(c, W, H, S, t, opts.lines);
    if (t > 11.95 && t < 12.2) { c.fillStyle = `rgba(0,0,0,${seg(t, 11.95, 12.1)})`; c.fillRect(0, 0, W, H); }
    if (t >= 12.2 && t < 12.35) { c.fillStyle = `rgba(0,0,0,${1 - seg(t, 12.2, 12.35)})`; c.fillRect(0, 0, W, H); }
    overlays(c, W, H, S, t, true);
    return;
  }
  c.save();
  // camera shake: a thud at the flash, building as the wave approaches
  let shake = 0;
  if (t > 17 && t < 22.2) shake = S * (.012 * Math.max(0, 1 - (t - 17) * 2) + .025 * Math.pow(seg(t, 18, 21.9), 2));
  if (t > 15.5 && t < 16) shake = S * .003;
  if (shake) c.translate((Math.random() - .5) * shake * 2, (Math.random() - .5) * shake * 2);
  // zoom push as the wave arrives
  if (t > 20.5 && t < 22.2) { const z = 1 + .12 * Math.pow(seg(t, 20.5, 21.9), 2); c.translate(W / 2, H / 2); c.scale(z, z); c.translate(-W / 2, -H / 2); }

  if (t < 1.3) { c.fillStyle = `rgba(0,0,0,${Math.min(1, t / 1.1)})`; c.fillRect(0, 0, W, H); }
  else if (t < 4.4) titleCard(c, W, H, S, t);
  else if (t < 12.2) shotSky(c, W, H, S, t, opts.lines);
  else if (t < 14.3) shotEstablish(c, W, H, S, t, cast);
  else if (t < 15.5) shotLowAngle(c, W, H, S, t);
  else if (t < 16.0) shotEstablish(c, W, H, S, t, cast);
  else if (t < 22.2) shotBlast(c, W, H, S, t, cast);
  else { c.fillStyle = '#000'; c.fillRect(-20, -20, W + 40, H + 40); }
  c.restore();
  overlays(c, W, H, S, t, false);
}
function overlays(c, W, H, S, t, gl) {
  // flash, bloom and the anamorphic streak
  if (t >= 17 && t < 19) {
    const k = t - 17;
    c.save(); c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 1; c.fillStyle = `rgba(255,255,255,${clamp(1 - k / .55, 0, 1)})`; c.fillRect(0, 0, W, H);
    c.restore();
    anamorphic(c, W, H * .5, clamp(1 - k / 1.6, 0, 1) * .9);
  }
  if (t >= 21.3 && t < 22.2) {
    const k = seg(t, 21.3, 21.95);
    c.fillStyle = `rgba(255,214,160,${k})`; c.fillRect(0, 0, W, H);
    c.fillStyle = `rgba(255,255,250,${Math.pow(k, 2)})`; c.fillRect(0, 0, W, H);
  }
  // the ending
  if (t >= 22.2) {
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    const msg = 'nuclear option chosen', k = seg(t, 23.2, 25.6), n = Math.floor(msg.length * k);
    const flicker = .7 + .1 * Math.sin(t * 13) + .08 * (h(Math.floor(t * 18)) - .5);
    c.font = `${Math.round(S * .05)}px 'Special Elite', 'Courier New', monospace`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = `rgba(206,200,190,${flicker * (1 - seg(t, 28.2, 28.8))})`;
    c.fillText(msg.slice(0, n) + (n < msg.length && Math.floor(t * 3) % 2 ? '_' : ''), W / 2, H / 2);
    if (t > 28.8) { c.fillStyle = `rgba(242,238,226,${seg(t, 28.8, 30)})`; c.fillRect(0, 0, W, H); }
  }
  // finishing: vignette, grain, letterbox
  if (t > .3 && t < 28.8) {
    if (!gl || t >= 22.2) vignette(c, W, H, t > 22.2 ? .2 : .55);
    grain(c, W, H, t, t > 22.2 ? .12 : .09);
    letterbox(c, W, H, ease(seg(t, .2, 1.3)) * (1 - seg(t, 28.4, 28.8)));
  }
}

// quality: 'auto' | 'full' | 'light' | '2d'
const FALLBACK_KEY = 'inkmate.cine.fallback';
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
const isChromeOS = /\bCrOS\b/.test(navigator.userAgent || '');
function startChoice(quality, glCanvas, W, H) {
  if (!glCanvas || !I.NukeGL || quality === '2d') return null;
  if (quality === 'auto' && store.get(FALLBACK_KEY)) return null;
  const maxTier = quality === 'light' ? 1 : quality === 'full' ? 2 : (isChromeOS ? 1 : 2);
  const p = I.NukeGL.startProbe(glCanvas, W, H, maxTier, quality === 'auto');
  // without background compiling, building the shader would freeze the page, so Auto doesn't risk it
  if (!p.parallel && quality === 'auto') return null;
  return p;
}
I.cinematicInfo = { isChromeOS, clearFallback: () => store.set(FALLBACK_KEY, '') };
I.runNukeCinematic = function (canvas, opts) {
  assets();
  const cues = [
    [.2, () => opts.sfx('rumble')],
    [14.6, () => opts.sfx('whistle')],
    [15.5, () => opts.music.fadeTo(0, 350)],
    [17.0, () => opts.sfx('nukeboom')],
    [17.05, () => opts.sfx('nukeroar')],
    [22.2, () => opts.sfx('tinnitus')],
    [23.6, () => opts.music.fadeTo(.35, 2500)],
    [27.2, () => opts.music.fadeTo(0, 1600)],
  ];
  return new Promise(resolve => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const c = canvas.getContext('2d');
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = '#000'; c.fillRect(0, 0, canvas.width, canvas.height);
    let done = false, gl = null, strikes = 0, frames = 0, last = 0, avg = 30;
    const saved = I.boil;
    const glCanvas = opts.glCanvas;
    const fallBack = why => {
      if (!gl) return;
      gl = null; opts.gl = false;
      if (glCanvas) glCanvas.hidden = true;
      store.set(FALLBACK_KEY, '1');
      if (opts.onFallback) opts.onFallback(why);
    };
    const onLost = e => { e.preventDefault(); fallBack('lost'); };
    if (glCanvas) glCanvas.addEventListener('webglcontextlost', onLost);
    const stop = () => {
      if (done) return; done = true; I.boil = saved;
      if (glCanvas) { glCanvas.hidden = true; glCanvas.removeEventListener('webglcontextlost', onLost); }
      resolve();
    };
    opts.onSkip(stop);
    // start the film straight away; the 3D renderer gets built in the background during the title card
    let probe = null, decided = false;
    const decide = res => {
      decided = true;
      gl = res && res.tier > 0 ? res.renderer : null;
      opts.gl = !!gl; opts.tier = gl ? res.tier : 0;
      if (glCanvas) glCanvas.hidden = !gl;
      if (opts.onTier) opts.onTier(opts.tier);
    };
    opts.gl = false;
    setTimeout(() => { if (done) return; probe = startChoice(opts.quality || 'auto', glCanvas, W, H); if (!probe) decide(null); }, 120);
    const t0 = performance.now();
    {
      const frame = now => {
        if (done) return;
        const t = (now - t0) / 1000 + (opts.startAt || 0);
        const dt = last ? now - last : 16; last = now; frames++;
        if (!decided && probe) {
          if (t >= 4.3) decide(null);                      // not ready in time: play the 2D version
          else { const r = probe.step(); if (r) decide(r); }
        }
        if (gl) {
          // safety net: if frames start taking too long, drop to the 2D version for good
          if (t > 4.6) {
            if (dt > 900) fallBack('slow');
            else if (dt > 250) { if (++strikes >= 2) fallBack('slow'); }
            else strikes = Math.max(0, strikes - .25);
          }
          avg = avg * .9 + dt * .1;
          if (gl && frames % 15 === 0 && t > 4.6) { if (avg > 40) gl.scale *= .82; else if (avg < 22) gl.scale *= 1.05; }
          if (gl && t >= 4.4 && t < 22.2) gl.draw(t, W, H);
        }
        while (cues.length && t >= cues[0][0]) cues.shift()[1]();
        if (t >= DUR) { stop(); return; }
        I.boil = Math.floor(t * 6) % 4;
        c.setTransform(dpr, 0, 0, dpr, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
        render(c, W, H, t, opts);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  });
};
// for checking single frames
I.renderNukeFrame = function (canvas, t, opts) {
  assets();
  const W = canvas.width, H = canvas.height, c = canvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); I.boil = Math.floor(t * 6) % 4;
  render(c, W, H, t, opts);
};
})();
