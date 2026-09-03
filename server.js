const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');

// Load .env locally (on Render, env vars are injected automatically)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [k, ...v] = line.trim().split('=');
    if (k && v.length) process.env[k] = v.join('=');
  });
}

const API_KEY = process.env.ANTHROPIC_API_KEY;
const IS_LOCAL = process.env.NODE_ENV !== 'production';
console.log('API key loaded:', API_KEY ? API_KEY.slice(0, 20) + '...' : 'MISSING');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const SYSTEM_PROMPT = `אתה עוזר מכירות של יוחנן שבדרון, מרצה לקורסי AI מעשיים לציבור החרדי.
כבר למדו אצלו 1,500 בוגרים ב-30 מחזורים.
יש שני מסלולים חיים בזום, שעתיים בכל מפגש, עם הקלטות וקבוצת ליווי. הם שני שלבים של אותו מסע, לא שני קורסים נפרדים:
1) AI למתחילים, 3 מפגשים (6 שעות), נפתח יום שני א׳ בחשוון, 12 באוקטובר, פעם בשבוע 19:30-21:30, 750 ₪ + מע״מ (סה״כ 885 ₪): לעבוד נכון עם AI ולהוציא ממנו תוצרים מקצועיים. ChatGPT ו-Gemini, 7 הכללים לכתיבת פרומפט, עבודה באיטרציות, NotebookLM ומקורות, הפיכת פגישה לסיכום החלטות משימות מסמך ומייל, ובניית מצגות מקצועיות. למי שמשתמש ב-AI אבל לא מרגיש ששולט בו.
2) AI למתקדמים, 9 מפגשים (18 שעות), נפתח יום רביעי ג׳ בחשוון, 14 באוקטובר, פעם בשבוע 19:30-21:30, 3,750 ₪ + מע״מ (סה״כ 4,425 ₪): לבנות באמצעות AI. שלושה תחומים: סוכני AI ו-Projects, אוטומציות עם Make (Forms, Google Sheets, Gmail, Google Calendar, Webhooks), ובניית תוכנות עם Claude Code ו-Codex ללא כתיבת קוד. בסיום כל תלמיד בונה פרויקט אישי. לא נדרש ידע בתכנות.
ייתכנו שינויים במועדים ובשעות. ההרשמה נעשית בוואטסאפ ישירות מול יוחנן. אל תמציא הנחות, מבצעים, שעות או תאריכים אחרים מאלה שכתובים כאן.

המטרה שלך בשיחה: לברר את הכאב של הגולש, להתחבר אליו, ולדחוף לרישום לקורס.

איך לנהל את השיחה:
- שאל שאלה אחת ממוקדת על הקושי שלו: מה לוקח לו הכי הרבה זמן? מה הוא עדיין עושה ידנית?
- הקשב לתשובה, הכר בכאב, ואז חבר אותו לפתרון שהקורס נותן
- אחרי 2-3 הודעות — הפנה לרישום: "זה בדיוק מה שאנחנו עושים בקורס. כדאי שנדבר — אפשר לכתוב ליוחנן בוואטסאפ ולשריין מקום במחזור הקרוב"
- אם לא ברור לו איזה מסלול מתאים, שאל אם הוא כבר עובד עם AI היום: מי שעדיין לא שולט בכלי, מתאים למתחילים. מי שכבר עובד איתו ורוצה לבנות, למתקדמים.
- אל תתן הרצאות. שאל, הקשב, חבר.

ענה בעברית, קצר, חם, ישיר. אל תספר על הקורס אלא אם שאלו — קודם תבין מה הכאב.
הקהל: אנשים דתיים ומסורתיים, בעלי עסקים, אנשי משרד, מקצועות חופשיים.`;

function callClaude(messages) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages,
    });
    const req = https.request({
      host: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      rejectUnauthorized: !IS_LOCAL, // false only locally (behind inspection proxy)
      headers: {
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          resolve(parsed.content[0].text);
        } catch (e) {
          reject(new Error('Invalid response from API'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  const messages = (history || []).map(m => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: message });

  try {
    const reply = await callClaude(messages);
    res.json({ reply });
  } catch (err) {
    console.error('Claude error:', err.message);
    res.status(500).json({ error: 'שגיאה בחיבור ל-AI' });
  }
});

// Local dev
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

module.exports = app;
