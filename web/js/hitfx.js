// hitfx.js — 만화식 타격 이펙트 (콕 찌르기 리액션)
// VFX 디자인 스펙 v1.0 구현: 골드 스타버스트 + 방사 스파크 + 충격 링 +
// 의성어("콩!/빡!/퍽!!") + 어질어질 별 궤도 + 발밑 먼지. 빨강/혈흔 금지 —
// "아픔"이 아니라 골드가 팡 터지는 코믹 리액션.
//
// 아키텍처:
// - 텍스처는 모듈 로드 후 첫 히트 때 1회만 생성해 전 아바타 공유. 히트 순간에는
//   Sprite 생성 + SpriteMaterial clone(맵 공유)만 한다 — 캔버스/지오메트리 작업 0.
// - fxRoot는 아바타 최상위 group(발바닥 원점, yaw만 변함)에 부착. chibi 내부
//   wrapper는 π 회전·스쿼시 대상이라 이펙트가 함께 찌그러지므로 금지.
// - 모든 재질 depthWrite/depthTest false + renderOrder 10: 머리 구 중심에 놓여도
//   파묻히지 않는 오버레이 (닉네임 라벨과 동일 철학).

import * as THREE from 'three';

const INK = '#463a30';          // chibi 외곽선과 동일 잉크 브라운 — 한 그림처럼
const GOLD = '#d4af37';
const GOLD_HI = '#ffd75e';
const CREAM = '#fff8e7';
const SPARK_TINTS = ['#ffd75e', '#fff8e7', '#ffd75e', '#ff8fab']; // 1/4 핑크 포인트

const GLOBAL_MAX = 80;          // 씬 전역 동시 FX 스프라이트 상한
let liveSprites = 0;            // 전역 카운터 — 초과 히트는 축소 모드로

// ---- 이징 ----
const easeOutCubic = (u) => 1 - Math.pow(1 - u, 3);
const easeOutQuart = (u) => 1 - Math.pow(1 - u, 4);
const easeOutQuad = (u) => 1 - (1 - u) * (1 - u);
const easeOutBack = (u) => 1 + 2.7 * Math.pow(u - 1, 3) + 1.7 * Math.pow(u - 1, 2);

// ---------------------------------------------------------------------------
// "아얏!" 사운드 — WebAudio 합성 (에셋 없음). 2음절: "아"(짧게 치솟는 톤) →
// "얏!"(높은 데서 뚝 떨어지는 톤). 히트마다 피치를 살짝 흔들어 반복감을 줄인다.
// AudioContext는 지연 생성 — 입장(사용자 제스처) 이후이므로 재생 제약 없음.
// ---------------------------------------------------------------------------
let _actx = null;
let _lastOuch = 0;

function getAudio() {
  if (!_actx) {
    try {
      _actx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) { return null; }
  }
  if (_actx.state === 'suspended') _actx.resume().catch(() => {});
  return _actx;
}

/** 맞았을 때 귀여운 비명 — level 1~3 (셀수록 높고 길게 떨어진다) */
export function playOuch(levelIn) {
  const now = performance.now();
  if (now - _lastOuch < 130) return; // 다발 히트 불협화음 방지
  _lastOuch = now;
  const ctx = getAudio();
  if (!ctx) return;
  const lv = Math.max(1, Math.min(3, levelIn | 0 || 1));
  const jit = 0.92 + Math.random() * 0.16;
  const t0 = ctx.currentTime + 0.01;

  // "아" — 짧게 치솟음
  const o1 = ctx.createOscillator();
  o1.type = 'triangle';
  o1.frequency.setValueAtTime(480 * jit * (1 + 0.1 * (lv - 1)), t0);
  o1.frequency.exponentialRampToValueAtTime(760 * jit, t0 + 0.07);
  const g1 = ctx.createGain();
  g1.gain.setValueAtTime(0.0001, t0);
  g1.gain.exponentialRampToValueAtTime(0.2, t0 + 0.015);
  g1.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
  o1.connect(g1).connect(ctx.destination);
  o1.start(t0);
  o1.stop(t0 + 0.1);

  // "얏!" — 급낙하
  const t1 = t0 + 0.1;
  const fall = 0.16 + 0.05 * lv;
  const o2 = ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(820 * jit * (1 + 0.14 * (lv - 1)), t1);
  o2.frequency.exponentialRampToValueAtTime(300 * jit, t1 + fall);
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.0001, t1);
  g2.gain.exponentialRampToValueAtTime(0.24, t1 + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.0001, t1 + fall + 0.05);
  o2.connect(g2).connect(ctx.destination);
  o2.start(t1);
  o2.stop(t1 + fall + 0.1);
}

// ---------------------------------------------------------------------------
// 공유 텍스처 (지연 1회 생성)
// ---------------------------------------------------------------------------
let TEX = null;

function cv(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// T1. 스타버스트 — 24정점 뾰족 방사 + 백색 코어 별
function texStarburst() {
  const c = cv(256);
  const x = c.getContext('2d');
  x.translate(128, 128);
  x.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = (i % 2 === 0 ? 118 : 56) + (Math.random() * 14 - 7); // 손그림 지터
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 118);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.32, '#fff3c4');
  g.addColorStop(0.72, GOLD);
  g.addColorStop(1, '#c89b2a');
  x.fillStyle = g;
  x.fill();
  x.strokeStyle = INK;
  x.lineWidth = 9;
  x.lineJoin = 'miter';
  x.stroke();
  x.beginPath(); // 플래시 코어 (12각 별)
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 === 0 ? 52 : 26;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  x.fillStyle = '#ffffff';
  x.fill();
  return new THREE.CanvasTexture(c);
}

// T2. 스파크 잔별 — 4각 반짝 (흰색, 틴트용)
function texSpark() {
  const c = cv(64);
  const x = c.getContext('2d');
  x.beginPath();
  x.moveTo(32, 4);
  x.quadraticCurveTo(38, 26, 60, 32);
  x.quadraticCurveTo(38, 38, 32, 60);
  x.quadraticCurveTo(26, 38, 4, 32);
  x.quadraticCurveTo(26, 26, 32, 4);
  x.closePath();
  x.fillStyle = '#ffffff';
  x.fill();
  x.strokeStyle = INK;
  x.lineWidth = 3;
  x.stroke();
  return new THREE.CanvasTexture(c);
}

// T3. 충격 링 — 만화식 이중선 (흰색, 틴트용)
function texRing() {
  const c = cv(128);
  const x = c.getContext('2d');
  x.strokeStyle = '#ffffff';
  x.lineWidth = 13;
  x.beginPath();
  x.arc(64, 64, 48, 0, Math.PI * 2);
  x.stroke();
  x.strokeStyle = 'rgba(70,58,48,0.9)';
  x.lineWidth = 3;
  for (const r of [55, 41]) {
    x.beginPath();
    x.arc(64, 64, r, 0, Math.PI * 2);
    x.stroke();
  }
  return new THREE.CanvasTexture(c);
}

// T4. 어질어질 별 — 5각 골드 별 + 하이라이트
function texDizzy() {
  const c = cv(64);
  const x = c.getContext('2d');
  x.translate(32, 34);
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 26 : 11;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  const g = x.createLinearGradient(0, -26, 0, 26);
  g.addColorStop(0, GOLD_HI);
  g.addColorStop(1, GOLD);
  x.fillStyle = g;
  x.fill();
  x.strokeStyle = INK;
  x.lineWidth = 3.5;
  x.lineJoin = 'round';
  x.stroke();
  x.beginPath();
  x.arc(-6, -12, 5, 0, Math.PI * 2);
  x.fillStyle = '#ffffff';
  x.fill();
  return new THREE.CanvasTexture(c);
}

// T5. 먼지 퍼프 — 뭉게 원 3개 (흰색, 틴트용)
function texDust() {
  const c = cv(64);
  const x = c.getContext('2d');
  for (const [px, py, r] of [[24, 38, 16], [42, 36, 13], [33, 26, 11]]) {
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.arc(px, py, r, 0, Math.PI * 2);
    x.fill();
  }
  return new THREE.CanvasTexture(c);
}

// T6~T8. 의성어 — 글자별 기울임 + 잉크/크림/골드 3중 스트로크
function texWord(word, emphasis) {
  const font = '900 128px Pretendard, "Apple SD Gothic Neo", sans-serif';
  const probe = cv(8).getContext('2d');
  probe.font = font;
  const w = Math.ceil(probe.measureText(word).width) + 140;
  const h = 230;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.font = font;
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  let penX = 70;
  const glyphs = Array.from(word);
  for (let i = 0; i < glyphs.length; i++) {
    const ch = glyphs[i];
    const cw = x.measureText(ch).width;
    x.save();
    x.translate(penX + cw / 2, h / 2);
    x.rotate(((i === 0 ? -6 : i % 2 ? 5 : -5) * Math.PI) / 180);
    x.strokeStyle = INK;
    x.lineWidth = 26;
    x.strokeText(ch, -cw / 2, 0);
    x.strokeStyle = '#fffdf7';
    x.lineWidth = 12;
    x.strokeText(ch, -cw / 2, 0);
    const g = x.createLinearGradient(0, -64, 0, 64);
    g.addColorStop(0, '#fff8e7');
    g.addColorStop(0.55, GOLD_HI);
    g.addColorStop(1, GOLD);
    x.fillStyle = g;
    x.fillText(ch, -cw / 2, 0);
    x.restore();
    penX += cw;
  }
  if (emphasis) {
    // 좌우 이중 강조선 — "소리가 큰" 만화 기호
    x.strokeStyle = INK;
    x.lineWidth = 6;
    x.lineCap = 'round';
    for (const side of [-1, 1]) {
      const bx = side < 0 ? 34 : w - 34;
      for (const dy of [-16, 16]) {
        x.beginPath();
        x.moveTo(bx, h / 2 + dy);
        const a = ((dy < 0 ? -8 : 8) * Math.PI) / 180;
        x.lineTo(bx - side * 28 * Math.cos(a), h / 2 + dy + 28 * Math.sin(a) * (dy < 0 ? -1 : 1));
        x.stroke();
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.userData = { aspect: w / h };
  return tex;
}

function getTex() {
  if (!TEX) {
    TEX = {
      star: texStarburst(),
      spark: texSpark(),
      ring: texRing(),
      dizzy: texDizzy(),
      dust: texDust(),
      words: [texWord('콩!'), texWord('빡!'), texWord('퍽!!', true)],
    };
  }
  return TEX;
}

// ---------------------------------------------------------------------------
// 이펙트 인스턴스
// ---------------------------------------------------------------------------

function makeSprite(map, tint) {
  const mat = new THREE.SpriteMaterial({
    map,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  if (tint) mat.color.set(tint);
  const s = new THREE.Sprite(mat);
  s.renderOrder = 10;
  liveSprites++;
  return s;
}

/**
 * 아바타 최상위 group에 타격 FX를 부착한다.
 * 반환 API: hit(level 1~3), update(delta), dispose()
 */
export function attachHitFx(group) {
  const root = new THREE.Group();
  group.add(root);
  const items = []; // { sprite, t, start, life, tick(item), dizzy? }

  function kill(item) {
    root.remove(item.sprite);
    item.sprite.material.dispose(); // 공유 텍스처는 dispose 금지
    liveSprites--;
  }

  // 새 히트 진입: 어질 별(타이머 리셋)만 남기고 즉시 정리
  function clearBurst() {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].dizzy) continue;
      kill(items[i]);
      items.splice(i, 1);
    }
  }

  function hit(levelIn) {
    const T = getTex();
    const level = Math.max(1, Math.min(3, levelIn | 0 || 1));
    clearBurst();
    playOuch(level); // "아얏!" — 시각 이펙트와 한 몸
    const reduced = liveSprites > GLOBAL_MAX; // 예산 초과 — 핵심 2요소만

    const P = { x: 0, y: 1.06, z: 0 }; // 임팩트 포인트 (머리 중심 살짝 위)

    // A. 스타버스트 — 임팩트 프레임 (페이드인 금지, 첫 프레임 85% 등장)
    {
      const dia = [0.48, 0.62, 0.85][level - 1];
      const sp = makeSprite(T.star);
      sp.material.rotation = Math.random() * Math.PI * 2;
      sp.position.set(P.x, P.y, P.z);
      sp.scale.set(dia * 0.85, dia * 0.85, 1);
      root.add(sp);
      items.push({
        sprite: sp, t: 0, start: 0, life: 0.24,
        tick(it) {
          const t = it.t;
          let s = dia;
          if (t < 0.07) s = dia * (0.85 + 0.15 * easeOutQuart(t / 0.07));
          else if (t > 0.16) {
            const u = (t - 0.16) / 0.08;
            s = dia * (1 + 0.12 * u);
            sp.material.opacity = 1 - u; // 스냅 소멸 — 잔향 없는 타격음
          }
          sp.scale.set(s, s, 1);
          if (level === 3 && t < 0.1) {
            sp.material.color.set('#ffffff').lerp(new THREE.Color(GOLD_HI), t / 0.1);
          }
        },
      });
    }

    // D. 의성어 — 0.03초 늦게 (만화 타이밍 계단)
    {
      const tex = T.words[level - 1];
      const H = [0.3, 0.38, 0.46][level - 1];
      const W = H * tex.userData.aspect;
      const side = Math.random() < 0.5 ? -1 : 1;
      const sp = makeSprite(tex);
      sp.material.rotation = side * -0.14;
      sp.position.set(side * 0.34, 1.38, 0);
      sp.scale.set(0.001, 0.001, 1);
      root.add(sp);
      const baseRot = side * -0.14;
      items.push({
        sprite: sp, t: 0, start: 0.03, life: 0.7,
        tick(it) {
          const t = it.t;
          if (t < 0.17) {
            const k = easeOutBack(Math.min(1, (t - 0.0) / 0.14));
            sp.scale.set(Math.max(0.001, W * k), Math.max(0.001, H * k), 1);
          } else {
            sp.scale.set(W, H, 1);
          }
          if (level === 3 && t > 0.17 && t < 0.37) {
            sp.material.rotation = baseRot + 0.07 * Math.sin(t * 110); // 진동 = 굉음
          } else {
            sp.material.rotation = baseRot;
          }
          if (t > 0.45) {
            const u = Math.min(1, (t - 0.45) / 0.25);
            sp.position.y = 1.38 + 0.12 * easeOutQuad(u);
            sp.material.opacity = 1 - u;
          }
        },
      });
    }

    if (reduced) return;

    // B. 방사 스파크
    {
      const n = [6, 8, 10][level - 1];
      const reach = [0.5, 0.62, 0.75][level - 1];
      for (let i = 0; i < n; i++) {
        // 단위 구 랜덤 (|y| ≤ 0.75 — 위아래 몰림 방지)
        let vx; let vy; let vz;
        do {
          vx = Math.random() * 2 - 1;
          vy = Math.random() * 2 - 1;
          vz = Math.random() * 2 - 1;
        } while (Math.hypot(vx, vy, vz) > 1 || Math.hypot(vx, vy, vz) < 0.3 || Math.abs(vy) > 0.75);
        const L = Math.hypot(vx, vy, vz);
        vx /= L; vy /= L; vz /= L;
        const sp = makeSprite(T.spark, SPARK_TINTS[i % SPARK_TINTS.length]);
        sp.position.set(P.x + vx * 0.18, P.y + vy * 0.18, P.z + vz * 0.18);
        sp.scale.set(0.14, 0.14, 1);
        root.add(sp);
        items.push({
          sprite: sp, t: 0, start: 0, life: 0.32,
          tick(it) {
            const u = it.t / 0.32;
            const r = 0.18 + (reach - 0.18) * easeOutCubic(u);
            sp.position.set(P.x + vx * r, P.y + vy * r, P.z + vz * r);
            const s = 0.14 + (0.05 - 0.14) * u;
            sp.scale.set(s, s, 1);
            sp.material.opacity = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
          },
        });
      }
    }

    // C. 충격 링 (L2+)
    if (level >= 2) {
      const target = level === 2 ? 0.85 : 1.05;
      const sp = makeSprite(T.ring, GOLD);
      sp.position.set(P.x, P.y, P.z);
      sp.material.opacity = 0.85;
      root.add(sp);
      items.push({
        sprite: sp, t: 0, start: 0, life: 0.28,
        tick(it) {
          const u = it.t / 0.28;
          const s = 0.25 + (target - 0.25) * easeOutQuart(u);
          sp.scale.set(s, s, 1);
          if (u > 0.3) sp.material.opacity = 0.85 * (1 - (u - 0.3) / 0.7);
        },
      });
    }

    // E. 어질어질 별 궤도 (L2+) — 여운 담당. 이미 돌고 있으면 타이머만 리셋
    if (level >= 2) {
      const existing = items.filter((it) => it.dizzy);
      const want = level === 2 ? 3 : 4;
      const life = level === 2 ? 1.2 : 1.8;
      const omega = level === 2 ? 4.2 : 5.2;
      const size = level === 2 ? 0.09 : 0.11;
      if (existing.length) {
        for (const it of existing) { it.t = Math.min(it.t, it.start); it.life = it.start + life; it.omega = omega; }
      } else {
        for (let i = 0; i < want; i++) {
          const sp = makeSprite(T.dizzy);
          sp.material.opacity = 0;
          sp.scale.set(size, size, 1);
          root.add(sp);
          const item = {
            sprite: sp, t: 0, start: 0.15, life: 0.15 + life, dizzy: true, omega,
            tick(it) {
              const t = it.t;
              const a = (i / want) * Math.PI * 2 + it.omega * t;
              sp.position.set(Math.cos(a) * 0.26, 1.48 + 0.03 * Math.sin(6 * t + i), Math.sin(a) * 0.26);
              sp.material.rotation += 3.0 * it.dt;
              const lifeT = it.life - it.start;
              const u = (t - it.start) / lifeT;
              let op = 1;
              if (t - it.start < 0.1) op = (t - it.start) / 0.1;
              else if (u > 1 - 0.25 / lifeT) op = Math.max(0, (1 - u) / (0.25 / lifeT));
              sp.material.opacity = op;
            },
          };
          items.push(item);
        }
      }
    }

    // F. 발밑 먼지 퍼프 (L3) — 스쿼시가 눌릴 때
    if (level === 3) {
      const spots = [[-0.22, 0.07, 0.06], [0.24, 0.07, -0.05], [0.02, 0.06, 0.24]];
      for (const [dx, dy, dz] of spots) {
        const sp = makeSprite(T.dust, CREAM);
        sp.material.opacity = 0.6;
        sp.position.set(dx, dy, dz);
        sp.scale.set(0.12, 0.12, 1);
        root.add(sp);
        const ox = dx; const oz = dz;
        const outX = Math.sign(dx || 0.1) * 0.08;
        const outZ = Math.sign(dz || 0.1) * 0.08;
        items.push({
          sprite: sp, t: 0, start: 0.05, life: 0.45,
          tick(it) {
            const u = Math.min(1, (it.t - 0.05) / 0.4);
            const k = easeOutQuad(u);
            const s = 0.12 + 0.18 * k;
            sp.scale.set(s, s, 1);
            sp.position.set(ox + outX * k, dy, oz + outZ * k);
            sp.material.opacity = 0.6 * (1 - u);
          },
        });
      }
    }
  }

  function update(delta) {
    if (!items.length) return;
    const d = Math.min(delta || 0, 0.1);
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.t += d;
      it.dt = d;
      if (it.t < it.start) { it.sprite.visible = false; continue; }
      it.sprite.visible = true;
      it.tick(it);
      if (it.t >= it.life) {
        kill(it);
        items.splice(i, 1);
      }
    }
  }

  function dispose() {
    for (const it of items) kill(it);
    items.length = 0;
    group.remove(root);
  }

  return { hit, update, dispose };
}
