import { employeeService } from '@services/employeeService';
import { useAuthedQuery } from '@shared/hooks/useAuthedQuery';

/** TanStack Query key factory for the employees list. */
const employeesQueryKey = (userId: string) => ['employees', userId] as const;

const EMPLOYEES_FETCH_TIMEOUT_MS = 12_000;

/**
 * Fetches all employees with their platform app assignments.
 * Data is cached for 60 seconds. Includes a 12-second timeout guard via Promise.race.
 *
 * Note: Supabase JS client does not accept an AbortSignal directly, so we use
 * Promise.race with a timeout promise instead of AbortController (which had no effect before).
 */
export const useEmployees = () => {
  return useAuthedQuery({
    buildQueryKey: employeesQueryKey,
    queryFn: async () => {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('انتهت مهلة تحميل البيانات. حاول مرة أخرى.')),
          EMPLOYEES_FETCH_TIMEOUT_MS
        );
      });

      const rows = await Promise.race([
        employeeService.getAll(),
        timeoutPromise,
      ]);

      return rows || [];
    },
    staleTime: 60_000,
  });
};
