/* Inkmate: the NUKE cinematic, real-time 3D.
   One full-screen fragment shader raymarches the scene: chess pieces and board as signed distance fields,
   a lit metal bomb, and volumetric fireball / mushroom cloud / shockwave / clouds.
   INK.NukeGL.create(canvas) -> renderer or null (no WebGL / shader failed).  renderer.draw(t) draws one frame. */
(() => {
'use strict';
const I = window.INK;

const VERT = `attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes; uniform float uTime;
uniform vec3 uRo; uniform vec3 uTa; uniform float uFov; uniform float uRoll;
uniform float uK;          // seconds since the flash (negative before)
uniform float uRing;       // shockwave radius
uniform vec4 uBomb;        // position, visible
uniform vec2 uBombRot;     // spin, tilt
uniform float uDesat, uClouds, uPin, uTrail, uExposure, uFireI;
uniform vec4 uFire;        // fireball height, radius, cap radius, cap tube
uniform vec4 uFire2;       // heat, stem radius, condensation ring radius, condensation alpha
uniform vec3 uSun;
uniform vec4 uHero[16];
uniform vec4 uHeroRot[16];

#define PI 3.14159265
float gHM[16];

float hash(float n){ return fract(sin(n) * 43758.5453123); }
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0 + 113.0 * i.z;
  return mix(mix(mix(hash(n), hash(n + 1.0), f.x), mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
             mix(mix(hash(n + 113.0), hash(n + 114.0), f.x), mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
}
float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
float smin(float a, float b, float k){ float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0); }
float sdCyl(vec3 p, float r, float h0, float h1){ vec2 d = vec2(length(p.xz) - r, max(h0 - p.y, p.y - h1)); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
float sdCone(vec3 p, float r0, float r1, float h0, float h1){ float t = clamp((p.y - h0) / (h1 - h0), 0.0, 1.0); vec2 d = vec2(length(p.xz) - mix(r0, r1, t), max(h0 - p.y, p.y - h1)); return (min(max(d.x, d.y), 0.0) + length(max(d, 0.0))) * 0.8; }
vec3 rotAx(vec3 v, vec3 k, float a){ float c = cos(a), s = sin(a); return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
vec3 modAng(vec3 p, float n){ float sec = 2.0 * PI / n; float a = atan(p.z, p.x); a = mod(a + sec * 0.5, sec) - sec * 0.5; float r = length(p.xz); return vec3(r * cos(a), p.y, r * sin(a)); }

// ---------------------------------------------------------------- chess pieces (base at y = 0)
float piece(vec3 p, float type){
  float d = sdCyl(p, 0.34, 0.0, 0.07) - 0.015;
  d = smin(d, sdCyl(p, 0.28, 0.06, 0.13) - 0.01, 0.04);
  if (type < 1.5){
    d = smin(d, sdCone(p, 0.19, 0.08, 0.12, 0.46), 0.05);
    d = smin(d, sdCyl(p, 0.15, 0.44, 0.48) - 0.01, 0.03);
    d = smin(d, length(p - vec3(0.0, 0.6, 0.0)) - 0.14, 0.03);
  } else if (type < 2.5){
    d = smin(d, sdCone(p, 0.24, 0.2, 0.12, 0.68), 0.05);
    float c = sdCyl(p, 0.27, 0.64, 0.82) - 0.01;
    vec3 q = modAng(p, 6.0);
    c = max(c, -sdBox(q - vec3(0.27, 0.83, 0.0), vec3(0.15, 0.08, 0.045)));
    c = max(c, -sdCyl(p, 0.17, 0.74, 0.9));
    d = smin(d, c, 0.03);
  } else if (type < 3.5){
    d = smin(d, sdCone(p, 0.21, 0.08, 0.12, 0.6), 0.05);
    d = smin(d, sdCyl(p, 0.15, 0.58, 0.63) - 0.01, 0.03);
    vec3 q = p - vec3(0.0, 0.78, 0.0);
    float e = (length(q / vec3(0.13, 0.19, 0.13)) - 1.0) * 0.12;
    vec3 q2 = q; float ca = cos(0.7), sa = sin(0.7); q2.xy = vec2(ca * q.x - sa * q.y, sa * q.x + ca * q.y);
    e = max(e, -sdBox(q2 - vec3(0.0, 0.05, 0.0), vec3(0.25, 0.012, 0.25)));
    d = smin(d, e, 0.03);
    d = smin(d, length(p - vec3(0.0, 0.99, 0.0)) - 0.045, 0.02);
  } else if (type < 4.5){
    d = smin(d, sdCone(p, 0.25, 0.09, 0.12, 0.76), 0.05);
    d = smin(d, sdCyl(p, 0.18, 0.74, 0.79) - 0.01, 0.03);
    float cr = sdCone(p, 0.1, 0.19, 0.78, 0.97);
    vec3 q = modAng(p, 8.0);
    cr = max(cr, -(length(q - vec3(0.21, 0.99, 0.0)) - 0.065));
    d = smin(d, cr, 0.02);
    d = smin(d, length(p - vec3(0.0, 1.0, 0.0)) - 0.055, 0.02);
  } else {
    d = smin(d, sdCone(p, 0.25, 0.09, 0.12, 0.78), 0.05);
    d = smin(d, sdCyl(p, 0.18, 0.76, 0.81) - 0.01, 0.03);
    d = smin(d, sdCone(p, 0.11, 0.17, 0.8, 0.98), 0.02);
    d = smin(d, sdCyl(p, 0.17, 0.96, 1.01) - 0.01, 0.02);
    d = min(d, sdBox(p - vec3(0.0, 1.12, 0.0), vec3(0.025, 0.1, 0.025)) - 0.008);
    d = min(d, sdBox(p - vec3(0.0, 1.14, 0.0), vec3(0.075, 0.025, 0.025)) - 0.008);
  }
  return d;
}
float backType(float ax){
  if (ax < 0.5) return 5.0; if (ax < 1.5) return 4.0; if (ax < 2.5) return 3.0; if (ax < 3.5) return 2.0;
  if (ax < 4.5) return 3.0; if (ax < 5.5) return 2.0; if (ax < 6.5) return 3.0; return 2.0;
}
vec2 boardPieces(vec3 p){
  float az = abs(p.z);
  float bound = sdBox(vec3(p.x, p.y - 0.65, az - 6.5), vec3(7.5, 0.7, 1.0));
  if (bound > 0.3) return vec2(bound + 0.1, 0.0);
  float ix = clamp(floor(p.x + 0.5), -7.0, 7.0);
  float sz = p.z >= 0.0 ? 1.0 : -1.0;
  float iz = clamp(floor(az + 0.5), 6.0, 7.0) * sz;
  vec3 q = p - vec3(ix, 0.0, iz);
  float skip = max(min(0.5 - abs(q.x), 0.5 - abs(q.z)), 0.0) + 0.05;
  float dc = length(vec2(ix, iz));
  if (uRing > dc - 0.25) return vec2(skip, 0.0);
  float type = abs(iz) < 6.5 ? 1.0 : backType(abs(ix));
  float d = piece(q / 0.9, type) * 0.9;
  return vec2(min(d, skip), iz > 0.0 ? 2.0 : 3.0);
}

// ---------------------------------------------------------------- the bomb (nose down, along local y)
float bombSD(vec3 p, out float band){
  vec3 q = p - uBomb.xyz;
  float ct = cos(uBombRot.y), st = sin(uBombRot.y);
  q.xy = vec2(ct * q.x + st * q.y, -st * q.x + ct * q.y);
  float cs = cos(uBombRot.x), ss = sin(uBombRot.x);
  q.xz = vec2(cs * q.x + ss * q.z, -ss * q.x + cs * q.z);
  float body = (length(q / vec3(0.36, 1.0, 0.36)) - 1.0) * 0.34;
  body = smin(body, sdCone(q, 0.31, 0.16, 0.25, 1.05), 0.12);
  vec3 f = modAng(q, 4.0);
  float fins = sdBox(f - vec3(0.27, 0.96, 0.0), vec3(0.2, 0.22, 0.014)) - 0.004;
  float ring = max(sdCyl(q, 0.46, 0.98, 1.2), -sdCyl(q, 0.42, 0.9, 1.3));
  band = step(-0.22, q.y) * step(q.y, -0.06) + 2.0 * step(abs(q.y + 0.55), 0.012);
  return min(body, min(fins, ring));
}

vec2 map(vec3 p){
  float board = sdBox(p - vec3(0.0, -0.12, 0.0), vec3(7.5, 0.12, 7.5));
  if (uK > 0.0){ float cr = 1.7 * smoothstep(0.0, 0.5, uK); board = max(board, -(length(p - vec3(0.0, 0.5, 0.0)) - cr)); }
  float frame = max(sdBox(p - vec3(0.0, -0.1, 0.0), vec3(8.1, 0.16, 8.1)), -sdBox(p, vec3(7.5, 0.4, 7.5)));
  vec2 res = vec2(board, 1.0);
  if (frame < res.x) res = vec2(frame, 4.0);
  vec2 bp = boardPieces(p); if (bp.x < res.x) res = bp;
  if (uBomb.w > 0.5){ float band; float bd = bombSD(p, band); if (bd < res.x) res = vec2(bd, band > 1.5 ? 8.0 : band > 0.5 ? 6.0 : 5.0); }
  for (int i = 0; i < 16; i++){
    if (gHM[i] < 0.5) continue;
    vec4 H = uHero[i]; vec4 R = uHeroRot[i];
    vec3 q = rotAx(p - H.xyz, R.xyz, -R.w);
    float d = piece(q / 0.9 + vec3(0.0, 0.5, 0.0), H.w) * 0.9;
    if (d < res.x) res = vec2(d, 7.0);
  }
  return res;
}
vec3 calcNormal(vec3 p){
  vec2 e = vec2(0.0015, -0.0015);
  return normalize(e.xyy * map(p + e.xyy).x + e.yyx * map(p + e.yyx).x + e.yxy * map(p + e.yxy).x + e.xxx * map(p + e.xxx).x);
}
float softShadow(vec3 ro, vec3 rd, float tmax){
  float res = 1.0, t = 0.03;
  for (int i = 0; i < 26; i++){
    float h = map(ro + rd * t).x;
    res = min(res, 9.0 * h / t);
    t += clamp(h, 0.03, 0.45);
    if (res < 0.01 || t > tmax) break;
  }
  return clamp(res, 0.0, 1.0);
}
float calcAO(vec3 p, vec3 n){
  float o = 0.0, s = 1.0;
  for (int i = 1; i <= 4; i++){ float h = 0.03 + 0.08 * float(i); o += (h - map(p + n * h).x) * s; s *= 0.7; }
  return clamp(1.0 - 2.2 * o, 0.0, 1.0);
}

// ---------------------------------------------------------------- sky
vec3 fireCol(){ return vec3(1.0, 0.62, 0.32); }
vec3 skyCol(vec3 rd){
  float y = rd.y;
  vec3 zen = vec3(0.008, 0.014, 0.045), mid = vec3(0.1, 0.07, 0.16), hor = vec3(0.95, 0.34, 0.12);
  vec3 col = mix(hor, mid, smoothstep(0.0, 0.16, y));
  col = mix(col, zen, smoothstep(0.18, 0.75, y));
  col = mix(col, vec3(0.25, 0.16, 0.14), smoothstep(0.0, -0.3, y));
  float s = max(dot(rd, uSun), 0.0);
  col += vec3(1.0, 0.42, 0.12) * pow(s, 24.0) * 0.7 + vec3(1.0, 0.6, 0.25) * pow(s, 300.0) * 1.5 + vec3(1.0, 0.85, 0.6) * pow(s, 4000.0) * 30.0;
  if (uK > 0.0){
    vec3 C = vec3(0.0, uFire.x, 0.0);
    float g = max(dot(rd, normalize(C - uRo)), 0.0);
    col += fireCol() * uFireI * (0.008 * pow(g, 10.0) + 0.0012);
  }
  float az = atan(rd.z, rd.x);
  float mh = 0.012 + 0.04 * fbm3(vec3(az * 2.5, 0.0, 1.0)) + 0.02 * noise(vec3(az * 14.0, 3.0, 0.0));
  if (y < mh && y > -0.06) col = mix(col, vec3(0.08, 0.05, 0.07) + fireCol() * uFireI * 0.004, 0.75);
  return col;
}

// ---------------------------------------------------------------- shading
vec3 lightAt(vec3 p, vec3 n, vec3 rd, vec3 alb, float spec, float shin, float wrap){
  vec3 col = vec3(0.0);
  float ao = calcAO(p, n);
  vec3 amb = mix(vec3(0.09, 0.05, 0.06), vec3(0.16, 0.13, 0.24), n.y * 0.5 + 0.5);
  if (uK > 0.0) amb += fireCol() * uFireI * 0.003;
  col += alb * amb * ao;
  vec3 v = -rd;
  float fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  // the sun (or what's left of it)
  float sunI = uK > 0.0 ? max(0.1, 1.0 - uK * 0.35) : 1.0;
  {
    vec3 l = uSun;
    float dif = max((dot(n, l) + wrap) / (1.0 + wrap), 0.0);
    float sh = uK > 0.0 ? 1.0 : softShadow(p + n * 0.02, l, 18.0);
    vec3 hv = normalize(l + v);
    float sp = pow(max(dot(n, hv), 0.0), shin) * spec;
    col += (alb * dif + sp * (0.3 + fres)) * vec3(2.2, 1.35, 0.8) * sh * sunI;
  }
  if (uK > 0.0){
    vec3 C = vec3(0.0, uFire.x, 0.0);
    vec3 l = C - p; float d = length(l); l /= d;
    float dif = max((dot(n, l) + wrap) / (1.0 + wrap), 0.0);
    float sh = softShadow(p + n * 0.02, l, d - uFire.y);
    vec3 hv = normalize(l + v);
    float sp = pow(max(dot(n, hv), 0.0), shin) * spec;
    col += (alb * dif + sp * (0.3 + fres)) * fireCol() * uFireI / (1.0 + d * d * 0.09) * sh;
  }
  col += skyCol(reflect(rd, n)) * fres * spec * 0.6 * ao;
  return col;
}
vec3 material(vec3 p, vec3 n, vec3 rd, float m){
  if (m < 1.5){
    float ix = floor(p.x + 0.5), iz = floor(p.z + 0.5);
    float dark = mod(ix + iz, 2.0);
    float vein = fbm(p * vec3(3.0, 1.0, 3.0) + vec3(ix * 3.1, 0.0, iz * 1.7));
    vec3 light = vec3(0.8, 0.76, 0.68) * (0.85 + 0.25 * smoothstep(0.45, 0.6, vein)) - vec3(0.12) * smoothstep(0.62, 0.66, vein);
    float grain = fbm3(vec3(p.x * 2.0, 0.0, p.z * 18.0));
    vec3 walnut = vec3(0.15, 0.09, 0.055) * (0.7 + 0.6 * grain);
    vec3 alb = mix(light, walnut, dark);
    float edge = smoothstep(0.47, 0.5, max(abs(p.x - ix), abs(p.z - iz)));
    alb *= 1.0 - edge * 0.5;
    float r = length(p.xz);
    if (uK > 0.0){
      float burnt = smoothstep(uRing + 0.3, uRing - 1.5, r) * smoothstep(9.0, 2.0, r);
      alb = mix(alb, vec3(0.03, 0.025, 0.02), burnt * 0.85);
    }
    vec3 c = lightAt(p, n, rd, alb, 0.6, 60.0, 0.0);
    if (uK > 0.0){ float glow = smoothstep(2.4, 1.2, r) * exp(-uK * 0.5); c += vec3(1.0, 0.35, 0.08) * glow * 3.0; }
    return c;
  }
  if (m < 2.5) return lightAt(p, n, rd, vec3(0.86, 0.8, 0.68), 0.45, 40.0, 0.35);
  if (m < 3.5) return lightAt(p, n, rd, vec3(0.03, 0.026, 0.024), 1.0, 90.0, 0.0);
  if (m < 4.5){ float g = fbm3(vec3(p.x * 9.0, p.y * 9.0, p.z * 1.5)); return lightAt(p, n, rd, vec3(0.2, 0.11, 0.06) * (0.7 + 0.6 * g), 0.5, 50.0, 0.0); }
  if (m < 5.5){ float w = fbm3(p * 9.0); return lightAt(p, n, rd, vec3(0.16, 0.17, 0.15) * (0.75 + 0.5 * w), 0.8, 70.0, 0.0); }
  if (m < 6.5) return lightAt(p, n, rd, vec3(0.85, 0.62, 0.08), 0.7, 60.0, 0.0);
  if (m < 7.5) return lightAt(p, n, rd, vec3(0.42, 0.34, 0.26), 0.3, 30.0, 0.3) + vec3(1.0, 0.4, 0.1) * 0.3 * exp(-uK * 0.4);
  return lightAt(p, n, rd, vec3(0.8, 0.1, 0.06), 0.6, 60.0, 0.0);
}

// ---------------------------------------------------------------- volumes
vec2 cylHit(vec3 ro, vec3 rd, float r, float y0, float y1){
  float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - r * r;
  float h = b * b - a * c;
  if (h < 0.0 || a < 1e-6) return vec2(-1.0);
  h = sqrt(h);
  float t0 = (-b - h) / a, t1 = (-b + h) / a;
  float ry = abs(rd.y) < 1e-5 ? 1e-5 : rd.y;
  float s0 = (y0 - ro.y) / ry, s1 = (y1 - ro.y) / ry;
  if (s0 > s1){ float tmp = s0; s0 = s1; s1 = tmp; }
  float tn = max(max(t0, s0), 0.0), tf = min(t1, s1);
  if (tf < tn) return vec2(-1.0);
  return vec2(tn, tf);
}
vec3 blackbody(float t){
  t = clamp(t, 0.0, 1.0);
  vec3 c = mix(vec3(0.4, 0.03, 0.0), vec3(1.0, 0.3, 0.04), smoothstep(0.0, 0.35, t));
  c = mix(c, vec3(1.0, 0.7, 0.25), smoothstep(0.35, 0.7, t));
  return mix(c, vec3(1.0, 0.96, 0.85), smoothstep(0.7, 1.0, t));
}
vec4 fireDens(vec3 p){
  vec3 C = vec3(0.0, uFire.x, 0.0);
  float rb = uFire.y, capR = uFire.z, capT = uFire.w;
  vec3 q = p - C;
  float ball = length(q * vec3(1.0, 1.3, 1.0)) - rb;
  float tor = length(vec2(length(q.xz) - capR, q.y * 1.25)) - capT;
  float cap = smin(ball, tor, 0.9);
  float sr = uFire2.y * (1.0 + 1.4 * exp(-max(p.y, 0.0) * 1.3));
  float stem = max(length(p.xz) - sr, max(-p.y, p.y - C.y));
  float shape = uFire2.y > 0.01 ? smin(cap, stem, 0.7) : cap;
  vec3 flow = vec3(q.x, 0.0, q.z) * 0.12 * uK;
  float n = fbm(p * 1.25 + vec3(0.0, -uK * 0.75, 0.0) - flow);
  float dens = clamp((-shape + (n - 0.5) * 2.4 + 0.25) * 3.0, 0.0, 1.0);
  float temp = uFire2.x * clamp(1.15 - length(q) / (rb * 1.25), 0.0, 1.0) * (0.55 + 0.7 * n);
  temp = max(temp, uFire2.x * 0.55 * clamp(1.0 - p.y / (C.y * 0.5 + 0.01), 0.0, 1.0) * step(stem, 0.25) * (0.5 + n));
  float cy = C.y * 0.52;
  float cring = length(vec2(length(p.xz) - uFire2.z, (p.y - cy) * 1.8)) - 0.22;
  float cd = clamp(-cring * 3.5 + (noise(p * 2.6) - 0.5) * 1.4, 0.0, 1.0) * uFire2.w;
  return vec4(dens, temp, cd, 0.0);
}
vec4 marchFire(vec3 ro, vec3 rd, float tEnd, float jit){
  if (uK <= 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float outer = max(uFire.z + uFire.w + 1.6, uFire2.z + 0.8);
  vec2 b = cylHit(ro, rd, outer, -0.25, uFire.x + uFire.y * 1.4 + uFire.w + 0.8);
  if (b.x < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float t0 = b.x, t1 = min(b.y, tEnd);
  if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);
  float dt = (t1 - t0) / 40.0, t = t0 + dt * jit;
  vec3 acc = vec3(0.0); float T = 1.0;
  vec3 C = vec3(0.0, uFire.x, 0.0);
  for (int i = 0; i < 40; i++){
    if (t > t1) break;
    vec3 p = ro + rd * t;
    vec4 d = fireDens(p);
    float dd = d.x * 2.4 + d.z * 1.6;
    if (dd > 0.002){
      float a = 1.0 - exp(-dd * dt * 1.7);
      float dl = length(p - C);
      float under = clamp(1.0 - (p.y - C.y) / (uFire.w + 0.5), 0.15, 1.0);
      float occ = fireDens(p + vec3(0.0, 0.55, 0.0)).x;
      float sky = exp(-occ * 2.2);
      float toward = fireDens(p + (C - p) * 0.18).x;
      vec3 lit = vec3(0.3, 0.24, 0.21) * (uFireI * 0.03 * under * exp(-toward * 1.4) / (1.0 + dl * dl * 0.1) * fireCol())
               + vec3(0.22, 0.17, 0.24) * 0.55 * sky + vec3(0.9, 0.4, 0.15) * 0.12 * sky * max(uSun.y + 0.3, 0.0);
      vec3 cond = vec3(0.9, 0.86, 0.84) * (0.35 + uFireI * 0.012);
      vec3 col = mix(lit, cond, d.z / (d.x + d.z + 1e-4));
      vec3 emit = blackbody(d.y) * pow(d.y, 1.5) * 22.0;
      acc += T * a * (col + emit);
      T *= 1.0 - a;
      if (T < 0.02) break;
    }
    t += dt;
  }
  return vec4(acc, T);
}
vec4 marchDust(vec3 ro, vec3 rd, float tEnd, float jit){
  if (uRing <= 0.05) return vec4(0.0, 0.0, 0.0, 1.0);
  float hgt = 0.9 + 0.7 * smoothstep(0.0, 8.0, uRing);
  vec2 b = cylHit(ro, rd, uRing + 2.2, -0.25, hgt * 2.2);
  if (b.x < 0.0) return vec4(0.0, 0.0, 0.0, 1.0);
  float t0 = b.x, t1 = min(b.y, tEnd);
  if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);
  float dt = (t1 - t0) / 34.0, t = t0 + dt * jit;
  vec3 acc = vec3(0.0); float T = 1.0;
  vec3 C = vec3(0.0, uFire.x, 0.0);
  for (int i = 0; i < 34; i++){
    if (t > t1) break;
    vec3 p = ro + rd * t;
    float r = length(p.xz), x = r - uRing;
    if (x > -4.0){
      float wall = length(vec2(max(x, 0.0) * 1.5, max(p.y, 0.0) / hgt)) - 1.0;
      float sheet = max(p.y / (hgt * 0.55) - 1.0, -x - 4.0);
      float shape = x < 0.0 ? min(wall, sheet) : wall;
      vec3 outward = vec3(p.x, 0.0, p.z) / max(r, 0.01);
      float n = fbm3(p * 1.25 + vec3(0.0, -uK * 0.5, 0.0) - outward * uK * 1.1);
      float dd = clamp((-shape + (n - 0.5) * 2.2 + 0.1) * 2.6, 0.0, 1.0);
      if (dd > 0.002){
        float a = 1.0 - exp(-dd * dt * 2.0);
        float dl = length(p - C);
        vec3 col = vec3(0.45, 0.35, 0.26) * (0.06 + uFireI * 0.022 / (1.0 + dl * dl * 0.07) * fireCol() * clamp(1.0 - p.y / (hgt * 2.0), 0.2, 1.0) + vec3(0.2, 0.16, 0.2) * 0.35 * smoothstep(0.0, hgt * 2.0, p.y + 0.4));
        col += vec3(1.0, 0.45, 0.12) * 0.25 * smoothstep(0.6, 0.0, p.y) * smoothstep(-1.0, 0.5, x) * exp(-uK * 0.25);
        acc += T * a * col;
        T *= 1.0 - a;
        if (T < 0.03) break;
      }
    }
    t += dt;
  }
  return vec4(acc, T);
}
vec4 marchClouds(vec3 ro, vec3 rd, float tEnd, float jit){
  if (uClouds < 0.5) return vec4(0.0, 0.0, 0.0, 1.0);
  float y0 = 7.0, y1 = 19.0;
  float ry = abs(rd.y) < 1e-4 ? 1e-4 : rd.y;
  float s0 = (y0 - ro.y) / ry, s1 = (y1 - ro.y) / ry;
  if (s0 > s1){ float tmp = s0; s0 = s1; s1 = tmp; }
  float t0 = max(s0, 0.0), t1 = min(min(s1, tEnd), t0 + 160.0);
  if (t1 <= t0) return vec4(0.0, 0.0, 0.0, 1.0);
  float dt = (t1 - t0) / 30.0, t = t0 + dt * jit;
  vec3 acc = vec3(0.0); float T = 1.0;
  float fw = pow(max(dot(rd, uSun), 0.0), 5.0);
  for (int i = 0; i < 30; i++){
    if (t > t1) break;
    vec3 p = ro + rd * t;
    float hh = (p.y - y0) / (y1 - y0);
    float prof = 1.0 - pow(abs(hh * 2.0 - 1.0), 2.0);
    float n = fbm(p * 0.07 + vec3(uTime * 0.02, 0.0, 0.0));
    float dd = clamp((n - 0.56 + prof * 0.14) * 5.0 * prof, 0.0, 1.0);
    if (dd > 0.002){
      float a = 1.0 - exp(-dd * dt * 0.35);
      vec3 ps = p + uSun * 3.0;
      float hs = clamp((ps.y - y0) / (y1 - y0), 0.0, 1.0);
      float occ = clamp((fbm(ps * 0.07 + vec3(uTime * 0.02, 0.0, 0.0)) - 0.56 + (1.0 - pow(abs(hs * 2.0 - 1.0), 2.0)) * 0.14) * 5.0, 0.0, 1.0);
      float light = exp(-occ * 2.5);
      vec3 col = mix(vec3(0.05, 0.04, 0.09), vec3(1.4, 0.62, 0.3) * (1.0 + fw * 2.0), light * (0.35 + 0.65 * hh));
      acc += T * a * col;
      T *= 1.0 - a;
      if (T < 0.02) break;
    }
    t += dt;
  }
  return vec4(acc, T);
}

// box the board region so empty sky costs almost nothing
vec2 boxHit(vec3 ro, vec3 rd, vec3 bmin, vec3 bmax){
  vec3 inv = 1.0 / rd;
  vec3 ta = (bmin - ro) * inv, tb = (bmax - ro) * inv;
  vec3 tmn = min(ta, tb), tmx = max(ta, tb);
  float tn = max(max(tmn.x, tmn.y), tmn.z), tf = min(min(tmx.x, tmx.y), tmx.z);
  return vec2(max(tn, 0.0), tf);
}
vec2 sphHit(vec3 ro, vec3 rd, vec3 c, float r){
  vec3 oc = ro - c; float b = dot(oc, rd), cc = dot(oc, oc) - r * r, h = b * b - cc;
  if (h < 0.0) return vec2(1e9, -1.0);
  h = sqrt(h); return vec2(max(-b - h, 0.0), -b + h);
}

vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec3 cw = normalize(uTa - uRo);
  vec3 cp = vec3(sin(uRoll), cos(uRoll), 0.0);
  vec3 cu = normalize(cross(cw, cp)), cv = cross(cu, cw);
  float fl = 0.5 / tan(uFov * 0.5);
  vec3 rd = normalize(uv.x * cu + uv.y * cv + fl * cw);
  vec3 ro = uRo;
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453);

  vec3 C = vec3(0.0, uFire.x, 0.0);
  vec3 toC = normalize(C - ro);
  float g = 1.0 - max(dot(rd, toC), 0.0);
  if (uK > 0.0){
    float haze = exp(-g * 25.0) * clamp(1.2 - uK * 0.15, 0.0, 1.0);
    rd = normalize(rd + (vec3(noise(vec3(uv * 40.0, uTime * 5.0)), noise(vec3(uv * 40.0 + 7.0, uTime * 5.0)), 0.0) - 0.5) * 0.012 * haze);
  }

  // which flying pieces could this ray touch?
  float tS = 1e9, tE = -1.0;
  for (int i = 0; i < 16; i++){
    gHM[i] = 0.0;
    if (uHero[i].w > 0.5){ vec2 h = sphHit(ro, rd, uHero[i].xyz, 0.8); if (h.y > 0.0){ gHM[i] = 1.0; tS = min(tS, h.x); tE = max(tE, h.y); } }
  }
  vec2 bb = boxHit(ro, rd, vec3(-8.3, -0.35, -8.3), vec3(8.3, 1.45, 8.3));
  if (bb.y > bb.x){ tS = min(tS, bb.x); tE = max(tE, bb.y); }
  if (uBomb.w > 0.5){ vec2 h = sphHit(ro, rd, uBomb.xyz, 1.5); if (h.y > 0.0){ tS = min(tS, h.x); tE = max(tE, h.y); } }

  vec3 col; float tHit = 1e5; float m = -1.0;
  if (tE > tS){
    float t = max(tS, 0.01);
    for (int i = 0; i < 120; i++){
      vec2 h = map(ro + rd * t);
      if (h.x < 0.0012 * t + 0.0005){ m = h.y; break; }
      t += h.x * 0.85;
      if (t > tE) break;
    }
    if (m > 0.0) tHit = t;
  }
  if (m > 0.0){
    vec3 p = ro + rd * tHit;
    vec3 n = calcNormal(p);
    col = material(p, n, rd, m);
    col = mix(col, skyCol(normalize(vec3(rd.x, 0.02, rd.z))), 1.0 - exp(-tHit * 0.004));
  } else if (rd.y < 0.0){
    float t = (-0.3 - ro.y) / rd.y;
    vec3 p = ro + rd * t;
    float n = fbm3(p * 0.35) * 0.6 + fbm3(p * 2.5) * 0.4;
    vec3 alb = vec3(0.26, 0.18, 0.13) * (0.6 + 0.6 * n);
    float r = length(p.xz);
    if (uK > 0.0) alb = mix(alb, vec3(0.04, 0.03, 0.025), smoothstep(uRing + 0.5, uRing - 2.0, r) * 0.8);
    vec3 nn = normalize(vec3((fbm3(p * 2.0 + 0.1) - 0.5) * 0.3, 1.0, (fbm3(p * 2.0 + 3.1) - 0.5) * 0.3));
    vec3 lit = alb * (vec3(0.18, 0.13, 0.15) + vec3(2.0, 1.2, 0.7) * max(dot(nn, uSun), 0.0) * (uK > 0.0 ? max(0.1, 1.0 - uK * 0.35) : 1.0));
    if (uK > 0.0){ vec3 l = C - p; float d = length(l); lit += alb * fireCol() * uFireI * max(dot(nn, l / d), 0.0) / (1.0 + d * d * 0.06); }
    col = mix(lit, skyCol(normalize(vec3(rd.x, 0.01, rd.z))), 1.0 - exp(-t * 0.006));
    tHit = t;
  } else col = skyCol(rd);

  // contrail behind the falling bomb
  if (uTrail > 0.0 && uBomb.w > 0.5){
    vec3 A = uBomb.xyz + vec3(0.0, 1.0, 0.0);
    vec3 ba = vec3(0.0, 1.0, 0.0);
    vec3 w0 = ro - A;
    float bdt = dot(rd, ba), d0 = dot(rd, w0), e0 = dot(ba, w0);
    float den = 1.0 - bdt * bdt;
    float sc = den > 1e-4 ? clamp((bdt * e0 - d0) / den, 0.0, tHit) : 0.0;
    float tc = max(e0 + bdt * sc, 0.0);
    vec3 pc = ro + rd * sc, qc = A + ba * tc;
    float dist = length(pc - qc);
    float width = 0.12 + tc * 0.03;
    float a = exp(-dist * dist / (width * width)) * exp(-tc * 0.06) * uTrail;
    col = mix(col, vec3(1.15, 1.0, 0.92), clamp(a, 0.0, 1.0) * 0.8);
  }

  vec4 cl = marchClouds(ro, rd, tHit, jit);
  col = col * cl.a + cl.rgb;
  vec4 du = marchDust(ro, rd, tHit, jit);
  col = col * du.a + du.rgb;
  vec4 fi = marchFire(ro, rd, tHit, jit);
  col = col * fi.a + fi.rgb;

  if (uK > 0.0){
    float vis = fi.a * du.a;
    col += fireCol() * uFireI * (exp(-g * 900.0) * 0.06 + exp(-g * 90.0) * 0.008 + exp(-g * 16.0) * 0.0008) * mix(0.35, 1.0, vis);
  }
  if (uPin > 0.0){
    vec3 P = vec3(0.0, 0.12, 0.0);
    float gp = 1.0 - max(dot(rd, normalize(P - ro)), 0.0);
    col += vec3(1.0, 0.92, 0.75) * uPin * (exp(-gp * 20000.0) * 30.0 + exp(-gp * 600.0) * 1.2 + exp(-gp * 40.0) * 0.08);
  }

  col *= uExposure;
  col = aces(col);
  col = pow(col, vec3(1.0 / 2.2));
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(col, col * vec3(0.84, 1.0, 1.14), (1.0 - lum) * 0.4);
  col = mix(col, col * vec3(1.1, 1.0, 0.84), lum * 0.35);
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.35);
  col = mix(col, vec3(lum), uDesat);
  vec2 q = gl_FragCoord.xy / uRes;
  col *= 0.35 + 0.65 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.22);
  gl_FragColor = vec4(col, 1.0);
}`;

// ------------------------------------------------------------------ shot direction (all in seconds of the cinematic)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, k) => a + (b - a) * k;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const easeOut = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const easeIn = k => Math.pow(clamp(k, 0, 1), 2.2);
const v3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const RING_SPEED = 3.75;
const ringAt = k => k > .2 ? RING_SPEED * Math.pow(k - .2, 1.15) : 0;
const bombY = t => 1.0 + 30 * (1 - easeIn(seg(t, 12.2, 16.0)));
function backType(ax) { return [5, 4, 3, 2, 3, 2, 3, 2][Math.min(7, ax)]; }
// flying pieces: the white side's middle files, nearest the camera
const HEROES = [];
for (const iz of [6, 7]) for (let ix = -4; ix <= 3; ix++) {
  const d = Math.hypot(ix, iz), seed = ix * 13 + iz * 7;
  const rnd = n => I.hash(seed + n);
  const ax = [rnd(1) - .5, rnd(2) - .5, rnd(3) - .5]; const al = Math.hypot(...ax) || 1;
  HEROES.push({ ix, iz, d, type: iz === 6 ? 1 : backType(Math.abs(ix)), hitK: .2 + Math.pow((d - .25) / RING_SPEED, 1 / 1.15),
    v: 5.5 + rnd(4) * 3.5, vy: 2.2 + rnd(5) * 2.8, axis: ax.map(x => x / al), w: (4 + rnd(6) * 6) * (rnd(7) > .5 ? 1 : -1) });
}

function params(t) {
  const P = { ro: [0, 2, 10], ta: [0, 1, 0], fov: .9, roll: 0, k: -1, ring: 0, bomb: [0, 0, 0, 0], bombRot: [0, 0], desat: 0, clouds: 0, pin: 0, trail: 0, exposure: 1,
    fireI: 0, fire: [0, 0, 0, 0], fire2: [0, 0, 0, 0], heroes: null };
  if (t < 12.2) {
    // SHOT A: falling with the bomb through dusk clouds, camera slowly pulling back
    const u = t - 4.4, k = u / 7.8, by = 58 - u * 3.6;
    P.bomb = [0, by, 0, 1]; P.bombRot = [t * 1.3, .18 * Math.sin(t * .6)];
    const a = .5 + k * .9, dist = lerp(2.4, 8.5, easeOut(k)), oy = lerp(.2, 1.4, k);
    P.ro = [Math.sin(a) * dist, by + oy, Math.cos(a) * dist]; P.ta = [0, by - .1 - k * 1.2, 0];
    P.fov = lerp(.62, .9, k); P.roll = .05 * Math.sin(u * .4); P.clouds = 1; P.exposure = 1.0;
  } else if (t < 14.3 || (t >= 15.5 && t < 16.0)) {
    // SHOT B: establishing dolly over the board at sunset as the bomb streaks down
    const u = ease(seg(t, 12.2, 16.0));
    P.ro = v3([10.5, 3.6, 17], [6.2, 2.3, 12.6], u); P.ta = v3([0, 1.6, 0], [0, 1.0, 0], u);
    P.fov = .78; P.roll = lerp(-.03, 0, u); P.exposure = 1.05;
    P.bomb = [0, bombY(t), 0, 1]; P.bombRot = [t * 1.6, .06]; P.trail = 1;
  } else if (t < 15.5) {
    // SHOT C: low angle from behind the white pieces, looking up as the bomb fills the sky
    const u = seg(t, 14.3, 15.5);
    const by = bombY(t);
    P.ro = [lerp(.62, .5, u), lerp(.24, .3, u), lerp(7.85, 7.7, u)];
    P.ta = [lerp(-.2, 0, u), lerp(4.2, 5.6, u), 0]; P.fov = lerp(1.3, 1.15, u); P.roll = lerp(.08, .03, u); P.exposure = 1.1;
    P.bomb = [0, by, 0, 1]; P.bombRot = [t * 1.6, .06]; P.trail = 1;
  } else {
    // impact, the silence, and the blast
    const k = t - 17;
    const pull = easeOut(seg(t, 17, 20.2)), tilt = easeOut(seg(t, 17, 19.5));
    P.ro = v3([6.2, 2.3, 12.6], [4.2, 1.5, 20.5], pull); P.ta = v3([0, 1.0, 0], [0, 4.8, 0], tilt);
    P.fov = lerp(.78, 1.0, pull);
    if (t < 17) { P.pin = ease(seg(t, 16.0, 16.4)); P.desat = .6 * ease(seg(t, 16.05, 16.4)); P.exposure = .9; }
    else {
      P.k = k; P.ring = ringAt(k);
      P.fireI = 80 * Math.exp(-k * .75) + 7;
      P.exposure = .95 + 1.4 * Math.exp(-k * 3);
      const rb = .35 + 2.0 * easeOut(k / 1.8), H = .7 + 5.6 * easeOut(k / 6.5);
      const capR = rb * (.25 + 1.05 * ease(seg(k, .6, 4.2))), capT = rb * (.55 + .2 * ease(seg(k, 1, 4)));
      P.fire = [H, rb, capR, capT];
      const cr = seg(k, .5, 2.8);
      P.fire2 = [Math.exp(-k * .38), k > .5 ? .35 + .3 * ease(seg(k, .8, 5)) : 0, capR * 1.2 + cr * 3.5, cr > 0 && cr < 1 ? Math.sin(cr * Math.PI) * .9 : 0];
      // flying pieces
      const hs = [], hr = [];
      for (const h of HEROES) {
        if (k < h.hitK) { hs.push(0, 0, 0, 0); hr.push(0, 1, 0, 0); continue; }
        const tau = k - h.hitK, dx = h.ix / h.d, dz = h.iz / h.d;
        const y = Math.max(.45, .45 + h.vy * tau - 3.2 * tau * tau);
        hs.push(h.ix + dx * h.v * tau, y, h.iz + dz * h.v * tau, h.type);
        hr.push(h.axis[0], h.axis[1], h.axis[2], h.w * tau);
      }
      P.heroes = [hs, hr];
    }
  }
  // camera shake: a thud at the flash, building as the wave closes in
  if (t > 17 && t < 22.2) {
    const k = t - 17, amp = .06 * Math.exp(-k * 2.2) + .07 * Math.pow(seg(t, 19, 21.9), 2);
    const j = () => (Math.random() - .5) * amp;
    P.ro = [P.ro[0] + j(), P.ro[1] + j(), P.ro[2] + j()]; P.ta = [P.ta[0] + j() * 2, P.ta[1] + j() * 2, P.ta[2]];
    P.roll += j() * .3;
  } else if (t > 15.5 && t < 16.05) { P.ro = [P.ro[0], P.ro[1] + (Math.random() - .5) * .01, P.ro[2]]; }
  return P;
}

function compile(gl, type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log); }
  return s;
}
function create(canvas) {
  let gl = null;
  try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' }); } catch (e) { gl = null; }
  if (!gl) return null;
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { console.warn('Nuke cinematic: WebGL shader failed, using the 2D version.', e); return null; }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos'); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  const U = {}; for (const n of ['uRes', 'uTime', 'uRo', 'uTa', 'uFov', 'uRoll', 'uK', 'uRing', 'uBomb', 'uBombRot', 'uDesat', 'uClouds', 'uPin', 'uTrail', 'uExposure', 'uFireI', 'uFire', 'uFire2', 'uSun', 'uHero', 'uHeroRot']) U[n] = gl.getUniformLocation(prog, n);
  const sun = [-.62, .16, -.77]; const sl = Math.hypot(...sun); sun.forEach((v, i) => sun[i] = v / sl);
  const emptyH = new Float32Array(64), emptyR = new Float32Array(64).map((_, i) => i % 4 === 1 ? 1 : 0);
  let scale = .62;
  return {
    get scale() { return scale; }, set scale(v) { scale = clamp(v, .3, 1); },
    draw(t, cssW, cssH) {
      const w = Math.max(160, Math.round(cssW * scale)), h = Math.max(90, Math.round(cssH * scale));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      const P = params(t);
      gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uTime, t);
      gl.uniform3fv(U.uRo, P.ro); gl.uniform3fv(U.uTa, P.ta); gl.uniform1f(U.uFov, P.fov); gl.uniform1f(U.uRoll, P.roll);
      gl.uniform1f(U.uK, P.k); gl.uniform1f(U.uRing, P.ring);
      gl.uniform4fv(U.uBomb, P.bomb); gl.uniform2fv(U.uBombRot, P.bombRot);
      gl.uniform1f(U.uDesat, P.desat); gl.uniform1f(U.uClouds, P.clouds); gl.uniform1f(U.uPin, P.pin); gl.uniform1f(U.uTrail, P.trail);
      gl.uniform1f(U.uExposure, P.exposure); gl.uniform1f(U.uFireI, P.fireI);
      gl.uniform4fv(U.uFire, P.fire); gl.uniform4fv(U.uFire2, P.fire2); gl.uniform3fv(U.uSun, sun);
      gl.uniform4fv(U.uHero, P.heroes ? new Float32Array(P.heroes[0]) : emptyH);
      gl.uniform4fv(U.uHeroRot, P.heroes ? new Float32Array(P.heroes[1]) : emptyR);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    },
  };
}
I.NukeGL = { create, params };
})();
