// ============================================================================
// THE LAST EXORCISM - Enemy AI system (client-side sim for single player;
// the coop server runs the same logic authoritatively in server/src/ai.ts).
//
// BUTCHER: sound-based detection -> investigate -> chase -> attack. Weakens to
//   holy water, loses you by crouching/hiding. Breaks weak barriers while chasing.
// WEEPING BRIDE: illusion engine - spawns false doors/whispers, mimics authored
//   voices (never real player audio), separates via misinformation.
// HOLLOW KING: darkness controller - kills lights/equipment, locks doors,
//   possesses objects; resolvable non-violently if his history is known.
// SATAN: gate pressure - scripted finale presence.
// ============================================================================
import * as THREE from 'three';
import { useGame } from './state';
import { audio } from './audio';
import { BRIDE_WHISPERS, SATAN_LINES } from '../data/lore';
import { weakenSeal } from '../data/campaign';
import { ROOMS } from '../data/world';
import type { RegionId } from '../shared-types';

const g = () => useGame.getState();

export type ButcherState = 'asleep' | 'patrol' | 'investigate' | 'chase' | 'attack' | 'stunned' | 'freed';

export interface ButcherAI {
  state: ButcherState;
  pos: THREE.Vector3;
  region: RegionId;
  lastKnownPlayer: THREE.Vector3;
  timer: number;
  stunTime: number;
  noise: number; // accumulated heard-noise level
}

export interface BrideAI {
  active: boolean;
  whisperTimer: number;
  illusionDoor: string | null;
}

export interface KingAI {
  active: boolean;
  darkness: number;      // 0..1 how much light he suppresses
  lockTimer: number;
  possessTarget: string | null;
}

export const butcher: ButcherAI = {
  state: 'asleep',
  pos: new THREE.Vector3(0, 0, 20),
  region: 'grand_staircase',
  lastKnownPlayer: new THREE.Vector3(),
  timer: 0,
  stunTime: 0,
  noise: 0,
};

export const bride: BrideAI = { active: false, whisperTimer: 12, illusionDoor: null };
export const king: KingAI = { active: false, darkness: 0, lockTimer: 0, possessTarget: null };

// ---------------------------------------------------------------------------
// Noise model: sprinting is loud, walking normal, crouch near-silent.
// The player movement system calls emitNoise() at footstep cadence.
// ---------------------------------------------------------------------------
export function emitNoise(level: number, pos: THREE.Vector3, region: RegionId) {
  if (butcher.state === 'asleep' || butcher.state === 'freed') return;
  if (region !== butcher.region) {
    // sound carries between adjacent regions at half strength
    level *= 0.45;
  }
  butcher.noise += level;
  if (butcher.noise > 1.6 && butcher.state !== 'chase') {
    butcher.state = 'investigate';
    butcher.lastKnownPlayer.copy(pos);
    butcher.region = region;
    butcher.timer = 9;
    audio.knifeDrag();
    g().showToast('Somewhere above, dragging stops. Listening.');
  } else if (butcher.noise > 3.2 && butcher.state === 'investigate') {
    startChase(pos);
  }
}

function startChase(pos: THREE.Vector3) {
  butcher.state = 'chase';
  butcher.region = g().region;
  butcher.lastKnownPlayer.copy(pos);
  audio.stinger();
  g().setFlag('butcherHunting');
  g().showToast('THE BUTCHER HAS FOUND YOU. Run — or hide and be still.');
  window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: 'jumpscare' } }));
}

export function wakeButcher() {
  if (butcher.state !== 'asleep') return;
  butcher.state = 'patrol';
  butcher.pos.set(0, 0, 20);
  butcher.region = 'grand_staircase';
  audio.knifeDrag();
}

// ---------------------------------------------------------------------------
// Per-frame update (called from the Player/Game loop with dt & player pos)
// ---------------------------------------------------------------------------
let dragAccum = 0;

export function updateEnemies(dt: number, playerPos: THREE.Vector3, playerRegion: RegionId, hidden: boolean) {
  const s = g();
  butcher.noise = Math.max(0, butcher.noise - dt * 0.7);

  switch (butcher.state) {
    case 'patrol': {
      // wander current region, occasional knife-drag sound
      butcher.timer -= dt;
      if (butcher.timer <= 0) {
        butcher.timer = 4 + Math.random() * 5;
        const roomCenter = new THREE.Vector3(regionCenter(butcher.region));
        butcher.pos.lerp(roomCenter.add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)), 0.6);
      }
      dragAccum += dt;
      if (dragAccum > 6) {
        dragAccum = 0;
        if (butcher.region === playerRegion) audio.knifeDrag();
      }
      break;
    }
    case 'investigate': {
      butcher.timer -= dt;
      const to = butcher.lastKnownPlayer.clone().sub(butcher.pos);
      if (to.length() > 0.6) {
        to.normalize();
        butcher.pos.addScaledVector(to, dt * 2.2);
      }
      if (butcher.noise > 2.4 && !hidden) startChase(playerPos);
      if (butcher.timer <= 0) butcher.state = 'patrol';
      break;
    }
    case 'chase': {
      if (butcher.region !== playerRegion) {
        // move toward the doorway of the player's region (simplified: teleport-follow through doors)
        butcher.region = playerRegion;
        butcher.pos.set(regionCenter(playerRegion).x, 0, regionCenter(playerRegion).z + 6);
      }
      const to = playerPos.clone().sub(butcher.pos);
      const dist = to.length();
      if (hidden && dist > 5) {
        // lost sight: search last position
        butcher.state = 'investigate';
        butcher.timer = 7;
        butcher.lastKnownPlayer.copy(playerPos);
        g().showToast('Heavy footsteps circle, then drift away…');
      } else if (dist < 1.7) {
        butcher.state = 'attack';
        butcher.timer = 0.6;
      } else {
        to.normalize();
        butcher.pos.addScaledVector(to, dt * 3.4); // slower than sprint, faster than walk
        if (Math.random() < dt * 0.6) audio.knifeDrag();
      }
      break;
    }
    case 'attack': {
      butcher.timer -= dt;
      if (butcher.timer <= 0) {
        if (!hidden) {
          s.set({ health: Math.max(0, s.health - 34) });
          audio.stinger();
          window.dispatchEvent(new CustomEvent('tle:hurt', {}));
          g().showToast('The knife finds you. Cold first, pain after.');
          if (g().health <= 0) handleDeath();
        }
        butcher.state = 'chase';
      }
      break;
    }
    case 'stunned': {
      butcher.stunTime -= dt;
      if (butcher.stunTime <= 0) {
        butcher.state = 'patrol';
        g().showToast('He rises like a door swinging back open.');
      }
      break;
    }
    default:
      break;
  }

  // proximity heartbeat & tension
  const d = butcher.region === playerRegion ? butcher.pos.distanceTo(playerPos) : 999;
  if (d < 12 && butcher.state !== 'asleep' && butcher.state !== 'freed') {
    audio.setTension(Math.min(1, (12 - d) / 10));
    const bpm = 60 + Math.floor((12 - d) * 6);
    if ((updateEnemies as never as { _hb?: number })._hb !== bpm) {
      (updateEnemies as never as { _hb?: number })._hb = bpm;
      audio.heartbeat(bpm);
    }
  } else {
    audio.setTension(s.sealIntegrity < 40 ? 0.4 : 0.1);
    if ((updateEnemies as never as { _hb?: number })._hb) {
      (updateEnemies as never as { _hb?: number })._hb = 0;
      audio.heartbeat(0);
    }
  }

  // ---- Weeping Bride: whispers & illusion doors during her chapters ----
  const chNum = chapterNumberNow();
  if (bride.active || chNum === 6) {
    bride.active = true;
    bride.whisperTimer -= dt;
    if (bride.whisperTimer <= 0) {
      bride.whisperTimer = 18 + Math.random() * 20;
      audio.whisper();
      const line = BRIDE_WHISPERS[Math.floor(Math.random() * BRIDE_WHISPERS.length)];
      s.set({ hint: `A voice, somewhere: “${line}”` });
      setTimeout(() => {
        if (g().hint?.includes(line)) g().set({ hint: null });
      }, 7000);
    }
  }

  // ---- Hollow King: light suppression during chapel arc ----
  if (chNum >= 8 && !s.flags.kingResolved) {
    king.active = true;
    king.darkness = Math.min(0.85, king.darkness + dt * 0.02);
    king.lockTimer -= dt;
    if (king.lockTimer <= 0 && s.region === 'chapel') {
      king.lockTimer = 22;
      s.showToast('The chapel doors sigh shut, then reconsider. The lamps gutter without wind.');
      window.dispatchEvent(new CustomEvent('tle:lightsFlicker', {}));
    }
  } else {
    king.active = false;
    king.darkness = Math.max(0, king.darkness - dt * 0.05);
  }

  // seal pressure in late chapters
  if (chNum >= 12) {
    weakenSealTick(dt);
  }
}

let sealTick = 0;
function weakenSealTick(dt: number) {
  sealTick += dt;
  if (sealTick > 10) {
    sealTick = 0;
    if (g().sealIntegrity > 5) weakenSeal(1);
  }
}

export function butcherStun() {
  butcher.state = 'stunned';
  butcher.stunTime = 14;
  butcher.noise = 0;
  g().setFlag('butcherHunting', false);
}

export function butcherShoot() {
  if (butcher.state === 'chase') {
    butcher.state = 'stunned';
    butcher.stunTime = 6;
    g().showToast('A silver round takes his shoulder. He looks almost surprised. Almost grateful.');
  } else {
    butcher.noise = 4; // gunfire attracts
  }
}

export function freeButcher() {
  butcher.state = 'freed';
  audio.sealChime();
  g().showToast('“Ambrose,” you say. The knife drops first, then the man. He bows, and leaves sideways through the wall.');
  g().setFlag('freedButcher');
}

export function saltLine() {
  if (butcher.state === 'chase') {
    butcher.state = 'investigate';
    butcher.timer = 5;
    g().showToast('He stops at the salt line, considers it, steps around it. Seconds bought, not safety.');
  }
}

function chapterNumberNow(): number {
  const order = [
    'ch01_invitation','ch02_locked_house','ch03_first_hunt','ch04_voice_on_radio','ch05_family_secret',
    'ch06_brides_game','ch07_hidden_caretaker','ch08_kings_key','ch09_treasure_vault','ch10_forgotten_ritual',
    'ch11_caretakers_truth','ch12_gateway','ch13_last_exorcism','ch14_beyond_the_door','ch15_seven_gates',
  ];
  return order.indexOf(g().chapter) + 1;
}

function regionCenter(r: RegionId): { x: number; y: number; z: number } {
  const room = ROOMS.find((x) => x.id === r) ?? ROOMS[0];
  return { x: room.cx, y: 0, z: room.cz };
}

export function satanTaunt() {
  audio.speak(SATAN_LINES[Math.floor(Math.random() * SATAN_LINES.length)], { pitch: 0.2, rate: 0.7 });
}

export function handleDeath() {
  const s = g();
  if (s.mode === 'single') {
    // single player: near-death vision -> spirit state instead of hard game over once
    if (!s.flags.diedOnce) {
      s.setFlag('diedOnce');
      s.set({ health: 40, isSpirit: true, sanity: Math.max(0, s.sanity - 20) });
      s.showToast('You die briefly. The house hands you back like a library book.');
      window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: 'spirit_transform' } }));
      return;
    }
    s.set({ screen: 'ending', ending: 'ending_consumed' });
    return;
  }
  // coop: mark dead -> spirit; if everyone dead -> spirit ending
  s.set({ health: 0, isSpirit: true });
  s.set({ deaths: s.deaths + 1 });
  window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: 'player_died' } }));
  if (s.deaths >= 1 && s.flags.allLost) s.set({ screen: 'ending', ending: 'ending_spirit' });
}
