// ============================================================================
// THE LAST EXORCISM - App root: menu <-> game screens, input attach, settings
// load, autosave on unload.
// ============================================================================
import { useEffect } from 'react';
import './ui/ui.css';
import { useGame, loadSettings, saveCampaign } from './systems/state';
import { input } from './systems/input';
import { Menu } from './ui/Menu';
import { GameScene } from './three/Game';
import {
  HUD, InventoryPanel, NotebookPanel, NoteReader, LibraryPuzzle,
  RadioSequence, DialogueBox, FinalRite, ChapterCard, EndingScreen, PauseMenu,
} from './ui/components';
import { MobileControls } from './ui/MobileControls';

const g = () => useGame.getState();

export default function App() {
  const screen = useGame((s) => s.screen);

  useEffect(() => {
    // load persisted settings once
    const st = loadSettings();
    if (st.mobileControls === false && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)) {
      st.mobileControls = true; // auto-enable touch controls on touch devices
    }
    g().set({ settings: st });
    input.sensitivity = st.sensitivity;
    input.attach(document.body);
    // autosave when leaving
    const bye = () => { if (g().screen === 'game') saveCampaign(); };
    window.addEventListener('pagehide', bye);
    return () => {
      window.removeEventListener('pagehide', bye);
      input.detach();
    };
  }, []);

  return (
    <div className="tle-app">
      {screen === 'menu' && <Menu />}
      {screen !== 'menu' && (
        <>
          <GameScene />
          <HUD />
          <MobileControls />
          <InventoryPanel />
          <NotebookPanel />
          <NoteReader />
          <LibraryPuzzle />
          <RadioSequence />
          <DialogueBox />
          <FinalRite />
          <ChapterCard />
          <PauseMenu />
          {screen === 'ending' && <EndingScreen />}
        </>
      )}
    </div>
  );
}
