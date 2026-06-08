import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersAndPermissions from './UsersAndPermissions';

const { toastMock, refetchMock, authServiceMock, queryRowsMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  refetchMock: vi.fn().mockResolvedValue(undefined),
  authServiceMock: {
    createManagedUser: vi.fn(),
    deleteManagedUser: vi.fn(),
  },
  queryRowsMock: [
    { id: 'admin-1', name: 'Admin User', isActive: true, role: 'admin' },
    { id: 'user-2', name: 'Second User', isActive: true, role: 'viewer' },
  ],
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: queryRowsMock,
    isLoading: false,
    error: null,
    refetch: refetchMock,
  }),
}));

vi.mock('@shared/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@app/providers/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'admin-1' },
    role: 'admin',
    loading: false,
  }),
}));

vi.mock('@shared/hooks/useAuthQueryGate', () => ({
  useAuthQueryGate: () => ({
    enabled: true,
    userId: 'admin-1',
  }),
  authQueryUserId: (userId?: string | null) => userId ?? '__none__',
}));

vi.mock('@shared/hooks/usePermissions', async () => {
  const actual = await vi.importActual<typeof import('@shared/hooks/usePermissions')>('@shared/hooks/usePermissions');
  return {
    ...actual,
    usePermissions: () => ({
      permissions: { can_view: true, can_edit: true, can_delete: true },
      loading: false,
      isAdmin: true,
    }),
  };
});

vi.mock('@services/userPermissionService', () => ({
  userPermissionService: {
    getUserPermissions: vi.fn().mockResolvedValue([]),
    upsertRole: vi.fn(),
    deletePermission: vi.fn(),
    upsertPermission: vi.fn(),
  },
}));

vi.mock('@services/authService', () => ({
  authService: authServiceMock,
}));

describe('UsersAndPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refetchMock.mockResolvedValue(undefined);
    authServiceMock.createManagedUser.mockResolvedValue({ user_id: 'user-3' });
    authServiceMock.deleteManagedUser.mockResolvedValue(undefined);
  });

  it('allows admins to open the add-user dialog and submit a new user', async () => {
    render(<UsersAndPermissions />);

    fireEvent.click(await screen.findByRole('button', { name: 'إضافة مستخدم' }));

    fireEvent.change(await screen.findByLabelText('الاسم'), {
      target: { value: 'New User' },
    });
    fireEvent.change(await screen.findByLabelText('البريد الإلكتروني'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(await screen.findByLabelText('كلمة المرور'), {
      target: { value: 'password123' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'إنشاء المستخدم' }));

    await waitFor(() =>
      expect(authServiceMock.createManagedUser).toHaveBeenCalledWith({
        name: 'New User',
        email: 'new@example.com',
        password: 'password123',
        role: 'viewer',
      }),
    );
  });

  it('allows admins to delete another user but keeps current-account delete disabled', async () => {
    render(<UsersAndPermissions />);

    const deleteButtons = screen.getAllByRole('button', { name: 'حذف' });
    expect(deleteButtons[0]).toBeDisabled();
    expect(deleteButtons[1]).not.toBeDisabled();

    fireEvent.click(deleteButtons[1]);
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحذف' }));

    await waitFor(() => expect(authServiceMock.deleteManagedUser).toHaveBeenCalledWith('user-2'));
  });
});
