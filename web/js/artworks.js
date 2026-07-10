// artworks.js — ARTSHOW Metaverse Museum
// 작가별 전시 갤러리 JSON을 로드하여 작품(액자 + 플라크 + 작품별 스포트라이트)을
// 생성하고 근접 작품을 탐색한다.
// 소유 파일: web/js/artworks.js (이 파일만 수정)

import * as THREE from 'three';
import { BUILDING, EYE_HEIGHT } from './config.js';

// ---------------------------------------------------------------------------
// 폴백 갤러리 데이터 — 루이지애나 스타일 레이아웃 (syhongart 개인전)
// 동쪽·남쪽 벽은 통유리(전시 불가)이므로:
//   북쪽 차콜 벽(z=-25, rotY=0): 5점, x = -20,-10,0,10,20
//   서쪽 화이트 벽(x=-25, rotY=+PI/2): 5점, z = -18,-9,0,9,18
//   중앙 가벽 2개(scene.js PARTITIONS, x=∓8 z=-5, 두께 0.25):
//     +z 면(입구를 향함, rotY=0, z=-4.875): 작가 대표작 2점
//     -z 면(rotY=PI, z=-5.125): 큐레이션 2점
// pos는 벽/가벽 면 좌표 — createArtworks가 프레임 절반+0.01m만큼 법선 방향으로 띄움
// 갤러리 JSON(fetch)이 없을 때(404, file:// 등)의 내장 폴백으로 사용된다.
// ---------------------------------------------------------------------------

const PICSUM = (id) => `https://picsum.photos/id/${id}/1200/900`;

export const FALLBACK_GALLERY = {
  id: 'syhongart',
  name: 'syhongart 개인전',
  description:
    '네온과 침묵, 도시와 자연이 교차하는 순간들을 담은 syhongart의 개인전입니다.',
  artworks: [
    // ---- 북쪽 차콜 벽 (5점) ----
    {
      id: 'aw-01',
      title: 'Alpine Silence',
      artist: 'Mara Ellingsen',
      year: 2024,
      desc: '고요한 산악 풍경 속에서 인간의 부재가 만들어내는 긴장을 포착한 작품입니다. 차가운 공기와 빛의 결을 통해 자연의 숭고함을 응시하게 합니다.',
      imageUrl: PICSUM(1018),
      pos: { x: -20, z: -25 },
      rotY: 0,
    },
    {
      id: 'aw-02',
      title: 'River Vein',
      artist: 'Jonas Feld',
      year: 2025,
      desc: '대지를 가로지르는 강줄기를 생명의 혈관으로 해석한 항공 시점의 풍경입니다. 물과 땅의 경계에서 시간의 흐름을 읽어냅니다.',
      imageUrl: PICSUM(1015),
      pos: { x: -10, z: -25 },
      rotY: 0,
    },
    {
      id: 'aw-03',
      title: 'Fog Meridian',
      artist: 'Celeste Aubert',
      year: 2026,
      desc: '안개가 삼킨 수평선 위로 떠오르는 미묘한 빛의 층위를 기록했습니다. 보이는 것과 보이지 않는 것 사이의 경계를 질문하는 작품입니다.',
      imageUrl: PICSUM(1025),
      pos: { x: 0, z: -25 },
      rotY: 0,
    },
    {
      id: 'aw-04',
      title: 'Harbor Study No.7',
      artist: 'Theo Lindqvist',
      year: 2024,
      desc: '항구 도시의 일상적 풍경을 절제된 구도로 담아낸 연작의 일곱 번째 작품입니다. 정박과 출항 사이, 머무름의 미학을 탐구합니다.',
      imageUrl: PICSUM(1039),
      pos: { x: 10, z: -25 },
      rotY: 0,
    },
    {
      id: 'aw-05',
      title: 'Quiet Arrival',
      artist: 'Ines Marchetti',
      year: 2025,
      desc: '도착이라는 순간이 지닌 낯섦과 안도감을 동시에 그려낸 작품입니다. 화면의 여백은 관객 각자의 여정을 투영하는 거울이 됩니다.',
      imageUrl: PICSUM(1043),
      pos: { x: 20, z: -25 },
      rotY: 0,
    },

    // ---- 서쪽 화이트 벽 (5점) ----
    {
      id: 'aw-06',
      title: 'Meadow Frequency',
      artist: 'Ruben Castell',
      year: 2024,
      desc: '초원의 바람을 시각적 주파수로 번역하려는 시도에서 출발한 작품입니다. 반복되는 결의 리듬이 화면 전체에 잔잔한 진동을 남깁니다.',
      imageUrl: PICSUM(1050),
      pos: { x: -25, z: -18 },
      rotY: Math.PI / 2,
    },
    {
      id: 'aw-07',
      title: 'Salt and Distance',
      artist: 'Hana Okabe',
      year: 2026,
      desc: '바다와 육지가 만나는 지점에서 거리감이라는 감각을 해부합니다. 소금기 어린 공기의 질감이 화면 너머로 전해지는 듯한 작품입니다.',
      imageUrl: PICSUM(1062),
      pos: { x: -25, z: -9 },
      rotY: Math.PI / 2,
    },
    {
      id: 'aw-08',
      title: 'Terrace of Hours',
      artist: 'Viktor Brandt',
      year: 2025,
      desc: '하루의 시간이 층층이 쌓이는 계단식 풍경을 은유적으로 담았습니다. 빛의 각도가 만들어내는 그림자의 계보를 따라가는 작품입니다.',
      imageUrl: PICSUM(1074),
      pos: { x: -25, z: 0 },
      rotY: Math.PI / 2,
    },
    {
      id: 'aw-09',
      title: 'Northern Interval',
      artist: 'Solveig Anker',
      year: 2024,
      desc: '북구의 짧은 낮과 긴 밤 사이의 간극을 색채의 온도로 표현했습니다. 침묵에 가까운 화면이 오히려 강한 서사를 품고 있는 작품입니다.',
      imageUrl: PICSUM(1080),
      pos: { x: -25, z: 9 },
      rotY: Math.PI / 2,
    },
    {
      id: 'aw-10',
      title: 'Concrete Bloom',
      artist: 'Adrian Voss',
      year: 2026,
      desc: '도시의 콘크리트 표면 위에서 피어나는 우연한 아름다움을 채집한 작품입니다. 인공과 자연의 경계가 흐려지는 순간을 포착합니다.',
      imageUrl: PICSUM(110),
      pos: { x: -25, z: 18 },
      rotY: Math.PI / 2,
    },

    // ---- 중앙 가벽 뒷면 (-z, 2점) ----
    {
      id: 'aw-11',
      title: 'Vanishing Grid',
      artist: 'Lena Horvat',
      year: 2025,
      desc: '소실점을 향해 수렴하는 구조물의 격자를 통해 질서와 무한을 사유합니다. 기하학적 반복 속에 숨은 미세한 불규칙이 작품의 핵심입니다.',
      imageUrl: PICSUM(164),
      pos: { x: -8, z: -5.125 },
      rotY: Math.PI,
    },
    {
      id: 'aw-12',
      title: 'Afterlight Sequence',
      artist: 'Emil Radoux',
      year: 2024,
      desc: '해가 진 직후 잔광이 사물에 남기는 마지막 색을 연속적으로 기록했습니다. 사라지는 것들에 대한 애도이자 기억의 방식에 관한 작품입니다.',
      imageUrl: PICSUM(219),
      pos: { x: 8, z: -5.125 },
      rotY: Math.PI,
    },

    // ---- 중앙 가벽 앞면 (+z, 입구를 향함): 작가 특별전 (syhongart) ----
    {
      id: 'aw-featured-01',
      title: 'Neon Vanitas',
      artist: 'syhongart',
      year: 2026,
      desc: '네온 프레임 속 크롬 핑크 스컬을 통해 디지털 시대의 바니타스(vanitas)를 재해석한 작품입니다. 화려한 빛의 입자들 사이에서 소멸과 영원이 교차합니다.',
      imageUrl: './assets/neon-vanitas.png',
      featured: true,
      pos: { x: -8, z: -4.875 },
      rotY: 0,
      size: { w: 2.2, h: 2.2 },
    },
    {
      id: 'aw-featured-02',
      title: 'Neon Motion',
      artist: 'syhongart',
      year: 2026,
      desc: '움직이는 빛으로 그린 싱글 채널 비디오 작품입니다. 정지된 회화가 담을 수 없는 시간의 층위를 네온의 리듬으로 풀어냅니다.',
      videoUrl: './assets/neon-motion.mp4',
      featured: true,
      pos: { x: 8, z: -4.875 },
      rotY: 0,
      size: { w: 2.2, h: 2.2 },
    },
  ],
};

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const ART_W = 2.8; // 작품 폭 (m)
const ART_H = 2.0; // 작품 높이 (m)
const ART_CENTER_OFF = 1.6; // 작품 중심 높이 = 층 바닥 + 1.6m (미술관 표준 시선)
const FRAME_DEPTH = 0.1; // 프레임 두께 (m)
const FRAME_BORDER = 0.09; // 프레임 테두리 폭 (m)
const SPOT_OFF = 3.35; // 스포트라이트 높이 = 층 바닥 + 3.35m (코퍼 천장 3.6m 바로 아래)
const NEARBY_DIST = 3.0; // 근접 판정 거리 (m) — 같은 층(|dy|<2)에서만

// ---------------------------------------------------------------------------
// 자동 배치 — BUILDING.artworkSlots(다층 청사진)를 순서대로 소비한다.
// 다층 전환으로 갤러리 JSON의 pos/rotY는 더 이상 사용하지 않는다(구 단층 좌표계).
// featured:true 작품은 featured 슬롯 풀을 우선 사용한다.
// ---------------------------------------------------------------------------

function floorYOf(id) {
  const f = BUILDING.floors.find((fl) => fl.id === id);
  return f ? f.y : 0;
}

function assignSlots(artworks) {
  const resolved = BUILDING.artworkSlots.map((s) => ({
    ...s,
    floorY: floorYOf(s.floor),
  }));
  const wallSlots = resolved.filter((s) => !s.featured);
  const featuredSlots = resolved.filter((s) => s.featured);
  const placed = [];

  for (const art of artworks) {
    const pool = art.featured ? featuredSlots : wallSlots;
    const slot = pool.shift();
    if (!slot) {
      console.warn(
        `[artworks] 배치 슬롯이 부족하여 작품을 건너뜁니다: ${art.id ?? art.title ?? '(unknown)'}`
      );
      continue;
    }
    placed.push({
      ...art,
      pos: { x: slot.x, z: slot.z },
      rotY: slot.rotY,
      floorY: slot.floorY,
      centerY: slot.floorY + ART_CENTER_OFF,
      size: art.size || slot.size,
    });
  }

  return placed;
}

// ---------------------------------------------------------------------------
// 갤러리 로드
// 우선순위: location.hash의 #gd=<base64url> (공유 링크, 디코딩 실패 시 다음 소스로)
//         → ?g=<id> → ./galleries/<id>.json (fetch 실패 시 다음 소스로)
//         → FALLBACK_GALLERY (내장 폴백)
// ---------------------------------------------------------------------------

const GALLERY_ID_RE = /^[a-z0-9-]+$/;

function getGalleryIdFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const g = params.get('g');
    if (g && GALLERY_ID_RE.test(g)) return g;
  } catch (err) {
    // URL 파싱 실패 시 기본값으로 진행
  }
  return 'syhongart';
}

// #gd= 해시에 base64url로 내장된 갤러리 JSON을 디코딩한다.
// 인코딩 규약: JSON.stringify → UTF-8 bytes → base64 → base64url(+/→-_, '=' 제거)
function decodeGalleryFromHash() {
  try {
    const hash = window.location.hash;
    if (!hash) return null;
    const match = hash.match(/[#&]gd=([^&]+)/);
    if (!match) return null;

    const b64url = match[1];
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const data = JSON.parse(json);

    if (!data || !Array.isArray(data.artworks)) {
      throw new Error('#gd= 데이터에 artworks 배열이 없습니다');
    }
    return data;
  } catch (err) {
    console.warn(
      '[artworks] #gd= 공유 링크 디코딩 실패, 다음 소스로 진행합니다:',
      err
    );
    return null;
  }
}

// 갤러리 로드 본체 — ensureGalleryLoaded()가 결과를 1회만 계산하도록 캐시한다.
// 반환값: { id, name, description, theme, artworks } (theme 필드 없으면 'daylight'로 보정)
async function loadGalleryInternal() {
  // 1순위: #gd= 공유 링크 (파일 업로드 없이 URL에 내장된 갤러리 데이터)
  const shared = decodeGalleryFromHash();
  if (shared) {
    // 공유 링크는 디렉터리에 없는 임시 전시다. 스튜디오가 내장한 id가 있어도
    // 무시하고 id=null로 두어, 전시 디렉터리 picker가 '공유된 전시 관람 중'으로
    // 처리하도록 한다(계약: #gd= 접속 시 getGalleryInfo().id === null).
    GALLERY_INFO = {
      id: null,
      name: shared.name ?? '공유된 전시',
      description: shared.description ?? '',
    };
    return {
      ...GALLERY_INFO,
      theme: shared.theme ?? 'daylight',
      artworks: shared.artworks,
    };
  }

  // 2순위: ?g=<id> → ./galleries/<id>.json
  const id = getGalleryIdFromUrl();
  try {
    const res = await fetch(`./galleries/${id}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data || !Array.isArray(data.artworks)) {
      throw new Error('gallery JSON에 artworks 배열이 없습니다');
    }
    GALLERY_INFO = {
      id: data.id ?? id,
      name: data.name ?? id,
      description: data.description ?? '',
    };
    return {
      ...GALLERY_INFO,
      theme: data.theme ?? 'daylight',
      artworks: data.artworks,
    };
  } catch (err) {
    console.warn(
      `[artworks] 갤러리 "${id}" 로드 실패, 내장 폴백 데이터를 사용합니다:`,
      err
    );
    // 3순위: 내장 폴백
    GALLERY_INFO = {
      id: FALLBACK_GALLERY.id,
      name: FALLBACK_GALLERY.name,
      description: FALLBACK_GALLERY.description,
    };
    return {
      ...GALLERY_INFO,
      theme: FALLBACK_GALLERY.theme ?? 'daylight',
      artworks: FALLBACK_GALLERY.artworks,
    };
  }
}

// loadGalleryInternal()의 결과를 1회만 계산해 재사용하는 캐시 프로미스.
// createArtworks()와 ensureGalleryLoaded()의 다른 호출자들이 동일한 프로미스를
// await하므로 fetch가 두 번 발생하지 않는다.
let galleryLoadPromise = null;

// 갤러리 데이터를 (최초 1회만) 로드해 캐시된 결과를 반환한다.
// 반환: { id, name, description, theme, artworks } — theme 필드가 없으면 'daylight'로 보정됨.
export function ensureGalleryLoaded() {
  if (!galleryLoadPromise) {
    galleryLoadPromise = loadGalleryInternal();
  }
  return galleryLoadPromise;
}

// 현재 로드된 작품 목록 (createArtworks가 채우고 getNearbyArtwork가 참조)
let ARTWORKS = [];

// 현재 로드된 갤러리 메타정보 (createArtworks 완료 후 유효, getGalleryInfo가 참조)
let GALLERY_INFO = null;

// ---------------------------------------------------------------------------
// 캔버스 텍스처 유틸
// ---------------------------------------------------------------------------

function makePlaceholderTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 366; // 1200x900 비율 근사 (2.8:2.0)
  const ctx = c.getContext('2d');

  // 옅은 회색 캔버스 질감
  ctx.fillStyle = '#e8e6e2';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 1;
  for (let i = 0; i < c.width; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, c.height);
    ctx.stroke();
  }
  for (let j = 0; j < c.height; j += 6) {
    ctx.beginPath();
    ctx.moveTo(0, j);
    ctx.lineTo(c.width, j);
    ctx.stroke();
  }
  ctx.fillStyle = '#b8b5b0';
  ctx.font = '500 22px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Loading…', c.width / 2, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePlaqueTexture(art) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#fbfbfa';
  ctx.fillRect(0, 0, c.width, c.height);

  // 미세한 테두리
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, c.width - 2, c.height - 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // 제목 (이탤릭 세리프 느낌 대신 미니멀 산세리프 볼드)
  ctx.fillStyle = '#111111';
  ctx.font = '700 34px Helvetica, Arial, sans-serif';
  ctx.fillText(art.title, 36, 92, c.width - 72);

  // 작가
  ctx.fillStyle = '#333333';
  ctx.font = '400 26px Helvetica, Arial, sans-serif';
  ctx.fillText(art.artist, 36, 148, c.width - 72);

  // 연도
  ctx.fillStyle = '#777777';
  ctx.font = '400 24px Helvetica, Arial, sans-serif';
  ctx.fillText(String(art.year), 36, 196, c.width - 72);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// 액자 + 플라크 + 스포트라이트 생성
// ---------------------------------------------------------------------------

function buildFrame(art, textureLoader) {
  const group = new THREE.Group();
  group.name = `artwork-${art.id}`;

  // 작품별 크기 (기본 2.8x2.0, size 필드로 오버라이드 — 정사각 작품 등)
  const artW = art.size ? art.size.w : ART_W;
  const artH = art.size ? art.size.h : ART_H;

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.4,
    metalness: 0.1,
  });

  // 프레임 4변 (박스). 개구부는 artW x artH.
  const outerW = artW + FRAME_BORDER * 2;

  const topBar = new THREE.Mesh(
    new THREE.BoxGeometry(outerW, FRAME_BORDER, FRAME_DEPTH),
    frameMat
  );
  topBar.position.set(0, artH / 2 + FRAME_BORDER / 2, 0);

  const bottomBar = new THREE.Mesh(
    new THREE.BoxGeometry(outerW, FRAME_BORDER, FRAME_DEPTH),
    frameMat
  );
  bottomBar.position.set(0, -(artH / 2 + FRAME_BORDER / 2), 0);

  const leftBar = new THREE.Mesh(
    new THREE.BoxGeometry(FRAME_BORDER, artH, FRAME_DEPTH),
    frameMat
  );
  leftBar.position.set(-(artW / 2 + FRAME_BORDER / 2), 0, 0);

  const rightBar = new THREE.Mesh(
    new THREE.BoxGeometry(FRAME_BORDER, artH, FRAME_DEPTH),
    frameMat
  );
  rightBar.position.set(artW / 2 + FRAME_BORDER / 2, 0, 0);

  for (const bar of [topBar, bottomBar, leftBar, rightBar]) {
    bar.castShadow = true;
    bar.receiveShadow = true;
    group.add(bar);
  }

  // 캔버스 백킹 (프레임 안쪽 뒷판)
  const backing = new THREE.Mesh(
    new THREE.BoxGeometry(artW, artH, FRAME_DEPTH * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
  );
  backing.position.set(0, 0, -FRAME_DEPTH * 0.2);
  backing.receiveShadow = true;
  group.add(backing);

  // 작품 평면 — placeholder 텍스처로 시작, 이미지/영상 로드 완료 시 교체
  const artMat = new THREE.MeshStandardMaterial({
    map: makePlaceholderTexture(),
    roughness: 0.85,
    metalness: 0.0,
  });
  const artPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(artW, artH),
    artMat
  );
  artPlane.position.set(0, 0, FRAME_DEPTH * 0.06 + 0.001);
  artPlane.receiveShadow = true;
  group.add(artPlane);

  if (art.videoUrl) {
    // 영상 작품 — VideoTexture (음소거 자동재생 + 루프)
    const video = document.createElement('video');
    video.src = art.videoUrl;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.addEventListener('canplay', () => {
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      const old = artMat.map;
      artMat.map = tex;
      // 영상 작품은 발광하는 스크린처럼 — 어두운 작품도 선명하게
      artMat.emissive = new THREE.Color(0xffffff);
      artMat.emissiveMap = tex;
      artMat.emissiveIntensity = 0.6;
      artMat.needsUpdate = true;
      if (old) old.dispose();
    }, { once: true });
    // 자동재생 차단 시 첫 사용자 입력에서 재시도
    video.play().catch(() => {
      const resume = () => {
        video.play().catch(() => {});
        window.removeEventListener('pointerdown', resume);
        window.removeEventListener('keydown', resume);
      };
      window.addEventListener('pointerdown', resume);
      window.addEventListener('keydown', resume);
    });
  } else {
    // 비동기 이미지 로드 (TextureLoader 기본 crossOrigin='anonymous')
    textureLoader.load(
      art.imageUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 8;
        const old = artMat.map;
        artMat.map = tex;
        artMat.needsUpdate = true;
        if (old) old.dispose();
      },
      undefined,
      () => {
        // 로드 실패 시 placeholder 유지
        console.warn(`[artworks] 이미지 로드 실패: ${art.imageUrl}`);
      }
    );
  }

  // 플라크 (작품 하단 우측 벽면, 흰색 라벨)
  const plaqueW = 0.5;
  const plaqueH = 0.25;
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(plaqueW, plaqueH),
    new THREE.MeshStandardMaterial({
      map: makePlaqueTexture(art),
      roughness: 0.6,
      metalness: 0.0,
    })
  );
  // 그룹 로컬 좌표: 작품 중심이 (0,0,0). 하단 우측에 배치.
  plaque.position.set(artW / 2 + FRAME_BORDER + 0.45, -(artH / 2) + 0.15, 0.02);
  group.add(plaque);

  return group;
}

function buildSpotlight(art, scene) {
  // 벽에서 실내 방향 법선: rotY=0 → +z, rotY=+PI/2 → +x, rotY=-PI/2 → -x
  const nx = Math.sin(art.rotY);
  const nz = Math.cos(art.rotY);
  const offset = 2.6; // 벽에서 실내로 들어온 거리

  const lx = art.pos.x + nx * offset;
  const lz = art.pos.z + nz * offset;

  // 넓은 콘 + 높은 penumbra = 갤러리 월워셔처럼 부드럽게 퍼지는 빛
  // (콘 경계가 딱딱한 원으로 잘리지 않도록 가장자리 대부분을 페더링)
  const spot = new THREE.SpotLight(0xfff4e0, 170);
  spot.angle = Math.PI / 5.5;
  spot.penumbra = 0.95;
  spot.decay = 2;
  spot.distance = 16;
  // 그림자는 메인 DirectionalLight(4096)가 담당 — 스포트라이트 14개가 각각
  // 섀도맵을 매 프레임 갱신하면 저사양 기기에서 프레임 드랍이 커서 비활성화
  spot.castShadow = false;
  const spotY = art.floorY + SPOT_OFF;
  spot.position.set(lx, spotY, lz);

  spot.target.position.set(art.pos.x, art.centerY, art.pos.z);
  scene.add(spot);
  scene.add(spot.target);

  // 트랙라이트 헤드 메시 (천장 트랙에 매달린 원통형 헤드)
  const head = new THREE.Group();

  const headBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.09, 0.26, 16),
    new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.35, metalness: 0.6 })
  );
  head.add(headBody);

  // 발광면 (헤드 앞쪽)
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.065, 16),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfff2d0,
      emissiveIntensity: 3.0,
      roughness: 1.0,
    })
  );
  lens.position.y = -0.131;
  lens.rotation.x = Math.PI / 2;
  head.add(lens);

  // 짧은 지지대 (트랙 연결부)
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8),
    new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.4, metalness: 0.6 })
  );
  stem.position.y = 0.19;
  head.add(stem);

  head.position.set(lx, spotY, lz);
  // 헤드를 작품 방향으로 기울임: -Y 축(발광면)이 타깃을 향하도록
  const dir = new THREE.Vector3(
    art.pos.x - lx,
    art.centerY - spotY,
    art.pos.z - lz
  ).normalize();
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    dir
  );
  head.quaternion.copy(quat);
  scene.add(head);
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

export async function createArtworks(scene) {
  const ginfo = await ensureGalleryLoaded();
  ARTWORKS = assignSlots(ginfo.artworks);

  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');

  for (const art of ARTWORKS) {
    const frame = buildFrame(art, textureLoader);
    frame.position.set(art.pos.x, art.centerY, art.pos.z);
    frame.rotation.y = art.rotY;

    // 벽에 살짝 띄워 z-fighting 방지 (벽 안쪽 방향으로 프레임 절반 + 여유)
    const nx = Math.sin(art.rotY);
    const nz = Math.cos(art.rotY);
    frame.position.x += nx * (FRAME_DEPTH / 2 + 0.01);
    frame.position.z += nz * (FRAME_DEPTH / 2 + 0.01);

    scene.add(frame);
    buildSpotlight(art, scene);
  }
  // 이미지는 백그라운드에서 계속 로드됨 (placeholder → 실이미지 교체)
}

// createArtworks 완료 후 유효. 그 전에는 null.
export function getGalleryInfo() {
  return GALLERY_INFO;
}

export function getNearbyArtwork(position) {
  let best = null;
  let bestDist = NEARBY_DIST;
  for (const art of ARTWORKS) {
    // 같은 층에서만 (다른 층의 같은 x/z 작품이 잡히지 않도록)
    if (Math.abs(position.y - (art.floorY + EYE_HEIGHT)) > 2.0) continue;
    const dx = position.x - art.pos.x;
    const dz = position.z - art.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d <= bestDist) {
      bestDist = d;
      best = art;
    }
  }
  return best;
}

// 배치 완료된 작품 배열 (createArtworks 완료 후 유효, 이전엔 []).
// 호출측의 우발적 변형으로부터 내부 배열을 보호하기 위해 얕은 복사본을 반환한다.
export function getPlacedArtworks() {
  return ARTWORKS.slice();
}

// 감상 포즈 계산 — 좌표 규약:
//   normal = (sin(art.rotY), cos(art.rotY))  (실내 쪽을 향함)
//   감상 위치 = art.pos + normal * VIEWING_DIST (x, z)
//   감상 yaw = art.rotY
const VIEWING_DIST = 2.6;

export function getViewingPose(art) {
  const nx = Math.sin(art.rotY);
  const nz = Math.cos(art.rotY);
  return {
    x: art.pos.x + nx * VIEWING_DIST,
    y: art.floorY + EYE_HEIGHT,
    z: art.pos.z + nz * VIEWING_DIST,
    ry: art.rotY,
  };
}
