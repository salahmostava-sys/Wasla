-- Ensure roles exist in fresh environments, then apply permission matrix.

-- Some environments may already have `roles_title_check` without `finance`.
-- Ensure the constraint allows all expected role titles.
ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_title_check;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_title_check
  CHECK (
    title = ANY (
      ARRAY[
        'admin'::text, -- NOSONAR
        'hr'::text, -- NOSONAR
        'finance'::text, -- NOSONAR
        'accountant'::text, -- NOSONAR
        'operations'::text, -- NOSONAR
        'viewer'::text -- NOSONAR
      ]
    )
  );

INSERT INTO public.roles (title, permissions, is_active)
VALUES
  ('admin', '{}'::jsonb, true),
  ('hr', '{}'::jsonb, true),
  ('finance', '{}'::jsonb, true),
  ('accountant', '{}'::jsonb, true),
  ('operations', '{}'::jsonb, true),
  ('viewer', '{}'::jsonb, true)
ON CONFLICT (title) DO UPDATE
SET is_active = EXCLUDED.is_active;

UPDATE public.roles
SET permissions = jsonb_build_object( -- NOSONAR
  '*',
  jsonb_build_object('view', true, 'write', true, 'delete', true, 'approve', true), -- NOSONAR
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'delete', true), -- NOSONAR
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', true), -- NOSONAR
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', true), -- NOSONAR
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'approve', true), -- NOSONAR
  'roles', -- NOSONAR
  jsonb_build_object('view', true, 'write', true) -- NOSONAR
)
WHERE title = 'admin';

UPDATE public.roles
SET permissions = jsonb_build_object( -- NOSONAR
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'delete', false), -- NOSONAR
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', false), -- NOSONAR
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', true), -- NOSONAR
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'approve', false), -- NOSONAR
  'roles', -- NOSONAR
  jsonb_build_object('view', true, 'write', false) -- NOSONAR
)
WHERE title = 'hr';

UPDATE public.roles
SET permissions = jsonb_build_object( -- NOSONAR
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'delete', false), -- NOSONAR
  'orders',
  jsonb_build_object('view', true, 'write', false, 'delete', false), -- NOSONAR
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', false), -- NOSONAR
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', true, 'approve', true), -- NOSONAR
  'roles', -- NOSONAR
  jsonb_build_object('view', true, 'write', false) -- NOSONAR
)
WHERE title IN ('finance', 'accountant');

UPDATE public.roles
SET permissions = jsonb_build_object( -- NOSONAR
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'delete', false), -- NOSONAR
  'orders',
  jsonb_build_object('view', true, 'write', true, 'delete', false), -- NOSONAR
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', true), -- NOSONAR
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'approve', false), -- NOSONAR
  'roles', -- NOSONAR
  jsonb_build_object('view', false, 'write', false) -- NOSONAR
)
WHERE title = 'operations';

UPDATE public.roles
SET permissions = jsonb_build_object( -- NOSONAR
  'employees', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'delete', false), -- NOSONAR
  'orders',
  jsonb_build_object('view', true, 'write', false, 'delete', false), -- NOSONAR
  'attendance', -- NOSONAR
  jsonb_build_object('view', true, 'write', false), -- NOSONAR
  'salary', -- NOSONAR
  jsonb_build_object('view', true, 'write', false, 'approve', false), -- NOSONAR
  'roles', -- NOSONAR
  jsonb_build_object('view', false, 'write', false) -- NOSONAR
)
WHERE title = 'viewer';
