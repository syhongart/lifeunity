// feed.js — 커뮤니티 피드 저장소 (방문자 로그 · 포토월)
// OpenArtShow Metaverse
//
// SOLID 설계 노트
//  - 단일 책임(S): VisitorLog는 "누가 다녀갔나", PhotoWall은 "어떤 사진이 남았나"만 담당.
//    직렬화/병합/상한 관리는 JsonListStore 하나가 전담한다.
//  - 개방/폐쇄(O)·의존성 역전(D): 두 스토어 모두 Storage 호환 객체(getItem/setItem)를
//    주입받는다. 지금은 localStorage(로컬 우선), 경량 백엔드 도입 시 서버 동기화
//    스토리지 구현체로 교체해도 호출부는 변하지 않는다.
//  - 병합은 id 기준 멱등 — P2P로 같은 항목이 여러 번 도착해도 중복되지 않는다
//    (방명록 mergeNotes와 동일한 CRDT-lite 규약).
//
// 랜딩 페이지가 같은 오리진의 localStorage를 읽어 "최근 관람객 / 라이브 포토월"을
// 렌더링한다 — 키는 전시 구분 없이 전역(피드는 사이트 단위 소셜 프루프이므로).

const VISITOR_KEY = 'lu-feed-visitors-v1';
const PHOTO_KEY = 'lu-feed-photos-v1';
const MAX_VISITORS = 40;
const MAX_PHOTOS = 12;
const MAX_THUMB_BYTES = 120000; // 데이터URL 문자열 길이 상한 (~90KB 바이너리)

function makeId(prefix) {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
}

/** id 멱등 병합 + ts 내림차순 + 상한 절단을 책임지는 공용 리스트 저장소 */
class JsonListStore {
  constructor(key, max, storage) {
    this.key = key;
    this.max = max;
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  }

  load() {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(this.key);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  merge(items) {
    const cur = this.load();
    const byId = new Map(cur.map((x) => [x.id, x]));
    for (const it of items || []) {
      if (it && typeof it.id === 'string' && !byId.has(it.id)) byId.set(it.id, it);
    }
    const merged = [...byId.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, this.max);
    if (this.storage) {
      try {
        this.storage.setItem(this.key, JSON.stringify(merged));
      } catch (_) {
        // 용량 초과 시 사진 절반만 남기고 재시도 (썸네일이 큰 항목이므로)
        try {
          this.storage.setItem(this.key, JSON.stringify(merged.slice(0, Math.ceil(this.max / 2))));
        } catch (_) {
          /* 그래도 실패하면 세션 메모리로만 */
        }
      }
    }
    return merged;
  }
}

/** 방문자 로그 — "○○님이 △△ 전시를 다녀갔어요" */
export class VisitorLog {
  constructor(storage) {
    this._store = new JsonListStore(VISITOR_KEY, MAX_VISITORS, storage);
  }

  add(nickname, galleryName) {
    return this._store.merge([
      {
        id: makeId('v'),
        name: String(nickname || '게스트').slice(0, 20),
        g: String(galleryName || '').slice(0, 40),
        ts: Date.now(),
      },
    ]);
  }

  list() {
    return this._store.load();
  }
}

/** 원격에서 온 사진 항목 검증 — 형식/크기 화이트리스트 (인터페이스 분리: 검증은 순수 함수) */
export function isValidPhotoItem(item) {
  return !!(
    item &&
    typeof item.id === 'string' &&
    item.id.length <= 40 &&
    typeof item.thumb === 'string' &&
    item.thumb.startsWith('data:image/jpeg;base64,') &&
    item.thumb.length <= MAX_THUMB_BYTES
  );
}

/** 포토월 — P키 캡처 썸네일의 로컬 우선 피드 */
export class PhotoWall {
  constructor(storage) {
    this._store = new JsonListStore(PHOTO_KEY, MAX_PHOTOS, storage);
  }

  /** 내 캡처 등록 → 병합된 항목(전파용) 반환 */
  addLocal(nickname, galleryName, thumbDataUrl) {
    const item = {
      id: makeId('p'),
      name: String(nickname || '게스트').slice(0, 20),
      g: String(galleryName || '').slice(0, 40),
      thumb: String(thumbDataUrl || ''),
      ts: Date.now(),
    };
    if (!isValidPhotoItem(item)) return null;
    this._store.merge([item]);
    return item;
  }

  /** 원격 전파 수신 — 검증 통과분만 병합 */
  addRemote(item) {
    if (!isValidPhotoItem(item)) return;
    this._store.merge([
      {
        id: item.id,
        name: String(item.name || '게스트').slice(0, 20),
        g: String(item.g || '').slice(0, 40),
        thumb: item.thumb,
        ts: Number(item.ts) || Date.now(),
      },
    ]);
  }

  list() {
    return this._store.load();
  }
}
