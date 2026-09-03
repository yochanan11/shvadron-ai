/* ============================================================
   SHWADRON.AI — מקור אמת יחיד למחירי הקורס הדיגיטלי
   ------------------------------------------------------------
   הקובץ הזה נטען גם בדפדפן (course.html) וגם בצד השרת
   (api/course-bot.js, api/coupon.js) — כדי שלא ייווצר מצב שבו
   העמוד מציג מחיר אחד, הבוט אומר מחיר אחר, והקופון מחשב לפי שלישי.

   לשינוי מחיר: לשנות כאן, ורק כאן.
   שימו לב: קישור הסליקה חייב לגבות בדיוק את הסכום שנגזר מהמספרים
   האלה. אחרי כל שינוי מחיר יש לעדכן גם את עמוד הסליקה ב-Morning.
   ============================================================ */
(function (root, factory) {
  var data = factory();
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.SHW_COURSE_PRICING = data;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRICE_EX      = 385;    // מחיר גרסת הצפייה, לפני מע״מ
  var VAT_RATE      = 0.18;   // שיעור המע״מ
  var COMPARE_PRICE = 2500;   // מחיר הקורס החי, לפני מע״מ
  var CHECKOUT_URL  = 'https://mrng.to/zoeR82jDpx'; // 385 + מע״מ = 454.30 ₪

  var vat   = Math.round(PRICE_EX * VAT_RATE * 100) / 100;
  var total = Math.round(PRICE_EX * (1 + VAT_RATE) * 100) / 100;

  // שקלים שלמים נשארים שלמים, אגורות מוצגות בשתי ספרות (454.30 ולא 454.3)
  function ils(n) {
    return (n % 1 === 0 ? String(n) : n.toFixed(2)) + ' ₪';
  }

  return {
    priceEx: PRICE_EX,
    vatRate: VAT_RATE,
    comparePrice: COMPARE_PRICE,
    checkoutUrl: CHECKOUT_URL,
    vat: vat,
    total: total,
    savePct: Math.round((1 - PRICE_EX / COMPARE_PRICE) * 100),
    ils: ils
  };
});
