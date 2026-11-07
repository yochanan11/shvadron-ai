/* ============================================================
   דף שמירת מקום אחרי הוובינר (makom.html).
   שם מלא, טלפון, מה מעניין, ובהטמעה גם שם העסק וכמה עובדים.
   שדה פתוח (לא חובה) כמה מילים על הנרשם, כדי שלנציג יהיה ממה לפתוח את השיחה.
   נשלח ל-/api/lead עם kind: 'makom', ומופיע ב-admin-leads.html
   ובגיליון הלידים (סוג פנייה "שמירת מקום").
   מאיזה וובינר הגיעו: ?src=<מפתח> בקישור (ברירת מחדל webinar-9-11),
   כדי שאותו דף ישמש גם בוובינרים הבאים. לדוגמה makom.html?src=webinar-<יום>-<חודש>
   ============================================================ */
(function(){
  'use strict';
  var form = document.querySelector('[data-makom]');
  if(!form) return;
  var params = new URLSearchParams(location.search);
  var src = (params.get('src') || 'webinar-9-11').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
  var msg = form.querySelector('.gift-msg');
  var biz = form.querySelector('[data-biz]');
  var btn = form.querySelector('[data-submit]');
  var wrap = document.getElementById('makom-form');

  // בהטמעה: שדות העסק מופיעים והכפתור משתנה
  function sync(){
    var v = (form.querySelector('input[name="interest"]:checked') || {}).value;
    var isBiz = v === 'business';
    biz.hidden = !isBiz;
    form.elements.company.required = isBiz;
    btn.textContent = isBiz ? 'קבעו לי שיחת אפיון' : 'שמרו לי מקום';
  }
  form.querySelectorAll('input[name="interest"]').forEach(function(r){ r.addEventListener('change', sync); });

  // כפתור בכרטיס: גולל לטופס ובוחר מראש את המסלול
  document.querySelectorAll('[data-pick]').forEach(function(a){
    a.addEventListener('click', function(e){
      var r = form.querySelector('input[name="interest"][value="' + a.getAttribute('data-pick') + '"]');
      if(!r) return;
      e.preventDefault();
      r.checked = true; sync();
      wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function(){ form.elements.name.focus({ preventScroll: true }); }, 400);
    });
  });

  function err(text, field){
    msg.textContent = text; msg.classList.add('err');
    if(field && field.focus) field.focus();
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var el = form.elements;
    var name = el.name.value.trim();
    var phone = el.phone.value.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
    var interest = (form.querySelector('input[name="interest"]:checked') || {}).value || '';
    var when = (form.querySelector('input[name="when"]:checked') || {}).value || '';
    var about = el.about.value.trim();
    var isBiz = interest === 'business';
    var company = isBiz ? el.company.value.trim() : '';
    var employees = isBiz ? el.employees.value : '';
    msg.classList.remove('err');

    if(!name){ return err('נא למלא שם מלא.', el.name); }
    if(!/^0\d{8,9}$/.test(phone)){ return err('נא למלא מספר טלפון תקין.', el.phone); }
    if(!interest){ return err('נא לבחור מה מעניין אותך.', form.querySelector('input[name="interest"]')); }
    if(isBiz && !company){ return err('נא למלא את שם העסק והתחום.', el.company); }

    btn.disabled = true;
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
        kind: 'makom', name: name, phone: phone, interest: interest, company: company, employees: employees,
        callTime: when, message: about, topicKey: src, consent: el.consent.checked,
        source: window.SHW_SOURCE ? SHW_SOURCE() : '', page: 'makom.html'
      })
    }).then(function(r){
      if(!r.ok) return fail();
      if(window.gtag) gtag('event', 'generate_lead', { lead_source: 'makom_' + interest, webinar: src, traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
      form.hidden = true;
      var after = wrap.querySelector('.gift-after');
      if(isBiz) after.querySelector('[data-after-title]').textContent = 'קיבלנו, נחזור אליך לדבר על העסק שלך 🎉';
      var cards = document.querySelector('.mk-cards'); if(cards) cards.hidden = true;
      after.hidden = false;
      wrap.scrollIntoView({ block: 'start' });
      after.focus();
    }, fail);
  });
})();
