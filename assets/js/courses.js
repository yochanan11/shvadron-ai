/* ============================================================
   SHWADRON.AI — התנהגות משותפת לדפי מערכת הקורסים
   ------------------------------------------------------------
   כל דף מגדיר window.SHW_COURSE לפני הטעינה של הקובץ הזה:

     window.SHW_COURSE = {
       id:         'course-basic',   // מזהה למדידה
       name:       'קורס הבסיס',
       price:      null,             // המחיר לפני מע״מ. null = טרם נקבע
       vatRate:    0.18,
       couponPage: 'course-basic'    // המפתח שנבדק מול /api/coupon
     };

   כדי לפרסם מחיר: להחליף את price במספר. זה המקום היחיד שצריך
   לגעת בו, וכל הדף נגזר ממנו: הכותרות, טבלת המחיר, הרצועה
   התחתונה, הנתונים המובנים לגוגל ותיבת הקופון.
   ============================================================ */
(function(){
'use strict';

var C = window.SHW_COURSE || {};
var VAT = typeof C.vatRate === 'number' ? C.vatRate : 0.18;
var hasPrice = typeof C.price === 'number' && C.price > 0;

function ils(n){ return (n % 1 === 0 ? String(n) : n.toFixed(2)) + ' ₪'; }
function each(sel, fn){ document.querySelectorAll(sel).forEach(fn); }

/* ─── מחירים: מקור אמת אחד ─────────────────────────────────
   .js-price       → המחיר לפני מע״מ
   .js-price-vat   → סכום המע״מ בלבד
   .js-price-total → הסכום הסופי לתשלום
   [data-has-price] → מוצג רק כשיש מחיר
   [data-no-price]  → מוצג רק כשהמחיר טרם נקבע                */
function render(priceEx){
  var vat   = Math.round(priceEx * VAT * 100) / 100;
  var total = Math.round(priceEx * (1 + VAT) * 100) / 100;

  each('.js-price',       function(el){ el.textContent = ils(priceEx); });
  each('.js-price-vat',   function(el){ el.textContent = ils(vat); });
  each('.js-price-total', function(el){ el.textContent = ils(total); });
  each('.js-vat-rate',    function(el){ el.textContent = (VAT * 100) + '%'; });

  window.SHW_PRICE_EX = priceEx;
  window.SHW_PRICE    = total;

  // הנתונים המובנים לגוגל נגזרים מאותו מקור, כדי שלא יוצג
  // בתוצאות החיפוש מחיר שאינו בתוקף.
  try {
    var ld = document.getElementById('course-ld');
    if (ld) {
      var data = JSON.parse(ld.textContent);
      data.offers = {
        '@type': 'Offer',
        price: total.toFixed(2),
        priceCurrency: 'ILS',
        availability: 'https://schema.org/InStock',
        url: location.href.split('#')[0],
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: String(priceEx),
          priceCurrency: 'ILS',
          valueAddedTaxIncluded: false,
          description: priceEx + ' ₪ לפני מע״מ. סה״כ לתשלום ' +
            total.toFixed(2) + ' ₪ כולל מע״מ ' + (VAT * 100) + '%.'
        }
      };
      ld.textContent = JSON.stringify(data);
    }
  } catch(e){}
}

if (hasPrice) {
  render(C.price);
  each('[data-no-price]', function(el){ el.hidden = true; });
} else {
  // כל עוד המחיר לא נקבע, אין מה להציג ואין מה להנחות בקופון.
  each('[data-has-price]', function(el){ el.hidden = true; });
}

/* ─── מדידת המרות: איזה כפתור הרשמה נלחץ ─────────────────── */
(function(){
  function where(el){
    if(el.closest('header'))      return 'header';
    if(el.closest('.stickybar'))  return 'sticky_mobile';
    if(el.closest('.hero'))       return 'hero';
    if(el.closest('.price-card')) return 'price_card';
    if(el.closest('.track'))      return 'track_card';
    var s = el.closest('section');
    return (s && s.id) ? s.id : 'other';
  }
  var value = window.SHW_PRICE || 0;
  var item  = { item_id: C.id || 'course', item_name: C.name || '', price: value, quantity: 1 };

  each('[data-join]', function(a){
    a.addEventListener('click', function(){
      gtag('event','click_join_cohort',{
        cta_location: where(a), course_id: C.id || '', value: value, currency:'ILS'
      });
      var href = a.getAttribute('href') || '';
      if(href.indexOf('wa.me') === 0 || href.indexOf('http') === 0){
        gtag('event','begin_checkout',{ currency:'ILS', value: value, items:[item] });
      }
    });
  });

  // מעקב אחרי בחירת מסלול בדף הבחירה
  each('[data-track-pick]', function(a){
    a.addEventListener('click', function(){
      gtag('event','select_course_track',{ course_id: a.getAttribute('data-track-pick') });
    });
  });

  var marks = [25,50,75,100], seen = {};
  window.addEventListener('scroll', function(){
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if(h <= 0) return;
    var pct = (window.scrollY / h) * 100;
    marks.forEach(function(m){
      if(pct >= m && !seen[m]){ seen[m] = 1; gtag('event','scroll_depth',{ percent_scrolled: m }); }
    });
  }, {passive:true});
})();

/* ─── קופון: נבדק בצד השרת ב-/api/coupon, לעולם לא סומכים
       על הדפדפן. קופון שמוגדר לעמוד הזה מחזיר קישור תשלום
       משלו, ואז כפתורי ההרשמה מפנים אליו במקום לוואטסאפ.  ─── */
(function(){
  var box   = document.getElementById('coupon-box');
  var input = document.getElementById('coupon-input');
  var btn   = document.getElementById('coupon-apply');
  var msg   = document.getElementById('coupon-msg');
  if(!box || !input || !btn || !msg || !hasPrice) return;

  function setMsg(text, ok){
    msg.textContent = text;
    msg.className = 'pd-coupon-msg ' + (ok ? 'ok' : 'err');
  }

  function apply(){
    var code = input.value.trim();
    if(!code){ setMsg('יש להזין קוד קופון.', false); return; }
    btn.disabled = true;
    setMsg('בודק קופון…', true);
    fetch('/api/coupon', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ code: code, page: C.couponPage || C.id })
    })
      .then(function(res){ return res.json(); })
      .then(function(data){
        if(!data.valid){
          setMsg('קוד קופון לא תקף.', false);
          btn.disabled = false;
          return;
        }
        each('.js-price',       function(el){ el.textContent = ils(data.price); });
        each('.js-price-vat',   function(el){ el.textContent = ils(data.vat); });
        each('.js-price-total', function(el){ el.textContent = ils(data.total); });
        if(data.checkoutUrl){
          each('[data-join]', function(a){
            a.href = data.checkoutUrl;
            a.removeAttribute('target');
          });
        }
        window.SHW_PRICE_EX = data.price;
        window.SHW_PRICE    = data.total;
        setMsg('הקופון הופעל! המחיר עודכן ל-' + ils(data.price) + ' + מע״מ.', true);
        input.disabled = true;
      })
      .catch(function(){
        setMsg('שגיאה בבדיקת הקופון, נסו שוב.', false);
        btn.disabled = false;
      });
  }

  btn.addEventListener('click', apply);
  input.addEventListener('keydown', function(e){
    if(e.key === 'Enter'){ e.preventDefault(); apply(); }
  });
})();

/* ─── חשיפה בגלילה ─── */
(function(){
  var els = document.querySelectorAll('.sr');
  if(!('IntersectionObserver' in window)){
    els.forEach(function(el){ el.classList.add('on'); });
    return;
  }
  var io = new IntersectionObserver(function(entries, o){
    entries.forEach(function(x){
      if(x.isIntersecting){ x.target.classList.add('on'); o.unobserve(x.target); }
    });
  }, {threshold:.12, rootMargin:'0px 0px -50px 0px'});
  els.forEach(function(el){ io.observe(el); });
})();

/* ─── רצועת ההרשמה הקבועה במובייל ─── */
(function(){
  var bar = document.getElementById('stickybar');
  if(!bar) return;
  function upd(){ bar.classList.toggle('show', window.scrollY > 480); }
  upd();
  window.addEventListener('scroll', upd, {passive:true});
})();

})();
