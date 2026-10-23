// ============================================================================
// THE LAST EXORCISM - Mobile touch controls: left virtual joystick, right-side
// look area, and large touch-friendly action buttons. No keyboard required.
// ============================================================================
import { useRef } from 'react';
import { input } from '../systems/input';
import { useGame } from '../systems/state';

export function MobileControls() {
  const show = useGame((s) => s.settings.mobileControls);
  const flashlightOn = useGame((s) => s.flashlightOn);
  const crouching = useGame((s) => s.crouching);
  const joyRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const lookTouchId = useRef<number | null>(null);
  const lastLook = useRef({ x: 0, y: 0 });
  const joyTouchId = useRef<number | null>(null);

  if (!show) return null;

  // ---- joystick ----
  const onJoyStart = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    joyTouchId.current = e.pointerId;
    onJoyMove(e);
  };
  const onJoyMove = (e: React.PointerEvent) => {
    if (joyTouchId.current !== e.pointerId || !joyRef.current) return;
    const r = joyRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2);
    let dy = (e.clientY - cy) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * 38}px, ${dy * 38}px)`;
    input.setVirtualMove(dx, -dy);
    input.touchSprint = len > 0.92; // push to the rim to sprint
  };
  const onJoyEnd = (e: React.PointerEvent) => {
    if (joyTouchId.current !== e.pointerId) return;
    joyTouchId.current = null;
    input.touchSprint = false;
    input.setVirtualMove(0, 0);
    if (knobRef.current) knobRef.current.style.transform = '';
  };

  // ---- look area ----
  const onLookStart = (e: React.PointerEvent) => {
    lookTouchId.current = e.pointerId;
    lastLook.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onLookMove = (e: React.PointerEvent) => {
    if (lookTouchId.current !== e.pointerId) return;
    input.addTouchLook(e.clientX - lastLook.current.x, e.clientY - lastLook.current.y);
    lastLook.current = { x: e.clientX, y: e.clientY };
  };
  const onLookEnd = (e: React.PointerEvent) => {
    if (lookTouchId.current === e.pointerId) lookTouchId.current = null;
  };

  const btn = (label: string, name: Parameters<typeof input.pressButton>[0], on?: boolean) => (
    <button className={on ? 'on' : ''} onPointerDown={(e) => { e.preventDefault(); input.pressButton(name); }}>
      {label}
    </button>
  );

  return (
    <div className="mobile-layer">
      {/* right half of screen: drag to look */}
      <div
        className="touch-look"
        onPointerDown={onLookStart}
        onPointerMove={onLookMove}
        onPointerUp={onLookEnd}
        onPointerCancel={onLookEnd}
      />
      {/* left virtual joystick */}
      <div ref={joyRef} className="joystick"
        onPointerDown={onJoyStart} onPointerMove={onJoyMove} onPointerUp={onJoyEnd} onPointerCancel={onJoyEnd}>
        <div ref={knobRef} className="knob" />
      </div>
      {/* action buttons */}
      <div className="mbtns">
        {btn('INTERACT', 'interact')}
        {btn('LIGHT', 'flashlight', flashlightOn)}
        {btn('USE', 'use')}
        {btn('CROUCH', 'crouch', crouching)}
        <button onPointerDown={(e) => {
          e.preventDefault();
          input.touchSprint = !input.touchSprint;
          (e.currentTarget as HTMLButtonElement).classList.toggle('on', input.touchSprint);
        }}>SPRINT</button>
        {btn('BAG', 'inventory')}
        {btn('BOOK', 'notebook')}
        {btn('PAUSE', 'pause')}
      </div>
    </div>
  );
}
