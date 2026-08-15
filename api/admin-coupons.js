const fs = require('fs');
const path = require('path');
const { kvRequest } = require('./_kv');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k] = v.join('=');
  });
}

// דף הניהול (admin-coupons.html) קורא ל-endpoint הזה כדי לראות/לערוך את
// רשימת הקופונים. הרשימה נשמרת ב-Vercel KV תחת המפתח "coupons", כמערך JSON
// של אובייקטים: { code, type: 'fixed'|'percent', value, page, checkoutUrl }.
// api/coupon.js קורא מאותו מפתח כדי לאמת קופון שהוזן בדף.
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'admin-not-configured' });
  }

  const given = req.headers['x-admin-password'];
  if (!given || given !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const r = await kvRequest(['GET', 'coupons']);
      const codes = r && r.result ? JSON.parse(r.result) : [];
      return res.json({ codes });
    } catch (e) {
      return res.status(500).json({ error: e.message === 'kv-not-configured' ? 'kv-not-configured' : 'kv-error' });
    }
  }

  if (req.method === 'POST') {
    const codes = req.body && req.body.codes;
    if (!Array.isArray(codes)) {
      return res.status(400).json({ error: 'invalid-body' });
    }
    const cleaned = [];
    for (const c of codes) {
      const code = c && String(c.code || '').trim();
      const type = c && c.type === 'percent' ? 'percent' : 'fixed';
      const value = c ? Number(c.value) : NaN;
      const page = c && String(c.page || '').trim();
      const checkoutUrl = c && String(c.checkoutUrl || '').trim();
      if (!code) continue;
      if (!page || !checkoutUrl || !Number.isFinite(value)) {
        return res.status(400).json({ error: 'invalid-coupon', code });
      }
      cleaned.push({ code, type, value, page, checkoutUrl });
    }
    try {
      await kvRequest(['SET', 'coupons', JSON.stringify(cleaned)]);
      return res.json({ ok: true, codes: cleaned });
    } catch (e) {
      return res.status(500).json({ error: e.message === 'kv-not-configured' ? 'kv-not-configured' : 'kv-error' });
    }
  }

  res.status(405).json({ error: 'method-not-allowed' });
};
