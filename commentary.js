/* Chess 2: the commentators. JIM does excited play-by-play, BARRY does deadpan colour commentary.
   line(event, ctx) gives { who, text }; placeholders: {A} acting side, {V} other side, {a} acting piece,
   {v} victim piece, {item}, {card}, {boss}, {act}. */
(() => {
'use strict';
const I = window.INK;
const pick = a => a[Math.floor(Math.random() * a.length)];
const JIM = {
  start: ['WELCOME, everybody, to CHESS 2! It is a beautiful day for absolute nonsense!', 'Good evening and welcome to Chess 2, where the rules are made up and the points don\'t matter!', 'We are LIVE! The pieces are on the board and nobody has read the rules!'],
  move: ['{A} moves the {a}. Interesting. Very interesting.', 'And the {a} is on the move!', '{A} pushes the {a} forward, the crowd is on its feet!', 'A quiet move from {A}. Too quiet.', 'The {a} goes for a little walk!'],
  capture: ['AND {A} TAKES THE {v}!', 'OH! The {a} just ate the {v}!', 'THE {v} IS GONE! {A} with the capture!', 'DOWN GOES THE {v}!', 'The {a} sends the {v} to the shadow realm!'],
  bigcapture: ['OH MY WORD! THE {v}! {A} HAS TAKEN THE {v}!', 'NO WAY! NO WAY! THE {v} HAS FALLEN!', 'THAT IS A MASSIVE CAPTURE! THE {v} IS DOWN!', 'UNBELIEVABLE SCENES! {V} HAS LOST THE {v}!'],
  check: ['CHECK! The king is in danger!', 'IT\'S CHECK! {V}\'s king is sweating!', 'Check from {A}! Somebody protect that king!'],
  blunder: ['OH NO. Oh no no no. {V} just walked the {v} straight into that!', 'That is a BLUNDER of historic proportions!', 'The {v} moved there just to die! Incredible!'],
  special: ['WHAT IS THIS? The {a} {verb}!', 'HE CAN DO THAT?! The {a} {verb}!', 'Special move! The {a} {verb}! The crowd has lost its mind!'],
  item: ['The {a} picks up a {item}! What will happen?!', 'A {item}! The {a} has found a {item}!', 'OOH, {A} grabs the {item}!'],
  card: ['{A} plays {card}!', 'And here comes {card}! Big card from {A}!', 'A card! {A} goes with {card}!'],
  nuke: ['HE\'S DONE IT! THE NUCLEAR OPTION! EVERYBODY GET DOWN!', 'A NUKE! IN A CHESS GAME! I HAVE SEEN EVERYTHING NOW!'],
  meteor: ['A METEOR! From SPACE! Right onto the {v}!', 'The sky has chosen violence! Goodbye, {v}!'],
  boss: ['WAIT, WHAT IS THAT? IT\'S {boss}! THE BOSS HAS ARRIVED!', 'OH NO. OH NO. {boss} HAS ENTERED THE ARENA!'],
  bossattack: ['{boss} is on the rampage!', 'Look at {boss} go! Nobody is safe!', '{boss} attacks! Pieces flying everywhere!'],
  bosshit: ['{A} lands a hit on {boss}!', 'BONK! The {a} smacks {boss}!', 'Right in the {boss}! Great hit from the {a}!'],
  bossdead: ['{boss} IS DEFEATED! {A} HAS SLAIN THE BEAST!', 'IT\'S OVER FOR {boss}! WHAT A HERO!'],
  act: ['We\'re into {act}, and things are getting WEIRD!', '{act}! The game has changed! Literally! The rules have changed!'],
  finale: ['THIS IS IT! THE FINALE! Everything is on fire and both kings have nukes!'],
  boring: ['Not much happening here, folks. I\'m going to go get a pie.', 'Twenty moves without a capture. My nan plays faster than this.'],
  mate: ['CHECKMATE! IT\'S ALL OVER! {A} WINS CHESS 2!', 'AND THAT IS CHECKMATE! WHAT. A. GAME!'],
  draw: ['It\'s a DRAW! Nobody wins! Everybody loses! Beautiful!'],
  friend: ['And here comes the reply from your friend!', 'Your friend has made their move, and WHAT a move!'],
  levelup: ['{a} HAS LEVELLED UP! {a} IS NOW A {lvl}!', 'LOOK AT THAT! {a}, a {lvl}! What a career!', 'A STAR IS BORN! {a} becomes a {lvl}!'],
  rip: ['NOOO! {v} HAS FALLEN!', 'And that\'s the end of {v}. What a servant to the board.', '{v} is gone! The crowd falls silent!'],
};
const BARRY = {
  start: ['I\'ve been doing this for thirty years, Jim. I\'ve never seen a chicken on a chessboard.', 'Should be a good one, Jim. Probably.'],
  move: ['Textbook, Jim. Well, a textbook. Not a good one.', 'I\'d have done the same thing. Then regretted it.', 'Bold.'],
  capture: ['He didn\'t need that {v} anyway, Jim.', 'That {v} had a family.', 'Brutal. Absolutely brutal.', 'Lovely technique on that.'],
  bigcapture: ['That\'s going to hurt in the morning.', 'I genuinely think {V} might cry, Jim.', 'You love to see it. Unless you\'re {V}.'],
  check: ['The king looks nervous, Jim. Look at his little face.', 'Kings are always like this. All talk.'],
  blunder: ['I\'ve seen better moves from a toaster, Jim. And there IS a toaster in this game.', 'I\'d have reported that move to the police.'],
  special: ['That\'s not in the rulebook, Jim.', 'Is that allowed? Nobody knows anymore.', 'Pure cinema.'],
  item: ['Why is there a {item} on a chessboard, Jim?', 'I\'m not even going to ask.'],
  card: ['Ah yes, {card}. A classic.', 'Interesting card choice. Wrong, but interesting.'],
  nuke: ['I think that might be against the Geneva Convention, Jim.', 'Well. That\'s the board gone.'],
  meteor: ['Unlucky. Cosmically unlucky.'],
  boss: ['I don\'t remember this being in chess, Jim.', 'We should probably leave, Jim.'],
  bossattack: ['That\'s not very sporting.', 'Somebody call security.'],
  bosshit: ['It felt that. Barely.', 'Keep hitting it, it\'ll get bored eventually.'],
  bossdead: ['Somebody get that piece a medal.', 'Never doubted them. Well, I doubted them a lot.'],
  act: ['I miss normal chess, Jim.', 'It only gets worse from here.'],
  finale: ['I\'ve lost my glasses, Jim. I think the meteor took them.'],
  boring: ['Wake me up when something explodes.'],
  mate: ['GG, as the young people say.', 'What a match. My heart can\'t take Chess 2.'],
  draw: ['Everybody gets a participation trophy.'],
  friend: ['Your friend\'s been practising, Jim.'],
  levelup: ['I remember when {a} was just a nobody, Jim.', 'Give that piece a pay rise.', 'They grow up so fast.'],
  rip: ['A moment\'s silence for {v}, please.', 'I had {v} on my fantasy team, Jim.', 'They\'ll be naming a square after {v}.'],
};
function fill(t, ctx) { return t.replace(/\{(\w+)\}/g, (m, k) => ctx[k] != null ? ctx[k] : m); }
function line(ev, ctx = {}, barry = false) { const pool = (barry ? BARRY : JIM)[ev]; return pool ? { who: barry ? 'BARRY' : 'JIM', text: fill(pick(pool), ctx) } : null; }

// talking out loud with the browser's built-in voices (if there are any)
let voices = [];
function loadVoices() { try { voices = (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch (e) { voices = []; } }
if (window.speechSynthesis) { loadVoices(); try { speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) { /* old browsers */ } }
function voiceFor(who) {
  const en = voices.filter(v => /^en/i.test(v.lang));
  if (!en.length) return null;
  const gb = en.filter(v => /GB|UK/i.test(v.lang) || /UK|British/i.test(v.name));
  const list = gb.length >= 2 ? gb : en;
  return list[who === 'JIM' ? 0 : Math.min(1, list.length - 1)] || null;
}
function speak(who, text, urgent) {
  if (!window.speechSynthesis) return;
  try {
    if (urgent) speechSynthesis.cancel();
    else if (speechSynthesis.pending || speechSynthesis.speaking) return;   // don't pile up a queue of old news
    const u = new SpeechSynthesisUtterance(text.replace(/[*]/g, ''));
    const v = voiceFor(who); if (v) u.voice = v;
    u.rate = who === 'JIM' ? 1.18 : .95; u.pitch = who === 'JIM' ? 1.25 : .7; u.volume = .9;
    speechSynthesis.speak(u);
  } catch (e) { /* no voice */ }
}
function hush() { try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
I.COMM = { line, speak, hush };
})();
