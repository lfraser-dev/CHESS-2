/* Chess 2: the pieces talk. Speech bubble lines for moving, capturing, dying, check, idling and more. */
(() => {
'use strict';
const I = window.INK;
const pick = a => a[Math.floor(Math.random() * a.length)];

// things a piece might say when it moves or when it's just standing there, by unit
const BY = {
  P: ['bro I\'m literally a pawn', 'one day I\'ll be a queen', 'why am I always first', 'I have the high ground', 'forward! I guess', 'nobody respects the pawn', 'en passant me i dare you'],
  N: ['neigh', 'L shape gang', 'I don\'t even know how I move', 'horsey time', 'I go where I want'],
  B: ['diagonals only, I don\'t make the rules', 'bless you', 'I\'m slanted', 'pray for me', 'straight lines are for rooks'],
  R: ['I\'m a castle. A walking castle.', 'stone cold', 'straight to the point', 'castling? in this economy?'],
  Q: ['I\'m built different', 'move.', 'I do everything here', 'the king is useless btw', 'slay'],
  K: ['I\'ll stay back here, you guys go', 'protect me!!', 'I am the king. I move one square.', 'is it safe yet', 'I\'m baby'],
  chicken: ['bawk', 'BAWK', 'bawk bawk?'], cow: ['moo', 'MOOOO', 'moo (aggressively)'], duck: ['quack', 'squeak', 'quack quack'],
  goose: ['HONK', 'honk honk', 'I lay gold, respect me'], pigeon: ['coo', 'gimme your chips', 'coo coo'],
  grandma: ['back in my day we had 64 squares', 'have you eaten?', 'don\'t make me get the handbag', 'you look thin'],
  gnome: ['...', '......', '(stares)'], toaster: ['ding', 'toast is ready', 'beep'], vending: ['out of order', 'insert coin'],
  ghost: ['boo', 'ooooo', 'you can\'t hurt me'], skeleton: ['spooky', 'rattle rattle', 'I need milk'],
  ogre: ['SMASH', 'me hungry', 'onions'], ufo: ['beep boop', 'take me to your king', 'we come in peace (lie)'],
  dragon: ['rawr', 'I could burn this whole board'], D: ['rawr', 'I could burn this whole board'],
  pagoda: ['AAAAAAAAAA', 'AAAAAAAAAAAAAAA', 'AAA'], trolley: ['*squeak squeak*', 'clean up on aisle 5'],
  ninja: ['...', 'you didn\'t see me'], samurai: ['honour', 'my blade is ready'], vampire: ['I vant to take your rook'],
  werewolf: ['awoooo', 'it\'s not even a full moon'], keg: ['don\'t touch me', 'I\'m feeling explosive'],
  trooper: ['sir yes sir', 'reloading!', 'contact!'], sniper: ['one shot', 'got you in my sights'],
  medic: ['MEDIC! oh wait that\'s me', 'stay still'], blob: ['blorp', 'bloop'], egg: ['...', '*wobble*'],
};
const GENERIC = ['let\'s go', 'I\'m him', 'watch this', 'trust the process', 'ok ok ok', 'this is my moment', 'skill issue', 'easy', 'vibes', 'we move'];
const LINES = {
  capture: ['get out', 'sit down', 'who\'s next', 'too easy', 'nothing personal', 'bye bye', 'ratio', 'that\'s mine now', 'L + you\'re captured'],
  dying: ['tell my wife...', 'I regret nothing', 'not like this', 'it was worth it', 'avenge me', 'lag!!', 'I was AFK', 'unfair', 'bro what', 'see you in the box', 'I had a family'],
  check: ['AAAAAAA', 'HELP', 'THIS IS FINE', 'guards??', 'I didn\'t sign up for this', 'someone DO something', 'mum?'],
  checker: ['check, bozo', 'run.', 'king spotted', 'peekaboo'],
  win: ['gg', 'GG EZ', 'too easy', 'I\'m the goat'],
  lose: ['I\'m going to cry', 'rematch', 'my mouse slipped', 'I wasn\'t even trying'],
  item: ['mine now', 'ooh shiny', 'finders keepers', 'yoink', 'WHAT IS THIS'],
  special: ['watch this', 'secret technique', 'they\'re not ready', 'hold my drink', 'it\'s my turn to cook'],
  spawn: ['where am I', 'hello?', 'I just got here', 'what is this place'],
  armour: ['ha! armour', 'that tickled', 'nope'],
  boss: ['WHAT IS THAT', 'nope nope nope', 'we\'re all gonna die', 'run!!'],
};
function line(kind, t) {
  if (kind === 'move' || kind === 'idle') { const own = BY[t]; return own && Math.random() < .75 ? pick(own) : pick(GENERIC); }
  return pick(LINES[kind] || GENERIC);
}

// draw a hand-drawn speech bubble pointing at (x, y)
function drawBubble(c, text, x, y, cell, alpha, bounds, loud) {
  const fs = Math.max(15, Math.min(22, cell * .34)) * (loud ? 1.15 : 1);
  c.save(); c.globalAlpha = alpha;
  c.font = `${loud ? 'bold ' : ''}${Math.round(fs)}px 'Patrick Hand', 'Comic Sans MS', cursive`;
  const w = Math.min(c.measureText(text).width, cell * 5.5) + fs * .9, h = fs * 1.45;
  let bx = x - w / 2, by = y - cell * .55 - h - fs * .4;
  if (bounds) { bx = Math.max(bounds[0] + 2, Math.min(bounds[2] - w - 2, bx)); if (by < bounds[1] + 2) by = y + cell * .5 + fs * .4; }
  const below = by > y;
  c.fillStyle = loud ? '#fff4c2' : '#fffdf6'; c.strokeStyle = '#1e1c24'; c.lineWidth = Math.max(1.4, fs * .1); c.lineJoin = 'round';
  const r = h * .45;
  c.beginPath();
  c.moveTo(bx + r, by); c.lineTo(bx + w - r, by); c.quadraticCurveTo(bx + w, by, bx + w, by + r); c.lineTo(bx + w, by + h - r); c.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
  const tx = Math.max(bx + r + 4, Math.min(bx + w - r - 4, x));
  if (!below) { c.lineTo(tx + fs * .35, by + h); c.lineTo(tx - fs * .1, by + h + fs * .55); c.lineTo(tx - fs * .3, by + h); }
  c.lineTo(bx + r, by + h); c.quadraticCurveTo(bx, by + h, bx, by + h - r); c.lineTo(bx, by + r); c.quadraticCurveTo(bx, by, bx + r, by);
  if (below) { c.moveTo(tx - fs * .3, by); c.lineTo(tx - fs * .1, by - fs * .55); c.lineTo(tx + fs * .35, by); }
  c.closePath(); c.fill(); c.stroke();
  c.fillStyle = loud ? '#b3322b' : '#1e1c24'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, bx + w / 2, by + h / 2 + 1, w - fs * .6);
  c.restore();
}

I.TALK = { line, drawBubble, LINES, BY };
})();
