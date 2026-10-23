// ============================================================================
// THE LAST EXORCISM - Player: first-person controller, collision, footsteps,
// flashlight, sanity/health. Rapier-style physics kept simple & deterministic
// (axis-aligned room bounds) for performance on mid-range devices.
// ============================================================================
import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { input } from '../systems/input';
import { useGame, saveCampaign } from '../systems/state';
import { pickNear, doInteract, useEquipment } from '../systems/interact';
import { updateEnemies, emitNoise, butcher, king } from '../systems/enemies';
import { ROOMS, DOORS } from '../data/world';
import { audio } from '../systems/audio';
import type { RegionId } from '../shared-types';

const g = () => useGame.getState();

export const playerPos = new THREE.Vector3(0, 1.6, -58);
let yaw = 0;
let pitch = 0;
let stepAccum = 0;
let bobT = 0;

function eyeHeight() {
  return g().crouching ? 1.0 : 1.6;
}

/** collide against room bounds + closed door panels of the current region */
function clampToRoom(p: THREE.Vector3, region: RegionId) {
  const room = ROOMS.find((r) => r.id === region)!;
  const hw = room.w / 2 - 0.4;
  const hd = room.d / 2 - 0.4;
  p.x = THREE.MathUtils.clamp(p.x, room.cx - hw, room.cx + hw);
  p.z = THREE.MathUtils.clamp(p.z, room.cz - hd, room.cz + hd);
  // doorway gaps: allow passing through open/unlocked doors
  for (const d of DOORS) {
    if (d.a !== region && d.b !== region) continue;
    const gap = 1.4;
    if (d.axis === 'z') {
      if (Math.abs(p.x - d.x) < gap && Math.abs(p.z - (d.z)) < 1.2) return; // in a doorway, skip wall clamp near it
    } else {
      if (Math.abs(p.z - d.z) < gap && Math.abs(p.x - (d.x)) < 1.2) return;
    }
  }
}

export function PlayerController() {
  const { camera } = useThree();
  const flashRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef(new THREE.Object3D());
  const shake = useRef(0);

  useEffect(() => {
    camera.rotation.order = 'YXZ';
    const tp = (e: Event) => {
      const d = (e as CustomEvent).detail as { region: string; x: number; z: number };
      playerPos.set(d.x, eyeHeight(), d.z);
      yaw = d.region === 'exterior' ? 0 : Math.atan2(d.x, d.z) + Math.PI;
    };
    window.addEventListener('tle:teleport', tp);
    const hurt = () => { shake.current = 1; };
    window.addEventListener('tle:hurt', hurt);
    return () => {
      window.removeEventListener('tle:teleport', tp);
      window.removeEventListener('tle:hurt', hurt);
    };
  }, [camera]);

  useFrame((_, dtRaw) => {
    const s = g();
    const dt = Math.min(dtRaw, 0.05);
    if (s.paused || s.screen !== 'game') return;

    // ---- look ----
    yaw -= input.state.lookDelta.x;
    pitch -= input.state.lookDelta.y;
    pitch = THREE.MathUtils.clamp(pitch, -1.45, 1.45);

    // ---- move ----
    input.pollKeys();
    const mv = input.state.move;
    const speed = s.isSpirit ? 5.2 : input.state.sprint && !s.crouching ? 5.6 : s.crouching ? 1.9 : 3.2;
    if (input.state.crouchToggle) s.set({ crouching: !s.crouching });

    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    const vx = (mv.x * cos - mv.y * sin) * speed;
    const vz = (-mv.x * sin - mv.y * cos) * speed;
    const moving = mv.lengthSq() > 0.01;
    if (moving) {
      playerPos.x += vx * dt;
      playerPos.z += vz * dt;
      clampToRoom(playerPos, s.region);
      // footsteps -> noise model
      stepAccum += dt * (input.state.sprint ? 2.6 : s.crouching ? 0.9 : 1.7);
      if (stepAccum >= 1) {
        stepAccum = 0;
        audio.footstep(s.crouching);
        if (!s.isSpirit) {
          const lvl = input.state.sprint ? 1.4 : s.crouching ? 0.15 : 0.6;
          emitNoise(lvl, playerPos.clone(), s.region);
        }
      }
      bobT += dt * (input.state.sprint ? 11 : 7);
    }

    // ---- interactions ----
    if (input.state.interactEdge) {
      const pick = pickNear(playerPos, yaw);
      if (pick.label) doInteract(pick);
      else s.showToast('Nothing within reach.');
    }
    if (input.state.flashlightEdge) {
      s.set({ flashlightOn: !s.flashlightOn });
      audio.page();
    }
    if (input.state.useEdge) {
      const ePos = butcher.region === s.region && butcher.state !== 'asleep' ? butcher.pos : null;
      useEquipment(ePos, playerPos.clone());
    }
    if (input.state.inventoryEdge) s.set({ showInventory: !s.showInventory, showNotebook: false, paused: false });
    if (input.state.notebookEdge) s.set({ showNotebook: !s.showNotebook, showInventory: false, paused: false });
    if (input.state.pauseEdge) {
      if (s.showInventory || s.showNotebook) s.set({ showInventory: false, showNotebook: false });
      else s.set({ paused: !s.paused });
      if (s.paused) { input.releaseLock(); saveCampaign(); }
      else input.requestLock();
    }
    if (input.state.wheelSlotDelta !== 0 && s.inventory.length) {
      const n = s.inventory.length;
      s.set({ selectedSlot: ((s.selectedSlot + input.state.wheelSlotDelta) % n + n) % n });
    }

    // spirit mechanics: near the candle shrine, interacting returns you to your body.
    if (s.isSpirit && s.sanity < 100) {
      s.set({ sanity: Math.min(100, s.sanity + dt * 2) });
    }

    // ---- enemies ----
    const hidden = s.flags.hiding || s.crouching && !moving;
    updateEnemies(dt, playerPos.clone(), s.region, !!hidden);

    // Hollow King suppresses flashlight
    const flashAllowed = s.flashlightOn && !(king.active && king.darkness > 0.6 && Math.random() < 0.02);

    // ---- camera ----
    const bob = s.settings.cameraShake && moving ? Math.sin(bobT) * 0.045 : 0;
    let shX = 0, shY = 0;
    if (shake.current > 0) {
      shake.current = Math.max(0, shake.current - dt * 2);
      shX = (Math.random() - 0.5) * 0.12 * shake.current;
      shY = (Math.random() - 0.5) * 0.12 * shake.current;
    }
    const lowSanity = s.sanity < 35 ? (35 - s.sanity) / 35 : 0;
    const drift = lowSanity * Math.sin(performance.now() / 900) * 0.02;
    camera.position.set(playerPos.x + shX, eyeHeight() + bob + shY, playerPos.z);
    camera.rotation.set(pitch + drift * 0.3, yaw + drift, drift);

    // ---- flashlight follow ----
    if (flashRef.current) {
      flashRef.current.visible = flashAllowed;
      flashRef.current.intensity = flashAllowed ? (s.isSpirit ? 6 : 14) : 0;
      const dir = new THREE.Vector3(Math.sin(yaw) * -1, Math.sin(pitch), Math.cos(yaw) * -1).normalize();
      targetRef.current.position.copy(camera.position).addScaledVector(dir, 12);
      targetRef.current.updateMatrixWorld();
      flashRef.current.target = targetRef.current;
    }

    // passive sanity pressure when dark & seal weak
    if (!flashAllowed && !ROOMS.find((r) => r.id === s.region)?.outdoor) {
      s.set({ sanity: Math.max(0, s.sanity - dt * 0.35) });
    } else {
      s.set({ sanity: Math.min(100, s.sanity + dt * 0.12) });
    }

    // net sync placeholder for coop
    if (g().connected) {
      // throttled input messages sent by CoopBridge component to avoid per-frame spam
    }

    input.endFrame();
  });

  return (
    <>
      {/* Flashlight: single spotlight attached to camera rig */}
      <spotLight
        ref={flashRef}
        position={[0, 0, 0]}
        angle={0.42}
        penumbra={0.55}
        intensity={0}
        distance={26}
        decay={1.6}
        color="#fff6da"
        castShadow={false}
      />
      <primitive object={targetRef.current} />
    </>
  );
}

/** expose yaw for other systems (interaction facing etc.) */
export function getPlayerYaw() {
  return yaw;
}
