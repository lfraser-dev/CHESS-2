/* Chess 2: online play outside Claude (GitHub Pages, or index.html opened from a download).
   Uses PeerJS (free WebRTC connections, with its public matchmaking server) to give game.js the same
   little "room" it uses inside Claude: everyone has a presence object, and everyone sees everyone's.
   One browser is the hub: it registers the id "chess2-<code>" and relays presence between the others.
   If the hub leaves, whoever is left takes over the hub id, so either player can reload and rejoin. */
(() => {
'use strict';
const I = window.INK;
const SRC = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
let loading = null;
function loadPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    let i = 0;
    const next = () => {
      if (i >= SRC.length) { loading = null; reject(new Error('Couldn\'t load the online library. Check your internet connection.')); return; }
      const s = document.createElement('script'); s.src = SRC[i++]; s.async = true;
      s.onload = () => window.Peer ? resolve(window.Peer) : next();
      s.onerror = () => { s.remove(); next(); };
      document.head.appendChild(s);
    };
    next();
  });
  return loading;
}
const rid = () => Math.random().toString(36).slice(2, 10);

// open a PeerJS peer with an id (or a random one); resolves once registered with the server
function openPeer(Peer, id) {
  return new Promise((resolve, reject) => {
    const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    const t = setTimeout(() => { p.destroy(); reject({ type: 'timeout' }); }, 12000);
    p.on('open', () => { clearTimeout(t); resolve(p); });
    p.on('error', e => { clearTimeout(t); p.destroy(); reject(e); });
  });
}
function connectTo(peer, id) {
  return new Promise((resolve, reject) => {
    const c = peer.connect(id, { reliable: true, serialization: 'json' });
    const t = setTimeout(() => { c.close(); reject({ type: 'timeout' }); }, 10000);
    const onErr = e => { if (e && (e.type === 'peer-unavailable')) { clearTimeout(t); peer.off('error', onErr); reject(e); } };
    peer.on('error', onErr);
    c.on('open', () => { clearTimeout(t); peer.off('error', onErr); resolve(c); });
    c.on('error', e => { clearTimeout(t); reject(e); });
  });
}

async function join(name) {
  const Peer = await loadPeerJs();
  const hubId = name;
  const me = rid();
  let mine = {}, left = false, hub = null, hubConns = new Map(), up = null, myPeer = null;
  const others = new Map();     // peer label -> presence
  const handlers = [];
  const peerObj = (peer, presence, isMe) => Object.freeze({ peer, by: null, isMe, sameTab: isMe, kind: 'viewer', guest: false, presence: Object.freeze({ ...presence }), updatedAt: Date.now() });
  const snapshot = () => [peerObj(me, mine, true), ...[...others].map(([p, pr]) => peerObj(p, pr, false))];
  let firing = false;
  const fire = () => { if (firing) return; firing = true; setTimeout(() => { firing = false; const peers = snapshot(); handlers.forEach(h => { try { h({ peers, joined: [], left: [], updated: peers }); } catch (e) { console.warn(e); } }); }, 0); };

  // ---- hub side: keep everyone's presence and pass it on
  const hubBroadcast = (msg, except) => { for (const [, c] of hubConns) if (c.peerLabel !== except && c.open) { try { c.send(msg); } catch (e) { /* closed */ } } };
  const hubAccept = c => {
    c.on('data', m => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'p' && typeof m.peer === 'string') {
        c.peerLabel = m.peer; hubConns.set(m.peer, c);
        others.set(m.peer, m.presence || {}); fire();
        hubBroadcast({ t: 'p', peer: m.peer, presence: m.presence || {} }, m.peer);
        // tell the newcomer about everyone (the hub included)
        try { c.send({ t: 'all', list: [[me, mine], ...[...others].filter(([p]) => p !== m.peer)] }); } catch (e) { /* closed */ }
      }
    });
    const gone = () => { if (c.peerLabel && hubConns.get(c.peerLabel) === c) { hubConns.delete(c.peerLabel); others.delete(c.peerLabel); fire(); hubBroadcast({ t: 'left', peer: c.peerLabel }); } };
    c.on('close', gone); c.on('error', gone);
  };
  const becomeHub = async () => {
    const p = await openPeer(Peer, hubId);
    hub = p; p.on('connection', hubAccept);
    p.on('disconnected', () => { if (!left) try { p.reconnect(); } catch (e) { /* ignore */ } });
    others.clear(); fire();
  };

  // ---- spoke side: one connection to the hub
  const spokeAttach = c => {
    up = c;
    c.on('data', m => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'all') { others.clear(); for (const [p, pr] of m.list || []) if (p !== me) others.set(p, pr || {}); fire(); }
      else if (m.t === 'p' && m.peer !== me) { others.set(m.peer, m.presence || {}); fire(); }
      else if (m.t === 'left') { others.delete(m.peer); fire(); }
    });
    const gone = () => { if (up !== c) return; up = null; others.clear(); fire(); if (!left) setTimeout(reconnect, 1500 + Math.random() * 1500); };
    c.on('close', gone); c.on('error', gone);
    c.send({ t: 'p', peer: me, presence: mine });
  };
  // connect to the hub; if there's no hub any more, become it
  const connectOrHub = async () => {
    if (!myPeer) myPeer = await openPeer(Peer);
    try { spokeAttach(await connectTo(myPeer, hubId)); return 'spoke'; }
    catch (e) {
      if (e && e.type === 'peer-unavailable') {
        try { myPeer.destroy(); myPeer = null; await becomeHub(); return 'hub'; }
        catch (e2) { if (e2 && e2.type === 'unavailable-id') { myPeer = await openPeer(Peer); spokeAttach(await connectTo(myPeer, hubId)); return 'spoke'; } throw e2; }
      }
      throw e;
    }
  };
  let reconnecting = false;
  const reconnect = async () => {
    if (left || reconnecting || up || hub) return;
    reconnecting = true;
    try { await connectOrHub(); } catch (e) { setTimeout(() => { reconnecting = false; reconnect(); }, 2500); return; }
    reconnecting = false;
  };

  const role = await connectOrHub();
  const room = {
    name,
    get isHub() { return !!hub; },
    firstRole: role,
    async presence(patch) {
      for (const k in patch) { if (patch[k] === null) delete mine[k]; else mine[k] = patch[k]; }
      if (JSON.stringify(mine).length > 60000) throw { code: 'invalid_argument', message: 'presence too big' };
      if (hub) hubBroadcast({ t: 'p', peer: me, presence: mine });
      else if (up && up.open) up.send({ t: 'p', peer: me, presence: mine });
      fire();
    },
    peers: () => snapshot(),
    onPeers(h) { handlers.push(h); fire(); return () => { const i = handlers.indexOf(h); if (i >= 0) handlers.splice(i, 1); }; },
    connected: () => !!hub || !!(up && up.open),
    async leave() {
      left = true;
      try { if (up) up.close(); } catch (e) { /* ignore */ }
      for (const [, c] of hubConns) try { c.close(); } catch (e) { /* ignore */ }
      try { if (hub) hub.destroy(); } catch (e) { /* ignore */ }
      try { if (myPeer) myPeer.destroy(); } catch (e) { /* ignore */ }
    },
  };
  return room;
}

// is anyone already hosting this code? (used before hosting, so two games don't pick the same code)
async function taken(name) {
  const Peer = await loadPeerJs();
  try { const p = await openPeer(Peer, name); p.destroy(); return false; }
  catch (e) { return !!(e && e.type === 'unavailable-id'); }
}

I.PeerRoom = { join, taken, load: loadPeerJs };
})();
