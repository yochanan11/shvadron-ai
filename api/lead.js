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
  'index.html':            'דף הבית (שני המסלולים)',
  'course-beginners.html': 'AI למתחילים (זום)',
  'course-advanced.html':  'AI למתקדמים (זום)',
  'course.html':           'הקורס הדיגיטלי',
  'business.html':         'הטמעה בעסקים',
  'register.html':         'טופס הרשמה',
};

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

// טופס "הוובינר במתנה" וטופס "חזרו אליי" (דפי הקורסים ודף העסקים): שומר שם, טלפון והסכמה לדיוור ברשימה "leads"
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
  // מייל: שדה חובה בכל הטפסים
  const email = String(b.email || '').trim().slice(0, 120);

  // טלפון ישראלי: 05X-XXXXXXX, או עם קידומת 972
  const local = phone.replace(/^\+?972/, '0');
  if (!name || !/^0\d{8,9}$/.test(local) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  // טופס ההרשמה: מסלול, מה רוצים ללמוד, ובשביל מה נרשמו (למשל וובינר)
  const register = b.kind === 'register';
  const track = register ? (TRACKS[b.track] || '') : '';
  const who = register ? (WHO[b.who] || '') : '';
  const message = register ? String(b.message || '').trim().slice(0, 1000) : '';
  const topic = register ? String(b.topic || '').trim().slice(0, 160) : '';
  // מפתח הוובינר (?for= בקישור). סקריפט הגיליון שולח לפיו מייל אישור עם פרטי הוובינר והזום
  const topicKey = register ? String(b.topicKey || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) : '';
  if (register && (!email || !(track || who))) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const course = (COURSES[page] || COURSES['index.html']) + (company ? ' · ' + company : '')
    + (employees ? ' · ' + employees + ' עובדים' : '') + (callback ? ' · בקשה לחזרה' : '')
    + (track ? ' · ' + track : '') + (who ? ' · ' + who : '') + (topic ? ' · ' + topic : '');
  const lead = { name, phone: local, email, consent, course, page, company, employees, source, track, who, message, topic, topicKey, ts: new Date().toISOString() };

  // KV (דף הניהול) והגיליון במקביל. מספיק שאחד מהם הצליח כדי שהליד לא ילך לאיבוד.
  const [kv, sheet] = await Promise.allSettled([
    kvRequest(['RPUSH', 'leads', JSON.stringify(lead)]),
    toSheet(lead, callback ? 'callback' : register ? 'register' : 'webinar'),
  ]);
  // נראה ב-Vercel > Logs. לא מכשיל את הבקשה אם הליד נשמר ב-KV.
  if (sheet.status === 'rejected' && sheet.reason.message !== 'sheet-not-configured') console.error('lead sheet:', sheet.reason.message);
  if (kv.status === 'fulfilled' || sheet.status === 'fulfilled') return res.json({ ok: true });
  const err = kv.reason && kv.reason.message === 'kv-not-configured' ? 'kv-not-configured' : 'kv-error';
  return res.status(503).json({ ok: false, error: err });
};
