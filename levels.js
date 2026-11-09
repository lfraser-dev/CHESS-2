/* Chess 2: pieces level up. Captures (and hitting bosses) give XP:
   2 XP  VETERAN  gets a name, a headband and +1 armour
   5 XP  LEGEND   gets a cape, a new way to move and +1 armour
   9 XP  MYTHIC   glows gold, can fly over pieces, grows a gun and +1 armour
   Your best pieces go in the Hall of Fame (in the Locker), and fallen heroes get a memorial. */
(() => {
'use strict';
const I = window.INK;
const { U } = I;
const LEVELS = [
  { at: 0, name: '' },
  { at: 2, name: 'Veteran' },
  { at: 5, name: 'Legend' },
  { at: 9, name: 'Mythic' },
];
const NAMES = ['Gerald', 'Big Steve', 'Kevin', 'Barbara', 'Sir Reginald', 'Tiny Tim', 'Dave', 'Brenda', 'Lord Wobbles', 'Mr Crumbs', 'Susan', 'Nigel', 'Doris', 'Captain Bonk',
  'Gary', 'Margaret', 'Clive', 'Sandra', 'Duke Spaghetti', 'Little Pete', 'Beverley', 'Trevor', 'Auntie Jean', 'Sir Bumble', 'Frank', 'Gwendolyn', 'Steve Jr', 'The Professor', 'Bob', 'Yvonne'];
const levelOf = xp => { let l = 0; LEVELS.forEach((x, i) => { if ((xp || 0) >= x.at) l = i; }); return l; };
const fullName = p => p && p.nm ? `${p.nm} the ${U[p.t].name}` : (p ? U[p.t].name : '');
const LEGEND_MOVES = ['step', 'kn', 'diag', 'rook'];

// give XP to the piece on sq. Returns { p, up: new level or 0 } (the piece object is replaced, never edited)
function gain(G, sq, n) {
  const p = G.board[sq]; if (!p || n <= 0) return null;
  const was = levelOf(p.xp), xp = (p.xp || 0) + n, lvl = levelOf(xp);
  const q = { ...p, xp, lvl };
  if (lvl > was) {
    for (let l = was + 1; l <= lvl; l++) {
      q.ar = (q.ar || 0) + 1;
      if (l === 1 && !q.nm) { const used = new Set(G.board.filter(Boolean).map(x => x.nm)); const free = NAMES.filter(x => !used.has(x)); q.nm = (free.length ? free : NAMES)[Math.floor(Math.random() * (free.length || NAMES.length))]; }
      if (l === 2) { const have = q.mut || [], opts = LEGEND_MOVES.filter(m => !have.includes(m)); if (opts.length) q.mut = [...have, opts[Math.floor(Math.random() * opts.length)]]; }
      if (l === 3) { const have = q.mut || []; q.mut = [...have, ...['fly', 'gun'].filter(m => !have.includes(m))]; }
    }
  }
  G.board[sq] = q;
  return { p: q, up: lvl > was ? lvl : 0 };
}

// ---------------------------------------------------------------- looks (sz = piece size, centred at x, y)
function drawBehind(c, p, x, y, sz, now) {
  const l = p.lvl || 0; if (l < 2) return;
  if (l >= 3) { const g = c.createRadialGradient(x, y, sz * .1, x, y, sz * .75); g.addColorStop(0, `rgba(255,220,90,${.55 + .15 * Math.sin(now / 250)})`); g.addColorStop(1, 'rgba(255,200,60,0)'); c.fillStyle = g; c.fillRect(x - sz, y - sz, sz * 2, sz * 2); }
  // cape
  const sway = Math.sin(now / 400 + (p.id || 0)) * sz * .05;
  c.fillStyle = l >= 3 ? '#e2b53a' : '#b3322b'; c.strokeStyle = '#1e1c24'; c.lineWidth = Math.max(1, sz * .03);
  c.beginPath(); c.moveTo(x - sz * .14, y - sz * .22); c.quadraticCurveTo(x - sz * .38 + sway, y + sz * .1, x - sz * .3 + sway, y + sz * .4); c.lineTo(x + sz * .3 + sway, y + sz * .4); c.quadraticCurveTo(x + sz * .38 + sway, y + sz * .1, x + sz * .14, y - sz * .22); c.closePath(); c.fill(); c.stroke();
}
function drawFront(c, p, x, y, sz, now) {
  const l = p.lvl || 0; if (l < 1) return;
  // headband with tails
  c.save(); c.strokeStyle = l >= 3 ? '#e2b53a' : '#c0392b'; c.lineWidth = Math.max(1.5, sz * .06); c.lineCap = 'round';
  const hy = y - sz * .26;
  c.beginPath(); c.moveTo(x - sz * .13, hy); c.lineTo(x + sz * .13, hy - sz * .02); c.stroke();
  const t = Math.sin(now / 200 + (p.id || 0)) * sz * .04;
  c.lineWidth = Math.max(1, sz * .04); c.beginPath(); c.moveTo(x + sz * .13, hy - sz * .02); c.lineTo(x + sz * .27, hy - sz * .06 + t); c.moveTo(x + sz * .13, hy - sz * .02); c.lineTo(x + sz * .25, hy + sz * .05 + t); c.stroke();
  c.restore();
  // level stars under the piece
  c.fillStyle = l >= 3 ? '#e2b53a' : '#c0392b';
  for (let k = 0; k < l; k++) star(c, x + (k - (l - 1) / 2) * sz * .17, y + sz * .5, sz * .07);
}
function star(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fill(); }

I.LEVELS = { LEVELS, levelOf, fullName, gain, drawBehind, drawFront };
})();
