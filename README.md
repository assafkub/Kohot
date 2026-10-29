# כוחות ⚽

אפליקציה לחלוקת כוחות בכדורגל השכונתי: מסמנים מי מגיע, לוחצים פעם אחת, ומקבלים קבוצות מאוזנות לפי רמה (1–7, כולל חצאים) ותפקידים (שוער, בלם, מגן, אמצע, חלוץ). כל לחיצה על "ערבוב מחדש" נותנת חלוקה אחרת, מאוזנת באותה מידה.

## מה יש בפנים

- **הוספת שחקנים מהירה**: כותבים שם (אפשר גם "דני 5.5") ולוחצים Enter.
- **הדבקת רשימה מהוואטסאפ**: מדביקים את רשימת המגיעים (גם הודעת כוחות קודמת). "שולם", סוגריים, כותרות ולינקים (כמו פייבוקס) מסוננים, "חדפ" נשמר בשם. שחקנים מוכרים מסומנים אוטומטית וחדשים נוספים.
- **חלוקה מאוזנת**: מאזנת סכום רמות, פיזור חזקים/חלשים ותפקידים (שוער לכל קבוצה כשיש מספיק), לשלוש קבוצות (שחורים, כחולים, לבנים) של 7 (או 6 כשחסרים שחקנים).
- **שלוש הקבוצות זו לצד זו** בשלוש עמודות, גם כשהטלפון מוחזק רגיל.
- **החלפות ידניות**: לחיצה ארוכה על שחקן וגרירה על שחקן מקבוצה אחרת מחליפה ביניהם (גודל הקבוצות לא משתנה), או לוחצים על שניהם.
- **שיתוף** לוואטסאפ, **שמירת משחקים** והיסטוריה.
- **חבורות ותפקידים**: מתחברים עם Google. שלושה תפקידים, שנאכפים במסד הנתונים (RLS):
  - **מנהל מערכת**: רואה את כל החבורות, היחיד שיוצר חבורות וממנה או מוריד מנהלים.
  - **מנהל חבורה**: שחקנים, רמות, כוחות והיסטוריה בחבורה שלו, קוד הצטרפות (כולל יצירת קוד חדש) והוצאת שחקנים.
  - **שחקן**: מצטרף עם קוד ורואה רק כוחות שפורסמו (שמות וצבעים, בלי רמות).
- **פרסום לשחקנים**: מהשיתוף במסך היום או מההיסטוריה. משחק שפורסם ונערך מתעדכן גם אצל השחקנים.
- מותאם לנייד, עברית מימין לשמאל, ואפשר להוסיף למסך הבית.

## הרצה מקומית

```bash
npm install
npm run dev
```

בלי משתני Supabase האפליקציה עובדת **במצב הדגמה**: בלי התחברות, והנתונים נשמרים רק בדפדפן. נוח לנסות לפני ההגדרה.

## חיבור Supabase והתחברות עם Google

1. **פרויקט Supabase**: צרו פרויקט ב-[supabase.com](https://supabase.com).
2. **מסד הנתונים**: ב-SQL Editor הריצו לפי הסדר את הקבצים שב-`supabase/migrations` (או `supabase db push` עם ה-CLI).
   אחר כך הפכו את עצמכם למנהל מערכת (עם המייל של Google):
   `insert into public.super_admins (user_id) select id from auth.users where email = 'you@example.com';`
3. **מפתחות**: ב-Project Settings → API העתיקו את ה-URL ואת ה-anon / publishable key לקובץ `.env.local` (ראו `.env.example`).
4. **Google OAuth**:
   - ב-[Google Cloud Console](https://console.cloud.google.com/apis/credentials) צרו OAuth Client ID מסוג Web application.
   - ב-Authorized redirect URIs הוסיפו את `https://<project-ref>.supabase.co/auth/v1/callback` (מופיע ב-Supabase תחת Authentication → Providers → Google).
   - ב-Supabase: Authentication → Providers → Google, הפעילו והדביקו Client ID ו-Client Secret.
5. **כתובות מותרות**: ב-Supabase תחת Authentication → URL Configuration:
   - Site URL: כתובת האתר ב-Vercel (למשל `https://kohot.vercel.app`).
   - Redirect URLs: הוסיפו `http://localhost:3000` ואת כתובת Vercel.

## העלאה ל-Vercel

1. ב-Vercel: Add New → Project → בחרו את ה-repo הזה.
2. הוסיפו Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. אחרי שיש כתובת, עדכנו אותה ב-Supabase (שלב 5 למעלה).

## בוט טלגרם

מנהל חבורה מדביק לבוט את רשימת המגיעים (כמו בוואטסאפ) ומקבל 3 חלוקות מאוזנות שונות, בטקסט בעמודות (שמות בלבד). עובד בתוכנית החינמית של Vercel.

1. **Supabase**: הריצו את `supabase/migrations/20261029140000_telegram.sql` ב-SQL Editor.
2. **Vercel → Settings → Environment Variables** (ואחר כך Redeploy):
   - `TELEGRAM_BOT_TOKEN` – הטוקן מ-BotFather.
   - `TELEGRAM_WEBHOOK_SECRET` – מחרוזת אקראית ארוכה (אותיות באנגלית, ספרות, `_`, `-`).
   - `SUPABASE_SERVICE_ROLE_KEY` – מ-Supabase → Project Settings → API (service_role / secret). רק בשרת, אף פעם לא עם `NEXT_PUBLIC_`.
   - `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` (לא חובה) – שם הבוט בלי @, כדי שהקוד בהגדרות ייפתח ישר בבוט.
3. **חיבור הבוט לאתר**: פתחו פעם אחת בדפדפן `https://<האתר>/api/telegram/setup?secret=<TELEGRAM_WEBHOOK_SECRET>`. אמור לחזור `"ok": true`.
4. **קישור מנהל**: באפליקציה, הגדרות → בוט טלגרם → קבלת קוד חיבור, ושולחים לבוט `/link <קוד>`. הבוט עונה רק למנהלים מקושרים, בצ'אט פרטי.

## מבנה

- `src/lib/balance.ts` – אלגוריתם החלוקה (חיפוש מקומי עם התחלות אקראיות, ובחירה אקראית מבין החלוקות הטובות).
- `src/lib/repo.ts` – גישה לנתונים: Supabase, או localStorage במצב הדגמה.
- `src/app` – המסכים: היום, שחקנים, היסטוריה, הגדרות.
- `supabase/migrations` – טבלאות, הרשאות RLS ופונקציות ליצירת חבורה והצטרפות.

בדיקות: `npm test`.
