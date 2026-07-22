import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryBuilder, type MockQueryResult } from '@shared/test/mocks/supabaseClientMock';
import { resetMockTableResults } from '@shared/test/mocks/serviceLayerTestUtils';

const { getSessionMock, invokeMock, tableResults, fromMock, rpcMock, channelMock, removeChannelMock, onAuthStateChangeMock, signInWithPasswordMock, signOutMock, getUserMock, updateUserMock, refreshSessionMock, callServerFunctionMock } = vi.hoisted(() => {
  const tableResultsLocal: Record<string, MockQueryResult> = {};
  return {
    tableResults: tableResultsLocal,
    getSessionMock: vi.fn(),
    invokeMock: vi.fn(),
    callServerFunctionMock: vi.fn(),
    fromMock: vi.fn((table: string) => createQueryBuilder(tableResultsLocal[table] ?? { data: null, error: null })),
    rpcMock: vi.fn(),
    channelMock: vi.fn(),
    removeChannelMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
    signInWithPasswordMock: vi.fn(),
    signOutMock: vi.fn(),
    getUserMock: vi.fn(),
    updateUserMock: vi.fn(),
    refreshSessionMock: vi.fn(),
  };
});

vi.mock('./supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
      getUser: (...args: unknown[]) => getUserMock(...args),
      updateUser: (...args: unknown[]) => updateUserMock(...args),
      refreshSession: (...args: unknown[]) => refreshSessionMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
    },
    from: fromMock,
    rpc: rpcMock,
    channel: channelMock,
    removeChannel: removeChannelMock,
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

vi.mock('@services/serverFunction', () => ({
  callServerFunction: callServerFunctionMock,
}));

vi.mock('./serviceError', () => ({
  throwIfError: vi.fn((error: unknown, context: string) => {
    if (!error) return;
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${context}: ${message}`);
  }),
}));

import { authService } from './authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockReset();
    resetMockTableResults(tableResults);
    fromMock.mockImplementation((table: string) => createQueryBuilder(tableResults[table] ?? { data: null, error: null }));
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'test-access-token' } },
      error: null,
    });
  });

  describe('signIn', () => {
    it('returns session and user on success', async () => {
      signInWithPasswordMock.mockResolvedValue({ data: { session: { id: 's1' }, user: { id: 'u1' } }, error: null });
      const res = await authService.signIn('test@ex.com', 'pass');
      expect(res).toEqual({ session: { id: 's1' }, user: { id: 'u1' } });
    });
    it('throws on error', async () => {
      signInWithPasswordMock.mockResolvedValue({ data: { session: null, user: null }, error: new Error('signIn err') });
      await expect(authService.signIn('a', 'b')).rejects.toThrow('authService.signIn: signIn err');
    });
    it('normalizes email (trim+lowercase) and trims password before authenticating', async () => {
      signInWithPasswordMock.mockResolvedValue({ data: { session: { id: 's1' }, user: { id: 'u1' } }, error: null });
      await authService.signIn('  Admin@Test.COM  ', '  secret123  ');
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: 'admin@test.com',
        password: 'secret123',
      });
    });
  });

  describe('signOut', () => {
    it('succeeds without error', async () => {
      signOutMock.mockResolvedValue({ error: null });
      await authService.signOut();
      expect(signOutMock).toHaveBeenCalled();
    });
    it('ignores session missing error', async () => {
      signOutMock.mockResolvedValue({ error: { message: 'session not found or missing' } });
      await authService.signOut(); // should not throw
      expect(signOutMock).toHaveBeenCalled();
    });
    it('throws on other error', async () => {
      signOutMock.mockResolvedValue({ error: new Error('signOut err') });
      await expect(authService.signOut()).rejects.toThrow('authService.signOut: signOut err');
    });
  });

  describe('getSession', () => {
    it('returns session', async () => {
      const res = await authService.getSession();
      expect(res).toEqual({ access_token: 'test-access-token' });
    });
    it('throws on error', async () => {
      getSessionMock.mockResolvedValue({ data: { session: null }, error: new Error('session err') });
      await expect(authService.getSession()).rejects.toThrow('authService.getSession: session err');
    });
  });

  describe('getCurrentUser', () => {
    it('returns user', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
      const res = await authService.getCurrentUser();
      expect(res).toEqual({ id: 'u1' });
    });
    it('throws on error', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: new Error('user err') });
      await expect(authService.getCurrentUser()).rejects.toThrow('authService.getCurrentUser: user err');
    });
  });

  describe('fetchUserRole', () => {
    it('returns role from rpc', async () => {
      rpcMock.mockResolvedValueOnce({ data: 'admin', error: null });
      const role = await authService.fetchUserRole('u1');
      expect(role).toBe('admin');
    });
    it('falls back to user_roles table if rpc fails', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc err') });
      tableResults.user_roles = { data: { role: 'viewer' }, error: null };
      const role = await authService.fetchUserRole('u2');
      expect(role).toBe('viewer');
    });
    it('throws if both fail', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc err') });
      tableResults.user_roles = { data: null, error: new Error('table err') };
      await expect(authService.fetchUserRole('u3')).rejects.toThrow('authService.fetchUserRole: table err');
    });
  });

  describe('fetchIsActive', () => {
    it('returns boolean from rpc', async () => {
      rpcMock.mockResolvedValueOnce({ data: false, error: null });
      const active = await authService.fetchIsActive('u1');
      expect(active).toBe(false);
    });
    it('falls back to profiles table if rpc fails', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc err') });
      tableResults.profiles = { data: { is_active: false }, error: null };
      const active = await authService.fetchIsActive('u2');
      expect(active).toBe(false);
    });
    it('throws if both fail', async () => {
      rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc err') });
      tableResults.profiles = { data: null, error: new Error('table err') };
      await expect(authService.fetchIsActive('u3')).rejects.toThrow('authService.fetchIsActive: table err');
    });
  });

  describe('fetchProfile', () => {
    it('returns profile', async () => {
      tableResults.profiles = { data: { id: 'u1', name: 'John' }, error: null };
      const res = await authService.fetchProfile('u1');
      expect(res).toEqual({ id: 'u1', name: 'John' });
    });
    it('throws on error', async () => {
      tableResults.profiles = { data: null, error: new Error('profile err') };
      await expect(authService.fetchProfile('u1')).rejects.toThrow('authService.fetchProfile: profile err');
    });
  });

  describe('updatePassword', () => {
    it('calls updateUser', async () => {
      updateUserMock.mockResolvedValue({ error: null });
      await authService.updatePassword('newpass');
      expect(updateUserMock).toHaveBeenCalledWith({ password: 'newpass' });
    });
    it('throws on error', async () => {
      updateUserMock.mockResolvedValue({ error: new Error('pass err') });
      await expect(authService.updatePassword('a')).rejects.toThrow('authService.updatePassword: pass err');
    });
  });

  describe('refreshSession', () => {
    it('returns refreshed session', async () => {
      refreshSessionMock.mockResolvedValue({ data: { session: { id: 's2' }, user: { id: 'u2' } }, error: null });
      const res = await authService.refreshSession();
      expect(res).toEqual({ session: { id: 's2' }, user: { id: 'u2' } });
    });
    it('returns an empty session when no refresh session exists', async () => {
      refreshSessionMock.mockResolvedValue({
        data: { session: null, user: null },
        error: new Error('Auth session missing!'),
      });

      await expect(authService.refreshSession()).resolves.toEqual({ session: null, user: null });
    });
    it('throws on error', async () => {
      refreshSessionMock.mockResolvedValue({ data: { session: null, user: null }, error: new Error('refresh err') });
      await expect(authService.refreshSession()).rejects.toThrow('authService.refreshSession: refresh err');
    });
  });

  describe('onAuthStateChange', () => {
    it('returns subscription', () => {
      onAuthStateChangeMock.mockReturnValue({ data: { subscription: 'sub' } });
      const res = authService.onAuthStateChange(vi.fn());
      expect(res).toBe('sub');
    });
  });

  describe('subscribeToProfileActiveChanges', () => {
    it('fires the callback when the profile active status changes', () => {
      let capturedHandler: ((payload: unknown) => void) | null = null;
      const mockChannel = {
        on: vi.fn().mockImplementation((_event: string, _filter: unknown, handler: (payload: unknown) => void) => {
          capturedHandler = handler;
          return mockChannel;
        }),
        subscribe: vi.fn().mockReturnThis(),
      };
      channelMock.mockReturnValue(mockChannel);

      const cb = vi.fn();
      authService.subscribeToProfileActiveChanges('u1', cb);

      expect(channelMock).toHaveBeenCalledWith('profile-active-u1');
      // Simulate a realtime event arriving
      capturedHandler?.({ new: { is_active: false } });
      expect(cb).toHaveBeenCalledWith(expect.objectContaining({ new: { is_active: false } }));
    });
  });

  describe('removeRealtimeChannel', () => {
    it('calls removeChannel', () => {
      const ch = {} as any;
      authService.removeRealtimeChannel(ch);
      expect(removeChannelMock).toHaveBeenCalledWith(ch);
    });
  });

  describe('revokeSession', () => {
    it('calls admin API', async () => {
      callServerFunctionMock.mockResolvedValue(null);
      await authService.revokeSession('u1');
      expect(callServerFunctionMock).toHaveBeenCalledWith('admin-update-user', expect.objectContaining({ action: 'revoke_session' }));
    });
    it('throws if no userId', async () => {
      await expect(authService.revokeSession(null)).rejects.toThrow('userId is required');
    });
    it('throws if not authenticated', async () => {
      getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
      await expect(authService.revokeSession('u1')).rejects.toThrow('not authenticated');
    });
    it('throws fallback message on network error', async () => {
      callServerFunctionMock.mockRejectedValue(new Error('NetworkError when attempting to fetch resource.'));
      await expect(authService.revokeSession('u1')).rejects.toThrow('الخادم غير متاح حالياً');
    });
    it('throws message from server error', async () => {
      callServerFunctionMock.mockRejectedValue(new Error('specific error'));
      await expect(authService.revokeSession('u1')).rejects.toThrow('specific error');
    });
    it('throws if fetch fails completely', async () => {
      callServerFunctionMock.mockRejectedValue(new Error('Network error'));
      await expect(authService.revokeSession('u1')).rejects.toThrow('Network error');
    });
  });

  describe('createManagedUser', () => {
    it('new user created via admin edge function returns assigned user id', async () => {
      callServerFunctionMock.mockResolvedValue({ user_id: 'user-99' });

      const res = await authService.createManagedUser({
        email: 'new@example.com',
        password: 'pwd',
        name: 'New User',
        role: 'hr',
      });

      expect(res).toEqual({ user_id: 'user-99' });
      expect(callServerFunctionMock).toHaveBeenCalledWith('admin-update-user', expect.objectContaining({
        action: 'create_user',
        email: 'new@example.com',
      }));
    });

    it('missing user_id in admin response throws to prevent silent failure', async () => {
      callServerFunctionMock.mockResolvedValue({});

      await expect(
        authService.createManagedUser({
          email: 'new@example.com',
          password: 'pwd',
          name: 'New User',
          role: 'viewer',
        }),
      ).rejects.toThrow('authService.createManagedUser: missing user_id');
    });
  });

  describe('deleteManagedUser', () => {
    it('delete_user action sent with correct user_id to admin edge function', async () => {
      callServerFunctionMock.mockResolvedValue(null);

      await authService.deleteManagedUser('u-99');

      expect(callServerFunctionMock).toHaveBeenCalledWith('admin-update-user', expect.objectContaining({
        action: 'delete_user',
        user_id: 'u-99',
      }));
    });

    it('throws if no userId', async () => {
      await expect(authService.deleteManagedUser(null)).rejects.toThrow('userId is required');
    });
  });
});
