/**
 * PresenceAvatars — Shows colored circles for users currently on the same page.
 * Similar to Google Sheets' collaborator avatars in the top-right corner.
 */
import type { PresenceUser } from '@shared/hooks/usePagePresence';
import { getRouteByPathname } from '@app/routesManifest';

type Props = {
  users: PresenceUser[];
  maxVisible?: number;
  isAdmin?: boolean;
};

export function PresenceAvatars({ users, maxVisible = 5, isAdmin = false }: Readonly<Props>) {
  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = users.length - maxVisible;

  return (
    <div className="flex items-center -space-x-2 rtl:space-x-reverse" dir="ltr">
      {visible.map((u) => {
        const route = u.currentPath ? getRouteByPathname(u.currentPath) : null;
        const pageTitle = route ? route.titleAr : (u.currentPath && u.currentPath !== '/') ? 'صفحة أخرى' : '';
        const title = isAdmin && pageTitle ? `${u.name} (في صفحة: ${pageTitle})` : u.name;

        return (
          <div
            key={u.userId}
            title={title}
            className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-xs font-bold text-white shadow-sm transition-transform hover:scale-110 hover:z-10"
            style={{ backgroundColor: u.color }}
          >
            {u.name.charAt(0)}
            {u.activeRowId && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border border-card" />
            )}
          </div>
        );
      })}
      {overflow > 0 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-semibold text-muted-foreground">
          +{overflow}
        </div>
      )}
    </div>
  );
}
