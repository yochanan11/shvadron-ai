/* ============================================================
   SHWADRON.AI — התנהגות משותפת לדפי מערכת הקורסים
   ------------------------------------------------------------
   כל דף מגדיר window.SHW_COURSE לפני הטעינה של הקובץ הזה:

     window.SHW_COURSE = {
       id:         'course-beginners',  // מזהה למדידה
       name:       'AI למתחילים',
       price:      null,             // המחיר לפני מע״מ. null = טרם נקבע
       vatRate:    0.18,
       couponPage: 'course-beginners'  // המפתח שנבדק מול /api/coupon
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

function ils(n){
  // 3750 מוצג כ-3,750. שברי אגורות נשמרים כפי שהם.
  return (n % 1 === 0 ? n.toLocaleString('he-IL') : n.toFixed(2)) + ' ₪';
}
function each(sel, fn){ document.querySelectorAll(sel).forEach(fn); }
/* תשלום אחד מתוך שלושה. מעוגל לשקל, ולכן מוצג בדף עם "כ-" לפניו */
function pmt(total){ return Math.round(total / 3); }

/* ─── מחירים: מקור אמת אחד ─────────────────────────────────
   .js-price       → המחיר לפני מע״מ
   .js-price-vat   → סכום המע״מ בלבד
   .js-price-total → הסכום הסופי לתשלום
   .js-price-pmt   → תשלום אחד מתוך שלושה, מעוגל לשקל
   [data-has-price] → מוצג רק כשיש מחיר
   [data-no-price]  → מוצג רק כשהמחיר טרם נקבע                */
function render(priceEx){
  var vat   = Math.round(priceEx * VAT * 100) / 100;
  var total = Math.round(priceEx * (1 + VAT) * 100) / 100;

  each('.js-price',       function(el){ el.textContent = ils(priceEx); });
  each('.js-price-vat',   function(el){ el.textContent = ils(vat); });
  each('.js-price-total', function(el){ el.textContent = ils(total); });
  each('.js-price-pmt',   function(el){ el.textContent = ils(pmt(total)); });
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

// אלמנטי המחיר נשלחים מהשרת עם hidden, כדי שדפדפן ללא JS יראה את
// גרסת "המחיר יעודכן" ולא מחיר ריק. כאן מחליטים מי מהשניים מוצג.
if (hasPrice) {
  render(C.price);
  each('[data-has-price]', function(el){ el.hidden = false; });
  each('[data-no-price]',  function(el){ el.hidden = true; });
} else {
  // כל עוד המחיר לא נקבע, אין מה להציג ואין מה להנחות בקופון.
  each('[data-has-price]', function(el){ el.hidden = true; });
  each('[data-no-price]',  function(el){ el.hidden = false; });
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
        cta_location: where(a), course_id: C.id || '', value: value, currency:'ILS',
        traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct'
      });
      var href = a.getAttribute('href') || '';
      if(href.indexOf('wa.me') === 0 || href.indexOf('http') === 0){
        gtag('event','begin_checkout',{ currency:'ILS', value: value, items:[item], traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
      }
    });
  });

  // מעקב אחרי בחירת מסלול בדף הבחירה
  each('[data-track-pick]', function(a){
    a.addEventListener('click', function(){
      gtag('event','select_course_track',{ course_id: a.getAttribute('data-track-pick'), traffic_source: window.SHW_SOURCE ? SHW_SOURCE() : 'direct' });
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

/* המחיר הרגיל כולל מע״מ, להשוואה מול מחיר אחרי הנחה */
function regularTotal(){ return Math.round(C.price * (1 + VAT) * 100) / 100; }

/* כשהנחה כבר מוחלת אוטומטית (מבצע או בוגרים) שדה הקופון מתקפל
   לקישור קטן "יש לך קוד קופון אחר?", כדי שלא ייראה שצריך קוד */
function collapseCoupon(){
  var box = document.getElementById('coupon-box');
  if(!box) return;
  var t = box.querySelector('.pd-coupon-toggle');
  box.classList.add('is-collapsed');
  if(!t) return;
  t.hidden = false;
  t.onclick = function(){
    box.classList.remove('is-collapsed'); t.hidden = true;
    var i = document.getElementById('coupon-input'); if(i) i.focus();
  };
}

/* מחיל תוצאת קופון תקפה מ-/api/coupon: המחירים בדף וקישור התשלום */
function applyCoupon(data){
  each('.js-price',       function(el){ el.textContent = ils(data.price); });
  each('.js-price-vat',   function(el){ el.textContent = ils(data.vat); });
  each('.js-price-total', function(el){ el.textContent = ils(data.total); });
  each('.js-price-pmt',   function(el){ el.textContent = ils(pmt(data.total)); });
  if(data.checkoutUrl){
    each('[data-join]', function(a){
      if((a.getAttribute('href') || '').charAt(0) === '#') return;  // קישורי גלילה נשארים
      a.href = data.checkoutUrl;
      a.removeAttribute('target');
    });
  }
  window.SHW_PRICE_EX = data.price;
  window.SHW_PRICE    = data.total;
  var regular = regularTotal();
  var save = Math.round((regular - data.total) * 100) / 100;
  each('[data-saving]', function(el){
    el.textContent = save > 0 ? 'חוסכים ' + ils(save) + ' מהמחיר הרגיל' : '';
    el.hidden = !(save > 0);
  });
}

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
        // הנחות לא מצטרפות: קוד שמביא למחיר גבוה מהמחיר שכבר מוצג לא מוחל
        if(window.SHW_PRICE && data.total >= window.SHW_PRICE){
          setMsg(data.total === window.SHW_PRICE ? 'ההנחה הזו כבר מחושבת במחיר.' : 'המחיר שמוצג כבר נמוך יותר. הנחות לא מצטרפות זו לזו.', false);
          btn.disabled = false;
          return;
        }
        applyCoupon(data);
        // קופון ידני מחליף את הנחת הרישום המוקדם, אז השורה שלה כבר לא נכונה
        each('.promo-bar, [data-promo]', function(el){ el.hidden = true; });
        each('[data-promo-row]', function(el){ el.hidden = false; });
        each('.js-regular', function(el){ el.textContent = ils(regularTotal()); });
        each('.js-price-label', function(el){ el.textContent = 'מחיר אחרי קופון, לפני מע״מ'; });
        setMsg('הקופון הופעל! המחיר עודכן ל-' + ils(data.total) + ' כולל מע״מ.', true);
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

/* ─── הטבת בוגרים: מי שהגיע מ-/alumni (?offer=alumni) לדף המתקדמים.
       הקופון "בוגרים" נבדק מול /api/coupon. כשהוא מוגדר, המחיר והקישור
       מתחלפים, והנחת הרישום המוקדם לא מוצגת בכלל, כדי שלא יהיו שתי הנחות
       מתחרות. כשהוא עדיין לא מוגדר, מוצגת הפניה לוואטסאפ במקום מחיר. ─── */
var ALUMNI = C.id === 'course-advanced' && /[?&]offer=alumni(&|$)/.test(location.search);
(function(){
  var bar = document.querySelector('.alumni-bar');
  if(!ALUMNI || !bar) return;
  function show(cls){
    bar.hidden = false;
    bar.querySelectorAll('.' + cls).forEach(function(el){ el.hidden = false; });
  }
  fetch('/api/coupon', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ code: bar.getAttribute('data-code'), page: 'course-advanced' })
  })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if(!data.valid){ show('alumni-off'); return; }
      applyCoupon(data);
      var regular = Math.round(C.price * (1 + VAT) * 100) / 100;
      var fill = { total: ils(data.total), regular: ils(regular), save: ils(Math.round((regular - data.total) * 100) / 100) };
      bar.querySelectorAll('[data-alumni]').forEach(function(el){ el.textContent = fill[el.getAttribute('data-alumni')]; });
      each('.js-regular', function(el){ el.textContent = ils(regularTotal()); });
      each('.js-price-label', function(el){ el.textContent = 'מחיר בוגרים, לפני מע״מ'; });
      each('[data-promo-row]', function(el){ el.hidden = false; });
      collapseCoupon();
      show('alumni-on');
    })
    .catch(function(){ show('alumni-off'); });
})();

/* ─── מבצע: עד data-until כולל, לפי שעון ישראל. הקוד שעל הבאנר
       נבדק מול /api/coupon, ורק אם הוא תקף הבאנר מוצג ובדף מסלול
       ההנחה מוחלת לבד: המחיר הרגיל מחוק, מחיר המבצע במקומו, וקישור
       התשלום מתחלף. אם הקופון לא מוגדר, הדף נשאר במחיר הרגיל.    ─── */
(function(){
  var bar = document.querySelector('.promo-bar:not(.alumni-bar):not(.promo-ever)');
  // הפס הקבוע ("מחזור כסליו · עד 20 איש") מחליף את פס המבצע ברגע
  // שההנחה אינה בתוקף, כדי שלא יישאר ראש הדף בלי קריאה לפעולה.
  function evergreen(){ each('[data-promo-else]', function(el){ el.hidden = false; }); }
  if(ALUMNI) return;
  if(!bar){ evergreen(); return; }
  var today, until = bar.getAttribute('data-until');
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());
  } catch(e){ evergreen(); return; }
  if(today > until){ evergreen(); return; }

  var days = Math.round((Date.parse(until) - Date.parse(today)) / 864e5) + 1;
  each('[data-promo-fill="left"]', function(el){
    el.textContent = days <= 1 ? '· היום בחצות ההנחה נגמרת' : '· נותרו ' + days + ' ימים';
  });

  var onTrack = hasPrice && document.getElementById('coupon-box');
  fetch('/api/coupon', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ code: bar.getAttribute('data-code'),
                           page: onTrack ? (C.couponPage || C.id) : 'course-beginners' })
  })
    .then(function(res){ return res.json(); })
    .then(function(data){
      if(!data.valid){ evergreen(); return; }
      bar.hidden = false;
      each('[data-promo]', function(el){ el.hidden = false; });
      if(!onTrack) return;
      applyCoupon(data);
      each('.js-regular', function(el){ el.textContent = ils(regularTotal()); });
      each('.js-price-label', function(el){ el.textContent = 'מחיר רישום מוקדם, לפני מע״מ'; });
      each('[data-promo-row]', function(el){ el.hidden = false; });
      collapseCoupon();
    })
    .catch(evergreen);
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

/* ─── השורה שמעל המחיר ──────────────────────────────────────
   כאן ישבה קודם ספירת ימים עד הפתיחה, והיא עבדה נגדנו: ״המחזור
   נפתח בעוד 29 ימים״, במקום הכי חזק באזור ההחלטה, אומר לגולש
   שיש לו חודש ושהוא יכול לחזור אחר כך. ספירה לאחור עוזרת רק
   כשהזמן קצר באמת.

   שלוש מדרגות, לפי מה שידוע בוודאות:
   1. יש מספר מקומות אמיתי ב-seatsLeft -> מציגים אותו. זה המחסור
      היחיד שאפשר להוכיח, והוא נקבע ידנית בקובץ הנתונים.
   2. נשארו DAYS_URGENT ימים או פחות -> הספירה עובדת לטובתנו.
   3. אחרת -> התקרה של הקבוצה, בלי מספר שנותר ובלי להמציא כלום.

   אין כאן בשום מצב מספר שלא הגיע מקובץ הנתונים.                */
(function(){
  var DAYS_URGENT = 10;

  var els = document.querySelectorAll('[data-days-to-start]');
  if(!els.length) return;

  var text = '';

  if(typeof C.seatsLeft === 'number' && C.seatsLeft > 0){
    text = C.seats
      ? 'נשארו ' + C.seatsLeft + ' מקומות מתוך ' + C.seats
      : 'נשארו ' + C.seatsLeft + ' מקומות';
  } else if(C.start){
    var start = new Date(C.start + 'T00:00:00');
    var today = new Date(); today.setHours(0,0,0,0);
    var days  = Math.round((start - today) / 86400000);

    if(!isFinite(days) || days < 0) return;

    if(days <= DAYS_URGENT){
      text = days === 0 ? 'המחזור נפתח היום'
           : days === 1 ? 'המחזור נפתח מחר'
           : 'המחזור נפתח בעוד ' + days + ' ימים';
    } else if(C.seats){
      text = 'הקבוצה מוגבלת ל-' + C.seats + ' משתתפים, נסגרת כשהיא מתמלאת';
    }
  } else if(C.seats){
    text = 'הקבוצה מוגבלת ל-' + C.seats + ' משתתפים, נסגרת כשהיא מתמלאת';
  }

  if(!text) return;

  els.forEach(function(el){
    el.textContent = text;
    el.removeAttribute('hidden');
  });
})();

})();
