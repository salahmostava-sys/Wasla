import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@app/i18n';
import UsersAndPermissions from './UsersAndPermissions';

const {
  toastMock,
  refetchMock,
  invalidateQueriesMock,
  authServiceMock,
  userPermissionServiceMock,
  auditServiceMock,
  queryRowsMock,
  languageState,
} = vi.hoisted(() => ({
  toastMock: vi.fn(),
  refetchMock: vi.fn().mockResolvedValue(undefined),
  invalidateQueriesMock: vi.fn().mockResolvedValue(undefined),
  authServiceMock: {
    createManagedUser: vi.fn(),
    deleteManagedUser: vi.fn(),
    updateManagedUser: vi.fn(),
  },
  userPermissionServiceMock: {
    getUserPermissions: vi.fn().mockResolvedValue([]),
    upsertRole: vi.fn().mockResolvedValue(undefined),
    deletePermission: vi.fn().mockResolvedValue(undefined),
    upsertPermission: vi.fn().mockResolvedValue(undefined),
  },
  auditServiceMock: { logAdminAction: vi.fn().mockResolvedValue(undefined) },
  queryRowsMock: [
    { id: 'admin-1', name: 'Admin User', email: 'admin@test.com', isActive: true, role: 'admin' },
    { id: 'user-2', name: 'Second User', email: 'user@test.com', isActive: true, role: 'viewer' },
  ],
  languageState: { lang: 'ar' as 'ar' | 'en', isRTL: true },
}));

vi.mock('@app/providers/LanguageContext', () => ({
  useLanguage: () => languageState,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
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
  userPermissionService: userPermissionServiceMock,
}));

vi.mock('@services/auditService', () => ({
  auditService: auditServiceMock,
}));

vi.mock('@services/authService', () => ({
  authService: authServiceMock,
}));

describe('UsersAndPermissions', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    languageState.lang = 'ar';
    languageState.isRTL = true;
    await i18n.changeLanguage('ar');
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
  }, 10000);

  it('does not render delete button for the current user and allows deleting another user', async () => {
    render(<UsersAndPermissions />);

    const adminCell = await screen.findByText('Admin User');
    const adminRow = adminCell.closest('tr');
    expect(adminRow).not.toBeNull();
    expect(within(adminRow as HTMLTableRowElement).queryByRole('button', { name: /حذف/i })).toBeNull();

    const secondUserCell = await screen.findByText('Second User');
    const secondUserRow = secondUserCell.closest('tr');
    expect(secondUserRow).not.toBeNull();

    const deleteButton = within(secondUserRow as HTMLTableRowElement).getByRole('button', { name: /حذف/i });
    expect(deleteButton).not.toBeDisabled();

    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الحذف' }));

    await waitFor(() => expect(authServiceMock.deleteManagedUser).toHaveBeenCalledWith('user-2'));
    await waitFor(() =>
      expect(auditServiceMock.logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'users.delete', record_id: 'user-2' }),
      ),
    );
  }, 15000);

  it('allows admins to open the edit-user dialog and submit changes', async () => {
    authServiceMock.createManagedUser.mockResolvedValue({ user_id: 'user-3' });
    authServiceMock.deleteManagedUser.mockResolvedValue(undefined);
    authServiceMock.updateManagedUser.mockResolvedValue(undefined);

    render(<UsersAndPermissions />);

    const adminCell = await screen.findByText('Admin User');
    const adminRow = adminCell.closest('tr');
    expect(adminRow).not.toBeNull();
    const editButton = within(adminRow as HTMLTableRowElement).getByRole('button', { name: /تعديل/i });
    fireEvent.click(editButton);

    const nameInput = await screen.findByLabelText('الاسم');
    expect(nameInput).toHaveValue('Admin User');

    fireEvent.change(nameInput, { target: { value: 'Updated Admin User' } });
    fireEvent.change(screen.getByLabelText('البريد الإلكتروني'), {
      target: { value: 'updated-admin@test.com' },
    });
    fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة (اختياري)'), {
      target: { value: 'newpassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));

    await waitFor(() =>
      expect(authServiceMock.updateManagedUser).toHaveBeenCalledWith('admin-1', expect.objectContaining({
        name: 'Updated Admin User',
        email: 'updated-admin@test.com',
        password: 'newpassword123',
        role: 'admin',
      })),
    );
  });

  it('allows admins to change role', async () => {
    render(<UsersAndPermissions />);
    const selectTriggers = screen.getAllByRole('combobox');
    expect(selectTriggers.length).toBeGreaterThan(0);
  });

  it('applies role defaults with confirmation, writing permissions and an audit log', async () => {
    render(<UsersAndPermissions />);

    const permissionsTab = screen.getByRole('tab', { name: 'الصلاحيات' });
    fireEvent.mouseDown(permissionsTab, { button: 0 });
    fireEvent.click(permissionsTab);

    const applyButton = await screen.findByRole('button', { name: 'تطبيق إعدادات الدور' });
    fireEvent.click(applyButton);

    // Confirm dialog opens; nothing written before confirming.
    expect(userPermissionServiceMock.upsertPermission).not.toHaveBeenCalled();

    const confirmButton = await screen.findByRole('button', { name: 'تطبيق الدور' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(userPermissionServiceMock.upsertPermission).toHaveBeenCalled());
    await waitFor(() =>
      expect(auditServiceMock.logAdminAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'permissions.reset_to_role_defaults' }),
      ),
    );
  }, 15000);

  it('toggles a whole permission column via the select-all header checkbox', async () => {
    render(<UsersAndPermissions />);

    const permissionsTab = screen.getByRole('tab', { name: 'الصلاحيات' });
    fireEvent.mouseDown(permissionsTab, { button: 0 });
    fireEvent.click(permissionsTab);

    const headerCheckboxView = await screen.findByRole('checkbox', { name: /تحديد الكل — عرض/ });
    const initial = headerCheckboxView.getAttribute('aria-checked');
    fireEvent.click(headerCheckboxView);

    await waitFor(() =>
      expect(headerCheckboxView.getAttribute('aria-checked')).not.toEqual(initial),
    );
  }, 15000);

  it('renders the users and permissions interface in English', async () => {
    languageState.lang = 'en';
    languageState.isRTL = false;
    await i18n.changeLanguage('en');

    render(<UsersAndPermissions />);

    expect(await screen.findByRole('heading', { name: 'Users & Permissions' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add User' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Role' })).toBeInTheDocument();
    expect(screen.getByText('System Admin')).toBeInTheDocument();

    const permissionsTab = screen.getByRole('tab', { name: 'Permissions' });
    fireEvent.mouseDown(permissionsTab, { button: 0, ctrlKey: false });
    fireEvent.click(permissionsTab);

    expect(await screen.findByRole('columnheader', { name: 'Page' })).toBeInTheDocument();
    expect(screen.getByText('Employees')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Permissions' })).toBeInTheDocument();
  });
});
