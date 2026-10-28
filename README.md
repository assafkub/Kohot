# כוחות ⚽

אפליקציה לחלוקת כוחות בכדורגל השכונתי: מסמנים מי מגיע, לוחצים פעם אחת, ומקבלים קבוצות מאוזנות לפי רמה (1–7, כולל חצאים) ותפקידים (שוער, בלם, מגן, אמצע, חלוץ). כל לחיצה על "ערבוב מחדש" נותנת חלוקה אחרת, מאוזנת באותה מידה.

## מה יש בפנים

- **הוספת שחקנים מהירה**: כותבים שם (אפשר גם "דני 5.5") ולוחצים Enter.
- **הדבקת רשימה מהוואטסאפ**: מדביקים את רשימת המגיעים, שחקנים מוכרים מסומנים אוטומטית וחדשים נוספים.
- **חלוקה מאוזנת**: מאזנת סכום רמות, פיזור חזקים/חלשים ותפקידים (שוער לכל קבוצה כשיש מספיק), ל-2 עד 5 קבוצות.
- **החלפה ידנית**: לוחצים על שחקן ואז על שחקן מקבוצה אחרת.
- **שיתוף** לוואטסאפ, **שמירת משחקים** והיסטוריה.
- **חבורות**: מתחברים עם Google, ומשתפים את החבורה עם עוד מארגנים בעזרת קוד הצטרפות.
- מותאם לנייד, עברית מימין לשמאל, ואפשר להוסיף למסך הבית.

## הרצה מקומית

```bash
npm install
npm run dev
```

בלי משתני Supabase האפליקציה עובדת **במצב הדגמה**: בלי התחברות, והנתונים נשמרים רק בדפדפן. נוח לנסות לפני ההגדרה.

## חיבור Supabase והתחברות עם Google

1. **פרויקט Supabase**: צרו פרויקט ב-[supabase.com](https://supabase.com).
2. **מסד הנתונים**: ב-SQL Editor הריצו את הקובץ `supabase/migrations/20261028000000_init.sql` (או `supabase db push` עם ה-CLI).
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

## מבנה

- `src/lib/balance.ts` – אלגוריתם החלוקה (חיפוש מקומי עם התחלות אקראיות, ובחירה אקראית מבין החלוקות הטובות).
- `src/lib/repo.ts` – גישה לנתונים: Supabase, או localStorage במצב הדגמה.
- `src/app` – המסכים: היום, שחקנים, היסטוריה, הגדרות.
- `supabase/migrations` – טבלאות, הרשאות RLS ופונקציות ליצירת חבורה והצטרפות.

בדיקות: `npm test`.
