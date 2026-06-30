# تقرير فحص النظام الشامل — MuhimmatAltawseel

تاريخ الفحص: 30 يونيو 2026 · النطاق: frontend (React/Vite/TS) · server (Express) · ai-backend (FastAPI) · supabase · CI/CD

---

## 1) فحوصات CI/CD (GitHub Actions) — تم الإصلاح ✅

| الفحص | الحالة قبل | السبب الجذري | الإصلاح |
|------|-----------|--------------|---------|
| Build & Test | فشل عند `Upload coverage` | `codecov-action@v4` بـ `fail_ci_if_error: true` بدون `CODECOV_TOKEN` + خاصية `threshold` غير صالحة | إضافة `token` + `fail_ci_if_error: false` وحذف `threshold` |
| Frontend verify | فشل (متقطّع) | (أ) ESLint OOM، (ب) اختبار متقطّع flaky | إضافة `NODE_OPTIONS=4096` + إصلاح الـ flaky |
| SonarCloud | Quality Gate / Scan فشل | `sonar.organization` غير معرّف + `sonar.sources=frontend/src` (مجلد غير موجود) | إضافة `organization` + تصحيح `sources/tests` للمجلدات الفعلية |
| SonarQube Analysis | فشل Scan | workflow لـ SonarQube self-hosted بدون `SONAR_HOST_URL` (مكرر مع SonarCloud) | تعطيله افتراضيًا عبر `if: vars.ENABLE_SONARQUBE == 'true'` |
| Vercel | Deployment failed | إعداد خارجي على لوحة Vercel | **يتطلّب تدخّلك** (انظر القسم 5) |

النتيجة بعد الإصلاح: **كل فحوصات GitHub Actions خضراء** (Build & Test ✅، SonarCloud ✅، Frontend verify ✅، AI backend ✅، Supabase ✅، SonarQube مُتخطّى ✅).

---

## 2) أخطاء برمجية حقيقية — تم الإصلاح ✅

### أ. اختبار متقطّع (Flaky test) — السبب الجذري لتذبذب CI
- **الملف:** `frontend/shared/components/orders/OrdersCellPopover.tsx`
- **المشكلة:** `setTimeout(...10ms)` يسجّل listener عالمي على `mousedown`، لكن دالة التنظيف (cleanup) كانت تحذف الـ listener فقط ولا تُلغي المؤقّت. لو فُكّ المكوّن (unmount) خلال 10ms — وهو شائع في الاختبارات — يشتغل المؤقّت بعد تفكيك jsdom ويسبّب فشلًا عشوائيًا.
- **الإصلاح:** حفظ مُعرّف المؤقّت و`clearTimeout` داخل التنظيف. تم التحقّق: 8/8 تشغيلات ناجحة بعد الإصلاح.

### ب. تحذيرات ESLint (تكسر `lint:strict`)
- 8 متغيّرات/استيرادات غير مستخدمة في كود تمت إضافته حديثًا:
  - `DashboardPerformanceHeader.tsx` (LayoutGrid, TrendingUp)
  - `FuelPageHeader.tsx` (BarChart3, Grid3X3, view, onViewChange)
  - `OrdersSummaryTable.tsx` (متغيّر `c` غير مستخدم × 2)
- تم تنظيفها بالكامل → ESLint نظيف (0 تحذير).

---

## 3) الأمان

- ✅ **لا توجد أسرار مكتوبة بالكود (hardcoded).** كل المفاتيح تُقرأ من متغيّرات البيئة (`import.meta.env` / `process.env`). `SUPABASE_SERVICE_ROLE_KEY` يُستخدم بشكل سليم في `server/` و`api/` فقط.
- ✅ إعداد CSP و X-Frame-Options و nosniff موجود في `vercel.json`.
- ⚠️ **ثغرة عالية الخطورة في مكتبة `xlsx` (SheetJS):** Prototype Pollution + ReDoS، **ولا يوجد إصلاح عبر npm**. النسخة على سجلّ npm قديمة.
  - **التوصية:** التثبيت من مصدر SheetJS الرسمي:
    `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`
  - أو التأكّد من عدم تمرير ملفات غير موثوقة، وتنقية المدخلات قبل التحليل.
- 🔐 **مهم:** التوكن (`ghp_...`) اللي شاركته معايا لازم **تلغيه فورًا** من GitHub → Settings → Developer settings → Tokens.

---

## 4) ملاحظات الجودة والأداء

- ✅ TypeScript نظيف (0 أخطاء)، 1018 اختبار ناجح، تقسيم الكود (code-splitting) مُفعّل.
- ✅ لا توجد `console.log`/`debugger` متبقّية في الكود المصدري، ولا أي `TODO/FIXME/@ts-ignore`.
- ⚠️ حِزم vendor كبيرة نسبيًا (مضغوطة gzip): `xlsx ~141KB`، `jspdf ~130KB`، `charts ~110KB`، `react ~110KB`. مقبولة بفضل الـ lazy-loading، لكن يُفضّل تحميل `xlsx/jspdf` عند الطلب فقط (dynamic import) في صفحات التصدير.
- ⚠️ ESLint يستهلك ذاكرة كبيرة (>1GB) → أُضيف `NODE_OPTIONS` في CI.

---

## 5) Vercel (يتطلّب تدخّلك)

النشر يفشل من جهة Vercel (إعداد monorepo). تأكّد من الآتي في لوحة Vercel:
1. **Root Directory** = جذر المستودع (وليس `frontend`) لأن `package.json` الجذر يبني عبر `cd frontend && npm run build && cp -r dist ../public`.
2. **Output Directory** = `public`.
3. **Environment Variables**: `VITE_SUPABASE_URL` و`VITE_SUPABASE_PUBLISHABLE_KEY` (وأي `VITE_*` من `.env.example`) مضبوطة في الـ Project Settings.
4. ابعت لوج "Details" بتاع Vercel لو لسه بيفشل وأحدّد السبب بدقّة.

ملاحظة: الإنتاج `muhimat.vercel.app` حاليًا عالق على شاشة تحميل (spinner) — غالبًا بسبب فشل آخر نشر أو نقص متغيّرات البيئة.

---

## 6) ملاحظات التصميم/الواجهة (مبنية على مراجعة الكود)

- التطبيق RTL عربي بالكامل مع نظام theme (tokens مثل `bg-popover`, `text-foreground`) — بنية CSS متّسقة وجيدة.
- في `OrdersSummaryTable.tsx` كان فيه نية لتلوين أعمدة المنصات (`getAppColor`) لكنها **كود ميّت** غير مُطبَّق على الخلايا — لو مطلوب التمييز اللوني للمنصّات، يُفعَّل؛ وإلا حُذف (تم الحذف لإسكات اللينت).
- لمراجعة تصميم أعمق (تباين الألوان، التجاوب، إمكانية الوصول a11y) محتاج وصول للتطبيق بعد تسجيل الدخول — أرسل حساب اختبار أو أصلح النشر أولًا.

---

## الخلاصة
كل أعطال GitHub Actions اتحلّت واتأكّدت خضراء. باقي **Vercel فقط** (يحتاج إعداد من لوحتك)، و**تحديث مكتبة xlsx** للأمان. لا توجد أسرار مكشوفة في الكود.
