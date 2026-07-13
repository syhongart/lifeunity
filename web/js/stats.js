// stats.js — 작가 리포트 (서버 없는 방문·감상 통계)
// OpenArtShow Metaverse — 내 브라우저가 접속해 있는 동안 관측한 것을 전시별
// localStorage에 누적한다. 작가가 자기 전시에 들어와 있는 동안의 방문자와
// "관람객이 어느 작품 앞에 오래 머물렀는가"(인기작)를 기록한다.
//
// 한계(정직한 스코프): 서버가 없으므로 "내가 접속해 있지 않은 동안"의 방문은
// 셀 수 없다. 이후 경량 백엔드를 붙이면 이 모듈의 기록 지점(addVisit/addDwell)에
// 전송 한 줄씩만 추가하면 된다.

const STATS_PREFIX = 'lu-stats-v1-';
const DWELL_RADIUS = 3.0; // 작품 앞 "감상 중" 판정 반경(m)

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function emptyStats() {
  return { totalVisits: 0, days: {}, dwell: {} };
}

export class GalleryStats {
  /** @param {string} galleryKey - 전시별 키 (룸 suffix와 동일 규약) */
  constructor(galleryKey) {
    this.key = STATS_PREFIX + String(galleryKey || 'default');
    this._seen = new Set(); // 이 세션에서 이미 센 방문자 id (재집계 방지)
    this.data = emptyStats();
    try {
      const raw = localStorage.getItem(this.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.data = {
            totalVisits: parsed.totalVisits | 0,
            days: parsed.days && typeof parsed.days === 'object' ? parsed.days : {},
            dwell: parsed.dwell && typeof parsed.dwell === 'object' ? parsed.dwell : {},
          };
        }
      }
    } catch (_) {
      /* 프라이빗 모드 등 — 세션 메모리로만 동작 */
    }
    this._saveTimer = null;
  }

  _save() {
    if (this._saveTimer) return; // 2초 디바운스 — dwell이 매초 갱신되므로
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      try {
        localStorage.setItem(this.key, JSON.stringify(this.data));
      } catch (_) {
        /* 무시 */
      }
    }, 2000);
  }

  /** 새 방문자 관측 (원격 사람 아바타 생성 시 1회) */
  addVisit(visitorId) {
    if (!visitorId || this._seen.has(visitorId)) return;
    this._seen.add(visitorId);
    this.data.totalVisits += 1;
    const day = todayKey();
    this.data.days[day] = (this.data.days[day] | 0) + 1;
    // 일자 기록은 최근 60일만 유지
    const keys = Object.keys(this.data.days).sort();
    while (keys.length > 60) delete this.data.days[keys.shift()];
    this._save();
  }

  /**
   * 감상 체류 적립 — 주기 호출. 원격 사람 아바타들의 위치를 받아 가장 가까운
   * 작품(반경 내)에 seconds를 더한다.
   * @param {Array<{x:number,z:number}>} humanPositions
   * @param {Array<{pos:{x:number,z:number}, title:string}>} artworks
   * @param {number} seconds
   */
  addDwell(humanPositions, artworks, seconds) {
    if (!humanPositions || !humanPositions.length || !artworks || !artworks.length) return;
    let changed = false;
    for (const h of humanPositions) {
      let best = null;
      let bestD = DWELL_RADIUS;
      for (const art of artworks) {
        const d = Math.hypot(art.pos.x - h.x, art.pos.z - h.z);
        if (d < bestD) {
          bestD = d;
          best = art;
        }
      }
      if (best && best.title) {
        this.data.dwell[best.title] = (this.data.dwell[best.title] || 0) + seconds;
        changed = true;
      }
    }
    if (changed) this._save();
  }

  /** 방명록 패널용 요약 한 줄. guestbookCount는 호출부(main.js)가 넘긴다. */
  summary(guestbookCount) {
    const today = this.data.days[todayKey()] | 0;
    const parts = [`오늘 방문 ${today}`, `누적 ${this.data.totalVisits}`];
    if (typeof guestbookCount === 'number') parts.push(`방명록 ${guestbookCount}`);
    const top = Object.entries(this.data.dwell).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 10) {
      const mins = top[1] >= 60 ? `${Math.round(top[1] / 60)}분` : `${Math.round(top[1])}초`;
      parts.push(`인기작 「${top[0]}」 ${mins}`);
    }
    return parts.join(' · ');
  }
}
