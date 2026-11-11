/* ============================================================
   טופס "מתלבטים? השאירו טלפון ונחזור אליכם".
   ------------------------------------------------------------
   שם וטלפון בלבד, בלי מייל. הטופס יושב בסוף כל דף, והוא היעד של הכפתור
   הראשי ("לשריין מקום") ושל הכפתור המשני ("מתלבטים?"): בדף משאירים פרטים,
   והתשלום הוא אפשרות למי שרוצה לסגור מיד. עם הליד נשלחים
   הדף שממנו הגיע והכפתור שהביא אותו לטופס (data-cta על הכפתור),
   כך שמי שחוזרת ללקוח יודעת מאיפה הוא בא.
   בדף העסקים הטופס כולל גם שם עסק, גודל צוות ומה מעניין.
   הפרטים נשלחים ל-/api/lead ומופיעים ב-admin-leads.html ובגיליון.
   אם השמירה נכשלה, מציעים לפנות בוואטסאפ במקום להשאיר את הגולש תלוי.
   ============================================================ */
(function(){
  'use strict';
  var page = location.pathname.split('/').pop() || 'index.html';
  var cameFrom = '';   // הכפתור האחרון שהוביל לטופס
  var intent = '', pickedTrack = '';   // שריון מקום (ובאיזה מחזור) או התלבטות, לעמודות בגיליון של המוכרת

  function where(a){
    if(a.getAttribute('data-cta')) return a.getAttribute('data-cta');
    if(a.closest('header'))  return 'כותרת הדף';
    if(a.closest('.dock'))   return 'רצועה תחתונה';
    if(a.closest('#top'))    return 'פתיחה';
    var s = a.closest('section');
    return (s && s.id) ? 'מקטע ' + s.id : 'גוף הדף';
  }

  /* מצב הטופס: למה הגולש הגיע אליו (intent: reserve שריון מקום, question
     מתלבט), לאיזה מחזור ומאיזה כפתור. מצב אחד, ופונקציה אחת שמציירת אותו:
     כותרת, טקסט וכפתור השליחה. המצב נשמר גם ב-history.state, כדי שרענון
     הדף לא יהפוך שריון מקום למתלבט, ומגיע גם מדף אחר דרך ?intent=reserve. */
  function setIntent(target, next, track, cta){
    intent = next; pickedTrack = track || ''; cameFrom = cta || cameFrom;
    var box = target.querySelector('.callback'), title = target.querySelector('[data-form-title]'),
        body = target.querySelector('[data-form-body]'), submit = target.querySelector('[data-form-submit]');
    if(!box || !title || !body) return;
    if(intent === 'reserve'){
      title.textContent = 'שריון מקום' + (pickedTrack ? ' ב' + pickedTrack : '') + '.';
      body.textContent = 'משאירים שם וטלפון, ונחזור אליכם עוד היום כדי להשלים את ההרשמה. בלי תשלום עכשיו.';
      if(submit) submit.textContent = 'שריינו לי מקום';
    } else {
      title.textContent = 'מתלבטים?';
      body.textContent = 'שיחה קצרה, בלי התחייבות. בודקים יחד איזה מחזור מתאים לכם, ועונים על כל מה שנשאר פתוח.';
      if(submit) submit.textContent = 'חזרו אליי';
    }
    try { history.replaceState({ shwIntent: intent, track: pickedTrack, cta: cameFrom }, '', location.pathname + location.search.replace(/([?&])intent=reserve&?/, '$1').replace(/[?&]$/, '') + '#callback'); } catch(err){}
  }
  function formSent(target){
    var f = target.querySelector('[data-callback]');
    return !!(f && f.hidden);
  }

  // קישורי הטופס (כותרת, רצועה תחתונה, גוף הדף): תמונות שנטענות בזמן הגלילה
  // מזיזות את הטופס למטה, ולכן מכוונים שוב אחרי שהדף התייצב
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href="#callback"], a[href="#contact"][data-cta]');
    if(!a) return;
    var target = document.querySelector(a.getAttribute('href'));
    if(!target) return;
    e.preventDefault();
    // אחרי שהפרטים נשלחו: רק גוללים לתודה, בלי להחליף את הכותרת שמעליה
    if(!formSent(target)){
      var box = target.querySelector('.callback');
      var cta = where(a);
      if(a.getAttribute('data-intent') === 'reserve'){
        var track = a.getAttribute('data-track') || (box && box.getAttribute('data-track')) || '';
        if(track && !a.getAttribute('data-cta')) cta += ' · שריון מקום';
        setIntent(target, 'reserve', track, cta);
      } else {
        setIntent(target, 'question', '', cta);
      }
      // כפתור שבוחר מראש ערך בטופס (דף העסקים: "לשליחת עובד")
      var pick = a.getAttribute('data-need'), sel = target.querySelector('select[name=need]');
      if(pick && sel) sel.value = pick;
    }
    target.scrollIntoView({ behavior: 'smooth' });
    setTimeout(function(){ target.scrollIntoView({ behavior: 'smooth' }); }, 900);
    setTimeout(function(){ var i = target.querySelector('input[name=name]'); if(i && !formSent(target)) i.focus({ preventScroll: true }); }, 1600);
  });

  /* כשהטופס על המסך, הרצועה התחתונה ("כתוב לי / לשריין מקום") יורדת, כדי
     שלא תכסה את שדה הטלפון ואת כפתור השליחה. היא חוזרת כשגוללים ממנו. */
  (function dockAwayFromForm(){
    var form = document.getElementById('callback') || document.getElementById('contact');
    if(!form || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function(entries){
      entries.forEach(function(e){ document.documentElement.classList.toggle('form-in-view', e.isIntersecting); });
    }, { threshold: 0, rootMargin: '0px 0px -25% 0px' }).observe(form);
  })();

  // רענון, חזרה אחורה, או הגעה מדף אחר עם ?intent=reserve#callback
  (function restore(){
    var target = document.getElementById('callback');
    if(!target || formSent(target)) return;
    var box = target.querySelector('.callback');
    var st = history.state;
    if(st && st.shwIntent){ setIntent(target, st.shwIntent, st.track, st.cta); return; }
    if(new URLSearchParams(location.search).get('intent') === 'reserve'){
      setIntent(target, 'reserve', box && box.getAttribute('data-track'), 'הגיע מדף אחר · שריון מקום');
    }
  })();

  document.querySelectorAll('[data-callback]').forEach(function(form){
    var msg = form.querySelector('.gift-msg');
    var el = form.elements;

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name    = el.name.value.trim();
      var phone   = el.phone.value.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
      var company = el.company ? el.company.value.trim() : '';
      // דף העסקים: גודל הצוות ומה מעניין, מה שקובע את ההצעה ואת המסלול המתאים
      var employees = el.employees ? el.employees.value : '';
      var need = el.need ? el.need.value : '';
      msg.classList.remove('err');
      if(!name){ msg.textContent = 'נא למלא שם.'; msg.classList.add('err'); el.name.focus(); return; }
      if(!/^0\d{8,9}$/.test(phone)){ msg.textContent = 'נא למלא מספר טלפון תקין.'; msg.classList.add('err'); el.phone.focus(); return; }
      // מייל רק בטופס שיש בו שדה כזה, וגם שם הוא לא חובה
      var email = el.email ? el.email.value.trim() : '';
      if(email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = 'נא למלא כתובת מייל תקינה.'; msg.classList.add('err'); el.email.focus(); return; }
      var cta = cameFrom || 'ישר מהטופס';
      if(el.cta) el.cta.value = cta;
      var btn = form.querySelector('button'); btn.disabled = true;
      msg.textContent = 'שולח…';

      function fail(){
        btn.disabled = false;
        msg.classList.add('err');
        // אותו קישור וואטסאפ כמו בשאר הדף (data-wa), כדי שיהיה באתר קישור אחד
        var wa = document.querySelector('a[data-wa]');
        msg.innerHTML = 'השליחה לא הצליחה. אפשר <a target="_blank" rel="noopener">לכתוב לנו בוואטסאפ</a>.';
        msg.querySelector('a').href = wa ? wa.href : 'https://wa.me/972528189921';
      }
      var source = window.SHW_SOURCE ? SHW_SOURCE() : '';
      // בלי תשובה תוך 15 שניות: לא משאירים את הכפתור תקוע על "שולח…"
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = ctl ? setTimeout(function(){ ctl.abort(); }, 15000) : 0;
      fetch('/api/lead', {
        method: 'POST', signal: ctl ? ctl.signal : undefined,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone, email: email, company: company, employees: employees, need: need,
                               kind: 'callback', cta: cta, intent: intent, track: pickedTrack, consent: !!(el.consent && el.consent.checked),
                               source: source, page: page })
      }).then(function(r){
        clearTimeout(timer);
        if(!r.ok) return fail();
        if(window.gtag) gtag('event', 'generate_lead', { lead_source: 'callback_' + page.replace('.html', ''), cta: cta, traffic_source: source || 'direct' });
        form.hidden = true;
        var after = form.parentNode.querySelector('.gift-after');
        if(after){ after.hidden = false; after.focus(); }
      }, function(){ clearTimeout(timer); fail(); });
    });
  });
})();
