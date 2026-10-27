/* ============================================================
   גיליון הלידים: Google Apps Script שמותקן בתוך הגיליון עצמו.
   api/lead.js שולח לכאן כל ליד (וובינר / "חזרו אליי"), והסקריפט
   מוסיף שורה ללשונית "לידים מהאתר". אם הלשונית לא קיימת, היא נוצרת.

   התקנה (פעם אחת):
   1. בגיליון: הרחבות > Apps Script. מוחקים את מה שיש ומדביקים את הקובץ הזה.
   2. משנים את SECRET למטה למחרוזת אקראית משלכם, ושומרים.
   3. פריסה > פריסה חדשה > סוג: אפליקציית אינטרנט.
      הפעלה בתור: אני. מי יכול לגשת: כל אחד. פריסה, ואישור ההרשאות.
   4. מעתיקים את כתובת ה-Web app.
   5. ב-Vercel > Settings > Environment Variables מוסיפים:
        LEADS_SHEET_URL    = כתובת ה-Web app
        LEADS_SHEET_SECRET = אותה מחרוזת כמו SECRET
      ואז Redeploy כדי שהמשתנים ייכנסו לתוקף.
   שינוי בקוד כאן דורש "ניהול פריסות > עריכה > גרסה חדשה", אחרת
   הכתובת ממשיכה להריץ את הגרסה הקודמת.
   ============================================================ */

const SHEET_NAME = 'לידים מהאתר';
const SECRET = 'CHANGE-ME';
// מזהה הגיליון (החלק שבין /d/ ל-/edit בקישור). כשהוא מלא, הלידים נכתבים לגיליון הזה
// גם אם הסקריפט נפתח מגיליון אחר. ריק: הגיליון שממנו נפתח הסקריפט.
const SHEET_ID = '';
// סדר העמודות בלשונית. עמודה חדשה שנוספת כאן (כמו "מייל") מתווספת לבד
// בסוף שורת הכותרות בלשונית קיימת, בלי לגעת בשורות הישנות.
const HEADERS = ['תאריך', 'שם', 'טלפון', 'מאיזה דף', 'שם העסק', 'כמה עובדים', 'סוג פנייה', 'הסכמה לדיוור', 'מקור הגעה', 'מייל', 'מסלול', 'מה רוצה ללמוד', 'וובינר'];
// utm_source מהקישור (ראו UTM.md) בשם שמובן בגיליון. מקור שלא ברשימה נכתב כמו שהוא
const SOURCES = {
  status: 'סטטוס', groups: 'קבוצות התוכן', whatsapp_community: 'קהילת הוואטסאפ', private: 'הודעה בפרטי',
  alumni: 'בוגרים', email: 'מייל', partner: 'שיתוף פעולה', webinar: 'וובינר', direct: 'ישיר (קישור בלי תיוג)',
};
function sourceLabel(src) {
  const [name, campaign] = String(src || 'direct').split('/');
  return (SOURCES[name] || name) + (campaign ? ' · ' + campaign : '');
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad-json' }); }
  if (d.secret !== SECRET) return out({ ok: false, error: 'forbidden' });

  // נעילה, כדי ששני לידים באותה שנייה לא ידרסו זה את זה
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet();
    const values = {
      'תאריך': d.ts ? new Date(d.ts) : new Date(),
      'שם': d.name || '',
      'טלפון': "'" + (d.phone || ''),       // גרש: שהאפס בתחילת המספר לא ייעלם
      'מאיזה דף': d.course || '',
      'שם העסק': d.company || '',
      'כמה עובדים': d.employees || '',
      'סוג פנייה': d.kind === 'callback' ? 'בקשה לחזרה' : d.kind === 'register' ? 'הרשמה' : 'וובינר',
      'הסכמה לדיוור': d.consent ? 'כן' : 'לא',
      'מקור הגעה': sourceLabel(d.source),
      'מייל': d.email || '',
      'מסלול': d.track || '',
      'מה רוצה ללמוד': d.message || '',
      'וובינר': WEBINARS[d.topicKey] ? WEBINARS[d.topicKey].title + ' · ' + WEBINARS[d.topicKey].when : '',
    };
    const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.appendRow(head.map(h => (h in values ? values[h] : '')));
  } finally {
    lock.releaseLock();
  }
  // מייל אישור לנרשמים בטופס ההרשמה. אם השליחה נכשלה, הליד כבר נשמר ולא מכשילים את הבקשה.
  if (d.kind === 'register' && d.email) {
    try { sendConfirmation(d); } catch (err) { console.error('confirmation mail: ' + err); }
  }
  return out({ ok: true });
}

/* ------------------------------------------------------------
   מייל אישור הרשמה
   נשלח מחשבון הגוגל שמריץ את הסקריפט (MailApp), אז בהתקנה הראשונה
   צריך לאשר את ההרשאה "שליחת מייל בשמך". מכסה בחשבון רגיל: כ-100 מיילים ביום.
   וובינר חדש: מוסיפים כאן מפתח עם אותו שם כמו ב-TOPICS ב-assets/js/register.js,
   ושולחים קישור register.html?for=<מפתח>. כל השאר נשלח לבד.
   ------------------------------------------------------------ */
const WEBINARS = {
  'browser-webinar': {
    title: 'התוסף של קלוד ו-ChatGPT לדפדפן, ואיזה כוח זה נותן לנו',
    when: 'יום רביעי, 21.10, בשעה 20:30',
    start: '20261021T203000', end: '20261021T213000',   // שעון ישראל, ללוח השנה
    zoom: 'https://us06web.zoom.us/j/82945699160?pwd=ZL8rdX5bTHKJL4gUgZrVGA71cbJJmn.1',
    prepare: 'מחשב עם דפדפן Chrome, וחשבון ב-ChatGPT או בקלוד (אפשר גם חינמי).',
  },
  'claude-code': {
    title: 'עובד שיושב לך על המחשב: Claude Code למי שלא מתכנת',
    when: 'יום שני, 2.11, בשעה 20:30',
    start: '20261102T203000', end: '20261102T213000',
    zoom: 'https://us06web.zoom.us/j/85933675922?pwd=zNi9UUzfF6RzW2laktslkLUjP3jh8h.1',
    prepare: 'מחשב. לא צריך שום ידע בתכנות.',
  },
  'pro-answers': {
    title: 'מתשובה בינונית לתשובה מקצועית: 7 הכללים, ותמונות שלא נראות כמו AI',
    when: 'יום רביעי, 11.11, בשעה 20:30',
    start: '20261111T203000', end: '20261111T213000',
    zoom: '',   // TODO: קישור הזום של 11.11. עד שיש קישור, המייל אומר שהקישור יישלח לפני הוובינר
    prepare: 'מחשב, וחשבון ב-ChatGPT או בקלוד (אפשר גם חינמי).',
  },
};
const TIPS_GROUP = 'https://chat.whatsapp.com/LPJw92Y30OV78GmbFzh5xv';

function sendConfirmation(d) {
  const first = String(d.name || '').trim().split(/\s+/)[0] || '';
  const w = WEBINARS[d.topicKey];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const btn = (href, text) => '<a href="' + esc(href) + '" style="display:inline-block;background:#5FC3B1;color:#0B1F3A;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:999px;margin:6px 0">' + esc(text) + '</a>';

  let subject, body;
  if (w) {
    const cal = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + '&text=' + encodeURIComponent('וובינר · ' + w.title)
      + '&dates=' + w.start + '/' + w.end + '&ctz=Asia/Jerusalem'
      + '&details=' + encodeURIComponent(w.zoom ? 'קישור לזום ' + w.zoom : 'קישור לזום יישלח במייל ובוואטסאפ לפני הוובינר');
    subject = 'נרשמת לוובינר · ' + w.title;
    body =
      '<p style="font-size:18px;margin:0 0 14px">שלום ' + esc(first) + ',</p>' +
      '<p>איזה כיף שנרשמת! מחכה לראות אותך בוובינר.</p>' +
      '<div style="background:#F2F6FB;border-right:4px solid #5FC3B1;padding:14px 16px;margin:18px 0;border-radius:6px">' +
        '<p style="margin:0 0 6px;font-weight:bold;font-size:17px;color:#4369AA">' + esc(w.title) + '</p>' +
        '<p style="margin:0">📅 ' + esc(w.when) + '</p>' +
        '<p style="margin:0">💻 בזום, ללא עלות</p>' +
      '</div>' +
      (w.zoom ? '<p style="margin:0 0 4px">הקישור להצטרפות</p>' + btn(w.zoom, 'כניסה לזום')
              : '<p style="margin:0 0 4px">את הקישור לזום אשלח לך לפני הוובינר.</p>') +
      '<p style="margin:14px 0 4px">וכדי לא לשכוח</p>' + btn(cal, 'הוספה ליומן') +
      '<p style="margin-top:18px"><b>מה כדאי להכין?</b><br/>' + esc(w.prepare) + ' נעבוד יחד בלייב, אז כדאי להגיע עם מחשב ולא רק מהטלפון.</p>';
  } else {
    subject = 'קיבלנו את הפרטים שלך | SHWADRON.AI';
    body =
      '<p style="font-size:18px;margin:0 0 14px">שלום ' + esc(first) + ',</p>' +
      '<p>תודה שנרשמת! הפרטים התקבלו, ויוחנן יחזור אליך בהקדם.</p>' +
      (d.track ? '<p>המסלול שבחרת: <b>' + esc(d.track) + '</b></p>' : '');
  }
  body +=
    '<p>בינתיים, בקבוצת הטיפים בוואטסאפ אני משתף טיפים קצרים על AI כמעט כל יום.</p>' + btn(TIPS_GROUP, 'להצטרפות לקבוצת הטיפים') +
    '<p style="margin-top:22px">שאלות? אפשר פשוט להשיב למייל הזה, או לכתוב לי בוואטסאפ 052-818-9921.</p>' +
    '<p style="margin:18px 0 0">להתראות,<br/><b>יוחנן שבדרון</b><br/><span style="color:#56657E">SHWADRON.AI</span></p>';

  // צבעי המותג כמו באתר (brand-ads.css): כחול #4369AA, טורקיז #5FC3B1, טקסט כחול כהה #1E3A69
  const html =
    '<div dir="rtl" style="background:#F2F6FB;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
      '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D5DEEA">' +
        '<div style="background:#4369AA;padding:18px 24px;text-align:right">' +
          // הלוגו מראש האתר (logo-shwadron-white.svg) כ-PNG, כי Gmail לא מציג SVG. אם תמונות חסומות, מוצג הטקסט החלופי
          '<img src="https://ai.shwadron-ai.com/assets/public/logo-email.png" alt="SHWADRON.AI" width="260" height="57" style="display:block;border:0;width:260px;height:auto;color:#ffffff;font-size:20px;font-weight:bold"/>' +
        '</div>' +
        '<div style="padding:24px;color:#1E3A69;font-size:16px;line-height:1.6;text-align:right">' + body + '</div>' +
      '</div>' +
    '</div>';

  MailApp.sendEmail({ to: d.email, subject: subject, htmlBody: html, name: 'יוחנן שבדרון' });
}

function getSheet() {
  const ss = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.setRightToLeft(true);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  // כותרות שחסרות בלשונית קיימת נוספות בסוף
  const head = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  HEADERS.filter(h => head.indexOf(h) === -1).forEach(h => {
    sheet.getRange(1, sheet.getLastColumn() + 1).setValue(h);
  });
  sheet.getRange(1, 1, 1, sheet.getLastColumn()).setFontWeight('bold');
  return sheet;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// להרצה ידנית מתוך עורך הסקריפט: שולח את מייל האישור של הוובינר לכתובת שלך, כדי לראות איך הוא נראה
function testConfirmationMail() {
  sendConfirmation({ name: 'יוחנן שבדרון', email: Session.getEffectiveUser().getEmail(), topicKey: 'claude-code', kind: 'register' });
}

// להרצה ידנית מתוך עורך הסקריפט: יוצר את הלשונית ומוסיף שורת בדיקה
// ביומן ההרצה רואים לאיזה גיליון נכתבה השורה, ומה הסקריפט החזיר
function testRow() {
  const res = doPost({ postData: { contents: JSON.stringify({
    secret: SECRET, name: 'בדיקה', phone: '0500000000', course: 'בדיקה מהעורך',
    kind: 'callback', consent: false, email: 'test@example.com', ts: new Date().toISOString(),
  }) } });
  const sheet = getSheet();
  console.log('תשובה: ' + res.getContent());
  console.log('נכתב לגיליון: ' + sheet.getParent().getUrl() + ' · לשונית: ' + sheet.getName() + ' · שורות: ' + sheet.getLastRow());
}
