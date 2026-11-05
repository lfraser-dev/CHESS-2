/* Chess 2 battle cam: a quick comic-book close-up whenever one piece takes another.
   INK.Battle.play(canvas, { att, def, armour, gain, snd }) -> Promise (resolves when done or skipped)
   INK.Battle.style(type, ranged) -> how a unit attacks (used by the board animations too). */
(() => {
'use strict';
const I = window.INK;
const { INK: K, PAPER, RED, GOLD, BLUE, ORANGE, GREEN } = I.COL;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const easeIn = k => k * k * k;
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeOutBack = k => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

// ------------------------------------------------------------------ how each unit fights
// kind: melee move | dash | stomp | fire | bite | beam | shot (bullet) | arrow | lob (arcing) | flame | grab | hex | scream | strike
const MELEE = {
  K: ['bonk', 'BONK!'], Q: ['slash', 'SLASH!'], B: ['whack', 'WHACK!'], R: ['slam', 'SLAM!'], N: ['kick', 'KICK!'], P: ['poke', 'POKE!'],
  T: ['crush', 'CRUNCH!'], siegetank: ['crush', 'CRUNCH!'], bulldozer: ['crush', 'SHOVE!'], trolley: ['crush', 'CRASH!'],
  golem: ['smash', 'SMASH!'], ogre: ['smash', 'THWOMP!'], grandma: ['whack', 'WHACK!'], mech: ['smash', 'KLANK!'], titan: ['stomp', 'STOMP!'], lizard: ['stomp', 'STOMP!'],
  D: ['fire', 'FWOOSH!'], phoenix: ['fire', 'FWOOSH!'], J: ['missile', 'KA-BLAM!'], heli: ['missile', 'BRRRAP!'], gunship: ['missile', 'BRRRT!'],
  Z: ['hex', 'ZAP!'], samurai: ['slash', 'SHING!'], ninja: ['slash', 'SHHK!'], werewolf: ['claw', 'RAKE!'], vampire: ['bite', 'CHOMP!'],
  blob: ['bite', 'GLORP!'], ufo: ['beam', 'ZWOOP!'], jester: ['bonk', 'HONK!'], skeleton: ['poke', 'RATTLE!'], pogo: ['stomp', 'BOING!'],
  voidknight: ['slash', 'CRUNCH!'], captain: ['slash', 'ARRR!'], bandit: ['kick', 'YEEHAW!'], vacuum: ['bite', 'SHLUUURP!'],
};
const RANGED = {
  A: ['arrow', 'THWIP!'], C: ['lob', 'THUNK!'], mortar: ['lob', 'WHUMP!'], toaster: ['lob', 'POP!'], cannon: ['shell', 'BOOM!'],
  siegetank: ['shell', 'BOOM!'], titan: ['shell', 'KA-CHUNK!'], trooper: ['shot', 'BLAM!'], sniper: ['shot', 'CRACK!'],
  sheriff: ['shot', 'BANG!'], stranger: ['shot', 'BANG!'], gunship: ['shot', 'BRRRT!'], mech: ['shot', 'BLAM!'],
  flamer: ['flame', 'FWOOSH!'], kraken: ['grab', 'SHLURP!'], tentacle: ['grab', 'SHLURP!'], necro: ['hex', 'HEX!'],
  pagoda: ['scream', 'AAAAAH!'], assassin: ['strike', 'SHHK!'],
};
function style(t, ranged) {
  const r = ranged ? RANGED[t] : MELEE[t];
  if (r) return { kind: r[0], word: r[1] };
  return ranged ? { kind: 'shot', word: 'BLAM!' } : { kind: 'slash', word: 'WHAM!' };
}
const isRangedKind = k => ['arrow', 'lob', 'shell', 'shot', 'flame', 'grab', 'hex', 'scream', 'beam', 'missile'].includes(k);
const IMPACT_SND = { arrow: 'twang', lob: 'boom', shell: 'boom', shot: 'hit', flame: 'boom', grab: 'hit', hex: 'spell', scream: 'scream', missile: 'boom', fire: 'boom', beam: 'spell', crush: 'boom', stomp: 'boom', smash: 'boom' };

// ------------------------------------------------------------------ drawing helpers
function unit(c, t, side, x, y, sz, face, seed, rot = 0, alpha = 1, squash = 1) {
  c.save(); c.globalAlpha *= alpha;
  c.translate(x, y); c.rotate(rot);
  const k = sz / 62; c.scale(face * k / squash, k * squash);
  c.strokeStyle = K; c.lineJoin = 'round'; c.lineCap = 'round'; c.lineWidth = 2.4;
  I.ART[t](c, side === 'w' ? PAPER : K, side === 'w' ? K : PAPER, seed);
  c.restore();
}
function cracks(c, x, y, sz, seed, side, amount) {
  c.save(); c.strokeStyle = side === 'b' ? '#ffe2a8' : K; c.lineWidth = Math.max(1.5, sz / 34);
  const n = Math.round(2 + amount * 3);
  for (let k = 0; k < n; k++) {
    let px = x + (I.hash(seed + k) - .5) * sz * .3, py = y - sz * (.2 + I.hash(seed + k + 4) * .45);
    c.beginPath(); c.moveTo(px, py);
    for (let j = 0; j < 4; j++) { px += (I.hash(seed + k * 9 + j) - .5) * sz * .22; py += sz * .07; c.lineTo(px, py); }
    c.stroke();
  }
  c.restore();
}
function burst(c, x, y, r0, r1, n, col, w, seed) {
  c.save(); c.strokeStyle = col; c.lineWidth = w;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + I.hash(seed + i) * .3, l = r0 + (r1 - r0) * (.5 + I.hash(seed + i + 7) * .5);
    c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke();
  }
  c.restore();
}
function starburst(c, x, y, r, spikes, fill, seed) {
  c.beginPath();
  for (let i = 0; i <= spikes * 2; i++) { const a = i / (spikes * 2) * Math.PI * 2, rr = i % 2 ? r * (.5 + I.hash(seed + i) * .15) : r * (.9 + I.hash(seed + i) * .2); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = K; c.lineWidth = 3; c.stroke();
}
function word(c, txt, x, y, size, rot, fill, alpha = 1) {
  c.save(); c.globalAlpha = alpha; c.translate(x, y); c.rotate(rot);
  c.font = `${Math.round(size)}px 'Permanent Marker', 'Patrick Hand', Impact, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = size * .22; c.strokeStyle = K; c.strokeText(txt, 0, 0);
  c.fillStyle = fill; c.fillText(txt, 0, 0);
  c.lineWidth = size * .05; c.strokeStyle = 'rgba(255,255,255,.6)'; c.strokeText(txt, -size * .03, -size * .03);
  c.restore();
}
function speedLines(c, x0, y0, x1, y1, n, dir, t, alpha, seed) {
  c.save(); c.globalAlpha = alpha; c.strokeStyle = K;
  for (let i = 0; i < n; i++) {
    const y = y0 + (y1 - y0) * I.hash(seed + i), len = (x1 - x0) * (.15 + I.hash(seed + i + 3) * .35);
    const x = x0 + ((I.hash(seed + i + 9) * (x1 - x0) + t * dir * (x1 - x0) * 3) % (x1 - x0) + (x1 - x0)) % (x1 - x0);
    c.lineWidth = 1 + I.hash(seed + i + 5) * 2.5;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - dir * len, y); c.stroke();
  }
  c.restore();
}

// ------------------------------------------------------------------ the scene
function draw(c, W, H, ms, o) {
  const S = Math.min(W, H);
  c.clearRect(0, 0, W, H);
  const IN = 170, OUT = o.total - 240;
  const open = ms < IN ? easeOut(ms / IN) : ms > OUT ? 1 - easeIn(seg(ms, OUT, o.total)) : 1;
  // dim the board behind
  c.fillStyle = `rgba(20,18,24,${.55 * open})`; c.fillRect(0, 0, W, H);
  // the panel: a slanted strip across the middle
  const ph = H * .6, py = (H - ph) / 2, sl = W * .06;
  const hw = W / 2 * open + sl;
  c.save();
  if (o.shake) c.translate((Math.random() - .5) * o.shake, (Math.random() - .5) * o.shake);
  c.beginPath(); c.moveTo(W / 2 - hw + sl, py); c.lineTo(W / 2 + hw, py); c.lineTo(W / 2 + hw - sl, py + ph); c.lineTo(W / 2 - hw, py + ph); c.closePath();
  c.save(); c.fillStyle = K; c.translate(6, 8); c.fill(); c.restore();
  c.save(); c.clip();
  const inverted = o.impactFrame;
  c.fillStyle = inverted ? K : PAPER; c.fillRect(0, 0, W, H);
  // background: ruled lines and a sunburst behind the impact point
  if (!inverted) {
    c.strokeStyle = 'rgba(84,128,196,0.2)'; c.lineWidth = 1;
    for (let y = py + 14; y < py + ph; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.save(); c.globalAlpha = .08 + .1 * o.energy; c.fillStyle = o.attSide === 'w' ? GOLD : RED;
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2 + ms / 2000; c.beginPath(); c.moveTo(o.hitX, py + ph * .55); c.lineTo(o.hitX + Math.cos(a) * W, py + ph * .55 + Math.sin(a) * W); c.lineTo(o.hitX + Math.cos(a + .1) * W, py + ph * .55 + Math.sin(a + .1) * W); c.closePath(); c.fill(); }
    c.restore();
  }
  // ground
  const gy = py + ph * .82;
  c.strokeStyle = inverted ? PAPER : K; c.lineWidth = 3; c.beginPath(); c.moveTo(0, gy + 2); c.lineTo(W, gy - 2); c.stroke();
  c.lineWidth = 1.2; for (let i = 0; i < 12; i++) { const x = I.hash(i + 30) * W; c.beginPath(); c.moveTo(x, gy + 8 + I.hash(i) * 14); c.lineTo(x + 14 + I.hash(i + 2) * 20, gy + 8 + I.hash(i) * 14); c.stroke(); }
  if (o.speed > 0) speedLines(c, 0, py, W, py + ph * .8, 26, o.speedDir, ms / 1000, o.speed * (inverted ? .6 : .5), 11);
  o.paint(c, { W, H, S, py, ph, gy, inverted, ms });
  c.restore();
  // panel border
  c.lineWidth = 5; c.strokeStyle = K; c.stroke();
  c.lineWidth = 2; c.strokeStyle = PAPER; c.beginPath(); c.moveTo(W / 2 - hw + sl + 8, py + 6); c.lineTo(W / 2 + hw - 6, py + 6); c.stroke();
  c.restore();
  // name tags
  if (open > .6) {
    const a = seg(ms, IN, IN + 150) * (ms > OUT ? 1 - seg(ms, OUT, OUT + 120) : 1), fs = Math.max(13, S * .042);
    c.save(); c.globalAlpha = a;
    tag(c, o.attName, W * .06, py - fs * .9, fs, o.attSide, -.04);
    tag(c, o.defName, W * .94, py + ph + fs * .9, fs, o.defSide, -.04, true);
    c.restore();
  }
}
function tag(c, txt, x, y, fs, side, rot, right) {
  c.save(); c.translate(x, y); c.rotate(rot);
  c.font = `${Math.round(fs)}px 'Permanent Marker', 'Patrick Hand', sans-serif`; c.textBaseline = 'middle'; c.textAlign = right ? 'right' : 'left';
  const w = c.measureText(txt).width, pad = fs * .4, bx = right ? -w - pad : -pad;
  c.fillStyle = side === 'w' ? PAPER : K; c.strokeStyle = K; c.lineWidth = 3;
  c.beginPath(); c.rect(bx, -fs * .75, w + pad * 2, fs * 1.5); c.fill(); c.stroke();
  c.fillStyle = side === 'w' ? K : PAPER; c.fillText(txt, 0, fs * .04);
  c.restore();
}

// ------------------------------------------------------------------ playing it
function play(canvas, opts) {
  const { att, def, armour, gain } = opts;
  const snd = opts.snd || (() => {});
  const ranged = !!opts.ranged;
  const st = style(att.t, ranged);
  const kind = st.kind, isRanged = ranged || isRangedKind(kind);
  const TOTAL = 1650, WIND = 460, HIT = 760;   // ms
  const label = p => { const n = I.U[p.t].name, who = opts.names ? opts.names[p.s] : ''; return who === 'You' ? `Your ${n}` : who === 'The Ink Baron' ? `Baron's ${n}` : who ? `${who} ${n.replace(/^The /, '')}` : n; };
  return new Promise(resolve => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2), W = Math.max(200, rect.width), H = Math.max(160, rect.height);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const c = canvas.getContext('2d');
    canvas.hidden = false;
    let done = false, t0 = performance.now(), whoosh = false, hitSnd = false, slowAcc = 0, last = t0;
    const finish = () => { if (done) return; done = true; canvas.hidden = true; canvas.onclick = null; resolve(); };
    canvas.onclick = finish;
    const particles = [];
    const seedP = (x, y, dir, n, col) => { for (let i = 0; i < n; i++) particles.push({ x, y, vx: dir * (200 + Math.random() * 700) * (Math.random() < .25 ? -.4 : 1), vy: -150 - Math.random() * 600, r: 2 + Math.random() * 7, col: Math.random() < .6 ? col : K, spin: Math.random() * 6 }); };
    let seeded = false;
    const frame = now => {
      if (done) return;
      // slow motion just after the hit
      const real = now - last; last = now;
      const msRaw = now - t0;
      const slow = slowAcc > HIT && slowAcc < HIT + 140 ? .35 : 1;
      slowAcc += real * slow;
      const ms = Math.min(slowAcc, TOTAL);
      if (ms >= TOTAL) { finish(); return; }
      if (!whoosh && ms > WIND - 60) { whoosh = true; snd(isRanged ? (kind === 'lob' || kind === 'shell' ? 'boom' : kind === 'arrow' ? 'twang' : 'tap') : 'whoosh'); }
      if (!hitSnd && ms >= HIT) { hitSnd = true; snd(armour ? 'clang' : (IMPACT_SND[kind] || 'hit')); if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {} }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const impactFrame = ms >= HIT && ms < HIT + 75;
      const shake = ms >= HIT && ms < HIT + 260 ? (1 - (ms - HIT) / 260) * Math.min(W, H) * .025 : 0;
      const xA = W * .26, xD = W * .74;
      const energy = seg(ms, 200, HIT) * (1 - seg(ms, HIT + 300, TOTAL));
      draw(c, W, H, ms, {
        total: TOTAL, impactFrame, shake, energy, hitX: xD, attSide: att.s, defSide: def.s,
        attName: label(att), defName: label(def),
        speed: !isRanged && ms > WIND && ms < HIT + 120 ? 1 : 0, speedDir: 1,
        paint: (c, g) => {
          const sz = g.ph * .62, fy = g.gy;
          const inv = g.inverted, line = inv ? PAPER : K;
          // ---- attacker
          let ax = xA, ay = fy, arot = 0, asq = 1;
          if (ms < WIND) { const k = seg(ms, 180, WIND); arot = -.16 * easeOut(k); asq = 1 - .1 * easeOut(k); ax = xA - sz * .12 * easeOut(k); }
          if (!isRanged) {
            if (ms >= WIND && ms < HIT) { const k = easeIn(seg(ms, WIND, HIT)); ax = lerp(xA - sz * .12, xD - sz * .62, k); arot = .1; asq = 1.08;
              for (let g2 = 1; g2 <= 4; g2++) unit(c, att.t, att.s, ax - g2 * sz * .16, ay - (kind === 'stomp' || kind === 'kick' ? Math.sin(k * Math.PI) * sz * .25 : 0), sz, 1, att.id, arot, .18 / g2 * 2.5); }
            else if (ms >= HIT) { const k = seg(ms, HIT, HIT + 500); ax = lerp(xD - sz * .62, xA + sz * .35, easeOut(k)); arot = lerp(.1, 0, k); asq = lerp(.88, 1, easeOutBack(k)); }
            if ((kind === 'stomp' || kind === 'kick') && ms >= WIND && ms < HIT) ay = fy - Math.sin(seg(ms, WIND, HIT) * Math.PI) * sz * .35;
          } else if (ms >= WIND && ms < WIND + 160) { const k = seg(ms, WIND, WIND + 160); ax = xA - sz * .1 * (1 - k) - sz * .06 * Math.sin(k * Math.PI); arot = -.06 * (1 - k); }
          // ---- defender
          let dx = xD, dy = fy, drot = 0, dalpha = 1, dsq = 1;
          if (ms < HIT && ms > 200) { dx = xD + Math.sin(ms / 30) * (ms > WIND ? 2 : .8); }
          if (ms >= HIT) {
            const k = seg(ms, HIT, TOTAL - 200);
            if (armour) { dx = xD + Math.sin(k * Math.PI) * sz * .22; drot = Math.sin(k * Math.PI * 3) * .12 * (1 - k); dsq = 1 - .1 * Math.sin(k * Math.PI); }
            else if (kind === 'grab' || kind === 'beam') { dy = kind === 'grab' ? fy + easeIn(k) * sz * 1.2 : fy - easeIn(k) * sz * 1.6; drot = kind === 'grab' ? Math.sin(k * 12) * .2 : 0; dalpha = 1 - seg(k, .5, 1); dsq = kind === 'beam' ? 1 + k * .4 : 1; }
            else { dx = xD + easeOut(k) * W * .45; dy = fy - Math.sin(Math.min(1, k * 1.4) * Math.PI) * sz * .8 + easeIn(k) * sz * .3; drot = easeOut(k) * 5.5; dalpha = 1 - seg(k, .65, 1); }
          }
          // projectile / effect between them
          if (isRanged && ms >= WIND && ms < HIT + 40) drawProjectile(c, kind, xA + sz * .3, fy - sz * .45, xD - sz * .1, fy - sz * .45, seg(ms, WIND + 60, HIT), sz, line);
          if (!isRanged && kind === 'fire' && ms > WIND - 80 && ms < HIT + 200) drawProjectile(c, 'flame', ax + sz * .3, fy - sz * .55, xD - sz * .1, fy - sz * .45, seg(ms, WIND - 80, HIT), sz, line);
          if (!isRanged && kind === 'missile' && ms >= WIND - 100 && ms < HIT) drawProjectile(c, 'missile', ax + sz * .3, fy - sz * .55, xD, fy - sz * .45, seg(ms, WIND - 100, HIT), sz, line);
          // the units (silhouettes in the impact frame)
          c.save();
          if (inv) c.filter = 'invert(1)';
          unit(c, def.t, def.s, dx, dy, sz, -1, def.id, drot, dalpha, dsq);
          if (ms >= HIT && !armour && kind !== 'grab' && kind !== 'beam') cracks(c, dx, dy, sz, def.id * 7, def.s, seg(ms, HIT, HIT + 200));
          unit(c, att.t, att.s, ax, ay, sz, 1, att.id, arot, 1, asq);
          c.restore();
          // grab: a tentacle wrapping the defender
          if (kind === 'grab' && ms >= WIND) drawTentacle(c, xA + sz * .2, fy, dx, dy - sz * .35, seg(ms, WIND, HIT), sz, line);
          if (kind === 'beam' && ms >= WIND) { c.save(); c.globalAlpha = .35 * (1 - seg(ms, TOTAL - 300, TOTAL)); c.fillStyle = '#f3e36a'; c.beginPath(); c.moveTo(dx - sz * .2, g.py); c.lineTo(dx + sz * .2, g.py); c.lineTo(dx + sz * .5, fy); c.lineTo(dx - sz * .5, fy); c.closePath(); c.fill(); c.restore(); }
          // impact
          if (ms >= HIT) {
            const k = seg(ms, HIT, HIT + 260), hx = armour ? xD - sz * .2 : xD - sz * .15, hy = fy - sz * .45;
            if (!seeded) { seeded = true; seedP(hx, hy, armour ? -1 : 1, armour ? 18 : 30, armour ? GOLD : (def.s === 'w' ? '#e9e1cf' : RED)); }
            if (k < 1) {
              c.save(); c.globalAlpha = 1 - k * k;
              starburst(c, hx, hy, sz * (.16 + .2 * easeOut(k)), 12, armour ? '#fff3c4' : (inv ? PAPER : '#fff6d8'), 5 + Math.floor(ms / 60));
              c.restore();
            }
            const k2 = seg(ms, HIT, HIT + 420);
            if (k2 < 1) burst(c, hx, hy, sz * (.25 + .35 * k2), sz * (.6 + .9 * k2), 22, inv ? PAPER : K, 3 * (1 - k2) + 1, 9);
            if (armour) drawArmourChip(c, hx, hy, seg(ms, HIT, HIT + 600), sz);
          }
          // particles: ink drops, chips, sparks
          for (const p of particles) {
            const tt = Math.max(0, (ms - HIT) / 1000);
            const x = p.x + p.vx * tt, y = p.y + p.vy * tt + 1400 * tt * tt;
            if (y > fy + 6) continue;
            c.save(); c.translate(x, y); c.rotate(p.spin * tt * 4); c.fillStyle = p.col; c.strokeStyle = line; c.lineWidth = 1;
            if (armour) { c.fillRect(-p.r * .3, -p.r, p.r * .6, p.r * 2); }
            else { c.beginPath(); c.ellipse(0, 0, p.r, p.r * .7, 0, 0, Math.PI * 2); c.fill(); }
            c.restore();
          }
          // the word
          if (ms >= HIT - 10) {
            const k = seg(ms, HIT, HIT + 160), fade = 1 - seg(ms, TOTAL - 330, TOTAL - 120);
            const fsz = sz * .42 * (k < 1 ? .6 + .7 * easeOutBack(k) : 1.3 - seg(ms, HIT + 160, TOTAL) * .15);
            word(c, armour ? 'CLANG!' : st.word, W * .5 + (armour ? -sz * .2 : sz * .1), g.py + g.ph * .24, fsz, -.12, armour ? '#d8dde6' : (att.s === 'w' ? '#f3d55b' : '#e8562b'), fade);
          }
          if (gain && ms > HIT + 250) {
            const k = seg(ms, HIT + 250, HIT + 600);
            word(c, `+${gain}`, xD + sz * .45, fy - sz * (.9 + .25 * k), sz * .24, .08, GOLD, Math.min(1, k * 2) * (1 - seg(ms, TOTAL - 300, TOTAL - 120)));
          }
          // muzzle flash for guns
          if ((kind === 'shot' || kind === 'shell') && ms >= WIND + 40 && ms < WIND + 140) starburst(c, xA + sz * .45, fy - sz * .45, sz * .14, 8, '#fff2a8', 3);
        },
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}
function drawProjectile(c, kind, x1, y1, x2, y2, k, sz, line) {
  const x = lerp(x1, x2, k);
  if (kind === 'arrow') {
    const y = lerp(y1, y2, k) - Math.sin(k * Math.PI) * sz * .25;
    const ang = Math.atan2((y2 - y1) - Math.cos(k * Math.PI) * sz * .25 * Math.PI, x2 - x1), L = sz * .4;
    c.save(); c.translate(x, y); c.rotate(ang); c.strokeStyle = line; c.lineWidth = Math.max(2, sz / 30);
    c.beginPath(); c.moveTo(-L, 0); c.lineTo(0, 0); c.stroke();
    c.fillStyle = line; c.beginPath(); c.moveTo(4, 0); c.lineTo(-sz * .08, -sz * .05); c.lineTo(-sz * .08, sz * .05); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-L, 0); c.lineTo(-L - sz * .08, -sz * .06); c.moveTo(-L, 0); c.lineTo(-L - sz * .08, sz * .06); c.stroke();
    c.restore();
  } else if (kind === 'shot' || kind === 'missile') {
    const y = lerp(y1, y2, k);
    const g = c.createLinearGradient(x - sz * 1.2, y, x, y); g.addColorStop(0, 'rgba(255,240,170,0)'); g.addColorStop(1, '#fff3b0');
    c.strokeStyle = g; c.lineWidth = Math.max(3, sz / 16); c.beginPath(); c.moveTo(x - sz * 1.2, y); c.lineTo(x, y); c.stroke();
    if (kind === 'missile') { c.save(); c.translate(x, y); c.fillStyle = '#4a4c58'; c.strokeStyle = line; c.lineWidth = 2; c.beginPath(); c.moveTo(sz * .14, 0); c.lineTo(-sz * .1, -sz * .04); c.lineTo(-sz * .1, sz * .04); c.closePath(); c.fill(); c.stroke(); c.restore(); }
    else { c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, Math.max(2, sz / 26), 0, 7); c.fill(); }
  } else if (kind === 'lob' || kind === 'shell') {
    const arc = kind === 'lob' ? sz * .9 : sz * .3;
    const y = lerp(y1, y2, k) - Math.sin(k * Math.PI) * arc;
    c.save(); c.strokeStyle = 'rgba(30,28,36,.25)'; c.setLineDash([4, 6]); c.lineWidth = 2; c.beginPath();
    for (let j = 0; j <= 20; j++) { const kk = k * j / 20; const xx = lerp(x1, x2, kk), yy = lerp(y1, y2, kk) - Math.sin(kk * Math.PI) * arc; j ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.stroke(); c.restore();
    c.save(); c.translate(x, y); c.rotate(k * 12); c.fillStyle = kind === 'lob' ? '#3b3a42' : K; c.strokeStyle = line; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 0, sz * .09, 0, 7); c.fill(); c.stroke(); c.restore();
  } else if (kind === 'flame') {
    for (let i = 0; i < 18; i++) {
      const kk = clamp(k * 1.3 - i / 30, 0, 1); if (kk <= 0) continue;
      const xx = lerp(x1, x2, kk), yy = lerp(y1, y2, kk) + Math.sin(i * 1.7 + k * 10) * sz * .06 * kk;
      const r = sz * (.05 + .14 * kk) * (.7 + I.hash(i) * .6);
      c.fillStyle = i % 3 ? 'rgba(232,137,43,.8)' : 'rgba(243,213,91,.9)'; c.beginPath(); c.arc(xx, yy, r, 0, 7); c.fill();
    }
  } else if (kind === 'hex') {
    const y = lerp(y1, y2, k);
    c.strokeStyle = GREEN; c.lineWidth = Math.max(3, sz / 18); c.beginPath();
    for (let j = 0; j <= 12; j++) { const kk = k * j / 12; c.lineTo(lerp(x1, x2, kk), lerp(y1, y2, kk) + Math.sin(j * 1.8) * sz * .08); } c.stroke();
    c.fillStyle = '#b6e07a'; c.beginPath(); c.arc(x, y, sz * .08, 0, 7); c.fill();
  } else if (kind === 'scream') {
    c.strokeStyle = RED; c.lineWidth = Math.max(3, sz / 20);
    for (let r = 0; r < 4; r++) { const kk = clamp(k * 1.2 - r * .15, 0, 1); if (kk <= 0) continue; const xx = lerp(x1, x2, kk); c.beginPath(); c.arc(xx - sz * .3, lerp(y1, y2, kk), sz * (.2 + .3 * kk), -.7, .7); c.stroke(); }
  } else if (kind === 'strike') {
    c.save(); c.globalAlpha = .6; c.strokeStyle = line; c.lineWidth = 2; c.setLineDash([2, 8]); c.beginPath(); c.moveTo(x1, y1); c.quadraticCurveTo((x1 + x2) / 2, y1 - sz * .8, x, lerp(y1, y2, k) - Math.sin(k * Math.PI) * sz * .4); c.stroke(); c.restore();
  }
}
function drawTentacle(c, x1, y1, x2, y2, k, sz, line) {
  const e = easeOut(k), tx = lerp(x1, x2, e), ty = lerp(y1, y2, e);
  const path = () => { c.beginPath(); c.moveTo(x1, y1); c.bezierCurveTo(x1 + sz * .3, y1 - sz * 1.1 * e, tx - sz * .5, ty - sz * .7, tx, ty); };
  c.save(); c.lineCap = 'round';
  c.lineWidth = sz * .16; c.strokeStyle = line; path(); c.stroke();
  c.lineWidth = sz * .1; c.strokeStyle = '#6b7c6a'; path(); c.stroke();
  if (k >= 1) { c.lineWidth = sz * .08; c.strokeStyle = line; c.beginPath(); c.ellipse(x2, y2 + sz * .05, sz * .3, sz * .1, -.2, 0, Math.PI * 2); c.stroke(); }
  c.restore();
}
function drawArmourChip(c, x, y, k, sz) {
  if (k >= 1) return;
  const px = x - easeOut(k) * sz * .6, py = y - Math.sin(k * Math.PI) * sz * .6 + k * k * sz * .5;
  c.save(); c.translate(px, py); c.rotate(-k * 8); c.globalAlpha = 1 - seg(k, .7, 1);
  c.fillStyle = '#d8d2c0'; c.strokeStyle = K; c.lineWidth = 2.5;
  const r = sz * .12; c.beginPath(); c.moveTo(-r, -r); c.lineTo(r, -r); c.lineTo(r * .9, r * .3); c.lineTo(0, r * 1.2); c.lineTo(-r * .9, r * .3); c.closePath(); c.fill(); c.stroke();
  c.restore();
}

I.Battle = { play, style, isRangedKind };
})();
