// Socket.IO smoke test: 2 players join, start, move; expect welcome/roster/snapshots.
const { io } = require('socket.io-client');
const URL = 'http://localhost:3001';

function client(name) {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'] });
    const seen = [];
    s.on('msg', (m) => {
      seen.push(m.t + (m.kind ? ':' + m.kind : ''));
      if (m.t === 'welcome') resolve({ s, id: m.playerId, code: m.roomCode, name, seen });
    });
    setTimeout(() => resolve({ s, id: null, code: null, name, seen }), 4000);
  });
}

(async () => {
  const a = await client('Alice');
  console.log('A joined room', a.code, 'seen', a.seen.join(','));
  a.s.emit('msg', { t: 'chapterAction', chapter: 'ch01_invitation', action: 'start' });
  const b = io(URL, { transports: ['websocket'] });
  const bSeen = [];
  let snapCount = 0;
  b.on('msg', (m) => {
    bSeen.push(m.t + (m.kind ? ':' + m.kind : ''));
    if (m.t === 'snapshot') snapCount++;
  });
  await new Promise((r) => b.on('connect', r));
  b.emit('msg', { t: 'join', roomCode: a.code, name: 'Bob' });
  await new Promise((r) => setTimeout(r, 300));
  b.emit('msg', { t: 'input', seq: 1, pos: { x: 1, y: 1.6, z: 8 }, yaw: 0, region: 'exterior', crouch: false, sprint: true, flashlight: true });
  b.emit('msg', { t: 'doorAction', doorId: 'front_door', action: 'open' });
  b.emit('msg', { t: 'voteDecision', decision: 'persuade' });
  b.emit('msg', { t: 'useEquipment', slot: 'salt' });
  await new Promise((r) => setTimeout(r, 800));
  console.log('B seen:', bSeen.slice(0, 10).join(','), '| snapshots to B:', snapCount);
  console.log('A seen after:', a.seen.slice(0, 10).join(','));
  process.exit(0);
})();
setTimeout(() => { console.error('TIMEOUT'); process.exit(1); }, 15000);
