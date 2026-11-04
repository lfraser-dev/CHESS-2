/* Inkmate art: every piece, card illustration, pack wrapper and card back, drawn live with wobbly ink. */
(() => {
'use strict';
const INK = window.INK;
const C = INK.COL = { INK: '#1e1c24', PAPER: '#f2eee2', RED: '#b3322b', GOLD: '#c99a1c', BLUE: '#4a6fb0', SOFT: '#5a5560', GLASS: '#9db3d6', ORANGE: '#e8892b', GREEN: '#6f8f3a' };
const { INK: K, PAPER, RED, GOLD, BLUE, GLASS, ORANGE, GREEN } = C;

const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
INK.hash = hash;
INK.boil = 0;
const jt = (s, a) => (hash(s * 1.31 + INK.boil * 7.77) - 0.5) * 2 * a;
function ln(c, x1, y1, x2, y2, s = 0, a = 0.7) {
  c.beginPath(); c.moveTo(x1 + jt(s, a), y1 + jt(s + .1, a));
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
  for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2, rr = r + jt(s + (i % n) * .9, a); const px = x + Math.cos(t) * rr, py = y + Math.sin(t) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath();
}
function ell(c, x, y, rx, ry, rot = 0) { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); }
const fs = (c, fill) => { c.fillStyle = fill; c.fill(); c.stroke(); };
function det(c, col, fn) { const o = c.strokeStyle, w = c.lineWidth; c.strokeStyle = col; fn(); c.strokeStyle = o; c.lineWidth = w; }
function thick(c, pts, s, F, w = 7) { // a tube: dark outline then fill colour
  const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]); };
  c.lineWidth = w + 3; path(); c.strokeStyle = K; c.stroke(); c.lineWidth = w; path(); c.strokeStyle = F; c.stroke(); c.strokeStyle = K; c.lineWidth = 2.4;
}
Object.assign(INK, { ln, poly, circ, fs });

// simple building blocks for figures
function legs(c, s, w = 4, top = -10) { ln(c, -w, top, -w - 1, 0, s, .4); ln(c, w, top, w + 1, 0, s + 1, .4); }
function torso(c, F, s, w1 = 9, w2 = 6, y1 = -10, y2 = -27) { poly(c, [[-w1, y1], [w1, y1], [w2, y2], [-w2, y2]], s, .5); fs(c, F); }
function head(c, F, s, y = -32, r = 5) { c.lineWidth = 2.2; circ(c, 0, y, r, s, .4, 10); fs(c, F); c.lineWidth = 2.4; }
function hatCowboy(c, F, s, y = -36) { c.lineWidth = 2.2; ln(c, -12, y, 12, y, s, .3); poly(c, [[-6, y], [-5, y - 8], [5, y - 8], [6, y]], s + 1, .4); fs(c, F); c.lineWidth = 2.4; }

// ===================================================================== pieces (local: feet at 0, ~55 tall, facing right)
const ART = {
  P(c, F, D, s) { legs(c, s); torso(c, F, s + 2); det(c, D, () => { c.lineWidth = 1.6; ln(c, -6, -12, 5, -25, s + 3, .4); }); c.lineWidth = 2.4; poly(c, [[-7.5, -27], [7.5, -27], [0, -42]], s + 4, .5); fs(c, F); det(c, D, () => { c.lineWidth = 1.6; ln(c, 1, -31, 5, -31, s + 5, .2); }); },
  N(c, F, D, s) {
    poly(c, [[-13, 0], [13, 0], [11, -9], [2, -15], [7, -22], [17, -26], [19, -31], [12, -40], [4, -44], [2, -51], [-2, -45], [-8, -42], [-13, -31], [-15, -17], [-12, -8]], s, .6); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.6; circ(c, 7, -35, 1.6, s + 1, .2, 6); c.fillStyle = D; c.fill(); ln(c, 15, -29, 16, -29, s + 2, .2); ln(c, -6, -10, 8, -10, s + 3, .3); });
    c.lineWidth = 1.8; ln(c, -10, -38, -16, -35, s + 4, .4); ln(c, -12, -30, -18, -27, s + 5, .4); ln(c, -14, -21, -19, -18, s + 6, .4);
  },
  B(c, F, D, s) { c.lineWidth = 2; ln(c, 15, 0, 15, -40, s, .4); ln(c, 11, -35, 19, -35, s + 1, .3); c.lineWidth = 2.4; torso(c, F, s + 2, 12, 6, 0, -28); det(c, D, () => { c.lineWidth = 1.6; ln(c, -8, -13, 8, -13, s + 3, .3); ln(c, 0, -26, 0, -14, s + 4, .3); }); head(c, F, s + 5, -33); poly(c, [[-6, -37], [0, -53], [6, -37]], s + 6, .5); fs(c, F); det(c, D, () => { c.lineWidth = 1.5; ln(c, -2, -42, 3, -47, s + 7, .2); }); },
  R(c, F, D, s) {
    poly(c, [[-12, 0], [-12, -34], [-15, -34], [-15, -45], [-9, -45], [-9, -40], [-3, -40], [-3, -45], [3, -45], [3, -40], [9, -40], [9, -45], [15, -45], [15, -34], [12, -34], [12, 0]], s, .5); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.4; for (let y = -29, k = 0; y < -8; y += 7, k++) for (let x = -9 + (k % 2) * 4; x < 8; x += 8) ln(c, x, y, x + 4, y, s + x + y, .3); c.lineWidth = 1.8; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-4, -6); c.arc(0, -6, 4, Math.PI, 0); c.lineTo(4, 0); c.stroke(); });
  },
  Q(c, F, D, s) { ln(c, -5, -22, -12, -12, s, .4); torso(c, F, s + 1, 14, 5, 0, -27); det(c, D, () => { c.lineWidth = 1.5; ln(c, -9, -6, 9, -6, s + 2, .4); ln(c, -4, -21, 4, -21, s + 3, .3); }); head(c, F, s + 4); c.lineWidth = 1.8; poly(c, [[-6, -36], [-7.5, -46], [-3.5, -40], [0, -48], [3.5, -40], [7.5, -46], [6, -36]], s + 5, .4); fs(c, GOLD); },
  K(c, F, D, s) {
    c.lineWidth = 2; ln(c, 10, -16, 13, -40, s, .3); circ(c, 13, -42, 2.6, s + 1, .3, 7); fs(c, GOLD); c.lineWidth = 2.4;
    torso(c, F, s + 2, 13, 7, 0, -28); det(c, D, () => { c.lineWidth = 1.5; ln(c, -10, -5, 10, -5, s + 3, .4); ln(c, 0, -26, 0, -6, s + 4, .3); });
    head(c, F, s + 5, -33, 5.5); c.lineWidth = 1.8; poly(c, [[-7, -37], [-7.5, -47], [-3.5, -42], [0, -48], [3.5, -42], [7.5, -47], [7, -37]], s + 6, .4); fs(c, GOLD);
    c.lineWidth = 2; ln(c, 0, -48, 0, -56, s + 7, .2); ln(c, -3, -53, 3, -53, s + 8, .2);
  },
  A(c, F, D, s) {
    c.lineWidth = 1.8; ln(c, -8, -24, -12, -33, s, .3); ln(c, -6, -24, -9, -34, s + 1, .3); c.lineWidth = 2.4;
    legs(c, s + 2); torso(c, F, s + 4, 8, 6, -10, -26); det(c, D, () => { c.lineWidth = 1.5; ln(c, 0, -23, 0, -13, s + 5, .3); ln(c, -3, -19, 3, -19, s + 6, .3); });
    c.lineWidth = 2.2; poly(c, [[-8, -25], [8, -25], [3, -41], [-5, -38]], s + 7, .5); fs(c, F);
    c.lineWidth = 2; c.beginPath(); c.arc(9, -22, 14, -1.15, 1.15); c.stroke();
    c.lineWidth = 1; c.beginPath(); c.moveTo(9 + Math.cos(-1.15) * 14, -22 + Math.sin(-1.15) * 14); c.lineTo(3, -22); c.lineTo(9 + Math.cos(1.15) * 14, -22 + Math.sin(1.15) * 14); c.stroke();
    c.lineWidth = 1.6; ln(c, 3, -22, 25, -22, s + 8, .2); ln(c, 25, -22, 21, -25, s + 9, .1); ln(c, 25, -22, 21, -19, s + 10, .1);
  },
  W(c, F, D, s) { poly(c, [[-19, 0], [-19, -24], [-15, -24], [-15, -30], [-8, -30], [-8, -24], [-3, -24], [-3, -30], [4, -30], [4, -24], [9, -24], [9, -30], [16, -30], [16, -24], [19, -24], [19, 0]], s, .5); fs(c, F); det(c, D, () => { c.lineWidth = 1.4; for (let y = -19, k = 0; y < -2; y += 6, k++) for (let x = -16 + (k % 2) * 5; x < 15; x += 10) ln(c, x, y, x + 6, y, s + x * 3 + y, .3); }); },
  C(c, F, D, s) {
    c.lineWidth = 2.6; ln(c, -20, -9, 20, -9, s, .4); c.lineWidth = 2.2; ln(c, -6, -9, 2, -32, s + 1, .4); ln(c, 10, -9, 2, -32, s + 2, .4);
    c.lineWidth = 3; ln(c, -22, -40, 16, -26, s + 3, .4); c.lineWidth = 2; circ(c, -22, -44, 5, s + 4, .5, 8); fs(c, K);
    for (const wx of [-12, 12]) { c.lineWidth = 2.2; circ(c, wx, -7, 7, s + wx, .4, 10); fs(c, F); det(c, D, () => { c.lineWidth = 1.3; ln(c, wx - 5, -7, wx + 5, -7, s + wx + 1, .2); ln(c, wx, -12, wx, -2, s + wx + 2, .2); }); }
  },
  T(c, F, D, s) {
    c.lineWidth = 3.4; ln(c, 4, -27, 26, -32, s, .3); c.lineWidth = 2.4;
    c.beginPath(); c.moveTo(-17, 0); c.lineTo(17, 0); c.arc(17, -6, 6, Math.PI / 2, -Math.PI / 2, true); c.lineTo(-17, -12); c.arc(-17, -6, 6, -Math.PI / 2, Math.PI / 2, true); c.closePath(); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.5; for (let x = -16; x <= 16; x += 8) { circ(c, x, -6, 3, s + x, .2, 8); c.stroke(); } });
    poly(c, [[-18, -12], [18, -12], [14, -21], [-15, -21]], s + 1, .5); fs(c, F);
    c.beginPath(); c.moveTo(-9, -21); c.quadraticCurveTo(-8, -32, 1, -32); c.quadraticCurveTo(10, -32, 10, -21); c.closePath(); fs(c, F);
  },
  Z(c, F, D, s) {
    c.lineWidth = 2; ln(c, 14, 0, 14, -42, s, .4);
    det(c, RED, () => { c.lineWidth = 1.6; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + INK.boil * .3; ln(c, 14 - Math.cos(a) * 5, -46 - Math.sin(a) * 5, 14 + Math.cos(a) * 5, -46 + Math.sin(a) * 5, s + k, .2); } });
    c.lineWidth = 2.4; torso(c, F, s + 1, 13, 3, 0, -30);
    det(c, D, () => { c.lineWidth = 1.3; ln(c, -6, -8, -2, -8, s + 2, .2); ln(c, -4, -10, -4, -6, s + 3, .2); ln(c, 3, -16, 7, -16, s + 4, .2); ln(c, 5, -18, 5, -14, s + 5, .2); });
    head(c, F, s + 6, -33, 4.5); c.lineWidth = 1.8; poly(c, [[-3.5, -32], [3.5, -32], [1, -21], [-1, -21]], s + 7, .4); fs(c, PAPER);
    c.lineWidth = 2.2; poly(c, [[-10, -36], [10, -36], [3, -43], [-6, -57], [-2, -44]], s + 8, .5); fs(c, F);
  },
  D(c, F, D, s) {
    c.lineWidth = 2; ln(c, -6, -4, -8, 0, s, .3); ln(c, 6, -4, 7, 0, s + 1, .3);
    c.beginPath(); c.moveTo(-13, -8); c.quadraticCurveTo(-24, -10, -26, -20); c.stroke();
    poly(c, [[-26, -20], [-29, -15], [-23, -16]], s + 3, .3); fs(c, F);
    c.lineWidth = 2.2; poly(c, [[-3, -18], [-15, -44], [-9, -36], [-4, -41], [3, -24]], s + 4, .6); fs(c, F);
    poly(c, [[-15, -7], [-6, -19], [7, -20], [13, -12], [9, -4], [-7, -3]], s + 5, .6); fs(c, F);
    poly(c, [[6, -18], [11, -31], [16, -31], [12, -15]], s + 6, .5); fs(c, F);
    poly(c, [[11, -31], [22, -36], [25, -32], [15, -27]], s + 7, .5); fs(c, F);
    c.fillStyle = RED; c.fillRect(17, -34, 2, 2);
    det(c, RED, () => { c.lineWidth = 1.4; ln(c, 26, -33, 32, -36, s + 8, .8); ln(c, 26, -32, 33, -31, s + 9, .8); ln(c, 26, -31, 31, -27, s + 10, .8); });
  },
  J(c, F, D, s) {
    c.fillStyle = 'rgba(30,28,36,0.15)'; ell(c, 0, 0, 22, 3); c.fill();
    c.save(); c.translate(0, -18); c.rotate(-0.12);
    det(c, RED, () => { c.lineWidth = 1.6; ln(c, -30, -1, -38, -2, s, .8); ln(c, -30, 1, -36, 2, s + 1, .8); });
    c.lineWidth = 2.2;
    poly(c, [[-26, -14], [-20, -14], [-12, -4], [-28, -4]], s + 2, .4); fs(c, F);
    poly(c, [[-28, -4], [10, -5], [22, -3], [32, 0], [22, 3], [-28, 4]], s + 3, .4); fs(c, F);
    poly(c, [[-6, 1], [8, 1], [-12, 11], [-18, 11]], s + 4, .4); fs(c, F);
    poly(c, [[6, -5], [12, -10], [20, -4]], s + 5, .3); fs(c, GLASS);
    c.restore();
  },
  chicken(c, F, D, s) {
    c.lineWidth = 2; ln(c, -3, -8, -4, 0, s, .3); ln(c, 3, -8, 4, 0, s + 1, .3); c.lineWidth = 2.4;
    poly(c, [[-10, -18], [-17, -29], [-12, -21], [-18, -22], [-10, -13]], s + 2, .4); fs(c, F);
    ell(c, 0, -16, 12, 9); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.5; c.beginPath(); c.arc(-1, -16, 6, 0.3, 2.6); c.stroke(); });
    ln(c, 7, -21, 9, -25, s + 3, .2); head(c, F, s + 4, -28, 5);
    c.lineWidth = 1.6; poly(c, [[6, -32], [8, -37], [9, -33], [11, -36], [12, -31]], s + 5, .3); fs(c, RED);
    poly(c, [[13, -29], [18, -27], [13, -26]], s + 6, .2); fs(c, GOLD);
    c.fillStyle = D; c.fillRect(9.5, -30, 1.8, 1.8);
  },
  keg(c, F, D, s) {
    poly(c, [[-11, 0], [11, 0], [13, -13], [11, -27], [-11, -27], [-13, -13]], s, .5); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.6; ln(c, -12, -6, 12, -6, s + 1, .3); ln(c, -12, -21, 12, -21, s + 2, .3); ln(c, -4, -16, 4, -10, s + 3, .2); ln(c, 4, -16, -4, -10, s + 4, .2); });
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, -27); c.quadraticCurveTo(2, -34, 7, -35); c.stroke();
    det(c, RED, () => { c.lineWidth = 1.5; for (let k = 0; k < 5; k++) { const a = k * 1.25 + INK.boil; ln(c, 8, -36, 8 + Math.cos(a) * 5, -36 + Math.sin(a) * 5, s + k, .3); } });
  },
  ghost(c, F, D, s) {
    c.save(); c.globalAlpha *= 0.85; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-12, -2 + jt(s, .5));
    for (let i = 0; i <= 4; i++) c.quadraticCurveTo(-12 + i * 6 - 3, (i % 2 ? -7 : 3), -12 + i * 6, -2);
    c.lineTo(12, -30); c.bezierCurveTo(12, -48, -12, -48, -12, -30); c.closePath(); fs(c, F);
    c.fillStyle = D; ell(c, -4, -31, 2.5, 4); c.fill(); ell(c, 5, -31, 2.5, 4); c.fill(); ell(c, 0, -21, 3, 3.5); c.fill();
    c.restore();
  },
  jester(c, F, D, s) {
    legs(c, s); torso(c, F, s + 2);
    det(c, D, () => { c.lineWidth = 1.3; poly(c, [[0, -24], [5, -18], [0, -12], [-5, -18]], s + 3, .3); c.stroke(); });
    head(c, F, s + 4);
    c.lineWidth = 2; poly(c, [[-6, -36], [-15, -45], [-4, -40], [0, -50], [4, -40], [15, -45], [6, -36]], s + 5, .5); fs(c, F);
    for (const [x, y] of [[-15, -45], [0, -50], [15, -45]]) { c.lineWidth = 1.4; circ(c, x, y, 2.4, s + x, .2, 7); fs(c, GOLD); }
    c.fillStyle = D; c.fillRect(1.5, -33, 1.8, 1.8);
  },
  assassin(c, F, D, s) {
    legs(c, s, 3); det(c, RED, () => { c.lineWidth = 2; ln(c, -3, -27, -15, -22, s + 9, .8); });
    torso(c, F, s + 2, 7, 5, -10, -27);
    c.lineWidth = 2.2; poly(c, [[-7, -26], [7, -26], [3, -42], [-6, -38]], s + 3, .5); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.5; ln(c, 0, -32, 4, -32, s + 4, .2); });
    c.lineWidth = 2; ln(c, 6, -18, 18, -28, s + 5, .2); ln(c, 9, -24, 12, -20, s + 6, .2);
  },
  golem(c, F, D, s) {
    poly(c, [[-12, 0], [-4, 0], [-4, -12], [-12, -12]], s, .5); fs(c, F); poly(c, [[4, 0], [12, 0], [12, -12], [4, -12]], s + 1, .5); fs(c, F);
    poly(c, [[-16, -11], [16, -11], [18, -36], [-18, -36]], s + 2, .7); fs(c, F);
    poly(c, [[-25, -34], [-17, -34], [-17, -14], [-25, -16]], s + 3, .6); fs(c, F); poly(c, [[17, -34], [25, -34], [25, -16], [17, -14]], s + 4, .6); fs(c, F);
    poly(c, [[-7, -36], [7, -36], [6, -47], [-6, -47]], s + 5, .5); fs(c, F);
    c.fillStyle = RED; c.fillRect(-4, -43, 3, 2); c.fillRect(2, -43, 3, 2);
    det(c, D, () => { c.lineWidth = 1.3; poly(c, [[-8, -30], [-4, -24], [-9, -18]], s + 6, .4, false); c.stroke(); poly(c, [[6, -28], [10, -22]], s + 7, .3, false); c.stroke(); });
  },
  heli(c, F, D, s) {
    c.lineWidth = 2; ln(c, -14, 0, 14, 0, s, .3); ln(c, -8, 0, -6, -6, s + 1, .2); ln(c, 8, 0, 6, -6, s + 2, .2);
    c.lineWidth = 3; ln(c, -6, -15, -27, -21, s + 3, .3); c.lineWidth = 1.6; circ(c, -27, -21, 4.5, s + 4, .4, 8); c.stroke();
    c.lineWidth = 2.4; ell(c, 3, -14, 13, 9); fs(c, F);
    c.beginPath(); c.moveTo(6, -22); c.quadraticCurveTo(15, -21, 15, -12); c.lineTo(6, -12); c.closePath(); fs(c, GLASS);
    c.lineWidth = 2; ln(c, 3, -23, 3, -28, s + 5, .2); c.lineWidth = 2.6; ln(c, -24, -28 + jt(s + 6, 1), 30, -28 - jt(s + 7, 1), s + 8, .4);
  },
  phoenix(c, F, D, s) {
    det(c, RED, () => { c.lineWidth = 1.8; for (let k = 0; k < 4; k++) ln(c, -6, -10, -20 - k * 2, -2 + k * 3, s + k, 1.2); });
    c.fillStyle = ORANGE; poly(c, [[-4, -9], [-18, -3], [-12, -10], [-20, -12]], s + 5, .6); c.fill();
    c.lineWidth = 2.2; poly(c, [[-2, -16], [-22, -44], [-8, -34], [-6, -46], [2, -26]], s + 6, .6); fs(c, F);
    poly(c, [[4, -18], [16, -44], [14, -30], [24, -38], [10, -18]], s + 7, .6); fs(c, F);
    ell(c, 2, -14, 10, 6, -0.3); fs(c, F); head(c, F, s + 8, -24, 4.5);
    c.lineWidth = 1.6; poly(c, [[4, -25], [11, -23], [4, -21]], s + 9, .2); fs(c, GOLD);
    det(c, RED, () => { c.lineWidth = 1.5; ln(c, -1, -28, -4, -35, s + 10, .5); ln(c, 1, -28, 1, -36, s + 11, .5); });
    c.lineWidth = 2; ln(c, 0, -8, -1, 0, s + 12, .2); ln(c, 4, -8, 5, 0, s + 13, .2);
  },
  serpent(c, F, D, s) {
    c.save(); c.translate(0, -22);
    c.lineWidth = 10; c.strokeStyle = K; c.beginPath(); c.arc(0, 0, 16, 0.5, Math.PI * 2 - 0.2); c.stroke();
    c.lineWidth = 6; c.strokeStyle = F; c.beginPath(); c.arc(0, 0, 16, 0.55, Math.PI * 2 - 0.25); c.stroke();
    c.strokeStyle = K; c.lineWidth = 2.2;
    poly(c, [[12, 8], [24, 4], [26, 12], [18, 16], [11, 14]], s, .4); fs(c, F);
    c.fillStyle = RED; c.fillRect(20, 7, 2.2, 2.2);
    det(c, D, () => { c.lineWidth = 1.2; for (let a = 1; a < 6; a += .7) ln(c, Math.cos(a) * 14, Math.sin(a) * 14, Math.cos(a + .2) * 18, Math.sin(a + .2) * 18, s + a, .2); });
    c.restore();
  },
  egg(c, F, D, s) {
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, -38); c.bezierCurveTo(15, -38, 15, 0, 0, 0); c.bezierCurveTo(-15, 0, -15, -38, 0, -38); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.4; circ(c, -4, -24, 2.5, s, .3, 7); c.stroke(); circ(c, 5, -14, 3, s + 1, .3, 7); c.stroke(); circ(c, 3, -30, 1.8, s + 2, .3, 6); c.stroke(); });
    det(c, RED, () => { c.lineWidth = 1.6; poly(c, [[-10, -20], [-5, -17], [-2, -21], [3, -17], [9, -20]], s + 3, .5, false); c.stroke(); });
  },
  goose(c, F, D, s) {
    c.lineWidth = 2; ln(c, -2, -8, -3, 0, s, .3); ln(c, 4, -8, 5, 0, s + 1, .3); c.lineWidth = 2.4;
    ell(c, -2, -14, 14, 8); fs(c, F);
    c.beginPath(); c.moveTo(8, -18); c.quadraticCurveTo(10, -32, 6, -40); c.lineTo(12, -42); c.quadraticCurveTo(16, -30, 13, -16); c.closePath(); fs(c, F);
    c.lineWidth = 1.6; poly(c, [[12, -42], [20, -40], [12, -38]], s + 2, .2); fs(c, ORANGE);
    c.fillStyle = D; c.fillRect(9, -41, 1.8, 1.8);
    c.lineWidth = 1.8; poly(c, [[-12, -15], [2, -18], [-2, -11]], s + 3, .4); fs(c, GOLD);
    c.lineWidth = 1.6; ell(c, 18, -3, 4, 5); fs(c, GOLD);
  },
  pagoda(c, F, D, s) {
    const roof = (y, w, h, k) => { c.lineWidth = 2.2; c.beginPath(); c.moveTo(-w, y - h + jt(s + k, .6)); c.quadraticCurveTo(-w * .7, y + 1, -w * .45, y); c.lineTo(w * .45, y); c.quadraticCurveTo(w * .7, y + 1, w, y - h + jt(s + k + 1, .6)); c.lineTo(w * .42, y - h * 1.7); c.lineTo(-w * .42, y - h * 1.7); c.closePath(); fs(c, RED); };
    det(c, RED, () => { c.lineWidth = 1.6; for (let i = 0; i < 6; i++) { const a = -2.7 + i * .45, r1 = 26 + (INK.boil % 2) * 2; ln(c, Math.cos(a) * r1, -24 + Math.sin(a) * r1 * .9, Math.cos(a) * (r1 + 7), -24 + Math.sin(a) * (r1 + 7) * .9, s + i, .6); } });
    c.lineWidth = 2.2; poly(c, [[-19, 0], [19, 0], [17, -5], [-17, -5]], s, .4); fs(c, F);
    poly(c, [[-13, -5], [13, -5], [12, -20], [-12, -20]], s + 1, .4); fs(c, F);
    c.lineWidth = 1.8; ell(c, 0, -11.5, 6.5, 5.5); fs(c, '#5a1410');
    c.fillStyle = PAPER; for (const x of [-4, -1.3, 1.3, 4]) { c.beginPath(); c.moveTo(x - 1.2, -16.6); c.lineTo(x + 1.2, -16.6); c.lineTo(x, -14); c.fill(); c.beginPath(); c.moveTo(x - 1.2, -6.4); c.lineTo(x + 1.2, -6.4); c.lineTo(x, -9); c.fill(); }
    roof(-20, 25, 6, 2);
    c.lineWidth = 2.2; poly(c, [[-9, -27], [9, -27], [8, -37], [-8, -37]], s + 3, .4); fs(c, F);
    c.fillStyle = PAPER; ell(c, -4, -32, 2.6, 2); c.fill(); c.stroke(); ell(c, 4, -32, 2.6, 2); c.fill(); c.stroke();
    c.fillStyle = RED; c.fillRect(-4.6, -32.8, 1.6, 1.6); c.fillRect(3.4, -32.8, 1.6, 1.6);
    c.lineWidth = 1.8; ln(c, -7, -36, -2, -34, s + 4, .2); ln(c, 7, -36, 2, -34, s + 5, .2);
    roof(-37, 19, 5, 6);
    c.lineWidth = 2; poly(c, [[-4.5, -45], [4.5, -45], [4, -50], [-4, -50]], s + 7, .3); fs(c, F);
    roof(-50, 11, 3.5, 8);
    c.lineWidth = 1.8; ln(c, 0, -56, 0, -63, s + 9, .2); for (const y of [-58, -60.5]) { ell(c, 0, y, 2.2, .9); c.stroke(); }
  },
  trolley(c, F, D, s) {
    c.lineWidth = 2.2; poly(c, [[-18, -28], [14, -28], [10, -10], [-14, -10]], s, .5); fs(c, F);
    det(c, D, () => { c.lineWidth = 1; for (let x = -12; x <= 8; x += 5) ln(c, x, -27, x + 1, -11, s + x, .2); for (let y = -23; y <= -14; y += 4.5) ln(c, -16, y, 12, y, s + y, .2); });
    c.lineWidth = 2; ln(c, 14, -28, 21, -34, s + 1, .3); ln(c, 19, -36, 24, -32, s + 2, .2);
    ln(c, -12, -10, -10, -5, s + 3, .2); ln(c, 8, -10, 7, -5, s + 4, .2); ln(c, -14, -5, 10, -5, s + 5, .3);
    for (const x of [-10, 7]) { circ(c, x, -2.5, 2.6, s + x, .2, 7); fs(c, K); }
  },
  duck(c, F, D, s) {
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(-14, -12); c.quadraticCurveTo(-16, -1, -2, -1); c.quadraticCurveTo(14, -1, 13, -12); c.quadraticCurveTo(6, -15, 2, -14); c.quadraticCurveTo(-8, -16, -14, -12); c.closePath(); fs(c, F === PAPER ? '#f3d55b' : F);
    circ(c, 5, -21, 6.5, s, .3, 10); fs(c, F === PAPER ? '#f3d55b' : F);
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(10, -21); c.quadraticCurveTo(17, -22, 17, -18); c.quadraticCurveTo(13, -16, 10, -18); c.closePath(); fs(c, ORANGE);
    c.fillStyle = D === K ? K : PAPER; c.fillRect(6, -23.5, 2, 2);
    det(c, D, () => { c.lineWidth = 1.4; c.beginPath(); c.arc(-3, -9, 5, .2, 2.4); c.stroke(); });
    c.lineWidth = 1.2; c.strokeStyle = BLUE; c.beginPath(); for (let x = -20; x <= 20; x += 4) c.lineTo(x, 1 + Math.sin(x * .6 + INK.boil) * 1); c.stroke(); c.strokeStyle = K;
  },
  gnome(c, F, D, s) {
    c.lineWidth = 2.2; poly(c, [[-9, 0], [9, 0], [8, -14], [-8, -14]], s, .4); fs(c, F);
    poly(c, [[-6, -16], [6, -16], [4, -2], [0, 2], [-4, -2]], s + 1, .4); fs(c, PAPER);
    det(c, '#8a8478', () => { c.lineWidth = 1; for (let k = -3; k <= 3; k += 2) ln(c, k, -14, k * .6, -3, s + k, .3); });
    circ(c, 0, -18, 4.5, s + 2, .3, 9); fs(c, '#f0c8a8');
    c.fillStyle = K; c.fillRect(-2.6, -19.5, 1.6, 1.6); c.fillRect(1.2, -19.5, 1.6, 1.6);
    c.lineWidth = 2.2; poly(c, [[-8, -20], [8, -20], [3, -32], [-2, -42]], s + 3, .5); fs(c, RED);
    c.lineWidth = 1.8; ln(c, 9, 0, 12, -18, s + 4, .2); poly(c, [[10, -18], [14, -18], [13, -24], [11, -24]], s + 5, .2); fs(c, '#cfc8b4');
  },
  pigeon(c, F, D, s) {
    c.lineWidth = 2; ln(c, -2, -6, -3, 0, s, .3); ln(c, 3, -6, 4, 0, s + 1, .3);
    c.lineWidth = 2.2; c.beginPath(); c.moveTo(-16, -14); c.quadraticCurveTo(-8, -2, 4, -6); c.quadraticCurveTo(12, -10, 10, -20); c.quadraticCurveTo(0, -22, -16, -14); c.closePath(); fs(c, F === PAPER ? '#d9d6d0' : F);
    det(c, BLUE, () => { c.lineWidth = 2; ln(c, 7, -18, 10, -12, s + 2, .3); });
    det(c, '#6f8f3a', () => { c.lineWidth = 1.6; ln(c, 6, -20, 9, -14, s + 3, .3); });
    circ(c, 10, -23, 4.6, s + 4, .3, 9); fs(c, F === PAPER ? '#d9d6d0' : F);
    c.lineWidth = 1.6; poly(c, [[14, -23], [18, -22], [14, -21]], s + 5, .1); fs(c, K);
    c.fillStyle = ORANGE; c.fillRect(10.5, -25, 2, 2);
    det(c, D, () => { c.lineWidth = 1.3; ln(c, -10, -13, 0, -10, s + 6, .3); ln(c, -8, -10, 2, -8, s + 7, .3); });
  },
  vending(c, F, D, s) {
    c.lineWidth = 2.4; poly(c, [[-13, 0], [13, 0], [13, -44], [-13, -44]], s, .4); fs(c, F);
    c.lineWidth = 1.8; poly(c, [[-10, -40], [5, -40], [5, -14], [-10, -14]], s + 1, .3); fs(c, '#dfe6ee');
    const cols = [RED, BLUE, GOLD, '#6f8f3a'];
    for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { c.fillStyle = cols[(r + k) % 4]; c.fillRect(-8.5 + k * 4.6, -38 + r * 6, 3, 4.5); }
    det(c, D, () => { c.lineWidth = 1.4; ln(c, 8, -36, 11, -36, s + 2, .1); ln(c, 9.5, -30, 9.5, -26, s + 3, .1); poly(c, [[-9, -10], [5, -10], [5, -5], [-9, -5]], s + 4, .2); c.stroke(); });
    c.fillStyle = GOLD; c.fillRect(8, -21, 3, 3);
  },
  grandma(c, F, D, s) {
    legs(c, s, 3.5, -8);
    c.lineWidth = 2.4; poly(c, [[-11, -8], [11, -8], [7, -26], [-6, -27]], s + 2, .5); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.2; for (let y = -22; y < -10; y += 4) ln(c, -7, y, 7, y, s + y, .5); });
    c.lineWidth = 2.2; circ(c, 3, -31, 5, s + 3, .3, 10); fs(c, '#f0c8a8');
    c.lineWidth = 1.8; circ(c, -1, -36, 3.6, s + 4, .4, 9); fs(c, '#d8d2c0'); circ(c, 4, -36.5, 4.6, s + 5, .4, 9); fs(c, '#d8d2c0');
    c.lineWidth = 1.2; circ(c, 5, -31, 1.8, s + 6, .1, 7); c.stroke(); circ(c, 1.5, -31, 1.8, s + 7, .1, 7); c.stroke();
    c.lineWidth = 2; ln(c, 6, -20, 13, -15 + Math.sin(INK.boil) * 1.5, s + 8, .2);
    poly(c, [[10, -16], [20, -16], [19, -6], [11, -6]], s + 9, .4); fs(c, RED); c.lineWidth = 1.4; c.beginPath(); c.arc(15, -16, 3.5, Math.PI, 0); c.stroke();
    c.lineWidth = 1.8; ln(c, -9, -14, -14, 0, s + 10, .2);
  },
  toaster(c, F, D, s) {
    c.lineWidth = 2; for (const x of [-5, 5]) { poly(c, [[x - 4, -22], [x + 4, -22], [x + 4, -36 - (INK.boil % 2)], [x - 4, -36 - (INK.boil % 2)]], s + x, .4); fs(c, '#e2c27a'); }
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(-15, 0); c.lineTo(15, 0); c.quadraticCurveTo(17, -12, 13, -24); c.lineTo(-13, -24); c.quadraticCurveTo(-17, -12, -15, 0); c.closePath(); fs(c, F === PAPER ? '#dfe1e4' : F);
    det(c, D, () => { c.lineWidth = 1.4; ln(c, -9, -24, -1, -24, s + 1, .1); ln(c, 1, -24, 9, -24, s + 2, .1); ln(c, 15, -14, 19, -14, s + 3, .2); });
    det(c, RED, () => { c.lineWidth = 1.4; for (let k = -1; k <= 1; k++) ln(c, k * 5, -40, k * 5 + 2, -46, s + k, .6); });
  },
  pogo(c, F, D, s) {
    c.lineWidth = 2; ln(c, 0, 0, 0, -6, s, .1);
    c.lineWidth = 1.6; c.beginPath(); for (let i = 0; i <= 6; i++) c.lineTo(i % 2 ? 3 : -3, -6 - i * 1.6); c.stroke();
    c.lineWidth = 2.2; ln(c, 0, -16, 0, -40, s + 1, .2); ln(c, -6, -18, 6, -18, s + 2, .2); ln(c, -6, -36, 6, -36, s + 3, .2);
    ln(c, -4, -18, -5, -26, s + 4, .3); ln(c, 4, -18, 5, -26, s + 5, .3);
    poly(c, [[-5, -26], [5, -26], [4, -36], [-4, -36]], s + 6, .4); fs(c, F);
    circ(c, 0, -41, 4.5, s + 7, .3, 9); fs(c, F);
    c.lineWidth = 1.8; poly(c, [[-5, -43], [5, -43], [3, -47], [-4, -47]], s + 8, .3); fs(c, RED); ln(c, 5, -43, 10, -43, s + 9, .1);
    c.lineWidth = 1.2; ln(c, -10, -4, -14, -2, s + 10, .4); ln(c, 10, -4, 14, -2, s + 11, .4);
  },
  blob(c, F, D, s) {
    c.lineWidth = 2.4; c.beginPath();
    for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2, r = 13 + Math.sin(a * 3 + INK.boil) * 2 + hash(s + i) * 2; const x = Math.cos(a) * r * 1.1, y = -13 + Math.sin(a) * r * .9; i ? c.lineTo(x, Math.min(y, 0)) : c.moveTo(x, Math.min(y, 0)); }
    c.closePath(); fs(c, K);
    c.fillStyle = PAPER; ell(c, -4, -16, 3.5, 4.5); c.fill(); ell(c, 5, -16, 3.5, 4.5); c.fill();
    c.fillStyle = F === PAPER ? BLUE : RED; c.fillRect(-4, -15, 2, 2.4); c.fillRect(5, -15, 2, 2.4);
    if (F === PAPER) { c.strokeStyle = PAPER; c.lineWidth = 1.4; ln(c, -8, -24, -3, -26, s, .3); c.strokeStyle = K; }
    c.fillStyle = K; ell(c, 13, -3, 2, 3); c.fill(); ell(c, -15, -2, 1.6, 2.2); c.fill();
  },
  voidknight(c, F, D, s) {
    c.lineWidth = 3; ln(c, -5, -11, -6, 0, s, .4); ln(c, 5, -11, 6, 0, s + 1, .4); c.lineWidth = 2.4;
    c.lineWidth = 2; ln(c, 17, -20, 20, -52, s + 9, .3); ln(c, 14, -24, 21, -24, s + 10, .2); c.lineWidth = 2.4;
    poly(c, [[-11, -11], [11, -11], [13, -32], [-13, -32]], s + 2, .5); fs(c, F);
    circ(c, -13, -31, 7, s + 3, .5, 10); fs(c, F); circ(c, 13, -31, 7, s + 4, .5, 10); fs(c, F);
    c.beginPath(); c.moveTo(-6, -33); c.lineTo(-6, -41); c.quadraticCurveTo(0, -47, 6, -41); c.lineTo(6, -33); c.closePath(); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.6; ln(c, -3, -39, 5, -39, s + 5, .2); poly(c, [[0, -28], [4, -22], [0, -16], [-4, -22]], s + 6, .3); c.stroke(); });
    det(c, RED, () => { c.lineWidth = 1.4; ln(c, 2, -38, 5, -38, s + 7, .1); });
  },
  plasma(c, F, D, s) {
    legs(c, s); torso(c, F, s + 2, 8, 7);
    c.beginPath(); c.moveTo(-6, -27); c.quadraticCurveTo(-6, -40, 1, -40); c.quadraticCurveTo(8, -40, 7, -27); c.closePath(); fs(c, F);
    c.lineWidth = 1.8; poly(c, [[1, -34], [8, -34], [7, -30], [1, -30]], s + 3, .2); fs(c, GLASS);
    c.lineWidth = 4.5; ln(c, -2, -19, 22, -21, s + 4, .3); c.lineWidth = 2.4;
    det(c, BLUE, () => { c.lineWidth = 1.6; circ(c, 25, -21, 3, s + 5, .6, 7); c.stroke(); });
  },
  titan(c, F, D, s) {
    c.lineWidth = 3.4; ln(c, -7, -16, -12, 0, s, .4); ln(c, 7, -16, 12, 0, s + 1, .4); ln(c, -16, 0, -8, 0, s + 2, .3); ln(c, 8, 0, 16, 0, s + 3, .3);
    c.lineWidth = 2.4; poly(c, [[-9, -14], [9, -14], [9, -21], [-9, -21]], s + 4, .4); fs(c, F);
    poly(c, [[-15, -21], [15, -21], [17, -45], [-17, -45]], s + 5, .6); fs(c, F);
    c.beginPath(); c.moveTo(-6, -45); c.quadraticCurveTo(0, -55, 6, -45); c.closePath(); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.4; for (let y = -40; y < -26; y += 5) ln(c, -11, y, -4, y, s + y, .2); });
    det(c, RED, () => { c.lineWidth = 1.8; ln(c, -2, -48, 3, -48, s + 6, .1); });
    c.lineWidth = 6; ln(c, 16, -36, 33, -36, s + 7, .2); c.lineWidth = 2.4; poly(c, [[-17, -40], [-25, -36], [-24, -24], [-17, -26]], s + 8, .4); fs(c, F);
  },
  tumbleweed(c, F, D, s) {
    c.lineWidth = 1.6;
    for (let k = 0; k < 7; k++) { c.beginPath(); c.ellipse(jt(s + k, 3), -13 + jt(s + k + 9, 3), 12 - k % 3, 10 + k % 2, k * .7 + INK.boil * .2, 0, Math.PI * 1.7); c.stroke(); }
    det(c, D === K ? K : '#5a5560', () => { c.lineWidth = 1; for (let k = 0; k < 5; k++) ln(c, -9 + k * 4, -4, -6 + k * 3, -22, s + k * 3, 1); });
    c.lineWidth = 1.2; ln(c, -20, 0, -13, 0, s + 20, .3); ln(c, -22, -6, -15, -5, s + 21, .3);
  },
  bandit(c, F, D, s) {
    legs(c, s); torso(c, F, s + 2); head(c, F, s + 3);
    c.lineWidth = 1.6; poly(c, [[-5, -31], [5, -31], [2, -26], [-2, -26]], s + 4, .3); fs(c, RED);
    hatCowboy(c, F, s + 5, -36);
    c.lineWidth = 2; circ(c, 13, -10, 6, s + 6, .6, 9); fs(c, PAPER); ln(c, 8, -16, 11, -18, s + 7, .3);
    c.fillStyle = '#8a6510'; c.font = 'bold 8px sans-serif'; c.textAlign = 'center'; c.fillText('$', 13, -7);
  },
  sheriff(c, F, D, s) {
    legs(c, s); torso(c, F, s + 2); head(c, F, s + 3); hatCowboy(c, F, s + 4, -36);
    c.lineWidth = 1.4; poly(c, [[-3, -22], [-1, -20], [-3, -17], [0, -18.5], [3, -17], [1, -20], [3, -22], [0, -21]], s + 5, .2); fs(c, GOLD);
    c.lineWidth = 2.6; ln(c, 7, -18, 18, -20, s + 6, .2); c.lineWidth = 2; ln(c, 9, -18, 9, -14, s + 7, .2);
  },
  stranger(c, F, D, s) {
    legs(c, s, 3.5, -8);
    poly(c, [[-15, -8], [15, -8], [2, -30], [-2, -30]], s + 2, .6); fs(c, F);
    det(c, D, () => { c.lineWidth = 1.4; ln(c, -12, -12, 12, -12, s + 3, .3); ln(c, -9, -16, 9, -16, s + 4, .3); });
    det(c, RED, () => { c.lineWidth = 1.4; ln(c, -10, -14, 10, -14, s + 5, .3); });
    head(c, F, s + 6, -33, 4.6); c.lineWidth = 2.2; ln(c, -13, -35, 13, -36, s + 7, .3); poly(c, [[-6, -35], [-5, -42], [5, -42], [6, -36]], s + 8, .4); fs(c, F);
    c.lineWidth = 2.6; ln(c, 9, -14, 20, -17, s + 9, .2);
  },
  tentacle(c, F, D, s) {
    c.lineWidth = 1.4; ln(c, -16, 0, 16, 0, s, .5); ln(c, -12, 3, 12, 3, s + 1, .5);
    thick(c, [[0, 0], [12 + jt(s, 2), -16], [-14 + jt(s + 1, 2), -28], [4 + jt(s + 2, 2), -46]], s, F, 7);
    c.beginPath(); c.arc(8, -46, 4, Math.PI, 0); c.stroke();
    det(c, D, () => { c.lineWidth = 1.2; for (const [x, y] of [[5, -10], [2, -20], [-4, -30], [0, -38]]) { circ(c, x, y, 1.6, s + x, .2, 6); c.stroke(); } });
  },
  moth(c, F, D, s) {
    c.save(); c.translate(0, -22);
    c.lineWidth = 2.2;
    for (const sx of [-1, 1]) {
      poly(c, [[0, -2], [sx * 22, -20], [sx * 24, -6], [sx * 4, 0]], s + sx, .6); fs(c, F);
      poly(c, [[0, 2], [sx * 16, 18], [sx * 6, 16]], s + sx + 5, .5); fs(c, F);
      det(c, D, () => { c.lineWidth = 1.4; circ(c, sx * 14, -10, 3.4, s + sx * 3, .3, 8); c.stroke(); });
    }
    ell(c, 0, 2, 3.5, 12); fs(c, F);
    c.lineWidth = 1.4; ln(c, -1, -9, -7, -20, s + 9, .4); ln(c, 1, -9, 7, -20, s + 10, .4);
    c.restore();
  },
  lizard(c, F, D, s) {
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(-8, -12); c.quadraticCurveTo(-26, -8, -28, 0); c.lineTo(-20, 0); c.quadraticCurveTo(-14, -6, -4, -6); c.closePath(); fs(c, F);
    c.lineWidth = 3.2; ln(c, -4, -12, -6, 0, s, .4); ln(c, 6, -12, 8, 0, s + 1, .4); c.lineWidth = 2.4;
    poly(c, [[-11, -10], [10, -10], [12, -30], [6, -42], [-6, -40], [-12, -26]], s + 2, .7); fs(c, F);
    det(c, RED, () => { c.lineWidth = 2; for (let k = 0; k < 4; k++) ln(c, -11 + k * 2, -18 - k * 6, -17 + k * 2, -21 - k * 6, s + k, .4); });
    c.lineWidth = 2.4; poly(c, [[2, -40], [16, -44], [22, -40], [14, -37], [20, -34], [8, -32]], s + 3, .5); fs(c, F);
    c.fillStyle = RED; c.fillRect(12, -42, 2.2, 2.2);
    c.lineWidth = 2; ln(c, 9, -26, 16, -22, s + 4, .3); ln(c, 16, -22, 18, -25, s + 5, .2);
  },
  parrot(c, F, D, s) {
    c.lineWidth = 2; ln(c, -14, -6, 14, -6, s, .3); ln(c, 0, -6, 0, 0, s + 1, .2);
    c.lineWidth = 2.2; poly(c, [[-4, -10], [-14, 2], [-9, 4], [-1, -8]], s + 2, .5); fs(c, F);
    ell(c, 2, -18, 7, 11, 0.25); fs(c, F);
    det(c, RED, () => { c.lineWidth = 2; ln(c, -1, -22, 4, -12, s + 3, .4); });
    head(c, F, s + 4, -31, 5.5);
    c.lineWidth = 1.8; c.beginPath(); c.moveTo(4, -33); c.quadraticCurveTo(12, -33, 9, -26); c.lineTo(5, -29); c.closePath(); fs(c, GOLD);
    c.fillStyle = D; c.fillRect(1, -33, 1.8, 1.8);
  },
  cannon(c, F, D, s) {
    c.lineWidth = 2.2; poly(c, [[-14, -3], [10, -3], [6, -12], [-12, -12]], s, .4); fs(c, F);
    c.lineWidth = 10; c.strokeStyle = K; ln(c, -13, -15, 18, -22, s + 1, .2); c.lineWidth = 6.5; c.strokeStyle = F; ln(c, -13, -15, 18, -22, s + 1, .2);
    c.strokeStyle = K; c.lineWidth = 2.2; circ(c, 19, -22, 4.2, s + 2, .3, 8); fs(c, F);
    circ(c, -6, -4, 6, s + 3, .4, 10); fs(c, F);
    for (const [x, y] of [[-20, -3], [-25, -3], [-22.5, -8]]) { c.lineWidth = 1.6; circ(c, x, y, 2.6, s + x, .2, 7); fs(c, K); }
  },
  captain(c, F, D, s) {
    legs(c, s); torso(c, F, s + 2, 11, 7, -4, -27);
    det(c, D, () => { c.lineWidth = 1.4; ln(c, 0, -26, 0, -6, s + 3, .3); });
    head(c, F, s + 4);
    c.fillStyle = D; ell(c, 2, -33, 2.2, 1.8); c.fill(); det(c, D, () => { c.lineWidth = 1; ln(c, -4, -36, 5, -31, s + 5, .1); });
    c.lineWidth = 2.2; poly(c, [[-11, -36], [-4, -43], [4, -43], [11, -36], [0, -38]], s + 6, .5); fs(c, F);
    det(c, GOLD, () => { c.lineWidth = 1.4; ln(c, -2, -40, 2, -40, s + 7, .1); });
    c.lineWidth = 2; ln(c, 7, -20, 12, -16, s + 8, .2); c.beginPath(); c.arc(13, -12, 3.5, -1.5, 2.2); c.stroke();
  },
  kraken(c, F, D, s) {
    for (const [x0, cx] of [[-14, -24], [14, 26], [-4, -10]]) thick(c, [[x0, -4], [cx + jt(s + x0, 2), -22], [x0 / 2 + jt(s + x0 + 1, 2), -30], [cx * .6, -42 + jt(s + x0 + 2, 2)]], s + x0, F, 5);
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(-12, -2); c.quadraticCurveTo(-12, -22, 0, -22); c.quadraticCurveTo(12, -22, 12, -2); c.closePath(); fs(c, F);
    c.fillStyle = PAPER; ell(c, 3, -13, 4, 3); c.fill(); c.stroke(); c.fillStyle = RED; c.fillRect(3, -14, 2, 2);
    det(c, BLUE, () => { c.lineWidth = 1.6; for (let k = 0; k < 3; k++) { c.beginPath(); for (let x = -22; x <= 22; x += 4) c.lineTo(x, -1 + k * 3 + Math.sin(x * .5 + k + INK.boil) * 1.2); c.stroke(); } });
  },
};
INK.ART = ART;

function drawPiece(c, t, side, x, y, sz, seed = 0, alpha = 1) {
  c.save(); c.globalAlpha *= alpha;
  c.translate(x, y + sz * 0.36);
  const k = sz / 62; c.scale(side === 'b' ? -k : k, k);
  c.strokeStyle = K; c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 2.4;
  if (t !== 'J' && t !== 'ghost') { c.fillStyle = 'rgba(30,28,36,0.13)'; ell(c, 0, 1, 15, 3.4); c.fill(); }
  ART[t](c, side === 'w' ? PAPER : K, side === 'w' ? K : PAPER, seed);
  c.restore();
}
INK.drawPiece = drawPiece;

// status badges drawn over a piece on the board
function drawBadges(c, p, x, y, cell) {
  const r = cell * 0.11; let bx = x + cell * 0.33, by = y - cell * 0.33;
  const next = () => { by += r * 2.3; };
  c.lineWidth = Math.max(1.2, cell / 45);
  if (p.fz > 0) { snowflake(c, bx, by, r * 1.3, p.id); next(); }
  if (p.ar > 0) { c.strokeStyle = K; poly(c, [[bx - r, by - r], [bx + r, by - r], [bx + r * .9, by + r * .3], [bx, by + r * 1.2], [bx - r * .9, by + r * .3]], p.id, .2); fs(c, '#d8d2c0'); badgeNum(c, bx, by, p.ar, K, r); next(); }
  if (p.bomb) { c.strokeStyle = K; circ(c, bx, by + r * .2, r * .85, p.id, .2, 8); fs(c, K); c.strokeStyle = RED; ln(c, bx + r * .5, by - r * .5, bx + r * 1.1, by - r * 1.1, p.id, .2); next(); }
  if (p.curse) { c.strokeStyle = GREEN; circ(c, bx, by, r * 1.05, p.id, .3, 8); fs(c, PAPER); badgeNum(c, bx, by, p.curse, GREEN, r); next(); }
  if (p.hatch) { c.strokeStyle = GOLD; circ(c, bx, by, r * 1.05, p.id, .3, 8); fs(c, PAPER); badgeNum(c, bx, by, p.hatch, '#8a6510', r); next(); }
  if (p.bounty) { c.fillStyle = '#8a6510'; c.font = `bold ${Math.round(r * 2.2)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('$', bx, by); next(); }
  if (p.reb) { c.strokeStyle = RED; c.lineWidth = Math.max(1.2, cell / 40); c.beginPath(); c.moveTo(bx - r, by + r); c.quadraticCurveTo(bx + r * .2, by, bx + r, by - r * 1.2); c.stroke(); ln(c, bx - r * .2, by + r * .2, bx + r * .4, by + r * .6, p.id, .1); next(); }
  if (p.sh > 0) { c.strokeStyle = K; c.lineWidth = 1.6; c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, cell * .45, 0, 7); c.stroke(); c.setLineDash([]); }
  c.strokeStyle = K;
}
function badgeNum(c, x, y, n, col, r) { c.fillStyle = col; c.font = `bold ${Math.round(r * 1.5)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), x, y + r * .1); }
INK.drawBadges = drawBadges;

function snowflake(c, x, y, r, s) {
  c.save(); c.strokeStyle = BLUE; c.lineWidth = Math.max(1.3, r / 8);
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI / 3;
    ln(c, x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r, s + k, r / 20);
    for (const g of [-1, 1]) { const bx = x + Math.cos(a) * r * .6 * g, by = y + Math.sin(a) * r * .6 * g; ln(c, bx, by, bx + Math.cos(a + 2.5 * g) * r * .3, by + Math.sin(a + 2.5 * g) * r * .3, s + k + 5, 0); ln(c, bx, by, bx + Math.cos(a - 2.5 * g) * r * .3, by + Math.sin(a - 2.5 * g) * r * .3, s + k + 9, 0); }
  }
  c.restore();
}
INK.snowflake = snowflake;

// terrain on a square (x,y = centre)
function drawTerrain(c, t, x, y, cell, sq, showMine) {
  const h = cell / 2;
  if (t.k === 'pit') {
    c.fillStyle = K; c.strokeStyle = K; c.lineWidth = 2;
    poly(c, [[x - h * .8, y - h * .5], [x - h * .2, y - h * .78], [x + h * .7, y - h * .6], [x + h * .82, y + h * .2], [x + h * .3, y + h * .75], [x - h * .6, y + h * .6], [x - h * .85, y + h * .05]], sq, 1.5); c.fill();
    c.strokeStyle = 'rgba(242,238,226,0.35)'; c.lineWidth = 1; for (let k = -h; k < h; k += 5) ln(c, x + k, y - h * .4, x + k + h * .4, y + h * .4, sq + k, .5);
  } else if (t.k === 'fire') {
    c.strokeStyle = RED; c.fillStyle = 'rgba(232,137,43,0.35)'; c.lineWidth = 1.8;
    for (let k = -1; k <= 1; k++) { const fx = x + k * h * .5, f = Math.sin(performance.now() / 120 + sq + k) * h * .08; poly(c, [[fx - h * .25, y + h * .6], [fx - h * .3 + f, y], [fx + f, y - h * .7 + Math.abs(k) * h * .2], [fx + h * .3 + f, y], [fx + h * .25, y + h * .6]], sq + k, 1); c.fill(); c.stroke(); }
  } else if (t.k === 'holy') {
    c.strokeStyle = GOLD; c.lineWidth = 1.6; c.setLineDash([3, 4]); c.beginPath(); c.arc(x, y, h * .82, 0, 7); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ln(c, x + Math.cos(a) * h * .85, y + Math.sin(a) * h * .85, x + Math.cos(a) * h * .97, y + Math.sin(a) * h * .97, sq + i, .2); }
  } else if (t.k === 'banana') {
    c.save(); c.translate(x, y + h * .35); c.rotate(-.3); c.strokeStyle = K; c.lineWidth = 1.4;
    for (const a of [-1.2, -.4, .5]) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a) * h * .5, Math.sin(a) * h * .25 - h * .2, Math.cos(a) * h * .55, Math.sin(a) * h * .3); c.lineTo(0, 0); c.fillStyle = '#f3d55b'; c.fill(); c.stroke(); }
    c.restore();
  } else if (t.k === 'rad') {
    c.fillStyle = 'rgba(111,143,58,0.18)'; c.fillRect(x - h + 2, y - h + 2, cell - 4, cell - 4);
    c.strokeStyle = 'rgba(111,143,58,0.6)'; c.lineWidth = 1; for (let k = -h; k < h; k += 6) ln(c, x + k, y + h - 3, x + k + h * .5, y - h + 3, sq + k, .6);
    trefoil(c, x - h * .55, y - h * .55, h * .22, '#6f8f3a');
  } else if (t.k === 'mine' && showMine) {
    c.strokeStyle = K; c.lineWidth = 1.4; const r = h * .22, my = y + h * .5;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ln(c, x + Math.cos(a) * r, my + Math.sin(a) * r * .5, x + Math.cos(a) * r * 1.5, my + Math.sin(a) * r * .75, sq + i, .2); }
    c.beginPath(); c.ellipse(x, my, r, r * .55, 0, 0, 7); fs(c, t.s === 'w' ? '#cfc8b4' : K);
    c.fillStyle = RED; c.fillRect(x - 1.5, my - r * .55 - 2, 3, 3);
  }
}
INK.drawTerrain = drawTerrain;
function trefoil(c, x, y, r, col) {
  c.save(); c.fillStyle = col;
  for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * Math.PI * 2 / 3; c.beginPath(); c.moveTo(x + Math.cos(a - .5) * r * .35, y + Math.sin(a - .5) * r * .35); c.arc(x, y, r, a - .5, a + .5); c.lineTo(x + Math.cos(a + .5) * r * .35, y + Math.sin(a + .5) * r * .35); c.closePath(); c.fill(); }
  c.beginPath(); c.arc(x, y, r * .22, 0, 7); c.fill(); c.restore();
}
INK.trefoil = trefoil;
// the bomb itself: centred at x,y, pointing along `rot`, `len` long. colours chosen by caller.
function drawNukeBomb(c, x, y, len, rot, line = K, body = '#3b3a42', seed = 1) {
  c.save(); c.translate(x, y); c.rotate(rot); const L = len, R = len * .2;
  c.strokeStyle = line; c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = Math.max(2, len / 40);
  // fins
  for (const sgn of [-1, 1]) { poly(c, [[-L * .38, sgn * R * .5], [-L * .58, sgn * R * 1.5], [-L * .5, sgn * R * 1.6], [-L * .22, sgn * R * .7]], seed + sgn, len / 120); fs(c, body); }
  poly(c, [[-L * .52, -R * .2], [-L * .6, -R * .2], [-L * .6, R * .2], [-L * .52, R * .2]], seed + 4, len / 160); fs(c, body);
  // body
  c.beginPath(); c.moveTo(-L * .45, -R * .7); c.lineTo(L * .2, -R); c.quadraticCurveTo(L * .52, -R * .9, L * .5, 0); c.quadraticCurveTo(L * .52, R * .9, L * .2, R); c.lineTo(-L * .45, R * .7); c.closePath(); fs(c, body);
  c.fillStyle = GOLD; c.fillRect(-L * .06, -R * .97, L * .1, R * 1.94); c.strokeRect(-L * .06, -R * .97, L * .1, R * 1.94);
  trefoil(c, L * .26, 0, R * .55, GOLD);
  c.lineWidth = Math.max(1, len / 90); ln(c, -L * .3, -R * .55, L * .1, -R * .8, seed + 9, len / 200);
  c.restore();
}
INK.drawNukeBomb = drawNukeBomb;

// ===================================================================== card illustrations (120 x 84 box)
function coinStack(c, x, y, n, s) {
  c.lineWidth = 2;
  for (let i = 0; i < n; i++) { const cx = x + (hash(s + i) - .5) * 30, cy = y - i * 5 + (i > n / 2 ? -6 : 0); ell(c, cx, cy, 13, 5); fs(c, GOLD); }
  ell(c, x + 26, y - 6, 9, 9); fs(c, GOLD); ln(c, x + 25, y - 10, x + 25, y - 2, s + 30, .3);
}
const P = (c, t, x, y, sz, side = 'w', s = 3) => drawPiece(c, t, side, x, y, sz, s);
function arrow(c, x1, y1, x2, y2, s = 1) { c.lineWidth = 2; ln(c, x1, y1, x2, y2, s, .3); const a = Math.atan2(y2 - y1, x2 - x1); ln(c, x2, y2, x2 - Math.cos(a - .5) * 7, y2 - Math.sin(a - .5) * 7, s + 1, .1); ln(c, x2, y2, x2 - Math.cos(a + .5) * 7, y2 - Math.sin(a + .5) * 7, s + 2, .1); }
function flames(c, x, y, w, h, s) { c.strokeStyle = RED; c.fillStyle = ORANGE; c.lineWidth = 1.8; for (let k = 0; k < 3; k++) { const fx = x - w / 2 + (k + .5) * w / 3; poly(c, [[fx - w / 7, y], [fx - w / 9, y - h * .5], [fx, y - h * (k === 1 ? 1 : .75)], [fx + w / 9, y - h * .5], [fx + w / 7, y]], s + k, 1); c.fill(); c.stroke(); } c.strokeStyle = K; }
function miniCard(c, x, y, rot, s) { c.save(); c.translate(x, y); c.rotate(rot); c.lineWidth = 2; poly(c, [[-11, -16], [11, -16], [11, 16], [-11, 16]], s, .4); fs(c, PAPER); c.lineWidth = 1.2; ln(c, -6, -8, 6, -8, s + 1, .3); ln(c, -6, -2, 4, -2, s + 2, .3); c.restore(); }
function hand(c, x, y, s) { c.lineWidth = 2; poly(c, [[x - 10, y + 12], [x - 12, y - 2], [x - 8, y - 4], [x - 6, y - 14], [x - 2, y - 15], [x - 1, y - 6], [x + 2, y - 15], [x + 6, y - 14], [x + 5, y - 4], [x + 10, y - 8], [x + 12, y - 4], [x + 6, y + 12]], s, .5); fs(c, PAPER); }

const SPELL_ART = {
  freeze: (c, w, h) => snowflake(c, w / 2, h / 2, h * .36, 3),
  shield: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.6; poly(c, [[x - 22, y - 26], [x + 22, y - 26], [x + 20, y + 4], [x, y + 28], [x - 20, y + 4]], 5, .8); fs(c, PAPER); c.lineWidth = 2; ln(c, x, y - 20, x, y + 18, 6, .5); ln(c, x - 15, y - 6, x + 15, y - 6, 7, .5); c.setLineDash([3, 4]); c.beginPath(); c.arc(x, y, 38, 0, 7); c.stroke(); c.setLineDash([]); },
  pit: (c, w, h) => { drawTerrain(c, { k: 'pit' }, w / 2, h / 2 + 8, 70, 3); c.lineWidth = 2.4; ln(c, w / 2 + 26, h / 2 - 30, w / 2 + 40, h / 2 + 8, 4, .4); poly(c, [[w / 2 + 36, h / 2 + 4], [w / 2 + 46, h / 2 + 2], [w / 2 + 44, h / 2 + 14], [w / 2 + 38, h / 2 + 14]], 5, .4); fs(c, PAPER); },
  truce: (c, w, h) => { const x = w / 2 - 14; c.lineWidth = 2.4; ln(c, x, h - 6, x, 8, 1, .3); c.beginPath(); c.moveTo(x, 10); for (let i = 1; i <= 6; i++) c.lineTo(x + i * 7, 10 + Math.sin(i) * 3); for (let i = 6; i >= 0; i--) c.lineTo(x + i * 7, 36 + Math.sin(i) * 3); c.closePath(); fs(c, PAPER); },
  pickpocket: (c, w, h) => { coinStack(c, w / 2 - 12, h / 2 + 18, 2, 4); hand(c, w / 2 + 22, h / 2 - 8, 6); },
  shuffle: (c, w, h) => { P(c, 'N', w / 2 - 28, h / 2, 40); P(c, 'B', w / 2 + 28, h / 2, 40); c.beginPath(); c.arc(w / 2, h / 2 - 6, 18, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.beginPath(); c.arc(w / 2, h / 2 + 4, 18, Math.PI * .1, Math.PI * .9); c.stroke(); },
  pouch: (c, w, h) => coinStack(c, w / 2 - 6, h / 2 + 14, 3, 1),
  purse: (c, w, h) => coinStack(c, w / 2 - 6, h / 2 + 18, 5, 2),
  chest: (c, w, h) => { const x = w / 2, y = h / 2 + 18; c.lineWidth = 2.4; coinStack(c, x - 4, y - 26, 3, 9); poly(c, [[x - 28, y], [x + 28, y], [x + 28, y - 24], [x - 28, y - 24]], 3, .6); fs(c, PAPER); c.lineWidth = 1.6; for (let k = -18; k <= 18; k += 12) ln(c, x + k, y - 22, x + k, y - 2, 5 + k, .3); c.lineWidth = 2; poly(c, [[x - 4, y - 16], [x + 4, y - 16], [x + 4, y - 8], [x - 4, y - 8]], 6, .3); fs(c, GOLD); },
  levy: (c, w, h) => { P(c, 'P', w / 2 - 16, h / 2 - 4, 46, 'w', 1); P(c, 'P', w / 2 + 16, h / 2 - 2, 46, 'w', 2); c.lineWidth = 2; ln(c, w / 2 + 36, h / 2 - 30, w / 2 + 36, h / 2 - 16, 3, .3); ln(c, w / 2 + 29, h / 2 - 23, w / 2 + 43, h / 2 - 23, 4, .3); },
  knighted: (c, w, h) => { P(c, 'P', w / 2 - 28, h / 2 - 2, 44); P(c, 'N', w / 2 + 28, h / 2 - 2, 48); arrow(c, w / 2 - 10, h / 2, w / 2 + 8, h / 2); },
  armor: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.4; poly(c, [[x - 20, y - 24], [x - 8, y - 18], [x + 8, y - 18], [x + 20, y - 24], [x + 22, y - 6], [x + 14, y + 24], [x - 14, y + 24], [x - 22, y - 6]], 3, .7); fs(c, '#d8d2c0'); c.lineWidth = 1.6; ln(c, x, y - 16, x, y + 20, 4, .4); ln(c, x - 14, y + 4, x + 14, y + 4, 5, .4); c.fillStyle = K; for (const [a, b] of [[-15, -14], [15, -14], [-10, 18], [10, 18]]) c.fillRect(x + a - 1, y + b - 1, 2.4, 2.4); },
  bombvest: (c, w, h) => { P(c, 'P', w / 2 - 18, h / 2, 50); const x = w / 2 + 20, y = h / 2 + 10; c.lineWidth = 2.2; circ(c, x, y, 13, 3, .6, 12); fs(c, K); c.lineWidth = 2; c.beginPath(); c.moveTo(x + 6, y - 11); c.quadraticCurveTo(x + 12, y - 22, x + 20, y - 20); c.stroke(); c.strokeStyle = RED; for (let k = 0; k < 6; k++) { const a = k; ln(c, x + 21, y - 21, x + 21 + Math.cos(a) * 6, y - 21 + Math.sin(a) * 6, k, .3); } c.strokeStyle = K; },
  curse: (c, w, h) => { const x = w / 2, y = h / 2 - 4; c.strokeStyle = GREEN; c.lineWidth = 1.4; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(x - 30 + i * 12, y + 26 - (i % 2) * 6, 3 + (i % 3), 0, 7); c.stroke(); } c.strokeStyle = K; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 16, y); c.bezierCurveTo(x - 18, y - 26, x + 18, y - 26, x + 16, y); c.lineTo(x + 10, y + 6); c.lineTo(x + 10, y + 16); c.lineTo(x - 10, y + 16); c.lineTo(x - 10, y + 6); c.closePath(); fs(c, PAPER); c.fillStyle = K; ell(c, x - 6, y - 4, 4, 5); c.fill(); ell(c, x + 6, y - 4, 4, 5); c.fill(); c.lineWidth = 1.4; for (let k = -6; k <= 6; k += 4) ln(c, x + k, y + 9, x + k, y + 15, k, .1); },
  mine: (c, w, h) => { drawTerrain(c, { k: 'mine', s: 'w' }, w / 2, h / 2 - 18, 110, 7, true); c.strokeStyle = 'rgba(30,28,36,.4)'; c.lineWidth = 1.2; for (let k = 0; k < 4; k++) ln(c, w / 2 - 40 + k * 22, h / 2 + 32, w / 2 - 28 + k * 22, h / 2 + 32, k, .4); },
  firewall: (c, w, h) => { flames(c, w / 2, h / 2 + 26, 90, 50, 3); },
  sketch: (c, w, h) => { miniCard(c, w / 2 - 14, h / 2 + 2, -.25, 1); miniCard(c, w / 2 + 6, h / 2, .15, 2); c.lineWidth = 3; ln(c, w / 2 + 14, h / 2 + 22, w / 2 + 38, h / 2 - 20, 3, .3); c.lineWidth = 1.6; poly(c, [[w / 2 + 12, h / 2 + 26], [w / 2 + 14, h / 2 + 20], [w / 2 + 17, h / 2 + 22]], 4, .1); fs(c, K); },
  spill: (c, w, h) => { const x = w / 2, y = h / 2 + 6; c.fillStyle = K; c.beginPath(); for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, r = 16 + hash(i) * 14; c.lineTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * .7); } c.fill(); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x - 40 + hash(i + 9) * 80, y - 20 + hash(i + 3) * 40, 2 + hash(i) * 3, 0, 7); c.fill(); } miniCard(c, x + 30, y - 20, .4, 6); },
  backpedal: (c, w, h) => { P(c, 'P', w / 2 - 6, h / 2 - 8, 50); c.setLineDash([3, 3]); arrow(c, w / 2 + 24, h / 2 - 22, w / 2 + 24, h / 2 + 20); c.setLineDash([]); },
  fireball: (c, w, h) => { const x = w / 2, y = h / 2 + 4; c.strokeStyle = RED; c.lineWidth = 2.2; for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .45; ln(c, x + Math.cos(a) * 14, y + Math.sin(a) * 14, x + Math.cos(a) * (28 + hash(i) * 10), y + Math.sin(a) * (28 + hash(i) * 10) - 6, i, 1.5); } c.strokeStyle = K; c.lineWidth = 2.4; circ(c, x, y, 15, 9, 1.2, 12); fs(c, ORANGE); },
  teleport: (c, w, h) => { const y = h / 2 + 6; c.lineWidth = 2; for (const x of [w / 2 - 30, w / 2 + 30]) for (let k = 1; k <= 3; k++) { ell(c, x, y + 8, 6 * k, 2.5 * k); c.stroke(); } P(c, 'P', w / 2 - 30, y - 14, 40); c.setLineDash([3, 4]); c.beginPath(); c.moveTo(w / 2 - 22, y - 26); c.quadraticCurveTo(w / 2, y - 48, w / 2 + 24, y - 20); c.stroke(); c.setLineDash([]); },
  polymorph: (c, w, h) => { P(c, 'R', w / 2 - 28, h / 2, 46, 'b'); arrow(c, w / 2 - 8, h / 2, w / 2 + 8, h / 2); P(c, 'chicken', w / 2 + 30, h / 2, 46, 'b'); },
  resurrect: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 18, y + 26); c.lineTo(x - 18, y - 10); c.arc(x, y - 10, 18, Math.PI, 0); c.lineTo(x + 18, y + 26); fs(c, PAPER); c.lineWidth = 2; ln(c, x, y - 18, x, y + 6, 1, .3); ln(c, x - 8, y - 10, x + 8, y - 10, 2, .3); c.lineWidth = 1.4; ln(c, x - 40, y + 26, x + 40, y + 26, 3, .4); hand(c, x + 32, y + 12, 7); },
  sanctuary: (c, w, h) => { drawTerrain(c, { k: 'holy' }, w / 2, h / 2, 76, 3); P(c, 'B', w / 2, h / 2, 50); },
  thief: (c, w, h) => { miniCard(c, w / 2 - 10, h / 2, -.2, 3); hand(c, w / 2 + 16, h / 2 + 8, 5); },
  rewind: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.4; circ(c, x, y, 26, 3, .8, 16); fs(c, PAPER); c.lineWidth = 2; ln(c, x, y, x, y - 18, 4, .2); ln(c, x, y, x - 12, y + 4, 5, .2); c.strokeStyle = RED; c.beginPath(); c.arc(x, y, 34, -2.6, 0.6); c.stroke(); ln(c, x + 34 * Math.cos(-2.6), y + 34 * Math.sin(-2.6), x + 34 * Math.cos(-2.6) + 8, y + 34 * Math.sin(-2.6) - 4, 6, .1); c.strokeStyle = K; },
  knightmare: (c, w, h) => { c.save(); c.globalAlpha = .35; P(c, 'N', w / 2 + 8, h / 2 - 2, 64, 'b'); c.restore(); P(c, 'P', w / 2 - 10, h / 2 + 2, 50); },
  mirror: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.6; ell(c, x, y, 20, 32); fs(c, '#e2e6ee'); c.lineWidth = 1.2; ln(c, x - 8, y - 18, x + 4, y - 26, 1, .2); ln(c, x - 12, y - 6, x + 6, y - 22, 2, .2); P(c, 'K', x - 42, y + 2, 40); c.save(); c.translate(x + 42, 0); c.scale(-1, 1); c.globalAlpha = .6; P(c, 'K', 0, y + 2, 40); c.restore(); },
  earthquake: (c, w, h) => { c.lineWidth = 2.4; poly(c, [[6, h / 2 + 8], [30, h / 2 + 10], [44, h / 2 + 2], [60, h / 2 + 16], [74, h / 2 + 6], [90, h / 2 + 14], [114, h / 2 + 10]], 1, 1, false); c.stroke(); c.lineWidth = 3; poly(c, [[40, h / 2 + 4], [52, h / 2 + 20], [58, h / 2 + 28], [70, h / 2 + 40]], 2, .5, false); c.stroke(); P(c, 'P', 34, h / 2 - 10, 36); P(c, 'R', 86, h / 2 - 12, 40); c.lineWidth = 1.2; for (const x of [20, 54, 100]) { ln(c, x, h / 2 - 32, x - 4, h / 2 - 24, x, .3); ln(c, x + 4, h / 2 - 32, x + 8, h / 2 - 24, x + 1, .3); } },
  lightning: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.4; poly(c, [[x + 4, y - 34], [x - 14, y + 2], [x - 2, y + 2], [x - 8, y + 34], [x + 14, y - 6], [x + 2, y - 6], [x + 10, y - 34]], 3, .8); fs(c, GOLD); },
  decree: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.2; poly(c, [[x - 26, y - 14], [x + 26, y - 14], [x + 22, y + 26], [x - 30, y + 26]], 1, .8); fs(c, PAPER); c.lineWidth = 1.3; for (let k = 0; k < 4; k++) ln(c, x - 20, y - 4 + k * 7, x + 16 - (k === 3 ? 18 : 0), y - 4 + k * 7, k + 3, .4); c.lineWidth = 2; poly(c, [[x - 14, y - 16], [x - 16, y - 34], [x - 7, y - 25], [x, y - 38], [x + 7, y - 25], [x + 16, y - 34], [x + 14, y - 16]], 9, .5); fs(c, GOLD); circ(c, x + 18, y + 24, 6, 10, .5, 9); fs(c, RED); },
  doubletime: (c, w, h) => { for (const [x, s] of [[w / 2 - 20, 1], [w / 2 + 20, 2]]) { const y = h / 2; c.lineWidth = 2.2; ln(c, x - 14, y - 26, x + 14, y - 26, s, .3); ln(c, x - 14, y + 26, x + 14, y + 26, s + 1, .3); c.beginPath(); c.moveTo(x - 11, y - 26); c.quadraticCurveTo(x - 10, y - 4, x, y); c.quadraticCurveTo(x - 10, y + 4, x - 11, y + 26); c.lineTo(x + 11, y + 26); c.quadraticCurveTo(x + 10, y + 4, x, y); c.quadraticCurveTo(x + 10, y - 4, x + 11, y - 26); c.closePath(); fs(c, PAPER); c.fillStyle = GOLD; c.beginPath(); c.moveTo(x - 8, y + 24); c.lineTo(x + 8, y + 24); c.lineTo(x, y + 12); c.fill(); } },
  mindcontrol: (c, w, h) => { const x = w / 2, y = h / 2; c.strokeStyle = BLUE; c.lineWidth = 2; c.beginPath(); for (let a = 0; a < 18; a += .2) c.lineTo(x + Math.cos(a) * a * 2, y + Math.sin(a) * a * 1.3); c.stroke(); c.strokeStyle = K; c.lineWidth = 2.2; ell(c, x, y, 14, 9); fs(c, PAPER); c.fillStyle = K; ell(c, x, y, 5, 5); c.fill(); },
  clone: (c, w, h) => { P(c, 'N', w / 2 - 22, h / 2, 50); c.save(); c.setLineDash([3, 3]); c.globalAlpha = .7; P(c, 'N', w / 2 + 22, h / 2, 50); c.restore(); },
  ouroboros: (c, w, h) => { c.save(); c.translate(w / 2, h / 2 + 22); c.scale(1.5, 1.5); ART.serpent(c, PAPER, K, 4); c.restore(); },
  swaphands: (c, w, h) => { miniCard(c, w / 2 - 26, h / 2, -.2, 1); miniCard(c, w / 2 + 26, h / 2, .2, 2); arrow(c, w / 2 - 10, h / 2 - 16, w / 2 + 10, h / 2 - 16, 3); arrow(c, w / 2 + 10, h / 2 + 16, w / 2 - 10, h / 2 + 16, 4); },
  meteor: (c, w, h) => { const x = w / 2 + 10, y = h / 2 - 2; c.lineWidth = 1.6; for (let i = 0; i < 5; i++) ln(c, x - 12 - i * 3, y - 12 + i * 5, x - 50 - i * 2, y - 36 + i * 4, i, 1); c.strokeStyle = RED; for (let i = 0; i < 3; i++) ln(c, x - 14, y - 6 + i * 5, x - 30, y - 16 + i * 6, i + 9, 1); c.strokeStyle = K; c.lineWidth = 2.4; circ(c, x, y, 15, 4, 2, 11); fs(c, K); c.lineWidth = 1.6; ln(c, x - 40, y + 30, x + 34, y + 30, 6, .5); },
  banana: (c, w, h) => { drawTerrain(c, { k: 'banana' }, w / 2, h / 2 - 8, 90, 3); c.lineWidth = 1.2; c.strokeStyle = 'rgba(30,28,36,.4)'; ln(c, w / 2 - 40, h / 2 + 30, w / 2 + 40, h / 2 + 30, 4, .4); c.strokeStyle = K; P(c, 'P', w / 2 + 34, h / 2, 34); c.lineWidth = 1.4; ln(c, w / 2 + 22, h / 2 - 22, w / 2 + 16, h / 2 - 28, 5, .3); ln(c, w / 2 + 46, h / 2 - 22, w / 2 + 52, h / 2 - 28, 6, .3); },
  tax: (c, w, h) => { const x = w / 2 - 14, y = h / 2; c.lineWidth = 2.2; poly(c, [[x - 20, y - 30], [x + 20, y - 30], [x + 20, y + 30], [x - 20, y + 30]], 1, .6); fs(c, PAPER); c.lineWidth = 1.2; for (let k = 0; k < 5; k++) ln(c, x - 14, y - 20 + k * 8, x + 12 - (k % 2) * 8, y - 20 + k * 8, k, .3); c.save(); c.translate(x + 6, y + 14); c.rotate(-.3); c.strokeStyle = RED; c.lineWidth = 2; c.strokeRect(-14, -8, 28, 14); c.fillStyle = RED; c.font = "bold 11px 'Permanent Marker', sans-serif"; c.textAlign = 'center'; c.fillText('TAX', 0, 4); c.restore(); coinStack(c, w / 2 + 30, h / 2 + 26, 3, 7); },
  coinflip: (c, w, h) => { const x = w / 2, y = h / 2 - 4; c.lineWidth = 2.4; ell(c, x, y, 20, 13, -.2); fs(c, GOLD); c.fillStyle = K; c.font = "bold 18px 'Permanent Marker', sans-serif"; c.textAlign = 'center'; c.fillText('?', x, y + 6); c.lineWidth = 1.6; c.beginPath(); c.arc(x, y + 6, 32, 2.2, 3.4); c.stroke(); c.beginPath(); c.arc(x, y + 6, 32, -.3, .9); c.stroke(); for (const sx of [-1, 1]) ln(c, x + sx * 30, y + 30, x + sx * 30, y + 36, sx, .2); },
  execute: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.6; ln(c, x - 20, y + 36, x - 20, y - 36, 1, .3); ln(c, x + 20, y + 36, x + 20, y - 36, 2, .3); ln(c, x - 26, y - 36, x + 26, y - 36, 3, .3); c.lineWidth = 2.2; poly(c, [[x - 18, y - 24], [x + 18, y - 32], [x + 18, y - 18], [x - 18, y - 12]], 4, .4); fs(c, '#cfd4da'); ln(c, x, y - 36, x, y - 30, 5, .1); c.lineWidth = 2.4; poly(c, [[x - 22, y + 18], [x + 22, y + 18], [x + 22, y + 28], [x - 22, y + 28]], 6, .4); fs(c, PAPER); c.beginPath(); c.arc(x, y + 18, 7, Math.PI, 0); c.stroke(); P(c, 'R', x + 40, y + 12, 34, 'b'); },
  party: (c, w, h) => { P(c, 'chicken', w / 2 - 20, h / 2 + 4, 44); P(c, 'duck', w / 2 + 22, h / 2 + 6, 40); c.lineWidth = 2; poly(c, [[w / 2 - 28, h / 2 - 18], [w / 2 - 14, h / 2 - 18], [w / 2 - 21, h / 2 - 38]], 1, .3); fs(c, RED); const cols = [RED, BLUE, GOLD, '#6f8f3a']; for (let i = 0; i < 14; i++) { c.fillStyle = cols[i % 4]; c.save(); c.translate(hash(i) * w, hash(i + 9) * h * .5); c.rotate(i); c.fillRect(-2, -1, 4, 2.5); c.restore(); } },
  nuke: (c, w, h) => { drawNukeBomb(c, w / 2, h / 2, w * .62, -.5, K, '#3b3a42', 3); c.strokeStyle = 'rgba(30,28,36,.35)'; c.lineWidth = 1.2; for (let k = 0; k < 4; k++) ln(c, w / 2 - 50 - k * 4, h / 2 - 10 + k * 8, w / 2 - 34 - k * 4, h / 2 - 18 + k * 8, k, .3); c.strokeStyle = K; },
  hymn: (c, w, h) => { P(c, 'P', w / 2 - 22, h / 2 + 4, 44); P(c, 'P', w / 2 + 4, h / 2 + 4, 44); c.lineWidth = 2; for (const [x, y] of [[w / 2 + 28, h / 2 - 18], [w / 2 + 42, h / 2 - 24]]) { ell(c, x, y + 12, 4, 3); fs(c, K); ln(c, x + 4, y + 12, x + 4, y - 6, x, .2); } ln(c, w / 2 + 32, h / 2 - 24, w / 2 + 46, h / 2 - 30, 7, .2); },
  crate: (c, w, h) => { const x = w / 2, y = h / 2 + 4; c.lineWidth = 2.4; poly(c, [[x - 22, y - 20], [x + 22, y - 20], [x + 22, y + 22], [x - 22, y + 22]], 1, .6); fs(c, '#d8c9a0'); c.lineWidth = 1.6; ln(c, x - 22, y - 20, x + 22, y + 22, 2, .4); ln(c, x + 22, y - 20, x - 22, y + 22, 3, .4); c.lineWidth = 1.4; ln(c, x, y - 20, x - 10, y - 38, 4, .3); ln(c, x, y - 20, x + 10, y - 38, 5, .3); c.beginPath(); c.arc(x, y - 38, 14, Math.PI, 0); fs(c, PAPER); },
  repairs: (c, w, h) => { SPELL_ART.armor(c, w - 20, h); const x = w / 2 + 24, y = h / 2; c.lineWidth = 4; ln(c, x - 8, y + 18, x + 8, y - 10, 1, .2); c.lineWidth = 2.2; c.beginPath(); c.arc(x + 10, y - 14, 6, 0.6, 5.2); c.stroke(); },
  droppod: (c, w, h) => { const x = w / 2, y = h / 2 - 2; flames(c, x, y + 38, 30, 16, 5); c.lineWidth = 2.4; poly(c, [[x - 14, y + 20], [x + 14, y + 20], [x + 10, y - 16], [x, y - 28], [x - 10, y - 16]], 3, .5); fs(c, PAPER); c.lineWidth = 1.6; ln(c, x - 12, y + 6, x + 12, y + 6, 4, .3); c.lineWidth = 1.2; for (let k = -1; k <= 1; k++) ln(c, x + k * 30, y - 40, x + k * 30, y - 22, k, .4); },
  orbital: (c, w, h) => { const x = w / 2, y = h / 2 + 10; c.fillStyle = 'rgba(179,50,43,0.18)'; c.fillRect(x - 10, 0, 20, y); c.strokeStyle = RED; c.lineWidth = 2; ln(c, x - 10, 0, x - 10, y, 1, .5); ln(c, x + 10, 0, x + 10, y, 2, .5); c.strokeStyle = K; c.lineWidth = 2; circ(c, x, y, 16, 3, .5, 12); c.stroke(); ln(c, x - 26, y, x - 8, y, 4, .2); ln(c, x + 8, y, x + 26, y, 5, .2); ln(c, x, y + 8, x, y + 24, 6, .2); },
  poker: (c, w, h) => { miniCard(c, w / 2 - 20, h / 2 - 4, -.3, 1); miniCard(c, w / 2 - 4, h / 2 - 8, .1, 2); coinStack(c, w / 2 + 18, h / 2 + 26, 3, 3); },
  wanted: (c, w, h) => { const x = w / 2, y = h / 2; c.lineWidth = 2.2; poly(c, [[x - 24, y - 34], [x + 24, y - 32], [x + 22, y + 34], [x - 26, y + 32]], 1, .8); fs(c, '#efe2bf'); c.fillStyle = K; c.font = "bold 11px 'Permanent Marker', sans-serif"; c.textAlign = 'center'; c.fillText('WANTED', x, y - 20); P(c, 'R', x, y + 6, 34, 'b'); c.fillStyle = '#8a6510'; c.fillText('$$$', x, y + 30); },
  lasso: (c, w, h) => { c.lineWidth = 2.2; ell(c, w / 2 + 16, h / 2 - 6, 22, 12, -.2); c.stroke(); c.beginPath(); c.moveTo(w / 2 - 4, h / 2 + 2); c.bezierCurveTo(w / 2 - 20, h / 2 + 30, w / 2 - 40, h / 2 - 10, w / 2 - 52, h / 2 + 30); c.stroke(); P(c, 'B', w / 2 + 16, h / 2 + 6, 40, 'b'); },
  goldrush: (c, w, h) => { const x = w / 2; c.lineWidth = 3; ln(c, x - 30, h / 2 + 28, x + 10, h / 2 - 20, 1, .3); c.lineWidth = 2.4; c.beginPath(); c.moveTo(x - 6, h / 2 - 30); c.quadraticCurveTo(x + 14, h / 2 - 26, x + 26, h / 2 - 8); c.stroke(); for (const [a, b, r] of [[20, 24, 7], [30, 18, 5], [12, 28, 4]]) { c.lineWidth = 1.8; poly(c, [[x + a - r, h / 2 + b], [x + a - r / 2, h / 2 + b - r], [x + a + r, h / 2 + b - r / 2], [x + a + r / 2, h / 2 + b + r / 2]], a, .6); fs(c, GOLD); } },
  stagecoach: (c, w, h) => { const x = w / 2, y = h / 2 + 18; c.lineWidth = 2.2; for (const wx of [-20, 20]) { circ(c, x + wx, y, 12, wx, .5, 12); fs(c, PAPER); for (let a = 0; a < 3; a++) ln(c, x + wx + Math.cos(a) * 11, y + Math.sin(a) * 11, x + wx - Math.cos(a) * 11, y - Math.sin(a) * 11, wx + a, .2); } poly(c, [[x - 30, y - 8], [x + 30, y - 8], [x + 26, y - 38], [x - 26, y - 38]], 3, .6); fs(c, PAPER); coinStack(c, x - 4, y - 42, 2, 5); },
  goo: (c, w, h) => { const x = w / 2, y = h / 2 + 8; c.fillStyle = 'rgba(111,143,58,0.45)'; c.strokeStyle = GREEN; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, r = 22 + hash(i + 3) * 10; c.lineTo(x + Math.cos(a) * r * 1.5, y + Math.sin(a) * r * .6); } c.closePath(); c.fill(); c.stroke(); for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(x - 30 + i * 15, y - 16 - hash(i) * 20, 3 + hash(i + 1) * 4, 0, 7); c.stroke(); } c.strokeStyle = K; },
  mutate: (c, w, h) => { P(c, 'P', w / 2 - 16, h / 2, 54); c.fillStyle = GREEN; c.font = "bold 34px 'Permanent Marker', sans-serif"; c.textAlign = 'center'; c.fillText('?', w / 2 + 24, h / 2 + 14); },
  stomp: (c, w, h) => { const x = w / 2, y = h / 2 + 4; c.lineWidth = 2.4; c.beginPath(); c.ellipse(x, y + 6, 20, 26, 0, 0, 7); fs(c, K); for (const [a, b] of [[-18, -26], [-4, -32], [10, -30], [22, -22]]) { ell(c, x + a, y + b, 5, 7); fs(c, K); } c.lineWidth = 1.4; for (const a of [-40, 40]) ln(c, x + a, y + 20, x + a * 1.3, y + 26, a, .4); },
  siren: (c, w, h) => { const x = w / 2 - 20, y = h / 2; c.lineWidth = 2.4; poly(c, [[x - 10, y + 24], [x + 10, y + 24], [x + 8, y - 10], [x - 8, y - 10]], 1, .4); fs(c, PAPER); c.beginPath(); c.arc(x, y - 10, 10, Math.PI, 0); fs(c, RED); c.lineWidth = 2; for (let k = 1; k <= 3; k++) { c.beginPath(); c.arc(x, y - 10, 14 + k * 9, -0.7, 0.4); c.stroke(); } snowflake(c, x + 50, y + 14, 12, 3); },
  bottle: (c, w, h) => { const x = w / 2, y = h / 2 + 6; c.save(); c.translate(x, y); c.rotate(-.5); c.lineWidth = 2.4; c.beginPath(); c.moveTo(-26, -10); c.lineTo(14, -10); c.lineTo(22, -5); c.lineTo(32, -5); c.lineTo(32, 5); c.lineTo(22, 5); c.lineTo(14, 10); c.lineTo(-26, 10); c.closePath(); fs(c, '#dfe6d2'); c.lineWidth = 1.8; poly(c, [[-18, -5], [6, -5], [6, 5], [-18, 5]], 2, .4); fs(c, '#efe2bf'); c.restore(); c.strokeStyle = BLUE; c.lineWidth = 1.6; for (let k = 0; k < 2; k++) { c.beginPath(); for (let i = 0; i <= 12; i++) c.lineTo(i * 10, y + 22 + k * 6 + Math.sin(i + k) * 2); c.stroke(); } c.strokeStyle = K; },
  plank: (c, w, h) => { const y = h / 2; c.lineWidth = 2.4; poly(c, [[8, y - 4], [70, y - 4], [70, y + 4], [8, y + 4]], 1, .5); fs(c, '#d8c9a0'); P(c, 'P', 62, y - 22, 34, 'b'); arrow(c, 84, y - 20, 96, y + 16, 4); c.strokeStyle = BLUE; c.lineWidth = 1.6; for (let k = 0; k < 2; k++) { c.beginPath(); for (let i = 0; i <= 12; i++) c.lineTo(i * 10, y + 28 + k * 6 + Math.sin(i + k) * 2); c.stroke(); } c.strokeStyle = K; },
  mutiny: (c, w, h) => { const x = w / 2 - 24; c.lineWidth = 2.4; ln(c, x, h - 6, x, 8, 1, .3); c.beginPath(); c.moveTo(x, 10); for (let i = 1; i <= 6; i++) c.lineTo(x + i * 8, 10 + Math.sin(i) * 3); for (let i = 6; i >= 0; i--) c.lineTo(x + i * 8, 42 + Math.sin(i) * 3); c.closePath(); fs(c, K); c.strokeStyle = PAPER; c.lineWidth = 2; circ(c, x + 24, 22, 6, 3, .3, 9); c.stroke(); ln(c, x + 14, 32, x + 34, 38, 4, .2); ln(c, x + 34, 32, x + 14, 38, 5, .2); c.strokeStyle = K; },
  treasure: (c, w, h) => { SPELL_ART.chest(c, w, h); c.strokeStyle = RED; c.lineWidth = 3; ln(c, 10, 10, 26, 26, 1, .3); ln(c, 26, 10, 10, 26, 2, .3); c.strokeStyle = K; },
};
INK.SPELL_ART = SPELL_ART;

function hiDPI(cv, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = K;
  return c;
}
INK.hiDPI = hiDPI;
function drawCardArt(cv, key, w = 112, h = 78) {
  const c = hiDPI(cv, w, h), card = INK.CARDS[key];
  const saved = INK.boil; INK.boil = 0;
  if (card.rarity === 'legendary' || card.rarity === 'epic') {
    c.strokeStyle = card.rarity === 'legendary' ? 'rgba(201,154,28,0.55)' : 'rgba(179,50,43,0.35)'; c.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; ln(c, w / 2 + Math.cos(a) * 18, h / 2 + Math.sin(a) * 14, w / 2 + Math.cos(a) * 70, h / 2 + Math.sin(a) * 50, i, .5); }
    c.strokeStyle = K;
  }
  if (card.kind === 'unit') drawPiece(c, card.unit, 'w', w / 2, h / 2 - 2, h * 0.9, 11);
  else (SPELL_ART[key] || SPELL_ART.pouch)(c, w, h);
  INK.boil = saved;
}
INK.drawCardArt = drawCardArt;

function drawPackArt(cv, w, h, packKey = 'classic') {
  const c = hiDPI(cv, w, h), pk = INK.PACKS[packKey];
  const m = w * 0.08;
  const saved = INK.boil; INK.boil = 0;
  c.lineWidth = Math.max(2, w / 70);
  c.beginPath(); c.moveTo(m, m * 1.4);
  for (let x = m; x <= w - m; x += w / 18) c.lineTo(x, m * (1.1 + ((x / (w / 18)) % 2 ? .4 : 0)));
  c.lineTo(w - m, h - m * 1.4);
  for (let x = w - m; x >= m; x -= w / 18) c.lineTo(x, h - m * (1.1 + ((x / (w / 18)) % 2 ? .4 : 0)));
  c.closePath(); c.fillStyle = PAPER; c.fill(); c.stroke();
  c.save(); c.clip();
  if (pk.band) { c.fillStyle = pk.band; c.globalAlpha = .9; c.fillRect(0, h * .78, w, h * .1); c.globalAlpha = 1; }
  c.strokeStyle = 'rgba(30,28,36,0.16)'; c.lineWidth = 1;
  for (let k = -h; k < w + h; k += 7) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k - h * .6, h); c.stroke(); }
  c.restore();
  c.strokeStyle = K; c.lineWidth = Math.max(1.5, w / 90);
  ln(c, m, m * 2.6, w - m, m * 2.6, 1, 1); ln(c, m, h - m * 2.6, w - m, h - m * 2.6, 2, 1);
  c.fillStyle = PAPER; ell(c, w / 2, h * .47, w * .34, h * .25); c.fill(); c.stroke();
  drawPiece(c, pk.badge, 'w', w / 2, h * .44, w * .45, 3);
  c.fillStyle = K; c.textAlign = 'center';
  const title = 'INKMATE';
  c.font = `${Math.round(w * (title.length > 9 ? .095 : .13))}px 'Permanent Marker', 'Patrick Hand', cursive`; c.fillText(title, w / 2, m * 2.6 + w * .14);
  if (w > 80) { c.font = `${Math.round(w * .075)}px 'Patrick Hand', cursive`; c.fillText('3 cards · could be a NUKE', w / 2, h - m * 2.6 - w * .05); }
  INK.boil = saved;
}
INK.drawPackArt = drawPackArt;

function drawCardBack(cv) {
  const w = 132, h = 184, c = hiDPI(cv, w, h);
  c.fillStyle = K; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(242,238,226,0.25)'; c.lineWidth = 1;
  for (let k = -h; k < w + h; k += 8) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + h, h); c.stroke(); c.beginPath(); c.moveTo(k + h, 0); c.lineTo(k, h); c.stroke(); }
  c.fillStyle = K; c.beginPath(); c.arc(w / 2, h / 2, 34, 0, 7); c.fill();
  c.strokeStyle = PAPER; c.lineWidth = 2; c.beginPath(); c.arc(w / 2, h / 2, 34, 0, 7); c.stroke();
  const saved = INK.boil; INK.boil = 0;
  c.save(); c.translate(w / 2, h / 2 + 10); c.scale(.9, .9); c.strokeStyle = PAPER; c.lineWidth = 2.4;
  poly(c, [[-13, 0], [13, 0], [7, -28], [-7, -28]], 2, .5); c.fillStyle = K; c.fill(); c.stroke();
  circ(c, 0, -33, 5.5, 5, .4, 10); c.fill(); c.stroke();
  poly(c, [[-7, -37], [-7.5, -47], [-3.5, -42], [0, -48], [3.5, -42], [7.5, -47], [7, -37]], 6, .4); c.fillStyle = GOLD; c.fill(); c.stroke();
  c.restore(); INK.boil = saved;
}
INK.drawCardBack = drawCardBack;

function drawUnitArt(cv, t, size = 84) { const c = hiDPI(cv, size, size); const saved = INK.boil; INK.boil = 0; drawPiece(c, t, 'w', size / 2, size / 2, size * .86, 21); INK.boil = saved; }
INK.drawUnitArt = drawUnitArt;
function drawMoveDiagram(cv, t) {
  const S = 98, cell = S / 7, c = hiDPI(cv, S, S), N = INK.N;
  const saved = INK.boil; INK.boil = 0;
  const savedEnv = { ...INK.ENV }; INK.ENV.terr = new Array(N * N).fill(null); INK.ENV.wrap = INK.ENV.truce = INK.ENV.km = INK.ENV.bp = false;
  const centre = 5 * N + 4, [cr, cc] = INK.rc(centre);
  const me = INK.mkPiece(t, 'w');
  const empty = new Array(N * N).fill(null); empty[centre] = me;
  const full = new Array(N * N).fill(null).map((_, i) => i === centre ? me : { ...INK.mkPiece('P', 'b'), ar: 0 });
  const sparse = new Array(N * N).fill(null); sparse[centre] = me;
  const moves = new Set(INK.genMoves(empty, 'w').filter(m => !m.cap).map(m => m.t));
  const caps = INK.genMoves(full, 'w').filter(m => m.cap);
  // ranged reach: put lone enemies on each square one at a time is costly; use rings of enemies at distance d with gaps
  const ranged = new Set();
  for (let i = 0; i < N * N; i++) { if (i === centre) continue; sparse[i] = INK.mkPiece('P', 'b'); for (const m of INK.genMoves(sparse, 'w')) if (m.t === i && m.r) ranged.add(i); sparse[i] = null; }
  for (let r = 0; r < 7; r++) for (let cl = 0; cl < 7; cl++) if ((r + cl) % 2) { c.fillStyle = 'rgba(30,28,36,0.07)'; c.fillRect(cl * cell, r * cell, cell, cell); }
  c.strokeStyle = 'rgba(30,28,36,0.35)'; c.lineWidth = 1; c.strokeRect(.5, .5, S - 1, S - 1);
  const pos = sq => { const [r, cl] = INK.rc(sq); return [r - cr + 3, cl - cc + 3]; };
  const inWin = ([r, cl]) => r >= 0 && r < 7 && cl >= 0 && cl < 7;
  for (const sq of moves) { const p = pos(sq); if (!inWin(p)) continue; c.fillStyle = K; c.beginPath(); c.arc(p[1] * cell + cell / 2, p[0] * cell + cell / 2, cell * .15, 0, 7); c.fill(); }
  for (const m of caps) { if (m.r || moves.has(m.t)) continue; const p = pos(m.t); if (!inWin(p)) continue; c.strokeStyle = RED; c.lineWidth = 1.6; c.beginPath(); c.arc(p[1] * cell + cell / 2, p[0] * cell + cell / 2, cell * .3, 0, 7); c.stroke(); }
  for (const sq of ranged) { const p = pos(sq); if (!inWin(p)) continue; const x = p[1] * cell + cell / 2, y = p[0] * cell + cell / 2; c.strokeStyle = RED; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 4, y - 4); c.lineTo(x + 4, y + 4); c.moveTo(x + 4, y - 4); c.lineTo(x - 4, y + 4); c.stroke(); }
  drawPiece(c, t, 'w', 3 * cell + cell / 2, 3 * cell + cell / 2 - 1, cell * 1.05, 4);
  Object.assign(INK.ENV, savedEnv); INK.boil = saved;
}
INK.drawMoveDiagram = drawMoveDiagram;
})();
