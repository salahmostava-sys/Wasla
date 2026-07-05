import { supabase } from "./supabase/client";
import { callServerFunction } from "@services/serverFunction";
import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import { throwIfError } from "./serviceError";

/**
 * Wrapper around callServerFunction() for internal /api/functions/admin-update-user calls.
 * Detects unreachable server and throws a clear Arabic message.
 */
async function callAdminApi(
  body: Record<string, unknown>
): Promise<void>;
async function callAdminApi<T>(
  body: Record<string, unknown>,
  expectData: true
): Promise<T>;
async function callAdminApi<T = void>(
  body: Record<string, unknown>,
  expectData?: boolean
): Promise<T | void> {
  try {
    const data = await callServerFunction<T>('admin-update-user', body);
    if (expectData) {
      return data;
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError') || error.message.includes('fetch')) {
        throw new Error("الخادم غير متاح حالياً. يرجى الانتظار لحظة والمحاولة مجدداً.");
      }
      throw new Error(error.message || "تعذر الاتصال بالخادم. يرجى التحقق من أن الخادم يعمل والمحاولة مجدداً.");
    }
    throw new Error("تعذر الاتصال بالخادم. يرجى التحقق من أن الخادم يعمل والمحاولة مجدداً.");
  }
}

export type AppRole = "admin" | "hr" | "finance" | "operations" | "viewer";

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface AdminCreateUserInput {
  email: string;
  password: string;
  name: string;
  role: AppRole;
}

type AdminCreateUserResult = {
  user_id: string;
};

type ProfileActiveRow = {
  is_active?: boolean;
};

// In-flight deduplication: if the same call is already running, reuse its promise.
const _inFlight: Record<string, Promise<unknown>> = {};
function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (Object.hasOwn(_inFlight, key)) return _inFlight[key] as Promise<T>;
  const p = fn().finally(() => { delete _inFlight[key]; });
  _inFlight[key] = p;
  return p;
}

export const authService = {
  signIn: async (email: string, password: string): Promise<{ session: Session | null; user: User | null }> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    throwIfError(error, "authService.signIn");
    return { session: data.session, user: data.user };
  },

  signOut: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (!error) return;
    const rawMessage = (error as { message?: unknown }).message;
    const message = (typeof rawMessage === "string" ? rawMessage : "").toLowerCase();
    if (message.includes("session") && message.includes("missing")) {
      return;
    }
    throwIfError(error, "authService.signOut");
  },

  getSession: async (): Promise<Session | null> => {
    const { data, error } = await supabase.auth.getSession();
    throwIfError(error, "authService.getSession");
    return data.session;
  },

  getCurrentUser: async (): Promise<User | null> => {
    const { data, error } = await supabase.auth.getUser();
    throwIfError(error, "authService.getCurrentUser");
    return data.user;
  },

  fetchUserRole: (userId: string): Promise<AppRole | null> =>
    dedupe(`role:${userId}`, async () => {
      const { data: rpcRole, error: rpcError } = await supabase.rpc("get_my_role");
      if (!rpcError) {
        return (rpcRole) ?? null;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      throwIfError(error, "authService.fetchUserRole");
      return (data?.role as AppRole) ?? null;
    }),

  fetchIsActive: (userId: string): Promise<boolean> =>
    dedupe(`active:${userId}`, async () => {
      const { data: rpcActive, error: rpcError } = await supabase.rpc("is_active_user", {
        _user_id: userId,
      });
      if (!rpcError && typeof rpcActive === "boolean") {
        return rpcActive;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .maybeSingle<ProfileActiveRow>();
      throwIfError(error, "authService.fetchIsActive");
      return data?.is_active !== false;
    }),

  fetchProfile: async (userId: string): Promise<UserProfile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, email, avatar_url, is_active")
      .eq("id", userId)
      .maybeSingle();
    throwIfError(error, "authService.fetchProfile");
    return data;
  },

  updatePassword: async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    throwIfError(error, "authService.updatePassword");
  },

  refreshSession: async (): Promise<{ session: Session | null; user: User | null }> => {
    const { data, error } = await supabase.auth.refreshSession();
    throwIfError(error, "authService.refreshSession");
    return { session: data.session, user: data.user };
  },

  onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    const { data } = supabase.auth.onAuthStateChange(callback);
    return data.subscription;
  },

  subscribeToProfileActiveChanges: (
    userId: string,
    callback: (payload: { new: ProfileActiveRow }) => void
  ) => {
    return supabase
      .channel(`profile-active-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${userId}`,
        },
        callback
      )
      .subscribe();
  },

  removeRealtimeChannel: (channel: ReturnType<typeof supabase.channel>) => {
    supabase.removeChannel(channel);
  },

  revokeSession: async (userId: string | null): Promise<void> => {
    if (!userId) throw new Error("authService.revokeSession: userId is required");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("authService.revokeSession: not authenticated");
    await callAdminApi({ user_id: userId, action: "revoke_session" });
  },

  createManagedUser: async (input: AdminCreateUserInput): Promise<AdminCreateUserResult> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("authService.createManagedUser: not authenticated");
    const result = await callAdminApi<AdminCreateUserResult & { user_id?: string }>(
      {
        action: "create_user",
        email: input.email,
        password: input.password,
        name: input.name,
        role: input.role,
      },
      true
    );
    if (!result?.user_id) throw new Error("authService.createManagedUser: missing user_id");
    return result;
  },

  deleteManagedUser: async (userId: string | null): Promise<void> => {
    if (!userId) throw new Error("authService.deleteManagedUser: userId is required");
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) throw new Error("authService.deleteManagedUser: not authenticated");
    await callAdminApi({ user_id: userId, action: "delete_user" });
  },
};
