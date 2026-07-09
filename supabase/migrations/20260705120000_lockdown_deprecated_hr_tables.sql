-- إقفال جدولي hr_performance_reviews و leave_requests بالكامل
-- الميزة اتلغت من الكود (commit 4d7bcfb)، لكن الجدولين كانوا لسه معرّضين
-- للقراءة العامة (RLS policy بشرط true على دور public — أي شخص بدون
-- تسجيل دخول أصلاً كان يقدر يقرأ كل البيانات فيهم عبر API مباشرة).
--
-- هذا الملف يقفل الوصول بالكامل (لا SELECT ولا أي عملية) بدل حذف
-- الجدولين نهائيًا، حفاظًا على البيانات القديمة لو احتجتوها لاحقًا
-- (تقرير تاريخي، أرشيف، إلخ). لو قررتوا مستقبلًا إنكم مش محتاجين
-- البيانات دي إطلاقًا، ممكن نعمل ترحيلة تانية تعمل DROP TABLE.

BEGIN;

-- hr_performance_reviews: حذف كل السياسات الحالية (المكررة والأصلية)
DROP POLICY IF EXISTS "hr_reviews_select" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "unified_select_policy" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "hr_reviews_insert" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "hr_reviews_update" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "unified_update_policy" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "hr_reviews_delete" ON public.hr_performance_reviews;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.hr_performance_reviews;
-- لا يوجد أي policy بديل بعد الحذف = RLS يرفض كل شيء بشكل افتراضي (fail-closed)

-- leave_requests: نفس الشيء
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
DROP POLICY IF EXISTS "unified_select_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "unified_insert_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
DROP POLICY IF EXISTS "unified_update_policy" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_delete" ON public.leave_requests;
DROP POLICY IF EXISTS "unified_delete_policy" ON public.leave_requests;

NOTIFY pgrst, 'reload schema';

COMMIT;


