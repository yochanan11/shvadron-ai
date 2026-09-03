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

// המחירים נשאבים ממקור האמת המשותף, כדי שהמחיר שהקופון מחזיר לא
// יסתור את מה שהאתר מציג. אם הקובץ לא נטען משום סיבה, נשארים
// הערכים שהיו כאן קודם, כדי שהקופונים לא ייפלו.
let pricing = {};
try { pricing = require('../assets/js/course-pricing.js'); } catch (e) { pricing = {}; }

const LAUNCH_END    = new Date('2026-08-10T23:59:59+03:00').getTime();
const REGULAR_PRICE = pricing.priceEx || 385;   // בסיס לחישוב הנחה באחוזים
const VAT_RATE      = pricing.vatRate || 0.18;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ valid: false, error: 'method-not-allowed' });

  // רשימת הקופונים נשמרת ב-Vercel KV (שם דף הניהול admin-coupons.html
  // עורך אותה). כל קופון הוא אובייקט: { code, type: 'fixed'|'percent',
  // value, page, checkoutUrl }. checkoutUrl הוא קישור תשלום קיים ב-Morning
  // שגובה בדיוק את הסכום הזה — אין לנו כרגע גישת API ל-Morning שיוצרת
  // קישור סליקה אוטומטית לכל סכום, אז חייבים קישור מוכן מראש לכל קופון.
  var coupons = [];
  try {
    var kv = await kvRequest(['GET', 'coupons']);
    if (kv && kv.result) coupons = JSON.parse(kv.result);
  } catch (e) {
    return res.status(503).json({ valid: false, error: 'coupon-not-configured' });
  }
  if (!Array.isArray(coupons) || !coupons.length) {
    return res.status(503).json({ valid: false, error: 'coupon-not-configured' });
  }

  // הקופון תקף רק אחרי שחלון ההשקה נסגר והמחיר עלה למחיר הרגיל.
  if (Date.now() < LAUNCH_END) {
    return res.status(403).json({ valid: false, error: 'not-active-yet' });
  }

  const code = req.body && req.body.code;
  const page = req.body && req.body.page;
  const entered     = code ? String(code).trim().toLowerCase() : '';
  const enteredPage = page ? String(page).trim().toLowerCase() : '';
  // התאמת עמוד היא חלק מהתנאי, כדי שקופון שהוגדר לעמוד אחד לא יעבוד באחר.
  const coupon = coupons.find(function (c) {
    return String(c.code).trim().toLowerCase() === entered &&
           String(c.page || '').trim().toLowerCase() === enteredPage;
  });
  if (!entered || !coupon) {
    return res.status(400).json({ valid: false, error: 'invalid-code' });
  }
  if (!coupon.checkoutUrl) {
    return res.status(503).json({ valid: false, error: 'coupon-missing-checkout-url' });
  }

  var price = coupon.type === 'percent'
    ? REGULAR_PRICE * (1 - Number(coupon.value) / 100)
    : Number(coupon.value);
  price = Math.max(0, Math.round(price * 100) / 100);

  // הסכום הסופי מעוגל כלפי מעלה ל-10 אגורות הקרובות (אין מטבע של אגורה
  // בודדת בישראל), וה-מע״מ המוצג מחושב אחורה מהסכום המעוגל כדי שהשורות
  // בטבלה יסתכמו בדיוק לסה״כ. חשוב: קישור התשלום שמוזן לקופון בדף
  // הניהול חייב לגבות בדיוק את הסכום המעוגל הזה, לא את הסכום הגולמי.
  const total = Math.ceil(price * (1 + VAT_RATE) * 10) / 10;
  const vat   = Math.round((total - price) * 100) / 100;

  res.json({
    valid: true,
    price: price,
    vat: vat,
    total: total,
    checkoutUrl: coupon.checkoutUrl,
  });
};
