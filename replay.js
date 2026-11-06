/* Chess 2: the end-of-game highlights reel. Plays back the biggest moments like a YouTube Short:
   a close-up of the board before, the move, the aftermath, a big caption and a reaction. */
(() => {
'use strict';
const I = window.INK;
const { N } = I;
const PAPER = '#f2eee2', INK = '#1e1c24', RED = '#b3322b';
const CLIP = 3000;

// pick the best moments (kept in the order they happened), always ending on the last one
function choose(all, max = 6) {
  if (!all.length) return [];
  const last = all[all.length - 1];
  const rest = all.slice(0, -1).map((c, i) => ({ c, i })).sort((a, b) => b.c.score - a.c.score).slice(0, max - 1).sort((a, b) => a.i - b.i).map(x => x.c);
  return [...rest, last];
}

function play(canvas, clips, opts = {}) {
  const c = canvas.getContext('2d');
  let stop = false, raf = 0;
  const done = new Promise(resolve => {
    const t0 = performance.now(), total = clips.length * CLIP + 2600;
    const frame = now => {
      if (stop) { resolve(); return; }
      const dpr = Math.min(window.devicePixelRatio || 1, 2), W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== Math.round(W * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const t = now - t0;
      if (t >= total) { resolve(); return; }
      const idx = Math.floor(t / CLIP);
      if (idx < clips.length) drawClip(c, W, H, clips[idx], (t % CLIP) / CLIP, idx, clips.length, now, opts);
      else drawEnd(c, W, H, (t - clips.length * CLIP) / 2600, opts);
      vhs(c, W, H, now);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  return { done, stop: () => { stop = true; cancelAnimationFrame(raf); } };
}

function drawClip(c, W, H, clip, k, idx, n, now, opts) {
  // 7x7 window around the action, slowly pushing in
  const S = 7, [tr, tc] = [clip.t / N | 0, clip.t % N];
  const r0 = Math.max(0, Math.min(N - S, tr - 3)), c0 = Math.max(0, Math.min(N - S, tc - 3));
  const zoom = 1 + k * .12 + (k > .45 && k < .55 ? .06 : 0);
  const cell = Math.min(W, H * .78) / S * zoom;
  const ox = W / 2 - ((tc - c0) + .5) * cell, oy = H * .44 - ((tr - r0) + .5) * cell;
  const xy = sq => [ox + ((sq % N) - c0 + .5) * cell, oy + ((sq / N | 0) - r0 + .5) * cell];
  c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
  // grid
  c.save();
  for (let r = r0 - 1; r <= r0 + S; r++) for (let cc = c0 - 1; cc <= c0 + S; cc++) {
    if (r < 0 || cc < 0 || r >= N || cc >= N) continue;
    const x = ox + (cc - c0) * cell, y = oy + (r - r0) * cell;
    if ((r + cc) % 2) { c.fillStyle = 'rgba(30,28,36,.06)'; c.fillRect(x, y, cell, cell); }
    c.strokeStyle = 'rgba(30,28,36,.35)'; c.lineWidth = 1; c.strokeRect(x, y, cell, cell);
  }
  const phase = k < .38 ? 0 : k < .55 ? 1 : 2;
  const board = phase < 2 ? clip.before : clip.after;
  const items = phase < 2 ? clip.itemsBefore : clip.itemsAfter;
  const mover = clip.f >= 0 && clip.f !== clip.t ? clip.before[clip.f] : null;
  if (items) for (let i = 0; i < N * N; i++) if (items[i] && !board[i]) { const [x, y] = xy(i); if (x > -cell && x < W + cell && y > -cell && y < H + cell) I.ITEMS.drawItem(c, items[i].k, x, y, cell, now, i); }
  for (let i = 0; i < N * N; i++) {
    const p = board[i]; if (!p) continue;
    if (phase === 1 && mover && (i === clip.f || p === mover)) continue;
    const [x, y] = xy(i); if (x < -cell || x > W + cell || y < -cell || y > H + cell) continue;
    let sc = 1;
    if (phase === 2 && i === clip.t) sc = 1 + .25 * Math.max(0, 1 - (k - .55) / .12);
    I.drawPiece(c, p.t, p.s, x, y, cell * .82 * sc, p.id * 3.7);
  }
  if (phase === 1 && mover) {
    const q = (k - .38) / .17, e = q * q * (3 - 2 * q), [x1, y1] = xy(clip.f), [x2, y2] = xy(clip.t);
    for (let g = 3; g >= 1; g--) { const qq = Math.max(0, e - g * .1); I.drawPiece(c, mover.t, mover.s, x1 + (x2 - x1) * qq, y1 + (y2 - y1) * qq - Math.sin(qq * Math.PI) * cell * .3, cell * .82, mover.id * 3.7, .2); }
    I.drawPiece(c, mover.t, mover.s, x1 + (x2 - x1) * e, y1 + (y2 - y1) * e - Math.sin(e * Math.PI) * cell * .3, cell * .82, mover.id * 3.7);
  }
  // impact flash
  if (k > .55 && k < .62) { c.fillStyle = `rgba(255,255,255,${1 - (k - .55) / .07})`; c.fillRect(0, 0, W, H); }
  if (k > .55 && k < .75) { const [x, y] = xy(clip.t), e = (k - .55) / .2; c.strokeStyle = INK; c.lineWidth = 2; c.globalAlpha = 1 - e; for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; c.beginPath(); c.moveTo(x + Math.cos(a) * cell * (.5 + e), y + Math.sin(a) * cell * (.5 + e)); c.lineTo(x + Math.cos(a) * cell * (.9 + e * 1.6), y + Math.sin(a) * cell * (.9 + e * 1.6)); c.stroke(); } c.globalAlpha = 1; }
  c.restore();
  // header: clip counter + REPLAY
  c.fillStyle = 'rgba(30,28,36,.82)'; c.fillRect(0, 0, W, 38);
  c.fillStyle = (now / 500 | 0) % 2 ? RED : '#7a1f1a'; c.beginPath(); c.arc(18, 19, 6, 0, 7); c.fill();
  c.font = `400 18px Anton, Impact, sans-serif`; c.fillStyle = '#fff'; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(`REPLAY  ${idx + 1}/${n}`, 32, 20);
  c.textAlign = 'right'; c.fillStyle = '#f3d55b'; c.fillText(clip.label || 'HIGHLIGHT', W - 14, 20);
  // caption (meme style) and reaction slam
  const cap = clip.caption || '';
  const fs = Math.max(18, Math.min(34, W / 20));
  c.font = `400 ${fs}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  c.lineWidth = fs * .16; c.strokeStyle = '#000'; c.fillStyle = '#fff'; c.lineJoin = 'round';
  wrap(c, cap, W - 40).forEach((ln, i, a) => { const y = H - 26 - (a.length - 1 - i) * fs * 1.12; c.strokeText(ln, W / 2, y); c.fillText(ln, W / 2, y); });
  if (clip.react && k > .58) {
    const e = Math.min(1, (k - .58) / .08), s = 1 + (1 - e) * 1.8, rf = Math.max(30, Math.min(70, W / 9));
    c.save(); c.translate(W / 2, H * .3); c.rotate(-.08); c.scale(s, s); c.globalAlpha = Math.min(1, e * 1.5);
    c.font = `400 ${rf}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = rf * .14; c.strokeStyle = INK; c.strokeText(clip.react.toUpperCase(), 0, 0, W * .9);
    c.fillStyle = '#f3d55b'; c.fillText(clip.react.toUpperCase(), 0, 0, W * .9); c.restore();
  }
  // clip intro wipe
  if (k < .06) { c.fillStyle = INK; c.fillRect(0, 0, W * (1 - k / .06), H); }
}
function drawEnd(c, W, H, k, opts) {
  c.fillStyle = INK; c.fillRect(0, 0, W, H);
  const s = 1 + Math.max(0, 1 - k * 4) * 1.5;
  c.save(); c.translate(W / 2, H * .42); c.scale(s, s);
  c.font = `400 ${Math.min(120, W / 5)}px Anton, Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#f3d55b'; c.fillText(opts.title || 'GG', 0, 0); c.restore();
  c.font = `20px 'Patrick Hand', cursive`; c.fillStyle = '#e9e1cf'; c.textAlign = 'center';
  c.fillText(opts.sub || 'thanks for watching', W / 2, H * .62);
  if (k > .3) { c.font = `400 16px Anton, Impact, sans-serif`; c.fillStyle = RED; c.fillText('LIKE AND SUBSCRIBE (there is nothing to subscribe to)', W / 2, H * .72, W - 30); }
}
function vhs(c, W, H, now) {
  c.fillStyle = 'rgba(0,0,0,.06)';
  for (let y = (now / 40) % 4; y < H; y += 4) c.fillRect(0, y, W, 1);
  const band = (now / 9) % (H + 60) - 30; c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, band, W, 18);
}
function wrap(c, text, max) {
  const words = text.split(' '), out = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (c.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out.slice(-3);
}

I.Replay = { choose, play, CLIP };
})();
