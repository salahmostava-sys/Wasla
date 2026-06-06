import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { routesManifest } from '@app/routesManifest';

const mockAuthState = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as string | null,
}));

const permissionsServiceMock = vi.hoisted(() => ({
  getUserPermission: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('@app/providers/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('@services/permissionsService', () => ({
  permissionsService: permissionsServiceMock,
}));

import { DEFAULT_PERMISSIONS, usePermissions, type PagePermission } from './usePermissions';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('DEFAULT_PERMISSIONS role matrix', () => {
  it('admin can perform all actions on employees', () => {
    const permissions = DEFAULT_PERMISSIONS.admin.employees;
    expect(permissions.can_view).toBe(true);
    expect(permissions.can_edit).toBe(true);
    expect(permissions.can_delete).toBe(true);
  });

  it('admin can perform all actions on salaries', () => {
    const permissions = DEFAULT_PERMISSIONS.admin.salaries;
    expect(permissions).toEqual({ can_view: true, can_edit: true, can_delete: true });
  });

  it('viewer canEdit = false on all pages', () => {
    for (const page of Object.keys(DEFAULT_PERMISSIONS.viewer)) {
      expect(DEFAULT_PERMISSIONS.viewer[page].can_edit).toBe(false);
    }
  });

  it('viewer canDelete = false on all pages', () => {
    for (const page of Object.keys(DEFAULT_PERMISSIONS.viewer)) {
      expect(DEFAULT_PERMISSIONS.viewer[page].can_delete).toBe(false);
    }
  });

  it('finance has access to salary pages', () => {
    const permissions = DEFAULT_PERMISSIONS.finance.salaries;
    expect(permissions.can_view).toBe(true);
    expect(permissions.can_edit).toBe(true);
  });

  it('finance has access to advances', () => {
    const permissions = DEFAULT_PERMISSIONS.finance.advances;
    expect(permissions.can_view).toBe(true);
    expect(permissions.can_edit).toBe(true);
  });

  it('hr has no access to finance-only pages (finance module)', () => {
    const permissions = DEFAULT_PERMISSIONS.hr.finance;
    expect(permissions.can_view).toBe(false);
    expect(permissions.can_edit).toBe(false);
    expect(permissions.can_delete).toBe(false);
  });

  it('hr cannot edit salaries', () => {
    const permissions = DEFAULT_PERMISSIONS.hr.salaries;
    expect(permissions.can_view).toBe(true);
    expect(permissions.can_edit).toBe(false);
  });

  it('operations can manage maintenance', () => {
    const permissions = DEFAULT_PERMISSIONS.operations.maintenance;
    expect(permissions.can_view).toBe(true);
    expect(permissions.can_edit).toBe(true);
    expect(permissions.can_delete).toBe(true);
  });

  it('operations cannot access salaries', () => {
    const permissions = DEFAULT_PERMISSIONS.operations.salaries;
    expect(permissions.can_view).toBe(false);
  });

  it('covers every gated route in the default permission matrix', () => {
    const pageKeys = routesManifest
      .filter((route) => route.permission)
      .map((route) => route.permission?.replace(/^view_/, ''));

    const roles = Object.keys(DEFAULT_PERMISSIONS) as Array<'admin' | 'hr' | 'finance' | 'operations' | 'viewer'>;
    for (const role of roles) {
      for (const pageKey of pageKeys) {
        expect(DEFAULT_PERMISSIONS[role]).toHaveProperty(pageKey);
      }
    }
  });
});

describe('usePermissions hook', () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.role = null;
    vi.clearAllMocks();
    permissionsServiceMock.getUserPermission.mockResolvedValue(null);
  });

  it('deny-all مؤقتاً أثناء تحميل صلاحيات الصفحة', async () => {
    const createDeferred = <T,>() => {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    };

    const deferred = createDeferred<PagePermission | null>();

    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'admin';
    permissionsServiceMock.getUserPermission.mockReturnValue(deferred.promise);

    const { result } = renderHook(() => usePermissions('employees'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(result.current.permissions).toEqual({
      can_view: false,
      can_edit: false,
      can_delete: false,
    });

    deferred.resolve(null);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions.can_edit).toBe(true);
  });

  it('denies all when no user', async () => {
    const { result } = renderHook(() => usePermissions('employees'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions).toEqual({
      can_view: false,
      can_edit: false,
      can_delete: false,
    });
  });

  it('denies all when user exists but no role (treats as loading)', async () => {
    mockAuthState.user = { id: 'u1' };

    const { result } = renderHook(() => usePermissions('employees'), {
      wrapper: createWrapper(),
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.permissions).toEqual({
      can_view: false,
      can_edit: false,
      can_delete: false,
    });
  });

  it('isAdmin = true for admin role', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'admin';

    const { result } = renderHook(() => usePermissions('employees'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  it('isAdmin = false for non-admin role', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'viewer';

    const { result } = renderHook(() => usePermissions('employees'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(false);
  });

  it('falls back to role defaults when no custom permissions in DB', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'admin';

    const { result } = renderHook(() => usePermissions('salaries'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions).toEqual({
      can_view: true,
      can_edit: true,
      can_delete: true,
    });
  });

  it('viewer gets deny-all on employees', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'viewer';

    const { result } = renderHook(() => usePermissions('employees'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions.can_view).toBe(false);
    expect(result.current.permissions.can_edit).toBe(false);
    expect(result.current.permissions.can_delete).toBe(false);
  });

  it('المشاهد لا يستطيع التعديل', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'viewer';

    const { result } = renderHook(() => usePermissions('maintenance'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions.can_edit).toBe(false);
  });

  it('المشاهد لا يستطيع الحذف', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'viewer';

    const { result } = renderHook(() => usePermissions('maintenance'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions.can_delete).toBe(false);
  });

  it('المسؤول يملك صلاحيات كاملة', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'admin';

    const { result } = renderHook(() => usePermissions('employees'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions).toEqual({
      can_view: true,
      can_edit: true,
      can_delete: true,
    });
  });

  it('المالية: صلاحية الرواتب', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'finance';

    const { result } = renderHook(() => usePermissions('salaries'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions.can_view).toBe(true);
    expect(result.current.permissions.can_edit).toBe(true);
  });

  it('finance role can access the finance module', async () => {
    mockAuthState.user = { id: 'u1' };
    mockAuthState.role = 'finance';

    const { result } = renderHook(() => usePermissions('finance'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.permissions).toEqual({
      can_view: true,
      can_edit: true,
      can_delete: true,
    });
  });
});
