#!/usr/bin/env node
/**
 * Fills the business details into every legal / marketing page.
 *
 *   node tools/fill-business-details.mjs
 *
 * Reads tools/business-details.json and replaces each yellow
 * <span class="todo">למילוי: ...</span> marker with the real value.
 *
 * Safe to re-run: a value that is already filled in stays as it is, and a
 * field left empty in the JSON keeps its yellow marker so it stays visible
 * as outstanding. Nothing is deleted.
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(root, 'tools/business-details.json'), 'utf8'));

// Each marker text maps to the config field that replaces it.
const MAP = [
  ['למילוי: השם המשפטי המלא של בעל העסק, כפי שרשום ברשויות', 'legalName'],
  ['למילוי: השם המשפטי המלא של בעל העסק',                    'legalName'],
  ['למילוי: שם משפטי מלא',                                    'legalName'],
  ['למילוי: מספר עוסק מורשה או מספר חברה',                    'businessNumber'],
  ['למילוי: מספר',                                            'businessNumber'],
  ['למילוי: כתובת דואר מלאה, כולל רחוב, מספר, עיר ומיקוד',    'address'],
  ['למילוי: כתובת דואר מלאה',                                 'address'],
  ['למילוי: כתובת',                                           'address'],
  ['למילוי: כתובת הדוא״ל לפניות נגישות',                      'accessibilityEmail'],
  ['למילוי: כתובת הדוא״ל הרשמית של העסק',                     'email'],
  ['למילוי: כתובת הדוא״ל הרשמית',                             'email'],
  ['למילוי: דוא״ל',                                           'email'],
  ['למילוי: שם רכז הנגישות, לרוב בעל העסק',                   'accessibilityOfficer'],
  ['למילוי: שעות המענה בפועל, לדוגמה: ימים א׳-ה׳, 09:00-17:00','serviceHours'],
  ['למילוי: שעות המענה בפועל',                                'serviceHours'],
  ['למילוי: שעות המענה',                                      'serviceHours'],
  ['למילוי',                                                  'serviceHours'],
  ['למילוי: מחוז השיפוט, למשל ירושלים או תל אביב',            'jurisdiction'],
  ['למילוי: תאריך יעד להוספת כתוביות, לדוגמה עד 31 בדצמבר 2026', 'captionsTargetDate'],
  ['למילוי: תאריך יעד לביצוע בדיקת קורא מסך',                 'screenReaderTestTargetDate']
];

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const files = readdirSync(root).filter(f => f.endsWith('.html'));
let totalFilled = 0, totalLeft = 0;

for (const file of files) {
  const path = join(root, file);
  let html = readFileSync(path, 'utf8');
  const before = html;
  let filled = 0;

  for (const [marker, field] of MAP) {
    const value = (cfg[field] || '').trim();
    if (!value) continue;                       // leave the marker visible
    // Replace the whole yellow span, marker text and all.
    const re = new RegExp(`<span class="todo">${esc(marker)}</span>`, 'g');
    const hits = html.match(re);
    if (hits) { html = html.replace(re, value); filled += hits.length; }
  }

  const left = (html.match(/class="todo"/g) || []).length;
  totalFilled += filled;
  totalLeft += left;

  if (html !== before) {
    writeFileSync(path, html, 'utf8');
    console.log(`${file.padEnd(24)} filled ${String(filled).padStart(2)}   still open: ${left}`);
  } else if (left) {
    console.log(`${file.padEnd(24)} filled  0   still open: ${left}`);
  }
}

console.log(`\nTotal filled: ${totalFilled}. Still marked for filling: ${totalLeft}.`);
if (totalLeft) {
  const missing = Object.entries(cfg)
    .filter(([k, v]) => !k.startsWith('_') && !String(v).trim())
    .map(([k]) => k);
  if (missing.length) console.log(`Empty fields in business-details.json: ${missing.join(', ')}`);
}
