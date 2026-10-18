/* ============================================================
   SHWADRON.AI — סילבוס להדפסה לכל אחד משלושת הקורסים
   ------------------------------------------------------------
   מריצים:  node tools/build-syllabus.mjs

   הסקריפט קורא את assets/data/courses.mjs וכותב שלושה קבצים:
   syllabus-beginners.html, syllabus-advanced.html, syllabus-digital.html.
   כל אחד מסמך בגודל A4 בעיצוב האתר, שנועד לשליחה בוואטסאפ או לשמירה
   כ-PDF (בדפדפן: הדפסה ← שמירה כ-PDF). כל התוכן, המועדים
   והמחירים נגזרים מקובץ הנתונים, ולכן אין לערוך את ה-HTML ידנית.
   אחרי שינוי בקובץ הנתונים מריצים את הסקריפט הזה שוב.
   ============================================================ */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BEGINNERS, ADVANCED, DIGITAL, TIME, NO_CLASSES, SCHEDULE_NOTE } from '../assets/data/courses.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ─── מועדים ───────────────────────────────────────────────
   אותו חישוב כמו ב-build-courses.mjs: מפגש בכל שבוע מהפתיחה,
   ושבוע שנופל ב-NO_CLASSES נדחה לשבוע שאחריו.                */
const isBreak = d => {
  const iso = d.toISOString().slice(0, 10);
  return NO_CLASSES.some(b => iso >= b.from && iso <= b.to);
};
function sessionDate(startISO, i) {
  const d = new Date(startISO + 'T00:00:00Z');
  for (let n = 0; ; d.setUTCDate(d.getUTCDate() + 7)) {
    if (isBreak(d)) continue;
    if (n++ === i) return d;
  }
}
const dayMonth = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;

/* התאריך העברי, באותיות ובכתיב של האתר: "ט״ו בכסליו" */
const LETTERS = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
const TENS    = ['', 'י', 'כ', 'ל'];
function gematria(n) {
  if (n === 15) return 'ט״ו';
  if (n === 16) return 'ט״ז';
  const s = TENS[Math.floor(n / 10)] + LETTERS[n % 10];
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
}
const HEB = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric', month: 'long', timeZone: 'UTC' });
function hebrewDate(d) {
  const parts = HEB.formatToParts(new Date(d.getTime() + 12 * 3600e3));
  const day   = +parts.find(p => p.type === 'day').value;
  const month = parts.find(p => p.type === 'month').value.replace(/^כסלו$/, 'כסליו');
  return `${gematria(day)} ב${month}`;
}
const dates = t => Array.from({ length: t.sessions }, (_, i) => sessionDate(t.start, i));

const ils = n => n.toLocaleString('he-IL', { maximumFractionDigits: 2 }) + ' ₪';
const totalOf = t => Math.round(t.priceEx * (1 + t.vatRate) * 100) / 100;

/* ─── רכיבים ─── */
/* החץ נצמד לשלב שאחריו, כדי ששבירת שורה לא תשאיר חץ יתום בסוף שורה */
const flow = steps => `<div class="flow">${steps.map((s, i) =>
  `<b>${i ? '<i aria-hidden="true">←</i>' : ''}<span>${esc(s)}</span></b>`).join('')}</div>`;

const figures = t => `<div class="figures">
${t.figures.map(([n, l]) => `    <div><span class="fig">${esc(n)}</span><span class="fig-label">${esc(l)}</span></div>`).join('\n')}
  </div>`;

function facts(t) {
  const ds = dates(t);
  const rows = [
    ['פתיחה', `${hebrewDate(ds[0])} · ${dayMonth(ds[0])}`],
    ['סיום', `${hebrewDate(ds.at(-1))} · ${dayMonth(ds.at(-1))}`],
    ['מתי', `ימי ${t.dayName}, ${t.time || TIME}`, true],
    ['היקף', `${t.hours} שעות`],
    ['מחיר', t.priceEx ? `${ils(totalOf(t))} כולל מע״מ` : 'יעודכן'],
  ];
  return `<dl class="facts">
${rows.map(([k, v, time]) => `    <div><dt>${esc(k)}</dt><dd>${time
    ? esc(v).replace(/[\d:]+-[\d:]+/, m => `<span class="ltr nowrap">${m}</span>`) : esc(v)}</dd></div>`).join('\n')}
  </dl>`;
}

const fit = t => `<div class="box">
    <p class="eyebrow">מתאים לי אם</p>
    <ul class="ticks">
${t.fit.map(f => `      <li>${esc(f)}</li>`).join('\n')}
    </ul>
  </div>`;

const pageFoot = (n, total) => `<footer class="sheet-foot">
    <img src="assets/public/logo-white.png" alt="SHWADRON.AI" width="380" height="107"/>
    <span>ai.shwadron-ai.com · ${esc(SCHEDULE_NOTE)}</span>
    <span class="ltr">${n} / ${total}</span>
  </footer>`;

const breakNote = NO_CLASSES.map(b => `אין מפגשים ב${b.label}`).join(' · ');

const head = t => `<header class="sheet-head">
    <p class="eyebrow">סילבוס</p>
    <p class="kicker">${esc(t.kicker)}</p>
    <h1>${esc(t.name)}</h1>
    <p class="lead">${esc(t.lead)}${t.promise ? ' ' + esc(t.promise) : ''}</p>
  </header>`;

const box = (title, items) => `<div class="box">
    <p class="eyebrow">${esc(title)}</p>
    <ul class="ticks">
${items.map(h => `      <li>${esc(h)}</li>`).join('\n')}
    </ul>
  </div>`;

/* ─── מאפס למאה: שני עמודים ─── */
function beginnersPage() {
  const t = BEGINNERS, ds = dates(t);
  const lessons = t.syllabus.map((s, i) => `<article class="lesson">
      <span class="lesson-n ltr">${esc(s.n)}</span>
      <div>
        <p class="lesson-when">מפגש ${i + 1} · יום ${t.dayName}, ${esc(hebrewDate(ds[i]))} · ${dayMonth(ds[i])}</p>
        <h3>${esc(s.title)}</h3>
        <p class="body">${esc(s.desc)}</p>${s.flow ? '\n        ' + flow(s.flow) : ''}${s.flow2
          ? `\n        <p class="flow-label">${esc(s.flow2Label)}</p>\n        ${flow(s.flow2)}` : ''}
      </div>
    </article>`).join('\n    ');
  return `<section class="sheet">
  ${head(t)}
  ${figures(t)}
  ${facts(t)}
  <div class="lessons">
    ${lessons}
  </div>
  <p class="small">${esc(breakNote)}</p>
  ${pageFoot(1, 2)}
</section>

<section class="sheet">
  <header class="sheet-head sheet-head-sm">
    <p class="eyebrow">${esc(t.name)} · המשך</p>
  </header>
  <div class="box project">
    <p class="eyebrow">יוצאים עם</p>
    <p class="lead strong">${esc(t.outcome)}</p>
  </div>
  <div class="box">
    <p class="eyebrow">מה לומדים</p>
    <div class="pills">${t.learn.map(x => `<span>${esc(x)}</span>`).join('')}</div>
  </div>
  <div class="cols">
  ${fit(t)}
  ${box('מה כלול', t.ticks)}
  </div>
  ${pageFoot(2, 2)}
</section>`;
}

/* ─── צבא הסוכנים: שלושה עמודים ─── */
/* כמה מפגשים נכנסים לעמוד הראשון של המסלול. השאר עוברים לעמוד ההמשך */
const ADV_FIRST_PAGE = 4;

function advancedPages() {
  const t = ADVANCED, ds = dates(t), p = t.project;
  const lessons = t.plan.map((s, i) => `<article class="lesson">
      <span class="lesson-n ltr">${String(i + 1).padStart(2, '0')}</span>
      <div>
        <p class="lesson-when">מפגש ${i + 1} · ${esc(s.domain)} · יום ${t.dayName}, ${esc(hebrewDate(ds[i]))} · ${dayMonth(ds[i])}</p>
        <h3>${esc(s.title)}</h3>
        <p class="body">${esc(s.desc)}</p>
        ${s.items ? `<div class="pills">${s.items.map(x => `<span>${esc(x)}</span>`).join('')}</div>` : flow(s.flow)}
      </div>
    </article>`);
  return `<section class="sheet">
  ${head(t)}
  ${figures(t)}
  ${facts(t)}
  <div class="lessons">
    ${lessons.slice(0, ADV_FIRST_PAGE).join('\n    ')}
  </div>
  ${pageFoot(1, 3)}
</section>

<section class="sheet">
  <header class="sheet-head sheet-head-sm">
    <p class="eyebrow">צבא הסוכנים · המשך</p>
  </header>
  <div class="lessons lessons-cont">
    ${lessons.slice(ADV_FIRST_PAGE).join('\n    ')}
  </div>
  <p class="small">${esc(breakNote)}</p>
  ${pageFoot(2, 3)}
</section>

<section class="sheet">
  <header class="sheet-head sheet-head-sm">
    <p class="eyebrow">צבא הסוכנים · פרויקט ומה כלול</p>
  </header>
  <div class="box project">
    <p class="eyebrow">${esc(p.title)}</p>
    <p class="lead strong">${esc(p.desc)}</p>
    <p class="body">${esc(p.lead)}</p>
    <div class="pills">${p.items.map(x => `<span>${esc(x)}</span>`).join('')}</div>
    <p class="small">${esc(p.example)}</p>
  </div>
  <div class="cols">
  ${fit(t)}
  ${box('מה כלול', t.highlights)}
  </div>
  ${pageFoot(3, 3)}
</section>`;
}

/* ─── המוח השני: עמוד אחד ─── */
function digitalPage() {
  const t = DIGITAL;
  const lessons = t.lessons.map((s, i) => `<article class="lesson">
      <span class="lesson-n ltr">${String(i + 1).padStart(2, '0')}</span>
      <div>
        <p class="lesson-when">שיעור ${i + 1}</p>
        <h3>${esc(s.title)}</h3>
        <p class="body">${esc(s.desc)}</p>
      </div>
    </article>`).join('\n    ');
  const rows = [
    ['פורמט', t.format],
    ['היקף', t.hoursNote],
    ['גישה', t.when],
    ['מחיר', `${ils(totalOf(t))} כולל מע״מ`],
  ];
  return `<section class="sheet">
  ${head(t)}
  ${figures(t)}
  <dl class="facts">
${rows.map(([k, v]) => `    <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
  </dl>
  <div class="lessons">
    ${lessons}
  </div>
  <div class="cols">
  ${box('מה תדע לעשות', t.able)}
  ${box('מה כלול', t.includes)}
  </div>
  <footer class="sheet-foot">
    <img src="assets/public/logo-white.png" alt="SHWADRON.AI" width="380" height="107"/>
    <span>ai.shwadron-ai.com</span>
    <span class="ltr">1 / 1</span>
  </footer>
</section>`;
}

const STYLE = `<style>
:root{
  --bg:#0A0A0B;--card:#141416;--line:#26262B;--line-soft:#1C1C1F;
  --ink:#F4F4F1;--ink-2:#C8C8CC;--muted:#A1A1A6;--dim:#6B6B72;
  --accent:#3EE6B0;--accent-ink:#0A0A0B;
}
*{margin:0;padding:0;box-sizing:border-box}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{background:#050506;color:var(--ink);direction:rtl;font-family:'Heebo',system-ui,sans-serif;
  line-height:1.55;-webkit-font-smoothing:antialiased;padding:24px 16px}
img{display:block;max-width:100%}
.ltr{direction:ltr;unicode-bidi:isolate}
.nowrap{white-space:nowrap}

.toolbar{max-width:210mm;margin:0 auto 20px;display:flex;flex-wrap:wrap;gap:12px;
  align-items:center;justify-content:space-between;color:var(--muted);font-size:15px}
.toolbar a{color:var(--ink);font-weight:500;padding-block:12px}
.toolbar a:hover{color:var(--accent)}
.toolbar button{font:700 15px 'Heebo',sans-serif;background:var(--accent);color:var(--accent-ink);
  border:0;border-radius:999px;padding:12px 24px;min-height:48px;cursor:pointer}

.sheet{width:100%;max-width:210mm;margin:0 auto 24px;background:var(--bg);border:1px solid var(--line-soft);
  padding:16mm 15mm 12mm;display:flex;flex-direction:column;gap:20px;position:relative;overflow:hidden}
.sheet::before{content:"";position:absolute;top:0;inset-inline:0;height:4px;background:var(--accent)}
.sheet-head{display:flex;flex-direction:column;gap:8px}
.sheet-head-sm{gap:0}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;color:var(--accent)}
.kicker{font-size:14px;color:var(--muted)}
h1{font-family:'Karantina','Heebo',sans-serif;font-weight:700;font-size:clamp(64px,14vw,104px);
  line-height:.86;letter-spacing:-.01em}
h3{font-size:19px;font-weight:700;line-height:1.3}
.lead{font-size:16.5px;color:var(--ink-2);max-width:62ch}
.body{font-size:14.5px;color:var(--muted)}
.small{font-size:13px;color:var(--muted)}
.strong{color:var(--ink);font-weight:500}

.figures{display:grid;grid-template-columns:repeat(auto-fit,minmax(90px,1fr));gap:0 24px;
  border-block:1px solid #1F1F23}
.figures>div{padding-block:12px;display:flex;flex-direction:column;gap:2px;min-width:0}
.fig{font-family:'Karantina','Heebo',sans-serif;font-weight:700;font-size:52px;line-height:1}
.figures>div:last-child .fig{color:var(--accent)}
.fig-label{font-size:13px;color:var(--muted)}

.facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px 20px}
.facts div{display:flex;flex-direction:column;gap:1px}
.facts dt{font-size:12px;color:var(--dim);font-weight:500}
.facts dd{font-size:14px;color:var(--ink);font-weight:500}

.lessons{display:flex;flex-direction:column}
.lesson{display:grid;grid-template-columns:56px 1fr;gap:14px;padding-block:16px;border-top:1px solid #3A3A40;
  break-inside:avoid}
.lesson:first-child{border-top-color:var(--ink)}
.lesson>div{display:flex;flex-direction:column;gap:6px;min-width:0}
.lesson-n{font-family:'Karantina','Heebo',sans-serif;font-weight:700;font-size:52px;line-height:.9;color:var(--dim)}
.lesson:first-child .lesson-n{color:var(--accent)}
.lessons-cont .lesson:first-child .lesson-n{color:var(--dim)}
.lesson-when{font-size:13px;font-weight:500;color:var(--accent)}

.flow,.pills{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:4px}
.flow span,.pills span{font-size:12.5px;font-weight:500;color:var(--ink-2);border:1px solid var(--line);
  background:var(--card);border-radius:999px;padding:3px 11px}
.flow b{display:inline-flex;align-items:center;gap:6px;font-weight:inherit;white-space:nowrap}
.flow i{font-style:normal;color:var(--accent);font-size:12px}
.flow-label{font-size:12.5px;font-weight:700;color:var(--ink-2);margin-top:6px}

.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}
.box{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:18px 20px;
  display:flex;flex-direction:column;gap:10px;break-inside:avoid}
.project{border:1.5px solid var(--accent)}
.ticks{list-style:none;display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--ink-2)}
.ticks li{display:flex;gap:8px}
.ticks li::before{content:"✓";color:var(--accent);font-weight:800;flex-shrink:0}
.sheet-foot{margin-top:auto;padding-top:14px;border-top:1px solid var(--line-soft);display:flex;
  flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;font-size:12px;color:var(--dim)}
.sheet-foot img{height:20px;width:auto;opacity:.8}

@media (min-width:820px){.sheet{min-height:297mm}}
@media (max-width:560px){
  body{padding:12px 0}
  .toolbar{padding-inline:16px}
  .sheet{padding:28px 16px 20px;border-inline:0}
  .fig{font-size:42px}
  .lesson{grid-template-columns:40px 1fr;gap:10px}
  .lesson-n{font-size:40px}
}
@page{size:A4;margin:0}
@media print{
  body{background:var(--bg);padding:0}
  .toolbar{display:none}
  .sheet{max-width:none;width:210mm;height:297mm;min-height:0;margin:0;border:0;break-after:page}
  .sheet:last-child{break-after:auto}
  .sheet{padding:11mm 14mm 8mm;gap:14px}
  h1{font-size:76px}
  .lead{font-size:15.5px}
  .fig,.lesson-n{font-size:44px}
  .figures>div{padding-block:8px}
  .lesson{padding-block:8px}
  .lesson>div{gap:4px}
  .sheet-head{gap:6px}
  .box{padding:12px 18px;gap:7px}
}
</style>`;

function doc(t, sheets) {
  return `<!DOCTYPE html>
<!-- נוצר אוטומטית על ידי tools/build-syllabus.mjs מתוך assets/data/courses.mjs. לא לערוך ידנית. -->
<html lang="he" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>סילבוס · ${esc(t.name)} | SHWADRON.AI</title>
<meta name="description" content="הסילבוס המלא של ${esc(t.name)}: ${esc(t.lead)}"/>
<meta name="robots" content="noindex, follow"/>
<link rel="icon" type="image/png" href="assets/public/icon.svg"/>
<link rel="stylesheet" href="assets/css/fonts.css"/>
${STYLE}
</head>
<body>
<div class="toolbar">
  <a href="${t.file}">→ חזרה לדף ${esc(t.name)}</a>
  <button type="button" onclick="window.print()">הדפסה / שמירה כ-PDF</button>
</div>

${sheets}
</body>
</html>
`;
}

for (const [file, t, render] of [
  ['syllabus-beginners.html', BEGINNERS, beginnersPage],
  ['syllabus-advanced.html',  ADVANCED,  advancedPages],
  ['syllabus-digital.html',   DIGITAL,   digitalPage],
]) {
  writeFileSync(join(ROOT, file), doc(t, render()));
  console.log('✓ ' + file);
}
