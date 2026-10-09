#!/usr/bin/env node
/**
 * 약관·개인정보처리방침 정적 웹페이지 생성 (Firebase Hosting 용).
 * 앱과 같은 원본(src/content/legal)을 HTML 로 렌더링한다 — 앱 문서를 고치면 다시 실행해 배포.
 *
 *   npm run build:legal-site   → build/legal-site/
 *   npm run deploy:hosting -- --project lastorder-ec049
 *
 * 결과 URL (cleanUrls): /legal/privacy, /legal/terms, /legal/location
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'build', 'legal-site');
/** 문서 모듈과 그 의존 파일 (외부 패키지 없음) */
const SOURCES = ['shared/policy.ts', 'src/constants/brand.ts', 'src/content/legal/info.ts', 'src/content/legal/documents.ts'];

// 1) TS → ESM JS 로 변환해 임시 폴더에 같은 구조로 쓰고 import
const tmp = mkdtempSync(join(tmpdir(), 'legal-site-'));
try {
  for (const rel of SOURCES) {
    const { outputText } = ts.transpileModule(readFileSync(join(ROOT, rel), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    });
    // 상대 경로 import 에 .js 확장자 추가 (Node ESM 규칙)
    const js = outputText.replace(/(from\s+['"])(\.{1,2}\/[^'"]+?)(['"])/g, (_, a, p, b) => `${a}${p}.js${b}`);
    const dest = join(tmp, rel.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, js);
  }
  const { LEGAL_DOCS, hasPlaceholders } = await import(pathToFileURL(join(tmp, 'src/content/legal/documents.js')).href);
  const { APP_NAME } = await import(pathToFileURL(join(tmp, 'src/constants/brand.js')).href);

  // 2) HTML 렌더링
  const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const docs = Object.values(LEGAL_DOCS);
  const nav = (current) =>
    docs.map((d) => `<a href="/legal/${d.key}"${d.key === current ? ' aria-current="page"' : ''}>${esc(d.title)}</a>`).join('');

  const page = (title, body, current) => `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${esc(APP_NAME)}</title>
<style>
:root { --bg:#ffffff; --text:#111827; --muted:#6b7280; --border:#e5e7eb; --accent:#16a34a; --warn-bg:#fee2e2; --warn:#b91c1c; }
@media (prefers-color-scheme: dark) { :root { --bg:#111827; --text:#f3f4f6; --muted:#9ca3af; --border:#374151; --accent:#4ade80; --warn-bg:#450a0a; --warn:#fca5a5; } }
* { box-sizing: border-box; }
body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR","Malgun Gothic",sans-serif; line-height:1.7; }
main { max-width:760px; margin:0 auto; padding:24px 16px 64px; }
header { border-bottom:1px solid var(--border); }
header .inner { max-width:760px; margin:0 auto; padding:14px 16px; display:flex; flex-wrap:wrap; gap:8px 16px; align-items:center; }
.brand { font-weight:800; color:var(--text); text-decoration:none; margin-right:auto; }
nav a { color:var(--muted); text-decoration:none; font-size:14px; }
nav { display:flex; flex-wrap:wrap; gap:12px; }
nav a[aria-current] { color:var(--accent); font-weight:700; }
h1 { font-size:26px; margin:8px 0 0; }
.meta { color:var(--muted); font-size:14px; margin:4px 0 24px; }
h2 { font-size:17px; margin:28px 0 6px; }
p { margin:0; white-space:pre-wrap; word-break:keep-all; overflow-wrap:anywhere; }
.draft { background:var(--warn-bg); color:var(--warn); border-radius:10px; padding:12px 14px; font-weight:700; font-size:14px; margin-bottom:16px; }
ul.docs { padding:0; list-style:none; } ul.docs li { margin:10px 0; } ul.docs a { color:var(--accent); font-weight:700; }
</style>
</head>
<body>
<header><div class="inner"><a class="brand" href="/">${esc(APP_NAME)}</a><nav>${nav(current)}</nav></div></header>
<main>
${body}
</main>
</body>
</html>
`;

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, 'legal'), { recursive: true });
  const drafts = [];
  for (const d of docs) {
    const draft = hasPlaceholders(d);
    if (draft) drafts.push(d.key);
    const body = [
      draft ? '<div class="draft">⚠️ 초안입니다 — 대괄호([…]) 항목은 시행 전에 실제 정보로 채워집니다.</div>' : '',
      `<h1>${esc(d.title)}</h1>`,
      `<p class="meta">시행일 ${esc(d.version)}</p>`,
      ...d.sections.map((s) => `<h2>${esc(s.heading)}</h2>\n<p>${esc(s.body)}</p>`),
    ].join('\n');
    writeFileSync(join(OUT, 'legal', `${d.key}.html`), page(d.title, body, d.key));
  }
  const list = `<h1>${esc(APP_NAME)} 약관 및 정책</h1>\n<ul class="docs">${docs
    .map((d) => `<li><a href="/legal/${d.key}">${esc(d.title)}</a></li>`)
    .join('')}</ul>`;
  writeFileSync(join(OUT, 'index.html'), page('약관 및 정책', list));
  writeFileSync(join(OUT, '404.html'), page('페이지를 찾을 수 없어요', '<h1>페이지를 찾을 수 없어요</h1>\n<p><a href="/">약관 및 정책 목록으로</a></p>'));

  console.log(`✔ ${relative(ROOT, OUT)}: ${docs.map((d) => `/legal/${d.key}`).join(', ')}`);
  if (drafts.length) console.log(`⚠ 자리표시자가 남은 초안: ${drafts.join(', ')} (src/content/legal/info.ts, shared/policy.ts)`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
