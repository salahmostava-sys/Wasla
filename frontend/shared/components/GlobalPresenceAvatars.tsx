import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthContext';
import { usePagePresence } from '@shared/hooks/usePagePresence';
import { PresenceAvatars } from '@shared/components/PresenceAvatars';

/**
 * A dedicated wrapper component for tracking and displaying global presence.
 * By isolating this hook in a separate component, we prevent the `AppLayout` 
 * (and by extension the entire application subtree) from re-rendering every time
 * a user's presence state syncs from Supabase.
 */
export const GlobalPresenceAvatars = React.memo(() => {
  const { role, user } = useAuth();
  const location = useLocation();
  const { onlineUsers } = usePagePresence('global', location.pathname);

  const filteredUsers = onlineUsers.filter(u => u.userId !== user?.id);

  return (
    <PresenceAvatars 
      users={filteredUsers} 
      maxVisible={4} 
      isAdmin={role === 'admin'} 
    />
  );
});
