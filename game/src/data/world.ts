// ============================================================================
// THE LAST EXORCISM - Blackthorn Manor layout: regions, doors, interactables.
// One interconnected environment divided into performance-friendly regions;
// only the current region (and neighbours) are rendered/simulated.
// ============================================================================
import type { RegionId } from '../shared-types';

export interface RoomDef {
  id: RegionId;
  name: string;
  /** centre of the playable floor area */
  cx: number;
  cz: number;
  w: number; // width  (x)
  d: number; // depth  (z)
  h: number; // height
  floor: 'grass' | 'stone' | 'wood' | 'carpet' | 'dirt' | 'gold' | 'water';
  outdoor?: boolean;
  dark?: number; // ambient darkness multiplier 0..1 (higher = darker)
}

export interface DoorDef {
  id: string;
  a: RegionId;
  b: RegionId;
  /** position on the wall between the two rooms */
  x: number;
  z: number;
  axis: 'x' | 'z';
  locked?: boolean;      // requires key/puzzle
  needsFlag?: string;    // story gate
  hidden?: string;       // revealed by this flag (secret passages)
}

export interface InteractableDef {
  id: string;
  region: RegionId;
  x: number;
  y: number;
  z: number;
  label: string;
  kind:
    | 'note' | 'memory' | 'item' | 'puzzle' | 'radio' | 'seal' | 'mirror'
    | 'portrait' | 'door' | 'circle' | 'locker' | 'testament' | 'switch' | 'body';
  once?: boolean;
  chapter?: number;      // only active during this chapter
  data?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Rooms. Coordinates lay out one connected manor footprint + underground ring.
// Ground floor spans roughly x[-30..30], z[-24..24]. Upstairs reuses footprints
// at y=4. Underground uses separate coordinate bands (entered via transitions).
// ---------------------------------------------------------------------------
export const ROOMS: RoomDef[] = [
  // ---- Exterior ----
  { id: 'exterior', name: 'The Approach', cx: 0, cz: -60, w: 70, d: 50, h: 14, floor: 'grass', outdoor: true, dark: 0.35 },
  // ---- Ground floor (entrance hall is the hub) ----
  { id: 'entrance_hall', name: 'Entrance Hall', cx: 0, cz: 0, w: 16, d: 20, h: 8, floor: 'stone', dark: 0.55 },
  { id: 'grand_staircase', name: 'Grand Staircase', cx: 0, cz: 20, w: 16, d: 16, h: 10, floor: 'carpet', dark: 0.5 },
  { id: 'kitchen', name: 'Kitchen', cx: -22, cz: 0, w: 14, d: 12, h: 6, floor: 'stone', dark: 0.45 },
  { id: 'dining_room', name: 'Dining Room', cx: -22, cz: 16, w: 14, d: 14, h: 7, floor: 'wood', dark: 0.5 },
  { id: 'bedrooms', name: 'Bedrooms', cx: 22, cz: 0, w: 16, d: 14, h: 6, floor: 'wood', dark: 0.6 },
  { id: 'medical_room', name: 'Medical Room', cx: 22, cz: 16, w: 12, d: 10, h: 6, floor: 'tile' as never, dark: 0.5 },
  { id: 'storage_room', name: 'Storage Room', cx: 22, cz: 28, w: 12, d: 10, h: 6, floor: 'wood', dark: 0.7 },
  { id: 'library', name: 'Library', cx: -22, cz: 34, w: 18, d: 16, h: 9, floor: 'wood', dark: 0.6 },
  { id: 'ballroom', name: 'Ballroom', cx: 0, cz: 44, w: 24, d: 20, h: 12, floor: 'wood', dark: 0.5 },
  // ---- Sealed wing (upper floors, modelled as adjacent regions for perf) ----
  { id: 'sealed_wing', name: 'Sealed Wing Corridor', cx: 0, cz: 64, w: 10, d: 24, h: 6, floor: 'carpet', dark: 0.75 },
  { id: 'nursery', name: 'Nursery', cx: -12, cz: 64, w: 10, d: 10, h: 6, floor: 'wood', dark: 0.65 },
  { id: 'evelyns_room', name: "Evelyn's Room", cx: 12, cz: 64, w: 10, d: 10, h: 6, floor: 'carpet', dark: 0.6 },
  { id: 'investigation_room', name: 'Old Investigation Room', cx: -12, cz: 78, w: 10, d: 10, h: 6, floor: 'wood', dark: 0.55 },
  { id: 'portrait_gallery', name: 'Portrait Gallery', cx: 12, cz: 78, w: 14, d: 10, h: 7, floor: 'carpet', dark: 0.65 },
  { id: 'archive', name: 'Archive', cx: 0, cz: 88, w: 12, d: 10, h: 6, floor: 'stone', dark: 0.7 },
  { id: 'secret_passages', name: 'Secret Passages', cx: 0, cz: 102, w: 8, d: 18, h: 4, floor: 'dirt', dark: 0.9 },
  // ---- Chapel & weapons wing ----
  { id: 'chapel', name: 'Chapel', cx: -38, cz: 56, w: 18, d: 24, h: 12, floor: 'stone', dark: 0.5 },
  { id: 'ritual_storage', name: 'Ritual Storage', cx: -38, cz: 80, w: 12, d: 10, h: 6, floor: 'stone', dark: 0.7 },
  { id: 'weapons_locker', name: 'Weapons Locker', cx: -56, cz: 56, w: 8, d: 8, h: 5, floor: 'stone', dark: 0.8 },
  { id: 'occult_library', name: 'Occult Library', cx: -56, cz: 72, w: 12, d: 10, h: 7, floor: 'wood', dark: 0.65 },
  // ---- Underground ----
  { id: 'servants_tunnels', name: "Servants' Tunnels", cx: 0, cz: -96, w: 10, d: 26, h: 4, floor: 'dirt', dark: 0.95 },
  { id: 'catacombs', name: 'Catacombs', cx: 0, cz: -120, w: 20, d: 16, h: 5, floor: 'stone', dark: 0.95 },
  { id: 'prison_cells', name: 'Prison Cells', cx: -20, cz: -120, w: 12, d: 12, h: 4, floor: 'stone', dark: 0.95 },
  { id: 'laboratory', name: 'Abandoned Laboratory', cx: 22, cz: -120, w: 14, d: 12, h: 5, floor: 'tile' as never, dark: 0.85 },
  { id: 'sacrificial_chamber', name: 'Sacrificial Chamber', cx: 0, cz: -142, w: 16, d: 16, h: 7, floor: 'stone', dark: 0.9 },
  { id: 'treasure_vault', name: 'Treasure Vault', cx: -24, cz: -142, w: 10, d: 10, h: 6, floor: 'gold', dark: 0.6 },
  { id: 'gateway_mechanisms', name: 'Gateway Mechanisms', cx: 24, cz: -142, w: 12, d: 10, h: 6, floor: 'stone', dark: 0.8 },
  { id: 'escape_tunnel', name: 'Alternate Escape Tunnel', cx: -40, cz: -142, w: 8, d: 14, h: 4, floor: 'dirt', dark: 0.9 },
  { id: 'gateway_chamber', name: 'Gateway Chamber', cx: 0, cz: -170, w: 34, d: 30, h: 16, floor: 'stone', dark: 0.7 },
];

// medical/lab use 'tile' - normalise in renderer
export function roomById(id: RegionId): RoomDef {
  return ROOMS.find((r) => r.id === id)!;
}

// ---------------------------------------------------------------------------
// Doors / connections. Position is where the doorway sits on the shared wall.
// ---------------------------------------------------------------------------
export const DOORS: DoorDef[] = [
  // exterior -> hall (main doors) ; side entrance unlocked later
  { id: 'd_main', a: 'exterior', b: 'entrance_hall', x: 0, z: -35, axis: 'z' },
  { id: 'd_side', a: 'exterior', b: 'kitchen', x: -29, z: -46, axis: 'z', needsFlag: 'sideEntrance' },
  // hall hub
  { id: 'd_hall_stairs', a: 'entrance_hall', b: 'grand_staircase', x: 0, z: 10, axis: 'z' },
  { id: 'd_hall_kitchen', a: 'entrance_hall', b: 'kitchen', x: -8, z: 0, axis: 'x' },
  { id: 'd_hall_bedrooms', a: 'entrance_hall', b: 'bedrooms', x: 8, z: 0, axis: 'x' },
  { id: 'd_kitchen_dining', a: 'kitchen', b: 'dining_room', x: -22, z: 6, axis: 'z' },
  { id: 'd_dining_library', a: 'dining_room', b: 'library', x: -22, z: 26, axis: 'z', locked: true },
  { id: 'd_stairs_ballroom', a: 'grand_staircase', b: 'ballroom', x: 0, z: 30, axis: 'z' },
  { id: 'd_bedrooms_medical', a: 'bedrooms', b: 'medical_room', x: 22, z: 7, axis: 'z' },
  { id: 'd_medical_storage', a: 'medical_room', b: 'storage_room', x: 22, z: 22, axis: 'z' },
  { id: 'd_library_ballroom', a: 'library', b: 'ballroom', x: -12, z: 37, axis: 'x' },
  // sealed wing
  { id: 'd_ball_sealed', a: 'ballroom', b: 'sealed_wing', x: 0, z: 54, axis: 'z', needsFlag: 'sealedWingOpen' },
  { id: 'd_sealed_nursery', a: 'sealed_wing', b: 'nursery', x: -5, z: 64, axis: 'x' },
  { id: 'd_sealed_evelyn', a: 'sealed_wing', b: 'evelyns_room', x: 5, z: 64, axis: 'x' },
  { id: 'd_nursery_invest', a: 'nursery', b: 'investigation_room', x: -12, z: 71, axis: 'z' },
  { id: 'd_evelyn_gallery', a: 'evelyns_room', b: 'portrait_gallery', x: 12, z: 71, axis: 'z' },
  { id: 'd_gallery_archive', a: 'portrait_gallery', b: 'archive', x: 6, z: 84, axis: 'x' },
  { id: 'd_invest_archive', a: 'investigation_room', b: 'archive', x: -6, z: 84, axis: 'x' },
  { id: 'd_archive_passages', a: 'archive', b: 'secret_passages', x: 0, z: 94, axis: 'z', hidden: 'passagesFound' },
  // chapel wing (reached via ballroom-side corridor through grand staircase landing)
  { id: 'd_stairs_chapel', a: 'grand_staircase', b: 'chapel', x: -8, z: 20, axis: 'x', needsFlag: 'chapelUnlocked' },
  { id: 'd_chapel_ritual', a: 'chapel', b: 'ritual_storage', x: -38, z: 68, axis: 'z' },
  { id: 'd_chapel_locker', a: 'chapel', b: 'weapons_locker', x: -47, z: 56, axis: 'x', locked: true },
  { id: 'd_locker_occult', a: 'weapons_locker', b: 'occult_library', x: -56, z: 60, axis: 'z' },
  { id: 'd_ritual_occult', a: 'ritual_storage', b: 'occult_library', x: -48, z: 78, axis: 'x' },
  // underground (from sacrificial area chain reached via secret passage -> tunnels)
  { id: 'd_passages_tunnels', a: 'secret_passages', b: 'servants_tunnels', x: 0, z: -83, axis: 'z', needsFlag: 'tunnelsOpen' },
  { id: 'd_hall_tunnels', a: 'entrance_hall', b: 'servants_tunnels', x: 0, z: -10, axis: 'z', hidden: 'cellarStairs' },
  { id: 'd_tunnels_catacombs', a: 'servants_tunnels', b: 'catacombs', x: 0, z: -110, axis: 'z' },
  { id: 'd_cata_prison', a: 'catacombs', b: 'prison_cells', x: -10, z: -120, axis: 'x' },
  { id: 'd_cata_lab', a: 'catacombs', b: 'laboratory', x: 12, z: -120, axis: 'x' },
  { id: 'd_cata_sacri', a: 'catacombs', b: 'sacrificial_chamber', x: 0, z: -130, axis: 'z' },
  { id: 'd_sacri_vault', a: 'sacrificial_chamber', b: 'treasure_vault', x: -8, z: -142, axis: 'x', locked: true },
  { id: 'd_sacri_mech', a: 'sacrificial_chamber', b: 'gateway_mechanisms', x: 8, z: -142, axis: 'x' },
  { id: 'd_mech_gate', a: 'gateway_mechanisms', b: 'gateway_chamber', x: 12, z: -155, axis: 'z', needsFlag: 'gateApproached' },
  { id: 'd_vault_escape', a: 'treasure_vault', b: 'escape_tunnel', x: -30, z: -142, axis: 'x', hidden: 'escapeKnown' },
  { id: 'd_gate_escape', a: 'gateway_chamber', b: 'escape_tunnel', x: -20, z: -162, axis: 'x', needsFlag: 'escaping' },
];

// ---------------------------------------------------------------------------
// Interactables placed throughout the manor. Handlers live in systems/interact.ts
// ---------------------------------------------------------------------------
export const INTERACTABLES: InteractableDef[] = [
  // -- Chapter 1: exterior --
  { id: 'i_gate', region: 'exterior', x: 0, y: 0, z: -46, label: 'Main Gate', kind: 'door' },
  { id: 'i_fountain', region: 'exterior', x: -14, y: 0, z: -52, label: 'Abandoned Fountain', kind: 'note', data: { noteId: 'fountain_clue' } },
  { id: 'i_photo', region: 'exterior', x: 6, y: 0, z: -40, label: 'Wedged Photograph', kind: 'note', data: { noteId: 'photo1' } },
  { id: 'i_side_door', region: 'exterior', x: -29, y: 0, z: -46, label: 'Side Entrance', kind: 'door' },
  // -- Chapter 2: ground floor --
  { id: 'i_hall_table', region: 'entrance_hall', x: 0, y: 0, z: -2, label: 'Console Table', kind: 'note', data: { noteId: 'welcome_letter' } },
  { id: 'i_hall_ledger', region: 'entrance_hall', x: -4, y: 0, z: 4, label: 'Visitor Ledger', kind: 'note', data: { noteId: 'ledger1' } },
  { id: 'i_knife_rack', region: 'kitchen', x: -24, y: 0, z: -2, label: 'Knife Rack', kind: 'item', data: { item: 'knife' } },
  { id: 'i_cooker', region: 'kitchen', x: -19, y: 0, z: 3, label: 'Cold Cooker', kind: 'note', data: { noteId: 'tea_note' } },
  { id: 'i_bedroom_trunk', region: 'bedrooms', x: 24, y: 0, z: -2, label: 'Travel Trunk', kind: 'item', data: { item: 'matches' } },
  { id: 'i_bedroom_diary', region: 'bedrooms', x: 20, y: 0, z: 4, label: 'Maid’s Diary', kind: 'note', data: { noteId: 'diary1' } },
  { id: 'i_library_puzzle', region: 'library', x: -22, y: 0, z: 34, label: 'Ledger Pattern Shelf', kind: 'puzzle', data: { puzzle: 'library' } },
  { id: 'i_cellar', region: 'entrance_hall', x: 4, y: 0, z: 6, label: 'Cellar Door (barricaded)', kind: 'door' },
  // -- Chapter 3: butcher hunt --
  { id: 'i_stair_noise', region: 'grand_staircase', x: 0, y: 0, z: 20, label: 'Scratched Newel Post', kind: 'note', data: { noteId: 'scratch' } },
  { id: 'i_med_cabinet', region: 'medical_room', x: 22, y: 0, z: 16, label: 'Medicine Cabinet', kind: 'item', data: { item: 'holy_water' } },
  { id: 'i_med_body', region: 'medical_room', x: 20, y: 0, z: 18, label: 'Slab with Restraints', kind: 'body' },
  { id: 'i_storage_locker', region: 'storage_room', x: 22, y: 0, z: 28, label: 'Supply Locker', kind: 'item', data: { item: 'bandage' } },
  { id: 'i_hide_armoire', region: 'bedrooms', x: 26, y: 0, z: 2, label: 'Armoire (hide inside)', kind: 'switch', data: { action: 'hide' } },
  // -- Chapter 4: radio --
  { id: 'i_radio', region: 'investigation_room', x: -12, y: 0, z: 78, label: 'Shortwave Radio & Tape Deck', kind: 'radio' },
  { id: 'i_evp', region: 'investigation_room', x: -14, y: 0, z: 76, label: 'Reel-to-reel tapes', kind: 'note', data: { noteId: 'evp1962' } },
  // -- Chapter 5: memories / Evelyn --
  { id: 'i_mem1', region: 'nursery', x: -12, y: 0, z: 64, label: 'Music Box on Rocking Horse', kind: 'memory', data: { mem: 'm1' } },
  { id: 'i_mem2', region: 'evelyns_room', x: 12, y: 0, z: 64, label: 'Evelyn’s Writing Desk', kind: 'memory', data: { mem: 'm2' } },
  { id: 'i_evelyn_altar', region: 'evelyns_room', x: 14, y: 0, z: 66, label: 'Candle Shrine', kind: 'switch', data: { action: 'evelynMeet' } },
  { id: 'i_archive_records', region: 'archive', x: 0, y: 0, z: 88, label: 'Blackthorn Estate Records', kind: 'note', data: { noteId: 'estate' } },
  // -- Chapter 6: bride's game --
  { id: 'i_cross', region: 'ballroom', x: -6, y: 0, z: 44, label: 'Silver Cross on Chandelier Chain', kind: 'item', data: { item: 'cross' } },
  { id: 'i_false_door', region: 'sealed_wing', x: 0, y: 0, z: 60, label: 'Weeping Behind This Door', kind: 'door' },
  { id: 'i_mirror', region: 'ballroom', x: 6, y: 0, z: 48, label: 'Tall Wedding Mirror', kind: 'mirror' },
  // -- Chapter 7: caretaker evidence --
  { id: 'i_matches', region: 'storage_room', x: 24, y: 0, z: 30, label: 'Fresh Kitchen Matches', kind: 'note', data: { noteId: 'matches' } },
  { id: 'i_caretaker_ledger', region: 'portrait_gallery', x: 12, y: 0, z: 78, label: 'Caretaker’s Ledger vs Portraits', kind: 'note', data: { noteId: 'caretaker_ledger' } },
  { id: 'i_wall_safe', region: 'secret_passages', x: 0, y: 0, z: 102, label: 'Hidden Panel: Caretaker’s Cache', kind: 'item', data: { item: 'invitation_list' } },
  // -- Chapter 8: chapel & king --
  { id: 'i_seal1', region: 'chapel', x: -38, y: 0, z: 50, label: 'Seal Mechanism I (Altar Stone)', kind: 'seal', data: { seal: '1' } },
  { id: 'i_seal2', region: 'chapel', x: -44, y: 0, z: 60, label: 'Seal Mechanism II (Font)', kind: 'seal', data: { seal: '2' } },
  { id: 'i_seal3', region: 'ritual_storage', x: -38, y: 0, z: 80, label: 'Seal Mechanism III (Reliquary)', kind: 'seal', data: { seal: '3' } },
  { id: 'i_king_circle', region: 'chapel', x: -34, y: 0, z: 66, label: 'Royal Markings (the King sleeps here)', kind: 'switch', data: { action: 'kingConfront' } },
  { id: 'i_necklace', region: 'chapel', x: -38, y: 0, z: 66, label: 'Drowned Necklace on the Steps', kind: 'item', data: { item: 'necklace_key' } },
  // -- Chapter 9: locker/vault/testament --
  { id: 'i_locker', region: 'weapons_locker', x: -56, y: 0, z: 56, label: 'Weapons Locker', kind: 'locker' },
  { id: 'i_rock_salt', region: 'occult_library', x: -56, y: 0, z: 72, label: 'Shelf of Salt & Iron', kind: 'item', data: { item: 'salt' } },
  { id: 'i_revolver', region: 'weapons_locker', x: -56, y: 0, z: 55, label: 'Old Revolver & Silver Rounds', kind: 'item', data: { item: 'revolver' } },
  { id: 'i_testament', region: 'treasure_vault', x: -24, y: 0, z: -142, label: 'THE TESTAMENT OF THE SEVEN GATES', kind: 'testament' },
  { id: 'i_gold', region: 'treasure_vault', x: -22, y: 0, z: -140, label: 'Coffer of Gold (optional)', kind: 'item', data: { item: 'gold' } },
  // -- Chapter 10: ritual components --
  { id: 'i_lab_components', region: 'laboratory', x: 22, y: 0, z: -120, label: 'Ritual Components Crate', kind: 'item', data: { item: 'rite_kit' } },
  { id: 'i_lab_notes', region: 'laboratory', x: 25, y: 0, z: -118, label: 'Measurement Log: “Hell Has Pressure”', kind: 'note', data: { noteId: 'labnotes' } },
  { id: 'i_prison_graffiti', region: 'prison_cells', x: -20, y: 0, z: -120, label: 'Counted Days Scratched on the Wall', kind: 'note', data: { noteId: 'graffiti' } },
  { id: 'i_circle_build', region: 'sacrificial_chamber', x: 0, y: 0, z: -142, label: 'Broken Ritual Circle', kind: 'switch', data: { action: 'buildCircle' } },
  // -- Chapter 11: caretaker confrontation --
  { id: 'i_caretaker', region: 'gateway_mechanisms', x: 24, y: 0, z: -142, label: 'The Caretaker at the Winch', kind: 'switch', data: { action: 'caretakerTalk' } },
  { id: 'i_recorder', region: 'gateway_mechanisms', x: 27, y: 0, z: -140, label: 'His Portable Recorder', kind: 'note', data: { noteId: 'caretaker_tape' } },
  // -- Chapters 12-13: finale --
  { id: 'i_charge', region: 'gateway_mechanisms', x: 21, y: 0, z: -144, label: 'Seal Capacitor Bank', kind: 'switch', data: { action: 'charge' } },
  { id: 'i_final_circle', region: 'gateway_chamber', x: 0, y: 0, z: -170, label: 'Spirit-Interaction Circle', kind: 'circle' },
  { id: 'i_satan_door', region: 'gateway_chamber', x: 0, y: 0, z: -180, label: 'THE GATE', kind: 'switch', data: { action: 'satanFace' } },
  // -- Chapter 14/15 --
  { id: 'i_escape_exit', region: 'escape_tunnel', x: -40, y: 0, z: -148, label: 'Moonlight at the Tunnel Mouth', kind: 'door' },
  { id: 'i_epilogue', region: 'exterior', x: 0, y: 0, z: -66, label: 'A Second Letter, In Your Own Handwriting', kind: 'note', data: { noteId: 'epilogue' } },
];

/** Which rooms connect to a given room (for neighbour loading). */
export function neighborsOf(id: RegionId): RegionId[] {
  const out = new Set<RegionId>();
  for (const d of DOORS) {
    if (d.a === id) out.add(d.b);
    if (d.b === id) out.add(d.a);
  }
  return [...out];
}
