import { supabase } from '@services/supabase/client';
import type { Database } from '@services/supabase/types';
import { toServiceError } from '@services/serviceError';

export type PagePermissionRow = {
  permission_key: string;
  can_view: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

export const userPermissionService = {
  getProfiles: async () => {
    const { data, error } = await supabase.from('profiles').select('id, name, email, is_active').order('name');
    if (error) throw toServiceError(error, 'userPermissionService.getProfiles');
    return data ?? [];
  },

  getUserRoles: async () => {
    const { data, error } = await supabase.from('user_roles').select('id, user_id, role');
    if (error) throw toServiceError(error, 'userPermissionService.getUserRoles');
    return data ?? [];
  },

  getUserPermissions: async (userId: string) => {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('permission_key, can_view, can_edit, can_delete')
      .eq('user_id', userId);
    if (error) throw toServiceError(error, 'userPermissionService.getUserPermissions');
    return data ?? [];
  },

  /** Persist the frontend-selected permission row. Roles are templates, not the saved source of truth. */
  upsertPermission: async (
    userId: string,
    permissionKey: string,
    perms: { can_view: boolean; can_edit: boolean; can_delete: boolean }
  ) => {
    const { error } = await supabase.from('user_permissions').upsert(
      {
        user_id: userId,
        permission_key: permissionKey,
        can_view: perms.can_view,
        can_edit: perms.can_edit,
        can_delete: perms.can_delete,
      },
      { onConflict: 'user_id,permission_key' }
    );
    if (error) throw toServiceError(error, 'userPermissionService.upsertPermission');
  },

  deletePermission: async (userId: string, permissionKey: string) => {
    const { error } = await supabase.from('user_permissions').delete().eq('user_id', userId).eq('permission_key', permissionKey);
    if (error) throw toServiceError(error, 'userPermissionService.deletePermission');
  },

  upsertRole: async (userId: string, role: string) => {
    type AppRole = Database['public']['Enums']['app_role'];
    const typedRole = role as AppRole;
    const { data: existing, error: existingError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) throw toServiceError(existingError, 'userPermissionService.upsertRole.select');
    if (existing?.id) {
      const { error } = await supabase.from('user_roles').update({ role: typedRole }).eq('id', existing.id);
      if (error) throw toServiceError(error, 'userPermissionService.upsertRole.update');
      return;
    }
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: typedRole });
    if (error) throw toServiceError(error, 'userPermissionService.upsertRole.insert');
  },
};
