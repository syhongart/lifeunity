// artworks.js — LifeUnity Metaverse Museum
// 12점의 작품(액자 + 플라크 + 작품별 스포트라이트) 생성 및 근접 작품 탐색.
// 소유 파일: web/js/artworks.js (이 파일만 수정)

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// 작품 데이터
// 배치: 북쪽 벽(z=-25 실내면, rotY=0) x = -18,-6,6,18
//       서쪽 벽(x=-25 실내면, rotY=+PI/2) z = -18,-6,6,18
//       동쪽 벽(x=+25 실내면, rotY=-PI/2) z = -18,-6,6,18
// pos는 벽 실내면 좌표 — createArtworks가 프레임 절반+0.01m만큼 실내로 띄움
// ---------------------------------------------------------------------------

const PICSUM = (id) => `https://picsum.photos/id/${id}/1200/900`;

export const ARTWORKS = [
  // ---- 북쪽 벽 ----
  {
    id: 'aw-01',
    title: 'Alpine Silence',
    artist: 'Mara Ellingsen',
    year: 2024,
    desc: '고요한 산악 풍경 속에서 인간의 부재가 만들어내는 긴장을 포착한 작품입니다. 차가운 공기와 빛의 결을 통해 자연의 숭고함을 응시하게 합니다.',
    imageUrl: PICSUM(1018),
    pos: { x: -18, z: -25 },
    rotY: 0,
  },
  {
    id: 'aw-02',
    title: 'River Vein',
    artist: 'Jonas Feld',
    year: 2025,
    desc: '대지를 가로지르는 강줄기를 생명의 혈관으로 해석한 항공 시점의 풍경입니다. 물과 땅의 경계에서 시간의 흐름을 읽어냅니다.',
    imageUrl: PICSUM(1015),
    pos: { x: -6, z: -25 },
    rotY: 0,
  },
  {
    id: 'aw-03',
    title: 'Fog Meridian',
    artist: 'Celeste Aubert',
    year: 2026,
    desc: '안개가 삼킨 수평선 위로 떠오르는 미묘한 빛의 층위를 기록했습니다. 보이는 것과 보이지 않는 것 사이의 경계를 질문하는 작품입니다.',
    imageUrl: PICSUM(1025),
    pos: { x: 6, z: -25 },
    rotY: 0,
  },
  {
    id: 'aw-04',
    title: 'Harbor Study No.7',
    artist: 'Theo Lindqvist',
    year: 2024,
    desc: '항구 도시의 일상적 풍경을 절제된 구도로 담아낸 연작의 일곱 번째 작품입니다. 정박과 출항 사이, 머무름의 미학을 탐구합니다.',
    imageUrl: PICSUM(1039),
    pos: { x: 18, z: -25 },
    rotY: 0,
  },

  // ---- 서쪽 벽 ----
  {
    id: 'aw-05',
    title: 'Quiet Arrival',
    artist: 'Ines Marchetti',
    year: 2025,
    desc: '도착이라는 순간이 지닌 낯섦과 안도감을 동시에 그려낸 작품입니다. 화면의 여백은 관객 각자의 여정을 투영하는 거울이 됩니다.',
    imageUrl: PICSUM(1043),
    pos: { x: -25, z: -18 },
    rotY: Math.PI / 2,
  },
  {
    id: 'aw-06',
    title: 'Meadow Frequency',
    artist: 'Ruben Castell',
    year: 2024,
    desc: '초원의 바람을 시각적 주파수로 번역하려는 시도에서 출발한 작품입니다. 반복되는 결의 리듬이 화면 전체에 잔잔한 진동을 남깁니다.',
    imageUrl: PICSUM(1050),
    pos: { x: -25, z: -6 },
    rotY: Math.PI / 2,
  },
  {
    id: 'aw-07',
    title: 'Salt and Distance',
    artist: 'Hana Okabe',
    year: 2026,
    desc: '바다와 육지가 만나는 지점에서 거리감이라는 감각을 해부합니다. 소금기 어린 공기의 질감이 화면 너머로 전해지는 듯한 작품입니다.',
    imageUrl: PICSUM(1062),
    pos: { x: -25, z: 6 },
    rotY: Math.PI / 2,
  },
  {
    id: 'aw-08',
    title: 'Terrace of Hours',
    artist: 'Viktor Brandt',
    year: 2025,
    desc: '하루의 시간이 층층이 쌓이는 계단식 풍경을 은유적으로 담았습니다. 빛의 각도가 만들어내는 그림자의 계보를 따라가는 작품입니다.',
    imageUrl: PICSUM(1074),
    pos: { x: -25, z: 18 },
    rotY: Math.PI / 2,
  },

  // ---- 동쪽 벽 ----
  {
    id: 'aw-09',
    title: 'Northern Interval',
    artist: 'Solveig Anker',
    year: 2024,
    desc: '북구의 짧은 낮과 긴 밤 사이의 간극을 색채의 온도로 표현했습니다. 침묵에 가까운 화면이 오히려 강한 서사를 품고 있는 작품입니다.',
    imageUrl: PICSUM(1080),
    pos: { x: 25, z: -18 },
    rotY: -Math.PI / 2,
  },
  {
    id: 'aw-10',
    title: 'Concrete Bloom',
    artist: 'Adrian Voss',
    year: 2026,
    desc: '도시의 콘크리트 표면 위에서 피어나는 우연한 아름다움을 채집한 작품입니다. 인공과 자연의 경계가 흐려지는 순간을 포착합니다.',
    imageUrl: PICSUM(110),
    pos: { x: 25, z: -6 },
    rotY: -Math.PI / 2,
  },
  {
    id: 'aw-11',
    title: 'Vanishing Grid',
    artist: 'Lena Horvat',
    year: 2025,
    desc: '소실점을 향해 수렴하는 구조물의 격자를 통해 질서와 무한을 사유합니다. 기하학적 반복 속에 숨은 미세한 불규칙이 작품의 핵심입니다.',
    imageUrl: PICSUM(164),
    pos: { x: 25, z: 6 },
    rotY: -Math.PI / 2,
  },
  {
    id: 'aw-12',
    title: 'Afterlight Sequence',
    artist: 'Emil Radoux',
    year: 2024,
    desc: '해가 진 직후 잔광이 사물에 남기는 마지막 색을 연속적으로 기록했습니다. 사라지는 것들에 대한 애도이자 기억의 방식에 관한 작품입니다.',
    imageUrl: PICSUM(219),
    pos: { x: 25, z: 18 },
    rotY: -Math.PI / 2,
  },

  // ---- 남쪽 벽: 작가 특별전 (syhongart) ----
  {
    id: 'aw-featured-01',
    title: 'Neon Vanitas',
    artist: 'syhongart',
    year: 2026,
    desc: '네온 프레임 속 크롬 핑크 스컬을 통해 디지털 시대의 바니타스(vanitas)를 재해석한 작품입니다. 화려한 빛의 입자들 사이에서 소멸과 영원이 교차합니다.',
    imageUrl: './assets/neon-vanitas.png',
    pos: { x: -6, z: 25 },
    rotY: Math.PI,
    size: { w: 2.2, h: 2.2 },
  },
  {
    id: 'aw-featured-02',
    title: 'Neon Motion',
    artist: 'syhongart',
    year: 2026,
    desc: '움직이는 빛으로 그린 싱글 채널 비디오 작품입니다. 정지된 회화가 담을 수 없는 시간의 층위를 네온의 리듬으로 풀어냅니다.',
    videoUrl: './assets/neon-motion.mp4',
    pos: { x: 6, z: 25 },
    rotY: Math.PI,
    size: { w: 2.2, h: 2.2 },
  },
];

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const ART_W = 2.8; // 작품 폭 (m)
const ART_H = 2.0; // 작품 높이 (m)
const ART_CENTER_Y = 2.6; // 작품 중심 높이 (m)
const FRAME_DEPTH = 0.1; // 프레임 두께 (m)
const FRAME_BORDER = 0.09; // 프레임 테두리 폭 (m)
const CEILING_LIGHT_Y = 6.8; // 스포트라이트 높이
const NEARBY_DIST = 3.0; // 근접 판정 거리 (m)

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

  const spot = new THREE.SpotLight(0xfff4e0, 150);
  spot.angle = Math.PI / 8;
  spot.penumbra = 0.5;
  spot.decay = 2;
  spot.distance = 14;
  // 그림자는 메인 DirectionalLight(4096)가 담당 — 스포트라이트 14개가 각각
  // 섀도맵을 매 프레임 갱신하면 저사양 기기에서 프레임 드랍이 커서 비활성화
  spot.castShadow = false;
  spot.position.set(lx, CEILING_LIGHT_Y, lz);

  spot.target.position.set(art.pos.x, ART_CENTER_Y, art.pos.z);
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

  head.position.set(lx, CEILING_LIGHT_Y, lz);
  // 헤드를 작품 방향으로 기울임: -Y 축(발광면)이 타깃을 향하도록
  const dir = new THREE.Vector3(
    art.pos.x - lx,
    ART_CENTER_Y - CEILING_LIGHT_Y,
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
  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin('anonymous');

  for (const art of ARTWORKS) {
    const frame = buildFrame(art, textureLoader);
    frame.position.set(art.pos.x, ART_CENTER_Y, art.pos.z);
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

export function getNearbyArtwork(position) {
  let best = null;
  let bestDist = NEARBY_DIST;
  for (const art of ARTWORKS) {
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
