/* Chess 2: online play outside Claude, through a free public MQTT message server over a secure websocket
   (the same kind of connection normal websites use, so it works on networks that block direct connections).
   It gives game.js the same little "room" as inside Claude: everyone has a presence object and sees everyone's.
   Each player's presence is a "retained" message on chess2/v1/<room>/<player id>, so whoever joins later gets it
   straight away, and the server clears it automatically if a player disconnects. */
(() => {
'use strict';
const I = window.INK;
const LIBS = ['https://cdn.jsdelivr.net/npm/mqtt@5.10.1/dist/mqtt.min.js', 'https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js', 'https://cdn.jsdelivr.net/npm/mqtt@4.3.7/dist/mqtt.min.js'];
// public servers, tried in this order (both players end up on the first one that works for them)
const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
let loading = null;
function loadLib() {
  if (window.mqtt && window.mqtt.connect) return Promise.resolve(window.mqtt);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (i >= LIBS.length) { loading = null; reject(new Error('Couldn\'t load the online library. Check your internet connection.')); return; }
      const s = document.createElement('script'); s.src = LIBS[i++]; s.async = true;
      s.onload = () => (window.mqtt && window.mqtt.connect) ? resolve(window.mqtt) : next();
      s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    };
    next();
  });
  return loading;
}
const rid = () => Math.random().toString(36).slice(2, 10);
const text = m => typeof m === 'string' ? m : (m && typeof m.toString === 'function' && !(m instanceof Uint8Array) ? m.toString() : new TextDecoder().decode(m));

function connectBroker(mqtt, url, me, willTopic) {
  return new Promise((resolve, reject) => {
    let done = false;
    const cl = mqtt.connect(url, { clientId: 'chess2_' + me, clean: true, keepalive: 20, connectTimeout: 7000, reconnectPeriod: 2500, protocolVersion: 4,
      will: { topic: willTopic, payload: '', retain: true, qos: 1 } });
    const t = setTimeout(() => { if (!done) { done = true; try { cl.end(true); } catch (e) { /* ignore */ } reject(new Error('timeout ' + url)); } }, 8000);
    cl.once('connect', () => { if (done) return; done = true; clearTimeout(t); resolve(cl); });
    cl.on('error', e => { if (done) return; done = true; clearTimeout(t); try { cl.end(true); } catch (x) { /* ignore */ } reject(e); });
  });
}

async function join(name) {
  const mqtt = await loadLib();
  const me = rid(), base = 'chess2/v1/' + name.replace(/[^a-z0-9-]/gi, '') + '/', myTopic = base + me;
  let cl = null, lastErr = null;
  for (const url of BROKERS) { try { cl = await connectBroker(mqtt, url, me, myTopic); break; } catch (e) { lastErr = e; } }
  if (!cl) throw new Error('Couldn\'t reach the online server. Your network might be blocking it: try a different wifi. (' + (lastErr && lastErr.message || 'no connection') + ')');

  let mine = {}, left = false;
  const others = new Map(), handlers = [];
  const peerObj = (peer, presence, isMe) => Object.freeze({ peer, by: null, isMe, sameTab: isMe, kind: 'viewer', guest: false, presence: Object.freeze({ ...presence }), updatedAt: Date.now() });
  const snapshot = () => [peerObj(me, mine, true), ...[...others].map(([p, pr]) => peerObj(p, pr, false))];
  let firing = false;
  const fire = () => { if (firing) return; firing = true; setTimeout(() => { firing = false; const peers = snapshot(); handlers.forEach(h => { try { h({ peers, joined: [], left: [], updated: peers }); } catch (e) { console.warn(e); } }); }, 0); };
  const publishMine = () => new Promise(res => { if (!cl.connected) return res(); cl.publish(myTopic, JSON.stringify(mine), { retain: true, qos: 1 }, () => res()); });

  cl.on('message', (topic, msg) => {
    if (!topic.startsWith(base)) return;
    const who = topic.slice(base.length); if (!who || who === me || who.includes('/')) return;
    const body = text(msg);
    if (!body) { if (others.delete(who)) fire(); return; }
    try { const pr = JSON.parse(body); if (pr && typeof pr === 'object') { others.set(who, pr); fire(); } } catch (e) { /* not ours */ }
  });
  // after a dropped connection: say hello again (the server already re-subscribes us)
  cl.on('connect', () => { if (!left) publishMine(); });
  await new Promise((res, rej) => cl.subscribe(base + '+', { qos: 1 }, err => err ? rej(err) : res()));

  return {
    name, kind: 'mqtt',
    async presence(patch) {
      for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
      if (JSON.stringify(mine).length > 60000) throw { code: 'invalid_argument', message: 'presence too big' };
      fire(); await publishMine();
    },
    peers: () => snapshot(),
    onPeers(h) { handlers.push(h); fire(); return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); }; },
    connected: () => !!cl.connected,
    async leave() {
      left = true;
      await new Promise(res => { try { cl.publish(myTopic, '', { retain: true, qos: 1 }, () => res()); } catch (e) { res(); } setTimeout(res, 800); });
      try { cl.end(true); } catch (e) { /* ignore */ }
    },
  };
}
I.MqttRoom = { join, load: loadLib };
})();
