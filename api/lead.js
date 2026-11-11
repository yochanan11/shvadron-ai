const { kvRequest } = require('./_kv');

// גיליון הלידים בגוגל: סקריפט Apps Script שמותקן בגיליון עצמו (tools/leads-sheet.gs)
// ומוסיף שורה ללשונית "לידים מהאתר". מוגדר בשני משתני סביבה ב-Vercel:
// LEADS_SHEET_URL (כתובת ה-Web app) ו-LEADS_SHEET_SECRET (זהה ל-SECRET בסקריפט).
// בלי הכתובת פשוט מדלגים. אם הגיליון איטי או נופל, הליד עדיין נשמר ב-KV.
async function toSheet(lead, kind) {
  const url = process.env.LEADS_SHEET_URL;
  if (!url) throw new Error('sheet-not-configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...lead, kind, secret: process.env.LEADS_SHEET_SECRET || '' }),
      signal: ctrl.signal,
    });
    const text = await r.text();
    let out = {}; try { out = JSON.parse(text); } catch (e) {}
    if (!r.ok || !out.ok) throw new Error('sheet-error ' + r.status + ' ' + text.slice(0, 200));
  } finally {
    clearTimeout(timer);
  }
}

// מאיזה דף הגיע הטופס, בשם שמובן בדף הניהול
const COURSES = {
  'index.html':            'דף הבית (שני המחזורים)',
  'course-beginners.html': 'מאפס למאה (זום)',
  'course-advanced.html':  'צבא הסוכנים (זום)',
  'course.html':           'המוח השני (דיגיטלי)',
  'business.html':         'הטמעה בעסקים',
  'cases.html':            'מה נבנה בעסקים',
  'register.html':         'טופס הרשמה',
  'makom.html':            'שמירת מקום אחרי וובינר',
};

// טופס העסקים: מה מעניין את הפונה
const NEEDS = {
  lecture:  'הרצאה',
  team:     'הדרכה לצוות',
  employee: 'שליחת עובד למחזור',
  unsure:   'עוד לא בטוח',
};

// דף שמירת המקום (makom.html): מה מעניין את הנרשם
const INTERESTS = {
  beginners: 'מאפס למאה (מתחילים)',
  advanced:  'צבא הסוכנים (מתקדמים)',
  business:  'הטמעה בעסק',
  unsure:    'לא בטוח, רוצה להתייעץ',
};
const CALL_TIMES = ['בוקר', 'צהריים', 'ערב'];

// טופס ההרשמה (register.html): המסלול שבחרו
const TRACKS = {
  beginners: 'מאפס למאה (מתחילים)',
  advanced:  'צבא הסוכנים (מתקדמים)',
};
// וובינר לקהל רחב: במקום מסלול, מי נרשם
const WHO = {
  employee: 'שכיר',
  business: 'בעל עסק / עצמאי',
};

// טופס "הוובינר במתנה" וטופס "מתלבטים, חזרו אליי" (כל הדפים): שומר שם, טלפון והסכמה לדיוור ברשימה "leads"
// ב-Vercel KV. דף הניהול admin-leads.html קורא מאותה רשימה.
// הוובינר נפתח בדפדפן גם אם השמירה נכשלה, כדי לא להעניש את הגולש.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method-not-allowed' });

  const b = req.body || {};
  const name  = String(b.name || '').trim().slice(0, 80);
  const phone = String(b.phone || '').replace(/[^\d+]/g, '').slice(0, 20);
  const page  = String(b.page || '').trim().slice(0, 60);
  const consent = b.consent === true;
  // רק בטופס העסקים: שם העסק, מוצג בדף הניהול לצד הדף שממנו הגיעה הפנייה
  const company = String(b.company || '').trim().slice(0, 80);
  // רק בטופס העסקים: גודל הצוות, כפי שנבחר ברשימה (למשל "11-25")
  const employees = String(b.employees || '').trim().slice(0, 20);
  // טופס "חזרו אליי" (לעומת טופס הוובינר), כדי שבדף הניהול יהיה ברור מי ביקש שיחה
  const callback = b.kind === 'callback';
  // מקור ההגעה (utm_source הראשון), אם הגולש אישר עוגיות סטטיסטיקה
  const source = String(b.source || '').trim().slice(0, 40);
  // מייל: חובה בטופס הוובינר ובטופס ההרשמה. בטופס "חזרו אליי" אין שדה מייל (שם וטלפון בלבד)
  const email = String(b.email || '').trim().slice(0, 120);
  // טופס "חזרו אליי": הכפתור שהביא את הגולש לטופס (כותרת, רצועה תחתונה, פתיחה וכו')
  const cta = callback ? String(b.cta || '').replace(/[<>"'&]/g, '').trim().slice(0, 40) : '';
  // טופס העסקים: מה מעניין (הרצאה, הדרכה לצוות, שליחת עובד למחזור)
  const need = callback ? (NEEDS[b.need] || '') : '';
  // טופס "חזרו אליי": שריון מקום או התלבטות, ובאיזה מחזור. בדף מסלול המחזור הוא של הדף.
  const intent = callback ? (b.intent === 'reserve' ? 'reserve' : 'question') : '';
  const COHORTS = ['מאפס למאה', 'צבא הסוכנים'];
  const PAGE_COHORT = { 'course-beginners.html': 'מאפס למאה', 'course-advanced.html': 'צבא הסוכנים' };
  const cohort = callback ? (COHORTS.includes(b.track) ? b.track : (PAGE_COHORT[page] || '')) : '';

  // טלפון ישראלי: 05X-XXXXXXX, או עם קידומת 972
  const local = phone.replace(/^\+?972/, '0');
  // שמירת מקום אחרי וובינר: בלי מייל (הנציג חוזר בטלפון), אבל חייבים לבחור מה מעניין, ובהטמעה גם שם העסק
  const makom = b.kind === 'makom';
  const interest = makom ? (INTERESTS[b.interest] || '') : '';
  const callTime = makom && CALL_TIMES.includes(b.callTime) ? b.callTime : '';
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  // הקלטת וובינר (register.html?for=<וובינר שכבר התקיים>): שם וטלפון פותחים את ההקלטה, בלי מייל
  const recording = b.kind === 'recording';
  if (!name || !/^0\d{8,9}$/.test(local) || ((makom || callback || recording) ? (email && !emailOk) : !emailOk)
      || (makom && (!interest || (b.interest === 'business' && !company)))) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  // טופס ההרשמה: מסלול, מה רוצים ללמוד, ובשביל מה נרשמו (למשל וובינר)
  const register = b.kind === 'register';
  const track = register ? (TRACKS[b.track] || '') : '';
  const who = register ? (WHO[b.who] || '') : '';
  const message = (register || makom) ? String(b.message || '').trim().slice(0, 1000) : '';
  const topic = (register || recording) ? String(b.topic || '').trim().slice(0, 160) : '';
  // מפתח הוובינר (?for= בקישור). סקריפט הגיליון שולח לפיו מייל אישור עם פרטי הוובינר והזום
  // בהקלטה המפתח מקבל קידומת rec-, כדי שסקריפט הגיליון לא ישלח מייל אישור עם קישור זום של וובינר שכבר התקיים
  const topicKey = (register || makom || recording)
    ? (recording ? 'rec-' : '') + String(b.topicKey || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) : '';
  if (register && (!email || !(track || who))) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const course = (COURSES[page] || COURSES['index.html']) + (company ? ' · ' + company : '')
    + (employees ? ' · ' + employees + ' עובדים' : '') + (need ? ' · מעניין: ' + need : '')
    + (callback ? (intent === 'reserve' ? ' · שריון מקום' : ' · בקשה לחזרה') : '') + (cta ? ' · כפתור: ' + cta : '')
    + (track ? ' · ' + track : '') + (who ? ' · ' + who : '') + (recording ? ' · צפייה בהקלטה' : '') + (topic ? ' · ' + topic : '')
    + (interest ? ' · ' + interest : '') + (callTime ? ' · לחזור ב' + callTime : '') + (makom && topicKey ? ' · ' + topicKey : '');
  const lead = { name, phone: local, email, consent, course, page, company, employees, need, cta, source, track: track || cohort || interest, intent, who, message, topic, topicKey, interest, callTime, ts: new Date().toISOString() };

  // KV (דף הניהול) והגיליון במקביל. מספיק שאחד מהם הצליח כדי שהליד לא ילך לאיבוד.
  const [kv, sheet] = await Promise.allSettled([
    kvRequest(['RPUSH', 'leads', JSON.stringify(lead)]),
    toSheet(lead, callback ? 'callback' : register ? 'register' : makom ? 'makom' : 'webinar'),
  ]);
  // נראה ב-Vercel > Logs. לא מכשיל את הבקשה אם הליד נשמר ב-KV.
  if (sheet.status === 'rejected' && sheet.reason.message !== 'sheet-not-configured') console.error('lead sheet:', sheet.reason.message);
  if (kv.status === 'fulfilled' || sheet.status === 'fulfilled') return res.json({ ok: true });
  const err = kv.reason && kv.reason.message === 'kv-not-configured' ? 'kv-not-configured' : 'kv-error';
  return res.status(503).json({ ok: false, error: err });
};
