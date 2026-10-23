// ============================================================================
// THE LAST EXORCISM - Game scene root: R3F Canvas, region streaming mount,
// player controller, chapter triggers, coop bridge.
// ============================================================================
import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { Manor } from './Manor';
import { PlayerController, playerPos } from './Player';
import { useGame, loadCampaign } from '../systems/state';
import { input } from '../systems/input';
import { audio } from '../systems/audio';
import { wakeButcher, butcherStun, butcherShoot, saltLine, freeButcher } from '../systems/enemies';
import { revealMemory, chapterById } from '../data/campaign';
import { MEMORIES } from '../data/lore';
import { goToRegion } from '../systems/interact';
import type { ChapterId } from '../shared-types';

const g = () => useGame.getState();

/** Wires gameplay events (chapter changes, stuns, reveals) into systems */
function GameLogic() {
  useEffect(() => {
    const onChapter = (e: Event) => {
      const ch = chapterById((e as CustomEvent<ChapterId>).detail);
      // teleport to the chapter's start region
      goToRegion(ch.region);
      // chapter-specific wakes
      if (ch.num === 3) {
        wakeButcher();
        g().showToast('Something enormous stops listening three rooms away.');
      }
      if (ch.num === 6 && !g().flags.m3heard) {
        // The bride whispers begin; also possible memory m3/m4 discovery via gallery
      }
      if (ch.num === 8) {
        // King awakens in chapel
      }
      if (ch.num === 12) {
        g().setFlag('gateApproached');
      }
    };
    const stun = () => butcherStun();
    const shoot = () => butcherShoot();
    const salting = () => saltLine();
    const seams = () => {
      // cross reveals illusion seams -> show false-door truth & unlock memory path
      g().showToast('Through the cross: the corridor ahead has NO floor plan underneath it. A seam of static runs down the wallpaper.');
      g().setFlag('seamsSeen');
    };
    const flicker = () => {
      g().set({ sanity: Math.max(0, g().sanity - 4) });
    };
    const galleryMem = () => {
      // portrait gallery can reveal memories m3/m4 once chapter 6+ reached
      const s = g();
      if (s.region === 'portrait_gallery' && chapterById(s.chapter).num >= 6) {
        if (!s.memoriesFound.includes('m3')) {
          const m = MEMORIES.m3;
          revealMemory('m3', m.title, m.body);
          setTimeout(() => {
            g().showToast('“Say his name,” Evelyn whispers. “The guard had one before the knife.”');
            freeButcher();
          }, 5000);
        } else if (!s.memoriesFound.includes('m4')) {
          const m = MEMORIES.m4;
          revealMemory('m4', m.title, m.body);
        }
      }
    };
    window.addEventListener('tle:chapter', onChapter);
    window.addEventListener('tle:butcherStun', stun);
    window.addEventListener('tle:shoot', shoot);
    window.addEventListener('tle:saltLine', salting);
    window.addEventListener('tle:revealSeams', seams);
    window.addEventListener('tle:lightsFlicker', flicker);
    const iv = setInterval(galleryMem, 2500);
    return () => {
      window.removeEventListener('tle:chapter', onChapter);
      window.removeEventListener('tle:butcherStun', stun);
      window.removeEventListener('tle:shoot', shoot);
      window.removeEventListener('tle:saltLine', salting);
      window.removeEventListener('tle:revealSeams', seams);
      window.removeEventListener('tle:lightsFlicker', flicker);
      clearInterval(iv);
    };
  }, []);
  return null;
}

/** Multiplayer bridge: send throttled position updates when connected */
function CoopBridge() {
  useEffect(() => {
    let alive = true;
    const loop = async () => {
      while (alive) {
        const s = g();
        if (s.connected) {
          const { net } = await import('../systems/net');
          net.send({
            t: 'input',
            seq: Date.now(),
            pos: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
            yaw: 0,
            region: s.region,
            crouch: s.crouching,
            sprint: input.state.sprint,
            flashlight: s.flashlightOn,
          });
        }
        await new Promise((r) => setTimeout(r, 120));
      }
    };
    loop();
    return () => { alive = false; };
  }, []);
  return null;
}

export function GameScene() {
  const brightness = useGame((s) => s.settings.brightness);
  useEffect(() => {
    // initial spawn
    const s = g();
    if (s.region === 'exterior') playerPos.set(0, 1.6, -70);
    const first = chapterById(s.chapter);
    window.dispatchEvent(new CustomEvent('tle:chapter', { detail: first.id }));
    // resume audio on gesture already done at menu; keep lock request on click
    const click = () => { input.requestLock(); audio.resume(); };
    window.addEventListener('pointerdown', click);
    // handle visibility change / rotation gracefully
    const vis = () => { if (document.hidden && !g().paused) g().set({ paused: true, hint: null }); };
    document.addEventListener('visibilitychange', vis);
    const resize = () => { /* canvas auto-resizes via R3F; re-lock handled by browser */ };
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    return () => {
      window.removeEventListener('pointerdown', click);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('resize', resize);
      window.removeEventListener('orientationchange', resize);
    };
  }, []);

  return (
    <div className="tle-canvas-wrap" style={{ filter: `brightness(${brightness})` }}>
      <Canvas
        camera={{ fov: 72, near: 0.1, far: 120 }}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        dpr={[1, 1.5]}
        shadows={false}
        frameloop="always"
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color('#05060a'), 1)}
      >
        <Suspense fallback={null}>
          <Manor />
          <PlayerController />
        </Suspense>
      </Canvas>
      <GameLogic />
      <CoopBridge />
    </div>
  );
}

/** Practice mode helper: jump to any chapter quickly */
export async function startPractice(chapter: ChapterId) {
  const s = g();
  s.resetRun();
  s.set({ mode: 'practice', chapter, screen: 'game' });
  const d = await loadCampaign(); // ensure db warm; ignore result
  void d;
  // grant practice kit
  s.setFlag('sealedWingOpen');
  s.setFlag('chapelUnlocked');
  s.setFlag('tunnelsOpen');
  s.setFlag('passagesFound');
  s.setFlag('cellarStairs');
  s.setFlag('escapeKnown');
  s.setFlag('vaultOpen');
  s.setFlag('circleBuilt');
  s.setFlag('charging');
  s.setFlag('knowsTestament');
  const ch = chapterById(chapter);
  for (const o of ch.objectives) if (o.id !== ch.objectives[0].id) s.completeObjective(o.id);
  goToRegion(ch.region);
  window.dispatchEvent(new CustomEvent('tle:chapter', { detail: chapter }));
}
