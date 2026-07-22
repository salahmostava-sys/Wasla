import { useCallback, useState } from 'react';
import { employeeService } from '@services/employeeService';
import { settingsHubService } from '@services/settingsHubService';
import { loadXlsx } from '@modules/salaries/lib/salaryPdfLoaders';
import {
  buildWpsExport,
  toBankWpsAoa,
  toMudadCsv,
  type WpsBuildResult,
  type WpsEmployeeInput,
  type WpsEstablishment,
} from '@modules/salaries/lib/wpsExport';
import type { MergedPdfComputed, SalaryRow } from '@modules/salaries/types/salary.types';
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<WpsBuildResult | null>(null);
  const [establishment, setEstablishment] = useState<WpsEstablishment | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch data + build the WPS result (without downloading) for the preview dialog.
  const openWpsDialog = useCallback(async () => {
    setDialogOpen(true);
    setPreview(null);
    setPreviewLoading(true);
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

      setEstablishment(toEstablishment(establishmentRecord as TradeRegisterWps, companyName));
      setPreview(buildWpsExport(inputs));
    } catch (err: unknown) {
      logError('[WPS] preview failed', err);
      toast.error('تعذّر تجهيز معاينة حماية الأجور');
      setDialogOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  }, [filtered, computeRow, companyName, toast]);

  const downloadWps = useCallback(
    async (format: WpsFormat) => {
      if (!preview || preview.included.length === 0) return;
      setDownloading(true);
      try {
        if (format === 'mudad') {
          const csv = toMudadCsv(preview.included, selectedMonth);
          downloadTextFile(csv, `WPS_Mudad_${selectedMonth}.csv`, 'text/csv;charset=utf-8;');
        } else {
          const est = establishment ?? toEstablishment(null, companyName);
          const XLSX = await loadXlsx();
          const ws = XLSX.utils.aoa_to_sheet(toBankWpsAoa(preview.included, est, selectedMonth));
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, 'WPS');
          XLSX.writeFile(wb, `WPS_Bank_${selectedMonth}.xlsx`);
        }
        toast.success('تم تصدير ملف حماية الأجور', {
          description: `${preview.included.length} موظف`,
        });
        setDialogOpen(false);
      } catch (err: unknown) {
        logError('[WPS] download failed', err);
        toast.error('تعذّر تصدير ملف حماية الأجور');
      } finally {
        setDownloading(false);
      }
    },
    [preview, establishment, selectedMonth, companyName, toast],
  );

  return {
    dialogOpen,
    setDialogOpen,
    previewLoading,
    preview,
    downloading,
    openWpsDialog,
    downloadWps,
  };
}
