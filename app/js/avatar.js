// avatar.js — 원격 플레이어 아바타 생성
// ARTSHOW Metaverse — MoMA급 미니멀 뮤지엄
//
// 리깅된 휴머노이드 4종(KayKit Adventurers — web/assets/avatars/{knight,mage,
// barbarian,rogue}.glb, 스킨 1개 + 애니메이션 76클립 내장)을 우선 사용하고,
// 해당 캐릭터 템플릿 로드 실패 시 캡슐+구 머리 폴백으로 자동 전환한다.

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import * as SkeletonUtils from '../vendor/SkeletonUtils.js';
import { buildDclAvatar, decodeLook, retargetClipForDcl } from './avatarkit.js';

// ---------------------------------------------------------------------------
// 캐릭터 정의 — 로비 선택 UI(ui.js)와 템플릿 로더가 공유하는 단일 진실 소스
// ---------------------------------------------------------------------------
export const CHARACTERS = [
  { id: 'knight', name: '기사', file: './assets/avatars/knight.glb' },
  { id: 'mage', name: '마법사', file: './assets/avatars/mage.glb' },
  { id: 'barbarian', name: '전사', file: './assets/avatars/barbarian.glb' },
  { id: 'rogue', name: '방랑자', file: './assets/avatars/rogue.glb' },
  { id: 'human', name: '휴먼', file: './assets/avatars/human.glb', anims: 'rpm' },
];
const DEFAULT_CHAR_ID = 'knight';

// KayKit 캐릭터의 메시 전방은 +Z(three.js 카메라 전방 -Z와 반대)라서 π 보정이 필요하다.
// QA 실측으로 확정: 보정 0일 때 북쪽을 바라보는 아바타가 등을 보였음 (2인 접속 스크린샷).
const CHAR_FORWARD_OFFSET = Math.PI;

// DCL(Decentraland base-avatars) 커스텀 아바타 전방 보정 — KayKit과 별도 상수.
// DCL 원본도 +Z를 바라보게 저작돼 있고, 플레이어 yaw=0의 이동 방향은 -Z다.
// 프리셋과 동일 조건 QA에서 프리셋은 등(-Z 정면), DCL은 얼굴(+Z 정면)을 보여
// 180° 불일치 확인 — 보정 없으면 원격 커스텀 아바타가 뒤로 걷는 문워크가 된다.
const DCL_FORWARD_OFFSET = Math.PI;

// DCL 리그의 바인드 포즈는 T포즈(팔이 수평)인데 RPM/Mixamo idle·walk 클립의 "레스트"는
// 이미 팔이 몸통 옆으로 내려온 자연스러운 자세다 — 레스트-상대 델타 리타게팅은 이
// 차이를 좌표축 관례 차이와 구분할 수 없어 팔이 계속 T포즈 근처에 머문다(QA 실측).
// 상완 본에 로컬 Z축 +90°를 더해 T포즈 기준을 자연스러운 팔 늘어뜨림 쪽으로 보정한다.
//
// Avatar_RightForeArm에 추가로 -50°가 들어있는 이유(QA 재실측, 2026-07-10): 손목 이하
// 트랙을 드롭해도(아래 DCL_HAND_BONE_RE) 기본 룩 idle 포즈에서 오른손이 치마 앞에
// 파편처럼 박히는 문제가 남아 있었다. 본별 월드 위치를 실측한 결과 Avatar_RightHand가
// 몸 중심(x≈0)까지 안쪽으로 말려 들어가 있었다(Avatar_LeftHand는 x≈+0.2로 정상 —
// reanchorRotationTrack의 레스트-상대 델타 변환이 상완(Arm)에는 DCL_ARM_CALIBRATION로
// 보정되지만 팔뚝(ForeArm)에는 보정이 없어, 미러링된 좌/우 리그에서 팔뚝 쪽만 한쪽이
// 크게 어긋난 것으로 추정). Avatar_LeftHand의 월드 위치(x≈0.205, y≈0.869, z≈0.112)를
// 기준으로 Avatar_RightForeArm에 로컬 Z축 회전을 여러 각도 실측 스윕(0°~180°, -90°~0°)해
// Avatar_RightHand가 그 좌우대칭 위치(x≈-0.205, y≈0.869, z≈0.112)에 가장 가깝게 오는
// 값을 찾았다 — -50°에서 (x≈-0.201, y≈0.883, z≈0.065)로 수렴, idle/walk 스크린샷으로
// 양손이 자연스럽게 붙어있음을 확인(cute-01~03, verify-idle/walk-minus50 스크린샷).
const DCL_ARM_CALIBRATION = new Map([
  ['Avatar_LeftArm', new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)],
  ['Avatar_RightArm', new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)],
  ['Avatar_RightForeArm', new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), (-50 * Math.PI) / 180)],
]);

// 감독 실측 진단 B: 리타게팅된 RPM 걷기/달리기 클립의 손목 이하(손/손가락) 회전
// 트랙이 왼손에서만 어긋나 기본 룩의 치마 앞에 손가락이 구겨진 살색 파편으로
// 박힌다(ShapeA_Hands_BaseMesh를 숨기면 사라지는 것으로 원인 특정 완료). 이
// 거리에서는 손가락 애니메이션이 어차피 보이지 않으므로, 손목 이하 트랙은
// 좌우 구분 없이 전부 드롭한다 — 손은 팔뚝(ForeArm) 애니메이션을 따라 부모
// 본 회전만으로 자연스럽게 따라간다(계층 구조상 자동으로 붙어 있음).
// 단, 이 드롭만으로는 파편이 완전히 사라지지 않아 위 DCL_ARM_CALIBRATION의
// Avatar_RightForeArm 보정을 추가로 적용했다(재실측 결과 참고).
const DCL_HAND_BONE_RE = /Hand|Thumb|Index|Middle|Ring|Pinky/;

// 아바타 목표 신장(m) — 캐릭터별 원본 비례가 달라도 균일 스케일로 맞춘다
const TARGET_HEIGHT = 1.8;

// ---------------------------------------------------------------------------
// Ready Player Me 커스텀 아바타 — 허용 URL 프리픽스 (프로덕션: RPM 공식 CDN 1개)
// 테스트에서 이 배열을 바꿔 다른 프리픽스를 허용/거부하는 경로를 검증할 수 있다.
// ---------------------------------------------------------------------------
export const RPM_ALLOWED_PREFIXES = ['https://models.readyplayer.me/'];

function isAllowedRpmUrl(url) {
  return (
    typeof url === 'string' &&
    url.toLowerCase().endsWith('.glb') &&
    RPM_ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix))
  );
}

// ---------------------------------------------------------------------------
// RPM 애니메이션 라이브러리 클립 — human 및 커스텀 RPM 아바타가 공유한다.
// 각 GLB는 메시 없이 animations[0] 하나(RPM 표준 릭 본 이름)만 담고 있어,
// 대상 스켈레톤의 본 이름과 매칭되면 clipAction()으로 바로 재생 가능하다.
// ---------------------------------------------------------------------------
const RPM_ANIM_FILES = {
  idle: './assets/anims/rpm-idle.glb',
  walk: './assets/anims/rpm-walk.glb',
  run: './assets/anims/rpm-run.glb',
};
let _rpmClipsPromise = null;
// 동기 접근용 캐시 — _templates Map과 동일한 패턴. 로드 완료 전에 human/커스텀 RPM
// 아바타가 생성되면 이 시점의 값(일부 또는 전부 null)을 그대로 쓴다 — 애니메이션 없는
// 정적 포즈로 렌더될 뿐, 캡슐 폴백까지 가지는 않는다(모델 자체는 정상 로드되었으므로).
let _rpmClips = { idle: null, walk: null, run: null };
// DCL 리타게팅용 — RPM 리그의 레스트(바인드 포즈) 정보. idle→walk→run 순으로
// 최초 성공한 클립에서 1회만 추출한다(동일 리그이므로 값은 동일해야 함).
// DCL 본의 로컬 레스트 회전값은 RPM/Mixamo 표준과 축 관례가 달라(Armature 좌표
// 보정 회전 등) 트랙 이름만 바꿔 복사하면 포즈가 붕괴한다(QA로 실측 확인) — 본별
// 레스트 쿼터니언 델타를 구해 재적용해야 하므로, 모든 본의 레스트 로컬 회전을 맵으로 둔다.
let _rpmHipsRest = null; // { local: THREE.Vector3, worldY: number } | null
let _rpmRestQuats = null; // Map<boneName, THREE.Quaternion> | null

function loadOneClip(file) {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      file,
      (gltf) => {
        const clip = (gltf.animations && gltf.animations[0]) || null;
        let hipsRestLocal = null;
        let hipsRestWorldY = null;
        const restQuats = new Map();
        if (gltf.scene) {
          gltf.scene.updateMatrixWorld(true);
          let hipsNode = null;
          gltf.scene.traverse((o) => {
            if (o.name) restQuats.set(o.name, o.quaternion.clone());
            if (!hipsNode && o.name === 'Hips') hipsNode = o;
          });
          if (hipsNode) {
            hipsRestLocal = hipsNode.position.clone();
            const wp = new THREE.Vector3();
            hipsNode.getWorldPosition(wp);
            hipsRestWorldY = wp.y;
          }
        }
        resolve({ clip, hipsRestLocal, hipsRestWorldY, restQuats: restQuats.size ? restQuats : null });
      },
      undefined,
      (err) => reject(err)
    );
  });
}

/**
 * RPM idle/walk/run 클립 3종을 병렬 로드해 캐시한다. 실패 시 null을 반환하고
 * (throw하지 않음) 호출부가 개별 클립 유무를 보고 대응하게 한다.
 * @returns {Promise<{idle: THREE.AnimationClip|null, walk: THREE.AnimationClip|null, run: THREE.AnimationClip|null}>}
 */
function loadRpmClips() {
  if (_rpmClipsPromise) return _rpmClipsPromise;
  const empty = { clip: null, hipsRestLocal: null, hipsRestWorldY: null, restQuats: null };
  _rpmClipsPromise = Promise.all([
    loadOneClip(RPM_ANIM_FILES.idle).catch((err) => {
      console.warn('RPM idle 클립 로드 실패:', err);
      return empty;
    }),
    loadOneClip(RPM_ANIM_FILES.walk).catch((err) => {
      console.warn('RPM walk 클립 로드 실패:', err);
      return empty;
    }),
    loadOneClip(RPM_ANIM_FILES.run).catch((err) => {
      console.warn('RPM run 클립 로드 실패:', err);
      return empty;
    }),
  ]).then(([idle, walk, run]) => {
    _rpmClips = { idle: idle.clip, walk: walk.clip, run: run.clip };
    const restSrc = idle.hipsRestLocal ? idle : walk.hipsRestLocal ? walk : run.hipsRestLocal ? run : null;
    _rpmHipsRest = restSrc ? { local: restSrc.hipsRestLocal, worldY: restSrc.hipsRestWorldY } : null;
    const quatSrc = idle.restQuats ? idle : walk.restQuats ? walk : run.restQuats ? run : null;
    _rpmRestQuats = quatSrc ? quatSrc.restQuats : null;
    return _rpmClips;
  });
  return _rpmClipsPromise;
}

// ---------------------------------------------------------------------------
// 커스텀 RPM URL 아바타 — GLB 템플릿을 URL별로 1회만 로드해 캐시한다.
// ---------------------------------------------------------------------------
const _rpmUrlTemplates = new Map(); // url → {scene, animations} | null(실패)
const _rpmUrlPromises = new Map(); // url → Promise<void> (중복 fetch 방지)

function loadRpmUrlTemplateOnce(url) {
  if (_rpmUrlPromises.has(url)) return _rpmUrlPromises.get(url);
  const loader = new GLTFLoader();
  const promise = new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        _rpmUrlTemplates.set(url, { scene: gltf.scene, animations: gltf.animations || [] });
        resolve();
      },
      undefined,
      (err) => {
        console.warn(`커스텀 RPM 아바타 로드 실패(${url}), 캡슐 폴백 사용:`, err);
        _rpmUrlTemplates.set(url, null);
        resolve();
      }
    );
  });
  _rpmUrlPromises.set(url, promise);
  return promise;
}

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
  _preloadAllPromise = Promise.all([
    ...CHARACTERS.map(loadOneTemplate),
    loadRpmClips(),
  ]).then(() => undefined);
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

/**
 * @param {{scene: THREE.Object3D, animations: THREE.AnimationClip[]}} template
 * @param {string} colorHex
 * @param {string} nickname
 * @param {{idle: THREE.AnimationClip|null, walk: THREE.AnimationClip|null, run: THREE.AnimationClip|null}|null} [animOverride]
 *   전달 시 template.animations(모델 내장 클립) 대신 이 idle/walk/run 클립을 그대로 사용한다.
 *   RPM 휴먼/커스텀 아바타처럼 모델 자체는 애니메이션이 없고 별도 클립 라이브러리를
 *   본 이름 매칭으로 재생하는 경우에 쓰인다.
 * @param {number} [forwardOffset] - 캐릭터 전방 보정(라디안). 기본 CHAR_FORWARD_OFFSET.
 */
function createRiggedAvatar(template, colorHex, nickname, animOverride = null, forwardOffset = CHAR_FORWARD_OFFSET) {
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
  wrapper.rotation.y = forwardOffset;
  wrapper.add(root);
  group.add(wrapper);

  // ---- 애니메이션 믹서 + idle/walk/run 액션 ----
  // animOverride가 있으면(RPM 휴먼/커스텀) 모델 내장 클립 대신 그 클립을 그대로 쓰고,
  // 없으면(KayKit 4종) 기존처럼 정확 이름 우선 매칭으로 내장 클립에서 찾는다.
  const mixer = new THREE.AnimationMixer(root);
  const animations = template.animations;

  let idleClip, walkClip, runClip;
  if (animOverride) {
    idleClip = animOverride.idle || null;
    walkClip = animOverride.walk || null;
    runClip = animOverride.run || null;
  } else {
    idleClip = findClip(animations, 'Idle', 'idle') || animations[0] || null;
    walkClip = findClip(animations, 'Walking_A', 'walk');
    runClip = findClip(animations, 'Running_A', 'run');
  }

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
// DCL 커스텀 아바타 ('dcl:' + JSON.stringify(look)) — avatarkit.js가 조립,
// 여기서는 정규화/애니메이션 리타게팅/씬 편입만 담당한다.
// ---------------------------------------------------------------------------

/**
 * SkinnedMesh는 본 변형이 Object3D.matrixWorld에 반영되지 않아(GPU 스키닝) 일반
 * Box3.setFromObject()로는 실제 렌더 크기를 잴 수 없다. 귀여움 슬라이더가 머리
 * 뼈를 스케일하므로, getVertexPosition()으로 정확히 잰다.
 * 주의: SkinnedMesh.getVertexPosition()은 내부적으로 bindMatrixInverse(= 자기
 * matrixWorld의 역행렬)를 마지막에 곱해 결과를 "메시 로컬 공간"으로 되돌려 놓는다
 * (레이캐스팅에서 로컬 공간 레이와 비교하기 위한 설계) — 월드 좌표가 필요하므로
 * obj.matrixWorld를 다시 곱해야 한다.
 * @param {THREE.Object3D} root
 * @returns {THREE.Box3}
 */
function computeSkinnedWorldBox3(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();
  let any = false;
  root.traverse((obj) => {
    if (!obj.isSkinnedMesh || obj.visible === false) return;
    const posAttr = obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position;
    if (!posAttr) return;
    for (let i = 0; i < posAttr.count; i++) {
      obj.getVertexPosition(i, v);
      v.applyMatrix4(obj.matrixWorld);
      box.expandByPoint(v);
      any = true;
    }
  });
  if (!any) box.setFromObject(root);
  return box;
}

/**
 * RPM Hips.position 트랙(리타게팅 후 'Avatar_Hips.position')을 DCL 리그에서 쓸 수
 * 있게 재보정한다. retargetClipForDcl()은 계약상 값에 hipsScale만 곱하므로(레스트
 * 오프셋/좌표축 차이는 모른다), 여기서 RPM 레스트 기준 델타를 뽑아 DCL의 실제
 * 레스트 로컬 위치에 다시 앵커링하고, Hips 부모(Armature)의 현재 월드 회전으로
 * 축을 맞춘다. 필요한 레스트 정보가 없거나 계산 결과가 유한하지 않으면 트랙을
 * 통째로 버려 실패를 흡수한다(회전 트랙만으로도 완전한 걷기 애니메이션이 된다).
 * @returns {boolean} 성공 여부
 */
function reanchorDclHipsPositionTrack(track, hipsScale, dclHipsLocalRest, dclParentWorldQuat) {
  if (!track || !dclHipsLocalRest || !dclParentWorldQuat || !_rpmHipsRest || !_rpmHipsRest.local) return false;
  const rpmRestScaled = _rpmHipsRest.local.clone().multiplyScalar(hipsScale);
  const invParentQuat = dclParentWorldQuat.clone().invert();
  const values = track.values;
  const tmp = new THREE.Vector3();
  for (let i = 0; i + 2 < values.length; i += 3) {
    tmp.set(values[i] - rpmRestScaled.x, values[i + 1] - rpmRestScaled.y, values[i + 2] - rpmRestScaled.z);
    tmp.applyQuaternion(invParentQuat);
    const nx = dclHipsLocalRest.x + tmp.x;
    const ny = dclHipsLocalRest.y + tmp.y;
    const nz = dclHipsLocalRest.z + tmp.z;
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return false;
    values[i] = nx;
    values[i + 1] = ny;
    values[i + 2] = nz;
  }
  return true;
}

/**
 * 회전 트랙(quaternion) 하나를 레스트-상대 델타로 재보정한다. DCL 본의 로컬 레스트
 * 회전이 RPM/Mixamo 표준과 축 관례가 달라(QA 실측 확인 — 이름만 바꿔 복사하면
 * 포즈가 완전히 붕괴함), 각 프레임 값에서 RPM 레스트 회전을 제거해 '순수 관절
 * 변화량'을 뽑고, 그 변화량을 DCL 본 자신의 레스트 회전 위에 다시 얹는다:
 *   q_dst(t) = restQuat_dst · restQuat_src⁻¹ · q_src(t)
 * @returns {boolean} 성공 여부(레스트 정보 없으면 false — 호출부가 트랙을 드롭)
 */
function reanchorRotationTrack(track, dclRestQuat, rpmRestQuat) {
  if (!track || !dclRestQuat || !rpmRestQuat) return false;
  const rpmRestInv = rpmRestQuat.clone().invert();
  const values = track.values;
  const q = new THREE.Quaternion();
  const corrected = new THREE.Quaternion();
  for (let i = 0; i + 3 < values.length; i += 4) {
    q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
    corrected.copy(dclRestQuat).multiply(rpmRestInv).multiply(q);
    if (
      !Number.isFinite(corrected.x) ||
      !Number.isFinite(corrected.y) ||
      !Number.isFinite(corrected.z) ||
      !Number.isFinite(corrected.w)
    ) {
      return false;
    }
    values[i] = corrected.x;
    values[i + 1] = corrected.y;
    values[i + 2] = corrected.z;
    values[i + 3] = corrected.w;
  }
  return true;
}

/**
 * 트랙의 모든 프레임 쿼터니언에 고정 오프셋을 post-multiply한다(DCL_ARM_CALIBRATION 등
 * "레스트 기준점 자체"를 보정하는 용도 — 매 프레임 동일 오프셋이므로 애니메이션의
 * 상대적 움직임은 그대로 보존된다).
 */
function applyQuaternionOffset(track, offsetQuat) {
  const values = track.values;
  const q = new THREE.Quaternion();
  for (let i = 0; i + 3 < values.length; i += 4) {
    q.set(values[i], values[i + 1], values[i + 2], values[i + 3]);
    q.multiply(offsetQuat);
    values[i] = q.x;
    values[i + 1] = q.y;
    values[i + 2] = q.z;
    values[i + 3] = q.w;
  }
}

/**
 * buildDclAvatar() 결과에 TARGET_HEIGHT 정규화 + 전방 보정 + RPM 클립 리타게팅
 * 애니메이션을 씌운다. 기존 createRiggedAvatar()의 idle/walk/run 블렌드 로직을
 * 그대로 따른다(KayKit 5종 경로는 건드리지 않음 — 별도 함수).
 * @param {{group: THREE.Group, skeleton: THREE.Skeleton, dispose: () => void}} built
 */
function createDclAnimatedAvatar(built, colorHex, nickname) {
  const dclRoot = built.group;
  const skeleton = built.skeleton;

  // 리타겟 보정용 — DCL 각 본의 로컬 레스트 회전(믹서가 애니메이션을 적용하기 전,
  // buildDclAvatar 직후의 값 = 바인드 포즈)을 이름별로 캡처해 둔다.
  const dclRestQuats = new Map();
  for (const b of skeleton.bones) dclRestQuats.set(b.name, b.quaternion.clone());

  const dclHipsBone = skeleton.getBoneByName
    ? skeleton.getBoneByName('Avatar_Hips')
    : skeleton.bones.find((b) => b.name === 'Avatar_Hips');
  const dclHipsLocalRest = dclHipsBone ? dclHipsBone.position.clone() : null;

  // hipsScale용 네이티브(정규화 전) 월드 y 측정
  dclRoot.updateMatrixWorld(true);
  let dclHipsRestWorldY = null;
  if (dclHipsBone) {
    const wp = new THREE.Vector3();
    dclHipsBone.getWorldPosition(wp);
    dclHipsRestWorldY = wp.y;
  }
  let hipsScale = 1;
  if (
    Number.isFinite(dclHipsRestWorldY) &&
    dclHipsRestWorldY > 0 &&
    _rpmHipsRest &&
    Number.isFinite(_rpmHipsRest.worldY) &&
    _rpmHipsRest.worldY > 0
  ) {
    const ratio = dclHipsRestWorldY / _rpmHipsRest.worldY;
    if (Number.isFinite(ratio) && ratio > 0) hipsScale = ratio;
  }

  // ---- 스케일 정규화(스킨 변형 반영) + 발바닥 y=0 정렬 — 기존 createRiggedAvatar와 동일 패턴 ----
  let box = computeSkinnedWorldBox3(dclRoot);
  const rawHeight = box.max.y - box.min.y;
  const scaleFactor = rawHeight > 0.0001 ? TARGET_HEIGHT / rawHeight : 1;
  dclRoot.scale.setScalar(scaleFactor);
  dclRoot.updateMatrixWorld(true);
  box = computeSkinnedWorldBox3(dclRoot);
  dclRoot.position.y -= box.min.y;
  dclRoot.updateMatrixWorld(true);
  box = computeSkinnedWorldBox3(dclRoot); // 라벨 높이 계산용 최종 실측값

  // ---- 전방 보정 래퍼 ----
  const group = new THREE.Group();
  const wrapper = new THREE.Group();
  wrapper.rotation.y = DCL_FORWARD_OFFSET;
  wrapper.add(dclRoot);
  group.add(wrapper);
  group.updateMatrixWorld(true);

  // Hips 부모(Armature)의 '현재' 월드 회전 — 좌표축 보정 기준(래퍼 회전 포함, 자동으로 맞음)
  const dclParentWorldQuat =
    dclHipsBone && dclHipsBone.parent ? dclHipsBone.parent.getWorldQuaternion(new THREE.Quaternion()) : null;

  // ---- 애니메이션: RPM 클립을 Avatar_ 접두어로 리타겟 + DCL 리그에 없는 뼈 트랙 제거 ----
  const dclBoneNames = new Set(skeleton.bones.map((b) => b.name));
  function prepClip(rawClip) {
    if (!rawClip) return null;
    let retargeted;
    try {
      retargeted = retargetClipForDcl(rawClip, hipsScale);
    } catch (err) {
      console.warn('DCL 클립 리타게팅 실패:', err);
      return null;
    }
    if (!retargeted) return null;
    retargeted.tracks = retargeted.tracks.filter((t) => {
      const dot = t.name.lastIndexOf('.');
      const boneName = dot === -1 ? t.name : t.name.slice(0, dot);
      return dclBoneNames.has(boneName);
    });

    // 손목 이하(손/손가락) 트랙 전부 드롭 — 진단 B, 위 DCL_HAND_BONE_RE 설명 참고.
    retargeted.tracks = retargeted.tracks.filter((t) => {
      const dot = t.name.lastIndexOf('.');
      const boneName = dot === -1 ? t.name : t.name.slice(0, dot);
      const bare = boneName.startsWith('Avatar_') ? boneName.slice('Avatar_'.length) : boneName;
      return !DCL_HAND_BONE_RE.test(bare);
    });

    retargeted.tracks = retargeted.tracks.filter((t) => {
      if (!t.name.endsWith('.quaternion')) return true;
      const boneName = t.name.slice(0, t.name.length - '.quaternion'.length); // 'Avatar_X'
      const srcName = boneName.startsWith('Avatar_') ? boneName.slice('Avatar_'.length) : boneName;
      const dclRest = dclRestQuats.get(boneName);
      const rpmRest = _rpmRestQuats ? _rpmRestQuats.get(srcName) : null;
      let ok = false;
      try {
        ok = reanchorRotationTrack(t, dclRest, rpmRest);
        const calib = DCL_ARM_CALIBRATION.get(boneName);
        if (ok && calib) applyQuaternionOffset(t, calib);
      } catch (err) {
        ok = false;
      }
      return ok;
    });

    const hipsIdx = retargeted.tracks.findIndex((t) => t.name === 'Avatar_Hips.position');
    if (hipsIdx !== -1) {
      let ok = false;
      try {
        ok = reanchorDclHipsPositionTrack(retargeted.tracks[hipsIdx], hipsScale, dclHipsLocalRest, dclParentWorldQuat);
      } catch (err) {
        ok = false;
      }
      if (!ok) retargeted.tracks.splice(hipsIdx, 1);
    }
    return retargeted.tracks.length ? retargeted : null;
  }

  const idleClip = prepClip(_rpmClips.idle);
  const walkClip = prepClip(_rpmClips.walk);
  const runClip = prepClip(_rpmClips.run);

  const mixer = new THREE.AnimationMixer(dclRoot);
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

  const label = createNicknameSprite(nickname, colorHex);
  label.position.y = box.max.y + 0.25;
  group.add(label);

  return {
    group,
    update(delta, speed) {
      if (mixer) mixer.update(delta);

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
      mixer.uncacheRoot(dclRoot);
      built.dispose();
      if (label.material.map) label.material.map.dispose();
      label.material.dispose();
    },
  };
}

// 커스텀 DCL 아바타 charId 프리픽스 — 'dcl:' + JSON.stringify(look)
const DCL_CHAR_PREFIX = 'dcl:';

/**
 * 커스텀 DCL 아바타 인스턴스 생성. buildDclAvatar()가 비동기라 RPM URL 아바타와
 * 동일한 패턴을 쓴다 — 캡슐 폴백을 즉시 반환하고, 조립/리타게팅이 끝나면 그룹
 * 내부 콘텐츠만 교체한다(그룹 참조 자체는 유지 — 호출부가 이미 scene에 add했을 수 있음).
 */
function createDclAvatarInstance(charId, colorHex, nickname) {
  const group = new THREE.Group();
  let current = createFallbackAvatar(colorHex, nickname);
  group.add(current.group);
  let disposed = false;

  (async () => {
    const look = decodeLook(charId);
    if (!look) {
      console.warn(`잘못된 DCL 아바타 룩, 캡슐 폴백 사용: ${charId}`);
      return;
    }
    let built;
    try {
      built = await buildDclAvatar(look);
    } catch (err) {
      console.warn('DCL 아바타 조립 실패, 캡슐 폴백 사용:', err);
      return;
    }
    if (disposed) {
      built.dispose();
      return;
    }
    await loadRpmClips();
    if (disposed) {
      built.dispose();
      return;
    }

    let rigged;
    try {
      rigged = createDclAnimatedAvatar(built, colorHex, nickname);
    } catch (err) {
      console.warn('DCL 아바타 리깅 실패, 캡슐 폴백 유지:', err);
      built.dispose();
      return;
    }

    group.remove(current.group);
    current.dispose();
    current = rigged;
    group.add(current.group);
  })();

  return {
    group,
    update(delta, speed) {
      current.update(delta, speed);
    },
    dispose() {
      disposed = true;
      current.dispose();
    },
  };
}

// 커스텀 RPM 아바타 charId 프리픽스 — 'rpm:https://models.readyplayer.me/xxx.glb'
const RPM_URL_PREFIX = 'rpm:';

/**
 * 커스텀 RPM URL 아바타 인스턴스 생성.
 * 이미 캐시된 템플릿이 있으면 즉시 리깅 아바타로 반환한다. 아직 로드된 적이 없으면
 * 캡슐 폴백을 즉시 반환하면서 백그라운드로 로드를 시작하고, 로드가 끝나면 (그룹 참조는
 * 그대로 유지한 채) 내부 콘텐츠만 리깅 아바타로 교체한다 — 호출부(예: multiplayer.js)는
 * 최초 생성 시점에만 group을 scene에 add하고 이후 재사용하므로, 그룹 참조가 바뀌면
 * 안 된다. 로드 실패 시에는 캡슐 폴백을 그대로 유지한다.
 */
function createRpmUrlAvatarInstance(url, colorHex, nickname) {
  const cached = _rpmUrlTemplates.get(url);
  if (cached) {
    try {
      return createRiggedAvatar(cached, colorHex, nickname, _rpmClips);
    } catch (err) {
      console.warn(`커스텀 RPM 아바타 생성 실패(${url}), 캡슐 폴백 사용:`, err);
      return createFallbackAvatar(colorHex, nickname);
    }
  }
  if (_rpmUrlTemplates.has(url)) {
    // 이전에 로드를 시도했다가 실패한 URL — 재시도하지 않고 캡슐 폴백 고정
    return createFallbackAvatar(colorHex, nickname);
  }

  const group = new THREE.Group();
  let current = createFallbackAvatar(colorHex, nickname);
  group.add(current.group);
  let disposed = false;

  loadRpmUrlTemplateOnce(url).then(() => {
    if (disposed) return;
    const template = _rpmUrlTemplates.get(url);
    if (!template) return; // 로드 실패 — 캡슐 폴백 유지 (경고는 로더가 이미 출력)

    group.remove(current.group);
    current.dispose();
    try {
      current = createRiggedAvatar(template, colorHex, nickname, _rpmClips);
    } catch (err) {
      console.warn(`커스텀 RPM 아바타 생성 실패(${url}), 캡슐 폴백 사용:`, err);
      current = createFallbackAvatar(colorHex, nickname);
    }
    group.add(current.group);
  });

  return {
    group,
    update(delta, speed) {
      current.update(delta, speed);
    },
    dispose() {
      disposed = true;
      current.dispose();
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
 * @param {string} charId - CHARACTERS의 id (예: 'knight'), 커스텀 DCL 아바타를 가리키는
 *   'dcl:' + JSON.stringify(look) 형태의 문자열, 또는 커스텀 Ready Player Me 아바타를
 *   가리키는 'rpm:https://models.readyplayer.me/xxx.glb' 형태의 문자열.
 *   허용된 도메인이 아니거나 형식이 유효하지 않으면, 혹은 그 외 알 수 없는 값이면
 *   'knight'로 폴백한다.
 * @param {string} colorHex - 닉네임 라벨 테두리 색 (예: '#e74c3c')
 * @param {string} nickname - 머리 위 라벨 텍스트
 * @returns {{group: THREE.Group, update: (delta:number, speed:number)=>void, dispose: ()=>void}}
 */
export function createAvatarInstance(charId, colorHex, nickname) {
  if (typeof charId === 'string' && charId.startsWith(DCL_CHAR_PREFIX)) {
    return createDclAvatarInstance(charId, colorHex, nickname);
  }

  if (typeof charId === 'string' && charId.startsWith(RPM_URL_PREFIX)) {
    const url = charId.slice(RPM_URL_PREFIX.length);
    if (isAllowedRpmUrl(url)) {
      return createRpmUrlAvatarInstance(url, colorHex, nickname);
    }
    console.warn(`허용되지 않은 RPM 아바타 URL, '${DEFAULT_CHAR_ID}'로 폴백:`, url);
    charId = DEFAULT_CHAR_ID;
  }

  const charDef = CHARACTERS.find((c) => c.id === charId) || CHARACTERS.find((c) => c.id === DEFAULT_CHAR_ID);
  const resolvedId = charDef.id;
  const template = _templates.get(resolvedId);
  if (template) {
    try {
      const animOverride = charDef.anims === 'rpm' ? _rpmClips : null;
      return createRiggedAvatar(template, colorHex, nickname, animOverride, charDef.forwardOffset);
    } catch (err) {
      console.warn(`리깅 아바타(${resolvedId}) 생성 실패, 캡슐 폴백 사용:`, err);
    }
  }
  return createFallbackAvatar(colorHex, nickname);
}
