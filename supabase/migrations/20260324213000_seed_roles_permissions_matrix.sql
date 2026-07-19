-- Seed/update granular permissions matrix for role-based authorization.

UPDATE public.roles
SET permissions = jsonb_build_object(
  '*',
  jsonb_build_object('view', true, 'write', true, 'delete', true, 'approve', true), -- NOSONAR
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'delete', true),
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', true),
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', true),
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'approve', true),
  'roles', -- NOSONAR
  jsonb_build_object('view', true, 'write', true)
)
WHERE title = 'admin';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', false),
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', true),
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'approve', false),
  'roles', -- NOSONAR
  jsonb_build_object('view', true, 'write', false)
)
WHERE title = 'hr';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', false),
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'approve', true),
  'roles', -- NOSONAR
  jsonb_build_object('view', true, 'write', false)
)
WHERE title IN ('finance', 'accountant');

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', false),
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', true),
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'approve', false),
  'roles', -- NOSONAR
  jsonb_build_object('view', false, 'write', false)
)
WHERE title = 'operations';

UPDATE public.roles
SET permissions = jsonb_build_object(
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'orders',
  jsonb_build_object('view', true, 'write', false, 'delete', false),
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', false),
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'approve', false),
  'roles', -- NOSONAR
  jsonb_build_object('view', false, 'write', false)
)
WHERE title = 'viewer';
