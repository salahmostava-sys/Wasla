# Supabase Cleanup Plan

الغرض من هذا الملف هو تنظيم تنظيف Supabase بطريقة آمنة وقابلة للرجوع، بدون حذف عشوائي أو تعديل حساس بدون موافقة صريحة.

## القواعد الثابتة

- لا حذف لجداول أو أعمدة أو Functions مباشرة بدون دليل واضح وقرار منفصل.
- أي تغيير حساس يتم شرحه قبل التنفيذ: الهدف، التأثير، المخاطر، وخطة الرجوع.
- نبدأ دائمًا بالتغييرات الأقل خطورة: Realtime، Audit triggers، ثم Archive/Rename، ثم الحذف الفعلي كآخر خطوة.
- كل مرحلة صغيرة تنتهي بحالة واضحة في Git أو تقرير مكتوب.
- أي جدول أو Function غير واضح الاستخدام يبقى كما هو.

## الحالة الحالية

- تم تقليل حمل Realtime/Audit سابقًا عبر migrations منفصلة.
- Supabase remote تم تحديثه حتى آخر migration مطبقة.
- Git status كان نظيفًا قبل إنشاء هذه الخطة.

## المرحلة 0: تثبيت نقطة البداية

الهدف: ضمان وجود نقطة رجوع قبل أي تنظيف جديد.

الأوامر:

```powershell
git status --short --branch
git log -3 --oneline
npx supabase migration list
```

شروط الانتقال:

- لا توجد تغييرات غير مفهومة في Git.
- آخر migrations المحلية والبعيدة متزامنة.
- أي ملف جديد أو migration مطبقة يتم عمل commit لها قبل بدء تنظيف جديد.

## المرحلة 1: الجرد بدون تعديل

الهدف: معرفة ما هو موجود وما هو مستخدم بدون لمس النظام.

نجمع:

- كل الجداول الموجودة في migrations/schema.
- كل استخدامات `supabase.from(...)` في frontend/server/api.
- كل استخدامات `supabase.rpc(...)`.
- كل Realtime subscriptions.
- كل Functions وTriggers وPolicies المهمة.
- كل Storage buckets أو storage policies.

أوامر مقترحة:

```powershell
rg -n "supabase\\.from\\(|\\.from\\('|\\.from\\(\"" frontend server api
rg -n "supabase\\.rpc\\(|\\.rpc\\('" frontend server api
rg -n "postgres_changes|supabase\\.channel|ALTER PUBLICATION supabase_realtime" frontend supabase\migrations
rg -n "CREATE TRIGGER|CREATE OR REPLACE FUNCTION|CREATE POLICY|ALTER TABLE .* ENABLE ROW LEVEL SECURITY" supabase\migrations
```

المخرجات المطلوبة:

- جدول استخدام لكل table/function.
- قائمة واضحة بما هو مستخدم، داخلي، حساس، غير واضح، أو مرشح للتنظيف.

## المرحلة 2: التصنيف

الحالة: مكتملة بتاريخ 2026-07-14.

- التقرير القابل لإعادة التوليد: `SUPABASE_USAGE_CLASSIFICATION.md`.
- تقييم دمج المايجريشن: `SUPABASE_MIGRATION_BASELINE_ASSESSMENT.md`.
- لم يتم حذف أو تعطيل أي عنصر خلال التصنيف.

تصنيف كل عنصر:

- مستخدم بوضوح: يظهر في الكود أو في RPC مستخدم.
- مستخدم داخليًا: يظهر داخل SQL Function أو Trigger.
- حساس: permissions, profiles, salaries, treasury, audit, auth-related data.
- غير واضح: لا يحذف ولا يعطل.
- مرشح للتنظيف: عليه دليل قوي أنه زائد أو عالي الحمل.

قاعدة القرار:

- لا يتم تنظيف عنصر إلا لو عليه دليلين على الأقل: مثل عدم وجود استخدام في الكود + عدم وجود استخدام داخلي في SQL.

## المرحلة 3: تنظيف منخفض الخطورة

أمثلة:

- إزالة جداول غير مستخدمة من `supabase_realtime`.
- تقليل Realtime subscriptions في الواجهة.
- إيقاف Audit UPDATE على جداول عالية الحركة.
- تعطيل Trigger ثقيل بشرط وجود rollback واضح.

قبل التنفيذ يجب توثيق:

- اسم العنصر.
- سبب التنظيف.
- التأثير المتوقع.
- طريقة الرجوع.

قالب قرار:

```text
Decision:
- Target:
- Proposed change:
- Evidence:
- Risk:
- Rollback:
- Approved by user:
```

## المرحلة 4: تنظيف متوسط الخطورة

أمثلة:

- Rename/Archive لجداول مهملة بدل حذفها.
- إيقاف Function غير مستخدمة بعد التأكد.
- تقليل indexes غير المستخدمة إذا كانت تسبب تكلفة كتابة واضحة.

القواعد:

- يفضل archive/rename أولًا بدل delete.
- نراقب التطبيق بعد التغيير.
- لا يتم تنفيذ أكثر من تغيير متوسط الخطورة في نفس migration.

## المرحلة 5: حذف فعلي

الحذف آخر خطوة فقط.

شروط الحذف:

- Backup أو archive واضح.
- لا استخدام في frontend/server/api.
- لا استخدام داخل SQL Functions/Triggers/Views.
- لا اعتماد RLS أو FK مهم.
- موافقة صريحة قبل التنفيذ.

Rollback:

- restore من archive أو backup.
- أو migration عكسية تعيد الجدول/العنصر إذا كان صغيرًا وممكنًا.

## المرحلة 6: Baseline/Squash

الغرض: ترتيب تاريخ migrations وليس تقليل حمل السيرفر مباشرة.

لا تبدأ هذه المرحلة إلا بعد استقرار الإنتاج.

الخطوات:

- استخراج schema النهائي.
- إنشاء baseline migration منظمة.
- أرشفة migrations القديمة بدل حذفها عشوائيًا.
- اختبار إنشاء قاعدة جديدة من الصفر إن أمكن.

## أوامر التحقق العامة

```powershell
npm run typecheck -w frontend
git diff --check
npx supabase db push
npx supabase migration list
```

ملاحظات:

- `supabase` كأمر مباشر قد لا يكون مثبتًا محليًا، لكن `npx supabase` يعمل في هذا المشروع.
- `VACUUM` لا يوضع داخل migration عادية إذا كانت تعمل داخل transaction. يفضل تنفيذه يدويًا كـ maintenance script عند الحاجة.

## سجل القرارات

```text
Date: 2026-07-14
Target: Supabase objects and 224 applied migrations
Decision: Complete classification; keep applied migration history unchanged
Reason: Local and remote histories match, while no isolated clean-room baseline test is available
Risk: None to runtime; reports and audit tooling only
Rollback: Remove the generated report, audit script, and package command
Status: Phase 2 complete
```

أضف أي قرار جديد هنا قبل التنفيذ:

```text
Date:
Target:
Decision:
Reason:
Risk:
Rollback:
Status:
```
