/* ============================================================
   הוובינר במתנה: שם וטלפון פותחים את הנגן במקום.
   הפרטים נשלחים ל-/api/lead. גם אם השמירה נכשלה, הוובינר נפתח,
   ומי שכבר מילא פעם לא יתבקש שוב (נשמר בדפדפן).
   ============================================================ */
(function(){
  'use strict';
  var KEY = 'shw_gift_v1';
  var forms = document.querySelectorAll('[data-gift]');
  if(!forms.length) return;

  function unlock(){
    document.querySelectorAll('.gift-locked').forEach(function(frame){
      var f = frame.querySelector('iframe');
      if(f && !f.src){ f.src = f.getAttribute('data-src'); }
      if(f) f.hidden = false;
      var c = frame.querySelector('.gift-cover'); if(c) c.remove();
      frame.classList.remove('gift-locked');
    });
    forms.forEach(function(form){
      form.hidden = true;
      // תודה + הזמנה לקבוצת הטיפים במקום הטופס, וכפתור ההמשך שמתחת לנגן
      var sec = form.closest('section') || document;
      sec.querySelectorAll('.gift-done, .gift-after').forEach(function(el){ el.hidden = false; });
    });
  }

  var done = false;
  try { done = localStorage.getItem(KEY) === '1'; } catch(e){}
  if(done){ unlock(); return; }

  forms.forEach(function(form){
    var msg = form.querySelector('.gift-msg');
    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name  = form.elements.name.value.trim();
      var phone = form.elements.phone.value.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
      msg.classList.remove('err');
      if(!name){ msg.textContent = 'נא למלא שם.'; msg.classList.add('err'); form.elements.name.focus(); return; }
      if(!/^0\d{8,9}$/.test(phone)){ msg.textContent = 'נא למלא מספר טלפון תקין.'; msg.classList.add('err'); form.elements.phone.focus(); return; }
      var email = form.elements.email ? form.elements.email.value.trim() : '';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = 'נא למלא כתובת מייל תקינה.'; msg.classList.add('err'); form.elements.email.focus(); return; }
      var btn = form.querySelector('button'); btn.disabled = true;
      msg.textContent = 'פותח…';
      function open(){
        try { localStorage.setItem(KEY, '1'); } catch(e){}
        if(window.gtag) gtag('event', 'generate_lead', { lead_source: 'webinar_gift', traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
        unlock();
      }
      fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone, email: email, consent: form.elements.consent.checked, source: window.SHW_SOURCE ? SHW_SOURCE() : '',
                               page: location.pathname.replace(/^\//, '') || 'index.html' })
      }).then(open, open);
    });
  });
})();
