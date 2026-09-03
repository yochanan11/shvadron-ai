/* ============================================================
   SHWADRON.AI — "יוחנן הדיגיטלי"
   בוט השאלות של עמוד הקורס הדיגיטלי.
   ------------------------------------------------------------
   • הרכיב נבנה כולו כאן, כך שאין צורך בסימון נוסף ב-course.html.
   • אין כאן שום מפתח וגם לא קריאה ישירה לספק AI. כל פנייה עוברת
     דרך /api/course-bot בשרת.
   • אם השירות לא זמין, הבוט אומר זאת בעברית ומציע מעבר לוואטסאפ.
     טעינת העמוד לא נפגעת בשום מקרה.
   • אירועי מדידה נשלחים דרך gtag, שהוא no-op עד לאישור העוגיות.
     תוכן השאלות עצמו לא נשלח לאנליטיקה אף פעם.
   ============================================================ */
(function (window, document) {
  'use strict';

  var ENDPOINT      = '/api/course-bot';
  var WHATSAPP_URL  = 'https://wa.me/972528189921';
  var WHATSAPP_TEXT = 'שלום יוחנן, הייתי בעמוד הקורס ורציתי לשאול:';
  var BUY_ANCHOR    = 'buy';
  var MAX_CHARS     = 500;
  var HISTORY_TURNS = 12;

  var STORE_THREAD  = 'yd_thread_v1';   // השיחה, לביקור הנוכחי בלבד
  var STORE_INVITE  = 'yd_invite_v1';   // האם בועת ההזמנה כבר הוצגה/נסגרה

  var GREETING =
    'שלום, אני יוחנן הדיגיטלי 👋\n' +
    'אפשר לשאול אותי על תוכן הקורס, רמת הידע הנדרשת, המחיר או מה תוכלו לעשות בעזרת AI אחרי הלימודים.';

  var QUICK = [
    'מה בדיוק לומדים בקורס?',
    'האם הקורס מתאים למתחילים?',
    'איך הקורס יכול לעזור לעסק שלי?',
    'מה ההבדל בין הקורס המוקלט לקורס החי?',
    'כמה זמן נשארת הגישה?',
    'האם צריך לשלם על כלי AI נוספים?'
  ];

  var FALLBACK_TEXT = 'על זה אני לא רוצה לנחש. אפשר לשאול את יוחנן ישירות בוואטסאפ.';

  /* ── עזרים קטנים ───────────────────────────────────────── */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function svg(path, extra) {
    var s = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
    return extra ? s + extra : s;
  }

  function store(key, value) {
    try {
      if (value === undefined) return window.sessionStorage.getItem(key);
      window.sessionStorage.setItem(key, value);
    } catch (e) { /* גלישה פרטית: השיחה פשוט לא תישמר */ }
    return null;
  }

  // אירועי מדידה. gtag קיים תמיד כ-no-op לפני ההסכמה, והבדיקה כאן
  // היא חגורה נוספת. שם השאלה או תוכנה לא נשלחים לעולם.
  function track(name, params) {
    try {
      var consent = window.SHW && window.SHW.consent;
      if (consent && !consent.has('statistics')) return;
      if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
    } catch (e) {}
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isMobile() {
    return window.matchMedia && window.matchMedia('(max-width: 720px)').matches;
  }

  /* ── הרכיב ─────────────────────────────────────────────── */

  function build() {
    var root = el('div', 'yd-root');
    root.setAttribute('data-yd-root', '');

    /* בועת ההזמנה */
    var invite = el('div', 'yd-invite');
    invite.hidden = true;
    var inviteBtn = el('button', 'yd-invite-open');
    inviteBtn.type = 'button';
    inviteBtn.textContent = 'מתלבטים אם הקורס מתאים לכם? תשאלו אותי 👋';
    var inviteClose = el('button', 'yd-invite-close', '×');
    inviteClose.type = 'button';
    inviteClose.setAttribute('aria-label', 'סגירת ההודעה');
    invite.appendChild(inviteBtn);
    invite.appendChild(inviteClose);

    /* הכפתור הסגור */
    var launcher = el('button', 'yd-launcher');
    launcher.type = 'button';
    launcher.id = 'yd-launcher';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'yd-panel');
    launcher.setAttribute('aria-label', 'פתיחת הצ׳אט עם יוחנן הדיגיטלי, עוזר AI לשאלות על הקורס');
    var face = el('span', 'yd-face');
    face.setAttribute('role', 'img');
    face.setAttribute('aria-label', 'איור של יוחנן שבדרון');
    launcher.appendChild(face);

    /* חלון השיחה */
    var panel = el('section', 'yd-panel');
    panel.id = 'yd-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'yd-title');
    panel.setAttribute('aria-describedby', 'yd-subtitle');

    var head = el('div', 'yd-head');
    var headFace = el('span', 'yd-face');
    headFace.setAttribute('role', 'img');
    headFace.setAttribute('aria-label', 'איור של יוחנן שבדרון');
    var headTxt = el('div', 'yd-head-txt');
    var title = el('h2', null, 'יוחנן הדיגיטלי');
    title.id = 'yd-title';
    var subtitle = el('p', null, 'עוזר AI שעונה על שאלות בנוגע לקורס');
    subtitle.id = 'yd-subtitle';
    headTxt.appendChild(title);
    headTxt.appendChild(subtitle);

    var minBtn = el('button', 'yd-head-btn');
    minBtn.type = 'button';
    minBtn.setAttribute('aria-label', 'מזעור החלון');
    minBtn.innerHTML = svg('<path d="M5 12h14"/>');

    var closeBtn = el('button', 'yd-head-btn');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'סגירת החלון');
    closeBtn.innerHTML = svg('<path d="M18 6L6 18"/><path d="M6 6l12 12"/>');

    head.appendChild(headFace);
    head.appendChild(headTxt);
    head.appendChild(minBtn);
    head.appendChild(closeBtn);

    var log = el('div', 'yd-log');
    log.id = 'yd-log';
    log.setAttribute('role', 'log');
    log.setAttribute('aria-live', 'polite');
    log.setAttribute('aria-relevant', 'additions text');
    log.setAttribute('aria-label', 'השיחה עם יוחנן הדיגיטלי');
    log.tabIndex = 0;

    var quick = el('div', 'yd-quick');
    quick.setAttribute('aria-label', 'שאלות מהירות');

    var form = el('form', 'yd-form');
    form.setAttribute('novalidate', '');
    var input = el('textarea', 'yd-input');
    input.id = 'yd-input';
    input.rows = 1;
    input.maxLength = MAX_CHARS;
    input.placeholder = 'כתבו כאן שאלה על הקורס…';
    input.setAttribute('aria-label', 'השאלה שלכם');
    var send = el('button', 'yd-send');
    send.type = 'submit';
    send.disabled = true;
    send.setAttribute('aria-label', 'שליחת השאלה');
    send.innerHTML = svg('<path d="M20 12H5"/><path d="M12 19l-7-7 7-7"/>');
    form.appendChild(input);
    form.appendChild(send);

    var note = el('p', 'yd-note',
      'יוחנן הדיגיטלי הוא עוזר AI, לא יוחנן עצמו. התשובות מבוססות על המידע שבעמוד הקורס.');

    panel.appendChild(head);
    panel.appendChild(log);
    panel.appendChild(quick);
    panel.appendChild(form);
    panel.appendChild(note);

    root.appendChild(invite);
    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    return {
      root: root, invite: invite, inviteBtn: inviteBtn, inviteClose: inviteClose,
      launcher: launcher, panel: panel, log: log, quick: quick,
      form: form, input: input, send: send, minBtn: minBtn, closeBtn: closeBtn
    };
  }

  function init() {
    if (document.querySelector('[data-yd-root]')) return;

    var ui = build();
    var thread = [];      // [{role:'user'|'assistant', content:string}]
    var open = false;
    var pending = false;
    var typingNode = null;

    /* ── הודעות ─────────────────────────────────────────── */

    function scrollDown() {
      ui.log.scrollTop = ui.log.scrollHeight;
    }

    function addMessage(role, text, opts) {
      opts = opts || {};
      var cls = role === 'user' ? 'yd-msg yd-msg-me'
              : (opts.error ? 'yd-msg yd-msg-err' : 'yd-msg yd-msg-bot');
      var node = el('div', cls, text);
      if (role !== 'user') node.setAttribute('dir', 'auto');
      ui.log.appendChild(node);
      scrollDown();
      return node;
    }

    function addBuyAction() {
      var target = document.getElementById(BUY_ANCHOR);
      if (!target) return;
      var btn = el('button', 'yd-act');
      btn.type = 'button';
      btn.textContent = 'אני רוצה להתחיל ללמוד ←';
      btn.addEventListener('click', function () {
        track('bot_click_buy', { cta_location: 'course_bot' });
        // מפנה לאזור הרכישה הקיים בעמוד. אין כאן תהליך רכישה חדש.
        if (isMobile()) closePanel();
        target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
        var terms = document.getElementById('terms-accept');
        if (terms) window.setTimeout(function () { terms.focus(); }, reducedMotion() ? 0 : 480);
      });
      ui.log.appendChild(btn);
      scrollDown();
    }

    function addWhatsappAction() {
      var a = el('a', 'yd-act yd-act-wa');
      a.href = WHATSAPP_URL + '?text=' + encodeURIComponent(WHATSAPP_TEXT);
      a.target = '_blank';
      a.rel = 'noopener';
      a.innerHTML = svg('<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5.2A8.5 8.5 0 1 1 21 11.5z"/>') +
                    'לשאול בוואטסאפ';
      a.addEventListener('click', function () {
        track('bot_click_whatsapp', { cta_location: 'course_bot' });
      });
      ui.log.appendChild(a);
      scrollDown();
    }

    function showTyping() {
      typingNode = el('div', 'yd-typing');
      typingNode.setAttribute('aria-label', 'יוחנן הדיגיטלי מקליד תשובה');
      typingNode.innerHTML = '<i></i><i></i><i></i>';
      ui.log.appendChild(typingNode);
      scrollDown();
    }

    function hideTyping() {
      if (typingNode && typingNode.parentNode) typingNode.parentNode.removeChild(typingNode);
      typingNode = null;
    }

    /* ── שאלות מהירות ───────────────────────────────────── */

    function renderQuick() {
      ui.quick.innerHTML = '';
      QUICK.forEach(function (q) {
        var b = el('button', null, q);
        b.type = 'button';
        b.addEventListener('click', function () {
          track('bot_quick_question', { question_index: QUICK.indexOf(q) + 1 });
          submit(q);
        });
        ui.quick.appendChild(b);
      });
      ui.quick.hidden = false;
    }

    /* ── שמירת השיחה לביקור הנוכחי ──────────────────────── */

    function saveThread() {
      try {
        store(STORE_THREAD, JSON.stringify(thread.slice(-HISTORY_TURNS * 2)));
      } catch (e) {}
    }

    function restoreThread() {
      var raw = store(STORE_THREAD);
      if (!raw) return false;
      var saved;
      try { saved = JSON.parse(raw); } catch (e) { return false; }
      if (!Array.isArray(saved) || !saved.length) return false;

      saved.forEach(function (m) {
        if (!m || (m.role !== 'user' && m.role !== 'assistant')) return;
        if (typeof m.content !== 'string' || !m.content) return;
        thread.push({ role: m.role, content: m.content });
        addMessage(m.role, m.content);
      });
      return thread.length > 0;
    }

    /* ── שליחה ──────────────────────────────────────────── */

    function couponApplied() {
      var field = document.getElementById('coupon-input');
      return !!(field && field.disabled);
    }

    function submit(text) {
      if (pending) return;
      text = String(text || '').trim().slice(0, MAX_CHARS);
      if (!text) return;

      ui.quick.hidden = true;
      addMessage('user', text);
      thread.push({ role: 'user', content: text });
      saveThread();

      ui.input.value = '';
      autoGrow();
      syncSend();

      pending = true;
      ui.send.disabled = true;
      showTyping();
      track('bot_send_message', { message_length_bucket: text.length > 120 ? 'long' : 'short' });

      var payload = {
        message: text,
        history: thread.slice(0, -1).slice(-HISTORY_TURNS),
        couponApplied: couponApplied()
      };

      window.fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; })
            .then(function (data) { return { status: res.status, data: data }; });
        })
        .then(function (out) {
          hideTyping();

          if (out.status === 429) {
            addMessage('assistant', 'שאלתם הרבה שאלות ברצף. אפשר להמתין רגע ולנסות שוב, או לכתוב ליוחנן ישירות בוואטסאפ.', { error: true });
            addWhatsappAction();
            return;
          }

          if (out.status !== 200 || !out.data || !out.data.reply) {
            // כולל את המצב שבו שירות הבוט לא מוגדר או לא זמין.
            addMessage('assistant', FALLBACK_TEXT, { error: true });
            addWhatsappAction();
            return;
          }

          var reply = String(out.data.reply);
          addMessage('assistant', reply);
          thread.push({ role: 'assistant', content: reply });
          saveThread();

          if (out.data.cta === 'buy') addBuyAction();
          else if (out.data.cta === 'whatsapp') addWhatsappAction();
        })
        .catch(function () {
          hideTyping();
          addMessage('assistant', 'משהו השתבש בחיבור. אפשר לנסות שוב עוד רגע, או לכתוב ליוחנן בוואטסאפ.', { error: true });
          addWhatsappAction();
        })
        .then(function () {
          pending = false;
          syncSend();
          if (open && !isMobile()) ui.input.focus();
        });
    }

    /* ── שדה הכתיבה ─────────────────────────────────────── */

    function autoGrow() {
      ui.input.style.height = 'auto';
      ui.input.style.height = Math.min(ui.input.scrollHeight, 110) + 'px';
    }

    function syncSend() {
      ui.send.disabled = pending || !ui.input.value.trim();
    }

    ui.input.addEventListener('input', function () { autoGrow(); syncSend(); });

    // Enter שולח, Shift+Enter יורד שורה. במובייל תמיד יורד שורה,
    // כדי שלא תישלח שאלה חצי כתובה בלחיצה על מקש האישור.
    ui.input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      if (isMobile()) return;
      e.preventDefault();
      submit(ui.input.value);
    });

    ui.form.addEventListener('submit', function (e) {
      e.preventDefault();
      submit(ui.input.value);
    });

    /* ── פתיחה, מזעור וסגירה ────────────────────────────── */

    // במסך מלא במובייל החלון מתנהג כדיאלוג מודאלי: הרקע לא נגלל
    // והמיקוד לכוד בפנים. בדסקטופ הוא אינו מודאלי, והגולש חופשי
    // להמשיך לגלוש בעמוד בזמן שהוא פתוח.
    function setFullScreen(on) {
      ui.root.classList.toggle('is-full', on);
      document.body.classList.toggle('yd-locked', on);
      if (on) ui.panel.setAttribute('aria-modal', 'true');
      else ui.panel.removeAttribute('aria-modal');
    }

    function openPanel() {
      if (open) return;
      open = true;
      hideInvite(true);

      ui.panel.hidden = false;
      ui.launcher.setAttribute('aria-expanded', 'true');
      ui.launcher.setAttribute('aria-label', 'מזעור הצ׳אט עם יוחנן הדיגיטלי');

      setFullScreen(isMobile());

      if (!ui.log.childNodes.length) {
        if (!restoreThread()) {
          addMessage('assistant', GREETING);
          renderQuick();
        }
      }
      scrollDown();

      track('bot_open', { page: 'course-digital' });

      // במובייל לא ממקדים את השדה מיד, כדי שהמקלדת לא תקפוץ ותכסה
      // את השיחה לפני שהגולש הספיק לקרוא אותה.
      window.setTimeout(function () {
        if (isMobile()) ui.panel.querySelector('.yd-head-btn').focus();
        else ui.input.focus();
      }, 30);
    }

    function closePanel(returnFocus) {
      if (!open) return;
      open = false;
      ui.panel.hidden = true;
      setFullScreen(false);
      ui.launcher.setAttribute('aria-expanded', 'false');
      ui.launcher.setAttribute('aria-label', 'פתיחת הצ׳אט עם יוחנן הדיגיטלי, עוזר AI לשאלות על הקורס');
      if (returnFocus !== false) ui.launcher.focus();
    }

    ui.launcher.addEventListener('click', function () {
      if (open) closePanel();
      else openPanel();
    });
    ui.minBtn.addEventListener('click', function () { closePanel(); });
    ui.closeBtn.addEventListener('click', function () { closePanel(); });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' && e.key !== 'Esc') return;
      if (open) { e.stopPropagation(); closePanel(); }
      else if (!ui.invite.hidden) hideInvite(true);
    });

    // מלכודת מיקוד — רק כשהחלון תופס מסך מלא במובייל. בדסקטופ
    // החלון אינו מודאלי, והגולש חופשי להמשיך לגלוש בעמוד.
    ui.panel.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !open || !ui.root.classList.contains('is-full')) return;
      var focusables = ui.panel.querySelectorAll(
        'button:not(:disabled), textarea, a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    // מעבר בין מובייל לדסקטופ בזמן שהחלון פתוח
    window.addEventListener('resize', function () {
      if (open) setFullScreen(isMobile());
    });

    /* ── בועת ההזמנה ────────────────────────────────────── */

    function hideInvite(remember) {
      ui.invite.hidden = true;
      if (remember) store(STORE_INVITE, '1');
    }

    ui.inviteBtn.addEventListener('click', function () { openPanel(); });
    ui.inviteClose.addEventListener('click', function () { hideInvite(true); });

    function maybeInvite() {
      if (open || store(STORE_INVITE) === '1') return;
      if (document.documentElement.getAttribute('data-consent') === 'undecided') return;
      ui.invite.hidden = false;
      store(STORE_INVITE, '1');   // פעם אחת בביקור, גם אם לא נסגרה ידנית
    }

    // 8 עד 12 שניות, ולא לפני שהגולש הכריע בהודעת העוגיות.
    window.setTimeout(maybeInvite, 8000 + Math.floor(Math.random() * 4000));

    // אם כבר קיימת שיחה מהביקור הזה, אין צורך בהזמנה מחדש.
    if (store(STORE_THREAD)) store(STORE_INVITE, '1');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window, document);
