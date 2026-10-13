const { kvRequest } = require('./_kv');

// טופס "הוובינר במתנה": שומר שם, טלפון והסכמה לדיוור ברשימה "leads"
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

  // טלפון ישראלי: 05X-XXXXXXX, או עם קידומת 972
  const local = phone.replace(/^\+?972/, '0');
  if (!name || !/^0\d{8,9}$/.test(local)) {
    return res.status(400).json({ ok: false, error: 'invalid' });
  }

  const lead = { name, phone: local, consent, page, ts: new Date().toISOString() };
  try {
    await kvRequest(['RPUSH', 'leads', JSON.stringify(lead)]);
    return res.json({ ok: true });
  } catch (e) {
    return res.status(503).json({ ok: false, error: e.message === 'kv-not-configured' ? 'kv-not-configured' : 'kv-error' });
  }
};
