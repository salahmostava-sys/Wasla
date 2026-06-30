import { supabase } from './supabase/client';
import { throwIfError } from './serviceError';
import type { SalaryDraftPatch } from '@modules/salaries/types/salary.types';

export interface SalaryDraft {
  id: string;
  user_id: string;
  month_year: string;
  employee_id: string;
  draft_data: SalaryDraftPatch;
  created_at: string;
  updated_at: string;
}

const rowIdToEmployeeId = (rowId: string, monthYear: string) => {
  const suffix = `-${monthYear}`;
  return rowId.endsWith(suffix) ? rowId.slice(0, -suffix.length) : rowId;
};

const getAuthenticatedUserId = async (
  context: string,
  required = true,
): Promise<string | null> => {
  const { data, error } = await supabase.auth.getUser();
  throwIfError(error, `${context}.getUser`);

  const userId = data.user?.id ?? null;
  if (!userId && required) {
    throw new Error('User not authenticated');
  }

  return userId;
};

export const salaryDraftService = {
  /**
   * Get all drafts for a specific month
   */
  getDraftsForMonth: async (monthYear: string): Promise<Record<string, SalaryDraftPatch>> => {
    const userId = await getAuthenticatedUserId('salaryDraftService.getDraftsForMonth', false);
    if (!userId) return {};

    const { data, error } = await supabase.from('salary_drafts')
      .select('employee_id, draft_data')
      .eq('month_year', monthYear)
      .eq('user_id', userId);

    throwIfError(error, 'salaryDraftService.getDraftsForMonth');

    const draftMap: Record<string, SalaryDraftPatch> = {};
    (data || []).forEach((draft) => {
      const rowId = `${draft.employee_id}-${monthYear}`;
      draftMap[rowId] = draft.draft_data as SalaryDraftPatch;
    });

    return draftMap;
  },

  /**
   * Save or update a draft for a specific employee
   */
  saveDraft: async (
    monthYear: string,
    employeeId: string,
    draftData: SalaryDraftPatch
  ): Promise<void> => {
    const userId = await getAuthenticatedUserId('salaryDraftService.saveDraft');
    if (!userId) throw new Error('User not authenticated');
    const { error } = await supabase
      .from('salary_drafts')
      .upsert(
        {
          month_year: monthYear,
          employee_id: employeeId,
          draft_data: draftData,
          user_id: userId,
        },
        {
          onConflict: 'user_id,month_year,employee_id',
        }
      );

    throwIfError(error, 'salaryDraftService.saveDraft');
  },

  /**
   * Save multiple drafts at once (batch operation).
   * Accepts an optional pre-resolved userId to avoid a redundant auth call
   * when invoked from syncDraftsForMonth (which already holds the userId).
   */
  saveDraftsBatch: async (
    monthYear: string,
    drafts: Record<string, SalaryDraftPatch>,
    preResolvedUserId?: string,
  ): Promise<void> => {
    // FIX Q1: accept pre-resolved userId to prevent double auth call from syncDraftsForMonth
    const userId = preResolvedUserId ?? await getAuthenticatedUserId('salaryDraftService.saveDraftsBatch');
    if (!userId) throw new Error('User not authenticated');

    const records = Object.entries(drafts).map(([rowId, draftData]) => {
      const employeeId = rowIdToEmployeeId(rowId, monthYear);
      return {
        user_id: userId,
        month_year: monthYear,
        employee_id: employeeId,
        draft_data: draftData,
      };
    });

    if (records.length === 0) return;

    const { error } = await supabase
      .from('salary_drafts')
      .upsert(records, {
        onConflict: 'user_id,month_year,employee_id',
      });

    throwIfError(error, 'salaryDraftService.saveDraftsBatch');
  },

  /**
   * Replace the current user's drafts for a month atomically:
   * 1. Fetch existing employee ids for this month (read-first).
   * 2. Upsert desired drafts.
   * 3. Delete stale ids that are no longer in the desired set.
   *
   * FIX B2: original order was save→select→delete.
   * If select failed after save, stale rows accumulated indefinitely.
   * New order: select→save→delete keeps the window of inconsistency minimal
   * and ensures delete only runs when we have a full picture of existing rows.
   */
  syncDraftsForMonth: async (
    monthYear: string,
    drafts: Record<string, SalaryDraftPatch>
  ): Promise<void> => {
    const userId = await getAuthenticatedUserId('salaryDraftService.syncDraftsForMonth');
    if (!userId) throw new Error('User not authenticated');
    const desiredEmployeeIds = new Set(
      Object.keys(drafts).map((rowId) => rowIdToEmployeeId(rowId, monthYear))
    );

    // Step 1: read existing ids BEFORE saving — gives us a clean snapshot
    const { data: existingData, error: selectError } = await supabase.from('salary_drafts')
      .select('employee_id')
      .eq('month_year', monthYear)
      .eq('user_id', userId);

    throwIfError(selectError, 'salaryDraftService.syncDraftsForMonth.select');

    // Step 2: upsert desired drafts — pass userId to avoid a second auth call
    if (desiredEmployeeIds.size > 0) {
      await salaryDraftService.saveDraftsBatch(monthYear, drafts, userId ?? undefined);
    }

    // Step 3: delete stale rows (those not in desired set)
    const staleEmployeeIds = (existingData || [])
      .map((draft) => String(draft.employee_id ?? ''))
      .filter((id) => id && !desiredEmployeeIds.has(id));

    if (staleEmployeeIds.length === 0) return;

    const { error: deleteError } = await supabase.from('salary_drafts')
      .delete()
      .eq('month_year', monthYear)
      .eq('user_id', userId)
      .in('employee_id', staleEmployeeIds);

    throwIfError(deleteError, 'salaryDraftService.syncDraftsForMonth.delete');
  },

  /**
   * Delete a specific draft
   */
  deleteDraft: async (monthYear: string, employeeId: string): Promise<void> => {
    const userId = await getAuthenticatedUserId('salaryDraftService.deleteDraft');
    if (!userId) throw new Error('User not authenticated');
    const { error } = await supabase
      .from('salary_drafts')
      .delete()
      .eq('month_year', monthYear)
      .eq('user_id', userId)
      .eq('employee_id', employeeId);

    throwIfError(error, 'salaryDraftService.deleteDraft');
  },

  /**
   * Delete all drafts for a specific month
   */
  clearDraftsForMonth: async (monthYear: string): Promise<void> => {
    const userId = await getAuthenticatedUserId('salaryDraftService.clearDraftsForMonth');
    if (!userId) throw new Error('User not authenticated');
    const { error } = await supabase
      .from('salary_drafts')
      .delete()
      .eq('month_year', monthYear)
      .eq('user_id', userId);

    throwIfError(error, 'salaryDraftService.clearDraftsForMonth');
  },

  /**
   * Subscribe to draft changes for real-time collaboration
   */
  subscribeToDraftChanges: (
    monthYear: string,
    onDraftChange: (payload: { employee_id: string; draft_data: SalaryDraftPatch; user_id: string }) => void
  ) => {
    return supabase
      .channel(`salary_drafts:${monthYear}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'salary_drafts',
          filter: `month_year=eq.${monthYear}`,
        },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const record = payload.new as { employee_id: string; draft_data: SalaryDraftPatch; user_id: string };
            onDraftChange(record);
          }
        }
      )
      .subscribe();
  },
};
