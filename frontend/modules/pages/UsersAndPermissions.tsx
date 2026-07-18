import { BaseInput } from '@shared/components/ui/base-input';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation, type TFunction } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  RefreshCw,
  AlertCircle,
  UserPlus,
  Trash2,
  Pencil,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@shared/components/ui/alert';
import { Label } from '@shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { getErrorMessage } from '@services/serviceError';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { useToast } from '@shared/hooks/use-toast';
import { authService } from '@services/authService';
import { userPermissionService } from '@services/userPermissionService';
import { auditService } from '@services/auditService';
import { useAuth } from '@app/providers/AuthContext';
import { useLanguage } from '@app/providers/LanguageContext';
import type { AppLanguage } from '@app/i18n/language';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions, DEFAULT_PERMISSIONS, type AppRole, type PagePermission } from '@shared/hooks/usePermissions';
import { PERMISSION_PAGE_ENTRIES } from '@shared/constants/permissionPages';
import { defaultQueryRetry } from '@shared/lib/query';
import { cn } from '@shared/lib/utils';
import { ScrollArea, ScrollBar } from '@shared/components/ui/scroll-area';
import { Input } from '@shared/components/ui/input';

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  is_active: boolean | null;
};

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  isActive: boolean;
  role: AppRole;
};

const EMPTY_USER_ROWS: UserRow[] = [];

const ROLES: AppRole[] = ['admin', 'hr', 'finance', 'operations', 'viewer'];

const ROLE_LABEL_KEYS: Record<AppRole, string> = {
  admin: 'admin',
  hr: 'hr_role',
  finance: 'finance_role',
  operations: 'operations_role',
  viewer: 'viewer',
};

const EMPTY_NEW_USER_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'viewer' as AppRole,
};

type PermissionField = keyof PagePermission;

const PERMISSION_COLUMNS: { field: PermissionField; labelKey: string }[] = [
  { field: 'can_view', labelKey: 'view' },
  { field: 'can_edit', labelKey: 'edit' },
  { field: 'can_delete', labelKey: 'delete' },
];

function getSearchClasses(isRTL: boolean) {
  return {
    icon: cn(
      'absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
      isRTL ? 'right-3' : 'left-3',
    ),
    input: isRTL ? 'pr-9' : 'pl-9',
  };
}

function getDirection(isRTL: boolean): 'rtl' | 'ltr' {
  return isRTL ? 'rtl' : 'ltr';
}

function getPermissionPageLabel(
  entry: (typeof PERMISSION_PAGE_ENTRIES)[number],
  lang: AppLanguage,
) {
  return lang === 'ar' ? entry.labelAr : entry.labelEn;
}

function UserStatusBadge({ isActive, t }: Readonly<{ isActive: boolean; t: TFunction }>) {
  return (
    <span className={cn(
      'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium',
      isActive ? 'bg-green-500/10 text-green-700' : 'bg-destructive/10 text-destructive',
    )}>
      <span className={cn('h-2 w-2 rounded-full', isActive ? 'bg-green-500' : 'bg-destructive')} />
      {isActive ? t('active') : t('inactive')}
    </span>
  );
}

function mergeMatrix(
  role: AppRole,
  dbRows: { permission_key: string; can_view: boolean; can_edit: boolean; can_delete: boolean }[]
): Record<string, PagePermission> {
  const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.viewer;
  const dbMap = Object.fromEntries(dbRows.map((r) => [r.permission_key, r]));
  const out: Record<string, PagePermission> = {};
  for (const { key } of PERMISSION_PAGE_ENTRIES) {
    const row = dbMap[key];
    const def = defaults[key] ?? { can_view: false, can_edit: false, can_delete: false };
    out[key] = row
      ? { can_view: row.can_view, can_edit: row.can_edit, can_delete: row.can_delete }
      : { ...def };
  }
  return out;
}

function getPermissionUpserts(matrix: Record<string, PagePermission>, userId: string) {
  return PERMISSION_PAGE_ENTRIES.map(({ key }) => {
    const cur = matrix[key];
    if (!cur) return Promise.resolve();
    return userPermissionService.upsertPermission(userId, key, cur);
  });
}

function getDefaultPermissionUpserts(userId: string, role: AppRole) {
  const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.viewer;
  return PERMISSION_PAGE_ENTRIES.map(({ key }) =>
    userPermissionService.upsertPermission(
      userId,
      key,
      defaults[key] ?? { can_view: false, can_edit: false, can_delete: false },
    )
  );
}

function validateUserForm(t: TFunction, name: string, email: string, password?: string): string | null {
  if (!name) return t('nameRequired');
  if (!email?.includes('@')) return t('invalidEmail');
  if (password !== undefined && password.length < 8) return t('passwordMinimum');
  return null;
}

async function handleUserDeletion(params: {
  target: UserRow | null;
  currentUserId: string | null;
  authService: typeof import('@services/authService').authService;
  setDeletingUserId: (id: string | null) => void;
  setPermUserId: (id: string | null) => void;
  setDeleteTarget: (target: null) => void;
  refetchUsersData: () => Promise<unknown>;
  toast: (props: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void;
  permUserId: string | null;
  t: TFunction;
}) {
  const { target, currentUserId, authService, setDeletingUserId, setPermUserId, setDeleteTarget, refetchUsersData, toast, permUserId, t } = params;
  if (!target) return;
  if (target.id === currentUserId) {
    toast({
      title: t('notAllowed'),
      description: t('cannotDeleteCurrentUser'),
      variant: 'destructive',
    });
    return;
  }

  setDeletingUserId(target.id);
  try {
    await authService.deleteManagedUser(target.id);
    toast({ title: t('userDeleted') });
    if (permUserId === target.id) {
      setPermUserId(null);
    }
    setDeleteTarget(null);
    await refetchUsersData();
  } catch (err: unknown) {
    const message = getErrorMessage(err, t('userDeleteFailed'));
    toast({
      title: t('userDeleteFailed'),
      description: message,
      variant: 'destructive',
    });
  } finally {
    setDeletingUserId(null);
  }
}

interface UsersAndPermissionsProps {
  embedded?: boolean;
}

function CreateUserDialog({
  open,
  setOpen,
  creatingUser,
  newUserForm,
  updateNewUserField,
  resetNewUserForm,
  createUser
}: Readonly<{
  open: boolean;
  setOpen: (o: boolean) => void;
  creatingUser: boolean;
  newUserForm: typeof EMPTY_NEW_USER_FORM;
  updateNewUserField: <K extends keyof typeof EMPTY_NEW_USER_FORM>(key: K, value: (typeof EMPTY_NEW_USER_FORM)[K]) => void;
  resetNewUserForm: () => void;
  createUser: () => void;
}>) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen && !creatingUser) resetNewUserForm();
      }}
    >
      <DialogContent className="sm:max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{t('addUserTitle')}</DialogTitle>
          <DialogDescription>
            {t('addUserDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <BaseInput label={t('userName')} id="new-user-name"
              value={newUserForm.name}
              onChange={(event) => updateNewUserField('name', event.target.value)}
              placeholder={t('userNamePlaceholder')}
              disabled={creatingUser} />

          <BaseInput label={t('email')} id="new-user-email"
              type="email"
              value={newUserForm.email}
              onChange={(event) => updateNewUserField('email', event.target.value)}
              placeholder="user@example.com"
              disabled={creatingUser} />

          <BaseInput label={t('password')} id="new-user-password"
              type="password"
              value={newUserForm.password}
              onChange={(event) => updateNewUserField('password', event.target.value)}
              placeholder={t('passwordMinimumPlaceholder')}
              disabled={creatingUser} />

          <div className="space-y-2">
            <Label>{t('role')}</Label>
            <Select
              value={newUserForm.role}
              onValueChange={(value) => updateNewUserField('role', value as AppRole)}
              disabled={creatingUser}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('selectRole')} />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {t(ROLE_LABEL_KEYS[role])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetNewUserForm();
            }}
            disabled={creatingUser}
          >
            {t('cancel')}
          </Button>
          <Button type="button" onClick={() => { createUser(); }} disabled={creatingUser}>
            {creatingUser ? t('creatingUser') : t('createUser')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const UsersAndPermissions = ({ embedded = false }: Readonly<UsersAndPermissionsProps>) => {
  const { t } = useTranslation();
  const { lang, isRTL } = useLanguage();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions: settingsPerm } = usePermissions('settings');

  const [rows, setRows] = useState<UserRow[]>([]);
  const {
    data: usersRows = EMPTY_USER_ROWS,
    isLoading: loading,
    error: usersError,
    refetch: refetchUsersData,
  } = useQuery({
    queryKey: ['users-and-permissions', uid, 'rows'],
    enabled,
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        userPermissionService.getProfiles(),
        userPermissionService.getUserRoles(),
      ]);

      const roleMap: Record<string, AppRole> = {};
      (roles || []).forEach((r) => {
        roleMap[r.user_id] = (r.role) || 'viewer';
      });

      return ((profiles || []) as ProfileRow[]).map((p) => ({
        id: p.id,
        name: p.name || '',
        email: p.email,
        isActive: p.is_active ?? true,
        role: roleMap[p.id] || 'viewer',
      }));
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [permUserId, setPermUserId] = useState<string | null>(null);
  const [matrix, setMatrix] = useState<Record<string, PagePermission>>({});
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState(EMPTY_NEW_USER_FORM);
  const [creatingUser, setCreatingUser] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<UserRow | null>(null);
  const [editUserForm, setEditUserForm] = useState({ name: '', email: '', password: '', role: 'viewer' as AppRole, isActive: true });
  const [editingUser, setEditingUser] = useState(false);

  // Access to this page (viewing and managing other users' roles/permissions) is driven by the
  // "settings" permission itself, not hardcoded to the admin role — an admin can delegate it to
  // anyone via the permissions matrix below (see supabase/migrations/*_allow_settings_delegate_*).
  const canView = settingsPerm.can_view;
  const canEdit = settingsPerm.can_edit;
  const canDelete = settingsPerm.can_delete;
  const currentUserId = user?.id ?? null;
  const direction = getDirection(isRTL);
  const searchClasses = getSearchClasses(isRTL);

  useEffect(() => {
    setRows(usersRows);
  }, [usersRows]);

  useEffect(() => {
    if (!usersError) return;
    const message = getErrorMessage(usersError, t('usersPermissionsLoadError'));
    toast({
      title: t('usersLoadErrorTitle'),
      description: message,
      variant: 'destructive',
    });
  }, [usersError, t, toast]);

  const selectedUser = useMemo(() => rows.find((r) => r.id === permUserId) ?? null, [rows, permUserId]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => 
      r.name.toLowerCase().includes(q) || 
      r.email?.toLowerCase().includes(q)
    );
  }, [rows, searchQuery]);

  const loadMatrix = useCallback(async (userId: string, role: AppRole) => {
    if (!canView) return;
    setMatrixLoading(true);
    try {
      const data = await userPermissionService.getUserPermissions(userId);
      setMatrix(mergeMatrix(role, (data || [])));
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('permissionsLoadError'));
      toast({ title: t('errorLoading'), description: message, variant: 'destructive' });
    } finally {
      setMatrixLoading(false);
    }
  }, [canView, t, toast]);

  useEffect(() => {
    if (rows.length && !permUserId) {
      setPermUserId(rows[0].id);
    }
  }, [rows, permUserId]);

  useEffect(() => {
    if (!permUserId || !canView) return;
    const u = rows.find((r) => r.id === permUserId);
    if (!u) return;
    loadMatrix(u.id, u.role).catch(() => {});
  }, [permUserId, rows, canView, loadMatrix]);

  const updateRole = async (userId: string, role: AppRole) => {
    if (!canEdit) return;
    setSavingId(userId);
    try {
      await userPermissionService.upsertRole(userId, role);

      setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role } : r)));
      toast({ title: t('roleUpdated') });
      if (userId === permUserId) {
        await loadMatrix(userId, role);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('errorSaving'));
      toast({
        title: t('roleUpdateFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSavingId(null);
    }
  };

  const setCell = (pageKey: string, field: keyof PagePermission, value: boolean) => {
    setMatrix((prev) => ({
      ...prev,
      [pageKey]: { ...prev[pageKey], [field]: value },
    }));
  };

  const saveMatrix = async () => {
    if (!canEdit || !selectedUser) return;
    setSavingMatrix(true);
    try {
      // Persist the full frontend-selected matrix. Role defaults are only templates for
      // first-time setup, not the source of truth after the admin saves permissions.
      await Promise.all(getPermissionUpserts(matrix, selectedUser.id));
      await auditService.logAdminAction({
        action: 'permissions.update',
        table_name: 'user_permissions',
        record_id: selectedUser.id,
        meta: { target_user_role: selectedUser.role },
      });
      toast({ title: t('permissionsSaved') });
      await queryClient.invalidateQueries({ queryKey: ['permissions', selectedUser.id] });
      await loadMatrix(selectedUser.id, selectedUser.role);
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('permissionsSaveFailed'));
      toast({ title: t('errorSaving'), description: message, variant: 'destructive' });
    } finally {
      setSavingMatrix(false);
    }
  };

  const updateNewUserField = <K extends keyof typeof EMPTY_NEW_USER_FORM>(
    key: K,
    value: (typeof EMPTY_NEW_USER_FORM)[K],
  ) => {
    setNewUserForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetNewUserForm = () => {
    setNewUserForm(EMPTY_NEW_USER_FORM);
  };

  const createUser = async () => {
    if (!canEdit) return;
    const name = newUserForm.name.trim();
    const email = newUserForm.email.trim().toLowerCase();
    const password = newUserForm.password;

    const errorMsg = validateUserForm(t, name, email, password);
    if (errorMsg) {
      toast({ title: errorMsg, variant: 'destructive' });
      return;
    }

    setCreatingUser(true);
    try {
      const created = await authService.createManagedUser({
        name,
        email,
        password,
        role: newUserForm.role,
      });
      await Promise.all(getDefaultPermissionUpserts(created.user_id, newUserForm.role));
      toast({ title: t('userCreated') });
      setCreateUserOpen(false);
      resetNewUserForm();
      await refetchUsersData();
      if (created.user_id) {
        setPermUserId(created.user_id);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('userCreateFailed'));
      toast({
        title: t('userCreateFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCreatingUser(false);
    }
  };

  const openEditModal = (row: UserRow) => {
    setEditTarget(row);
    setEditUserForm({
      name: row.name,
      email: row.email || '',
      password: '',
      role: row.role,
      isActive: row.isActive,
    });
  };

  const saveEditUser = async () => {
    if (!canEdit || !editTarget) return;
    const name = editUserForm.name.trim();
    const email = editUserForm.email.trim().toLowerCase();
    const password = editUserForm.password;

    const errorMsg = validateUserForm(t, name, email, password || undefined);
    if (errorMsg) {
      toast({ title: errorMsg, variant: 'destructive' });
      return;
    }

    setEditingUser(true);
    try {
      await authService.updateManagedUser(editTarget.id, {
        name,
        email,
        password: password || undefined,
        role: editUserForm.role,
        is_active: editUserForm.isActive,
      });
      await auditService.logAdminAction({
        action: 'users.update',
        table_name: 'auth.users',
        record_id: editTarget.id,
        meta: { name, email, role: editUserForm.role, is_active: editUserForm.isActive },
      });
      toast({ title: t('userUpdated') });
      setEditTarget(null);
      await refetchUsersData();
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('userUpdateFailed'));
      toast({
        title: t('userUpdateFailed'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setEditingUser(false);
    }
  };

  const deleteUser = async () => {
    if (!canDelete || !deleteTarget) return;
    await handleUserDeletion({
      target: deleteTarget,
      currentUserId,
      authService,
      setDeletingUserId,
      setPermUserId,
      setDeleteTarget,
      refetchUsersData,
      toast,
      permUserId,
      t,
    });
  };

  if (authLoading) {
    return (
      <div className="border bg-card p-6 text-sm text-muted-foreground rounded-2xl" dir={direction}>
        {t('sessionChecking')}
      </div>
    );
  }

  if (!canView) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t('unavailable')}</AlertTitle>
        <AlertDescription>
          {t('manageUsersAccessDenied')}
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="border bg-card p-6 text-sm text-muted-foreground rounded-2xl" dir={direction}>
        {t('usersPermissionsLoading')}
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={direction}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${embedded ? 'text-lg' : 'text-xl'} font-bold flex items-center gap-2`}>
            <Shield size={18} className="me-1" />
            {t('usersPermissionsTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('usersPermissionsDescription')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button type="button" className="gap-2" onClick={() => setCreateUserOpen(true)}>
              <UserPlus size={14} className="me-1" />
              {t('addUser')}
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => refetchUsersData().catch(() => {})}>
            <RefreshCw size={14} className="me-1" />
            {t('refresh')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="users">{t('users')}</TabsTrigger>
          <TabsTrigger value="permissions">{t('permissions')}</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className={searchClasses.icon} />
              <Input
                placeholder={t('searchUsersPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={searchClasses.input}
              />
            </div>

            <div className="rounded-2xl border bg-card overflow-hidden">
              <ScrollArea className="w-full">
                <table className="data-table w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="ta-th text-start">{t('userName')}</th>
                      <th className="ta-th text-start">{t('role')}</th>
                      <th className="ta-th text-start">{t('email')}</th>
                      <th className="ta-th text-start">{t('status')}</th>
                      <th className="ta-th text-start">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length > 0 ? (
                      filteredRows.map((row) => (
                        <tr
                          key={row.id}
                          className={cn(
                            "border-b last:border-0 hover:bg-muted/20",
                            row.id === permUserId && "bg-primary/5"
                          )}
                        >
                          <td className="ta-td font-semibold">{row.name || t('unnamedUser')}</td>
                          <td className="ta-td">
                            <Select
                              value={row.role}
                              onValueChange={(value) => updateRole(row.id, value as AppRole)}
                              disabled={!canEdit || savingId === row.id}
                            >
                              <SelectTrigger className="h-9 w-[170px]">
                                <SelectValue placeholder={t('selectRole')} />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((roleOption) => (
                                  <SelectItem key={roleOption} value={roleOption}>
                                    {t(ROLE_LABEL_KEYS[roleOption])}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="ta-td text-muted-foreground" dir="ltr">
                            {row.email || t('noEmail')}
                          </td>
                          <td className="ta-td">
                            <UserStatusBadge isActive={row.isActive} t={t} />
                          </td>
                          <td className="ta-td">
                            <div className="flex flex-wrap items-center gap-2">
                              {canEdit && (
                                <Button variant="outline" size="sm" onClick={() => openEditModal(row)}>
                                  <Pencil size={14} className="me-1" /> {t('edit')}
                                </Button>
                              )}
                              {canDelete && row.id !== currentUserId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteTarget(row)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 size={14} className="me-1" /> {t('delete')}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="ta-td py-10 text-center text-muted-foreground">
                          {t('noSearchResults')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          {selectedUser ? (
            <div className="border bg-card rounded-2xl p-5 flex flex-col">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b">
                <div>
                  <h3 className="text-lg font-bold">{selectedUser.name || t('unnamedUser')}</h3>
                  <p className="text-sm text-muted-foreground">{t('accessCustomization')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedUser.id}
                    onValueChange={(value) => setPermUserId(value)}
                    disabled={rows.length === 0 || matrixLoading || savingMatrix}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder={t('selectUser')} />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.name || t('unnamedUser')} - {t(ROLE_LABEL_KEYS[row.role])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => { saveMatrix(); }}
                    disabled={savingMatrix || matrixLoading || !canEdit}
                  >
                    {savingMatrix ? t('savingPermissions') : t('savePermissions')}
                  </Button>
                </div>
              </div>

              <div className="pt-4">
                {matrixLoading ? (
                  <div className="py-10 flex items-center justify-center text-sm text-muted-foreground">
                    {t('permissionsLoading')}
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="data-table data-table-compact w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="ta-th text-start w-[40%]">{t('page')}</th>
                          {PERMISSION_COLUMNS.map(({ field, labelKey }) => (
                            <th key={field} className="ta-th">{t(labelKey)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PERMISSION_PAGE_ENTRIES.map((entry) => {
                          const { key } = entry;
                          const m = matrix[key];
                          if (!m) return null;
                          return (
                            <tr key={key} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="ta-td font-medium py-1">{getPermissionPageLabel(entry, lang)}</td>
                              {PERMISSION_COLUMNS.map(({ field }) => (
                                <td key={field} className="ta-td py-1 text-center">
                                  <Checkbox
                                    checked={m[field]}
                                    onCheckedChange={(checked) => setCell(key, field, checked === true)}
                                    disabled={!canEdit}
                                    className="mx-auto"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border bg-card rounded-2xl p-5 flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <ShieldAlert className="h-12 w-12 opacity-20 mb-3" />
              <p>{t('noUsersForPermissions')}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateUserDialog
        open={createUserOpen}
        setOpen={setCreateUserOpen}
        creatingUser={creatingUser}
        newUserForm={newUserForm}
        updateNewUserField={updateNewUserField}
        resetNewUserForm={resetNewUserForm}
        createUser={createUser}
      />

      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open && !editingUser) setEditTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md" dir={direction}>
          <DialogHeader>
            <DialogTitle>{t('editUserTitle')}</DialogTitle>
            <DialogDescription>
              {t('editUserDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <BaseInput label={t('userName')} id="edit-user-name"
                value={editUserForm.name}
                onChange={(e) => setEditUserForm(p => ({ ...p, name: e.target.value }))}
                placeholder={t('userNamePlaceholder')}
                disabled={editingUser} />

            <BaseInput label={t('email')} id="edit-user-email"
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm(p => ({ ...p, email: e.target.value }))}
                placeholder="example@muhimmat.com"
                dir="ltr"
                disabled={editingUser} />

            <div className="space-y-2">
              <Label>{t('role')}</Label>
              <Select
                value={editUserForm.role}
                onValueChange={(value) => setEditUserForm((p) => ({ ...p, role: value as AppRole }))}
                disabled={editingUser}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectRole')} />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {t(ROLE_LABEL_KEYS[role])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 pt-2 pb-2">
              <Checkbox
                id="edit-user-active"
                checked={editUserForm.isActive}
                onCheckedChange={(checked) => setEditUserForm(p => ({ ...p, isActive: !!checked }))}
                disabled={editingUser}
              />
              <label htmlFor="edit-user-active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                {t('activeUserHint')}
              </label>
            </div>

            <BaseInput label={t('newPasswordOptional')} id="edit-user-password"
                type="password"
                value={editUserForm.password}
                onChange={(e) => setEditUserForm(p => ({ ...p, password: e.target.value }))}
                placeholder={t('leavePasswordEmpty')}
                disabled={editingUser} />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editingUser}
            >
              {t('cancel')}
            </Button>
            <Button type="button" onClick={() => { saveEditUser(); }} disabled={editingUser}>
              {editingUser ? t('saving') : t('saveChanges')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingUserId) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent dir={direction}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteUserTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t('deleteUserNamedDescription', { name: deleteTarget.name || t('unnamedUser') })
                : t('deleteUserDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUserId !== null}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteUser(); }}
              disabled={deletingUserId !== null}
            >
              {deletingUserId ? t('deletingUser') : t('confirmDelete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersAndPermissions;
