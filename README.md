# shas-tracker
מעקב לימוד ש"ס — https://atz1800.github.io/shas-tracker/

## עבודה על הקוד
עורכים את `index.html` כרגיל. הוא עובד גם בלי בנייה (ספריות מ-CDN ו-Babel בדפדפן), לבדיקה מהירה.

בכל דחיפה ל-main, GitHub Actions (`.github/workflows/deploy.yml`) מריץ בדיקות, ואז בונה (`npm run build` → `dist/`):
React, hebcal, Firebase והקוד נארזים מ-npm לקובץ JS אחד (בלי CDN ובלי Babel), מזהה גרסה מוזרק ל-`APP_VERSION`
ולשם המטמון ב-`sw.js` (אין צורך לעדכן ידנית), והאתר מתפרסם ל-Pages.

## בדיקות
```
npm ci
npm test            # יחידה: דף יומי מול hebcal, יום הולדת עברי, מיזוג סנכרון, מספור עמודים
npm run test:e2e    # דפדפן (Playwright, Firebase מדומה): תהליכים, נגישות axe, אופליין, מסך עיון, Service Worker
npm run test:rules  # כללי האבטחה של Firestore מול האמולטור (דורש Java)
```

## כללי האבטחה (Firestore)
`firestore.rules` מתפרסם אוטומטית מ-CI אם מוגדר הסוד `FIREBASE_SERVICE_ACCOUNT`
(JSON של חשבון שירות עם הרשאת Firebase Rules Admin). בלי הסוד — מפרסמים ידנית:
`npx firebase-tools deploy --only firestore:rules`.

## צילומי מסך להתקנה
`node scripts/screenshots.mjs` מייצר מחדש את `screenshot-*.png` (מנתוני דוגמה).
