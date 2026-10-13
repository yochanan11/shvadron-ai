const { kvRequest } = require('./_kv');

// דף הניהול admin-leads.html קורא מכאן את רשימת מי שביקש את הוובינר.
// מוגן באותה סיסמה של דף הקופונים (ADMIN_PASSWORD).
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method-not-allowed' });

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'admin-not-configured' });
  if (req.headers['x-admin-password'] !== ADMIN_PASSWORD) return res.status(401).json({ error: 'unauthorized' });

  try {
    const r = await kvRequest(['LRANGE', 'leads', '0', '-1']);
    const leads = (r && r.result || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
    return res.json({ leads: leads.reverse() });
  } catch (e) {
    return res.status(500).json({ error: e.message === 'kv-not-configured' ? 'kv-not-configured' : 'kv-error' });
  }
};
