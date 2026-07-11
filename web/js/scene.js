// ARTSHOW Metaverse — 전시장 건축 + 전역 조명
// 루이지애나 미술관(덴마크) 스타일: 통유리 벽 너머로 정원·바다가 보이는 미술관
//
// createMuseum(scene, themeName = 'daylight') → { bounds: {minX,maxX,minZ,maxZ} }
// themeName: 'daylight' | 'sunset' | 'night' | 'cycle' (미지정/미상 테마는 daylight로 폴백) — THEMES 상수 참고
// 'cycle': 정적 프리셋이 아니라 실시간 낮밤 순환 모드 — sceneTick(delta)이 매 프레임 태양 위치/
// 조명/하늘/바다색을 daylight·sunset·night 3개 키프레임 사이에서 부드럽게 보간한다 (하루 720초).
// - 북쪽/서쪽 벽: 화이트 회반죽 전시벽 + 노출 콘크리트 기둥
// - 동쪽·남쪽 벽: 통유리 커튼월 (다크 멀리언) — 바깥 풍경이 보임
// - 천장: 삼각 격자 콘크리트 와플 6m (루이스 칸, 예일대 미술관 스타일)
// - 실외: 잔디밭, 나무들, 동쪽 바다, 야외 조각
// - 중앙 가벽(파티션) 2개 — artworks.js가 여기에 대표작을 건다 (x=∓8, z=-5)
// 작품별 스포트라이트는 artworks.js 담당이므로 여기서 만들지 않는다.

import * as THREE from 'three';
import { RGBELoader } from '../vendor/RGBELoader.js';
import { mergeGeometries } from '../utils/BufferGeometryUtils.js';
import { ROOM, BUILDING } from './config.js';

const HALF = ROOM.size / 2;          // 25
const WALL_T = 0.3;                  // 벽 두께
const BASEBOARD_H = 0.12;            // 걸레받이 높이
const BASEBOARD_T = 0.02;            // 걸레받이 돌출
const MULLION_GAP = 2.5;             // 유리 멀리언 간격 (m)



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
    sun: { pos: [55, 48, 42], color: 0xfff0da, intensity: 3.7 }, // 그림자 대비↑
    fill: { pos: [-20, 16, -14], color: 0xdde8f8, intensity: 0.5 },
    hemi: { sky: 0xbfd9ee, ground: 0x6f8a52, intensity: 0.63 },
    ambient: { color: 0xffffff, intensity: 0.19 },
    fog: { color: 0xdfeaf2, near: 60, far: 420 },
    background: 0xdfeaf2,
    downlight: { color: 0xfff2dd, emissive: 0xffefc8, intensity: 22 },
    sea: { color: 0x3f7396, roughness: 0.12, metalness: 0.25 },
    grassTint: 0xffffff,
    treeUplights: false,
    shadowCamera: { left: -30, right: 45, top: 50, bottom: -28, near: 1, far: 180 },
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
    sun: { pos: [140, 14, 30], color: 0xff9552, intensity: 3.0 }, // 그림자 대비↑
    fill: { pos: [-30, 22, -20], color: 0x8a6fb0, intensity: 0.35 },
    hemi: { sky: 0xffb37a, ground: 0x6b4a52, intensity: 0.47 },
    ambient: { color: 0xffcfa0, intensity: 0.19 },
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
    sun: { pos: [-60, 40, -30], color: 0xaec6ff, intensity: 0.4 },
    fill: { pos: [40, 20, 30], color: 0x2a3a66, intensity: 0.12 },
    hemi: { sky: 0x1a2540, ground: 0x0a0c14, intensity: 0.19 },
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

  if (cs.scene.fog) {
    // 포테이토 모드(소프트 렌더)는 fog를 제거하므로 널 가드 필수 — 없으면
    // 매 프레임 예외로 cycle 전체(태양 이동·FPS 집계)가 조용히 죽는다 (실측)
    cs.scene.fog.color.copy(frame.fogColor);
    cs.scene.fog.near = frame.fogNear;
    cs.scene.fog.far = frame.fogFar;
  }
  cs.scene.background.copy(frame.bgColor);

  if (cs.downlights) {
    if (cs.downlights.warm) cs.downlights.warm.intensity = frame.downlightIntensity * 0.022;
    for (const light of cs.downlights.lights) light.intensity = frame.downlightIntensity;
    cs.downlights.bulbMat.emissiveIntensity = 2.5 * (frame.downlightIntensity / 22);
  }

  if (cs.seaMat) cs.seaMat.color.copy(frame.seaColor);

  for (const spot of cs.treeUplights) spot.intensity = frame.treeUplightIntensity;

  if (cs.skyDomes) {
    cs.skyDomes.daylight.material.opacity = frame.domeDay;
    cs.skyDomes.sunset.material.opacity = frame.domeSunset;
    cs.skyDomes.night.material.opacity = frame.domeNight;
    if (cs.skyDomes.stars) cs.skyDomes.stars.material.opacity = frame.domeNight;
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
// 절차적 텍스처: 노출 콘크리트 (기둥/커브용) — 거푸집 조인트 + 얼룩 + 타이홀
// ---------------------------------------------------------------------------
let concreteMapsCache = null;
function createConcreteMaps() {
  if (concreteMapsCache) return concreteMapsCache;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8f8b84';
  ctx.fillRect(0, 0, size, size);

  const rand = makeRand(31337);
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 16;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);

  // 물얼룩/거푸집 얼룩
  for (let i = 0; i < 16; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 30 + rand() * 90;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(70, 66, 60, ${0.04 + rand() * 0.05})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 수평 거푸집 조인트 (128px 주기 → 상하 심리스)
  for (let y = 0; y < size; y += 128) {
    ctx.fillStyle = 'rgba(50, 47, 42, 0.5)';
    ctx.fillRect(0, y, size, 3);
    ctx.fillStyle = 'rgba(200, 195, 186, 0.25)';
    ctx.fillRect(0, y + 3, size, 1);
  }
  // 폼 타이 홀
  for (let y = 64; y < size; y += 128) {
    for (let x = 64; x < size; x += 128) {
      const g = ctx.createRadialGradient(x, y, 0.5, x, y, 5);
      g.addColorStop(0, 'rgba(40, 37, 33, 0.8)');
      g.addColorStop(1, 'rgba(40, 37, 33, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;

  const normalMap = canvasToNormalTexture(canvas, 0.8);

  concreteMapsCache = { map, normalMap };
  return concreteMapsCache;
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

// HDRI 하늘 (Poly Haven CC0, drei-assets 1k 미러) — 프로시저럴 캔버스 하늘을
// 즉시 표시용 플레이스홀더로 쓰고, .hdr 로드가 끝나면 맵만 교체한다
// (로드 실패 시 기존 하늘 유지 — 네트워크 무관 폴백).
const SKY_HDRI = {
  daylight: './assets/sky/day.hdr',
  sunset: './assets/sky/sunset.hdr',
  night: './assets/sky/night.hdr',
};
function loadHdriInto(mat, key) {
  new RGBELoader().load(
    SKY_HDRI[key],
    (tex) => {
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      mat.map = tex;
      mat.needsUpdate = true;
    },
    undefined,
    () => { /* 실패 — 프로시저럴 하늘 유지 */ }
  );
}

// 또렷한 3D 포인트 별 — 캔버스 돔 별은 천정 UV 수축으로 찌그러졌고(감독 제보
// "별 이상해"), 1k HDRI의 별은 뭉개진다. 셀레스철 구 위 Points는 해상도와
// 무관하게 픽셀 단위로 또렷하다. 밝기/색 변주는 버텍스 컬러로.
function makeStarField() {
  const rand = makeRand(24680);
  const N = 900;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const R = 430;
  for (let i = 0; i < N; i++) {
    const az = rand() * Math.PI * 2;
    const el = Math.asin(0.03 + rand() * 0.96); // 지평선 살짝 위 ~ 천정
    pos[i * 3] = Math.cos(el) * Math.cos(az) * R;
    pos[i * 3 + 1] = Math.sin(el) * R - 70; // 돔과 같은 y 오프셋
    pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * R;
    const b = 0.35 + rand() * 0.65; // 밝기 변주
    const warm = rand() < 0.18;     // 18%는 웜톤 별
    col[i * 3] = b;
    col[i * 3 + 1] = b * (warm ? 0.88 : 0.97);
    col[i * 3 + 2] = b * (warm ? 0.75 : 1.0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.7,
    sizeAttenuation: false, // 항상 픽셀 단위 — 거리 무관 또렷함
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = -1;
  return pts;
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
    for (const d of [domeNight, domeSunset, domeDaylight]) d.position.y = -70; // HDRI 지면부 숨김
    domeNight.renderOrder = -3;
    domeSunset.renderOrder = -2;
    domeDaylight.renderOrder = -1;
    scene.add(domeNight, domeSunset, domeDaylight);
    loadHdriInto(domeDaylight.material, 'daylight');
    loadHdriInto(domeSunset.material, 'sunset');
    loadHdriInto(domeNight.material, 'night');
    const stars = makeStarField();
    scene.add(stars);
    return { daylight: domeDaylight, sunset: domeSunset, night: domeNight, stars };
  }

  const themeKey = theme === THEMES.sunset ? 'sunset' : theme === THEMES.night ? 'night' : 'daylight';
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.MeshBasicMaterial({ map: renderSkyTexture(theme.sky), side: THREE.BackSide, fog: false })
  );
  dome.position.y = -70; // HDRI 사진의 지면부가 잔디/바다 라인 아래로 잠기게
  scene.add(dome);
  loadHdriInto(dome.material, themeKey);
  if (themeKey === 'night') {
    const stars = makeStarField();
    stars.material.opacity = 1;
    scene.add(stars);
  }
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

  // 감독 지시: 동그란 blob 나무 → 잎 카드가 달린 디테일 트리로 전면 교체.
  // 나무당 76콜(가지 17+잎 카드 59)이라 그대로 두면 드로우콜이 폭발하므로,
  // 전 그루를 forest 그룹에 모아 월드 변환을 굽고 머티리얼별 4콜로 병합한다.
  const forest = new THREE.Group();
  let treeSeed = 40000;
  function makeTree(x, z, scale) {
    treeSeed += 733;
    const dt = buildDetailedTree(treeSeed, {
      trunkLen: 2.6 * scale,
      trunkRad: 0.24 * scale,
      maxLevel: 2,
      leafScale: 0.95 * scale,
    });
    dt.position.set(x, 0, z);
    dt.rotation.y = rand() * Math.PI * 2;
    forest.add(dt);
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
    forest.add(dt); // 배경 숲과 함께 병합
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

  // 숲 병합 커밋 — 수피 1콜 + 잎 텍스처별 3콜 (근거리+배경 전 그루)
  for (const m of bakeGroupByMaterial(forest)) scene.add(m);

  // (브론즈 조각은 옥상 테라스로 이전 — createBuilding 참조)

  return { seaMat: sea.material };
}

// ---------------------------------------------------------------------------
// 건축 요소
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 다층 미술관 건축 — BUILDING(config.js) 청사진 소비
// B1 미디어 갤러리 / 1F 메인 / 2F(중앙 보이드) / 옥상 테라스
// 코퍼 천장·계단·난간 전부 실물 지오메트리 (텍스처 페이크 금지)
// ---------------------------------------------------------------------------

// 사각형에서 구멍들을 뺀 나머지를 사각 세그먼트로 분할
function splitRect(outer, holes) {
  let rects = [outer];
  for (const h of holes) {
    const next = [];
    for (const r of rects) {
      // 교차 없음 → 그대로
      if (h.x1 <= r.x0 || h.x0 >= r.x1 || h.z1 <= r.z0 || h.z0 >= r.z1) {
        next.push(r);
        continue;
      }
      const ix0 = Math.max(r.x0, h.x0);
      const ix1 = Math.min(r.x1, h.x1);
      const iz0 = Math.max(r.z0, h.z0);
      const iz1 = Math.min(r.z1, h.z1);
      if (r.z0 < iz0) next.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: iz0 });
      if (iz1 < r.z1) next.push({ x0: r.x0, x1: r.x1, z0: iz1, z1: r.z1 });
      if (r.x0 < ix0) next.push({ x0: r.x0, x1: ix0, z0: iz0, z1: iz1 });
      if (ix1 < r.x1) next.push({ x0: ix1, x1: r.x1, z0: iz0, z1: iz1 });
    }
    rects = next;
  }
  return rects.filter((r) => r.x1 - r.x0 > 0.01 && r.z1 - r.z0 > 0.01);
}

function floorById(id) {
  return BUILDING.floors.find((f) => f.id === id);
}

// 파케 바닥 텍스처를 세그먼트에 — 전역 정렬(오프셋)로 세그먼트 경계가 이어진다
function parquetSegmentMaterial(rect, tint) {
  const maps = createParquetMaps();
  const perM = 16 / 50; // 원본 repeat 16/50m
  const w = rect.x1 - rect.x0;
  const d = rect.z1 - rect.z0;
  const map = maps.map.clone();
  const nrm = maps.normalMap.clone();
  for (const t of [map, nrm]) {
    t.needsUpdate = true;
    t.repeat.set(perM * w, perM * d);
    t.offset.set(((rect.x0 - BUILDING.minX) * perM) % 1, ((rect.z0 - BUILDING.minZ) * perM) % 1);
  }
  return new THREE.MeshStandardMaterial({
    map,
    normalMap: nrm,
    normalScale: new THREE.Vector2(0.7, 0.7),
    color: tint || 0xffffff,
    roughness: 0.4,
    metalness: 0.0,
  });
}

function concreteMaterial(repeatX, repeatY, colorTint) {
  const cm = createConcreteMaps();
  const map = cm.map.clone();
  const nrm = cm.normalMap.clone();
  for (const t of [map, nrm]) {
    t.needsUpdate = true;
    t.repeat.set(repeatX, repeatY);
  }
  return new THREE.MeshStandardMaterial({
    map,
    normalMap: nrm,
    normalScale: new THREE.Vector2(0.55, 0.55),
    color: colorTint || 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
  });
}

function plasterMaterial() {
  return new THREE.MeshStandardMaterial({
    map: createPlasterMaps().map,
    normalMap: createPlasterMaps().normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35),
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
  });
}

const railSteelMat = () => new THREE.MeshStandardMaterial({
  color: 0x26241f,
  roughness: 0.4,
  metalness: 0.75,
});

// 난간: 시작→끝 (x0,z0)-(x1,z1) 직선 구간, floorY 위에 세운다
function buildRailing(scene, x0, z0, x1, z1, floorY) {
  const mat = railSteelMat();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8e4e8,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(x1 - x0, z1 - z0); // z축 기준 yaw
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;

  const group = new THREE.Group();

  // 상부 레일
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len, 10), mat);
  top.rotation.x = Math.PI / 2;
  top.position.y = 1.05;
  group.add(top);

  // 포스트 (1.2m 간격)
  const nPosts = Math.max(2, Math.round(len / 1.2) + 1);
  for (let i = 0; i < nPosts; i++) {
    const t = nPosts === 1 ? 0.5 : i / (nPosts - 1);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 1.05, 0.045), mat);
    post.position.set(0, 0.525, -len / 2 + t * len);
    group.add(post);
  }

  // 유리 패널
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.85), glassMat);
  glass.rotation.y = Math.PI / 2;
  glass.position.y = 0.55;
  group.add(glass);

  group.rotation.y = ang;
  group.position.set(cx, floorY, cz);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  scene.add(group);
}

// 계단: 청사진 스펙대로 솔리드 스텝 + 핸드레일
function buildStair(scene, s) {
  const mat = concreteMaterial(1.2, 2.4);
  const rise = s.yTo - s.yFrom;
  const runLen = s.z1 - s.z0;
  const steps = 24;
  const stepRise = rise / steps;
  const stepRun = runLen / steps;
  const width = s.x1 - s.x0;
  const cx = (s.x0 + s.x1) / 2;

  for (let i = 0; i < steps; i++) {
    const topY = s.yFrom + (i + 1) * stepRise;
    const h = topY - s.yFrom + 0.25; // 바닥에서 이어지는 솔리드 매스
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(width, h, stepRun),
      mat
    );
    step.position.set(cx, topY - h / 2, s.z0 + (i + 0.5) * stepRun);
    step.castShadow = true;
    step.receiveShadow = true;
    scene.add(step);
  }

  // 핸드레일 (양측 경사 파이프 + 포스트)
  const railMat = railSteelMat();
  const slopeLen = Math.hypot(runLen, rise);
  const slopeAng = Math.atan2(rise, runLen);
  for (const rx of [s.x0 + 0.06, s.x1 - 0.06]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, slopeLen, 10), railMat);
    rail.rotation.x = Math.PI / 2 - slopeAng;
    rail.position.set(rx, (s.yFrom + s.yTo) / 2 + 0.95, (s.z0 + s.z1) / 2);
    rail.castShadow = true;
    scene.add(rail);

    for (const t of [0.08, 0.5, 0.92]) {
      const py = s.yFrom + rise * t;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.95, 0.045), railMat);
      post.position.set(rx, py + 0.475, s.z0 + runLen * t);
      post.castShadow = true;
      scene.add(post);
    }
  }
}

// 실물 코퍼(우물반자) 천장 — 직교 보 그리드 + 리세스 + 매입등
function buildCofferCeiling(scene, floorY, segments, lightsOut, theme, lightGrid, fullLights) {
  const ceilY = floorY + BUILDING.clearH;      // 보 밑면
  const beamD = 0.32;                          // 보 깊이
  const beamW = 0.14;
  const gap = 1.1;

  const beamMat = concreteMaterial(2, 0.4, 0xcfc9bf);
  const recessMat = new THREE.MeshStandardMaterial({
    color: 0x35322d,
    normalMap: createPlasterMaps().normalMap,
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughness: 0.95,
  });
  const canMat = new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.5, metalness: 0.6 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff6e0,
    emissive: theme.downlight.emissive,
    emissiveIntensity: 2.5 * (theme.downlight.intensity / 22),
    roughness: 1.0,
  });

  // 보·캔·벌브는 개별 메시 대신 지오메트리로 모아 층당 머티리얼별 1콜로 병합.
  // (드로우콜 계측: 보 247 + 캔 218 + 벌브 218 = 683콜이 씬 최대 항목이었다 —
  //  20fps iGPU 제보의 주범. 정적 지오메트리라 병합은 무손실)
  const beamGeos = [];
  const canGeos = [];
  const bulbGeos = [];
  for (const r of segments) {
    const w = r.x1 - r.x0;
    const d = r.z1 - r.z0;

    // 리세스 패널 (보 위쪽)
    const recess = new THREE.Mesh(new THREE.PlaneGeometry(w, d), recessMat);
    recess.rotation.x = Math.PI / 2;
    recess.position.set((r.x0 + r.x1) / 2, ceilY + beamD, (r.z0 + r.z1) / 2);
    scene.add(recess);

    // X 방향 보 (z 그리드 위치마다) — 전역 그리드에 정렬
    const zStart = Math.ceil((r.z0 - BUILDING.minZ) / gap);
    for (let k = zStart; ; k++) {
      const z = BUILDING.minZ + k * gap;
      if (z > r.z1 - 0.05) break;
      if (z < r.z0 + 0.05) continue;
      const g = new THREE.BoxGeometry(w, beamD, beamW);
      g.translate((r.x0 + r.x1) / 2, ceilY + beamD / 2, z);
      beamGeos.push(g);
    }
    // Z 방향 보 (x 그리드)
    const xStart = Math.ceil((r.x0 - BUILDING.minX) / gap);
    for (let k = xStart; ; k++) {
      const x = BUILDING.minX + k * gap;
      if (x > r.x1 - 0.05) break;
      if (x < r.x0 + 0.05) continue;
      const g = new THREE.BoxGeometry(beamW, beamD, d);
      g.translate(x, ceilY + beamD / 2, (r.z0 + r.z1) / 2);
      beamGeos.push(g);
    }

    // 코퍼 셀 발광 픽스처 (3칸마다 하나, 메시만 — 실제 광원은 lightGrid에서)
    for (let kx = xStart; ; kx++) {
      const cxCell = BUILDING.minX + kx * gap + gap / 2;
      if (cxCell > r.x1 - 0.2) break;
      if (cxCell < r.x0 + 0.2) continue;
      for (let kz = zStart; ; kz++) {
        const czCell = BUILDING.minZ + kz * gap + gap / 2;
        if (czCell > r.z1 - 0.2) break;
        if (czCell < r.z0 + 0.2) continue;
        if (((kx * 7 + kz * 5) % 3) !== 0) continue;
        const cg = new THREE.CylinderGeometry(0.07, 0.08, 0.1, 12);
        cg.translate(cxCell, ceilY + beamD - 0.06, czCell);
        canGeos.push(cg);
        const bg = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12);
        bg.translate(cxCell, ceilY + beamD - 0.12, czCell);
        bulbGeos.push(bg);
      }
    }
  }
  if (beamGeos.length) {
    const beams = new THREE.Mesh(mergeGeometries(beamGeos), beamMat);
    beams.castShadow = true;
    scene.add(beams);
  }
  if (canGeos.length) scene.add(new THREE.Mesh(mergeGeometries(canGeos), canMat));
  if (bulbGeos.length) scene.add(new THREE.Mesh(mergeGeometries(bulbGeos), bulbMat));

  // 실제 광원 — 층당 소수만. 포인트라이트는 포워드 렌더러의 모든 픽셀 셰이딩
  // 비용에 곱해지므로 정상 GPU(fullLights)에서만 켠다. 소프트웨어 렌더링/저사양
  // 에서는 생략하고 집계부의 웜 앰비언트 1개가 실내 보강을 대신한다 (3fps 진단:
  // 폰 60fps/PC 3fps는 씬이 아니라 그 PC의 GPU 가속 문제 — 전원 화질 저하는 부당).
  if (fullLights) {
    for (const [lx, lz] of lightGrid) {
      const light = new THREE.PointLight(theme.downlight.color, theme.downlight.intensity * 0.7, 9, 2);
      light.position.set(lx, ceilY - 0.15, lz);
      scene.add(light);
      lightsOut.push(light);
    }
  }

  return bulbMat;
}

// 남측 파사드 — 1F 커튼월(중앙 입구), 2F 리본 윈도우
function buildSouthFacade(scene) {
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcecf2,
    transparent: true,
    opacity: 0.1,
    roughness: 0.05,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mullionMat = railSteelMat();
  const z = BUILDING.maxZ;
  const W = BUILDING.maxX - BUILDING.minX;
  const f1 = floorById('f1');
  const f2 = floorById('f2');

  // ---- 1F 커튼월 (중앙 3m는 입구 개구부 — 유리 없음) ----
  const H1 = BUILDING.clearH;
  for (const [gx0, gx1] of [[BUILDING.minX, -1.5], [1.5, BUILDING.maxX]]) {
    const gw = gx1 - gx0;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(gw, H1), glassMat);
    pane.position.set((gx0 + gx1) / 2, f1.y + H1 / 2, z);
    pane.rotation.y = Math.PI;
    scene.add(pane);
  }
  // 멀리언 (2.2m 간격) + 입구 프레임
  for (let x = BUILDING.minX; x <= BUILDING.maxX + 0.01; x += 2.2) {
    if (x > -1.5 && x < 1.5) continue;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, H1, 0.12), mullionMat);
    post.position.set(x, f1.y + H1 / 2, z);
    post.castShadow = true;
    scene.add(post);
  }
  for (const x of [-1.5, 1.5]) {
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(0.18, H1, 0.18), mullionMat);
    jamb.position.set(x, f1.y + H1 / 2, z);
    jamb.castShadow = true;
    scene.add(jamb);
  }
  const header = new THREE.Mesh(new THREE.BoxGeometry(W, 0.14, 0.16), mullionMat);
  header.position.set(0, f1.y + H1 - 0.07, z);
  scene.add(header);

  // ---- 2F: 리본 윈도우 (y+1.2 ~ y+2.6), 위아래는 회반죽 밴드 ----
  const pMat = plasterMaterial();
  const below = new THREE.Mesh(new THREE.BoxGeometry(W, 1.2, BUILDING.wallT), pMat);
  below.position.set(0, f2.y + 0.6, z);
  below.castShadow = true;
  below.receiveShadow = true;
  scene.add(below);
  const above = new THREE.Mesh(new THREE.BoxGeometry(W, BUILDING.clearH - 2.6 + 0.6, BUILDING.wallT), pMat);
  above.position.set(0, f2.y + 2.6 + (BUILDING.clearH - 2.6 + 0.6) / 2, z);
  above.castShadow = true;
  above.receiveShadow = true;
  scene.add(above);
  const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.4), glassMat);
  ribbon.position.set(0, f2.y + 1.9, z);
  ribbon.rotation.y = Math.PI;
  scene.add(ribbon);
  for (let x = BUILDING.minX; x <= BUILDING.maxX + 0.01; x += 2.2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.08), mullionMat);
    post.position.set(x, f2.y + 1.9, z);
    scene.add(post);
  }

  // ---- B1 남측: 지하 솔리드 ----
  const b1 = floorById('b1');
  const b1wall = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, BUILDING.storyH, BUILDING.wallT), concreteMaterial(4, 1));
  b1wall.position.set(0, b1.y + BUILDING.storyH / 2, z);
  scene.add(b1wall);
}

function createBuilding(scene, theme, fullLights) {
  const B = BUILDING;
  const W = B.maxX - B.minX;
  const D = B.maxZ - B.minZ;
  const outer = { x0: B.minX, x1: B.maxX, z0: B.minZ, z1: B.maxZ };
  const lights = [];
  let bulbMat = null;

  // ---- 층별 슬래브 + 바닥 마감 + 코퍼 천장 ----
  const roomFloors = ['b1', 'f1', 'f2'];
  for (const f of B.floors) {
    const holes = B.slabHoles[f.id] || [];
    const segs = splitRect(outer, holes);

    for (const r of segs) {
      const w = r.x1 - r.x0;
      const d = r.z1 - r.z0;
      // 슬래브 (콘크리트 매스)
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(w, B.slabT, d),
        concreteMaterial(w / 6, d / 6)
      );
      slab.position.set((r.x0 + r.x1) / 2, f.y - B.slabT / 2, (r.z0 + r.z1) / 2);
      slab.castShadow = true;
      slab.receiveShadow = true;
      scene.add(slab);

      // 바닥 마감 — 실내는 파케(B1은 어두운 틴트), 옥상은 우드 데크
      const top = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        parquetSegmentMaterial(r, f.id === 'b1' ? 0x9a8870 : (f.id === 'roof' ? 0xcdb894 : 0xffffff))
      );
      top.rotation.x = -Math.PI / 2;
      top.position.set((r.x0 + r.x1) / 2, f.y + 0.002, (r.z0 + r.z1) / 2);
      top.receiveShadow = true;
      scene.add(top);
    }
  }

  // ---- 코퍼 천장 (각 실내층: 천장 = 위층 슬래브 밑) ----
  const lightGrids = {
    b1: [[-6, -3], [0, -3], [6, -3], [0, 3]],
    f1: [[-7, -4], [0, -4], [7, -4], [-7, 4], [0, 4], [7, 4]],
    f2: [[-7, -4.5], [0, -4.5], [7, -4.5], [-7, 5], [7, 5]],
  };
  const aboveOf = { b1: 'f1', f1: 'f2', f2: 'roof' };
  for (const id of roomFloors) {
    const f = floorById(id);
    const holesAbove = B.slabHoles[aboveOf[id]] || [];
    const segs = splitRect(outer, holesAbove);
    const bm = buildCofferCeiling(scene, f.y, segs, lights, theme, lightGrids[id], fullLights);
    if (!bulbMat) bulbMat = bm;
  }

  // ---- 외피 벽 (북/동/서 — 지하부터 옥상 파라펫 하단까지) ----
  const shellMat = concreteMaterial(3, 2);
  const shellH = floorById('roof').y - floorById('b1').y; // 12.6
  const shellYc = floorById('b1').y + shellH / 2;
  const north = new THREE.Mesh(new THREE.BoxGeometry(W + B.wallT * 2, shellH, B.wallT), shellMat);
  north.position.set(0, shellYc, B.minZ - B.wallT / 2);
  north.castShadow = true;
  north.receiveShadow = true;
  scene.add(north);
  for (const [x, sx] of [[B.minX - B.wallT / 2, 1], [B.maxX + B.wallT / 2, 1]]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(B.wallT, shellH, D), shellMat);
    side.position.set(x, shellYc, 0);
    side.castShadow = true;
    side.receiveShadow = true;
    scene.add(side);
  }

  // ---- 실내 회반죽 라이닝 (층별 북/동/서) ----
  for (const id of roomFloors) {
    const f = floorById(id);
    const pMat = plasterMaterial();
    const lining = [
      { w: W, h: BUILDING.clearH, x: 0, z: B.minZ + 0.02, ry: 0 },
      { w: D, h: BUILDING.clearH, x: B.maxX - 0.02, z: 0, ry: -Math.PI / 2 },
      { w: D, h: BUILDING.clearH, x: B.minX + 0.02, z: 0, ry: Math.PI / 2 },
    ];
    for (const L of lining) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(L.w, L.h), pMat);
      p.position.set(L.x, f.y + BUILDING.clearH / 2, L.z);
      p.rotation.y = L.ry;
      p.receiveShadow = true;
      scene.add(p);
    }
  }

  // ---- 남측 파사드 ----
  buildSouthFacade(scene);

  // ---- 계단 ----
  for (const s of B.stairs) buildStair(scene, s);

  // ---- 난간 (개구부/보이드 가장자리 — 계단 진입변은 개방) ----
  const f1y = floorById('f1').y;
  const f2y = floorById('f2').y;
  const roofY = floorById('roof').y;
  // 1F: B1 계단 개구부 (동변 + 북변; 남변은 계단 도착 지점이라 개방)
  buildRailing(scene, -8.7, -7, -8.7, -1, f1y);
  buildRailing(scene, -10.7, -7, -8.7, -7, f1y);
  // 2F: 1F→2F 계단 개구부 (동변 + 남변; 북변 도착 개방)
  buildRailing(scene, -8.7, 1, -8.7, 7, f2y);
  buildRailing(scene, -10.7, 1, -8.7, 1, f2y);
  // 2F: 중앙 보이드 4변
  buildRailing(scene, -4, -3, 5, -3, f2y);
  buildRailing(scene, -4, 3, 5, 3, f2y);
  buildRailing(scene, -4, -3, -4, 3, f2y);
  buildRailing(scene, 5, -3, 5, 3, f2y);
  // 옥상: 2F→옥상 계단 개구부 (서변 + 남변; 북변 도착 개방)
  buildRailing(scene, 8.7, 1, 8.7, 7, roofY);
  buildRailing(scene, 8.7, 1, 10.7, 1, roofY);

  // ---- 옥상: 파라펫 + 벤치 + 조각 + 계단 캐노피 ----
  const parapetMat = concreteMaterial(4, 0.5);
  const pH = 1.1;
  const pT = 0.25;
  const pSegs = [
    { w: W + 0.6, d: pT, x: 0, z: B.minZ - pT / 2 },
    { w: W + 0.6, d: pT, x: 0, z: B.maxZ + pT / 2 },
    { w: pT, d: D, x: B.minX - pT / 2, z: 0 },
    { w: pT, d: D, x: B.maxX + pT / 2, z: 0 },
  ];
  for (const s of pSegs) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(s.w, pH, s.d), parapetMat);
    seg.position.set(s.x, roofY + pH / 2, s.z);
    seg.castShadow = true;
    seg.receiveShadow = true;
    scene.add(seg);
  }

  // 벤치 2
  const benchWood = new THREE.MeshStandardMaterial({
    map: createParquetMaps().map,
    color: 0xb99a6f,
    roughness: 0.6,
  });
  for (const [bx, bz] of [[-4, 4], [2, -4]]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.09, 0.55), benchWood);
    seat.position.set(bx, roofY + 0.45, bz);
    seat.castShadow = true;
    scene.add(seat);
    for (const lx of [-0.9, 0.9]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.5), railSteelMat());
      leg.position.set(bx + lx, roofY + 0.21, bz);
      scene.add(leg);
    }
  }

  // 브론즈 조각 (정원에서 옥상으로 이전)
  const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x4f4436, roughness: 0.45, metalness: 0.65 });
  const sculpture = new THREE.Group();
  const arch = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.42, 14, 28, Math.PI), bronzeMat);
  arch.castShadow = true;
  sculpture.add(arch);
  const mass = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 14), bronzeMat);
  mass.scale.set(1.5, 0.75, 1.0);
  mass.position.set(1.1, -0.95, 0.2);
  mass.castShadow = true;
  sculpture.add(mass);
  sculpture.position.set(-2, roofY + 1.35, 0.5);
  sculpture.rotation.y = -0.6;
  scene.add(sculpture);
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 0.12, 24),
    concreteMaterial(1, 1, 0xd8d3ca)
  );
  pad.position.set(-2, roofY + 0.06, 0.5);
  pad.receiveShadow = true;
  scene.add(pad);

  // 계단 캐노피 (옥상 계단 개구부 위 소지붕)
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.18, 7.2), concreteMaterial(1, 2));
  canopy.position.set(9.7, roofY + 2.6, 4);
  canopy.castShadow = true;
  scene.add(canopy);
  for (const [px, pz] of [[8.85, 0.8], [10.55, 0.8], [8.85, 7.2], [10.55, 7.2]]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), railSteelMat());
    post.position.set(px, roofY + 1.3, pz);
    scene.add(post);
  }

  // 다운라이트 대체 웜 앰비언트 — 린 모드(fullLights=false)에서 포인트 15개의
  // 실내 보강을 광원 1개로. 계수 0.022는 스크린샷 대조로 맞춘 값.
  let warm = null;
  if (!fullLights) {
    warm = new THREE.AmbientLight(theme.downlight.color, theme.downlight.intensity * 0.022);
    scene.add(warm);
  }

  return { downlights: { lights, warm, bulbMat } };
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

// 나무 공유 머티리얼 — 모든 디테일 트리가 같은 재질을 쓰면 숲 전체를
// 머티리얼별 소수 메시로 병합할 수 있다 (나무당 76콜 → 숲 전체 4콜)
let _treeMats = null;
function sharedTreeMats() {
  if (!_treeMats) {
    _treeMats = {
      bark: new THREE.MeshStandardMaterial({
        map: createBarkTexture(),
        normalMap: createBarkNormal(),
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughness: 0.95,
        metalness: 0.0,
      }),
      leaves: makeLeafMaterials(),
    };
  }
  return _treeMats;
}

// 그룹의 모든 메시를 월드 변환으로 구워 머티리얼별 병합 메시로 반환.
// 나무처럼 "많은 부품 × 공유 재질" 정적 구조 전용 — 원본 그룹은 버린다.
function bakeGroupByMaterial(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  const meshes = [];
  for (const [mat, geos] of buckets) {
    const m = new THREE.Mesh(mergeGeometries(geos), mat);
    m.castShadow = !(mat.alphaTest > 0); // 알파 잎은 그림자 생략 (아티팩트 방지)
    meshes.push(m);
  }
  return meshes;
}

// 재귀 분기 나무: level이 깊어질수록 가늘고 짧아지며, 말단에 잎 클러스터
function buildDetailedTree(seed, opts) {
  const rand = makeRand(seed);
  const { bark: barkMat, leaves: leafMats } = sharedTreeMats();
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
function createGardenTree(scene, theme) {
  // 남측 정원의 큰 나무 — 1F 커튼월 너머로 보이는 주인공 조경
  const tree = buildDetailedTree(31415, {
    trunkLen: 4.6,
    trunkRad: 0.42,
    maxLevel: 3,
    leafScale: 1.4,
  });
  tree.position.set(7, 0, 14);
  for (const m of bakeGroupByMaterial(tree)) scene.add(m); // 부품 76+ → 4콜

  const rootFlare = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.72, 0.45, 9),
    new THREE.MeshStandardMaterial({
      map: createBarkTexture(),
      normalMap: createBarkNormal(),
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.95,
    })
  );
  rootFlare.position.set(7, 0.22, 14);
  rootFlare.castShadow = true;
  scene.add(rootFlare);

  // night/cycle: 나무 밑 웜 업라이트 2개
  const treeUplights = [];
  if (theme.treeUplights) {
    for (const [ux, uz] of [[5.6, 13], [8.4, 15]]) {
      const spot = new THREE.SpotLight(0xffb066, 150, 15, Math.PI / 5, 0.9, 1.8);
      spot.position.set(ux, 0.35, uz);
      const target = new THREE.Object3D();
      target.position.set(7, 7, 14);
      scene.add(target);
      spot.target = target;
      spot.castShadow = false;
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

  // 정원 큰 나무 주위 나비 5마리
  for (let i = 0; i < 5; i++) {
    makeButterfly(scene, {
      cx: 7,
      cz: 14,
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
  // 4096² → 2048²: 섀도 패스 필레이트 1/4. 소프트 필터(PCFSoft)가 계단을 뭉개
  // 주고, 정적 씬은 아래 main.js의 섀도맵 프리즈로 매 프레임 재렌더도 안 한다.
  sun.shadow.mapSize.set(2048, 2048);
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
// ---------------------------------------------------------------------------
// 접촉 그림자(가짜 AO) — 벽·바닥 접합부를 따라 어두운 그라디언트 스트립을 깐다.
// 베이크드 라이팅 전환 후 남은 "전체가 균일하게 떠 보이는" 플랫함을, 코너를
// 접지시키는 저비용 정적 디캘(층당 4장)로 회복한다. 실시간 AO 비용 0.
// ---------------------------------------------------------------------------
let _aoStripTex = null;
function getAOStripTexture() {
  if (_aoStripTex) return _aoStripTex;
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, 'rgba(10,8,5,0.44)'); // 벽 쪽 — 진하게 (0.34→0.44)
  grad.addColorStop(0.55, 'rgba(10,8,5,0.12)');
  grad.addColorStop(1, 'rgba(10,8,5,0)'); // 실내 쪽 — 소멸
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 128);
  _aoStripTex = new THREE.CanvasTexture(canvas);
  return _aoStripTex;
}

function buildContactShadows(scene) {
  const { minX, maxX, minZ, maxZ, wallT } = BUILDING;
  const W = 0.55; // 스트립 폭(실내 방향)
  const inX0 = minX + wallT / 2;
  const inX1 = maxX - wallT / 2;
  const inZ0 = minZ + wallT / 2;
  const inZ1 = maxZ - wallT / 2;
  const mat = new THREE.MeshBasicMaterial({
    map: getAOStripTexture(),
    transparent: true,
    depthWrite: false,
  });
  // 실내 층만 (옥상은 개방형이라 제외)
  for (const floor of BUILDING.floors) {
    if (floor.id === 'roof') continue;
    const y = floor.y + 0.018;
    // [길이, 중심x, 중심z, y회전] — 그라디언트 진한 쪽이 벽에 닿게 회전
    const strips = [
      [inX1 - inX0, (inX0 + inX1) / 2, inZ0 + W / 2, Math.PI],       // 북벽
      [inX1 - inX0, (inX0 + inX1) / 2, inZ1 - W / 2, 0],             // 남벽
      [inZ1 - inZ0, inX0 + W / 2, (inZ0 + inZ1) / 2, -Math.PI / 2],  // 서벽
      [inZ1 - inZ0, inX1 - W / 2, (inZ0 + inZ1) / 2, Math.PI / 2],   // 동벽
    ];
    for (const [len, cx, cz, ry] of strips) {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(len, W), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = ry;
      mesh.position.set(cx, y, cz);
      mesh.renderOrder = 1;
      scene.add(mesh);
    }
  }
}

export function createMuseum(scene, themeName = 'daylight', opts = {}) {
  const fullLights = opts.fullLights !== false;
  const isCycle = themeName === 'cycle';
  // cycle 시작 위상: 관람객 현지 시각(시+분) 비례 — 접속 즉시 "지금" 시각의 하늘로 시작
  const initPhase = isCycle ? getLocalPhase() : 0;
  const theme = isCycle ? buildCycleTheme(initPhase) : resolveTheme(themeName);

  // 안개: 실내는 또렷, 먼 풍경은 대기원근으로 옅어짐 (테마별 색/거리)
  scene.background = new THREE.Color(theme.background);
  scene.fog = new THREE.Fog(theme.fog.color, theme.fog.near, theme.fog.far);

  const skyRefs = createSky(scene, theme, isCycle);
  const outdoorRefs = createOutdoors(scene, theme);
  buildContactShadows(scene);

  const buildingRefs = createBuilding(scene, theme, fullLights);
  const gardenRefs = createGardenTree(scene, theme);
  const downlightRefs = buildingRefs.downlights;
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
      treeUplights: gardenRefs.treeUplights,
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
      minX: BUILDING.minX + 0.6,
      maxX: BUILDING.maxX - 0.6,
      minZ: BUILDING.minZ + 0.6,
      maxZ: BUILDING.maxZ - 0.6,
    },
  };
}
