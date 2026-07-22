import { useCallback, useState } from 'react';
import { isEmployeeIdUuid, isValidSalaryMonthYear } from '@shared/lib/salaryValidation';
import { salaryDataService } from '@services/salaryDataService';
import { employeeService } from '@services/employeeService';
import { salaryDraftService } from '@services/salaryDraftService';
import { buildSalaryRowSnapshot, getManualDeductionTotal } from '@modules/salaries/lib/salaryDomain';

import type { SalaryRow } from '@modules/salaries/types/salary.types';
import { getDisplayedBaseSalary } from '@modules/salaries/model/salaryUtils';
import { useSafeAction } from '@shared/hooks/useSafeAction';
import { logError } from '@shared/lib/logger';

import { toast as sonnerToast } from '@shared/components/ui/sonner';


export interface UseSalaryPersistenceParams {
  rows: SalaryRow[];
  setRows: React.Dispatch<React.SetStateAction<SalaryRow[]>>;
  filtered: SalaryRow[];
  selectedMonth: string;
  toast: typeof sonnerToast;
  user: { id: string } | null;
  uid: string;
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>;
  payslipRow: SalaryRow | null;
  setPayslipRow: React.Dispatch<React.SetStateAction<SalaryRow | null>>;
  setMarkingPaid: React.Dispatch<React.SetStateAction<string | null>>;
  setEmployeeFieldSaving: React.Dispatch<React.SetStateAction<string | null>>;
}


export function useSalaryPersistence(params: UseSalaryPersistenceParams) {
  const {
    rows: _rows,
    setRows,
    filtered,
    selectedMonth,
    toast,
    user,
    uid,
    queryClient,
    payslipRow,
    setPayslipRow,
    setMarkingPaid,
    setEmployeeFieldSaving,
  } = params;

  const { run } = useSafeAction({ toast, errorTitle: 'حدث خطأ' });

  const [approvingRowId, setApprovingRowId] = useState<string | null>(null);

  const getLatestRows = useCallback((): Promise<SalaryRow[]> => {
    return new Promise((resolve) => {
      setRows((prev) => {
        resolve(prev);
        return prev;
      });
    });
  }, [setRows]);

  const getLatestRow = useCallback((id: string): Promise<SalaryRow | undefined> => {
    return getLatestRows().then(rows => rows.find(r => r.id === id));
  }, [getLatestRows]);

  const resolveBaseSalaryForPersistence = useCallback(
    (row: SalaryRow, serverBaseSalary: number) => {
      const sheetBaseSalary = getDisplayedBaseSalary(row);
      return sheetBaseSalary > 0 ? sheetBaseSalary : serverBaseSalary;
    },
    [],
  );

  const refreshMonthSnapshot = useCallback(() => {
    salaryDataService.captureMonthSnapshot(selectedMonth).catch((error) => {
      logError('[Salaries] Failed to refresh salary month snapshot', error, { level: 'warn' });
    });
  }, [selectedMonth]);

  // Optimistic-concurrency write: updates the existing row only if its version
  // still matches what was loaded (row.dbVersion), or inserts a brand-new row
  // if none exists yet. Returns { conflict: true } instead of writing when
  // someone else changed this employee's salary since it was loaded — callers
  // must NOT treat a conflict as success.
  const writeSalaryRecordWithVersionCheck = useCallback(
    (row: SalaryRow, payload: Record<string, unknown>) =>
      row.dbId
        ? salaryDataService.updateWithVersionCheck(row.dbId, row.dbVersion, payload)
        : salaryDataService.insertNew(payload),
    [],
  );

  const reportConflict = useCallback(() => {
    toast.error('تم تعديل هذا الراتب من مستخدم آخر', {
      description: 'الرجاء تحديث الصفحة والمحاولة مجددًا.',
    });
  }, [toast]);


  const updateRow = useCallback(
    (id: string, patch: Partial<SalaryRow>) => {
      const patchChangesRow = (row: SalaryRow) =>
        Object.entries(patch).some(([key, value]) => {
          const currentValue = (row as unknown as Record<string, unknown>)[key];
          if (currentValue === value) return false;
          if (
            currentValue &&
            value &&
            typeof currentValue === 'object' &&
            typeof value === 'object'
          ) {
            return JSON.stringify(currentValue) !== JSON.stringify(value);
          }
          return true;
        });

      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const updated = { ...r, ...patch };
          if (patchChangesRow(r) && !('status' in patch) && !('isDirty' in patch)) {
            updated.isDirty = true;
          }
          return updated;
        }),
      );
      if (payslipRow?.id === id) setPayslipRow((prev) => (prev ? { ...prev, ...patch } : prev));
    },
    [payslipRow, setRows, setPayslipRow],
  );


  // computeServerSalaryForPayment computes manualDeduction ONCE here and returns
  // it in the result; callers must NOT call getManualDeductionTotal separately
  // (P1: avoid redundant computation on each approve/pay call).
  const computeServerSalaryForPayment = useCallback(
    async (row: SalaryRow, monthYear: string) => {
      const manualDeduction = getManualDeductionTotal(row);
      const calcData = await salaryDataService.calculateSalaryForEmployeeMonth(
        row.employeeId,
        monthYear,
        row.paymentMethod,
        manualDeduction,
        null,
      );
      const calc = (Array.isArray(calcData) ? calcData[0] : calcData) as
        | Record<string, number>
        | undefined;
      const baseSalary = resolveBaseSalaryForPersistence(row, Number(calc?.base_salary ?? 0));
      const advanceDeduction = Number(calc?.advance_deduction ?? row.advanceDeduction ?? 0);
      const externalDeduction = Number(calc?.external_deduction ?? row.externalDeduction ?? 0);
      const totalAdditions = row.incentives + row.sickAllowance;
      const totalDeductions =
        row.violations + manualDeduction + advanceDeduction + externalDeduction;
      const netSalary = Math.max(baseSalary + totalAdditions - totalDeductions, 0);
      return {
        manualDeduction,
        baseSalary,
        advanceDeduction,
        externalDeduction,
        totalAdditions,
        netSalary,
      };
    },
    [resolveBaseSalaryForPersistence],
  );

  // FIX C1: replaced N sequential getAdvanceInstallmentStatuses queries with a
  // single bulk query (getInstallmentsByIds already returns all relevant rows).
  // We derive per-advance completion from those rows directly with O(1) DB calls.

  const settleAdvanceInstallments = useCallback(async (row: SalaryRow, nowStr: string) => {
    if (row.advanceInstallmentIds.length === 0) return;

    // Mark installments deducted first
    await salaryDataService.markInstallmentsDeducted(row.advanceInstallmentIds, nowStr);

    // Fetch all installments for these advances in ONE query (not N)
    const instData = await salaryDataService.getInstallmentsByIds(row.advanceInstallmentIds);
    if (!instData.length) return;

    // Build a map of advance_id to deducted installment ids we just marked
    const justDeductedIds = new Set(row.advanceInstallmentIds);

    // Group installments by advance and check if all are now deducted
    const advanceIdToStatuses = new Map<string, string[]>();
    for (const inst of instData) {
      const effective = justDeductedIds.has(inst.id ?? '') ? 'deducted' : inst.status;
      if (!advanceIdToStatuses.has(inst.advance_id)) {
        advanceIdToStatuses.set(inst.advance_id, []);
      }
      advanceIdToStatuses.get(inst.advance_id)!.push(effective);
    }

    // Complete any advance where all installments are now deducted in parallel.
    const completions = [...advanceIdToStatuses.entries()]
      .filter(([, statuses]) => statuses.every((s) => s === 'deducted'))
      .map(([advId]) => salaryDataService.markAdvanceCompleted(advId));

    if (completions.length > 0) await Promise.all(completions);
  }, []);


  const approveRow = useCallback(
    async (id: string) => {
      // FIX W6b: guard against double-fire; if already approving any row, bail out.
      if (approvingRowId) return;

      // FIX W6c: read rows from the state updater to avoid stale closure.
      const row = await getLatestRow(id);
      if (!row) return;
      if (!isEmployeeIdUuid(row.employeeId) || !isValidSalaryMonthYear(selectedMonth)) {
        toast.error('تعذّر الاعتماد', {
          description: 'معرف الموظف أو الشهر غير صالح',
        });
        return;
      }

      setApprovingRowId(id);
      const calcResult = await run(
        () => computeServerSalaryForPayment(row, selectedMonth),
        { errorTitle: 'تعذّر حساب الراتب من الخادم' },
      );
      if (!calcResult) {
        setApprovingRowId(null);
        return;
      }

      const { manualDeduction, baseSalary, advanceDeduction, externalDeduction, totalAdditions, netSalary } = calcResult;
      const rowSnapshot = buildSalaryRowSnapshot({
        ...row,
        advanceDeduction,
        externalDeduction,
      });

      const writeResult = await run(
        () =>
          writeSalaryRecordWithVersionCheck(row, {
            employee_id: row.employeeId,
            month_year: selectedMonth,
            base_salary: baseSalary,
            allowances: totalAdditions,
            attendance_deduction: row.violations,
            advance_deduction: advanceDeduction,
            external_deduction: externalDeduction,
            manual_deduction: manualDeduction,
            net_salary: netSalary,
            is_approved: true,
            approved_by: user?.id ?? null,
            approved_at: new Date().toISOString(),
            payment_method: row.paymentMethod,
            sheet_snapshot: rowSnapshot,
          }),
        { errorTitle: 'تعذّر حفظ الاعتماد' },
      );
      if (!writeResult) {
        setApprovingRowId(null);
        return;
      }
      if (writeResult.conflict) {
        setApprovingRowId(null);
        reportConflict();
        return;
      }

      refreshMonthSnapshot();

      salaryDraftService.deleteDraft(selectedMonth, row.employeeId).catch((e) => {
        logError('[Salaries] Failed to clear draft after approve', e, { level: 'warn' });
      });

      updateRow(id, { status: 'approved', isDirty: false, advanceDeduction, externalDeduction });
      setApprovingRowId(null);
      toast.success('تم اعتماد الراتب');


    },
    [selectedMonth, toast, user, run, computeServerSalaryForPayment, updateRow, refreshMonthSnapshot, approvingRowId, getLatestRow, writeSalaryRecordWithVersionCheck, reportConflict],
  );

  const unapproveRow = useCallback(
    async (id: string) => {
      if (approvingRowId) return;

      const row = await getLatestRow(id);
      if (!row) return;

      setApprovingRowId(id);
      const success = await run(
        async () => {
          await salaryDataService.deleteByEmployeeMonth(row.employeeId, selectedMonth);
          return true;
        },
        { errorTitle: 'تعذّر إلغاء الاعتماد' },
      );
      if (!success) {
        setApprovingRowId(null);
        return;
      }

      refreshMonthSnapshot();

      updateRow(id, { status: 'pending', isDirty: true });
      setApprovingRowId(null);
      toast.success('تم إلغاء الاعتماد');
    },
    [toast, run, updateRow, refreshMonthSnapshot, approvingRowId, getLatestRow, selectedMonth],
  );


  const markAsPaid = useCallback(
    async (row: SalaryRow) => {
      if (!isEmployeeIdUuid(row.employeeId) || !isValidSalaryMonthYear(selectedMonth)) {
        toast.error('معرف الموظف أو الشهر غير صالح');
        return;
      }
      setMarkingPaid(row.id);
      await run(
        async () => {
          const {
            manualDeduction,
            baseSalary,
            advanceDeduction,
            externalDeduction,
            totalAdditions,
            netSalary,
          } = await computeServerSalaryForPayment(row, selectedMonth);
          const nowStr = new Date().toISOString();
          const rowSnapshot = buildSalaryRowSnapshot({
            ...row,
            advanceDeduction,
            externalDeduction,
          });

          const writeResult = await writeSalaryRecordWithVersionCheck(row, {
            employee_id: row.employeeId,
            month_year: selectedMonth,
            base_salary: baseSalary,
            allowances: totalAdditions,
            attendance_deduction: row.violations,
            advance_deduction: advanceDeduction,
            external_deduction: externalDeduction,
            manual_deduction: manualDeduction,
            net_salary: netSalary,
            is_approved: true,
            approved_by: user?.id ?? null,
            approved_at: nowStr,
            payment_method: row.paymentMethod,
            sheet_snapshot: rowSnapshot,
          });
          if (writeResult.conflict) {
            reportConflict();
            return;
          }

          await settleAdvanceInstallments(row, nowStr);

          salaryDraftService.deleteDraft(selectedMonth, row.employeeId).catch((e) => {
            logError('[Salaries] Failed to clear draft after payment', e, { level: 'warn' });
          });

          // FIX C2: refreshMonthSnapshot moved inside run() so it only fires on success
          refreshMonthSnapshot();
          updateRow(row.id, {
            status: 'paid',
            isDirty: false,
            advanceDeduction,
            externalDeduction,
          });
          toast.success('تم الصرف وحفظ سجل الراتب');
        },
        { errorTitle: 'خطأ أثناء الصرف' },
      );
      setMarkingPaid(null);
    },
    [selectedMonth, toast, user, run, computeServerSalaryForPayment, settleAdvanceInstallments, updateRow, setMarkingPaid, refreshMonthSnapshot, writeSalaryRecordWithVersionCheck, reportConflict],
  );


  const approveAll = useCallback(async () => {
    // FIX #1: read fresh rows from state to prevent stale closure data.
    // We read fresh rows, then re-filter using filtered ids.
    const filteredIds = new Set(filtered.map((r) => r.id));
    const freshRows = await getLatestRows();
    const approvalRows = freshRows
      .filter((r) => filteredIds.has(r.id))
      .filter((r) => r.status === 'pending' || r.isDirty);
    if (approvalRows.length === 0) return;
    if (!isValidSalaryMonthYear(selectedMonth)) {
      toast.error('خطأ', { description: 'الشهر المحدد غير صالح' });
      return;
    }

    const monthCalcData = await run(
      () => salaryDataService.calculateSalaryForMonth(selectedMonth),
      { errorTitle: 'خطأ أثناء الحساب من الخادم' },
    );
    // FIX M7: undefined means run() caught an error and showed a toast; abort.
    if (monthCalcData === undefined) return;

    // monthCalcData may be empty array if the RPC returned no rows (legitimate).
    // We handle rows with no server calc gracefully below via skippedRows.
    const monthCalcMap = new Map<string, Record<string, number>>(
      (Array.isArray(monthCalcData) ? monthCalcData : []).map((item) => [
        String((item as Record<string, unknown>).employee_id),
        item as Record<string, number>,
      ]),
    );

    const nowStr = new Date().toISOString();
    const skippedRows: string[] = [];
    const records = approvalRows
      .filter((row) => {
        const calc = monthCalcMap.get(row.employeeId);
        if (!calc && getDisplayedBaseSalary(row) <= 0) {
          skippedRows.push(row.employeeName);
          return false;
        }
        return true;
      })
      .map((row) => {
        const calc = monthCalcMap.get(row.employeeId);
        const manualDeduction = getManualDeductionTotal(row);
        const baseSalary = resolveBaseSalaryForPersistence(row, Number(calc?.base_salary ?? 0));
        const advanceDeduction = Number(calc?.advance_deduction ?? row.advanceDeduction ?? 0);
        const externalDeduction = Number(calc?.external_deduction ?? row.externalDeduction ?? 0);
        const totalAdditions = row.incentives + row.sickAllowance;
        const totalDeductions =
          row.violations + manualDeduction + advanceDeduction + externalDeduction;
        const netSalary = Math.max(baseSalary + totalAdditions - totalDeductions, 0);
        const rowSnapshot = buildSalaryRowSnapshot({
          ...row,
          advanceDeduction,
          externalDeduction,
        });
        return {
          employee_id: row.employeeId,
          month_year: selectedMonth,
          base_salary: baseSalary,
          allowances: totalAdditions,
          attendance_deduction: row.violations,
          advance_deduction: advanceDeduction,
          external_deduction: externalDeduction,
          manual_deduction: manualDeduction,
          net_salary: netSalary,
          is_approved: true,
          approved_by: user?.id ?? null,
          approved_at: nowStr,
          payment_method: row.paymentMethod,
          sheet_snapshot: rowSnapshot,
        };
      });

    // Re-check versions right before writing: catches an employee whose salary
    // was approved/edited by someone else since this page loaded. Rows with no
    // dbId yet (never approved before) have nothing to conflict against.
    const rowByEmployeeId = new Map(approvalRows.map((r) => [r.employeeId, r]));
    const employeeIdsToRecheck = approvalRows.filter((r) => r.dbId).map((r) => r.employeeId);
    const currentVersions = await run(
      () => salaryDataService.getCurrentVersions(selectedMonth, employeeIdsToRecheck),
      { errorTitle: 'تعذّر التحقق من أحدث نسخة للرواتب' },
    );
    if (currentVersions === undefined) return;
    const currentVersionMap = new Map(currentVersions.map((v) => [v.employee_id, v.version]));

    const conflictedNames: string[] = [];
    const finalRecords = records.filter((record) => {
      const row = rowByEmployeeId.get(record.employee_id);
      if (!row?.dbId) return true;
      if (currentVersionMap.get(record.employee_id) !== row.dbVersion) {
        conflictedNames.push(row.employeeName);
        return false;
      }
      return true;
    });

    const saved = finalRecords.length === 0 ? true : await run(
      async () => {
        await salaryDataService.upsertSalaryRecords(finalRecords);
        return true;
      },
      { errorTitle: 'خطأ أثناء الاعتماد' },
    );
    if (!saved) return;

    refreshMonthSnapshot();

    const approvedIds = new Set(finalRecords.map((r) => r.employee_id));
    const approvedRowIds = new Set(
      approvalRows
        .filter((r) => approvedIds.has(r.employeeId))
        .map((r) => r.id)
    );
    await Promise.all(
      approvalRows
        .filter((r) => approvedIds.has(r.employeeId))
        .map((r) =>
          salaryDraftService.deleteDraft(selectedMonth, r.employeeId).catch((e) => {
            logError('[Salaries] Failed to clear draft after bulk approve', e, { level: 'warn' });
          }),
        ),
    );
    setRows((prev) =>
      prev.map((r) => (
        approvedRowIds.has(r.id)
          ? { ...r, status: 'approved' as const, isDirty: false }
          : r
      )),
    );
    if (skippedRows.length > 0) {
      toast.warning(`تم تخطي ${skippedRows.length} موظف (لا يوجد حساب من الخادم)`, {
        description: skippedRows.join('، '),
      });
    }
    if (conflictedNames.length > 0) {
      toast.warning(`تم تخطي ${conflictedNames.length} موظف (تم تعديله من مستخدم آخر)`, {
        description: conflictedNames.join('، '),
      });
    }
    if (finalRecords.length > 0) {
      toast.success(`تم اعتماد ${finalRecords.length} راتب وحفظها`);
    }
  }, [filtered, selectedMonth, toast, user, run, setRows, resolveBaseSalaryForPersistence, refreshMonthSnapshot, getLatestRows]);


  const persistEmployeeCity = useCallback(
    async (row: SalaryRow, nextCity: 'makkah' | 'jeddah') => {
      if (row.cityKey === nextCity) return;
      setEmployeeFieldSaving(`${row.employeeId}:city`);
      await run(
        async () => {
          await employeeService.updateEmployee(row.employeeId, { city: nextCity });
          // FIX C4: correct query key; was 'base-context', now 'context' to match useSalaryData.
          await queryClient.invalidateQueries({
            queryKey: ['salaries', uid, 'context', selectedMonth],
          });
          toast.success('تم تحديث الفرع');
        },
        { errorTitle: 'فشل تحديث الفرع' },
      );
      setEmployeeFieldSaving(null);
    },
    [toast, queryClient, uid, selectedMonth, setEmployeeFieldSaving, run],
  );

  const persistEmployeePaymentMethod = useCallback(
    (row: SalaryRow, next: 'bank' | 'cash') => {
      if (row.paymentMethod === next) return;
      if (next === 'bank' && !row.hasIban) {
        toast.error('لا يوجد رقم آيبان', {
          description: 'أضف رقم الآيبان من ملف الموظف قبل اختيار التحويل البنكي.',
        });
        return;
      }
      setEmployeeFieldSaving(`${row.employeeId}:payment`);
      updateRow(row.id, { paymentMethod: next });
      toast.success('تم تحديث طريقة الصرف; اعتمد الراتب لحفظ التغيير نهائيا');
      setEmployeeFieldSaving(null);
    },
    [toast, setEmployeeFieldSaving, updateRow],
  );

  return {
    updateRow,
    approveRow,
    unapproveRow,
    approvingRowId,
    markAsPaid,
    approveAll,
    persistEmployeeCity,
    persistEmployeePaymentMethod,
    computeServerSalaryForPayment,
    settleAdvanceInstallments,
  };
}
