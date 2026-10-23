// ============================================================================
// THE LAST EXORCISM - Interaction system: raycast-free proximity picking,
// note/item/puzzle handlers, chapter triggers. Works with E key or the mobile
// Interact button (touch-friendly: tap the object OR walk near + press E).
// ============================================================================
import * as THREE from 'three';
import { useGame } from './state';
import { INTERACTABLES, DOORS, roomById } from '../data/world';
import type { InteractableDef } from '../data/world';
import { NOTES, MEMORIES, BRIDE_WHISPERS } from '../data/lore';
import { obj, revealMemory, weakenSeal, addNote, chapterById } from '../data/campaign';
import { audio } from './audio';

const g = () => useGame.getState();
const chapterNum = () => chapterById(g().chapter).num;

export interface PickResult {
  def: InteractableDef | null;
  doorId: string | null;
  label: string;
}

/** Find the nearest interactable/door within reach of the player position. */
export function pickNear(pos: THREE.Vector3, facingYaw: number, reach = 2.6): PickResult {
  const region = g().region;
  let best: InteractableDef | null = null;
  let bestD = reach;
  for (const it of INTERACTABLES) {
    if (it.region !== region) continue;
    const d = Math.hypot(it.x - pos.x, it.z - pos.z);
    if (d < bestD) {
      // must be roughly in front unless very close
      const ang = Math.atan2(pos.x - it.x, pos.z - it.z);
      const diff = Math.abs(shortestAngle(ang, facingYaw));
      if (diff < 1.4 || d < 1.2) {
        best = it;
        bestD = d;
      }
    }
  }
  // doors: check doorway positions to neighbouring regions
  let bestDoor: string | null = null;
  let bd = 2.2;
  for (const dr of DOORS) {
    if (dr.a !== region && dr.b !== region) continue;
    if (dr.hidden && !g().flags[dr.hidden]) continue;
    const d = Math.hypot(dr.x - pos.x, dr.z - pos.z);
    if (d < bd) {
      bestDoor = dr.id;
      bd = d;
    }
  }
  if (!best && bestDoor) {
    const dr = DOORS.find((x) => x.id === bestDoor)!;
    return { def: null, doorId: bestDoor, label: doorLabel(dr.id) };
  }
  return { def: best, doorId: null, label: best ? best.label : '' };
}

function shortestAngle(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function doorLabel(id: string): string {
  const dr = DOORS.find((d) => d.id === id)!;
  const other = dr.a === g().region ? dr.b : dr.a;
  return `Enter ${roomById(other).name}`;
}

export function canPassDoor(id: string): { ok: boolean; reason?: string } {
  const s = g();
  const dr = DOORS.find((d) => d.id === id)!;
  if (dr.hidden && !s.flags[dr.hidden]) return { ok: false, reason: 'Nothing but wall here.' };
  if (dr.needsFlag && !s.flags[dr.needsFlag]) {
    return { ok: false, reason: 'It will not move. Not yet.' };
  }
  if (dr.locked) {
    switch (id) {
      case 'd_dining_library':
        if (s.flags.libraryUnlocked) break;
        return { ok: false, reason: 'Locked. A ledger’s pattern is scratched around the frame…' };
      case 'd_chapel_locker':
        if (s.inventory.some((i) => i.id === 'necklace_key')) break;
        return { ok: false, reason: 'A drowned-looking keyhole. You need a necklace.' };
      case 'd_sacri_vault':
        if (s.flags.vaultOpen) break;
        return { ok: false, reason: 'The vault door is fused shut. Something glints through the seam.' };
    }
  }
  return { ok: true };
}

export function useDoor(id: string) {
  const s = g();
  const dr = DOORS.find((d) => d.id === id)!;
  const check = canPassDoor(id);
  if (!check.ok) {
    s.showToast(check.reason ?? 'Locked.');
    audio.door(true);
    // story trigger: opening the weeping door during ch6 = mistake
    if (id === 'd_ball_sealed' && !s.flags.sealedWingOpen) {
      s.showToast('The bolts draw themselves back. The house permits you upstairs.');
      s.setFlag('sealedWingOpen');
    }
    return;
  }
  audio.door(false);
  const dest = dr.a === s.region ? dr.b : dr.a;
  goToRegion(dest, dr);
  // triggers by destination
  if (dest === 'entrance_hall') obj('ch1_door', 'The doors slam behind you. No handle on this side.');
  if (dest === 'library') s.setFlag('inLibrary');
  if (dest === 'treasure_vault') obj('ch9_vault', 'Gold enough to buy the county. It is warm to the touch.');
  if (dest === 'gateway_chamber') obj('ch12_reach');
  if (dest === 'catacombs') obj('ch10_catacombs', 'The catacombs are patient. So are the cells.');
  if (dest === 'servants_tunnels' && s.chapter === 'ch10_forgotten_ritual') { /* flavour */ }
}

export function goToRegion(region: string, dr?: { x: number; z: number; axis: string }) {
  const s = g();
  const room = roomById(region as never);
  let x = room.cx, z = room.cz;
  if (dr) {
    // spawn just inside the target room near the doorway
    const inwardX = Math.sign(room.cx - dr.x) || 1;
    const inwardZ = Math.sign(room.cz - dr.z) || 1;
    x = dr.axis === 'z' ? dr.x + inwardX * 0 : dr.x + inwardX * 2.5;
    z = dr.axis === 'z' ? dr.z + inwardZ * 2.5 : dr.z;
  }
  window.dispatchEvent(
    new CustomEvent('tle:teleport', { detail: { region, x, z } }),
  );
  s.set({ region: region as never, spawnToken: s.spawnToken + 1 });
}

// ---------------------------------------------------------------------------
// Main interact handler (E / Interact button)
// ---------------------------------------------------------------------------
export function doInteract(pick: PickResult) {
  const s = g();
  if (s.isSpirit) {
    showToastShort('You are spirit-touched. Some locks answer to you now.');
  }
  if (pick.doorId) {
    useDoor(pick.doorId);
    return;
  }
  const it = pick.def;
  if (!it) return;
  if (it.once && s.flags[`done_${it.id}`]) return;

  switch (it.kind) {
    case 'note': {
      const n = NOTES[it.data?.noteId ?? ''];
      if (n) {
        audio.page();
        addNote({ id: it.data!.noteId, title: n.title, body: n.body, chapter: s.chapter, kind: 'document' });
        window.dispatchEvent(new CustomEvent('tle:openNote', { detail: n }));
        handleNoteTrigger(it);
      }
      break;
    }
    case 'memory': {
      const m = MEMORIES[it.data?.mem ?? ''];
      if (m) {
        audio.sealChime();
        revealMemory(it.data!.mem, m.title, m.body);
        handleMemoryTrigger(it);
      }
      break;
    }
    case 'item': {
      giveItem(it.data!.item);
      audio.pickup();
      if (it.once) s.setFlag(`done_${it.id}`);
      handleItemTrigger(it);
      break;
    }
    case 'puzzle': {
      if (it.data?.puzzle === 'library') openLibraryPuzzle();
      break;
    }
    case 'radio': {
      runRadio();
      break;
    }
    case 'seal': {
      activateSeal(it);
      break;
    }
    case 'mirror': {
      smashMirror();
      break;
    }
    case 'locker': {
      openLocker();
      break;
    }
    case 'testament': {
      readTestament();
      break;
    }
    case 'circle': {
      enterFinalCircle();
      break;
    }
    case 'body': {
      s.showToast('Restraints. Recent buckles. Someone was treated here — kindly, and against their will.');
      break;
    }
    case 'door': {
      handleSpecialDoor(it);
      break;
    }
    case 'switch': {
      runSwitch(it);
      break;
    }
    case 'portrait': {
      break;
    }
  }
}

function showToastShort(msg: string) {
  g().showToast(msg);
}

// ---- per-object story triggers -------------------------------------------
function handleNoteTrigger(it: InteractableDef) {
  const id = it.data?.noteId;
  if (id === 'fountain_clue') obj('ch1_clue');
  if (id === 'photo1') obj('ch1_gate', 'The gate opens without being touched.');
  if (id === 'welcome_letter') obj('ch2_hall', 'Photographed yourselves arriving. You have no memory of that camera.');
  if (id === 'ledger1') g().setFlag('knowsPattern');
  if (id === 'tea_note') obj('ch7_proof', 'Someone lives here. Someone drinks tea in the kitchen of the dead.');
  if (id === 'matches') g().setFlag('caretakerSuspect');
  if (id === 'caretaker_ledger') obj('ch7_portrait', 'The bloodline never left the house. It changed jobs.');
  if (id === 'scratch') obj('ch3_witness', 'He has been here longer than the family name.');
  if (id === 'evp1962') g().setFlag('knowsReel6');
  if (id === 'estate') g().setFlag('knowsEvelyn');
  if (id === 'labnotes') g().setFlag('knowsRiteRule');
  if (id === 'graffiti') g().setFlag('caretakerKindness');
  if (id === 'caretaker_tape') {
    obj('ch11_evidence', 'Play it a third time. Listen past her voice to what answers him.');
    g().setFlag('tapeShown');
  }
  if (id === 'epilogue') obj('ch15_fin');
}

function handleMemoryTrigger(it: InteractableDef) {
  const mem = it.data?.mem;
  if (mem === 'm1') obj('ch5_nursery');
  if (mem === 'm2') obj('ch5_evelyn', 'Evelyn: “Now you carry it. Willingly. That is rarer than you know.”');
  if (mem === 'm3') g().setFlag('butcherTruth');
  if (mem === 'm4') g().setFlag('kingTruth');
}

function handleItemTrigger(it: InteractableDef) {
  const item = it.data?.item;
  if (item === 'holy_water') obj('ch3_holy', 'Holy water. It sloshes wrong — heavier when evil is near.');
  if (item === 'cross') g().setFlag('hasCross');
  if (item === 'invitation_list') obj('ch7_confront', 'Your own invitation, annotated in pencil: “holds the fourth candle”.');
  if (item === 'necklace_key') obj('ch8_necklace', 'Seven links. The heaviest is a key.');
}

export function giveItem(id: string) {
  const defs: Record<string, { name: string; desc: string; usable?: boolean }> = {
    knife: { name: 'Kitchen Knife', desc: 'Small, honest, useless against most of what lives here.' },
    matches: { name: 'Matches', desc: 'Dry. Yours? Or his?' },
    holy_water: { name: 'Holy Water', desc: 'Use (G) on the Butcher to weaken him.', usable: true },
    bandage: { name: 'Field Bandage', desc: 'Use (G) to steady your bleeding.', usable: true },
    cross: { name: 'Silver Cross', desc: 'Illusions bleed at the edges when you hold it.', usable: true },
    salt: { name: 'Iron-Flecked Salt', desc: 'A line poured buys seconds, not safety.', usable: true },
    necklace_key: { name: "Drowned King's Necklace", desc: 'Weapons locker key on every chain.' },
    revolver: { name: 'Revolver + Silver Rounds', desc: 'Cannot kill them. Can interrupt them.', usable: true },
    gold: { name: 'Handful of Gold', desc: 'Optional. Warm. Counts toward nothing.' },
    rite_kit: { name: 'Rite Components', desc: 'Chalk, ash, oil of wintergreen, a spare willing name.' },
    invitation_list: { name: 'Invitation List', desc: 'Every guest, every purpose. Including yours.' },
  };
  const d = defs[id];
  if (!d) return;
  g().addItem({ id, name: d.name, desc: d.desc, qty: 1, usable: d.usable });
  g().showToast(`Picked up: ${d.name}`);
}

// ---------------------------------------------------------------------------
// Puzzles & special interactions (all touch-friendly, tap-based)
// ---------------------------------------------------------------------------
export function openLibraryPuzzle() {
  const s = g();
  if (s.flags.libraryUnlocked) {
    s.showToast('The library stands open. The books rearrange themselves politely as you enter.');
    return;
  }
  if (!s.notes.some((n) => n.id === 'ledger1')) {
    s.showToast('A four-symbol lock: VII · III · I · IV. You have seen this sequence somewhere.');
    return;
  }
  window.dispatchEvent(new CustomEvent('tle:puzzle', { detail: { puzzle: 'library' } }));
}

export function solveLibraryPuzzle() {
  const s = g();
  s.setFlag('libraryUnlocked');
  audio.door(false);
  obj('ch2_library', 'The tumblers fall like teeth. The library exhales.');
  s.showToast('The library door drifts open.');
}

export function runRadio() {
  const s = g();
  if (s.flags.radioPlayed) {
    s.showToast('REEL 6 turns. Silence is the loudest track.');
    return;
  }
  s.setFlag('radioPlaying');
  window.dispatchEvent(new CustomEvent('tle:radio', {}));
}

export function radioFinished() {
  const s = g();
  s.setFlag('radioPlayed');
  obj('ch4_radio', 'The broadcast ends with your own name, read like a roll call of the dead.');
  // spirit transformation begins
  s.set({ isSpirit: true });
  obj('ch4_spirit', 'You slip sideways out of your body. The manor looks different from the thin side.');
  window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: 'spirit_transform' } }));
}

export function spiritReturn() {
  const s = g();
  if (!s.isSpirit) return;
  s.set({ isSpirit: false });
  obj('ch4_return', 'You take your body back like a coat that fits slightly wrong.');
  s.setFlag('freedGhosts'); // seeing the thin side teaches how ghosts can be freed
}

export function activateSeal(it: InteractableDef) {
  const s = g();
  const n = it.data!.seal;
  const flag = `seal${n}`;
  if (s.flags[flag]) return;
  s.setFlag(flag);
  audio.sealChime();
  s.showToast(`Seal mechanism ${n} engages with a sound like a knuckle cracking.`);
  const done = ['seal1', 'seal2', 'seal3'].filter((f) => g().flags[f]).length;
  if (done >= 3) {
    obj('ch8_seals', 'Three seals answer. The chapel bells ring once — approvingly.');
    s.setFlag('chapelBlessed');
  }
}

export function smashMirror() {
  const s = g();
  if (s.flags.mirrorSmashed) return;
  if (!s.inventory.some((i) => i.id === 'cross')) {
    s.showToast('The mirror shows the room one degree rotated. Your reflection blinks first. Touching it bare-handed seems inadvisable.');
    audio.whisper();
    s.set({ hint: 'BRIDE WHISPER: ' + BRIDE_WHISPERS[Math.floor(Math.random() * BRIDE_WHISPERS.length)] });
    return;
  }
  s.setFlag('mirrorSmashed');
  audio.stinger();
  window.dispatchEvent(new CustomEvent('tle:event', { detail: { kind: 'illusion_break' } }));
  obj('ch6_mirror', 'The mirror breaks into rooms instead of shards. The loop ends mid-waltz.');
  s.setFlag('sealedWingOpen');
}

export function refuseFalseDoor() {
  const s = g();
  if (s.flags.refusedDoor) return;
  s.setFlag('refusedDoor');
  obj('ch6_false', 'You step back from the weeping. The weeping stops first, offended.');
  audio.whisper();
}

export function openLocker() {
  const s = g();
  if (!s.inventory.some((i) => i.id === 'necklace_key')) {
    s.showToast('Bolted shut. A necklace-shaped keyhole, dripping slightly.');
    return;
  }
  if (s.flags.lockerOpened) return;
  s.setFlag('lockerOpened');
  giveItem('revolver');
  obj('ch9_locker', 'The locker yields: revolver, silver rounds, and a hand-drawn map of the vault.');
  s.setFlag('vaultOpen');
  s.setFlag('escapeKnown');
}

export function readTestament() {
  const s = g();
  audio.page();
  addNote({
    id: 'testament',
    title: 'THE TESTAMENT OF THE SEVEN GATES',
    body:
      'Seven gateways connect the realms; Blackthorn is the first and the weakest. Each ghost bound to a gate ' +
      'is a rivet; each frightened death a hammer-blow. To reverse the rite: speak the founding names backward, ' +
      'spend no blood within the circle, and let the gate choose its own closer. Defeating the rivets without ' +
      'repairing the seal only loosens the door.',
    chapter: s.chapter,
    kind: 'testament',
  });
  obj('ch9_testament', 'You understand now: the ghosts are rivets, not invaders.');
  s.setFlag('knowsTestament');
  s.setFlag('tunnelsOpen');
}

export function buildCircle() {
  const s = g();
  if (s.flags.circleBuilt) return;
  if (!s.inventory.some((i) => i.id === 'rite_kit')) {
    s.showToast('The broken circle needs chalk, ash, oil — and someone who measured this before. Look underground.');
    return;
  }
  s.setFlag('circleBuilt');
  audio.sealChime();
  obj('ch10_chamber', 'The reconstructed circle hums at a frequency you feel in your fillings.');
  s.setFlag('gateApproached');
}

export function kingConfront() {
  const s = g();
  if (s.flags.kingResolved) return;
  if (s.flags.kingTruth) {
    // alternative resolution: speak his history
    s.setFlag('kingResolved');
    audio.sealChime();
    obj('ch8_king', 'You say his kingdom’s forgotten name aloud. The Hollow King kneels, grateful, and lets the dark pass.');
    s.setFlag('freedGhosts');
    g().setFlag('necklaceAvailable');
    s.showToast('The necklace surfaces in the font, drifting like something released.');
  } else {
    s.showToast('Cold presses against your skull. Lights die one by one. He cannot tell you from a threat.');
    weakenSeal(4);
    audio.stinger();
    s.set({ sanity: Math.max(0, s.sanity - 12) });
    // fight path: shoot with revolver handled via useEquipment
  }
}

export function caretakerTalk() {
  const s = g();
  window.dispatchEvent(new CustomEvent('tle:dialogue', { detail: { who: 'caretaker' } }));
  obj('ch11_listen', 'He tells the truth entirely, which is how you can tell he believes it.');
}

export function caretakerDecision(decision: 'expose' | 'confront' | 'persuade' | 'pact') {
  const s = g();
  if (decision === 'pact') {
    s.setFlag('pact');
    s.showToast('You hand him the last component. Somewhere, a promise starts keeping itself.');
  } else {
    s.setFlag('caretakerHelps');
    if (decision === 'persuade') s.showToast('“Then help us close it properly,” you say. He nods like a man set down.');
    if (decision === 'expose') s.showToast('You play the tape a third time. His face does the arithmetic of grief.');
    if (decision === 'confront') s.showToast('He surrenders the winch key without a word. That is worse than a fight.');
    obj('ch11_choice', 'The Caretaker steps aside from the mechanism. For now, the house obeys guests, not hosts.');
  }
}

export function chargeRitual() {
  const s = g();
  if (!s.flags.caretakerHelps && !s.flags.pact) {
    s.showToast('The capacitor bank needs both hands and a clear conscience. The Caretaker watches you decide.');
  }
  s.setFlag('charging');
  obj('ch12_hold', 'Hold the line. The circle charges like a held breath.');
  s.showToast('Deep below, something begins counting down.');
  s.setFlag('gateApproached');
}

export function enterFinalCircle() {
  const s = g();
  obj('ch13_circle', 'You stand in the spirit-interaction circle. Evelyn’s handwriting crawls up the floor: “Together, then.”');
  window.dispatchEvent(new CustomEvent('tle:finalRite', {}));
}

export function completeRite() {
  const s = g();
  s.setFlag('ritualReversed');
  audio.sealChime();
  obj('ch13_words', 'The reversed rite takes hold. The gate hesitates — gates never hesitate.');
}

export function satanFace() {
  const s = g();
  window.dispatchEvent(new CustomEvent('tle:dialogue', { detail: { who: 'satan' } }));
}

export function finalChoice(choice: 'close' | 'sacrifice' | 'flee') {
  const s = g();
  if (choice === 'close') {
    if (s.flags.knowsTestament && s.flags.ritualReversed) {
      obj('ch13_satan', 'You refuse the offer and finish the sentence. The gate closes around the closing of it.');
      s.setFlag('closedGate');
    } else {
      s.showToast('Without the Testament’s knowledge your words slide off the door. Learn why the ghosts are rivets.');
    }
  } else if (choice === 'sacrifice') {
    s.setFlag('evelynSacrifice');
    obj('ch13_satan', 'Evelyn takes the offered place in the lock. She thanks you. That is the unbearable part.');
  } else {
    s.setFlag('escapeOnly');
    s.setFlag('escaping');
    obj('ch13_satan', 'You break the circle and run for the servants’ exit. The house lets you — which should worry you.');
  }
  // advance to ch14
  window.dispatchEvent(new CustomEvent('tle:advance', {}));
}

export function escapeManor() {
  const s = g();
  obj('ch14_escape', 'Night air. Grass underfoot that does not move when nobody walks on it.');
  window.dispatchEvent(new CustomEvent('tle:advance', {}));
}

export function hideAction() {
  const s = g();
  if (s.flags.butcherHunting) {
    s.setFlag('hiding');
    s.showToast('Inside the armoire. Mothballs and old wool. Through the slats: his footsteps slow…');
    setTimeout(() => {
      g().setFlag('hiding', false);
      g().setFlag('butcherHunting', false);
      obj('ch3_hide', 'His footsteps fade. The knife-drag sound resumes somewhere far above.');
    }, 6000);
  } else {
    s.showToast('You could hide here when it matters. Probably it will matter.');
  }
}

export function evelynMeet() {
  const s = g();
  if (s.memoriesFound.length < 2) {
    s.showToast('The shrine waits for evidence. Gather her memories first — the nursery, the writing desk.');
    return;
  }
  s.setFlag('evelynGuide');
  obj('ch5_meet', 'Evelyn Blackthorn accepts you as witnesses. The sealed wing unlocks with a sound like a held breath released.');
  s.setFlag('sealedWingOpen');
  s.setFlag('passagesFound');
  s.setFlag('cellarStairs');
  audio.sealChime();
}

function handleSpecialDoor(it: InteractableDef) {
  const s = g();
  if (it.id === 'i_gate') {
    obj('ch1_gate', 'The main gate swings wide before you touch it. Invitation accepted.');
    goToRegion('entrance_hall', { x: 0, z: -35, axis: 'z' });
    return;
  }
  if (it.id === 'i_side_door') {
    s.setFlag('sideEntrance');
    s.showToast('The side entrance hangs open on one hinge. Useful later. Smelled of pipe smoke.');
    return;
  }
  if (it.id === 'i_cellar') {
    if (chapterNum() >= 10 || s.flags.tunnelsOpen) {
      s.setFlag('cellarStairs');
      s.showToast('The barricade gives easily. Too easily. Stairs descend where none were drawn on any plan.');
    } else {
      s.showToast('Barricaded from the other side. Whatever boarded this did not want cellar work.');
    }
    return;
  }
  if (it.id === 'i_false_door') {
    if (s.flags.mirrorSmashed) {
      s.showToast('Behind the door: a brick wall, two hundred years cold. The weeping was never in there.');
      refuseFalseDoor();
    } else {
      s.showToast('Something weeps behind this door, wearing a voice you love. The letter warned you. Do not open it.');
      audio.whisper();
      s.set({ sanity: Math.max(0, s.sanity - 5) });
    }
    return;
  }
  if (it.id === 'i_escape_exit') {
    escapeManor();
    return;
  }
}

function runSwitch(it: InteractableDef) {
  const a = it.data?.action;
  if (a === 'hide') hideAction();
  if (a === 'evelynMeet') evelynMeet();
  if (a === 'kingConfront') kingConfront();
  if (a === 'caretakerTalk') caretakerTalk();
  if (a === 'buildCircle') buildCircle();
  if (a === 'charge') chargeRitual();
  if (a === 'satanFace') satanFace();
}

// small helper attached ad-hoc (chapter number)

export function useEquipment(targetEnemyPos: THREE.Vector3 | null, playerPos: THREE.Vector3) {
  const s = g();
  const inv = s.inventory;
  const slot = inv[s.selectedSlot] ?? inv.find((i) => i.usable);
  if (!slot) {
    s.showToast('No equipment selected. Tab to open inventory and choose.');
    return;
  }
  switch (slot.id) {
    case 'holy_water': {
      if (targetEnemyPos && targetEnemyPos.distanceTo(playerPos) < 6) {
        s.consumeItem('holy_water');
        window.dispatchEvent(new CustomEvent('tle:butcherStun', {}));
        s.showToast('The water strikes him like a bell. The Butcher recoils, shrinking into something merely large.');
      } else {
        s.showToast('You splash holy water into empty air. It smells briefly of church.');
      }
      break;
    }
    case 'bandage': {
      s.consumeItem('bandage');
      s.set({ health: Math.min(100, s.health + 25) });
      s.showToast('Bandaged. The bleeding slows.');
      break;
    }
    case 'cross': {
      window.dispatchEvent(new CustomEvent('tle:revealSeams', {}));
      s.showToast('Held up, the cross makes illusions bleed at their seams.');
      break;
    }
    case 'salt': {
      s.consumeItem('salt');
      window.dispatchEvent(new CustomEvent('tle:saltLine', {}));
      s.showToast('A line of salt-and-iron. It will buy seconds, not safety.');
      break;
    }
    case 'revolver': {
      if (targetEnemyPos && targetEnemyPos.distanceTo(playerPos) < 14) {
        audio.stinger();
        window.dispatchEvent(new CustomEvent('tle:shoot', {}));
        s.showToast('Silver rounds fire. They cannot kill what is already dead — but they can interrupt it.');
      } else {
        audio.stinger();
        s.showToast('You fire into the dark. The dark files a complaint.');
        s.set({ sanity: Math.max(0, s.sanity - 6) });
      }
      break;
    }
    default:
      s.showToast(`${slot.name}: not something you can simply use here.`);
  }
}
