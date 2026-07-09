// LifeUnity Metaverse — 1인칭 플레이어 컨트롤러
// PointerLock 마우스 시점 + WASD 이동 + 모바일 터치(가상 조이스틱/시점 드래그)
// 다층 미술관 수직 이동: BUILDING(config.js)의 층/슬래브 개구부/계단 밴드를 소비해
// 실물 지오메트리(계단·난간·보이드) 없이도 지면 높이와 추락/관통을 물리적으로 해석한다.

import * as THREE from 'three';
import { ROOM, EYE_HEIGHT, BUILDING } from './config.js';

const WALK_SPEED = 2.5;   // m/s
const RUN_SPEED = 4.5;    // m/s (Shift)
const ACCEL = 10.0;       // 가감속 감쇠 계수 (1/s)
const MOUSE_SENS = 0.0022;      // rad / px
const TOUCH_LOOK_SENS = 0.0045; // rad / px
const PITCH_LIMIT = THREE.MathUtils.degToRad(89);
const BOB_AMPLITUDE = 0.03;     // 헤드밥 진폭 (m)
const BOB_FREQ_WALK = 7.5;      // 걷기 헤드밥 각속도 (rad/s)
const JOYSTICK_RADIUS = 60;     // 가상 조이스틱 최대 반경 (px)

// --- 수직 이동 해석 상수 ---
const WALL_MARGIN = 0.45;   // 건물 풋프린트 벽 안쪽 여유(카메라가 벽면에 파고들지 않도록)
const STEP_TOLERANCE = 0.65; // 프레임당 허용 고저차(더 크면 이동 취소 = 난간/추락 방지)
const GROUND_LERP_RATE = 12; // 지면 y 추종 지수 보간 계수 (계단이 매끄러운 경사로 느껴짐)

// 지정 지점(x, z)이 계단 밴드 안이면 해당 지점의 계단 경사면 y를 반환, 아니면 null.
function stairGroundAt(x, z) {
  for (const s of BUILDING.stairs) {
    const xMin = Math.min(s.x0, s.x1), xMax = Math.max(s.x0, s.x1);
    if (x < xMin || x > xMax) continue;
    const zMin = Math.min(s.z0, s.z1), zMax = Math.max(s.z0, s.z1);
    if (z < zMin || z > zMax) continue;
    const t = THREE.MathUtils.clamp((z - s.z0) / (s.z1 - s.z0), 0, 1);
    return s.yFrom + t * (s.yTo - s.yFrom);
  }
  return null;
}

function insideRect(rect, x, z) {
  return x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1;
}

function insideFootprint(x, z) {
  return x >= BUILDING.minX && x <= BUILDING.maxX && z >= BUILDING.minZ && z <= BUILDING.maxZ;
}

// (x, z) 지점에서 "서 있을 수 있는" 모든 지면 후보 y값을 모은다:
// - 계단 밴드 위라면 그 경사면 높이
// - 건물 풋프린트 안이라면, 그 층 slabHoles(개구부) 밖인 각 층의 슬래브 상면
// - 풋프린트 밖(실외)이라면 지반 레벨(y=0)
function groundCandidatesAt(x, z) {
  const candidates = [];

  const stairY = stairGroundAt(x, z);
  if (stairY !== null) candidates.push(stairY);

  if (insideFootprint(x, z)) {
    for (const floor of BUILDING.floors) {
      const holes = BUILDING.slabHoles[floor.id] || [];
      let inHole = false;
      for (const h of holes) {
        if (insideRect(h, x, z)) { inHole = true; break; }
      }
      if (!inHole) candidates.push(floor.y);
    }
  } else {
    candidates.push(0); // 실외 지반
  }

  return candidates;
}

// 후보 중 "현재 지면 + STEP_TOLERANCE"를 넘지 않는 가장 높은 값을 고른다.
// 후보가 없거나, 선택된 값이 현재 지면보다 STEP_TOLERANCE 이상 낮으면(=추락/관통) null.
function resolveGround(x, z, currentGroundY) {
  const candidates = groundCandidatesAt(x, z);
  let best = null;
  for (const c of candidates) {
    if (c <= currentGroundY + STEP_TOLERANCE && (best === null || c > best)) best = c;
  }
  if (best === null) return null;
  if (currentGroundY - best > STEP_TOLERANCE) return null;
  return best;
}

// 건물 풋프린트를 벽으로 취급해 관통을 막는다. 남측(맥스Z)은 1F 커튼월 입구이므로 개방—
// 남측을 통한 실제 층 이동 가능 여부는 위의 높이 해석(resolveGround)이 자연히 걸러준다
// (1F만 실외 지반과 높이가 일치해 통과되고, B1/2F/옥상은 고저차로 자동 차단됨).
function clampFootprintWalls(nx, nz) {
  let x = nx;
  let z = nz;
  // 동/서벽: 건물 깊이(Z) 대역 안에서는 X를 풋프린트 안쪽으로 제한
  if (nz > BUILDING.minZ - WALL_MARGIN && nz < BUILDING.maxZ + WALL_MARGIN) {
    x = THREE.MathUtils.clamp(nx, BUILDING.minX + WALL_MARGIN, BUILDING.maxX - WALL_MARGIN);
  }
  // 북벽: 건물 폭(X) 대역 안에서는 북쪽 경계만 제한 (남쪽은 입구이므로 열어 둔다)
  if (nx > BUILDING.minX - WALL_MARGIN && nx < BUILDING.maxX + WALL_MARGIN) {
    z = Math.max(nz, BUILDING.minZ + WALL_MARGIN);
  }
  return { x, z };
}

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

    // 수직 이동(층/계단) 상태 — groundY = 발이 딛고 선 지면의 y (카메라 y = groundY + EYE_HEIGHT + bob)
    this.groundY = this.camera.position.y - EYE_HEIGHT;

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

  // 제안된 (nx, nz)를 풋프린트 벽 충돌 → 지면 높이 해석까지 거쳐 확정한다.
  // 성공 시 { x, z, y } 반환, 실패(벽 관통/추락) 시 null.
  _tryMove(nx, nz) {
    const clamped = clampFootprintWalls(nx, nz);
    const px = THREE.MathUtils.clamp(clamped.x, -ROOM.bound, ROOM.bound);
    const pz = THREE.MathUtils.clamp(clamped.z, -ROOM.bound, ROOM.bound);

    // 남측 커튼월: 중앙 입구(|x| ≤ 1.4)만 통과 — 나머지는 유리 (1F 기준.
    // 다른 층은 실내외 고저차 때문에 resolveGround가 어차피 차단한다)
    const wallZ = BUILDING.maxZ;
    const curZ = this.camera.position.z;
    const inXBand = px > BUILDING.minX - WALL_MARGIN && px < BUILDING.maxX + WALL_MARGIN;
    if (inXBand && (curZ - wallZ) * (pz - wallZ) < 0 && Math.abs(px) > 1.4) {
      return null;
    }

    const g = resolveGround(px, pz, this.groundY);
    if (g === null) return null;
    return { x: px, z: pz, y: g };
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

    // --- 위치 갱신: 풋프린트 벽 + 지면(층/계단/개구부) 해석 ---
    const pos = this.camera.position;
    const nx = pos.x + this.velocity.x * delta;
    const nz = pos.z + this.velocity.y * delta;

    let moved = this._tryMove(nx, nz);
    if (!moved) {
      // 대각 이동이 막히면 축별로 독립 시도 → 벽/난간을 따라 슬라이딩
      const onlyX = this._tryMove(nx, pos.z);
      const onlyZ = this._tryMove(pos.x, nz);
      moved = onlyX || onlyZ || null;
    }

    if (moved) {
      pos.x = moved.x;
      pos.z = moved.z;
      this.groundY = moved.y;
    }
    // moved가 null이면(모든 축 이동이 벽/추락으로 막힘) 위치를 그대로 유지한다.

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

    // --- 카메라 y는 groundY를 부드럽게 추종 (계단이 매끄러운 경사처럼 느껴진다) ---
    const yLerp = Math.min(1, GROUND_LERP_RATE * delta);
    const targetY = this.groundY + EYE_HEIGHT + this.bobOffset;
    pos.y += (targetY - pos.y) * yLerp;
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

  // 위치·높이·yaw 즉시 설정 (텔레포트/투어/스폰용). pitch=0 리셋, 속도 0 리셋.
  // y가 주어지면 그 높이로 텔레포트(groundY = y - EYE_HEIGHT), 없으면 해당 (x,z)의
  // 최고 지면(층 슬래브/계단 상면)을 자동으로 찾아 그 위에 선다.
  // disable 상태에서도 동작해야 한다.
  setPose({ x, y, z, ry }) {
    const px = THREE.MathUtils.clamp(x, -ROOM.bound, ROOM.bound);
    const pz = THREE.MathUtils.clamp(z, -ROOM.bound, ROOM.bound);

    let gy;
    if (y !== undefined && y !== null) {
      gy = y - EYE_HEIGHT;
    } else {
      const candidates = groundCandidatesAt(px, pz);
      gy = candidates.length ? Math.max(...candidates) : 0;
    }
    this.groundY = gy;
    this.camera.position.set(px, gy + EYE_HEIGHT, pz);

    this.euler.set(0, ry, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);

    this.velocity.set(0, 0);
    this.bobPhase = 0;
    this.bobOffset = 0;
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
