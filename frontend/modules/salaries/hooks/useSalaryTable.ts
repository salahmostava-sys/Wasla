import { useCallback, useMemo } from 'react';
import type { SalaryRow, SortDir } from '@modules/salaries/types/salary.types';
import { getTotalDeductions } from '@modules/salaries/lib/salaryDomain';
import { toComparableSortValue } from '@modules/salaries/lib/salaryConstants';
import { getDisplayedBaseSalary } from '@modules/salaries/model/salaryUtils';

export function computeSalaryRow(r: SalaryRow) {
  const totalPlatformSalary = getDisplayedBaseSalary(r);
  const totalAdditions = r.incentives + r.sickAllowance;
  const totalWithSalary = totalPlatformSalary + totalAdditions;
  const totalDeductions = getTotalDeductions(r);
  const netSalary = totalWithSalary - totalDeductions;
  const remaining = netSalary - r.transfer;
  return { totalPlatformSalary, totalAdditions, totalWithSalary, totalDeductions, netSalary, remaining };
}

export function useSalaryFilteredRows(
  rows: SalaryRow[],
  search: string,
  statusFilter: string,
  cityFilter: string,
  sortField: string | null,
  sortDir: SortDir,
  platforms: string[]
) {
  const computeRow = useCallback((r: SalaryRow) => computeSalaryRow(r), []);

  const filteredBase = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchSearch = q === '' || r.employeeName.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      const matchCity = cityFilter === 'all' || r.cityKey === cityFilter;
      return matchSearch && matchStatus && matchCity;
    });
  }, [rows, search, statusFilter, cityFilter]);

  const filtered = useMemo(() => {
    if (!sortField || !sortDir) return filteredBase;

    // FIX W2: pre-compute sort values once per row outside the comparator.
    // Previously, computeRow() was called inside the sort comparator — O(n log n) calls.
    // Now we compute once per row — O(n) — then sort on cached values.
    const getSortValue = (row: SalaryRow) => {
      const computed = computeRow(row);
      switch (sortField) {
        case 'employeeName':
          return row.employeeName;
        case 'jobTitle':
          return row.jobTitle;
        case 'nationalId':
          return row.nationalId;
        case 'platformSalaries':
          return computed.totalPlatformSalary;
        case 'incentives':
          return row.incentives;
        case 'sickAllowance':
          return row.sickAllowance;
        case 'totalAdditions':
          return computed.totalAdditions;
        case 'totalWithSalary':
          return computed.totalWithSalary;
        case 'advanceDeduction':
          return row.advanceDeduction;
        case 'violationDeduction':
          return row.violationDeduction;
        case 'totalDeductions':
          return computed.totalDeductions;
        case 'netSalary':
          return computed.netSalary;
        case 'transfer':
          return row.transfer;
        case 'remaining':
          return computed.remaining;
        case 'status':
          return row.status;
        default:
          if (platforms.includes(sortField)) return row.platformOrders[sortField] || 0;
          if (sortField.includes('_')) {
            const [appId, colId] = sortField.split('_');
            const col = row.customColumns.find(c => c.appId === appId && c.colId === colId);
            return col ? col.value : 0;
          }
          // Fallback: check known numeric fields on SalaryRow
          if (sortField in row) {
            const val = (row as unknown as Record<string, unknown>)[sortField];
            return typeof val === 'number' ? val : toComparableSortValue(val);
          }
          return 0;
      }
    };

    // Cache sort values — O(n) — then sort on cached pairs — O(n log n) comparisons, O(1) each
    const withValues = filteredBase.map((row) => ({ row, val: getSortValue(row) }));
    withValues.sort((a, b) => {
      if (a.val < b.val) return sortDir === 'asc' ? -1 : 1;
      if (a.val > b.val) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return withValues.map((x) => x.row);
  }, [filteredBase, sortField, sortDir, computeRow, platforms]);

  return { filtered, filteredBase, computeRow };
}
