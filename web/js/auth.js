// auth.js — 소셜 로그인 (구글/카카오/네이버)
//
// ⚠️ 현재는 목(mock) 구현이다. 실제 OAuth 키가 발급되면 loginWith() 내부의
// mock 분기를 각 플랫폼 JS SDK 호출로 교체하면 된다 (인터페이스 불변):
//   - Google: Google Identity Services (accounts.google.com/gsi/client)
//   - Kakao:  Kakao JS SDK (Kakao.Auth.login)
//   - Naver:  네아로 JS SDK (naver_id_login)
// 키는 아래 CONFIG에 채운다. 키가 비어 있으면 자동으로 mock 모드로 동작한다.

const CONFIG = {
  google: { clientId: '' }, // Google Cloud Console OAuth 클라이언트 ID
  kakao: { jsKey: '' },     // Kakao Developers JavaScript 키
  naver: { clientId: '' },  // Naver Developers Client ID
};

export const PROVIDERS = {
  google: { label: 'Google로 계속하기', short: 'G' },
  kakao: { label: '카카오로 계속하기', short: 'K' },
  naver: { label: '네이버로 계속하기', short: 'N' },
};

const STORAGE_KEY = 'lu-auth-profile-v1';

// mock 로그인 시 부여되는 표시 이름 (플랫폼별 감성 차이만 살짝)
export const MOCK_NAMES = {
  google: '아트러버',
  kakao: '전시나들이',
  naver: '갤러리워커',
};

let profile = null; // { provider, name, initial } | null
let changeListeners = [];

function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.provider === 'string' && typeof p.name === 'string') return p;
  } catch (_) {
    /* 무시 */
  }
  return null;
}

function persist() {
  try {
    if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    else localStorage.removeItem(STORAGE_KEY);
  } catch (_) {
    /* 무시 */
  }
}

function emitChange() {
  for (const cb of changeListeners) {
    try {
      cb(profile);
    } catch (_) {
      /* 리스너 오류는 무시 */
    }
  }
}

profile = loadProfile();

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

export function getProfile() {
  return profile;
}

export function isMockMode(provider) {
  const c = CONFIG[provider];
  if (!c) return true;
  return !Object.values(c).some((v) => typeof v === 'string' && v.length > 0);
}

// 로그인 — 성공 시 profile 반환. mock 모드에서는 잠깐의 지연 후 가짜 프로필 부여.
export async function loginWith(provider) {
  if (!PROVIDERS[provider]) throw new Error('unknown provider: ' + provider);

  if (isMockMode(provider)) {
    // 실제 SDK 왕복처럼 느껴지도록 짧은 지연
    await new Promise((r) => setTimeout(r, 450));
    const name = MOCK_NAMES[provider] || '관람객';
    profile = { provider, name, initial: name.slice(0, 1) };
    persist();
    emitChange();
    return profile;
  }

  // TODO(키 발급 후): 플랫폼별 실제 SDK 로그인으로 교체
  throw new Error('SDK 연동은 키 발급 후 활성화됩니다');
}

export function logout() {
  profile = null;
  persist();
  emitChange();
}

export function onAuthChange(cb) {
  if (typeof cb === 'function') changeListeners.push(cb);
}
