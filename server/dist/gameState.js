import { PROTOCOL_VERSION } from './types.js';
const CHAPTER_ORDER = [
    'ch01_invitation', 'ch02_locked_house', 'ch03_first_hunt', 'ch04_voice_on_radio', 'ch05_family_secret',
    'ch06_brides_game', 'ch07_hidden_caretaker', 'ch08_kings_key', 'ch09_treasure_vault', 'ch10_forgotten_ritual',
    'ch11_caretakers_truth', 'ch12_gateway', 'ch13_last_exorcism', 'ch14_beyond_the_door', 'ch15_seven_gates',
];
/** Coarse region adjacency used by enemy pathing through doorway "corridors". */
const REGION_GRAPH = {
    exterior: ['entrance_hall'],
    entrance_hall: ['exterior', 'grand_staircase', 'kitchen', 'dining_room', 'library'],
    grand_staircase: ['entrance_hall', 'bedrooms', 'ballroom', 'medical_room', 'storage_room', 'sealed_wing'],
    kitchen: ['entrance_hall', 'dining_room', 'storage_room', 'servants_tunnels'],
    dining_room: ['entrance_hall', 'kitchen', 'ballroom'],
    bedrooms: ['grand_staircase', 'medical_room', 'sealed_wing'],
    library: ['entrance_hall', 'occult_library', 'archive'],
    ballroom: ['grand_staircase', 'dining_room', 'sealed_wing'],
    medical_room: ['grand_staircase', 'bedrooms'],
    storage_room: ['grand_staircase', 'kitchen', 'ritual_storage'],
    sealed_wing: ['grand_staircase', 'nursery', 'evelyns_room', 'portrait_gallery', 'investigation_room', 'secret_passages'],
    nursery: ['sealed_wing', 'evelyns_room'],
    evelyns_room: ['sealed_wing', 'nursery', 'archive'],
    investigation_room: ['sealed_wing', 'archive'],
    portrait_gallery: ['sealed_wing', 'ballroom'],
    archive: ['library', 'investigation_room', 'evelyns_room', 'occult_library'],
    secret_passages: ['sealed_wing', 'chapel', 'ritual_storage', 'servants_tunnels'],
    chapel: ['secret_passages', 'ritual_storage', 'occult_library', 'catacombs'],
    ritual_storage: ['storage_room', 'secret_passages', 'weapons_locker', 'chapel'],
    weapons_locker: ['ritual_storage'],
    occult_library: ['library', 'chapel', 'archive'],
    servants_tunnels: ['kitchen', 'secret_passages', 'catacombs', 'prison_cells'],
    catacombs: ['chapel', 'servants_tunnels', 'prison_cells', 'laboratory', 'treasure_vault'],
    prison_cells: ['servants_tunnels', 'catacombs', 'laboratory'],
    laboratory: ['catacombs', 'prison_cells', 'sacrificial_chamber'],
    sacrificial_chamber: ['laboratory', 'gateway_mechanisms', 'treasure_vault'],
    treasure_vault: ['catacombs', 'sacrificial_chamber'],
    gateway_mechanisms: ['sacrificial_chamber', 'gateway_chamber', 'escape_tunnel'],
    escape_tunnel: ['gateway_mechanisms', 'exterior'],
    gateway_chamber: ['gateway_mechanisms'],
};
function bfsPath(from, to) {
    if (from === to)
        return [to];
    const seen = new Set([from]);
    let frontier = [[from]];
    while (frontier.length) {
        const next = [];
        for (const path of frontier) {
            for (const nb of REGION_GRAPH[path[path.length - 1]] ?? []) {
                if (seen.has(nb))
                    continue;
                seen.add(nb);
                const p = [...path, nb];
                if (nb === to)
                    return p;
                next.push(p);
            }
        }
        frontier = next;
    }
    return [from]; // unreachable: stay put
}
export class GameState {
    tick = 0;
    seed;
    phase = 'lobby';
    chapter = 'ch01_invitation';
    sealIntegrity = 100;
    ending;
    players = new Map();
    votes = new Map();
    enemies = [];
    doors = [];
    lastInputAt = new Map();
    constructor(seed) {
        this.seed = seed;
        // deterministic-ish spawn using room seed
        const rnd = mulberry(seed);
        this.enemies = [
            { type: 'butcher', pos: { x: 0, y: 0, z: 0 }, region: 'storage_room', aiState: 'idle', alerted: false },
            { type: 'bride', pos: { x: rnd() * 4 - 2, y: 0, z: rnd() * 4 - 2 }, region: 'ballroom', aiState: 'lurk', alerted: false },
            { type: 'hollowKing', pos: { x: 0, y: 0, z: 0 }, region: 'chapel', aiState: 'dormant', alerted: false },
            { type: 'caretaker', pos: { x: 0, y: 0, z: 0 }, region: 'investigation_room', aiState: 'watching', alerted: false },
        ];
        this.doors = defaultDoors();
    }
    addPlayer(id, name) {
        this.players.set(id, {
            id, name,
            pos: { x: 0, y: 1.6, z: 8 }, yaw: Math.PI,
            region: 'exterior', alive: true, isSpirit: false,
            crouching: false, sprinting: false, flashlightOn: false,
            health: 100, sanity: 100,
        });
    }
    removePlayer(id) {
        this.players.delete(id);
        this.votes.delete(id);
    }
    applyInput(id, m) {
        const p = this.players.get(id);
        if (!p)
            return;
        // server-authoritative sanity checks: clamp position & teleport speed
        const now = Date.now();
        const prev = this.lastInputAt.get(id) ?? now;
        const dt = Math.max(0.05, (now - prev) / 1000);
        this.lastInputAt.set(id, now);
        const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z;
        const speed = Math.hypot(dx, dz) / dt;
        if (!Number.isFinite(speed) || speed > 15) {
            // teleport (region change / scripted move): accept but reset the reference
            p.pos = { x: clamp(m.pos.x, -120, 120), y: 1.6, z: clamp(m.pos.z, -120, 120) };
            this.lastInputAt.set(id, now);
        }
        else {
            p.pos = { x: clamp(m.pos.x, -120, 120), y: 1.6, z: clamp(m.pos.z, -120, 120) };
        }
        p.yaw = m.yaw;
        p.region = m.region;
        p.crouching = m.crouch;
        p.sprinting = m.sprint;
        p.flashlightOn = m.flashlight;
    }
    /** advance simulation one tick (called at 10 Hz) */
    step() {
        this.tick++;
        if (this.phase !== 'playing')
            return;
        const alivePlayers = [...this.players.values()].filter((p) => p.alive);
        // --- Butcher AI: hunt nearest living player in reach -------------------
        const butcher = this.enemies.find((e) => e.type === 'butcher');
        if (butcher && butcher.aiState !== 'stunned' && alivePlayers.length) {
            const target = pickTarget(butcher, alivePlayers);
            if (target) {
                if (target.region !== butcher.region) {
                    const path = bfsPath(butcher.region, target.region);
                    if (path.length > 1)
                        butcher.region = path[1];
                }
                else {
                    butcher.alerted = true;
                    butcher.aiState = 'chase';
                    const d = dist(target.pos, butcher.pos);
                    if (d < 1.8) {
                        butcher.aiState = 'attack';
                        target.health = Math.max(0, target.health - 25);
                        if (target.health <= 0)
                            this.kill(target.id);
                    }
                    else {
                        // move toward target (simple lerp on the plane)
                        butcher.pos.x += (target.pos.x - butcher.pos.x) * 0.06;
                        butcher.pos.z += (target.pos.z - butcher.pos.z) * 0.06;
                    }
                }
            }
            else {
                butcher.alerted = false;
                butcher.aiState = 'patrol';
            }
        }
        // --- Bride: relocate between illusion regions when observed -------------
        const bride = this.enemies.find((e) => e.type === 'bride');
        if (bride && this.tick % 40 === 0) {
            const nbrs = REGION_GRAPH[bride.region] ?? ['ballroom'];
            bride.region = nbrs[Math.floor(Math.random() * nbrs.length)];
        }
        // --- Hollow King awakens once the campaign reaches chapter 8 ------------
        if (chapterNum(this.chapter) >= 8) {
            const king = this.enemies.find((e) => e.type === 'hollowKing');
            if (king && king.aiState === 'dormant')
                king.aiState = 'awake';
        }
        // --- Seal drains slowly while playing; ends the run at zero -------------
        if (chapterNum(this.chapter) >= 12)
            this.sealIntegrity = Math.max(0, this.sealIntegrity - 0.05);
        if (this.sealIntegrity <= 0 && !this.ending)
            this.finish('ending_consumed');
        // --- All players dead -> spirit ending ----------------------------------
        if (this.players.size > 0 && [...this.players.values()].every((p) => !p.alive)) {
            this.finish('ending_spirit');
        }
    }
    kill(playerId) {
        const p = this.players.get(playerId);
        if (!p || !p.alive)
            return;
        p.alive = false;
        p.isSpirit = true; // story ch4: the selected death becomes a playable spirit
    }
    useEquipment(playerId, slot, targetEnemy) {
        const p = this.players.get(playerId);
        if (!p)
            return null;
        if (slot === 'holy_water' && targetEnemy) {
            const e = this.enemies.find((x) => x.type === targetEnemy);
            if (e && e.type === 'butcher' && dist(e.pos, p.pos) < 4) {
                e.aiState = 'stunned';
                setTimeout(() => { e.aiState = 'patrol'; }, 8000);
                return { kind: 'enemy_despawn', data: { enemy: 'butcher', stunned: true } };
            }
        }
        if (slot === 'salt') {
            // salt line blocks the butcher from entering this region for a while
            const b = this.enemies.find((x) => x.type === 'butcher');
            if (b && b.region === p.region) {
                b.aiState = 'investigate';
            }
        }
        return null;
    }
    voteDecision(playerId, decision) {
        this.votes.set(playerId, decision);
        // majority decides the Caretaker chapter outcome
        const counts = { expose: 0, confront: 0, persuade: 0, pact: 0 };
        for (const v of this.votes.values())
            counts[v]++;
        const winner = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
        if (this.players.size >= 2 && [...this.players.values()].every((p) => this.votes.has(p.id))) {
            if (winner === 'pact')
                this.sealIntegrity = Math.max(0, this.sealIntegrity - 30);
            if (winner === 'persuade')
                this.sealIntegrity = Math.min(100, this.sealIntegrity + 10);
            return winner;
        }
        return null;
    }
    advanceChapter(action) {
        if (action === 'complete') {
            const i = CHAPTER_ORDER.indexOf(this.chapter);
            if (i >= 0 && i < CHAPTER_ORDER.length - 1) {
                this.chapter = CHAPTER_ORDER[i + 1];
                if (this.chapter === 'ch13_last_exorcism') {
                    this.enemies.push({ type: 'satan', pos: { x: 0, y: 0, z: 0 }, region: 'gateway_chamber', aiState: 'manifest', alerted: true });
                }
                return this.chapter;
            }
        }
        if (action === 'finish') {
            // final choice mapping comes from payload elsewhere; default good ending
            this.finish('ending_gate_closed');
        }
        return null;
    }
    finish(ending) {
        if (this.phase === 'ended')
            return;
        this.phase = 'ended';
        this.ending = ending;
    }
    snapshot() {
        return {
            protocol: PROTOCOL_VERSION,
            tick: this.tick,
            seed: this.seed,
            players: [...this.players.values()],
            enemies: this.enemies.map((e) => ({ ...e, pos: { ...e.pos } })),
            doors: this.doors,
            sealIntegrity: this.sealIntegrity,
            phase: this.phase,
            ending: this.ending,
        };
    }
}
function chapterNum(c) {
    return CHAPTER_ORDER.indexOf(c) + 1;
}
function pickTarget(butcher, players) {
    // sound-driven: prefer same-region players, then adjacent regions
    let best = null;
    let bestScore = Infinity;
    for (const p of players) {
        const adj = (REGION_GRAPH[butcher.region] ?? []).includes(p.region);
        const score = p.region === butcher.region ? 0 : adj ? 1 : 5;
        if (score < bestScore) {
            bestScore = score;
            best = p;
        }
    }
    // hiding reduces detection: crouching + not sprinting in another region stays hidden
    if (best && bestScore > 0 && best.crouching && !best.sprinting)
        return null;
    return best;
}
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.z - b.z);
}
function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
function mulberry(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function defaultDoors() {
    return [
        { id: 'front_door', open: false, locked: true, region: 'entrance_hall' }, // seals after entry (ch1)
        { id: 'sealed_wing_door', open: false, locked: true, region: 'grand_staircase' },
        { id: 'chapel_door', open: true, locked: false, region: 'chapel' },
        { id: 'weapons_locker', open: false, locked: true, region: 'weapons_locker' }, // needs necklace key (ch8)
        { id: 'vault_door', open: false, locked: true, region: 'treasure_vault' },
        { id: 'gate_door', open: false, locked: true, region: 'gateway_chamber' },
        { id: 'escape_tunnel_door', open: false, locked: false, region: 'escape_tunnel' },
    ];
}
