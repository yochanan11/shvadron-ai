# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static Hebrew (RTL) marketing site for SHWADRON.AI (AI courses for the Haredi public), deployed on Vercel from `main` to `ai.shwadron-ai.com`. Plain HTML/CSS/vanilla JS, no framework and no bundler. A few Vercel serverless functions live in `api/`. Pushing to `main` is a production deploy; the owner reviews changes before they go live.

Products and their pages:
- `index.html`: gateway. States the message ("לא לומדים כלים. לומדים לאמץ אותם.") and splits visitors between the two live Zoom cohorts
- `course-beginners.html`, `course-advanced.html`: live Zoom tracks
- `course.html`: recorded digital course (own inline CSS/JS, does **not** load `courses.css`/`courses.js`)
- `cases.html`, `business.html`: what was built in businesses, and the business offer
- `register.html`: webinar registration. For a webinar that already took place (`RECORDINGS` in `assets/js/register.js`) it becomes a recording page: name + phone open the recording, with the beginners cohort card under it
- `paid.html`: thank-you after paying for a Zoom track (`?track=beginners|advanced` picks date and WhatsApp group), with a "send to a friend" button
- `course-thanks.html`: thank-you after buying the digital course, with the upgrade offer to the advanced track
- `admin-coupons.html`, `admin-leads.html`: password-protected admin pages (password = `ADMIN_PASSWORD` env)
- `terms.html`, `privacy.html`, `cancellation.html`, `accessibility.html`: legal pages; prices and data collection are listed there too

## Commands

```bash
node tools/build-courses.mjs      # regenerate track content after editing assets/data/courses.mjs
node tools/build-syllabus.mjs     # regenerate syllabus-digital.html (printable A4 syllabus) from the same data
npm start                         # local Express server (server.js) on the repo root, incl. a local /api/chat
python3 -m http.server 8765       # quickest static preview (api/ calls will fail; mock them)
node --check <file.js>            # syntax check; there is no test suite or linter
```

Chromium + Playwright are available for visual/regression checks (`require('/opt/node-tools/node_modules/playwright')`); check pages at 390px and 1280px, with and without JavaScript.

## Site rules (owner's brief, November 2026)

The site sells the two cohorts. Every page does one thing: gets people into a cohort.

- One primary button per page, always the same verb: "לשריין מקום". **It leads to the lead form, not to the checkout** (owner's decision, 11.11.2026: on the page people leave details and the saleswoman closes; paying is an option, not the main path). It repeats in the header, the hero, the cohort cards, the offer and the sticky bottom bar (`.dock`). The form's title follows the button (`data-intent="reserve"`, `data-track`): "שריון מקום במאפס למאה".
- Payment stays available as an option: a text link next to the price in the offer, a line under the form, and a button shown after the details were sent ("רוצים לסגור כבר עכשיו?"). These are the only links to Morning on the track pages, and they keep `data-join` so coupons can swap them.
- The other way into the same form: "מתלבטים? נחזור אליכם" (header on desktop, links in the page). Name + phone only, no email. The lead carries the page and the button that led to the form (`data-cta`, see `assets/js/callback.js`), so a "reserve" lead and a "hesitating" lead can be told apart.
- One WhatsApp link site-wide: same number, same prepared text (`WHATSAPP` in the data file). Write `<a data-wa href="#">` and the build fills it in. Functional links on thank-you pages (group join, share, upgrade) are the only exceptions.
- No free webinar, no live broadcast and no digital course as a separate track on the two sales pages. Those are exits from the purchase.
- Objections come from the leads sheet, most frequent first. `REASSURE` in the data file holds the answers to the three most common ones (recordings, full refund, Hebrew and filtered internet): only those appear in the hero and by the button in the cohort cards. Everything else is in `FAQ` in the same file, in the sheet's order, and the build generates the questions block of the home page and the two track pages from it (`on:` picks the pages). Three answers are deliberately left out until the owner confirms them: participants of all ages, a one-on-one consulting product, and "one hour a week pays for the course".
- Whoever calls back is the saleswoman, so the copy says "נחזור אליכם עוד היום", not "יוחנן יחזור אליכם".
- Always "יותר מ-1,500 בוגרים", never a bare "1,500".
- No date that has passed anywhere on the site. `[data-closes]` + `[data-closing]` hide deadline text after its date (`assets/js/source.js`).
- Look: `assets/css/shw-modern.css` is the 2026 layer, loaded last on every page (after `brand-ads.css`). Same branding, newer language: depth instead of the paper texture and the wave, soft rounded surfaces, glass chips on the blue, chat bubbles for the employers' messages (`.grid.chat`), a floating bottom bar on phones. It holds appearance only, no content.
- Design: blue `#3B5BA5`, teal `#65B8AB`, white; Rubik (self-hosted in `assets/fonts`, because content filters block Google Fonts); mobile first; no women in images, faces and names blurred in Zoom screenshots; conservative tone, no fear clichés and no military metaphors beyond the track name.

## Syllabus PDFs

The two Zoom tracks link to branded PDF syllabi in `assets/public/syllabus/` (`syllabus-beginners.pdf`, `syllabus-advanced.pdf`), built in the owner's `my-agents` repo (`menahel-status/content/מודעות/*-syllabus.build.py`) in the SHWADRON.AI ad branding. The old `syllabus-beginners.html`/`syllabus-advanced.html` URLs redirect to them (vercel.json). When the syllabus in `courses.mjs` changes, rebuild the PDFs there and copy them here. `.vercelignore` drops every `*.pdf`; the syllabus folder is exempted at the end of that file, so keep that exception or the links return 404.

## Single source of truth for the Zoom tracks

`assets/data/courses.mjs` holds prices (`priceEx`, before VAT), VAT rate, start dates, Hebrew dates, syllabus (with a deliverable per session), the home-page cohort cards, org logos, webinar config, no-class ranges (`NO_CLASSES`, e.g. Chanukah), and the cohort block: `COHORT` (name, registration closing date), `seatsLeft` per track, `WHATSAPP`, `GIFT`. `tools/build-courses.mjs` injects generated markup between `<!-- BUILD:name -->` … `<!-- /BUILD:name -->` markers in `index.html`, the two track pages and (webinar only) `course.html`. Never hand-edit inside BUILD markers; edit the data file and rebuild. Session dates are derived weekly from `start`, skipping `NO_CLASSES`.

Seats left: `seatsLeft` on each track is the only number to update (`null` shows no number at all). After a rebuild it appears in the sticky top bar, the hero deadline line, the cohort cards and the offer. The home page, which speaks about both cohorts, shows the sum, and only when both numbers are set. There is no timer and no number that was not typed into the data file. Outside BUILD markers, `<b data-seats="beginners|advanced|all" hidden></b>` is filled by the build the same way.

The build also writes the priced state straight into the HTML (`staticPrice`): `[data-has-price]`/`[data-no-price]` visibility and the `.js-price*` amounts, so crawlers and no-JS visitors see real prices. Text outside BUILD markers (hero copy, FAQs, `api/chat.js` prompt, `REQUIREMENTS.md`, `terms.html`) is hand-written and must be updated separately when prices or dates change; grep for old values.

Display rule: the VAT-inclusive total is the main price everywhere; the pre-VAT figure appears only in breakdowns.

**One deliberate exception, approved by the owner:** on `business.html` the exposure
lecture is shown as `2,500 ₪ + מע״מ`, pre-VAT, because that is what a business buyer
expects to compare. Do not "fix" it to the VAT-inclusive figure. That price is
hand-written (not generated), and 2,500 + VAT currently equals the advanced track's
price exactly, which the copy on that page leans on without naming the number; if
either price changes, re-check that sentence.

## Pricing, coupons and checkout

- Checkout is external (Morning / "חשבונית ירוקה", `mrng.to/...` links). Each displayed amount must match a Morning link exactly; the site cannot create links. Morning redirects buyers to the thank-you pages.
- `api/coupon.js` validates a code against coupons stored in Vercel KV (key `coupons`, edited via `admin-coupons.html` / `api/admin-coupons.js`). A coupon is `{code, type: total|fixed|percent, value, page, checkoutUrl, until?}`; `value` is the VAT-inclusive amount for `total`, the pre-VAT price for `fixed`, a discount percent for `percent`; `page` is `course-beginners`, `course-advanced` or `course-digital`. The API computes the total (rounded up to 10 agorot), refuses a coupon that is not cheaper than the page's regular price, and returns the coupon's own `checkoutUrl`. `PAGE_PRICES`/`REGULAR_PRICE` there must match the data file / `course.html`.
- `assets/js/courses.js` (track pages) applies coupons, swaps checkout links, and runs two automatic offers that both validate via `/api/coupon` before showing anything:
  - early-bird promo: config lives on the `.promo-bar` element (`data-until`, `data-code`); hidden after the date;
  - alumni offer: `/alumni` redirects (vercel.json) to `course-advanced.html?offer=alumni`, which applies the `בוגרים` coupon and suppresses the early-bird promo.
  Discounts never stack: a manual code that would raise the shown price is refused.
- `_kv.js` is a minimal Upstash/Vercel KV REST wrapper (`KV_REST_API_URL`, `KV_REST_API_TOKEN`).

## Other moving parts

- `assets/js/gift.js` + `api/lead.js`: the webinar is gated behind a name/phone form; leads go to KV list `leads` (viewed in `admin-leads.html`). Marketing consent is a separate, unticked checkbox, as the privacy policy requires.
- `assets/js/callback.js`: the "מתלבטים" form (name + phone, generated by `leadForm()` in the build) on the home, course and digital pages, and the richer business form, via `api/lead.js` (`kind: 'callback'`). The page, the button that led to the form and the business "what interests you" choice are appended to the lead's `course` string, so they show in the sheet's "מאיזה דף" column without redeploying the Apps Script. Every lead is also appended to the owner's Google Sheet (tab "לידים מהאתר") through the Apps Script in `tools/leads-sheet.gs`, configured by the Vercel env vars `LEADS_SHEET_URL` and `LEADS_SHEET_SECRET`; without them the sheet step is skipped. The script maps values by header name, so a new column only needs adding to its `HEADERS`. All lead forms take an optional email and, once sent, invite the visitor to the WhatsApp tips group (`TIPS_GROUP` in the data file). A lead counts as saved if KV or the sheet succeeded.
- `assets/js/consent.js`: cookie consent manager; GA4/Clarity load only after consent. Use `SHW.consent.onGrant('statistics', fn)` for anything analytics-related, including browser storage.
- `assets/js/source.js`: first-touch traffic source from `?src=` or `utm_source` (stored only after statistics consent; without consent it is carried from page to page inside internal links) exposed as `SHW_SOURCE()` and attached to forms and GA4 events. Also sends `click_whatsapp`, and hides expired deadline text. Thank-you pages send `reached_thank_you`, not `purchase`: verified purchases come only from Morning's sales report. Tagged links per source are in `UTM.md`.
- `api/chat.js` (Vercel) and `server.js` (local) each carry the same sales-bot `SYSTEM_PROMPT` with prices/dates; keep them in sync.
- Testimonial walls use WhatsApp screenshots in `assets/public/assets/whatsapp-proofs/`. Only use a screenshot on the page of the product it is actually about; blur names/photos before committing (anything committed is publicly served).
- `vercel.json`: function limits, cache headers, and redirects (old page copies such as `index1.html`/`course-access.html` redirect to `/`).

## Content constraints from the owner

- Do not change prices, dates, coupons or purchase terms without explicit approval; check Morning amounts before publishing price changes.
- The advanced track must not promise a finished working system. Approved project wording: "לאורך הקורס תתכננו ותבנו פרויקט AI אישי, עם תרגול והכוונה, ותלמדו איך לבדוק, לשפר ולהמשיך לפתח אותו בעצמכם." It is training, not personal implementation.
- Beginners is not a prerequisite for advanced; present them as two tracks with different goals.
- Never invent testimonials, names, numbers or results.
