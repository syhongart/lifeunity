// web/js/ui.js
// LifeUnity Museum — UI 모듈 (DOM/CSS 전부 JS에서 동적 생성)
// MoMA 미니멀 미학: Helvetica, 화이트/블랙, 골드(#d4af37) 포인트

import { AVATAR_COLORS } from './config.js';

const GOLD = '#d4af37';
const MAX_CHAT_MESSAGES = 8;
const MAX_NICKNAME_LEN = 12;

// ---------------------------------------------------------------------------
// 내부 상태
// ---------------------------------------------------------------------------
let els = null;              // 생성된 DOM 요소 캐시
let callbacks = { onEnter: null, onChatSend: null };
let selectedColor = AVATAR_COLORS[0];
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

// 투어 바 버튼 콜백 (setTourHandlers로 배선)
let tourHandlers = { onPrev: null, onNext: null, onExit: null, onToggleAuto: null };

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
}
#lu-artwork .lu-art-hint .lu-key {
  display: inline-block;
  min-width: 16px; text-align: center;
  margin-right: 7px;
  padding: 1px 6px;
  border: 1px solid var(--lu-gold);
  color: var(--lu-gold);
  font-size: 10px; letter-spacing: 0.04em;
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
  #lu-tourbar {
    bottom: 92px; padding: 9px 14px; gap: 10px;
    font-size: 11px; max-width: calc(100vw - 20px);
  }
  .lu-tour-title { max-width: 110px; }
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

  // 색상 스와치
  const swatchLabel = el('div', { className: 'lu-field-label', text: '아바타 색상', style: 'margin-top:26px;' });
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
    nickLabel, nickInput, nickHint,
    swatchLabel, swatches,
    enterBtn,
    pickerBox,
    divider, studioLink,
  ]);
  const overlay = el('div', { id: 'lu-lobby', className: 'lu' }, [card]);
  document.body.appendChild(overlay);

  function submit() {
    let nickname = nickInput.value.trim().slice(0, MAX_NICKNAME_LEN);
    if (!nickname) nickname = '게스트';
    if (typeof callbacks.onEnter === 'function') {
      callbacks.onEnter({ nickname, color: selectedColor });
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
  const rows = [
    ['마우스 드래그', '시점 회전'],
    ['W A S D', '이동'],
    ['Shift', '달리기'],
    ['Enter', '채팅'],
    ['M', '작품 목록'],
    ['T', '투어'],
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
  return panel;
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
    placeholder: 'Enter 키로 채팅…',
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
  const hint = el('div', { className: 'lu-art-hint' }, [
    el('span', { className: 'lu-key', text: 'E' }),
    document.createTextNode(' — 크게 보기'),
  ]);
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
// 전역 키 핸들러 — Enter로 채팅 입력창 포커스, ESC 우선순위 처리
// ---------------------------------------------------------------------------
// ESC 우선순위 규약:
//   ① 라이트박스가 열려 있으면 라이트박스만 닫는다
//   ② (라이트박스가 닫혀 있고) 작품 목록이 열려 있으면 작품 목록만 닫는다
//   ③ 둘 다 닫혀 있으면 ui.js는 아무것도 하지 않는다 (투어 종료는 main.js 담당)
// 채팅 입력창 포커스 중 ESC는 입력창 자체 keydown 핸들러가 stopPropagation하므로
// 이 전역 핸들러까지 도달하지 않는다 (기존 동작 유지).
function bindGlobalKeys() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
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
      return;
    }
    // 라이트박스가 열려 있는 동안에는 Enter(채팅 포커스) 등 다른 전역 키를 막는다
    // — 오버레이에 가려진 채팅 입력창이 포커스되는 혼란을 방지.
    if (lightboxOpen) return;
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
    tourBar: buildTourBar(),
  };

  bindGlobalKeys();

  // initUI() 호출 이전에 대기 중이던 값이 있으면 지금 적용한다.
  if (pendingGalleryTitle !== null) applyGalleryTitle(pendingGalleryTitle);
  if (pendingPicker) applyGalleryPicker(pendingPicker.galleries, pendingPicker.currentId, pendingPicker.onPick);
  if (pendingArtworkList) renderArtworkList(pendingArtworkList);
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
