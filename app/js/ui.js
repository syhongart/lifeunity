// web/js/ui.js
// LifeUnity Museum — UI 모듈 (DOM/CSS 전부 JS에서 동적 생성)
// MoMA 미니멀 미학: Helvetica, 화이트/블랙, 골드(#d4af37) 포인트

import { AVATAR_COLORS } from './config.js';
import { CHARACTERS, RPM_ALLOWED_PREFIXES } from './avatar.js';
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
function readStoredChar() {
  try {
    const saved = localStorage.getItem(LU_CHAR_STORAGE_KEY);
    return CHARACTERS.some((c) => c.id === saved) ? saved : CHARACTERS[0].id;
  } catch (_) {
    return CHARACTERS[0].id; // 프라이빗 모드 등 localStorage 접근 불가 시 기본값
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
let actionHandlers = { onTour: null, onViewArtwork: null, onGuestbook: null, onCapture: null };

// 공유 모달 상태 (SNS 공유 — 포토 모드)
let shareModalOpen = false;
let shareData = { blob: null, dataUrl: '', galleryName: '', shareUrl: '' };
let shareCopyTimer = null;

// RPM 아바타 크리에이터 모달 상태 (로비 RPM 패널의 [아바타 직접 만들기])
let rpmCreatorOpen = false;
let rpmCreatorTimer = null; // 10초 무응답 타임아웃 — load 성공 시 클리어
let onRpmAvatarExported = null; // buildLobby()가 배선 — export된 URL을 #lu-rpm-url에 반영

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
  --lu-font: 'Helvetica Neue', Helvetica, Arial, 'Apple SD Gothic Neo',
             'Malgun Gothic', sans-serif;
}

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
  font-family: var(--lu-font); font-weight: 300;
  font-size: 12px; letter-spacing: 0.04em;
  color: #444; background: #fafafa;
  border: 1px solid #eee; border-radius: 2px;
  padding: 8px 14px; cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, background 0.2s ease;
}
.lu-char-btn:hover { border-color: rgba(0,0,0,0.25); }
.lu-char-btn.lu-selected {
  border-color: var(--lu-gold);
  color: #111;
  background: #f6f3ea;
}

/* ------------------------- 커스텀 아바타 (Ready Player Me) ------------------------- */
.lu-rpm-toggle {
  display: block;
  width: 100%;
  margin-top: 10px;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 11px; letter-spacing: 0.05em;
  color: #999; background: transparent;
  border: none; cursor: pointer;
  padding: 2px 0; text-align: center;
  transition: color 0.2s ease;
}
.lu-rpm-toggle:hover { color: var(--lu-gold); }
.lu-rpm-panel {
  max-height: 0; overflow: hidden;
  opacity: 0;
  transition: max-height 0.3s ease, opacity 0.25s ease, margin-top 0.3s ease;
}
.lu-rpm-panel.lu-open {
  max-height: 220px; opacity: 1; margin-top: 10px;
}
#lu-rpm-url {
  width: 100%;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 13px; color: #111;
  background: #fafafa;
  border: 1px solid #eee;
  padding: 9px 10px; outline: none;
  border-radius: 0;
  transition: border-color 0.25s ease;
}
#lu-rpm-url::placeholder { color: #bbb; }
#lu-rpm-url:focus { border-color: var(--lu-gold); }
#lu-rpm-url.lu-invalid { border-color: #c0392b; }
.lu-rpm-hint {
  margin-top: 6px; text-align: left;
  font-size: 10px; color: #aaa;
}
.lu-rpm-link {
  display: inline-block;
  margin-top: 8px;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 10px; letter-spacing: 0.03em; color: #999;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: color 0.2s ease, border-color 0.2s ease;
}
.lu-rpm-link:hover { color: var(--lu-gold); border-bottom-color: var(--lu-gold); }
.lu-rpm-actions {
  display: flex; align-items: center; flex-wrap: wrap;
  justify-content: space-between; gap: 10px 14px;
  margin-top: 4px;
}
.lu-rpm-create-btn {
  flex: 0 0 auto;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 11px; letter-spacing: 0.05em;
  color: var(--lu-gold); background: transparent;
  border: 1px solid var(--lu-gold); border-radius: 2px;
  padding: 7px 14px; cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease;
}
.lu-rpm-create-btn:hover { background: var(--lu-gold); color: #111; }

/* --------------------- RPM 아바타 크리에이터 모달 (iframe) --------------------- */
#lu-rpm-creator {
  position: fixed; inset: 0; z-index: 990;
  background: rgba(4,4,5,0.96);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
  opacity: 0; pointer-events: none;
  transition: opacity 0.3s ease;
}
#lu-rpm-creator.lu-open { opacity: 1; pointer-events: auto; }
.lu-rpmc-card {
  width: 100%; max-width: 720px; max-height: 92vh;
  background: rgba(255,255,255,0.98);
  color: #111;
  box-shadow: 0 30px 90px rgba(0,0,0,0.5);
  display: flex; flex-direction: column;
  transform: scale(0.97); opacity: 0;
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease;
}
#lu-rpm-creator.lu-open .lu-rpmc-card { transform: scale(1); opacity: 1; }
.lu-rpmc-head {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}
.lu-rpmc-title {
  font-size: 13px; letter-spacing: 0.12em;
  color: #111;
}
#lu-rpmc-close {
  flex: 0 0 auto;
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: 1px solid #ddd; border-radius: 50%;
  color: #999; font-size: 15px; font-weight: 300; line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
}
#lu-rpmc-close:hover { border-color: var(--lu-gold); color: var(--lu-gold); transform: rotate(90deg); }
.lu-rpmc-body {
  position: relative;
  flex: 0 0 auto;
  width: 100%; height: min(640px, 80vh);
  background: #0c0c0d;
}
#lu-rpmc-iframe {
  width: 100%; height: 100%;
  border: none; display: block;
}
.lu-rpmc-status {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 16px; padding: 24px;
  text-align: center;
}
.lu-rpmc-status-text {
  font-size: 12px; letter-spacing: 0.06em; line-height: 1.7;
  color: rgba(255,255,255,0.7);
  max-width: 280px;
}
.lu-rpmc-hint {
  flex: 0 0 auto;
  padding: 12px 20px 16px;
  font-size: 10px; letter-spacing: 0.04em;
  color: #b0aca4;
  text-align: center;
}

#lu-enter-btn {
  width: 100%; margin-top: 30px;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 13px; letter-spacing: 0.3em; text-indent: 0.3em;
  color: #fff; background: #111;
  border: 1px solid #111;
  padding: 14px 0; cursor: pointer;
  transition: background 0.25s ease, color 0.25s ease;
}
#lu-enter-btn:hover { background: var(--lu-gold); border-color: var(--lu-gold); color: #111; }

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

#lu-controls {
  top: 16px; left: 16px;
  background: rgba(10,10,12,0.55);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  padding: 14px 18px;
  border-left: 2px solid var(--lu-gold);
  font-size: 12px; line-height: 1.9;
  color: rgba(255,255,255,0.85);
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
  top: 16px; right: 16px;
  display: flex; flex-direction: column; align-items: flex-end;
  gap: 6px;
  font-size: 12px; letter-spacing: 0.08em;
  text-align: right;
}
#lu-topright .lu-stat {
  background: rgba(10,10,12,0.55);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  padding: 6px 12px;
  color: rgba(255,255,255,0.85);
}
#lu-topright .lu-stat b { font-weight: 400; color: var(--lu-gold); }

#lu-gallery-title {
  top: 18px; left: 50%;
  transform: translateX(-50%);
  max-width: min(70vw, 520px);
  font-size: 11px; letter-spacing: 0.42em; text-indent: 0.42em;
  color: rgba(255,255,255,0.5);
  text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-shadow: 0 1px 6px rgba(0,0,0,0.6);
}
#lu-gallery-title:empty { opacity: 0 !important; }

#lu-status {
  bottom: 22px; left: 50%;
  transform: translateX(-50%);
  max-width: min(80vw, 560px);
  background: rgba(10,10,12,0.55);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  padding: 8px 22px;
  font-size: 12px; letter-spacing: 0.14em;
  color: rgba(255,255,255,0.85);
  text-align: center;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#lu-status:empty { opacity: 0; }

/* --------------------------------- 채팅 --------------------------------- */
#lu-chat {
  bottom: 16px; left: 16px;
  width: min(340px, calc(100vw - 32px));
  display: flex; flex-direction: column; gap: 8px;
}
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
  position: fixed; z-index: 600;
  top: 50%; right: 0;
  transform: translate(105%, -50%);
  width: min(320px, calc(100vw - 24px));
  background: rgba(255,255,255,0.96);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  color: #111;
  padding: 30px 28px;
  border-left: 2px solid var(--lu-gold);
  box-shadow: -18px 0 50px rgba(0,0,0,0.28);
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
#lu-artwork.lu-open { transform: translate(0, -50%); }
#lu-artwork .lu-art-eyebrow {
  font-size: 10px; letter-spacing: 0.3em;
  color: var(--lu-gold); margin-bottom: 12px;
}
#lu-artwork .lu-art-title {
  font-size: 20px; font-weight: 300; line-height: 1.3;
  color: #111;
}
#lu-artwork .lu-art-meta {
  margin-top: 8px;
  font-size: 12px; letter-spacing: 0.06em;
  color: #888;
}
#lu-artwork .lu-art-rule {
  width: 28px; height: 1px; background: #ddd; margin: 18px 0;
}
#lu-artwork .lu-art-desc {
  font-size: 13px; line-height: 1.8; color: #444;
  max-height: 40vh; overflow-y: auto;
}
#lu-artwork .lu-art-hint {
  margin-top: 16px;
  font-size: 11px; letter-spacing: 0.04em; color: #999;
  font-family: var(--lu-font); font-weight: 300;
  background: transparent; border: none; cursor: pointer;
  padding: 6px 0; text-align: left;
  transition: color 0.25s ease;
}
#lu-artwork .lu-art-hint:hover { color: var(--lu-gold); }
#lu-artwork .lu-art-hint .lu-key {
  display: inline-block;
  min-width: 16px; text-align: center;
  margin-right: 7px;
  padding: 1px 6px;
  border: 1px solid var(--lu-gold);
  color: var(--lu-gold);
  font-size: 10px; letter-spacing: 0.04em;
}

/* ---------------------- 터치 기기: 조작법 접기 + 액션 독 ---------------------- */
#lu-controls.lu-collapsed { display: none; }
#lu-controls-toggle {
  position: fixed; top: 14px; left: 14px; z-index: 520;
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(10,10,12,0.6);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.2); border-radius: 50%;
  color: rgba(255,255,255,0.85);
  font-family: var(--lu-font); font-weight: 300; font-size: 15px;
  cursor: pointer;
  transition: border-color 0.25s ease, color 0.25s ease;
}
#lu-controls-toggle:active { border-color: var(--lu-gold); color: var(--lu-gold); }
#lu-dock {
  position: fixed; right: 14px; bottom: 96px; z-index: 520;
  display: flex; flex-direction: column; gap: 10px;
}
.lu-dock-btn {
  width: 52px; height: 52px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(10,10,12,0.62);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.22); border-radius: 50%;
  color: rgba(255,255,255,0.9);
  font-family: var(--lu-font); font-weight: 300;
  font-size: 12px; letter-spacing: 0.06em;
  cursor: pointer;
  transition: border-color 0.25s ease, color 0.25s ease, transform 0.15s ease;
}
.lu-dock-btn:active {
  border-color: var(--lu-gold); color: var(--lu-gold);
  transform: scale(0.94);
}

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
  font-size: 24px; font-weight: 300; line-height: 1.35;
  letter-spacing: 0.02em;
  color: #fff;
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
  background: rgba(255,255,255,0.97);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
  color: #111;
  box-shadow: 18px 0 50px rgba(0,0,0,0.28);
  transform: translateX(-100%); /* 닫혀도 책갈피 탭은 화면에 남는다 */
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  display: flex; flex-direction: column;
}
#lu-guestbook.lu-open { transform: translateX(0); }

/* 책갈피 탭 — 패널 오른쪽 가장자리에 붙어 함께 미끄러진다 */
#lu-gbtab {
  position: absolute;
  right: -33px; top: 38%;
  writing-mode: vertical-rl;
  padding: 15px 8px 15px 6px;
  background: rgba(10,10,12,0.72);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.16);
  border-left: 2px solid var(--lu-gold);
  border-radius: 0 9px 9px 0;
  color: rgba(255,255,255,0.92);
  font-family: var(--lu-font); font-weight: 300;
  font-size: 12px; letter-spacing: 0.3em;
  cursor: pointer;
  opacity: 0; pointer-events: none;
  transition: opacity 0.6s ease, color 0.25s ease;
}
#lu-gbtab.lu-visible { opacity: 1; pointer-events: auto; }
#lu-gbtab:hover { color: var(--lu-gold); }
#lu-guestbook-head {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px 24px 16px;
  border-bottom: 1px solid #eee;
}
#lu-guestbook-title {
  font-size: 13px; letter-spacing: 0.16em; text-indent: 0.16em;
  color: #111;
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
  padding: 14px 24px;
  border-bottom: 1px solid #f0f0ee;
}
.lu-gbook-name { font-size: 12px; font-weight: 400; color: var(--lu-gold); }
.lu-gbook-time {
  margin-left: 8px;
  font-size: 10px; letter-spacing: 0.04em; color: #aaa;
}
.lu-gbook-text {
  margin-top: 6px;
  font-size: 13px; line-height: 1.6; color: #333;
  word-break: break-word; white-space: pre-wrap;
}
.lu-gbook-empty {
  padding: 40px 24px; text-align: center;
  font-size: 12px; color: #aaa;
}
#lu-guestbook-footer {
  flex: 0 0 auto;
  padding: 16px 24px 20px;
  border-top: 1px solid #eee;
}
#lu-gbook-input {
  width: 100%; resize: none;
  font-family: var(--lu-font); font-weight: 300;
  font-size: 13px; color: #111;
  background: #fafafa;
  border: 1px solid #eee;
  padding: 10px 12px; outline: none;
  border-radius: 0;
  transition: border-color 0.25s ease;
}
#lu-gbook-input::placeholder { color: #bbb; }
#lu-gbook-input:focus { border-color: var(--lu-gold); }
.lu-gbook-footer-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px;
}
.lu-gbook-count {
  font-size: 10px; letter-spacing: 0.04em; color: #bbb;
}
#lu-gbook-submit {
  font-family: var(--lu-font); font-weight: 300;
  font-size: 12px; letter-spacing: 0.2em; text-indent: 0.2em;
  color: #fff; background: #111;
  border: 1px solid #111;
  padding: 9px 18px; cursor: pointer;
  transition: background 0.25s ease, color 0.25s ease, opacity 0.25s ease;
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
  #lu-status { bottom: 76px; font-size: 11px; padding: 6px 14px; }
  #lu-artwork { padding: 22px 18px; }
  #lu-artwork .lu-art-title { font-size: 17px; }
  #lu-gallery-title { font-size: 10px; letter-spacing: 0.28em; text-indent: 0.28em; max-width: 60vw; }
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
  #lu-rpm-creator { padding: 8px; }
  .lu-rpmc-card { max-width: 100%; max-height: calc(100vh - 16px); height: calc(100vh - 16px); }
  .lu-rpmc-body { flex: 1 1 auto; height: auto; }
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
  const title = el('div', { className: 'lu-lobby-title', text: 'LIFEUNITY MUSEUM' });
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
    el('span', { text: '또는 게스트로 입장' }),
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

  // 캐릭터 선택 (KayKit Adventurers 4종) — 색상 스와치 위에 배치
  const charLabel = el('div', { className: 'lu-field-label', text: '캐릭터', style: 'margin-top:26px;' });
  const charsRow = el('div', { className: 'lu-chars' });
  CHARACTERS.forEach((c) => {
    const btn = el('button', {
      className: 'lu-char-btn' + (c.id === selectedChar ? ' lu-selected' : ''),
      type: 'button',
      'aria-label': `캐릭터 ${c.name}`,
      text: c.name,
    });
    btn.addEventListener('click', () => {
      selectedChar = c.id;
      try { localStorage.setItem(LU_CHAR_STORAGE_KEY, c.id); } catch (_) { /* 프라이빗 모드 등 무시 */ }
      charsRow.querySelectorAll('.lu-char-btn').forEach((b) => b.classList.remove('lu-selected'));
      btn.classList.add('lu-selected');
    });
    charsRow.appendChild(btn);
  });

  // 커스텀 아바타 (Ready Player Me) — 접이식. 유효한 URL이 입력되면 캐릭터 선택보다
  // 우선한다 (submit()에서 처리).
  const LU_RPM_STORAGE_KEY = 'lu-rpm-url';
  function readStoredRpmUrl() {
    try {
      return localStorage.getItem(LU_RPM_STORAGE_KEY) || '';
    } catch (_) {
      return ''; // 프라이빗 모드 등 localStorage 접근 불가 시 무시
    }
  }
  function isValidRpmUrl(url) {
    return (
      typeof url === 'string' &&
      url.toLowerCase().endsWith('.glb') &&
      RPM_ALLOWED_PREFIXES.some((prefix) => url.startsWith(prefix))
    );
  }

  const rpmToggle = el('button', {
    className: 'lu-rpm-toggle',
    type: 'button',
    text: '나만의 아바타 (Ready Player Me) ▾',
  });
  const rpmInput = el('input', {
    id: 'lu-rpm-url',
    type: 'text',
    placeholder: 'https://models.readyplayer.me/....glb',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const rpmHint = el('div', {
    className: 'lu-rpm-hint',
    text: 'readyplayer.me에서 만든 아바타 주소를 붙여넣으세요',
  });
  const rpmLink = el('a', {
    className: 'lu-rpm-link',
    href: 'https://readyplayer.me/',
    target: '_blank',
    rel: 'noopener noreferrer',
    text: 'readyplayer.me에서 아바타 만들기 →',
  });
  const rpmCreateBtn = el('button', {
    className: 'lu-rpm-create-btn',
    type: 'button',
    text: '아바타 직접 만들기',
  });
  rpmCreateBtn.addEventListener('click', () => {
    openRpmCreator((url) => {
      rpmInput.value = url;
      // 기존 검증/저장(localStorage) 로직을 그대로 태우기 위해 input 이벤트를 디스패치한다.
      rpmInput.dispatchEvent(new Event('input', { bubbles: true }));
      setRpmOpen(true); // RPM 패널은 펼쳐진 상태를 유지
    });
  });
  const rpmActions = el('div', { className: 'lu-rpm-actions' }, [rpmLink, rpmCreateBtn]);
  const rpmPanel = el('div', { className: 'lu-rpm-panel' }, [rpmInput, rpmHint, rpmActions]);

  let rpmOpen = false;
  function setRpmOpen(open) {
    rpmOpen = open;
    rpmPanel.classList.toggle('lu-open', open);
    rpmToggle.textContent = `나만의 아바타 (Ready Player Me) ${open ? '▴' : '▾'}`;
  }
  rpmToggle.addEventListener('click', () => setRpmOpen(!rpmOpen));

  function syncRpmValidity() {
    const v = rpmInput.value.trim();
    rpmInput.classList.toggle('lu-invalid', v.length > 0 && !isValidRpmUrl(v));
  }

  const storedRpmUrl = readStoredRpmUrl();
  if (storedRpmUrl) {
    rpmInput.value = storedRpmUrl;
    setRpmOpen(true); // 저장된 URL이 있으면 시작부터 펼쳐 보여준다
  }
  syncRpmValidity();

  rpmInput.addEventListener('input', () => {
    try { localStorage.setItem(LU_RPM_STORAGE_KEY, rpmInput.value.trim()); } catch (_) { /* 무시 */ }
    syncRpmValidity();
  });
  rpmInput.addEventListener('keydown', (e) => e.stopPropagation()); // 로비 입력 중 WASD/Enter 전역 처리 차단
  rpmInput.addEventListener('keyup', (e) => e.stopPropagation());

  // 색상 스와치
  const swatchLabel = el('div', { className: 'lu-field-label', text: '아바타 색상', style: 'margin-top:20px;' });
  const swatches = el('div', { className: 'lu-swatches' });
  AVATAR_COLORS.forEach((color, i) => {
    const btn = el('button', {
      className: 'lu-swatch' + (i === 0 ? ' lu-selected' : ''),
      type: 'button',
      title: color,
      'aria-label': `아바타 색상 ${color}`,
      style: `background:${color};`,
    });
    btn.addEventListener('click', () => {
      selectedColor = color;
      swatches.querySelectorAll('.lu-swatch').forEach((s) => s.classList.remove('lu-selected'));
      btn.classList.add('lu-selected');
    });
    swatches.appendChild(btn);
  });

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
    authBox, orDivider,
    nickLabel, nickInput, nickHint,
    charLabel, charsRow,
    rpmToggle, rpmPanel,
    swatchLabel, swatches,
    enterBtn,
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
    // 유효한 커스텀 RPM URL이 입력돼 있으면 캐릭터 선택보다 우선한다.
    // 무효값(빈 값 포함)은 조용히 무시하고 선택된 캐릭터를 그대로 쓴다.
    const rpmUrl = rpmInput.value.trim();
    const char = isValidRpmUrl(rpmUrl) ? `rpm:${rpmUrl}` : selectedChar;
    syncRpmValidity();
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

  return { overlay, nickInput, pickerBox };
}

function buildControls() {
  // 기기별 조작 안내 — 터치 기기에는 키보드 안내 대신 터치 제스처 안내
  const rows = IS_TOUCH
    ? [
        ['왼쪽 드래그', '이동'],
        ['오른쪽 드래그', '시점 회전'],
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
        ['P', '사진 촬영'],
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

  const listBtn = el('button', {
    className: 'lu-dock-btn', type: 'button', 'aria-label': '작품 목록',
    text: '목록',
  });
  listBtn.addEventListener('click', () => toggleArtworkList());

  const tourBtn = el('button', {
    className: 'lu-dock-btn', type: 'button', 'aria-label': '투어 시작/종료',
    text: '투어',
  });
  tourBtn.addEventListener('click', () => {
    if (typeof actionHandlers.onTour === 'function') actionHandlers.onTour();
  });

  const captureBtn = el('button', {
    className: 'lu-dock-btn', type: 'button', 'aria-label': '사진 촬영',
    text: '캡처',
  });
  captureBtn.addEventListener('click', () => {
    if (typeof actionHandlers.onCapture === 'function') actionHandlers.onCapture();
  });

  // 방명록은 화면 왼쪽 책갈피 탭(#lu-gbtab)이 담당하므로 독 버튼은 두지 않는다
  const dock = el('div', { id: 'lu-dock', className: 'lu lu-hud' }, [listBtn, tourBtn, captureBtn]);
  document.body.appendChild(dock);
  return dock;
}

function buildTopRight() {
  const fps = el('span', { text: '--' });
  const count = el('span', { text: '1' });
  const fpsStat = el('div', { className: 'lu-stat' });
  fpsStat.append('FPS ');
  const fpsB = el('b'); fpsB.appendChild(fps); fpsStat.appendChild(fpsB);
  const countStat = el('div', { className: 'lu-stat' });
  countStat.append('접속 ');
  const countB = el('b'); countB.appendChild(count); countStat.appendChild(countB);
  countStat.append(' 명');
  const wrap = el('div', { id: 'lu-topright', className: 'lu lu-hud' }, [fpsStat, countStat]);
  document.body.appendChild(wrap);
  return { wrap, fps, count };
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
  hint.addEventListener('click', () => {
    if (typeof actionHandlers.onViewArtwork === 'function') actionHandlers.onViewArtwork();
  });
  const panel = el('div', { id: 'lu-artwork', className: 'lu' }, [eyebrow, title, meta, rule, desc, hint]);
  document.body.appendChild(panel);
  return { panel, title, meta, desc };
}

function buildGalleryTitle() {
  const bar = el('div', { id: 'lu-gallery-title', className: 'lu lu-hud' });
  document.body.appendChild(bar);
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

  return { overlay, closeBtn, stage, title: titleEl, meta: metaEl, rule: ruleEl, desc: descEl };
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
  notes.forEach((note) => {
    const head = el('div', {}, [
      el('span', { className: 'lu-gbook-name', text: note.name || '게스트' }),
      el('span', { className: 'lu-gbook-time', text: formatRelativeTime(note.ts) }),
    ]);
    const text = el('div', { className: 'lu-gbook-text', text: note.text || '' });
    body.appendChild(el('div', { className: 'lu-gbook-note' }, [head, text]));
  });
}

function buildGuestbookPanel() {
  const closeBtn = el('button', { id: 'lu-guestbook-close', type: 'button', 'aria-label': '닫기', text: '×' });
  const head = el('div', { id: 'lu-guestbook-head' }, [
    el('div', { id: 'lu-guestbook-title', text: 'GUESTBOOK — 방명록' }),
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
  const footer = el('div', { id: 'lu-guestbook-footer' }, [input, footerRow]);

  // 책갈피 탭 — 패널이 닫혀 있어도 화면 왼쪽 가장자리에 살짝 나와 있고,
  // 패널의 자식이므로 열릴 때 패널과 함께 미끄러진다
  const tab = el('button', {
    id: 'lu-gbtab',
    type: 'button',
    'aria-label': '방명록 열기/닫기',
    text: '방명록',
  });
  tab.addEventListener('click', () => toggleGuestbook());

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
      const file = new File([shareData.blob], 'lifeunity.png', { type: 'image/png' });
      await navigator.share({
        files: [file],
        title: shareData.galleryName || 'LIFEUNITY',
        text: `${shareData.galleryName || 'LIFEUNITY'} — LIFEUNITY 3D 전시`,
      });
    } catch (_) {
      /* 사용자가 공유 시트를 취소한 경우 등 — 조용히 무시 */
    }
  });

  saveBtn.addEventListener('click', () => {
    if (!shareData.dataUrl) return;
    const a = document.createElement('a');
    a.href = shareData.dataUrl;
    a.download = 'lifeunity.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  xBtn.addEventListener('click', () => {
    const text = `${shareData.galleryName || 'LIFEUNITY'} — LIFEUNITY 3D 전시`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareData.shareUrl || '')}`;
    window.open(url, '_blank', 'noopener');
  });

  threadsBtn.addEventListener('click', () => {
    const text = `${shareData.galleryName || 'LIFEUNITY'} — LIFEUNITY 3D 전시 ${shareData.shareUrl || ''}`;
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
// RPM 아바타 크리에이터 모달 — 로비 RPM 패널의 [아바타 직접 만들기]로 열리는
// Ready Player Me 공식 크리에이터 iframe. 완성된 아바타 GLB URL을 postMessage로
// 받아 #lu-rpm-url에 자동으로 채워 넣는다 (RPM Frame API).
// ---------------------------------------------------------------------------
const RPM_CREATOR_SRC = 'https://demo.readyplayer.me/avatar?frameApi&clearCache';
const RPM_CREATOR_TIMEOUT_MS = 10000;

function buildRpmCreator() {
  const closeBtn = el('button', { id: 'lu-rpmc-close', type: 'button', 'aria-label': '닫기', text: '×' });
  const title = el('div', { className: 'lu-rpmc-title', text: '아바타 만들기 — Ready Player Me' });
  const head = el('div', { className: 'lu-rpmc-head' }, [title, closeBtn]);

  const spinner = el('div', { className: 'lu-spinner' });
  const statusText = el('div', { className: 'lu-rpmc-status-text', text: '크리에이터 불러오는 중...' });
  const status = el('div', { className: 'lu-rpmc-status' }, [spinner, statusText]);

  // src는 openRpmCreator()에서 지연 설정하고, closeRpmCreator()에서 제거해 리소스를 해제한다.
  const iframe = el('iframe', {
    id: 'lu-rpmc-iframe',
    title: 'Ready Player Me 아바타 크리에이터',
    allow: 'camera *; microphone *',
  });

  const body = el('div', { className: 'lu-rpmc-body' }, [status, iframe]);
  const hint = el('div', { className: 'lu-rpmc-hint', text: '완성하면 주소가 자동으로 입력됩니다' });

  const card = el('div', { className: 'lu-rpmc-card' }, [head, body, hint]);
  const overlay = el('div', { id: 'lu-rpm-creator', className: 'lu' }, [card]);
  document.body.appendChild(overlay);

  closeBtn.addEventListener('click', () => closeRpmCreator());
  // 카드 바깥(배경) 클릭 시 닫힘 — 카드 자체 클릭은 통과
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeRpmCreator(); });

  iframe.addEventListener('load', () => {
    if (!rpmCreatorOpen) return; // 모달이 닫힌 뒤(src 제거로 발생하는) about:blank load는 무시
    if (rpmCreatorTimer) { clearTimeout(rpmCreatorTimer); rpmCreatorTimer = null; }
    status.style.display = 'none';
    iframe.style.display = '';
    subscribeRpmFrame();
  });
  iframe.addEventListener('error', () => showRpmCreatorError());

  return { overlay, card, iframe, status, statusText, spinner };
}

// origin 검증 — 'https://' + (서브도메인.)?readyplayer.me 형태만 통과시킨다.
// event.origin이 이 형태면(합성 테스트 이벤트 포함) 그대로 통과한다.
function isRpmOrigin(origin) {
  return typeof origin === 'string' && /^https:\/\/([a-z0-9-]+\.)?readyplayer\.me$/i.test(origin);
}

function parseRpmEvent(event) {
  if (!isRpmOrigin(event.origin)) return null;
  try {
    const json = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    return json && json.source === 'readyplayerme' ? json : null;
  } catch (_) {
    return null;
  }
}

function subscribeRpmFrame() {
  if (!els || !els.rpmCreator) return;
  const iframe = els.rpmCreator.iframe;
  if (!iframe.contentWindow) return;
  iframe.contentWindow.postMessage(
    JSON.stringify({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.**' }),
    '*'
  );
}

function bindRpmMessageListener() {
  window.addEventListener('message', (event) => {
    const json = parseRpmEvent(event);
    if (!json) return;
    if (json.eventName === 'v1.frame.ready') {
      subscribeRpmFrame();
    } else if (json.eventName === 'v1.avatar.exported') {
      const url = json.data && json.data.url;
      if (url && typeof onRpmAvatarExported === 'function') onRpmAvatarExported(url);
      closeRpmCreator();
    }
  });
}

// onExported(url) — export 완료 시 호출될 콜백. buildLobby()가 [아바타 직접 만들기]
// 클릭 시 배선해 #lu-rpm-url을 채우고 패널을 펼친 채로 유지한다.
function openRpmCreator(onExported) {
  if (!els || !els.rpmCreator) return;
  onRpmAvatarExported = typeof onExported === 'function' ? onExported : null;
  rpmCreatorOpen = true;

  const { overlay, iframe, status, statusText, spinner } = els.rpmCreator;
  spinner.style.display = '';
  statusText.textContent = '크리에이터 불러오는 중...';
  status.style.display = 'flex';
  iframe.style.display = 'none';
  overlay.classList.add('lu-open');

  if (rpmCreatorTimer) clearTimeout(rpmCreatorTimer);
  rpmCreatorTimer = setTimeout(() => showRpmCreatorError(), RPM_CREATOR_TIMEOUT_MS);

  iframe.src = RPM_CREATOR_SRC; // lazy 생성 — 모달을 열 때만 로드
}

function showRpmCreatorError() {
  if (!els || !els.rpmCreator) return;
  if (rpmCreatorTimer) { clearTimeout(rpmCreatorTimer); rpmCreatorTimer = null; }
  const { status, statusText, spinner, iframe } = els.rpmCreator;
  spinner.style.display = 'none';
  statusText.textContent = '연결할 수 없습니다 — readyplayer.me에서 만든 주소를 직접 붙여넣어 주세요';
  status.style.display = 'flex';
  iframe.style.display = 'none';
}

function closeRpmCreator() {
  if (!els || !els.rpmCreator || !rpmCreatorOpen) return;
  rpmCreatorOpen = false;
  onRpmAvatarExported = null;
  if (rpmCreatorTimer) { clearTimeout(rpmCreatorTimer); rpmCreatorTimer = null; }
  els.rpmCreator.overlay.classList.remove('lu-open');
  els.rpmCreator.iframe.removeAttribute('src'); // 리소스 해제
}

// ---------------------------------------------------------------------------
// 전역 키 핸들러 — Enter로 채팅 입력창 포커스, ESC 우선순위 처리
// ---------------------------------------------------------------------------
// ESC 우선순위 규약:
//   ① 아바타 크리에이터 모달이 열려 있으면 크리에이터 모달만 닫는다
//   ② (크리에이터 모달이 닫혀 있고) 공유 모달이 열려 있으면 공유 모달만 닫는다
//   ③ (위 둘이 닫혀 있고) 라이트박스가 열려 있으면 라이트박스만 닫는다
//   ④ (위 셋이 닫혀 있고) 작품 목록이 열려 있으면 작품 목록만 닫는다
//   ⑤ (위 넷이 닫혀 있고) 방명록이 열려 있으면 방명록만 닫는다
//   ⑥ 다섯 다 닫혀 있으면 ui.js는 아무것도 하지 않는다 (투어 종료는 main.js 담당)
// 채팅/방명록 입력창 포커스 중 ESC는 입력창 자체 keydown 핸들러가 stopPropagation하므로
// 이 전역 핸들러까지 도달하지 않는다 (기존 동작 유지).
function bindGlobalKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (rpmCreatorOpen) {
        e.preventDefault();
        // ui.js 리스너는 main.js보다 먼저 등록되므로 여기서 멈추면
        // 같은 ESC가 main.js의 투어-종료 리스너까지 도달하지 않는다 (ESC=한 동작).
        e.stopImmediatePropagation();
        closeRpmCreator();
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
    // 라이트박스/공유 모달/크리에이터 모달이 열려 있는 동안에는 Enter(채팅 포커스) 등
    // 다른 전역 키를 막는다 — 오버레이에 가려진 채팅 입력창이 포커스되는 혼란을 방지.
    if (lightboxOpen || shareModalOpen || rpmCreatorOpen) return;
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
    rpmCreator: buildRpmCreator(),
  };

  bindGlobalKeys();
  bindRpmMessageListener();

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
  els.topRight.count.textContent = String(n);
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
  els.galleryTitle.textContent = name || '';
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
export function setActionHandlers({ onTour, onViewArtwork, onGuestbook, onCapture } = {}) {
  actionHandlers = {
    onTour: typeof onTour === 'function' ? onTour : null,
    onViewArtwork: typeof onViewArtwork === 'function' ? onViewArtwork : null,
    onGuestbook: typeof onGuestbook === 'function' ? onGuestbook : null,
    onCapture: typeof onCapture === 'function' ? onCapture : null,
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
      const file = new File([shareData.blob], 'lifeunity.png', { type: 'image/png' });
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
