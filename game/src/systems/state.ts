// ============================================================================
// THE LAST EXORCISM - Global game state (Zustand) + IndexedDB persistence
// ============================================================================
import { create } from 'zustand';
import type { ChapterId, EndingId, RegionId } from '../shared-types';

export type Quality = 'LOW' | 'MEDIUM' | 'HIGH';
export type GameMode = 'single' | 'coop' | 'practice';
export type Screen = 'menu' | 'game' | 'ending';

export interface Settings {
  quality: Quality;
  sensitivity: number;      // 0.2 .. 3
  brightness: number;       // 0.5 .. 1.8
  masterVolume: number;     // 0..1
  sfxVolume: number;        // 0..1
  musicVolume: number;      // 0..1
  textSize: number;         // 0.85 .. 1.6
  cameraShake: boolean;
  reducedFlashing: boolean;
  mobileControls: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  quality: 'MEDIUM',
  sensitivity: 1,
  brightness: 1,
  masterVolume: 0.8,
  sfxVolume: 0.9,
  musicVolume: 0.7,
  textSize: 1,
  cameraShake: true,
  reducedFlashing: false,
  mobileControls: false,
};

export interface InvItem {
  id: string;
  name: string;
  desc: string;
  qty: number;
  usable?: boolean;
}

export interface NoteEntry {
  id: string;
  title: string;
  body: string;
  chapter: ChapterId;
  kind: 'document' | 'memory' | 'clue' | 'testament';
}

export interface ObjectiveDef {
  id: string;
  text: string;
}

export interface GameState {
  screen: Screen;
  mode: GameMode;
  playerName: string;
  roomCode: string | null;
  connected: boolean;
  settings: Settings;

  // ---- campaign progress ----
  chapter: ChapterId;
  objectivesDone: string[];
  flags: Record<string, boolean>;
  inventory: InvItem[];
  selectedSlot: number;
  notes: NoteEntry[];
  memoriesFound: string[];
  region: RegionId;
  spawnToken: number;          // bump to teleport the player (region transitions)
  sealIntegrity: number;
  deaths: number;               // how many players have died this run
  ending: EndingId | null;
  toast: string | null;
  hint: string | null;
  paused: boolean;
  showInventory: boolean;
  showNotebook: boolean;

  // runtime player stats (mirrored for HUD)
  health: number;
  sanity: number;
  flashlightOn: boolean;
  crouching: boolean;
  isSpirit: boolean;

  set: (p: Partial<GameState>) => void;
  addItem: (item: InvItem) => void;
  consumeItem: (id: string) => void;
  addNote: (n: NoteEntry) => void;
  completeObjective: (objId: string) => void;
  setFlag: (f: string, v?: boolean) => void;
  showToast: (msg: string) => void;
  resetRun: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  mode: 'single',
  playerName: 'Hunter',
  roomCode: null,
  connected: false,
  settings: { ...DEFAULT_SETTINGS },

  chapter: 'ch01_invitation',
  objectivesDone: [],
  flags: {},
  inventory: [],
  selectedSlot: 0,
  notes: [],
  memoriesFound: [],
  region: 'exterior',
  spawnToken: 0,
  sealIntegrity: 100,
  deaths: 0,
  ending: null,
  toast: null,
  hint: null,
  paused: false,
  showInventory: false,
  showNotebook: false,

  health: 100,
  sanity: 100,
  flashlightOn: false,
  crouching: false,
  isSpirit: false,

  set: (p) => set(p),
  addItem: (item) => {
    const inv = [...get().inventory];
    const i = inv.findIndex((x) => x.id === item.id);
    if (i >= 0) inv[i] = { ...inv[i], qty: inv[i].qty + item.qty };
    else inv.push(item);
    set({ inventory: inv });
  },
  consumeItem: (id) => {
    const inv = [...get().inventory];
    const i = inv.findIndex((x) => x.id === id);
    if (i < 0) return;
    inv[i] = { ...inv[i], qty: inv[i].qty - 1 };
    if (inv[i].qty <= 0) inv.splice(i, 1);
    set({ inventory: inv });
  },
  addNote: (n) => {
    if (get().notes.some((x) => x.id === n.id)) return;
    set({ notes: [...get().notes, n], toast: `Notebook: ${n.title}` });
  },
  completeObjective: (objId) => {
    if (get().objectivesDone.includes(objId)) return;
    set({ objectivesDone: [...get().objectivesDone, objId] });
  },
  setFlag: (f, v = true) => set({ flags: { ...get().flags, [f]: v } }),
  showToast: (msg) => {
    clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: null }), 3600);
  },
  resetRun: () =>
    set({
      chapter: 'ch01_invitation',
      objectivesDone: [],
      flags: {},
      inventory: [],
      notes: [],
      memoriesFound: [],
      region: 'exterior',
      sealIntegrity: 100,
      deaths: 0,
      ending: null,
      health: 100,
      sanity: 100,
      isSpirit: false,
      flashlightOn: false,
      crouching: false,
      selectedSlot: 0,
      spawnToken: get().spawnToken + 1,
    }),
}));

// ---------------------------------------------------------------------------
// IndexedDB save/load of the local campaign
// ---------------------------------------------------------------------------
const DB_NAME = 'tle-save';
const STORE = 'campaigns';

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => {
      if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE);
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

export interface SaveData {
  chapter: ChapterId;
  objectivesDone: string[];
  flags: Record<string, boolean>;
  inventory: InvItem[];
  notes: NoteEntry[];
  memoriesFound: string[];
  region: RegionId;
  sealIntegrity: number;
  deaths: number;
  savedAt: number;
}

export async function saveCampaign(key = 'solo'): Promise<void> {
  const g = useGame.getState();
  const data: SaveData = {
    chapter: g.chapter,
    objectivesDone: g.objectivesDone,
    flags: g.flags,
    inventory: g.inventory,
    notes: g.notes,
    memoriesFound: g.memoriesFound,
    region: g.region,
    sealIntegrity: g.sealIntegrity,
    deaths: g.deaths,
    savedAt: Date.now(),
  };
  try {
    const db = await openDb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(data, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  } catch (e) {
    console.warn('save failed', e);
  }
}

export async function loadCampaign(key = 'solo'): Promise<SaveData | null> {
  try {
    const db = await openDb();
    const data = await new Promise<SaveData | null>((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const rq = tx.objectStore(STORE).get(key);
      rq.onsuccess = () => res(rq.result ?? null);
      rq.onerror = () => rej(rq.error);
    });
    db.close();
    return data;
  } catch (e) {
    console.warn('load failed', e);
    return null;
  }
}

export async function hasSave(key = 'solo'): Promise<boolean> {
  return (await loadCampaign(key)) != null;
}

export async function clearSave(key = 'solo'): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => res();
    });
    db.close();
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Settings persistence (localStorage - small & synchronous)
// ---------------------------------------------------------------------------
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem('tle-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function persistSettings(s: Settings) {
  try {
    localStorage.setItem('tle-settings', JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
