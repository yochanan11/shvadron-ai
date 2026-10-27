# קישורים מתויגים לפי מקור תנועה

כל קישור שמפרסמים מקבל `utm_source` לפי המקור. Google Analytics קורא את זה לבד,
והאתר שומר את המקור (רק אחרי הסכמה לעוגיות סטטיסטיקה) כדי לצרף אותו לאירועי
הלחיצה על הרשמה ולהגעה לדף התודה.

| מקור | פרמטר להוסיף לסוף הקישור |
|---|---|
| קהילת הוואטסאפ | `?utm_source=whatsapp_community` |
| סטטוס | `?utm_source=status` |
| קבוצות התוכן בוואטסאפ | `?utm_source=groups` |
| הודעה אישית בפרטי | `?utm_source=private` |
| מייל | `?utm_source=email` |
| בוגרי הקורסים | `?utm_source=alumni` (הקישור /alumni כבר כולל אותו) |
| שיתוף פעולה | `?utm_source=partner&utm_campaign=<שם השותף>` |
| וובינר | `?utm_source=webinar&utm_campaign=<שם או תאריך הוובינר>` |

דוגמה: `https://ai.shwadron-ai.com/course-advanced.html?utm_source=status`

בדף ההרשמה לוובינר מוסיפים עם `&` אחרי ה-`for`:
`https://ai.shwadron-ai.com/register.html?for=claude-code&utm_source=status`
בגיליון הלידים העמודה "מקור הגעה" מציגה את השם בעברית (SOURCES ב-`tools/leads-sheet.gs`),
והעמודה "וובינר" את הוובינר שנרשמו אליו. קישור בלי תיוג נרשם כ"ישיר".

## מה נמדד
- `select_course_track`: בחירת מסלול בדף הבית
- `click_join_cohort` / `click_buy_course` + `begin_checkout`: לחיצה על הרשמה או תשלום
- `generate_lead`: מילוי טופס הוובינר
- `reached_thank_you`: הגעה לדף התודה. **זו לא רכישה מאומתת.**

לכל אירוע מצורף `traffic_source`.

## רכישות מאומתות
נספרות רק לפי דוח המכירות במורנינג. השוואה שבועית בין מספר המכירות במורנינג
לבין `reached_thank_you` לפי מקור נותנת תמונה של איזה מקור מביא קונים.
