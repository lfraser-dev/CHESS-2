/* Chess 2: the meme layer.
   - The Brainrot meter climbs every turn. Each level is a new "act" and unlocks crazier special moves.
   - Every piece has special moves (INK.MEMES.specialsFor). They're applied to a copy of the state
     and only allowed if they don't leave your own king in check.
   - Captions ("White: *googles en passant*"), reactions and move annotations for every move. */
(() => {
'use strict';
const I = window.INK;
const { N, U, DIR8, ORTH, KN, rc, inB, other } = I;
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const blocked = (st, i) => I.solid(st.terr[i]);
const sq = (r, c) => inB(r, c) ? r * N + c : -1;
const hittable = p => p && p.t !== 'K' && !(p.sh > 0) && !U[p.t].untouchable;
const kill = (st, i, ev) => { const p = st.board[i]; if (!p || p.t === 'K') return null; st.board[i] = null; st.grave[p.s].push(p.t); ev.push({ type: 'destroy', sq: i, p }); return p; };
const near = (i, rad) => I.area(i, rad);
const isChess = t => ['P', 'N', 'B', 'R', 'Q', 'K'].includes(t);

// ---------------------------------------------------------------- the story
const TIERS = [
  { at: 0, act: 'ACT I', name: 'A Normal Game of Chess', sub: 'nothing weird is going to happen' },
  { at: 15, act: 'ACT II', name: 'Something Is Off', sub: 'the pieces have started getting ideas' },
  { at: 35, act: 'ACT III', name: 'Chess in Ohio', sub: 'the rules are more like suggestions now' },
  { at: 55, act: 'ACT IV', name: 'Total Brainrot', sub: 'nobody remembers how a knight moves' },
  { at: 75, act: 'ACT V', name: 'Completely Unhinged', sub: 'the board is legally a war zone' },
  { at: 100, act: 'THE FINALE', name: 'The Big Red Button', sub: 'both kings get a NUKE. Meteors every turn. Everything can self-destruct.' },
];
const tierOf = rot => { let t = 0; TIERS.forEach((x, i) => { if (rot >= x.at) t = i; }); return t; };
const RATE = { calm: 0, mild: .6, wild: 1, unhinged: 1.6 };

// ---------------------------------------------------------------- special moves
// targets(st, at, side) -> list of target squares (-1 = no target needed)
// apply(st, side, at, tg, ev, out) -> text for the log ("" = it failed)
const lineTo = (st, at, dr, dc, side) => { // squares a rook-ish slide reaches; stops at a blocker (captures enemies)
  const [r, c] = rc(at), out = [];
  for (let k = 1; k < N; k++) { const j = sq(r + dr * k, c + dc * k); if (j < 0 || blocked(st, j)) break; const q = st.board[j]; if (!q) { out.push(j); continue; } if (q.s !== side && hittable(q)) out.push(j); break; }
  return out;
};
const randomEmpty = (st, rows) => { const opts = []; for (let i = 0; i < N * N; i++) { const r = i / N | 0; if (rows.includes(r) && !st.board[i] && !blocked(st, i) && !(st.terr[i] && st.terr[i].k === 'portal')) opts.push(i); } return opts.length ? pick(opts) : -1; };

const SPECIALS = [
  // ---- pawns
  { key: 'holyhell', name: 'Google en passant', verb: 'googles en passant', tier: 1, who: t => t === 'P',
    react: ['HOLY HELL', 'new response just dropped', 'actual zombie'],
    targets: (st, at, s) => { const [r, c] = rc(at); return [sq(r, c - 1), sq(r, c + 1)].filter(j => j >= 0 && st.board[j] && st.board[j].s !== s && hittable(st.board[j])); },
    apply: (st, s, at, tg, ev) => { const p = kill(st, tg, ev); st.board[tg] = st.board[at]; st.board[at] = null; return `en passants the ${U[p.t].name} (it didn't even move twice)`; } },
  { key: 'airstrike', name: 'Call in an airstrike', verb: 'calls in an airstrike', tier: 3, who: t => t === 'P',
    react: ['AIRSTRIKE INBOUND', 'bro has connections', 'the pawn knows people'],
    targets: (st, at, s) => near(at, 4).filter(j => st.board[j] && st.board[j].s !== s && hittable(st.board[j])),
    apply: (st, s, at, tg, ev) => { const lost = []; for (const j of [tg, ...ORTH.map(([a, b]) => { const [r, c] = rc(tg); return sq(r + a, c + b); })]) if (j >= 0 && st.board[j] && st.board[j].s !== s && hittable(st.board[j])) lost.push(U[kill(st, j, ev).t].name); ev.push({ type: 'shell', sq: tg }); return `calls in an airstrike on ${lost.join(', ')}`; } },
  // ---- knights
  { key: 'offboard', name: 'Walk off the board', verb: 'walks off the board', tier: 1, who: t => t === 'N',
    react: ['where is he going', 'he\'ll be back. probably', 'bro left the game'],
    targets: () => [-1],
    apply: (st, s, at, tg, ev, out) => { out.limbo = { p: st.board[at], turns: 2, why: 'dimension' }; st.board[at] = null; ev.push({ type: 'spell', sq: at }); return 'walks off the edge of the board into another dimension. It comes back in 2 turns, somewhere in enemy territory'; } },
  { key: 'doublehorse', name: 'Double horsey', verb: 'does two horsey jumps at once', tier: 3, who: t => t === 'N',
    react: ['HORSEY GOES BRRR', 'two moves?? in this economy??', 'L shaped twice'],
    targets: (st, at, s) => { const [r, c] = rc(at), set = new Set(); for (const [a, b] of KN) for (const [d, e] of KN) { const j = sq(r + a + d, c + b + e); if (j < 0 || j === at || blocked(st, j)) continue; const q = st.board[j]; if (!q || (q.s !== s && hittable(q))) set.add(j); } return [...set]; },
    apply: (st, s, at, tg, ev) => { const q = st.board[tg]; let t = 'double-jumps'; if (q) t += ` onto the ${U[kill(st, tg, ev).t].name}`; st.board[tg] = st.board[at]; st.board[at] = null; return t; } },
  // ---- bishops
  { key: 'turn90', name: 'Turn 90 degrees', verb: 'turns 90 degrees and moves like a rook', tier: 1, who: t => t === 'B',
    react: ['bishop can do that??', 'illegal (allowed)', 'diagonal is so last season'],
    targets: (st, at, s) => ORTH.flatMap(([a, b]) => lineTo(st, at, a, b, s)),
    apply: (st, s, at, tg, ev) => { let t = 'slides straight'; if (st.board[tg]) t += ` into the ${U[kill(st, tg, ev).t].name}`; st.board[tg] = st.board[at]; st.board[at] = null; return t; } },
  { key: 'convert', name: 'Convert an enemy', verb: 'converts an enemy to the cause', tier: 3, who: t => t === 'B',
    react: ['he\'s been enlightened', 'TRAITOR', 'join us'],
    targets: (st, at, s) => near(at, 2).filter(j => st.board[j] && st.board[j].s !== s && hittable(st.board[j]) && st.board[j].t !== 'Q'),
    apply: (st, s, at, tg, ev) => { const p = st.board[tg]; st.board[tg] = { ...p, s, fz: 1 }; ev.push({ type: 'spell', sq: tg }); return `preaches at the ${U[p.t].name} until it switches sides`; } },
  // ---- rooks
  { key: 'castleany', name: 'Castle with anything', verb: 'castles with a random piece', tier: 1, who: t => t === 'R',
    react: ['castling 2: electric boogaloo', 'that\'s not how castling works', 'he\'s cooking'],
    targets: (st, at, s) => { const out = []; for (let j = 0; j < N * N; j++) { const q = st.board[j]; if (j !== at && q && q.s === s && q.t !== 'K') out.push(j); } return out; },
    apply: (st, s, at, tg) => { const a = st.board[at], b = st.board[tg]; st.board[at] = b; st.board[tg] = a; return `castles with the ${U[b.t].name} on the other side of the board`; } },
  { key: 'bowl', name: 'Roll across the board', verb: 'rolls across the board like a bowling ball', tier: 3, who: t => t === 'R',
    react: ['STRIKE!', 'bowling for pieces', 'he rolled'],
    targets: (st, at, s) => { const out = []; const [r, c] = rc(at); for (const [a, b] of ORTH) { let last = -1; for (let k = 1; k < N; k++) { const j = sq(r + a * k, c + b * k); if (j < 0 || blocked(st, j)) break; const q = st.board[j]; if (q && (q.s === s || !hittable(q))) break; last = j; } if (last >= 0 && Math.max(Math.abs(rc(last)[0] - r), Math.abs(rc(last)[1] - c)) >= 2) out.push(last); } return out; },
    apply: (st, s, at, tg, ev) => { const [r, c] = rc(at), [tr, tc] = rc(tg), a = Math.sign(tr - r), b = Math.sign(tc - c), hit = []; for (let k = 1; ; k++) { const j = sq(r + a * k, c + b * k); if (st.board[j]) hit.push(U[kill(st, j, ev).t].name); if (j === tg) break; } st.board[tg] = st.board[at]; st.board[at] = null; return hit.length ? `rolls straight through ${hit.join(', ')}` : 'rolls across the board for no reason'; } },
  // ---- queens
  { key: 'stealturn', name: 'Steal the next turn', verb: 'steals the next turn', tier: 2, who: t => t === 'Q', free: true,
    react: ['AND AGAIN', 'she said no', 'turn order is a social construct'],
    targets: () => [-1],
    apply: (st, s, at, tg, ev, out) => { out.extra = true; ev.push({ type: 'field', key: 'double' }); return 'steals the next turn (this doesn\'t use a move, and you go twice)'; } },
  { key: 'tantrum', name: 'Throw a tantrum', verb: 'throws a tantrum', tier: 4, who: t => t === 'Q',
    react: ['she\'s tweaking', 'EMOTIONAL DAMAGE', 'someone calm her down'],
    targets: (st, at, s) => near(at, 1).some(j => st.board[j] && st.board[j].s !== s && hittable(st.board[j])) ? [-1] : [],
    apply: (st, s, at, tg, ev) => { const hit = []; for (const j of near(at, 1)) if (j !== at && st.board[j] && st.board[j].s !== s && hittable(st.board[j])) hit.push(U[kill(st, j, ev).t].name); st.board[at] = { ...st.board[at], fz: 2 }; ev.push({ type: 'shell', sq: at }); return `throws a tantrum and flattens ${hit.join(', ')}, then needs a lie down`; } },
  // ---- kings
  { key: 'snack', name: 'Eat his own piece', verb: 'gets hungry and eats his own piece', tier: 1, who: t => t === 'K',
    react: ['bro was HUNGRY', 'he ate his own guy', 'cannibal king'],
    targets: (st, at, s) => near(at, 1).filter(j => j !== at && st.board[j] && st.board[j].s === s && st.board[j].t !== 'K'),
    apply: (st, s, at, tg, ev) => { const p = kill(st, tg, ev), g = 2 + 2 * (U[p.t].val || 1); st.coins[s] += g; ev.push({ type: 'coins', n: g }); return `eats his own ${U[p.t].name} and burps out ${g} coins`; } },
  { key: 'mum', name: 'Call his mum', verb: 'calls his mum', tier: 2, who: t => t === 'K',
    react: ['MUM COME PICK ME UP', 'she\'s here', 'grandma diff'],
    targets: (st, at) => near(at, 1).filter(j => !st.board[j] && !blocked(st, j)),
    apply: (st, s, at, tg, ev) => { st.board[tg] = I.mkPiece('grandma', s); ev.push({ type: 'summon', sq: tg, big: true }); return 'phones his mum. Grandma turns up with her handbag'; } },
  // ---- anyone (not kings)
  { key: 'griddy', name: 'Hit the griddy', verb: 'hits the griddy', tier: 1, who: t => t !== 'K',
    react: ['he\'s dancing', 'SHEESH', 'they can\'t look away'],
    targets: (st, at, s) => near(at, 1).some(j => st.board[j] && st.board[j].s !== s && hittable(st.board[j])) ? [-1] : [],
    apply: (st, s, at, tg, ev) => { let n = 0; for (const j of near(at, 1)) { const q = st.board[j]; if (j !== at && q && q.s !== s && hittable(q)) { st.board[j] = { ...q, fz: Math.max(q.fz || 0, 1) }; n++; } } ev.push({ type: 'spell', sq: at }); return `dances so hard that ${n} enem${n === 1 ? 'y stands' : 'ies stand'} there watching (frozen for a turn)`; } },
  { key: 'snacks', name: 'Go get snacks', verb: 'leaves to get snacks', tier: 2, who: t => t !== 'K' && t !== 'N',
    react: ['brb', 'he\'s getting snacks mid-game', 'touch grass arc'],
    targets: () => [-1],
    apply: (st, s, at, tg, ev, out) => { out.limbo = { p: st.board[at], turns: 2, why: 'snacks' }; st.board[at] = null; ev.push({ type: 'spell', sq: at }); return 'walks off the board to get snacks. Back in 2 turns with 3 coins'; } },
  { key: 'eat', name: 'Eat the piece next to it', verb: 'eats the piece next to it', tier: 3, who: t => t !== 'K',
    react: ['CRONCH', 'nom nom nom', 'he ate him'],
    targets: (st, at, s) => near(at, 1).filter(j => j !== at && st.board[j] && st.board[j].s !== s && hittable(st.board[j])),
    apply: (st, s, at, tg, ev) => `eats the ${U[kill(st, tg, ev).t].name} whole` },
  // ---- time rifts: any piece next to an open rift can jump into the past and erase an enemy from history
  { key: 'timetravel', name: 'Travel back in time', verb: 'jumps into the time rift and erases an enemy from history', tier: 0, who: t => t !== 'K', rift: true,
    react: ['IT NEVER EXISTED', 'butterfly effect', 'TIME PARADOX', 'he changed the timeline'],
    targets: (st, at, s) => {
      const R = st.rift; if (!R || !R.past) return [];
      const [r, c] = rc(at), [rr, rcc] = rc(R.at); if (Math.max(Math.abs(r - rr), Math.abs(c - rcc)) > 1) return [];
      const was = new Set(R.past.map(x => x[1]));
      const out = []; for (let j = 0; j < N * N; j++) { const q = st.board[j]; if (q && q.s !== s && hittable(q) && was.has(q.id)) out.push(j); } return out;
    },
    apply: (st, s, at, tg, ev, out) => { const q = st.board[tg]; st.board[tg] = null; st.grave[q.s].push(q.t); ev.push({ type: 'erase', sq: tg, p: q }); out.limbo = { p: st.board[at], turns: 2, why: 'time' }; st.board[at] = null; return `jumps into the time rift, goes back 10 turns and erases the ${U[q.t].name} from history. It never existed`; } },
  { key: 'selfdestruct', name: 'Self-destruct', verb: 'self-destructs', tier: 5, who: t => t !== 'K',
    react: ['GOODBYE CRUEL WORLD', 'he chose violence', 'kaboom'],
    targets: () => [-1],
    apply: (st, s, at, tg, ev) => { const hit = []; for (const j of near(at, 1)) if (j !== at && st.board[j] && hittable(st.board[j])) hit.push(U[kill(st, j, ev).t].name); kill(st, at, ev); ev.push({ type: 'shell', sq: at }); return `self-destructs${hit.length ? `, taking ${hit.join(', ')} with it` : ''}`; } },
];
const DESC = {
  holyhell: 'Pawn. Takes an enemy piece standing right beside it and moves into its square.',
  airstrike: 'Pawn. Bombs an enemy within 4 squares, plus any enemies right next to it.',
  offboard: 'Knight. Leaves the board for 2 turns, then drops back in somewhere in enemy territory.',
  doublehorse: 'Knight. Makes two knight jumps in one go, and can capture where it lands.',
  turn90: 'Bishop. Moves (and captures) in a straight line like a rook, just this once.',
  convert: 'Bishop. An enemy piece within 2 squares switches sides (not queens or kings). It is dizzy for a turn.',
  castleany: 'Rook. Swaps places with any of your pieces, anywhere on the board.',
  bowl: 'Rook. Rolls in a straight line to the end, flattening every enemy piece in the way.',
  stealturn: 'Queen. Free: doesn\'t use your move, and you get two moves in a row.',
  tantrum: 'Queen. Destroys every enemy piece next to her, then she can\'t move for 2 turns.',
  snack: 'King. Eats one of his own pieces next to him and burps out coins.',
  mum: 'King. Grandma turns up on an empty square next to him.',
  griddy: 'Any piece but the king. Every enemy next to it is frozen for a turn watching.',
  snacks: 'Any piece but kings and knights. Leaves for 2 turns and comes back home with 3 coins.',
  eat: 'Any piece but the king. Eats an enemy piece right next to it.',
  selfdestruct: 'Any piece but the king, finale only. Blows itself up and everything next to it.',
};
SPECIALS.forEach(s => { s.desc = DESC[s.key]; });
const BY_KEY = Object.fromEntries(SPECIALS.map(s => [s.key, s]));

// try a special on a copy of the state; returns null if it's not allowed
function trySpecial(G, side, at, key, tg) {
  const sp = BY_KEY[key], p = G.board[at];
  if (!sp || !p || p.s !== side || (p.fz > 0 && sp.key !== 'selfdestruct')) return null;
  const st = I.cloneState(G), ev = [], out = {};
  const text = sp.apply(st, side, at, tg, ev, out);
  if (!text) return null;
  I.setEnv(st);
  const ok = !I.inCheck(st.board, side);
  I.setEnv(G);
  return ok ? { st, ev, out, text, sp } : null;
}
// specials that piece can use right now: [{ sp, opts: [target squares] }]
function specialsFor(G, at, side) {
  const p = G.board[at]; if (!p || p.s !== side) return [];
  const tier = tierOf(G.rot || 0), res = [];
  for (const sp of SPECIALS) {
    if (sp.tier > tier || !sp.who(p.t)) continue;
    if (sp.tier >= 5 && !G.finale) continue;
    if (sp.key === 'stealturn' && G.extra) continue;
    if (sp.rift && !G.rift) continue;
    const opts = sp.targets(G, at, side).filter(tg => trySpecial(G, side, at, sp.key, tg));
    if (opts.length) res.push({ sp, opts });
  }
  return res;
}
// every special move a side could make (for the Ink Baron)
function allSpecials(G, side) {
  const out = [];
  for (let i = 0; i < N * N; i++) { const p = G.board[i]; if (p && p.s === side) for (const { sp, opts } of specialsFor(G, i, side)) for (const tg of opts) out.push({ at: i, key: sp.key, tg }); }
  return out;
}
// the big finale: meteors every turn. Returns the square hit (or -1)
function meteor(G, toMove) {
  for (let tries = 0; tries < 14; tries++) {
    const i = rnd(N * N), p = G.board[i];
    if (p && (p.t === 'K' || !hittable(p))) continue;
    const st = I.cloneState(G), ev = [];
    if (p) kill(st, i, ev);
    if (!st.terr[i]) st.terr[i] = { k: 'fire', n: 3 };
    I.setEnv(st);
    const bad = I.inCheck(st.board, other(toMove));
    I.setEnv(G);
    if (bad) continue;
    return { sq: i, st, p };
  }
  return null;
}

// ---------------------------------------------------------------- captions
const SIDE = s => s === 'w' ? 'White' : 'Black';
const WALK = ['moonwalks', 'struts', 'tiptoes', 'power walks', 'crab walks', 'skedaddles', 'vibes', 'sneaks', 'does a little shuffle', 'slides in', 'zooms', 'saunters', 'marches', 'rolls', 'hops', 'speedruns'];
const EAT = ['eats', 'deletes', 'yeets', 'obliterates', 'sends to the shadow realm', 'bonks', 'uninstalls', 'evicts', 'cancels', 'returns to sender', 'absolutely cooks', 'flattens', 'clears', 'violates the Geneva convention against'];
const REACT = {
  bigcap: ['NOOOOO', 'it\'s so over', 'EMOTIONAL DAMAGE', 'BRO WHAT', 'not like this', 'he\'s him'],
  cap: ['sheesh', 'cronch', 'ouch', 'get rekt', 'skill issue', 'L'],
  check: ['CHECK.', 'uh oh', 'he\'s cooking', 'king is sweating'],
  chaos: ['bro what', 'nah', 'who did this', 'the devs are drunk', 'it\'s getting worse'],
  annot: [['!!', 'Brilliant', '#1aa7a1'], ['??', 'Blunder', '#c0392b'], ['?!', 'Dubious', '#d08b16'], ['!', 'Great move', '#3d7bd9'], ['📖', 'Book move', '#8a6e4b']],
};
function moveCaption(side, mover, cap, tier, check) {
  const n = U[mover.t].name;
  let text;
  if (cap) text = tier === 0 ? `takes ${U[cap.t].name}` : `${n} ${pick(EAT)} the ${U[cap.t].name}`;
  else text = tier === 0 ? `moves ${n}` : `${n} ${pick(WALK)}`;
  if (check) text += tier >= 2 ? ' and says CHECK' : ', check';
  let react = null;
  if (cap && (U[cap.t].val >= 5 || cap.t === 'Q')) react = pick(REACT.bigcap);
  else if (check && Math.random() < .5 + tier * .1) react = pick(REACT.check);
  else if (cap && Math.random() < .25 + tier * .12) react = pick(REACT.cap);
  let annot = null;
  if (Math.random() < .12 + tier * .08) annot = cap && U[cap.t].val >= 5 ? REACT.annot[0] : pick(REACT.annot);
  return { text: `${SIDE(side)}: *${text}*`, react, annot };
}

I.MEMES = { TIERS, tierOf, RATE, SPECIALS, BY_KEY, trySpecial, specialsFor, allSpecials, meteor, moveCaption, SIDE, REACT, pick };
})();
