// main.js — ARTSHOW Museum 통합 엔트리 포인트
// 소유: 통합 담당. 다른 모듈의 공개 API 계약을 그대로 사용한다.

import * as THREE from 'three';
import { ROOM, EYE_HEIGHT, BUILDING, PEER_ROOM_ID } from './config.js';
import { createMuseum, sceneTick } from './scene.js';
import {
  ensureGalleryLoaded,
  createArtworks,
  getNearbyArtwork,
  getPlacedArtworks,
  getArtworkHitMeshes,
  getViewingPose,
} from './artworks.js';
import { startAmbient } from './ambient.js';
import { PlayerController } from './player.js';
import { MultiplayerManager } from './multiplayer.js';
import { preloadAvatarTemplates, createAvatarInstance } from './avatar.js';
import { NpcCrowd } from './npc.js';
import { loadNotes, saveNotes, mergeNotes, makeNote } from './guestbook.js';
import { GalleryStats } from './stats.js';
import { VisitorLog, PhotoWall } from './feed.js';
import {
  initUI,
  showLoading,
  hideLobby,
  showArtworkInfo,
  hideArtworkInfo,
  addChatMessage,
  setPlayerCount,
  setStatus,
  setFPS,
  showLightbox,
  isLightboxOpen,
  setOnLightboxClose,
  setGalleryTitle,
  initGalleryPicker,
  initArtworkList,
  toggleArtworkList,
  hideArtworkList,
  isArtworkListOpen,
  showTourBar,
  hideTourBar,
  setTourHandlers,
  setActionHandlers,
  initGuestbook,
  toggleGuestbook,
  isGuestbookOpen,
  setGuestbookNotes,
  setGuestbookStats,
  setDockActive,
  showShareModal,
  isShareModalOpen,
  flashShutter,
} from './ui.js';

let renderer = null;
let scene = null;
let camera = null;
let player = null;
let mp = null; // MultiplayerManager — 입장 전에는 null (sendState/update 가드)
let npcCrowd = null; // AI 관객 — 호스트가 될 때 npcProvider 안에서 지연 생성
let stats = null; // 작가 리포트 (전시별 방문·감상 통계 — stats.js)
const visitorLog = new VisitorLog(); // 랜딩 "최근 관람객" 피드
// 적응형 저사양 모드 — 실측 FPS가 낮으면 화면에서 먼 AI 관객을 잠시 숨긴다.
// (시뮬레이션·다른 접속자에게는 영향 없음 — 순수 로컬 렌더 절약)
let liteMode = false;
let liteToggleCooldown = 0;
let liteCullAccum = 0;
const LITE_ENTER_FPS = 24;
const LITE_EXIT_FPS = 45;
const LITE_VISIBLE_NPCS = 3;

// 품질 사다리 학습 — AA/해상도 배율은 렌더러 생성 시에만 정할 수 있어,
// 이번 세션의 실측 FPS로 다음 접속의 시작 품질을 학습한다.
//   'low'  : AA off, 배율 1.25 (저사양 모드가 발동됐던 기기)
//   null   : AA on, 터치 1.5 / 데스크톱 최소 1.5× 슈퍼샘플 (기본)
//   'high' : AA on + 2.0× 풀 슈퍼샘플 (FPS 55+가 10초 지속됐던 기기)
// 고FPS 지속 시 low→기본→high로 한 단계씩 승급, 저사양 모드 발동 시 즉시 low.
const SPEC_KEY = 'lu-spec-v2';
// 성능 세대 — 베이킹처럼 부하 구조가 크게 바뀌는 최적화를 배포할 때 +1.
// 과거 세대에서 학습된 low/high 판정은 무효화하고 기본값에서 재평가한다
// (실기기 제보: 무겁던 시절 low로 학습된 폰이 최적화 후에도 AA off로 남던 문제).
const PERF_GEN = 2;
function readSpec() {
  try {
    const raw = localStorage.getItem(SPEC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.gen === PERF_GEN && (parsed.v === 'low' || parsed.v === 'high')) return parsed.v;
      return null; // 세대 불일치 — 재평가
    }
    return null;
  } catch (_) {
    return null;
  }
}
function writeSpec(v) {
  try {
    if (v) localStorage.setItem(SPEC_KEY, JSON.stringify({ v, gen: PERF_GEN }));
    else localStorage.removeItem(SPEC_KEY);
    localStorage.removeItem('lu-spec-v1');
    localStorage.removeItem('lu-lowspec-v1');
  } catch (_) { /* 무시 */ }
}
let specFastTicks = 0; // 승급용 고FPS 연속 카운트

// ---------------------------------------------------------------------------
// 첫 방문 행동 온보딩 (터치 전용, UX 감사 §3 경량판) — 모달 대신 "행동으로
// 배우는" 3단계: 이동 힌트(맥동 링) → 시점 스와이프 힌트 → 투어 안전망 안내.
// 각 단계는 실제 행동(이동/회전)이 감지되면 넘어가며 localStorage로 1회만.
// ---------------------------------------------------------------------------
const ONBOARD_KEY = 'lu-onboard-v1';
let onboardStep = -1; // -1: 비활성
let onboardRing = null;
let onboardPos0 = null;
let onboardYaw0 = 0;
let onboardDoneT = 0;

function startOnboarding() {
  try {
    if (localStorage.getItem(ONBOARD_KEY)) return;
  } catch (_) { /* 접근 불가 시 매번 떠도 무해 */ }
  if (!(typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)) return;
  onboardStep = 0;
  const st = player.getState();
  onboardPos0 = { x: st.x, z: st.z };
  // 맥동하는 조이스틱 프리뷰 링 — 플로팅 조이스틱이라 위치가 달라도 동작 일치
  const styleTag = document.createElement('style');
  styleTag.textContent = '@keyframes lu-ob-pulse { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.75;} 70%{transform:translate(-50%,-50%) scale(1.25);opacity:0.2;} 100%{transform:translate(-50%,-50%) scale(1);opacity:0.75;} }';
  document.head.appendChild(styleTag);
  onboardRing = document.createElement('div');
  onboardRing.style.cssText =
    'position:fixed;left:24%;bottom:22%;width:110px;height:110px;border-radius:50%;' +
    'border:3px solid rgba(255,253,247,0.85);pointer-events:none;z-index:60;' +
    'transform:translate(-50%,-50%);animation:lu-ob-pulse 1.6s ease-in-out infinite;';
  document.body.appendChild(onboardRing);
  setStatus('왼쪽 화면을 누른 채 밀면 걸어요 🚶');
}

function tickOnboarding() {
  if (onboardStep < 0) return;
  const st = player.getState();
  if (onboardStep === 0) {
    if (Math.hypot(st.x - onboardPos0.x, st.z - onboardPos0.z) > 1.5) {
      onboardStep = 1;
      onboardYaw0 = st.ry;
      if (onboardRing) {
        onboardRing.remove();
        onboardRing = null;
      }
      setStatus('잘했어요! 오른쪽 화면을 쓸면 주위를 둘러봐요 👀');
    }
  } else if (onboardStep === 1) {
    let dy = st.ry - onboardYaw0;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    if (Math.abs(dy) > 0.6) {
      onboardStep = 2;
      onboardDoneT = 0;
      setStatus('작품에 다가가면 설명이 나타나요 — 어려우면 [투어] 버튼을 눌러요 🖼️');
    }
  } else if (onboardStep === 2) {
    onboardDoneT += 1;
    if (onboardDoneT > 420) { // ~7초(60fps 기준) 후 종료
      onboardStep = -1;
      try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (_) { /* 무시 */ }
    }
  }
}

function applyNpcCulling() {
  if (!mp) return;
  const npcs = [];
  for (const [rid, av] of mp.remoteAvatars) {
    if (rid.startsWith('npc-')) npcs.push(av);
  }
  if (!liteMode) {
    for (const av of npcs) av.group.visible = true;
    return;
  }
  npcs.sort((a, b) => a.group.position.distanceTo(camera.position) - b.group.position.distanceTo(camera.position));
  npcs.forEach((av, i) => {
    av.group.visible = i < LITE_VISIBLE_NPCS;
  });
}
const photoWall = new PhotoWall(); // 랜딩 "라이브 포토월" 피드
let statsDwellTimer = null;

// ---------------------------------------------------------------------------
// 3인칭 '내 모습 보기' (V키 / 터치 독 '시점' 버튼)
// 플레이어 제어는 1인칭 그대로 두고, 렌더 직전에만 카메라를 시선 반대 방향으로
// 당겼다가 복원한다 — player.js가 camera.position을 눈 위치로 소유하는 계약을
// 깨지 않는다(이동·충돌·상태 전송 모두 눈 위치 기준 유지).
// ---------------------------------------------------------------------------
const SELF_CAM_DIST = 3.0;
const SELF_CAM_RISE = 0.7;
const SELF_CAM_TILT = -0.2; // 살짝 내려다보는 오버숄더 앵글(rad)
let thirdPerson = false;
let selfAvatar = null;  // createAvatarInstance() 결과 — 최초 토글 시 지연 생성
let selfInfo = null;    // { nickname, color, char } — 입장 시 캡처
let selfPrev = null;    // 자기 속도 산출용 직전 (x,z)
let selfSpeed = 0;
const _selfCamSaved = new THREE.Vector3();
const _selfCamBack = new THREE.Vector3();
const _selfCamQuatSaved = new THREE.Quaternion();

function toggleSelfView() {
  if (!entered) return;
  thirdPerson = !thirdPerson;
  if (thirdPerson) {
    if (!selfAvatar && selfInfo) {
      try {
        selfAvatar = createAvatarInstance(selfInfo.char, selfInfo.color, ' ');
        // 닉네임 라벨 스프라이트 숨김 — 3인칭 화면 중앙을 빈 알약이 가리지 않게
        selfAvatar.group.traverse((o) => {
          if (o.isSprite) o.visible = false;
        });
        scene.add(selfAvatar.group);
      } catch (err) {
        console.warn('내 아바타 생성 실패:', err);
        selfAvatar = null;
        thirdPerson = false;
        return;
      }
    }
    if (!selfAvatar) {
      thirdPerson = false;
      return;
    }
    selfAvatar.group.visible = true;
    setDockActive('self', true);
    selfPrev = null;
    selfSpeed = 0;
    setStatus('내 모습 보기 — V키 또는 [시점] 버튼으로 복귀');
  } else if (selfAvatar) {
    selfAvatar.group.visible = false;
    setDockActive('self', false);
  }
}

function applySelfCamOffset() {
  _selfCamSaved.copy(camera.position);
  _selfCamQuatSaved.copy(camera.quaternion);
  _selfCamBack.set(0, 0, 1).applyQuaternion(camera.quaternion);
  camera.position.addScaledVector(_selfCamBack, SELF_CAM_DIST);
  camera.position.y += SELF_CAM_RISE;
  camera.rotateX(SELF_CAM_TILT);
}
function restoreSelfCamOffset() {
  camera.position.copy(_selfCamSaved);
  camera.quaternion.copy(_selfCamQuatSaved);
}

// ---------------------------------------------------------------------------
// 캐릭터 때리기 — 캔버스 탭/클릭(데스크톱·모바일 공용)으로 아바타를 콕.
// 드래그(시점 회전/이동)와 구분: 이동 7px 미만 + 450ms 미만만 탭으로 인정.
// 명중 판정은 레이캐스트, 사거리 4m — 호스트가 서버 권위로 한 번 더 검증한다.
// ---------------------------------------------------------------------------
const HIT_REACH = 4.0;
const _tapRaycaster = new THREE.Raycaster();
const _tapNdc = new THREE.Vector2();
let _tapDown = null;

function bindHitTap(dom) {
  dom.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    _tapDown = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  dom.addEventListener('pointerup', (e) => {
    const down = _tapDown;
    _tapDown = null;
    if (!down || !e.isPrimary || !entered || !mp) return;
    if (performance.now() - down.t > 450) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) return;
    const rect = dom.getBoundingClientRect();
    _tapNdc.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    _tapRaycaster.setFromCamera(_tapNdc, camera);
    _tapRaycaster.far = HIT_REACH + SELF_CAM_DIST; // 3인칭이면 카메라가 뒤로 빠져 있음
    const entries = [...mp.remoteAvatars.entries()];
    if (!entries.length) return;
    const groups = entries.map(([, av]) => av.group);
    const hits = _tapRaycaster.intersectObjects(groups, true);
    if (hits.length) {
      // 아바타 명중 — 콕 찌르기
      let node = hits[0].object;
      while (node && !groups.includes(node)) node = node.parent;
      if (node) {
        const [id] = entries[groups.indexOf(node)];
        mp.sendHit(id);
        return;
      }
    }
    // 아바타 미명중 — 작품 탭이면 그 작품 앞으로 자동 이동 (UX 감사 §4:
    // 이동 조작이 서툰 관람객도 탭 한 번으로 작품에 도달)
    _tapRaycaster.far = 60;
    const artHits = _tapRaycaster.intersectObjects(getArtworkHitMeshes(), false);
    if (artHits.length && artHits[0].object.userData.luArt) {
      handleArtworkSelect(artHits[0].object.userData.luArt);
    }
  });
}
let clock = null;
let myNickname = '게스트'; // 입장 시 갱신 — 채팅 isSelf 판별용
let entered = false; // 로비 통과 여부 — 라이트박스 E키 게이트에 사용
let galleryInfo = null; // ensureGalleryLoaded() 결과 캐시 (전시 디렉터리 picker의 currentId로 사용)
let placedArtworks = []; // getPlacedArtworks() 캐시 — 작품 목록/투어 공용

// 방명록 상태 — 갤러리별 localStorage 키(gbKey) + 현재 렌더 중인 병합본(guestbookNotes) 캐시
let gbKey = 'shared';
let guestbookNotes = [];
let guestbookSentOnce = false; // mp 연결 성공 직후 로컬 노트를 1회만 전송하기 위한 플래그

// FPS 집계
let fpsFrames = 0;
let fpsElapsed = 0;

// ---------------------------------------------------------------------------
// 카메라 트윈 (텔레포트/투어 공용) — animate 루프 안에서 매 프레임 갱신된다.
// ---------------------------------------------------------------------------
let tween = null; // { fromX, fromZ, fromRy, toX, toZ, toRy, duration, elapsed, onDone }

const TWEEN_MIN_DURATION = 0.8; // s
const TWEEN_MAX_DURATION = 2.2; // s

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// 최단 각도 보간 (라디안). yaw가 -PI..PI 경계를 도는 방향으로 자연스럽게 회전한다.
function lerpAngle(a, b, t) {
  let diff = (b - a) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * t;
}

// 현재 카메라 pose → 목표 pose로 부드럽게 이동을 시작한다. 이동 중에는
// player.disable()을 유지하고, 완료 시 onDone(목표 pose)을 호출한다.
function startTween(toPose, onDone) {
  const cur = player.getState();
  const toY = typeof toPose.y === 'number' ? toPose.y : cur.y;
  const dx = toPose.x - cur.x;
  const dy = toY - cur.y;
  const dz = toPose.z - cur.z;
  const dist = Math.hypot(dx, dy, dz);
  const duration = THREE.MathUtils.clamp(
    TWEEN_MIN_DURATION + dist * 0.035,
    TWEEN_MIN_DURATION,
    TWEEN_MAX_DURATION
  );
  player.disable();
  tween = {
    fromX: cur.x,
    fromY: cur.y,
    fromZ: cur.z,
    fromRy: cur.ry,
    toX: toPose.x,
    toY: toY,
    toZ: toPose.z,
    toRy: toPose.ry,
    duration,
    elapsed: 0,
    onDone: onDone || null,
  };
}

const tweenEuler = new THREE.Euler(0, 0, 0, 'YXZ');

function updateTween(delta) {
  if (!tween) return;
  tween.elapsed += delta;
  const t = Math.min(1, tween.elapsed / tween.duration);
  const e = easeInOutCubic(t);
  const x = tween.fromX + (tween.toX - tween.fromX) * e;
  const y = tween.fromY + (tween.toY - tween.fromY) * e;
  const z = tween.fromZ + (tween.toZ - tween.fromZ) * e;
  const ry = lerpAngle(tween.fromRy, tween.toRy, e);
  camera.position.set(x, y, z);
  tweenEuler.set(0, ry, 0, 'YXZ');
  camera.quaternion.setFromEuler(tweenEuler);
  if (t >= 1) {
    const done = tween.onDone;
    tween = null;
    if (done) done();
  }
}

// ---------------------------------------------------------------------------
// 도슨트 투어 상태
// ---------------------------------------------------------------------------
let touring = false;
let tourIndex = 0;
let tourAutoOn = true;
let tourWaiting = false; // 목적지 도착 후 머무름 카운트 중인지
let tourStayElapsed = 0;
const TOUR_STAY_SECONDS = 6;

async function init() {
  showLoading(true);

  // 1. 렌더러 / 씬 / 카메라
  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    55, // 자연 원근 (사람 시야감) — 광각 왜곡 없이 180cm 관람자의 눈으로
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(BUILDING.spawn.x, EYE_HEIGHT, BUILDING.spawn.z);

  // 품질 사다리 적용 — MSAA(antialias) + 슈퍼샘플링(SSAA, 화면보다 크게
  // 렌더 후 축소)으로 계단 현상을 이중으로 누른다.
  const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const spec = readSpec();
  renderer = new THREE.WebGLRenderer({ antialias: spec !== 'low' });
  bindHitTap(renderer.domElement);
  // 비네팅 — 가장자리를 살짝 눌러 시선을 화면 중앙(작품)으로 모은다.
  // DOM 오버레이라 GPU 비용 0. 사진 캡처에는 capturePhoto가 동일 그라디언트를
  // 캔버스에 합성해 화면과 같은 무드로 저장된다.
  const vignette = document.createElement('div');
  vignette.id = 'lu-vignette';
  vignette.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:5;' +
    'background:radial-gradient(ellipse 72% 62% at 50% 46%,' +
    ' rgba(8,6,4,0) 50%, rgba(8,6,4,0.03) 62%, rgba(8,6,4,0.09) 72%,' +
    ' rgba(8,6,4,0.17) 82%, rgba(8,6,4,0.26) 91%, rgba(8,6,4,0.34) 100%);';
  document.body.appendChild(vignette);

  const dpr = window.devicePixelRatio || 1;
  let ratio;
  if (spec === 'low') {
    ratio = Math.min(dpr, 1.25);
  } else if (spec === 'high') {
    ratio = Math.min(Math.max(dpr, 2), 2.5); // 고사양: 네이티브(최대 2.5)
  } else if (coarsePointer) {
    // 실기기 제보: 고DPR 폰을 1.5로 캡하면 절반 해상도 확대라 액자 모서리
    // 계단이 심함 — 기본을 2.0 캡으로 상향 (베이킹 후 씬이 가벼워져 감당 가능)
    ratio = Math.min(dpr, 2);
  } else {
    ratio = Math.min(Math.max(dpr, 1.5), 2);
  }
  renderer.setPixelRatio(ratio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92; // 전체 감광 — 갤러리 무드 (기존 1.1)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // 2. 갤러리 데이터 로드(1회, 캐시) → 테마 반영 뮤지엄 건축 → 작품 설치
  //    createArtworks() 내부에서도 동일한 캐시된 프로미스를 await하므로 fetch는 1회만 발생한다.
  const ginfo = await ensureGalleryLoaded();
  createMuseum(scene, resolveAutoTheme(ginfo.theme));
  await createArtworks(scene);

  // 리깅 아바타(GLB) 4종 백그라운드 프리로드 — await하지 않는다. 로비에서 닉네임/색/
  // 캐릭터를 고르는 동안 네트워크로 로드가 끝나길 노려, 입장(handleEnter) 시점에 이미
  // 캐시돼 있도록 하기 위함. 캐릭터별 개별 실패는 avatar.js가 캡슐 폴백으로 처리한다.
  preloadAvatarTemplates();

  // 전시 제목 표시 + 전시 디렉터리 picker 배선 (ginfo 재사용)
  galleryInfo = ginfo;
  setGalleryTitle(galleryInfo.name);
  loadGalleryDirectory();

  // 방명록 — 갤러리별 로컬 노트 로드 (공유 링크 등 id가 없으면 'shared' 키 사용)
  gbKey = ginfo.id ?? 'shared';
  guestbookNotes = loadNotes(gbKey);
  setGuestbookNotes(guestbookNotes);
  initGuestbook({ onSubmit: handleGuestbookSubmit });

  // 작품 목록 패널 + 도슨트 투어 배선 (createArtworks 완료 후에만 유효)
  placedArtworks = getPlacedArtworks();
  initArtworkList(placedArtworks, handleArtworkSelect);
  setTourHandlers({
    onPrev: tourPrev,
    onNext: tourNext,
    onExit: exitTour,
    onToggleAuto: tourToggleAuto,
  });
  // 터치 기기 액션 독(투어/방명록)·작품 패널 '크게 보기' 버튼 — 키보드 T/E/G의 대체 진입점
  setActionHandlers({
    onSelfView: () => { if (entered && !isShareModalOpen()) toggleSelfView(); },
    onTour: () => { if (entered) toggleTour(); },
    onViewArtwork: viewCurrentArtwork,
    onGuestbook: () => { if (entered && !isLightboxOpen()) toggleGuestbook(); },
    onCapture: () => { if (entered && !isShareModalOpen()) { flashShutter(); capturePhoto(); } },
  });

  // 3. 플레이어 컨트롤러 (로비 동안 비활성)
  // 생성자가 스폰 위치를 z=8로 재설정하므로, 의도한 스폰(z=12)은 생성 후 지정
  player = new PlayerController(camera, renderer.domElement);
  // BUILDING.spawn — 1F 남측 입구 앞, 북쪽(작품 벽)을 바라보고 시작
  const spawnFloor = BUILDING.floors.find((f) => f.id === BUILDING.spawn.floor);
  player.setPose({
    x: BUILDING.spawn.x,
    y: (spawnFloor ? spawnFloor.y : 0) + EYE_HEIGHT,
    z: BUILDING.spawn.z,
    ry: BUILDING.spawn.ry,
  });
  player.disable();

  // 4. UI 초기화 → 로비 표시
  initUI({
    onEnter: handleEnter,
    onChatSend: handleChatSend,
  });
  showLoading(false);

  // 라이트박스가 닫히면(ESC/X/배경 클릭 모두) 플레이어 이동을 재활성화.
  // 단, 투어 진행 중에는 카메라를 투어가 계속 통제해야 하므로 재활성화하지 않는다.
  setOnLightboxClose(() => {
    if (entered && !touring) player.enable();
  });

  // 리사이즈 대응
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);

  // 렌더 루프 시작
  clock = new THREE.Clock();
  renderer.setAnimationLoop(animate);
}

// 전시 디렉터리 로드 — 실패 시(파일 없음, #gd= 공유 링크 접속 등) 조용히 스킵.
// #gd= 공유 링크로 접속한 경우 ensureGalleryLoaded() 결과의 id가 null이므로 currentId도
// null로 전달되며, ui.js가 이를 '공유된 전시 관람 중'으로 처리한다.
function loadGalleryDirectory() {
  fetch('./galleries/index.json')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((list) => {
      if (!Array.isArray(list)) return;
      const currentId = galleryInfo ? galleryInfo.id : null;
      initGalleryPicker(list, currentId, (id) => {
        window.location.href = './index.html?g=' + id;
      });
    })
    .catch(() => {
      // 디렉터리가 없거나 로드에 실패해도 로비/관람에는 영향 없음
    });
}

// 전역 키 입력 — E(라이트박스) / M(작품 목록) / T(투어) / ←→(투어 이전·다음) / ESC(투어 종료).
// 채팅 입력창 포커스 중에는 ui.js의 입력 핸들러가 keydown을 stopPropagation하므로
// 여기까지 도달하지 않는다.
// 'auto' 테마 → 관람객의 현지 시각으로 실제 테마 결정 (입장 시점 1회 — 추가 부하 없음).
// 06~16시 daylight / 16~19시 sunset / 그 외 night.
function resolveAutoTheme(theme) {
  if (theme !== 'auto') return theme;
  const h = new Date().getHours();
  if (h >= 6 && h < 16) return 'daylight';
  if (h >= 16 && h < 19) return 'sunset';
  return 'night';
}

// 현재 층 판정/안내 — 카메라 y가 어느 층 대역에 있는지 (계단 중간은 아래층 유지)
let currentFloorId = null;
function updateFloorIndicator() {
  if (!entered) return;
  const y = camera.position.y - EYE_HEIGHT;
  let best = null;
  for (const f of BUILDING.floors) {
    if (y >= f.y - 0.9 && (best === null || f.y > best.y)) best = f;
  }
  if (!best) return;
  if (currentFloorId === null) {
    currentFloorId = best.id; // 스폰 층은 조용히 기록
    return;
  }
  if (best.id !== currentFloorId) {
    currentFloorId = best.id;
    setStatus(best.name);
  }
}

// 현재 감상 대상 작품을 라이트박스로 — E키와 터치 '크게 보기' 버튼이 공유하는 진입점.
// 투어 중에는 정차 중인 작품을 그대로 대상으로 삼는다 (감상 포즈는 근접 판정
// 거리보다 살짝 멀 수 있어 직접 지정).
function viewCurrentArtwork() {
  if (!entered || isLightboxOpen()) return;
  const art = touring ? placedArtworks[tourIndex] : getNearbyArtwork(camera.position);
  if (!art) return;
  showLightbox(art);
  player.disable();
}

// ---------------------------------------------------------------------------
// SNS 공유 — 포토 모드 (P키 / 터치 독 '캡처' 버튼)
// ---------------------------------------------------------------------------

// 현재 3D 화면을 캡처해 워터마크를 합성한 뒤 공유 모달을 연다.
// WebGL 컨텍스트는 preserveDrawingBuffer:false이므로, renderer.render() 직후
// 같은 동기 흐름 안에서 toDataURL을 호출해야 화면이 지워지기 전에 픽셀을 읽을 수 있다.
function capturePhoto() {
  if (!renderer || !scene || !camera) return;
  try {
    if (thirdPerson && selfAvatar) applySelfCamOffset();
    renderer.render(scene, camera);
    if (thirdPerson && selfAvatar) restoreSelfCamOffset();
    const rawDataUrl = renderer.domElement.toDataURL('image/png');

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      // 화면과 동일한 비네팅을 사진에도 — 라이브 무드 그대로 저장
      const vg = ctx.createRadialGradient(
        canvas.width / 2, canvas.height * 0.46, Math.min(canvas.width, canvas.height) * 0.4,
        canvas.width / 2, canvas.height * 0.46, Math.max(canvas.width, canvas.height) * 0.72
      );
      vg.addColorStop(0, 'rgba(8,6,4,0)');
      vg.addColorStop(0.24, 'rgba(8,6,4,0.03)');
      vg.addColorStop(0.44, 'rgba(8,6,4,0.09)');
      vg.addColorStop(0.64, 'rgba(8,6,4,0.17)');
      vg.addColorStop(0.82, 'rgba(8,6,4,0.26)');
      vg.addColorStop(1, 'rgba(8,6,4,0.34)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawWatermark(ctx, canvas.width, canvas.height, galleryInfo ? galleryInfo.name : '');

      // canvas.toBlob은 일부 환경에서 콜백이 오지 않는 사례가 있어,
      // 어차피 미리보기용으로 만드는 dataURL에서 동기적으로 Blob을 만든다.
      const outDataUrl = canvas.toDataURL('image/png');

      // 포토월 썸네일(360px JPEG) — 랜딩 피드 + 같은 방 전원에게 전파
      try {
        const tw = 360;
        const th = Math.round((canvas.height / canvas.width) * tw);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = tw;
        thumbCanvas.height = th;
        thumbCanvas.getContext('2d').drawImage(canvas, 0, 0, tw, th);
        const thumb = thumbCanvas.toDataURL('image/jpeg', 0.72);
        const item = photoWall.addLocal(myNickname, galleryInfo ? galleryInfo.name : '', thumb);
        if (item && mp) mp.sendPhoto(item);
      } catch (err) {
        console.warn('포토월 썸네일 생성 실패 (캡처 자체는 정상):', err);
      }
      showShareModal({
        blob: dataUrlToBlob(outDataUrl),
        dataUrl: outDataUrl,
        galleryName: (galleryInfo && galleryInfo.name) || 'ARTSHOW 전시',
        shareUrl: getShareUrl(),
      });
    };
    img.onerror = () => {
      setStatus('사진 촬영에 실패했습니다.');
    };
    img.src = rawDataUrl;
  } catch (err) {
    console.error('사진 촬영 실패:', err);
    setStatus('사진 촬영에 실패했습니다.');
  }
}

// dataURL(base64 PNG) → Blob 동기 변환 — toBlob 콜백 미발화 환경 대응
function dataUrlToBlob(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

// 캡처 이미지 하단에 그라디언트 + 전시명(좌) + ARTSHOW 브랜드/URL(우) 워터마크를 합성한다.
function drawWatermark(ctx, w, h, galleryName) {
  const bandHeight = Math.max(90, Math.round(h * 0.14));
  const grad = ctx.createLinearGradient(0, h - bandHeight, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h - bandHeight, w, bandHeight);

  const pad = Math.max(20, Math.round(w * 0.025));
  // 고해상도(레티나 등) 캡처에서도 워터마크가 같은 비율로 보이도록 캔버스 폭 기준 스케일
  const s = Math.max(1, w / 1400);
  ctx.textBaseline = 'alphabetic';

  // 좌하단 — 전시명
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `300 ${Math.round(18 * s)}px Helvetica, Arial, sans-serif`;
  ctx.fillText(galleryName || 'ARTSHOW 전시', pad, h - pad - 6 * s);

  // 우하단 — ARTSHOW(골드, letter-spacing) + 사이트 URL
  ctx.fillStyle = '#d4af37';
  ctx.font = `300 ${Math.round(16 * s)}px Helvetica, Arial, sans-serif`;
  drawLetterSpacedRight(ctx, 'ARTSHOW', w - pad, h - pad - 22 * s, 2.5 * s);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `300 ${Math.round(12 * s)}px Helvetica, Arial, sans-serif`;
  ctx.fillText('syhongart.github.io/artshow', w - pad, h - pad - 4 * s);
}

// canvas 2D는 표준 letter-spacing을 지원하지 않는 브라우저가 많아, 글자를 하나씩
// 그려서 우측 정렬 기준으로 자간을 직접 적용한다.
function drawLetterSpacedRight(ctx, text, rightX, y, spacing) {
  const chars = Array.from(text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((sum, cw) => sum + cw, 0) + spacing * (chars.length - 1);

  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'left';
  let x = rightX - total;
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
  ctx.textAlign = prevAlign;
}

// 공유용 URL — 기본은 현재 주소(#gd= 공유 링크 포함). 해시에 인코딩된 전시 데이터가
// 너무 길면(2000자+) SNS 인텐트/미리보기에서 깨지기 쉬우므로 같은 경로의 landing.html로 대체한다.
function getShareUrl() {
  const href = window.location.href;
  if (href.length < 2000) return href;
  return window.location.origin + window.location.pathname.replace(/index\.html$/, 'landing.html');
}

function onKeyDown(e) {
  if (e.code === 'KeyE') {
    viewCurrentArtwork();
    return;
  }

  if (e.code === 'KeyM') {
    if (!entered || isLightboxOpen()) return;
    toggleArtworkList();
    return;
  }

  if (e.code === 'KeyT') {
    if (!entered) return;
    toggleTour();
    return;
  }

  if (e.code === 'KeyG') {
    if (!entered || isLightboxOpen()) return;
    toggleGuestbook();
    return;
  }

  if (e.code === 'KeyP') {
    // 라이트박스/투어 중에도 촬영 허용 — 캔버스에는 DOM UI가 찍히지 않으므로
    // 지금 보이는 3D 화면 그대로 캡처된다. 공유 모달이 열려 있을 때만 막는다.
    if (!entered || isShareModalOpen()) return;
    flashShutter();
    capturePhoto();
    return;
  }

  if (e.code === 'KeyV') {
    if (!entered || isShareModalOpen()) return;
    toggleSelfView();
    return;
  }

  if (touring && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
    if (isLightboxOpen()) return;
    e.preventDefault();
    if (e.code === 'ArrowLeft') tourPrev();
    else tourNext();
    return;
  }

  if (e.code === 'Escape') {
    // 라이트박스/작품목록/방명록은 ui.js가 자체 ESC 핸들러로 닫는다. 셋 다 닫혀 있을 때만
    // 투어 종료를 담당한다 (ui.js ESC 우선순위 규약과 합치).
    if (touring && !isLightboxOpen() && !isArtworkListOpen() && !isGuestbookOpen()) {
      exitTour();
    }
  }
}

// 작품 목록 카드 클릭 → 트윈 텔레포트. 도착 후 player.setPose로 확정하고,
// 투어 중이 아니면 이동을 재활성화한다. 투어 중이면 투어 인덱스를 선택한
// 작품에 맞춰 갱신하고 머무름 카운트를 새로 시작한다.
function handleArtworkSelect(art) {
  if (!art || !entered) return;
  const pose = getViewingPose(art);
  const wasTouring = touring;
  if (wasTouring) {
    const idx = placedArtworks.indexOf(art);
    if (idx !== -1) tourIndex = idx;
    tourWaiting = false;
  }
  startTween(pose, () => {
    player.setPose(pose);
    if (wasTouring) {
      updateTourBar(art);
      tourWaiting = true;
      tourStayElapsed = 0;
    } else if (entered && !isLightboxOpen()) {
      player.enable();
    }
  });
}

// ---------------------------------------------------------------------------
// 도슨트 투어 오케스트레이션
// ---------------------------------------------------------------------------

function updateTourBar(art) {
  showTourBar({
    index: tourIndex, // ui.js가 0-based를 받아 +1하여 표시한다 (계약)
    total: placedArtworks.length,
    title: art ? art.title || '' : '',
    autoOn: tourAutoOn,
  });
}

function goToTourIndex(index) {
  const art = placedArtworks[index];
  if (!art) return;
  tourIndex = index;
  tourWaiting = false;
  tourStayElapsed = 0;
  updateTourBar(art);
  const pose = getViewingPose(art);
  startTween(pose, () => {
    player.setPose(pose);
    tourWaiting = true;
    tourStayElapsed = 0;
  });
}

function startTour() {
  if (!entered || isLightboxOpen() || touring) return;
  if (!placedArtworks || placedArtworks.length === 0) return;
  if (isArtworkListOpen()) hideArtworkList();
  touring = true;
  setDockActive('tour', true);
  tourAutoOn = true;
  player.disable();
  goToTourIndex(0);
}

function exitTour() {
  if (!touring) return;
  touring = false;
  setDockActive('tour', false);
  tourWaiting = false;
  tween = null; // 이동 중이었다면 현재 카메라 위치에서 즉시 정지
  hideTourBar();
  const state = player.getState();
  player.setPose({ x: state.x, z: state.z, ry: state.ry });
  if (entered && !isLightboxOpen()) player.enable();
}

function toggleTour() {
  if (touring) exitTour();
  else startTour();
}

function tourNext() {
  if (!touring || placedArtworks.length === 0) return;
  goToTourIndex((tourIndex + 1) % placedArtworks.length);
}

function tourPrev() {
  if (!touring || placedArtworks.length === 0) return;
  goToTourIndex((tourIndex - 1 + placedArtworks.length) % placedArtworks.length);
}

function tourToggleAuto() {
  if (!touring) return;
  tourAutoOn = !tourAutoOn;
  tourStayElapsed = 0;
  updateTourBar(placedArtworks[tourIndex]);
}

// 짧은 문자열 요약 (공유 링크 전시의 룸 키용 — 같은 링크 = 같은 방)
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function handleEnter({ nickname, color, char }) {
  myNickname = nickname;
  selfInfo = { nickname, color, char };
  entered = true;
  hideLobby();
  player.enable();

  // 새소리·바람 앰비언트 (사용자 제스처 안에서 시작해야 autoplay 허용됨)
  startAmbient();
  startOnboarding();

  try {
    // 전시별 멀티플레이 룸 — 같은 전시 링크로 들어온 사람끼리만 만난다.
    // 디렉터리 전시는 id, 공유 링크(#gd=/#gz=) 전시는 해시 데이터의 djb2 요약을 쓴다.
    const roomSuffix = (galleryInfo && galleryInfo.id) || 'link-' + djb2(window.location.hash || '');
    mp = new MultiplayerManager(scene, { nickname, color, char, roomId: `${PEER_ROOM_ID}-${roomSuffix}` });
    // 작가 리포트 — 방문자·인기작(체류) 통계. 전시 키는 룸 suffix와 동일 규약.
    stats = new GalleryStats(roomSuffix);
    mp.onVisitor = (id, info) => {
      stats.addVisit(id);
      visitorLog.add(info && info.nickname, galleryInfo ? galleryInfo.name : '');
    };
    mp.onPhoto = (item) => {
      photoWall.addRemote(item);
      setStatus(`${item.name || '누군가'}님이 관람 사진을 남겼어요 📸`);
    };
    if (statsDwellTimer) clearInterval(statsDwellTimer);
    statsDwellTimer = setInterval(() => {
      if (!mp || !stats) return;
      const humans = [];
      for (const [rid, av] of mp.remoteAvatars) {
        if (!rid.startsWith('npc-')) humans.push({ x: av.group.position.x, z: av.group.position.z });
      }
      stats.addDwell(humans, getPlacedArtworks(), 2);
      setGuestbookStats(stats.summary(guestbookNotes.length));
    }, 2000);
    // onChat은 원격 메시지 전용 (자기 메시지는 handleChatSend가 로컬 표시,
    // 에코는 senderId 필터로 차단됨) — 닉네임이 겹쳐도 안전
    mp.onChat = (name, text) => addChatMessage(name, text, false);
    mp.onPlayerCount = (n) => setPlayerCount(n);
    mp.onStatus = handleMultiplayerStatus;
    mp.onGuestbook = handleRemoteGuestbook;
    // 내가 맞았을 때 — 상태바 + (3인칭이면) 내 아바타에도 상처 반영
    mp.onSelfHit = (level) => {
      setStatus(level >= 3 ? '아야!! 너무해요 😭' : '아야! 누가 때렸어요 😣');
      if (selfAvatar) selfAvatar.hit(level);
    };
    // NPC가 맞았을 때 — 아파하는 한마디 (채팅 큐 → npcProvider가 다음 틱에 전송)
    mp.onNpcHit = (id, level) => {
      if (npcCrowd) npcCrowd.onHit(id, level);
    };
    // AI 관객 — 호스트가 된 클라이언트만 mp.update()가 매 프레임 호출한다.
    // 작품 배치는 입장 전에 끝나므로 getPlacedArtworks()는 여기서 항상 유효하다.
    mp.npcProvider = (delta, humans) => {
      if (!npcCrowd) npcCrowd = new NpcCrowd(getPlacedArtworks());
      const states = npcCrowd.update(delta, humans);
      const remark = npcCrowd.takeChat();
      if (remark) mp.sendNpcChat(remark.name, remark.text); // 호스트 화면 표시 포함
      return states;
    };
    mp.connect();
  } catch (err) {
    console.error('멀티플레이어 초기화 실패:', err);
    mp = null;
    setStatus('멀티플레이어 연결에 실패했습니다. 혼자 관람 모드로 진행합니다.');
  }
}

// mp.onStatus 래퍼 — 상태 표시는 그대로 위임하되, 연결이 처음 성립되는 시점
// ('호스트로 개설됨' 또는 '접속됨(게스트)')에 로컬 방명록 전체를 1회만 전송한다.
function handleMultiplayerStatus(statusText) {
  setStatus(statusText);
  if (guestbookSentOnce || !mp) return;
  if (statusText === '호스트로 개설됨' || statusText.startsWith('접속됨')) {
    guestbookSentOnce = true;
    try {
      mp.sendGuestbook(guestbookNotes);
    } catch (err) {
      console.error('방명록 동기화 전송 실패:', err);
    }
  }
}

// 방명록 입력창 제출(ui.js initGuestbook의 onSubmit) — 노트 생성 → 로컬 병합/저장/렌더 →
// 연결돼 있으면 상대에게도 전파.
function handleGuestbookSubmit(text) {
  if (!text) return;
  const note = makeNote(myNickname, text);
  guestbookNotes = mergeNotes(guestbookNotes, [note]);
  saveNotes(gbKey, guestbookNotes);
  setGuestbookNotes(guestbookNotes);
  if (mp) {
    try {
      mp.sendGuestbook([note]);
    } catch (err) {
      console.error('방명록 전송 실패:', err);
    }
  }
}

// mp.onGuestbook — 원격(다른 접속자)에서 전파된 노트를 로컬과 병합해 저장/렌더한다.
function handleRemoteGuestbook(notes) {
  guestbookNotes = mergeNotes(guestbookNotes, notes);
  saveNotes(gbKey, guestbookNotes);
  setGuestbookNotes(guestbookNotes);
}

function handleChatSend(text) {
  if (!text) return;
  // 내 메시지는 항상 로컬에 즉시 표시 (원격 에코는 senderId 필터로 차단됨)
  addChatMessage(myNickname, text, true);
  if (mp) {
    try {
      mp.sendChat(text);
    } catch (err) {
      console.error('채팅 전송 실패:', err);
      setStatus('채팅 전송에 실패했습니다.');
    }
  }
}

function animate() {
  const delta = clock.getDelta();

  try {
    // 이동/회전 (트윈/투어 중에는 player.disable 상태이므로 update는 사실상 no-op)
    player.update(delta);

    // 카메라 트윈(텔레포트/투어) 갱신 — 별도 루프 없이 기존 animate 루프에 포함
    updateTween(delta);

    // 도슨트 투어 자동진행 — 목적지 도착 후 머무름 중 && 라이트박스가 닫혀 있고
    // 새 트윈이 진행 중이 아닐 때만 카운트한다 (라이트박스 여는 동안 일시정지)
    if (touring && tourWaiting && tourAutoOn && !tween && !isLightboxOpen()) {
      tourStayElapsed += delta;
      if (tourStayElapsed >= TOUR_STAY_SECONDS) {
        tourNext();
      }
    }

    // 나비·새 애니메이션
    sceneTick(delta);

    // 층 이동 안내 — 카메라 y로 현재 층 판정, 바뀔 때 1회 표시
    updateFloorIndicator();

    // 멀티플레이어 (입장 후에만) — 트윈/투어 중에도 카메라 기준으로 계속 전송
    if (mp) {
      mp.sendState(player.getState());
      mp.update(delta);
    }

    tickOnboarding();

    // 3인칭 자기 아바타 — 눈 위치/yaw를 발밑 기준으로 반영 + 속도 평활
    if (thirdPerson && selfAvatar) {
      const st = player.getState();
      selfAvatar.group.position.set(st.x, st.y - EYE_HEIGHT, st.z);
      selfAvatar.group.rotation.y = st.ry;
      if (!selfPrev) selfPrev = { x: st.x, z: st.z };
      const raw = delta > 0 ? Math.hypot(st.x - selfPrev.x, st.z - selfPrev.z) / delta : 0;
      selfSpeed += (raw - selfSpeed) * Math.min(1, 10 * delta);
      selfPrev.x = st.x;
      selfPrev.z = st.z;
      selfAvatar.update(delta, selfSpeed);
    }

    // 근접 작품 안내 — ui.js가 중복 렌더를 막으므로 매 프레임 호출해도 안전
    const nearby = getNearbyArtwork(camera.position);
    if (nearby) {
      showArtworkInfo(nearby);
    } else {
      hideArtworkInfo();
    }

    // FPS 집계 (0.5초마다 갱신)
    fpsFrames += 1;
    fpsElapsed += delta;
    if (fpsElapsed >= 0.5) {
      const fpsNow = fpsFrames / fpsElapsed;
      setFPS(Math.round(fpsNow));
      fpsFrames = 0;
      fpsElapsed = 0;
      // 저사양 자동 전환 (히스테리시스 + 10초 재전환 금지로 깜빡임 방지)
      liteToggleCooldown = Math.max(0, liteToggleCooldown - 0.5);
      if (liteToggleCooldown === 0 && entered) {
        if (!liteMode && fpsNow < LITE_ENTER_FPS) {
          liteMode = true;
          liteToggleCooldown = 10;
          writeSpec('low'); // 다음 접속은 AA 끄고 가볍게 시작
          setStatus('원활한 관람을 위해 먼 곳의 관객을 잠시 숨깁니다');
        } else if (liteMode && fpsNow > LITE_EXIT_FPS) {
          liteMode = false;
          liteToggleCooldown = 10;
          applyNpcCulling();
        }
        // 품질 승급 — 고FPS(55+)가 10초(0.5s 틱 × 20) 지속되면 한 단계 위로
        // (low → 기본 → high). 다음 접속부터 적용된다.
        if (!liteMode && fpsNow > 55) {
          specFastTicks += 1;
          if (specFastTicks >= 20) {
            const cur = readSpec();
            if (cur === 'low') writeSpec(null);
            else if (cur === null) writeSpec('high');
            specFastTicks = 0;
          }
        } else {
          specFastTicks = 0;
        }
      }
    }
    // 저사양 모드 컬링 — 2초마다 가까운 관객 3명만 표시
    liteCullAccum += delta;
    if (liteCullAccum >= 2) {
      liteCullAccum = 0;
      if (liteMode) applyNpcCulling();
    }

    if (thirdPerson && selfAvatar) {
      applySelfCamOffset();
      renderer.render(scene, camera);
      restoreSelfCamOffset();
    } else {
      renderer.render(scene, camera);
    }
  } catch (err) {
    console.error('렌더 루프 오류:', err);
    renderer.setAnimationLoop(null);
    setStatus('오류가 발생했습니다. 페이지를 새로고침해 주세요.');
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// 페이지 이탈 시 피어 연결 정리
window.addEventListener('beforeunload', () => {
  if (mp) {
    try {
      mp.dispose();
    } catch (_) {
      /* 무시 */
    }
  }
});

init().catch((err) => {
  console.error('초기화 실패:', err);
  try {
    setStatus('초기화 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.');
  } catch (_) {
    // ui.js 조차 로드되지 않은 경우 최소한의 안내
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;font-family:Helvetica,Arial,sans-serif;font-size:16px;text-align:center;">초기화 중 오류가 발생했습니다.<br>페이지를 새로고침해 주세요.</div>'
    );
  }
});
