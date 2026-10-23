// ============================================================================
// THE LAST EXORCISM - Multiplayer server (Express + Socket.IO).
// Server-authoritative co-op for private rooms of 2-8 investigators.
// The single-player campaign runs entirely in the browser WITHOUT this server.
//
//   npm run dev      # develop (tsx watch) on :3001
//   npm run build && npm start
// ============================================================================
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import type { ClientMessage, ServerMessage } from './types.js';
import { PROTOCOL_VERSION, MAX_PLAYERS } from './types.js';
import { RoomManager, type Room } from './rooms.js';
import { GameState } from './gameState.js';

const PORT = Number(process.env.PORT ?? 3001);

const app = express();
app.use(express.json());

const manager = RoomManager.instance;
const states = new Map<string, GameState>(); // roomCode -> authoritative state

function stateFor(room: Room): GameState {
  let s = states.get(room.code);
  if (!s) {
    s = new GameState(room.seed);
    states.set(room.code, s);
  }
  return s;
}

// ---- REST endpoints (health, lobby listing) --------------------------------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, protocol: PROTOCOL_VERSION, rooms: manager.list().length });
});

app.get('/api/rooms', (_req, res) => {
  // private co-op: never list other rooms' contents, only count for capacity UX
  res.json({ rooms: manager.list().map((r) => ({ code: r.code, playerCount: r.playerCount, started: r.started })) });
});

app.post('/api/room', (req, res) => {
  const name = String(req.body?.name ?? 'Host').slice(0, 24);
  const room = manager.create();
  room.hostName = name;
  res.json({ code: room.code });
});

// ---- Socket.IO --------------------------------------------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: false },
  maxHttpBufferSize: 1e5,
  pingInterval: 10000,
  pingTimeout: 25000,
});

io.on('connection', (socket) => {
  let joinedRoom: Room | null = null;
  let playerId = socket.id;

  socket.on('msg', (raw: ClientMessage) => {
    try {
      if (!raw || typeof raw !== 'object') return;
      switch (raw.t) {
        case 'join': {
          const name = String(raw.name ?? '').slice(0, 24) || 'Investigator';
          const room = raw.roomCode ? manager.getOrCreate(raw.roomCode) : manager.create();
          const ok = room.add({ id: playerId, name, socket });
          if (!ok) return;
          joinedRoom = room;
          socket.join(room.code);
          const st = stateFor(room);
          st.addPlayer(playerId, name);
          send(socket, { t: 'welcome', playerId, roomCode: room.code, hostId: room.hostId });
          break;
        }
        case 'input': {
          if (!joinedRoom) return;
          stateFor(joinedRoom).applyInput(playerId, {
            pos: raw.pos, yaw: raw.yaw, region: raw.region,
            crouch: !!raw.crouch, sprint: !!raw.sprint, flashlight: !!raw.flashlight,
          });
          break;
        }
        case 'interact': {
          if (!joinedRoom) return;
          joinedRoom.relay(playerId, raw);
          break;
        }
        case 'useEquipment': {
          if (!joinedRoom) return;
          const ev = stateFor(joinedRoom).useEquipment(playerId, raw.slot, raw.targetEnemy);
          if (ev) joinedRoom.broadcast({ t: 'event', kind: ev.kind, data: ev.data });
          break;
        }
        case 'doorAction': {
          if (!joinedRoom) return;
          const st = stateFor(joinedRoom);
          const door = st.doors.find((d) => d.id === raw.doorId);
          if (door) {
            if (raw.action === 'open') door.open = !door.locked;
            if (raw.action === 'close') door.open = false;
            if (raw.action === 'unlock') door.locked = false;
            st.doors = st.doors.map((d) => ({ ...d }));
            joinedRoom.broadcast({ t: 'event', kind: 'door_changed', data: { door: door.id, open: door.open, locked: door.locked } });
          }
          break;
        }
        case 'chapterAction': {
          if (!joinedRoom) return;
          const st = stateFor(joinedRoom);
          if (raw.action === 'start') {
            st.phase = 'playing';
            joinedRoom.started = true;
            joinedRoom.broadcast({ t: 'event', kind: 'chapter_complete', data: { chapter: st.chapter, phase: 'playing' } });
          }
          const ch = st.advanceChapter(raw.action);
          if (ch) joinedRoom.broadcast({ t: 'event', kind: 'chapter_complete', data: { chapter: ch } });
          if (st.phase === 'ended' && st.ending) {
            joinedRoom.broadcast({ t: 'event', kind: 'ending', data: { ending: st.ending } });
          }
          break;
        }
        case 'voteDecision': {
          if (!joinedRoom) return;
          const winner = stateFor(joinedRoom).voteDecision(playerId, raw.decision);
          if (winner) joinedRoom.broadcast({ t: 'event', kind: 'seal_weakened', data: { caretakerVote: winner } });
          break;
        }
        case 'leave': {
          leave();
          break;
        }
      }
    } catch {
      send(socket, { t: 'error', code: 'bad_message', message: 'Malformed message ignored.' });
    }
  });

  function leave() {
    if (joinedRoom) {
      const st = states.get(joinedRoom.code);
      st?.removePlayer(playerId);
      joinedRoom.remove(playerId);
      socket.leave(joinedRoom.code);
      joinedRoom = null;
    }
  }

  socket.on('disconnect', () => leave());

  function send(sock: typeof socket, msg: ServerMessage) {
    sock.emit('msg', msg);
  }
});

// ---- Authoritative simulation loop: 10 Hz step + snapshot -------------------
setInterval(() => {
  for (const [code, st] of states) {
    st.step();
    const room = manager.get(code);
    if (room) room.broadcast({ t: 'snapshot', snap: st.snapshot() });
    if (st.phase === 'ended') {
      // keep state briefly so clients can read the ending, then GC
      setTimeout(() => states.delete(code), 60_000);
    }
  }
}, 100);

server.listen(PORT, () => {
  console.log(`THE LAST EXORCISM - séance server listening on :${PORT} (protocol v${PROTOCOL_VERSION}, max ${MAX_PLAYERS}/room)`);
});
