// ============================================================================
// THE LAST EXORCISM - Shared TypeScript types for network messages & game state
// Used by the client (game/) and the authoritative server (server/).
// ============================================================================

export const PROTOCOL_VERSION = 1;

/** Regions of Blackthorn Manor. Only one region is simulated/rendered at a time. */
export type RegionId =
  | 'exterior'
  | 'entrance_hall'
  | 'grand_staircase'
  | 'kitchen'
  | 'dining_room'
  | 'bedrooms'
  | 'library'
  | 'ballroom'
  | 'medical_room'
  | 'storage_room'
  | 'sealed_wing'
  | 'nursery'
  | 'evelyns_room'
  | 'investigation_room'
  | 'portrait_gallery'
  | 'archive'
  | 'secret_passages'
  | 'chapel'
  | 'ritual_storage'
  | 'weapons_locker'
  | 'occult_library'
  | 'servants_tunnels'
  | 'catacombs'
  | 'prison_cells'
  | 'laboratory'
  | 'sacrificial_chamber'
  | 'treasure_vault'
  | 'gateway_mechanisms'
  | 'escape_tunnel'
  | 'gateway_chamber';

/** Campaign chapters, in order. */
export type ChapterId =
  | 'ch01_invitation'
  | 'ch02_locked_house'
  | 'ch03_first_hunt'
  | 'ch04_voice_on_radio'
  | 'ch05_family_secret'
  | 'ch06_brides_game'
  | 'ch07_hidden_caretaker'
  | 'ch08_kings_key'
  | 'ch09_treasure_vault'
  | 'ch10_forgotten_ritual'
  | 'ch11_caretakers_truth'
  | 'ch12_gateway'
  | 'ch13_last_exorcism'
  | 'ch14_beyond_the_door'
  | 'ch15_seven_gates';

export type EnemyType = 'butcher' | 'bride' | 'hollowKing' | 'caretaker' | 'satan';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface PlayerState {
  id: string;
  name: string;
  pos: Vec3;
  yaw: number;
  region: RegionId;
  alive: boolean;
  isSpirit: boolean;
  crouching: boolean;
  sprinting: boolean;
  flashlightOn: boolean;
  health: number; // 0..100
  sanity: number; // 0..100
}

export interface EnemyState {
  type: EnemyType;
  pos: Vec3;
  region: RegionId;
  /** butcher: idle|patrol|investigate|chase|attack|stunned ; others use their own AI states */
  aiState: string;
  alerted: boolean;
}

export interface DoorState {
  id: string;
  open: boolean;
  locked: boolean;
  region: RegionId;
}

export interface ObjectiveProgress {
  chapter: ChapterId;
  objectivesDone: string[];
  flags: Record<string, boolean>;
}

export interface Snapshot {
  protocol: number;
  tick: number;
  seed: number;
  players: PlayerState[];
  enemies: EnemyState[];
  doors: DoorState[];
  sealIntegrity: number; // 0..100, drops as the ritual progresses
  phase: 'lobby' | 'playing' | 'ended';
  ending?: EndingId;
}

export type EndingId =
  | 'ending_seal_restored'   // Sacrifice / restore the seal, escape with the truth
  | 'ending_gate_closed'     // Reverse the ritual, free the bound spirits
  | 'ending_consumed'        // Failed: the gateway opens
  | 'ending_pact'            // Dark ending: side with the Caretaker / Satan
  | 'ending_spirit'          // All players die and become spirits (bad-but-thematic)
  | 'ending_escape_alive';   // Flee without resolving - the gateway stays unstable

// ---------------------------------------------------------------------------
// Client -> Server messages
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { t: 'join'; roomCode: string; name: string; invitedById?: string }
  | { t: 'input'; seq: number; pos: Vec3; yaw: number; region: RegionId; crouch: boolean; sprint: boolean; flashlight: boolean }
  | { t: 'interact'; objectId: string; region: RegionId }
  | { t: 'useEquipment'; slot: string; targetEnemy?: string }
  | { t: 'doorAction'; doorId: string; action: 'open' | 'close' | 'unlock' | 'pick' }
  | { t: 'chapterAction'; chapter: ChapterId; action: string; payload?: Record<string, unknown> }
  | { t: 'voteDecision'; decision: 'expose' | 'confront' | 'persuade' | 'pact' }
  | { t: 'leave'; roomCode: string };

// ---------------------------------------------------------------------------
// Server -> Client messages
// ---------------------------------------------------------------------------

export type ServerMessage =
  | { t: 'welcome'; playerId: string; roomCode: string; hostId: string }
  | { t: 'roster'; players: { id: string; name: string }[] }
  | { t: 'snapshot'; snap: Snapshot }
  | { t: 'event'; kind: EventKind; data?: Record<string, unknown> }
  | { t: 'error'; code: string; message: string }
  | { t: 'kicked'; reason: string };

export type EventKind =
  | 'player_died'
  | 'player_revived'
  | 'enemy_spawn'
  | 'enemy_despawn'
  | 'seal_weakened'
  | 'memory_revealed'
  | 'illusion_break'
  | 'radio_voice'
  | 'door_changed'
  | 'item_acquired'
  | 'chapter_complete'
  | 'ending'
  | 'spirit_transform'
  | 'jumpscare'
  | 'whisper';

export interface RoomInfo {
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  started: boolean;
}

export const MAX_PLAYERS = 8;
