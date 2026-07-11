// chibi.js — 자체 제작 치비(SD) 캐릭터 생성기
// ARTSHOW Metaverse — 외부 에셋 0: three.js 프리미티브 + 캔버스 얼굴 텍스처만으로
// "애니멀 크로싱 공식"(큰 머리 + 왕눈이 + 단순한 몸)을 코드로 조립한다.
//
// 설계 원칙
// - 스키닝/리타게팅 없음: 뼈 대신 피벗 Group 계층에 파츠를 강체로 붙이고,
//   걷기/숨쉬기/찰랑임은 update()에서 사인파로 직접 구동한다. GLB 리깅 계열
//   버그(스프링본 동결·문워크·손목 붕괴)가 구조적으로 발생하지 않는다.
// - 파라미터가 곧 아바타: look 객체(JSON)만 주고받으면 어디서든 동일하게 재조립
//   가능 — 멀티플레이 동기화는 'chibi:'+JSON 문자열 하나로 끝난다.
// - 전방 +Z 저작: KayKit/DCL과 동일하게 π 래퍼로 감싸 게임 관례(yaw=0 → -Z)에 맞춘다.

import * as THREE from 'three';
import { mergeGeometries } from '../utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// 파라미터 정의 (UI와 공유하는 단일 진실 소스)
// ---------------------------------------------------------------------------
export const CHIBI_HAIR_STYLES = [
  { id: 'twintail', name: '트윈테일' },
  { id: 'bob', name: '단발' },
  { id: 'ponytail', name: '포니테일' },
  { id: 'buns', name: '경단머리' },
  { id: 'short', name: '숏컷' },
];
export const CHIBI_EYE_STYLES = [
  { id: 'sparkle', name: '반짝' },
  { id: 'round', name: '동글' },
  { id: 'happy', name: '스마일' },
];
export const CHIBI_MOUTH_STYLES = [
  { id: 'smile', name: '미소' },
  { id: 'cat', name: '고양이' },
  { id: 'open', name: '벌림' },
];
export const CHIBI_BOTTOM_TYPES = [
  { id: 'skirt', name: '치마' },
  { id: 'pants', name: '바지' },
];
export const CHIBI_ACCESSORIES = [
  { id: 'none', name: '없음' },
  { id: 'ribbon', name: '리본' },
  { id: 'flower', name: '꽃' },
  { id: 'horns', name: '뿔' },
];

export const DEFAULT_CHIBI = {
  skin: '#ffd9bd',
  hairStyle: 'twintail',
  hairColor: '#6b4530',
  eyeStyle: 'sparkle',
  eyeColor: '#7a4a2f',
  mouth: 'smile',
  blush: true,
  top: '#ff8fab',
  bottom: '#5468c4',
  bottomType: 'skirt',
  shoes: '#fffdf7',
  acc: 'ribbon',
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ID_OF = (list) => new Set(list.map((x) => x.id));
const HAIR_IDS = ID_OF(CHIBI_HAIR_STYLES);
const EYE_IDS = ID_OF(CHIBI_EYE_STYLES);
const MOUTH_IDS = ID_OF(CHIBI_MOUTH_STYLES);
const BOTTOM_IDS = ID_OF(CHIBI_BOTTOM_TYPES);
const ACC_IDS = ID_OF(CHIBI_ACCESSORIES);

/** 임의 입력을 안전한 치비 파라미터로 정규화한다. */
export function normalizeChibi(p) {
  const src = p && typeof p === 'object' ? p : {};
  const hex = (v, d) => (typeof v === 'string' && HEX_RE.test(v) ? v : d);
  const pick = (v, ids, d) => (typeof v === 'string' && ids.has(v) ? v : d);
  return {
    skin: hex(src.skin, DEFAULT_CHIBI.skin),
    hairStyle: pick(src.hairStyle, HAIR_IDS, DEFAULT_CHIBI.hairStyle),
    hairColor: hex(src.hairColor, DEFAULT_CHIBI.hairColor),
    eyeStyle: pick(src.eyeStyle, EYE_IDS, DEFAULT_CHIBI.eyeStyle),
    eyeColor: hex(src.eyeColor, DEFAULT_CHIBI.eyeColor),
    mouth: pick(src.mouth, MOUTH_IDS, DEFAULT_CHIBI.mouth),
    blush: src.blush !== false,
    top: hex(src.top, DEFAULT_CHIBI.top),
    bottom: hex(src.bottom, DEFAULT_CHIBI.bottom),
    bottomType: pick(src.bottomType, BOTTOM_IDS, DEFAULT_CHIBI.bottomType),
    shoes: hex(src.shoes, DEFAULT_CHIBI.shoes),
    acc: pick(src.acc, ACC_IDS, DEFAULT_CHIBI.acc),
  };
}

export const CHIBI_CHAR_PREFIX = 'chibi:';

export function encodeChibi(p) {
  return CHIBI_CHAR_PREFIX + JSON.stringify(normalizeChibi(p));
}

/** 'chibi:'+JSON 문자열 → 파라미터 객체 (실패 시 null) */
export function decodeChibi(charId) {
  if (typeof charId !== 'string' || !charId.startsWith(CHIBI_CHAR_PREFIX)) return null;
  try {
    return normalizeChibi(JSON.parse(charId.slice(CHIBI_CHAR_PREFIX.length)));
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 얼굴 캔버스 — 귀여움의 8할. 512² 투명 캔버스에 왕눈이/입/볼터치를 그려
// 머리 구의 전면 캡에 매핑한다.
// ---------------------------------------------------------------------------
function shade(hexColor, factor) {
  const c = new THREE.Color(hexColor);
  c.multiplyScalar(factor);
  return `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
}

function drawEye(ctx, cx, cy, p) {
  const EW = 42, EH = 60; // 반지름 (가로/세로)
  if (p.eyeStyle === 'happy') {
    // 감은 웃는 눈 (∩)
    ctx.strokeStyle = '#2a2320';
    ctx.lineCap = 'round';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(cx, cy + 26, EW + 4, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
    return;
  }
  // 흰자 — 살짝만 (없으면 스티커 같고, 크면 무서움)
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, EW + 7, EH + 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 홍채 — 위가 밝고 아래로 갈수록 짙은 세로 그라디언트
  const grad = ctx.createLinearGradient(cx, cy - EH, cx, cy + EH);
  grad.addColorStop(0, shade(p.eyeColor, 1.25));
  grad.addColorStop(0.55, p.eyeColor);
  grad.addColorStop(1, shade(p.eyeColor, 0.45));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, EW, EH, 0, 0, Math.PI * 2);
  ctx.fill();
  // 동공
  ctx.fillStyle = 'rgba(25,18,14,0.9)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 6, EW * 0.42, EH * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  // 하이라이트 — 큰 것 좌상 + 작은 것 우하 (생기의 핵심)
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx - 14, cy - 22, 15, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 13, cy + 20, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // 윗눈꺼풀 라인 (속눈썹 느낌)
  ctx.strokeStyle = '#2a2320';
  ctx.lineCap = 'round';
  ctx.lineWidth = p.eyeStyle === 'round' ? 9 : 14;
  ctx.beginPath();
  ctx.arc(cx, cy - 4, EW + 9, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
}

/**
 * 얼굴을 캔버스에 그린다. fx로 아픔/상처 상태를 표현한다:
 *   fx.ouch  — 맞은 직후 >_< 표정 (눈·입 오버라이드)
 *   fx.wound — 누적 상처 0~3 (1: 반창고, 2: +멍/처진 눈썹, 3: +눈물)
 */
function drawFaceInto(canvas, p, fx) {
  const wound = (fx && fx.wound) || 0;
  const ouch = !!(fx && fx.ouch);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);

  const EYE_Y = 252;
  if (ouch) {
    // >_< 눈 — 아픔의 만국 공통어
    ctx.strokeStyle = '#2a2320';
    ctx.lineCap = 'round';
    ctx.lineWidth = 15;
    for (const s of [-1, 1]) {
      const cx = 256 + s * 88;
      ctx.beginPath();
      ctx.moveTo(cx - s * 34, EYE_Y - 30);
      ctx.lineTo(cx + s * 24, EYE_Y + 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - s * 34, EYE_Y + 34);
      ctx.lineTo(cx + s * 24, EYE_Y + 2);
      ctx.stroke();
    }
  } else {
    drawEye(ctx, 256 - 88, EYE_Y, p);
    drawEye(ctx, 256 + 88, EYE_Y, p);
  }

  // 눈썹 — 평소 아치, 상처 2+ 는 팔자(슬픔), 아픔 순간은 안쪽으로 찌푸림
  ctx.strokeStyle = shade(p.hairColor, 0.8);
  ctx.lineCap = 'round';
  ctx.lineWidth = 9;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (ouch) {
      ctx.moveTo(256 + s * 58, EYE_Y - 92);
      ctx.lineTo(256 + s * 112, EYE_Y - 72);
    } else if (wound >= 2) {
      ctx.moveTo(256 + s * 60, EYE_Y - 74);
      ctx.lineTo(256 + s * 112, EYE_Y - 94);
    } else {
      ctx.arc(256 + s * 88, EYE_Y - 58, 36, Math.PI * 1.25, Math.PI * 1.75);
    }
    ctx.stroke();
  }

  // 입
  const MY = 368;
  ctx.strokeStyle = '#b0605a';
  ctx.lineCap = 'round';
  if (ouch) {
    // 크게 벌린 울상
    ctx.fillStyle = '#a14a44';
    ctx.beginPath();
    ctx.ellipse(256, MY, 34, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e58a80';
    ctx.beginPath();
    ctx.ellipse(256, MY + 12, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.mouth === 'cat') {
    ctx.lineWidth = 9;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(256 + s * 14, MY - 8, 15, s === -1 ? 0.15 * Math.PI : 0.35 * Math.PI, s === -1 ? 0.65 * Math.PI : 0.85 * Math.PI);
      ctx.stroke();
    }
  } else if (p.mouth === 'open') {
    ctx.fillStyle = '#a14a44';
    ctx.beginPath();
    ctx.ellipse(256, MY, 24, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e58a80';
    ctx.beginPath();
    ctx.ellipse(256, MY + 8, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(256, MY - 14, 26, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }

  // 볼터치
  if (p.blush && !ouch) {
    ctx.fillStyle = 'rgba(255,140,140,0.38)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(256 + s * 158, 330, 40, 24, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 상처 1+: 오른쪽 볼 반창고
  if (wound >= 1) {
    ctx.save();
    ctx.translate(256 + 152, 326);
    ctx.rotate(-0.5);
    ctx.fillStyle = '#e8c9a0';
    ctx.fillRect(-40, -13, 80, 26);
    ctx.fillStyle = '#d9b88d';
    ctx.fillRect(-15, -13, 30, 26);
    ctx.restore();
  }
  // 상처 2+: 왼쪽 볼 멍
  if (wound >= 2) {
    ctx.fillStyle = 'rgba(110,90,200,0.45)';
    ctx.beginPath();
    ctx.ellipse(256 - 152, 320, 32, 21, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // 상처 3: 그렁그렁 눈물
  if (wound >= 3 && !ouch) {
    ctx.fillStyle = 'rgba(130,185,255,0.85)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(256 + s * 88, EYE_Y + 80, 10, 16, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFaceCanvas(p) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  drawFaceInto(canvas, p, null);
  return canvas;
}

// ---------------------------------------------------------------------------
// 파츠 빌더
// ---------------------------------------------------------------------------
function toon(color, doubleSide) {
  // 회전체(치마/꽁지머리)와 열린 구 세그먼트(뒷머리 커튼)는 프로파일 방향에 따라
  // 법선이 안쪽을 향할 수 있어 DoubleSide가 필수다 — 앞면 컬링으로 "안 보이는
  // 치마" 버그가 났던 실측 교훈.
  return new THREE.MeshToonMaterial({ color, side: doubleSide ? THREE.DoubleSide : THREE.FrontSide });
}

/** 뒷면 확장 셸 방식 외곽선 — 셀룩의 마감 (머리·몸 등 큰 파츠에만). */
function addOutline(mesh, thickness, collect) {
  const mat = new THREE.MeshBasicMaterial({ color: '#463a30', side: THREE.BackSide });
  const outline = new THREE.Mesh(mesh.geometry, mat);
  outline.scale.setScalar(thickness);
  mesh.add(outline);
  collect.push(mat);
}

function lathePoints(pairs) {
  return pairs.map(([x, y]) => new THREE.Vector2(x, y));
}

/**
 * 치비 아바타를 조립한다 (동기 — 로드 없음).
 * @param {object} params - normalizeChibi 형태의 파라미터 (생략 시 기본 룩)
 * @returns {{group: THREE.Group, height: number, update: (delta:number, speed:number)=>void, dispose: ()=>void}}
 */
export function buildChibi(params) {
  const p = normalizeChibi(params);
  const mats = []; // dispose 대상
  const geos = [];
  const texs = [];

  const mkGeo = (g) => {
    geos.push(g);
    return g;
  };
  const mkMat = (m) => {
    mats.push(m);
    return m;
  };

  // ---- 루트/래퍼 (전방 +Z 저작 → π 보정) ----
  const group = new THREE.Group();
  const wrapper = new THREE.Group();
  wrapper.rotation.y = Math.PI;
  group.add(wrapper);

  const skinMat = mkMat(toon(p.skin));
  const hairMat = mkMat(toon(p.hairColor, true));
  const topMat = mkMat(toon(p.top));
  const bottomMat = mkMat(toon(p.bottom, true));
  const shoeMat = mkMat(toon(p.shoes));

  // ---- 하반신: 다리 피벗(고관절) ----
  const HIP_Y = 0.44;
  const legPivots = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.085, HIP_Y, 0);
    const legMat = p.bottomType === 'pants' ? bottomMat : skinMat;
    const leg = new THREE.Mesh(mkGeo(new THREE.CapsuleGeometry(0.055, 0.2, 6, 12)), legMat);
    leg.position.y = -0.19;
    pivot.add(leg);
    const foot = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.082, 16, 12)), shoeMat);
    foot.scale.set(1, 0.72, 1.25);
    foot.position.set(0, -0.375, 0.03);
    pivot.add(foot);
    wrapper.add(pivot);
    legPivots.push(pivot);
  }

  // ---- 몸통 ----
  const torso = new THREE.Mesh(mkGeo(new THREE.CapsuleGeometry(0.155, 0.17, 8, 16)), topMat);
  torso.position.y = 0.585;
  torso.scale.set(1, 1, 0.9);
  addOutline(torso, 1.05, mats);
  wrapper.add(torso);

  if (p.bottomType === 'skirt') {
    const skirt = new THREE.Mesh(
      mkGeo(new THREE.LatheGeometry(lathePoints([[0.165, 0.03], [0.22, -0.03], [0.29, -0.13], [0.3, -0.155]]), 24)),
      bottomMat
    );
    skirt.position.y = 0.56;
    wrapper.add(skirt);
  } else {
    // 바지: 골반 덮개
    const shorts = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.35)), bottomMat);
    shorts.position.y = 0.5;
    wrapper.add(shorts);
  }

  // ---- 팔 피벗(어깨) ----
  const armPivots = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.172, 0.7, 0);
    pivot.rotation.z = s * 0.5; // 살짝 벌린 기본 자세
    const arm = new THREE.Mesh(mkGeo(new THREE.CapsuleGeometry(0.05, 0.15, 6, 12)), skinMat);
    arm.position.y = -0.115;
    pivot.add(arm);
    // 소매 캡 (상의색)
    const sleeve = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.07, 12, 10)), topMat);
    sleeve.position.y = -0.02;
    sleeve.scale.set(1, 0.8, 1);
    pivot.add(sleeve);
    wrapper.add(pivot);
    armPivots.push(pivot);
  }

  // ---- 머리 피벗(목) ----
  const headPivot = new THREE.Group();
  headPivot.position.y = 0.78;
  wrapper.add(headPivot);

  const HEAD_R = 0.3;
  const skull = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(HEAD_R, 32, 24)), skinMat);
  skull.scale.set(1, 0.95, 0.97);
  skull.position.y = 0.25;
  addOutline(skull, 1.045, mats);
  headPivot.add(skull);

  // 얼굴 캡 (+Z 전면) — 캔버스 텍스처 (상처/아픔 시 제자리에서 다시 그린다)
  const faceCanvas = drawFaceCanvas(p);
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  texs.push(faceTex);
  const FACE_PHI = 1.85;
  const faceGeo = mkGeo(
    new THREE.SphereGeometry(HEAD_R * 1.012, 32, 24, Math.PI / 2 - FACE_PHI / 2, FACE_PHI, Math.PI * 0.33, Math.PI * 0.4)
  );
  const faceMat = mkMat(
    new THREE.MeshToonMaterial({ map: faceTex, transparent: true, alphaTest: 0.02 })
  );
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.scale.copy(skull.scale);
  face.position.copy(skull.position);
  headPivot.add(face);

  // ---- 헤어 ----
  const HAIR_R = HEAD_R * 1.07;
  const hairRoot = new THREE.Group();
  hairRoot.position.copy(skull.position);
  headPivot.add(hairRoot);
  const tailPivots = []; // 찰랑임 애니메이션 대상

  // 공통 헬멧 셸 (앞이마 위 ~ 뒤통수)
  const shell = new THREE.Mesh(
    mkGeo(new THREE.SphereGeometry(HAIR_R, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.44)),
    hairMat
  );
  addOutline(shell, 1.04, mats);
  hairRoot.add(shell);
  // 뒷머리 커튼 + 앞머리(뱅) — 같은 재질의 정적 파츠라 지오메트리 병합으로
  // 1드로우콜에 그린다 (아바타당 3~4콜 절약, 관객 7명이면 25콜+).
  const staticHairGeos = [];
  if (p.hairStyle !== 'short') {
    const FRONT_OPEN = 1.95;
    staticHairGeos.push(
      new THREE.SphereGeometry(HAIR_R * 0.995, 32, 16, Math.PI / 2 + FRONT_OPEN / 2, Math.PI * 2 - FRONT_OPEN, Math.PI * 0.3, Math.PI * (p.hairStyle === 'bob' ? 0.42 : 0.34))
    );
  }
  for (const [bx, bs] of [[-0.13, 0.105], [0.0, 0.12], [0.13, 0.105]]) {
    const bang = new THREE.SphereGeometry(bs, 14, 10);
    bang.scale(1, 0.52, 0.5);
    bang.translate(bx, 0.21, 0.235);
    staticHairGeos.push(bang);
  }
  if (staticHairGeos.length) {
    const mergedHair = new THREE.Mesh(mkGeo(mergeGeometries(staticHairGeos)), hairMat);
    staticHairGeos.forEach((g) => g.dispose());
    hairRoot.add(mergedHair);
  }

  const tailProfile = lathePoints([[0.015, 0.03], [0.075, -0.03], [0.085, -0.14], [0.055, -0.26], [0.008, -0.36]]);
  if (p.hairStyle === 'twintail') {
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.27, 0.22, -0.07);
      pivot.rotation.z = s * 0.35;
      const tail = new THREE.Mesh(mkGeo(new THREE.LatheGeometry(tailProfile, 16)), hairMat);
      tail.scale.setScalar(1.15);
      pivot.add(tail);
      // 묶은 자리 방울
      const tie = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.06, 10, 8)), mkMat(toon('#ffd166')));
      tie.position.y = 0.03;
      pivot.add(tie);
      hairRoot.add(pivot);
      tailPivots.push({ pivot, baseZ: pivot.rotation.z, baseX: 0 });
    }
  } else if (p.hairStyle === 'ponytail') {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.16, -0.26);
    pivot.rotation.x = -0.5;
    const tail = new THREE.Mesh(mkGeo(new THREE.LatheGeometry(tailProfile, 16)), hairMat);
    tail.scale.setScalar(1.25);
    pivot.add(tail);
    hairRoot.add(pivot);
    tailPivots.push({ pivot, baseZ: 0, baseX: pivot.rotation.x });
  } else if (p.hairStyle === 'buns') {
    for (const s of [-1, 1]) {
      const bun = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.1, 14, 12)), hairMat);
      bun.position.set(s * 0.2, 0.26, -0.04);
      addOutline(bun, 1.07, mats);
      hairRoot.add(bun);
    }
  }
  // 'bob'/'short'는 셸+커튼(+뱅)으로 완성

  // ---- 액세서리 ----
  if (p.acc === 'ribbon') {
    const rib = new THREE.Group();
    rib.position.set(0.17, 0.27, 0.13);
    rib.rotation.z = -0.25;
    const ribMat = mkMat(toon('#ff5d73'));
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(mkGeo(new THREE.ConeGeometry(0.05, 0.1, 10)), ribMat);
      wing.rotation.z = s * (Math.PI / 2);
      wing.position.x = s * 0.055;
      rib.add(wing);
    }
    const knot = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.032, 10, 8)), ribMat);
    rib.add(knot);
    hairRoot.add(rib);
  } else if (p.acc === 'horns') {
    const hornMat = mkMat(toon('#c0392b'));
    for (const s of [-1, 1]) {
      const horn = new THREE.Mesh(mkGeo(new THREE.ConeGeometry(0.055, 0.17, 10)), hornMat);
      horn.position.set(s * 0.17, 0.33, 0.04);
      horn.rotation.z = -s * 0.42; // 바깥쪽으로 벌어진 도깨비 뿔
      addOutline(horn, 1.12, mats);
      hairRoot.add(horn);
    }
  } else if (p.acc === 'flower') {
    const fl = new THREE.Group();
    fl.position.set(0.18, 0.25, 0.15);
    const petalMat = mkMat(toon('#ffd166'));
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.032, 8, 6)), petalMat);
      petal.position.set(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0);
      petal.scale.z = 0.5;
      fl.add(petal);
    }
    const core = new THREE.Mesh(mkGeo(new THREE.SphereGeometry(0.026, 8, 6)), mkMat(toon('#ff8c42')));
    core.position.z = 0.012;
    fl.add(core);
    hairRoot.add(fl);
  }

  // ---------------------------------------------------------------------------
  // 절차 애니메이션 — 사인파 워크사이클 + 아이들 호흡/살랑임
  // ---------------------------------------------------------------------------
  let t = Math.random() * 10; // 개체별 위상 오프셋 (군집 동기화 방지)
  let walkPhase = 0;
  const HEIGHT = 1.34;

  // ---- 맞기 리액션 상태 ----
  const SQUASH_DUR = 0.55;
  let wound = 0;   // 누적 상처 0~3 (얼굴에 반창고/멍/눈물)
  let ouchT = 0;   // >_< 표정 남은 시간
  let squashT = 0; // 움찔 스쿼시 남은 시간

  function refreshFace() {
    drawFaceInto(faceCanvas, p, { wound, ouch: ouchT > 0 });
    faceTex.needsUpdate = true;
  }

  /** 누적 상처 단계 설정 (0~3) — 회복 감쇠에서도 호출된다 */
  function setWound(level) {
    const next = Math.max(0, Math.min(3, Math.floor(level) || 0));
    if (next === wound) return;
    wound = next;
    refreshFace();
  }

  /** 맞았다! — 움찔 + >_< 표정 (표정은 잠시 후 자동 복귀) */
  function ouch() {
    ouchT = 0.85;
    squashT = SQUASH_DUR;
    refreshFace();
  }

  function update(delta, speed) {
    const d = Math.min(delta || 0, 0.1);
    t += d;

    // 아픔 표정 타이머 — 끝나면 평상 얼굴(상처 반영)로 복귀
    if (ouchT > 0) {
      ouchT -= d;
      if (ouchT <= 0) {
        ouchT = 0;
        refreshFace();
      }
    }
    // 움찔 스쿼시 — 눌렸다 통통 복귀
    if (squashT > 0) {
      squashT = Math.max(0, squashT - d);
      const k = Math.sin((squashT / SQUASH_DUR) * Math.PI);
      wrapper.scale.set(1 + 0.1 * k, 1 - 0.18 * k, 1 + 0.1 * k);
    } else if (wrapper.scale.y !== 1) {
      wrapper.scale.set(1, 1, 1);
    }
    const spd = Math.max(0, speed || 0);
    const w = Math.min(1, spd / 1.3); // 걷기 블렌드 0~1
    walkPhase += d * (3 + 8.5 * Math.min(spd, 2.4));

    const swing = Math.sin(walkPhase);
    legPivots[0].rotation.x = swing * 0.78 * w;
    legPivots[1].rotation.x = -swing * 0.78 * w;
    armPivots[0].rotation.x = -swing * 0.5 * w;
    armPivots[1].rotation.x = swing * 0.5 * w;
    // 아이들: 팔 살짝 흔들 + 호흡
    const idle = 1 - w;
    armPivots[0].rotation.z = -0.5 - Math.sin(t * 1.7) * 0.05 * idle;
    armPivots[1].rotation.z = 0.5 + Math.sin(t * 1.7 + 1.3) * 0.05 * idle;

    // 통통 튀는 보행 바운스 + 아이들 호흡 — 래퍼 전체 y
    wrapper.position.y = Math.abs(Math.cos(walkPhase)) * 0.045 * w + Math.sin(t * 2.1) * 0.007 * idle;
    // 몸통 좌우 흔들
    wrapper.rotation.z = Math.sin(walkPhase) * 0.045 * w;

    // 머리: 아이들 갸웃 + 걷기 시 살짝 앞으로
    headPivot.rotation.z = Math.sin(t * 1.1) * 0.05 * idle;
    headPivot.rotation.x = 0.06 * w + Math.sin(t * 2.1) * 0.012 * idle;

    // 꽁지머리 찰랑임 — 아이들은 느긋하게, 걸을 땐 통통
    for (let i = 0; i < tailPivots.length; i++) {
      const tp = tailPivots[i];
      const sway = Math.sin(t * 2.3 + i * 2.1) * 0.09 * idle + Math.sin(walkPhase * 2 + i) * 0.14 * w;
      tp.pivot.rotation.z = tp.baseZ + sway;
      tp.pivot.rotation.x = tp.baseX + Math.abs(Math.cos(walkPhase * 2)) * 0.12 * w;
    }
  }

  function dispose() {
    for (const g of geos) g.dispose();
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
    for (const tx of texs) tx.dispose();
  }

  return { group, height: HEIGHT, update, dispose, setWound, ouch };
}
