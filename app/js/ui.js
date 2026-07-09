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

  const card = el('div', { className: 'lu-lobby-card' }, [
    title, sub, rule,
    nickLabel, nickInput, nickHint,
    swatchLabel, swatches,
    enterBtn,
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

  return { overlay, nickInput };
}

function buildControls() {
  const rows = [
    ['마우스 드래그', '시점 회전'],
    ['W A S D', '이동'],
    ['Shift', '달리기'],
    ['Enter', '채팅'],
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
  const panel = el('div', { id: 'lu-artwork', className: 'lu' }, [eyebrow, title, meta, rule, desc]);
  document.body.appendChild(panel);
  return { panel, title, meta, desc };
}

// ---------------------------------------------------------------------------
// 전역 키 핸들러 — Enter로 채팅 입력창 포커스
// ---------------------------------------------------------------------------
function bindGlobalKeys() {
  window.addEventListener('keydown', (e) => {
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
  };

  bindGlobalKeys();
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
