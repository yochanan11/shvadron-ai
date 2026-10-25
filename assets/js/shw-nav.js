/* ============================================================
   SHWADRON.AI — ניווט ועוגנים
   ------------------------------------------------------------
   שני דברים, ושניהם נוגעים ישירות בהמרה:

   1. קפיצה לעוגן בטעינה ישירה. ב-CSS יש scroll-behavior:smooth,
      והדפדפן מתחיל את הגלילה החלקה בזמן שהתמונות עוד נטענות.
      הפריסה זזה תחתיה, הגלילה מתבטלת, והגולש נשאר בראש הדף.
      מי שלוחץ על קישור מודעה אל #buy היה נוחת בראש דף של
      16,000 פיקסל. כאן מכבים את ה-smooth לרגע, קופצים ליעד,
      ומחזירים אותו.

   2. תפריט מובייל. מתחת ל-860px ה-site-nav מוסתר ב-CSS ולא היה
      שום דבר שמחליף אותו, כך שדף העסקים והמסלולים האחרים פשוט
      לא היו נגישים בטלפון. כאן נבנה כפתור ולוח קישורים מאותו
      ה-nav שכבר קיים בדף, בלי מרקאפ כפול.

   בלי הקובץ הזה הדף עובד בדיוק כמו קודם: הניווט בדסקטופ קיים,
   והקישורים בפוטר נותנים גישה לכל מסלול.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ─── 1. קפיצה לעוגן בטעינה ─────────────────────────────── */

  function target() {
    var hash = location.hash;
    if (!hash || hash.length < 2) return null;
    try { return document.querySelector(hash); } catch (e) { return null; }
  }

  function jumpToHash() {
    var el = target();
    if (el) el.scrollIntoView();
  }

  /* הגלילה החלקה נדלקת רק כאן, אחרי שהקפיצה הסתיימה. עד אז
     scroll-behavior הוא auto, ולכן שום אנימציה לא מתחרה בקפיצה. */
  function enableSmooth() {
    root.classList.add('smooth-ok');
  }

  if (!location.hash) {
    enableSmooth();
  } else {
    /* התמונות נטענות אחרי הפרסור ומזיזות את היעד, ולכן קופצים שוב
       בכל שלב שבו הגובה יכול להשתנות. ברגע שהגולש גולל בעצמו
       מפסיקים לגעת במיקום שלו. */
    var touched = false;
    var stop = function () { touched = true; };
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    window.addEventListener('keydown', stop, { once: true });

    /* תמונות עצלות נכנסות גם אחרי load ומזיזות את היעד. מנסים
       שוב כל עוד גובה הדף ממשיך להשתנות, ולכל היותר כשתי שניות. */
    var tries = 0;
    var lastH = 0;
    var settle = function () {
      if (touched) return done();
      var h = document.body.scrollHeight;
      if (h !== lastH) { lastH = h; jumpToHash(); }
      if (++tries < 16) setTimeout(settle, 130);
      else done();
    };
    var done = function () {
      if (root.classList.contains('smooth-ok')) return;
      enableSmooth();
    };

    jumpToHash();
    if (document.readyState === 'complete') settle();
    else window.addEventListener('load', settle);
  }

  /* ─── 2. תפריט מובייל ───────────────────────────────────── */

  var head = document.querySelector('.site-head');
  var nav = head && head.querySelector('.site-nav');
  if (!head || !nav) return;

  var panel = document.createElement('div');
  panel.className = 'nav-panel';
  panel.id = 'nav-panel';
  panel.hidden = true;
  panel.appendChild(nav.cloneNode(true));

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nav-toggle';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'nav-panel');
  btn.setAttribute('aria-label', 'תפריט');
  btn.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>';

  function setOpen(open) {
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    panel.hidden = !open;
    head.classList.toggle('nav-open', open);
  }

  btn.addEventListener('click', function () {
    setOpen(btn.getAttribute('aria-expanded') !== 'true');
  });

  /* לחיצה על קישור סוגרת, אחרת הלוח נשאר פתוח מעל היעד */
  panel.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      btn.focus();
    }
  });

  var wrap = head.querySelector('.wrap') || head;
  wrap.appendChild(btn);
  head.appendChild(panel);
})();
