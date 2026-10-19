/* ============================================================
   טופס "חזרו אליי": בדפי הקורסים, בדף הבית ובדף העסקים.
   שם, טלפון (ובדף העסקים גם שם העסק) נשלחים ל-/api/lead ומופיעים
   ב-admin-leads.html עם הדף שממנו הגיעו והסימון "בקשה לחזרה".
   אם השמירה נכשלה, מציעים לפנות בוואטסאפ במקום להשאיר את הגולש תלוי.
   ============================================================ */
(function(){
  'use strict';
  var page = location.pathname.split('/').pop() || 'index.html';

  // קישורי "השאירו פרטים" (כותרת ורצועה תחתונה): תמונות שנטענות בזמן הגלילה
  // מזיזות את הטופס למטה, ולכן מכוונים שוב אחרי שהדף התייצב
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href="#callback"]');
    var target = document.getElementById('callback');
    if(!a || !target) return;
    e.preventDefault();
    history.replaceState(null, '', '#callback');
    target.scrollIntoView({ behavior: 'smooth' });
    setTimeout(function(){ target.scrollIntoView({ behavior: 'smooth' }); }, 900);
    setTimeout(function(){ var i = target.querySelector('input[name=name]'); if(i) i.focus({ preventScroll: true }); }, 1600);
  });

  document.querySelectorAll('[data-callback]').forEach(function(form){
    var msg = form.querySelector('.gift-msg');

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var name    = form.elements.name.value.trim();
      var phone   = form.elements.phone.value.replace(/[^\d+]/g, '').replace(/^\+?972/, '0');
      var company = form.elements.company ? form.elements.company.value.trim() : '';
      // דף העסקים: גודל הצוות, מה שקובע את ההצעה ואת המסלול המתאים
      var employees = form.elements.employees ? form.elements.employees.value : '';
      msg.classList.remove('err');
      if(!name){ msg.textContent = 'נא למלא שם.'; msg.classList.add('err'); form.elements.name.focus(); return; }
      if(!/^0\d{8,9}$/.test(phone)){ msg.textContent = 'נא למלא מספר טלפון תקין.'; msg.classList.add('err'); form.elements.phone.focus(); return; }
      var email = form.elements.email ? form.elements.email.value.trim() : '';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.textContent = 'נא למלא כתובת מייל תקינה.'; msg.classList.add('err'); form.elements.email.focus(); return; }
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
        body: JSON.stringify({ name: name, phone: phone, email: email, company: company, employees: employees, kind: 'callback',
                               consent: form.elements.consent.checked, source: window.SHW_SOURCE ? SHW_SOURCE() : '', page: page })
      }).then(function(r){
        if(!r.ok) return fail();
        if(window.gtag) gtag('event', 'generate_lead', { lead_source: 'callback_' + page.replace('.html', ''), traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
        form.hidden = true;
        var after = form.parentNode.querySelector('.gift-after');
        if(after){ after.hidden = false; after.focus(); }
      }, fail);
    });
  });
})();
