import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

// First-person controller: pointer-lock mouse look + WASD/arrows + sprint.
// Movement is resolved through a `resolve(pos)` callback supplied by the game,
// which clamps the player to the current walkable zone and sets ground height.
export class PlayerController {
  constructor(camera, domElement) {
    this.controls = new PointerLockControls(camera, domElement);
    this.object = this.controls.getObject();
    this.keys = Object.create(null);
    this.speed = 6.2;
    this.sprintMult = 1.6;
    this.enabled = true;
    this.resolve = null; // (THREE.Vector3) => void

    this._onKeyDown = (e) => { this.keys[e.code] = true; };
    this._onKeyUp = (e) => { this.keys[e.code] = false; };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
  }

  get locked() { return this.controls.isLocked; }
  lock() { this.controls.lock(); }
  unlock() { this.controls.unlock(); }
  setPosition(x, y, z) { this.object.position.set(x, y, z); }

  // Point the camera toward a world-space target (yaw only).
  lookAt(x, z) {
    const p = this.object.position;
    const yaw = Math.atan2(x - p.x, -(z - p.z));
    // PointerLockControls uses its own euler; nudge via a fake pointer is messy,
    // so we set the object's rotation directly (yaw about Y).
    this.object.rotation.set(0, yaw, 0);
  }

  update(dt) {
    if (!this.enabled) return;
    let fwd = 0, str = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) fwd += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) fwd -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) str += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) str -= 1;

    if (this.controls.isLocked && (fwd || str)) {
      const len = Math.hypot(fwd, str) || 1;
      const sprint = (this.keys['ShiftLeft'] || this.keys['ShiftRight']) ? this.sprintMult : 1;
      const step = this.speed * sprint * dt;
      this.controls.moveForward((fwd / len) * step);
      this.controls.moveRight((str / len) * step);
    }
    if (this.resolve) this.resolve(this.object.position);
  }

  dispose() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }
}
