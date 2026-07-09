// LifeUnity Metaverse — 전시장 건축 + 전역 조명
// 루이지애나 미술관(덴마크) 스타일: 통유리 벽 너머로 정원·바다가 보이는 미술관
//
// createMuseum(scene) → { bounds: {minX,maxX,minZ,maxZ} }
// - 북쪽 벽: 차콜 전시벽 / 서쪽 벽: 화이트 전시벽
// - 동쪽·남쪽 벽: 통유리 커튼월 (다크 멀리언) — 바깥 풍경이 보임
// - 천장: 따뜻한 우드 슬랫
// - 실외: 잔디밭, 나무들, 동쪽 바다, 야외 조각
// - 중앙 가벽(파티션) 2개 — artworks.js가 여기에 대표작을 건다 (x=∓8, z=-5)
// 작품별 스포트라이트는 artworks.js 담당이므로 여기서 만들지 않는다.

import * as THREE from 'three';
import { ROOM } from './config.js';

const HALF = ROOM.size / 2;          // 25
const WALL_T = 0.3;                  // 벽 두께
const BASEBOARD_H = 0.12;            // 걸레받이 높이
const BASEBOARD_T = 0.02;            // 걸레받이 돌출
const MULLION_GAP = 2.5;             // 유리 멀리언 간격 (m)

// 파티션 가벽 위치/크기 — artworks.js와 좌표 공유
export const PARTITIONS = [
  { x: -8, z: -5, w: 3.8, h: 4.2, t: 0.25 },
  { x: 8, z: -5, w: 3.8, h: 4.2, t: 0.25 },
];

// 실내 중정 (유리로 둘러싸인 정원 — 큰 나무가 지붕 개구부로 자람)
const COURTYARD = { cx: 9, cz: 9, half: 4 }; // x 5..13, z 5..13

// 스카이라이트 밴드 (북쪽 전시벽 앞 유리 천장 띠)
const SKYBAND = { z0: -17.5, z1: -14.5 };

// 움직이는 생물(나비/새) — sceneTick(delta)이 매 프레임 갱신
const creatures = [];

// 시드 고정 LCG — 실행마다 동일한 배치/텍스처
function makeRand(seedInit) {
  let seed = seedInit;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 절차적 텍스처: 오크 파케 바닥 (1024x1024)
// ---------------------------------------------------------------------------
function createParquetTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b98d5f';
  ctx.fillRect(0, 0, size, size);

  const plankW = 256;
  const plankH = 64;
  const oakTones = ['#b98d5f', '#c49a6c', '#ad8153', '#bf9265', '#b28758', '#c79f73', '#a97d4f'];
  const rand = makeRand(12345);

  for (let row = 0; row * plankH < size; row++) {
    const offset = (row % 4) * (plankW / 4);
    for (let col = -1; col * plankW < size + plankW; col++) {
      const x = col * plankW - offset;
      const y = row * plankH;

      const tone = oakTones[Math.floor(rand() * oakTones.length)];
      ctx.fillStyle = tone;
      ctx.fillRect(x, y, plankW, plankH);

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

      ctx.strokeStyle = 'rgba(60, 38, 18, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, plankW - 1.5, plankH - 1.5);
      ctx.strokeStyle = 'rgba(255, 240, 215, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 1, y + plankH - 1);
      ctx.lineTo(x + 1, y + 1);
      ctx.lineTo(x + plankW - 1, y + 1);
      ctx.stroke();
    }
  }

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
  tex.repeat.set(6, 6);
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

  const rand = makeRand(98765);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 8;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

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
// 절차적 텍스처: 우드 슬랫 천장 (루이지애나 회랑 천장)
// ---------------------------------------------------------------------------
function createWoodSlatTexture() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8a5f3c';
  ctx.fillRect(0, 0, size, size);

  const rand = makeRand(55555);
  const slatH = 42; // 슬랫 폭 (px)
  const tones = ['#8a5f3c', '#946a45', '#7d5434', '#9c724c', '#835a38'];

  for (let y = 0; y < size; y += slatH) {
    const tone = tones[Math.floor(rand() * tones.length)];
    ctx.fillStyle = tone;
    ctx.fillRect(0, y, size, slatH - 3);

    // 나뭇결 (길게 흐르는 선)
    for (let g = 0; g < 14; g++) {
      const gy = y + rand() * (slatH - 3);
      ctx.strokeStyle = rand() > 0.5
        ? `rgba(60, 38, 20, ${0.06 + rand() * 0.1})`
        : `rgba(220, 185, 150, ${0.05 + rand() * 0.08})`;
      ctx.lineWidth = 0.5 + rand() * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x <= size; x += size / 6) {
        ctx.lineTo(x, gy + (rand() - 0.5) * 4);
      }
      ctx.stroke();
    }

    // 슬랫 사이 그림자 홈
    ctx.fillStyle = 'rgba(25, 15, 8, 0.85)';
    ctx.fillRect(0, y + slatH - 3, size, 3);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 5); // 슬랫이 x 방향으로 길게 흐르도록
  tex.anisotropy = 8;
  return tex;
}

// ---------------------------------------------------------------------------
// 절차적 텍스처: 잔디
// ---------------------------------------------------------------------------
function createGrassTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#5f8a3e';
  ctx.fillRect(0, 0, size, size);

  const rand = makeRand(24680);

  // 색 변화 패치
  for (let i = 0; i < 90; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 20 + rand() * 80;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const light = rand() > 0.5;
    grad.addColorStop(0, light ? 'rgba(140, 180, 90, 0.12)' : 'rgba(60, 95, 40, 0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 잔디 잎 스트로크
  for (let i = 0; i < 5000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const g = 110 + rand() * 80;
    ctx.strokeStyle = `rgba(${40 + rand() * 40}, ${g}, ${30 + rand() * 30}, ${0.25 + rand() * 0.3})`;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * 3, y - 1.5 - rand() * 3);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.anisotropy = 4;
  return tex;
}

// ---------------------------------------------------------------------------
// 하늘 돔 (그라디언트 + 구름)
// ---------------------------------------------------------------------------
function createSky(scene) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 세로 그라디언트: 천정 파랑 → 수평선 옅은 하늘
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0.0, '#4a86c8');
  grad.addColorStop(0.45, '#7fb2e0');
  grad.addColorStop(0.75, '#c8dff0');
  grad.addColorStop(1.0, '#e8f1f6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 부드러운 뭉게구름
  const rand = makeRand(13579);
  for (let i = 0; i < 26; i++) {
    const cx = rand() * size;
    const cy = size * (0.3 + rand() * 0.45); // 중간 높이대
    const scale = 30 + rand() * 90;
    for (let p = 0; p < 7; p++) {
      const px = cx + (rand() - 0.5) * scale * 2.4;
      const py = cy + (rand() - 0.5) * scale * 0.7;
      const pr = scale * (0.35 + rand() * 0.5);
      const cloudGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      cloudGrad.addColorStop(0, `rgba(255, 255, 255, ${0.25 + rand() * 0.3})`);
      cloudGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  dome.position.y = -20; // 수평선을 낮춰 지평선 근처까지 그라디언트가 오도록
  scene.add(dome);
}

// ---------------------------------------------------------------------------
// 실외: 잔디밭 / 바다 / 나무 / 야외 조각
// ---------------------------------------------------------------------------
function createOutdoors(scene) {
  // 잔디밭 (미술관 바닥 밑까지 넓게 — 미술관 바닥이 위에 얹힘)
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({
      map: createGrassTexture(),
      roughness: 0.95,
      metalness: 0.0,
    })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.03;
  grass.receiveShadow = true;
  scene.add(grass);

  // 동쪽 바다 (수평선의 외레순 해협)
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 900),
    new THREE.MeshStandardMaterial({
      color: 0x3f7396,
      roughness: 0.12,
      metalness: 0.25,
    })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(290, -0.02, 0); // x 90~490
  scene.add(sea);

  // 잔디→바다 경계 모래톤 스트립
  const shore = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 900),
    new THREE.MeshStandardMaterial({ color: 0xc9bb96, roughness: 0.9 })
  );
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(88, -0.025, 0);
  scene.add(shore);

  // ---- 나무 ----
  const rand = makeRand(97531);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4630, roughness: 0.9 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x3e6b2f, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x4d7c38, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x35592a, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x5e8a42, roughness: 0.9 }),
  ];

  function makeTree(x, z, scale) {
    const tree = new THREE.Group();

    const trunkH = 2.2 * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12 * scale, 0.2 * scale, trunkH, 7),
      trunkMat
    );
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    tree.add(trunk);

    // 뭉친 잎덩어리 3~4개 (로우폴리 구)
    const blobs = 3 + Math.floor(rand() * 2);
    for (let b = 0; b < blobs; b++) {
      const r = (0.9 + rand() * 0.8) * scale;
      const leaf = new THREE.Mesh(
        new THREE.IcosahedronGeometry(r, 1),
        leafMats[Math.floor(rand() * leafMats.length)]
      );
      leaf.position.set(
        (rand() - 0.5) * 1.4 * scale,
        trunkH + (rand() * 1.2 + 0.2) * scale,
        (rand() - 0.5) * 1.4 * scale
      );
      leaf.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
      leaf.castShadow = true;
      tree.add(leaf);
    }

    tree.position.set(x, 0, z);
    scene.add(tree);
  }

  // 남쪽 정원 (유리벽 z=+25 너머) — 울창한 군락
  const southSpots = [
    [-20, 33], [-12, 30], [-4, 35], [4, 31], [12, 34], [20, 30],
    [-16, 42], [-6, 45], [6, 43], [16, 46], [0, 52], [-24, 50], [24, 48],
  ];
  for (const [x, z] of southSpots) {
    makeTree(x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 3, 1.0 + rand() * 0.9);
  }

  // 동쪽 잔디 (유리벽 x=+25 너머) — 바다 조망을 남기고 드문드문
  const eastSpots = [
    [34, -20], [40, -10], [36, 14], [44, 22], [52, -18], [60, 8], [48, -2],
  ];
  for (const [x, z] of eastSpots) {
    makeTree(x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 3, 0.9 + rand() * 0.8);
  }

  // 북서쪽에도 배경 나무 (솔리드 벽 뒤라 살짝만)
  const backSpots = [[-35, -30], [-45, 0], [-38, 20], [-30, 40], [20, -40], [-10, -38]];
  for (const [x, z] of backSpots) {
    makeTree(x + (rand() - 0.5) * 4, z + (rand() - 0.5) * 4, 1.1 + rand() * 1.0);
  }

  // ---- 야외 조각 (헨리 무어 풍 브론즈 아치) — 동쪽 잔디, 바다를 배경으로 ----
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0x4f4436,
    roughness: 0.45,
    metalness: 0.65,
  });

  const sculpture = new THREE.Group();

  // 기울어진 아치 (반 토러스)
  const arch = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.75, 14, 28, Math.PI),
    bronzeMat
  );
  arch.castShadow = true;
  sculpture.add(arch);

  // 아치 발치의 둥근 매스
  const mass = new THREE.Mesh(new THREE.SphereGeometry(1.0, 18, 14), bronzeMat);
  mass.scale.set(1.5, 0.75, 1.0);
  mass.position.set(2.0, -1.6, 0.3);
  mass.castShadow = true;
  sculpture.add(mass);

  sculpture.position.set(48, 2.25, 6);
  sculpture.rotation.y = -0.7;
  scene.add(sculpture);

  // 조각 받침 콘크리트 패드
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.18, 24),
    new THREE.MeshStandardMaterial({ color: 0xb9b4ab, roughness: 0.85 })
  );
  pad.position.set(48, 0.06, 6);
  pad.receiveShadow = true;
  scene.add(pad);
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

function createSolidWalls(scene) {
  const H = ROOM.wallHeight;

  // 북쪽 벽: 차콜 전시벽 (루이지애나 사진 전시실 스타일)
  const charcoalMat = new THREE.MeshStandardMaterial({
    color: 0x322e2b,
    roughness: 0.95,
    metalness: 0.0,
  });
  const north = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.size + WALL_T * 2, H, WALL_T),
    charcoalMat
  );
  north.position.set(0, H / 2, -HALF - WALL_T / 2);
  north.castShadow = true;
  north.receiveShadow = true;
  scene.add(north);

  // 서쪽 벽: 화이트 회반죽 전시벽
  const plasterMat = new THREE.MeshStandardMaterial({
    map: createPlasterTexture(),
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
  });
  const west = new THREE.Mesh(
    new THREE.BoxGeometry(WALL_T, H, ROOM.size),
    plasterMat
  );
  west.position.set(-HALF - WALL_T / 2, H / 2, 0);
  west.castShadow = true;
  west.receiveShadow = true;
  scene.add(west);
}

function createGlassWalls(scene) {
  const H = ROOM.wallHeight;

  // 유리 — 아주 옅은 하늘빛 반투명 (바깥이 훤히 보임)
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcecf2,
    transparent: true,
    opacity: 0.09,
    roughness: 0.05,
    metalness: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // 멀리언(창틀) — 다크 브라운 스틸
  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x241f1a,
    roughness: 0.5,
    metalness: 0.6,
  });

  const buildGlassWall = (axis) => {
    // axis: 'east' (x=+25, z 방향으로 길게) | 'south' (z=+25, x 방향으로 길게)
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(ROOM.size, H),
      glassMat
    );
    if (axis === 'east') {
      glass.position.set(HALF, H / 2, 0);
      glass.rotation.y = -Math.PI / 2;
    } else {
      glass.position.set(0, H / 2, HALF);
      glass.rotation.y = Math.PI;
    }
    // 유리는 그림자를 만들지 않음 — 햇빛이 통과
    scene.add(glass);

    // 세로 멀리언 (2.5m 간격) — 회랑 사진의 스트라이프 그림자를 만든다
    for (let d = -HALF; d <= HALF; d += MULLION_GAP) {
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, H, 0.14),
        mullionMat
      );
      if (axis === 'east') post.position.set(HALF, H / 2, d);
      else post.position.set(d, H / 2, HALF);
      post.castShadow = true;
      post.receiveShadow = true;
      scene.add(post);
    }

    // 상/하 가로 레일
    for (const y of [0.07, H - 0.07]) {
      const rail = new THREE.Mesh(
        axis === 'east'
          ? new THREE.BoxGeometry(0.16, 0.14, ROOM.size)
          : new THREE.BoxGeometry(ROOM.size, 0.14, 0.16),
        mullionMat
      );
      if (axis === 'east') rail.position.set(HALF, y, 0);
      else rail.position.set(0, y, HALF);
      rail.castShadow = true;
      scene.add(rail);
    }

    // 중간 가로 레일 (2.4m 높이 — 시선 위)
    const mid = new THREE.Mesh(
      axis === 'east'
        ? new THREE.BoxGeometry(0.1, 0.1, ROOM.size)
        : new THREE.BoxGeometry(ROOM.size, 0.1, 0.1),
      mullionMat
    );
    if (axis === 'east') mid.position.set(HALF, 2.4, 0);
    else mid.position.set(0, 2.4, HALF);
    mid.castShadow = true;
    scene.add(mid);
  };

  buildGlassWall('east');
  buildGlassWall('south');
}

function createPartitions(scene) {
  // 중앙 가벽 2개 — 화이트, artworks.js가 앞뒷면에 작품을 건다
  const mat = new THREE.MeshStandardMaterial({
    map: createPlasterTexture(),
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
  });
  const edgeMat = new THREE.MeshStandardMaterial({
    color: 0xe8e5df,
    roughness: 0.8,
  });

  for (const p of PARTITIONS) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.t), mat);
    wall.position.set(p.x, p.h / 2, p.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);

    // 하단 받침 (구조 디테일)
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(p.w + 0.12, 0.1, p.t + 0.12),
      edgeMat
    );
    base.position.set(p.x, 0.05, p.z);
    base.receiveShadow = true;
    scene.add(base);
  }
}

function createBaseboards(scene) {
  // 솔리드 벽(북/서)에만 걸레받이
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeceae4,
    roughness: 0.5,
    metalness: 0.0,
  });
  const y = BASEBOARD_H / 2;
  const inset = HALF - BASEBOARD_T / 2;

  const north = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM.size, BASEBOARD_H, BASEBOARD_T),
    mat
  );
  north.position.set(0, y, -inset);
  north.receiveShadow = true;
  scene.add(north);

  const west = new THREE.Mesh(
    new THREE.BoxGeometry(BASEBOARD_T, BASEBOARD_H, ROOM.size),
    mat
  );
  west.position.set(-inset, y, 0);
  west.receiveShadow = true;
  scene.add(west);
}

function createCeiling(scene) {
  // 분할 천장: 우드 슬랫 + 유리 스카이라이트 밴드 + 중정 개구부
  // 개구부 1: SKYBAND (z -17.5~-14.5, 전폭) — 유리 천장, 북쪽 전시벽에 자연광
  // 개구부 2: COURTYARD (x 5~13, z 5~13) — 완전히 뚫림, 큰 나무가 관통
  const H = ROOM.wallHeight;
  const woodTexBase = createWoodSlatTexture();
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 0.9 });

  const c0 = COURTYARD.cx - COURTYARD.half; // 5
  const c1 = COURTYARD.cx + COURTYARD.half; // 13
  const cz0 = COURTYARD.cz - COURTYARD.half;
  const cz1 = COURTYARD.cz + COURTYARD.half;

  // 우드 천장 사각 세그먼트 (x0,x1,z0,z1)
  const rects = [
    [-HALF, HALF, -HALF, SKYBAND.z0],          // 북쪽 스트립
    [-HALF, HALF, SKYBAND.z1, cz0],            // 중앙부
    [-HALF, c0, cz0, cz1],                     // 중정 서쪽
    [c1, HALF, cz0, cz1],                      // 중정 동쪽
    [-HALF, HALF, cz1, HALF],                  // 남쪽 스트립
  ];

  for (const [x0, x1, z0, z1] of rects) {
    const w = x1 - x0;
    const d = z1 - z0;
    if (w <= 0 || d <= 0) continue;
    const tex = woodTexBase.clone();
    tex.needsUpdate = true;
    tex.repeat.set((2 * w) / ROOM.size, (5 * d) / ROOM.size); // 슬랫 스케일 일정 유지
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });

    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    panel.rotation.x = Math.PI / 2;
    panel.position.set((x0 + x1) / 2, H, (z0 + z1) / 2);
    scene.add(panel);

    // 위쪽 지붕 슬래브 (개구부와 정렬)
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, d), roofMat);
    roof.position.set((x0 + x1) / 2, H + 0.18, (z0 + z1) / 2);
    roof.castShadow = true;
    scene.add(roof);
  }

  // ---- 스카이라이트 밴드: 유리 + 리브 멀리언 ----
  const skyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2f0f6,
    transparent: true,
    opacity: 0.1,
    roughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ribMat = new THREE.MeshStandardMaterial({
    color: 0x241f1a,
    roughness: 0.5,
    metalness: 0.6,
  });

  const bandD = SKYBAND.z1 - SKYBAND.z0;
  const bandZ = (SKYBAND.z0 + SKYBAND.z1) / 2;
  const skyGlass = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.size, bandD), skyGlassMat);
  skyGlass.rotation.x = Math.PI / 2;
  skyGlass.position.set(0, H + 0.02, bandZ);
  scene.add(skyGlass);

  // 리브 (x 방향 2.5m 간격, 밴드를 가로지름) — 벽에 스트라이프 빛
  for (let x = -HALF; x <= HALF; x += MULLION_GAP) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, bandD), ribMat);
    rib.position.set(x, H + 0.02, bandZ);
    rib.castShadow = true;
    scene.add(rib);
  }
  // 밴드 가장자리 빔
  for (const z of [SKYBAND.z0, SKYBAND.z1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM.size, 0.22, 0.16), ribMat);
    beam.position.set(0, H + 0.02, z);
    beam.castShadow = true;
    scene.add(beam);
  }

  // ---- 중정 개구부 우드 커브(테두리) ----
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x7a5638, roughness: 0.75 });
  const curbT = 0.3;
  const curbSegs = [
    { w: c1 - c0 + curbT * 2, d: curbT, x: COURTYARD.cx, z: cz0 - curbT / 2 },
    { w: c1 - c0 + curbT * 2, d: curbT, x: COURTYARD.cx, z: cz1 + curbT / 2 },
    { w: curbT, d: cz1 - cz0, x: c0 - curbT / 2, z: COURTYARD.cz },
    { w: curbT, d: cz1 - cz0, x: c1 + curbT / 2, z: COURTYARD.cz },
  ];
  for (const s of curbSegs) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.5, s.d), curbMat);
    seg.position.set(s.x, H + 0.1, s.z);
    seg.castShadow = true;
    scene.add(seg);
  }

  // 우드 처마 페시아 (지붕 외곽 테두리)
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x7a5638, roughness: 0.75 });
  const t = 0.5;
  const L = ROOM.size + 2.6;
  const segs = [
    { w: L, d: t, x: 0, z: (L - t) / 2 },
    { w: L, d: t, x: 0, z: -(L - t) / 2 },
    { w: t, d: L - t * 2, x: (L - t) / 2, z: 0 },
    { w: t, d: L - t * 2, x: -(L - t) / 2, z: 0 },
  ];
  for (const s of segs) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.42, s.d), fasciaMat);
    seg.position.set(s.x, ROOM.wallHeight - 0.02, s.z);
    seg.castShadow = true;
    scene.add(seg);
  }
}

// ---------------------------------------------------------------------------
// 실내 중정 — 유리로 둘러싸인 정원, 큰 나무가 지붕을 뚫고 자란다
// ---------------------------------------------------------------------------
function createCourtyard(scene) {
  const H = ROOM.wallHeight;
  const { cx, cz, half } = COURTYARD;
  const size = half * 2;

  // 유리 벽 4면
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcecf2,
    transparent: true,
    opacity: 0.08,
    roughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x241f1a,
    roughness: 0.5,
    metalness: 0.6,
  });

  const faces = [
    { x: cx, z: cz - half, rotY: 0 },
    { x: cx, z: cz + half, rotY: Math.PI },
    { x: cx - half, z: cz, rotY: Math.PI / 2 },
    { x: cx + half, z: cz, rotY: -Math.PI / 2 },
  ];
  for (const f of faces) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(size, H), glassMat);
    pane.position.set(f.x, H / 2, f.z);
    pane.rotation.y = f.rotY;
    scene.add(pane);
  }

  // 모서리 + 중간 멀리언
  const postOffsets = [-half, -half / 2, 0, half / 2, half];
  for (const o of postOffsets) {
    for (const [px, pz] of [
      [cx + o, cz - half], [cx + o, cz + half],
      [cx - half, cz + o], [cx + half, cz + o],
    ]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.12), mullionMat);
      post.position.set(px, H / 2, pz);
      post.castShadow = true;
      scene.add(post);
    }
  }
  // 상하 레일
  for (const y of [0.06, H - 0.06]) {
    for (const f of faces) {
      const rail = new THREE.Mesh(
        f.rotY === 0 || f.rotY === Math.PI
          ? new THREE.BoxGeometry(size, 0.12, 0.14)
          : new THREE.BoxGeometry(0.14, 0.12, size),
        mullionMat
      );
      rail.position.set(f.x, y, f.z);
      scene.add(rail);
    }
  }

  // 중정 바닥: 잔디 패치 + 스톤 보더
  const grassTex = createGrassTexture().clone();
  grassTex.needsUpdate = true;
  grassTex.repeat.set(6, 6);
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(size - 0.3, size - 0.3),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 })
  );
  patch.rotation.x = -Math.PI / 2;
  patch.position.set(cx, 0.02, cz);
  patch.receiveShadow = true;
  scene.add(patch);

  const borderMat = new THREE.MeshStandardMaterial({ color: 0xa8a29a, roughness: 0.85 });
  for (const s of [
    { w: size, d: 0.16, x: cx, z: cz - half + 0.08 },
    { w: size, d: 0.16, x: cx, z: cz + half - 0.08 },
    { w: 0.16, d: size, x: cx - half + 0.08, z: cz },
    { w: 0.16, d: size, x: cx + half - 0.08, z: cz },
  ]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(s.w, 0.07, s.d), borderMat);
    b.position.set(s.x, 0.035, s.z);
    scene.add(b);
  }

  // ---- 큰 나무 (지붕 개구부 관통) ----
  const rand = makeRand(31415);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a452f, roughness: 0.9 });
  const leafMats = [
    new THREE.MeshStandardMaterial({ color: 0x47763a, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x548a3e, roughness: 0.9 }),
    new THREE.MeshStandardMaterial({ color: 0x3c6630, roughness: 0.9 }),
  ];

  const tree = new THREE.Group();
  const trunkH = 9.5;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.5, trunkH, 10),
    trunkMat
  );
  trunk.position.y = trunkH / 2;
  trunk.castShadow = true;
  tree.add(trunk);

  // 큰 가지 3개
  for (let b = 0; b < 3; b++) {
    const branchH = 3 + rand() * 1.5;
    const branch = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.16, branchH, 7),
      trunkMat
    );
    const ang = (b / 3) * Math.PI * 2 + rand();
    branch.position.set(
      Math.cos(ang) * 1.1,
      5.5 + b * 1.1,
      Math.sin(ang) * 1.1
    );
    branch.rotation.z = Math.cos(ang) * 0.7;
    branch.rotation.x = -Math.sin(ang) * 0.7;
    branch.castShadow = true;
    tree.add(branch);
  }

  // 실내에서 보이는 낮은 잎덩어리
  for (let i = 0; i < 3; i++) {
    const r = 1.1 + rand() * 0.6;
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMats[i % 3]);
    leaf.position.set(
      (rand() - 0.5) * 2.6,
      5.3 + rand() * 1.2,
      (rand() - 0.5) * 2.6
    );
    leaf.castShadow = true;
    tree.add(leaf);
  }
  // 지붕 위로 펼쳐지는 큰 수관
  for (let i = 0; i < 6; i++) {
    const r = 1.6 + rand() * 1.3;
    const leaf = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 1),
      leafMats[Math.floor(rand() * 3)]
    );
    leaf.position.set(
      (rand() - 0.5) * 5.5,
      8.6 + rand() * 2.6,
      (rand() - 0.5) * 5.5
    );
    leaf.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
    leaf.castShadow = true;
    tree.add(leaf);
  }

  tree.position.set(cx, 0, cz);
  scene.add(tree);

  // 바위 몇 개
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8d887f, roughness: 0.95 });
  for (let i = 0; i < 4; i++) {
    const r = 0.2 + rand() * 0.35;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
    const ang = rand() * Math.PI * 2;
    const dist = 1.2 + rand() * 2.2;
    rock.position.set(cx + Math.cos(ang) * dist, r * 0.55, cz + Math.sin(ang) * dist);
    rock.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

// ---------------------------------------------------------------------------
// 생물: 나비 (중정 + 남쪽 정원) / 하늘의 새
// ---------------------------------------------------------------------------
function makeButterfly(scene, opts) {
  const group = new THREE.Group();

  const wingGeoL = new THREE.PlaneGeometry(0.16, 0.12);
  wingGeoL.translate(-0.09, 0, 0);
  const wingGeoR = new THREE.PlaneGeometry(0.16, 0.12);
  wingGeoR.translate(0.09, 0, 0);

  const mat = new THREE.MeshBasicMaterial({
    color: opts.color,
    side: THREE.DoubleSide,
  });
  const wingL = new THREE.Mesh(wingGeoL, mat);
  const wingR = new THREE.Mesh(wingGeoR, mat);
  wingL.rotation.x = -Math.PI / 2;
  wingR.rotation.x = -Math.PI / 2;
  group.add(wingL);
  group.add(wingR);

  scene.add(group);

  creatures.push({
    update(time) {
      const t = time * opts.speed + opts.phase;
      const x = opts.cx + Math.cos(t) * opts.rx;
      const z = opts.cz + Math.sin(t * opts.zRatio) * opts.rz;
      const y = opts.cy + Math.sin(time * opts.bobSpeed + opts.phase) * opts.bobAmp;

      // 진행 방향으로 몸통 회전
      const dx = -Math.sin(t) * opts.rx * opts.speed;
      const dz = Math.cos(t * opts.zRatio) * opts.rz * opts.zRatio * opts.speed;
      group.rotation.y = Math.atan2(dx, dz);

      group.position.set(x, y, z);

      // 날갯짓
      const flap = Math.sin(time * opts.flapSpeed) * 1.1;
      wingL.rotation.y = flap;
      wingR.rotation.y = -flap;
    },
  });
}

function makeBird(scene, opts) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0x2a2a2e, side: THREE.DoubleSide });

  const wingGeoL = new THREE.PlaneGeometry(1.6, 0.35);
  wingGeoL.translate(-0.8, 0, 0);
  const wingGeoR = new THREE.PlaneGeometry(1.6, 0.35);
  wingGeoR.translate(0.8, 0, 0);
  const wingL = new THREE.Mesh(wingGeoL, mat);
  const wingR = new THREE.Mesh(wingGeoR, mat);
  wingL.rotation.x = -Math.PI / 2;
  wingR.rotation.x = -Math.PI / 2;
  group.add(wingL);
  group.add(wingR);
  scene.add(group);

  creatures.push({
    update(time) {
      const t = time * opts.speed + opts.phase;
      const x = opts.cx + Math.cos(t) * opts.radius;
      const z = opts.cz + Math.sin(t) * opts.radius;
      const y = opts.cy + Math.sin(time * 0.3 + opts.phase) * 2;

      group.rotation.y = -t - Math.PI / 2; // 원을 따라 진행 방향
      group.position.set(x, y, z);

      const flap = Math.sin(time * opts.flapSpeed + opts.phase) * 0.55;
      wingL.rotation.y = flap;
      wingR.rotation.y = -flap;
    },
  });
}

function createCreatures(scene) {
  const rand = makeRand(86420);
  const butterflyColors = [0xe8923a, 0xf3d34a, 0xe8e4da, 0xc76fb8, 0x7fb2e0];

  // 중정 나비 5마리 (나무 주위)
  for (let i = 0; i < 5; i++) {
    makeButterfly(scene, {
      cx: COURTYARD.cx,
      cz: COURTYARD.cz,
      cy: 1.4 + rand() * 3.0,
      rx: 1.0 + rand() * 2.2,
      rz: 1.0 + rand() * 2.2,
      zRatio: 0.7 + rand() * 0.6,
      speed: 0.35 + rand() * 0.4,
      phase: rand() * Math.PI * 2,
      bobSpeed: 1.5 + rand() * 1.5,
      bobAmp: 0.3 + rand() * 0.3,
      flapSpeed: 9 + rand() * 5,
      color: butterflyColors[i % butterflyColors.length],
    });
  }

  // 남쪽 정원 나비 4마리 (유리벽 너머로 보임)
  for (let i = 0; i < 4; i++) {
    makeButterfly(scene, {
      cx: -14 + i * 10 + rand() * 4,
      cz: 30 + rand() * 8,
      cy: 1.2 + rand() * 2.0,
      rx: 1.5 + rand() * 3.0,
      rz: 1.5 + rand() * 3.0,
      zRatio: 0.6 + rand() * 0.8,
      speed: 0.3 + rand() * 0.35,
      phase: rand() * Math.PI * 2,
      bobSpeed: 1.2 + rand() * 1.6,
      bobAmp: 0.35 + rand() * 0.4,
      flapSpeed: 8 + rand() * 5,
      color: butterflyColors[(i + 2) % butterflyColors.length],
    });
  }

  // 하늘의 새 3마리 (먼 원을 그리며 활공)
  for (let i = 0; i < 3; i++) {
    makeBird(scene, {
      cx: 20 + rand() * 30,
      cz: -10 + rand() * 40,
      cy: 26 + rand() * 12,
      radius: 55 + rand() * 45,
      speed: 0.04 + rand() * 0.03,
      phase: rand() * Math.PI * 2,
      flapSpeed: 2.2 + rand() * 1.2,
    });
  }
}

// sceneTick — main.js 렌더 루프에서 매 프레임 호출
let sceneTime = 0;
export function sceneTick(delta) {
  sceneTime += delta;
  for (const c of creatures) c.update(sceneTime);
}

function createLightTracks(scene) {
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2c,
    roughness: 0.45,
    metalness: 0.85,
  });
  const trackLen = ROOM.size - 8;
  const y = ROOM.wallHeight - 0.08;
  const zPositions = [-14, 0, 14];

  for (const z of zPositions) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(trackLen, 0.07, 0.12), trackMat);
    rail.position.set(0, y, z);
    scene.add(rail);

    const groove = new THREE.Mesh(
      new THREE.BoxGeometry(trackLen, 0.02, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.6, metalness: 0.6 })
    );
    groove.position.set(0, y - 0.045, z);
    scene.add(groove);
  }
}

function createDownlights(scene) {
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
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.20, 0.12, 20),
        fixtureMat
      );
      housing.position.set(x, y - 0.06, z);
      scene.add(housing);

      const bulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20),
        bulbMat
      );
      bulb.position.set(x, y - 0.125, z);
      scene.add(bulb);

      // 낮의 미술관 — 다운라이트는 보조광 수준으로
      const light = new THREE.PointLight(0xfff2dd, 22, 18, 2);
      light.position.set(x, y - 0.35, z);
      scene.add(light);
    }
  }
}

function createGlobalLights(scene) {
  // 하늘빛 반구광 (파란 하늘 + 잔디 반사광)
  const hemi = new THREE.HemisphereLight(0xbfd9ee, 0x6f8a52, 0.75);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);

  scene.add(new THREE.AmbientLight(0xffffff, 0.22));

  // 태양 — 남동쪽 높은 곳에서 유리벽을 통해 실내로 들어옴
  const sun = new THREE.DirectionalLight(0xfff0da, 3.2);
  sun.position.set(55, 48, 42);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  // 실내 + 근처 실외(정원/조각)까지 그림자 커버
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 65;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 180;
  scene.add(sun);
  scene.add(sun.target);

  // 필 라이트 (북서쪽 차가운 하늘광 — 그림자 없음)
  const fill = new THREE.DirectionalLight(0xdde8f8, 0.5);
  fill.position.set(-20, 16, -14);
  scene.add(fill);
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------
export function createMuseum(scene) {
  // 안개: 실내는 또렷, 먼 풍경은 대기원근으로 옅어짐
  scene.background = new THREE.Color(0xdfeaf2);
  scene.fog = new THREE.Fog(0xdfeaf2, 60, 420);

  createSky(scene);
  createOutdoors(scene);

  createFloor(scene);
  createSolidWalls(scene);
  createGlassWalls(scene);
  createPartitions(scene);
  createCourtyard(scene);
  createBaseboards(scene);
  createCeiling(scene);
  createLightTracks(scene);
  createDownlights(scene);
  createGlobalLights(scene);
  createCreatures(scene);

  return {
    bounds: {
      minX: -ROOM.bound,
      maxX: ROOM.bound,
      minZ: -ROOM.bound,
      maxZ: ROOM.bound,
    },
  };
}
