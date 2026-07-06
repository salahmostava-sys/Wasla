import React from 'react';
import { useAuth } from '@app/providers/AuthContext';
import { usePagePresence } from '@shared/hooks/usePagePresence';
import { PresenceAvatars } from '@shared/components/PresenceAvatars';

interface PagePresenceAvatarsProps {
  pageKey: string;
}

/**
 * A dedicated wrapper component for tracking and displaying page-level presence.
 * By isolating this hook in a separate component, we prevent the parent page 
 * from re-rendering every time a user's presence state syncs from Supabase.
 */
export const PagePresenceAvatars = React.memo(({ pageKey }: PagePresenceAvatarsProps) => {
  const { role } = useAuth();
  const { onlineUsers } = usePagePresence(pageKey);

  return (
    <PresenceAvatars 
      users={onlineUsers} 
      maxVisible={4} 
      isAdmin={role === 'admin'} 
    />
  );
});
