import { useCallback, useState } from 'react';
import { employeeService } from '@services/employeeService';
import { settingsHubService } from '@services/settingsHubService';
import { loadXlsx } from '@modules/salaries/lib/salaryPdfLoaders';
import {
  buildWpsExport,
  toBankWpsAoa,
  toMudadCsv,
  type WpsEmployeeInput,
  type WpsEstablishment,
} from '@modules/salaries/lib/wpsExport';
import type { SalaryRow } from '@modules/salaries/types/salary.types';
import type { MergedPdfComputed } from '@modules/salaries/types/salary.types';
import { logError } from '@shared/lib/logger';
import type { toast as sonnerToast } from '@shared/components/ui/sonner';

export type WpsFormat = 'mudad' | 'bank';

// UTF-8 byte-order mark, so Excel/Mudad read the Arabic CSV as UTF-8.
const UTF8_BOM = '\uFEFF';

interface UseWpsExportParams {
  filtered: SalaryRow[];
  computeRow: (r: SalaryRow) => MergedPdfComputed;
  selectedMonth: string;
  /** The client company name (from system settings), used in the bank file header. */
  companyName: string;
  toast: typeof sonnerToast;
}

// The generated Supabase types lag the WPS-fields migration.
type TradeRegisterWps = {
  name: string | null;
  mol_establishment_number: string | null;
  employer_iban: string | null;
  employer_bank_code: string | null;
} | null;

function toEstablishment(record: TradeRegisterWps, companyName: string): WpsEstablishment {
  return {
    companyName: record?.name?.trim() || companyName,
    molEstablishmentNumber: record?.mol_establishment_number ?? '',
    employerIban: record?.employer_iban ?? '',
    employerBankCode: record?.employer_bank_code ?? null,
  };
}

function downloadTextFile(text: string, fileName: string, mime: string) {
  const blob = new Blob([UTF8_BOM + text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function useWpsExport({ filtered, computeRow, selectedMonth, companyName, toast }: UseWpsExportParams) {
  const [wpsLoading, setWpsLoading] = useState(false);

  const runWpsExport = useCallback(
    async (format: WpsFormat) => {
      setWpsLoading(true);
      try {
        const [employees, establishmentRecord] = await Promise.all([
          employeeService.getActiveForSalaryContext(),
          settingsHubService.getTradeRegister(),
        ]);

        const ibanById = new Map<string, string>();
        for (const e of employees as Array<{ id: string; iban: string | null }>) {
          ibanById.set(e.id, e.iban ?? '');
        }

        const inputs: WpsEmployeeInput[] = filtered.map((r) => {
          const c = computeRow(r);
          return {
            employeeId: r.employeeId,
            name: r.employeeName,
            nationalId: r.nationalId,
            iban: ibanById.get(r.employeeId) ?? '',
            paymentMethod: r.paymentMethod,
            basicSalary: c.totalPlatformSalary,
            otherAllowances: c.totalAdditions,
            deductions: c.totalDeductions,
            netSalary: c.netSalary,
          };
        });

        const result = buildWpsExport(inputs);
        if (result.included.length === 0) {
          toast.error('لا يوجد موظفون مؤهلون للتصدير', {
            description: 'كل الموظفين بدون آيبان صالح أو الدفع نقدي.',
          });
          return;
        }

        const establishment = toEstablishment(establishmentRecord as TradeRegisterWps, companyName);

        if (format === 'mudad') {
          const csv = toMudadCsv(result.included, selectedMonth);
          downloadTextFile(csv, `WPS_Mudad_${selectedMonth}.csv`, 'text/csv;charset=utf-8;');
        } else {
          const XLSX = await loadXlsx();
          const ws = XLSX.utils.aoa_to_sheet(toBankWpsAoa(result.included, establishment, selectedMonth));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'WPS');
          XLSX.writeFile(wb, `WPS_Bank_${selectedMonth}.xlsx`);
        }

        const parts = [`تم تصدير ${result.included.length} موظف`];
        if (result.excluded.length) parts.push(`استُبعد ${result.excluded.length} (بدون آيبان/نقدي)`);
        if (result.warnings.length) parts.push(`${result.warnings.length} صافيهم < 50% (قد تُرفض من مُدد)`);
        toast.success('تم تصدير ملف حماية الأجور', { description: parts.join(' • ') });
      } catch (err: unknown) {
        logError('[WPS] export failed', err);
        toast.error('تعذّر تصدير ملف حماية الأجور');
      } finally {
        setWpsLoading(false);
      }
    },
    [filtered, computeRow, selectedMonth, companyName, toast],
  );

  return { runWpsExport, wpsLoading };
}
