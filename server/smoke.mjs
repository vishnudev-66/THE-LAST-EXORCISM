// Socket.IO smoke test: 2 players join, start, move; expect welcome/roster/snapshots.
import pkg from 'socket.io-client';
const { io } = pkg;

const URL = 'http://localhost:3001';

function client(name) {
  return new Promise((resolve) => {
    const s = io(URL, { transports: ['websocket'] });
    const seen = [];
    s.on('msg', (m) => {
      seen.push(m.t + (m.kind ? ':' + m.kind : ''));
      if (m.t === 'welcome') {
        resolve({ s, id: m.playerId, code: m.roomCode, name, seen });
      }
    });
  });
}

const a = await client('Alice');
a.s.emit('msg', { t: 'chapterAction', chapter: 'ch01_invitation', action: 'start' });
const b = await client('Bob'); // joins same room via returned code? welcome gave roomCode
b.s.emit('msg', { t: 'join', roomCode: a.code, name: 'Bob' });
await new Promise(r => setTimeout(r, 400));
b.s.emit('msg', { t: 'input', seq: 1, pos: { x: 1, y: 1.6, z: 8 }, yaw: 0, region: 'exterior', crouch: false, sprint: true, flashlight: true });
b.s.emit('msg', { t: 'doorAction', doorId: 'front_door', action: 'open' });
b.s.emit('msg', { t: 'voteDecision', decision: 'persuade' });
await new Promise(r => setTimeout(r, 700));
let snapCount = 0;
b.s.on('msg', (m) => { if (m.t === 'snapshot') snapCount++; });
await new Promise(r => setTimeout(r, 500));
console.log(JSON.stringify({
  aliceSaw: a.seen.slice(0, 6), bobSaw: b.seen.slice(0, 8), snapCount,
}, null, 1));
process.exit(0);
