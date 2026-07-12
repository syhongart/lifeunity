#!/usr/bin/env node
// docs/team-roster.js(데이터) → team/index.html 인사기록 페이지 생성기 (의존성 0)
// 실행: node scripts/build-team.mjs   (저장소 루트 기준)
// 개발일지와 동일한 갤러리 플레이트 디자인 시스템.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'https://syhongart.github.io/artshow';
const SITE = 'ARTSHOW';
const OUT = join(ROOT, 'team');

// ---------------------------------------------------------------------------
// 명부 — 기여 건수는 개발일지(docs/DEVLOG.md)의 실제 태그·항목에서 집계한 값.
// 새 인원/기여가 생기면 이 배열만 갱신하고 재생성한다.
// ---------------------------------------------------------------------------
const ROSTER = {
  updated: '2026-07-12',
  fulltime: [
    {
      emoji: '🎬', name: '감독', handle: 'syhongart', role: '창업자 · 총괄 디렉터',
      tier: '창업자', tierClass: 'founder', joined: '2026-07', works: 42,
      note: '모든 결정의 최종 방향. 시각예술가 겸 감독 — 제품 철학과 브랜드의 원천.',
      items: ['제품 방향·전 기능 의사결정', '브랜드(청자 그린)·마스코트 컨셉', '지원금·사업화 전략'],
    },
    {
      emoji: '🧠', name: 'Fable 5', handle: '팀장', role: '개발 총괄 · 심층 판단',
      tier: '정규직', tierClass: 'staff', joined: '2026-07', works: 20,
      note: '성능 심층 디버깅, 설계 판단, 법무·전략 같은 무거운 일 담당.',
      items: ['PC 3fps 소프트웨어 렌더링 진단', '드로우콜 -62% 병합', '전문 에이전트 오케스트레이션'],
    },
    {
      emoji: '⚙️', name: 'Opus 4.8', handle: '부팀장', role: '개발 실무',
      tier: '정규직', tierClass: 'staff', joined: '2026-07', works: 6,
      note: '기능 개발·문서·QA 실무. 팀장 부재 시 개발 연속성 담당.',
      items: ['얼굴형 파츠 구현', '개발일지 블로그·인사기록', '기능 QA·배포'],
    },
  ],
  contract: [
    {
      emoji: '⚖️', name: '법무팀', role: '상표 · 규제 실사',
      tier: '계약직', tierClass: 'contract', joined: '2026-07', works: 4,
      note: '실수가 치명적인 영역 — 자가 체크가 아닌 웹 실사로 상표 충돌을 걸러낸다.',
      items: [
        "'볼리' 적신호 적발 (삼성 Ballie 국문 상표)",
        "'데구리' 적신호 적발 (포켓몬 데구리)",
        '아야모 🟢 청신호 — 최종 채택 근거',
        '코인 보상 규제 검토 (가상자산법·전금법)',
      ],
    },
    {
      emoji: '🎨', name: '디자이너', role: 'VFX · HUD · 랜딩',
      tier: '계약직', tierClass: 'contract', joined: '2026-07', works: 3,
      note: '게임급 인터랙션과 편집형 랜딩. 감독 피드백을 시각 언어로 번역.',
      items: [
        '만화 타격 이펙트 + 모바일 HUD 게임급 개편',
        '랜딩 갤러리 플레이트 전면 개편',
        '모바일 독 UX 감사',
      ],
    },
    {
      emoji: '✍️', name: '카피라이터', role: '네이밍 · 카피',
      tier: '계약직', tierClass: 'contract', joined: '2026-07', works: 2,
      note: '글로벌 기준 3음절 코이닝. (자가 체크만으로는 상표 충돌을 못 걸러 법무 실사와 짝으로 운영.)',
      items: ['마스코트 네이밍 3라운드 → 아야모', '랜딩 히어로·섹션 카피'],
    },
    {
      emoji: '⚡', name: '성능 전문가', role: '렌더링 진단',
      tier: '계약직', tierClass: 'contract', joined: '2026-07', works: 1,
      note: '프레임타임 수학으로 "씬을 깎는 방향이 틀렸다"는 감독 직관을 근거로 입증.',
      items: ['CPU 소프트웨어 래스터라이저 감지 — 250~330ms/프레임 진단'],
    },
    {
      emoji: '🔬', name: '리서처', role: '지원금 · 시장 조사',
      tier: '계약직', tierClass: 'contract', joined: '2026-07', works: 2,
      note: '현행 공고·규제를 웹 실사로 확인해 전략 근거를 만든다.',
      items: ['예술인복지재단·창업 지원금 조사', 'AI 메타버스 시장 분석'],
    },
  ],
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const maxWorks = Math.max(...[...ROSTER.fulltime, ...ROSTER.contract].map((m) => m.works));
const totalWorks = [...ROSTER.fulltime, ...ROSTER.contract].reduce((a, m) => a + m.works, 0);

function memberCard(m) {
  const pct = Math.round((m.works / maxWorks) * 100);
  return `<div class="member">
  <div class="m-top">
    <span class="m-emoji" aria-hidden="true">${m.emoji}</span>
    <div class="m-id">
      <div class="m-name">${esc(m.name)}${m.handle ? ` <span class="m-handle">${esc(m.handle)}</span>` : ''}</div>
      <div class="m-role">${esc(m.role)}</div>
    </div>
    <span class="m-badge ${m.tierClass}">${esc(m.tier)}</span>
  </div>
  <p class="m-note">${esc(m.note)}</p>
  <div class="m-bar" role="img" aria-label="기여 ${m.works}건">
    <span class="m-bar-fill" style="width:${pct}%"></span>
    <span class="m-bar-num">${m.works}건</span>
  </div>
  <ul class="m-items">${m.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
</div>`;
}

const CSS = `
:root{--gold:#5f9e7d;--gold-text:#3d6b50;--paper:#fdfbf5;--paper-deep:#f6f1e4;--panel:#fffdf9;
--ink:#17140f;--ink-body:#57503f;--ink-dim:#6b6459;--line:#e6dfcf;--g100:#e3efe7;--g300:#8fd0ab;
--g500:#5f9e7d;--g600:#4e8a6a;--g700:#3f7a5c;--g800:#2c5844;--g900:#14261d;--r:3px}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Helvetica Neue",Helvetica,Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
font-size:15px;line-height:1.7;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
a{color:var(--gold-text);text-decoration:none}
.top{display:flex;align-items:center;gap:18px;padding:14px 22px;background:var(--g900);color:#f2f2f0}
.top .logo{font-weight:700;letter-spacing:0.04em;color:#fff;font-size:16px}
.top .logo .dot{color:var(--gold)}
.top nav{margin-left:auto;display:flex;gap:18px;font-size:13px}
.top nav a{color:rgba(242,242,240,0.75)} .top nav a:hover{color:#fff}
.wrap{max-width:900px;margin:0 auto;padding:48px 22px 90px}
.eyebrow{font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:var(--gold-text);font-weight:600}
h1{font-size:clamp(26px,4.5vw,36px);line-height:1.3;margin:10px 0 6px;letter-spacing:-0.01em}
.lead{color:var(--ink-body);margin:0 0 30px}
.stat-row{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 44px}
.stat{flex:1;min-width:130px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:16px 18px}
.stat .n{font-size:26px;font-weight:600;color:var(--g700);line-height:1}
.stat .l{font-size:12px;color:var(--ink-dim);margin-top:6px;letter-spacing:0.04em}
h2.sec{font-size:15px;color:var(--g800);margin:38px 0 16px;padding-left:10px;border-left:3px solid var(--g300);letter-spacing:0.02em}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.member{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px}
.m-top{display:flex;align-items:center;gap:12px}
.m-emoji{font-size:30px;line-height:1;flex:0 0 auto}
.m-id{flex:1;min-width:0}
.m-name{font-size:16px;font-weight:600;color:var(--ink)}
.m-handle{font-size:12px;font-weight:400;color:var(--ink-dim)}
.m-role{font-size:12.5px;color:var(--ink-dim)}
.m-badge{flex:0 0 auto;font-size:11px;font-weight:600;letter-spacing:0.04em;padding:3px 9px;border-radius:2px}
.m-badge.founder{background:var(--g800);color:#eef7f1}
.m-badge.staff{background:var(--g100);color:var(--g800)}
.m-badge.contract{background:var(--paper-deep);color:var(--ink-body);border:1px solid var(--line)}
.m-note{font-size:13px;color:var(--ink-body);margin:12px 0 12px}
.m-bar{position:relative;height:20px;background:var(--paper-deep);border-radius:2px;overflow:hidden;display:flex;align-items:center}
.m-bar-fill{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,var(--g300),var(--g600));border-radius:2px}
.m-bar-num{position:relative;margin-left:auto;padding-right:8px;font-size:11px;font-weight:600;color:var(--g900)}
.m-items{margin:12px 0 0;padding-left:18px}
.m-items li{font-size:12.5px;color:var(--ink-body);margin:0 0 4px}
.note-foot{margin-top:40px;font-size:12px;color:var(--ink-dim);line-height:1.6;border-top:1px solid var(--line);padding-top:18px}
footer{border-top:1px solid var(--line);padding:26px 22px;text-align:center;color:var(--ink-dim);font-size:12.5px}
@media(max-width:640px){.grid{grid-template-columns:1fr}.top nav{gap:12px}}
`;

const jsonld = {
  '@context': 'https://schema.org', '@type': 'Organization', name: SITE,
  url: `${BASE_URL}/`, member: [...ROSTER.fulltime, ...ROSTER.contract].map((m) => ({
    '@type': 'Person', name: m.name, jobTitle: m.role,
  })),
};

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>팀 · 인사기록 — ${SITE}</title>
<meta name="description" content="ARTSHOW를 만드는 팀 — 정규직과 계약직(디자이너·법무·카피·성능·리서처)의 인사기록과 기여도. 사람과 AI가 함께 만드는 미술관.">
<link rel="canonical" href="${BASE_URL}/team/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="팀 · 인사기록 — ${SITE}">
<meta property="og:description" content="정규직과 계약직의 인사기록과 기여도 — 사람과 AI가 함께 만드는 미술관.">
<meta property="og:url" content="${BASE_URL}/team/">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <a class="logo" href="../">ARTSHOW<span class="dot">.</span></a>
  <nav>
    <a href="../team/">팀</a>
    <a href="../devlog/">개발일지</a>
    <a href="../valuation/">밸류에이션</a>
    <a href="../guide.html">가이드</a>
    <a href="../app/">입장하기</a>
  </nav>
</header>
<div class="wrap">
  <div class="eyebrow">Team · HR</div>
  <h1>팀 · 인사기록</h1>
  <p class="lead">ARTSHOW는 감독 한 사람과 AI 팀이 함께 만듭니다.<br>
  무거운 일에는 전문 계약직을 고용해 맡깁니다 — 아래는 그 기록입니다.</p>

  <div class="stat-row">
    <div class="stat"><div class="n">${ROSTER.fulltime.length}</div><div class="l">정규직 · 창업자</div></div>
    <div class="stat"><div class="n">${ROSTER.contract.length}</div><div class="l">전문 계약직</div></div>
    <div class="stat"><div class="n">${totalWorks}</div><div class="l">누적 기여 건수</div></div>
    <div class="stat"><div class="n">42</div><div class="l">공개 개발일지</div></div>
  </div>

  <h2 class="sec">정규직 · 창업자</h2>
  <div class="grid">${ROSTER.fulltime.map(memberCard).join('\n')}</div>

  <h2 class="sec">전문 계약직</h2>
  <div class="grid">${ROSTER.contract.map(memberCard).join('\n')}</div>

  <p class="note-foot">
    기여 건수는 <a href="../devlog/">공개 개발일지</a>의 실제 항목·태그에서 집계한 값입니다.
    막대는 팀 내 최대 기여자 대비 상대치입니다. 계약직은 사안이 생길 때 고용되어 실사·감사·자문을
    수행하며, 결과는 개발일지에 근거와 함께 남습니다.<br>
    <span style="color:var(--ink-dim)">최종 갱신 ${ROSTER.updated}</span>
  </p>
</div>
<footer>&copy; 2026 ARTSHOW. — 사람과 AI가 함께 만드는 미술관.</footer>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
console.log(`team: ${ROSTER.fulltime.length} 정규직 + ${ROSTER.contract.length} 계약직 → team/index.html`);
