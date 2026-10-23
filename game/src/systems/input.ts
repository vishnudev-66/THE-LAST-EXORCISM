// ============================================================================
// THE LAST EXORCISM - Input system: keyboard + mouse-look (PC) and virtual
// joystick / touch look (mobile). Touch-friendly; never requires a keyboard.
// ============================================================================
import * as THREE from 'three';

export interface InputState {
  move: THREE.Vector2;        // x: strafe, y: forward  (-1..1)
  lookDelta: THREE.Vector2;   // consumed each frame by camera
  sprint: boolean;
  crouchToggle: boolean;      // edge-triggered
  interactEdge: boolean;      // edge-triggered (E / interact button)
  flashlightEdge: boolean;    // edge-triggered (F)
  useEdge: boolean;           // G / use-equipment button
  inventoryEdge: boolean;     // Tab
  notebookEdge: boolean;      // J
  pauseEdge: boolean;         // Esc
  wheelSlotDelta: number;     // equipment slot scroll
}

class InputManager {
  state: InputState = {
    move: new THREE.Vector2(),
    lookDelta: new THREE.Vector2(),
    sprint: false,
    crouchToggle: false,
    interactEdge: false,
    flashlightEdge: false,
    useEdge: false,
    inventoryEdge: false,
    notebookEdge: false,
    pauseEdge: false,
    wheelSlotDelta: 0,
  };

  keys = new Set<string>();
  pointerLocked = false;
  isTouch = false;
  sensitivity = 1;

  private el: HTMLElement | null = null;
  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    this.state.lookDelta.x += e.movementX * 0.0022 * this.sensitivity;
    this.state.lookDelta.y += e.movementY * 0.0022 * this.sensitivity;
  };
  private onKeyDown = (e: KeyboardEvent) => {
    if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
    if (this.keys.has(e.code)) return;
    this.keys.add(e.code);
    switch (e.code) {
      case 'KeyE': this.state.interactEdge = true; break;
      case 'KeyF': this.state.flashlightEdge = true; break;
      case 'KeyG': this.state.useEdge = true; break;
      case 'Tab': this.state.inventoryEdge = true; break;
      case 'KeyJ': this.state.notebookEdge = true; break;
      case 'Escape': this.state.pauseEdge = true; break;
      case 'ControlLeft': case 'KeyC': this.state.crouchToggle = true; break;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
  private onWheel = (e: WheelEvent) => {
    this.state.wheelSlotDelta += Math.sign(e.deltaY);
  };
  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.el;
  };

  attach(el: HTMLElement) {
    this.el = el;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  detach() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    if (document.pointerLockElement) document.exitPointerLock();
    this.el = null;
  }

  requestLock() {
    if (this.isTouch) return;
    this.el?.requestPointerLock?.();
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Recompute movement vector from keys (touch joystick writes directly). */
  pollKeys() {
    const m = this.state.move;
    let x = 0, y = 0;
    if (this.keys.has('KeyW')) y += 1;
    if (this.keys.has('KeyS')) y -= 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    // On touch, joystick sets these via setVirtualMove; only override when keys pressed
    if (x !== 0 || y !== 0 || !this.touchActive) {
      m.set(x, y);
    }
    this.state.sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint;
  }

  touchActive = false;
  touchSprint = false;

  setVirtualMove(x: number, y: number) {
    this.touchActive = true;
    this.state.move.set(x, y);
  }

  addTouchLook(dx: number, dy: number) {
    this.state.lookDelta.x += dx * 0.0038 * this.sensitivity;
    this.state.lookDelta.y += dy * 0.0038 * this.sensitivity;
  }

  pressButton(name: 'interact' | 'flashlight' | 'use' | 'inventory' | 'notebook' | 'pause' | 'crouch') {
    switch (name) {
      case 'interact': this.state.interactEdge = true; break;
      case 'flashlight': this.state.flashlightEdge = true; break;
      case 'use': this.state.useEdge = true; break;
      case 'inventory': this.state.inventoryEdge = true; break;
      case 'notebook': this.state.notebookEdge = true; break;
      case 'pause': this.state.pauseEdge = true; break;
      case 'crouch': this.state.crouchToggle = true; break;
    }
  }

  /** Consume per-frame data; call at end of frame. */
  endFrame() {
    this.state.lookDelta.set(0, 0);
    this.state.interactEdge = false;
    this.state.flashlightEdge = false;
    this.state.useEdge = false;
    this.state.inventoryEdge = false;
    this.state.notebookEdge = false;
    this.state.pauseEdge = false;
    this.state.crouchToggle = false;
    this.state.wheelSlotDelta = 0;
  }
}

export const input = new InputManager();
