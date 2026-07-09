// avatar.js — 원격 플레이어 아바타 메시 생성
// LifeUnity Metaverse — MoMA급 미니멀 뮤지엄

import * as THREE from 'three';

/**
 * 닉네임 라벨용 캔버스 텍스처 Sprite 생성
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

/**
 * 아바타 메시 생성.
 * Group 원점은 발바닥(y=0) 기준. 외부에서 position / rotation.y 조작.
 *
 * @param {string} colorHex - 몸통 색 (예: '#e74c3c')
 * @param {string} nickname - 머리 위 라벨 텍스트
 * @returns {THREE.Group}
 */
export function createAvatarMesh(colorHex, nickname) {
  const group = new THREE.Group();

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

  // ---- 눈: 정면(-Z 아님, +Z? → Three.js에서 rotation.y=yaw 기준 정면은 -Z가 카메라 관례지만
  //         아바타는 바라보는 방향을 -Z로 두면 yaw 적용 시 자연스러움) ----
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

  // ---- 닉네임 라벨: 머리 위 0.5m ----
  const label = createNicknameSprite(nickname);
  label.position.y = headY + headRadius + 0.5;
  group.add(label);

  return group;
}
