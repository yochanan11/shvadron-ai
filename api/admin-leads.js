const { kvRequest } = require('./_kv');

// דף הניהול admin-leads.html קורא מכאן את רשימת מי שביקש את הוובינר.
// מוגן באותה סיסמה של דף הקופונים (ADMIN_PASSWORD).
// בדיקת החיבור לגיליון הלידים (כפתור בדף הניהול): שולחת שורת בדיקה
// ומחזירה בעברית מה בדיוק קרה, כדי שלא צריך לחפור בלוגים של Vercel.
async function testSheet() {
  const url = process.env.LEADS_SHEET_URL;
  if (!url) return { ok: false, why: 'המשתנה LEADS_SHEET_URL לא מוגדר ב-Vercel, או שלא נעשה Redeploy אחרי שהוגדר.' };
  if (!process.env.LEADS_SHEET_SECRET) return { ok: false, why: 'המשתנה LEADS_SHEET_SECRET לא מוגדר ב-Vercel.' };
  if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url.trim()))
    return { ok: false, why: 'הכתובת ב-LEADS_SHEET_URL לא נראית ככתובת Web app. היא צריכה להתחיל ב-https://script.google.com/macros/s/ ולהסתיים ב-/exec.' };
  let status, text;
  try {
    const r = await fetch(url.trim(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: process.env.LEADS_SHEET_SECRET, name: 'בדיקת חיבור', phone: '0500000000',
        course: 'בדיקה מדף הניהול', kind: 'callback', consent: false, ts: new Date().toISOString() }),
    });
    status = r.status; text = await r.text();
  } catch (e) {
    return { ok: false, why: 'לא הצלחנו להגיע לכתובת של הסקריפט: ' + e.message };
  }
  let d = null; try { d = JSON.parse(text); } catch (e) {}
  if (d && d.ok) return { ok: true, why: 'עובד. נוספה שורת "בדיקת חיבור" ללשונית "לידים מהאתר".' };
  if (d && d.error === 'forbidden') return { ok: false, why: 'הסיסמה לא תואמת: SECRET בסקריפט שונה מ-LEADS_SHEET_SECRET ב-Vercel. אחרי תיקון בסקריפט צריך גם פריסה מחדש (ניהול פריסות > עריכה > גרסה חדשה).' };
  if (/accounts\.google\.com|ServiceLogin|signin/i.test(text)) return { ok: false, why: 'גוגל דורש התחברות: בהגדרות הפריסה של הסקריפט "מי יכול לגשת" צריך להיות "כל אחד".' };
  if (/doPost/.test(text)) return { ok: false, why: 'הסקריפט שנפרס לא מכיל את הקוד (לא נמצאה הפונקציה doPost). צריך להדביק את הקוד, לשמור, ולפרוס גרסה חדשה.' };
  return { ok: false, why: 'הסקריפט החזיר תשובה לא צפויה (קוד ' + status + '): ' + text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300) };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method-not-allowed' });

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'admin-not-configured' });
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: 'unauthorized' });

  if (req.query && req.query.test === 'sheet') return res.json(await testSheet());

  try {
    const r = await kvRequest(['LRANGE', 'leads', '0', '-1']);
    const leads = (r && r.result || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
    return res.json({ leads: leads.reverse() });
  } catch (e) {
    return res.status(500).json({ error: e.message === 'kv-not-configured' ? 'kv-not-configured' : 'kv-error' });
  }
};
