/* ============================================================
   SHWADRON.AI — שכבת התנועה
   ------------------------------------------------------------
   שני כללים שלא נשברים:
   1. התוכן קיים וקריא גם בלי הקובץ הזה. התנועה מתווספת על דף
      שכבר עובד, ולעולם לא מסתירה מחיר או כפתור קנייה.
   2. מי שביקש ממערכת ההפעלה פחות תנועה לא מקבל כלום מכאן.

   מה יש כאן: חשיפה בגלילה, כותרות שעולות מאחורי מסכה, מספרים
   שרצים כלפי מעלה, קשתות ההירו שנמתחות, פס התקדמות גלילה,
   והטיה עדינה של כרטיסים אחרי העכבר.
   ============================================================ */
(function () {
  'use strict';

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  var root = document.documentElement;
  root.classList.add('motion');

  /* ─── 0. כותרת ההירו: כל שורה נחשפת מאחורי מסכה ─────────────
     הכותרת נכתבת בדף כטקסט רגיל עם <br>, והחלוקה לשורות נעשית
     כאן. ככה אין בדף מרקאפ שקיים רק בשביל אנימציה, ומי שאין לו
     ג׳אווהסקריפט מקבל כותרת רגילה לגמרי.                      */
  var h1 = document.querySelector('#top h1');
  if (h1 && h1.innerHTML.indexOf('<br') > -1) {
    var lines = h1.innerHTML.split(/<br\s*\/?>/i);
    h1.innerHTML = lines.map(function (line) {
      return '<span class="mask"><span>' + line + '</span></span>';
    }).join('');
  }

  /* ─── 1. מה זז בגלילה ──────────────────────────────────────
     נבחר כאן ולא בכתיבת מחלקות ביד, כדי שדף חדש יקבל את זה
     בלי לזכור להוסיף שום דבר.                                */
  var SELECTORS = [
    '.sec .eyebrow', '.sec h2', '.sec .lead', '.sec .body',
    '.card', '.rule-top', '.step', '.lesson', '.quote-card',
    '.badge', '.tbl-wrap', '.figures > div', '.founder-photo',
    '.founder-body > *', '.cta-box', '.qa details', '.buy-card',
    '.gift-form', '.video-frame', '.logos', '.shot', '.arc'
  ];
  var items = [];
  SELECTORS.forEach(function (s) {
    document.querySelectorAll(s).forEach(function (el) {
      if (el.closest('#top') || items.indexOf(el) > -1) return;  // ההירו מונפש בנפרד
      items.push(el);
    });
  });
  items.forEach(function (el) { el.classList.add('rise'); });

  /* השהיה מדורגת בין אחים, כדי שרשת כרטיסים תיפתח בגל ולא בבת אחת */
  items.forEach(function (el) {
    var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) {
      return c.classList && c.classList.contains('rise');
    });
    var i = sibs.indexOf(el);
    if (i > 0) el.style.setProperty('--d', Math.min(i, 5) * 70 + 'ms');
  });

  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ─── 2. מספרים שרצים ──────────────────────────────────────
     רק מספרים אמיתיים. טקסט כמו ∞ או 30+ נשאר כפי שהוא, והסיומת
     נשמרת, כך ש-1,500+ נשאר 1,500+ ולא הופך ל-1500.           */
  function countUp(el) {
    var raw = el.textContent.trim();
    var m = raw.match(/^([^\d]*)([\d,]+)(.*)$/);
    if (!m) return;
    var target = parseInt(m[2].replace(/,/g, ''), 10);
    if (!target || target > 100000) return;
    var dur = 900, t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts;
      var p = Math.min((ts - t0) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = m[1] + Math.round(target * eased).toLocaleString('he-IL') + m[3];
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  if ('IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target);
        nio.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    document.querySelectorAll('.fig').forEach(function (el) { nio.observe(el); });
  }

  /* ─── 3. פס התקדמות הגלילה ─── */
  var bar = document.createElement('div');
  bar.className = 'scroll-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  var head = document.querySelector('.site-head');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var h = document.documentElement.scrollHeight - innerHeight;
      bar.style.transform = 'scaleX(' + (h > 0 ? scrollY / h : 0) + ')';
      if (head) head.classList.toggle('is-stuck', scrollY > 24);
      ticking = false;
    });
  }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ─── 4. הטיה עדינה של כרטיס אחרי העכבר ────────────────────
     רק במכשירים עם עכבר אמיתי. במגע זה רק מפריע.              */
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.card, .quote-card, .buy-card').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        c.style.setProperty('--rx', (-y * 3).toFixed(2) + 'deg');
        c.style.setProperty('--ry', (x * 3).toFixed(2) + 'deg');
        c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        c.style.setProperty('--my', (e.clientY - r.top) + 'px');
      });
      c.addEventListener('pointerleave', function () {
        c.style.setProperty('--rx', '0deg');
        c.style.setProperty('--ry', '0deg');
      });
    });
  }
})();
