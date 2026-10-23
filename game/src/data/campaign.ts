// ============================================================================
// THE LAST EXORCISM - Campaign data: 15 chapters, objectives, triggers, story
// ============================================================================
import type { ChapterId, EndingId, RegionId } from '../shared-types';
import { useGame } from '../systems/state';
import type { NoteEntry } from '../systems/state';

export interface Objective {
  id: string;
  text: string;
}

export interface ChapterDef {
  id: ChapterId;
  num: number;
  title: string;
  brief: string;          // shown when the chapter begins
  region: RegionId;       // where the chapter plays out (start)
  objectives: Objective[];
  onEnter?: () => void;
  next: ChapterId | null;
}

const g = () => useGame.getState();

/** Mark an objective done + auto-advance when all objectives of a chapter are complete. */
export function obj(id: string, toast?: string) {
  const s = g();
  if (s.objectivesDone.includes(id)) return;
  s.completeObjective(id);
  if (toast) s.showToast(toast);
  const ch = CHAPTERS.find((c) => c.id === s.chapter)!;
  if (ch.objectives.every((o) => g().objectivesDone.includes(o.id))) {
    advanceChapter();
  }
}

export function advanceChapter() {
  const s = g();
  const ch = CHAPTERS.find((c) => c.id === s.chapter)!;
  if (!ch.next) return;
  const nch = CHAPTERS.find((c) => c.id === ch.next)!;
  s.set({ chapter: nch.id, objectivesDone: [], spawnToken: s.spawnToken + 1 });
  s.showToast(`CHAPTER ${nch.num} — ${nch.title.toUpperCase()}`);
  window.dispatchEvent(new CustomEvent('tle:chapter', { detail: nch.id }));
  nch.onEnter?.();
}

export function addNote(n: NoteEntry) {
  g().addNote(n);
}

// ---------------------------------------------------------------------------
// Story helpers
// ---------------------------------------------------------------------------
export function revealMemory(memId: string, title: string, body: string) {
  const s = g();
  if (s.memoriesFound.includes(memId)) return;
  s.set({ memoriesFound: [...s.memoriesFound, memId] });
  s.addNote({ id: `mem_${memId}`, title, body, chapter: s.chapter, kind: 'memory' });
  s.showToast('A memory surfaces... Evelyn whispers the truth.');
  window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: 'memory_revealed' } }));
}

export function weakenSeal(amount: number) {
  const s = g();
  s.set({ sealIntegrity: Math.max(0, s.sealIntegrity - amount) });
  window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: 'seal_weakened' } }));
}

// ---------------------------------------------------------------------------
// The fifteen chapters
// ---------------------------------------------------------------------------
export const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch01_invitation',
    num: 1,
    title: 'The Invitation',
    brief:
      'A letter arrived three weeks ago, unsigned, postmarked from a town that burned down in 1974. ' +
      'It promised work any honest ghost hunter cannot refuse. Blackthorn Manor stands at the end of this road. ' +
      'The gate is already shut behind you.',
    region: 'exterior',
    objectives: [
      { id: 'ch1_gate', text: 'Approach the main gate' },
      { id: 'ch1_clue', text: 'Examine the hidden clue by the fountain' },
      { id: 'ch1_door', text: 'Reach the sealed entrance doors' },
    ],
    next: 'ch02_locked_house',
  },
  {
    id: 'ch02_locked_house',
    num: 2,
    title: 'The Locked House',
    brief:
      'The doors opened for you — and slammed shut before the echo died. Whatever sealed this house wanted ' +
      'you inside. Search the grand hall, kitchen, bedrooms and library. Find another way deeper in.',
    region: 'entrance_hall',
    objectives: [
      { id: 'ch2_hall', text: 'Search the entrance hall (the photograph)' },
      { id: 'ch2_kitchen', text: 'Find a tool in the kitchen' },
      { id: 'ch2_bedrooms', text: 'Investigate the bedrooms' },
      { id: 'ch2_library', text: 'Unlock the library door using the pattern in the ledger' },
    ],
    next: 'ch03_first_hunt',
  },
  {
    id: 'ch03_first_hunt',
    num: 3,
    title: 'The First Hunt',
    brief:
      'Something enormous is dragging a knife along the walls upstairs. It hears everything. Do not run blindly. ' +
      'Find holy water — the old caretaker kept some in the medical room.',
    region: 'grand_staircase',
    objectives: [
      { id: 'ch3_witness', text: 'Survive your first encounter with the Butcher' },
      { id: 'ch3_holy', text: 'Retrieve holy water from the medical room' },
      { id: 'ch3_hide', text: 'Escape by hiding until his footsteps fade' },
    ],
    next: 'ch04_voice_on_radio',
  },
  {
    id: 'ch04_voice_on_radio',
    num: 4,
    title: 'The Voice on the Radio',
    brief:
      'The shortwave in the investigation room picks up a broadcast from inside the manor — dated 1962. ' +
      'A team of investigators recorded their own deaths. The voice on the radio knows your name.',
    region: 'investigation_room',
    objectives: [
      { id: 'ch4_radio', text: 'Listen to the 1962 broadcast to the end' },
      { id: 'ch4_spirit', text: 'Let the radio station pull you through — become spirit-touched' },
      { id: 'ch4_return', text: 'Return to your body before the seal marks you' },
    ],
    onEnter: () => {
      // In coop, the scripted death falls on the host's chosen "invited" teammate;
      // in single player it is a near-death vision (playable spirit transformation).
      g().setFlag('spiritTouched');
    },
    next: 'ch05_family_secret',
  },
  {
    id: 'ch05_family_secret',
    num: 5,
    title: 'The Family Secret',
    brief:
      'Evelyn Blackthorn died here two hundred years ago — and she has been waiting for someone stubborn enough ' +
      'to keep walking. Gather her memories in the sealed wing.',
    region: 'sealed_wing',
    objectives: [
      { id: 'ch5_nursery', text: "Recover memory I in the nursery (the patriarch's study)" },
      { id: 'ch5_evelyn', text: "Recover memory II in Evelyn's room (the interrupted ritual)" },
      { id: 'ch5_meet', text: 'Accept Evelyn as a guide' },
    ],
    next: 'ch06_brides_game',
  },
  {
    id: 'ch06_brides_game',
    num: 6,
    title: "The Bride's Game",
    brief:
      'The ballroom doors open onto corridors that do not exist. She will wear your friend’s voice and beg you ' +
      'to open a locked door. If you hear someone you love calling from behind a locked door — do not open it.',
    region: 'ballroom',
    objectives: [
      { id: 'ch6_cross', text: 'Break the first illusion with the silver cross (camera reveals seams)' },
      { id: 'ch6_false', text: 'Refuse the false door — do not answer the weeping' },
      { id: 'ch6_mirror', text: 'Shatter the mirror at the heart of the bride’s loop' },
    ],
    next: 'ch07_hidden_caretaker',
  },
  {
    id: 'ch07_hidden_caretaker',
    num: 7,
    title: 'The Hidden Caretaker',
    brief:
      'Fresh tea in the kitchen. Boot prints no older than this morning. Someone living has been walking these ' +
      'halls with you — or behind you.',
    region: 'storage_room',
    objectives: [
      { id: 'ch7_proof', text: 'Collect proof of a living intruder (fresh matches, the ledgers)' },
      { id: 'ch7_portrait', text: 'Compare the portrait gallery to the caretaker’s ledger' },
      { id: 'ch7_confront', text: 'Follow him into the secret passages' },
    ],
    next: 'ch08_kings_key',
  },
  {
    id: 'ch08_kings_key',
    num: 8,
    title: "The King's Key",
    brief:
      'The chapel bells ring without hands to pull them. The Hollow King wore a crown before the manor had a ' +
      'name, and his necklace holds the weapons locker key. He lets no one take it quietly.',
    region: 'chapel',
    objectives: [
      { id: 'ch8_seals', text: 'Activate the three seal mechanisms in the chapel wing' },
      { id: 'ch8_king', text: 'Survive or resolve the confrontation with the Hollow King' },
      { id: 'ch8_necklace', text: 'Take the necklace (weapons locker key)' },
    ],
    next: 'ch09_treasure_vault',
  },
  {
    id: 'ch09_treasure_vault',
    num: 9,
    title: 'The Treasure Vault',
    brief:
      'Gold enough to buy the county, jewels cut from stone that fell upward, and one manuscript worth more ' +
      'than all of it: The Testament of the Seven Gates. Take the knowledge. The gold is optional.',
    region: 'treasure_vault',
    objectives: [
      { id: 'ch9_locker', text: 'Open the weapons locker with the necklace key' },
      { id: 'ch9_vault', text: 'Enter the treasure vault' },
      { id: 'ch9_testament', text: 'Read THE TESTAMENT OF THE SEVEN GATES' },
    ],
    next: 'ch10_forgotten_ritual',
  },
  {
    id: 'ch10_forgotten_ritual',
    num: 10,
    title: 'The Forgotten Ritual',
    brief:
      'Beneath the manor: servants’ tunnels, catacombs, cells, a laboratory where someone tried to measure hell, ' +
      'and a sacrificial chamber with a stain shaped like a child. Reconstruct the original ritual.',
    region: 'servants_tunnels',
    objectives: [
      { id: 'ch10_catacombs', text: 'Pass the catacombs and prison cells' },
      { id: 'ch10_lab', text: 'Recover the ritual components from the laboratory' },
      { id: 'ch10_chamber', text: 'Reconstruct the ritual circle in the sacrificial chamber' },
    ],
    next: 'ch11_caretakers_truth',
  },
  {
    id: 'ch11_caretakers_truth',
    num: 11,
    title: "The Caretaker's Truth",
    brief:
      'He wrote the invitations. Each guest was chosen for a purpose in an unfinished ritual — including you. ' +
      'He believes Satan will give him back the person he loves. You can prove otherwise.',
    region: 'gateway_mechanisms',
    objectives: [
      { id: 'ch11_listen', text: 'Hear the Caretaker explain himself' },
      { id: 'ch11_evidence', text: 'Show him the recordings of his loved one beyond the gate' },
      { id: 'ch11_choice', text: 'Decide: expose / confront / persuade / accept the pact' },
    ],
    next: 'ch12_gateway',
  },
  {
    id: 'ch12_gateway',
    num: 12,
    title: 'The Gateway',
    brief:
      'The seal is failing. Staircases forget where they were going. Rooms trade places between blinks. ' +
      'Get to the gateway chamber before the geometry finishes collapsing.',
    region: 'gateway_mechanisms',
    objectives: [
      { id: 'ch12_reach', text: 'Reach the gateway chamber' },
      { id: 'ch12_hold', text: 'Hold the line while the ritual circle charges' },
    ],
    next: 'ch13_last_exorcism',
  },
  {
    id: 'ch13_last_exorcism',
    num: 13,
    title: 'The Last Exorcism',
    brief:
      'He is on the other side of the door, and the door is thinning. Ordinary weapons cannot kill what waits ' +
      'there. Speak the reversed rite. Close what should never have been opened.',
    region: 'gateway_chamber',
    objectives: [
      { id: 'ch13_circle', text: 'Stand in the designated spirit-interaction circle' },
      { id: 'ch13_words', text: 'Complete the reversed ritual against the pressure of the gate' },
      { id: 'ch13_satan', text: 'Face Satan’s final temptation' },
    ],
    next: 'ch14_beyond_the_door',
  },
  {
    id: 'ch14_beyond_the_door',
    num: 14,
    title: 'Beyond the Door',
    brief: 'The manor is dying around you. Run. Resolve what remains of your fates.',
    region: 'escape_tunnel',
    objectives: [{ id: 'ch14_escape', text: 'Escape through the alternate tunnel' }],
    next: 'ch15_seven_gates',
  },
  {
    id: 'ch15_seven_gates',
    num: 15,
    title: 'The Seven Gates',
    brief:
      'Post-credits. Six other gateways remain. Somewhere, something counts them on its fingers, and stops ' +
      'at six, smiling at the arithmetic.',
    region: 'exterior',
    objectives: [{ id: 'ch15_fin', text: 'Witness the revelation' }],
    next: null,
  },
];

export const CHAPTER_ORDER = CHAPTERS.map((c) => c.id);

export function chapterById(id: ChapterId): ChapterDef {
  return CHAPTERS.find((c) => c.id === id)!;
}

// ---------------------------------------------------------------------------
// Endings - computed from flags gathered across the campaign
// ---------------------------------------------------------------------------
export function computeEnding(): EndingId {
  const s = g();
  const f = s.flags;
  if (f.pact) return 'ending_pact';
  if (s.deaths > 0 && f.allLost) return 'ending_spirit';
  if (s.health <= 0 && s.mode === 'single') return 'ending_consumed';
  if (s.sealIntegrity <= 0) return 'ending_consumed';
  if (f.freedGhosts && f.ritualReversed) return 'ending_gate_closed';
  if (f.evelynSacrifice) return 'ending_seal_restored';
  if (f.escapeOnly) return 'ending_escape_alive';
  return 'ending_seal_restored';
}

export const ENDING_TEXT: Record<EndingId, { title: string; body: string }> = {
  ending_gate_closed: {
    title: 'THE GATE IS CLOSED',
    body:
      'The reversed rite takes hold. The Butcher lays down his knife and is only a guard again; the Bride lifts ' +
      'her veil and is only a woman who was lied to; the King’s crown rustles into dust. Evelyn steps through ' +
      'the narrowing dark as if coming home. Behind you the gateway seals with a sound like a held breath finally ' +
      'released. You walk out carrying the truth — and the Testament. Six gates still stand somewhere in the world.',
  },
  ending_seal_restored: {
    title: 'THE SEAL HOLDS',
    body:
      'There was no way to close it without something precious left inside. You know what it cost. The manor ' +
      'settles over the repaired seal like a lid over a wound. Evelyn stays — the lock needs a keeper, and she ' +
      'was always the strongest thing in this house. Some nights, travellers on that road hear a woman humming ' +
      'behind the walls, keeping the door shut from the other side.',
  },
  ending_consumed: {
    title: 'CONSUMED',
    body:
      'The seal fails at the worst possible second. The gate does not open so much as the world admits it was ' +
      'never closed. The invitation that arrives at the next address is printed on paper that smells faintly of ' +
      'smoke and old roses. It says: "You entered together."',
  },
  ending_pact: {
    title: 'THE PACT',
    body:
      'The Caretaker was right about one thing: grief is persuadable. You hand him the last component. Beyond ' +
      'the gate, something keeps its promise exactly — which is the worst way to keep a promise. The manor’s ' +
      'lights come on, room by room, all across the county.',
  },
  ending_spirit: {
    title: 'THE NEW RESIDENTS',
    body:
      'None of you walked out. That is not the same as leaving. The house needed new bound spirits to replace ' +
      'the ones you freed, and it has excellent taste in guests. When the next hunters arrive, you will be the ' +
      'voices on the radio, begging them not to open the door. They never listen. None of us did.',
  },
  ending_escape_alive: {
    title: 'OUT ALIVE',
    body:
      'You ran, and the manor let you — which should worry you more than a chase would have. Everyone is alive. ' +
      'Nobody sleeps well. The seal cracks audibly every few months, a sound like distant applause, and each ' +
      'time it gets closer. You survived Blackthorn Manor. Blackthorn Manor did not need to survive you.',
  },
};
