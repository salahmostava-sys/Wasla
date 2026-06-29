-- ============================================================
-- FIX: تسجيل الـ squash migrations كـ "applied" دون تنفيذها
-- ============================================================
-- هذا الملف يُطبَّق في Supabase Dashboard > SQL Editor
-- لأن الـ squash migration للتطوير المحلي فقط، لكن supabase CLI
-- يظن أنها لم تُطبَّق، مما يتسبب في أخطاء عند "db push"
-- ============================================================

-- تسجيل migration الـ squash كـ applied (لتجنب تطبيقها مجدداً)
INSERT INTO supabase_migrations.schema_migrations (version)
VALUES
  ('20260701000000'),
  ('20260702000000')
ON CONFLICT (version) DO NOTHING;
