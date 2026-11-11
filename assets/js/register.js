/* ============================================================
   דף ההרשמה (register.html): שם פרטי ומשפחה, טלפון, מייל, מסלול
   ("מאפס למאה" או "צבא הסוכנים") ומה רוצים ללמוד.
   נשלח ל-/api/lead עם kind: 'register', ומופיע ב-admin-leads.html
   ובגיליון הלידים כמו שאר הטפסים.
   ?for=<מפתח> מציג מעל הטופס בשביל מה נרשמים (למשל וובינר), ונשמר עם הליד.
   וובינר שכבר התקיים (RECORDINGS): הדף הופך לדף הקלטה. שם וטלפון, ההקלטה
   נפתחת מיד, ומתחתיה כרטיס המחזור עם הכפתור והדדליין.
   ============================================================ */
(function(){
  'use strict';
  // וובינר עתידי: מוסיפים שורה ב-TOPICS וב-WEBINARS, ושולחים קישור register.html?for=<מפתח>.
  // אחרי שהוובינר התקיים מעבירים אותו ל-RECORDINGS (או מוחקים), כדי שלא יישאר באתר תאריך שעבר.
  var TOPICS = {};
  // הכותרת בהירו (שתי שורות), תגיות המועד, ושדה "מה הייתם רוצים ללמוד" שהופך לשאלה אחת לוובינר.
  // דוגמה לרשומה:
  //   'my-webinar': { title: 'שורה ראשונה', accent: 'שורה שנייה.', lead: '...', when: ['יום', 'שעה', 'בזום', 'חינם'],
  //                   placeholder: '...', who: true /* קהל רחב: שואלים "שכיר או בעל עסק" במקום מסלול */ }
  var WEBINARS = {};
  // וובינר שכבר התקיים: הדף אוסף שם וטלפון, ההקלטה נפתחת מיד, ומתחתיה הצעת המחזור.
  // src הוא כתובת ההטמעה של ההקלטה (Vimeo: https://player.vimeo.com/video/<מספר>?dnt=1,
  // דרייב: https://drive.google.com/file/d/<מזהה>/preview, והקובץ חייב להיות פתוח לצפייה לכל מי שיש לו קישור).
  // email: true מוסיף שדה מייל חובה (המתנה נשלחת גם למייל, ונבנית רשימת מיילים).
  var RECORDINGS = {
    'pro-answers': {
      name: 'מתשובה בינונית לתשובה מקצועית',
      eyebrow: 'מתנה · ההקלטה המלאה',
      title: 'מתשובה בינונית', accent: 'לתשובה מקצועית.',
      lead: 'ההקלטה המלאה של הוובינר: איך כותבים פרומפט, 7 הכללים, ותמונות שלא נראות כמו AI. אותה בקשה פעמיים, לפני ואחרי.',
      gate: 'משאירים שם, טלפון ומייל, והיא נפתחת כאן מיד. נשלח אותה גם למייל.',
      email: true,
      // הקובץ בדרייב חייב להיות פתוח לצפייה לכל מי שיש לו קישור
      src: 'https://drive.google.com/file/d/1zOvfpd7uOGD81hrUDq6YOMdBjG-drFcx/preview'
    }
  };
  // קישורים אחרים למתנה מובילים למתנה הנוכחית
  var ALIAS = { 'video-editing': 'pro-answers', 'gift': 'pro-answers' };
  var forKey = (new URLSearchParams(location.search).get('for') || '').trim();
  if(ALIAS[forKey]) forKey = ALIAS[forKey];
  var topic = TOPICS[forKey] || '';
  var w = WEBINARS[forKey];
  function $(sel){ return document.querySelector(sel); }
  var rec = RECORDINGS[forKey];
  if(rec){ recordingPage(rec); return; }
  if(w){
    $('[data-hero-eyebrow]').textContent = 'וובינר חינם · הרשמה';
    var h1 = $('[data-hero-title]'); h1.textContent = w.title; h1.appendChild(document.createElement('br'));
    var acc = document.createElement('span'); acc.className = 'on-accent'; acc.textContent = w.accent; h1.appendChild(acc);
    $('[data-hero-lead]').textContent = w.lead;
    var whenEl = $('[data-hero-when]');
    w.when.forEach(function(t){ var s = document.createElement('span'); s.textContent = t; whenEl.appendChild(s); });
    whenEl.hidden = false;
    var qLabel = $('[data-message-label]');
    qLabel.textContent = 'שאלה אחת שתרצו שאענה עליה בוובינר ';
    var small = document.createElement('small'); small.textContent = '(לא חובה)'; qLabel.appendChild(small);
    $('[data-register] textarea[name="message"]').placeholder = w.placeholder;
    $('[data-submit]').textContent = 'שמרו לי מקום';
    if(w.who){
      $('[data-track]').hidden = true;
      $('[data-who]').hidden = false;
    }
    $('[data-steps="general"]').hidden = true;
    $('[data-steps="webinar"]').hidden = false;
    $('[data-after-text]').innerHTML = '<b>נרשמתם, איזה כיף!</b> מייל אישור עם קישור לזום ועם כפתור להוספה ליומן בדרך אליכם. בינתיים, בקבוצת הטיפים יוחנן משתף טיפים קצרים על AI, בלי ספאם.';
    document.title = w.title.replace(/\.$/, '') + ' · וובינר חינם | SHWADRON.AI';
    // הטופס עולה לאזור העליון, שיופיע מיד בלי לגלול
    var slot = $('[data-hero-form]');
    slot.appendChild($('[data-register]'));
    slot.appendChild($('.gift-after'));
    slot.hidden = false;
    // בטלפון התוויות מוסתרות (נשארות לקוראי מסך), ולכן שם השדה מופיע בתוכו
    if(window.matchMedia('(max-width:899px)').matches) slot.querySelectorAll('.gift-fields label').forEach(function(l){
      var t = l.querySelector('span'), i = l.querySelector('input');
      if(t && i) i.placeholder = t.textContent.trim();
    });
    $('main').classList.add('reg-webinar');
    $('[data-head-cta]').href = '#top';
  }

  /* ─── דף הקלטה: שם וטלפון, "לצפות בהקלטה", ומתחת להקלטה הצעת המחזור ─── */
  function recordingPage(rec){
    var KEY = 'shw_rec_' + forKey;
    var form = $('[data-rec]'), sec = $('#recording'), frame = sec.querySelector('iframe');
    var msg = form.querySelector('.gift-msg');
    $('[data-hero-eyebrow]').textContent = rec.eyebrow || 'ההקלטה המלאה · חינם';
    var emailField = form.querySelector('[data-rec-email]');
    if(rec.email && emailField){ emailField.hidden = false; emailField.querySelector('input').required = true; }
    var h1 = $('[data-hero-title]'); h1.textContent = rec.title; h1.appendChild(document.createElement('br'));
    var acc = document.createElement('span'); acc.className = 'on-accent'; acc.textContent = rec.accent; h1.appendChild(acc);
    $('[data-hero-lead]').textContent = rec.lead + ' ' + rec.gate;
    document.title = rec.name + ' · ההקלטה המלאה | SHWADRON.AI';
    frame.title = 'הקלטת הוובינר: ' + rec.name;
    // הטופס עולה לאזור העליון, והטופס הכללי של הדף יורד
    var slot = $('[data-hero-form]');
    slot.appendChild(form); slot.appendChild($('[data-rec-open]'));
    form.hidden = false; slot.hidden = false;
    // בטלפון התוויות מוסתרות (נשארות לקוראי מסך), ולכן שם השדה מופיע בתוכו
    if(window.matchMedia('(max-width:899px)').matches) form.querySelectorAll('.gift-fields label').forEach(function(l){
      var t = l.querySelector('span'), i = l.querySelector('input');
      if(t && i) i.placeholder = t.textContent.trim();
    });
    $('#form').hidden = true;
    $('main').classList.add('reg-webinar');
    var cta = $('[data-head-cta]'); cta.href = '#top'; cta.textContent = 'לצפות בהקלטה';

    function unlock(scroll){
      if(!frame.src) frame.src = rec.src;
      sec.hidden = false;
      form.hidden = true;
      $('[data-hero-lead]').textContent = rec.lead;
      $('[data-rec-open]').hidden = false;
      cta.href = '#recording';
      if(scroll) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    var done = false;
    try { done = localStorage.getItem(KEY) === '1'; } catch(e){}
    if(done){ unlock(false); return; }

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var el = form.elements;
      var name  = el.name.value.trim();
      var phone = el.phone.value.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
      msg.classList.remove('err');
      if(!name){ msg.textContent = 'נא למלא שם.'; msg.classList.add('err'); el.name.focus(); return; }
      if(!/^0\d{8,9}$/.test(phone)){ msg.textContent = 'נא למלא מספר טלפון תקין.'; msg.classList.add('err'); el.phone.focus(); return; }
      var email = rec.email && el.email ? el.email.value.trim() : '';
      if(rec.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = 'נא למלא כתובת מייל תקינה, לשם נשלח את ההקלטה.'; msg.classList.add('err'); el.email.focus(); return; }
      form.querySelector('button').disabled = true;
      msg.textContent = 'פותח…';
      // ההקלטה נפתחת גם אם השמירה נכשלה, כדי לא להעניש את הגולש
      function open(){
        try { localStorage.setItem(KEY, '1'); } catch(e){}
        if(window.gtag) gtag('event', 'generate_lead', { lead_source: 'recording_' + forKey, traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
        unlock(true);
      }
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'recording', name: name, phone: phone, email: email, topic: rec.name, topicKey: forKey,
                               consent: el.consent.checked, source: window.SHW_SOURCE ? SHW_SOURCE() : '', page: 'register.html' })
      }).then(open, open);
    });
  }

  var form = document.querySelector('[data-register]');
  if(!form) return;
  var msg = form.querySelector('.gift-msg');

  function err(text, field){
    msg.textContent = text; msg.classList.add('err');
    if(field && field.focus) field.focus();
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var el = form.elements;
    var first = el.firstName.value.trim();
    var last  = el.lastName.value.trim();
    var phone = el.phone.value.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
    var email = el.email.value.trim();
    var trackInput = form.querySelector('input[name="track"]:checked');
    var whoInput = form.querySelector('input[name="who"]:checked');
    var message = el.message.value.trim();
    msg.classList.remove('err');

    if(!first){ return err('נא למלא שם פרטי.', el.firstName); }
    if(!last){ return err('נא למלא שם משפחה.', el.lastName); }
    if(!/^0\d{8,9}$/.test(phone)){ return err('נא למלא מספר טלפון תקין.', el.phone); }
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ return err('נא למלא כתובת מייל תקינה.', el.email); }
    if(w && w.who){
      if(!whoInput){ return err('נא לבחור מה מתאר אתכם.', form.querySelector('input[name="who"]')); }
    } else if(!trackInput){ return err('נא לבחור מסלול.', form.querySelector('input[name="track"]')); }

    var btn = form.querySelector('button'); btn.disabled = true;
    msg.textContent = 'שולח…';

    function fail(){
      btn.disabled = false;
      msg.classList.add('err');
      var wa = document.querySelector('a[data-wa]');
      msg.innerHTML = 'השליחה לא הצליחה. אפשר <a target="_blank" rel="noopener">לכתוב לנו בוואטסאפ</a>.';
      msg.querySelector('a').href = wa ? wa.href : 'https://wa.me/972528189921';
    }
    fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: first + ' ' + last, firstName: first, lastName: last, phone: phone, email: email,
        track: trackInput ? trackInput.value : '', who: whoInput ? whoInput.value : '', message: message, topic: topic, topicKey: topic ? forKey : '', kind: 'register',
        consent: el.consent.checked, source: window.SHW_SOURCE ? SHW_SOURCE() : '', page: 'register.html'
      })
    }).then(function(r){
      if(!r.ok) return fail();
      if(window.gtag) gtag('event', 'generate_lead', { lead_source: 'register' + (forKey ? '_' + forKey : ''), traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
      form.hidden = true;
      var after = form.parentNode.querySelector('.gift-after');
      if(after){ after.hidden = false; after.focus(); }
    }, fail);
  });
})();
