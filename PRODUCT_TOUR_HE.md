<div dir="rtl">

# SignalDesk V2 — מדריך מוצר וארכיטקטורה (עברית)

> מדריך מקיף להבנת כל מה שנבנה בפלטפורמת **SignalDesk** על פני שלבים 0–5 ו-V2.
> המערכת רצה **ללא כל הגדרת סביבה** (ללא `.env.local`) במצב דמו אינטראקטיבי —
> ראו את הפרק האחרון "מעבר מדמו לפרודקשן".

---

## 1. סקירה כללית — מה המוצר עושה ואיך הכסף עובד

**SignalDesk** היא פלטפורמת **Conversation Intelligence ו-CRM Analytics** עבור צוותי מכירות והצלחת לקוח (B2B Micro-SaaS).

**הלולאה המרכזית:**

1. **אודיו נכנס** — נציג מעלה הקלטת שיחה, או שהיא נכנסת אוטומטית דרך Webhook (Zapier/Twilio/VoIP).
2. **תמלול** — AssemblyAI מתמלל עם זיהוי דוברים (diarization) בעברית ובאנגלית.
3. **ניתוח AI** — Claude מחלץ סיכום, סנטימנט, התנגדויות, פריטי פעולה, שלב עסקה מומלץ, ציון בריאות עסקה ודגלי סיכון.
4. **סנכרון ל-CRM** — התובנות נדחפות אוטומטית ל-HubSpot או Monday.com (הערות, שלבי עסקה, משימות מעקב).
5. **דאשבורד** — מנהלים רואים סנטימנט, פייפליין, עסקאות בסיכון ודוח שבועי.

**מודל ההכנסה (תמחור):**

| מסלול | מחיר | למי |
|---|---|---|
| Starter | $0 | התנסות — 25 שיחות בחודש |
| Growth | $49 למשתמש/חודש | צוותים — שיחות ללא הגבלה + סנכרון CRM |
| Team | מותאם | ארגונים — SSO, הרשאות, שדות CRM מותאמים |

**הערך העסקי:** הנציגים מפסיקים להקליד סיכומים ידנית, אף התנגדות או צעד-המשך לא הולך לאיבוד, והמנהלים מקבלים שקיפות מלאה למה עסקאות נתקעות.

---

## 2. ארכיטקטורה וזרימת נתונים מקצה לקצה

**מחסנית טכנולוגית:** Next.js 15 (App Router, TypeScript) · Tailwind + shadcn/ui · Supabase (PostgreSQL, Auth, RLS, Storage) · AssemblyAI (STT) · Claude `claude-sonnet-4-6` · HubSpot + Monday · Zod · Tremor/Recharts.

**זרימת ה-Pipeline:**

```
POST /api/ingest  (העלאה ידנית)   ┐
POST /api/webhooks/calls/ingest   ┘→ יצירת רשומת call (status=uploaded)
     → אחסון אודיו ב-Supabase Storage (דלי פרטי)
     → שליחת ג'וב ל-AssemblyAI (speaker_labels=true, זיהוי שפה)
     → status=transcribing

תמלול מוכן — שני מסלולים זהים:
  (פרודקשן) AssemblyAI → POST /api/transcription/webhook  (אימות חתימה)
  (לוקאלי)  GET /api/calls/[id]/sync-status → polling
     → כתיבת transcripts, status=transcribed
     → הפעלת חילוץ תובנות

/api/insights
     → Claude עם JSON schema → ולידציה ב-Zod
     → computeDealHealth (ציון דטרמיניסטי 0–100)
     → כתיבת insights, status=completed
     → אם יש אינטגרציית CRM פעילה → סנכרון אוטומטי
     → שיגור התראות (alerts) אם מתקיים טריגר
```

**אבטחה ובידוד נתונים:**

- **Multi-tenant לפי `workspace_id`** — כל טבלה מוגנת ב-**RLS (Row-Level Security)**: משתמש קורא/כותב שורה רק אם הוא חבר ב-workspace (`workspace_members`).
- **הצפנת טוקנים AES-256-GCM** — טוקני ה-CRM מוצפנים במנוחה (`src/lib/crypto.ts`), ולעולם לא מוחזרים ללקוח.
- **מפתחות API מגובבים** — מפתחות הזנה (`sd_live_…`) נשמרים כ-SHA-256 בלבד, עם השוואה ב-`timingSafeEqual`.
- **הגנת SSRF** — כל כתובת יוצאת (webhook/recording) נבדקת מול טווחים פרטיים/loopback/metadata (`src/lib/net/ssrf.ts`).
- **הגנה בפני הזרקת נוסחאות ב-CSV** וייצוא בטוח (`src/lib/csv.ts`).

---

## 3. פירוט המסכים והפיצ'רים (לפי סדר ניווט)

### דף הבית ומגנט הלידים — `/`
נחיתה שיווקית: Hero, השוואת "עם/בלי SignalDesk", **מנתח חי** (Live Analyzer) שמדגים שיחה אמיתית בעברית/אנגלית, תמחור, שאלות נפוצות, וטופס לכידת לידים (`POST /api/leads`). במצב דמו מופיע כפתור **"Enter Live Demo"** שמוביל ישירות לדאשבורד.

### דאשבורד מנהלים ודוח שבועי — `/dashboard`
כרטיסי KPI (סה"כ שיחות, סנטימנט ממוצע, עסקאות שנסגרו, היצמדות ל-Playbook), גרף התנגדויות מובילות, גרף מגמת שיחות/המרות, רשימת **עסקאות בסיכון**, והתפלגות פייפליין לפי שלב. כפתור **"Weekly Executive Brief"** פותח מגירה עם דוח שבועי (`GET /api/digest/weekly`): מדדי 7 ימים, שינוי סנטימנט שבוע-על-שבוע, התנגדויות מובילות, עסקאות בסיכון, ומדדי ה-Playbook הטובים/חלשים ביותר.

### רשימת שיחות, פילטרים וייצוא — `/calls`
טבלה עם שם לקוח, סטטוס, בריאות עסקה, רמת סיכון, סנטימנט, שפה וסטטוס סנכרון CRM. **סרגל פילטרים** (חיפוש, סנטימנט, סיכון, שפה, סנכרון) מבוסס פרמטרי URL, וכפתור **ייצוא CSV/JSON** (`GET /api/calls/export`).

### ניתוח שיחה מעמיק — `/calls/[id]`
- **נגן מסונכרן לתמלול** (`SyncedPlayer`): אודיו אמיתי, שליטה במהירות (1x–2x), חיפוש בתמלול, והדגשת האמירה הפעילה בזמן אמת (תומך RTL, `dir="auto"`).
- **Deal Health Gauge** — ציון בריאות עסקה 0–100.
- **Risk Radar** — דגלי סיכון עם ציטוטי ראיה.
- **Playbook Scorecard** — ציון לכל קריטריון (BANT) עם ראיות וטיפ אימון.
- **AI Call Coach** — Scorecard לנציג (גילוי/טיפול בהתנגדויות/סגירה), הזדמנויות שהוחמצו עם תגובות נגד, ו**מייל פולו-אפ** מוכן לשליחה בשפת השיחה (`POST /api/calls/[id]/coach`).
- **Talk Ratio** — יחס דיבור/הקשבה, ו**היסטוריית סנכרון CRM**.

### העלאת שיחות — `/upload`
גרירה-ושחרור של קובץ אודיו או כתובת URL ציבורית, עם מעקב סטטוס חי (`StatusTracker`).

### Webhooks אוטומטיים — `/settings/webhooks`
יצירת מפתחות הזנה (`sd_live_…`) ל-Zapier/Make/Twilio, וה-endpoint `POST /api/webhooks/calls/ingest` (Bearer, מוגן SSRF, dedupe לפי `external_call_id`).

### ניהול Playbooks — `/settings/playbooks`
עריכת קריטריוני כשירות ומשקלים ששולטים בציון בריאות העסקה. שני ברירות מחדל: **BANT (אנגלית)** ו-**כשירות B2B (עברית)**. ניתן להריץ `reanalyze` כדי להחיל שינויים.

### התראות — `/settings/alerts`
כללי התראה ל-Slack/Teams/webhook מותאם, שמופעלים אוטומטית אחרי כל ניתוח (עסקה בסיכון, סנטימנט שלילי, סיום שיחה). **הגנת אבטחה:** הדף מוגן בהרשאת owner/admin וה-webhook הסודי לעולם לא נשלח לדפדפן (רק דגל `hasWebhook`).

### חיבורי CRM — `/settings/integrations`
חיבור HubSpot/Monday עם **טוקן API** או **OAuth**, מיפוי pipeline/board, וסנכרון אוטומטי בסיום שיחה. הטוקנים מוצפנים AES-256-GCM.

### העוזר המרחף — `Ask AI` Copilot
מגירה בסרגל העליון לשיחה חופשית על נתוני סביבת העבודה (`POST /api/ai/chat`, בסטרימינג). עונה בעברית או אנגלית לפי שפת השאלה, ומצומצם ל-RLS של ה-workspace.

---

## 4. סיור מודרך בדמו (5 דקות)

1. פתחו את `/` ולחצו **"Enter Live Demo"** (או גשו ישירות ל-`/dashboard`).
2. בדאשבורד — הביטו ב-KPI, ב**עסקאות בסיכון**, ולחצו **"Weekly Executive Brief"**.
3. עברו ל-`/calls` — סננו לפי **Risk = high** או **Language = he**, ולחצו **Export CSV**.
4. פתחו את **"גלובוס טק — התנגדות מחיר"** — צפו ב-Risk Radar וב-Deal Health 28.
5. פתחו את **"Acme Corp — Discovery"** — נגנו את האודיו, שנו מהירות ל-2x, וצפו בהדגשת התמלול.
6. גללו ל-**AI Call Coach** — קראו את ה-Scorecard ואת מייל הפולו-אפ; לחצו **Regenerate**.
7. לחצו **"Sync to CRM"** — צפו בתוצאת הסנכרון המדומה.
8. פתחו שיחה בעברית (**חברת אלפא**) — שימו לב ל-RTL ולתמלול הדו-לשוני.
9. פתחו את **Ask AI** בסרגל העליון ושאלו: *"אילו עסקאות בסיכון?"* ו-*"סכם את הלקוחות בעברית"*.
10. בקרו ב-`/settings/playbooks`, `/settings/webhooks` ו-`/settings/alerts` כדי לראות את מסכי הניהול.

---

## 5. מעבר מדמו לפרודקשן

מצב הדמו פעיל כאשר **אין** הגדרת Supabase או כש-`DEMO_MODE=true`. כדי לעבור לדאטה אמיתי, הוסיפו ל-`.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=            # כתובת פרויקט Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # שרת בלבד
ASSEMBLYAI_API_KEY=
ASSEMBLYAI_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
HUBSPOT_CLIENT_ID= / HUBSPOT_CLIENT_SECRET=
MONDAY_CLIENT_ID= / MONDAY_CLIENT_SECRET=
APP_URL=                            # בסיס ציבורי ל-webhooks
ENCRYPTION_KEY=                     # להצפנת טוקני CRM
```

ברגע ש-`NEXT_PUBLIC_SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוגדרים, `isDemoMode()` מחזיר `false` וכל מסלולי הפרודקשן (Supabase + RLS, AssemblyAI, Claude, CRM OAuth) פועלים ללא שינוי — שכבת הדמו הופכת לרדומה לחלוטין. לאחר מכן הריצו את המיגרציות ב-`supabase/migrations/` וצרו משתמש; ה-trigger `handle_new_user` ייצר פרופיל, workspace ו-Playbooks כברירת מחדל אוטומטית.

</div>
