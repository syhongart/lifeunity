// avatar.js — 원격 플레이어 아바타 생성
// LifeUnity Metaverse — MoMA급 미니멀 뮤지엄
//
// 리깅된 휴머노이드 4종(KayKit Adventurers — web/assets/avatars/{knight,mage,
// barbarian,rogue}.glb, 스킨 1개 + 애니메이션 76클립 내장)을 우선 사용하고,
// 해당 캐릭터 템플릿 로드 실패 시 캡슐+구 머리 폴백으로 자동 전환한다.

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';

// ---------------------------------------------------------------------------
// 캐릭터 정의 — 로비 선택 UI(ui.js)와 템플릿 로더가 공유하는 단일 진실 소스
// ---------------------------------------------------------------------------
export const CHARACTERS = [
  { id: 'knight', name: '기사', file: './assets/avatars/knight.glb' },
  { id: 'mage', name: '마법사', file: './assets/avatars/mage.glb' },
  { id: 'barbarian', name: '전사', file: './assets/avatars/barbarian.glb' },
  { id: 'rogue', name: '방랑자', file: './assets/avatars/rogue.glb' },
];
const CHAR_IDS = new Set(CHARACTERS.map((c) => c.id));
const DEFAULT_CHAR_ID = 'knight';

// KayKit 캐릭터의 메시 전방은 +Z(three.js 카메라 전방 -Z와 반대)라서 π 보정이 필요하다.
// QA 실측으로 확정: 보정 0일 때 북쪽을 바라보는 아바타가 등을 보였음 (2인 접속 스크린샷).
const CHAR_FORWARD_OFFSET = Math.PI;

// 아바타 목표 신장(m) — 캐릭터별 원본 비례가 달라도 균일 스케일로 맞춘다
const TARGET_HEIGHT = 1.8;

// ---------------------------------------------------------------------------
// 템플릿 프리로드 — 모듈 레벨 캐시. 여러 곳에서 호출돼도 캐릭터별 GLTF fetch는 1회.
// ---------------------------------------------------------------------------
let _preloadAllPromise = null;
const _templates = new Map(); // charId → { scene, animations } | null(실패)

function loadOneTemplate(charDef) {
  const loader = new GLTFLoader();
  return new Promise((resolve) => {
    loader.load(
      charDef.file,
      (gltf) => {
        _templates.set(charDef.id, { scene: gltf.scene, animations: gltf.animations || [] });
        resolve();
      },
      undefined,
      (err) => {
        console.warn(`아바타 템플릿(${charDef.id}) 로드 실패, 캡슐 폴백 사용:`, err);
        _templates.set(charDef.id, null);
        resolve();
      }
    );
  });
}

/**
 * CHARACTERS 전부를 병렬로 1회 로드해 모듈 캐시에 저장한다.
 * 캐릭터별로 개별 실패를 허용한다 — 하나가 실패해도 나머지는 정상 사용되고,
 * 실패한 캐릭터는 createAvatarInstance()에서 캡슐 폴백으로 자동 전환된다.
 * @returns {Promise<void>}
 */
export function preloadAvatarTemplates() {
  if (_preloadAllPromise) return _preloadAllPromise;
  _preloadAllPromise = Promise.all(CHARACTERS.map(loadOneTemplate)).then(() => undefined);
  return _preloadAllPromise;
}

// ---------------------------------------------------------------------------
// 닉네임 라벨용 캔버스 텍스처 Sprite
// ---------------------------------------------------------------------------

/**
 * @param {string} nickname
 * @param {string} [colorHex] - 라벨 테두리 색 (플레이어별 아바타 색상). KayKit은
 *   텍스처 기반 스킨이라 모델 자체를 틴트하면 지저분해지므로, 색 구분은 라벨
 *   테두리로만 표현한다.
 * @returns {THREE.Sprite}
 */
function createNicknameSprite(nickname, colorHex) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const fontSize = 48;
  const font = `${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.font = font;

  const text = nickname || '???';
  const textWidth = ctx.measureText(text).width;

  const borderW = 5; // 캔버스 픽셀 기준 — 스프라이트 월드 크기(0.28m)에 맞춰 대략 2px급으로 보임
  const padX = 28;
  const padY = 16;
  canvas.width = Math.ceil(textWidth + padX * 2);
  canvas.height = fontSize + padY * 2;

  // 캔버스 리사이즈 후 컨텍스트 상태 초기화되므로 다시 설정
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 반투명 검정 배경 + 플레이어 색 테두리 (라운드 사각형)
  const r = canvas.height / 2;
  const inset = borderW / 2;
  const roundedRectPath = (x0, y0, x1, y1, radius) => {
    ctx.beginPath();
    ctx.moveTo(x0 + radius, y0);
    ctx.lineTo(x1 - radius, y0);
    ctx.arc(x1 - radius, y0 + radius, radius, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x0 + radius, y1);
    ctx.arc(x0 + radius, y0 + radius, radius, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
  };
  roundedRectPath(0, 0, canvas.width, canvas.height, r);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();
  roundedRectPath(inset, inset, canvas.width - inset, canvas.height - inset, r - inset);
  ctx.strokeStyle = colorHex || '#ffffff';
  ctx.lineWidth = borderW;
  ctx.stroke();

  // 흰 글씨
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);

  // 월드 크기: 높이 약 0.28m, 폭은 캔버스 비율 유지
  const worldHeight = 0.28;
  sprite.scale.set(worldHeight * (canvas.width / canvas.height), worldHeight, 1);

  return sprite;
}

// ---------------------------------------------------------------------------
// 폴백: 캡슐 + 구 머리 아바타 (템플릿 로드 실패 시)
// ---------------------------------------------------------------------------

function createFallbackAvatar(colorHex, nickname) {
  const group = new THREE.Group();
  const disposables = [];

  const bodyColor = new THREE.Color(colorHex);
  // 머리는 살짝 밝은 톤
  const headColor = bodyColor.clone().lerp(new THREE.Color('#ffffff'), 0.35);

  // ---- 몸통: 캡슐 ----
  // CapsuleGeometry(radius, length) → 전체 높이 = length + 2*radius
  const bodyRadius = 0.28;
  const bodyLength = 0.7;
  const bodyHeight = bodyLength + bodyRadius * 2; // 1.26m
  const bodyGeo = new THREE.CapsuleGeometry(bodyRadius, bodyLength, 8, 16);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.6,
    metalness: 0.0,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = bodyHeight / 2; // 발바닥 기준
  body.castShadow = true;
  group.add(body);
  disposables.push(bodyGeo, bodyMat);

  // ---- 머리: 구 ----
  const headRadius = 0.19;
  const headY = bodyHeight + headRadius + 0.03; // 몸통 위 살짝 띄움
  const headGeo = new THREE.SphereGeometry(headRadius, 24, 16);
  const headMat = new THREE.MeshStandardMaterial({
    color: headColor,
    roughness: 0.55,
    metalness: 0.0,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = headY;
  head.castShadow = true;
  group.add(head);
  disposables.push(headGeo, headMat);

  // ---- 눈: 정면(-Z) ----
  // 플레이어 카메라 yaw와 일치하도록 정면을 -Z로 배치
  const eyeGeo = new THREE.BoxGeometry(0.05, 0.07, 0.03);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: '#1a1a1a',
    roughness: 0.35,
    metalness: 0.0,
  });
  const eyeOffsetX = 0.075;
  const eyeZ = -(headRadius - 0.005); // 정면(-Z)에 살짝 박히게
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
  eyeL.position.set(-eyeOffsetX, headY + 0.03, eyeZ);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
  eyeR.position.set(eyeOffsetX, headY + 0.03, eyeZ);
  group.add(eyeL, eyeR);
  disposables.push(eyeGeo, eyeMat);

  // ---- 닉네임 라벨: 머리 위 0.5m ----
  const label = createNicknameSprite(nickname, colorHex);
  label.position.y = headY + headRadius + 0.5;
  group.add(label);

  return {
    group,
    update() {
      // 폴백은 애니메이션 없음 — no-op
    },
    dispose() {
      for (const d of disposables) d.dispose();
      if (label.material.map) label.material.map.dispose();
      label.material.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 클립 이름 매칭 — 정확한 이름을 우선 탐색하고, 없을 때만 소문자 부분일치로 폴백.
// KayKit에는 'Jump_Idle', '2H_Melee_Idle', 'Sit_Chair_Idle' 등 'idle'을 포함하는
// 클립이 많아, 부분일치를 먼저 쓰면 엉뚱한(예: 앉기) 클립이 idle로 오매칭될 수 있다.
// ---------------------------------------------------------------------------
function findClip(animations, exactName, fallbackKey) {
  const exact = animations.find((c) => c.name === exactName);
  if (exact) return exact;
  return animations.find((c) => c.name && c.name.toLowerCase().includes(fallbackKey)) || null;
}

// ---------------------------------------------------------------------------
// 리깅 아바타 (템플릿 로드 성공 시)
// ---------------------------------------------------------------------------

function createRiggedAvatar(template, colorHex, nickname) {
  const group = new THREE.Group();

  const root = SkeletonUtils.clone(template.scene);
  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = false;
  });
  // 메시/머티리얼은 SkeletonUtils.clone(내부적으로 Object3D.clone)이 스켈레톤만
  // 깊은 복제하고 geometry/material은 템플릿과 참조를 공유한다. KayKit은 텍스처
  // 기반 스킨이라 인스턴스별 색 변경이 필요 없으므로(색 구분은 라벨 테두리로 처리)
  // 굳이 clone하지 않는다 — dispose()에서도 공유 리소스는 건드리지 않는다.

  // ---- 스케일 정규화: 실측 바운딩박스 높이를 기준으로 균일 스케일 + 발바닥 y=0 정렬 ----
  // (캐릭터별 원본 비례가 달라도 항상 TARGET_HEIGHT로 맞춰 방들 사이 눈높이가 일정하다)
  root.updateMatrixWorld(true);
  let box = new THREE.Box3().setFromObject(root);
  const rawHeight = box.max.y - box.min.y;
  const scaleFactor = rawHeight > 0.0001 ? TARGET_HEIGHT / rawHeight : 1;
  root.scale.setScalar(scaleFactor);
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root);
  root.position.y -= box.min.y; // 발바닥을 y=0에 맞춤
  root.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(root); // 라벨 높이 계산용 최종 실측값

  // ---- 전방 보정 래퍼 (CHAR_FORWARD_OFFSET — 현재 0, QA 결과에 따라 조정) ----
  const wrapper = new THREE.Group();
  wrapper.rotation.y = CHAR_FORWARD_OFFSET;
  wrapper.add(root);
  group.add(wrapper);

  // ---- 애니메이션 믹서 + idle/walk/run 액션 (정확 이름 우선 매칭) ----
  const mixer = new THREE.AnimationMixer(root);
  const animations = template.animations;

  const idleClip = findClip(animations, 'Idle', 'idle') || animations[0] || null;
  const walkClip = findClip(animations, 'Walking_A', 'walk');
  const runClip = findClip(animations, 'Running_A', 'run');

  const idleAction = idleClip ? mixer.clipAction(idleClip) : null;
  const walkAction = walkClip ? mixer.clipAction(walkClip) : null;
  const runAction = runClip ? mixer.clipAction(runClip) : null;

  const actions = [idleAction, walkAction, runAction].filter(Boolean);
  for (const action of actions) {
    action.play();
    action.enabled = true;
    action.setEffectiveWeight(0);
  }
  if (idleAction) idleAction.setEffectiveWeight(1);

  const weights = { idle: idleAction ? 1 : 0, walk: 0, run: 0 };
  const BLEND_RATE = 8;

  // ---- 닉네임 라벨: 모델 실측 바운딩박스 상단 + 0.25m (캐릭터별 키/장비 차이 대응) ----
  const label = createNicknameSprite(nickname, colorHex);
  label.position.y = box.max.y + 0.25;
  group.add(label);

  return {
    group,
    update(delta, speed) {
      if (mixer) mixer.update(delta);

      // 목표 상태 결정
      let target = 'idle';
      if (speed >= 3.2 && runAction) target = 'run';
      else if (speed >= 0.15 && walkAction) target = 'walk';

      if (target === 'walk' && walkAction) {
        walkAction.timeScale = THREE.MathUtils.clamp(speed / 1.7, 0.6, 1.6);
      }
      if (target === 'run' && runAction) {
        runAction.timeScale = Math.max(0.1, speed / 4);
      }

      const targetWeights = { idle: 0, walk: 0, run: 0 };
      targetWeights[target] = 1;

      const t = Math.min(1, BLEND_RATE * delta);
      weights.idle += (targetWeights.idle - weights.idle) * t;
      weights.walk += (targetWeights.walk - weights.walk) * t;
      weights.run += (targetWeights.run - weights.run) * t;

      if (idleAction) idleAction.setEffectiveWeight(weights.idle);
      if (walkAction) walkAction.setEffectiveWeight(weights.walk);
      if (runAction) runAction.setEffectiveWeight(weights.run);
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      if (label.material.map) label.material.map.dispose();
      label.material.dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// 공개 API — 인스턴스 생성
// ---------------------------------------------------------------------------

/**
 * 아바타 인스턴스 생성.
 * Group 원점은 발바닥(y=0) 기준. 외부에서 position / rotation.y 조작.
 *
 * @param {string} charId - CHARACTERS의 id (예: 'knight'). 유효하지 않으면 'knight'로 폴백.
 * @param {string} colorHex - 닉네임 라벨 테두리 색 (예: '#e74c3c')
 * @param {string} nickname - 머리 위 라벨 텍스트
 * @returns {{group: THREE.Group, update: (delta:number, speed:number)=>void, dispose: ()=>void}}
 */
export function createAvatarInstance(charId, colorHex, nickname) {
  const resolvedId = CHAR_IDS.has(charId) ? charId : DEFAULT_CHAR_ID;
  const template = _templates.get(resolvedId);
  if (template) {
    try {
      return createRiggedAvatar(template, colorHex, nickname);
    } catch (err) {
      console.warn(`리깅 아바타(${resolvedId}) 생성 실패, 캡슐 폴백 사용:`, err);
    }
  }
  return createFallbackAvatar(colorHex, nickname);
}
