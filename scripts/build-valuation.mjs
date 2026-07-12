#!/usr/bin/env node
// 시장가치 추적기 — DEVLOG 신호 + 트랙션 입력으로 밸류에이션을 산출하고
// docs/valuation-history.json에 일자별 누적, valuation/index.html에 그래프를 그린다.
// 실행: node scripts/build-valuation.mjs  (저장소 루트 기준, 하루 1회 멱등)
//
// 모델(결정론적·공개 — 근거는 페이지 하단):
//   자산가치(만원)  = 8,000(원가재현 하한) + 개발일지건수 × 100(문서·IP 축적)
//   실현가치(만원)  = 자산가치 + 트랙션 기여
//       + 상설갤러리 × 30
//       + MAU × 1
//       + 월매출(만원) × 12 × 8   (ARR × 시드 배수 8)
//   시장범위(조건부) = 자산가치 × 4 ~ × 12   ※트랙션 확보 시 잠재 범위
//   목표선          = 500,000만 (50억)
//   트랙션은 docs/traction.json { galleries, mau, mrr } 에서 읽는다(없으면 0).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'https://syhongart.github.io/openartshow';
const SITE = 'ARTSHOW';
const HIST = join(ROOT, 'docs', 'valuation-history.json');
const TRACTION = join(ROOT, 'docs', 'traction.json');
const OUT = join(ROOT, 'valuation');
const GOAL = 500000; // 50억 (만원)

const kstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// --- 신호 집계 ---
const devlog = readFileSync(join(ROOT, 'docs', 'DEVLOG.md'), 'utf8');
const devlogCount = (devlog.match(/^## \d{4}-\d{2}-\d{2} · /gm) || []).length;

let traction = { galleries: 0, mau: 0, mrr: 0 };
if (existsSync(TRACTION)) {
  try { traction = Object.assign(traction, JSON.parse(readFileSync(TRACTION, 'utf8'))); } catch { /* 무시 */ }
}

// --- 밸류에이션 모델 ---
const asset = 8000 + devlogCount * 100;
const tractionValue = traction.galleries * 30 + traction.mau * 1 + traction.mrr * 12 * 8;
const realized = asset + tractionValue;
const mktLow = Math.round(asset * 4);
const mktHigh = Math.round(asset * 12);
const point = {
  date: kstDate, devlogs: devlogCount,
  galleries: traction.galleries, mau: traction.mau, mrr: traction.mrr,
  asset, realized, mktLow, mktHigh,
};

// --- 히스토리 멱등 upsert ---
let history = [];
if (existsSync(HIST)) { try { history = JSON.parse(readFileSync(HIST, 'utf8')); } catch { history = []; } }
// 구버전 포인트 보정: realized 없으면 asset으로
history = history.map((h) => ({ ...h, realized: h.realized ?? h.asset,
  galleries: h.galleries ?? 0, mau: h.mau ?? 0, mrr: h.mrr ?? 0 }));
const idx = history.findIndex((h) => h.date === kstDate);
if (idx >= 0) history[idx] = point; else history.push(point);
history.sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(HIST, JSON.stringify(history, null, 2) + '\n');

function won(manwon) {
  const eok = manwon / 10000;
  if (eok >= 1) return `${(Math.round(eok * 100) / 100).toLocaleString('ko-KR')}억`;
  return `${Math.round(manwon).toLocaleString('ko-KR')}만`;
}
const pct = (v) => `${Math.round((v / GOAL) * 1000) / 10}%`;

// --- SVG: 실현가치 실선 + 조건부 밴드 + 50억 목표선 ---
function chartSvg(hist) {
  const W = 720, H = 380, PL = 66, PR = 64, PT = 24, PB = 44;
  const iw = W - PL - PR, ih = H - PT - PB;
  const n = hist.length;
  const maxV = Math.max(GOAL, ...hist.map((h) => Math.max(h.mktHigh, h.realized))) * 1.05;
  const x = (i) => PL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => PT + ih - (v / maxV) * ih;

  let grid = '', ylab = '';
  const stepE = 10; // 10억 간격
  for (let e = 0; e * 10000 <= maxV; e += stepE) {
    const gy = y(e * 10000);
    grid += `<line x1="${PL}" y1="${gy.toFixed(1)}" x2="${W - PR}" y2="${gy.toFixed(1)}" class="grid"/>`;
    ylab += `<text x="${PL - 10}" y="${(gy + 4).toFixed(1)}" class="ytick">${e}억</text>`;
  }

  // 50억 목표선
  const gyGoal = y(GOAL);
  const goalLine = `<line x1="${PL}" y1="${gyGoal.toFixed(1)}" x2="${W - PR}" y2="${gyGoal.toFixed(1)}" class="goal"/>` +
    `<text x="${W - PR + 6}" y="${(gyGoal + 4).toFixed(1)}" class="goallab">목표 50억</text>`;

  // 조건부 밴드
  const top = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.mktHigh).toFixed(1)}`);
  const bot = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.mktLow).toFixed(1)}`).reverse();
  const band = `<polygon points="${[...top, ...bot].join(' ')}" class="band"/>`;

  // 실현가치 실선 + 점
  const line = `<polyline points="${hist.map((h, i) => `${x(i).toFixed(1)},${y(h.realized).toFixed(1)}`).join(' ')}" class="real"/>`;
  const dots = hist.map((h, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(h.realized).toFixed(1)}" r="3.5" class="dot"><title>${h.date} · 실현 ${won(h.realized)}</title></circle>`
  ).join('');
  const last = hist[n - 1];
  const endLab = `<text x="${x(n - 1).toFixed(1)}" y="${(y(last.realized) - 10).toFixed(1)}" class="endlab">${won(last.realized)}</text>`;

  let xlab = '';
  const showIdx = n <= 6 ? hist.map((_, i) => i) : [0, Math.floor(n / 2), n - 1];
  for (const i of showIdx) xlab += `<text x="${x(i).toFixed(1)}" y="${H - PB + 20}" class="xtick">${hist[i].date.slice(5)}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="시장가치 추이와 50억 목표">
  ${grid}${ylab}${band}${goalLine}${line}${dots}${endLab}${xlab}
</svg>`;
}

const last = history[history.length - 1];
const toGoal = GOAL - last.realized;

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
.wrap{max-width:840px;margin:0 auto;padding:48px 22px 90px}
.eyebrow{font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:var(--gold-text);font-weight:600}
h1{font-size:clamp(26px,4.5vw,36px);line-height:1.3;margin:10px 0 6px;letter-spacing:-0.01em}
.lead{color:var(--ink-body);margin:0 0 28px}
.hero-n{display:flex;gap:26px;flex-wrap:wrap;align-items:baseline;margin:0 0 8px}
.hero-n .big{font-size:44px;font-weight:600;color:var(--g700);line-height:1}
.hero-n .sub{font-size:13px;color:var(--ink-dim)}
.hero-n .rng{font-size:15px;color:var(--ink-body)}
.goalbar{margin:6px 0 24px}
.goalbar .track{height:12px;background:var(--paper-deep);border:1px solid var(--line);border-radius:6px;overflow:hidden}
.goalbar .fill{height:100%;background:linear-gradient(90deg,var(--g300),var(--g600))}
.goalbar .cap{font-size:12px;color:var(--ink-dim);margin-top:6px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:20px 22px;margin:0 0 22px}
.chart{width:100%;height:auto;display:block}
.grid{stroke:#eae3d3;stroke-width:1}
.goal{stroke:var(--g600);stroke-width:1.5;stroke-dasharray:5 4}
.goallab{fill:var(--g700);font-size:11px;font-weight:600}
.ytick,.xtick{fill:var(--ink-dim);font-size:11px}
.ytick{text-anchor:end}.xtick{text-anchor:middle}
.band{fill:var(--g300);opacity:0.20}
.real{fill:none;stroke:var(--g700);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.dot{fill:var(--g700);stroke:var(--panel);stroke-width:1.5}
.endlab{fill:var(--g800);font-size:12px;font-weight:600;text-anchor:middle}
.legend{display:flex;gap:20px;flex-wrap:wrap;margin:14px 0 0;font-size:12.5px;color:var(--ink-body)}
.legend .k{display:inline-flex;align-items:center;gap:7px}
.legend .sw{width:22px;height:0;border-top:3px solid var(--g700);border-radius:2px}
.legend .sw.band{height:12px;border:none;background:var(--g300);opacity:0.4;border-radius:2px}
.legend .sw.goal{border-top:2px dashed var(--g600)}
h2.sec{font-size:15px;color:var(--g800);margin:30px 0 12px;padding-left:10px;border-left:3px solid var(--g300)}
table{border-collapse:collapse;font-size:13px;width:100%}
th,td{border:1px solid var(--line);padding:7px 12px;text-align:left;color:var(--ink-body)}
th{background:var(--paper-deep);color:var(--ink);font-weight:600}
.lever{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:12px 0}
.lever .c{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px}
.lever .c b{color:var(--g700)} .lever .c .s{font-size:12px;color:var(--ink-dim)}
.note{font-size:12.5px;color:var(--ink-dim);line-height:1.7;margin-top:8px}
.disc{background:var(--paper-deep);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;font-size:12.5px;color:var(--ink-body);margin-top:22px}
footer{border-top:1px solid var(--line);padding:26px 22px;text-align:center;color:var(--ink-dim);font-size:12.5px}
@media(max-width:560px){.top nav{gap:12px}.hero-n .big{font-size:34px}.lever{grid-template-columns:1fr}}
`;

const rows = history.slice().reverse().map((h) =>
  `<tr><td>${h.date}</td><td>${h.devlogs}건</td><td>${h.galleries}·${h.mau}·${won(h.mrr)}</td><td>${won(h.realized)}</td><td>${pct(h.realized)}</td></tr>`
).join('');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>시장가치 추이 · 목표 50억 — ${SITE}</title>
<meta name="description" content="ARTSHOW의 결과물·트랙션 기반 시장가치를 매일 자동 산출하고 50억 목표까지의 경로를 추적합니다.">
<link rel="canonical" href="${BASE_URL}/valuation/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="시장가치 추이 · 목표 50억 — ${SITE}">
<meta property="og:description" content="결과물·트랙션 기반 밸류에이션과 50억 목표 경로.">
<meta property="og:url" content="${BASE_URL}/valuation/">
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <a class="logo" href="../">ARTSHOW<span class="dot">.</span></a>
  <nav>
    <a href="../valuation/">밸류에이션</a>
    <a href="../team/">팀</a>
    <a href="../devlog/">개발일지</a>
    <a href="../app/">입장하기</a>
  </nav>
</header>
<div class="wrap">
  <div class="eyebrow">Valuation · 목표 50억 · 매일 04:00 KST</div>
  <h1>시장가치 추이</h1>
  <p class="lead">결과물(개발일지·문서·IP)과 트랙션(갤러리·이용자·매출)로 밸류에이션을 매일 산출하고,<br>
  <strong>50억 목표까지의 경로</strong>를 추적합니다. 숫자는 시장 호가가 아니라 공개 모델의 출력입니다.</p>

  <div class="hero-n">
    <div><div class="big">${won(last.realized)}</div><div class="sub">실현 가치 · ${last.date}</div></div>
    <div class="rng">조건부 시장범위 <strong>${won(last.mktLow)} ~ ${won(last.mktHigh)}</strong><br>
      <span class="sub">트랙션 확보 시 (프리시드)</span></div>
  </div>
  <div class="goalbar">
    <div class="track"><div class="fill" style="width:${Math.max(1.5, (last.realized / GOAL) * 100).toFixed(1)}%"></div></div>
    <div class="cap">목표 50억까지 <strong>${won(toGoal)}</strong> 남음 · 현재 <strong>${pct(last.realized)}</strong></div>
  </div>

  <div class="card">
    ${chartSvg(history)}
    <div class="legend">
      <span class="k"><span class="sw"></span>실현 가치</span>
      <span class="k"><span class="sw band"></span>조건부 시장범위</span>
      <span class="k"><span class="sw goal"></span>목표 50억</span>
    </div>
  </div>

  <h2 class="sec">50억을 여는 세 레버</h2>
  <div class="lever">
    <div class="c"><b>매출</b><br>월매출 5,000만<br><span class="s">= ARR 6억 × 8배 ≈ 48억. 가장 확실한 경로</span></div>
    <div class="c"><b>이용자</b><br>MAU 1~3만<br><span class="s">작가 1인 1갤러리라 유저당 가치가 높다</span></div>
    <div class="c"><b>카테고리</b><br>AI 관람객<br><span class="s">경쟁사에 없는 wedge — 배수를 2~3배로</span></div>
  </div>
  <p class="note">현재 트랙션(갤러리·MAU·월매출)은 모두 0 — 실현 가치 = 자산 가치.
    <code>docs/traction.json</code>에 실측값이 들어오는 순간 실선이 목표선을 향해 올라간다.</p>

  <h2 class="sec">일자별 기록</h2>
  <div style="overflow-x:auto"><table>
    <thead><tr><th>날짜</th><th>개발일지</th><th>갤러리·MAU·월매출</th><th>실현 가치</th><th>목표 대비</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>

  <h2 class="sec">산출 근거 (공개 모델)</h2>
  <p class="note">
    · <strong>자산가치</strong> = 8,000만(원가 재현) + 개발일지 × 100만(문서·IP 축적).<br>
    · <strong>실현가치</strong> = 자산가치 + 상설갤러리×30만 + MAU×1만 + 월매출×12×8(ARR×시드 배수).<br>
    · <strong>시장범위</strong> = 자산가치 ×4 ~ ×12 (트랙션 확보 전제, 현재 미실현).<br>
    · <strong>목표 50억</strong>은 한국 시드 라운드 밸류. 위 세 레버 중 하나가 실측으로
    쌓이면 실현가치가 목표선을 향해 오른다.
  </p>

  <div class="disc">
    ⚠️ 내부 추적용 자기 추정이며 외부 투자·거래의 근거가 아닙니다. 시장범위·목표는
    트랙션 확보라는 조건부 시나리오입니다. 실제 가치는 시장이 정합니다.
  </div>
</div>
<footer>&copy; 2026 ARTSHOW. — 매일 04:00 KST 자동 산출 · 목표 50억 · 최종 ${last.date}</footer>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
console.log(`valuation ${kstDate}: 실현 ${won(realized)} (${pct(realized)}) / 목표까지 ${won(toGoal)} · 개발일지 ${devlogCount} · 트랙션 g${traction.galleries}/m${traction.mau}/₩${traction.mrr}`);
