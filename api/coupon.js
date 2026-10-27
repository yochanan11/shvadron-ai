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

// חייב להישאר זהה לערכים במקור האמת ב-course.html, אחרת המחיר שהקופון
// מחזיר יסתור את מה שהאתר מציג.
const LAUNCH_END   = new Date('2026-08-10T23:59:59+03:00').getTime();
const REGULAR_PRICE = 326.27; // הקורס הדיגיטלי לפני מע״מ (385 ₪ כולל), בסיס להנחה באחוזים
// המחיר לפני מע״מ של כל קורס, לחישוב הנחה באחוזים ולחסימת קופון שמייקר.
// מסלולי הזום חייבים להישאר זהים ל-priceEx ב-assets/data/courses.mjs.
const PAGE_PRICES = { 'course-beginners': 750, 'course-advanced': 2500, 'course-digital': REGULAR_PRICE };
const VAT_RATE      = 0.18;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ valid: false, error: 'method-not-allowed' });

  // רשימת הקופונים נשמרת ב-Vercel KV (שם דף הניהול admin-coupons.html
  // עורך אותה). כל קופון הוא אובייקט: { code, type: 'fixed'|'total'|'percent',
  // value, page, checkoutUrl, until? }. until הוא היום האחרון שבו הקופון
  // תקף (YYYY-MM-DD, שעון ישראל). checkoutUrl הוא קישור תשלום קיים ב-Morning
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
  // היום לפי שעון ישראל, בפורמט YYYY-MM-DD, כדי שקופון יפוג בחצות שלנו.
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  if (coupon.until && today > coupon.until) {
    return res.status(400).json({ valid: false, error: 'expired' });
  }
  if (!coupon.checkoutUrl) {
    return res.status(503).json({ valid: false, error: 'coupon-missing-checkout-url' });
  }

  // בסוג 'total' הערך הוא הסכום לתשלום כולל מע״מ, והמחיר לפני מע״מ מחושב
  // ממנו אחורה. בשאר הסוגים הערך נותן את המחיר לפני מע״מ.
  var total = null;
  var price;
  if (coupon.type === 'total') {
    // עיגול לאגורות לפני ה-ceil, כדי ש-336.3 לא יהפוך ל-336.4 בגלל שגיאת float
    total = Math.max(0, Math.ceil(Math.round(Number(coupon.value) * 100) / 10) / 10);
    price = total / (1 + VAT_RATE);
  } else {
    price = coupon.type === 'percent'
      ? (PAGE_PRICES[enteredPage] || REGULAR_PRICE) * (1 - Number(coupon.value) / 100)
      : Number(coupon.value);
  }
  price = Math.max(0, Math.round(price * 100) / 100);

  // קופון שמעלה את המחיר מעל מחיר המסלול (למשל אחרי שהמחיר ירד והקופון
  // לא עודכן) לא מוצג בכלל, כדי שלקוח לא יראה "הנחה" יקרה מהמחיר הרגיל.
  if (PAGE_PRICES[enteredPage] && price >= PAGE_PRICES[enteredPage]) {
    return res.status(400).json({ valid: false, error: 'invalid-code' });
  }

  // הסכום הסופי מעוגל כלפי מעלה ל-10 אגורות הקרובות (אין מטבע של אגורה
  // בודדת בישראל), וה-מע״מ המוצג מחושב אחורה מהסכום המעוגל כדי שהשורות
  // בטבלה יסתכמו בדיוק לסה״כ. חשוב: קישור התשלום שמוזן לקופון בדף
  // הניהול חייב לגבות בדיוק את הסכום המעוגל הזה, לא את הסכום הגולמי.
  if (total === null) total = Math.ceil(price * (1 + VAT_RATE) * 10) / 10;
  const vat   = Math.round((total - price) * 100) / 100;

  res.json({
    valid: true,
    price: price,
    vat: vat,
    total: total,
    checkoutUrl: coupon.checkoutUrl,
  });
};
