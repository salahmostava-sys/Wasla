/**
 * useSalaryActions — Thin orchestrator hook.
 *
 * All heavy logic has been extracted into specialised hooks:
 *   • useSalaryIO          — Excel import / export / template download
 *   • useSalaryPrint       — Print table, merged PDF, batch ZIP
 *   • useSalaryPersistence — Approve, pay, persist employee fields
 *
 * This file composes them and adds the remaining local-state helpers
 * (sorting, platform-order edits, employee-detail dialog).
 */

import { useEffect, useRef } from 'react';
import type React from 'react';
import type JSZip from 'jszip';
import { toast as sonnerToast } from '@shared/components/ui/sonner';
import { salaryService } from '@services/salaryService';
import type { PricingRule } from '@services/salaryService';
import type { SalaryRow, SchemeData, SortDir } from '@modules/salaries/types/salary.types';
import { computeSalaryRow } from '@modules/salaries/hooks/useSalaryTable';
import { getPrimaryPlatformActivityCount } from '@modules/salaries/model/salaryUtils';
import { useSalaryIO } from '@modules/salaries/hooks/useSalaryIO';
import { useSalaryPrint } from '@modules/salaries/hooks/useSalaryPrint';
import { useSalaryPersistence } from '@modules/salaries/hooks/useSalaryPersistence';
import { allocateSalaryByPlatformOrders } from '@modules/salaries/lib/salaryDomain';

// ─── Params (kept identical to the original for backward-compat) ─────────────

export interface UseSalaryActionsParams {
  rows: SalaryRow[];
  setRows: React.Dispatch<React.SetStateAction<SalaryRow[]>>;
  filtered: SalaryRow[];
  computeRow: (r: SalaryRow) => ReturnType<typeof computeSalaryRow>;
  selectedMonth: string;
  platforms: string[];
  platformColors: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }>;
  toast: typeof sonnerToast;
  user: { id: string } | null;
  uid: string;
  queryClient: ReturnType<typeof import('@tanstack/react-query').useQueryClient>;
  projectName: string;
  payslipRow: SalaryRow | null;
  setPayslipRow: React.Dispatch<React.SetStateAction<SalaryRow | null>>;
  sortField: string | null;
  setSortField: React.Dispatch<React.SetStateAction<string | null>>;
  sortDir: SortDir;
  setSortDir: React.Dispatch<React.SetStateAction<SortDir>>;
  salaryActionLoading: boolean;
  setSalaryActionLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setMarkingPaid: React.Dispatch<React.SetStateAction<string | null>>;
  setBatchQueue: React.Dispatch<React.SetStateAction<SalaryRow[]>>;
  setBatchIndex: React.Dispatch<React.SetStateAction<number>>;
  setBatchZip: React.Dispatch<React.SetStateAction<JSZip | null>>;
  setBatchMonth: React.Dispatch<React.SetStateAction<string>>;
  salaryToolbarImportRef: React.RefObject<HTMLInputElement | null>;
  employeeFieldSaving: string | null;
  setEmployeeFieldSaving: React.Dispatch<React.SetStateAction<string | null>>;
  appIdByName: Record<string, string>;
  pricingRulesByAppId: Record<string, PricingRule[]>;
  empPlatformScheme: Record<string, Record<string, SchemeData | null>>;
  setDetailRow: React.Dispatch<React.SetStateAction<SalaryRow | null>>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useSalaryActions(params: UseSalaryActionsParams) {
  const {
    rows, setRows, filtered, computeRow,
    selectedMonth, platforms, platformColors,
    toast, user, uid, queryClient, projectName,
    payslipRow, setPayslipRow,
    sortField, setSortField, sortDir, setSortDir,
    salaryActionLoading, setSalaryActionLoading,
    setMarkingPaid,
    setBatchQueue, setBatchIndex, setBatchZip, setBatchMonth,
    salaryToolbarImportRef,
    setEmployeeFieldSaving,
    appIdByName, pricingRulesByAppId, empPlatformScheme,
    setDetailRow,
  } = params;

  // FIX #3: keep refs to pricing data so updatePlatformOrders always reads fresh values.
  // These change when the admin updates schemes/rules while the page is open.
  const appIdByNameRef = useRef(appIdByName); appIdByNameRef.current = appIdByName;
  const pricingRulesByAppIdRef = useRef(pricingRulesByAppId); pricingRulesByAppIdRef.current = pricingRulesByAppId;
  const empPlatformSchemeRef = useRef(empPlatformScheme); empPlatformSchemeRef.current = empPlatformScheme;

  // ── Delegate to specialised hooks ─────────────────────────────────────────

  const io = useSalaryIO({
    filtered, computeRow, selectedMonth, toast,
    uid, queryClient,
    salaryToolbarImportRef, salaryActionLoading, setSalaryActionLoading,
  });

  const print = useSalaryPrint({
    filtered, computeRow, selectedMonth,
    platforms, platformColors, projectName, toast,
    setSalaryActionLoading,
    setBatchQueue, setBatchIndex, setBatchZip, setBatchMonth,
  });

  const persistence = useSalaryPersistence({
    rows, setRows, filtered, selectedMonth,
    toast, user, uid, queryClient,
    payslipRow, setPayslipRow,
    setMarkingPaid, setEmployeeFieldSaving,
  });

  // ── Local helpers (too small to warrant their own hook) ────────────────────

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // FIX W6d: updatePlatformOrders performs an OPTIMISTIC local salary calculation
  // so the user sees immediate feedback. This is intentionally a different code path
  // from the Supabase RPC (preview_salary_for_month) which is the single source of truth.
  // The row is marked isDirty=true, and on approve the server recalculates authoritatively.
  // Additionally, we debounce-invalidate the preview query so the RPC values catch up.
  const previewInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (previewInvalidateTimer.current) {
      clearTimeout(previewInvalidateTimer.current);
    }
  }, []);

  const updatePlatformOrders = (id: string, platform: string, value: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const currentMetric = r.platformMetrics[platform];
        if (currentMetric && currentMetric.workType !== 'orders') return r;
        const newOrders = { ...r.platformOrders, [platform]: value };
        const platformSchemes = empPlatformSchemeRef.current?.[r.employeeId] ?? {};
        const scheme = platformSchemes[platform];
        if (scheme?.id && scheme.salary_scheme_tiers?.length) {
          const groupedPlatforms = Object.keys(newOrders).filter(
            (name) => platformSchemes[name]?.id === scheme.id,
          );
          const groupedOrders = Object.fromEntries(
            groupedPlatforms.map((name) => [name, newOrders[name] ?? 0]),
          );
          const groupedSalary = salaryService.calculateTierSalary(
            Object.values(groupedOrders).reduce((sum, orders) => sum + orders, 0),
            scheme.salary_scheme_tiers,
            scheme.target_orders,
            scheme.target_bonus,
          );
          const allocations = allocateSalaryByPlatformOrders(groupedSalary, groupedOrders);
          const newSalaries = { ...r.platformSalaries, ...allocations };
          const newMetrics = { ...r.platformMetrics };
          groupedPlatforms.forEach((name) => {
            const metric = r.platformMetrics[name];
            newMetrics[name] = {
              appName: name,
              schemeId: scheme.id,
              schemeTotalOrders: Object.values(groupedOrders).reduce((sum, orders) => sum + orders, 0),
              workType: metric?.workType || 'orders',
              calculationMethod: metric?.calculationMethod ?? null,
              ordersCount: groupedOrders[name],
              shiftDays: metric?.shiftDays || 0,
              salary: allocations[name],
            };
          });
          return {
            ...r,
            platformOrders: newOrders,
            platformSalaries: newSalaries,
            platformMetrics: newMetrics,
            isDirty: true,
          };
        }
        // FIX #3: read from refs to avoid stale closure
        const appId = appIdByNameRef.current[platform];
        const appRules = appId ? (pricingRulesByAppIdRef.current[appId] || []) : [];
        const ruleResult = salaryService.applyPricingRules(appRules, value);
        let salary = Math.round(ruleResult.salary || 0);
        if (!ruleResult.matchedRule) {
          const fallbackScheme = empPlatformSchemeRef.current?.[r.employeeId]?.[platform];
          if (fallbackScheme?.salary_scheme_tiers) {
            salary = salaryService.calculateTierSalary(
              value,
              fallbackScheme.salary_scheme_tiers,
              fallbackScheme.target_orders,
              fallbackScheme.target_bonus,
            );
          }
        }
        const newSalaries = { ...r.platformSalaries, [platform]: salary };
        const nextMetric = {
          appName: platform,
          workType: currentMetric?.workType || 'orders',
          calculationMethod: currentMetric?.calculationMethod ?? null,
          ordersCount: value,
          shiftDays: currentMetric?.shiftDays || 0,
          salary,
        };
        const newMetrics = { ...r.platformMetrics, [platform]: nextMetric };
        return {
          ...r,
          platformOrders: { ...newOrders, [platform]: getPrimaryPlatformActivityCount(nextMetric) },
          platformSalaries: newSalaries,
          platformMetrics: newMetrics,
          isDirty: true,
        };
      }),
    );

    // Debounced server re-sync: after the user stops editing for 3s, invalidate
    // the preview query so RPC values replace optimistic local calculations.
    if (previewInvalidateTimer.current) clearTimeout(previewInvalidateTimer.current);
    previewInvalidateTimer.current = setTimeout(() => {
      queryClient.invalidateQueries({
        queryKey: ['salaries', uid, 'preview', selectedMonth],
      });
    }, 3_000);
  };

  const openEmployeeDetail = (row: SalaryRow) => {
    setDetailRow(row);
  };

  // ── Return the same public API as before (backward-compatible) ────────────

  return {
    // State
    handleSort,
    updateRow: persistence.updateRow,
    updatePlatformOrders,
    openEmployeeDetail,
    // Persistence
    persistEmployeeCity: persistence.persistEmployeeCity,
    persistEmployeePaymentMethod: persistence.persistEmployeePaymentMethod,
    approveRow: persistence.approveRow,
    unapproveRow: persistence.unapproveRow,
    approvingRowId: persistence.approvingRowId,
    markAsPaid: persistence.markAsPaid,
    approveAll: persistence.approveAll,
    computeServerSalaryForPayment: persistence.computeServerSalaryForPayment,
    settleAdvanceInstallments: persistence.settleAdvanceInstallments,
    // IO
    exportExcel: io.exportExcel,
    downloadSalaryTemplate: io.downloadSalaryTemplate,
    handleSalaryImportFile: io.handleSalaryImportFile,
    runExportExcel: io.runExportExcel,
    openSalaryToolbarImport: io.openSalaryToolbarImport,
    onSalaryToolbarImportChange: io.onSalaryToolbarImportChange,
    // Print
    handlePrintTable: print.handlePrintTable,
    startBatchZipExport: print.startBatchZipExport,
    exportMergedPDF: print.exportMergedPDF,
    runPrintTable: print.runPrintTable,
  };
}
