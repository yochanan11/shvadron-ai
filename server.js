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

const SYSTEM_PROMPT = `אתה עוזר מכירות של יוחנן שבדרון, מרצה לקורס AI מעשי לציבור החרדי.
הקורס: 4 מפגשים בזום, תרגול חי, תוצאות ביד. לומדים ChatGPT, Claude, Gemini ובונים סוכן AI אישי.

המטרה שלך בשיחה: לברר את הכאב של הגולש, להתחבר אליו, ולדחוף לרישום לקורס.

איך לנהל את השיחה:
- שאל שאלה אחת ממוקדת על הקושי שלו: מה לוקח לו הכי הרבה זמן? מה הוא עדיין עושה ידנית?
- הקשב לתשובה, הכר בכאב, ואז חבר אותו לפתרון שהקורס נותן
- אחרי 2-3 הודעות — הפנה לרישום: "זה בדיוק מה שאנחנו עושים בקורס. כדאי שנדבר — אפשר להירשם ישירות או לשאול את יוחנן בוואטסאפ"
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
