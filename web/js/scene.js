// LifeUnity Metaverse — 전시장 건축 + 전역 조명
// 소유자: config.js / scene.js 담당 에이전트
//
// createMuseum(scene) → { bounds: {minX,maxX,minZ,maxZ} }
// 바닥/벽/천장/걸레받이/천장트랙/다운라이트 + 전역 조명만 생성.
// 작품별 스포트라이트는 artworks.js 담당이므로 여기서 만들지 않는다.

import * as THREE from 'three';
import { ROOM } from './config.js';

const HALF = ROOM.size / 2;          // 25
const WALL_T = 0.3;                  // 벽 두께
const BASEBOARD_H = 0.12;            // 걸레받이 높이
const BASEBOARD_T = 0.02;            // 걸레받이 돌출

// ---------------------------------------------------------------------------
// 절차적 텍스처: 오크 파케 바닥 (1024x1024)
// ---------------------------------------------------------------------------
function createParquetTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 기본 오크 톤
  ctx.fillStyle = '#b98d5f';
  ctx.fillRect(0, 0, size, size);

  // 헤링본 느낌의 플랭크 격자 (행마다 오프셋)
  const plankW = 256;  // 플랭크 길이 (px)
  const plankH = 64;   // 플랭크 폭 (px)
  const oakTones = ['#b98d5f', '#c49a6c', '#ad8153', '#bf9265', '#b28758', '#c79f73', '#a97d4f'];

  let seed = 12345;
  const rand = () => {
    // 간단한 LCG — 실행마다 동일한 텍스처
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let row = 0; row * plankH < size; row++) {
    const offset = (row % 4) * (plankW / 4);
    for (let col = -1; col * plankW < size + plankW; col++) {
      const x = col * plankW - offset;
      const y = row * plankH;

      // 플랭크 베이스 톤
      const tone = oakTones[Math.floor(rand() * oakTones.length)];
      ctx.fillStyle = tone;
      ctx.fillRect(x, y, plankW, plankH);

      // 나뭇결: 플랭크 내부에 흐르는 곡선 스트로크
      const grainCount = 10 + Math.floor(rand() * 8);
      for (let g = 0; g < grainCount; g++) {
        const gy = y + rand() * plankH;
        const dark = rand() > 0.5;
        const alpha = 0.05 + rand() * 0.10;
        ctx.strokeStyle = dark
          ? `rgba(90, 60, 30, ${alpha})`
          : `rgba(235, 210, 175, ${alpha})`;
        ctx.lineWidth = 0.6 + rand() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        const seg = 4;
        for (let s = 1; s <= seg; s++) {
          const sx = x + (plankW / seg) * s;
          const sy = gy + (rand() - 0.5) * 7;
          ctx.quadraticCurveTo(
            x + (plankW / seg) * (s - 0.5),
            gy + (rand() - 0.5) * 10,
            sx, sy
          );
        }
        ctx.stroke();
      }

      // 간혹 옹이(knot)
      if (rand() > 0.82) {
        const kx = x + plankW * (0.2 + rand() * 0.6);
        const ky = y + plankH * (0.25 + rand() * 0.5);
        const kr = 2 + rand() * 4;
        const grad = ctx.createRadialGradient(kx, ky, 0.5, kx, ky, kr);
        grad.addColorStop(0, 'rgba(70, 45, 22, 0.55)');
        grad.addColorStop(0.6, 'rgba(100, 68, 36, 0.28)');
        grad.addColorStop(1, 'rgba(100, 68, 36, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fill();
      }

      // 플랭크 경계선 (홈)
      ctx.strokeStyle = 'rgba(60, 38, 18, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, plankW - 1.5, plankH - 1.5);
      // 상단 하이라이트 (베벨 느낌)
      ctx.strokeStyle = 'rgba(255, 240, 215, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + plankH - 1);
      ctx.lineTo(x + 1, y + 1);
      ctx.lineTo(x + plankW - 1, y + 1);
      ctx.stroke();
    }
  }

  // 전체 미세 노이즈로 마감 톤 다운
  const noise = ctx.getImageData(0, 0, size, size);
  const d = noise.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(noise, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6); // 50m 바닥에 약 8.3m 주기 → 플랭크 약 2m
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
// 절차적 텍스처: 뮤지엄 화이트 벽 (미세 회반죽 노이즈)
// ---------------------------------------------------------------------------
function createPlasterTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7f6f2';
  ctx.fillRect(0, 0, size, size);

  let seed = 98765;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 8; // 아주 미세한 그레인
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // 넓고 흐릿한 얼룩 (회반죽 트로웰 자국)
  for (let i = 0; i < 60; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    grad.addColorStop(0, light ? 'rgba(255,255,255,0.03)' : 'rgba(190,188,182,0.03)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1.5);
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// 건축 요소
// ---------------------------------------------------------------------------
function createFloor(scene) {
  const tex = createParquetTexture();
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.35,
    metalness: 0.0,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.size, ROOM.size), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);
}

function createWalls(scene) {
  const tex = createPlasterTexture();
  const wallMat = new THREE.MeshStandardMaterial({
    map: tex,
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
  });

  const H = ROOM.wallHeight;
  const makeWall = (w, d, x, z) => {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
    wall.position.set(x, H / 2, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
  };

  // 북/남 (z 고정, x로 길게) — 벽 중심이 경계 바깥쪽으로 절반 나가도록
  makeWall(ROOM.size + WALL_T * 2, WALL_T, 0, -HALF - WALL_T / 2);
  makeWall(ROOM.size + WALL_T * 2, WALL_T, 0, HALF + WALL_T / 2);
  // 동/서 (x 고정, z로 길게)
  makeWall(WALL_T, ROOM.size, -HALF - WALL_T / 2, 0);
  makeWall(WALL_T, ROOM.size, HALF + WALL_T / 2, 0);
}

function createBaseboards(scene) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeceae4,
    roughness: 0.5,
    metalness: 0.0,
  });
  const y = BASEBOARD_H / 2;
  const inset = HALF - BASEBOARD_T / 2; // 벽 안쪽 면에 밀착

  const makeBoard = (w, d, x, z) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, BASEBOARD_H, d), mat);
    board.position.set(x, y, z);
    board.receiveShadow = true;
    scene.add(board);
  };

  makeBoard(ROOM.size, BASEBOARD_T, 0, -inset);
  makeBoard(ROOM.size, BASEBOARD_T, 0, inset);
  makeBoard(BASEBOARD_T, ROOM.size, -inset, 0);
  makeBoard(BASEBOARD_T, ROOM.size, inset, 0);
}

function createCeiling(scene) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf4f3ef,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.size, ROOM.size), mat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.wallHeight;
  scene.add(ceiling);
}

function createLightTracks(scene) {
  // 다크 메탈 트랙 레일 3줄 (천장에 매달림, x 방향으로 길게)
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2c,
    roughness: 0.45,
    metalness: 0.85,
  });
  const trackLen = ROOM.size - 8; // 42m
  const y = ROOM.wallHeight - 0.08;
  const zPositions = [-14, 0, 14];

  for (const z of zPositions) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(trackLen, 0.07, 0.12), trackMat);
    rail.position.set(0, y, z);
    scene.add(rail);

    // 레일 하단 홈 라인 (디테일)
    const groove = new THREE.Mesh(
      new THREE.BoxGeometry(trackLen, 0.02, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.6, metalness: 0.6 })
    );
    groove.position.set(0, y - 0.045, z);
    scene.add(groove);
  }
}

function createDownlights(scene) {
  // 3x3 그리드 매입형 다운라이트 9개
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3c,
    roughness: 0.4,
    metalness: 0.8,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff6e0,
    emissive: 0xffefc8,
    emissiveIntensity: 2.5,
    roughness: 1.0,
  });

  const coords = [-14, 0, 14];
  const y = ROOM.wallHeight;

  for (const x of coords) {
    for (const z of coords) {
      // 매입 하우징 실린더
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.20, 0.12, 20),
        fixtureMat
      );
      housing.position.set(x, y - 0.06, z);
      scene.add(housing);

      // 발광 전구 (하우징 하단 디스크)
      const bulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20),
        bulbMat
      );
      bulb.position.set(x, y - 0.125, z);
      scene.add(bulb);

      // PointLight — r160 물리 단위
      const light = new THREE.PointLight(0xfff2dd, 40, 20, 2);
      light.position.set(x, y - 0.35, z);
      scene.add(light);
    }
  }
}

function createGlobalLights(scene) {
  // 하늘/바닥 반구광
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd8cfc0, 0.5);
  hemi.position.set(0, ROOM.wallHeight, 0);
  scene.add(hemi);

  // 앰비언트
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  // 그림자 키 라이트
  const key = new THREE.DirectionalLight(0xfff8ee, 2);
  key.position.set(18, 24, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.left = -HALF - 2;
  key.shadow.camera.right = HALF + 2;
  key.shadow.camera.top = HALF + 2;
  key.shadow.camera.bottom = -HALF - 2;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 80;
  scene.add(key);
  scene.add(key.target);

  // 필 라이트 (반대편, 그림자 없음, 차가운 톤)
  const fill = new THREE.DirectionalLight(0xe8eefb, 0.6);
  fill.position.set(-16, 14, -10);
  scene.add(fill);

  // 림 라이트 (뒤쪽 실루엣 강조)
  const rim = new THREE.DirectionalLight(0xffffff, 0.4);
  rim.position.set(0, 10, -22);
  scene.add(rim);
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------
export function createMuseum(scene) {
  scene.background = new THREE.Color(0xfafaf8);
  scene.fog = new THREE.Fog(0xfafaf8, 1, 120);

  createFloor(scene);
  createWalls(scene);
  createBaseboards(scene);
  createCeiling(scene);
  createLightTracks(scene);
  createDownlights(scene);
  createGlobalLights(scene);

  return {
    bounds: {
      minX: -ROOM.bound,
      maxX: ROOM.bound,
      minZ: -ROOM.bound,
      maxZ: ROOM.bound,
    },
  };
}
