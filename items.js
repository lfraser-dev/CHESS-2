/* Chess 2: random things that turn up on the board.
   A pomegranate, a marker, gems, a wedding ring, a disco ball, a birthday cake...
   Walk a piece onto one and something ridiculous happens. None of these can leave your own king in check:
   they only add pieces, freeze enemies, upgrade pieces or hand out coins. */
(() => {
'use strict';
const I = window.INK;
const { N, U, rc, other } = I;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const empty = (G, i) => !G.board[i] && !(G.terr[i] && ['pit', 'fire', 'portal', 'boss', 'void'].includes(G.terr[i].k));
const DRAWABLE = ['N', 'B', 'R', 'chicken', 'duck', 'grandma', 'trooper', 'pogo', 'cow', 'gnome', 'toaster', 'ogre', 'werewolf', 'goose'];
const AGE_UP = { P: 'N', N: 'B', B: 'R', R: 'Q' };

// each item: name, verb (for the caption), react lines, use(G, side, at, h) -> log text
// h = helpers from game.js: { fx, summon, sound, slam, coins }
const ITEMS = {
  pomegranate: {
    name: 'Pomegranate', verb: 'eats a pomegranate', react: ['SEEDS EVERYWHERE', 'it\'s so juicy', 'he ate the whole thing'],
    use(G, side, at, h) {
      let n = 0;
      for (const j of I.area(at, 1)) { const q = G.board[j]; if (j !== at && q && q.s !== side && q.t !== 'K' && !(q.sh > 0)) { G.board[j] = { ...q, fz: Math.max(q.fz || 0, 1) }; n++; } h.fx({ kind: 'splat', sq: j, dur: 9000, s: j * 7 }); }
      h.coins(side, 1, at);
      return n ? `eats a pomegranate and sprays seeds everywhere. ${n} enem${n === 1 ? 'y is' : 'ies are'} too sticky to move next turn` : 'eats a pomegranate. Very messy. +1 coin';
    } },
  marker: {
    name: 'Marker', verb: 'picks up a marker and draws a new piece', react: ['he can DRAW??', 'art diff', 'that\'s a terrible horse'],
    use(G, side, at, h) {
      const spots = I.area(at, 1).filter(j => j !== at && empty(G, j));
      if (!spots.length) { h.coins(side, 2, at); return 'picks up a marker but there\'s no room to draw. Sells it for 2 coins'; }
      const t = pick(DRAWABLE), j = pick(spots);
      G.board[j] = I.mkPiece(t, side); h.summon(j);
      return `picks up a marker and draws a ${U[t].name} next to itself. It's real now`;
    } },
  gem: {
    name: 'Gem', verb: 'finds a gem', react: ['SHINY', 'we\'re rich', 'bling bling'],
    use(G, side, at, h) {
      G.gems[side] = (G.gems[side] || 0) + 1;
      h.coins(side, 3, at);
      const p = G.board[at];
      if (G.gems[side] >= 3 && p.t !== 'K') {
        G.gems[side] = 0;
        const nt = p.t === 'Q' ? 'J' : 'Q';
        G.board[at] = { ...p, t: nt, mut: undefined };
        h.fx({ kind: 'spell', key: 'mutate', sq: at, dur: 1000 }); h.slam('ASCENDED', true);
        return `finds the third gem and ASCENDS into a ${U[nt].name}`;
      }
      return `finds a gem (+3 coins). ${G.gems[side]} of 3: the third one ascends whoever grabs it`;
    } },
  ring: {
    name: 'Wedding Ring', verb: 'finds a ring and gets married', react: ['YOU MAY KISS THE BRIDE', 'i\'m crying', 'they grow up so fast'],
    use(G, side, at, h) {
      const p = G.board[at];
      const near = I.area(at, 3).filter(j => j !== at && G.board[j] && G.board[j].s === side && G.board[j].t !== 'K')
        .sort((a, b) => dist(a, at) - dist(b, at));
      if (!near.length) { h.coins(side, 1, at); return 'proposes to nobody. Rejected by the entire board. Keeps the ring (+1 coin)'; }
      const j = near[0], q = G.board[j];
      if (p.t === 'K') {
        if (q.t !== 'Q') G.board[j] = { ...q, t: 'Q', mut: undefined };
        h.fx({ kind: 'spell', key: 'mutate', sq: j, dur: 1000 });
        return `proposes to the ${U[q.t].name}. Royal wedding! It becomes a Queen`;
      }
      G.board[at] = { ...p, ar: (p.ar || 0) + 1 }; G.board[j] = { ...q, ar: (q.ar || 0) + 1 };
      const spots = [...I.area(at, 1), ...I.area(j, 1)].filter(k => empty(G, k));
      let baby = '';
      if (spots.length) { const k = pick(spots), bt = pick(['P', 'chicken', 'duck', 'P']); G.board[k] = I.mkPiece(bt, side); h.summon(k); baby = ` A baby ${U[bt].name} is born`; }
      h.fx({ kind: 'text', sq: j, str: '♥', col: '#c0392b', delay: 200, dur: 1500 });
      return `marries the ${U[q.t].name}. They protect each other (+1 armour each).${baby}`;
    } },
  disco: {
    name: 'Disco Ball', verb: 'starts a dance party', react: ['DANCE PARTY', 'everybody\'s dancing', 'the floor is MOVING'],
    use(G, side, at, h) {
      let n = 0;
      for (const j of I.area(at, 2)) { const q = G.board[j]; if (q && q.s !== side && q.t !== 'K' && !(q.sh > 0)) { G.board[j] = { ...q, fz: Math.max(q.fz || 0, 1) }; n++; } if (q) h.fx({ kind: 'dance', sq: j, dur: 2200, delay: Math.random() * 200 }); }
      h.coins(side, 2, at);
      return `starts a dance party. ${n ? `${n} enem${n === 1 ? 'y' : 'ies'} can't stop dancing and miss${n === 1 ? 'es' : ''} a turn` : 'Nobody came'}. +2 coins from the door`;
    } },
  cake: {
    name: 'Birthday Cake', verb: 'has a birthday', react: ['HAPPY BIRTHDAY', 'he\'s all grown up', 'make a wish'],
    use(G, side, at, h) {
      const p = G.board[at], nt = AGE_UP[p.t];
      if (nt) { G.board[at] = { ...p, t: nt }; h.fx({ kind: 'spell', key: 'mutate', sq: at, dur: 900 }); return `has a birthday and grows up into a ${U[nt].name}`; }
      if (p.t === 'K') { h.coins(side, 4, at); return 'turns 1000 years old. Gets 4 coins in a card from his nan'; }
      G.board[at] = { ...p, ar: (p.ar || 0) + 1 };
      return 'has a birthday. Gets a nice jumper (+1 armour)';
    } },
};
const KEYS = Object.keys(ITEMS);
const dist = (a, b) => { const [r1, c1] = rc(a), [r2, c2] = rc(b); return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)); };

// drop a random item somewhere in the middle of the board
function spawn(G) {
  const opts = [];
  for (let i = 0; i < N * N; i++) { const r = i / N | 0; if (r >= 3 && r <= N - 4 && empty(G, i) && !G.items[i]) opts.push(i); }
  if (!opts.length) return -1;
  const at = pick(opts);
  G.items[at] = { k: pick(KEYS), born: performance.now() };
  return at;
}

// ---------------------------------------------------------------- art (same ballpoint style as the pieces)
const INK = '#1e1c24';
function drawItem(c, k, x, y, s, t, seed) {
  const bob = Math.sin(t / 380 + seed) * s * .05;
  c.save(); c.translate(x, y + bob); c.lineWidth = Math.max(1.4, s * .045); c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round';
  // shadow
  c.fillStyle = 'rgba(30,28,36,.16)'; c.beginPath(); c.ellipse(0, s * .32 - bob, s * .26, s * .07, 0, 0, 7); c.fill();
  const R = s * .24;
  if (k === 'pomegranate') {
    c.fillStyle = '#b8322b'; c.beginPath(); c.arc(0, s * .03, R, 0, 7); c.fill(); c.stroke();
    c.fillStyle = '#d9584a'; c.beginPath(); c.arc(-R * .35, -R * .25, R * .3, 0, 7); c.fill();
    c.beginPath(); c.moveTo(-R * .35, -R * .85); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .32; c.lineTo(Math.cos(a) * R * .5, -R * .9 + Math.sin(a) * R * .55 - R * .2 * (i % 2)); } c.lineTo(R * .35, -R * .85); c.fillStyle = '#7a1f1a'; c.fill(); c.stroke();
  } else if (k === 'marker') {
    c.rotate(-.6);
    c.fillStyle = '#f2eee2'; c.beginPath(); c.rect(-s * .07, -s * .26, s * .14, s * .4); c.fill(); c.stroke();
    c.fillStyle = '#3d7bd9'; c.beginPath(); c.rect(-s * .075, -s * .3, s * .15, s * .14); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-s * .07, s * .14); c.lineTo(-s * .03, s * .26); c.lineTo(s * .03, s * .26); c.lineTo(s * .07, s * .14); c.fillStyle = INK; c.fill();
    c.font = `bold ${Math.round(s * .09)}px sans-serif`; c.fillStyle = '#3d7bd9'; c.textAlign = 'center'; c.fillText('INK', 0, s * .03);
  } else if (k === 'gem') {
    const g = c.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#9ff0ec'); g.addColorStop(1, '#1aa7a1');
    c.fillStyle = g; c.beginPath(); c.moveTo(-R, -R * .2); c.lineTo(-R * .5, -R * .7); c.lineTo(R * .5, -R * .7); c.lineTo(R, -R * .2); c.lineTo(0, R * .95); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-R, -R * .2); c.lineTo(R, -R * .2); c.moveTo(-R * .5, -R * .7); c.lineTo(-R * .2, -R * .2); c.lineTo(0, R * .95); c.lineTo(R * .2, -R * .2); c.lineTo(R * .5, -R * .7); c.stroke();
    const tw = (Math.sin(t / 200 + seed) + 1) / 2; c.strokeStyle = `rgba(255,255,255,${tw})`; c.beginPath(); c.moveTo(R * .7, -R * 1.1); c.lineTo(R * .7, -R * .7); c.moveTo(R * .5, -R * .9); c.lineTo(R * .9, -R * .9); c.stroke();
  } else if (k === 'ring') {
    c.strokeStyle = '#c99a1c'; c.lineWidth = s * .07; c.beginPath(); c.ellipse(0, s * .06, R * .85, R * .7, 0, 0, 7); c.stroke();
    c.strokeStyle = INK; c.lineWidth = Math.max(1.2, s * .03); c.beginPath(); c.ellipse(0, s * .06, R * 1.0, R * .85, 0, 0, 7); c.stroke();
    c.fillStyle = '#bfe9f5'; c.beginPath(); c.moveTo(-R * .35, -R * .6); c.lineTo(0, -R * 1.15); c.lineTo(R * .35, -R * .6); c.lineTo(0, -R * .35); c.closePath(); c.fill(); c.stroke();
  } else if (k === 'disco') {
    c.strokeStyle = INK; c.beginPath(); c.moveTo(0, -R * 1.4); c.lineTo(0, -R); c.stroke();
    c.fillStyle = '#c9ccd6'; c.beginPath(); c.arc(0, 0, R, 0, 7); c.fill();
    c.save(); c.clip(); c.lineWidth = 1;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-R, i * R / 3.5); c.lineTo(R, i * R / 3.5); c.stroke(); const ox = Math.sin(t / 300) * R * .4; c.beginPath(); c.moveTo(i * R / 3.2 + ox, -R); c.lineTo(i * R / 3.2 + ox, R); c.stroke(); }
    for (let i = 0; i < 5; i++) { c.fillStyle = ['#f3d55b', '#e86ad6', '#5bd1f3', '#fff', '#7be06a'][i]; c.globalAlpha = (Math.sin(t / 150 + i * 1.7) + 1) / 2; c.fillRect(Math.cos(i * 2.3) * R * .55 - 2, Math.sin(i * 1.9) * R * .55 - 2, 4, 4); }
    c.restore(); c.globalAlpha = 1; c.beginPath(); c.arc(0, 0, R, 0, 7); c.stroke();
  } else if (k === 'cake') {
    c.fillStyle = '#f6e3c4'; c.beginPath(); c.rect(-R, -R * .25, R * 2, R * 1.05); c.fill(); c.stroke();
    c.fillStyle = '#e88bb0'; c.beginPath(); c.moveTo(-R, -R * .25); for (let i = 0; i <= 6; i++) c.lineTo(-R + i * R / 3, -R * .25 + (i % 2 ? R * .28 : 0)); c.lineTo(R, -R * .25); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#4a6fb0'; c.fillRect(-R * .08, -R * .85, R * .16, R * .6); c.strokeRect(-R * .08, -R * .85, R * .16, R * .6);
    const fl = 1 + Math.sin(t / 90 + seed) * .15; c.fillStyle = '#f3a52b'; c.beginPath(); c.ellipse(0, -R * 1.05, R * .12, R * .2 * fl, 0, 0, 7); c.fill();
  }
  c.restore();
}

I.ITEMS = { ITEMS, KEYS, spawn, drawItem };
})();
