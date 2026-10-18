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
// סדר העמודות בלשונית. עמודה חדשה שנוספת כאן (כמו "מייל") מתווספת לבד
// בסוף שורת הכותרות בלשונית קיימת, בלי לגעת בשורות הישנות.
const HEADERS = ['תאריך', 'שם', 'טלפון', 'מאיזה דף', 'שם העסק', 'סוג פנייה', 'הסכמה לדיוור', 'מקור הגעה', 'מייל'];

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
      'סוג פנייה': d.kind === 'callback' ? 'בקשה לחזרה' : 'וובינר',
      'הסכמה לדיוור': d.consent ? 'כן' : 'לא',
      'מקור הגעה': d.source || '',
      'מייל': d.email || '',
    };
    const head = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    sheet.appendRow(head.map(h => (h in values ? values[h] : '')));
  } finally {
    lock.releaseLock();
  }
  return out({ ok: true });
}

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
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

// להרצה ידנית מתוך עורך הסקריפט: יוצר את הלשונית ומוסיף שורת בדיקה
function testRow() {
  doPost({ postData: { contents: JSON.stringify({
    secret: SECRET, name: 'בדיקה', phone: '0500000000', course: 'בדיקה מהעורך',
    kind: 'callback', consent: false, email: 'test@example.com', ts: new Date().toISOString(),
  }) } });
}
