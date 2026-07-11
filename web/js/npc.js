// npc.js — AI 관객 (치비 NPC) 시뮬레이터
// ARTSHOW Metaverse — 전시장을 돌아다니며 작품을 감상하는 앰비언트 관객.
//
// 아키텍처: 시뮬레이션은 "호스트만" 돌리고, 결과 상태를 기존 멀티플레이
// states 브로드캐스트에 합류시킨다(multiplayer.js의 npcProvider 훅). 접속자
// 전원이 같은 NPC를 같은 위치에서 보게 되고, 게스트 쪽 렌더링·보간·걷기
// 애니메이션은 사람 플레이어와 완전히 동일한 경로를 탄다 — NPC 전용 렌더
// 코드가 없다.
//
// 행동 모델(작품 중심 상태기계):
//   WALK  — 다음 감상 지점까지 직선 보행 (같은 층 안에서만 이동)
//   VIEW  — 작품 정면(getViewingPose)에 서서 7~16초 감상, 이따금 한마디
// 층간 이동(계단 내비게이션)은 하지 않는다 — NPC마다 담당 층을 배정해
// 지하 미디어관부터 옥상까지 골고루 살아있게 한다.

import { encodeChibi } from './chibi.js';
import { getViewingPose } from './artworks.js';

const NPC_NAMES = ['모네홀릭', '별헤는밤', '느린산책', '점묘덕후', '푸른시간', '수집가K'];
const NPC_COLORS = ['#e07a5f', '#81b29a', '#f2cc8f', '#8e7dbe', '#6a8caf', '#d68fb8'];

// 랜덤 치비 룩 재료 — 관객답게 차분한 조합 위주
const SKINS = ['#ffd9bd', '#f0c8a8', '#e0b090', '#c98d66'];
const HAIRS = ['#6b4530', '#2b2b33', '#8a4be0', '#d96c2c', '#c9a227', '#4a5568'];
const CLOTHES = ['#ff8fab', '#ffd166', '#7ec4cf', '#95d5b2', '#5468c4', '#b799ff', '#e0596e', '#3a3f4a'];
const HAIR_STYLES = ['twintail', 'bob', 'ponytail', 'buns', 'short'];
const EYE_STYLES = ['sparkle', 'round', 'happy'];
const MOUTHS = ['smile', 'cat', 'open'];
const ACCS = ['none', 'ribbon', 'flower', 'none'];

const REMARKS = [
  (t) => `『${t}』 앞에서 발이 안 떨어지네요`,
  (t) => `『${t}』 색감이 정말 좋다...`,
  () => '이 방 분위기 너무 좋아요',
  (t) => `『${t}』 실물로 보니 다르네요`,
  () => '천천히 둘러보는 중이에요 🚶',
  (t) => `『${t}』 한참 보게 되는 작품이에요`,
];

const WALK_SPEED_MIN = 0.75;
const WALK_SPEED_MAX = 1.05;
const VIEW_TIME_MIN = 7;
const VIEW_TIME_MAX = 16;
const CHAT_CHANCE = 0.3;       // 감상 시작 시 한마디 확률
const CHAT_COOLDOWN = 30;      // 전체 NPC 공용 채팅 쿨다운(초) — 스팸 방지
const ARRIVE_DIST = 0.15;
const FEATURED_WEIGHT = 3;     // 인기작(대표작) 선택 가중치 — 관객이 모이는 연출
const FEATURED_VIEW_MULT = 1.7; // 인기작 감상 시간 배수
const GREET_DIST = 2.3;        // 사람 접근 인사 거리(m)
const GREET_COOLDOWN = 60;     // NPC별 인사 쿨다운(초)

const GREETINGS = [
  '안녕하세요! 같이 봐요 ☺️',
  '어서 오세요~ 여기 작품 좋아요',
  '안녕하세요, 천천히 둘러보세요!',
];

// ---- 꼬마악마 (뿔 달린 심술 평론가) — 작품을 꼬아서 평가한다 ----
const IMP_NAME = '꼬마악마';
const IMP_REMARKS = [
  (t) => `『${t}』... 흠, 색만 요란하네요`,
  (t) => `『${t}』 이 정도는 나도 그리겠는데요?`,
  (t) => `『${t}』 액자가 아깝... 농담이에요. 반쯤은.`,
  (t) => `솔직히 『${t}』는 과대평가 아닌가요?`,
  (t) => `『${t}』 앞에서 다들 감동한 척은... 쳇`,
  (t) => `『${t}』 나쁘진 않네요. 인정하긴 싫지만.`,
  (t) => `흥, 『${t}』... 자꾸 눈이 가서 짜증나네`,
];
const IMP_GREETINGS = [
  '왜요. 뭐요.',
  '흥, 말 걸지 마세요. ...뭐 봐요?',
  '나 바빠요. 혹평할 작품이 많거든요.',
];
const IMP_HURT = [
  '지금... 때렸어요?! 기억해두죠.',
  '아야!! 이 미술관 매너 뭐예요?!',
  '으윽... 뿔 부러지면 책임질 거예요?!',
  '흑... 안 아프거든요?! 하나도!!',
];
const HURT_LINES = [
  '아야!!',
  '으앙, 왜 때려요 ㅠㅠ',
  '아야... 아프단 말이에요',
];
const IMP_LOOK = {
  hairStyle: 'short',
  hairColor: '#3a2430',
  skin: '#f2c8a0',
  eyeStyle: 'round',
  eyeColor: '#b02e2e',
  mouth: 'cat',
  blush: false,
  top: '#3a3f4a',
  bottom: '#8e2635',
  bottomType: 'pants',
  shoes: '#2b2b33',
  acc: 'horns',
};

// 가중치 랜덤 — 인기작(featured)이 더 자주 뽑히게
function weightedPick(arts) {
  let total = 0;
  for (const a of arts) total += a.featured ? FEATURED_WEIGHT : 1;
  let r = Math.random() * total;
  for (const a of arts) {
    r -= a.featured ? FEATURED_WEIGHT : 1;
    if (r <= 0) return a;
  }
  return arts[arts.length - 1];
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randRange(a, b) {
  return a + Math.random() * (b - a);
}

function randomChibiChar() {
  return encodeChibi({
    skin: rand(SKINS),
    hairStyle: rand(HAIR_STYLES),
    hairColor: rand(HAIRS),
    eyeStyle: rand(EYE_STYLES),
    eyeColor: rand(['#7a4a2f', '#3f6f8f', '#4f7a3a', '#2b2b33']),
    mouth: rand(MOUTHS),
    blush: Math.random() < 0.75,
    top: rand(CLOTHES),
    bottom: rand(CLOTHES),
    bottomType: Math.random() < 0.5 ? 'skirt' : 'pants',
    shoes: rand(['#fffdf7', '#3a3f4a', '#e0596e']),
    acc: rand(ACCS),
  });
}

export class NpcCrowd {
  /**
   * @param {Array} artworks - getPlacedArtworks() 결과 (pos/rotY/floorY/title)
   * @param {number} count - NPC 수 (작품 있는 층 수에 맞춰 자동 감축)
   */
  constructor(artworks, count = null) {
    this._chatQueue = [];
    this._chatCooldown = 10; // 입장 직후 잠깐은 조용히
    this.npcs = [];

    // 층별 작품 그룹 — NPC마다 담당 층을 배정한다
    const byFloor = new Map();
    for (const art of artworks || []) {
      if (!art || !art.pos) continue;
      const key = Math.round((art.floorY || 0) * 10);
      if (!byFloor.has(key)) byFloor.set(key, []);
      byFloor.get(key).push(art);
    }
    // 작품 2점 이상인 층만 순회 대상 (1점이면 감상만 반복)
    const floors = Array.from(byFloor.values()).filter((list) => list.length >= 1);
    if (floors.length === 0) return;

    // 인원 자동 조절: 작품이 있는 층당 2명, 최소 3 최대 6 (명시 count가 우선)
    const auto = Math.max(3, Math.min(6, floors.length * 2));
    const n = Math.min(count || auto, NPC_NAMES.length);
    for (let i = 0; i < n; i++) {
      const floorArts = floors[i % floors.length];
      const art = rand(floorArts);
      const pose = this._posedAt(art);
      this.npcs.push({
        id: `npc-${i + 1}`,
        nickname: NPC_NAMES[i],
        color: NPC_COLORS[i % NPC_COLORS.length],
        char: randomChibiChar(),
        persona: 'normal',
        floorArts,
        art,
        state: 'view',
        viewLeft: randRange(2, VIEW_TIME_MAX), // 시작 시점 분산
        speed: randRange(WALK_SPEED_MIN, WALK_SPEED_MAX),
        x: pose.x,
        y: pose.y,
        z: pose.z,
        ry: pose.ry,
        tx: pose.x,
        tz: pose.z,
        try_: pose.ry,
        greetCd: randRange(0, 20), // 입장 직후 일제히 인사하지 않게 분산
        hurtCd: 0,
      });
    }

    // 꼬마악마 — 작품이 가장 많은 층에 상주하는 심술 평론가 (+1명, 별도 정원)
    const impFloor = floors.reduce((a, b) => (b.length > a.length ? b : a), floors[0]);
    const impArt = rand(impFloor);
    const impPose = this._posedAt(impArt);
    this.npcs.push({
      id: 'npc-imp',
      nickname: IMP_NAME,
      color: '#b02e2e',
      char: encodeChibi(IMP_LOOK),
      persona: 'imp',
      floorArts: impFloor,
      art: impArt,
      state: 'view',
      viewLeft: randRange(4, VIEW_TIME_MAX),
      speed: randRange(WALK_SPEED_MIN, WALK_SPEED_MAX),
      x: impPose.x,
      y: impPose.y,
      z: impPose.z,
      ry: impPose.ry,
      tx: impPose.x,
      tz: impPose.z,
      try_: impPose.ry,
      greetCd: randRange(0, 15),
      hurtCd: 0,
    });
  }

  /** 감상 위치 + 겹침 방지용 소폭 좌우 오프셋(벽 접선 방향) */
  _posedAt(art) {
    const pose = getViewingPose(art);
    const off = randRange(-0.55, 0.55);
    // 접선 = 법선을 90° 회전 → (cos(rotY), -sin(rotY))
    pose.x += Math.cos(art.rotY) * off;
    pose.z += -Math.sin(art.rotY) * off;
    return pose;
  }

  _pickNext(npc) {
    const candidates = npc.floorArts.filter((a) => a !== npc.art);
    npc.art = candidates.length ? weightedPick(candidates) : npc.art;
    const pose = this._posedAt(npc.art);
    npc.tx = pose.x;
    npc.tz = pose.z;
    npc.try_ = pose.ry;
    npc.state = 'walk';
    npc.speed = randRange(WALK_SPEED_MIN, WALK_SPEED_MAX);
  }

  /**
   * 매 프레임 시뮬레이션 진행 + states 페이로드 반환 (호스트 전용 호출).
   * @param {number} delta
   * @param {Array<{x:number,z:number}>} [humans] - 사람 플레이어 위치(호스트+게스트)
   */
  update(delta, humans) {
    const d = Math.min(delta || 0, 0.1);
    this._chatCooldown = Math.max(0, this._chatCooldown - d);
    const out = {};
    for (const npc of this.npcs) {
      npc.greetCd = Math.max(0, npc.greetCd - d);
      npc.hurtCd = Math.max(0, npc.hurtCd - d);
      if (npc.state === 'view') {
        npc.viewLeft -= d;
        // 사람이 다가오면 몸을 돌려 바라보고, 이따금 인사한다
        const near = this._nearestHuman(npc, humans);
        if (near) {
          npc.ry = Math.atan2(-(near.x - npc.x), -(near.z - npc.z));
          if (npc.greetCd <= 0 && this._chatCooldown <= 0) {
            npc.greetCd = GREET_COOLDOWN;
            this._chatCooldown = CHAT_COOLDOWN * 0.5; // 인사는 조금 더 자주 허용
            this._chatQueue.push({ name: npc.nickname, text: rand(npc.persona === 'imp' ? IMP_GREETINGS : GREETINGS) });
          }
        } else {
          npc.ry = npc.try_; // 사람이 떠나면 다시 작품을 본다
        }
        if (npc.viewLeft <= 0) this._pickNext(npc);
      } else {
        const dx = npc.tx - npc.x;
        const dz = npc.tz - npc.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= ARRIVE_DIST) {
          npc.state = 'view';
          npc.viewLeft = randRange(VIEW_TIME_MIN, VIEW_TIME_MAX) * (npc.art && npc.art.featured ? FEATURED_VIEW_MULT : 1);
          npc.ry = npc.try_; // 작품 정면을 본다
          this._maybeRemark(npc);
        } else {
          const step = Math.min(dist, npc.speed * d);
          npc.x += (dx / dist) * step;
          npc.z += (dz / dist) * step;
          npc.ry = Math.atan2(-dx, -dz); // yaw=0 → -Z 관례
        }
      }
      out[npc.id] = {
        nickname: npc.nickname,
        color: npc.color,
        char: npc.char,
        npc: true,
        x: npc.x,
        y: npc.y, // getViewingPose가 이미 눈높이(floorY+EYE_HEIGHT) 관례
        z: npc.z,
        ry: npc.ry,
      };
    }
    return out;
  }

  _nearestHuman(npc, humans) {
    if (!humans || !humans.length) return null;
    let best = null;
    let bestD = GREET_DIST;
    for (const h of humans) {
      if (!h) continue;
      const dist = Math.hypot(h.x - npc.x, h.z - npc.z);
      if (dist < bestD) {
        bestD = dist;
        best = h;
      }
    }
    return best;
  }

  _maybeRemark(npc) {
    const imp = npc.persona === 'imp';
    // 꼬마악마는 혹평이 본업이라 더 자주(0.55), 쿨다운도 짧게 쓴다
    if (this._chatCooldown > 0 || Math.random() > (imp ? 0.55 : CHAT_CHANCE)) return;
    this._chatCooldown = imp ? CHAT_COOLDOWN * 0.6 : CHAT_COOLDOWN;
    const title = (npc.art && npc.art.title) || '이 작품';
    this._chatQueue.push({ name: npc.nickname, text: rand(imp ? IMP_REMARKS : REMARKS)(title) });
  }

  /** 맞았을 때 — 아파하는 한마디 (호스트 전용, multiplayer.onNpcHit이 호출) */
  onHit(id, level) {
    const npc = this.npcs.find((n) => n.id === id);
    if (!npc || npc.hurtCd > 0) return;
    npc.hurtCd = 8;
    const pool = npc.persona === 'imp' ? IMP_HURT : HURT_LINES;
    let text = pool[Math.min(pool.length - 1, Math.max(0, (level | 0) - 1))];
    if (level >= 3 && npc.persona !== 'imp') text = '으앙 ㅠㅠ 그만 때려요!! 진짜 아파요!!';
    this._chatQueue.push({ name: npc.nickname, text });
  }

  /** 대기 중인 NPC 채팅 한 건을 꺼낸다 (없으면 null) */
  takeChat() {
    return this._chatQueue.shift() || null;
  }
}
