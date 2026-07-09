import { BaseInput } from '@shared/components/ui/base-input';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, RefreshCw, AlertCircle, UserPlus, Trash2, Pencil, Search, ChevronLeft, ShieldAlert } from 'lucide-react';
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
import { ActiveUsersTab } from './components/ActiveUsersTab';
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
  const canEdit = settingsPerm.can_edit && isAdmin;
  const canDelete = settingsPerm.can_delete && isAdmin;
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
      (r.email && r.email.toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  const loadMatrix = useCallback(async (userId: string, role: AppRole) => {
    if (!isAdmin) return;
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
  }, [isAdmin, toast]);

  useEffect(() => {
    if (rows.length && !permUserId) {
      setPermUserId(rows[0].id);
    }
  }, [rows, permUserId]);

  useEffect(() => {
    if (!permUserId || !isAdmin) return;
    const u = rows.find((r) => r.id === permUserId);
    if (!u) return;
    loadMatrix(u.id, u.role).catch(() => {});
  }, [permUserId, rows, isAdmin, loadMatrix]);

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
    if (!canEdit || !selectedUser || !isAdmin) return;
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

  if (!isAdmin) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>غير متاح</AlertTitle>
        <AlertDescription>
          إدارة المستخدمين والأدوار والصلاحيات المخصصة متاحة لـ <strong>مدير النظام</strong> فقط (مطابقة لسياسات قاعدة البيانات).
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
          <TabsTrigger value="users">المستخدمين والصلاحيات</TabsTrigger>
          {isAdmin && <TabsTrigger value="active_users">المستخدمين النشطين</TabsTrigger>}
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex flex-col lg:flex-row gap-6">
            
            {/* Master View: Users List */}
            <div className="w-full lg:w-1/3 flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم أو البريد..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>
              
              <div className="border bg-card rounded-2xl overflow-hidden flex flex-col h-[600px]">
                <div className="bg-muted/40 p-3 border-b text-sm font-semibold flex justify-between items-center">
                  <span>المستخدمون ({filteredRows.length})</span>
                </div>
                <ScrollArea className="flex-1">
                  {filteredRows.length > 0 ? (
                    <div className="divide-y">
                      {filteredRows.map((row) => {
                        const isSelected = row.id === permUserId;
                        return (
                          <div
                            key={row.id}
                            onClick={() => setPermUserId(row.id)}
                            className={cn(
                              "p-3 cursor-pointer transition-colors flex items-center justify-between gap-3 group hover:bg-muted/50",
                              isSelected ? "bg-primary/5 hover:bg-primary/10 border-r-4 border-primary" : "border-r-4 border-transparent"
                            )}
                          >
                            <div className="flex-1 overflow-hidden">
                              <p className="font-semibold text-sm truncate">{row.name}</p>
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                                <span className={cn("inline-block w-2 h-2 rounded-full", row.isActive ? "bg-green-500" : "bg-destructive")} />
                                {ROLE_LABELS_AR[row.role]}
                              </p>
                            </div>
                            <ChevronLeft className={cn("h-4 w-4 text-muted-foreground transition-transform", isSelected && "text-primary -translate-x-1")} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      لا توجد نتائج للبحث.
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>

            {/* Detail View: User Permissions & Info */}
            <div className="w-full lg:w-2/3">
              {selectedUser ? (
                <div className="border bg-card rounded-2xl p-5 flex flex-col h-[600px]">
                  {/* Detail Header */}
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b">
                    <div>
                      <h3 className="text-lg font-bold flex items-center gap-2">
                        {selectedUser.name}
                        {!selectedUser.isActive && (
                          <span className="text-xs font-normal bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">موقوف</span>
                        )}
                      </h3>
                      <p className="text-sm text-muted-foreground" dir="ltr">{selectedUser.email || 'لا يوجد بريد إلكتروني'}</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <Button variant="outline" size="sm" onClick={() => openEditModal(selectedUser)}>
                          <Pencil size={14} className="me-1" /> تعديل
                        </Button>
                      )}
                      {canDelete && selectedUser.id !== currentUserId && (
                        <Button variant="outline" size="sm" onClick={() => setDeleteTarget(selectedUser)} className="text-destructive hover:text-destructive">
                          <Trash2 size={14} className="me-1" /> حذف
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="py-4 border-b flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <Label>الدور الأساسي</Label>
                      <p className="text-xs text-muted-foreground">يحدد الصلاحيات الافتراضية للمستخدم</p>
                    </div>
                    <Select
                      value={selectedUser.role}
                      onValueChange={(value) => updateRole(selectedUser.id, value as AppRole)}
                      disabled={!canEdit || savingId === selectedUser.id}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="اختر الدور" />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS_AR[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Matrix */}
                  <div className="flex-1 overflow-hidden flex flex-col pt-4">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <h4 className="font-semibold text-sm">تخصيص الصلاحيات</h4>
                        <p className="text-xs text-muted-foreground">لتجاوز الصلاحيات الافتراضية للدور الأساسي.</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => { saveMatrix(); }}
                        disabled={savingMatrix || matrixLoading || !canEdit}
                      >
                        {savingMatrix ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                      </Button>
                    </div>

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
                                <th className="ta-th">عرض</th>
                                <th className="ta-th">تعديل</th>
                                <th className="ta-th">حذف</th>
                              </tr>
                            </thead>
                            <tbody>
                              {PERMISSION_PAGE_ENTRIES.map(({ key, labelAr }) => {
                                const m = matrix[key];
                                if (!m) return null;
                                return (
                                  <tr key={key} className="border-b last:border-0 hover:bg-muted/20">
                                    <td className="ta-td font-medium py-2.5">{labelAr}</td>
                                    <td className="ta-td py-2.5 text-center">
                                      <Checkbox
                                        checked={m.can_view}
                                        onCheckedChange={(v) => setCell(key, 'can_view', v === true)}
                                        disabled={!canEdit}
                                        className="mx-auto"
                                      />
                                    </td>
                                    <td className="ta-td py-2.5 text-center">
                                      <Checkbox
                                        checked={m.can_edit}
                                        onCheckedChange={(v) => setCell(key, 'can_edit', v === true)}
                                        disabled={!canEdit}
                                        className="mx-auto"
                                      />
                                    </td>
                                    <td className="ta-td py-2.5 text-center">
                                      <Checkbox
                                        checked={m.can_delete}
                                        onCheckedChange={(v) => setCell(key, 'can_delete', v === true)}
                                        disabled={!canEdit}
                                        className="mx-auto"
                                      />
                                    </td>
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
                  <p>اختر مستخدماً من القائمة لعرض وتعديل صلاحياته</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="active_users">
            <ActiveUsersTab />
          </TabsContent>
        )}
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
