// LifeUnity Metaverse — 1인칭 플레이어 컨트롤러
// PointerLock 마우스 시점 + WASD 이동 + 모바일 터치(가상 조이스틱/시점 드래그)

import * as THREE from 'three';
import { ROOM, EYE_HEIGHT } from './config.js';

const WALK_SPEED = 2.5;   // m/s
const RUN_SPEED = 4.5;    // m/s (Shift)
const ACCEL = 10.0;       // 가감속 감쇠 계수 (1/s)
const MOUSE_SENS = 0.0022;      // rad / px
const TOUCH_LOOK_SENS = 0.0045; // rad / px
const PITCH_LIMIT = THREE.MathUtils.degToRad(89);
const BOB_AMPLITUDE = 0.03;     // 헤드밥 진폭 (m)
const BOB_FREQ_WALK = 7.5;      // 걷기 헤드밥 각속도 (rad/s)
const JOYSTICK_RADIUS = 60;     // 가상 조이스틱 최대 반경 (px)

export class PlayerController {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.enabled = false;

    // 시점 (Euler YXZ: yaw → pitch)
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.position.set(0, EYE_HEIGHT, 8);

    // 이동 상태
    this.keys = { forward: false, backward: false, left: false, right: false, run: false };
    this.velocity = new THREE.Vector2(0, 0); // 수평 속도 (x, z)
    this.bobPhase = 0;
    this.bobOffset = 0;

    // 터치 상태
    this.moveTouch = null;  // { id, startX, startY, dx, dy }
    this.lookTouch = null;  // { id, lastX, lastY }

    this._bindEvents();
  }

  _bindEvents() {
    // --- Pointer Lock ---
    this._onClick = () => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock?.();
      }
    };
    this.domElement.addEventListener('click', this._onClick);

    this._onMouseMove = (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== this.domElement) return;
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.euler.y -= e.movementX * MOUSE_SENS;
      this.euler.x -= e.movementY * MOUSE_SENS;
      this.euler.x = THREE.MathUtils.clamp(this.euler.x, -PITCH_LIMIT, PITCH_LIMIT);
      this.euler.z = 0;
      this.camera.quaternion.setFromEuler(this.euler);
    };
    document.addEventListener('mousemove', this._onMouseMove);

    // --- 키보드 ---
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return; // 채팅 입력 중
      this._setKey(e.code, true);
    };
    this._onKeyUp = (e) => {
      this._setKey(e.code, false);
    };
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);

    // --- 터치 (모바일) ---
    this._onTouchStart = (e) => {
      if (!this.enabled) return;
      for (const touch of e.changedTouches) {
        const half = window.innerWidth * 0.5;
        if (touch.clientX < half && this.moveTouch === null) {
          this.moveTouch = {
            id: touch.identifier,
            startX: touch.clientX,
            startY: touch.clientY,
            dx: 0,
            dy: 0,
          };
        } else if (touch.clientX >= half && this.lookTouch === null) {
          this.lookTouch = {
            id: touch.identifier,
            lastX: touch.clientX,
            lastY: touch.clientY,
          };
        }
      }
      if (e.cancelable) e.preventDefault();
    };

    this._onTouchMove = (e) => {
      if (!this.enabled) return;
      for (const touch of e.changedTouches) {
        if (this.moveTouch && touch.identifier === this.moveTouch.id) {
          const dx = touch.clientX - this.moveTouch.startX;
          const dy = touch.clientY - this.moveTouch.startY;
          const len = Math.hypot(dx, dy);
          const scale = len > JOYSTICK_RADIUS ? JOYSTICK_RADIUS / len : 1;
          this.moveTouch.dx = (dx * scale) / JOYSTICK_RADIUS; // -1 ~ 1
          this.moveTouch.dy = (dy * scale) / JOYSTICK_RADIUS;
        } else if (this.lookTouch && touch.identifier === this.lookTouch.id) {
          const mx = touch.clientX - this.lookTouch.lastX;
          const my = touch.clientY - this.lookTouch.lastY;
          this.lookTouch.lastX = touch.clientX;
          this.lookTouch.lastY = touch.clientY;
          this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
          this.euler.y -= mx * TOUCH_LOOK_SENS;
          this.euler.x -= my * TOUCH_LOOK_SENS;
          this.euler.x = THREE.MathUtils.clamp(this.euler.x, -PITCH_LIMIT, PITCH_LIMIT);
          this.euler.z = 0;
          this.camera.quaternion.setFromEuler(this.euler);
        }
      }
      if (e.cancelable) e.preventDefault();
    };

    this._onTouchEnd = (e) => {
      for (const touch of e.changedTouches) {
        if (this.moveTouch && touch.identifier === this.moveTouch.id) {
          this.moveTouch = null;
        } else if (this.lookTouch && touch.identifier === this.lookTouch.id) {
          this.lookTouch = null;
        }
      }
    };

    this.domElement.addEventListener('touchstart', this._onTouchStart, { passive: false });
    this.domElement.addEventListener('touchmove', this._onTouchMove, { passive: false });
    this.domElement.addEventListener('touchend', this._onTouchEnd);
    this.domElement.addEventListener('touchcancel', this._onTouchEnd);
  }

  _setKey(code, pressed) {
    switch (code) {
      case 'KeyW': case 'ArrowUp':    this.keys.forward = pressed; break;
      case 'KeyS': case 'ArrowDown':  this.keys.backward = pressed; break;
      case 'KeyA': case 'ArrowLeft':  this.keys.left = pressed; break;
      case 'KeyD': case 'ArrowRight': this.keys.right = pressed; break;
      case 'ShiftLeft': case 'ShiftRight': this.keys.run = pressed; break;
    }
  }

  update(delta) {
    if (!this.enabled) return;
    delta = Math.min(delta, 0.1); // 탭 전환 등으로 인한 급점프 방지

    // --- 입력 → 로컬 이동 방향 (x: 좌우, z: 앞뒤. 앞 = -1) ---
    let inputX = 0;
    let inputZ = 0;
    if (this.keys.forward) inputZ -= 1;
    if (this.keys.backward) inputZ += 1;
    if (this.keys.left) inputX -= 1;
    if (this.keys.right) inputX += 1;

    let speed = this.keys.run ? RUN_SPEED : WALK_SPEED;

    // 가상 조이스틱 (아날로그 입력, 키보드 입력이 없을 때)
    if (this.moveTouch && inputX === 0 && inputZ === 0) {
      inputX = this.moveTouch.dx;
      inputZ = this.moveTouch.dy;
      const mag = Math.hypot(inputX, inputZ);
      speed = WALK_SPEED + (RUN_SPEED - WALK_SPEED) * Math.min(1, Math.max(0, (mag - 0.85) / 0.15));
    } else {
      const len = Math.hypot(inputX, inputZ);
      if (len > 1) { inputX /= len; inputZ /= len; }
    }

    // --- 카메라 yaw 기준 월드 수평 방향으로 변환 ---
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    const yaw = this.euler.y;
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // 로컬 (inputX, inputZ) → 월드: forward = (-sin, -cos), right = (cos, -sin)
    // 앞(inputZ=-1)일 때 forward 방향이 되도록: world = inputX*right + inputZ*(+Z축 회전)
    const targetVX = (inputX * cos + inputZ * sin) * speed;
    const targetVZ = (-inputX * sin + inputZ * cos) * speed;

    // --- 부드러운 가감속 (지수 감쇠) ---
    const damp = 1 - Math.exp(-ACCEL * delta);
    this.velocity.x += (targetVX - this.velocity.x) * damp;
    this.velocity.y += (targetVZ - this.velocity.y) * damp; // Vector2.y = 월드 z 속도

    // --- 위치 갱신 + BOUNDS 클램프 ---
    const pos = this.camera.position;
    pos.x += this.velocity.x * delta;
    pos.z += this.velocity.y * delta;
    pos.x = THREE.MathUtils.clamp(pos.x, -ROOM.bound, ROOM.bound);
    pos.z = THREE.MathUtils.clamp(pos.z, -ROOM.bound, ROOM.bound);

    // --- 헤드밥 (걷는 동안만, 사인파 진폭 0.03) ---
    const horizSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    if (horizSpeed > 0.3) {
      this.bobPhase += delta * BOB_FREQ_WALK * (horizSpeed / WALK_SPEED);
      const intensity = Math.min(1, horizSpeed / WALK_SPEED);
      this.bobOffset = Math.sin(this.bobPhase) * BOB_AMPLITUDE * intensity;
    } else {
      // 정지 시 부드럽게 0으로 복귀
      this.bobOffset += (0 - this.bobOffset) * damp;
      if (Math.abs(this.bobOffset) < 0.0005) {
        this.bobOffset = 0;
        this.bobPhase = 0;
      }
    }
    pos.y = EYE_HEIGHT + this.bobOffset;
  }

  getState() {
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    return {
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
      ry: this.euler.y,
    };
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
    this.keys.forward = this.keys.backward = this.keys.left = this.keys.right = this.keys.run = false;
    this.velocity.set(0, 0);
    this.moveTouch = null;
    this.lookTouch = null;
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock?.();
    }
  }

  dispose() {
    this.disable();
    this.domElement.removeEventListener('click', this._onClick);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
    this.domElement.removeEventListener('touchstart', this._onTouchStart);
    this.domElement.removeEventListener('touchmove', this._onTouchMove);
    this.domElement.removeEventListener('touchend', this._onTouchEnd);
    this.domElement.removeEventListener('touchcancel', this._onTouchEnd);
  }
}
