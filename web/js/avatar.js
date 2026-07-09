// avatar.js — 원격 플레이어 아바타 생성
// LifeUnity Metaverse — MoMA급 미니멀 뮤지엄
//
// 리깅된 휴머노이드(web/assets/avatar.glb — Mixamo X Bot, idle/walk/run 클립 내장)를
// 우선 사용하고, 로드 실패 시 캡슐+구 머리 폴백으로 자동 전환한다.

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';

// ---------------------------------------------------------------------------
// 템플릿 프리로드 — 모듈 레벨 캐시. 여러 곳에서 호출돼도 GLTF fetch는 1회.
// ---------------------------------------------------------------------------
let _templatePromise = null;
let _template = null; // { scene, animations } | null(실패)

/**
 * web/assets/avatar.glb를 1회 로드해 모듈 캐시에 저장한다.
 * 실패해도 throw하지 않고 null로 저장해 폴백 모드로 동작한다.
 * @returns {Promise<void>}
 */
export function preloadAvatarTemplate() {
  if (_templatePromise) return _templatePromise;

  const loader = new GLTFLoader();
  _templatePromise = new Promise((resolve) => {
    loader.load(
      './assets/avatar.glb',
      (gltf) => {
        _template = { scene: gltf.scene, animations: gltf.animations || [] };
        resolve();
      },
      undefined,
      (err) => {
        console.warn('아바타 템플릿 로드 실패, 캡슐 폴백 사용:', err);
        _template = null;
        resolve();
      }
    );
  });
  return _templatePromise;
}

// ---------------------------------------------------------------------------
// 닉네임 라벨용 캔버스 텍스처 Sprite
// ---------------------------------------------------------------------------

/**
 * @param {string} nickname
 * @returns {THREE.Sprite}
 */
function createNicknameSprite(nickname) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const fontSize = 48;
  const font = `${fontSize}px Helvetica, Arial, sans-serif`;
  ctx.font = font;

  const text = nickname || '???';
  const textWidth = ctx.measureText(text).width;

  const padX = 28;
  const padY = 16;
  canvas.width = Math.ceil(textWidth + padX * 2);
  canvas.height = fontSize + padY * 2;

  // 캔버스 리사이즈 후 컨텍스트 상태 초기화되므로 다시 설정
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 반투명 검정 배경 (라운드 사각형)
  const r = canvas.height / 2;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(canvas.width - r, 0);
  ctx.arc(canvas.width - r, r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(r, canvas.height);
  ctx.arc(r, r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

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
  const label = createNicknameSprite(nickname);
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
// 클립 이름 매칭 — 'idle' / 'walk' / 'run' 을 소문자 부분일치로 탐색.
// 못 찾으면 idle은 첫 클립으로 폴백.
// ---------------------------------------------------------------------------
function findClip(animations, key) {
  return animations.find((c) => c.name && c.name.toLowerCase().includes(key)) || null;
}

// ---------------------------------------------------------------------------
// 리깅 아바타 (템플릿 로드 성공 시)
// ---------------------------------------------------------------------------

function createRiggedAvatar(colorHex, nickname) {
  const group = new THREE.Group();

  const root = SkeletonUtils.clone(_template.scene);
  root.position.set(0, 0, 0);
  group.add(root);

  // ---- 머티리얼: 인스턴스별 clone 후 은은한 틴트 (가장 밝은 스킨드 메시 하나만) ----
  const tintColor = new THREE.Color(colorHex).lerp(new THREE.Color('#ffffff'), 0.45);
  const clonedMaterials = [];
  const clonedGeometries = [];
  let brightestMesh = null;
  let brightestLuma = -1;

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = false;

    if (obj.geometry) clonedGeometries.push(obj.geometry);

    const applyClone = (mat) => {
      const cloned = mat.clone();
      clonedMaterials.push(cloned);
      // 틴트 대상 탐색은 스킨드 메시(피부/의상)로 한정 — 액세서리 등 비스킨 메시 제외
      if (obj.isSkinnedMesh) {
        const c = cloned.color || new THREE.Color('#ffffff');
        const luma = 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
        if (luma > brightestLuma) {
          brightestLuma = luma;
          brightestMesh = obj;
        }
      }
      return cloned;
    };

    if (Array.isArray(obj.material)) {
      obj.material = obj.material.map(applyClone);
    } else if (obj.material) {
      obj.material = applyClone(obj.material);
    }
  });

  // 가장 밝은(대개 피부/바디) 재질 하나만 은은하게 틴트 — 마네킹 질감 유지
  if (brightestMesh) {
    const mats = Array.isArray(brightestMesh.material)
      ? brightestMesh.material
      : [brightestMesh.material];
    for (const m of mats) {
      if (m && m.color) m.color.multiply(tintColor);
    }
  }

  // ---- 애니메이션 믹서 + idle/walk/run 액션 ----
  const mixer = new THREE.AnimationMixer(root);
  const animations = _template.animations;

  const idleClip = findClip(animations, 'idle') || animations[0] || null;
  const walkClip = findClip(animations, 'walk');
  const runClip = findClip(animations, 'run');

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

  // ---- 닉네임 라벨: 머리 위 y≈2.05 (X Bot 신장 ~1.8m 기준) ----
  const label = createNicknameSprite(nickname);
  label.position.y = 2.05;
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
      for (const geo of clonedGeometries) geo.dispose();
      for (const mat of clonedMaterials) mat.dispose();
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
 * @param {string} colorHex - 몸통/틴트 색 (예: '#e74c3c')
 * @param {string} nickname - 머리 위 라벨 텍스트
 * @returns {{group: THREE.Group, update: (delta:number, speed:number)=>void, dispose: ()=>void}}
 */
export function createAvatarInstance(colorHex, nickname) {
  if (_template) {
    try {
      return createRiggedAvatar(colorHex, nickname);
    } catch (err) {
      console.warn('리깅 아바타 생성 실패, 캡슐 폴백 사용:', err);
    }
  }
  return createFallbackAvatar(colorHex, nickname);
}
