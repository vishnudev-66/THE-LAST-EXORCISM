// ============================================================================
// THE LAST EXORCISM - Socket.IO multiplayer client (private co-op 2-8 players).
// Single-player never touches this module; the game works fully without a server.
// ============================================================================
import { io, type Socket } from 'socket.io-client';
import type { ClientMessage, ServerMessage, Snapshot } from '../shared-types';
import { useGame } from './state';

const g = () => useGame.getState();

class NetClient {
  private sock: Socket | null = null;
  onSnapshot: ((s: Snapshot) => void) | null = null;
  onEvent: ((msg: Extract<ServerMessage, { t: 'event' }>) => void) | null = null;
  connected = false;

  connect(serverUrl?: string) {
    if (this.sock) return;
    const url = serverUrl ?? (import.meta.env.VITE_SERVER_URL as string | undefined) ?? window.location.origin;
    this.sock = io(url, { transports: ['websocket', 'polling'], reconnectionAttempts: 6 });
    this.sock.on('connect', () => {
      this.connected = true;
      g().set({ connected: true });
      g().showToast('Connected to the séance (multiplayer server).');
    });
    this.sock.on('disconnect', () => {
      this.connected = false;
      g().set({ connected: false });
      g().showToast('Connection lost — attempting to reconnect…');
    });
    this.sock.on('message', (raw: ServerMessage) => this.handle(raw));
    this.sock.on('connect_error', () => {
      g().showToast('Multiplayer server unreachable. Solo campaign unaffected.');
    });
  }

  private handle(msg: ServerMessage) {
    switch (msg.t) {
      case 'welcome':
        g().set({ roomCode: msg.roomCode });
        break;
      case 'roster':
        window.dispatchEvent(new CustomEvent('tle:roster', { detail: msg.players }));
        break;
      case 'snapshot':
        this.onSnapshot?.(msg.snap);
        break;
      case 'event':
        this.onEvent?.(msg);
        window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: msg.kind, ...msg.data } }));
        break;
      case 'error':
        g().showToast(`Server: ${msg.message}`);
        break;
      case 'kicked':
        g().showToast(`Removed: ${msg.reason}`);
        g().set({ screen: 'menu', connected: false });
        break;
    }
  }

  join(roomCode: string, name: string) {
    this.send({ t: 'join', roomCode, name });
  }

  send(msg: ClientMessage) {
    if (!this.sock || !this.connected) return;
    this.sock.emit('msg', msg);
  }

  disconnect() {
    this.sock?.disconnect();
    this.sock = null;
    this.connected = false;
    g().set({ connected: false, roomCode: null });
  }
}

export const net = new NetClient();
