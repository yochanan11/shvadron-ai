/* ============================================================
   SHWADRON.AI — הזרקת תוכן המסלולים לתוך הדפים
   ------------------------------------------------------------
   מריצים:  node tools/build-courses.mjs

   הסקריפט קורא את assets/data/courses.mjs ומחליף את התוכן שבין
   סימני BUILD בקבצי ה-HTML. הוא לא נוגע בשום דבר מחוץ לסימנים,
   ולכן אפשר להריץ אותו שוב ושוב בבטחה.

       <!-- BUILD:tracks -->  ...  <!-- /BUILD:tracks -->

   המרקאפ שנוצר משתמש אך ורק בקומפוננטות שכבר קיימות בגיליון
   assets/css/courses.css. אין כאן עיצוב חדש.
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BEGINNERS, ADVANCED, COMPARE, TRACKS, SCHEDULE_NOTE, TIME,
         ORGS, ORGS_TITLE } from '../assets/data/courses.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* בריחה מתווי HTML, כדי שתוכן מקובץ הנתונים לא ישבור את הדף */
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* וי בתוך רשימה, בדיוק ה-SVG שכבר בשימוש ב-.incl וב-.track */
const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

/* החץ שבסוף שורת שיעור, כמו ב-.lesson הקיים */
const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M19 12H5"/><path d="M11 18l-6-6 6-6"/></svg>';

const ind = (n, s) => s.split('\n').map(l => (l ? ' '.repeat(n) + l : l)).join('\n');

/* ─── מועדים ───────────────────────────────────────────────
   מועד המפגש הראשון נשמר בקובץ הנתונים, והמפגשים הבאים נגזרים
   ממנו לפי התדירות. שינוי תאריך הפתיחה מזיז את כל הסדרה.      */
const MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני',
                'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

/* התאריך של מפגש מספר i, בשבועות מהפתיחה */
function sessionDate(startISO, i) {
  const d = new Date(startISO + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + i * 7);
  return d;
}
const dayMonth  = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
const longDate  = d => `${d.getUTCDate()} ב${MONTHS[d.getUTCMonth()]}`;

/* "יום שני, א׳ בחשוון · 12 באוקטובר" */
const startLabel = t => t.start
  ? `יום ${t.dayName}, ${t.hebrew ? t.hebrew + ' · ' : ''}${longDate(sessionDate(t.start, 0))}`
  : 'יעודכן בהמשך';

/* מחיר בשקלים עם מפריד אלפים, כמו בכל מקום אחר בדף */
const ils = n => n.toLocaleString('he-IL') + ' ₪';

/* השורה הקטנה מתחת לכפתור בכרטיס המסלול */
const priceNote = t => t.priceEx
  ? `${t.meta[0]} · ${ils(t.priceEx)} + מע״מ`
  : `${t.meta[0]} · המחיר יעודכן`;

/* ─── שרשרת שלבים: רעיון ← אפיון ← בנייה ─────────────────────
   בנויה על אותם ויזואלים של .pills span, עם חץ מפריד.        */
function flow(steps, label) {
  const items = steps.map((s, i) =>
    (i ? '<i aria-hidden="true">←</i>' : '') + `<span>${esc(s)}</span>`).join('\n  ');
  return `<div class="flow" role="list" aria-label="${esc(label)}">\n  ${items}\n</div>`;
}

/* ─── כרטיס מסלול בדף הבחירה (.track הקיים) ─── */
function trackCard(t, i) {
  const sr = i ? ' sr-2' : '';
  return `<article class="track${t.tone ? ' ' + t.tone : ''} sr${sr}">
  <span class="lvl on-light${t.tone ? ' ' + t.tone : ''}">${esc(t.kicker.split('·')[0].trim())}</span>
  <div class="meta">${t.meta.map((m, j) =>
    (j ? '<i aria-hidden="true">·</i>' : '') + `<span>${esc(m)}</span>`).join('')}</div>
  <h3>${esc(t.name)}</h3>
  <p class="lead">${esc(t.lead)}</p>
  <ul>
${t.highlights.map(h => `    <li>${CHECK}${esc(h)}</li>`).join('\n')}
  </ul>
  <p class="who">${esc(t.promise)}</p>
  <div class="foot">
    <a class="btn btn-lg" href="${t.file}" data-track-pick="${t.id}">לפרטים על מסלול ${esc(t.short)}</a>
    <span class="note">${esc(priceNote(t))}</span>
  </div>
</article>`;
}

/* ─── כרטיס "מתאים לי אם" (.cmp-col הקיים ממקטע הפער) ─── */
function fitCard(t, i) {
  const sr = i ? ' sr-2' : '';
  return `<div class="cmp-col after sr${sr}">
  <h3><i aria-hidden="true">✓</i>${esc(t.name)}</h3>
  <p class="fit-lead">מתאים לי אם:</p>
  <ul>
${t.fit.map(f => `    <li>${esc(f)}</li>`).join('\n')}
  </ul>
  <a class="btn btn-sm" href="${t.file}" data-track-pick="${t.id}">למסלול ${esc(t.short)} ←</a>
</div>`;
}

/* ─── טבלת ההשוואה (.cmp-tbl הקיימת) ─── */
function compareTable() {
  const [b, a] = TRACKS;
  const cell = (val, no, col) =>
    `<td class="col-${col}${no ? ' no' : ''}">${no ? esc(val) : `<b>${esc(val)}</b>`}</td>`;
  return `<table class="cmp-tbl">
  <thead>
    <tr>
      <th scope="col">&nbsp;</th>
      <th scope="col" class="col-basic">${esc(b.name)}<span>${esc(b.meta[0])}</span></th>
      <th scope="col" class="col-pro">${esc(a.name)}<span>${esc(a.meta[0])}</span></th>
    </tr>
  </thead>
  <tbody>
${COMPARE.map(r => `    <tr>
      <th scope="row">${esc(r.label)}</th>
      ${cell(r.b, r.bNo, 'basic')}
      ${cell(r.a, r.aNo, 'pro')}
    </tr>`).join('\n')}
  </tbody>
</table>`;
}

/* ─── סילבוס מסלול המתחילים (.lesson הקיים) ─── */
function beginnersSyllabus() {
  return BEGINNERS.syllabus.map((s, i) => `<div class="lesson sr">
  <b>${esc(s.n)}</b>
  <div>
    <span class="when">${esc(BEGINNERS.start
      ? `מפגש ${i + 1} · יום ${BEGINNERS.dayName}, ${s.hebrew ? s.hebrew + ' · ' : ''}${dayMonth(sessionDate(BEGINNERS.start, i))}`
      : s.when)}</span>
    <h3>${esc(s.title)}</h3>
  </div>
  <div class="lesson-body">
    <p>${esc(s.desc)}</p>
${s.flow ? ind(4, flow(s.flow, `שלבי ${s.title}`)) : ''}
  </div>
  ${ARROW}
</div>`).join('\n');
}

/* ─── שלושת התחומים של מסלול המתקדמים (.lesson הקיים) ─── */
function advancedBlocks() {
  return ADVANCED.blocks.map(bl => `<div class="lesson sr">
  <b>${esc(bl.n)}</b>
  <div>
    <span class="when">${esc(bl.when)}</span>
    <h3>${esc(bl.title)}</h3>
  </div>
  <div class="lesson-body">
    <p>${esc(bl.desc)}</p>
${bl.items ? ind(4, `<ul class="lesson-list">\n${bl.items.map(x => `  <li>${esc(x)}</li>`).join('\n')}\n</ul>`) : ''}
${bl.flow ? ind(4, flow(bl.flow, `שלבי ${bl.title}`)) : ''}
  </div>
  ${ARROW}
</div>`).join('\n');
}

/* ─── רשימת "מה לומדים" (.pills הקיים) ─── */
function learnPills() {
  return `<div class="pills sr sr-2">\n${
    BEGINNERS.learn.map(l => `  <span>${esc(l)}</span>`).join('\n')}\n</div>`;
}

/* ─── הפרויקט האישי (.project-box הקיים) ─── */
function projectBox() {
  const p = ADVANCED.project;
  return `<div class="project-box sr">
  <div class="num" aria-hidden="true">✦</div>
  <div>
    <h2>${esc(p.title)}</h2>
    <p>${esc(p.desc)}</p>
    <p class="fit-lead">${esc(p.lead)}</p>
    <ul>
${p.items.map(i => `      <li>${esc(i)}</li>`).join('\n')}
    </ul>
  </div>
</div>`;
}

/* ─── רצועת הלוגואים ───────────────────────────────────────
   המסילה מורכבת משתי קבוצות זהות, וההנפשה מזיזה אותה ב-50%,
   כך שהמעבר בין סוף הקבוצה הראשונה לתחילת השנייה לא נראה.
   כל קבוצה מכילה את הרשימה פעמיים, כדי שגם מסך רחב יתמלא.   */
function orgs() {
  const img = (o, hidden) =>
    `<li><img src="assets/public/logos/${o.file}" ` +
    (hidden ? 'alt="" aria-hidden="true" ' : `alt="${esc(o.alt)}" `) +
    `width="${o.w}" height="${o.h}" style="height:${o.h}px" loading="lazy"/></li>`;

  const set = hidden => ORGS.map(o => img(o, hidden)).join('') +
                        ORGS.map(o => img(o, true)).join('');

  return `<div class="orgs sr">
  <h3 class="orgs-title">${esc(ORGS_TITLE)}</h3>
  <div class="orgs-strip">
    <div class="orgs-track">
      <ul class="orgs-set">${set(false)}</ul>
      <ul class="orgs-set" aria-hidden="true">${set(true)}</ul>
    </div>
  </div>
  <a class="orgs-cta" href="https://wa.me/972528189921" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>רוצים גם בעסק שלכם?<span class="sr-only"> (נפתח בוואטסאפ)</span></a>
</div>`;
}

/* ─── טבלת פרטי המסלול (.dtl הקיימת) ─── */
function details(t) {
  const rows = [
    ['מתחילים',   startLabel(t)],
    ['תדירות',    t.cadence],
    ['שעות',      t.time || TIME],
    ['מפגשים',    `${t.sessions} מפגשים`],
    ['סה״כ',      `${t.hours} שעות`],
    ['איפה',      'Zoom, גם באינטרנט מסונן'],
  ];
  const price = t.priceEx == null
    ? '<b class="price">תעודכן בהמשך</b>'
    : `<b class="price">${ils(t.priceEx)} + מע״מ</b>`;
  return `<div class="dtl">
${rows.map(([k, v]) => `  <div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('\n')}
  <div><span>עלות</span>${price}</div>
</div>
<p class="dtl-note">${esc(SCHEDULE_NOTE)}</p>`;
}

/* פרטי שני המסלולים בדף הבחירה */
function detailsHub() {
  const [b, a] = TRACKS;
  const rows = [
    ['מתחילים',   `${startLabel(b)} · ${b.sessions} מפגשים`],
    ['מתקדמים',   `${startLabel(a)} · ${a.sessions} מפגשים`],
    ['תדירות',    `פעם בשבוע, ${TIME}`],
    ['איפה',      'Zoom, גם באינטרנט מסונן'],
    ['הקלטות',    'כלולות ונשארות'],
    ['מחיר',      `${ils(b.priceEx)} / ${ils(a.priceEx)} + מע״מ`],
  ];
  return `<div class="dtl">
${rows.map(([k, v]) => `  <div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('\n')}
</div>
<p class="dtl-note">${esc(SCHEDULE_NOTE)}</p>`;
}

/* ─── נתונים מובנים לגוגל, כולל המחיר ─── */
function jsonLd(t) {
  const url = `https://www.shwadron-ai.com/${t.file}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `${t.name} — ${t.sessions === 3 ? 'שלושה' : 'תשעה'} מפגשי זום`,
    description: t.ldDescription,
    provider: { '@type': 'Person', name: 'יוחנן שבדרון', url: 'https://www.shwadron-ai.com/' },
    inLanguage: 'he',
    educationalLevel: t.level,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: `PT${t.hours}H`,
      ...(t.start ? { startDate: `${t.start}T${(t.time || TIME).split('-')[0]}:00${t.tzOffset || ''}` } : {}),
    },
    image: 'https://www.shwadron-ai.com/assets/public/yochanan-card.jpg',
  };
  if (t.priceEx != null) {
    const total = Math.round(t.priceEx * (1 + t.vatRate) * 100) / 100;
    data.offers = {
      '@type': 'Offer',
      price: total.toFixed(2),
      priceCurrency: 'ILS',
      availability: 'https://schema.org/InStock',
      url,
      priceSpecification: {
        '@type': 'PriceSpecification',
        price: String(t.priceEx),
        priceCurrency: 'ILS',
        valueAddedTaxIncluded: false,
        description: `${t.priceEx} ₪ לפני מע״מ. סה״כ לתשלום ${total.toFixed(2)} ₪ ` +
                     `כולל מע״מ ${t.vatRate * 100}%.`,
      },
    };
  }
  return '<script type="application/ld+json" id="course-ld">\n' +
         JSON.stringify(data, null, 2) + '\n</' + 'script>';
}

/* ─── הגדרת הדף: מכאן courses.js לוקח את המחיר ─── */
function config(t) {
  const price = t.priceEx == null ? 'null' : String(t.priceEx);
  const note  = t.priceEx == null
    ? '// המחיר טרם נקבע. לקביעתו: priceEx ב-assets/data/courses.mjs.'
    : '// המחיר מגיע מ-priceEx ב-assets/data/courses.mjs. לשינוי, לערוך שם';
  return `<script>
  ${note}
  // ולהריץ: node tools/build-courses.mjs
  window.SHW_COURSE = {
    id:         '${t.id}',
    name:       '${t.name}',
    price:      ${price},
    vatRate:    ${t.vatRate},
    couponPage: '${t.id}'
  };
</` + `script>`;
}

/* ─── ההחלפה בפועל ─── */
const BLOCKS = {
  'index.html': {
    tracks:  () => TRACKS.map(trackCard).join('\n\n'),
    fit:     () => TRACKS.map(fitCard).join('\n\n'),
    compare: compareTable,
    details: detailsHub,
    orgs:    orgs,
  },
  'course-beginners.html': {
    syllabus: beginnersSyllabus,
    learn:    learnPills,
    config:   () => config(BEGINNERS),
    ld:       () => jsonLd(BEGINNERS),
    details:  () => details(BEGINNERS),
  },
  'course-advanced.html': {
    syllabus: advancedBlocks,
    project:  projectBox,
    config:   () => config(ADVANCED),
    ld:       () => jsonLd(ADVANCED),
    details:  () => details(ADVANCED),
  },
};

let touched = 0;
for (const [file, blocks] of Object.entries(BLOCKS)) {
  const path = join(ROOT, file);
  let html = readFileSync(path, 'utf8');
  for (const [name, render] of Object.entries(blocks)) {
    const re = new RegExp(`(<!-- BUILD:${name} -->)[\\s\\S]*?(<!-- /BUILD:${name} -->)`);
    if (!re.test(html)) {
      console.error(`✗ ${file}: חסר סימן BUILD:${name}`);
      process.exitCode = 1;
      continue;
    }
    // המרקאפ מוזרק בהזחה של שני רווחים, כמו שאר גוף הדף
    html = html.replace(re, (_m, open, close) =>
      `${open}\n${ind(2, render())}\n${' '.repeat(2)}${close}`);
  }
  writeFileSync(path, html);
  console.log(`✓ ${file}`);
  touched++;
}
console.log(`\nעודכנו ${touched} קבצים מתוך assets/data/courses.mjs`);
