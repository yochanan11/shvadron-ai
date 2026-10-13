/* ============================================================
   מקור התנועה: מאיפה הגיע המבקר (וואטסאפ, סטטוס, בוגרים וכו').
   ------------------------------------------------------------
   הקישורים שמפרסמים נושאים utm_source (ראו UTM.md). הערך נשמר
   בדפדפן רק אחרי הסכמה לעוגיות סטטיסטיקה, דרך מנגנון ההסכמה
   הקיים. בלי הסכמה הוא חי רק בעמוד הנוכחי ולא נשמר.
   לא נשמר שום מידע אישי, רק שם המקור והקמפיין.
   SHW_SOURCE() מחזיר את המקור, לצירוף לאירועי המדידה.
   ============================================================ */
(function(window){
  'use strict';
  var KEY = 'shw_src_v1';
  var DAYS = 30;
  var q = new URLSearchParams(window.location.search);
  var fromUrl = q.get('utm_source') ? {
    source:   q.get('utm_source').slice(0, 40),
    campaign: (q.get('utm_campaign') || '').slice(0, 60),
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
})(window);
