// main.js — LifeUnity Museum 통합 엔트리 포인트
// 소유: 통합 담당. 다른 모듈의 공개 API 계약을 그대로 사용한다.

import * as THREE from 'three';
import { ROOM, EYE_HEIGHT } from './config.js';
import { createMuseum, sceneTick } from './scene.js';
import { createArtworks, getNearbyArtwork, getGalleryInfo } from './artworks.js';
import { startAmbient } from './ambient.js';
import { PlayerController } from './player.js';
import { MultiplayerManager } from './multiplayer.js';
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
} from './ui.js';

let renderer = null;
let scene = null;
let camera = null;
let player = null;
let mp = null; // MultiplayerManager — 입장 전에는 null (sendState/update 가드)
let clock = null;
let myNickname = '게스트'; // 입장 시 갱신 — 채팅 isSelf 판별용
let entered = false; // 로비 통과 여부 — 라이트박스 E키 게이트에 사용
let galleryInfo = null; // getGalleryInfo() 결과 캐시 (전시 디렉터리 picker의 currentId로 사용)

// FPS 집계
let fpsFrames = 0;
let fpsElapsed = 0;

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

  // 2. 뮤지엄 건축 + 작품 설치
  createMuseum(scene);
  await createArtworks(scene);

  // 전시 제목 표시 + 전시 디렉터리 picker 배선
  galleryInfo = getGalleryInfo();
  if (galleryInfo) setGalleryTitle(galleryInfo.name);
  loadGalleryDirectory();

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

  // 라이트박스가 닫히면(ESC/X/배경 클릭 모두) 플레이어 이동을 재활성화
  setOnLightboxClose(() => {
    if (entered) player.enable();
  });

  // 리사이즈 대응
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('keydown', onKeyDown);

  // 렌더 루프 시작
  clock = new THREE.Clock();
  renderer.setAnimationLoop(animate);
}

// 전시 디렉터리 로드 — 실패 시(파일 없음, #gd= 공유 링크 접속 등) 조용히 스킵.
// #gd= 공유 링크로 접속한 경우 getGalleryInfo().id가 null이므로 currentId도 null로
// 전달되며, ui.js가 이를 '공유된 전시 관람 중'으로 처리한다.
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

// 근접 작품이 있을 때 E 키로 라이트박스를 연다. 채팅 입력창 포커스 중에는
// ui.js의 입력 핸들러가 keydown을 stopPropagation하므로 여기까지 도달하지 않는다.
function onKeyDown(e) {
  if (e.code !== 'KeyE') return;
  if (!entered || isLightboxOpen()) return;
  const nearby = getNearbyArtwork(camera.position);
  if (!nearby) return;
  showLightbox(nearby);
  player.disable();
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
    mp.onStatus = (statusText) => setStatus(statusText);
    mp.connect();
  } catch (err) {
    console.error('멀티플레이어 초기화 실패:', err);
    mp = null;
    setStatus('멀티플레이어 연결에 실패했습니다. 혼자 관람 모드로 진행합니다.');
  }
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
    // 이동/회전
    player.update(delta);

    // 나비·새 애니메이션
    sceneTick(delta);

    // 멀티플레이어 (입장 후에만)
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
