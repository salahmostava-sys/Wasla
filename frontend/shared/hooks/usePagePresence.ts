/**
 * usePagePresence — Real-time presence tracking per page.
 *
 * Shows who else is viewing the same page (like Google Sheets collaborators).
 * Uses Supabase Realtime Presence channels.
 *
 * Usage:
 *   const { onlineUsers, trackRow, activeRows } = usePagePresence('employees');
 *
 * - `onlineUsers`: list of users currently on this page
 * - `trackRow(rowId)`: call when user starts editing a row
 * - `activeRows`: map of rowId → user info (who's editing what)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@services/supabase/client';
import { useAuth } from '@app/providers/AuthContext';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type PresenceUser = {
  userId: string;
  name: string;
  color: string;
  /** The row this user is currently editing (null = just viewing) */
  activeRowId: string | null;
  /** The current path the user is on (optional, for global presence) */
  currentPath?: string;
};

/** Stable avatar colors assigned per user index. */
const PRESENCE_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#9333ea',
  '#ea580c', '#0891b2', '#c026d3', '#65a30d',
  '#d97706', '#4f46e5', '#be123c', '#059669',
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = Math.trunc((hash << 5) - hash + userId.codePointAt(i)!);
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

type PresenceTrackPayload = {
  userId: string;
  name: string;
  color: string;
  activeRowId: string | null;
  currentPath?: string;
};

function collectPresenceState(
  state: Record<string, PresenceTrackPayload[]>,
  currentUserId: string,
): { users: PresenceUser[]; rows: Map<string, PresenceUser> } {
  const users: PresenceUser[] = [];
  const rows = new Map<string, PresenceUser>();
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      if (p.userId === currentUserId) continue;
      const u: PresenceUser = {
        userId: p.userId,
        name: p.name,
        color: p.color,
        activeRowId: p.activeRowId,
        currentPath: p.currentPath,
      };
      users.push(u);
      if (p.activeRowId) {
        rows.set(p.activeRowId, u);
      }
    }
  }
  return { users, rows };
}

export function usePagePresence(pageKey: string, currentPath?: string) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const [activeRows, setActiveRows] = useState<Map<string, PresenceUser>>(new Map());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentRowRef = useRef<string | null>(null);
  const currentPathRef = useRef<string | undefined>(currentPath);

  // تحديث المسار الحالي باستمرار لتجنب الاعتماديات القديمة في subscribe
  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  // تحديث الحالة عند تغير المسار (دون إعادة الاشتراك الكاملة)
  useEffect(() => {
    const channel = channelRef.current;
    if (channel && user?.id) {
      channel.track({
        userId: user.id,
        name: user.user_metadata?.name ?? user.email ?? 'مستخدم',
        color: pickColor(user.id),
        activeRowId: currentRowRef.current,
        currentPath: currentPath,
      }).catch(() => {});
    }
  }, [currentPath, user?.id, user?.user_metadata?.name, user?.email]);

  useEffect(() => {
    if (!user?.id) return;

    const channelName = `presence:${pageKey}`;

    // Find and remove any existing channel with the same topic to prevent reuse
    // which can throw "cannot add 'presence' callbacks after subscribe" error
    const existing = supabase.getChannels().find(
      (c) => c.topic === `realtime:${channelName}` || c.topic === channelName
    );
    if (existing) {
      supabase.removeChannel(existing).catch(() => {});
    }

    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceTrackPayload>();
        const { users, rows } = collectPresenceState(state, user.id);
        setOnlineUsers(users);
        setActiveRows(rows);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            name: user.user_metadata?.name ?? user.email ?? 'مستخدم',
            color: pickColor(user.id),
            activeRowId: currentRowRef.current,
            currentPath: currentPathRef.current,
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack().catch(() => {});
      supabase.removeChannel(channel).catch(() => {});
      channelRef.current = null;
    };
  }, [pageKey, user?.id, user?.email, user?.user_metadata?.name]);

  /** Call when user starts editing a specific row. Pass null to clear. */
  const trackRow = useCallback(
    async (rowId: string | null) => {
      if (!user?.id || !channelRef.current) return;
      if (currentRowRef.current === rowId) return;
      currentRowRef.current = rowId;
      await channelRef.current.track({
        userId: user.id,
        name: user.user_metadata?.name ?? user.email ?? 'مستخدم',
        color: pickColor(user.id),
        activeRowId: rowId,
        currentPath: currentPathRef.current,
      });
    },
    [user],
  );

  return { onlineUsers, activeRows, trackRow };
}
