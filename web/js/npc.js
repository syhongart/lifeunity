// npc.js — AI 관객 (치비 NPC) 시뮬레이터
// OpenArtShow Metaverse — 전시장을 돌아다니며 작품을 감상하는 앰비언트 관객.
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
const CONVO_COOLDOWN = 40;     // 짝 대화 전체 쿨다운(초)
const SLOT_SPACING = 0.62;     // 같은 작품 관람 슬롯 간격(m)
const AVOID_RADIUS = 0.9;      // 보행 중 회피 조향 감지 반경(m)
const BODY_SEP = 0.5;          // 캐릭터 몸 반경 합(m) — 이보다 겹치면 밀어낸다
const FLOOR_TOL = 1.5;         // y(눈높이) 차가 이만큼 크면 다른 층 — 회피 제외

// 같은 작품 앞에 모인 관객들의 소소한 대화 — [말 거는 쪽, 답하는 쪽]
const CONVOS = [
  [(t) => `『${t}』 색이 참 좋지 않아요?`, () => '그쵸, 한참 보게 돼요'],
  [(t) => `저 『${t}』 보러 두 번째 와요`, () => '오… 그 마음 알 것 같아요'],
  [() => '이 방 조명이 참 좋네요', () => '작품이 더 살아 보여요'],
  [(t) => `『${t}』는 실물이 훨씬 낫네요`, () => '사진으론 다 못 담죠'],
  [(t) => `『${t}』 앞에만 오면 발이 멈춰요`, () => '저도요, 신기하죠'],
];
// 꼬마악마가 답하는 쪽이면 까칠하게 받아친다
const IMP_REPLIES = [
  '흥, 보는 눈은 있으시네요',
  '그 정도로 감동하다니… 순수하시긴',
  '뭐, 나쁘진 않죠. 인정하긴 싫지만',
];

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
        x: 0, y: 0, z: 0, ry: 0, tx: 0, tz: 0, try_: 0,
        slot: 0,
        faceUntil: 0,
        facePt: null,
        greetCd: randRange(0, 20), // 입장 직후 일제히 인사하지 않게 분산
        hurtCd: 0,
      });
      const npc = this.npcs[this.npcs.length - 1];
      const pose = this._posedAt(art, npc);
      npc.x = npc.tx = pose.x;
      npc.y = pose.y;
      npc.z = npc.tz = pose.z;
      npc.ry = npc.try_ = pose.ry;
    }

    // 꼬마악마 — 작품이 가장 많은 층에 상주하는 심술 평론가 (+1명, 별도 정원)
    const impFloor = floors.reduce((a, b) => (b.length > a.length ? b : a), floors[0]);
    const impArt = rand(impFloor);
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
      x: 0, y: 0, z: 0, ry: 0, tx: 0, tz: 0, try_: 0,
      slot: 0,
      faceUntil: 0,
      facePt: null,
      greetCd: randRange(0, 15),
      hurtCd: 0,
    });
    const imp = this.npcs[this.npcs.length - 1];
    const impPose = this._posedAt(impArt, imp);
    imp.x = imp.tx = impPose.x;
    imp.y = impPose.y;
    imp.z = imp.tz = impPose.z;
    imp.ry = imp.try_ = impPose.ry;

    this._t = 0;             // 누적 시뮬레이션 시간(초) — 대화 타이머용
    this._convoCd = 15;      // 첫 대화는 입장 15초 후부터
    this._pendingReplies = [];
  }

  /**
   * 감상 위치 — 같은 작품을 보는 관객끼리 겹치지 않게 슬롯(가로 간격 + 지그재그
   * 깊이)을 배정한다. 실측 제보: 랜덤 오프셋만으로는 3명이 한 점에 포개졌음.
   */
  _slotFor(art, self) {
    const used = new Set();
    for (const n of this.npcs) {
      if (n !== self && n.art === art) used.add(n.slot);
    }
    for (const c of [0, -1, 1, -2, 2]) {
      if (!used.has(c)) return c;
    }
    return Math.floor(Math.random() * 5) - 2;
  }

  _posedAt(art, self) {
    const pose = getViewingPose(art);
    const slot = this._slotFor(art, self);
    if (self) self.slot = slot;
    const off = slot * SLOT_SPACING;
    const depth = (Math.abs(slot) % 2) * 0.45; // 옆 슬롯은 반 발짝 뒤 — 지그재그
    // 접선 = 법선을 90° 회전 → (cos(rotY), -sin(rotY)) / 깊이 = 법선 방향
    pose.x += Math.cos(art.rotY) * off + Math.sin(art.rotY) * depth;
    pose.z += -Math.sin(art.rotY) * off + Math.cos(art.rotY) * depth;
    return pose;
  }

  _pickNext(npc) {
    const candidates = npc.floorArts.filter((a) => a !== npc.art);
    npc.art = candidates.length ? weightedPick(candidates) : npc.art;
    const pose = this._posedAt(npc.art, npc);
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
    this._t += d;
    this._chatCooldown = Math.max(0, this._chatCooldown - d);
    this._convoCd = Math.max(0, this._convoCd - d);

    // 예약된 대답 처리 (짝 대화의 두 번째 대사)
    while (this._pendingReplies.length && this._pendingReplies[0].at <= this._t) {
      const r = this._pendingReplies.shift();
      this._chatQueue.push({ name: r.name, text: r.text });
    }
    // 짝 대화 시작 — 같은 작품을 보는 두 관객이 소소하게 한마디씩
    if (this._convoCd <= 0) this._tryStartConvo();

    const out = {};
    for (const npc of this.npcs) {
      npc.greetCd = Math.max(0, npc.greetCd - d);
      npc.hurtCd = Math.max(0, npc.hurtCd - d);
      if (npc.state === 'view') {
        npc.viewLeft -= d;
        // 사람이 다가오면 몸을 돌려 바라보고, 이따금 인사한다
        const near = this._nearestHuman(npc, humans);
        if (npc.stareAt && this._t < npc.stareUntil) {
          // 맞은 직후에는 때린 사람을 최우선으로 쳐다본다
          npc.ry = Math.atan2(-(npc.stareAt.x - npc.x), -(npc.stareAt.z - npc.z));
        } else if (near) {
          npc.ry = Math.atan2(-(near.x - npc.x), -(near.z - npc.z));
          if (npc.greetCd <= 0 && this._chatCooldown <= 0) {
            npc.greetCd = GREET_COOLDOWN;
            this._chatCooldown = CHAT_COOLDOWN * 0.5; // 인사는 조금 더 자주 허용
            this._chatQueue.push({ name: npc.nickname, text: rand(npc.persona === 'imp' ? IMP_GREETINGS : GREETINGS) });
          }
        } else if (npc.facePt && this._t < npc.faceUntil) {
          // 대화 중 — 상대를 마주본다
          npc.ry = Math.atan2(-(npc.facePt.x - npc.x), -(npc.facePt.z - npc.z));
        } else {
          npc.facePt = null;
          npc.ry = npc.try_; // 다시 작품을 본다
        }
        if (npc.viewLeft <= 0) this._pickNext(npc);
      } else {
        // 맞은 직후 스턴 — 잠깐 멈춰 서서 때린 사람을 쳐다본다 (이동 스킵,
        // 최종 페이로드는 아래 공통 루프가 채운다)
        if (npc.stunT > 0) {
          npc.stunT = Math.max(0, npc.stunT - d);
          if (npc.stareAt) {
            npc.ry = Math.atan2(-(npc.stareAt.x - npc.x), -(npc.stareAt.z - npc.z));
          }
          continue;
        }
        const dx = npc.tx - npc.x;
        const dz = npc.tz - npc.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= ARRIVE_DIST) {
          npc.state = 'view';
          npc.viewLeft = randRange(VIEW_TIME_MIN, VIEW_TIME_MAX) * (npc.art && npc.art.featured ? FEATURED_VIEW_MULT : 1);
          npc.ry = npc.try_; // 작품 정면을 본다
          this._maybeRemark(npc);
        } else {
          // 목표 방향 + 회피 조향 — 근처 캐릭터(NPC·사람)를 완만한 호로 비켜 간다
          let dirX = dx / dist;
          let dirZ = dz / dist;
          const avoid = this._avoidVector(npc, humans);
          if (avoid) {
            dirX += avoid.x;
            dirZ += avoid.z;
            const len = Math.hypot(dirX, dirZ) || 1;
            dirX /= len;
            dirZ /= len;
          }
          const step = Math.min(dist, npc.speed * d);
          npc.x += dirX * step;
          npc.z += dirZ * step;
          npc.ry = Math.atan2(-dirX, -dirZ); // yaw=0 → -Z 관례
        }
      }
    }

    // 관통 방지 — 조향으로 못 피한 겹침을 직접 밀어낸 뒤 최종 좌표를 내보낸다
    this._resolveOverlaps(humans);
    for (const npc of this.npcs) {
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

  /**
   * 보행 중 회피 조향 벡터 — 감지 반경 안의 다른 캐릭터에게서 멀어지는 방향의
   * 가중합. 가까울수록 세게 밀어 목표 방향과 섞으면 자연스러운 우회 호가 된다.
   */
  _avoidVector(self, humans) {
    let ax = 0;
    let az = 0;
    const consider = (x, z, weight) => {
      const dx = self.x - x;
      const dz = self.z - z;
      const d = Math.hypot(dx, dz);
      if (d >= AVOID_RADIUS || d < 1e-4) return;
      const s = (weight * (1 - d / AVOID_RADIUS)) / d;
      ax += dx * s;
      az += dz * s;
    };
    for (const n of this.npcs) {
      if (n === self || Math.abs(n.y - self.y) > FLOOR_TOL) continue;
      consider(n.x, n.z, 1.6);
    }
    for (const h of humans || []) {
      if (!h) continue;
      if (h.y != null && Math.abs(h.y - self.y) > FLOOR_TOL) continue;
      consider(h.x, h.z, 2.2); // 사람은 더 크게 비켜 준다
    }
    if (ax === 0 && az === 0) return null;
    return { x: ax, z: az };
  }

  /**
   * 겹침 하드 해소 — NPC끼리, NPC와 사람이 BODY_SEP 미만으로 포개지면 밀어낸다.
   * 걷는 쪽이 양보하고(전량 이동), 감상 중인 쪽은 슬롯 자리를 지킨다.
   * 둘 다 감상 중이면 슬롯 배정이 이미 간격을 보장하므로 건드리지 않는다.
   */
  _resolveOverlaps(humans) {
    for (let i = 0; i < this.npcs.length; i++) {
      const a = this.npcs[i];
      for (let j = i + 1; j < this.npcs.length; j++) {
        const b = this.npcs[j];
        if (Math.abs(a.y - b.y) > FLOOR_TOL) continue;
        const aWalks = a.state === 'walk';
        const bWalks = b.state === 'walk';
        if (!aWalks && !bWalks) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        if (d >= BODY_SEP || d < 1e-4) continue;
        const push = BODY_SEP - d;
        const ux = dx / d;
        const uz = dz / d;
        if (aWalks && bWalks) {
          a.x -= ux * push * 0.5; a.z -= uz * push * 0.5;
          b.x += ux * push * 0.5; b.z += uz * push * 0.5;
        } else if (aWalks) {
          a.x -= ux * push; a.z -= uz * push;
        } else {
          b.x += ux * push; b.z += uz * push;
        }
      }
      // 사람은 밀 수 없으니 NPC가 전량 양보 (감상 중이어도 — 사람이 파고들면 비켜선다)
      for (const h of humans || []) {
        if (!h) continue;
        if (h.y != null && Math.abs(h.y - a.y) > FLOOR_TOL) continue;
        const dx = a.x - h.x;
        const dz = a.z - h.z;
        const d = Math.hypot(dx, dz);
        if (d >= BODY_SEP || d < 1e-4) continue;
        const push = BODY_SEP - d;
        a.x += (dx / d) * push;
        a.z += (dz / d) * push;
      }
    }
  }

  /** 같은 작품 앞의 두 관객을 골라 대화를 시작한다 */
  _tryStartConvo() {
    const viewers = this.npcs.filter((n) => n.state === 'view' && n.viewLeft > 5);
    for (let i = 0; i < viewers.length; i++) {
      for (let j = i + 1; j < viewers.length; j++) {
        const a = viewers[i];
        const b = viewers[j];
        if (a.art !== b.art) continue;
        if (Math.hypot(a.x - b.x, a.z - b.z) > 3) continue;
        // 말 거는 쪽은 악마가 아닌 쪽 우선 (악마는 받아치는 게 어울린다)
        const [talker, replier] = a.persona === 'imp' ? [b, a] : [a, b];
        const convo = rand(CONVOS);
        const title = (talker.art && talker.art.title) || '이 작품';
        this._chatQueue.push({ name: talker.nickname, text: convo[0](title) });
        this._pendingReplies.push({
          at: this._t + randRange(2.5, 5),
          name: replier.nickname,
          text: replier.persona === 'imp' ? rand(IMP_REPLIES) : convo[1](title),
        });
        // 서로 마주보기 (대화 시간 동안)
        talker.facePt = { x: replier.x, z: replier.z };
        talker.faceUntil = this._t + 7;
        replier.facePt = { x: talker.x, z: talker.z };
        replier.faceUntil = this._t + 8;
        // 둘 다 감상 시간을 조금 연장 — 대화 중 자리 뜨지 않게
        talker.viewLeft = Math.max(talker.viewLeft, 9);
        replier.viewLeft = Math.max(replier.viewLeft, 10);
        this._convoCd = CONVO_COOLDOWN;
        this._chatCooldown = Math.max(this._chatCooldown, 8);
        return;
      }
    }
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

  /** 맞았을 때 — 때린 사람을 쳐다보며 아파한다 (호스트 전용, multiplayer.onNpcHit) */
  onHit(id, level, hitter) {
    const npc = this.npcs.find((n) => n.id === id);
    if (!npc) return;
    // 응시·스턴은 쿨다운과 무관 — 연타당해도 매번 돌아본다
    if (hitter && typeof hitter.x === 'number') {
      npc.stareAt = { x: hitter.x, z: hitter.z };
      npc.stareUntil = this._t + 2.5;
      npc.stunT = 1.2; // 걷던 중이면 멈춰 서서 쳐다본다
    }
    if (npc.hurtCd > 0) return;
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
