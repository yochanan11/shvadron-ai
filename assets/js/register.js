/* ============================================================
   דף ההרשמה (register.html): שם פרטי ומשפחה, טלפון, מייל, מסלול
   ("מאפס למאה" או "צבא הסוכנים") ומה רוצים ללמוד.
   נשלח ל-/api/lead עם kind: 'register', ומופיע ב-admin-leads.html
   ובגיליון הלידים כמו שאר הטפסים.
   ?for=<מפתח> מציג מעל הטופס בשביל מה נרשמים (למשל וובינר), ונשמר עם הליד.
   ============================================================ */
(function(){
  'use strict';
  // הקשרים שאפשר להעביר בקישור. מפתח חדש: מוסיפים שורה כאן, ושולחים קישור register.html?for=<מפתח>
  var TOPICS = {
    'browser-webinar': 'וובינר חינם בזום · התוסף של קלוד ו-ChatGPT לדפדפן · יום רביעי 21.10 בשעה 20:30',
    'claude-code':     'וובינר חינם בזום · עובד שיושב לך על המחשב, Claude Code למי שלא מתכנת · יום שני 2.11 בשעה 20:30',
    'pro-answers':     'וובינר חינם בזום · מתשובה בינונית לתשובה מקצועית, 7 הכללים · יום רביעי 11.11 בשעה 20:30'
  };
  // וובינר: הכותרת בהירו (שתי שורות), תגיות המועד, ושדה "מה הייתם רוצים ללמוד" שהופך לשאלה אחת לוובינר
  var WEBINARS = {
    'claude-code': {
      title: 'עובד שיושב לך על המחשב.', accent: 'Claude Code למי שלא מתכנת.',
      lead: 'וובינר חינם בזום, לשכירים ולבעלי עסקים. נראה איך הוראה אחת בעברית עוברת לבד על תיקייה שלמה של קבצים ומכינה מהם Excel מסודר, בלי שורת קוד.',
      when: ['יום שני 2.11', '20:30', 'בזום', 'חינם'],
      placeholder: 'למשל: איזו עבודה במחשב הייתם רוצים שמישהו יעשה בשבילכם',
      who: true   // קהל רחב: שואלים "שכיר או בעל עסק" במקום לבחור מסלול
    },
    'pro-answers': {
      title: 'מתשובה בינונית', accent: 'לתשובה מקצועית.',
      lead: 'וובינר חינם בזום. 7 הכללים, ותמונות שלא נראות כמו AI. אותה בקשה פעמיים, לפני ואחרי.',
      when: ['יום רביעי 11.11', '20:30', 'בזום', 'חינם'],
      placeholder: 'למשל: למה ChatGPT נותן לי תשובות כלליות, ואיך מקבלים תמונה שלא נראית כמו AI'
    }
  };
  var forKey = (new URLSearchParams(location.search).get('for') || '').trim();
  var topic = TOPICS[forKey] || '';
  var w = WEBINARS[forKey];
  function $(sel){ return document.querySelector(sel); }
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
      msg.innerHTML = 'השליחה לא הצליחה. אפשר <a href="https://wa.me/972528189921" target="_blank" rel="noopener">לכתוב ליוחנן בוואטסאפ</a>.';
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
