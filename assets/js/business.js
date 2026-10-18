/* ============================================================
   דף העסקים: טופס "חזרו אליי".
   שם, טלפון ושם העסק נשלחים ל-/api/lead ומופיעים ב-admin-leads.html.
   אם השמירה נכשלה, מציעים לפנות בוואטסאפ במקום להשאיר את הגולש תלוי.
   ============================================================ */
(function(){
  'use strict';
  var form = document.querySelector('[data-biz-form]');
  if(!form) return;
  var msg = form.querySelector('.gift-msg');

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var name    = form.elements.name.value.trim();
    var phone   = form.elements.phone.value.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
    var company = form.elements.company.value.trim();
    msg.classList.remove('err');
    if(!name){ msg.textContent = 'נא למלא שם.'; msg.classList.add('err'); form.elements.name.focus(); return; }
    if(!/^0\d{8,9}$/.test(phone)){ msg.textContent = 'נא למלא מספר טלפון תקין.'; msg.classList.add('err'); form.elements.phone.focus(); return; }
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
      body: JSON.stringify({ name: name, phone: phone, company: company,
                             consent: form.elements.consent.checked, page: 'business.html' })
    }).then(function(r){
      if(!r.ok) return fail();
      if(window.gtag) gtag('event', 'generate_lead', { lead_source: 'business', traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
      form.hidden = true;
      var after = form.parentNode.querySelector('.gift-after');
      if(after){ after.hidden = false; after.focus(); }
    }, fail);
  });
})();
