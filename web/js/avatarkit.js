// avatarkit.js — 자체 호스팅 아바타 커스터마이저 코어
// LifeUnity Metaverse — Decentraland base-avatars(Apache-2.0) 파츠를 런타임에 조립한다.
//
// 이 모듈은 순수 조립 로직만 담당한다(씬 추가/애니메이션/전방 보정은 avatar.js,
// UI는 ui.js). manifest.json 색인 + 개별 파츠 GLB/PNG를 런타임에 fetch해
// 하나의 THREE.Group으로 합친다.

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

// ---------------------------------------------------------------------------
// 상수 — 공개 API
// ---------------------------------------------------------------------------

export const DCL_BASE = './assets/dcl';

// 밝은 → 어두운 자연 피부톤 8종 (DCL 팔레트 느낌)
export const SKIN_TONES = [
  '#fbe0c8',
  '#f2c8a0',
  '#e0a877',
  '#c98a5c',
  '#a86b42',
  '#8a5232',
  '#6b3d24',
  '#432818',
];

// 검정/갈색계 4 + 금발/빨강 + 파랑/분홍/보라/민트(귀여움 옵션) = 10종
export const HAIR_COLORS = [
  '#1c1c1c', // 검정
  '#3a2a1e', // 다크 브라운
  '#6b4423', // 미디엄 브라운
  '#a9754f', // 라이트 브라운 (밤색)
  '#e8c27a', // 금발
  '#b34a2c', // 레드/오번
  '#4a7fd6', // 파랑
  '#ef8fc4', // 분홍
  '#9b6fd6', // 보라
  '#6fd6b8', // 민트
];

/**
 * Look 스키마 (JSDoc 참고용):
 * {
 *   shape: 'male'|'female', hair: id|null, top: id, bottom: id, feet: id,
 *   eyes: id, brows: id, mouth: id, glasses: id|null,
 *   skin: '#rrggbb', hairColor: '#rrggbb', cute: 0~1
 * }
 */
export const DEFAULT_LOOK = {
  shape: 'female',
  hair: 'F_Hair_TwoTails',
  top: 'F_uBody_PinkBasicTShirt',
  bottom: 'F_lBody_SchoolSkirt',
  feet: 'F_BunShoes_01',
  eyes: 'F_Eyes_01',
  brows: 'F_Eyebrows_00',
  mouth: 'F_Mouth_00',
  glasses: null,
  skin: '#f2c8a0',
  hairColor: '#3a2a1e',
  cute: 0.6,
};

// ---------------------------------------------------------------------------
// manifest 로드 + 캐시
// ---------------------------------------------------------------------------

let _manifestPromise = null;
let _manifestCache = null;

/**
 * manifest.json을 1회만 fetch해 캐시한다. 여러 곳에서 호출돼도 네트워크 요청은 1회.
 * @returns {Promise<object>}
 */
export async function loadPartsManifest() {
  if (_manifestCache) return _manifestCache;
  if (!_manifestPromise) {
    _manifestPromise = fetch(`${DCL_BASE}/manifest.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`manifest.json 로드 실패: HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        _manifestCache = json;
        return json;
      });
  }
  return _manifestPromise;
}

function getManifestItem(manifest, category, id) {
  const list = manifest && manifest.categories && manifest.categories[category];
  if (!Array.isArray(list) || id == null) return null;
  return list.find((it) => it.id === id) || null;
}

function pickBodyItem(manifest, shape) {
  const list = (manifest && manifest.categories && manifest.categories.body_shape) || [];
  return list.find((it) => it.models && it.models[shape]) || list[0] || null;
}

// ---------------------------------------------------------------------------
// Look 정규화 / 인코딩 / 디코딩
// ---------------------------------------------------------------------------

// look 필드 → manifest 카테고리 키 매핑
const PART_FIELD_TO_CATEGORY = {
  hair: 'hair',
  top: 'upper_body',
  bottom: 'lower_body',
  feet: 'feet',
  eyes: 'eyes',
  brows: 'eyebrows',
  mouth: 'mouth',
  glasses: 'eyewear',
};
const NULLABLE_FIELDS = new Set(['hair', 'glasses']);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * 임의의 입력을 안전한 Look 객체로 정규화한다. manifest가 주어지면 파츠 id가
 * 실제 존재하고 현재 체형에서 착용 가능한지까지 검증해, 미보유/미지원 id는
 * DEFAULT_LOOK 값(널 허용 필드는 null)으로 대체한다.
 * @param {object} look
 * @param {object|null} [manifest]
 * @returns {object}
 */
function normalizeLook(look, manifest) {
  const src = look && typeof look === 'object' ? look : {};

  const out = {
    shape: src.shape === 'male' ? 'male' : src.shape === 'female' ? 'female' : DEFAULT_LOOK.shape,
    skin: typeof src.skin === 'string' && HEX_RE.test(src.skin) ? src.skin : DEFAULT_LOOK.skin,
    hairColor:
      typeof src.hairColor === 'string' && HEX_RE.test(src.hairColor) ? src.hairColor : DEFAULT_LOOK.hairColor,
    cute: Number.isFinite(src.cute) ? Math.min(1, Math.max(0, src.cute)) : DEFAULT_LOOK.cute,
  };

  for (const [field, category] of Object.entries(PART_FIELD_TO_CATEGORY)) {
    let val = typeof src[field] === 'string' ? src[field] : null;
    if (val === null) {
      val = NULLABLE_FIELDS.has(field) ? null : DEFAULT_LOOK[field];
    }
    if (manifest && val != null) {
      const item = getManifestItem(manifest, category, val);
      if (!item || !item.models || !item.models[out.shape]) {
        val = NULLABLE_FIELDS.has(field) ? null : DEFAULT_LOOK[field];
      }
    }
    out[field] = val;
  }

  return out;
}

/**
 * @param {object} look
 * @returns {string} 'dcl:' + JSON.stringify(정규화된 look)
 */
export function encodeLook(look) {
  return 'dcl:' + JSON.stringify(normalizeLook(look, _manifestCache));
}

/**
 * @param {string} str
 * @returns {object|null} look 객체, 형식이 아니면 null. 미보유 파츠 id는 기본값으로 대체.
 */
export function decodeLook(str) {
  if (typeof str !== 'string' || !str.startsWith('dcl:')) return null;
  let parsed;
  try {
    parsed = JSON.parse(str.slice(4));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  return normalizeLook(parsed, _manifestCache);
}

// ---------------------------------------------------------------------------
// 조립
// ---------------------------------------------------------------------------

function tintClonedMaterial(mesh, look, disposables) {
  const isArray = Array.isArray(mesh.material);
  const mats = isArray ? mesh.material : [mesh.material];
  const cloned = mats.map((m) => {
    if (!m) return m;
    const c = m.clone();
    disposables.materials.push(c);
    const name = (c.name || '').toLowerCase();
    if (name.includes('skin')) {
      try {
        c.color.set(look.skin);
      } catch {
        /* 색상 파싱 실패 시 원래 재질 색 유지 */
      }
    } else if (name.includes('hair')) {
      try {
        c.color.set(look.hairColor);
      } catch {
        /* noop */
      }
    }
    return c;
  });
  mesh.material = isArray ? cloned : cloned[0];
}

function rebindToBaseSkeleton(mesh, boneByName) {
  if (!mesh.skeleton) return;
  const bones = mesh.skeleton.bones.map((b) => boneByName.get(b.name) || b);
  mesh.bind(new THREE.Skeleton(bones, mesh.skeleton.boneInverses), mesh.bindMatrix);
}

/**
 * Look을 조립해 렌더 가능한 아바타를 만든다. 실패한 개별 파츠는 건너뛰고
 * 콘솔 경고만 남긴다(전체 실패는 베이스 체형 로드 실패 시에만 발생).
 * @param {object} look
 * @returns {Promise<{group: THREE.Group, skeleton: THREE.Skeleton, dispose: () => void}>}
 */
export async function buildDclAvatar(look) {
  const manifest = await loadPartsManifest();
  const normalized = normalizeLook(look, manifest);

  const group = new THREE.Group();
  const disposables = { materials: [], textures: [] };
  const loader = new GLTFLoader();
  const texLoader = new THREE.TextureLoader();

  const bodyItem = pickBodyItem(manifest, normalized.shape);
  if (!bodyItem) throw new Error('DCL 베이스 체형 파츠를 manifest에서 찾을 수 없습니다.');
  const bodyFile = bodyItem.models[normalized.shape];
  if (!bodyFile) throw new Error(`DCL 베이스 체형(${bodyItem.id})이 ${normalized.shape} 체형을 지원하지 않습니다.`);
  const bodyUrl = `${DCL_BASE}/body_shape/${bodyItem.id}/${bodyFile}`;

  let bodyGltf;
  try {
    bodyGltf = await loader.loadAsync(bodyUrl);
  } catch (err) {
    throw new Error(`DCL 베이스 체형(${bodyItem.id}) 로드 실패: ${(err && err.message) || err}`);
  }
  const bodyRoot = bodyGltf.scene;
  group.add(bodyRoot);
  bodyRoot.updateMatrixWorld(true);

  let baseSkinnedMesh = null;
  bodyRoot.traverse((o) => {
    if (!baseSkinnedMesh && o.isSkinnedMesh) baseSkinnedMesh = o;
  });
  if (!baseSkinnedMesh || !baseSkinnedMesh.skeleton) {
    throw new Error(`DCL 베이스 체형(${bodyItem.id})에서 스켈레톤을 찾지 못했습니다.`);
  }
  const skeleton = baseSkinnedMesh.skeleton;
  const boneByName = new Map();
  for (const b of skeleton.bones) boneByName.set(b.name, b);

  // 베이스 파츠 역할별 분류(이름 부분일치) — 웨어러블 장착 시 숨김 처리 대상
  const baseByRole = { uBody: [], lBody: [], feet: [], maskEyes: [], maskEyebrows: [], maskMouth: [] };
  bodyRoot.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const n = o.name || '';
    if (n.includes('uBody_BaseMesh')) baseByRole.uBody.push(o);
    else if (n.includes('lBody_BaseMesh')) baseByRole.lBody.push(o);
    else if (n.includes('Feet_BaseMesh')) baseByRole.feet.push(o);
    else if (n.includes('Mask_Eyes')) baseByRole.maskEyes.push(o);
    else if (n.includes('Mask_Eyebrows')) baseByRole.maskEyebrows.push(o);
    else if (n.includes('Mask_Mouth')) baseByRole.maskMouth.push(o);
    // Head/Hands_BaseMesh는 역할 목록에 넣지 않음 — 항상 표시(숨김 대상 아님)
  });

  // 베이스 전체 재질 clone + 틴트 (얼굴 텍스처는 이후 이 clone 위에 적용)
  bodyRoot.traverse((o) => {
    if (o.isSkinnedMesh) tintClonedMaterial(o, normalized, disposables);
  });

  async function loadWearable(category, id, hideGroups) {
    if (!id) return;
    const item = getManifestItem(manifest, category, id);
    if (!item) {
      console.warn(`[avatarkit] DCL 파츠를 찾을 수 없음: ${category}/${id}`);
      return;
    }
    const file = item.models[normalized.shape];
    if (!file) {
      console.warn(`[avatarkit] DCL 파츠(${id})는 ${normalized.shape} 체형을 지원하지 않음`);
      return;
    }
    const url = `${DCL_BASE}/${category}/${item.id}/${file}`;
    let gltf;
    try {
      gltf = await loader.loadAsync(url);
    } catch (err) {
      console.warn(`[avatarkit] DCL 파츠 로드 실패(${url}):`, err);
      return;
    }
    const root = gltf.scene;
    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      rebindToBaseSkeleton(o, boneByName);
      tintClonedMaterial(o, normalized, disposables);
    });
    group.add(root);
    for (const list of hideGroups) {
      for (const m of list) m.visible = false;
    }
  }

  await Promise.all([
    loadWearable('hair', normalized.hair, []),
    loadWearable('upper_body', normalized.top, [baseByRole.uBody]),
    loadWearable('lower_body', normalized.bottom, [baseByRole.lBody]),
    loadWearable('feet', normalized.feet, [baseByRole.feet]),
    loadWearable('eyewear', normalized.glasses, []),
  ]);

  // 얼굴 텍스처(눈/눈썹/입) — PNG를 해당 Mask 메쉬 재질(이미 clone됨)의 map으로 지정
  async function applyFaceTexture(category, id, meshList) {
    if (!id || meshList.length === 0) return;
    const item = getManifestItem(manifest, category, id);
    if (!item) {
      console.warn(`[avatarkit] DCL 얼굴 파츠를 찾을 수 없음: ${category}/${id}`);
      return;
    }
    const file = item.models[normalized.shape];
    if (!file) {
      console.warn(`[avatarkit] DCL 얼굴 파츠(${id})는 ${normalized.shape} 체형을 지원하지 않음`);
      return;
    }
    const url = `${DCL_BASE}/${category}/${item.id}/${file}`;
    let tex;
    try {
      tex = await texLoader.loadAsync(url);
    } catch (err) {
      console.warn(`[avatarkit] DCL 얼굴 텍스처 로드 실패(${url}):`, err);
      return;
    }
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    disposables.textures.push(tex);
    for (const mesh of meshList) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m) continue;
        m.map = tex;
        m.transparent = true;
        m.opacity = 1;
        m.alphaTest = 0.01;
        m.needsUpdate = true;
      }
    }
  }

  await Promise.all([
    applyFaceTexture('eyes', normalized.eyes, baseByRole.maskEyes),
    applyFaceTexture('eyebrows', normalized.brows, baseByRole.maskEyebrows),
    applyFaceTexture('mouth', normalized.mouth, baseByRole.maskMouth),
  ]);

  // 귀여움: 머리 뼈 스케일 — 헤어/안경/얼굴 마스크는 머리 뼈에 스킨되어 함께 커진다
  const headBone = boneByName.get('Avatar_Head');
  if (headBone) headBone.scale.setScalar(1 + normalized.cute * 0.5);

  group.updateMatrixWorld(true);

  return {
    group,
    skeleton,
    dispose() {
      for (const m of disposables.materials) {
        try {
          m.dispose();
        } catch {
          /* noop */
        }
      }
      for (const t of disposables.textures) {
        try {
          t.dispose();
        } catch {
          /* noop */
        }
      }
    },
  };
}

// ---------------------------------------------------------------------------
// RPM 클립 → DCL 리그 리타게팅
// ---------------------------------------------------------------------------

/**
 * Mixamo 표준 본 이름(RPM) 트랙을 'Avatar_' 접두어 DCL 리그용으로 복제한다.
 * Hips의 position 트랙 값에는 hipsScale을 곱한다(리그 높이 비율 보정).
 * 그 외 본의 position 트랙은 드롭한다(회전 트랙만 유지).
 * @param {THREE.AnimationClip} clip
 * @param {number} [hipsScale]
 * @returns {THREE.AnimationClip|null}
 */
export function retargetClipForDcl(clip, hipsScale = 1) {
  if (!clip) return null;
  const scale = Number.isFinite(hipsScale) && hipsScale > 0 ? hipsScale : 1;

  const tracks = [];
  for (const track of clip.tracks) {
    const dot = track.name.lastIndexOf('.');
    if (dot === -1) continue;
    const nodeName = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    if (prop === 'position' && nodeName !== 'Hips') continue; // 다른 본 position 트랙은 드롭

    const targetName = nodeName.startsWith('Avatar_') ? nodeName : `Avatar_${nodeName}`;
    const newTrack = track.clone();
    newTrack.name = `${targetName}.${prop}`;

    if (prop === 'position' && nodeName === 'Hips' && scale !== 1) {
      const values = newTrack.values;
      for (let i = 0; i < values.length; i++) values[i] *= scale;
    }
    tracks.push(newTrack);
  }

  return new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
}
