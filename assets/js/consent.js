/* ============================================================
   Shwadron.AI - Cookie / tracking consent
   ------------------------------------------------------------
   Nothing that is not strictly necessary runs until the visitor
   opts in. Google Analytics 4 and Microsoft Clarity are loaded
   ONLY after consent for the "statistics" category is granted.

   Categories in use on this site:
     essential   - always on, no consent needed (consent record itself)
     preferences - remembering the visitor's own choices
     statistics  - Google Analytics 4, Microsoft Clarity
     marketing   - none in use today; the switch exists so that
                   adding a pixel later cannot silently skip consent
     external    - Google Fonts, embedded video

   Public API:
     SHW.consent.get()             -> {statistics, marketing, preferences, ts, v}|null
     SHW.consent.has('statistics') -> boolean
     SHW.consent.open()            -> opens the settings dialog
     SHW.consent.onGrant(cat, fn)  -> run fn now (if granted) or on grant
   ============================================================ */
(function (window, document) {
  'use strict';

  var STORE_KEY = 'shw_consent_v1';
  var POLICY_VERSION = '2026-08-01';

  // Analytics IDs live here so no page can start a tracker on its own.
  var TRACKERS = {
    GA4_ID: 'G-CCPB1QRS42',
    CLARITY_ID: 'xu2vu3u1d0'
  };

  var listeners = [];
  var state = null;

  /* ── storage ─────────────────────────────────────────────── */
  function read() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      // A policy revision invalidates the old record: ask again.
      if (parsed.v !== POLICY_VERSION) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function write(choice) {
    state = {
      preferences: !!choice.preferences,
      statistics: !!choice.statistics,
      marketing: !!choice.marketing,
      ts: new Date().toISOString(),
      v: POLICY_VERSION
    };
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode: the choice still applies for this page view */
    }
    apply();
  }

  function has(cat) {
    return !!(state && state[cat]);
  }

  /* ── applying consent ────────────────────────────────────── */
  var started = {};

  function startGA4() {
    if (started.ga4 || !TRACKERS.GA4_ID) return;
    started.ga4 = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + TRACKERS.GA4_ID;
    document.head.appendChild(s);
    window.gtag('js', new Date());
    // IP anonymisation + no ad personalisation: analytics only.
    window.gtag('config', TRACKERS.GA4_ID, {
      anonymize_ip: true,
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function startClarity() {
    if (started.clarity || !TRACKERS.CLARITY_ID) return;
    started.clarity = true;
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1;
      t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', TRACKERS.CLARITY_ID);
  }

  function apply() {
    if (has('statistics')) {
      startGA4();
      startClarity();
    }
    // Queued callbacks fire once their category is granted.
    listeners = listeners.filter(function (l) {
      if (has(l.cat)) { try { l.fn(); } catch (e) {} return false; }
      return true;
    });
    document.documentElement.setAttribute(
      'data-consent',
      state ? (has('statistics') ? 'statistics' : 'essential') : 'undecided'
    );
  }

  /* ── gtag stub ───────────────────────────────────────────
     Pages call gtag('event', ...) for conversions. Before consent
     that must be a no-op rather than a ReferenceError. */
  if (!window.gtag) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { if (has('statistics')) window.dataLayer.push(arguments); };
  }

  /* ── UI ──────────────────────────────────────────────────── */
  var BANNER_ID = 'shw-cookie-banner';
  var DIALOG_ID = 'shw-cookie-dialog';
  var lastFocus = null;

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html != null) n.innerHTML = html;
    return n;
  }

  function buildBanner() {
    var b = el('section', {
      id: BANNER_ID,
      role: 'region',
      'aria-labelledby': 'shw-cookie-title',
      class: 'shw-cookie-banner'
    });
    b.innerHTML =
      '<div class="shw-cookie-inner">' +
        '<h2 id="shw-cookie-title" tabindex="-1">שימוש בעוגיות באתר</h2>' +
        '<p>אנחנו משתמשים בעוגיות חיוניות להפעלת האתר. בנוסף, אנחנו מעוניינים להשתמש ' +
        'בעוגיות סטטיסטיקה (Google Analytics ו-Microsoft Clarity) כדי להבין איך משתמשים באתר ולשפר אותו. ' +
        'עוגיות הסטטיסטיקה לא ייטענו בלי אישורכם. ' +
        'פרטים מלאים במדיניות הפרטיות והעוגיות.</p>' +
        '<div class="shw-cookie-actions">' +
          '<button type="button" data-act="accept" class="shw-ck-btn shw-ck-primary">אני מאשר הכול</button>' +
          '<button type="button" data-act="reject" class="shw-ck-btn shw-ck-secondary">רק עוגיות חיוניות</button>' +
          '<button type="button" data-act="settings" class="shw-ck-btn shw-ck-link">הגדרות עוגיות</button>' +
          '<a href="privacy.html" class="shw-ck-btn shw-ck-link">מדיניות פרטיות ועוגיות</a>' +
        '</div>' +
      '</div>';

    b.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'accept') {
        write({ preferences: true, statistics: true, marketing: false });
        closeBanner();
      } else if (act === 'reject') {
        write({ preferences: false, statistics: false, marketing: false });
        closeBanner();
      } else if (act === 'settings') {
        openDialog();
      }
    });
    return b;
  }

  function closeBanner() {
    var b = document.getElementById(BANNER_ID);
    if (b) b.parentNode.removeChild(b);
    var t = document.getElementById('shw-consent-toggle');
    if (t) t.focus();
  }

  function showBanner() {
    if (document.getElementById(BANNER_ID)) return;
    var b = buildBanner();
    document.body.appendChild(b);
    // Announce the banner to assistive tech without stealing the caret
    // from a visitor who has already started interacting with the page.
    window.setTimeout(function () {
      var h = document.getElementById('shw-cookie-title');
      if (h && document.activeElement === document.body) h.focus();
    }, 400);
  }

  /* Settings dialog: native <dialog> gives us the focus trap,
     Escape-to-close and focus restoration for free. */
  function buildDialog() {
    var d = el('dialog', { id: DIALOG_ID, class: 'shw-cookie-dialog', 'aria-labelledby': 'shw-ck-dlg-title' });
    d.innerHTML =
      '<form method="dialog" class="shw-ck-form">' +
        '<h2 id="shw-ck-dlg-title">הגדרות עוגיות</h2>' +
        '<p class="shw-ck-intro">בחרו אילו סוגי עוגיות מותר לטעון. אפשר לשנות את הבחירה בכל עת ' +
        'דרך הקישור "הגדרות עוגיות" בתחתית כל עמוד.</p>' +

        '<fieldset class="shw-ck-group">' +
          '<legend>עוגיות חיוניות</legend>' +
          '<label class="shw-ck-row">' +
            '<input type="checkbox" checked disabled aria-describedby="ck-ess-d"/>' +
            '<span><b>תמיד פעיל</b><span id="ck-ess-d" class="shw-ck-desc">נדרשות לתפקוד בסיסי של האתר ולשמירת בחירת העוגיות שלכם. ללא אלה האתר לא יעבוד כראוי.</span></span>' +
          '</label>' +
        '</fieldset>' +

        '<fieldset class="shw-ck-group">' +
          '<legend>העדפות</legend>' +
          '<label class="shw-ck-row">' +
            '<input type="checkbox" id="ck-pref" aria-describedby="ck-pref-d"/>' +
            '<span><b>שמירת העדפות</b><span id="ck-pref-d" class="shw-ck-desc">זוכר בחירות שביצעתם באתר, כדי שלא תצטרכו לבצע אותן שוב.</span></span>' +
          '</label>' +
        '</fieldset>' +

        '<fieldset class="shw-ck-group">' +
          '<legend>סטטיסטיקה ואנליטיקה</legend>' +
          '<label class="shw-ck-row">' +
            '<input type="checkbox" id="ck-stats" aria-describedby="ck-stats-d"/>' +
            '<span><b>Google Analytics 4, Microsoft Clarity</b><span id="ck-stats-d" class="shw-ck-desc">מדידת תנועה באתר, עמודים נצפים והקלטת דפוסי שימוש אנונימיים, לצורך שיפור האתר. המידע מועבר ל-Google Ireland ול-Microsoft.</span></span>' +
          '</label>' +
        '</fieldset>' +

        '<fieldset class="shw-ck-group">' +
          '<legend>פרסום ושיווק</legend>' +
          '<label class="shw-ck-row">' +
            '<input type="checkbox" id="ck-mkt" aria-describedby="ck-mkt-d"/>' +
            '<span><b>עוגיות פרסום</b><span id="ck-mkt-d" class="shw-ck-desc">נכון להיום האתר אינו מפעיל פיקסלים או עוגיות פרסום. הבחירה נשמרת מראש למקרה שייווספו בעתיד.</span></span>' +
          '</label>' +
        '</fieldset>' +

        '<div class="shw-ck-dlg-actions">' +
          '<button type="button" data-act="save" class="shw-ck-btn shw-ck-primary">שמירת הבחירה</button>' +
          '<button type="button" data-act="all" class="shw-ck-btn shw-ck-secondary">אישור הכול</button>' +
          '<button type="button" data-act="none" class="shw-ck-btn shw-ck-secondary">רק חיוניות</button>' +
          '<button type="button" data-act="close" class="shw-ck-btn shw-ck-link">סגירה</button>' +
        '</div>' +
      '</form>';

    d.addEventListener('click', function (e) {
      var act = e.target.getAttribute && e.target.getAttribute('data-act');
      if (!act) return;
      if (act === 'save') {
        write({
          preferences: d.querySelector('#ck-pref').checked,
          statistics: d.querySelector('#ck-stats').checked,
          marketing: d.querySelector('#ck-mkt').checked
        });
      } else if (act === 'all') {
        write({ preferences: true, statistics: true, marketing: true });
      } else if (act === 'none') {
        write({ preferences: false, statistics: false, marketing: false });
      }
      closeDialog();
      if (act !== 'close') closeBanner();
    });

    // Escape closes via the native dialog; restore focus ourselves
    // because we removed the banner underneath it.
    d.addEventListener('close', function () {
      if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    });
    return d;
  }

  function openDialog() {
    lastFocus = document.activeElement;
    var d = document.getElementById(DIALOG_ID);
    if (!d) { d = buildDialog(); document.body.appendChild(d); }
    d.querySelector('#ck-pref').checked = has('preferences');
    d.querySelector('#ck-stats').checked = has('statistics');
    d.querySelector('#ck-mkt').checked = has('marketing');
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
    var first = d.querySelector('#ck-pref');
    if (first) first.focus();
  }

  function closeDialog() {
    var d = document.getElementById(DIALOG_ID);
    if (!d) return;
    if (typeof d.close === 'function') d.close();
    else d.removeAttribute('open');
  }

  /* ── boot ────────────────────────────────────────────────── */
  state = read();
  apply();

  function boot() {
    if (!state) showBanner();
    // Footer link (rendered by footer.js or hand-written) opens settings.
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-consent-settings]');
      if (t) { e.preventDefault(); openDialog(); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.SHW = window.SHW || {};
  window.SHW.consent = {
    get: function () { return state; },
    has: has,
    open: openDialog,
    version: POLICY_VERSION,
    onGrant: function (cat, fn) {
      if (has(cat)) { fn(); } else { listeners.push({ cat: cat, fn: fn }); }
    }
  };
})(window, document);
