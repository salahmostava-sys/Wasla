import { useEffect, useRef } from 'react';
import { realtimeService } from '@services/realtimeService';

/** Tables backing Dashboard KPIs + analytics (invalidate on change; read-heavy). */
export const REALTIME_TABLES_DASHBOARD = [
  'employees',
  'attendance',
  'daily_orders',
  'audit_log',
  'vehicles',
  'alerts',
  'apps',
  'app_targets',
] as const;

/** Subscribe to postgres_changes on the given tables; cleanup on unmount. */
export function useRealtimePostgresChanges(
  channelName: string,
  tables: readonly string[],
  onEvent: () => void,
  debounceMs: number = 2000
): void {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tablesKey = tables.join('\0');

  useEffect(() => {
    if (tables.length === 0) return;

    const debouncedEvent = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onEventRef.current();
      }, debounceMs);
    };

    const unsubscribe = realtimeService.subscribeToTables(channelName, tables, debouncedEvent);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      unsubscribe();
    };
  }, [channelName, tables, tablesKey, debounceMs]);
}
