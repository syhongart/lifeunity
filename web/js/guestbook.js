// guestbook.js — 방명록 데이터 계층 (localStorage 영속화 + 병합)
// 소유자: guestbook.js / multiplayer.js 담당 에이전트

const MAX_NOTES = 200;
const MAX_TEXT_LEN = 120;

/**
 * @typedef {{id: string, name: string, text: string, ts: number}} Note
 */

function storageKey(galleryId) {
  return `lu-guestbook-${galleryId ?? 'shared'}`;
}

/**
 * 갤러리의 방명록 노트를 localStorage에서 불러온다.
 * @param {string|null|undefined} galleryId
 * @returns {Note[]}
 */
export function loadNotes(galleryId) {
  try {
    const raw = localStorage.getItem(storageKey(galleryId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((n) => n && typeof n === 'object' && typeof n.id === 'string');
  } catch (e) {
    return [];
  }
}

/**
 * 노트 배열을 ts 내림차순 정렬, 최대 MAX_NOTES개로 절단 후 저장한다.
 * @param {string|null|undefined} galleryId
 * @param {Note[]} notes
 * @returns {void}
 */
export function saveNotes(galleryId, notes) {
  const sorted = [...notes].sort((a, b) => b.ts - a.ts).slice(0, MAX_NOTES);
  try {
    localStorage.setItem(storageKey(galleryId), JSON.stringify(sorted));
  } catch (e) {
    // 저장 실패(용량 초과 등)는 무시 — 방명록은 부가 기능
  }
}

/**
 * 두 노트 배열을 id 기준으로 중복 제거하며 병합, ts 내림차순으로 반환한다.
 * @param {Note[]} a
 * @param {Note[]} b
 * @returns {Note[]}
 */
export function mergeNotes(a, b) {
  const map = new Map();
  for (const n of [...a, ...b]) {
    if (!n || typeof n.id !== 'string') continue;
    map.set(n.id, n);
  }
  return Array.from(map.values()).sort((x, y) => y.ts - x.ts);
}

/**
 * 새 방명록 노트를 생성한다.
 * @param {string} name
 * @param {string} text
 * @returns {Note}
 */
export function makeNote(name, text) {
  return {
    id: randomHexId(8),
    name: String(name || '익명').slice(0, 40),
    text: String(text || '').slice(0, MAX_TEXT_LEN),
    ts: Date.now(),
  };
}

function randomHexId(len) {
  const bytes = new Uint8Array(Math.ceil(len / 2));
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, len);
}
