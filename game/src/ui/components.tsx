// ============================================================================
// THE LAST EXORCISM - UI components: HUD, inventory, notebook, note reader,
// pause/settings, library puzzle dial, radio sequence, dialogue boxes,
// chapter cards, ending screen. All elements are touch-friendly.
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { useGame, saveCampaign, loadCampaign, DEFAULT_SETTINGS, persistSettings } from '../systems/state';
import type { Settings } from '../systems/state';
import { CHAPTERS, chapterById, computeEnding, ENDING_TEXT, advanceChapter } from '../data/campaign';
import { RADIO_SCRIPT, CARETAKER_MONOLOGUE, SATAN_LINES } from '../data/lore';
import { audio } from '../systems/audio';
import { solveLibraryPuzzle, spiritReturn, caretakerDecision, finalChoice, completeRite, useEquipment } from '../systems/interact';
import { pickNear } from '../systems/interact';
import { playerPos } from '../three/Player';
import { input } from '../systems/input';
import type { NoteEntry } from '../systems/state';

const g = () => useGame.getState();

export function HUD() {
  const s = useGame();
  const [prompt, setPrompt] = useState('');
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (!g().paused && g().screen === 'game') {
        const p = pickNear(playerPos, 0, 2.6);
        setPrompt(p.label ? `[E] ${p.label}` : '');
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const ch = chapterById(s.chapter);
  return (
    <div className="hud" style={{ ['--tsz' as never]: s.settings.textSize }}>
      {!input.isTouch && <div className="crosshair" />}
      {prompt && <div className="interact-prompt">{prompt}</div>}
      <div className="chapter-hud">
        <div className="ch-title">CH {ch.num} · {ch.title.toUpperCase()}</div>
        {ch.objectives.map((o) => (
          <div key={o.id} className={`obj${s.objectivesDone.includes(o.id) ? ' done' : ''}`}>• {o.text}</div>
        ))}
      </div>
      <div className="seal-hud">
        SEAL INTEGRITY {Math.round(s.sealIntegrity)}%<br />
        {s.isSpirit ? <span style={{ color: 'var(--ghost)' }}>SPIRIT-TOUCHED</span> : null}
      </div>
      <div className="vitals">
        <div className="bar"><div className="lbl">HEALTH</div><div className="track"><div className="fill hp" style={{ width: `${s.health}%` }} /></div></div>
        <div className="bar"><div className="lbl">SANITY</div><div className="track"><div className="fill sn" style={{ width: `${s.sanity}%` }} /></div></div>
      </div>
      {s.inventory.length > 0 && (
        <div className="slot-hud">
          {s.inventory[Math.min(s.selectedSlot, s.inventory.length - 1)]?.name ?? '—'}
          <span style={{ opacity: 0.6 }}> ({input.isTouch ? 'USE btn' : 'G'})</span>
        </div>
      )}
      {s.toast && <div className="toast">{s.toast}</div>}
      {s.hint && <div className="hint-line">{s.hint}</div>}
      {s.isSpirit && <div className="spirit-vignette" />}
      {s.sanity < 35 && !s.settings.reducedFlashing && <div className="low-sanity" />}
    </div>
  );
}

export function InventoryPanel() {
  const s = useGame();
  if (!s.showInventory) return null;
  return (
    <div className="overlay" onClick={() => g().set({ showInventory: false })}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ ['--tsz' as never]: s.settings.textSize }}>
        <span className="x-close" onClick={() => g().set({ showInventory: false })}>✕</span>
        <h2>EQUIPMENT & INVENTORY</h2>
        {s.inventory.length === 0 && <p style={{ opacity: 0.7 }}>Empty pockets. The manor has not trusted you with anything yet.</p>}
        {s.inventory.map((it, i) => (
          <div
            key={it.id}
            className={`item-row${i === s.selectedSlot ? ' sel' : ''}`}
            onClick={() => {
              g().set({ selectedSlot: i });
              if (it.usable && input.isTouch) {
                useEquipment(null, playerPos.clone());
              }
            }}
          >
            <span>{it.name} {it.qty > 1 ? `×${it.qty}` : ''}</span>
            <span style={{ opacity: 0.7 }}>{it.desc}</span>
          </div>
        ))}
        <p style={{ opacity: 0.55, fontSize: 12 }}>{input.isTouch ? 'Tap a usable item to use it.' : 'Scroll wheel to switch slot · G to use · Tab to close.'}</p>
      </div>
    </div>
  );
}

export function NotebookPanel() {
  const s = useGame();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!s.showNotebook) return null;
  const open = s.notes.find((n) => n.id === openId);
  return (
    <div className="overlay" onClick={() => g().set({ showNotebook: false })}>
      <div className="panel" onClick={(e) => e.stopPropagation()} style={{ ['--tsz' as never]: s.settings.textSize }}>
        <span className="x-close" onClick={() => g().set({ showNotebook: false })}>✕</span>
        <h2>INVESTIGATION NOTEBOOK</h2>
        {open ? (
          <>
            <h3 style={{ color: 'var(--bone)' }}>{open.title} <small style={{ opacity: 0.6 }}>[{open.kind}]</small></h3>
            <div className="note-body">{open.body}</div>
            <button className="mbtn small" onClick={() => setOpenId(null)}>← back to index</button>
          </>
        ) : (
          <>
            {s.memoriesFound.length > 0 && <p style={{ color: 'var(--ghost)', fontStyle: 'italic' }}>Memories recovered: {s.memoriesFound.length}/4</p>}
            {s.notes.length === 0 && <p style={{ opacity: 0.7 }}>No evidence yet. Read everything. Trust little.</p>}
            {s.notes.map((n: NoteEntry) => (
              <div key={n.id} className="note-entry" onClick={() => setOpenId(n.id)}>
                ▸ {n.title} <small style={{ opacity: 0.55 }}>({n.kind})</small>
              </div>
            ))}
            {s.isSpirit && (
              <button className="mbtn" onClick={() => { spiritReturn(); g().set({ showNotebook: false }); }}>
                Return from the thin side to your body
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Reader shown when picking up a note (auto-open), tap/click or Enter to dismiss */
export function NoteReader() {
  const [note, setNote] = useState<{ title: string; body: string } | null>(null);
  useEffect(() => {
    const h = (e: Event) => setNote((e as CustomEvent).detail);
    window.addEventListener('tle:openNote', h);
    return () => window.removeEventListener('tle:openNote', h);
  }, []);
  if (!note) return null;
  return (
    <div className="overlay" onClick={() => setNote(null)}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>{note.title}</h2>
        <div className="note-body">{note.body}</div>
        <button className="mbtn small" onClick={() => setNote(null)}>Close (tap anywhere)</button>
      </div>
    </div>
  );
}

/** Library pattern puzzle: VII · III · I · IV — four touch dials */
export function LibraryPuzzle() {
  const [show, setShow] = useState(false);
  const [vals, setVals] = useState([1, 1, 1, 1]);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  useEffect(() => {
    const h = () => setShow(true);
    window.addEventListener('tle:puzzle', h);
    return () => window.removeEventListener('tle:puzzle', h);
  }, []);
  if (!show) return null;
  const target = [7, 3, 1, 4];
  const trySolve = () => {
    if (vals.every((v, i) => v === target[i])) {
      solveLibraryPuzzle();
      setShow(false);
    } else {
      audio.door(true);
      g().showToast('The shelf clicks disapprovingly.');
    }
  };
  return (
    <div className="overlay">
      <div className="panel dial">
        <span className="x-close" onClick={() => setShow(false)}>✕</span>
        <h2>THE LEDGER PATTERN</h2>
        <p style={{ opacity: 0.8 }}>Four books must be pushed out by the right number of fingers. The ledger taught you: gates, seals, child, warned.</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
          {vals.map((v, i) => (
            <div key={i}>
              <button onClick={() => setVals((p) => p.map((x, j) => (j === i ? ((x + 5) % 7) + 1 : x)))}>−</button>
              <div className="num">{ROMAN[v - 1]}</div>
              <button onClick={() => setVals((p) => p.map((x, j) => (j === i ? (x % 7) + 1 : x)))}>+</button>
            </div>
          ))}
        </div>
        <button className="mbtn" onClick={trySolve}>Push the last book in</button>
      </div>
    </div>
  );
}

/** Chapter 4 radio playthrough: authored lines read aloud over static */
export function RadioSequence() {
  const [show, setShow] = useState(false);
  const idxRef = useRef(0);
  useEffect(() => {
    const h = () => { setShow(true); idxRef.current = 0; step(); };
    const step = () => {
      const i = idxRef.current;
      audio.radioStatic(1.4);
      const delay = 1900;
      setTimeout(() => {
        if (i < RADIO_SCRIPT.length) {
          audio.speak(RADIO_SCRIPT[i], { pitch: 0.5, rate: 0.9 });
          idxRef.current = i + 1;
          step();
        } else {
          import('../systems/interact').then(({ radioFinished }) => radioFinished());
          setShow(false);
        }
      }, delay);
    };
    window.addEventListener('tle:radio', h);
    return () => window.removeEventListener('tle:radio', h);
  }, []);
  if (!show) return null;
  return (
    <div className="dialogue">
      <div className="who">SHORTWAVE — UNKNOWN STATION, DATED 1962</div>
      <div className="line">…{RADIO_SCRIPT[Math.min(idxRef.current, RADIO_SCRIPT.length - 1)]}</div>
      <div style={{ opacity: 0.6, fontSize: 12 }}>Listening… (stay near the radio)</div>
    </div>
  );
}

/** Caretaker / Satan dialogues with decisions */
export function DialogueBox() {
  const [dlg, setDlg] = useState<{ who: 'caretaker' | 'satan'; line: number } | null>(null);
  useEffect(() => {
    const h = (e: Event) => setDlg({ who: (e as CustomEvent).detail.who, line: 0 });
    window.addEventListener('tle:dialogue', h);
    return () => window.removeEventListener('tle:dialogue', h);
  }, []);
  useEffect(() => {
    if (!dlg) return;
    const script = dlg.who === 'caretaker' ? CARETAKER_MONOLOGUE : SATAN_LINES;
    if (dlg.line < script.length) {
      audio.speak(script[dlg.line], { pitch: dlg.who === 'satan' ? 0.15 : 0.6, rate: 0.8 });
    }
  }, [dlg]);
  if (!dlg) return null;
  const script = dlg.who === 'caretaker' ? CARETAKER_MONOLOGUE : SATAN_LINES;
  const done = dlg.line >= script.length - 1;
  return (
    <div className="dialogue">
      <div className="who">{dlg.who === 'caretaker' ? 'THE CARETAKER' : 'BEYOND THE GATE'}</div>
      <div className="line">“{script[Math.min(dlg.line, script.length - 1)]}”</div>
      <div className="choices">
        {!done ? (
          <button onClick={() => setDlg({ ...dlg, line: dlg.line + 1 })}>Listen further ▸</button>
        ) : dlg.who === 'caretaker' ? (
          g().notes.some((n) => n.id === 'caretaker_tape') ? (
            <>
              <button onClick={() => { caretakerDecision('expose'); setDlg(null); }}>EXPOSE the deception — play the tape a third time</button>
              <button onClick={() => { caretakerDecision('confront'); setDlg(null); }}>CONFRONT him at the winch</button>
              <button onClick={() => { caretakerDecision('persuade'); setDlg(null); }}>PERSUADE him to reverse the ritual</button>
              <button onClick={() => { caretakerDecision('pact'); setDlg(null); }}>ACCEPT the pact</button>
            </>
          ) : (
            <button onClick={() => setDlg(null)}>You have no evidence yet. Find his recording. ▸</button>
          )
        ) : (
          g().flags.charging || g().flags.circleBuilt ? (
            <>
              <button onClick={() => { finalChoice('close'); setDlg(null); }}>REFUSE and finish the reversed rite</button>
              <button onClick={() => { finalChoice('sacrifice'); setDlg(null); }}>Offer the seal a willing keeper (Evelyn)</button>
              <button onClick={() => { finalChoice('flee'); setDlg(null); }}>BREAK the circle and run</button>
            </>
          ) : (
            <button onClick={() => setDlg(null)}>Reconstruct the ritual first. He is right about that much. ▸</button>
          )
        )}
      </div>
    </div>
  );
}

/** Final rite minigame: hold-the-words sequence (tap in order; touch friendly) */
export function FinalRite() {
  const [show, setShow] = useState(false);
  const WORDS = ['neahc', 'drow', 'emen', 'taew', 'tsrif']; // "reverse rite" syllables
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const h = () => { setShow(true); setIdx(0); };
    window.addEventListener('tle:finalRite', h);
    return () => window.removeEventListener('tle:finalRite', h);
  }, []);
  if (!show) return null;
  return (
    <div className="overlay">
      <div className="panel dial">
        <h2>THE REVERSED RITE</h2>
        <p style={{ opacity: 0.8 }}>Speak the founding words backward while the gate pushes against them. Tap each word as it glows.</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {WORDS.map((w, i) => (
            <button
              key={w}
              className="mbtn small"
              style={{ borderColor: i === idx ? 'var(--amber)' : undefined, color: i < idx ? 'var(--ghost)' : undefined }}
              onClick={() => {
                if (i === idx) {
                  audio.page();
                  const ni = idx + 1;
                  setIdx(ni);
                  if (ni >= WORDS.length) {
                    completeRite();
                    setShow(false);
                  }
                } else {
                  audio.stinger();
                  g().set({ sanity: Math.max(0, g().sanity - 6) });
                  setIdx(0);
                }
              }}
            >
              {w}
            </button>
          ))}
        </div>
        <button className="mbtn small danger" onClick={() => setShow(false)}>Step out of the circle</button>
      </div>
    </div>
  );
}

/** Chapter intro card */
export function ChapterCard() {
  const [card, setCard] = useState<{ num: number; title: string; brief: string } | null>(null);
  useEffect(() => {
    const showCh = (id: string) => {
      const c = CHAPTERS.find((x) => x.id === id)!;
      setCard({ num: c.num, title: c.title, brief: c.brief });
    };
    const h = (e: Event) => showCh((e as CustomEvent).detail);
    const adv = () => {
      const st = g();
      const cur = CHAPTERS.find((c) => c.id === st.chapter)!;
      if (cur.next) advanceChapter();
      else if (st.flags.pact || st.flags.closedGate || st.flags.evelynSacrifice || st.flags.escapeOnly) {
        st.set({ screen: 'ending', ending: computeEnding() });
      }
      const after = CHAPTERS.find((c) => c.id === g().chapter)!;
      if (after.num === 15) showCh('ch15_seven_gates');
    };
    window.addEventListener('tle:chapter', h);
    window.addEventListener('tle:advance', adv);
    return () => {
      window.removeEventListener('tle:chapter', h);
      window.removeEventListener('tle:advance', adv);
    };
  }, []);
  if (!card) return null;
  return (
    <div className="chapter-card" onClick={() => setCard(null)}>
      <div className="chapter-inner">
        <div className="num">CHAPTER {card.num}</div>
        <h1>{card.title.toUpperCase()}</h1>
        <p>{card.brief}</p>
        <button className="mbtn">Begin ▸ (tap anywhere)</button>
      </div>
    </div>
  );
}

export function EndingScreen() {
  const ending = useGame((s) => s.ending);
  if (!ending) return null;
  const t = ENDING_TEXT[ending];
  return (
    <div className="ending-screen">
      <div>
        <div className="num" style={{ letterSpacing: '0.3em', color: '#666' }}>THE LAST EXORCISM</div>
        <h1>{t.title}</h1>
        <p>{t.body}</p>
        <p style={{ opacity: 0.6, fontSize: 13 }}>Seal integrity at the end: {Math.round(useGame.getState().sealIntegrity)}% · Deaths: {useGame.getState().deaths}</p>
        <button className="mbtn" onClick={() => { g().resetRun(); g().set({ screen: 'menu', ending: null }); }}>Return to the gate (new cycle)</button>
      </div>
    </div>
  );
}

/** Pause menu with settings */
export function PauseMenu() {
  const s = useGame();
  if (!s.paused) return null;
  const setSt = (patch: Partial<Settings>) => {
    const ns = { ...g().settings, ...patch };
    g().set({ settings: ns });
    persistSettings(ns);
    audio.volumes = { master: ns.masterVolume, sfx: ns.sfxVolume, music: ns.musicVolume };
    audio.applyVolumes();
    input.sensitivity = ns.sensitivity;
  };
  const row = (label: string, key: keyof Settings, min: number, max: number, stepv = 0.05) => (
    <div className="settings-row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={stepv} value={s.settings[key] as number}
        onChange={(e) => setSt({ [key]: parseFloat(e.target.value) } as Partial<Settings>)} />
    </div>
  );
  return (
    <div className="overlay">
      <div className="panel" style={{ ['--tsz' as never]: s.settings.textSize }}>
        <h2>PAUSED — SETTINGS</h2>
        <div className="settings-row">
          <span>Graphics quality</span>
          <span className="qbtns">
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((q) => (
              <button key={q} className={s.settings.quality === q ? 'sel' : ''} onClick={() => setSt({ quality: q })}>{q}</button>
            ))}
          </span>
        </div>
        {row('Look sensitivity', 'sensitivity', 0.2, 3)}
        {row('Brightness', 'brightness', 0.5, 1.8)}
        {row('Master volume', 'masterVolume', 0, 1)}
        {row('Sound effects', 'sfxVolume', 0, 1)}
        {row('Ambience/music', 'musicVolume', 0, 1)}
        {row('Text size', 'textSize', 0.85, 1.6)}
        <div className="settings-row">
          <span>Camera shake</span>
          <button className="mbtn small" onClick={() => setSt({ cameraShake: !s.settings.cameraShake })}>{s.settings.cameraShake ? 'ON' : 'OFF'}</button>
        </div>
        <div className="settings-row">
          <span>Reduced flashing</span>
          <button className="mbtn small" onClick={() => setSt({ reducedFlashing: !s.settings.reducedFlashing })}>{s.settings.reducedFlashing ? 'ON' : 'OFF'}</button>
        </div>
        <button className="mbtn" onClick={() => { g().set({ paused: false }); input.requestLock(); }}>Resume</button>
        <button className="mbtn" onClick={() => { saveCampaign(); g().showToast('Campaign saved locally (IndexedDB).'); }}>Save campaign</button>
        <button className="mbtn" onClick={async () => {
          const d = await loadCampaign();
          if (d) { g().set({ ...d, paused: false, screen: 'game', spawnToken: g().spawnToken + 1 }); g().showToast('Campaign loaded.'); }
          else g().showToast('No local save found.');
        }}>Load campaign</button>
        <button className="mbtn danger" onClick={() => { g().set({ screen: 'menu', paused: false }); }}>Abandon to main menu</button>
        <p style={{ opacity: 0.5, fontSize: 12 }}>
          PC: WASD move · Mouse look · Shift sprint · Ctrl/C crouch · E interact · F flashlight · G use equipment ·
          Tab inventory · J notebook · Esc pause. Mobile: joystick + buttons on screen.
        </p>
      </div>
    </div>
  );
}
