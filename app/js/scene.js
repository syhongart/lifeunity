// LifeUnity Metaverse — 전시장 건축 + 전역 조명
// 루이지애나 미술관(덴마크) 스타일: 통유리 벽 너머로 정원·바다가 보이는 미술관
//
// createMuseum(scene, themeName = 'daylight') → { bounds: {minX,maxX,minZ,maxZ} }
// themeName: 'daylight' | 'sunset' | 'night' | 'cycle' (미지정/미상 테마는 daylight로 폴백) — THEMES 상수 참고
// 'cycle': 정적 프리셋이 아니라 실시간 낮밤 순환 모드 — sceneTick(delta)이 매 프레임 태양 위치/
// 조명/하늘/바다색을 daylight·sunset·night 3개 키프레임 사이에서 부드럽게 보간한다 (하루 720초).
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

// 아치형 배럴 볼트 천장 — 벽 상단(7m)에서 중앙 11m까지 솟는다 (킴벨 미술관 풍)
// 정점을 따라 리지 스카이라이트(유리 띠)가 x 방향으로 흐른다
const VAULT_TOP = 11;                 // 볼트 정점 높이
const RIDGE_HALF = 1.8;               // 리지 스카이라이트 반폭 (z ±1.8)
// 원호 기하: 현 50m, 상승 4m → 반지름/중심/반각
const VAULT_RISE = VAULT_TOP - ROOM.wallHeight;
const VAULT_R = (HALF * HALF + VAULT_RISE * VAULT_RISE) / (2 * VAULT_RISE);
const VAULT_YC = VAULT_TOP - VAULT_R;
const VAULT_THETA = Math.asin(HALF / VAULT_R);
// z 위치에서의 볼트 천장 높이
const vaultY = (z) => VAULT_YC + Math.sqrt(VAULT_R * VAULT_R - z * z);

// ---------------------------------------------------------------------------
// 테마 시스템 — 전시 분위기 프리셋 (작가가 갤러리 JSON에서 선택)
// daylight(기본) / sunset(황혼) / night(야간 개장)
// Three.js r160 물리 광량 단위: PointLight 20~60, SpotLight 80~250, Directional 0.2~3.5
// ---------------------------------------------------------------------------
export const THEMES = {
  daylight: {
    sky: {
      stops: [
        [0.0, '#4a86c8'],
        [0.45, '#7fb2e0'],
        [0.75, '#c8dff0'],
        [1.0, '#e8f1f6'],
      ],
      cloudColor: '255,255,255',
      cloudAlpha: [0.25, 0.55],
      cloudCount: 26,
      stars: 0,
    },
    sun: { pos: [55, 48, 42], color: 0xfff0da, intensity: 3.2 },
    fill: { pos: [-20, 16, -14], color: 0xdde8f8, intensity: 0.5 },
    hemi: { sky: 0xbfd9ee, ground: 0x6f8a52, intensity: 0.75 },
    ambient: { color: 0xffffff, intensity: 0.22 },
    fog: { color: 0xdfeaf2, near: 60, far: 420 },
    background: 0xdfeaf2,
    downlight: { color: 0xfff2dd, emissive: 0xffefc8, intensity: 22 },
    sea: { color: 0x3f7396, roughness: 0.12, metalness: 0.25 },
    grassTint: 0xffffff,
    treeUplights: false,
    shadowCamera: { left: -45, right: 70, top: 65, bottom: -45, near: 1, far: 180 },
  },
  sunset: {
    sky: {
      // 천정의 저문 인디고 → 수평선의 뜨거운 주황·골드 (황혼 그라디언트)
      stops: [
        [0.0, '#2c2f5e'],
        [0.32, '#6a4f80'],
        [0.58, '#c96a5e'],
        [0.8, '#f0954f'],
        [1.0, '#ffd9a2'],
      ],
      cloudColor: '255,200,145', // 노을빛이 밴 구름
      cloudAlpha: [0.28, 0.6],
      cloudCount: 24,
      stars: 0,
    },
    // 동쪽 바다 위, 낮은 고도의 주황 태양
    sun: { pos: [140, 14, 30], color: 0xff9552, intensity: 2.6 },
    fill: { pos: [-30, 22, -20], color: 0x8a6fb0, intensity: 0.35 },
    hemi: { sky: 0xffb37a, ground: 0x6b4a52, intensity: 0.55 },
    ambient: { color: 0xffcfa0, intensity: 0.22 },
    fog: { color: 0xcf7f62, near: 55, far: 400 },
    background: 0xcf7f62,
    downlight: { color: 0xffd8ae, emissive: 0xffd8ae, intensity: 27 }, // 실내 웜톤 보강
    // 낮은 태양이 만드는 강한 반사 하이라이트 — 낮은 roughness/높은 metalness
    sea: { color: 0x7a5a78, roughness: 0.06, metalness: 0.45 },
    grassTint: 0xe6b98f,
    treeUplights: false,
    shadowCamera: { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 320 },
  },
  night: {
    sky: {
      // 짙은 남색 하늘
      stops: [
        [0.0, '#060814'],
        [0.4, '#0d1330'],
        [0.7, '#161f42'],
        [1.0, '#232c4d'],
      ],
      cloudColor: '150,170,220', // 달빛이 스민 옅은 청회색 구름
      cloudAlpha: [0.05, 0.14],
      cloudCount: 16,
      stars: 760, // 700개 이상, 크기/밝기 랜덤 (makeRand 시드 고정)
    },
    // 낮은 달 — 차갑고 희미한 방향광
    sun: { pos: [-60, 40, -30], color: 0xaec6ff, intensity: 0.35 },
    fill: { pos: [40, 20, 30], color: 0x2a3a66, intensity: 0.12 },
    hemi: { sky: 0x1a2540, ground: 0x0a0c14, intensity: 0.22 },
    ambient: { color: 0x33456e, intensity: 0.1 },
    fog: { color: 0x0a0f22, near: 45, far: 320 },
    background: 0x0a0f22,
    // 다운라이트·작품 스포트라이트가 주인공 — 실내 조도 보강
    downlight: { color: 0xfff0d8, emissive: 0xfff0d8, intensity: 32 },
    sea: { color: 0x0b1830, roughness: 0.2, metalness: 0.25 },
    grassTint: 0x28304a, // 바깥 잔디는 어둡게
    treeUplights: true,  // 중정 나무 아래 업라이트 2개 (웜 스팟)
    shadowCamera: { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 220 },
  },
};

function resolveTheme(themeName) {
  return THEMES[themeName] || THEMES.daylight;
}

// ---------------------------------------------------------------------------
// 'cycle' 테마 — 실시간 낮밤 순환 (담당 A)
// THEMES.daylight/sunset/night 3종을 키프레임으로 재사용해 매 프레임 보간한다.
// 무거운 리소스(캔버스 텍스처)는 createMuseum 시점에 딱 한 번만 만들고,
// sceneTick에서는 색/광량/투명도 등 가벼운 숫자만 갱신한다 (성능 우선).
// ---------------------------------------------------------------------------
const CYCLE_DAY_SECONDS = 720;   // 하루 길이 (12분)
const CYCLE_ARC_RADIUS = 150;    // 태양이 그리는 동-서 원호 반지름

// 그림자 카메라 프러스텀: 세 정적 테마의 프러스텀을 모두 포함하는 합집합
// (태양이 움직이는 동안 프레임마다 재계산하지 않고 한 번만 넉넉히 잡는다)
const CYCLE_SHADOW_CAMERA = {
  left: Math.min(THEMES.daylight.shadowCamera.left, THEMES.sunset.shadowCamera.left, THEMES.night.shadowCamera.left),
  right: Math.max(THEMES.daylight.shadowCamera.right, THEMES.sunset.shadowCamera.right, THEMES.night.shadowCamera.right),
  top: Math.max(THEMES.daylight.shadowCamera.top, THEMES.sunset.shadowCamera.top, THEMES.night.shadowCamera.top),
  bottom: Math.min(THEMES.daylight.shadowCamera.bottom, THEMES.sunset.shadowCamera.bottom, THEMES.night.shadowCamera.bottom),
  near: 1,
  far: Math.max(THEMES.daylight.shadowCamera.far, THEMES.sunset.shadowCamera.far, THEMES.night.shadowCamera.far),
};

const lerpN = (a, b, t) => a + (b - a) * t;

// 현지 시각(시+분)을 0..1 위상으로 (0=자정, 0.5=정오)
function getLocalPhase() {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) / 1440;
}

// 위상 → 두 인접 키프레임 + 그 사이 보간 비율
// elev > 0.3 → daylight / 0.3~0.02 → daylight↔sunset / 0.02~-0.12 → sunset↔night / 그 이하 → night
function cycleSegment(elev) {
  if (elev > 0.3) return { from: 'daylight', to: 'daylight', t: 0 };
  if (elev > 0.02) return { from: 'daylight', to: 'sunset', t: (0.3 - elev) / (0.3 - 0.02) };
  if (elev > -0.12) return { from: 'sunset', to: 'night', t: (0.02 - elev) / (0.02 - -0.12) };
  return { from: 'night', to: 'night', t: 0 };
}

// 주어진 위상의 전체 조명/색 스냅샷 계산 (초기 건축 + 매 프레임 갱신이 공유하는 단일 소스)
function cycleFrameAt(phase) {
  const elev = Math.sin((phase - 0.25) * Math.PI * 2);
  const seg = cycleSegment(elev);
  const { from, to, t } = seg;
  const F = THEMES[from];
  const T = THEMES[to];

  // 태양 — daylight/sunset 구간에서만 밝기를 가지며, night로 넘어갈수록 사그라든다
  let sunColor, sunIntensity;
  if (to === 'night') {
    // sunset → night: 색은 노을에 고정한 채 밝기만 0으로 페이드
    sunColor = new THREE.Color(F.sun.color);
    sunIntensity = F.sun.intensity * (1 - t);
  } else if (from === 'night') {
    sunColor = new THREE.Color(THEMES.sunset.sun.color);
    sunIntensity = 0;
  } else {
    sunColor = new THREE.Color(F.sun.color).lerp(new THREE.Color(T.sun.color), t);
    sunIntensity = lerpN(F.sun.intensity, T.sun.intensity, t);
  }

  // 달 — 고정 위치/색(night 파라미터), night 가중치에 비례해 밝기만 블렌드 인
  let moonIntensity = 0;
  if (from === 'sunset' && to === 'night') moonIntensity = THEMES.night.sun.intensity * t;
  else if (from === 'night' && to === 'night') moonIntensity = THEMES.night.sun.intensity;

  // 태양 위치 — 동→서 원호 (위상 기반 방위각, 반지름 ~150, 고도는 elev 비례)
  const arcAngle = (phase - 0.25) * Math.PI * 2;
  const sunPos = [Math.cos(arcAngle) * CYCLE_ARC_RADIUS, elev * CYCLE_ARC_RADIUS, 0];

  const hemiSky = new THREE.Color(F.hemi.sky).lerp(new THREE.Color(T.hemi.sky), t);
  const hemiGround = new THREE.Color(F.hemi.ground).lerp(new THREE.Color(T.hemi.ground), t);
  const hemiIntensity = lerpN(F.hemi.intensity, T.hemi.intensity, t);

  const ambientColor = new THREE.Color(F.ambient.color).lerp(new THREE.Color(T.ambient.color), t);
  const ambientIntensity = lerpN(F.ambient.intensity, T.ambient.intensity, t);

  const fogColor = new THREE.Color(F.fog.color).lerp(new THREE.Color(T.fog.color), t);
  const fogNear = lerpN(F.fog.near, T.fog.near, t);
  const fogFar = lerpN(F.fog.far, T.fog.far, t);

  const bgColor = new THREE.Color(F.background).lerp(new THREE.Color(T.background), t);

  const downlightIntensity = lerpN(F.downlight.intensity, T.downlight.intensity, t);

  const seaColor = new THREE.Color(F.sea.color).lerp(new THREE.Color(T.sea.color), t);

  // 하늘 돔 3장의 오퍼시티 가중치 (텍스처는 재생성하지 않고 opacity만 블렌드)
  let domeDay = 0, domeSunset = 0, domeNight = 0;
  if (from === 'daylight' && to === 'daylight') domeDay = 1;
  else if (from === 'daylight' && to === 'sunset') { domeDay = 1 - t; domeSunset = t; }
  else if (from === 'sunset' && to === 'night') { domeSunset = 1 - t; domeNight = t; }
  else domeNight = 1;

  return {
    elev, seg,
    sunColor, sunIntensity, sunPos,
    moonIntensity,
    hemiSky, hemiGround, hemiIntensity,
    ambientColor, ambientIntensity,
    fogColor, fogNear, fogFar,
    bgColor,
    downlightIntensity,
    seaColor,
    domeDay, domeSunset, domeNight,
    treeUplightIntensity: 150 * domeNight, // night 가중치에 비례해 중정 업라이트 페이드 인
  };
}

// createMuseum(scene, 'cycle') 건축 시 필요한 '정적' 테마 형태로 초기 프레임을 감싼다.
// (grassTint/fill/downlight 색/sea 재질값 등 프레임마다 갱신 대상이 아닌 값은 daylight를 기본으로 삼는다)
function buildCycleTheme(phase) {
  const frame = cycleFrameAt(phase);
  const { seg } = frame;
  const grassTint = new THREE.Color(THEMES[seg.from].grassTint)
    .lerp(new THREE.Color(THEMES[seg.to].grassTint), seg.t)
    .getHex();

  return {
    sun: { pos: frame.sunPos, color: frame.sunColor.getHex(), intensity: frame.sunIntensity },
    fill: THEMES.daylight.fill,
    hemi: { sky: frame.hemiSky.getHex(), ground: frame.hemiGround.getHex(), intensity: frame.hemiIntensity },
    ambient: { color: frame.ambientColor.getHex(), intensity: frame.ambientIntensity },
    fog: { color: frame.fogColor.getHex(), near: frame.fogNear, far: frame.fogFar },
    background: frame.bgColor.getHex(),
    downlight: {
      color: THEMES.daylight.downlight.color,
      emissive: THEMES.daylight.downlight.emissive,
      intensity: frame.downlightIntensity,
    },
    sea: { color: frame.seaColor.getHex(), roughness: THEMES.daylight.sea.roughness, metalness: THEMES.daylight.sea.metalness },
    grassTint,
    treeUplights: true, // cycle에서는 항상 업라이트 픽스처를 만들고 밝기만 동적으로 페이드
    shadowCamera: CYCLE_SHADOW_CAMERA,
  };
}

// 매 프레임: cycleFrameAt() 스냅샷을 실제 조명/재질/돔에 반영
function applyCycleFrame(cs, frame) {
  cs.sunLight.color.copy(frame.sunColor);
  cs.sunLight.intensity = frame.sunIntensity;
  cs.sunLight.position.set(frame.sunPos[0], frame.sunPos[1], frame.sunPos[2]);
  // 밤에는 광량 0인 태양의 4096² 섀도맵 렌더를 건너뛴다 (성능)
  cs.sunLight.castShadow = frame.sunIntensity > 0.01;

  cs.moonLight.intensity = frame.moonIntensity;

  cs.hemiLight.color.copy(frame.hemiSky);
  cs.hemiLight.groundColor.copy(frame.hemiGround);
  cs.hemiLight.intensity = frame.hemiIntensity;

  cs.ambientLight.color.copy(frame.ambientColor);
  cs.ambientLight.intensity = frame.ambientIntensity;

  cs.scene.fog.color.copy(frame.fogColor);
  cs.scene.fog.near = frame.fogNear;
  cs.scene.fog.far = frame.fogFar;
  cs.scene.background.copy(frame.bgColor);

  if (cs.downlights) {
    for (const light of cs.downlights.lights) light.intensity = frame.downlightIntensity;
    cs.downlights.bulbMat.emissiveIntensity = 2.5 * (frame.downlightIntensity / 22);
  }

  if (cs.seaMat) cs.seaMat.color.copy(frame.seaColor);

  for (const spot of cs.treeUplights) spot.intensity = frame.treeUplightIntensity;

  if (cs.skyDomes) {
    cs.skyDomes.daylight.material.opacity = frame.domeDay;
    cs.skyDomes.sunset.material.opacity = frame.domeSunset;
    cs.skyDomes.night.material.opacity = frame.domeNight;
  }
}

// 활성 cycle 상태 (정적 테마일 땐 null → sceneTick에서 사이클 코드 실행 안 함)
let cycleState = null;

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
// 노말맵 생성 유틸 — 알베도 밝기를 높이로 해석해 Sobel 기울기로 노말을 만든다.
// 타일 경계는 랩(wrap) 샘플링으로 계산하므로 심리스가 유지된다.
// 노말맵은 색 데이터가 아니므로 SRGB 지정 금지(Linear 기본값 사용).
// ---------------------------------------------------------------------------
function canvasToNormalTexture(canvas, strength) {
  const w = canvas.width;
  const h = canvas.height;
  const src = canvas.getContext('2d').getImageData(0, 0, w, h).data;

  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
  }
  const at = (x, y) => lum[((y + h) % h) * w + ((x + w) % w)];

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const d = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const gy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const inv = 1 / Math.sqrt(gx * gx + gy * gy + 1);
      const i = (y * w + x) * 4;
      d[i] = Math.round((-gx * inv * 0.5 + 0.5) * 255);
      d[i + 1] = Math.round((gy * inv * 0.5 + 0.5) * 255);
      d[i + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      d[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ---------------------------------------------------------------------------
// 절차적 텍스처: 오크 파케 바닥 (1024x1024, 심리스)
// 플랭크의 톤/결/옹이를 (행, 열 mod N) 시드로 결정 → 오른쪽 경계를 넘는 플랭크가
// 왼쪽 첫 플랭크와 완전히 동일해져 타일 경계가 보이지 않는다.
// ---------------------------------------------------------------------------
function createParquetMaps() {
  const size = 1024;
  const plankW = 256; // 4 plank/행 (N=4)
  const plankH = 64;  // 16행 정확히 — 상하 경계도 심리스
  const N = size / plankW;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#b98d5f';
  ctx.fillRect(0, 0, size, size);

  const oakTones = ['#b98d5f', '#c49a6c', '#ad8153', '#bf9265', '#b28758', '#c79f73', '#a97d4f'];

  // 한 장의 플랭크를 자기 영역에 클리핑해 그린다 — 결/옹이가 이웃 플랭크나
  // 캔버스 경계를 침범하지 않으므로 상하좌우 랩이 항상 맞아떨어진다.
  function drawPlank(x, y, seed) {
    const rand = makeRand(seed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, plankW, plankH);
    ctx.clip();

    ctx.fillStyle = oakTones[Math.floor(rand() * oakTones.length)];
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

    // 플랭크 경계 홈(어두움) + 상단 베벨 하이라이트 — 노말맵의 주요 높이 신호
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

    ctx.restore();
  }

  for (let row = 0; row * plankH < size; row++) {
    const offset = (row % 4) * (plankW / 4);
    const y = row * plankH;
    // col=N은 오른쪽 경계를 덮는 랩 사본 — (col mod N) 시드가 col=0과 동일
    for (let col = 0; col <= N; col++) {
      const x = col * plankW - offset;
      if (x >= size) continue;
      const k = ((col % N) + N) % N;
      drawPlank(x, y, 12345 + row * 977 + k * 131);
    }
  }

  // 미세 노이즈 (픽셀 단위 무상관 노이즈 — 경계 무관)
  const rand = makeRand(24601);
  const noise = ctx.getImageData(0, 0, size, size);
  const d = noise.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(noise, 0, 0);

  // 실측 비율: repeat 16 → 타일 3.125m, 플랭크 폭 ≈19.5cm × 길이 ≈78cm (파케 블록)
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(16, 16);
  map.anisotropy = 16;

  const normalMap = canvasToNormalTexture(canvas, 1.6);
  normalMap.repeat.set(16, 16);
  normalMap.anisotropy = 16;

  return { map, normalMap };
}

// ---------------------------------------------------------------------------
// 절차적 텍스처: 뮤지엄 화이트 벽 (미세 회반죽 노이즈)
// ---------------------------------------------------------------------------
let plasterMapsCache = null;
function createPlasterMaps() {
  if (plasterMapsCache) return plasterMapsCache;
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

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(4, 1.5);
  map.anisotropy = 4;

  const normalMap = canvasToNormalTexture(canvas, 0.9);
  normalMap.repeat.set(4, 1.5);

  plasterMapsCache = { map, normalMap };
  return plasterMapsCache;
}

// ---------------------------------------------------------------------------
// 절차적 텍스처: 우드 슬랫 천장 (루이지애나 회랑 천장)
// ---------------------------------------------------------------------------
function createWoodSlatMaps() {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8a5f3c';
  ctx.fillRect(0, 0, size, size);

  const rand = makeRand(55555);
  const slatH = 64; // 1024/64 = 16줄 정확히 → 상하 심리스
  const tones = ['#8a5f3c', '#946a45', '#7d5434', '#9c724c', '#835a38'];

  for (let y = 0; y < size; y += slatH) {
    const tone = tones[Math.floor(rand() * tones.length)];
    ctx.fillStyle = tone;
    ctx.fillRect(0, y, size, slatH - 4);

    // 나뭇결 — 끝점을 시작 y로 되돌려 좌우 랩이 이어지게 한다
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y, size, slatH - 4);
    ctx.clip();
    for (let g = 0; g < 14; g++) {
      const gy = y + rand() * (slatH - 4);
      ctx.strokeStyle = rand() > 0.5
        ? `rgba(60, 38, 20, ${0.06 + rand() * 0.1})`
        : `rgba(220, 185, 150, ${0.05 + rand() * 0.08})`;
      ctx.lineWidth = 0.5 + rand() * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      const segs = 6;
      for (let s = 1; s < segs; s++) {
        ctx.lineTo((size / segs) * s, gy + (rand() - 0.5) * 4);
      }
      ctx.lineTo(size, gy); // 시작점과 동일한 y로 마감 → 심리스
      ctx.stroke();
    }
    ctx.restore();

    // 슬랫 사이 그림자 홈 — 노말맵의 주요 높이 신호
    ctx.fillStyle = 'rgba(25, 15, 8, 0.85)';
    ctx.fillRect(0, y + slatH - 4, size, 4);
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 20); // 슬랫 폭 ≈16cm 실측 (64px/1024 × 50m/20)
  map.anisotropy = 8;

  const normalMap = canvasToNormalTexture(canvas, 1.3);
  normalMap.repeat.set(2, 20);
  normalMap.anisotropy = 8;

  return { map, normalMap };
}

// ---------------------------------------------------------------------------
// 절차적 텍스처: 잔디
// ---------------------------------------------------------------------------
let grassMapsCache = null;
function createGrassMaps() {
  if (grassMapsCache) return grassMapsCache;
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

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(60, 60);
  map.anisotropy = 4;

  const normalMap = canvasToNormalTexture(canvas, 0.8);
  normalMap.repeat.set(60, 60);

  grassMapsCache = { map, normalMap };
  return grassMapsCache;
}

// ---------------------------------------------------------------------------
// 하늘 돔 (그라디언트 + 구름) — 텍스처 드로잉은 renderSkyTexture()로 공유
// ---------------------------------------------------------------------------
function renderSkyTexture(sky) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 세로 그라디언트: 천정 색 → 수평선 색 (테마별 stops)
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  for (const [stop, color] of sky.stops) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 별 (night 테마) — 크기·밝기 랜덤, 시드 고정, 가끔 큰 별엔 은은한 글로우
  if (sky.stars > 0) {
    const srand = makeRand(90210);
    for (let i = 0; i < sky.stars; i++) {
      const x = srand() * size;
      const y = srand() * size * 0.82; // 수평선 근처는 비워둠
      const r = 0.4 + srand() * 1.6;
      const bright = 0.35 + srand() * 0.65;
      if (srand() > 0.965) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
        glow.addColorStop(0, `rgba(255, 255, 255, ${bright * 0.5})`);
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, r * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${bright})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 부드러운 뭉게구름 (테마별 색조/농도)
  const rand = makeRand(13579);
  const [aMin, aMax] = sky.cloudAlpha;
  for (let i = 0; i < sky.cloudCount; i++) {
    const cx = rand() * size;
    const cy = size * (0.3 + rand() * 0.45); // 중간 높이대
    const scale = 30 + rand() * 90;
    for (let p = 0; p < 7; p++) {
      const px = cx + (rand() - 0.5) * scale * 2.4;
      const py = cy + (rand() - 0.5) * scale * 0.7;
      const pr = scale * (0.35 + rand() * 0.5);
      const cloudGrad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      cloudGrad.addColorStop(0, `rgba(${sky.cloudColor}, ${aMin + rand() * (aMax - aMin)})`);
      cloudGrad.addColorStop(1, `rgba(${sky.cloudColor}, 0)`);
      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSky(scene, theme, isCycle) {
  if (isCycle) {
    // daylight/sunset/night 3장의 텍스처를 미리(딱 한 번) 만들어 겹쳐 놓고,
    // sceneTick에서는 각 돔의 opacity만 블렌드한다 (텍스처 재생성 없음 — 성능 우선)
    const makeDome = (sky, radius) => new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16),
      new THREE.MeshBasicMaterial({
        map: renderSkyTexture(sky),
        side: THREE.BackSide,
        fog: false,
        transparent: true,
        // depthWrite: false → 어떤 돔도 깊이버퍼에 쓰지 않으므로 돔끼리 깊이 비교가 없어 z-fighting 불가.
        // depthTest는 기본값(true)을 유지해야 실내 불투명 지오메트리(벽/바닥/작품)가 하늘을 정상적으로 가린다.
        // (depthTest:false로 두면 투명 패스가 불투명 패스 뒤에 그려지며 하늘이 전시장 전체를 덮어버린다)
        depthWrite: false,
        opacity: 0,
      })
    );
    const domeNight = makeDome(THEMES.night.sky, 450);
    const domeSunset = makeDome(THEMES.sunset.sky, 448);
    const domeDaylight = makeDome(THEMES.daylight.sky, 446);
    for (const d of [domeNight, domeSunset, domeDaylight]) d.position.y = -20;
    domeNight.renderOrder = -3;
    domeSunset.renderOrder = -2;
    domeDaylight.renderOrder = -1;
    scene.add(domeNight, domeSunset, domeDaylight);
    return { daylight: domeDaylight, sunset: domeSunset, night: domeNight };
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.MeshBasicMaterial({ map: renderSkyTexture(theme.sky), side: THREE.BackSide, fog: false })
  );
  dome.position.y = -20; // 수평선을 낮춰 지평선 근처까지 그라디언트가 오도록
  scene.add(dome);
  return null;
}

// ---------------------------------------------------------------------------
// 실외: 잔디밭 / 바다 / 나무 / 야외 조각
// ---------------------------------------------------------------------------
function createOutdoors(scene, theme) {
  // 잔디밭 (미술관 바닥 밑까지 넓게 — 미술관 바닥이 위에 얹힘)
  // grassTint: daylight는 흰색(무변화), sunset은 웜톤, night는 어둡게 다운
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({
      map: createGrassMaps().map,
      normalMap: createGrassMaps().normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      color: theme.grassTint,
      roughness: 0.95,
      metalness: 0.0,
    })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.03;
  grass.receiveShadow = true;
  scene.add(grass);

  // 동쪽 바다 (수평선의 외레순 해협) — 테마별 색/거칠기(태양 반사 강도)
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 900),
    new THREE.MeshStandardMaterial({
      color: theme.sea.color,
      roughness: theme.sea.roughness,
      metalness: theme.sea.metalness,
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

  // 유리벽 바로 너머의 가까운 나무 — 디테일 트리 (관람자가 자세히 보게 됨)
  const nearDetailSpots = [
    [-12, 30, 1.0], [4, 31, 1.15], [12, 34, 0.9],   // 남쪽 정원
    [34, -18, 1.1], [36, 14, 0.95],                  // 동쪽 잔디
  ];
  nearDetailSpots.forEach(([x, z, s], i) => {
    const dt = buildDetailedTree(60000 + i * 137, {
      trunkLen: 3.2 * s,
      trunkRad: 0.32 * s,
      maxLevel: 2,
      leafScale: 1.1 * s,
    });
    dt.position.set(x + (rand() - 0.5) * 2, 0, z + (rand() - 0.5) * 2);
    dt.rotation.y = rand() * Math.PI * 2;
    scene.add(dt);
  });

  // 남쪽 정원 (유리벽 z=+25 너머) — 배경 군락 (로우폴리)
  const southSpots = [
    [-20, 33], [-4, 35], [20, 30],
    [-16, 42], [-6, 45], [6, 43], [16, 46], [0, 52], [-24, 50], [24, 48],
  ];
  for (const [x, z] of southSpots) {
    makeTree(x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 3, 1.0 + rand() * 0.9);
  }

  // 동쪽 잔디 (유리벽 x=+25 너머) — 바다 조망을 남기고 드문드문
  const eastSpots = [
    [40, -10], [44, 22], [52, -18], [60, 8], [48, -2],
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

  return { seaMat: sea.material };
}

// ---------------------------------------------------------------------------
// 건축 요소
// ---------------------------------------------------------------------------
function createFloor(scene) {
  const maps = createParquetMaps();
  const mat = new THREE.MeshStandardMaterial({
    map: maps.map,
    normalMap: maps.normalMap,
    normalScale: new THREE.Vector2(0.7, 0.7),
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
    normalMap: createPlasterMaps().normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
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
    map: createPlasterMaps().map,
    normalMap: createPlasterMaps().normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
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
    map: createPlasterMaps().map,
    normalMap: createPlasterMaps().normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
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
  // 아치형 배럴 볼트 천장 (z 방향으로 커브, x 방향으로 흐름)
  // - 우드 슬랫 스트립이 원호를 따라 이어짐
  // - 정점(|z| < RIDGE_HALF)은 리지 스카이라이트 유리
  // - 중정(x 5~13, z 5~13) 위는 완전히 뚫림 — 큰 나무 관통
  // - 글루램 아치 리브 + 아치형 박공(동쪽 유리 / 서쪽 회반죽)
  const H = ROOM.wallHeight;
  const woodMapsBase = createWoodSlatMaps();
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x3b3733,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
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

  const c0 = COURTYARD.cx - COURTYARD.half; // 5
  const c1 = COURTYARD.cx + COURTYARD.half; // 13
  const cz0 = COURTYARD.cz - COURTYARD.half;
  const cz1 = COURTYARD.cz + COURTYARD.half;

  // ---- 볼트 스트립 (원호를 따라 30개) ----
  const N = 30;
  const dTheta = (2 * VAULT_THETA) / N;

  for (let i = 0; i < N; i++) {
    const th0 = -VAULT_THETA + i * dTheta;
    const thm = th0 + dTheta / 2;
    const zm = VAULT_R * Math.sin(thm);
    const ym = VAULT_YC + VAULT_R * Math.cos(thm);
    const ds = 2 * VAULT_R * Math.sin(dTheta / 2); // 스트립 현 길이

    const zLo = VAULT_R * Math.sin(th0);
    const zHi = VAULT_R * Math.sin(th0 + dTheta);
    const isRidge = Math.abs(zm) < RIDGE_HALF;
    const cutCourtyard = zHi > cz0 && zLo < cz1;

    // x 커버 구간: 중정과 겹치면 좌/우로 분할
    const spans = cutCourtyard
      ? [[-HALF, c0], [c1, HALF]]
      : [[-HALF, HALF]];

    for (const [x0, x1] of spans) {
      const w = x1 - x0;
      if (w <= 0) continue;

      let mat;
      if (isRidge) {
        mat = skyGlassMat;
      } else {
        const tex = woodMapsBase.map.clone();
        tex.needsUpdate = true;
        tex.repeat.set((2 * w) / ROOM.size, (20 * ds) / ROOM.size);
        const nrm = woodMapsBase.normalMap.clone();
        nrm.needsUpdate = true;
        nrm.repeat.set((2 * w) / ROOM.size, (20 * ds) / ROOM.size);
        mat = new THREE.MeshStandardMaterial({
          map: tex,
          normalMap: nrm,
          normalScale: new THREE.Vector2(0.55, 0.55),
          roughness: 0.8,
        });
      }

      const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, ds), mat);
      strip.rotation.x = Math.PI / 2 + thm; // 원호 접선 방향으로 기울임
      strip.position.set((x0 + x1) / 2, ym, zm);
      strip.receiveShadow = !isRidge;
      scene.add(strip);

      // 외피(지붕널) — 유리 리지 구간 제외, 태양광 차단용 castShadow
      if (!isRidge) {
        const shell = new THREE.Mesh(new THREE.PlaneGeometry(w, ds + 0.05), roofMat);
        shell.rotation.x = Math.PI / 2 + thm;
        shell.position.set(
          (x0 + x1) / 2,
          VAULT_YC + (VAULT_R + 0.16) * Math.cos(thm),
          (VAULT_R + 0.16) * Math.sin(thm)
        );
        shell.castShadow = true;
        scene.add(shell);
      }
    }
  }

  // ---- 글루램 아치 리브 (5m 간격 + 양끝) ----
  const ribXs = [-24.9, -20, -15, -10, -5, 0, 5, 10, 15, 20, 24.9];
  for (const rx of ribXs) {
    const isGableRib = Math.abs(rx) > 24;
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(VAULT_R, isGableRib ? 0.1 : 0.14, 8, 72, 2 * VAULT_THETA),
      ribMat
    );
    rib.rotation.z = Math.PI / 2 - VAULT_THETA; // 아치가 정점 중심에 오도록
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI / 2;            // XY 평면 아치 → YZ 평면
    holder.position.set(rx, VAULT_YC, 0);
    holder.add(rib);
    rib.castShadow = true;
    scene.add(holder);
  }

  // ---- 리지 스카이라이트 프레임 ----
  // 가장자리 빔 (x로 길게, z=±RIDGE_HALF)
  for (const z of [-RIDGE_HALF, RIDGE_HALF]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM.size, 0.2, 0.16), ribMat);
    beam.position.set(0, vaultY(RIDGE_HALF) - 0.02, z);
    beam.castShadow = true;
    scene.add(beam);
  }
  // 크로스 리브 (2.5m 간격) — 스트라이프 빛
  for (let x = -HALF + MULLION_GAP; x < HALF; x += MULLION_GAP) {
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.13, RIDGE_HALF * 2 + 0.1),
      ribMat
    );
    rib.position.set(x, vaultY(0) - 0.03, 0);
    rib.castShadow = true;
    scene.add(rib);
  }

  // ---- 아치형 박공 (동/서 끝의 벽 위 아치 안쪽 면) ----
  const gableShape = new THREE.Shape();
  gableShape.moveTo(-HALF, H);
  const gSegs = 26;
  for (let i = 1; i <= gSegs; i++) {
    const z = -HALF + (ROOM.size / gSegs) * i;
    gableShape.lineTo(z, vaultY(Math.min(Math.abs(z), HALF - 0.001) * Math.sign(z) || 0));
  }
  gableShape.lineTo(HALF, H);
  gableShape.closePath();
  const gableGeo = new THREE.ShapeGeometry(gableShape);

  // 동쪽: 아치형 유리 박공 (빛이 쏟아짐) + 세로 포스트 팬
  const eastGable = new THREE.Mesh(gableGeo, skyGlassMat);
  eastGable.rotation.y = -Math.PI / 2;
  eastGable.position.set(HALF - 0.02, 0, 0);
  scene.add(eastGable);
  for (let z = -20; z <= 20; z += 5) {
    const h = vaultY(z) - H;
    if (h < 0.15) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, 0.1), ribMat);
    post.position.set(HALF - 0.02, H + h / 2, z);
    post.castShadow = true;
    scene.add(post);
  }

  // 서쪽: 회반죽 박공 (양면)
  const westGableMat = new THREE.MeshStandardMaterial({
    map: createPlasterMaps().map,
    normalMap: createPlasterMaps().normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0xffffff,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const westGable = new THREE.Mesh(gableGeo.clone(), westGableMat);
  westGable.rotation.y = Math.PI / 2;
  westGable.position.set(-HALF + 0.02, 0, 0);
  westGable.receiveShadow = true;
  scene.add(westGable);

  // ---- 중정 개구부 우드 커브 (볼트 표면 높이를 따라) ----
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x7a5638, roughness: 0.75 });
  const curbT = 0.3;
  // 북/남 가장자리 (z 고정 → 수평 배치)
  for (const z of [cz0, cz1]) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(c1 - c0 + curbT * 2, 0.5, curbT),
      curbMat
    );
    seg.position.set(COURTYARD.cx, vaultY(z) - 0.05, z + (z === cz0 ? -curbT / 2 : curbT / 2));
    seg.castShadow = true;
    scene.add(seg);
  }
  // 동/서 가장자리 (z를 따라 경사 — 중간 기울기로 근사)
  const slopeTheta = Math.asin(COURTYARD.cz / VAULT_R);
  for (const x of [c0 - curbT / 2, c1 + curbT / 2]) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(curbT, 0.5, cz1 - cz0 + curbT),
      curbMat
    );
    seg.position.set(x, (vaultY(cz0) + vaultY(cz1)) / 2 - 0.05, COURTYARD.cz);
    seg.rotation.x = slopeTheta;
    seg.castShadow = true;
    scene.add(seg);
  }

  // ---- 우드 처마 페시아 (볼트가 벽과 만나는 북/남 모서리) ----
  const fasciaMat = new THREE.MeshStandardMaterial({ color: 0x7a5638, roughness: 0.75 });
  for (const z of [-(HALF + 0.3), HALF + 0.3]) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(ROOM.size + 2.6, 0.42, 0.5),
      fasciaMat
    );
    seg.position.set(0, H - 0.02, z);
    seg.castShadow = true;
    scene.add(seg);
  }
}

// ---------------------------------------------------------------------------
// 디테일 나무 — 나무껍질 텍스처 + 재귀 가지 분기 + 알파 잎 클러스터
// ---------------------------------------------------------------------------
let barkTexCache = null;
let barkNormalCache = null;
function createBarkNormal() {
  createBarkTexture(); // 캔버스 생성 보장
  return barkNormalCache;
}
function createBarkTexture() {
  if (barkTexCache) return barkTexCache;
  const w = 256, h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#6b5138';
  ctx.fillRect(0, 0, w, h);

  const rand = makeRand(77777);

  // 세로 골 (수피 균열)
  for (let i = 0; i < 46; i++) {
    const x0 = rand() * w;
    const dark = rand() > 0.35;
    ctx.strokeStyle = dark
      ? `rgba(38, 26, 15, ${0.25 + rand() * 0.4})`
      : `rgba(150, 120, 88, ${0.15 + rand() * 0.3})`;
    ctx.lineWidth = 1 + rand() * 4;
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    let x = x0;
    for (let y = 0; y <= h; y += h / 10) {
      x += (rand() - 0.5) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // 가로 마디/옹이
  for (let i = 0; i < 8; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 4 + rand() * 10;
    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, 'rgba(30, 20, 10, 0.6)');
    grad.addColorStop(0.6, 'rgba(90, 66, 42, 0.3)');
    grad.addColorStop(1, 'rgba(90, 66, 42, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 미세 노이즈
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 18;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 2);
  barkTexCache = tex;
  barkNormalCache = canvasToNormalTexture(canvas, 1.2);
  barkNormalCache.repeat.copy(tex.repeat);
  return tex;
}

const leafTexCache = {};
function createLeafClusterTexture(variant) {
  if (leafTexCache[variant]) return leafTexCache[variant];
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // 투명 배경 위에 잎을 흩뿌림 — 알파로 실루엣이 뚫려 보임

  const rand = makeRand(50505 + variant * 999);
  const baseHue = 95 + variant * 14; // 녹색 계열 변주

  for (let i = 0; i < 150; i++) {
    // 중앙에 밀집, 가장자리로 갈수록 성김
    const ang = rand() * Math.PI * 2;
    const dist = Math.pow(rand(), 0.6) * size * 0.45;
    const x = size / 2 + Math.cos(ang) * dist;
    const y = size / 2 + Math.sin(ang) * dist;
    const leafLen = 7 + rand() * 13;
    const leafW = leafLen * (0.4 + rand() * 0.25);
    const rot = rand() * Math.PI;

    const light = 22 + rand() * 26;
    const sat = 40 + rand() * 30;
    ctx.fillStyle = `hsla(${baseHue + (rand() - 0.5) * 24}, ${sat}%, ${light}%, ${0.75 + rand() * 0.25})`;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.ellipse(0, 0, leafLen, leafW, 0, 0, Math.PI * 2);
    ctx.fill();
    // 잎맥 하이라이트
    if (rand() > 0.6) {
      ctx.strokeStyle = `hsla(${baseHue}, 45%, ${light + 18}%, 0.5)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-leafLen * 0.8, 0);
      ctx.lineTo(leafLen * 0.8, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  leafTexCache[variant] = tex;
  return tex;
}

function makeLeafMaterials() {
  return [0, 1, 2].map((v) => new THREE.MeshStandardMaterial({
    map: createLeafClusterTexture(v),
    transparent: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0.0,
  }));
}

// 재귀 분기 나무: level이 깊어질수록 가늘고 짧아지며, 말단에 잎 클러스터
function buildDetailedTree(seed, opts) {
  const rand = makeRand(seed);
  const barkMat = new THREE.MeshStandardMaterial({
    map: createBarkTexture(),
    normalMap: createBarkNormal(),
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.95,
    metalness: 0.0,
  });
  const leafMats = makeLeafMaterials();
  const maxLevel = opts.maxLevel;
  const leafScale = opts.leafScale;

  function addLeafCluster(parent, y, s) {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(2.3 * s, 1.8 * s),
        leafMats[Math.floor(rand() * leafMats.length)]
      );
      plane.position.set(
        (rand() - 0.5) * 0.7 * s,
        y + (rand() - 0.5) * 0.6 * s,
        (rand() - 0.5) * 0.7 * s
      );
      plane.rotation.set(
        (rand() - 0.5) * 1.0,
        rand() * Math.PI,
        (rand() - 0.5) * 0.7
      );
      // 알파 잎은 그림자 생략 (투명 그림자 아티팩트 방지)
      parent.add(plane);
    }
  }

  function branch(level, len, rad) {
    const g = new THREE.Group();

    const geo = new THREE.CylinderGeometry(rad * 0.62, rad, len, 7);
    geo.translate(0, len / 2, 0);
    const limb = new THREE.Mesh(geo, barkMat);
    limb.castShadow = true;
    g.add(limb);

    if (level < maxLevel) {
      const kids = 2 + (rand() > 0.45 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const child = branch(
          level + 1,
          len * (0.6 + rand() * 0.18),
          rad * 0.6
        );
        child.position.y = len * (0.8 + rand() * 0.18);
        // 첫 분기는 완만하게(수관이 개구부 안에 머물도록), 깊을수록 크게 벌어짐
        const tiltBase = level === 0 ? 0.24 : 0.4 + level * 0.12;
        child.rotation.z = tiltBase + rand() * 0.3;
        child.rotation.y = (k / kids) * Math.PI * 2 + rand() * 0.9;
        g.add(child);
      }
      // 중간 가지에도 드문드문 잎
      if (level >= 1 && rand() > 0.45) {
        addLeafCluster(g, len * 0.75, leafScale * 0.7);
      }
    } else {
      addLeafCluster(g, len * 0.9, leafScale);
      if (rand() > 0.5) addLeafCluster(g, len * 0.55, leafScale * 0.8);
    }

    return g;
  }

  return branch(0, opts.trunkLen, opts.trunkRad);
}

// ---------------------------------------------------------------------------
// 실내 중정 — 유리로 둘러싸인 정원, 큰 나무가 지붕을 뚫고 자란다
// ---------------------------------------------------------------------------
function createCourtyard(scene, theme) {
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
  const grassMaps = createGrassMaps();
  const grassTex = grassMaps.map.clone();
  grassTex.needsUpdate = true;
  grassTex.repeat.set(6, 6);
  const grassNormal = grassMaps.normalMap.clone();
  grassNormal.needsUpdate = true;
  grassNormal.repeat.set(6, 6);
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(size - 0.3, size - 0.3),
    new THREE.MeshStandardMaterial({ map: grassTex, normalMap: grassNormal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95 })
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

  // ---- 큰 나무 (지붕 개구부 관통) — 재귀 분기 + 잎 텍스처 디테일 트리 ----
  const rand = makeRand(31415);
  const tree = buildDetailedTree(31415, {
    trunkLen: 5.4,     // 첫 줄기 — 재귀 합산으로 총 높이 약 11m
    trunkRad: 0.5,
    maxLevel: 3,
    leafScale: 1.5,
  });
  tree.position.set(cx, 0, cz);
  scene.add(tree);

  // 뿌리 발치 (둥치 벌어짐)
  const rootFlare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.85, 0.5, 9),
    new THREE.MeshStandardMaterial({
      map: createBarkTexture(),
      normalMap: createBarkNormal(),
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.95,
    })
  );
  rootFlare.position.set(cx, 0.25, cz);
  rootFlare.castShadow = true;
  scene.add(rootFlare);

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

  // ---- night 테마 / cycle: 중정 큰 나무 밑 업라이트 2개 (위로 조준, 웜 스팟) ----
  // cycle은 항상 픽스처를 만들어 두고 sceneTick에서 night 가중치로 밝기만 페이드한다
  const treeUplights = [];
  if (theme.treeUplights) {
    const uplightSpots = [
      [cx - 1.6, cz - 1.1],
      [cx + 1.8, cz + 1.4],
    ];
    for (const [ux, uz] of uplightSpots) {
      const spot = new THREE.SpotLight(0xffb066, 150, 15, Math.PI / 5, 0.9, 1.8);
      spot.position.set(ux, 0.35, uz);
      const target = new THREE.Object3D();
      target.position.set(cx, 8.5, cz);
      scene.add(target);
      spot.target = target;
      spot.castShadow = false; // 업라이트는 강조용 — 별도 그림자 부담 없이 가볍게
      scene.add(spot);
      treeUplights.push(spot);
    }
  }

  return { treeUplights };
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

  // 정적 테마일 땐 cycleState가 null이라 아래 코드가 실행되지 않는다
  if (cycleState) {
    cycleState.phase = (cycleState.phase + delta / CYCLE_DAY_SECONDS) % 1;
    applyCycleFrame(cycleState, cycleFrameAt(cycleState.phase));
  }
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

    // 볼트 천장까지 올라가는 행어 로드 (서스펜션 구조)
    for (let hx = -18; hx <= 18; hx += 9) {
      const topY = vaultY(z) - 0.05;
      const rodLen = topY - y;
      if (rodLen <= 0.1) continue;
      const rod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, rodLen, 6),
        trackMat
      );
      rod.position.set(hx, y + rodLen / 2, z);
      scene.add(rod);
    }
  }
}

function createDownlights(scene, theme) {
  // 볼트 천장에서 내려오는 펜던트 조명 3x3
  const fixtureMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a3c,
    roughness: 0.4,
    metalness: 0.8,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff6e0,
    emissive: theme.downlight.emissive,
    emissiveIntensity: 2.5 * (theme.downlight.intensity / 22),
    roughness: 1.0,
  });

  const coords = [-14, 0, 14];
  const shadeY = 6.5; // 펜던트 갓 높이
  const lights = [];

  for (const x of coords) {
    for (const z of coords) {
      // 볼트 표면에서 갓까지 내려오는 와이어
      const topY = vaultY(z) - 0.04;
      const wireLen = topY - shadeY;
      const wire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, wireLen, 6),
        fixtureMat
      );
      wire.position.set(x, shadeY + wireLen / 2, z);
      scene.add(wire);

      // 펜던트 갓 (원뿔형)
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.2, 0.26, 20),
        fixtureMat
      );
      shade.position.set(x, shadeY, z);
      shade.castShadow = true;
      scene.add(shade);

      // 발광 전구
      const bulb = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.025, 20),
        bulbMat
      );
      bulb.position.set(x, shadeY - 0.14, z);
      scene.add(bulb);

      // 실내 다운라이트 — 테마별 광량 (night는 스포트라이트와 함께 주광 역할)
      const light = new THREE.PointLight(theme.downlight.color, theme.downlight.intensity, 18, 2);
      light.position.set(x, shadeY - 0.3, z);
      scene.add(light);
      lights.push(light);
    }
  }

  return { lights, bulbMat };
}

function createGlobalLights(scene, theme) {
  // 하늘빛 반구광 (하늘색 + 지면 반사광) — 테마별 색/광량
  const hemi = new THREE.HemisphereLight(theme.hemi.sky, theme.hemi.ground, theme.hemi.intensity);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(theme.ambient.color, theme.ambient.intensity);
  scene.add(ambient);

  // 태양(daylight/sunset) 또는 달(night) — 유리벽을 통해 실내로 들어오는 주 방향광
  const sun = new THREE.DirectionalLight(theme.sun.color, theme.sun.intensity);
  sun.position.set(...theme.sun.pos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  // 실내 + 근처 실외(정원/조각)까지 그림자 커버 (테마별 태양 각도에 맞춰 조정)
  const sc = theme.shadowCamera;
  sun.shadow.camera.left = sc.left;
  sun.shadow.camera.right = sc.right;
  sun.shadow.camera.top = sc.top;
  sun.shadow.camera.bottom = sc.bottom;
  sun.shadow.camera.near = sc.near;
  sun.shadow.camera.far = sc.far;
  scene.add(sun);
  scene.add(sun.target);

  // 필 라이트 (반대쪽 차가운/보조 광 — 그림자 없음)
  const fill = new THREE.DirectionalLight(theme.fill.color, theme.fill.intensity);
  fill.position.set(...theme.fill.pos);
  scene.add(fill);

  return { hemi, ambient, sun, fill };
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------
export function createMuseum(scene, themeName = 'daylight') {
  const isCycle = themeName === 'cycle';
  // cycle 시작 위상: 관람객 현지 시각(시+분) 비례 — 접속 즉시 "지금" 시각의 하늘로 시작
  const initPhase = isCycle ? getLocalPhase() : 0;
  const theme = isCycle ? buildCycleTheme(initPhase) : resolveTheme(themeName);

  // 안개: 실내는 또렷, 먼 풍경은 대기원근으로 옅어짐 (테마별 색/거리)
  scene.background = new THREE.Color(theme.background);
  scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);

  const skyRefs = createSky(scene, theme, isCycle);
  const outdoorRefs = createOutdoors(scene, theme);

  createFloor(scene);
  createSolidWalls(scene);
  createGlassWalls(scene);
  createPartitions(scene);
  const courtyardRefs = createCourtyard(scene, theme);
  createBaseboards(scene);
  createCeiling(scene);
  createLightTracks(scene);
  const downlightRefs = createDownlights(scene, theme);
  const lightRefs = createGlobalLights(scene, theme);
  createCreatures(scene);

  if (isCycle) {
    // 달 — night 테마의 고정 위치/색을 그대로 재사용, 밝기만 매 프레임 블렌드
    const moon = new THREE.DirectionalLight(THEMES.night.sun.color, 0);
    moon.position.set(...THEMES.night.sun.pos);
    scene.add(moon);
    scene.add(moon.target);

    cycleState = {
      scene,
      phase: initPhase,
      sunLight: lightRefs.sun,
      hemiLight: lightRefs.hemi,
      ambientLight: lightRefs.ambient,
      moonLight: moon,
      seaMat: outdoorRefs.seaMat,
      downlights: downlightRefs,
      treeUplights: courtyardRefs.treeUplights,
      skyDomes: skyRefs,
    };
    // 태양이 움직이므로 넉넉한 합집합 프러스텀을 실제로 반영 (새 라이트에만 영향 — 정적 테마 불변)
    lightRefs.sun.shadow.camera.updateProjectionMatrix();
    applyCycleFrame(cycleState, cycleFrameAt(initPhase)); // 첫 프레임부터 정확한 상태로 시작
  } else {
    cycleState = null; // 정적 테마로 재생성 시 이전 cycle 참조를 폐기
  }

  return {
    bounds: {
      minX: -ROOM.bound,
      maxX: ROOM.bound,
      minZ: -ROOM.bound,
      maxZ: ROOM.bound,
    },
  };
}
