// avatar.js — 아바타 인스턴스 생성 (치비 전용)
// OpenArtShow Metaverse — 감독 지시로 서드파티 캐릭터(KayKit/RPM/DCL) 전면 삭제.
// 유일한 캐릭터는 자체 제작 치비(chibi.js — 외부 에셋 0, 저작권 완전 보유)이며,
// 구버전 접속자가 보내오는 옛 charId('knight', 'dcl:...', 'rpm:...')는 모두
// 기본 치비로 폴백해 하위호환을 유지한다.

import * as THREE from 'three';
import { buildChibi, decodeChibi, CHIBI_CHAR_PREFIX } from './chibi.js';
import { attachHitFx } from './hitfx.js';

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
    // 라벨은 순수 오버레이 — 투명 픽셀이 깊이를 기록하면 뒤에 그려지는
    // 블롭 그림자(renderOrder 1)가 빌보드 사각형 영역에서 통째로 지워진다
    // (QA 이분 탐색으로 확정된 가림 사고).
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);

  // 월드 크기: 높이 약 0.28m, 폭은 캔버스 비율 유지
  const worldHeight = 0.28;
  sprite.scale.set(worldHeight * (canvas.width / canvas.height), worldHeight, 1);

  return sprite;
}

// ---------------------------------------------------------------------------
// 폴백: 캡슐 + 구 머리 아바타 (치비 조립이 예외를 던지는 비상시에만)
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
  body.castShadow = false; // 블롭 그림자가 접지 담당 (섀도맵 프리즈 잔상 방지)
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
  head.castShadow = false; // 블롭 그림자가 접지 담당
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

/**
 * 자체 치비 아바타 인스턴스 생성 ('chibi:'+JSON). buildChibi()는 동기(로드 없음)라
 * 폴백 교체 패턴이 필요 없다 — 실패 시에만 캡슐 폴백.
 */
function createChibiAvatarInstance(charId, colorHex, nickname) {
  const params = decodeChibi(charId); // null이면 기본 룩으로 조립
  let built;
  try {
    built = buildChibi(params || undefined);
  } catch (err) {
    console.warn('치비 아바타 생성 실패, 캡슐 폴백 사용:', err);
    return createFallbackAvatar(colorHex, nickname);
  }
  const group = new THREE.Group();
  group.add(built.group);
  const label = createNicknameSprite(nickname, colorHex);
  label.position.y = built.height + 0.42;
  group.add(label);
  return {
    group,
    update(delta, speed) {
      built.update(delta, speed);
    },
    hit() {
      built.ouch(); // >_< 표정 + 움찔 스쿼시 (chibi.js 내장)
    },
    setWound(level) {
      built.setWound(level); // 반창고/멍/눈물 얼굴 반영
    },
    dispose() {
      built.dispose();
      if (label.material.map) label.material.map.dispose();
      label.material.dispose();
    },
  };
}

// 치비 전용 디스패처 — 알 수 없는 charId는 전부 기본 치비
function createAvatarInstanceInner(charId, colorHex, nickname) {
  if (typeof charId === 'string' && charId.startsWith(CHIBI_CHAR_PREFIX)) {
    return createChibiAvatarInstance(charId, colorHex, nickname);
  }
  return createChibiAvatarInstance(CHIBI_CHAR_PREFIX + '{}', colorHex, nickname);
}

// ---------------------------------------------------------------------------
// 블롭 그림자 — 발밑의 부드러운 원형 그림자. 실시간 그림자 맵 대신 버텍스 컬러
// 알파 그라디언트(중심 진함 → 가장자리 투명) 원판 하나를 쓴다.
// 캔버스 텍스처 방식은 SwiftShader 실측에서 그려지지 않아(QA 이분 탐색:
// 동일 설정의 단색 투명 재질은 보이고 맵이 붙는 순간 사라짐) 텍스처 없는
// 경로로 구현한다 — 모바일 비용도 이쪽이 더 낮다.
// ---------------------------------------------------------------------------
function attachBlobShadow(group, radius) {
  const geo = new THREE.CircleGeometry(1, 24);
  const posAttr = geo.attributes.position;
  const rgba = new Float32Array(posAttr.count * 4);
  for (let i = 0; i < posAttr.count; i++) {
    const r = Math.min(1, Math.hypot(posAttr.getX(i), posAttr.getY(i)));
    const alpha = 0.78 * (1 - r); // 중심 0.78 → 가장자리 0 (감독 지시로 진하게, 0.65→0.78)
    rgba[i * 4 + 0] = 0.08;
    rgba[i * 4 + 1] = 0.055;
    rgba[i * 4 + 2] = 0.03;
    rgba[i * 4 + 3] = alpha;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false, // 바닥과의 z-파이팅·발 간섭 방지
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.scale.setScalar(radius);
  mesh.position.y = 0.02;
  mesh.renderOrder = 1;
  group.add(mesh);
  return { mat, geo };
}

export function createAvatarInstance(charId, colorHex, nickname) {
  const inst = createAvatarInstanceInner(charId, colorHex, nickname);
  // 발밑 그림자 — 치비는 작게, 휴머노이드는 표준. 그룹 원점(발바닥)에 부착되므로
  // 걷기 바운스(내부 래퍼의 y 움직임)와 무관하게 항상 바닥에 붙어 있다.
  const isChibi = typeof charId === 'string' && charId.startsWith(CHIBI_CHAR_PREFIX);
  // 반경은 몸 실루엣보다 확실히 크게 — 치비 치마 폭(~0.6m)이 원반을 다 가리면
  // 그림자가 그려져도 보이지 않는다(픽셀 실측으로 확인한 함정).
  const shadow = attachBlobShadow(inst.group, isChibi ? 0.5 : 0.55);
  // 만화식 타격 이펙트 — 최상위 group에 부착 (내부 래퍼는 회전·스쿼시 대상이라 금지)
  const fx = attachHitFx(inst.group);
  const origDispose = inst.dispose;
  // 치비가 아닌 아바타(GLB류)용 제네릭 '움찔' — 그룹 y 스쿼시 (치비는 자체 리액션)
  let hitT = 0;
  const HIT_DUR = 0.5;
  return {
    group: inst.group,
    update: (delta, speed) => {
      inst.update(delta, speed);
      fx.update(delta);
      if (hitT > 0) {
        hitT = Math.max(0, hitT - (delta || 0));
        const k = Math.sin((hitT / HIT_DUR) * Math.PI);
        inst.group.scale.y = 1 - 0.14 * k;
        if (hitT === 0) inst.group.scale.y = 1;
      }
    },
    /** 맞기 리액션 + 상처 반영 (level: 누적 상처 0~3) */
    hit(level) {
      if (typeof inst.setWound === 'function') inst.setWound(level);
      if (typeof inst.hit === 'function') inst.hit(level);
      else hitT = HIT_DUR;
      fx.hit(level);
    },
    /** 상처 단계만 반영 (자연 회복 감쇠용 — 리액션 없음) */
    setWound(level) {
      if (typeof inst.setWound === 'function') inst.setWound(level);
    },
    dispose: () => {
      fx.dispose();
      shadow.mat.dispose();
      shadow.geo.dispose();
      origDispose.call(inst);
    },
  };
}
