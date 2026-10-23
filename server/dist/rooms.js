import { MAX_PLAYERS, PROTOCOL_VERSION } from './types.js';
export class Room {
    code;
    hostId = '';
    hostName = '';
    started = false;
    seed = Math.floor(Math.random() * 0xffffffff);
    protocol = PROTOCOL_VERSION;
    players = new Map();
    constructor(code) {
        this.code = code;
    }
    info() {
        return {
            code: this.code,
            hostName: this.hostName,
            playerCount: this.players.size,
            maxPlayers: MAX_PLAYERS,
            started: this.started,
        };
    }
    add(player) {
        if (this.players.size >= MAX_PLAYERS) {
            player.socket.emit('msg', { t: 'error', code: 'room_full', message: `Room ${this.code} is full (${MAX_PLAYERS} invitations per séance).` });
            player.socket.disconnect(true);
            return false;
        }
        this.players.set(player.id, player);
        if (!this.hostId) {
            this.hostId = player.id;
            this.hostName = player.name;
        }
        this.broadcast({ t: 'roster', players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name })) });
        return true;
    }
    remove(id) {
        this.players.delete(id);
        if (this.hostId === id) {
            const next = [...this.players.values()][0];
            this.hostId = next?.id ?? '';
            this.hostName = next?.name ?? '';
        }
        this.broadcast({ t: 'roster', players: [...this.players.values()].map((p) => ({ id: p.id, name: p.name })) });
        if (this.players.size === 0)
            RoomManager.instance.delete(this.code);
    }
    sendTo(id, msg) {
        this.players.get(id)?.socket.emit('msg', msg);
    }
    broadcast(msg, exceptId) {
        for (const [id, p] of this.players)
            if (id !== exceptId)
                p.socket.emit('msg', msg);
    }
    /** relay a gameplay message from one client to the rest (state merge happens on host) */
    relay(fromId, msg) {
        this.broadcast({ t: 'event', kind: 'door_changed', data: { from: fromId, msg } }, fromId);
    }
}
export class RoomManager {
    static instance = new RoomManager();
    rooms = new Map();
    get(code) {
        return this.rooms.get(code.toUpperCase());
    }
    getOrCreate(code) {
        const c = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'BLACKTHORN'.slice(0, 4);
        let r = this.rooms.get(c);
        if (!r) {
            r = new Room(c);
            this.rooms.set(c, r);
        }
        return r;
    }
    create() {
        // human-friendly invitation codes (no vowels to avoid accidental words)
        const alphabet = 'BCDFGHJKLMNPQRSTVWXZ23456789';
        let code = '';
        do {
            code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
        } while (this.rooms.has(code));
        const r = new Room(code);
        this.rooms.set(code, r);
        return r;
    }
    delete(code) {
        this.rooms.delete(code);
    }
    list() {
        return [...this.rooms.values()].map((r) => r.info());
    }
}
