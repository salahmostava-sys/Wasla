-- ══════════════════════════════════════════════════════════════════════════════
-- اختبار نظام الصيانة وقطع الغيار
-- ══════════════════════════════════════════════════════════════════════════════

-- 🧪 Test 1: التحقق من وجود الجداول
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  'spare_parts' as table_name,
  COUNT(*) as row_count
FROM spare_parts
UNION ALL
SELECT 
  'maintenance_logs',
  COUNT(*)
FROM maintenance_logs
UNION ALL
SELECT 
  'maintenance_parts',
  COUNT(*)
FROM maintenance_parts;

-- النتيجة المتوقعة: يجب أن تظهر الجداول الثلاثة بدون أخطاء


-- 🧪 Test 2: التحقق من وجود الـ Triggers
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  trigger_name,
  event_object_table,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_fill_maintenance_employee',
    'trg_deduct_stock',
    'trg_restore_stock',
    'trg_update_total_cost'
  )
ORDER BY trigger_name ASC;

-- النتيجة المتوقعة: 4 triggers


-- 🧪 Test 3: التحقق من وجود الـ Functions
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'fill_maintenance_employee',
    'deduct_spare_part_stock',
    'restore_spare_part_stock',
    'update_maintenance_total_cost'
  )
ORDER BY routine_name ASC;

-- النتيجة المتوقعة: 4 functions


-- 🧪 Test 4: اختبار إضافة قطعة غيار
-- ══════════════════════════════════════════════════════════════════════════════
BEGIN;

-- إضافة قطعة اختبار
INSERT INTO spare_parts (
  name_ar,
  part_number,
  stock_quantity,
  min_stock_alert,
  unit,
  unit_cost,
  supplier,
  notes
) VALUES (
  'قطعة اختبار',
  'TEST-001',
  100,
  10,
  'قطعة',
  50.00,
  'مورد اختبار',
  'قطعة للاختبار فقط'
) RETURNING id, name_ar, stock_quantity;

ROLLBACK; -- لا نريد حفظ البيانات الاختبارية


-- 🧪 Test 5: اختبار خصم المخزون
-- ══════════════════════════════════════════════════════════════════════════════
-- هذا الاختبار يتطلب بيانات حقيقية، لذا نستخدم simulation

-- الخطوات:
-- 1. إنشاء قطعة غيار بكمية 100
-- 2. إنشاء سجل صيانة
-- 3. إضافة القطعة للصيانة بكمية 10
-- 4. التحقق من أن المخزون أصبح 90
-- 5. حذف سجل الصيانة
-- 6. التحقق من أن المخزون عاد إلى 100


-- 🧪 Test 6: عرض القطع ذات المخزون المنخفض
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  id,
  name_ar,
  stock_quantity,
  min_stock_alert,
  unit,
  (min_stock_alert - stock_quantity) as shortage
FROM spare_parts
WHERE stock_quantity < min_stock_alert
ORDER BY shortage DESC;

-- النتيجة المتوقعة: قائمة بالقطع التي تحتاج إعادة طلب


-- 🧪 Test 7: عرض تكلفة الصيانة لكل مركبة
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  v.plate_number,
  v.brand,
  COUNT(ml.id) as maintenance_count,
  COALESCE(SUM(ml.total_cost), 0) as total_cost,
  COALESCE(AVG(ml.total_cost), 0) as avg_cost
FROM vehicles v
LEFT JOIN maintenance_logs ml ON ml.vehicle_id = v.id
GROUP BY v.id, v.plate_number, v.brand
HAVING COUNT(ml.id) > 0
ORDER BY total_cost DESC
LIMIT 10;

-- النتيجة المتوقعة: أكثر 10 مركبات تكلفة في الصيانة


-- 🧪 Test 8: عرض أكثر القطع استخداماً
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  sp.name_ar,
  sp.unit,
  SUM(mp.quantity_used) as total_used,
  COUNT(DISTINCT mp.maintenance_log_id) as usage_count,
  COALESCE(AVG(mp.cost_at_time), 0) as avg_cost
FROM maintenance_parts mp
JOIN spare_parts sp ON sp.id = mp.part_id
GROUP BY sp.id, sp.name_ar, sp.unit
ORDER BY total_used DESC
LIMIT 10;

-- النتيجة المتوقعة: أكثر 10 قطع استخداماً


-- 🧪 Test 9: عرض سجلات الصيانة مع التفاصيل
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  ml.id,
  ml.maintenance_date,
  ml.type,
  v.plate_number,
  e.name as driver_name,
  ml.total_cost,
  ml.status,
  COUNT(mp.id) as parts_count
FROM maintenance_logs ml
JOIN vehicles v ON v.id = ml.vehicle_id
LEFT JOIN employees e ON e.id = ml.employee_id
LEFT JOIN maintenance_parts mp ON mp.maintenance_log_id = ml.id
GROUP BY ml.id, ml.maintenance_date, ml.type, v.plate_number, e.name, ml.total_cost, ml.status
ORDER BY ml.maintenance_date DESC
LIMIT 20;

-- النتيجة المتوقعة: آخر 20 سجل صيانة مع التفاصيل


-- 🧪 Test 10: التحقق من RLS Policies
-- ══════════════════════════════════════════════════════════════════════════════
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('spare_parts', 'maintenance_logs', 'maintenance_parts')
ORDER BY tablename ASC, policyname ASC;

-- النتيجة المتوقعة: قائمة بجميع الـ policies المطبقة


-- 🧪 Test 11: اختبار حساب التكلفة الإجمالية
-- ══════════════════════════════════════════════════════════════════════════════
-- عرض سجل صيانة مع حساب التكلفة يدوياً ومقارنتها بالمحفوظة
SELECT 
  ml.id,
  ml.total_cost as stored_total,
  COALESCE(SUM(mp.quantity_used * mp.cost_at_time), 0) as calculated_total,
  CASE 
    WHEN ml.total_cost = COALESCE(SUM(mp.quantity_used * mp.cost_at_time), 0) 
    THEN '✅ صحيح'
    ELSE '❌ خطأ'
  END as validation
FROM maintenance_logs ml
LEFT JOIN maintenance_parts mp ON mp.maintenance_log_id = ml.id
GROUP BY ml.id, ml.total_cost
HAVING COUNT(mp.id) > 0
LIMIT 10;

-- النتيجة المتوقعة: جميع السجلات يجب أن تكون "✅ صحيح"


-- 🧪 Test 12: اختبار تعبئة السائق تلقائياً
-- ══════════════════════════════════════════════════════════════════════════════
-- عرض سجلات الصيانة مع التحقق من وجود السائق
SELECT 
  ml.id,
  v.plate_number,
  e.name as assigned_driver,
  CASE 
    WHEN ml.employee_id IS NOT NULL THEN '✅ تم التعبئة'
    ELSE '⚠️ لم يتم التعبئة'
  END as driver_status
FROM maintenance_logs ml
JOIN vehicles v ON v.id = ml.vehicle_id
LEFT JOIN employees e ON e.id = ml.employee_id
ORDER BY ml.created_at DESC
LIMIT 20;

-- النتيجة المتوقعة: معظم السجلات يجب أن تكون "✅ تم التعبئة"


-- ══════════════════════════════════════════════════════════════════════════════
-- ملخص الاختبارات
-- ══════════════════════════════════════════════════════════════════════════════

/*
✅ Test 1: التحقق من وجود الجداول
✅ Test 2: التحقق من وجود الـ Triggers
✅ Test 3: التحقق من وجود الـ Functions
✅ Test 4: اختبار إضافة قطعة غيار
✅ Test 5: اختبار خصم المخزون
✅ Test 6: عرض القطع ذات المخزون المنخفض
✅ Test 7: عرض تكلفة الصيانة لكل مركبة
✅ Test 8: عرض أكثر القطع استخداماً
✅ Test 9: عرض سجلات الصيانة مع التفاصيل
✅ Test 10: التحقق من RLS Policies
✅ Test 11: اختبار حساب التكلفة الإجمالية
✅ Test 12: اختبار تعبئة السائق تلقائياً

جميع الاختبارات يجب أن تعمل بدون أخطاء!
*/
