/* ============================================================
   מקור התנועה ומדידה משותפת לכל הדפים.
   ------------------------------------------------------------
   1. מקור: כל קישור שמפרסמים נושא פרמטר מקור (ראו UTM.md), בצורה
      הקצרה ?src=status-1111 או בצורת utm_source. הערך נשמר בדפדפן
      רק אחרי הסכמה לעוגיות סטטיסטיקה, דרך מנגנון ההסכמה הקיים.
      בלי הסכמה לא נשמר כלום, והמקור עובר מדף לדף בתוך הקישורים
      הפנימיים עצמם (?src=...), כך שהוא עדיין מגיע לטופס ולדף התשלום.
      לא נשמר שום מידע אישי, רק שם המקור והקמפיין.
      SHW_SOURCE() מחזיר את המקור, לצירוף לטפסים ולאירועי המדידה.
   2. אירועים ל-Google Analytics: לחיצה על וואטסאפ (click_whatsapp).
      לחיצה על "לשריין מקום" ושליחת טופס נרשמות ב-courses.js
      וב-callback.js. gtag שולח רק אחרי הסכמה לסטטיסטיקה.
   3. הפס העליון ושורת הדדליין: אחרי data-closes מוסתר "ההרשמה
      נסגרת ב-", כדי שלא יישאר באתר תאריך שעבר.
   ============================================================ */
(function(window, document){
  'use strict';
  var KEY = 'shw_src_v1';
  var DAYS = 30;
  var q = new URLSearchParams(window.location.search);
  function clean(v, max){ return String(v || '').replace(/[^\w֐-׿.\-]/g, '').slice(0, max); }
  var rawSource = clean(q.get('src') || q.get('utm_source'), 40);
  var fromUrl = rawSource ? {
    source:   rawSource,
    campaign: clean(q.get('utm_campaign'), 60),
    ts: Date.now()
  } : null;

  function stored(){
    try {
      var s = JSON.parse(window.localStorage.getItem(KEY) || 'null');
      if (s && Date.now() - s.ts < DAYS * 864e5) return s;
    } catch (e) {}
    return null;
  }

  // כניסה ראשונה קובעת: מקור חדש לא דורס מקור שכבר נשמר ב-30 הימים האחרונים
  if (fromUrl && window.SHW && SHW.consent) {
    SHW.consent.onGrant('statistics', function(){
      try { if (!stored()) window.localStorage.setItem(KEY, JSON.stringify(fromUrl)); } catch (e) {}
    });
  }

  window.SHW_SOURCE = function(){
    var s = stored() || fromUrl;
    return s ? s.source + (s.campaign ? '/' + s.campaign : '') : 'direct';
  };

  function ev(name, params){
    if (!window.gtag) return;
    params = params || {};
    params.traffic_source = window.SHW_SOURCE();
    window.gtag('event', name, params);
  }
  window.SHW_EVENT = ev;

  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';

    // וואטסאפ: הקישור האחד של האתר, קבוצות, ושיתוף לחבר
    if (/wa\.me\/|chat\.whatsapp\.com\//.test(href)) {
      ev('click_whatsapp', {
        link_type: /chat\.whatsapp\.com/.test(href) ? 'group' : (/wa\.me\/\?/.test(href) ? 'share' : 'chat'),
        page: location.pathname.split('/').pop() || 'index.html'
      });
      return;
    }

    // המקור עובר הלאה בקישורים פנימיים, כל עוד הוא לא שמור בדפדפן
    if (!fromUrl || stored() || href.charAt(0) === '#') return;
    try {
      var u = new URL(a.href, location.href);
      if (u.host !== location.host || !/^https?:$/.test(u.protocol)) return;
      if (u.searchParams.get('src') || u.searchParams.get('utm_source')) return;
      u.searchParams.set('src', fromUrl.source);
      if (fromUrl.campaign) u.searchParams.set('utm_campaign', fromUrl.campaign);
      a.href = u.toString();
    } catch (err) {}
  }, true);

  // ההרשמה נסגרה: לא משאירים באתר "נסגרת ב-" עם תאריך שעבר
  function closing(){
    var today;
    try { today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date()); }
    catch (e) { return; }
    document.querySelectorAll('[data-closes]').forEach(function(box){
      if (today <= box.getAttribute('data-closes')) return;
      (box.hasAttribute('data-closing') ? [box] : []).concat([].slice.call(box.querySelectorAll('[data-closing]')))
        .forEach(function(el){ el.hidden = true; });
      // מה שמוצג במקום ההצעה שפג תוקפה
      box.querySelectorAll('[data-after-closing]').forEach(function(el){ el.hidden = false; });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', closing);
  else closing();
})(window, document);
