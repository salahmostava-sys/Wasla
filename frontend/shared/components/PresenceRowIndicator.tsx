/**
 * PresenceRowIndicator — Shows a colored border + tiny name label on a row
 * that another user is currently editing. Like Google Sheets cell highlights.
 *
 * Usage: Wrap or overlay on a <tr> element.
 */
import type { PresenceUser } from '@shared/hooks/usePagePresence';

type Props = {
  user: PresenceUser | undefined;
};

export function PresenceRowIndicator({ user }: Readonly<Props>) {
  if (!user) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 rounded-sm border-2 transition-all"
      style={{ borderColor: user.color }}
    >
      <span
        className="absolute -top-3.5 start-2 rounded px-1.5 py-0 text-[9px] font-medium text-white whitespace-nowrap shadow-sm"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </span>
    </div>
  );
}
