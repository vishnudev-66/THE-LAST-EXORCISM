// ============================================================================
// THE LAST EXORCISM - Main menu: single-player / private co-op (2-8) / practice.
// ============================================================================
import { useEffect, useState } from 'react';
import { useGame, hasSave, clearSave } from '../systems/state';
import type { GameMode } from '../systems/state';
import { input } from '../systems/input';
import { audio } from '../systems/audio';
import { net } from '../systems/net';
import { CHAPTERS } from '../data/campaign';
import { startPractice } from '../three/Game';
import type { ChapterId } from '../shared-types';

const g = () => useGame.getState();

export function Menu() {
  const [name, setName] = useState(useGame.getState().playerName);
  const [room, setRoom] = useState('');
  const [showCoop, setShowCoop] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [saveExists, setSaveExists] = useState(false);
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([]);
  const mode: GameMode = useGame((s) => s.mode);
  const connected = useGame((s) => s.connected);

  useEffect(() => {
    hasSave().then(setSaveExists);
    const h = (e: Event) => setRoster((e as CustomEvent).detail);
    window.addEventListener('tle:roster', h);
    return () => window.removeEventListener('tle:roster', h);
  }, []);

  const beginRun = (m: GameMode) => {
    audio.init();
    audio.volumes = { master: g().settings.masterVolume, sfx: g().settings.sfxVolume, music: g().settings.musicVolume };
    audio.applyVolumes();
    input.sensitivity = g().settings.sensitivity;
    g().resetRun();
    g().set({ mode: m, playerName: name || 'Hunter', screen: 'game' });
    if (input.isTouch) g().set({ settings: { ...g().settings, mobileControls: true }, paused: false });
  };

  const continueRun = async () => {
    audio.init();
    const d = await loadSettingsAndSave();
    if (!d) return;
    g().set({ ...d, screen: 'game', mode: 'single', paused: false, spawnToken: g().spawnToken + 1 });
    window.dispatchEvent(new CustomEvent('tle:chapter', { detail: d.chapter }));
  };

  const joinRoom = (privateCode?: string) => {
    const code = (privateCode ?? room).trim().toUpperCase();
    if (!code) return;
    beginRun('coop');
    net.connect();
    net.join(code, name || 'Hunter');
    setRoom(code);
    setShowCoop(false);
  };

  return (
    <div className="menu-bg">
      <div className="menu-card">
        <h1 className="title">THE LAST EXORCISM</h1>
        <p className="tagline">You entered together. One of you died. None of you can leave.</p>

        <input className="tle-input" placeholder="Your name, hunter" value={name} maxLength={16}
          onChange={(e) => setName(e.target.value)} />

        <button className="mbtn" onClick={() => beginRun('single')}>▶ SINGLE-PLAYER CAMPAIGN</button>
        {saveExists && (
          <>
            <button className="mbtn" onClick={continueRun}>⟳ CONTINUE SAVED INVESTIGATION</button>
            <button className="mbtn small danger" onClick={async () => { await clearSave(); setSaveExists(false); }}>delete save</button>
          </>
        )}
        <button className="mbtn" onClick={() => setShowCoop((v) => !v)}>⚑ PRIVATE CO-OP (2–8 PLAYERS)</button>
        {showCoop && (
          <div style={{ border: '1px solid var(--edge)', padding: 14, margin: '8px auto', width: 'min(460px,94%)' }}>
            <p style={{ fontSize: 13, opacity: 0.8 }}>
              The séance server must be running (<code>npm run dev:server</code>). Single-player never needs it.
              {connected ? ' ✓ Connected.' : ' ✗ Not connected yet.'}
            </p>
            <input className="tle-input" placeholder="ROOM CODE (share it with friends)" value={room}
              onChange={(e) => setRoom(e.target.value.toUpperCase())} maxLength={6} />
            <button className="mbtn" onClick={() => joinRoom()}>Join / create private room</button>
            <p style={{ fontSize: 12, opacity: 0.6 }}>
              Each invited player receives the campaign for a different reason — all selected for an unfinished ritual.
              Roster: {roster.map((r) => r.name).join(', ') || '—'}
            </p>
          </div>
        )}
        <button className="mbtn" onClick={() => setShowPractice((v) => !v)}>☾ PRACTICE MODE</button>
        {showPractice && (
          <div style={{ border: '1px solid var(--edge)', padding: 14, margin: '8px auto', width: 'min(460px,94%)', maxHeight: '30vh', overflowY: 'auto', touchAction: 'pan-y' }}>
            {CHAPTERS.map((c) => (
              <button key={c.id} className="mbtn small" onClick={() => { audio.init(); startPractice(c.id as ChapterId); }}>
                CH{c.num} · {c.title}
              </button>
            ))}
          </div>
        )}

        <p style={{ marginTop: 26, fontSize: 12, opacity: 0.55, lineHeight: 1.7 }}>
          PC: WASD · Mouse look · Shift sprint · Ctrl/C crouch · E interact · F flashlight · G equipment · Tab inventory · J notebook · Esc pause.<br />
          Mobile: virtual joystick, drag-to-look and on-screen buttons — no keyboard needed.<br />
          Headphones recommended. Contains flashing imagery (reduced-flashing option in settings).
        </p>
      </div>
    </div>
  );
}

/** helper to load save data at continue */
async function loadSettingsAndSave() {
  const { loadCampaign } = await import('../systems/state');
  const d = await loadCampaign();
  if (!d) { g().showToast('No save found.'); return null; }
  return d;
}
