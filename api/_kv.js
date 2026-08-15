const https = require('https');
const { URL } = require('url');

// עטיפה דקה סביב ה-REST API של Vercel KV (מבוסס Upstash Redis).
// לא דורשת חבילת npm נוספת, רק KV_REST_API_URL ו-KV_REST_API_TOKEN
// שנוספים אוטומטית ל-env כאשר מחברים KV database לפרויקט ב-Vercel.
function kvRequest(command) {
  return new Promise((resolve, reject) => {
    const base  = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (!base || !token) return reject(new Error('kv-not-configured'));

    const body = JSON.stringify(command);
    const u = new URL(base);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { kvRequest };
