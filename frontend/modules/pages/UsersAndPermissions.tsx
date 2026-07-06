import { BaseInput } from '@shared/components/ui/base-input';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, RefreshCw, Save, AlertCircle, UserPlus, Trash2 } from 'lucide-react';
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
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions, DEFAULT_PERMISSIONS, type AppRole, type PagePermission } from '@shared/hooks/usePermissions';
import { PERMISSION_PAGE_ENTRIES } from '@shared/constants/permissionPages';
import { defaultQueryRetry } from '@shared/lib/query';

type ProfileRow = {
  id: string;
  name: string | null;
  is_active: boolean | null;
};

type UserRow = {
  id: string;
  name: string;
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

interface UsersAndPermissionsProps {
  embedded?: boolean;
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
        isActive: p.is_active ?? true,
        role: roleMap[p.id] || 'viewer',
      }));
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });
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

  const isAdmin = authRole === 'admin';
  const canEdit = settingsPerm.can_edit && isAdmin;
  const canDelete = settingsPerm.can_delete && isAdmin;
  const currentUserId = user?.id ?? null;

  // Local state mirrors React Query data — kept because updateRole performs optimistic
  // local updates on the rows array (setRows) before the server response.
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
      await Promise.all(
        PERMISSION_PAGE_ENTRIES.map(({ key }) => {
          const cur = matrix[key];
          if (!cur) return Promise.resolve();
          const def = roleDefaults[key] ?? { can_view: false, can_edit: false, can_delete: false };
          const same =
            cur.can_view === def.can_view && cur.can_edit === def.can_edit && cur.can_delete === def.can_delete;
          if (same) {
            return userPermissionService.deletePermission(selectedUser.id, key);
          }
          return userPermissionService.upsertPermission(selectedUser.id, key, cur);
        })
      );
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

    if (!name) {
      toast({ title: 'الاسم مطلوب', variant: 'destructive' });
      return;
    }
    if (!email?.includes('@')) {
      toast({ title: 'البريد الإلكتروني غير صالح', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({
        title: 'كلمة المرور ضعيفة',
        description: 'يجب أن تكون كلمة المرور 8 أحرف على الأقل.',
        variant: 'destructive',
      });
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

  const deleteUser = async () => {
    if (!canDelete || !deleteTarget) return;
    if (deleteTarget.id === currentUserId) {
      toast({
        title: 'غير مسموح',
        description: 'لا يمكن حذف الحساب الحالي.',
        variant: 'destructive',
      });
      return;
    }

    setDeletingUserId(deleteTarget.id);
    try {
      await authService.deleteManagedUser(deleteTarget.id);
      toast({ title: 'تم حذف المستخدم بنجاح' });
      if (permUserId === deleteTarget.id) {
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
            تعيين أدوار المستخدمين، ثم صلاحيات كل صفحة (عرض / تعديل / حذف) عند الحاجة لتجاوز افتراضات الدور.
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
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="users">المستخدمين</TabsTrigger>
          <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="ta-th">الاسم</th>
                  <th className="ta-th">الحالة</th>
                  <th className="ta-th">الدور</th>
                  <th className="ta-th">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="ta-td">{row.name}</td>
                    <td className="ta-td">{row.isActive ? 'نشط' : 'موقوف'}</td>
                    <td className="ta-td">
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.role}
                          onValueChange={(value) => updateRole(row.id, value as AppRole)}
                          disabled={!canEdit || savingId === row.id}
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
                        {savingId === row.id && <Save size={14} className="animate-pulse text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="ta-td">
                      {canDelete ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2 text-destructive hover:text-destructive"
                          disabled={row.id === currentUserId || deletingUserId === row.id}
                          onClick={() => setDeleteTarget(row)}
                          title={row.id === currentUserId ? 'لا يمكن حذف الحساب الحالي' : 'حذف المستخدم'}
                        >
                          <Trash2 size={14} className="text-destructive" />
                          حذف
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="ta-td text-muted-foreground">
                      لا يوجد مستخدمون.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="permissions">
          {canEdit && rows.length > 0 ? (
            <div className="space-y-3 border bg-card p-4 rounded-2xl">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold">صلاحيات الصفحات (مخصصة للمستخدم)</h3>
                  <p className="text-xs text-muted-foreground">
                    الأسماء أدناه هي صفحات النظام الفعلية. عند المطابقة مع افتراضات الدور لا تُخزّن صفوف إضافية في قاعدة البيانات.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-start gap-2" dir="rtl">
                  <Select value={permUserId ?? ''} onValueChange={(v) => setPermUserId(v)}>
                    <SelectTrigger className="w-[240px]">
                      <SelectValue placeholder="اختر مستخدماً" />
                    </SelectTrigger>
                    <SelectContent>
                      {rows.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} — {ROLE_LABELS_AR[r.role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => { saveMatrix(); }}
                    disabled={savingMatrix || matrixLoading || !selectedUser}
                  >
                    {savingMatrix ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}
                  </Button>
                </div>
              </div>

              {matrixLoading ? (
                <p className="text-sm text-muted-foreground py-4">جاري تحميل الصلاحيات...</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-muted/40">
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
                          <tr key={key} className="border-t">
                            <td className="ta-td font-medium">{labelAr}</td>
                            <td className="ta-td">
                              <Checkbox
                                checked={m.can_view}
                                onCheckedChange={(v) => setCell(key, 'can_view', v === true)}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="ta-td">
                              <Checkbox
                                checked={m.can_edit}
                                onCheckedChange={(v) => setCell(key, 'can_edit', v === true)}
                                disabled={!canEdit}
                              />
                            </td>
                            <td className="ta-td">
                              <Checkbox
                                checked={m.can_delete}
                                onCheckedChange={(v) => setCell(key, 'can_delete', v === true)}
                                disabled={!canEdit}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="border bg-card p-4 text-sm text-muted-foreground rounded-2xl">
              لا توجد صلاحيات مخصصة متاحة للعرض حالياً.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={createUserOpen}
        onOpenChange={(open) => {
          setCreateUserOpen(open);
          if (!open && !creatingUser) resetNewUserForm();
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
                setCreateUserOpen(false);
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
