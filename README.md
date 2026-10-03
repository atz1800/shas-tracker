# shas-tracker
מעקב לימוד ש"ס — https://atz1800.github.io/shas-tracker/

עורכים את `index.html` כרגיל. בכל דחיפה ל-main, GitHub Actions (`.github/workflows/deploy.yml`) מקמפל מראש את הקוד
(`npm run build` → `dist/`, בלי Babel בדפדפן) ומפרסם ל-Pages. בדיקה מקומית: `npm ci && npm run build`.
