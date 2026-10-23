// ============================================================================
// THE LAST EXORCISM - Story documents, memories and radio scripts (authored text)
// ============================================================================

export interface NoteText {
  title: string;
  body: string;
}

export const NOTES: Record<string, NoteText> = {
  fountain_clue: {
    title: 'The Fountain Inscription',
    body:
      'Beneath the silt, the fountain basin carries a carved line in Latin and, below it, a scratched modern ' +
      'translation: "QUI APERIT — LET WHOOP OPEN." Someone has counted seven notches around the drain. One is ' +
      'fresh. The gateway is numbered, and this house is number one.',
  },
  photo1: {
    title: 'The Photograph from the Letter',
    body:
      'The same photograph that came with your invitation, wedged into the gate where you dropped it: seven ' +
      'figures on the manor steps, dated 1962. Six faces are scratched out. The seventh is yours — but you have ' +
      'never worn that coat.',
  },
  welcome_letter: {
    title: 'A Second Invitation',
    body:
      'On the console table, in fresh ink: "You entered together. One of you died. None of you can leave. ' +
      '— H." The caretaker’s initials. The paper is warm.',
  },
  ledger1: {
    title: 'Visitor Ledger',
    body:
      'Every page lists investigators who arrived at Blackthorn since 1908. Each entry ends the same way: ' +
      '"departed, incomplete." The last page has today’s date and all of your names — written in a hand you do ' +
      'not recognise as your own. A pattern recurs: VII · III · I · IV. Seven gates, three seals, one child, four ' +
      'who were warned.',
  },
  tea_note: {
    title: 'Still-Warm Tea',
    body:
      'Two cups on the kitchen table. One cold for years. The other steaming. Whoever lives here now takes sugar ' +
      'and hears everything.',
  },
  diary1: {
    title: "Maid's Diary, 1889",
    body:
      '"The master keeps the east wing boarded. He says the girl in the portrait asks to be let out, and that ' +
      'kindness would be a mistake. I heard weeping there Tuesday. It knew my name."',
  },
  scratch: {
    title: 'Scratched Into the Newel Post',
    body:
      'Deep gouges, recent, at shoulder height: "HE HEARS THE FLOOR. WALK SOFT OR WALK LAST." Below, in a ' +
      'different cut: "the guard did not choose this knife."',
  },
  evp1962: {
    title: 'EVP Reels — 1962 Team',
    body:
      'Labels in shaking handwriting: REEL 4 "THE BUTCHER FINDS VOSS" · REEL 5 "THE BRIDE WEARS MARY’S VOICE" · ' +
      'REEL 6 "SILENCE — DO NOT ANSWER IT". The tape deck still has REEL 6 loaded. It has never been played.',
  },
  estate: {
    title: 'Blackthorn Estate Records',
    body:
      'Sale deeds, parish burials, an inquest. Silas Blackthorn, patriarch, "died of fright," 1783. His daughter ' +
      'Evelyn: no burial record — only a note: "remained." Every subsequent owner adds the same clause to the ' +
      'deed: the east wing may be inherited but never opened.',
  },
  matches: {
    title: 'Fresh Kitchen Matches',
    body:
      'A box of kitchen matches, half-used, struck within the day. Inside the lid, pencil: "Seal III before ' +
      'Vigil. God forgive me, she is still screaming."',
  },
  caretaker_ledger: {
    title: 'The Caretaker’s Lineage',
    body:
      'Set the visitor ledger beside the portrait gallery dates: 1783 Silas · 1849 Abraham · 1908 Thomas · ' +
      '1962 Edmund · present day: E. Blackthorn, caretaker. The family never left. They just stopped signing ' +
      'portraits and started signing invitations.',
  },
  labnotes: {
    title: 'Laboratory Log — Dr. Voss, 1962',
    body:
      '"Pressure beyond the door rises when we fear. It is not haunting, it is husbandry — something is farming ' +
      'us and the seal is the fence. If the fence falls, do not fight what comes. Close the gap. Rite reversed, ' +
      'blood unspent, name spoken last."',
  },
  graffiti: {
    title: 'Cell 7 Wall',
    body:
      'Tally marks for 4,112 days. Under them: "He visits. He brings tea. He asks what the other side sounds ' +
      'like. I tell him: like his mother, calling him to dinner, only wrong."',
  },
  caretaker_tape: {
    title: "The Caretaker's Recording",
    body:
      'His voice, then a woman’s reply through static — patient, loving, and repeating the same three sentences ' +
      'every ninety seconds. You have listened twice. On the third play-through the sentences change. They are ' +
      'instructions for opening the gate. His loved one is long gone; something is wearing her like a coat.',
  },
  epilogue: {
    title: 'The Seventh Notch',
    body:
      'A letter on the garden path, postmarked from nowhere, addressed in your own handwriting: "Six remain. ' +
      'You know what to do. You always have. — H." Around the fountain drain, a fresh notch waits to be cut.',
  },
};

// ---------------------------------------------------------------------------
// Evelyn's memories (revealed via memory objects)
// ---------------------------------------------------------------------------
export const MEMORIES: Record<string, NoteText> = {
  m1: {
    title: 'Memory I — The Patriarch’s Study',
    body:
      'A music box plays itself backward. You stand inside a memory that is not yours: Silas Blackthorn bends ' +
      'over diggings from beneath the foundation — older than the manor, older than the county. "There is a door," ' +
      'he tells his daughter, "and men with patience can learn its hinges." He does not say he intends to sell ' +
      'what is behind it. He says: control.',
  },
  m2: {
    title: 'Memory II — The Interrupted Ritual',
    body:
      'Candles the colour of bone. Three shadows pinned to the walls that are not people yet. Evelyn — sixteen, ' +
      'brave, terrified — throws herself between her father and the circle because the rite demands "a willing ' +
      'name" and her father has written hers. The failure is instantaneous: the gate half-opens, three hang ' +
      'fast in the doorway, and Evelyn is pulled in with her mouth full of everyone’s names. She has held the ' +
      'seal shut with her own hands for two hundred years.',
  },
  m3: {
    title: 'Memory III — The Guard',
    body:
      'A large man named Ambrose takes a beating meant for the girl in the hall. He swears on his sword arm to ' +
      'keep her safe. Satan accepts the oath and twists it: the guard will protect her forever — by killing ' +
      'everyone who ever reaches her. The Butcher remembers being kind.',
  },
  m4: {
    title: 'Memory IV — The King',
    body:
      'Before the manor, before the family: a king with no name binds the gate with a necklace of seven links ' +
      'and his own shadow. His kingdom forgets him; the gate remembers. He cannot tell allies from intruders ' +
      'anymore — only threats, and everything threatens a dead king.',
  },
};

// ---------------------------------------------------------------------------
// Radio script (chapter 4) - authored lines, played sequentially
// ---------------------------------------------------------------------------
export const RADIO_SCRIPT: string[] = [
  '…static… is anyone… the reels said not to answer it…',
  'This is Mary Voss, investigation team, night four. The bride knows my mother’s voice.',
  'Voss is gone. The big man found him in the dark kitchen. We hear the knife on the wall now. Always.',
  'If you are receiving this: do not open any door that calls you by a name you love.',
  'We drew the rite backwards on the chapel floor. Say it backwards. Say our names last.',
  '…the caretaker lets them in. He always lets them in…',
  '[signal lost]',
];

// ---------------------------------------------------------------------------
// Bride whispers / false voices (authored lines only - never real player audio)
// ---------------------------------------------------------------------------
export const BRIDE_WHISPERS: string[] = [
  'Open the door. I’m the one who stayed behind.',
  'It’s so cold in here, and you promised.',
  'Don’t listen to them. Only I tell the truth about the fire.',
  'Your friend is fine. Just open it and see.',
];

export const SATAN_LINES: string[] = [
  'You think closing me helps? Ask your dead where they went.',
  'The seal is a cage for her, not for me. Free me and she rests.',
  'I offered the caretaker the same kindness I offer you: the exact shape of what you want.',
  'Seven doors. I am patient. I have been patient longer than your language.',
];

export const CARETAKER_MONOLOGUE: string[] = [
  'Yes. The invitations were mine. Every one. You were chosen for the ritual’s arithmetic, not its mercy.',
  'My sister walked through this gate in 1999. He says she stands on the other side waiting. I have heard her.',
  'What have I heard? …I have heard her. That is the whole religion of my life.',
  'Show me. Play the tape. If it is truly not her — God help me, play it.',
];
