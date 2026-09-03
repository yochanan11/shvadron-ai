/* ============================================================
   SHWADRON.AI — /api/course-bot
   ------------------------------------------------------------
   הצד השרתי של "יוחנן הדיגיטלי", בוט השאלות בעמוד הקורס.

   עקרונות:
   • מפתח ה-API נשאר בשרת בלבד, במשתנה סביבה. הוא לא נשלח ללקוח
     ולא מופיע בשום הודעת שגיאה.
   • הבוט מוגבל למאגר הידע ב-api/_course-kb.js בלבד.
   • הגבלת קצב, הגבלת אורך שאלה והגבלת אורך היסטוריה — כדי שלא
     יהיה אפשר להפוך את הנקודה הזו למודל שפה חינמי לכל דורש.
   • לא נשמר ולא נרשם ללוגים תוכן של שאלות או פרטי גולשים.

   משתני סביבה:
     ANTHROPIC_API_KEY   — חובה. בלעדיו הנקודה מחזירה 503 והבוט
                           בעמוד מציג הודעה ידידותית + מעבר לוואטסאפ.
     COURSE_BOT_MODEL    — רשות. ברירת מחדל claude-opus-5.
     COURSE_BOT_RPM      — רשות. מספר שאלות מותר לכל גולש בחלון
                           של 10 דקות. ברירת מחדל 15.
     KV_REST_API_URL /
     KV_REST_API_TOKEN   — רשות. אם מוגדרים, הגבלת הקצב משותפת לכל
                           המכונות. אחרת נשמרת בזיכרון המכונה בלבד.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { buildSystemPrompt, WHATSAPP_NUMBER } = require('./_course-kb');
const { kvRequest } = require('./_kv');

// טעינת .env בפיתוח מקומי. ב-Vercel המשתנים מוזרקים אוטומטית.
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k] = v.join('=');
  });
}

/* ── מגבלות ───────────────────────────────────────────────── */
const MAX_MESSAGE_CHARS = 500;   // אורך שאלה בודדת
const MAX_HISTORY_TURNS = 12;    // הודעות קודמות שנשלחות למודל
const MAX_HISTORY_CHARS = 1200;  // אורך הודעה בהיסטוריה
const RATE_WINDOW_SEC   = 600;   // חלון הגבלת הקצב, 10 דקות
const MAX_TOKENS        = 700;   // תשובות קצרות. די והותר.

const ALLOWED_HOSTS = [
  'shwadron-ai.com',
  'www.shwadron-ai.com',
  'ai.shwadron-ai.com',
  'localhost',
  '127.0.0.1'
];

/* ── עזרים ────────────────────────────────────────────────── */

// מנקה קלט: מסיר תווי בקרה, מכווץ רווחים וחותך לאורך המותר.
function clean(value, maxChars) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]{3,}/g, '  ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxChars);
}

// האם המקור מורשה. בקשה בלי Origin (same-origin ברוב הדפדפנים,
// וגם curl) מותרת — ההגנה האמיתית כאן היא הגבלת הקצב.
function originAllowed(origin) {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return ALLOWED_HOSTS.some(h => host === h || host.endsWith('.vercel.app'));
  } catch (e) {
    return false;
  }
}

// מזהה גולש להגבלת קצב. ה-IP עובר גיבוב חד-כיווני ולא נשמר כפי שהוא,
// כדי שלא יישמר מידע מזהה במאגר.
function visitorKey(req) {
  const fwd = req.headers['x-forwarded-for'] || '';
  const ip = String(fwd).split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  const salt = process.env.ANTHROPIC_API_KEY || 'shw';
  return crypto.createHash('sha256').update(ip + '|' + salt).digest('hex').slice(0, 32);
}

// גיבוי בזיכרון כשאין KV. תקף למכונה אחת בלבד, וזה מספיק כדי
// לעצור לולאת בקשות מאותו דפדפן.
const memoryHits = new Map();

async function overRateLimit(key) {
  const limit = Number(process.env.COURSE_BOT_RPM) || 15;
  const kvKey = 'coursebot:rl:' + key;

  try {
    const res = await kvRequest(['INCR', kvKey]);
    const count = res && typeof res.result === 'number' ? res.result : null;
    if (count !== null) {
      if (count === 1) await kvRequest(['EXPIRE', kvKey, String(RATE_WINDOW_SEC)]);
      return count > limit;
    }
  } catch (e) {
    // אין KV מוגדר, או שהוא לא זמין. ממשיכים לגיבוי בזיכרון.
  }

  const now = Date.now();
  const entry = memoryHits.get(key);
  if (!entry || now > entry.resetAt) {
    memoryHits.set(key, { count: 1, resetAt: now + RATE_WINDOW_SEC * 1000 });
    // ניקוי עצל, כדי שהמפה לא תגדל בלי גבול לאורך חיי המכונה.
    if (memoryHits.size > 500) {
      for (const [k, v] of memoryHits) if (now > v.resetAt) memoryHits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/* ── קריאה למודל ──────────────────────────────────────────── */
async function ask(system, messages) {
  const SDK = require('@anthropic-ai/sdk');
  const Anthropic = SDK.default || SDK;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: process.env.COURSE_BOT_MODEL || 'claude-opus-5',
    max_tokens: MAX_TOKENS,
    // תשובות קצרות על מאגר ידע קטן. effort נמוך שומר על זמן תגובה
    // שמתאים לבועת צ׳אט ועל עלות סבירה.
    output_config: { effort: 'low' },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages
  });

  if (response.stop_reason === 'refusal') return null;

  return response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();
}

/* ── הנקודה עצמה ──────────────────────────────────────────── */
module.exports = async (req, res) => {
  const origin = req.headers.origin;

  if (originAllowed(origin) && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method-not-allowed' });
  if (!originAllowed(origin)) return res.status(403).json({ error: 'forbidden' });

  if (!process.env.ANTHROPIC_API_KEY) {
    // הבוט לא מוגדר. הממשק בעמוד יציג הודעה ידידותית ומעבר לוואטסאפ.
    return res.status(503).json({ error: 'bot-unavailable', whatsapp: WHATSAPP_NUMBER });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'bad-request' });
  }

  const message = clean(body.message, MAX_MESSAGE_CHARS);
  if (!message) return res.status(400).json({ error: 'empty-message' });

  try {
    if (await overRateLimit(visitorKey(req))) {
      return res.status(429).json({ error: 'rate-limited' });
    }
  } catch (e) {
    // כשל בהגבלת הקצב לא יפיל את השיחה של גולש אמיתי.
  }

  // ההיסטוריה מגיעה מהלקוח ולכן היא לא אמינה: מסננים לתפקידים
  // חוקיים בלבד, חותכים באורך, ומוודאים שהיא מתחילה בהודעת גולש.
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = [];
  for (const item of rawHistory.slice(-MAX_HISTORY_TURNS)) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant')) continue;
    const content = clean(item.content, MAX_HISTORY_CHARS);
    if (!content) continue;
    if (!history.length && item.role !== 'user') continue;
    history.push({ role: item.role, content });
  }
  if (history.length && history[history.length - 1].role === 'user') history.pop();

  const system = buildSystemPrompt({ couponApplied: body.couponApplied === true });

  // הודעת הגולש עטופה בתגית, כדי שהמודל יראה בבירור היכן מתחיל
  // ונגמר קלט חיצוני ולא יתייחס אליו כאל הוראה מהמערכת.
  const messages = history.concat([{
    role: 'user',
    content: '<שאלת_גולש>\n' + message + '\n</שאלת_גולש>'
  }]);

  try {
    const reply = await ask(system, messages);
    if (!reply) {
      return res.json({
        reply: 'על זה אני לא רוצה לנחש. אפשר לשאול את יוחנן ישירות בוואטסאפ.',
        cta: 'whatsapp'
      });
    }

    // התגית שהמודל מוסיף בסוף ההודעה הופכת לכפתור בממשק, ומוסרת מהטקסט.
    let cta = null;
    let text = reply.replace(/\[\[CTA:(BUY|WHATSAPP)\]\]/gi, (m, kind) => {
      cta = kind.toLowerCase();
      return '';
    }).trim();

    if (!text) {
      text = 'על זה אני לא רוצה לנחש. אפשר לשאול את יוחנן ישירות בוואטסאפ.';
      cta = 'whatsapp';
    }

    return res.json({ reply: text, cta });
  } catch (err) {
    // ללוגים נכנס רק סוג התקלה. לא תוכן השאלה, לא פרטי הגולש.
    console.error('course-bot failed:', err && err.status ? 'status ' + err.status : 'network');
    return res.status(502).json({ error: 'upstream-error' });
  }
};
