/* ============================================================
   SHWADRON.AI · דף קצר להציג למנהל, אחד לכל מחזור חי
   ------------------------------------------------------------
   מריצים:  node tools/build-manager.mjs [תיקיית פלט]

   עמוד A4 אחד לכל מסלול, לעובד שהמעסיק משלם עליו: מה העובד
   ילמד, עם מה הוא חוזר לעבודה, כמה זמן זה לוקח, מה צריך, מחיר
   וחשבונית. הכול נגזר מ-assets/data/courses.mjs, כך שאחרי שינוי
   בתאריכים או במחיר מריצים שוב. הפלט: manager-beginners.pdf ו-
   manager-advanced.pdf. ה-HTML שממנו הם נבנים נכתב לתיקייה זמנית ולא עולה לאתר.
   ברירת המחדל לפלט היא assets/public/syllabus/, שהקבצים בה עולים
   לאתר (ראו .vercelignore).
   ============================================================ */
import { writeFileSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { BEGINNERS, ADVANCED, TIME, NO_CLASSES, COHORT, WHATSAPP } from '../assets/data/courses.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(process.argv[2] || join(ROOT, 'assets/public/syllabus'));
const asset = p => pathToFileURL(join(ROOT, p)).href;

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* אותו חישוב מועדים כמו בשאר הסקריפטים: שבוע אחרי שבוע, בלי NO_CLASSES */
const isBreak = d => NO_CLASSES.some(b => { const i = d.toISOString().slice(0, 10); return i >= b.from && i <= b.to; });
function sessionDate(startISO, i) {
  const d = new Date(startISO + 'T00:00:00Z');
  for (let n = 0; ; d.setUTCDate(d.getUTCDate() + 7)) {
    if (isBreak(d)) continue;
    if (n++ === i) return d;
  }
}
const dm = d => `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
const ils = n => n.toLocaleString('he-IL', { maximumFractionDigits: 2 }) + ' ₪';
const total = t => Math.round(t.priceEx * (1 + t.vatRate) * 100) / 100;
const phone = '0' + WHATSAPP.number.slice(3).replace(/^(\d{2})(\d{3})(\d{4})$/, '$1-$2-$3');

/* מה שונה בין שני הדפים. כל משפט כאן נשען על מה שכבר כתוב באתר
   ובקובץ הנתונים, בלי מספרים ובלי תוצאות שלא נמדדו. */
const TRACK = {
  beginners: {
    t: BEGINNERS,
    kicker: 'דף למנהל · 3 מפגשים בזום',
    goal: 'העובד לומד לעבוד נכון עם AI ולהוציא ממנו תוצרים מקצועיים, על המשימות שלו מהעבודה, ולא על דוגמאות.',
    outs: BEGINNERS.syllabus.map((s, i) => ({ n: i + 1, title: s.title, out: s.out })),
    gains: [
      'עובד שמוציא מה-AI מסמכים, סיכומי פגישות ומצגות ברמה מקצועית, ויודע לבדוק ולשפר אותם',
      'שיטת עבודה קבועה (7 הכללים), שנשארת אצלו גם אחרי הקורס',
      'כל התרגול נעשה על משימות אמיתיות מהעבודה אצלכם',
    ],
    needs: 'מספיק טלפון עם זום (אפשר גם ממחשב). עובדים עם ChatGPT, Gemini, NotebookLM, Claude ו-Gamma, בגרסאות החינמיות. אין עלות נוספת.',
    data: '',
  },
  advanced: {
    t: ADVANCED,
    kicker: 'דף למנהל · 9 מפגשים בזום',
    goal: 'העובד לומד לאפיין תהליך עבודה ולבנות עבורו סוכני AI, אוטומציות וכלים, בלי לכתוב קוד. לאורך הקורס הוא מתכנן ובונה פרויקט AI אישי, עם תרגול והכוונה.',
    outs: ADVANCED.plan.map((s, i) => ({ n: i + 1, title: s.title, out: s.out })),
    gains: [
      'עובד שיודע לקחת עבודה שחוזרת על עצמה ולתאר אותה כתהליך שאפשר להעביר ל-AI',
      'פרויקט אישי מתוך העסק שלכם, שהוא ממשיך לפתח אחרי הקורס',
      'כללי בטיחות: מה הסוכן עושה לבד ומה רק באישור, מה מותר להדביק ומה לא',
    ],
    needs: 'מחשב. עובדים עם ChatGPT, Gemini, Claude, Claude Code, Make, סקילים וסוכנים. נדרש לפחות מנוי בתשלום לקלוד (בשביל Claude Code), בנוסף למחיר הקורס.',
    data: 'מידע של לקוחות: חלק מהקורס מוקדש לזה. מה מותר להדביק ל-AI ומה לא, מצבי הרשאות, חסימת קבצים רגישים, ועשר שאלות בטיחות לפני כל הפעלה של סוכן.',
  },
};

function page(key) {
  const { t, kicker, goal, outs, gains, needs, data } = TRACK[key];
  const dates = Array.from({ length: t.sessions }, (_, i) => sessionDate(t.start, i));
  const brk = NO_CLASSES.find(b => b.from > dates[0].toISOString().slice(0, 10) && b.to < dates.at(-1).toISOString().slice(0, 10));
  const when = t.sessions <= 4 ? dates.map(dm).join(', ') : `${dm(dates[0])} עד ${dm(dates.at(-1))}`;
  const closes = new Date(COHORT.closes + 'T00:00:00Z');
  const facts = [
    ['מתי', `ימי ${t.dayName}, ${t.time || TIME}, אחרי שעות העבודה`],
    ['תאריכים', `${when}${brk ? ` (בלי מפגש ב${brk.label})` : ''}`],
    ['היקף', `${t.sessions} מפגשים חיים בזום, שעתיים כל מפגש, ${t.hours} שעות בסך הכול`],
    ['קבוצה', `עד ${t.seats} משתתפים, וקבוצת ליווי בוואטסאפ`],
    ['הקלטות', 'כל מפגש מוקלט, למי שנאלץ להחסיר'],
  ];
  return `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"/>
<title>${esc(t.name)} · דף למנהל | SHWADRON.AI</title>
<style>
@font-face{font-family:'Rubik';font-weight:300 900;src:url(${asset('assets/fonts/rubik-hebrew-wght-normal.woff2')}) format('woff2');unicode-range:U+0590-05FF,U+200C-2010,U+20AA,U+25CC,U+FB1D-FB4F}
@font-face{font-family:'Rubik';font-weight:300 900;src:url(${asset('assets/fonts/rubik-latin-wght-normal.woff2')}) format('woff2')}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:'Rubik',Arial,sans-serif;color:#1E2B4A;font-size:10.6pt;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;height:297mm;display:flex;flex-direction:column;overflow:hidden}
header{background:linear-gradient(135deg,#2E4A8C,#3B5BA5 55%,#4E78B8);color:#fff;padding:9mm 14mm 7.5mm;position:relative}
header::after{content:"";position:absolute;inset:auto 0 0 0;height:3px;background:#65B8AB}
.top{display:flex;justify-content:space-between;align-items:center}
.top img{height:9mm}
.tag{font-size:9pt;font-weight:600;padding:1.4mm 3.5mm;border:1px solid rgba(255,255,255,.45);border-radius:99px;background:rgba(255,255,255,.1)}
h1{margin:5.5mm 0 1.5mm;font-size:24pt;font-weight:800;line-height:1.1}
h1 span{color:#A6E6DA}
.sub{margin:0;font-size:11.5pt;opacity:.92;max-width:150mm}
main{flex:1;padding:7mm 14mm 0;display:grid;grid-template-columns:1fr 66mm;gap:8mm}
h2{margin:0 0 2.5mm;font-size:12pt;font-weight:800;color:#3B5BA5}
.goal{margin:0 0 6mm;font-size:11pt}
ol{list-style:none;margin:0 0 6mm;padding:0;display:grid;gap:${outs.length > 4 ? '1.6mm' : '3mm'}}
ol li{display:grid;grid-template-columns:7mm 1fr;gap:2.5mm;align-items:start}
ol b.n{display:grid;place-items:center;width:7mm;height:7mm;border-radius:2mm;background:#EAF0FA;color:#3B5BA5;font-size:9.5pt;font-weight:800}
ol .tt{font-weight:700;display:block;font-size:${outs.length > 4 ? '10pt' : '10.6pt'}}
ol .o{display:block;color:#47567A;font-size:${outs.length > 4 ? '9.3pt' : '10pt'};line-height:1.4}
ul.g{margin:0;padding:0;list-style:none;display:grid;gap:2mm}
ul.g li{padding-inline-start:5mm;position:relative}
ul.g li::before{content:"";position:absolute;inset-inline-start:0;top:2.2mm;width:2.2mm;height:2.2mm;border-radius:50%;background:#65B8AB}
aside{display:flex;flex-direction:column;gap:4mm}
.box{border:1px solid #D7E0EE;border-radius:4mm;padding:4mm 4.5mm;background:#F6F9FD}
.box.price{background:#EEF8F5;border-color:#B9E2D9}
dl{margin:0;display:grid;gap:2mm}
dt{font-size:8.6pt;font-weight:700;color:#3B5BA5}
dd{margin:0;font-size:9.8pt;line-height:1.4}
.big{font-size:20pt;font-weight:800;color:#1E2B4A;line-height:1.1;margin:1mm 0 .5mm}
.small{font-size:9pt;color:#47567A;line-height:1.45;margin:0}
.box p{margin:0}
.box p+p{margin-top:1.6mm}
.note{margin:5mm 0 0;padding:3.5mm 4.5mm;border-radius:4mm;background:#FFF7E8;border:1px solid #F1DDB4;font-size:9.6pt}
footer{margin:5mm 14mm 8mm;padding-top:4mm;border-top:1px solid #D7E0EE;display:flex;justify-content:space-between;gap:6mm;font-size:9.2pt;color:#47567A}
footer b{color:#1E2B4A}
</style></head>
<body><div class="sheet">
<header>
  <div class="top"><img src="${asset('assets/public/logo-shwadron-white.svg')}" alt="SHWADRON.AI"/><span class="tag">${esc(kicker)}</span></div>
  <h1>${esc(t.name)}<span> · הכשרת AI לעובד</span></h1>
  <p class="sub">מה העובד ילמד, עם מה הוא חוזר לעבודה, וכמה זה עולה לעסק.</p>
</header>
<main>
  <section>
    <h2>המטרה</h2>
    <p class="goal">${esc(goal)}</p>
    <h2>עם מה הוא חוזר מכל מפגש</h2>
    <ol>
${outs.map(o => `      <li><b class="n">${o.n}</b><span><span class="tt">${esc(o.title)}</span><span class="o">${esc(o.out)}</span></span></li>`).join('\n')}
    </ol>
    <h2>מה העסק מקבל</h2>
    <ul class="g">
${gains.map(g => `      <li>${esc(g)}</li>`).join('\n')}
    </ul>${data ? `
    <p class="note">${esc(data)}</p>` : ''}
  </section>
  <aside>
    <div class="box"><dl>
${facts.map(([k, v]) => `      <div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('\n')}
    </dl></div>
    <div class="box price">
      <p class="small"><b>מחיר</b></p>
      <p class="big">${esc(ils(t.priceEx))} <span style="font-size:11pt;font-weight:600">+ מע״מ</span></p>
      <p class="small">${esc(ils(total(t)))} כולל מע״מ · עד 3 תשלומים</p>
      <p class="small">החשבונית יוצאת על שם העסק.</p>
      <p class="small">החזר מלא אחרי המפגש הראשון: לא מתאים? מבקשים עד 48 שעות מתום המפגש, והכסף חוזר תוך 14 ימים.</p>
    </div>
    <div class="box"><p class="small"><b>מה צריך</b></p><p class="small">${esc(needs)}</p></div>
    <div class="box"><p class="small"><b>מי מלמד</b></p><p class="small">יוחנן שבדרון. בוגר תואר ראשון במדעי המחשב, התמחות בבינה מלאכותית. הוביל הטמעות AI במשרדי ממשלה וביותר מ-30 עסקים. יותר מ-1,500 בוגרים ב-30 מחזורים.</p></div>
  </aside>
</main>
<footer>
  <span><b>הרשמה ופרטים:</b> ai.shwadron-ai.com/${esc(t.file)} · וואטסאפ ${esc(phone)}</span>
  <span><b>ההרשמה נסגרת ב-${dm(closes)}</b></span>
</footer>
</div></body></html>`;
}

mkdirSync(OUT, { recursive: true });
const TMP = mkdtempSync(join(tmpdir(), 'shw-manager-'));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const browser = await chromium.launch();
const pg = await browser.newPage();
for (const key of Object.keys(TRACK)) {
  const html = join(TMP, `manager-${key}.html`);
  writeFileSync(html, page(key));
  await pg.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  const over = await pg.evaluate(() => { const s = document.querySelector('.sheet'); return s.scrollHeight - s.clientHeight; });
  if (over > 0) console.warn(`! manager-${key}: התוכן ארוך מעמוד אחד ב-${over}px`);
  await pg.pdf({ path: join(OUT, `manager-${key}.pdf`), format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  console.log('✓ manager-' + key + '.pdf');
}
await browser.close();
