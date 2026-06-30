/**
 * Shared employee lookup utilities.
 * Extracted from services that had identical getEmployees implementations.
 */
import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';

export type ActiveEmployeeWithJobTitle = { id: string; name: string; job_title: string | null };

/**
 * Fetches active employees with id, name, and job_title.
 * Used by hrReviewService and leaveService (previously duplicated).
 */
export async function getActiveEmployeesWithJobTitle(): Promise<ActiveEmployeeWithJobTitle[]> {
  const PAGE_SIZE = 1000;
  const allRows: ActiveEmployeeWithJobTitle[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, job_title')
      .eq('status', 'active')
      .order('name')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) handleSupabaseError(error, 'getActiveEmployeesWithJobTitle');
    
    const rows = data ?? [];
    allRows.push(...rows);
    
    if (rows.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  return allRows;
}
