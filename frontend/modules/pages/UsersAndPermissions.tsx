import { BaseInput } from '@shared/components/ui/base-input';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions, DEFAULT_PERMISSIONS, type AppRole, type PagePermission } from '@shared/hooks/usePermissions';
import { PERMISSION_PAGE_ENTRIES } from '@shared/constants/permissionPages';
import { defaultQueryRetry } from '@shared/lib/query';
import { cn } from '@shared/lib/utils';
import { ScrollArea } from '@shared/components/ui/scroll-area';
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

const ROLES: AppRole[] = ['admin', 'hr', 'finance', 'operations', 'viewer'];

const ROLE_LABELS_AR: Record<AppRole, string> = {
  admin: 'مدير النظام',
  hr: 'موارد بشرية',
  finance: 'مالية',
  operations: 'عمليات',
  viewer: 'عرض فقط',
};

const EMPTY_NEW_USER_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'viewer' as AppRole,
};

type PermissionField = keyof PagePermission;

const PERMISSION_COLUMNS: { field: PermissionField; label: string }[] = [
  { field: 'can_view', label: 'عرض' },
  { field: 'can_edit', label: 'تعديل' },
  { field: 'can_delete', label: 'حذف' },
];

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

function getPermissionUpdates(matrix: Record<string, PagePermission>, userId: string, roleDefaults: Record<string, PagePermission>) {
  return PERMISSION_PAGE_ENTRIES.map(({ key }) => {
    const cur = matrix[key];
    if (!cur) return Promise.resolve();
    const def = roleDefaults[key] ?? { can_view: false, can_edit: false, can_delete: false };
    const same =
      cur.can_view === def.can_view && cur.can_edit === def.can_edit && cur.can_delete === def.can_delete;
    if (same) {
      return userPermissionService.deletePermission(userId, key);
    }
    return userPermissionService.upsertPermission(userId, key, cur);
  });
}

function validateUserForm(name: string, email: string, password?: string): string | null {
  if (!name) return 'الاسم مطلوب';
  if (!email?.includes('@')) return 'البريد الإلكتروني غير صالح';
  if (password !== undefined && password && password.length < 8) return 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.';
  if (password === '' && arguments.length === 3) return 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.'; // For create
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
}) {
  const { target, currentUserId, authService, setDeletingUserId, setPermUserId, setDeleteTarget, refetchUsersData, toast, permUserId } = params;
  if (!target) return;
  if (target.id === currentUserId) {
    toast({
      title: 'غير مسموح',
      description: 'لا يمكن حذف الحساب الحالي.',
      variant: 'destructive',
    });
    return;
  }

  setDeletingUserId(target.id);
  try {
    await authService.deleteManagedUser(target.id);
    toast({ title: 'تم حذف المستخدم بنجاح' });
    if (permUserId === target.id) {
      setPermUserId(null);
    }
    setDeleteTarget(null);
    await refetchUsersData();
  } catch (err: unknown) {
    const message = getErrorMessage(err, 'تعذر حذف المستخدم');
    toast({
      title: 'فشل حذف المستخدم',
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
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen && !creatingUser) resetNewUserForm();
      }}
    >
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>إضافة مستخدم جديد</DialogTitle>
          <DialogDescription>
            سيتم إنشاء حساب جديد يمكنه تسجيل الدخول مباشرة، ثم يُسند له الدور الذي تختاره.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <BaseInput label="الاسم" id="new-user-name"
              value={newUserForm.name}
              onChange={(event) => updateNewUserField('name', event.target.value)}
              placeholder="اسم المستخدم"
              disabled={creatingUser} />

          <BaseInput label="البريد الإلكتروني" id="new-user-email"
              type="email"
              value={newUserForm.email}
              onChange={(event) => updateNewUserField('email', event.target.value)}
              placeholder="user@example.com"
              disabled={creatingUser} />

          <BaseInput label="كلمة المرور" id="new-user-password"
              type="password"
              value={newUserForm.password}
              onChange={(event) => updateNewUserField('password', event.target.value)}
              placeholder="8 أحرف على الأقل"
              disabled={creatingUser} />

          <div className="space-y-2">
            <Label>الدور</Label>
            <Select
              value={newUserForm.role}
              onValueChange={(value) => updateNewUserField('role', value as AppRole)}
              disabled={creatingUser}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر الدور" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS_AR[role]}
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
            إلغاء
          </Button>
          <Button type="button" onClick={() => { createUser(); }} disabled={creatingUser}>
            {creatingUser ? 'جارٍ الإنشاء...' : 'إنشاء المستخدم'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const UsersAndPermissions = ({ embedded = false }: Readonly<UsersAndPermissionsProps>) => {
  const { toast } = useToast();
  const { user, role: authRole, loading: authLoading } = useAuth();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const { permissions: settingsPerm } = usePermissions('settings');

  const [rows, setRows] = useState<UserRow[]>([]);
  const {
    data: usersRows = [],
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
        name: p.name || 'بدون اسم',
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

  const isAdmin = authRole === 'admin';
  // Access to this page (viewing and managing other users' roles/permissions) is driven by the
  // "settings" permission itself, not hardcoded to the admin role — an admin can delegate it to
  // anyone via the permissions matrix below (see supabase/migrations/*_allow_settings_delegate_*).
  const canView = settingsPerm.can_view || isAdmin;
  const canEdit = settingsPerm.can_edit || isAdmin;
  const canDelete = settingsPerm.can_delete || isAdmin;
  const currentUserId = user?.id ?? null;

  useEffect(() => {
    setRows(usersRows);
  }, [usersRows]);

  useEffect(() => {
    if (!usersError) return;
    const message = getErrorMessage(usersError, 'تعذر تحميل بيانات المستخدمين والصلاحيات');
    toast({
      title: 'خطأ في تحميل المستخدمين',
      description: message,
      variant: 'destructive',
    });
  }, [usersError, toast]);

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
      const message = getErrorMessage(err, 'تعذر تحميل الصلاحيات');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    } finally {
      setMatrixLoading(false);
    }
  }, [canView, toast]);

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
      toast({ title: 'تم تحديث الدور' });
      if (userId === permUserId) {
        await loadMatrix(userId, role);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'حدث خطأ أثناء الحفظ');
      toast({
        title: 'فشل تحديث الدور',
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
      const roleDefaults = DEFAULT_PERMISSIONS[selectedUser.role] || DEFAULT_PERMISSIONS.viewer;
      // Execute all permission updates in parallel instead of sequentially
      await Promise.all(getPermissionUpdates(matrix, selectedUser.id, roleDefaults));
      await auditService.logAdminAction({
        action: 'permissions.update',
        table_name: 'user_permissions',
        record_id: selectedUser.id,
        meta: { target_user_role: selectedUser.role },
      });
      toast({ title: 'تم حفظ الصلاحيات' });
      await loadMatrix(selectedUser.id, selectedUser.role);
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'فشل الحفظ');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
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

    const errorMsg = validateUserForm(name, email, password);
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
      toast({ title: 'تم إنشاء المستخدم بنجاح' });
      setCreateUserOpen(false);
      resetNewUserForm();
      await refetchUsersData();
      if (created.user_id) {
        setPermUserId(created.user_id);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'تعذر إنشاء المستخدم');
      toast({
        title: 'فشل إنشاء المستخدم',
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

    const errorMsg = validateUserForm(name, email, password || undefined);
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
      toast({ title: 'تم التحديث بنجاح' });
      setEditTarget(null);
      await refetchUsersData();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'تعذر تحديث المستخدم');
      toast({
        title: 'خطأ أثناء التحديث',
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
      permUserId
    });
  };

  if (authLoading) {
    return (
      <div className="border bg-card p-6 text-sm text-muted-foreground rounded-2xl">
        جاري التحقق من الجلسة...
      </div>
    );
  }

  if (!canView) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>غير متاح</AlertTitle>
        <AlertDescription>
          ليس لديك صلاحية الوصول لإدارة المستخدمين والأدوار والصلاحيات. تواصل مع مدير النظام لمنحك هذه الصلاحية.
        </AlertDescription>
      </Alert>
    );
  }

  if (loading) {
    return (
      <div className="border bg-card p-6 text-sm text-muted-foreground rounded-2xl">
        جاري تحميل المستخدمين والصلاحيات...
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={`${embedded ? 'text-lg' : 'text-xl'} font-bold flex items-center gap-2`}>
            <Shield size={18} className="me-1" />
            المستخدمون والصلاحيات
          </h2>
          <p className="text-sm text-muted-foreground">
            إدارة حسابات المستخدمين وصلاحيات وصولهم للصفحات بسهولة.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button type="button" className="gap-2" onClick={() => setCreateUserOpen(true)}>
              <UserPlus size={14} className="me-1" />
              إضافة مستخدم
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={() => refetchUsersData().catch(() => {})}>
            <RefreshCw size={14} className="me-1" />
            تحديث
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="users">المستخدمون</TabsTrigger>
          <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو البريد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>

            <div className="rounded-2xl border bg-card overflow-hidden">
              <ScrollArea className="w-full">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="ta-th text-start">الاسم</th>
                      <th className="ta-th text-start">الدور</th>
                      <th className="ta-th text-start">البريد</th>
                      <th className="ta-th text-start">الحالة</th>
                      <th className="ta-th text-start">الإجراءات</th>
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
                          <td className="ta-td font-semibold">{row.name}</td>
                          <td className="ta-td">
                            <Select
                              value={row.role}
                              onValueChange={(value) => updateRole(row.id, value as AppRole)}
                              disabled={!canEdit || savingId === row.id}
                            >
                              <SelectTrigger className="h-9 w-[170px]">
                                <SelectValue placeholder="اختر الدور" />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((roleOption) => (
                                  <SelectItem key={roleOption} value={roleOption}>
                                    {ROLE_LABELS_AR[roleOption]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="ta-td text-muted-foreground" dir="ltr">
                            {row.email || 'لا يوجد بريد إلكتروني'}
                          </td>
                          <td className="ta-td">
                            <span className={cn(
                              "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium",
                              row.isActive ? "bg-green-500/10 text-green-700" : "bg-destructive/10 text-destructive"
                            )}>
                              <span className={cn("h-2 w-2 rounded-full", row.isActive ? "bg-green-500" : "bg-destructive")} />
                              {row.isActive ? 'نشط' : 'موقوف'}
                            </span>
                          </td>
                          <td className="ta-td">
                            <div className="flex flex-wrap items-center gap-2">
                              {canEdit && (
                                <Button variant="outline" size="sm" onClick={() => openEditModal(row)}>
                                  <Pencil size={14} className="me-1" /> تعديل
                                </Button>
                              )}
                              {canDelete && row.id !== currentUserId && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteTarget(row)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 size={14} className="me-1" /> حذف
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="ta-td py-10 text-center text-muted-foreground">
                          لا توجد نتائج للبحث.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          {selectedUser ? (
            <div className="border bg-card rounded-2xl p-5 flex flex-col h-[600px]">
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b">
                <div>
                  <h3 className="text-lg font-bold">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">تخصيص صلاحيات الوصول للصفحات</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedUser.id}
                    onValueChange={(value) => setPermUserId(value)}
                    disabled={rows.length === 0 || matrixLoading || savingMatrix}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="اختر المستخدم" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.name} - {ROLE_LABELS_AR[row.role]}
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
                    {savingMatrix ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                  </Button>
                </div>
              </div>

              <div className="flex-1 overflow-hidden flex flex-col pt-4">
                {matrixLoading ? (
                  <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                    جاري تحميل الصلاحيات...
                  </div>
                ) : (
                  <div className="flex-1 rounded-lg border overflow-hidden">
                    <ScrollArea className="h-full">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 sticky top-0 z-10 shadow-sm">
                          <tr>
                            <th className="ta-th text-start w-[40%]">الصفحة</th>
                            {PERMISSION_COLUMNS.map(({ field, label }) => (
                              <th key={field} className="ta-th">{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {PERMISSION_PAGE_ENTRIES.map(({ key, labelAr }) => {
                            const m = matrix[key];
                            if (!m) return null;
                            return (
                              <tr key={key} className="border-b last:border-0 hover:bg-muted/20">
                                <td className="ta-td font-medium py-2.5">{labelAr}</td>
                                {PERMISSION_COLUMNS.map(({ field }) => (
                                  <td key={field} className="ta-td py-2.5 text-center">
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
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border bg-card rounded-2xl p-5 flex flex-col items-center justify-center h-[600px] text-muted-foreground">
              <ShieldAlert className="h-12 w-12 opacity-20 mb-3" />
              <p>لا يوجد مستخدمون لتعديل صلاحياتهم</p>
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
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المستخدم</DialogTitle>
            <DialogDescription>
              تعديل بيانات المستخدم المحددة. يمكنك تغيير كلمة المرور عبر إدخال قيمة جديدة أو تركها فارغة للاحتفاظ بالقديمة.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <BaseInput label="الاسم" id="edit-user-name"
                value={editUserForm.name}
                onChange={(e) => setEditUserForm(p => ({ ...p, name: e.target.value }))}
                placeholder="اسم المستخدم"
                disabled={editingUser} />

            <BaseInput label="البريد الإلكتروني" id="edit-user-email"
                type="email"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm(p => ({ ...p, email: e.target.value }))}
                placeholder="example@muhimmat.com"
                dir="ltr"
                disabled={editingUser} />
            
            <div className="flex items-center space-x-2 space-x-reverse pt-2 pb-2">
              <Checkbox
                id="edit-user-active"
                checked={editUserForm.isActive}
                onCheckedChange={(checked) => setEditUserForm(p => ({ ...p, isActive: !!checked }))}
                disabled={editingUser}
              />
              <label htmlFor="edit-user-active" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                المستخدم نشط (يمكنه الدخول للنظام)
              </label>
            </div>

            <BaseInput label="كلمة المرور الجديدة (اختياري)" id="edit-user-password"
                type="password"
                value={editUserForm.password}
                onChange={(e) => setEditUserForm(p => ({ ...p, password: e.target.value }))}
                placeholder="اتركه فارغاً لعدم التغيير"
                disabled={editingUser} />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={editingUser}
            >
              إلغاء
            </Button>
            <Button type="button" onClick={() => { saveEditUser(); }} disabled={editingUser}>
              {editingUser ? 'جاري الحفظ...' : 'حفظ التعديلات'}
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
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المستخدم</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `سيتم حذف المستخدم "${deleteTarget.name}" نهائيًا من النظام. لا يمكن التراجع عن هذا الإجراء.`
                : 'سيتم حذف المستخدم نهائيًا من النظام.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingUserId !== null}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteUser(); }}
              disabled={deletingUserId !== null}
            >
              {deletingUserId ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default UsersAndPermissions;
