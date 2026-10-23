// ============================================================================
// THE LAST EXORCISM - Manor renderer. Loads ONLY the current region + visible
// neighbours (progressive / region streaming). Low-poly procedural geometry,
// shared materials, instanced props, fog, minimal dynamic lights.
// Quality presets LOW/MEDIUM/HIGH adjust pixel ratio, fog density & prop count.
// ============================================================================
import { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ROOMS, DOORS, INTERACTABLES } from '../data/world';
import { useGame } from '../systems/state';
import { butcher, king } from '../systems/enemies';
import type { RoomDef } from '../data/world';
import type { RegionId } from '../shared-types';

const g = () => useGame.getState();

// ---------------------------------------------------------------------------
// Shared materials (created once, reused everywhere)
// ---------------------------------------------------------------------------
function makeMats() {
  const std = (color: string, rough = 0.95) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.02 });
  return {
    grass: std('#1a2417'),
    stone: std('#3c3f45'),
    wood: std('#4a3626'),
    carpet: std('#4b1f2a'),
    dirt: std('#2b241c'),
    gold: std('#8f6a1e', 0.4),
    tile: std('#565e63'),
    wall: std('#4d4640'),
    wallIn: std('#39332e'),
    roof: std('#241f1b'),
    doorWood: std('#5b4023'),
    doorLocked: std('#6e5a2a'),
    metal: std('#7d838c', 0.4),
    glass: new THREE.MeshStandardMaterial({ color: '#9fb7c9', transparent: true, opacity: 0.25 }),
    glow: new THREE.MeshBasicMaterial({ color: '#cfd8ff' }),
    candle: new THREE.MeshBasicMaterial({ color: '#ffb45e' }),
    interact: new THREE.MeshBasicMaterial({ color: '#ffd97a', transparent: true, opacity: 0.55 }),
    black: std('#0a0a0c'),
    blood: std('#4a0d0d'),
    ghost: new THREE.MeshBasicMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.35 }),
  };
}
type Mats = ReturnType<typeof makeMats>;
let MATS: Mats | null = null;
function mats(): Mats {
  if (!MATS) MATS = makeMats();
  return MATS;
}

function floorMat(m: Mats, f: RoomDef['floor']) {
  switch (f) {
    case 'grass': return m.grass;
    case 'stone': return m.stone;
    case 'wood': return m.wood;
    case 'carpet': return m.carpet;
    case 'dirt': return m.dirt;
    case 'gold': return m.gold;
    default: return m.tile;
  }
}

// ---------------------------------------------------------------------------
// A single room: floor, walls with doorway gaps, ceiling, a few instanced props
// ---------------------------------------------------------------------------
function RoomMesh({ room }: { room: RoomDef }) {
  const m = mats();
  const q = g().settings.quality;
  const mat = floorMat(m, room.floor);
  const wallH = room.h;
  // Wall pieces around each side, leaving doorway gaps where doors exist
  const sides = useMemo(() => {
    const cx = room.cx, cz = room.cz, w = room.w, d = room.d;
    const segs: { x: number; z: number; sx: number; sz: number }[] = [];
    const pushSide = (axis: 'x' | 'z', at: number, from: number, to: number, thick = 0.5) => {
      const gaps = DOORS.filter((dr) =>
        (axis === 'z' ? dr.axis === 'z' : dr.axis === 'x') &&
        Math.abs((axis === 'z' ? dr.z : dr.x) - at) < 0.6 &&
        (dr.a === room.id || dr.b === room.id),
      ).map((dr) => (axis === 'z' ? dr.x : dr.z));
      let cur = from;
      const sorted = [...gaps].sort((a, b) => a - b);
      for (const gp of sorted) {
        if (gp - 1.4 > cur) {
          const mid = (cur + gp - 1.4) / 2;
          if (axis === 'z') segs.push({ x: mid, z: at, sx: gp - 1.4 - cur, sz: thick });
          else segs.push({ x: at, z: mid, sx: thick, sz: gp - 1.4 - cur });
        }
        cur = gp + 1.4;
      }
      if (to > cur) {
        const mid = (cur + to) / 2;
        if (axis === 'z') segs.push({ x: mid, z: at, sx: to - cur, sz: thick });
        else segs.push({ x: at, z: mid, sx: thick, sz: to - cur });
      }
    };
    pushSide('z', cz - d / 2, cx - w / 2, cx + w / 2);
    pushSide('z', cz + d / 2, cx - w / 2, cx + w / 2);
    pushSide('x', cx - w / 2, cz - d / 2, cz + d / 2);
    pushSide('x', cx + w / 2, cz - d / 2, cz + d / 2);
    return segs;
  }, [room]);

  const props = useMemo(() => {
    // simple instanced pillars / pews / shelves per room type (LOW quality: fewer)
    const n = q === 'LOW' ? 0 : room.w > 16 ? 6 : 3;
    const out: { x: number; y: number; z: number; s: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / (n + 1);
      out.push({ x: room.cx - room.w / 2 + 2 + t * (room.w - 4), z: room.cz + (i % 2 ? room.d / 2 - 2 : -room.d / 2 + 2), y: wallH / 2, s: 1 });
    }
    return out;
  }, [room, q, wallH]);

  return (
    <group>
      {/* floor */}
      {!room.outdoor && (
        <mesh position={[room.cx, 0, room.cz]} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow={false}>
          <planeGeometry args={[room.w, room.d]} />
        </mesh>
      )}
      {/* ceiling */}
      {!room.outdoor && (
        <mesh position={[room.cx, wallH, room.cz]} rotation={[Math.PI / 2, 0, 0]} material={m.roof}>
          <planeGeometry args={[room.w, room.d]} />
        </mesh>
      )}
      {/* wall segments */}
      {sides.map((sg, i) => (
        <mesh key={i} position={[sg.x, wallH / 2, sg.z]} material={room.outdoor ? m.stone : m.wallIn}>
          <boxGeometry args={[Math.max(sg.sx, 0.1), wallH, Math.max(sg.sz, 0.1)]} />
        </mesh>
      ))}
      {/* pillars */}
      {props.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]} material={m.stone}>
          <boxGeometry args={[0.7, wallH, 0.7]} />
        </mesh>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Exterior extras: gate, fountain, trees (instanced), manor facade
// ---------------------------------------------------------------------------
function ExteriorProps() {
  const m = mats();
  const trees = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 14; i++) {
      arr.push([-32 + (i % 7) * 10 + (i * 7) % 3, -78 + Math.floor(i / 7) * 18]);
    }
    return arr;
  }, []);
  return (
    <group>
      {/* lawn */}
      <mesh position={[0, 0, -60]} rotation={[-Math.PI / 2, 0, 0]} material={m.grass}>
        <planeGeometry args={[70, 50]} />
      </mesh>
      {/* stone path */}
      <mesh position={[0, 0.02, -44]} rotation={[-Math.PI / 2, 0, 0]} material={m.stone}>
        <planeGeometry args={[4, 26]} />
      </mesh>
      {/* main gate posts */}
      <mesh position={[-2.2, 2, -46]} material={m.stone}><boxGeometry args={[0.8, 4, 0.8]} /></mesh>
      <mesh position={[2.2, 2, -46]} material={m.stone}><boxGeometry args={[0.8, 4, 0.8]} /></mesh>
      <mesh position={[0, 4.2, -46]} material={m.metal}><boxGeometry args={[5.2, 0.4, 0.4]} /></mesh>
      {/* fountain */}
      <mesh position={[-14, 0.4, -52]} material={m.stone}><cylinderGeometry args={[2.4, 2.6, 0.8, 12]} /></mesh>
      <mesh position={[-14, 0.85, -52]} material={m.black}><cylinderGeometry args={[2.1, 2.1, 0.15, 12]} /></mesh>
      <mesh position={[-14, 1.8, -52]} material={m.stone}><cylinderGeometry args={[0.3, 0.4, 2, 8]} /></mesh>
      {/* manor facade behind entrance doors */}
      <mesh position={[0, 5, -33.6]} material={m.wall}><boxGeometry args={[20, 10, 1.2]} /></mesh>
      {/* dead trees */}
      {trees.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 2, 0]} material={m.black}><cylinderGeometry args={[0.18, 0.3, 4, 5]} /></mesh>
          <mesh position={[0.6, 3.4, 0]} rotation={[0, 0, -0.7]} material={m.black}><cylinderGeometry args={[0.06, 0.12, 2, 4]} /></mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Doorway markers + interactable glows (billboard diamonds near objects)
// ---------------------------------------------------------------------------
function Markers() {
  const region = useGame((s) => s.region);
  const flags = useGame((s) => s.flags);
  const m = mats();
  const items = INTERACTABLES.filter((it) => it.region === region);
  const doors = DOORS.filter((d) => (d.a === region || d.b === region) && !(d.hidden && !flags[d.hidden]));
  const pulseRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const k = 0.5 + Math.sin(clock.elapsedTime * 2.4) * 0.22;
      pulseRef.current.children.forEach((c) => {
        const mesh = c as THREE.Mesh;
        const mm = mesh.material as THREE.MeshBasicMaterial;
        if (mm.opacity !== undefined) mm.opacity = Math.min(mm.userData.maxOp ?? 0.5, k);
      });
    }
  });
  return (
    <group ref={pulseRef}>
      {items.map((it) => (
        <mesh key={it.id} position={[it.x, 1.15, it.z]} material={m.interact} userData={{ maxOp: 0.55 }}>
          <octahedronGeometry args={[0.16]} />
        </mesh>
      ))}
      {doors.map((d) => (
        <mesh key={d.id} position={[d.x, 1.4, d.z]} material={d.locked && !isDoorOpen(d.id) ? m.doorLocked : m.glass} userData={{ maxOp: 0.3 }}>
          <boxGeometry args={d.axis === 'z' ? [2.6, 2.8, 0.18] : [0.18, 2.8, 2.6]} />
        </mesh>
      ))}
    </group>
  );
}

function isDoorOpen(id: string) {
  const s = g();
  const dr = DOORS.find((x) => x.id === id)!;
  if (dr.needsFlag && !s.flags[dr.needsFlag]) return false;
  return true;
}

// ---------------------------------------------------------------------------
// The Butcher avatar (visible when in your region)
// ---------------------------------------------------------------------------
function ButcherMesh() {
  const region = useGame((s) => s.region);
  const st = butcher.state;
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) {
      ref.current.position.copy(butcher.pos);
      ref.current.position.y = 1.6 + Math.sin(performance.now() / 300) * 0.06;
      ref.current.visible = st !== 'asleep' && st !== 'freed' && butcher.region === region;
    }
  });
  const m = mats();
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 0.4, 0]} material={m.black}><capsuleGeometry args={[0.7, 1.8, 4, 8]} /></mesh>
      <mesh position={[0, 1.5, 0]} material={m.blood}><sphereGeometry args={[0.42, 10, 8]} /></mesh>
      {/* apron */}
      <mesh position={[0, 0.2, 0.55]} material={m.blood}><boxGeometry args={[1, 1.4, 0.12]} /></mesh>
      {/* knife */}
      <mesh position={[0.9, 0.1, 0.6]} rotation={[0.4, 0, 0.2]} material={m.metal}><boxGeometry args={[0.12, 1.6, 0.4]} /></mesh>
      {st === 'chase' && <pointLight color="#ff3b3b" intensity={4} distance={7} position={[0, 2, 0]} />}
    </group>
  );
}

/** Evelyn apparition: appears briefly in candle-lit rooms once she is your guide */
function EvelynApparition() {
  const flags = useGame((s) => s.flags);
  const region = useGame((s) => s.region);
  const ref = useRef<THREE.Group>(null);
  const m = mats();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const blink = Math.sin(clock.elapsedTime * 0.5);
    ref.current.visible = !!flags.evelynGuide && blink > 0.92 && ['sealed_wing', 'evelyns_room', 'gateway_chamber'].includes(region);
    ref.current.position.set(region === 'gateway_chamber' ? 3 : 0, 1.4, region === 'gateway_chamber' ? -166 : 66);
  });
  return (
    <group ref={ref} visible={false}>
      <mesh material={m.ghost}><capsuleGeometry args={[0.4, 1.4, 4, 8]} /></mesh>
      <pointLight color="#bfe8ff" intensity={3} distance={6} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Region streaming wrapper: render current region + connected neighbours
// whose spatial bounds are within draw budget
// ---------------------------------------------------------------------------
export function Manor() {
  const region = useGame((s) => s.region);
  const quality = useGame((s) => s.settings.quality);
  const { scene, gl } = useThree();
  const m = mats();

  // tune renderer & fog per quality
  useEffect(() => {
    const pr = quality === 'HIGH' ? Math.min(window.devicePixelRatio, 2) : quality === 'MEDIUM' ? Math.min(window.devicePixelRatio, 1.5) : 1;
    gl.setPixelRatio(pr);
    const room = ROOMS.find((r) => r.id === region)!;
    scene.fog = new THREE.FogExp2('#05060a', room.outdoor ? 0.012 : quality === 'LOW' ? 0.06 : 0.045);
    scene.background = new THREE.Color('#05060a');
  }, [quality, region, scene, gl]);

  const visible = useMemo(() => {
    const cur = ROOMS.find((r) => r.id === region)!;
    const nb = new Set<RegionId>();
    for (const d of DOORS) {
      if (d.a === region) nb.add(d.b);
      if (d.b === region) nb.add(d.a);
    }
    const ids = new Set<RegionId>([region, ...nb]);
    return ROOMS.filter((r) => ids.has(r.id)).filter((r) => {
      // only rooms reasonably close in world space OR the current one
      const dist = Math.hypot(r.cx - cur.cx, r.cz - cur.cz);
      return r.id === region || dist < 60;
    });
  }, [region]);

  const room = ROOMS.find((r) => r.id === region)!;
  const ambientLevel = room.outdoor ? 0.5 : Math.max(0.05, 0.3 - (room.dark ?? 0.5) * 0.28 - king.darkness * 0.15);

  return (
    <group>
      <ambientLight intensity={ambientLevel} color="#8b93b8" />
      {/* one dim hemisphere-ish fill light, no shadows for perf */}
      <hemisphereLight intensity={quality === 'LOW' ? 0.12 : 0.22} color="#3a4258" groundColor="#0a0a0c" />
      {visible.map((r) =>
        r.id === 'exterior' ? (
          <group key={r.id}>
            <ExteriorProps />
            <RoomMesh room={{ ...r, outdoor: true }} />
          </group>
        ) : (
          <RoomMesh key={r.id} room={r} />
        ),
      )}
      {/* sparse candle lights only on MEDIUM+ to limit dynamic lights */}
      {quality !== 'LOW' && <Candles region={region} />}
      <Markers />
      <ButcherMesh />
      <EvelynApparition />
      <GatewayChamberFx />
    </group>
  );
}

function Candles({ region }: { region: RegionId }) {
  const spots = useMemo(() => {
    const room = ROOMS.find((r) => r.id === region)!;
    const n = region === 'chapel' ? 4 : region === 'gateway_chamber' ? 5 : 2;
    const arr: [number, number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      arr.push([room.cx + Math.cos(a) * (room.w / 2 - 2), room.h - 1.2, room.cz + Math.sin(a) * (room.d / 2 - 2)]);
    }
    return arr;
  }, [region]);
  return (
    <>
      {spots.map((p, i) => (
        <group key={i} position={p}>
          <mesh material={mats().candle}><boxGeometry args={[0.1, 0.3, 0.1]} /></mesh>
          <pointLight color="#ff9a3c" intensity={2.4} distance={7} decay={2} />
        </group>
      ))}
    </>
  );
}

/** The gate itself: a tear in space at the end of the campaign */
function GatewayChamberFx() {
  const region = useGame((s) => s.region);
  const seal = useGame((s) => s.sealIntegrity);
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () => new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uT: { value: 0 }, uOpen: { value: 0.2 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `
        varying vec2 vUv; uniform float uT; uniform float uOpen;
        void main(){
          vec2 c = vUv-0.5;
          float r = length(c);
          float swirl = sin(atan(c.y,c.x)*6.0 + uT*2.0 + r*20.0)*0.5+0.5;
          float core = smoothstep(0.5, 0.05, r);
          vec3 col = mix(vec3(0.02,0.0,0.05), vec3(0.55,0.05,0.1), swirl*core);
          float a = core*(0.35+0.6*uOpen)*(0.6+0.4*swirl);
          gl_FragColor = vec4(col, a);
        }`,
    }),
    [],
  );
  useFrame(({ clock }) => {
    mat.uniforms.uT.value = clock.elapsedTime;
    mat.uniforms.uOpen.value = 1 - seal / 100;
    if (ref.current) ref.current.rotation.z = clock.elapsedTime * 0.1;
  });
  if (region !== 'gateway_chamber') return null;
  return (
    <group>
      <mesh ref={ref} position={[0, 5, -184]} material={mat}>
        <circleGeometry args={[7, 32]} />
      </mesh>
      <pointLight position={[0, 5, -182]} color="#ff2a4a" intensity={6 + (100 - seal) * 0.2} distance={30} />
      {/* ritual mechanisms: cover pillars */}
      {[[-8, -166], [8, -166], [-12, -174], [12, -174]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2.5, z]} material={mats().stone}>
          <boxGeometry args={[1.6, 5, 1.6]} />
        </mesh>
      ))}
      {/* spirit interaction circle */}
      <mesh position={[0, 0.03, -170]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.6, 32]} />
        <meshBasicMaterial color="#7ad7ff" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
