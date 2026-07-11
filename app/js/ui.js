// web/js/ui.js
// ARTSHOW Museum — UI 모듈 (DOM/CSS 전부 JS에서 동적 생성)
// MoMA 미니멀 미학: Helvetica, 화이트/블랙, 골드(#d4af37) 포인트

import * as THREE from 'three';
import { AVATAR_COLORS } from './config.js';
import { CHARACTERS, createAvatarInstance } from './avatar.js';
import {
  DCL_BASE,
  SKIN_TONES,
  HAIR_COLORS,
  EYE_COLORS,
  DEFAULT_LOOK,
  loadPartsManifest,
  encodeLook,
  decodeLook,
} from './avatarkit.js';
import { getPlacedArtworks } from './artworks.js';
import {
  DEFAULT_CHIBI,
  CHIBI_HAIR_STYLES,
  CHIBI_EYE_STYLES,
  CHIBI_MOUTH_STYLES,
  CHIBI_BOTTOM_TYPES,
  CHIBI_ACCESSORIES,
  encodeChibi,
  normalizeChibi,
} from './chibi.js';
import {
  PROVIDERS as AUTH_PROVIDERS,
  MOCK_NAMES as AUTH_MOCK_PREFILL,
  loginWith as authLoginWith,
  logout as authLogout,
  getProfile as authGetProfile,
  onAuthChange,
} from './auth.js';

const GOLD = '#d4af37';
const MAX_CHAT_MESSAGES = 8;
const MAX_NICKNAME_LEN = 12;

// ---------------------------------------------------------------------------
// 내부 상태
// ---------------------------------------------------------------------------
let els = null;              // 생성된 DOM 요소 캐시
let callbacks = { onEnter: null, onChatSend: null };
let selectedColor = AVATAR_COLORS[0];
const LU_CHAR_STORAGE_KEY = 'lu-char';
// 커스텀(DCL) 아바타 선택을 가리키는 selectedChar 값 — CHARACTERS에는 없는 가상 id.
// 실제 char 문자열('dcl:'+JSON)은 입장 submit 시점에 저장된 룩으로부터 새로 encodeLook한다.
const CUSTOM_CHAR_ID = 'custom';
// readStoredChar()가 아래에서 즉시 readStoredLook()을 호출하므로, 그 함수가 참조하는
// const 키들은 (함수 선언 자체는 호이스팅되지만 const 바인딩은 TDZ이므로) 반드시
// readStoredChar() 호출보다 앞서 선언되어야 한다.
const LU_LOOK_STORAGE_KEY = 'lu-custom-look-v1';
const LU_LOOK_THUMB_KEY = 'lu-custom-look-thumb-v1';
function readStoredLook() {
  try {
    const raw = localStorage.getItem(LU_LOOK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null; // 프라이빗 모드 등 localStorage 접근 불가 또는 저장값 손상 시 무시
  }
}
function saveStoredLook(look) {
  try { localStorage.setItem(LU_LOOK_STORAGE_KEY, JSON.stringify(look)); } catch (_) { /* 무시 */ }
}
function readStoredLookThumb() {
  try { return localStorage.getItem(LU_LOOK_THUMB_KEY) || ''; } catch (_) { return ''; }
}
function saveStoredLookThumb(dataUrl) {
  try { localStorage.setItem(LU_LOOK_THUMB_KEY, dataUrl); } catch (_) { /* 무시 — 용량 초과 등은 조용히 무시 */ }
}
// 치비(자체 코드 생성) 아바타 — CUSTOM_CHAR_ID와 같은 패턴의 가상 id.
const CHIBI_SEL_ID = 'chibi';
const LU_CHIBI_STORAGE_KEY = 'lu-chibi-look-v1';
const LU_CHIBI_THUMB_KEY = 'lu-chibi-look-thumb-v1';
function readStoredChibi() {
  try {
    const raw = localStorage.getItem(LU_CHIBI_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}
function saveStoredChibi(params) {
  try { localStorage.setItem(LU_CHIBI_STORAGE_KEY, JSON.stringify(params)); } catch (_) { /* 무시 */ }
}
function readStoredChibiThumb() {
  try { return localStorage.getItem(LU_CHIBI_THUMB_KEY) || ''; } catch (_) { return ''; }
}
function saveStoredChibiThumb(dataUrl) {
  try { localStorage.setItem(LU_CHIBI_THUMB_KEY, dataUrl); } catch (_) { /* 무시 */ }
}
function readStoredChar() {
  try {
    const saved = localStorage.getItem(LU_CHAR_STORAGE_KEY);
    if (saved === CUSTOM_CHAR_ID && readStoredLook()) return CUSTOM_CHAR_ID;
    if (saved === CHIBI_SEL_ID) return CHIBI_SEL_ID; // 저장 룩 없어도 기본 치비로 입장 가능
    if (CHARACTERS.some((c) => c.id === saved)) return saved;
    return CHIBI_SEL_ID; // 신규 방문 기본값 — 오리지널 치비
  } catch (_) {
    return CHIBI_SEL_ID; // 프라이빗 모드 등 localStorage 접근 불가 시 기본값
  }
}
let selectedChar = readStoredChar();
let entered = false;         // 로비 통과 여부 (입장 후에만 채팅 활성화)
let currentArtworkId = null; // 작품 패널 재렌더 생략용
let initialized = false;

// 라이트박스 상태
let lightboxOpen = false;
let onLightboxClose = null;
let lightboxCloseTimer = null;

// 작품 목록 패널 상태
let artworkListOpen = false;
let onArtworkSelect = null; // initArtworkList(artworks, onSelect)의 onSelect

// 방명록 패널 상태
let guestbookOpen = false;
let onGuestbookSubmit = null; // initGuestbook({ onSubmit })의 onSubmit
let pendingGuestbookNotes = null; // initUI() 이전에 setGuestbookNotes()가 불렸을 때 대기시켜 둘 값
const MAX_GUESTBOOK_TEXT = 120;

// 투어 바 버튼 콜백 (setTourHandlers로 배선)
let tourHandlers = { onPrev: null, onNext: null, onExit: null, onToggleAuto: null };

// 터치 기기 여부 — 조작 안내/액션 버튼 구성이 달라진다
const IS_TOUCH =
  (typeof window !== 'undefined' && 'ontouchstart' in window) ||
  (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

// 터치 액션 버튼 콜백 (setActionHandlers로 배선) — 키보드 없는 기기의 M/T/E/G/P 대체
let actionHandlers = { onTour: null, onViewArtwork: null, onGuestbook: null, onCapture: null, onSelfView: null };

// 공유 모달 상태 (SNS 공유 — 포토 모드)
let shareModalOpen = false;
let shareData = { blob: null, dataUrl: '', galleryName: '', shareUrl: '' };
let shareCopyTimer = null;

// 아바타 커스터마이저(#lu-avatar-maker) 모달 상태
// (LU_LOOK_STORAGE_KEY/LU_LOOK_THUMB_KEY 및 readStoredLook/saveStoredLook/readStoredLookThumb/
// saveStoredLookThumb는 위쪽 readStoredChar() 앞에서 이미 선언했다 — TDZ 순서 문제로 이동됨)
let makerOpen = false;
let makerLook = null;            // 편집 중인 작업용 look 객체 (저장 전까지는 커밋되지 않음)
let makerManifest = null;        // loadPartsManifest() 결과 캐시 (탭 렌더링용)
let makerActiveTab = 'shape';
let makerRebuildTimer = null;    // 파츠 변경 → 프리뷰 재조립 300ms 디바운스
let makerPreviewInstance = null; // createAvatarInstance() 결과 — dispose 후 재조립
let makerPreviewRAF = null;
let makerPreviewLastT = 0;
let makerDragging = false;
let makerDragLastX = 0;

// 치비 메이커(#lu-chibi-maker) 모달 상태 — 커스터마이저와 동일 패턴, 탭 없음
let chibiOpen = false;
let chibiParams = null;
let chibiPreviewInstance = null;
let chibiPreviewRAF = null;
let chibiPreviewLastT = 0;
let chibiDragging = false;
let chibiDragLastX = 0;

// initUI() 호출 이전에 setGalleryTitle / initGalleryPicker / initArtworkList가
// 먼저 불려도 값을 잃지 않도록 대기시켜 두었다가 DOM 생성 직후 적용한다.
let pendingGalleryTitle = null;
let pendingPicker = null; // { galleries, currentId, onPick }
let pendingArtworkList = null; // artworks 배열

// ---------------------------------------------------------------------------
// CSS 주입
// ---------------------------------------------------------------------------
function injectStyles() {
  const css = `
:root {
  --lu-gold: ${GOLD};
  --lu-ink: #17140f;
  /* Gilded Frame HUD 토큰 — 챔퍼 2단계 + 모션 (게임 HUD 디자인 감사 v1.0) */
  --lu-ch-s: 7px;
  --lu-ch-l: 14px;
  --lu-spring: 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  --lu-slide: 0.36s cubic-bezier(0.22, 1, 0.36, 1);
  --lu-font: 'Helvetica Neue', Helvetica, Arial, 'Apple SD Gothic Neo',
             'Malgun Gothic', sans-serif;
}
/* 실루엣 — 라운드 2단계 (챔퍼 컷은 clip-path가 보더를 대각선에서 끊어
   모서리가 덜 만든 것처럼 보였음 — 감독 피드백으로 라운드 회귀) */
.lu-cut-s { border-radius: 10px; }
.lu-cut-l { border-radius: 16px; }

.lu * { box-sizing: border-box; margin: 0; padding: 0; }

.lu {
  font-family: var(--lu-font);
  font-weight: 300;
  -webkit-font-smoothing: antialiased;
  color: #fff;
  user-select: none;
}

/* ------------------------------ 로딩 오버레이 ------------------------------ */
#lu-loading {
  position: fixed; inset: 0; z-index: 1000;
  background: #000;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 28px;
  transition: opacity 0.5s ease;
}
#lu-loading.lu-hidden { opacity: 0; pointer-events: none; }
.lu-spinner {
  width: 44px; height: 44px;
  border: 1px solid rgba(255,255,255,0.15);
  border-top-color: var(--lu-gold);
  border-radius: 50%;
  animation: lu-spin 0.9s linear infinite;
}
@keyframes lu-spin { to { transform: rotate(360deg); } }
.lu-loading-text {
  font-size: 13px; letter-spacing: 0.5em; text-indent: 0.5em;
  color: rgba(255,255,255,0.75);
  animation: lu-pulse 1.8s ease-in-out infinite;
}
@keyframes lu-pulse { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }

/* ------------------------------ 로비 오버레이 ------------------------------ */
#lu-lobby {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(8,8,10,0.72);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  transition: opacity 0.6s ease;
}
#lu-lobby.lu-hidden { opacity: 0; pointer-events: none; }
.lu-lobby-card {
  width: 100%; max-width: 400px;
  background: rgba(255,255,255,0.97);
  color: #111;
  padding: 44px 36px 36px;
  box-shadow: 0 30px 80px rgba(0,0,0,0.5);
  text-align: center;
}
.lu-lobby-title {
  font-size: 24px; font-weight: 300;
  letter-spacing: 0.32em; text-indent: 0.32em;
  color: #111;
}
.lu-lobby-sub {
  margin-top: 10px;
  font-size: 11px; letter-spacing: 0.18em; text-indent: 0.18em;
  color: #999;
}
.lu-lobby-rule {
  width: 36px; height: 1px; background: var(--lu-gold);
  margin: 22px auto;
}
.lu-field-label {
  display: block; text-align: left;
  font-size: 11px; letter-spacing: 0.12em;
  color: #666; margin: 0 0 8px 2px;
}
#lu-nickname {
  width: 100%;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 15px; color: #111;
  background: transparent;
  border: none; border-bottom: 1px solid #ccc;
  padding: 8px 2px; outline: none;
  transition: border-color 0.25s ease;
  border-radius: 0;
}
#lu-nickname:focus { border-bottom-color: var(--lu-gold); }
.lu-field-hint {
  text-align: left; font-size: 10px; color: #aaa;
  margin: 6px 0 0 2px;
}
.lu-swatches {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 12px; margin-top: 4px;
}
.lu-swatch {
  width: 28px; height: 28px; border-radius: 50%;
  border: none; cursor: pointer; padding: 0;
  outline: 2px solid transparent; outline-offset: 3px;
  transform: scale(1);
  transition: outline-color 0.2s ease, transform 0.2s ease;
}
.lu-swatch:hover { transform: scale(1.12); }
.lu-swatch.lu-selected {
  outline-color: var(--lu-gold);
  transform: scale(1.12);
}
.lu-chars {
  display: flex; flex-wrap: wrap; justify-content: center;
  gap: 8px; margin-top: 4px;
}
.lu-char-btn {
  font-family: var(--lu-font); font-weight: 500;
  font-size: 12.5px; letter-spacing: 0.03em;
  color: #4a453c; background: #fffdf9;
  border: 1px solid #e6dfcf; border-radius: 12px;
  padding: 10px 15px; cursor: pointer;
  box-shadow: 0 2px 8px rgba(23,20,15,0.04);
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease, transform 0.15s ease;
}
.lu-char-btn:hover { transform: translateY(-1px); }
.lu-char-btn:hover { border-color: rgba(0,0,0,0.25); }
.lu-char-btn.lu-selected {
  border-color: var(--lu-gold);
  color: #111;
  background: #f6f3ea;
}

/* ------------------------------ 커스텀 아바타 버튼 ------------------------------ */
.lu-char-custom {
  position: relative;
  background-size: cover; background-position: center 18%;
}
.lu-char-custom.lu-has-thumb {
  color: #fff; border-color: #ddd;
  text-shadow: 0 1px 4px rgba(0,0,0,0.75);
}
.lu-char-edit-link {
  display: block;
  margin: 6px auto 0;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 10px; letter-spacing: 0.05em; color: #999;
  background: transparent; border: none; cursor: pointer;
  padding: 2px 4px; text-align: center;
  transition: color 0.2s ease;
}
.lu-char-edit-link:hover { color: var(--lu-gold); }

/* -------------------------- 아바타 커스터마이저 모달 -------------------------- */
#lu-avatar-maker, #lu-chibi-maker {
  position: fixed; inset: 0; z-index: 985;
  background: rgba(4,4,5,0.96);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s ease;
}
#lu-avatar-maker.lu-open, #lu-chibi-maker.lu-open { opacity: 1; pointer-events: auto; }
.lu-am-card {
  width: 100%; max-width: 780px; max-height: 92vh;
  background: rgba(255,255,255,0.98);
  color: #111;
  box-shadow: 0 30px 90px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
  transform: scale(0.97); opacity: 0;
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease;
}
#lu-avatar-maker.lu-open .lu-am-card, #lu-chibi-maker.lu-open .lu-am-card { transform: scale(1); opacity: 1; }
.lu-am-head {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}
.lu-am-title { font-size: 13px; letter-spacing: 0.16em; text-indent: 0.16em; color: #111; }
#lu-am-close {
  flex: 0 0 auto;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid #ddd; border-radius: 50%;
  color: #999; font-size: 15px; font-weight: 300; line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
#lu-am-close:hover { border-color: var(--lu-gold); color: var(--lu-gold); transform: rotate(90deg); }
.lu-am-body {
  flex: 1 1 auto; min-height: 0;
  display: flex; gap: 20px;
  padding: 20px;
  overflow: hidden;
}
.lu-am-preview {
  flex: 0 0 auto;
  width: 300px; height: 400px;
  background: #f2efe6;
  border: 1px solid #eee;
  position: relative;
  touch-action: none;
}
.lu-am-preview canvas { display: block; width: 100%; height: 100%; cursor: grab; }
.lu-am-preview.lu-dragging canvas { cursor: grabbing; }
.lu-am-preview-hint {
  position: absolute; left: 0; right: 0; bottom: 8px;
  text-align: center;
  font-size: 9px; letter-spacing: 0.06em; color: #b0aca4;
  pointer-events: none;
}
.lu-am-panel {
  flex: 1 1 auto; min-width: 0;
  display: flex; flex-direction: column;
}
.lu-am-tabs {
  flex: 0 0 auto;
  display: flex; flex-wrap: wrap; gap: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid #eee;
}
.lu-am-tab {
  font-family: var(--lu-font); font-weight: 300;
  font-size: 11px; letter-spacing: 0.04em;
  color: #666; background: #fafafa;
  border: 1px solid #eee; border-radius: 2px;
  padding: 6px 11px; cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.lu-am-tab:hover { border-color: rgba(0,0,0,0.25); }
.lu-am-tab.lu-selected { border-color: var(--lu-gold); color: #111; background: #f6f3ea; }
.lu-am-tabpage {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto;
  padding-top: 14px;
}
.lu-am-section-title {
  font-size: 10px; letter-spacing: 0.14em; color: #999;
  margin: 14px 0 8px;
}
.lu-am-section-title:first-child { margin-top: 0; }
.lu-am-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 8px;
}
.lu-am-thumb {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  background: #fafafa; border: 1px solid #eee; border-radius: 2px;
  padding: 6px 4px 7px; cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}
.lu-am-thumb:hover { border-color: rgba(0,0,0,0.25); }
.lu-am-thumb.lu-selected { border-color: var(--lu-gold); background: #f6f3ea; }
.lu-am-thumb img {
  width: 48px; height: 48px; object-fit: contain;
  background: #fff; border: 1px solid #f0f0ee;
}
.lu-am-thumb-none {
  width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  background: #fff; border: 1px solid #f0f0ee;
  font-size: 10px; color: #bbb; letter-spacing: 0.02em;
}
.lu-am-thumb-label {
  font-size: 9px; letter-spacing: 0.01em; color: #777;
  text-align: center;
  max-width: 62px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.lu-am-cute-row { margin-top: 4px; }
.lu-am-cute-label {
  display: flex; justify-content: space-between;
  font-size: 11px; color: #666; margin-bottom: 8px;
}
.lu-am-cute-label b { color: var(--lu-gold); font-weight: 400; }
#lu-am-cute { width: 100%; accent-color: var(--lu-gold); }
.lu-am-footer {
  flex: 0 0 auto;
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 20px 18px;
  border-top: 1px solid #eee;
}
.lu-am-btn {
  font-family: var(--lu-font); font-weight: 300;
  font-size: 12px; letter-spacing: 0.1em;
  color: #666; background: transparent;
  border: 1px solid #ddd; border-radius: 2px;
  padding: 10px 18px; cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.lu-am-btn:hover { border-color: rgba(0,0,0,0.35); color: #222; }
.lu-am-btn-primary {
  color: #111; background: var(--lu-gold); border-color: var(--lu-gold);
}
.lu-am-btn-primary:hover { background: #c9a02f; border-color: #c9a02f; color: #111; }

#lu-enter-btn {
  width: 100%; margin-top: 30px;
  font-family: var(--lu-font); font-weight: 600;
  font-size: 14px; letter-spacing: 0.24em; text-indent: 0.24em;
  color: #17140f; background: var(--lu-gold);
  border: 1px solid var(--lu-gold); border-radius: 999px;
  padding: 15px 0; cursor: pointer;
  box-shadow: 0 6px 20px rgba(212,175,55,0.35);
  transition: transform 0.15s ease, box-shadow 0.25s ease;
}
#lu-enter-btn:hover { transform: translateY(-1px); box-shadow: 0 9px 26px rgba(212,175,55,0.45); }

/* ------------------------------ 전시 선택 ------------------------------ */
.lu-picker-note {
  text-align: left;
  font-size: 11px; letter-spacing: 0.04em;
  color: var(--lu-gold);
  margin: 0 0 10px 2px;
}
.lu-picker-list {
  display: flex; flex-direction: column; gap: 6px;
}
.lu-picker-item {
  display: block; width: 100%; text-align: left;
  font-family: var(--lu-font); font-weight: 300;
  background: #fafafa; border: 1px solid #eee; border-left: 2px solid transparent;
  padding: 10px 14px; cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}
.lu-picker-item:hover:not(:disabled) { background: #f2f2f0; border-left-color: var(--lu-gold); }
.lu-picker-item:disabled { cursor: default; }
.lu-picker-item.lu-picker-current {
  background: #f6f3ea; border-left-color: var(--lu-gold);
}
.lu-picker-name { font-size: 13px; color: #111; }
.lu-picker-meta { font-size: 10px; letter-spacing: 0.06em; color: #999; margin-top: 3px; }

.lu-lobby-divider { width: 100%; height: 1px; background: #eee; margin: 26px 0 18px; }
.lu-studio-link {
  display: inline-block;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 11px; letter-spacing: 0.1em; color: #999;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.lu-studio-link:hover { color: var(--lu-gold); border-bottom-color: var(--lu-gold); }

/* ------------------------------ 소셜 로그인 ------------------------------ */
#lu-auth { margin: 26px 0 6px; }
.lu-social-wrap { display: flex; flex-direction: column; gap: 9px; }
.lu-social-btn {
  display: flex; align-items: center; gap: 12px;
  width: 100%;
  padding: 11px 16px;
  background: transparent;
  border: 1px solid rgba(0,0,0,0.18);
  border-radius: 3px;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 13px; letter-spacing: 0.02em;
  color: #222;
  cursor: pointer;
  transition: border-color 0.25s ease, background 0.25s ease, opacity 0.25s ease;
}
.lu-social-btn:hover { border-color: rgba(0,0,0,0.45); }
.lu-social-btn:disabled { opacity: 0.55; cursor: default; }
.lu-social-busy { background: rgba(0,0,0,0.03); }
.lu-social-badge {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px;
  border-radius: 50%;
  font-size: 11px; font-weight: 500;
  flex: 0 0 auto;
}
.lu-social-google .lu-social-badge { background: #fff; border: 1px solid #dadce0; color: #4285f4; }
.lu-social-kakao .lu-social-badge { background: #fee500; color: #191919; }
.lu-social-kakao { background: rgba(254,229,0,0.12); border-color: rgba(210,190,0,0.45); }
.lu-social-kakao:hover { background: rgba(254,229,0,0.22); }
.lu-social-naver .lu-social-badge { background: #03c75a; color: #fff; }
.lu-social-naver { background: rgba(3,199,90,0.07); border-color: rgba(3,150,70,0.35); }
.lu-social-naver:hover { background: rgba(3,199,90,0.14); }
.lu-social-note {
  margin-top: 2px;
  font-size: 10px; letter-spacing: 0.03em;
  color: #b0aca4;
  text-align: center;
}

.lu-logged-chip {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px;
  border: 1px solid rgba(0,0,0,0.14);
  border-left: 2px solid var(--lu-gold);
  border-radius: 3px;
  background: rgba(0,0,0,0.025);
}
.lu-logged-avatar {
  display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border-radius: 50%;
  background: #1a1a1c; color: var(--lu-gold);
  font-size: 13px; font-weight: 400;
  flex: 0 0 auto;
}
.lu-logged-name { font-size: 13px; color: #1a1a1a; }
.lu-logged-via {
  font-size: 10px; color: #999;
  border: 1px solid #ddd; border-radius: 50%;
  width: 17px; height: 17px;
  display: inline-flex; align-items: center; justify-content: center;
}
.lu-logout-btn {
  margin-left: auto;
  background: transparent; border: none;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 11px; letter-spacing: 0.04em;
  color: #999; cursor: pointer;
  transition: color 0.25s ease;
}
.lu-logout-btn:hover { color: var(--lu-gold); }

.lu-auth-or {
  display: flex; align-items: center; gap: 12px;
  margin: 18px 0 4px;
}
.lu-auth-or::before, .lu-auth-or::after {
  content: ''; flex: 1; height: 1px; background: rgba(0,0,0,0.1);
}
.lu-auth-or span {
  font-size: 10px; letter-spacing: 0.12em;
  color: #b0aca4;
}

/* --------------------------------- HUD --------------------------------- */
.lu-hud {
  position: fixed; z-index: 500;
  opacity: 0; pointer-events: none;
  transition: opacity 0.6s ease;
}
.lu-hud.lu-visible { opacity: 1; }
/* [P0] 인터랙티브 HUD는 가시화와 함께 터치도 복구 (감사 발견 버그) */
#lu-dock.lu-visible, #lu-controls-toggle.lu-visible { pointer-events: auto; }
/* (작품 카드의 터치 기기 배치는 작품 패널 베이스 CSS 뒤에서 재정의 — 캐스케이드 순서) */

#lu-controls {
  top: calc(16px + env(safe-area-inset-top, 0px));
  left: max(16px, env(safe-area-inset-left, 0px));
  background: rgba(23,20,15,0.82);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  backdrop-filter: blur(24px) saturate(150%);
  padding: 14px 18px;
  border: 1px solid rgba(253,251,245,0.16);
  border-left: 3px solid var(--lu-gold);
  box-shadow: inset 0 1px 0 rgba(253,251,245,0.10);
  font-size: 12px; font-weight: 500; line-height: 1.9;
  color: rgba(253,251,245,0.88);
}
#lu-controls .lu-key {
  display: inline-block; min-width: 72px;
  color: var(--lu-gold); letter-spacing: 0.06em;
}
#lu-controls .lu-controls-title {
  font-size: 10px; letter-spacing: 0.24em;
  color: rgba(255,255,255,0.5);
  margin-bottom: 6px;
}

#lu-topright {
  top: calc(16px + env(safe-area-inset-top, 0px));
  right: max(16px, env(safe-area-inset-right, 0px));
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 6px;
  font-size: 12px; letter-spacing: 0.08em;
  text-align: right;
}
#lu-topright .lu-stat {
  background: rgba(23,20,15,0.66);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(253,251,245,0.16);
  box-shadow: inset 0 1px 0 rgba(253,251,245,0.10);
  padding: 6px 12px;
  font-weight: 500;
  color: rgba(253,251,245,0.85);
}
#lu-topright .lu-stat b {
  font-weight: 600; font-variant-numeric: tabular-nums; color: #e6c458;
}
/* 성능 지표는 디버그 정보 — 터치 기기 1차 HUD에서 제외 (게임 HUD 감사) */
@media (pointer: coarse) { #lu-topright { display: none; } }

/* 상단 통합 바 — 전시명 + 라이브 접속자 (Gilded Frame 유리 칩) */
#lu-topbar {
  border-radius: 17px;
  top: calc(10px + env(safe-area-inset-top, 0px));
  left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 10px;
  height: 34px; padding: 0 16px;
  max-width: min(78vw, 480px);
  background: rgba(23,20,15,0.66);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(253,251,245,0.16);
  box-shadow: inset 0 1px 0 rgba(253,251,245,0.10);
}
#lu-topbar.lu-empty { opacity: 0 !important; }
.lu-topbar-title {
  font-size: 11px; font-weight: 500;
  letter-spacing: 0.28em; text-indent: 0.28em;
  color: rgba(253,251,245,0.85);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lu-topbar-sep { width: 1px; height: 12px; background: rgba(253,251,245,0.2); flex: none; }
.lu-topbar-count {
  display: flex; align-items: center; gap: 5px; flex: none;
  font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
  color: #e6c458;
}
.lu-topbar-count::before {
  content: ''; width: 5px; height: 5px; border-radius: 50%;
  background: #7ec97e; box-shadow: 0 0 6px rgba(126,201,126,0.8);
}
.lu-topbar-count b { display: inline-block; font-weight: 600; }
.lu-topbar-count.lu-tick b { animation: lu-count-tick 0.3s cubic-bezier(0.34,1.56,0.64,1); }
@keyframes lu-count-tick { 0% { transform: scale(1.25); } 100% { transform: scale(1); } }

#lu-status {
  /* 하단은 조이스틱·독의 영역 — 토스트는 상단 바 아래로 */
  top: calc(54px + env(safe-area-inset-top, 0px)); left: 50%;
  transform: translateX(-50%);
  max-width: min(80vw, 560px);
  background: rgba(23,20,15,0.66);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(253,251,245,0.16);
  border-left: 3px solid var(--lu-gold);
  box-shadow: inset 0 1px 0 rgba(253,251,245,0.10);
  padding: 7px 18px;
  font-size: 12px; font-weight: 600; letter-spacing: 0.08em;
  color: rgba(253,251,245,0.95);
  text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  transition: opacity 0.22s cubic-bezier(0.22,1,0.36,1);
}
#lu-status:empty { opacity: 0; }

/* --------------------------------- 채팅 --------------------------------- */
#lu-chat {
  bottom: 16px; left: 16px;
  width: min(340px, calc(100vw - 32px));
  display: flex; flex-direction: column; gap: 8px;
}
/* 터치 기기 기본: 입력창을 접어 하단을 가상 조이스틱 영역으로 비워둔다.
   (실기기 UX 피드백 — 전폭 채팅 입력창이 왼쪽 엄지를 삼켜 키보드가 올라오던 문제) */
#lu-chat.lu-chat-collapsed #lu-chat-input { display: none; }
#lu-chat.lu-chat-collapsed { pointer-events: none; }
#lu-chat-log {
  display: flex; flex-direction: column; gap: 3px;
  max-height: 220px; overflow: hidden;
}
.lu-chat-msg {
  background: rgba(10,10,12,0.5);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  padding: 5px 10px;
  font-size: 12px; line-height: 1.5;
  color: rgba(255,255,255,0.9);
  word-break: break-word;
  animation: lu-chat-in 0.25s ease;
  align-self: flex-start;
  max-width: 100%;
}
@keyframes lu-chat-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.lu-chat-name { font-weight: 400; color: rgba(255,255,255,0.65); margin-right: 6px; }
.lu-chat-msg.lu-self .lu-chat-name { color: var(--lu-gold); }
#lu-chat-input {
  width: 100%;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 13px; color: #fff;
  background: rgba(10,10,12,0.6);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.12);
  padding: 9px 12px; outline: none;
  opacity: 0.55; pointer-events: auto;
  transition: opacity 0.25s ease, border-color 0.25s ease;
  border-radius: 0;
}
#lu-chat-input::placeholder { color: rgba(255,255,255,0.35); letter-spacing: 0.06em; }
#lu-chat-input:focus { opacity: 1; border-color: var(--lu-gold); }

/* ----------------------------- 작품 정보 패널 ----------------------------- */
#lu-artwork {
  /* 미술관 벽면 캡션 카드 — 크림 종이 + 골드 상단 액센트 */
  position: fixed; z-index: 600;
  top: 50%; right: 16px;
  transform: translate(calc(100% + 40px), -50%);
  width: min(320px, calc(100vw - 28px));
  background: linear-gradient(180deg, #fffdf8 0%, #f8f4ea 100%);
  color: #1c1a16;
  padding: 26px 26px 22px;
  border-radius: 16px;
  border: 1px solid rgba(212,175,55,0.28);
  box-shadow: 0 18px 50px rgba(20,15,8,0.30), 0 2px 8px rgba(20,15,8,0.12);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease;
}
#lu-artwork::before {
  /* 골드 상단 레일 — 챔퍼 모서리와 정렬되는 좌측 기점 짧은 선 */
  content: '';
  position: absolute; top: 0; left: var(--lu-ch-l, 14px); width: 44px; height: 3px;
  background: linear-gradient(90deg, var(--lu-gold), rgba(212,175,55,0));
}
#lu-artwork.lu-open { transform: translate(0, -50%); }
#lu-artwork .lu-art-eyebrow {
  font-size: 9.5px; letter-spacing: 0.34em;
  color: #b28a2e; margin-bottom: 10px;
}
#lu-artwork .lu-art-title {
  font-size: 21px; font-weight: 600; line-height: 1.32;
  letter-spacing: -0.01em; color: #17140f;
}
#lu-artwork .lu-art-meta {
  margin-top: 7px;
  font-size: 12px; letter-spacing: 0.05em;
  color: #8a8172;
}
#lu-artwork .lu-art-rule {
  width: 34px; height: 2px; border-radius: 2px;
  background: var(--lu-gold); opacity: 0.65; margin: 16px 0 14px;
}
#lu-artwork .lu-art-desc {
  font-size: 13px; line-height: 1.85; color: #4a453c;
  max-height: 38vh; overflow-y: auto;
}
#lu-artwork .lu-art-hint {
  margin-top: 18px;
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; letter-spacing: 0.05em; color: #6b6459;
  font-family: var(--lu-font); font-weight: 500;
  background: rgba(212,175,55,0.10);
  border: 1px solid rgba(212,175,55,0.45); border-radius: 999px;
  cursor: pointer;
  padding: 8px 16px; text-align: center;
  transition: background 0.25s ease, color 0.25s ease;
}
#lu-artwork .lu-art-hint:hover { background: var(--lu-gold); color: #17140f; }
#lu-artwork .lu-art-hint .lu-key {
  display: inline-block;
  min-width: 16px; text-align: center;
  margin-right: 7px;
  padding: 1px 6px;
  border: 1px solid var(--lu-gold);
  color: var(--lu-gold);
  font-size: 10px; letter-spacing: 0.04em;
}
/* 터치 기기: 작품 카드를 하단 좌측 미니 캡션으로 이동 — 시점 드래그 존을
   아예 벗어나므로 pointer-events 핵이 불필요. 카드 전체가 '크게 보기' 탭 타깃. */
@media (pointer: coarse) {
  #lu-artwork {
    top: auto; right: auto;
    left: max(12px, env(safe-area-inset-left, 0px));
    bottom: calc(96px + env(safe-area-inset-bottom, 0px));
    width: min(248px, calc(100vw - 104px)); /* 우측 독 폭 회피 */
    padding: 14px 16px 12px;
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(20,15,8,0.35);
    transform: translateY(16px); opacity: 0; pointer-events: none;
    transition: transform var(--lu-slide), opacity 0.25s ease;
  }
  #lu-artwork.lu-open { transform: translateY(0); opacity: 1; pointer-events: auto; }
  #lu-artwork .lu-art-eyebrow { font-size: 9px; letter-spacing: 0.3em; margin-bottom: 6px; }
  #lu-artwork .lu-art-title { font-size: 15px; }
  #lu-artwork .lu-art-meta { font-size: 11px; margin-top: 4px; }
  #lu-artwork .lu-art-rule { margin: 10px 0 0; }
  #lu-artwork .lu-art-desc { display: none; } /* 설명은 라이트박스에서 */
  #lu-artwork .lu-art-hint {
    margin-top: 10px; padding: 6px 12px;
    font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
    border-radius: 999px;
  }
}

/* ---------------------- 터치 기기: 조작법 접기 + 액션 독 ---------------------- */
#lu-controls.lu-collapsed { display: none; }
#lu-controls-toggle {
  position: fixed; z-index: 520;
  top: calc(10px + env(safe-area-inset-top, 0px));
  left: max(12px, env(safe-area-inset-left, 0px));
  width: 34px; height: 34px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(23,20,15,0.66);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(253,251,245,0.16);
  box-shadow: inset 0 1px 0 rgba(253,251,245,0.10);
  color: rgba(253,251,245,0.9);
  font-family: var(--lu-font); font-weight: 700; font-size: 14px;
  cursor: pointer;
  transition: transform var(--lu-spring), background-color 0.25s ease;
}
#lu-controls-toggle:active {
  transform: scale(0.90); background-color: rgba(253,251,245,0.14);
  transition-duration: 0s;
}
#lu-dock {
  position: fixed; z-index: 520;
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: calc(108px + env(safe-area-inset-bottom, 0px));
  display: flex; flex-direction: column; gap: 14px;
}
.lu-dock-wrap { filter: drop-shadow(0 4px 14px rgba(10,8,4,0.45)); }
.lu-dock-btn {
  position: relative; overflow: hidden; /* lu-on 노치가 라운드를 넘지 않게 */
  width: 56px; height: 56px; border-radius: 12px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px;
  background: rgba(23,20,15,0.66);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  backdrop-filter: blur(16px) saturate(150%);
  border: 1px solid rgba(253,251,245,0.16);
  box-shadow: inset 0 1px 0 rgba(253,251,245,0.10);
  color: rgba(253,251,245,0.92);
  font-family: var(--lu-font);
  cursor: pointer;
  transition: transform var(--lu-spring), background-color 0.25s ease,
              border-color 0.25s ease, color 0.25s ease;
}
.lu-dock-btn svg {
  width: 21px; height: 21px; fill: none;
  stroke: currentColor; stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round;
}
.lu-dock-label {
  font-size: 9px; font-weight: 700; letter-spacing: 0.1em; opacity: 0.75;
}
.lu-dock-btn:active {
  transform: scale(0.90);
  background-color: rgba(253,251,245,0.14);
  transition-duration: 0s;
}
/* 주 행동(캡처) — 화면 유일의 골드 면 */
.lu-dock-btn.lu-gold {
  background: linear-gradient(180deg, #e0bd4e, #c9a02f);
  border-color: rgba(255,236,170,0.65);
  box-shadow: inset 0 1px 0 rgba(255,246,214,0.55);
  color: var(--lu-ink);
}
.lu-dock-btn.lu-gold .lu-dock-label { opacity: 1; }
.lu-dock-btn.lu-gold.lu-cap-pop { animation: lu-cap-pop 0.45s ease; }
@keyframes lu-cap-pop {
  0% { transform: scale(0.90); }
  55% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
/* 토글 ON — 골드 헤어라인 + 좌측 노치 (면 채움 금지) */
.lu-dock-btn.lu-on {
  border-color: rgba(212,175,55,0.85);
  color: #e6c458;
}
.lu-dock-btn.lu-on::before {
  content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 3px;
  background: var(--lu-gold);
}
#lu-more-sheet {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 640;
  border-radius: 16px 16px 0 0;
  padding: 10px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  background: rgba(23,20,15,0.82);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  backdrop-filter: blur(24px) saturate(150%);
  border-top: 1px solid rgba(212,175,55,0.45); /* 시트 유일 골드 — '열림' 신호 */
  transform: translateY(105%);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}
#lu-more-sheet.lu-open { transform: translateY(0); }
.lu-sheet-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: rgba(253,251,245,0.28);
  margin: 0 auto 12px;
}
.lu-sheet-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
}
#lu-more-sheet .lu-sheet-btn {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  min-width: 0; padding: 14px 8px; border-radius: 12px;
  background: rgba(253,251,245,0.06);
  border: 1px solid rgba(253,251,245,0.14);
  color: rgba(253,251,245,0.92); font-family: var(--lu-font);
  font-size: 10px; font-weight: 700; letter-spacing: 0.1em; cursor: pointer;
  transition: transform var(--lu-spring), background-color 0.2s ease;
}
#lu-more-sheet .lu-sheet-btn svg {
  width: 20px; height: 20px; fill: none;
  stroke: currentColor; stroke-width: 1.8;
  stroke-linecap: round; stroke-linejoin: round;
}
#lu-more-sheet .lu-sheet-btn:active {
  transform: scale(0.94); background-color: rgba(253,251,245,0.14);
  transition-duration: 0s;
}
#lu-more-backdrop {
  position: fixed; inset: 0; z-index: 630;
  background: rgba(10,8,4,0.35);
  opacity: 0; pointer-events: none;
  transition: opacity 0.25s ease;
}
#lu-more-backdrop.lu-open { opacity: 1; pointer-events: auto; }
#lu-lightbox { touch-action: none; }
.lu-lightbox-media { transition: transform 0.08s linear; will-change: transform; }

/* -------------------------------- 라이트박스 -------------------------------- */
#lu-lightbox {
  position: fixed; inset: 0; z-index: 950;
  background: rgba(4,4,5,0.96);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 64px 32px 40px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.32s ease;
}
#lu-lightbox.lu-open {
  opacity: 1; pointer-events: auto;
}
#lu-lightbox-close {
  position: fixed; top: 22px; right: 26px; z-index: 951;
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid rgba(255,255,255,0.25);
  border-radius: 50%;
  color: rgba(255,255,255,0.75);
  font-size: 18px; font-weight: 300; line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
#lu-lightbox-close:hover {
  border-color: var(--lu-gold); color: var(--lu-gold);
  transform: rotate(90deg);
}
.lu-lightbox-stage {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
  display: flex; align-items: center; justify-content: center;
  transform: scale(0.97); opacity: 0;
  transition: transform 0.36s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.36s ease;
}
#lu-lightbox.lu-open .lu-lightbox-stage { transform: scale(1); opacity: 1; }
.lu-lightbox-media {
  /* 스테이지(flex 잔여 공간)를 기준으로 맞춰 캡션을 침범하지 않는다 */
  max-width: 100%; max-height: 100%;
  object-fit: contain;
  box-shadow: 0 30px 90px rgba(0,0,0,0.6);
}
.lu-lightbox-caption {
  flex: 0 0 auto;
  width: 100%; max-width: 640px;
  margin-top: 26px;
  text-align: center;
}
.lu-lightbox-title {
  font-size: 25px; font-weight: 600; line-height: 1.35;
  letter-spacing: -0.01em;
  color: #fff;
}
.lu-lightbox-caption::before {
  content: '';
  display: block;
  width: 34px; height: 2px; margin: 0 auto 16px;
  background: var(--lu-gold); border-radius: 2px; opacity: 0.8;
}
.lu-lightbox-meta {
  margin-top: 8px;
  font-size: 12px; letter-spacing: 0.12em;
  color: var(--lu-gold);
}
.lu-lightbox-rule {
  width: 28px; height: 1px; background: rgba(255,255,255,0.2);
  margin: 18px auto;
}
.lu-lightbox-desc {
  font-size: 13px; line-height: 1.85;
  color: rgba(255,255,255,0.55);
  max-height: 16vh; overflow-y: auto;
}
.lu-lightbox-desc:empty { display: none; }

/* ----------------------------- 작품 목록 패널 ----------------------------- */
#lu-artlist {
  position: fixed; z-index: 650;
  top: 0; right: 0; bottom: 0;
  width: min(340px, calc(100vw - 24px));
  background: rgba(255,255,255,0.97);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  color: #111;
  box-shadow: -18px 0 50px rgba(0,0,0,0.28);
  transform: translateX(105%);
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex; flex-direction: column;
}
#lu-artlist.lu-open { transform: translateX(0); }
#lu-artlist-head {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px 24px 16px;
  border-bottom: 1px solid #eee;
}
#lu-artlist-title {
  font-size: 13px; letter-spacing: 0.28em; text-indent: 0.28em;
  color: #111;
}
#lu-artlist-close {
  flex: 0 0 auto;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid #ddd; border-radius: 50%;
  color: #999; font-size: 15px; font-weight: 300; line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
#lu-artlist-close:hover { border-color: var(--lu-gold); color: var(--lu-gold); transform: rotate(90deg); }
#lu-artlist-body {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto;
}
.lu-artlist-card {
  display: flex; align-items: center; gap: 14px;
  width: 100%; text-align: left;
  font-family: var(--lu-font); font-weight: 300;
  background: transparent; border: none; border-bottom: 1px solid #f0f0ee;
  padding: 14px 24px;
  cursor: pointer;
  transition: background 0.2s ease;
}
.lu-artlist-card:hover { background: #f6f3ea; }
.lu-artlist-thumb {
  flex: 0 0 auto;
  width: 56px; height: 56px; object-fit: cover;
  background: #eee;
}
.lu-artlist-info { min-width: 0; }
.lu-artlist-name {
  font-size: 13px; color: #111;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lu-artlist-artist {
  margin-top: 4px;
  font-size: 11px; letter-spacing: 0.04em; color: #999;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.lu-artlist-empty {
  padding: 40px 24px; text-align: center;
  font-size: 12px; color: #aaa;
}

/* ------------------------------- 방명록 패널 ------------------------------- */
/* 작품 목록 패널과 대칭 — 화면 왼쪽에서 슬라이드-인 */
#lu-guestbook {
  position: fixed; z-index: 650;
  top: 0; left: 0; bottom: 0;
  width: min(340px, calc(100vw - 24px));
  overflow: visible; /* 책갈피 탭이 패널 오른쪽 바깥으로 나온다 */
  background: linear-gradient(180deg, #fdfbf5 0%, #f6f1e4 100%);
  color: #1c1a16;
  box-shadow: 18px 0 50px rgba(20,15,8,0.28);
  transform: translateX(-100%); /* 닫혀도 책갈피 탭은 화면에 남는다 */
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex; flex-direction: column;
}
#lu-guestbook.lu-open { transform: translateX(0); }

/* 책갈피 탭 — 패널 오른쪽 가장자리에 붙어 함께 미끄러진다 */
#lu-gbtab {
  /* 책갈피 은유를 재질로 지킨다 — 열리는 패널과 같은 크림 종이 */
  position: absolute;
  right: -30px; top: max(20%, calc(env(safe-area-inset-top, 0px) + 72px));
  writing-mode: vertical-rl;
  padding: 14px 7px;
  background: linear-gradient(90deg, #f6f1e4, #fffdf8);
  border: 1px solid rgba(212,175,55,0.40);
  border-left: none;
  border-radius: 0 10px 10px 0;
  color: var(--lu-ink);
  font-family: var(--lu-font); font-weight: 700;
  font-size: 11px; letter-spacing: 0.26em;
  cursor: pointer;
  opacity: 0; pointer-events: none;
  transition: opacity 0.6s ease, transform var(--lu-spring);
}
#lu-gbtab.lu-visible { opacity: 1; pointer-events: auto; }
#lu-gbtab:active { transform: translateX(2px); transition-duration: 0s; }
#lu-guestbook-head {
  flex: 0 0 auto;
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(212,175,55,0.35);
}
#lu-guestbook-title .lu-gb-eyebrow {
  display: block;
  font-size: 9.5px; letter-spacing: 0.34em; color: #b28a2e;
  margin-bottom: 6px;
}
#lu-guestbook-title .lu-gb-main {
  display: block;
  font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: #17140f;
}
#lu-guestbook-title .lu-gb-sub {
  display: block;
  margin-top: 5px;
  font-size: 11.5px; color: #8a8172; letter-spacing: 0.03em;
}
#lu-guestbook-close {
  flex: 0 0 auto;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid #ddd; border-radius: 50%;
  color: #999; font-size: 15px; font-weight: 300; line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
#lu-guestbook-close:hover { border-color: var(--lu-gold); color: var(--lu-gold); transform: rotate(90deg); }
#lu-guestbook-body {
  flex: 1 1 auto; min-height: 0;
  overflow-y: auto;
}
.lu-gbook-note {
  /* 방명록 한 장 — 종이 카드 + 큰따옴표 워터마크 */
  position: relative;
  margin: 12px 16px 0;
  padding: 14px 16px 14px 18px;
  background: #fffefb;
  border: 1px solid #efe8d6;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(31,26,18,0.05);
}
.lu-gbook-note::before {
  content: '“';
  position: absolute; top: 2px; right: 12px;
  font-size: 34px; line-height: 1; color: rgba(212,175,55,0.28);
  font-family: Georgia, serif;
}
#lu-guestbook-body > .lu-gbook-note:last-child { margin-bottom: 14px; }
.lu-gbook-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  margin-right: 7px; vertical-align: 1px;
}
.lu-gbook-name { font-size: 12.5px; font-weight: 600; color: #3f3a30; }
.lu-gbook-time {
  margin-left: 8px;
  font-size: 10px; letter-spacing: 0.04em; color: #b3ab99;
}
.lu-gbook-text {
  margin-top: 7px;
  font-size: 13px; line-height: 1.7; color: #4a453c;
  word-break: break-word; white-space: pre-wrap;
}
.lu-gbook-empty {
  margin: 20px 16px; padding: 36px 20px; text-align: center;
  font-size: 12.5px; line-height: 1.8; color: #a89f8c;
  border: 1px dashed #ddd3ba; border-radius: 12px;
}
#lu-guestbook-footer {
  flex: 0 0 auto;
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid rgba(212,175,55,0.30);
  background: rgba(255,254,251,0.7);
}
#lu-gbook-input {
  width: 100%; resize: none;
  font-family: var(--lu-font); font-weight: 400;
  font-size: 13px; color: #1c1a16;
  background: #fffefb;
  border: 1px solid #e5dcc4;
  padding: 11px 13px; outline: none;
  border-radius: 12px;
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
#lu-gbook-input::placeholder { color: #b3ab99; }
#lu-gbook-input:focus { border-color: var(--lu-gold); box-shadow: 0 0 0 3px rgba(212,175,55,0.15); }
.lu-gbook-footer-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px;
}
.lu-gbook-count {
  font-size: 10px; letter-spacing: 0.04em; color: #bbb;
}
#lu-gbook-submit {
  font-family: var(--lu-font); font-weight: 600;
  font-size: 12.5px; letter-spacing: 0.06em;
  color: #17140f;
  background: var(--lu-gold);
  border: 1px solid var(--lu-gold); border-radius: 999px;
  padding: 9px 22px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  box-shadow: 0 3px 12px rgba(212,175,55,0.35);
}
#lu-gbook-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(212,175,55,0.45); }
#lu-gbook-submit:disabled {
  background: transparent; color: #b3ab99;
  border-color: #ddd3ba; box-shadow: none; cursor: default;
}
#lu-gbook-submit:hover { background: var(--lu-gold); border-color: var(--lu-gold); color: #111; }
#lu-gbook-submit:disabled { opacity: 0.35; cursor: default; }
#lu-gbook-submit:disabled:hover { background: #111; border-color: #111; color: #fff; }

/* -------------------------------- 투어 바 -------------------------------- */
#lu-tourbar {
  position: fixed; z-index: 500;
  bottom: 78px; left: 50%;
  display: flex; align-items: center; gap: 16px;
  background: rgba(10,10,12,0.6);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  padding: 11px 24px;
  border-top: 2px solid var(--lu-gold);
  font-size: 12px; letter-spacing: 0.05em;
  color: rgba(255,255,255,0.85);
  max-width: min(90vw, 640px);
  opacity: 0; pointer-events: none;
  transform: translate(-50%, 16px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  white-space: nowrap;
}
#lu-tourbar.lu-open { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
#lu-tourbar button {
  font-family: var(--lu-font); font-weight: 300;
  font-size: 12px; letter-spacing: 0.03em;
  color: rgba(255,255,255,0.85);
  background: transparent; border: none;
  cursor: pointer; padding: 4px 2px;
  transition: color 0.2s ease;
}
#lu-tourbar button:hover { color: var(--lu-gold); }
.lu-tour-sep {
  flex: 0 0 auto;
  width: 1px; height: 14px; background: rgba(255,255,255,0.2);
}
.lu-tour-count { color: var(--lu-gold); }
.lu-tour-title {
  display: inline-block;
  max-width: 220px; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; vertical-align: bottom;
  color: rgba(255,255,255,0.85);
}
#lu-tourbar .lu-tour-auto.lu-tour-on { color: var(--lu-gold); }
#lu-tourbar-exit { color: rgba(255,255,255,0.6); }
#lu-tourbar-exit:hover { color: var(--lu-gold); }

/* ------------------------------- 셔터 플래시 ------------------------------- */
/* 포토 모드(P키) 캡처 순간 흰 플래시 — flashShutter()가 opacity를 직접 제어한다 */
#lu-shutter {
  position: fixed; inset: 0; z-index: 970;
  background: #fff;
  opacity: 0; pointer-events: none;
}

/* -------------------------------- 공유 모달 -------------------------------- */
#lu-share {
  position: fixed; inset: 0; z-index: 980;
  background: rgba(4,4,5,0.96);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s ease;
}
#lu-share.lu-open { opacity: 1; pointer-events: auto; }
.lu-share-card {
  position: relative;
  width: 100%; max-width: 460px;
  max-height: 92vh; overflow-y: auto;
  background: rgba(255,255,255,0.97);
  color: #111;
  padding: 26px 24px 22px;
  box-shadow: 0 30px 90px rgba(0,0,0,0.5);
  text-align: center;
  transform: scale(0.97); opacity: 0;
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease;
}
#lu-share.lu-open .lu-share-card { transform: scale(1); opacity: 1; }
#lu-share-close {
  position: absolute; top: 14px; right: 14px;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid #ddd; border-radius: 50%;
  color: #999; font-size: 15px; font-weight: 300; line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
#lu-share-close:hover { border-color: var(--lu-gold); color: var(--lu-gold); transform: rotate(90deg); }
.lu-share-title {
  font-size: 13px; letter-spacing: 0.28em; text-indent: 0.28em;
  color: #111; margin-bottom: 18px;
}
.lu-share-preview {
  display: block;
  max-width: 100%; max-height: 55vh;
  margin: 0 auto;
  object-fit: contain;
  border: 1px solid #eee;
  background: #f4f4f2;
}
.lu-share-actions {
  display: flex; flex-direction: column; gap: 8px;
  margin-top: 20px;
}
.lu-share-btn {
  width: 100%;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 13px; letter-spacing: 0.04em;
  color: #222; background: transparent;
  border: 1px solid rgba(0,0,0,0.18);
  border-radius: 3px;
  padding: 11px 16px; cursor: pointer;
  transition: border-color 0.25s ease, background 0.25s ease, color 0.25s ease;
}
.lu-share-btn:hover { border-color: rgba(0,0,0,0.45); }
.lu-share-btn-primary {
  background: var(--lu-gold); border-color: var(--lu-gold); color: #111;
}
.lu-share-btn-primary:hover { background: #c4a02f; border-color: #c4a02f; }
.lu-share-btn-copied { border-color: var(--lu-gold); color: var(--lu-gold); }
.lu-share-hint {
  margin-top: 16px;
  font-size: 10px; letter-spacing: 0.02em; line-height: 1.6;
  color: #b0aca4;
}

/* ------------------------------- 모바일 ------------------------------- */
@media (max-width: 640px) {
  .lu-lobby-card { padding: 34px 22px 26px; }
  .lu-lobby-title { font-size: 19px; }
  #lu-controls { font-size: 11px; padding: 10px 12px; }
  #lu-controls .lu-key { min-width: 60px; }
  #lu-chat { width: calc(100vw - 24px); left: 12px; bottom: 12px; }
  #lu-chat-log { max-height: 130px; }
  #lu-status { font-size: 11px; padding: 6px 14px; }
  #lu-topbar { max-width: 72vw; padding: 0 12px; }
  .lu-topbar-title { font-size: 10px; letter-spacing: 0.2em; text-indent: 0.2em; }
  #lu-lightbox { padding: 56px 18px 28px; }
  #lu-lightbox-close { top: 14px; right: 14px; width: 36px; height: 36px; font-size: 16px; }
  .lu-lightbox-media { max-width: 100%; max-height: 100%; }
  .lu-lightbox-title { font-size: 19px; }
  .lu-lightbox-caption { margin-top: 18px; }
  #lu-artlist { width: calc(100vw - 24px); }
  #lu-artlist-head { padding: 18px 18px 14px; }
  .lu-artlist-card { padding: 12px 18px; gap: 12px; }
  #lu-guestbook { width: calc(100vw - 24px); }
  #lu-guestbook-head { padding: 18px 18px 14px; }
  .lu-gbook-note { padding: 12px 18px; }
  #lu-guestbook-footer { padding: 14px 18px 16px; }
  #lu-tourbar {
    bottom: 92px; padding: 9px 14px; gap: 10px;
    font-size: 11px; max-width: calc(100vw - 20px);
  }
  .lu-tour-title { max-width: 110px; }
  .lu-share-card { padding: 20px 16px 18px; max-width: calc(100vw - 24px); }
  .lu-share-preview { max-height: 42vh; }
}

/* --------------------- 아바타 커스터마이저: 세로 배치 폴백 --------------------- */
@media (max-width: 720px) {
  #lu-avatar-maker, #lu-chibi-maker { padding: 8px; }
  .lu-am-card { max-width: 92vw; max-height: 88vh; }
  .lu-am-body { flex-direction: column; overflow-y: auto; padding: 14px; gap: 14px; }
  .lu-am-preview { width: 100%; max-width: 260px; height: 320px; margin: 0 auto; }
  .lu-am-panel { min-height: 0; }
  .lu-am-tabpage { max-height: 40vh; }
}
`;
  const style = document.createElement('style');
  style.id = 'lu-styles';
  style.textContent = css;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// DOM 빌드 헬퍼
// ---------------------------------------------------------------------------
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) node.appendChild(child);
  return node;
}

// ---------------------------------------------------------------------------
// 컴포넌트 생성
// ---------------------------------------------------------------------------
function buildLoading() {
  const overlay = el('div', { id: 'lu-loading', className: 'lu' }, [
    el('div', { className: 'lu-spinner' }),
    el('div', { className: 'lu-loading-text', text: 'MUSEUM LOADING...' }),
  ]);
  document.body.appendChild(overlay);
  return overlay;
}

function buildLobby() {
  const title = el('div', { className: 'lu-lobby-title', text: 'ARTSHOW MUSEUM' });
  const sub = el('div', { className: 'lu-lobby-sub', text: 'VIRTUAL EXHIBITION' });
  const rule = el('div', { className: 'lu-lobby-rule' });

  // ---- 소셜 로그인 (현재 mock — auth.js 참고) ----
  const authBox = el('div', { id: 'lu-auth' });

  const socialWrap = el('div', { className: 'lu-social-wrap' });
  const loggedWrap = el('div', { className: 'lu-logged-wrap' });

  const buildSocialButtons = () => {
    socialWrap.textContent = '';
    for (const key of Object.keys(AUTH_PROVIDERS)) {
      const p = AUTH_PROVIDERS[key];
      const btn = el('button', {
        className: `lu-social-btn lu-social-${key}`,
        type: 'button',
      }, [
        el('span', { className: 'lu-social-badge', text: p.short }),
        el('span', { text: p.label }),
      ]);
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.classList.add('lu-social-busy');
        try {
          await authLoginWith(key);
        } catch (_) {
          /* mock에서는 실패 없음 */
        }
        btn.disabled = false;
        btn.classList.remove('lu-social-busy');
      });
      socialWrap.appendChild(btn);
    }
    socialWrap.appendChild(el('div', {
      className: 'lu-social-note',
      text: '계정 연동 준비 중 — 지금은 프로필 미리보기로 동작합니다',
    }));
  };

  const buildLoggedChip = (p) => {
    loggedWrap.textContent = '';
    const avatar = el('span', { className: 'lu-logged-avatar', text: p.initial || p.name.slice(0, 1) });
    const name = el('span', { className: 'lu-logged-name', text: `${p.name}님` });
    const via = el('span', { className: 'lu-logged-via', text: AUTH_PROVIDERS[p.provider] ? AUTH_PROVIDERS[p.provider].short : '' });
    const logoutBtn = el('button', { className: 'lu-logout-btn', type: 'button', text: '로그아웃' });
    logoutBtn.addEventListener('click', () => authLogout());
    loggedWrap.appendChild(el('div', { className: 'lu-logged-chip' }, [avatar, name, via, logoutBtn]));
  };

  const syncAuthUI = (p) => {
    if (p) {
      buildLoggedChip(p);
      socialWrap.style.display = 'none';
      loggedWrap.style.display = '';
      // 프로필 이름을 닉네임에 프리필 (사용자가 수정 가능)
      nickInput.value = p.name.slice(0, MAX_NICKNAME_LEN);
    } else {
      socialWrap.style.display = '';
      loggedWrap.style.display = 'none';
      if (!nickInput.value || Object.values(AUTH_MOCK_PREFILL).includes(nickInput.value)) {
        nickInput.value = '게스트';
      }
    }
  };

  buildSocialButtons();
  authBox.appendChild(socialWrap);
  authBox.appendChild(loggedWrap);

  const orDivider = el('div', { className: 'lu-auth-or' }, [
    el('span', { text: '소셜 계정 연동 (준비 중)' }),
  ]);

  // 닉네임
  const nickLabel = el('label', { className: 'lu-field-label', for: 'lu-nickname', text: '닉네임' });
  const nickInput = el('input', {
    id: 'lu-nickname',
    type: 'text',
    maxlength: String(MAX_NICKNAME_LEN),
    value: '게스트',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const nickHint = el('div', { className: 'lu-field-hint', text: `최대 ${MAX_NICKNAME_LEN}자 · 비워두면 '게스트'로 입장합니다` });

  // 캐릭터 선택 (KayKit Adventurers 4종 + 휴먼 + 커스텀) — 색상 스와치 위에 배치
  const charLabel = el('div', { className: 'lu-field-label', text: '캐릭터', style: 'margin-top:26px;' });
  const charsRow = el('div', { className: 'lu-chars' });

  function selectChar(id, btn) {
    selectedChar = id;
    try { localStorage.setItem(LU_CHAR_STORAGE_KEY, id); } catch (_) { /* 프라이빗 모드 등 무시 */ }
    charsRow.querySelectorAll('.lu-char-btn').forEach((b) => b.classList.remove('lu-selected'));
    btn.classList.add('lu-selected');
  }

  CHARACTERS.forEach((c) => {
    const btn = el('button', {
      className: 'lu-char-btn' + (c.id === selectedChar ? ' lu-selected' : ''),
      type: 'button',
      'aria-label': `캐릭터 ${c.name}`,
      text: c.name,
    });
    btn.addEventListener('click', () => selectChar(c.id, btn));
    charsRow.appendChild(btn);
  });

  // 커스텀 아바타(자체 커스터마이저) — 6번째 선택지. 저장된 룩이 있으면 선택만 하고,
  // 없으면 곧바로 커스터마이저를 연다. 저장 후에는 프리뷰 스냅샷을 배경으로 보여준다.
  const customBtn = el('button', {
    className: 'lu-char-btn lu-char-custom' + (selectedChar === CUSTOM_CHAR_ID ? ' lu-selected' : ''),
    type: 'button',
    'aria-label': '커스텀 아바타',
  });
  function syncCustomButtonVisual() {
    const thumb = readStoredLookThumb();
    if (thumb) {
      customBtn.style.backgroundImage = `url('${thumb}')`;
      customBtn.classList.add('lu-has-thumb');
      customBtn.textContent = '';
      customBtn.appendChild(el('span', { text: '커스텀' }));
    } else {
      customBtn.style.backgroundImage = '';
      customBtn.classList.remove('lu-has-thumb');
      customBtn.textContent = '✨ 커스텀';
    }
  }
  syncCustomButtonVisual();
  customBtn.addEventListener('click', () => {
    if (readStoredLook()) {
      selectChar(CUSTOM_CHAR_ID, customBtn);
    } else {
      openAvatarMaker();
    }
  });
  charsRow.appendChild(customBtn);

  // 치비 아바타(자체 코드 생성) — 7번째 선택지. 저장된 룩이 있으면 1클릭은 선택,
  // 재클릭은 메이커 열기. 없으면 곧바로 메이커를 연다.
  const chibiBtn = el('button', {
    className: 'lu-char-btn lu-char-custom' + (selectedChar === CHIBI_SEL_ID ? ' lu-selected' : ''),
    type: 'button',
    'aria-label': '치비 아바타',
  });
  function syncChibiButtonVisual() {
    const thumb = readStoredChibiThumb();
    if (thumb) {
      chibiBtn.style.backgroundImage = `url('${thumb}')`;
      chibiBtn.classList.add('lu-has-thumb');
      chibiBtn.textContent = '';
      chibiBtn.appendChild(el('span', { text: '치비' }));
    } else {
      chibiBtn.style.backgroundImage = '';
      chibiBtn.classList.remove('lu-has-thumb');
      chibiBtn.textContent = '🧸 치비';
    }
  }
  syncChibiButtonVisual();
  chibiBtn.addEventListener('click', () => {
    if (selectedChar !== CHIBI_SEL_ID) {
      selectChar(CHIBI_SEL_ID, chibiBtn); // 1클릭: 선택 (저장 룩 없으면 기본 치비)
    } else {
      openChibiMaker(); // 재클릭: 꾸미기
    }
  });
  // 치비(오리지널) → 커스텀 → 클래식 프리셋 순서로 노출
  charsRow.prepend(customBtn);
  charsRow.prepend(chibiBtn);

  const editLink = el('button', {
    className: 'lu-char-edit-link',
    type: 'button',
    text: '꾸미기 ✎',
  });
  editLink.addEventListener('click', () => openAvatarMaker());

  // 색상 스와치
  const enterBtn = el('button', { id: 'lu-enter-btn', type: 'button', text: '입장하기' });

  // 전시 선택 섹션 — initGalleryPicker() 호출 전에는 빈 컨테이너
  const pickerBox = el('div', { id: 'lu-picker' });

  // 하단 스튜디오 링크
  const divider = el('div', { className: 'lu-lobby-divider' });
  const studioLink = el('a', {
    className: 'lu-studio-link',
    href: './studio.html',
    target: '_blank',
    rel: 'noopener noreferrer',
    text: '작가 스튜디오에서 나만의 전시 만들기 →',
  });

  const card = el('div', { className: 'lu-lobby-card' }, [
    title, sub, rule,
    nickLabel, nickInput, nickHint,
    charLabel, charsRow, editLink,
    enterBtn,
    orDivider, authBox,
    pickerBox,
    divider, studioLink,
  ]);
  const overlay = el('div', { id: 'lu-lobby', className: 'lu' }, [card]);
  document.body.appendChild(overlay);

  // 저장된 로그인 세션 복원 + 상태 변화 반영
  syncAuthUI(authGetProfile());
  onAuthChange(syncAuthUI);

  function submit() {
    let nickname = nickInput.value.trim().slice(0, MAX_NICKNAME_LEN);
    if (!nickname) nickname = '게스트';
    // 라벨 색은 닉네임 해시로 자동 배정 — 같은 이름은 늘 같은 색, 선택 UI 제거
    let colorHash = 0;
    for (let i = 0; i < nickname.length; i++) colorHash = (colorHash * 31 + nickname.charCodeAt(i)) >>> 0;
    selectedColor = AVATAR_COLORS[colorHash % AVATAR_COLORS.length];
    // 커스텀 선택 시 저장된 룩으로부터 char 문자열('dcl:'+JSON)을 새로 인코딩한다
    // (manifest 기준 정규화/폴백까지 encodeLook이 처리 — avatarkit.js 계약).
    let char = selectedChar;
    if (selectedChar === CUSTOM_CHAR_ID) {
      const storedLook = readStoredLook();
      char = encodeLook(Object.assign({}, DEFAULT_LOOK, storedLook || {}));
    } else if (selectedChar === CHIBI_SEL_ID) {
      char = encodeChibi(Object.assign({}, DEFAULT_CHIBI, readStoredChibi() || {}));
    }
    if (typeof callbacks.onEnter === 'function') {
      callbacks.onEnter({ nickname, color: selectedColor, char });
    }
  }
  enterBtn.addEventListener('click', submit);
  nickInput.addEventListener('keydown', (e) => {
    e.stopPropagation(); // 로비 입력 중 WASD/Enter 전역 처리 차단
    if (e.key === 'Enter') submit();
  });
  nickInput.addEventListener('keyup', (e) => e.stopPropagation());

  // 커스터마이저에서 [저장하고 사용]을 누르면 호출 — 로비의 커스텀 버튼을 선택 상태로
  // 전환하고 썸네일을 갱신한다 (아바타 메이커 모달은 이 함수를 통해서만 로비 상태를 건드린다).
  function onCustomLookSaved() {
    syncCustomButtonVisual();
    selectChar(CUSTOM_CHAR_ID, customBtn);
  }

  // 치비 메이커에서 [저장하고 사용]을 누르면 호출 — onCustomLookSaved와 동일 규약
  function onChibiSaved() {
    syncChibiButtonVisual();
    selectChar(CHIBI_SEL_ID, chibiBtn);
  }

  return { overlay, nickInput, pickerBox, onCustomLookSaved, onChibiSaved };
}

function buildControls() {
  // 기기별 조작 안내 — 터치 기기에는 키보드 안내 대신 터치 제스처 안내
  const rows = IS_TOUCH
    ? [
        ['왼쪽 드래그', '이동'],
        ['오른쪽 드래그', '시점 회전'],
        ['캐릭터 탭', '콕 찌르기'],
        ['작품 카드', '탭하여 크게 보기'],
      ]
    : [
        ['마우스 드래그', '시점 회전'],
        ['W A S D', '이동'],
        ['Shift', '달리기'],
        ['Enter', '채팅'],
        ['M', '작품 목록'],
        ['T', '투어'],
        ['G', '방명록'],
        ['V', '내 모습 보기'],
        ['P', '사진 촬영'],
        ['클릭', '캐릭터 콕 찌르기'],
      ];
  const panel = el('div', { id: 'lu-controls', className: 'lu lu-hud' });
  panel.appendChild(el('div', { className: 'lu-controls-title', text: 'CONTROLS' }));
  rows.forEach(([key, desc]) => {
    const row = el('div', {}, [
      el('span', { className: 'lu-key', text: key }),
      el('span', { text: desc }),
    ]);
    panel.appendChild(row);
  });
  document.body.appendChild(panel);

  // 터치 기기: 화면을 넓게 쓰도록 접힌 상태로 시작 — '?' 칩으로 토글
  if (IS_TOUCH) {
    panel.classList.add('lu-collapsed');
    const toggle = el('button', {
      id: 'lu-controls-toggle',
      className: 'lu lu-hud',
      type: 'button',
      'aria-label': '조작법 보기',
      text: '?',
    });
    toggle.addEventListener('click', () => {
      panel.classList.toggle('lu-collapsed');
    });
    document.body.appendChild(toggle);
  }

  return panel;
}

function buildMobileDock() {
  // 터치 기기 전용 액션 독 — 키보드 단축키(M/T)의 대체 진입점
  if (!IS_TOUCH) return null;

  // UX 감사 §2 IA: 1차 노출은 [투어][캡처(골드 강조)][더보기]만 — 엄지 호 안 3버튼.
  // 목록/내 모습/채팅/조작법은 더보기 시트로. 채팅은 접속자 ≥2일 때만 독에 동적 승격.
  function toggleChat() {
    const wrap = els && els.chat && els.chat.wrap;
    if (!wrap) return;
    const collapsed = wrap.classList.toggle('lu-chat-collapsed');
    if (!collapsed && els.chat.input) els.chat.input.focus();
    else if (els.chat.input) els.chat.input.blur();
    chatBtn.classList.toggle('lu-on', !collapsed);
  }

  // 스트로크 아이콘 시스템 — 원 안 텍스트는 게임 HUD 문법이 아니다 (디자인 감사 P2)
  const ICONS = {
    chat: '<path d="M20 15a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/>',
    tour: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2.1 4.9-4.9 2.1 2.1-4.9z"/>',
    capture: '<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.4"/>',
    more: '<circle cx="5.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
    list: '<path d="M8.5 6h11.5M8.5 12h11.5M8.5 18h11.5"/><circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none"/>',
    self: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/>',
    help: '<path d="M9.2 9a2.9 2.9 0 1 1 4.2 2.6c-.9.45-1.4 1.05-1.4 2.1"/><circle cx="12" cy="17.4" r="1" fill="currentColor" stroke="none"/>',
  };
  function svgIcon(name) {
    const span = document.createElement('span');
    span.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>';
    return span.firstChild;
  }
  function dockBtn(cls, aria, icon, label) {
    const b = el('button', { className: cls, type: 'button', 'aria-label': aria });
    b.appendChild(svgIcon(icon));
    b.appendChild(el('span', { className: 'lu-dock-label', text: label }));
    // 그림자는 래퍼의 drop-shadow가 담당 (버튼 자체는 배경 블러 레이어)
    const wrap = el('div', { className: 'lu-dock-wrap' }, [b]);
    return { b, wrap };
  }

  const chat = dockBtn('lu-dock-btn', '채팅 열기/닫기', 'chat', '채팅');
  const chatBtn = chat.b;
  chat.wrap.style.display = 'none'; // 접속자 ≥2에서 setPlayerCount가 노출
  chatBtn.addEventListener('click', toggleChat);

  const tour = dockBtn('lu-dock-btn', '투어 시작/종료', 'tour', '투어');
  const tourBtn = tour.b;
  tourBtn.addEventListener('click', () => {
    if (typeof actionHandlers.onTour === 'function') actionHandlers.onTour();
  });

  const capture = dockBtn('lu-dock-btn lu-gold', '사진 촬영', 'capture', '캡처');
  const captureBtn = capture.b;
  captureBtn.addEventListener('click', () => {
    // 촬영 순간 1회 팝 — 눌림이 물리적으로 반응했다는 확인
    captureBtn.classList.remove('lu-cap-pop');
    void captureBtn.offsetWidth;
    captureBtn.classList.add('lu-cap-pop');
    if (typeof actionHandlers.onCapture === 'function') actionHandlers.onCapture();
  });

  const more = dockBtn('lu-dock-btn', '더보기', 'more', '메뉴');
  const moreBtn = more.b;

  // ---- 더보기 시트 ----
  const backdrop = el('div', { id: 'lu-more-backdrop' });
  const sheet = el('div', { id: 'lu-more-sheet' });
  function closeSheet() {
    sheet.classList.remove('lu-open');
    backdrop.classList.remove('lu-open');
  }
  function sheetBtn(icon, label, fn) {
    const b = el('button', { className: 'lu-sheet-btn', type: 'button' });
    b.appendChild(svgIcon(icon));
    b.appendChild(el('span', { text: label }));
    b.addEventListener('click', () => {
      closeSheet();
      fn();
    });
    return b;
  }
  const grid = el('div', { className: 'lu-sheet-grid' }, [
    sheetBtn('list', '작품 목록', () => toggleArtworkList()),
    sheetBtn('self', '내 모습', () => {
      if (typeof actionHandlers.onSelfView === 'function') actionHandlers.onSelfView();
    }),
    sheetBtn('chat', '채팅', toggleChat),
    sheetBtn('help', '조작법', () => {
      const panel = document.getElementById('lu-controls');
      if (panel) panel.classList.toggle('lu-collapsed');
    }),
  ]);
  sheet.append(el('div', { className: 'lu-sheet-handle' }), grid);
  backdrop.addEventListener('click', closeSheet);
  moreBtn.addEventListener('click', () => {
    const open = sheet.classList.toggle('lu-open');
    backdrop.classList.toggle('lu-open', open);
  });
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);

  // 방명록은 화면 왼쪽 책갈피 탭(#lu-gbtab)이 담당하므로 독 버튼은 두지 않는다
  const dock = el('div', { id: 'lu-dock', className: 'lu lu-hud' }, [chat.wrap, tour.wrap, capture.wrap, more.wrap]);
  document.body.appendChild(dock);
  dockRefs = { chatBtn, chatWrap: chat.wrap, tourBtn, selfBtn: null, dock };
  return dock;
}

// 독 활성 상태 표시 — main.js가 투어/3인칭 토글 시점에 호출한다
let dockRefs = null;
export function setDockActive(key, on) {
  if (!dockRefs) return;
  if (key === 'tour' && dockRefs.tourBtn) dockRefs.tourBtn.classList.toggle('lu-on', !!on);
  // 'self'는 시트 안 버튼이라 상태 뱃지 대상 아님 — 상태바 문구가 담당
}

function buildTopRight() {
  // FPS는 디버그 지표 — 우상단에 단독으로, 터치 기기에서는 CSS가 숨긴다.
  // 접속자 수는 상단 통합 바(buildGalleryTitle)로 이동 (게임 HUD 감사 §3.4).
  const fps = el('span', { text: '--' });
  const fpsStat = el('div', { className: 'lu-stat' });
  fpsStat.append('FPS ');
  const fpsB = el('b'); fpsB.appendChild(fps); fpsStat.appendChild(fpsB);
  const wrap = el('div', { id: 'lu-topright', className: 'lu lu-hud' }, [fpsStat]);
  document.body.appendChild(wrap);
  // count/countWrap은 상단 바가 생성 후 주입한다 (setPlayerCount 호환)
  return { wrap, fps, count: el('span'), countWrap: null };
}

function buildStatus() {
  const bar = el('div', { id: 'lu-status', className: 'lu lu-hud' });
  document.body.appendChild(bar);
  return bar;
}

function buildChat() {
  const log = el('div', { id: 'lu-chat-log' });
  const input = el('input', {
    id: 'lu-chat-input',
    type: 'text',
    maxlength: '120',
    placeholder: IS_TOUCH ? '탭하여 채팅…' : 'Enter 키로 채팅…',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const wrap = el('div', { id: 'lu-chat', className: 'lu lu-hud' }, [log, input]);
  if (IS_TOUCH) wrap.classList.add('lu-chat-collapsed');
  document.body.appendChild(wrap);

  // 입력창 포커스 중 키 이벤트가 플레이어 조작(WASD)으로 전파되지 않도록 차단
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const text = input.value.trim();
      input.value = '';
      input.blur();
      if (text && typeof callbacks.onChatSend === 'function') {
        callbacks.onChatSend(text);
      }
    } else if (e.key === 'Escape') {
      input.value = '';
      input.blur();
    }
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('keypress', (e) => e.stopPropagation());

  return { wrap, log, input };
}

function buildArtworkPanel() {
  const eyebrow = el('div', { className: 'lu-art-eyebrow', text: 'ARTWORK' });
  const title = el('div', { className: 'lu-art-title' });
  const meta = el('div', { className: 'lu-art-meta' });
  const rule = el('div', { className: 'lu-art-rule' });
  const desc = el('div', { className: 'lu-art-desc' });
  // 힌트를 실제 버튼으로 — 데스크톱은 E키 안내 겸용, 터치는 유일한 진입점
  const hint = el('button', { className: 'lu-art-hint', type: 'button' });
  if (IS_TOUCH) {
    hint.appendChild(document.createTextNode('크게 보기'));
  } else {
    hint.appendChild(el('span', { className: 'lu-key', text: 'E' }));
    hint.appendChild(document.createTextNode(' — 크게 보기'));
  }
  hint.addEventListener('click', (e) => {
    e.stopPropagation(); // 터치의 카드 전체 탭 핸들러와 이중 발화 방지
    if (typeof actionHandlers.onViewArtwork === 'function') actionHandlers.onViewArtwork();
  });
  const panel = el('div', { id: 'lu-artwork', className: 'lu' }, [eyebrow, title, meta, rule, desc, hint]);
  if (IS_TOUCH) {
    // 하단 좌측 미니 캡션에서는 카드 전체가 '크게 보기' 탭 타깃
    panel.addEventListener('click', () => {
      if (typeof actionHandlers.onViewArtwork === 'function') actionHandlers.onViewArtwork();
    });
  }
  document.body.appendChild(panel);
  return { panel, title, meta, desc };
}

function buildGalleryTitle() {
  // 상단 통합 바 — 전시명 + 라이브 접속자 하나의 유리 칩으로
  const title = el('span', { className: 'lu-topbar-title' });
  const count = el('b', { text: '1' });
  const countWrap = el('span', { className: 'lu-topbar-count' });
  countWrap.appendChild(count);
  countWrap.append(' 명');
  const bar = el('div', { id: 'lu-topbar', className: 'lu lu-hud lu-cut-s lu-empty' }, [
    title,
    el('span', { className: 'lu-topbar-sep' }),
    countWrap,
  ]);
  document.body.appendChild(bar);
  bar._count = count;
  bar._countWrap = countWrap;
  return bar;
}

function buildLightbox() {
  const closeBtn = el('button', {
    id: 'lu-lightbox-close', type: 'button', 'aria-label': '닫기', text: '×',
  });

  const stage = el('div', { className: 'lu-lightbox-stage' });

  const titleEl = el('div', { className: 'lu-lightbox-title' });
  const metaEl = el('div', { className: 'lu-lightbox-meta' });
  const ruleEl = el('div', { className: 'lu-lightbox-rule' });
  const descEl = el('div', { className: 'lu-lightbox-desc' });
  const caption = el('div', { className: 'lu-lightbox-caption' }, [titleEl, metaEl, ruleEl, descEl]);

  const overlay = el('div', { id: 'lu-lightbox', className: 'lu' }, [closeBtn, stage, caption]);
  document.body.appendChild(overlay);

  closeBtn.addEventListener('click', () => hideLightbox());
  // 배경(스테이지의 여백) 클릭 시 닫힘 — 이미지/영상 자체 클릭은 통과
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === stage) hideLightbox();
  });

  // ---- 감상 제스처 (UX 감사 §4): 핀치 줌 · 팬 · 더블탭 줌 · 스와이프 넘김/닫기 ----
  const pointers = new Map();
  let zScale = 1;
  let zTx = 0;
  let zTy = 0;
  let pinch0 = 0;
  let scale0 = 1;
  let lastTapT = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let swipe0 = null;

  function mediaEl() {
    return stage.querySelector('.lu-lightbox-media');
  }
  function applyZoom() {
    const media = mediaEl();
    if (media) media.style.transform = `translate(${zTx}px, ${zTy}px) scale(${zScale})`;
  }
  function resetZoom() {
    zScale = 1;
    zTx = 0;
    zTy = 0;
    applyZoom();
  }

  overlay.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) swipe0 = { x: e.clientX, y: e.clientY, t: performance.now() };
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
      scale0 = zScale;
    }
  });
  overlay.addEventListener('pointermove', (e) => {
    const pt = pointers.get(e.pointerId);
    if (!pt) return;
    const dx = e.clientX - pt.x;
    const dy = e.clientY - pt.y;
    pt.x = e.clientX;
    pt.y = e.clientY;
    if (pointers.size === 2 && pinch0 > 0) {
      const [a, b] = [...pointers.values()];
      zScale = Math.min(4, Math.max(1, scale0 * (Math.hypot(a.x - b.x, a.y - b.y) / pinch0)));
      if (zScale === 1) { zTx = 0; zTy = 0; }
      applyZoom();
    } else if (pointers.size === 1 && zScale > 1) {
      zTx += dx;
      zTy += dy;
      applyZoom();
    }
  });
  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size !== 0 || !swipe0) return;
    const dt = performance.now() - swipe0.t;
    const dx = e.clientX - swipe0.x;
    const dy = e.clientY - swipe0.y;
    swipe0 = null;
    if (zScale === 1 && dt < 600) {
      if (Math.abs(dx) > 64 && Math.abs(dy) < 56) {
        navLightbox(dx < 0 ? 1 : -1); // 왼쪽으로 쓸면 다음 작품
        return;
      }
      if (dy > 84 && Math.abs(dx) < 60) {
        hideLightbox(); // 아래로 쓸어 닫기 — 모바일 시트 관용구
        return;
      }
    }
    // 더블탭 줌 토글 (이동 거의 없는 짧은 탭 2연속)
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12 && dt < 350) {
      const now = performance.now();
      if (now - lastTapT < 320 && Math.hypot(e.clientX - lastTapX, e.clientY - lastTapY) < 44) {
        if (zScale > 1) {
          resetZoom();
        } else {
          zScale = 2.4;
          applyZoom();
        }
        lastTapT = 0;
        return;
      }
      lastTapT = now;
      lastTapX = e.clientX;
      lastTapY = e.clientY;
    }
  }
  overlay.addEventListener('pointerup', endPointer);
  overlay.addEventListener('pointercancel', (e) => pointers.delete(e.pointerId));

  return { overlay, closeBtn, stage, title: titleEl, meta: metaEl, rule: ruleEl, desc: descEl, resetZoom };
}

// 라이트박스 이전/다음 작품 — 배치 순서 기준 순환
let lightboxCurrentArt = null;
function navLightbox(dir) {
  const list = getPlacedArtworks();
  if (!lightboxCurrentArt || list.length < 2) return;
  const idx = list.indexOf(lightboxCurrentArt);
  const next = list[((idx === -1 ? 0 : idx) + dir + list.length) % list.length];
  showLightbox(next);
}

// 썸네일 로드 실패(또는 비디오 전용 작품 등 imageUrl 부재) 시 사용할 중립 회색 placeholder
const ARTLIST_THUMB_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56"><rect width="56" height="56" fill="#eaeae6"/></svg>'
  );

function renderArtworkList(artworks) {
  const body = els.artworkList.body;
  body.innerHTML = '';
  if (!Array.isArray(artworks) || artworks.length === 0) {
    body.appendChild(el('div', { className: 'lu-artlist-empty', text: '표시할 작품이 없습니다' }));
    return;
  }
  artworks.forEach((art) => {
    const thumb = el('img', {
      className: 'lu-artlist-thumb',
      src: art.imageUrl || ARTLIST_THUMB_FALLBACK,
      alt: art.title || '',
      loading: 'lazy',
    });
    thumb.addEventListener('error', () => { thumb.src = ARTLIST_THUMB_FALLBACK; }, { once: true });

    const info = el('div', { className: 'lu-artlist-info' }, [
      el('div', { className: 'lu-artlist-name', text: art.title || '' }),
      el('div', { className: 'lu-artlist-artist', text: art.artist || '' }),
    ]);
    const card = el('button', { type: 'button', className: 'lu-artlist-card' }, [thumb, info]);
    card.addEventListener('click', () => {
      hideArtworkList();
      if (typeof onArtworkSelect === 'function') onArtworkSelect(art);
    });
    body.appendChild(card);
  });
}

function buildArtworkList() {
  const closeBtn = el('button', { id: 'lu-artlist-close', type: 'button', 'aria-label': '닫기', text: '×' });
  const head = el('div', { id: 'lu-artlist-head' }, [
    el('div', { id: 'lu-artlist-title', text: '작품 목록' }),
    closeBtn,
  ]);
  const body = el('div', { id: 'lu-artlist-body' });
  const panel = el('div', { id: 'lu-artlist', className: 'lu' }, [head, body]);
  document.body.appendChild(panel);

  closeBtn.addEventListener('click', () => hideArtworkList());

  return { panel, body };
}

// ---------------------------------------------------------------------------
// 방명록 패널 — G 키(또는 HUD 버튼)로 열어 전시에 한 줄 메모를 남긴다
// ---------------------------------------------------------------------------

// '3분 전' / '2시간 전' / '어제' / 'YYYY.MM.DD' — 노트 작성 시각을 사람이 읽기 쉬운 형태로.
function formatRelativeTime(ts) {
  const now = Date.now();
  const diffMs = Math.max(0, now - ts);
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;

  const d = new Date(ts);
  const n = new Date(now);
  const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(n) - startOfDay(d)) / 86400000);
  if (dayDiff <= 1) return '어제';

  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

function renderGuestbookNotes(notes) {
  const body = els.guestbook.body;
  body.innerHTML = '';
  if (!Array.isArray(notes) || notes.length === 0) {
    body.appendChild(el('div', { className: 'lu-gbook-empty', text: '첫 방명록을 남겨보세요' }));
    return;
  }
  const DOT_COLORS = ['#e07a5f', '#81b29a', '#d4af37', '#8e7dbe', '#6a8caf', '#d68fb8'];
  notes.forEach((note) => {
    const name = note.name || '게스트';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    const dot = el('span', { className: 'lu-gbook-dot' });
    dot.style.background = DOT_COLORS[hash % DOT_COLORS.length];
    const head = el('div', {}, [
      dot,
      el('span', { className: 'lu-gbook-name', text: name }),
      el('span', { className: 'lu-gbook-time', text: formatRelativeTime(note.ts) }),
    ]);
    const text = el('div', { className: 'lu-gbook-text', text: note.text || '' });
    body.appendChild(el('div', { className: 'lu-gbook-note' }, [head, text]));
  });
}

function buildGuestbookPanel() {
  const closeBtn = el('button', { id: 'lu-guestbook-close', type: 'button', 'aria-label': '닫기', text: '×' });
  const head = el('div', { id: 'lu-guestbook-head' }, [
    el('div', { id: 'lu-guestbook-title' }, [
      el('span', { className: 'lu-gb-eyebrow', text: 'GUESTBOOK' }),
      el('span', { className: 'lu-gb-main', text: '방명록' }),
      el('span', { className: 'lu-gb-sub', text: '다녀간 마음을 한 줄 남겨 주세요' }),
    ]),
    closeBtn,
  ]);
  const body = el('div', { id: 'lu-guestbook-body' });

  const input = el('textarea', {
    id: 'lu-gbook-input',
    rows: '3',
    maxlength: String(MAX_GUESTBOOK_TEXT),
    placeholder: '전시에 한 줄 메모를 남겨보세요…',
    spellcheck: 'false',
  });
  const count = el('span', { className: 'lu-gbook-count', text: `0/${MAX_GUESTBOOK_TEXT}` });
  const submitBtn = el('button', { id: 'lu-gbook-submit', type: 'button', text: '남기기' });
  submitBtn.disabled = true;
  const footerRow = el('div', { className: 'lu-gbook-footer-row' }, [count, submitBtn]);
  const statsLine = el('div', {
    id: 'lu-gbook-stats',
    style: 'font-size:11px;letter-spacing:0.04em;color:rgba(255,255,255,0.45);padding:6px 2px 0;',
  });
  const footer = el('div', { id: 'lu-guestbook-footer' }, [input, footerRow, statsLine]);

  // 책갈피 탭 — 패널이 닫혀 있어도 화면 왼쪽 가장자리에 살짝 나와 있고,
  // 패널의 자식이므로 열릴 때 패널과 함께 미끄러진다
  const tab = el('button', {
    id: 'lu-gbtab',
    type: 'button',
    'aria-label': '방명록 열기/닫기 (위아래로 드래그해 위치 이동)',
    title: '드래그해서 위치를 옮길 수 있어요',
    text: '방명록',
  });

  // ---- 탭 수직 드래그 이동 (위치는 localStorage에 기억) ----
  // 모바일에서 왼쪽 가장자리는 이동 조이스틱 영역과 겹칠 수 있어, 사용자가
  // 탭을 원하는 높이로 치울 수 있게 한다. 6px 미만 이동은 탭(열기)으로 처리.
  const GBTAB_TOP_KEY = 'lu-gbtab-top-v1';
  try {
    const saved = parseFloat(localStorage.getItem(GBTAB_TOP_KEY));
    if (Number.isFinite(saved)) tab.style.top = clampTabTop(saved) + 'px';
  } catch (_) { /* 무시 */ }

  function clampTabTop(px) {
    const max = Math.max(80, (window.innerHeight || 800) - 140);
    return Math.min(max, Math.max(60, px));
  }

  let tabDrag = null; // { startY, startTop, moved }
  tab.addEventListener('pointerdown', (e) => {
    const rect = tab.getBoundingClientRect();
    tabDrag = { startY: e.clientY, startTop: rect.top, moved: false };
    tab.setPointerCapture(e.pointerId);
  });
  tab.addEventListener('pointermove', (e) => {
    if (!tabDrag) return;
    const dy = e.clientY - tabDrag.startY;
    if (Math.abs(dy) > 6) tabDrag.moved = true;
    if (tabDrag.moved) tab.style.top = clampTabTop(tabDrag.startTop + dy) + 'px';
  });
  const endTabDrag = () => {
    if (tabDrag && tabDrag.moved) {
      try { localStorage.setItem(GBTAB_TOP_KEY, String(parseFloat(tab.style.top))); } catch (_) { /* 무시 */ }
    }
    // click 이벤트가 pointerup 뒤에 오므로, 드래그였다면 클릭 무시 플래그 유지
    setTimeout(() => { tabDrag = null; }, 0);
  };
  tab.addEventListener('pointerup', endTabDrag);
  tab.addEventListener('pointercancel', endTabDrag);
  tab.addEventListener('click', () => {
    if (tabDrag && tabDrag.moved) return; // 드래그로 끝난 제스처 — 열지 않음
    toggleGuestbook();
  });

  const panel = el('div', { id: 'lu-guestbook', className: 'lu' }, [head, body, footer, tab]);
  document.body.appendChild(panel);

  closeBtn.addEventListener('click', () => hideGuestbook());

  function updateCount() {
    const len = input.value.length;
    count.textContent = `${len}/${MAX_GUESTBOOK_TEXT}`;
    submitBtn.disabled = input.value.trim().length === 0;
  }

  function submit() {
    const text = input.value.trim().slice(0, MAX_GUESTBOOK_TEXT);
    if (!text) return;
    input.value = '';
    updateCount();
    input.blur();
    if (typeof onGuestbookSubmit === 'function') onGuestbookSubmit(text);
  }

  // 입력창 포커스 중 키 이벤트가 플레이어 조작(WASD/G 등)으로 전파되지 않도록 차단
  // (채팅 입력창과 동일 패턴)
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      input.value = '';
      updateCount();
      input.blur();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  input.addEventListener('keypress', (e) => e.stopPropagation());
  input.addEventListener('input', updateCount);

  submitBtn.addEventListener('click', submit);

  return { panel, body, input, count, submitBtn, tab };
}

function buildTourBar() {
  const prevBtn = el('button', { type: 'button', 'aria-label': '이전 작품', text: '◀ 이전' });
  const sep1 = el('span', { className: 'lu-tour-sep' });
  const countEl = el('span', { className: 'lu-tour-count' });
  const titleEl = el('span', { className: 'lu-tour-title' });
  const sep2 = el('span', { className: 'lu-tour-sep' });
  const nextBtn = el('button', { type: 'button', 'aria-label': '다음 작품', text: '다음 ▶' });
  const sep3 = el('span', { className: 'lu-tour-sep' });
  const autoBtn = el('button', { type: 'button', className: 'lu-tour-auto' });
  const sep4 = el('span', { className: 'lu-tour-sep' });
  const exitBtn = el('button', { id: 'lu-tourbar-exit', type: 'button', 'aria-label': '투어 종료', text: '✕ 종료' });

  const bar = el('div', { id: 'lu-tourbar', className: 'lu' }, [
    prevBtn, sep1, countEl, titleEl, sep2, nextBtn, sep3, autoBtn, sep4, exitBtn,
  ]);
  document.body.appendChild(bar);

  prevBtn.addEventListener('click', () => { if (tourHandlers.onPrev) tourHandlers.onPrev(); });
  nextBtn.addEventListener('click', () => { if (tourHandlers.onNext) tourHandlers.onNext(); });
  exitBtn.addEventListener('click', () => { if (tourHandlers.onExit) tourHandlers.onExit(); });
  autoBtn.addEventListener('click', () => { if (tourHandlers.onToggleAuto) tourHandlers.onToggleAuto(); });

  return { bar, prevBtn, nextBtn, autoBtn, exitBtn, countEl, titleEl };
}

// ---------------------------------------------------------------------------
// 셔터 플래시 — 포토 모드(P키) 캡처 순간 흰 화면 페이드
// ---------------------------------------------------------------------------
function buildShutter() {
  const overlay = el('div', { id: 'lu-shutter', className: 'lu' });
  document.body.appendChild(overlay);
  return overlay;
}

// ---------------------------------------------------------------------------
// 공유 모달 — 포토 모드로 캡처한 화면을 SNS(X/Threads)·기기 공유·저장·링크 복사
// ---------------------------------------------------------------------------
function buildShareModal() {
  const closeBtn = el('button', { id: 'lu-share-close', type: 'button', 'aria-label': '닫기', text: '×' });
  const title = el('div', { className: 'lu-share-title', text: '전시 공유하기' });
  const preview = el('img', { className: 'lu-share-preview', alt: '캡처한 전시 화면' });

  const deviceBtn = el('button', { className: 'lu-share-btn lu-share-btn-primary', type: 'button', text: '기기로 공유' });
  const saveBtn = el('button', { className: 'lu-share-btn', type: 'button', text: '이미지 저장' });
  const xBtn = el('button', { className: 'lu-share-btn', type: 'button', text: 'X에 공유' });
  const threadsBtn = el('button', { className: 'lu-share-btn', type: 'button', text: 'Threads에 공유' });
  const copyBtn = el('button', { className: 'lu-share-btn', type: 'button', text: '링크 복사' });

  const actions = el('div', { className: 'lu-share-actions' }, [deviceBtn, saveBtn, xBtn, threadsBtn, copyBtn]);
  const hint = el('div', {
    className: 'lu-share-hint',
    text: '인스타그램은 이미지를 저장하거나 기기로 공유한 뒤 앱에서 올려주세요',
  });

  const card = el('div', { className: 'lu-share-card' }, [closeBtn, title, preview, actions, hint]);
  const overlay = el('div', { id: 'lu-share', className: 'lu' }, [card]);
  document.body.appendChild(overlay);

  closeBtn.addEventListener('click', () => hideShareModal());
  // 카드 바깥(배경) 클릭 시 닫힘 — 카드 자체 클릭은 통과
  overlay.addEventListener('click', (e) => { if (e.target === overlay) hideShareModal(); });

  deviceBtn.addEventListener('click', async () => {
    if (!shareData.blob || typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    try {
      const file = new File([shareData.blob], 'artshow.png', { type: 'image/png' });
      await navigator.share({
        files: [file],
        title: shareData.galleryName || 'ARTSHOW',
        text: `${shareData.galleryName || 'ARTSHOW'} — ARTSHOW 3D 전시`,
      });
    } catch (_) {
      /* 사용자가 공유 시트를 취소한 경우 등 — 조용히 무시 */
    }
  });

  saveBtn.addEventListener('click', () => {
    if (!shareData.dataUrl) return;
    const a = document.createElement('a');
    a.href = shareData.dataUrl;
    a.download = 'artshow.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  xBtn.addEventListener('click', () => {
    const text = `${shareData.galleryName || 'ARTSHOW'} — ARTSHOW 3D 전시`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareData.shareUrl || '')}`;
    window.open(url, '_blank', 'noopener');
  });

  threadsBtn.addEventListener('click', () => {
    const text = `${shareData.galleryName || 'ARTSHOW'} — ARTSHOW 3D 전시 ${shareData.shareUrl || ''}`;
    const url = `https://www.threads.net/intent/post?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener');
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(shareData.shareUrl || '');
      if (shareCopyTimer) clearTimeout(shareCopyTimer);
      copyBtn.textContent = '복사됨';
      copyBtn.classList.add('lu-share-btn-copied');
      shareCopyTimer = setTimeout(() => {
        copyBtn.textContent = '링크 복사';
        copyBtn.classList.remove('lu-share-btn-copied');
        shareCopyTimer = null;
      }, 1600);
    } catch (_) {
      /* 클립보드 접근 실패(권한 등) — 조용히 무시 */
    }
  });

  return { overlay, card, title, preview, deviceBtn, saveBtn, xBtn, threadsBtn, copyBtn };
}

// ---------------------------------------------------------------------------
// 아바타 커스터마이저 모달 — Decentraland base-avatars 파츠(avatarkit.js)를
// 조합해 나만의 아바타를 만든다. 좌측 3D 라이브 프리뷰는 avatar.js의
// createAvatarInstance()를 그대로 재사용한다(중복 구현 최소화).
// ---------------------------------------------------------------------------
const MAKER_TABS = [
  { key: 'shape', label: '체형' },
  { key: 'hair', label: '헤어' },
  { key: 'top', label: '상의' },
  { key: 'bottom', label: '하의' },
  { key: 'feet', label: '신발' },
  { key: 'face', label: '얼굴' },
  { key: 'glasses', label: '안경' },
  { key: 'color', label: '색상' },
];
// look 필드 → manifest 카테고리 키 (avatarkit.js 내부 매핑과 동일 — 파츠 목록 조회용)
const MAKER_FIELD_CATEGORY = { hair: 'hair', top: 'upper_body', bottom: 'lower_body', feet: 'feet', glasses: 'eyewear' };
const MAKER_NULLABLE_FIELDS = new Set(['hair', 'glasses']);

function buildAvatarMaker() {
  const closeBtn = el('button', { id: 'lu-am-close', type: 'button', 'aria-label': '닫기', text: '×' });
  const title = el('div', { className: 'lu-am-title', text: '아바타 커스터마이저' });
  const head = el('div', { className: 'lu-am-head' }, [title, closeBtn]);

  // ---- 좌측: 3D 라이브 프리뷰 (자체 소형 렌더러 — 메인 씬과 독립) ----
  const canvas = el('canvas', { width: '300', height: '400' });
  const previewHint = el('div', { className: 'lu-am-preview-hint', text: '드래그해서 회전' });
  const previewBox = el('div', { className: 'lu-am-preview' }, [canvas, previewHint]);

  // WebGLRenderer/씬/카메라/조명은 커스터마이저를 처음 열 때(ensurePreviewRenderer())
  // 지연 생성한다 — initUI() 시점(로비 진입 전, 아직 필요 없을 수도 있는 시점)에
  // GL 컨텍스트를 미리 만들지 않는다(감독 지적). 이후 재오픈부터는 재사용.
  let previewRenderer = null;
  let previewScene = null;
  let previewCamera = null;
  let previewRotator = null; // 자동 회전/드래그 회전은 이 그룹만 돌린다

  function ensurePreviewRenderer() {
    if (previewRenderer) return;
    previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    previewRenderer.setPixelRatio(Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    previewRenderer.setSize(300, 400, false);
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewRenderer.toneMappingExposure = 1.1;
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color('#f2efe6');
    previewCamera = new THREE.PerspectiveCamera(28, 300 / 400, 0.1, 20);
    previewCamera.position.set(0, 1.15, 3.1);
    previewCamera.lookAt(0, 0.95, 0);

    // 따뜻한 조명 — 차가운 흰색 광원 금지(감독 진단: 기존 흰색 조명이 "시체" 인상에
    // 일조). 살짝 노란 키라이트 + 부드러운 웜 필라이트 + 웜 톤 헤미스피어 앰비언트.
    previewScene.add(new THREE.HemisphereLight(0xfff1d9, 0x2b1f14, 3.0));
    const previewKeyLight = new THREE.DirectionalLight(0xffd9a0, 3.0);
    previewKeyLight.position.set(1.4, 2.6, 2.0);
    previewScene.add(previewKeyLight);
    const previewFillLight = new THREE.DirectionalLight(0xffe8c8, 1.1);
    previewFillLight.position.set(-1.8, 1.1, 1.6);
    previewScene.add(previewFillLight);

    previewRotator = new THREE.Group();
    previewScene.add(previewRotator);
  }

  // ---- 우측: 탭 + 탭 페이지 ----
  const tabsRow = el('div', { className: 'lu-am-tabs' });
  const tabButtons = new Map();
  const tabPage = el('div', { className: 'lu-am-tabpage' });
  MAKER_TABS.forEach((tab) => {
    const btn = el('button', {
      type: 'button',
      className: 'lu-am-tab' + (tab.key === makerActiveTab ? ' lu-selected' : ''),
      text: tab.label,
    });
    btn.addEventListener('click', () => setActiveTab(tab.key));
    tabButtons.set(tab.key, btn);
    tabsRow.appendChild(btn);
  });
  const panel = el('div', { className: 'lu-am-panel' }, [tabsRow, tabPage]);

  const body = el('div', { className: 'lu-am-body' }, [previewBox, panel]);

  const saveBtn = el('button', { className: 'lu-am-btn lu-am-btn-primary', type: 'button', text: '저장하고 사용' });
  const closeBtn2 = el('button', { className: 'lu-am-btn', type: 'button', text: '닫기' });
  const footer = el('div', { className: 'lu-am-footer' }, [closeBtn2, saveBtn]);

  const card = el('div', { className: 'lu-am-card' }, [head, body, footer]);
  const overlay = el('div', { id: 'lu-avatar-maker', className: 'lu' }, [card]);
  document.body.appendChild(overlay);

  closeBtn.addEventListener('click', () => closeAvatarMaker());
  closeBtn2.addEventListener('click', () => closeAvatarMaker());
  // 카드 바깥(배경) 클릭 시 닫힘 — 카드 자체 클릭은 통과
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAvatarMaker(); });

  saveBtn.addEventListener('click', () => {
    if (!makerLook) return;
    saveStoredLook(makerLook);
    try {
      if (previewRenderer) {
        // 스냅샷 직전에 동기 렌더 — WebGLRenderer는 preserveDrawingBuffer:false라
        // 직전 rAF 프레임의 드로잉 버퍼가 합성 후 비워져, 클릭 핸들러 시점의
        // toDataURL()이 빈(투명) 이미지를 반환할 수 있다. 같은 태스크 안에서 다시
        // 그린 직후 읽으면 실제 아바타가 담긴다.
        previewRenderer.render(previewScene, previewCamera);
        saveStoredLookThumb(previewRenderer.domElement.toDataURL('image/png'));
      }
    } catch (_) {
      /* 캔버스 오염 등 — 썸네일 스냅샷 실패는 조용히 무시(저장 자체는 계속 진행) */
    }
    if (els && els.lobby) els.lobby.onCustomLookSaved();
    closeAvatarMaker();
  });

  // ---- 파츠 썸네일 그리드 ----
  function thumbButton(categoryKey, item, selectedId, onPick) {
    const isNone = item.id === null;
    const btn = el('button', {
      type: 'button',
      className: 'lu-am-thumb' + (item.id === selectedId ? ' lu-selected' : ''),
      title: item.name || (isNone ? '없음' : item.id),
    });
    if (isNone) {
      btn.appendChild(el('span', { className: 'lu-am-thumb-none', text: '없음' }));
    } else if (item.thumb) {
      const img = el('img', {
        src: `${DCL_BASE}/${categoryKey}/${item.id}/${item.thumb}`,
        alt: item.name || item.id,
        loading: 'lazy',
      });
      img.addEventListener(
        'error',
        () => {
          img.remove();
          btn.insertBefore(
            el('span', { className: 'lu-am-thumb-none', text: (item.name || item.id).slice(0, 2) }),
            btn.firstChild
          );
        },
        { once: true }
      );
      btn.appendChild(img);
    } else {
      btn.appendChild(el('span', { className: 'lu-am-thumb-none', text: (item.name || item.id).slice(0, 2) }));
    }
    btn.appendChild(el('span', { className: 'lu-am-thumb-label', text: isNone ? '없음' : item.name || item.id }));
    btn.addEventListener('click', () => onPick(item.id));
    return btn;
  }

  function renderPartGrid(container, categoryKey, field) {
    const list = (makerManifest && makerManifest.categories && makerManifest.categories[categoryKey]) || [];
    const supported = list.filter((it) => it.models && it.models[makerLook.shape]);
    const grid = el('div', { className: 'lu-am-grid' });
    if (MAKER_NULLABLE_FIELDS.has(field)) {
      grid.appendChild(thumbButton(categoryKey, { id: null, name: '없음' }, makerLook[field], (id) => pickField(field, id)));
    }
    supported.forEach((item) => grid.appendChild(thumbButton(categoryKey, item, makerLook[field], (id) => pickField(field, id))));
    container.appendChild(grid);
  }

  // encodeLook()→decodeLook() 왕복으로 avatarkit.js의 정규화/체형-미지원 폴백 로직을
  // 그대로 재사용한다(파츠 id 유효성 검사 등을 ui.js에 중복 구현하지 않는다).
  function normalizeMakerLook() {
    makerLook = decodeLook(encodeLook(makerLook)) || Object.assign({}, DEFAULT_LOOK);
  }

  function pickField(field, id) {
    if (!makerLook) return;
    makerLook[field] = id;
    normalizeMakerLook();
    scheduleRebuildPreview();
    renderActiveTab();
  }

  function pickShape(shape) {
    if (!makerLook || makerLook.shape === shape) return;
    makerLook.shape = shape;
    normalizeMakerLook(); // 체형 미지원 파츠는 여기서 기본값으로 자동 대체됨
    scheduleRebuildPreview();
    renderActiveTab();
  }

  function renderShapeTab() {
    const list = (makerManifest && makerManifest.categories && makerManifest.categories.body_shape) || [];
    const grid = el('div', { className: 'lu-am-grid' });
    list.forEach((item) => {
      const shape = item.models && item.models.male ? 'male' : 'female';
      grid.appendChild(thumbButton('body_shape', item, makerLook.shape === shape ? shape : null, () => pickShape(shape)));
    });
    tabPage.appendChild(grid);
  }

  function renderFaceTab() {
    [
      ['눈', 'eyes', 'eyes'],
      ['눈썹', 'eyebrows', 'brows'],
      ['입', 'mouth', 'mouth'],
    ].forEach(([label, categoryKey, field]) => {
      tabPage.appendChild(el('div', { className: 'lu-am-section-title', text: label }));
      renderPartGrid(tabPage, categoryKey, field);
    });
  }

  function renderColorTab() {
    tabPage.appendChild(el('div', { className: 'lu-am-section-title', text: '피부색' }));
    const skinRow = el('div', { className: 'lu-swatches' });
    SKIN_TONES.forEach((hex) => {
      const swatch = el('button', {
        type: 'button',
        className: 'lu-swatch' + (makerLook.skin === hex ? ' lu-selected' : ''),
        style: `background:${hex};`,
        title: hex,
        'aria-label': `피부색 ${hex}`,
      });
      swatch.addEventListener('click', () => {
        makerLook.skin = hex;
        normalizeMakerLook();
        scheduleRebuildPreview();
        renderActiveTab();
      });
      skinRow.appendChild(swatch);
    });
    tabPage.appendChild(skinRow);

    tabPage.appendChild(el('div', { className: 'lu-am-section-title', text: '머리 색' }));
    const hairRow = el('div', { className: 'lu-swatches' });
    HAIR_COLORS.forEach((hex) => {
      const swatch = el('button', {
        type: 'button',
        className: 'lu-swatch' + (makerLook.hairColor === hex ? ' lu-selected' : ''),
        style: `background:${hex};`,
        title: hex,
        'aria-label': `머리색 ${hex}`,
      });
      swatch.addEventListener('click', () => {
        makerLook.hairColor = hex;
        normalizeMakerLook();
        scheduleRebuildPreview();
        renderActiveTab();
      });
      hairRow.appendChild(swatch);
    });
    tabPage.appendChild(hairRow);

    tabPage.appendChild(el('div', { className: 'lu-am-section-title', text: '눈동자 색' }));
    const eyeRow = el('div', { className: 'lu-swatches' });
    EYE_COLORS.forEach((hex) => {
      const swatch = el('button', {
        type: 'button',
        className: 'lu-swatch' + (makerLook.eyeColor === hex ? ' lu-selected' : ''),
        style: `background:${hex};`,
        title: hex,
        'aria-label': `눈동자 색 ${hex}`,
      });
      swatch.addEventListener('click', () => {
        makerLook.eyeColor = hex;
        normalizeMakerLook();
        scheduleRebuildPreview();
        renderActiveTab();
      });
      eyeRow.appendChild(swatch);
    });
    tabPage.appendChild(eyeRow);

    tabPage.appendChild(el('div', { className: 'lu-am-section-title', text: '귀여움' }));
    const cuteLabel = el('div', { className: 'lu-am-cute-label' }, [
      el('span', { text: '진지함' }),
      el('b', { text: `${Math.round(makerLook.cute * 100)}%` }),
      el('span', { text: '귀여움' }),
    ]);
    const cuteInput = el('input', {
      id: 'lu-am-cute',
      type: 'range',
      min: '0',
      max: '100',
      step: '1',
      value: String(Math.round(makerLook.cute * 100)),
    });
    cuteInput.addEventListener('input', () => {
      makerLook.cute = Number(cuteInput.value) / 100;
      cuteLabel.querySelector('b').textContent = `${cuteInput.value}%`;
      scheduleRebuildPreview(); // 슬라이더 드래그 중에는 탭을 재렌더하지 않는다(포커스 유지)
    });
    cuteInput.addEventListener('keydown', (e) => e.stopPropagation());
    tabPage.appendChild(el('div', { className: 'lu-am-cute-row' }, [cuteLabel, cuteInput]));
  }

  function renderActiveTab() {
    tabPage.textContent = '';
    if (!makerLook || !makerManifest) return;
    tabButtons.forEach((btn, key) => btn.classList.toggle('lu-selected', key === makerActiveTab));
    if (makerActiveTab === 'shape') renderShapeTab();
    else if (makerActiveTab === 'face') renderFaceTab();
    else if (makerActiveTab === 'color') renderColorTab();
    else renderPartGrid(tabPage, MAKER_FIELD_CATEGORY[makerActiveTab], makerActiveTab);
  }

  function setActiveTab(key) {
    makerActiveTab = key;
    renderActiveTab();
  }

  // ---- 프리뷰 조립/재조립 — 파츠 변경 300ms 디바운스 후 dispose→재조립 ----
  function rebuildPreview() {
    if (!makerLook || !previewRotator) return; // 렌더러가 아직 지연 생성 전이면 스킵
    if (makerPreviewInstance) {
      previewRotator.remove(makerPreviewInstance.group);
      makerPreviewInstance.dispose();
      makerPreviewInstance = null;
    }
    makerPreviewInstance = createAvatarInstance(encodeLook(makerLook), GOLD, ' ');
    previewRotator.add(makerPreviewInstance.group);
  }

  function scheduleRebuildPreview() {
    if (makerRebuildTimer) clearTimeout(makerRebuildTimer);
    makerRebuildTimer = setTimeout(() => {
      makerRebuildTimer = null;
      rebuildPreview();
    }, 300);
  }

  // ---- 렌더 루프: 느린 자동 회전 + idle 애니메이션(speed=0) ----
  function previewFrame(t) {
    makerPreviewRAF = requestAnimationFrame(previewFrame);
    const delta = makerPreviewLastT ? Math.min(0.05, (t - makerPreviewLastT) / 1000) : 0;
    makerPreviewLastT = t;
    if (!makerDragging) previewRotator.rotation.y += delta * 0.35;
    if (makerPreviewInstance) makerPreviewInstance.update(delta, 0); // speed 0 → idle 블렌드
    previewRenderer.render(previewScene, previewCamera);
  }
  function startPreviewLoop() {
    if (makerPreviewRAF) return;
    makerPreviewLastT = 0;
    makerPreviewRAF = requestAnimationFrame(previewFrame);
  }
  function stopPreviewLoop() {
    if (makerPreviewRAF) cancelAnimationFrame(makerPreviewRAF);
    makerPreviewRAF = null;
  }

  // ---- 드래그 회전 (자동 회전은 드래그 중 일시정지) ----
  canvas.addEventListener('pointerdown', (e) => {
    makerDragging = true;
    makerDragLastX = e.clientX;
    previewBox.classList.add('lu-dragging');
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!makerDragging || !previewRotator) return;
    const dx = e.clientX - makerDragLastX;
    makerDragLastX = e.clientX;
    previewRotator.rotation.y += dx * 0.012;
  });
  function endDrag() {
    makerDragging = false;
    previewBox.classList.remove('lu-dragging');
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', endDrag);

  async function open() {
    makerOpen = true;
    ensurePreviewRenderer(); // 첫 오픈 시점에 지연 생성(이후 재오픈부터는 재사용)
    overlay.classList.add('lu-open');
    startPreviewLoop();
    tabPage.textContent = '';
    const manifest = await loadPartsManifest().catch((err) => {
      console.warn('DCL 파츠 manifest 로드 실패:', err);
      return null;
    });
    if (!makerOpen) return; // 로딩 중 모달이 닫힌 경우
    makerManifest = manifest;
    const stored = readStoredLook();
    makerLook = Object.assign({}, DEFAULT_LOOK, stored || {});
    normalizeMakerLook();
    makerActiveTab = 'shape';
    renderActiveTab();
    rebuildPreview();
  }

  function close() {
    if (!makerOpen) return;
    makerOpen = false;
    overlay.classList.remove('lu-open');
    stopPreviewLoop();
    if (makerRebuildTimer) { clearTimeout(makerRebuildTimer); makerRebuildTimer = null; }
    if (makerPreviewInstance) {
      if (previewRotator) previewRotator.remove(makerPreviewInstance.group);
      makerPreviewInstance.dispose();
      makerPreviewInstance = null;
    }
  }

  return { overlay, card, open, close };
}

// 로비의 커스텀 버튼/꾸미기 링크가 호출하는 진입점 — 실제 열기/닫기는

// ---------------------------------------------------------------------------
// 치비 메이커 모달 — chibi.js(자체 코드 생성기)의 파라미터를 칩/스와치로 편집.
// DCL 커스터마이저와 동일한 모달 CSS(lu-am-*)를 재사용하되 탭 없이 한 화면이다.
// 프리뷰는 createAvatarInstance('chibi:'+JSON)를 그대로 재사용한다.
// ---------------------------------------------------------------------------
const CHIBI_CLOTH_COLORS = [
  '#ff8fab', '#ffd166', '#7ec4cf', '#95d5b2', '#5468c4',
  '#b799ff', '#fffdf7', '#3a3f4a', '#e0596e', '#d96c2c',
];

function buildChibiMaker() {
  const closeX = el('button', { id: 'lu-am-close', type: 'button', 'aria-label': '닫기', text: '×' });
  const title = el('div', { className: 'lu-am-title', text: '치비 만들기' });
  const head = el('div', { className: 'lu-am-head' }, [title, closeX]);

  const canvas = el('canvas', { width: '300', height: '400' });
  const previewHint = el('div', { className: 'lu-am-preview-hint', text: '드래그해서 회전' });
  const previewBox = el('div', { className: 'lu-am-preview' }, [canvas, previewHint]);

  let previewRenderer = null;
  let previewScene = null;
  let previewCamera = null;
  let previewRotator = null;

  function ensurePreviewRenderer() {
    if (previewRenderer) return;
    previewRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    previewRenderer.setPixelRatio(Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1));
    previewRenderer.setSize(300, 400, false);
    previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewRenderer.toneMappingExposure = 1.1;
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color('#f6f1e3');
    // 치비 신장(~1.34m)에 맞춘 근접 프레이밍 — DCL 프리뷰(1.8m)보다 낮고 가깝다
    previewCamera = new THREE.PerspectiveCamera(30, 300 / 400, 0.1, 20);
    previewCamera.position.set(0, 0.82, 2.35);
    previewCamera.lookAt(0, 0.7, 0);
    previewScene.add(new THREE.HemisphereLight(0xfff1d9, 0x2b1f14, 3.0));
    const key = new THREE.DirectionalLight(0xffd9a0, 3.0);
    key.position.set(1.4, 2.6, 2.0);
    previewScene.add(key);
    const fill = new THREE.DirectionalLight(0xffe8c8, 1.1);
    fill.position.set(-1.8, 1.1, 1.6);
    previewScene.add(fill);
    previewRotator = new THREE.Group();
    previewScene.add(previewRotator);
  }

  const panel = el('div', { className: 'lu-am-panel' });
  const page = el('div', { className: 'lu-am-tabpage' });
  panel.appendChild(page);
  const body = el('div', { className: 'lu-am-body' }, [previewBox, panel]);

  const saveBtn = el('button', { className: 'lu-am-btn lu-am-btn-primary', type: 'button', text: '저장하고 사용' });
  const closeBtn = el('button', { className: 'lu-am-btn', type: 'button', text: '닫기' });
  const footer = el('div', { className: 'lu-am-footer' }, [closeBtn, saveBtn]);
  const card = el('div', { className: 'lu-am-card' }, [head, body, footer]);
  const overlay = el('div', { id: 'lu-chibi-maker', className: 'lu' }, [card]);
  document.body.appendChild(overlay);

  function setParam(key, value) {
    if (!chibiParams) return;
    chibiParams[key] = value;
    chibiParams = normalizeChibi(chibiParams);
    rebuildPreview();
    renderPanel();
  }

  function chipRow(labelText, options, key) {
    page.appendChild(el('div', { className: 'lu-am-section-title', text: labelText }));
    const row = el('div', { className: 'lu-am-tabs' });
    options.forEach((opt) => {
      const btn = el('button', {
        type: 'button',
        className: 'lu-am-tab' + (chibiParams[key] === opt.id ? ' lu-selected' : ''),
        text: opt.name,
      });
      btn.addEventListener('click', () => setParam(key, opt.id));
      row.appendChild(btn);
    });
    page.appendChild(row);
  }

  function swatchRow(labelText, palette, key) {
    page.appendChild(el('div', { className: 'lu-am-section-title', text: labelText }));
    const row = el('div', { className: 'lu-swatches' });
    palette.forEach((hex) => {
      const swatch = el('button', {
        type: 'button',
        className: 'lu-swatch' + (chibiParams[key] === hex ? ' lu-selected' : ''),
        style: `background:${hex};`,
        title: hex,
        'aria-label': `${labelText} ${hex}`,
      });
      swatch.addEventListener('click', () => setParam(key, hex));
      row.appendChild(swatch);
    });
    page.appendChild(row);
  }

  function renderPanel() {
    page.textContent = '';
    if (!chibiParams) return;
    chipRow('헤어', CHIBI_HAIR_STYLES, 'hairStyle');
    chipRow('눈', CHIBI_EYE_STYLES, 'eyeStyle');
    chipRow('입', CHIBI_MOUTH_STYLES, 'mouth');
    chipRow('볼터치', [{ id: true, name: '있음' }, { id: false, name: '없음' }], 'blush');
    chipRow('하의', CHIBI_BOTTOM_TYPES, 'bottomType');
    chipRow('액세서리', CHIBI_ACCESSORIES, 'acc');
    swatchRow('피부색', SKIN_TONES, 'skin');
    swatchRow('머리 색', HAIR_COLORS, 'hairColor');
    swatchRow('눈동자 색', EYE_COLORS, 'eyeColor');
    swatchRow('상의 색', CHIBI_CLOTH_COLORS, 'top');
    swatchRow('하의 색', CHIBI_CLOTH_COLORS, 'bottom');
    swatchRow('신발 색', CHIBI_CLOTH_COLORS, 'shoes');
  }

  // 치비 조립은 동기·저비용이라 디바운스 없이 즉시 재조립한다
  function rebuildPreview() {
    if (!chibiParams || !previewRotator) return;
    if (chibiPreviewInstance) {
      previewRotator.remove(chibiPreviewInstance.group);
      chibiPreviewInstance.dispose();
      chibiPreviewInstance = null;
    }
    chibiPreviewInstance = createAvatarInstance(encodeChibi(chibiParams), GOLD, ' ');
    previewRotator.add(chibiPreviewInstance.group);
  }

  function previewFrame(t) {
    chibiPreviewRAF = requestAnimationFrame(previewFrame);
    const delta = chibiPreviewLastT ? Math.min(0.05, (t - chibiPreviewLastT) / 1000) : 0;
    chibiPreviewLastT = t;
    if (!chibiDragging) previewRotator.rotation.y += delta * 0.35;
    if (chibiPreviewInstance) chibiPreviewInstance.update(delta, 0);
    previewRenderer.render(previewScene, previewCamera);
  }
  function startLoop() {
    if (chibiPreviewRAF) return;
    chibiPreviewLastT = 0;
    chibiPreviewRAF = requestAnimationFrame(previewFrame);
  }
  function stopLoop() {
    if (chibiPreviewRAF) cancelAnimationFrame(chibiPreviewRAF);
    chibiPreviewRAF = null;
  }

  // 드래그 회전 — 포인터 캡처로 카드 밖 드래그도 추적
  canvas.addEventListener('pointerdown', (e) => {
    chibiDragging = true;
    chibiDragLastX = e.clientX;
    previewBox.classList.add('lu-dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!chibiDragging) return;
    previewRotator.rotation.y += (e.clientX - chibiDragLastX) * 0.012;
    chibiDragLastX = e.clientX;
  });
  const endDrag = () => {
    chibiDragging = false;
    previewBox.classList.remove('lu-dragging');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  closeX.addEventListener('click', () => closeChibiMaker());
  closeBtn.addEventListener('click', () => closeChibiMaker());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeChibiMaker(); });

  saveBtn.addEventListener('click', () => {
    if (!chibiParams) return;
    saveStoredChibi(chibiParams);
    try {
      if (previewRenderer) {
        // preserveDrawingBuffer:false 대응 — 같은 태스크 안에서 렌더 직후 스냅샷
        previewRenderer.render(previewScene, previewCamera);
        saveStoredChibiThumb(previewRenderer.domElement.toDataURL('image/png'));
      }
    } catch (_) {
      /* 스냅샷 실패는 무시 — 저장 자체는 진행 */
    }
    if (els && els.lobby) els.lobby.onChibiSaved();
    closeChibiMaker();
  });

  function open() {
    chibiParams = normalizeChibi(Object.assign({}, DEFAULT_CHIBI, readStoredChibi() || {}));
    ensurePreviewRenderer();
    previewRotator.rotation.y = 0;
    rebuildPreview();
    renderPanel();
    overlay.classList.add('lu-open');
    chibiOpen = true;
    startLoop();
  }
  function close() {
    overlay.classList.remove('lu-open');
    chibiOpen = false;
    stopLoop();
    if (chibiPreviewInstance) {
      previewRotator.remove(chibiPreviewInstance.group);
      chibiPreviewInstance.dispose();
      chibiPreviewInstance = null;
    }
  }
  return { open, close };
}

function openChibiMaker() {
  if (els && els.chibiMaker) els.chibiMaker.open();
}
function closeChibiMaker() {
  if (els && els.chibiMaker) els.chibiMaker.close();
}

// buildAvatarMaker()가 반환한 open()/close()에 위임한다.
function openAvatarMaker() {
  if (els && els.avatarMaker) els.avatarMaker.open();
}
function closeAvatarMaker() {
  if (els && els.avatarMaker) els.avatarMaker.close();
}

// ---------------------------------------------------------------------------
// 전역 키 핸들러 — Enter로 채팅 입력창 포커스, ESC 우선순위 처리
// ---------------------------------------------------------------------------
// ESC 우선순위 규약:
//   ① 아바타 커스터마이저 모달이 열려 있으면 커스터마이저 모달만 닫는다
//   ② (커스터마이저가 닫혀 있고) 공유 모달이 열려 있으면 공유 모달만 닫는다
//   ③ (위 둘이 닫혀 있고) 라이트박스가 열려 있으면 라이트박스만 닫는다
//   ④ (위 셋이 닫혀 있고) 작품 목록이 열려 있으면 작품 목록만 닫는다
//   ⑤ (위 넷이 닫혀 있고) 방명록이 열려 있으면 방명록만 닫는다
//   ⑥ 다섯 다 닫혀 있으면 ui.js는 아무것도 하지 않는다 (투어 종료는 main.js 담당)
// 채팅/방명록 입력창 포커스 중 ESC는 입력창 자체 keydown 핸들러가 stopPropagation하므로
// 이 전역 핸들러까지 도달하지 않는다 (기존 동작 유지).
function bindGlobalKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (chibiOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeChibiMaker();
        return;
      }
      if (makerOpen) {
        e.preventDefault();
        // ui.js 리스너는 main.js보다 먼저 등록되므로 여기서 멈추면
        // 같은 ESC가 main.js의 투어-종료 리스너까지 도달하지 않는다 (ESC=한 동작).
        e.stopImmediatePropagation();
        closeAvatarMaker();
        return;
      }
      if (shareModalOpen) {
        e.preventDefault();
        // ui.js 리스너는 main.js보다 먼저 등록되므로 여기서 멈추면
        // 같은 ESC가 main.js의 투어-종료 리스너까지 도달하지 않는다 (ESC=한 동작).
        e.stopImmediatePropagation();
        hideShareModal();
        return;
      }
      if (lightboxOpen) {
        e.preventDefault();
        // 같은 ESC가 main.js의 투어-종료 리스너까지 도달해 라이트박스 닫기 +
        // 투어 종료가 한 번에 일어나는 것을 막는다 (ESC=한 동작). ui.js 리스너는
        // main.js보다 먼저 등록되므로 여기서 멈추면 main.js는 이 ESC를 못 받는다.
        e.stopImmediatePropagation();
        hideLightbox();
        return;
      }
      if (artworkListOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        hideArtworkList();
        return;
      }
      if (guestbookOpen) {
        e.preventDefault();
        e.stopImmediatePropagation();
        hideGuestbook();
        return;
      }
      return;
    }
    // 라이트박스/공유 모달/커스터마이저 모달이 열려 있는 동안에는 Enter(채팅 포커스) 등
    // 다른 전역 키를 막는다 — 오버레이에 가려진 채팅 입력창이 포커스되는 혼란을 방지.
    if (lightboxOpen || shareModalOpen || makerOpen) return;
    if (!entered) return;
    const active = document.activeElement;
    const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (typing) return; // 입력 중이면 각 input의 자체 핸들러가 처리
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      els.chat.input.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initUI({ onEnter, onChatSend } = {}) {
  if (initialized) {
    callbacks.onEnter = onEnter || callbacks.onEnter;
    callbacks.onChatSend = onChatSend || callbacks.onChatSend;
    return;
  }
  initialized = true;
  callbacks.onEnter = onEnter || null;
  callbacks.onChatSend = onChatSend || null;

  injectStyles();

  els = {
    loading: buildLoading(),
    lobby: buildLobby(),
    controls: buildControls(),
    topRight: buildTopRight(),
    status: buildStatus(),
    chat: buildChat(),
    artwork: buildArtworkPanel(),
    galleryTitle: buildGalleryTitle(),
    lightbox: buildLightbox(),
    artworkList: buildArtworkList(),
    guestbook: buildGuestbookPanel(),
    tourBar: buildTourBar(),
    dock: buildMobileDock(),
    shutter: buildShutter(),
    share: buildShareModal(),
    avatarMaker: buildAvatarMaker(),
    chibiMaker: buildChibiMaker(),
  };
  // 접속자 수 표시는 상단 통합 바 소속 — setPlayerCount가 쓰는 참조를 연결
  els.topRight.count = els.galleryTitle._count;
  els.topRight.countWrap = els.galleryTitle._countWrap;

  bindGlobalKeys();
  // 커스터마이저를 열기 전에 미리 워밍업 — 첫 오픈 시 탭이 빈 상태로 잠깐 보이는 것을 줄인다.
  loadPartsManifest().catch(() => { /* 실패해도 openAvatarMaker()가 재시도 + 콘솔 경고 */ });

  // initUI() 호출 이전에 대기 중이던 값이 있으면 지금 적용한다.
  if (pendingGalleryTitle !== null) applyGalleryTitle(pendingGalleryTitle);
  if (pendingPicker) applyGalleryPicker(pendingPicker.galleries, pendingPicker.currentId, pendingPicker.onPick);
  if (pendingArtworkList) renderArtworkList(pendingArtworkList);
  if (pendingGuestbookNotes) renderGuestbookNotes(pendingGuestbookNotes);
}

export function showLoading(show) {
  if (!els) return;
  els.loading.classList.toggle('lu-hidden', !show);
}

export function hideLobby() {
  if (!els) return;
  entered = true;
  els.lobby.overlay.classList.add('lu-hidden');
  // HUD 표시
  els.controls.classList.add('lu-visible');
  els.topRight.wrap.classList.add('lu-visible');
  els.status.classList.add('lu-visible');
  els.chat.wrap.classList.add('lu-visible');
  els.galleryTitle.classList.add('lu-visible');
  els.guestbook.tab.classList.add('lu-visible');
  // [P0] 모바일 독·조작법 토글 — 이 두 줄이 빠져 실기기에서 독이 투명+터치불가로
  // 죽어 있었다 (UX 감사에서 발견). dock은 데스크톱에서 null이므로 가드.
  if (els.dock) els.dock.classList.add('lu-visible');
  const controlsToggle = document.getElementById('lu-controls-toggle');
  if (controlsToggle) controlsToggle.classList.add('lu-visible');
}

export function showArtworkInfo(art) {
  if (!els || !art) return;
  if (currentArtworkId === art.id && els.artwork.panel.classList.contains('lu-open')) {
    return; // 같은 작품이면 재렌더 생략
  }
  currentArtworkId = art.id;
  els.artwork.title.textContent = art.title || '';
  els.artwork.meta.textContent = [art.artist, art.year].filter(Boolean).join(' · ');
  els.artwork.desc.textContent = art.desc || '';
  els.artwork.panel.classList.add('lu-open');
}

export function hideArtworkInfo() {
  if (!els) return;
  currentArtworkId = null;
  els.artwork.panel.classList.remove('lu-open');
}

export function addChatMessage(name, text, isSelf) {
  if (!els) return;
  const msg = el('div', { className: 'lu-chat-msg' + (isSelf ? ' lu-self' : '') }, [
    el('span', { className: 'lu-chat-name', text: name }),
    el('span', { text: text }),
  ]);
  els.chat.log.appendChild(msg);
  while (els.chat.log.children.length > MAX_CHAT_MESSAGES) {
    els.chat.log.removeChild(els.chat.log.firstChild);
  }
}

export function setPlayerCount(n) {
  if (!els) return;
  const prev = els.topRight.count.textContent;
  els.topRight.count.textContent = String(n);
  // 숫자 변화에 스프링 틱 — 살아있는 게이지처럼
  if (prev !== String(n) && els.topRight.countWrap) {
    els.topRight.countWrap.classList.remove('lu-tick');
    void els.topRight.countWrap.offsetWidth;
    els.topRight.countWrap.classList.add('lu-tick');
  }
  // 접속자 ≥2일 때만 독에 채팅 버튼 노출 (혼자일 땐 인지 부하 절감 — UX 감사 §2)
  if (dockRefs && dockRefs.chatWrap) dockRefs.chatWrap.style.display = n >= 2 ? '' : 'none';
}

export function setStatus(text) {
  if (!els) return;
  els.status.textContent = text || '';
}

export function setFPS(n) {
  if (!els) return;
  els.topRight.fps.textContent = String(Math.round(n));
}

// ---------------------------------------------------------------------------
// 전시 제목
// ---------------------------------------------------------------------------

function applyGalleryTitle(name) {
  els.galleryTitle.querySelector('.lu-topbar-title').textContent = name || '';
  els.galleryTitle.classList.toggle('lu-empty', !name);
}

export function setGalleryTitle(name) {
  pendingGalleryTitle = name || '';
  if (!els) return; // initUI() 호출 시 pendingGalleryTitle이 적용됨
  applyGalleryTitle(pendingGalleryTitle);
}

// ---------------------------------------------------------------------------
// 전시 디렉터리 (로비 내 전시 선택)
// ---------------------------------------------------------------------------

function applyGalleryPicker(galleries, currentId, onPick) {
  const box = els.lobby.pickerBox;
  box.innerHTML = '';
  if (!Array.isArray(galleries) || galleries.length === 0) return;

  const label = el('div', {
    className: 'lu-field-label',
    text: '전시 선택',
    style: 'margin-top:26px;',
  });
  box.appendChild(label);

  if (currentId === null || currentId === undefined) {
    box.appendChild(el('div', { className: 'lu-picker-note', text: '공유된 전시 관람 중' }));
  }

  const list = el('div', { className: 'lu-picker-list' });
  galleries.forEach((g) => {
    const isCurrent = g.id === currentId;
    const item = el('button', {
      type: 'button',
      className: 'lu-picker-item' + (isCurrent ? ' lu-picker-current' : ''),
    }, [
      el('div', { className: 'lu-picker-name', text: g.name || g.id }),
      el('div', {
        className: 'lu-picker-meta',
        text: [g.artist, typeof g.count === 'number' ? `${g.count}점` : null]
          .filter(Boolean).join(' · '),
      }),
    ]);
    if (isCurrent) item.disabled = true;
    item.addEventListener('click', () => {
      if (isCurrent) return;
      if (typeof onPick === 'function') onPick(g.id);
    });
    list.appendChild(item);
  });
  box.appendChild(list);
}

export function initGalleryPicker(galleries, currentId, onPick) {
  pendingPicker = { galleries, currentId: currentId ?? null, onPick };
  if (!els) return; // initUI() 호출 시 pendingPicker가 적용됨
  applyGalleryPicker(pendingPicker.galleries, pendingPicker.currentId, pendingPicker.onPick);
}

// ---------------------------------------------------------------------------
// 라이트박스 — 작품 확대 감상
// ---------------------------------------------------------------------------

function clearLightboxMedia() {
  const stage = els.lightbox.stage;
  const media = stage.firstChild;
  if (media && media.tagName === 'VIDEO') {
    media.pause();
    media.removeAttribute('src');
    media.load();
  }
  stage.innerHTML = '';
}

export function showLightbox(art) {
  if (!els || !art) return;
  lightboxCurrentArt = art;
  if (els.lightbox.resetZoom) els.lightbox.resetZoom();
  if (lightboxCloseTimer) {
    clearTimeout(lightboxCloseTimer);
    lightboxCloseTimer = null;
  }

  clearLightboxMedia();

  let media;
  if (art.videoUrl) {
    media = el('video', {
      className: 'lu-lightbox-media',
      src: art.videoUrl,
      controls: 'controls',
      autoplay: 'autoplay',
      loop: 'loop',
      muted: 'muted',
      playsinline: 'playsinline',
    });
    media.muted = true; // 일부 브라우저는 속성만으로 부족
  } else {
    media = el('img', {
      className: 'lu-lightbox-media',
      src: art.imageUrl || '',
      alt: art.title || '',
    });
  }
  els.lightbox.stage.appendChild(media);

  els.lightbox.title.textContent = art.title || '';
  els.lightbox.meta.textContent = [art.artist, art.year].filter(Boolean).join(' · ');
  els.lightbox.desc.textContent = art.desc || '';

  lightboxOpen = true;
  els.lightbox.overlay.classList.add('lu-open');
}

export function hideLightbox() {
  if (!els || !lightboxOpen) return;
  lightboxOpen = false;
  els.lightbox.overlay.classList.remove('lu-open');

  // 페이드 아웃(0.32s)이 끝난 뒤 미디어를 정리해 영상 재생/오디오 로드를 멈춘다.
  if (lightboxCloseTimer) clearTimeout(lightboxCloseTimer);
  lightboxCloseTimer = setTimeout(() => {
    clearLightboxMedia();
    lightboxCloseTimer = null;
  }, 340);

  if (typeof onLightboxClose === 'function') onLightboxClose();
}

export function isLightboxOpen() {
  return lightboxOpen;
}

export function setOnLightboxClose(cb) {
  onLightboxClose = typeof cb === 'function' ? cb : null;
}

// ---------------------------------------------------------------------------
// 작품 목록 패널 — M 키(또는 HUD 버튼)로 열어 작품을 골라 텔레포트
// ---------------------------------------------------------------------------

// artworks: getPlacedArtworks()가 반환하는 작품 배열. onSelect(art)는 카드 클릭 시
// (패널이 자동으로 닫힌 뒤) 호출된다. createArtworks() 완료 후 호출해야 한다.
export function initArtworkList(artworks, onSelect) {
  onArtworkSelect = typeof onSelect === 'function' ? onSelect : null;
  pendingArtworkList = artworks;
  if (!els) return; // initUI() 호출 시 pendingArtworkList가 적용됨
  renderArtworkList(pendingArtworkList);
}

export function toggleArtworkList() {
  if (!els) return;
  if (artworkListOpen) {
    hideArtworkList();
  } else {
    artworkListOpen = true;
    els.artworkList.panel.classList.add('lu-open');
  }
}

export function hideArtworkList() {
  if (!els || !artworkListOpen) return;
  artworkListOpen = false;
  els.artworkList.panel.classList.remove('lu-open');
}

export function isArtworkListOpen() {
  return artworkListOpen;
}

// ---------------------------------------------------------------------------
// 투어 바 — T 키로 시작하는 도슨트 투어의 하단 중앙 컨트롤 바
// ---------------------------------------------------------------------------

// index는 0-based (현재 작품의 배열 인덱스) — 화면에는 index+1 / total로 표시된다.
export function showTourBar({ index, total, title, autoOn } = {}) {
  if (!els) return;
  const t = els.tourBar;
  const pos = Number.isFinite(index) ? index + 1 : 1;
  const tot = Number.isFinite(total) ? total : 0;
  t.countEl.textContent = `● ${pos} / ${tot}`;
  t.titleEl.textContent = ` — ${title || ''}`;
  t.autoBtn.textContent = autoOn ? '자동진행 ON' : '자동진행 OFF';
  t.autoBtn.classList.toggle('lu-tour-on', !!autoOn);
  t.bar.classList.add('lu-open');
}

export function hideTourBar() {
  if (!els) return;
  els.tourBar.bar.classList.remove('lu-open');
}

// 터치 액션 독/작품 패널 버튼 콜백 — 키보드 없는 기기에서 T(투어)/E(크게 보기)/G(방명록)/P(캡처) 대체.
// main.js가 배선한다. 방명록 독 버튼 자체는 ui.js 내부에서 toggleGuestbook()을 직접 호출하므로
// onGuestbook은 현재 ui.js 내부에서 호출하지 않지만, 계약대로 인터페이스에 포함해 둔다.
export function setActionHandlers({ onTour, onViewArtwork, onGuestbook, onCapture, onSelfView } = {}) {
  actionHandlers = {
    onTour: typeof onTour === 'function' ? onTour : null,
    onViewArtwork: typeof onViewArtwork === 'function' ? onViewArtwork : null,
    onGuestbook: typeof onGuestbook === 'function' ? onGuestbook : null,
    onCapture: typeof onCapture === 'function' ? onCapture : null,
    onSelfView: typeof onSelfView === 'function' ? onSelfView : null,
  };
}

// ---------------------------------------------------------------------------
// 공유 모달 — 포토 모드(P키)로 캡처한 화면을 SNS 공유
// ---------------------------------------------------------------------------

// { blob, dataUrl, galleryName, shareUrl } — blob/dataUrl은 워터마크 합성이 끝난 PNG
// (main.js의 capturePhoto()가 canvas.toBlob + toDataURL로 만들어 전달한다).
export function showShareModal({ blob, dataUrl, galleryName, shareUrl } = {}) {
  if (!els) return;
  shareData = {
    blob: blob || null,
    dataUrl: dataUrl || '',
    galleryName: galleryName || '',
    shareUrl: shareUrl || (typeof window !== 'undefined' ? window.location.href : ''),
  };
  els.share.preview.src = shareData.dataUrl;

  // '기기로 공유' 버튼 — Web Share API의 파일 공유를 지원하는 기기에서만 노출
  let canDeviceShare = false;
  if (
    shareData.blob &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function'
  ) {
    try {
      const file = new File([shareData.blob], 'artshow.png', { type: 'image/png' });
      canDeviceShare = navigator.canShare({ files: [file] });
    } catch (_) {
      canDeviceShare = false;
    }
  }
  els.share.deviceBtn.style.display = canDeviceShare ? '' : 'none';

  // 복사 버튼 표시 상태 초기화 (직전 '복사됨' 피드백이 남아있지 않도록)
  if (shareCopyTimer) { clearTimeout(shareCopyTimer); shareCopyTimer = null; }
  els.share.copyBtn.textContent = '링크 복사';
  els.share.copyBtn.classList.remove('lu-share-btn-copied');

  shareModalOpen = true;
  els.share.overlay.classList.add('lu-open');
}

export function hideShareModal() {
  if (!els || !shareModalOpen) return;
  shareModalOpen = false;
  els.share.overlay.classList.remove('lu-open');
}

export function isShareModalOpen() {
  return shareModalOpen;
}

// 캡처 순간 흰 플래시 0.25s 페이드 — capturePhoto()가 renderer.render() 직후 호출한다.
export function flashShutter() {
  if (!els) return;
  const s = els.shutter;
  s.style.transition = 'none';
  s.style.opacity = '1';
  void s.offsetWidth; // 강제 리플로우: opacity:1을 먼저 확정시킨 뒤 트랜지션을 건다
  s.style.transition = 'opacity 0.25s ease';
  s.style.opacity = '0';
}

// onPrev/onNext/onExit/onToggleAuto — 투어 바 버튼 클릭 시 호출될 콜백.
// main.js가 T 키 진입 시(또는 이후 필요 시점에) 배선한다.
export function setTourHandlers({ onPrev, onNext, onExit, onToggleAuto } = {}) {
  tourHandlers = {
    onPrev: typeof onPrev === 'function' ? onPrev : null,
    onNext: typeof onNext === 'function' ? onNext : null,
    onExit: typeof onExit === 'function' ? onExit : null,
    onToggleAuto: typeof onToggleAuto === 'function' ? onToggleAuto : null,
  };
}

// ---------------------------------------------------------------------------
// 방명록 패널 — G 키(또는 HUD 버튼)로 열어 전시에 한 줄 메모를 남긴다
// ---------------------------------------------------------------------------

// onSubmit(text) — 입력창에서 [남기기] 또는 Ctrl/Cmd+Enter로 제출된 본문(트림·120자 이내).
// 닉네임 결합(makeNote) 및 저장/브로드캐스트는 main.js 담당.
/** 방명록 패널 하단 통계 요약 한 줄 갱신 (작가 리포트 — main.js가 주기 호출) */
export function setGuestbookStats(text) {
  const line = document.getElementById('lu-gbook-stats');
  if (line) line.textContent = text || '';
}

export function initGuestbook({ onSubmit } = {}) {
  onGuestbookSubmit = typeof onSubmit === 'function' ? onSubmit : null;
}

export function toggleGuestbook() {
  if (!els) return;
  if (guestbookOpen) {
    hideGuestbook();
  } else {
    guestbookOpen = true;
    els.guestbook.panel.classList.add('lu-open');
  }
}

export function hideGuestbook() {
  if (!els || !guestbookOpen) return;
  guestbookOpen = false;
  els.guestbook.panel.classList.remove('lu-open');
}

export function isGuestbookOpen() {
  return guestbookOpen;
}

// notes: note[] (id/name/text/ts) — 전체 교체 렌더. 최신순으로 전달되어야 한다.
export function setGuestbookNotes(notes) {
  pendingGuestbookNotes = Array.isArray(notes) ? notes : [];
  if (!els) return; // initUI() 호출 시 pendingGuestbookNotes가 적용됨
  renderGuestbookNotes(pendingGuestbookNotes);
}
