#!/usr/bin/env node
// 시장가치 추적기 — docs/DEVLOG.md의 실측 신호로 밸류에이션을 산출하고
// docs/valuation-history.json에 일자별로 누적, valuation/index.html에 그래프를 그린다.
// 실행: node scripts/build-valuation.mjs  (저장소 루트 기준, 하루 1회 멱등)
//
// 모델(결정론적, 지어내지 않음 — 근거는 페이지 하단에 공개):
//   자산가치(만원) = 8,000(원가재현 하한) + 개발일지건수 × 100(문서·IP 축적)
//   시장범위(조건부) = 자산가치 × 4 (하한) ~ × 12 (상한)  ※트랙션 확보 시
// 근거: 2026-07-12 감독 문답 밸류에이션(원가재현 1~1.5억, 프리시드 5~15억).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'https://syhongart.github.io/artshow';
const SITE = 'ARTSHOW';
const HIST = join(ROOT, 'docs', 'valuation-history.json');
const OUT = join(ROOT, 'valuation');

// KST 기준 날짜 (cron이 새벽 4시 KST에 돈다)
const kstDate = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

// --- 신호 집계 ---
const devlog = readFileSync(join(ROOT, 'docs', 'DEVLOG.md'), 'utf8');
const devlogCount = (devlog.match(/^## \d{4}-\d{2}-\d{2} · /gm) || []).length;

// --- 밸류에이션 모델 ---
const asset = 8000 + devlogCount * 100;      // 만원
const mktLow = Math.round(asset * 4);
const mktHigh = Math.round(asset * 12);
const point = { date: kstDate, devlogs: devlogCount, asset, mktLow, mktHigh };

// --- 히스토리 로드 + 멱등 upsert ---
let history = [];
if (existsSync(HIST)) {
  try { history = JSON.parse(readFileSync(HIST, 'utf8')); } catch { history = []; }
}
const idx = history.findIndex((h) => h.date === kstDate);
if (idx >= 0) history[idx] = point; else history.push(point);
history.sort((a, b) => a.date.localeCompare(b.date));
writeFileSync(HIST, JSON.stringify(history, null, 2) + '\n');

// --- 숫자 포맷 (만원 → 억/만) ---
function won(manwon) {
  const eok = manwon / 10000;
  if (eok >= 1) return `${(Math.round(eok * 100) / 100).toLocaleString('ko-KR')}억`;
  return `${manwon.toLocaleString('ko-KR')}만`;
}

// --- SVG 라인 차트 (자산 = 실선, 시장범위 = 밴드) ---
function chartSvg(hist) {
  const W = 720, H = 360, PL = 64, PR = 20, PT = 24, PB = 44;
  const iw = W - PL - PR, ih = H - PT - PB;
  const n = hist.length;
  const maxV = Math.max(...hist.map((h) => h.mktHigh)) * 1.08;
  const x = (i) => PL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => PT + ih - (v / maxV) * ih;

  // Y 격자 (억 단위)
  const eokMax = maxV / 10000;
  const stepE = eokMax > 12 ? 5 : eokMax > 6 ? 2 : 1;
  let grid = '', ylab = '';
  for (let e = 0; e * 10000 <= maxV; e += stepE) {
    const gy = y(e * 10000);
    grid += `<line x1="${PL}" y1="${gy.toFixed(1)}" x2="${W - PR}" y2="${gy.toFixed(1)}" class="grid"/>`;
    ylab += `<text x="${PL - 10}" y="${(gy + 4).toFixed(1)}" class="ytick">${e}억</text>`;
  }

  // 시장범위 밴드 (low → high 폐곡선)
  const topPts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.mktHigh).toFixed(1)}`);
  const botPts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.mktLow).toFixed(1)}`).reverse();
  const band = `<polygon points="${[...topPts, ...botPts].join(' ')}" class="band"/>`;
  const lowLine = `<polyline points="${hist.map((h, i) => `${x(i).toFixed(1)},${y(h.mktLow).toFixed(1)}`).join(' ')}" class="edge"/>`;
  const highLine = `<polyline points="${hist.map((h, i) => `${x(i).toFixed(1)},${y(h.mktHigh).toFixed(1)}`).join(' ')}" class="edge"/>`;

  // 자산가치 실선 + 데이터엔드 점
  const assetPts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.asset).toFixed(1)}`).join(' ');
  const assetLine = `<polyline points="${assetPts}" class="asset"/>`;
  const dots = hist.map((h, i) =>
    `<circle cx="${x(i).toFixed(1)}" cy="${y(h.asset).toFixed(1)}" r="3.5" class="dot"><title>${h.date} · 자산 ${won(h.asset)}</title></circle>`
  ).join('');

  // X 라벨 (처음·마지막, 많으면 중간도)
  let xlab = '';
  const showIdx = n <= 6 ? hist.map((_, i) => i) : [0, Math.floor(n / 2), n - 1];
  for (const i of showIdx) {
    xlab += `<text x="${x(i).toFixed(1)}" y="${H - PB + 20}" class="xtick">${hist[i].date.slice(5)}</text>`;
  }

  const last = hist[n - 1];
  const endLabel = `<text x="${x(n - 1).toFixed(1)}" y="${(y(last.asset) - 10).toFixed(1)}" class="endlab">${won(last.asset)}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="시장가치 추이 그래프">
  ${grid}${ylab}
  ${band}${lowLine}${highLine}
  ${assetLine}${dots}${endLabel}
  ${xlab}
</svg>`;
}

const last = history[history.length - 1];
const first = history[0];
const deltaAsset = last.asset - first.asset;

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
.hero-n{display:flex;gap:26px;flex-wrap:wrap;align-items:baseline;margin:0 0 24px}
.hero-n .big{font-size:44px;font-weight:600;color:var(--g700);line-height:1}
.hero-n .sub{font-size:13px;color:var(--ink-dim)}
.hero-n .rng{font-size:15px;color:var(--ink-body)}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:20px 22px;margin:0 0 22px}
.chart{width:100%;height:auto;display:block}
.grid{stroke:#eae3d3;stroke-width:1}
.ytick,.xtick{fill:var(--ink-dim);font-size:11px}
.ytick{text-anchor:end}.xtick{text-anchor:middle}
.band{fill:var(--g300);opacity:0.20}
.edge{fill:none;stroke:var(--g300);stroke-width:1;stroke-dasharray:3 3;opacity:0.7}
.asset{fill:none;stroke:var(--g700);stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.dot{fill:var(--g700);stroke:var(--panel);stroke-width:1.5}
.endlab{fill:var(--g800);font-size:12px;font-weight:600;text-anchor:middle}
.legend{display:flex;gap:20px;flex-wrap:wrap;margin:14px 0 0;font-size:12.5px;color:var(--ink-body)}
.legend .k{display:inline-flex;align-items:center;gap:7px}
.legend .sw{width:22px;height:0;border-top:3px solid var(--g700);border-radius:2px}
.legend .sw.band{height:12px;border:none;background:var(--g300);opacity:0.4;border-radius:2px}
h2.sec{font-size:15px;color:var(--g800);margin:30px 0 12px;padding-left:10px;border-left:3px solid var(--g300)}
table{border-collapse:collapse;font-size:13px;width:100%}
th,td{border:1px solid var(--line);padding:7px 12px;text-align:left;color:var(--ink-body)}
th{background:var(--paper-deep);color:var(--ink);font-weight:600}
.note{font-size:12.5px;color:var(--ink-dim);line-height:1.7;margin-top:8px}
.disc{background:var(--paper-deep);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;font-size:12.5px;color:var(--ink-body);margin-top:22px}
footer{border-top:1px solid var(--line);padding:26px 22px;text-align:center;color:var(--ink-dim);font-size:12.5px}
@media(max-width:560px){.top nav{gap:12px}.hero-n .big{font-size:34px}}
`;

const rows = history.slice().reverse().map((h) =>
  `<tr><td>${h.date}</td><td>${h.devlogs}건</td><td>${won(h.asset)}</td><td>${won(h.mktLow)} ~ ${won(h.mktHigh)}</td></tr>`
).join('');

const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>시장가치 추이 — ${SITE}</title>
<meta name="description" content="ARTSHOW의 결과물 기반 시장가치를 매일 새벽 4시 자동 산출해 그래프로 추적합니다. 자산가치와 조건부 시장범위.">
<link rel="canonical" href="${BASE_URL}/valuation/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="시장가치 추이 — ${SITE}">
<meta property="og:description" content="결과물 기반 밸류에이션을 매일 자동 추적하는 그래프.">
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
  <div class="eyebrow">Valuation · 매일 04:00 KST 자동 갱신</div>
  <h1>시장가치 추이</h1>
  <p class="lead">결과물(개발일지·기능·문서 자산)로 추정한 밸류에이션을 매일 산출해 누적합니다.<br>
  아래 숫자는 시장 호가가 아니라 <strong>공개된 산출 모델</strong>의 출력입니다 — 근거는 하단에 있습니다.</p>

  <div class="hero-n">
    <div><div class="big">${won(last.asset)}</div><div class="sub">방어 가능 자산가치 · ${last.date}</div></div>
    <div class="rng">조건부 시장범위 <strong>${won(last.mktLow)} ~ ${won(last.mktHigh)}</strong><br>
      <span class="sub">트랙션 확보 시 (프리시드)</span></div>
  </div>

  <div class="card">
    ${chartSvg(history)}
    <div class="legend">
      <span class="k"><span class="sw"></span>자산가치 (방어 가능)</span>
      <span class="k"><span class="sw band"></span>시장범위 (조건부·트랙션 시)</span>
    </div>
  </div>

  <h2 class="sec">일자별 기록</h2>
  <div style="overflow-x:auto"><table>
    <thead><tr><th>날짜</th><th>개발일지</th><th>자산가치</th><th>시장범위(조건부)</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="note">기록 시작 이후 자산가치 <strong>${deltaAsset >= 0 ? '+' : ''}${won(Math.abs(deltaAsset))}</strong> 변동
    (개발일지 ${first.devlogs}→${last.devlogs}건).</p>

  <h2 class="sec">산출 근거 (공개 모델)</h2>
  <p class="note">
    · <strong>자산가치</strong> = 8,000만(원가 재현 하한) + 개발일지 건수 × 100만(문서·IP 축적분).
    완성된 코드베이스를 사람 팀으로 재현하는 원가에, 실사 통과 비용을 미리 지불한 문서·IP 자산을 더한 값.<br>
    · <strong>시장범위</strong> = 자산가치 × 4(하한) ~ × 12(상한). 한국 프리시드에서 작동하는 MVP가
    받는 배수. <strong>트랙션(사용자·매출) 확보를 전제</strong>하며 현재는 미실현이다.<br>
    · 개발일지 건수를 진척 신호로 쓰는 이유: 모든 결정이 원인·분석·개선·결과로 기록돼 있어
    <a href="../devlog/">공개 검증</a>이 가능하기 때문. 지어낸 숫자가 아니다.
  </p>

  <div class="disc">
    ⚠️ 본 밸류에이션은 내부 추적용 자기 추정이며 외부 투자·거래의 근거가 아닙니다.
    시장범위는 트랙션 확보라는 조건부 시나리오입니다. 실제 가치는 시장이 정합니다.
  </div>
</div>
<footer>&copy; 2026 ARTSHOW. — 매일 04:00 KST 자동 산출 · 최종 ${last.date}</footer>
</body>
</html>
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'index.html'), html);
console.log(`valuation ${kstDate}: 자산 ${won(asset)} / 시장 ${won(mktLow)}~${won(mktHigh)} (개발일지 ${devlogCount}건, 히스토리 ${history.length}점)`);
