/* ============================================================
   SHWADRON.AI — פתיחת שדה הקופון
   ------------------------------------------------------------
   שדה הקופון מקופל כברירת מחדל, כדי שלא ייראה שצריך קוד כדי
   לקנות. מי שיש לו קוד לוחץ ונפתח לו השדה. כל הבדיקה עצמה
   נעשית ב-assets/js/courses.js מול /api/coupon, והקובץ הזה רק
   חושף את השדה.
   ============================================================ */
(function () {
  'use strict';
  var open   = document.getElementById('coupon-open');
  var fields = document.getElementById('coupon-fields');
  if (!open || !fields) return;

  open.setAttribute('aria-expanded', 'false');
  open.setAttribute('aria-controls', 'coupon-fields');

  open.addEventListener('click', function () {
    fields.hidden = false;
    open.hidden = true;
    open.setAttribute('aria-expanded', 'true');
    var input = document.getElementById('coupon-input');
    if (input) input.focus();
  });

  // כשהנחה אוטומטית כבר הוחלה, courses.js מסמן את התיבה.
  // אז אין טעם להציע קוד, והכפתור משנה את נוסחו.
  new MutationObserver(function () {
    if (document.getElementById('coupon-box').classList.contains('is-collapsed')) {
      open.textContent = 'יש לך קוד קופון אחר?';
    }
  }).observe(document.getElementById('coupon-box'), { attributes: true, attributeFilter: ['class'] });
})();
