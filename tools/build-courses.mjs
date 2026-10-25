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
import { BEGINNERS, ADVANCED, DIGITAL, ALL_TRACKS, COMPARE, TRACKS, SCHEDULE_NOTE,
         TIME, NO_CLASSES, ORGS, ORGS_TITLE, ORGS_QUOTE, MARQUEE, WEBINAR, TIPS_GROUP }
         from '../assets/data/courses.mjs';

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

/* האם בערב הזה אין מפגש (חנוכה וכדומה). השוואת מחרוזות ISO */
const isBreak = d => {
  const iso = d.toISOString().slice(0, 10);
  return NO_CLASSES.some(b => iso >= b.from && iso <= b.to);
};

/* התאריך של מפגש מספר i, שבוע אחרי שבוע מהפתיחה. שבוע שנופל
   בימים בלי מפגשים מדולג, והמפגש עובר לשבוע שאחריו. */
function sessionDate(startISO, i) {
  const d = new Date(startISO + 'T00:00:00Z');
  for (let n = 0; ; d.setUTCDate(d.getUTCDate() + 7)) {
    if (isBreak(d)) continue;
    if (n++ === i) return d;
  }
}
const dayMonth  = d => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
const longDate  = d => `${d.getUTCDate()} ב${MONTHS[d.getUTCMonth()]}`;

/* "יום שני, א׳ בחשוון · 12 באוקטובר" */
const startLabel = t => t.start
  ? `יום ${t.dayName}, ${t.hebrew ? t.hebrew + ' · ' : ''}${longDate(sessionDate(t.start, 0))}`
  : 'יעודכן בהמשך';

/* מחיר בשקלים עם מפריד אלפים, כמו בכל מקום אחר בדף */
const ils = n => n.toLocaleString('he-IL') + ' ₪';
/* המחיר הסופי כולל מע״מ: זה המחיר הראשי שמוצג לצרכן */
const totalOf = t => Math.round(t.priceEx * (1 + t.vatRate) * 100) / 100;

/* השורה הקטנה מתחת לכפתור בכרטיס המסלול */
const priceNote = t => t.priceEx
  ? `${t.meta[0]} · ${ils(totalOf(t))} כולל מע״מ`
  : `${t.meta[0]} · המחיר יעודכן`;

/* ─── שרשרת שלבים: רעיון ← אפיון ← בנייה ─────────────────────
   בנויה על אותם ויזואלים של .pills span, עם חץ מפריד.        */
function flow(steps, label) {
  const items = steps.map((s, i) =>
    (i ? '<i aria-hidden="true">←</i>' : '') + `<span>${esc(s)}</span>`).join('\n  ');
  return `<div class="flow" role="list" aria-label="${esc(label)}">\n  ${items}\n</div>`;
}

/* ─── שורת מפגש בעיצוב החדש (.lesson ב-shw-2026.css) ─── */
function lessonRow(n, when, title, desc, extra) {
  return `<article class="lesson">
  <span class="lesson-n ltr">${esc(n)}</span>
  <div>
    <p class="lesson-when">${esc(when)}</p>
    <h3 class="card-title">${esc(title)}</h3>
    <p class="body">${esc(desc)}</p>${extra ? '\n' + ind(4, extra) : ''}
  </div>
</article>`;
}

/* ─── הודעת הפסקה בין שני מפגשים ─────────────────────────────
   כשהסדרה מדלגת על שבוע, בלוח נפער חור של שבועיים. בלי שורה
   שמסבירה אותו הגולש רואה תאריכים שלא מסתדרים ומאבד אמון בלוח.
   מחזיר מחרוזת ריקה כשאין דילוג בין i-1 ל-i.                */
function breakNote(startISO, i) {
  if (!startISO || i === 0) return '';
  const prev = sessionDate(startISO, i - 1);
  const next = sessionDate(startISO, i);
  const gapDays = Math.round((next - prev) / 86400000);
  if (gapDays <= 7) return '';
  /* איזה טווח נפל באמצע. אם יש כמה, לוקחים את הראשון שרלוונטי */
  const mid = NO_CLASSES.find(b => {
    const from = new Date(b.from + 'T00:00:00Z');
    return from > prev && from < next;
  });
  const label = mid ? mid.label : 'הפסקה';
  return `<p class="lesson-break">${esc(label)}: אין מפגש בשבוע הזה, והסדרה ממשיכה בשבוע שאחריו.</p>\n`;
}

/* ─── כרטיס מסלול בדף הבחירה (.track הקיים) ───────────────────
   הכרטיס נושא את כל מה שצריך כדי להחליט: מתי מתחילים, מה יוצאים
   איתו, המחיר, ומחיר הרישום המוקדם כל עוד הוא בתוקף. הכפתור
   מוביל למקטע ההרשמה שבדף המסלול, ושם גם מוחלת ההנחה.          */
function trackCard(t, i) {
  const sr = i ? ' sr-2' : '';
  const promoNote = t.priceEx
    ? `\n    <b class="note promo" data-promo hidden>עד 19.10 בחצות ${
        fmt(Math.round(totalOf(t) * 0.9 * 100) / 100)} כולל מע״מ</b>`
    : '';
  return `<article class="track${t.tone ? ' ' + t.tone : ''} sr${sr}">
  <span class="lvl on-light${t.tone ? ' ' + t.tone : ''}">${esc(t.kicker.split('·')[0].trim())}</span>
  <div class="meta">${t.meta.map((m, j) =>
    (j ? '<i aria-hidden="true">·</i>' : '') + `<span>${esc(m)}</span>`).join('')}</div>
  <h3>${esc(t.name)}</h3>
  <p class="when-line">${esc(`${t.sessions} מפגשים · מיום ${t.dayName} ${
    t.start ? dayMonth(sessionDate(t.start, 0)) : 'יעודכן'} · ${t.time || TIME}`)}</p>
  <p class="lead">${esc(t.lead)}</p>
  <ul>
${t.highlights.map(h => `    <li>${CHECK}${esc(h)}</li>`).join('\n')}
  </ul>
  <p class="who"><b>${esc(t.outcome || t.promise)}</b></p>
  <div class="foot">
    <a class="btn btn-lg" href="${t.file}#buy" data-track-pick="${t.id}">לשריין מקום במסלול ${esc(t.short)}</a>
    <span class="note">${esc(priceNote(t))}</span>${promoNote}
    <a class="more" href="${t.file}" data-track-pick="${t.id}">לכל הפרטים על המסלול &#8592;</a>
  </div>
</article>`;
}

/* ─── שלושת כרטיסי המסלולים בדף הבית (.card ב-shw-2026.css) ──
   המחירים נגזרים כולם מ-priceEx, כך שעדכון מחיר בקובץ הנתונים
   מתגלגל לכרטיס, לטבלת ההשוואה ולדף המסלול באותה הרצה.      */
function hubTrack(t) {
  const total = totalOf(t);
  const pmt   = fmt(Math.round(total / 3));
  const when  = t.start
    ? `פתיחה: יום ${t.dayName}, ${dayMonth(sessionDate(t.start, 0))}`
    : (t.when || '');
  const href  = t.start ? `${t.file}#buy` : t.file;
  const note  = t.note || `כולל מע״מ · או 3 תשלומים של כ-${pmt}`;
  return `<article class="card${t.flag ? ' is-featured' : ''}">${t.flag
    ? `\n  <span class="card-flag">${esc(t.flag)}</span>` : ''}
  <p class="card-kicker">${esc(t.kicker)}</p>
  <h3 class="card-name">${esc(t.name)}</h3>
  <p class="body" style="color:var(--ink-2)">${esc(t.lead)}</p>
  <div class="card-mini">
${t.figures.map(([n, l], i) => `    <div><span class="fig${
      i === 2 && t.flag ? ' on-accent' : ''}">${esc(n)}</span><span class="fig-label">${esc(l)}</span></div>`).join('\n')}
  </div>
  <ul class="ticks">
${t.ticks.map(x => `    <li>${esc(x)}</li>`).join('\n')}
  </ul>
  <div class="card-foot">
    <div class="card-price">
      <b>${esc(fmt(total))}</b>
      <span class="${t.start ? 'when' : ''}">${esc(when)}</span>
    </div>
    <span class="small">${esc(note)}</span>
    <a class="btn ${t.flag ? 'btn-primary' : 'btn-light'} btn-block" href="${href}" data-track-pick="${t.id}">${esc(t.cta)}</a>
  </div>
</article>`;
}
const hubTracks = () => ALL_TRACKS.map(hubTrack).join('\n\n');

/* ─── טבלת ההשוואה של שלושת המסלולים ─── */
function hubCompare() {
  const [b, d, a] = ALL_TRACKS;
  const rows = [
    ['למי', 'לא נגעו, או נגעו קצת', 'רוצים ללמוד לבד, בקצב שלהם', 'רוצים AI בעבודה ובעסק'],
    ['פורמט', '3 ערבים חיים בזום', '4 שיעורים מוקלטים, 8 שעות', '9 מפגשים חיים בזום, 18 שעות'],
    ['ליווי', 'מרצה חי וקבוצת וואטסאפ', 'ספריית פרומפטים ועדכוני תוכן', 'מרצה חי והכוונה בבנייה'],
    ['יוצאים עם', 'ביטחון ושימוש יומיומי', 'סוכן אישי וארבעה תוצרים', 'פרויקט AI אישי ותעודת סיום'],
    ['מתחילים', `יום ${b.dayName} ${dayMonth(sessionDate(b.start, 0))}`, 'מיד עם הרכישה',
                `יום ${a.dayName} ${dayMonth(sessionDate(a.start, 0))}`],
  ];
  return `<table class="tbl">
  <thead>
    <tr>
      <th scope="col" style="width:16%">&nbsp;</th>
      <th scope="col">${esc(b.name)}</th>
      <th scope="col">${esc(d.name)}</th>
      <th scope="col" class="col-accent">${esc(a.name)}</th>
    </tr>
  </thead>
  <tbody>
${rows.map(([k, ...v]) => `    <tr><th scope="row">${esc(k)}</th>${
      v.map(x => `<td>${esc(x)}</td>`).join('')}</tr>`).join('\n')}
    <tr><th scope="row">מחיר</th>${ALL_TRACKS.map(t =>
      `<td><b>${esc(fmt(totalOf(t)))}</b></td>`).join('')}</tr>
  </tbody>
</table>`;
}

/* ─── רצועת הלוגואים במקטע המעסיקים הבהיר ─── */
function hubLogos() {
  return `<div class="logos">
${ORGS.filter(o => o.alt !== 'לוגו שותף').map(o =>
  `  <img src="assets/public/logos/${o.file}" alt="${esc(o.alt)}" width="${o.w}" height="${o.h}" loading="lazy"/>`).join('\n')}
</div>`;
}

/* ─── רצועת לוגואים נעה (דף העסקים) ───
   שתי קבוצות זהות זו אחרי זו, והמסילה זזה בדיוק ברוחב קבוצה אחת,
   כך שהלולאה חלקה. כל קבוצה מכילה את הרשימה פעמיים כדי שתהיה רחבה
   ממסך גדול. רק הלוגואים בקבוצה הראשונה נקראים לקורא מסך. */
function logoRun() {
  const list = ORGS.filter(o => o.alt !== 'לוגו שותף');
  const img = (o, hidden) =>
    `<img src="assets/public/logos/${o.file}" alt="${hidden ? '' : esc(o.alt)}" width="${o.w}" height="${o.h}" loading="lazy"/>`;
  const set = hidden => list.map(o => img(o, hidden)).concat(list.map(o => img(o, true))).join('');
  return `<div class="logo-run">
  <div class="logo-run-track">
    <div class="logos">${set(false)}</div>
    <div class="logos" aria-hidden="true">${set(true)}</div>
  </div>
</div>`;
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
  return BEGINNERS.syllabus.map((s, i) => breakNote(BEGINNERS.start, i) + lessonRow(
    s.n,
    BEGINNERS.start
      ? `מפגש ${i + 1} · יום ${BEGINNERS.dayName}, ${s.hebrew ? s.hebrew + ' · ' : ''}${dayMonth(sessionDate(BEGINNERS.start, i))}`
      : s.when,
    s.title, s.desc,
    [s.flow ? flow(s.flow, `שלבי ${s.title}`) : '',
     s.flow2 ? `<p class="small" style="margin-top:18px">${esc(s.flow2Label)}</p>\n` +
       flow(s.flow2, `שלבי ${s.flow2Label}`).replace('class="flow"', 'class="flow" style="margin-top:8px"') : '',
    ].filter(Boolean).join('\n'))).join('\n');
}

/* ─── שלושת התחומים של מסלול המתקדמים (.lesson הקיים) ─── */
function advancedBlocks() {
  return ADVANCED.blocks.map(bl => {
    const extra = [
      bl.items ? `<ul class="ticks">\n${bl.items.map(x => `  <li>${esc(x)}</li>`).join('\n')}\n</ul>` : '',
      bl.flow ? flow(bl.flow, `שלבי ${bl.title}`) : '',
    ].filter(Boolean).join('\n');
    return lessonRow(bl.n, bl.when, bl.title, bl.desc, extra);
  }).join('\n');
}

/* ─── רשימת "מה לומדים" (.pills הקיים) ─── */
function learnPills() {
  return `<div class="pills sr sr-2">\n${
    BEGINNERS.learn.map(l => `  <span>${esc(l)}</span>`).join('\n')}\n</div>`;
}

/* ─── הפרויקט האישי, בכרטיס של העיצוב החדש ─── */
function projectBox() {
  const p = ADVANCED.project;
  return `<div class="card">
  <p class="card-kicker">${esc(p.title)}</p>
  <p class="lead">${esc(p.desc)}</p>
  <p class="body" style="color:var(--ink-2)">${esc(p.lead)}</p>
  <ul class="ticks">
${p.items.map(i => `    <li>${esc(i)}</li>`).join('\n')}
  </ul>${p.example ? `
  <p class="small">${esc(p.example)}${p.exampleLink
    ? ` <a href="${esc(p.exampleLink.href)}" style="color:var(--accent);text-decoration:underline">${esc(p.exampleLink.text)}</a>` : ''}</p>` : ''}
</div>`;
}

/* ─── הוובינר ───────────────────────────────────────────────
   הנגן נטען רק כשמגיעים אליו (loading="lazy"), כדי שלא יאט את
   טעינת הדף. הכותרת מגיעה מקובץ הנתונים ומכילה <em>, ולכן היא
   היחידה שאינה עוברת בריחת תווים.                             */
function videoSrc() {
  return WEBINAR.provider === 'vimeo'
    ? `https://player.vimeo.com/video/${WEBINAR.id}?dnt=1`
    : `https://drive.google.com/file/d/${WEBINAR.id}/preview`;
}

/* opts.reveal — שם מחלקת החשיפה בגלילה. דפי המסלולים משתמשים
   ב-sr, והדף הדיגיטלי ב-reveal, ולכן היא פרמטר ולא קבוע.
   opts.attr — תגית המדידה. בדף הדיגיטלי היא נשארת ריקה, כי שם
   סקריפט הדף דורס את ה-href של כל [data-buy] בקישור לסליקה. */
function webinar(opts = {}) {
  const href = opts.ctaHref || WEBINAR.cta.href;
  const text = opts.ctaText || WEBINAR.cta.text;
  const n    = opts.num || '07';
  return `<section class="sec" id="webinar">
  <div class="wrap stack">
    <div style="display:flex;flex-direction:column;gap:20px">
      <p class="eyebrow">${esc(n)} · עוד לא מוכן להחליט</p>
      <h2 class="h-sm">וובינר שלם,<br/><span class="on-accent">במתנה.</span></h2>
      <p class="lead">${esc(WEBINAR.lead)}</p>
      <p class="body">${esc(WEBINAR.note)}</p>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
      <form class="gift-form" data-gift novalidate>
        <div class="gift-fields">
          <label><span>שם</span><input name="name" autocomplete="name" required/></label>
          <label><span>טלפון</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" required/></label>
          <label class="biz-wide"><span>מייל</span><input name="email" type="email" inputmode="email" autocomplete="email" required/></label>
        </div>
        <label class="gift-consent"><input type="checkbox" name="consent"/> <span>אשמח לקבל מיוחנן עדכונים, טיפים והטבות בוואטסאפ (אפשר להסיר בכל עת)</span></label>
        <button class="btn btn-primary btn-block" type="submit">פתחו לי את הוובינר</button>
        <p class="gift-msg" role="status" aria-live="polite"></p>
        <p class="gift-fine">הפרטים נשמרים רק אצלנו, לפי <a href="privacy.html" target="_blank" rel="noopener">מדיניות הפרטיות</a>.</p>
      </form>
      <div class="gift-done" hidden>
        <p class="lead"><b>הוובינר פתוח, צפייה מהנה.</b> רוצים להמשיך לקבל טיפים קצרים על AI? בקבוצת הטיפים יוחנן משתף טיפים שוטפים, בלי ספאם.</p>
        <a class="btn btn-primary tips-btn" href="${TIPS_GROUP}" target="_blank" rel="noopener"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z"/></svg>להצטרפות לקבוצת הטיפים בוואטסאפ</a>
      </div>
      <div class="video-frame gift-locked">
        <div class="gift-cover" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          <span>הוובינר נפתח מיד אחרי מילוי הפרטים</span>
        </div>
        <iframe data-src="${videoSrc()}" title="וובינר AI עם יוחנן שבדרון"
                allow="autoplay; fullscreen; picture-in-picture"
                allowfullscreen referrerpolicy="strict-origin-when-cross-origin" hidden></iframe>
      </div>
    </div>
    <a class="btn btn-light gift-after" href="${href}" data-join hidden>${esc(text)}</a>
  </div>
</section>`;
}

/* ─── הרצועה הנעה ───────────────────────────────────────────
   שתי קבוצות זהות, וההנפשה מזיזה את המסילה ב-50%, כך שהמעבר
   ביניהן אינו נראה. כל קבוצה מכילה את הרשימה שלוש פעמים, כדי
   שתהיה רחבה גם ממסך של 2560 ולא ייווצר פס ירוק ריק בסוף.   */
function marquee(key) {
  const items = MARQUEE[key];
  const set = Array.from({ length: 3 }, () =>
    items.map(t => `<span>${esc(t)}</span><i>/</i>`).join('')).join('');
  return `<div class="marquee" aria-hidden="true">
  <div class="marquee-track">
    <div>${set}</div>
    <div>${set}</div>
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
  <figure class="orgs-quote">
    <blockquote>״${esc(ORGS_QUOTE.text)}״</blockquote>
    <figcaption>${esc(ORGS_QUOTE.who)}</figcaption>
  </figure>
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
    : `<b class="price">${ils(totalOf(t))} כולל מע״מ</b>`;
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
    ['מחיר',      `${ils(totalOf(b))} / ${ils(totalOf(a))} כולל מע״מ`],
  ];
  return `<div class="dtl">
${rows.map(([k, v]) => `  <div><span>${esc(k)}</span><b>${esc(v)}</b></div>`).join('\n')}
</div>
<p class="dtl-note">${esc(SCHEDULE_NOTE)}</p>`;
}

/* ─── נתונים מובנים לגוגל, כולל המחיר ─── */
function jsonLd(t) {
  const url = `https://ai.shwadron-ai.com/${t.file}`;
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: `${t.name}, ${t.sessions === 3 ? 'שלושה' : 'תשעה'} מפגשי זום`,
    description: t.ldDescription,
    provider: { '@type': 'Person', name: 'יוחנן שבדרון', url: 'https://ai.shwadron-ai.com/' },
    inLanguage: 'he',
    educationalLevel: t.level,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: `PT${t.hours}H`,
      ...(t.start ? { startDate: `${t.start}T${(t.time || TIME).split('-')[0]}:00${t.tzOffset || ''}` } : {}),
    },
    image: 'https://ai.shwadron-ai.com/assets/public/yochanan-card.jpg',
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
    start:      ${t.start ? `'${t.start}'` : 'null'},
    couponPage: '${t.id}'
  };
</` + `script>`;
}

/* ─── מצב המחיר בתוך ה-HTML עצמו ─────────────────────────────
   הסקריפט בדף מחליף בין "המחיר יעודכן" למחיר, אבל מי שקורא את
   הדף בלי JS (גוגל, תצוגות מקדימות, כלי AI) ראה עד עכשיו "טרם
   פורסם". כאן ה-HTML נכתב כבר במצב הנכון, עם הסכומים עצמם.     */
const fmt = n => (n % 1 === 0 ? n.toLocaleString('he-IL') : n.toFixed(2)) + ' ₪';
function staticPrice(html, t) {
  const has = !!t.priceEx;
  html = html.replace(/<([a-z]+)([^>]*?) data-(has|no)-price( hidden)?([^>]*)>/g,
    (_m, tag, pre, kind, _h, post) =>
      `<${tag}${pre} data-${kind}-price${(kind === 'has') !== has ? ' hidden' : ''}${post}>`);
  if (!has) return html;
  const vat   = Math.round(t.priceEx * t.vatRate * 100) / 100;
  const total = Math.round(t.priceEx * (1 + t.vatRate) * 100) / 100;
  const val = { 'js-price': fmt(t.priceEx), 'js-price-vat': fmt(vat),
                'js-price-total': fmt(total), 'js-price-pmt': fmt(Math.round(total / 3)),
                'js-vat-rate': (t.vatRate * 100) + '%' };
  return html.replace(/class="(js-price|js-price-vat|js-price-total|js-price-pmt|js-vat-rate)"([^>]*)>[^<]*</g,
    (_m, cls, rest) => `class="${cls}"${rest}>${val[cls]}<`);
}
const PRICED = { 'course-beginners.html': BEGINNERS, 'course-advanced.html': ADVANCED };

/* ─── ההחלפה בפועל ─── */
const BLOCKS = {
  // fitCard, learnPills, details ו-detailsHub נשארים בקובץ אך אינם
  // מוזרקים יותר: המקטעים שהשתמשו בהם הוסרו מהדפים כדי לקצר אותם.
  // להחזרת אחד מהם צריך להחזיר גם את סימני ה-BUILD לדף.
  'index.html': {
    tracks:  hubTracks,
    compare: hubCompare,
    logos:   logoRun,
    webinar: () => webinar({ ctaHref: '#tracks' }),
  },
  'course-beginners.html': {
    logos:    logoRun,
    syllabus: beginnersSyllabus,
    config:   () => config(BEGINNERS),
    ld:       () => jsonLd(BEGINNERS),
    webinar:  () => webinar({ ctaHref: '#buy', num: '08' }),
  },
  // דף העסקים: רק רצועת הלוגואים הנעה, כמו בדף הבית.
  'business.html': {
    logos: logoRun,
  },
  // הדף הדיגיטלי: רק הוובינר. שאר התוכן שלו אינו מנוהל כאן.
  'course.html': {
    webinar: () => webinar({ ctaHref: '#buy', ctaText: 'אני רוצה להתחיל ללמוד', num: '08' }),
  },
  'course-advanced.html': {
    logos:    logoRun,
    syllabus: advancedBlocks,
    project:  projectBox,
    config:   () => config(ADVANCED),
    ld:       () => jsonLd(ADVANCED),
    webinar:  () => webinar({ ctaHref: '#buy', num: '09' }),
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
  if (PRICED[file]) html = staticPrice(html, PRICED[file]);
  writeFileSync(path, html);
  console.log(`✓ ${file}`);
  touched++;
}
console.log(`\nעודכנו ${touched} קבצים מתוך assets/data/courses.mjs`);
