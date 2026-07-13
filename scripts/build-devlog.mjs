#!/usr/bin/env node
// docs/DEVLOG.md → devlog/ 정적 블로그 생성기 (의존성 0)
// 실행: node scripts/build-devlog.mjs   (저장소 루트 기준)
// 산출: devlog/index.html, devlog/<slug>.html, sitemap.xml, robots.txt
// BASE_URL은 artshow 이전·자체 도메인 구매 시 여기 한 곳만 바꾼다.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = 'https://syhongart.github.io/openartshow'; // 랜딩 OG와 동일 규약
const SITE = 'OpenArtShow';
const OUT = join(ROOT, 'devlog');

// ---------- 파싱 ----------
const src = readFileSync(join(ROOT, 'docs/DEVLOG.md'), 'utf8');
const blocks = src.split(/\n(?=## )/);
const entries = [];
for (const b of blocks) {
  const m = b.match(/^## (\d{4}-\d{2}-\d{2}) · (.+)\n([\s\S]*)$/);
  if (!m) continue;
  const [, date, title] = m;
  let body = m[3].replace(/\n---\s*$/,'').trim();
  entries.push({ date, title: title.trim(), body, slug: `${date}-${hash6(title)}` });
}

function hash6(s) { // djb2 — 제목이 같으면 영구 동일 슬러그 (SEO 안정성)
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0').slice(0, 6);
}

// 제목 키워드 → 주제 이모티콘 (첫 매치 승리, 슬러그·SEO 타이틀에는 미포함)
const EMOJI_RULES = [
  [/법무/, '⚖️'],
  [/블로그|일지 공개/, '📝'],
  [/네이밍|마스코트|아야모|치비|캐릭터 전면/, '🧸'],
  [/fps|프레임|드로우콜|성능|베이크드|픽셀|렌더링|포테이토|저사양/i, '⚡'],
  [/하늘|HDRI|별|은하수/i, '🌌'],
  [/나무|정원/, '🌳'],
  [/그림자/, '🌗'],
  [/일몰|사이클|cycle|테마/i, '🌅'],
  [/타격|이펙트|콕 찌|VFX|HUD/i, '💥'],
  [/모바일|햄버거|독 /, '📱'],
  [/충돌|회피|통과/, '🚶'],
  [/방명록/, '📖'],
  [/스크롤|레일/, '📜'],
  [/랜딩|카드|배지|CTA|타이포|조판|그린|골드|디자인|플레이트|라운드|비네팅|로비|리파인|조명/, '🎨'],
];
const emojiFor = t => (EMOJI_RULES.find(([re]) => re.test(t)) || [null, '🛠️'])[1];

// ---------- 마크다운 → HTML (개발일지 서브셋: h3/불릿/표/굵게/코드/링크) ----------
const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function inline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noopener" target="_blank">$1</a>');
}
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let list = null, para = [], table = null, fence = null;
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push('<ul>' + list.map(i => `<li>${inline(i.join(' '))}</li>`).join('') + '</ul>'); list = null; } };
  const flushTable = () => {
    if (!table) return;
    const [head, ...rows] = table.filter(r => !/^\|[\s:-]+\|/.test(r));
    const cells = r => r.split('|').slice(1, -1).map(c => c.trim());
    let h = '<div class="tbl"><table><thead><tr>' + cells(head).map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>';
    for (const r of rows) h += '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
    out.push(h + '</tbody></table></div>');
    table = null;
  };
  for (const raw of lines) {
    if (fence !== null) {
      if (/^```/.test(raw)) { out.push(`<pre><code>${esc(fence.join('\n'))}</code></pre>`); fence = null; }
      else fence.push(raw);
      continue;
    }
    if (/^```/.test(raw)) { flushPara(); flushList(); flushTable(); fence = []; continue; }
    const img = raw.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (img) {
      flushPara(); flushList(); flushTable();
      const isrc = img[2].replace('../devlog/img/', './img/'); // DEVLOG.md(docs/) 기준 → 블로그 기준 경로
      out.push(`<figure class="shot"><img src="${esc(isrc)}" alt="${esc(img[1])}" loading="lazy">` +
        (img[1] ? `<figcaption>${inline(img[1])}</figcaption>` : '') + `</figure>`);
      continue;
    }
    if (/^\|/.test(raw.trim())) { flushPara(); flushList(); (table ||= []).push(raw.trim()); continue; }
    flushTable();
    const h3 = raw.match(/^### (.+)/);
    if (h3) { flushPara(); flushList(); out.push(`<h3>${inline(h3[1])}</h3>`); continue; }
    const li = raw.match(/^- (.+)/);
    if (li) { flushPara(); (list ||= []).push([li[1]]); continue; }
    if (/^\s{2,}\S/.test(raw) && list) { list[list.length - 1].push(raw.trim()); continue; }
    if (!raw.trim()) { flushPara(); flushList(); continue; }
    flushList(); para.push(raw.trim());
  }
  flushPara(); flushList(); flushTable();
  return out.join('\n');
}

function excerpt(body, n = 120) {
  const line = body.split('\n').map(l => l.replace(/^[-#\s]+/, '').trim()).find(l => l.length > 10) || '';
  const t = line.replace(/\*\*|`/g, '');
  return t.length > n ? t.slice(0, n - 1) + '…' : t;
}

// ---------- 셸 (랜딩 갤러리 플레이트 토큰과 동일 언어) ----------
const CSS = `
:root{--gold:#5f9e7d;--gold-text:#3d6b50;--paper:#fdfbf5;--paper-deep:#f6f1e4;--panel:#fffdf9;
--ink:#17140f;--ink-body:#57503f;--ink-dim:#6b6459;--line:#e6dfcf;--g300:#8fd0ab;--g600:#4e8a6a;
--g700:#3f7a5c;--g800:#2c5844;--g900:#14261d;--r:3px}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Helvetica Neue",Helvetica,Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;
font-size:15px;line-height:1.75;word-break:keep-all;overflow-wrap:break-word;-webkit-font-smoothing:antialiased}
a{color:var(--gold-text);text-decoration:none}
.top{display:flex;align-items:center;gap:18px;padding:14px 22px;background:var(--g900);color:#f2f2f0}
.top .logo{font-weight:700;letter-spacing:0.04em;color:#fff;font-size:16px}
.top .logo .dot{color:var(--gold)}
.top nav{margin-left:auto;display:flex;gap:18px;font-size:13px}
.top nav a{color:rgba(242,242,240,0.75)} .top nav a:hover{color:#fff}
.wrap{max-width:760px;margin:0 auto;padding:48px 22px 90px}
.eyebrow{font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:var(--gold-text);font-weight:600}
h1{font-size:clamp(26px,4.5vw,36px);line-height:1.3;margin:10px 0 6px;letter-spacing:-0.01em}
.lead{color:var(--ink-body);margin:0 0 34px}
.card{display:block;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:20px 22px;margin:0 0 14px;
transition:border-color .2s,transform .2s}
.card:hover{border-color:var(--g300);transform:translateY(-1px)}
.card .d{font-size:12px;letter-spacing:0.12em;color:var(--gold-text);font-weight:600}
.card h2{font-size:17px;margin:6px 0 6px;color:var(--ink);line-height:1.45}
.card p{margin:0;font-size:13.5px;color:var(--ink-body)}
.emo{margin-right:6px}
.shot{margin:22px 0}
.shot img{display:block;width:100%;border:1px solid var(--line);border-radius:var(--r)}
.shot figcaption{margin-top:8px;font-size:12.5px;color:var(--ink-dim);text-align:center}
article h3{font-size:15px;color:var(--g800);margin:34px 0 10px;padding-left:10px;border-left:3px solid var(--g300)}
article ul{margin:0 0 16px;padding-left:20px}
article li{margin:0 0 6px;color:var(--ink-body)}
article p{color:var(--ink-body)}
article strong{color:var(--ink)}
article code{background:var(--paper-deep);border:1px solid var(--line);border-radius:var(--r);padding:1px 5px;font-size:12.5px}
article pre{background:var(--g900);color:#e8efe9;padding:14px 16px;border-radius:var(--r);overflow-x:auto;font-size:12.5px;line-height:1.6}
article pre code{background:none;border:none;color:inherit;padding:0}
.tbl{overflow-x:auto;margin:0 0 16px}
table{border-collapse:collapse;font-size:13px;min-width:420px}
th,td{border:1px solid var(--line);padding:7px 12px;text-align:left;color:var(--ink-body)}
th{background:var(--paper-deep);color:var(--ink);font-weight:600}
.meta{color:var(--ink-dim);font-size:13px;margin:0 0 30px}
.pn{display:flex;gap:12px;margin-top:50px;flex-wrap:wrap}
.pn a{flex:1;min-width:220px;background:var(--panel);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;font-size:13px}
.pn a:hover{border-color:var(--g300)}
.pn .lbl{display:block;font-size:11px;letter-spacing:0.14em;color:var(--ink-dim);margin-bottom:4px}
.back{display:inline-block;margin-bottom:26px;font-size:13px}
footer{border-top:1px solid var(--line);padding:26px 22px;text-align:center;color:var(--ink-dim);font-size:12.5px}
@media(max-width:520px){.top nav{gap:12px}}
`;

function shell({ title, desc, path, og, jsonld, bodyHtml }) {
  const url = `${BASE_URL}${path}`;
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${og}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<style>${CSS}</style>
</head>
<body>
<header class="top">
  <a class="logo" href="../">OpenArtShow<span class="dot">.</span></a>
  <nav>
    <a href="../devlog/">개발일지</a>
    <a href="../team/">팀</a>
    <a href="../valuation/">밸류에이션</a>
    <a href="../guide.html">가이드</a>
    <a href="../app/">입장하기</a>
  </nav>
</header>
<div class="wrap">
${bodyHtml}
</div>
<footer>&copy; 2026 OpenArtShow. — 만드는 과정을 기록합니다.</footer>
</body>
</html>
`;
}

// ---------- 생성 ----------
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith('.html')) unlinkSync(join(OUT, f)); // 슬러그 변경 잔재 제거

entries.forEach((e, i) => {
  const newer = entries[i - 1], older = entries[i + 1];
  const pn = [];
  if (older) pn.push(`<a href="./${older.slug}.html"><span class="lbl">← 이전 기록</span>${esc(older.title)}</a>`);
  if (newer) pn.push(`<a href="./${newer.slug}.html" style="text-align:right"><span class="lbl">다음 기록 →</span>${esc(newer.title)}</a>`);
  const body = `
<a class="back" href="./">← 개발일지 전체</a>
<article>
<div class="eyebrow">${e.date}</div>
<h1><span class="emo">${emojiFor(e.title)}</span>${esc(e.title)}</h1>
<p class="meta">OpenArtShow 개발일지 — 원인 · 분석 · 개선 · 결과</p>
${mdToHtml(e.body)}
</article>
${pn.length ? `<div class="pn">${pn.join('')}</div>` : ''}`;
  writeFileSync(join(OUT, `${e.slug}.html`), shell({
    title: `${e.title} — ${SITE} 개발일지`,
    desc: excerpt(e.body, 150),
    path: `/devlog/${e.slug}.html`,
    og: 'article',
    jsonld: {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: e.title, datePublished: e.date,
      author: { '@type': 'Organization', name: SITE },
      mainEntityOfPage: `${BASE_URL}/devlog/${e.slug}.html`,
      inLanguage: 'ko',
    },
    bodyHtml: body,
  }));
});

const cards = entries.map(e => `<a class="card" href="./${e.slug}.html">
  <span class="d">${e.date}</span>
  <h2><span class="emo">${emojiFor(e.title)}</span>${esc(e.title)}</h2>
  <p>${esc(excerpt(e.body))}</p>
</a>`).join('\n');

writeFileSync(join(OUT, 'index.html'), shell({
  title: `개발일지 — ${SITE}`,
  desc: 'OpenArtShow를 만드는 과정의 공개 기록. 웹 3D 미술관의 성능·디자인·법무·브랜드 결정을 원인-분석-개선-결과로 남깁니다.',
  path: '/devlog/',
  og: 'website',
  jsonld: {
    '@context': 'https://schema.org', '@type': 'Blog',
    name: `${SITE} 개발일지`, url: `${BASE_URL}/devlog/`, inLanguage: 'ko',
    blogPost: entries.slice(0, 10).map(e => ({ '@type': 'BlogPosting', headline: e.title, datePublished: e.date, url: `${BASE_URL}/devlog/${e.slug}.html` })),
  },
  bodyHtml: `
<div class="eyebrow">Devlog</div>
<h1>개발일지</h1>
<p class="lead">링크 하나로 열리는 3D 미술관을 만드는 과정 — ${entries.length}건의 기록.<br>
문제의 원인, 분석, 개선, 결과를 그대로 남깁니다.</p>
${cards}`,
}));

// ---------- sitemap / robots ----------
const urls = [
  { loc: `${BASE_URL}/`, mod: entries[0].date },
  { loc: `${BASE_URL}/guide.html`, mod: entries[0].date },
  { loc: `${BASE_URL}/team/`, mod: entries[0].date },
  { loc: `${BASE_URL}/valuation/`, mod: entries[0].date },
  { loc: `${BASE_URL}/devlog/`, mod: entries[0].date },
  ...entries.map(e => ({ loc: `${BASE_URL}/devlog/${e.slug}.html`, mod: e.date })),
];
writeFileSync(join(ROOT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.mod}</lastmod></url>`).join('\n') +
  `\n</urlset>\n`);
writeFileSync(join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${BASE_URL}/sitemap.xml\n`);

console.log(`devlog: ${entries.length} posts → devlog/ + sitemap.xml + robots.txt`);
