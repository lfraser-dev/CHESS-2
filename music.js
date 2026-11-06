/* Chess 2: the soundtrack. An original tune generated live with Web Audio (no files), that builds act by act:
   ACT I   plucky arpeggio
   ACT II  + bass
   ACT III + drums
   ACT IV  + lead melody, faster
   ACT V   + double-time hats, faster again
   BOSS    a darker progression, kicks on every beat and brass stabs
   Uses a small look-ahead scheduler, so it stays light on slow computers. */
(() => {
'use strict';
const I = window.INK;
// A minor, as semitones from A
const SCALE = [0, 2, 3, 5, 7, 8, 10];
const PROG = [[0, 'm'], [5, 'M'], [2, 'M'], [6, 'M']];          // Am  F  C  G   (scale degrees)
const BOSS_PROG = [[0, 'm'], [1, 'M'], [0, 'm'], [4, 'M']];     // Am  Bb  Am  E  (Bb borrowed, E major for tension)
const MOTIF = [0, null, 2, null, 4, null, 2, 1, null, 4, 5, 4, 2, null, 1, null];
const BOSS_MOTIF = [0, 0, null, 0, 1, null, 0, null, 4, null, 3, 2, 1, null, 0, null];
const A2 = 110;
const hz = semi => A2 * Math.pow(2, semi / 12);
const degSemi = (deg, prog = PROG) => { const o = Math.floor(deg / 7), d = ((deg % 7) + 7) % 7; return SCALE[d] + o * 12; };

let AC = null, out = null, timer = 0, on = true, level = 0, boss = false, step = 0, nextT = 0, noiseBuf = null, ducked = false;
const vol = () => (on && !ducked ? .55 : 0);

function chordFor(bar) {
  const pr = boss ? BOSS_PROG : PROG, [deg, q] = pr[bar % pr.length];
  // the borrowed Bb (degree 1 in the boss progression) is a semitone above A
  const root = boss && deg === 1 ? 1 : boss && deg === 4 ? 7 : degSemi(deg);
  const third = q === 'M' ? 4 : 3;
  return { root, notes: [root, root + third, root + 7] };
}
function voice(type, f, t, dur, v, dest, opts = {}) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (opts.att || .005)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (opts.lp) { const f2 = AC.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = opts.lp; o.connect(f2); node = f2; }
  node.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + .05);
}
function hit(t, dur, v, freq, type) {
  const n = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  n.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(out); n.start(t); n.stop(t + dur + .02);
}
function playStep(s, t, len) {
  const bar = Math.floor(s / 16), i = s % 16, ch = chordFor(bar);
  const lv = boss ? 5 : level;
  // arpeggio (always)
  if (!boss || i % 2 === 0) { const n = ch.notes[[0, 1, 2, 1][i % 4]] + 24 + (i >= 8 && lv >= 3 ? 12 : 0); voice('triangle', hz(n), t, len * 1.8, boss ? .05 : .07, out, { lp: 2400 }); }
  // bass
  if (lv >= 1) {
    if (boss ? i % 2 === 0 : (i === 0 || i === 6 || i === 8 || (lv >= 4 && i === 12) || i === 14)) {
      const oct = lv >= 4 && i % 4 === 2 ? 12 : 0;
      voice(lv >= 4 ? 'sawtooth' : 'square', hz(ch.root + oct), t, len * (boss ? 1.6 : 2.5), .07, out, { lp: lv >= 4 ? 700 : 450 });
    }
  }
  // drums
  if (lv >= 2) {
    const kick = boss ? i % 4 === 0 : (i === 0 || i === 8 || (lv >= 4 && i === 10));
    if (kick) voice('sine', 140, t, .22, .5, out, { slide: 40 });
    if (i === 4 || i === 12) { hit(t, .14, .22, 1800, 'bandpass'); voice('triangle', 190, t, .08, .08, out, { slide: 120 }); }
    const hat = lv >= 5 || boss ? true : i % 2 === 0;
    if (hat) hit(t, .04, i % 4 === 2 ? .09 : .05, 7000, 'highpass');
  }
  // lead melody
  if (lv >= 3) {
    const m = (boss ? BOSS_MOTIF : MOTIF)[i];
    if (m !== null && (bar % 2 === 1 || boss || lv >= 4)) {
      const base = boss ? ch.root : degSemi(m + PROG[bar % 4][0]) - degSemi(PROG[bar % 4][0]) + ch.root;
      const n = boss ? ch.root + [0, 1, 3, 5, 7, 8][m] + 24 : base + 24;
      voice('square', hz(n), t, len * 1.7, .035, out, { lp: 3000 });
    }
  }
  // brass stabs for the bosses
  if (boss && (i === 0 || i === 3 || i === 6)) for (const n of ch.notes) voice('sawtooth', hz(n + 12), t, len * 1.2, .03, out, { lp: 1600, att: .01 });
}
function tempo() { return boss ? 150 : [92, 96, 104, 118, 132, 140][Math.min(5, level)]; }
function tick() {
  if (!AC || AC.state !== 'running' || document.hidden) return;
  const len = 60 / tempo() / 4;
  if (nextT < AC.currentTime) nextT = AC.currentTime + .05;
  while (nextT < AC.currentTime + .25) { if (vol() > 0) playStep(step, nextT, len); step++; nextT += len; }
}
function start(ctx) {
  if (AC || !ctx) return;
  AC = ctx;
  out = AC.createGain(); out.gain.value = vol(); out.connect(AC.destination);
  noiseBuf = AC.createBuffer(1, AC.sampleRate * .3, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  nextT = AC.currentTime + .1;
  timer = setInterval(tick, 60);
}
const fade = () => { if (out) out.gain.setTargetAtTime(vol(), AC.currentTime, .3); };
function setLevel(l, isBoss) {
  const was = boss; level = Math.max(0, Math.min(5, l | 0)); boss = !!isBoss;
  if (boss !== was) step = Math.ceil(step / 16) * 16;   // switch songs on a bar line
}
function setOn(v) { on = !!v; fade(); }
function duck(v) { ducked = !!v; fade(); }
I.Music = { start, setLevel, setOn, duck, get on() { return on; } };
})();
