/* Chess 2: the Locker. Coins left over at the end of a game are banked here (plus bonuses), and you spend them
   on cosmetics: hats for your pieces, board themes, capture effects and silly titles. Saved in this browser.
   Cosmetics never change the rules, so they're fair online (your friend sees your hats and title too). */
(() => {
'use strict';
const I = window.INK;
const KEY = 'chess2.locker';
const INK = '#1e1c24';

const CATALOG = {
  hat: [
    { id: 'none', name: 'No hat', price: 0 },
    { id: 'party', name: 'Party Hat', price: 15 },
    { id: 'cone', name: 'Traffic Cone', price: 20 },
    { id: 'shades', name: 'Sunglasses', price: 25 },
    { id: 'tophat', name: 'Top Hat', price: 30 },
    { id: 'cowboy', name: 'Cowboy Hat', price: 30 },
    { id: 'chef', name: 'Chef Hat', price: 35 },
    { id: 'propeller', name: 'Propeller Cap', price: 40 },
    { id: 'viking', name: 'Viking Helmet', price: 50 },
    { id: 'crown', name: 'Golden Crown', price: 60 },
    { id: 'halo', name: 'Halo', price: 80 },
  ],
  theme: [
    { id: 'notebook', name: 'Notebook', price: 0 },
    { id: 'graph', name: 'Graph Paper', price: 20 },
    { id: 'parchment', name: 'Old Parchment', price: 30 },
    { id: 'grass', name: 'Football Pitch', price: 40 },
    { id: 'beach', name: 'Beach', price: 40 },
    { id: 'disco', name: 'Disco Floor', price: 80 },
    { id: 'space', name: 'Outer Space', price: 100 },
  ],
  fx: [
    { id: 'ink', name: 'Ink Splat', price: 0 },
    { id: 'confetti', name: 'Confetti', price: 25 },
    { id: 'hearts', name: 'Hearts', price: 30 },
    { id: 'fire', name: 'Fire', price: 45 },
    { id: 'pixels', name: 'Pixel Explosion', price: 50 },
    { id: 'lightning', name: 'Lightning', price: 60 },
    { id: 'rainbow', name: 'Rainbow', price: 80 },
  ],
  title: [
    { id: 'none', name: 'No title', price: 0 },
    { id: 'blunder', name: 'Professional Blunderer', price: 10 },
    { id: 'unhinged', name: 'the Unhinged', price: 10 },
    { id: 'whisperer', name: 'Pawn Whisperer', price: 15 },
    { id: 'horsey', name: 'Horsey Enjoyer', price: 15 },
    { id: 'pom', name: 'Pomegranate Survivor', price: 25 },
    { id: 'goat', name: 'Certified Goat', price: 40 },
    { id: 'slayer', name: 'Boss Slayer', price: 60 },
    { id: 'gm', name: 'Chess 2 Grandmaster', price: 150 },
  ],
};
const TABS = [['hat', 'Hats'], ['theme', 'Boards'], ['fx', 'Capture effects'], ['title', 'Titles']];
const find = (kind, id) => CATALOG[kind].find(x => x.id === id) || CATALOG[kind][0];
const DEFAULT = { bank: 30, owned: ['hat:none', 'theme:notebook', 'fx:ink', 'title:none'], eq: { hat: 'none', theme: 'notebook', fx: 'ink', title: 'none' }, games: 0, wins: 0 };

let prof = null;
function load() {
  if (prof) return prof;
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s.bank === 'number') prof = { ...DEFAULT, ...s, eq: { ...DEFAULT.eq, ...(s.eq || {}) }, owned: [...new Set([...DEFAULT.owned, ...(s.owned || [])])] }; } catch (e) { /* fresh */ }
  return prof || (prof = JSON.parse(JSON.stringify(DEFAULT)));
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(prof)); } catch (e) { /* not saved: private window */ } }
const owns = (kind, id) => load().owned.includes(kind + ':' + id);
function buy(kind, id) {
  const p = load(), item = find(kind, id);
  if (owns(kind, id)) return { ok: true };
  if (p.bank < item.price) return { ok: false, why: `You need ${item.price - p.bank} more coins` };
  p.bank -= item.price; p.owned.push(kind + ':' + id); p.eq[kind] = id; save();
  return { ok: true, bought: true };
}
function equip(kind, id) { if (!owns(kind, id)) return false; load().eq[kind] = id; save(); return true; }
function bank(n, won) { const p = load(); p.bank += Math.max(0, Math.round(n)); p.games++; if (won) p.wins++; save(); return p.bank; }
// what other players see: just ids, so it's tiny to send online
const look = () => { const e = load().eq; return { hat: e.hat, fx: e.fx, title: e.title }; };
const titleText = cos => cos && cos.title && cos.title !== 'none' ? find('title', cos.title).name : '';

// ---------------------------------------------------------------- hats (drawn on top of a piece of size sz centred at x, y)
function drawHat(c, hat, x, y, sz, now = 0) {
  if (!hat || hat === 'none') return;
  const s = sz, top = y - s * .44;
  c.save(); c.translate(x, top); c.lineJoin = 'round'; c.lineCap = 'round';
  c.strokeStyle = INK; c.lineWidth = Math.max(1, s * .04);
  if (hat === 'party') {
    c.fillStyle = '#e86ad6'; c.beginPath(); c.moveTo(-s * .15, s * .02); c.lineTo(0, -s * .32); c.lineTo(s * .15, s * .02); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f3d55b'; c.beginPath(); c.arc(0, -s * .33, s * .05, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = '#f3d55b'; c.beginPath(); c.moveTo(-s * .1, -s * .08); c.lineTo(s * .07, -s * .15); c.stroke();
  } else if (hat === 'cone') {
    c.fillStyle = '#ef7d22'; c.beginPath(); c.moveTo(-s * .16, s * .03); c.lineTo(-s * .05, -s * .3); c.lineTo(s * .05, -s * .3); c.lineTo(s * .16, s * .03); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.fillRect(-s * .1, -s * .14, s * .2, s * .06);
  } else if (hat === 'shades') {
    c.translate(0, s * .12); c.fillStyle = INK;
    for (const dx of [-s * .09, s * .09]) { c.beginPath(); c.ellipse(dx, 0, s * .08, s * .055, 0, 0, 7); c.fill(); }
    c.beginPath(); c.moveTo(-s * .02, -s * .01); c.lineTo(s * .02, -s * .01); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-s * .13, -s * .02); c.lineTo(-s * .1, -s * .035); c.stroke();
  } else if (hat === 'tophat') {
    c.fillStyle = INK; c.fillRect(-s * .2, -s * .01, s * .4, s * .05); c.fillRect(-s * .12, -s * .27, s * .24, s * .27);
    c.fillStyle = '#b3322b'; c.fillRect(-s * .12, -s * .07, s * .24, s * .05);
  } else if (hat === 'cowboy') {
    c.fillStyle = '#9b6a3c'; c.beginPath(); c.ellipse(0, 0, s * .26, s * .06, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-s * .13, 0); c.quadraticCurveTo(-s * .14, -s * .22, 0, -s * .17); c.quadraticCurveTo(s * .14, -s * .22, s * .13, 0); c.closePath(); c.fill(); c.stroke();
  } else if (hat === 'chef') {
    c.fillStyle = '#fff'; c.fillRect(-s * .11, -s * .1, s * .22, s * .1); c.strokeRect(-s * .11, -s * .1, s * .22, s * .1);
    for (const [dx, dy, r] of [[-s * .1, -s * .16, .09], [s * .1, -s * .16, .09], [0, -s * .22, .11]]) { c.beginPath(); c.arc(dx, dy, s * r, 0, 7); c.fill(); c.stroke(); }
  } else if (hat === 'propeller') {
    c.fillStyle = '#4a6fb0'; c.beginPath(); c.arc(0, 0, s * .15, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, -s * .15); c.lineTo(0, -s * .22); c.stroke();
    const a = now / 60; c.fillStyle = '#e8892b';
    for (const k of [0, Math.PI]) { c.save(); c.translate(0, -s * .22); c.scale(Math.cos(a + k), 1); c.beginPath(); c.ellipse(s * .1, 0, s * .1, s * .03, 0, 0, 7); c.fill(); c.stroke(); c.restore(); }
  } else if (hat === 'viking') {
    c.fillStyle = '#9aa0a8'; c.beginPath(); c.arc(0, 0, s * .15, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f2eee2';
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * s * .13, -s * .05); c.quadraticCurveTo(sg * s * .3, -s * .1, sg * s * .26, -s * .3); c.quadraticCurveTo(sg * s * .2, -s * .14, sg * s * .1, -s * .1); c.closePath(); c.fill(); c.stroke(); }
  } else if (hat === 'crown') {
    c.fillStyle = '#e2b53a'; c.beginPath(); c.moveTo(-s * .15, s * .03); c.lineTo(-s * .17, -s * .15); c.lineTo(-s * .08, -s * .06); c.lineTo(0, -s * .19); c.lineTo(s * .08, -s * .06); c.lineTo(s * .17, -s * .15); c.lineTo(s * .15, s * .03); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#c0392b'; c.beginPath(); c.arc(0, -s * .04, s * .03, 0, 7); c.fill();
  } else if (hat === 'halo') {
    c.strokeStyle = '#f3d55b'; c.lineWidth = Math.max(1.5, s * .05); c.shadowColor = '#fff3b0'; c.shadowBlur = s * .2;
    c.beginPath(); c.ellipse(0, -s * .12 + Math.sin(now / 300) * s * .02, s * .17, s * .05, 0, 0, 7); c.stroke(); c.shadowBlur = 0;
  }
  c.restore();
}

// ---------------------------------------------------------------- board themes
// colours for the board drawing: base fill, dark-square tint, grid lines, and whether pieces need a glow to show up
const THEMES = {
  notebook: { base: 'rgba(242,238,226,0.9)', dark: 'rgba(30,28,36,0.17)', darkFill: 'rgba(30,28,36,0.07)', line: 'rgba(30,28,36,0.75)', hatch: true },
  graph: { base: '#f4f8ff', dark: 'rgba(74,111,176,0.18)', darkFill: 'rgba(74,111,176,0.1)', line: 'rgba(74,111,176,0.8)', hatch: false },
  parchment: { base: '#efdcb2', dark: 'rgba(110,70,30,0.22)', darkFill: 'rgba(110,70,30,0.13)', line: 'rgba(90,55,25,0.7)', hatch: true },
  grass: { base: '#7fbf5a', dark: 'rgba(30,80,20,0.18)', darkFill: 'rgba(40,100,30,0.16)', line: 'rgba(255,255,255,0.75)', hatch: false, stripes: true },
  beach: { base: '#f3dfa6', dark: 'rgba(180,140,60,0.2)', darkFill: 'rgba(180,140,60,0.14)', line: 'rgba(120,90,40,0.55)', hatch: false, shells: true },
  disco: { base: '#2a2238', dark: null, darkFill: null, line: 'rgba(255,255,255,0.35)', hatch: false, disco: true, glow: true },
  space: { base: '#141a33', dark: null, darkFill: 'rgba(255,255,255,0.04)', line: 'rgba(170,190,255,0.35)', hatch: false, stars: true, glow: true },
};
const theme = id => THEMES[id] || THEMES.notebook;
// extra per-square decoration for fancy themes (called for each visible square)
function decorate(c, th, r, col, x, y, cell, now) {
  if (th.disco) { const h = (r * 47 + col * 83 + Math.floor(now / 500) * 37) % 360, on = (r + col + Math.floor(now / 500)) % 3 === 0; c.fillStyle = `hsla(${h},80%,${on ? 62 : 38}%,${on ? .55 : .25})`; c.fillRect(x + 1, y + 1, cell - 2, cell - 2); }
  else if (th.stars) { const n = I.hash(r * 31 + col * 17); if (n > .6) { c.fillStyle = `rgba(255,255,255,${.4 + .5 * Math.abs(Math.sin(now / 700 + n * 20))})`; c.fillRect(x + I.hash(r + col * 9) * cell, y + I.hash(col + r * 5) * cell, 1.6, 1.6); } }
  else if (th.stripes) { if (col % 2) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x, y, cell, cell); } }
  else if (th.shells && I.hash(r * 13 + col * 7) > .93) { c.fillStyle = '#f2b8a6'; c.beginPath(); c.arc(x + cell * .7, y + cell * .75, cell * .07, Math.PI, 0); c.fill(); }
}

// ---------------------------------------------------------------- capture effects (k = 0..1, at x, y)
function drawCaptureFx(c, style, x, y, cell, k, seed) {
  const h = n => I.hash(seed + n);
  c.save();
  if (style === 'confetti' || style === 'rainbow') {
    for (let i = 0; i < 24; i++) { const a = h(i) * Math.PI * 2, sp = .6 + h(i + 30) * 1.6, e = Math.min(1, k * 3); c.globalAlpha = 1 - Math.max(0, k - .6) / .4; c.fillStyle = style === 'rainbow' ? `hsl(${(i * 15 + k * 200) % 360},85%,58%)` : ['#e86ad6', '#f3d55b', '#5bd1f3', '#7be06a', '#b3322b'][i % 5]; c.save(); c.translate(x + Math.cos(a) * cell * sp * e, y + Math.sin(a) * cell * sp * e * .7 - cell * .4 * Math.sin(e * Math.PI / 2) + k * k * cell); c.rotate(k * 10 + i); c.fillRect(-cell * .05, -cell * .025, cell * .1, cell * .05); c.restore(); }
    if (style === 'rainbow') { c.globalAlpha = Math.max(0, 1 - k) * .8; c.lineWidth = cell * .07; ['#e74c3c', '#f39c12', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6'].forEach((col, i) => { c.strokeStyle = col; c.beginPath(); c.arc(x, y + cell * .3, cell * (.5 + i * .08) * Math.min(1, k * 2.5), Math.PI, 0); c.stroke(); }); }
  } else if (style === 'hearts') {
    for (let i = 0; i < 9; i++) { const e = k, px = x + (h(i) - .5) * cell * 1.6, py = y - e * cell * (1 + h(i + 5)), s = cell * (.12 + h(i + 9) * .1); c.globalAlpha = 1 - e; c.fillStyle = i % 3 ? '#e74c6b' : '#ff9ab0'; c.beginPath(); c.moveTo(px, py + s * .35); c.bezierCurveTo(px - s, py - s * .4, px - s * .4, py - s, px, py - s * .35); c.bezierCurveTo(px + s * .4, py - s, px + s, py - s * .4, px, py + s * .35); c.fill(); }
  } else if (style === 'fire') {
    for (let i = 0; i < 14; i++) { const e = k, px = x + (h(i) - .5) * cell * .9, py = y + cell * .3 - e * cell * (.6 + h(i + 3) * .8), r = cell * (.18 - e * .14) * (.6 + h(i + 7)); if (r <= 0) continue; c.globalAlpha = 1 - e * .8; c.fillStyle = i % 3 === 0 ? '#f3d55b' : i % 3 === 1 ? '#ef7d22' : '#c0392b'; c.beginPath(); c.arc(px, py, r, 0, 7); c.fill(); }
  } else if (style === 'pixels') {
    for (let i = 0; i < 20; i++) { const a = h(i) * Math.PI * 2, d = cell * (.2 + h(i + 2) * 1.2) * Math.min(1, k * 2.5), s = cell * .1; c.globalAlpha = 1 - k; c.fillStyle = ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c', '#fff'][i % 5]; c.fillRect(Math.round((x + Math.cos(a) * d) / 3) * 3, Math.round((y + Math.sin(a) * d + k * k * cell * .8) / 3) * 3, s, s); }
  } else if (style === 'lightning') {
    if (k < .5) { c.globalAlpha = 1 - k * 2; c.strokeStyle = '#fff6a8'; c.shadowColor = '#f3d55b'; c.shadowBlur = cell * .3; c.lineWidth = cell * .07; c.beginPath(); let px = x + (h(1) - .5) * cell * .4, py = y - cell * 3; c.moveTo(px, py); for (let i = 0; i < 7; i++) { px += (h(i + 4) - .5) * cell * .6; py += cell * 3 / 7; c.lineTo(px, py); } c.stroke(); c.fillStyle = 'rgba(255,250,200,.5)'; c.beginPath(); c.arc(x, y, cell * .7 * (1 - k * 2), 0, 7); c.fill(); }
  }
  c.restore();
}

I.LOCKER = { CATALOG, TABS, find, load, save, owns, buy, equip, bank, look, titleText, drawHat, THEMES, theme, decorate, drawCaptureFx };
})();
