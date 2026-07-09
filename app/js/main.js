// main.js — LifeUnity Museum 통합 엔트리 포인트
// 소유: 통합 담당. 다른 모듈의 공개 API 계약을 그대로 사용한다.

import * as THREE from 'three';
import { ROOM, EYE_HEIGHT } from './config.js';
import { createMuseum, sceneTick } from './scene.js';
import {
  ensureGalleryLoaded,
  createArtworks,
  getNearbyArtwork,
  getPlacedArtworks,
  getViewingPose,
} from './artworks.js';
import { startAmbient } from './ambient.js';
import { PlayerController } from './player.js';
import { MultiplayerManager } from './multiplayer.js';
import { loadNotes, saveNotes, mergeNotes, makeNote } from './guestbook.js';
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
} from './ui.js';

let renderer = null;
let scene = null;
let camera = null;
let player = null;
let mp = null; // MultiplayerManager — 입장 전에는 null (sendState/update 가드)
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
  const dx = toPose.x - cur.x;
  const dz = toPose.z - cur.z;
  const dist = Math.hypot(dx, dz);
  const duration = THREE.MathUtils.clamp(
    TWEEN_MIN_DURATION + dist * 0.035,
    TWEEN_MIN_DURATION,
    TWEEN_MAX_DURATION
  );
  player.disable();
  tween = {
    fromX: cur.x,
    fromZ: cur.z,
    fromRy: cur.ry,
    toX: toPose.x,
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
  const z = tween.fromZ + (tween.toZ - tween.fromZ) * e;
  const ry = lerpAngle(tween.fromRy, tween.toRy, e);
  camera.position.set(x, EYE_HEIGHT, z);
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
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, EYE_HEIGHT, 12);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // 2. 갤러리 데이터 로드(1회, 캐시) → 테마 반영 뮤지엄 건축 → 작품 설치
  //    createArtworks() 내부에서도 동일한 캐시된 프로미스를 await하므로 fetch는 1회만 발생한다.
  const ginfo = await ensureGalleryLoaded();
  createMuseum(scene, resolveAutoTheme(ginfo.theme));
  await createArtworks(scene);

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
    onTour: () => { if (entered) toggleTour(); },
    onViewArtwork: viewCurrentArtwork,
    onGuestbook: () => { if (entered && !isLightboxOpen()) toggleGuestbook(); },
  });

  // 3. 플레이어 컨트롤러 (로비 동안 비활성)
  // 생성자가 스폰 위치를 z=8로 재설정하므로, 의도한 스폰(z=12)은 생성 후 지정
  player = new PlayerController(camera, renderer.domElement);
  camera.position.set(0, EYE_HEIGHT, 12);
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
  tourAutoOn = true;
  player.disable();
  goToTourIndex(0);
}

function exitTour() {
  if (!touring) return;
  touring = false;
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

function handleEnter({ nickname, color }) {
  myNickname = nickname;
  entered = true;
  hideLobby();
  player.enable();

  // 새소리·바람 앰비언트 (사용자 제스처 안에서 시작해야 autoplay 허용됨)
  startAmbient();

  try {
    mp = new MultiplayerManager(scene, { nickname, color });
    // onChat은 원격 메시지 전용 (자기 메시지는 handleChatSend가 로컬 표시,
    // 에코는 senderId 필터로 차단됨) — 닉네임이 겹쳐도 안전
    mp.onChat = (name, text) => addChatMessage(name, text, false);
    mp.onPlayerCount = (n) => setPlayerCount(n);
    mp.onStatus = handleMultiplayerStatus;
    mp.onGuestbook = handleRemoteGuestbook;
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

    // 멀티플레이어 (입장 후에만) — 트윈/투어 중에도 카메라 기준으로 계속 전송
    if (mp) {
      mp.sendState(player.getState());
      mp.update(delta);
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
      setFPS(Math.round(fpsFrames / fpsElapsed));
      fpsFrames = 0;
      fpsElapsed = 0;
    }

    renderer.render(scene, camera);
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
