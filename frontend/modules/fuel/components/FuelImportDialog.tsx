import { useRef, useState } from 'react';
import { UploadCloud, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { NameMappingDialog } from '@modules/orders/components/NameMappingDialog';
import type { UnmatchedEmployeeName } from '@shared/lib/nameMatching';
import type { Employee, DailyRow } from '@modules/fuel/types/fuel.types';
import {
  buildDailyLookup,
  buildFuelImportRows,
  downloadFuelMetricTemplate,
  parseFuelImportFile,
  runFuelImportUpload,
  type FuelMetric,
} from '@modules/fuel/utils/fuelSpreadsheetImport';

type Props = Readonly<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  metric: FuelMetric;
  dayArr: number[];
  year: number;
  month: number;
  employees: Employee[];
  templateEmployees: Employee[];
  dailyRows: DailyRow[];
  bulkUpsertDailyMileage: (rows: { employee_id: string; date: string; km_total: number; fuel_cost: number; notes: string | null }[], chunkSize?: number) => Promise<{ saved: number; failed: { row: unknown; error: string }[] }>;
  onImported: () => void;
}>;

const METRIC_LABEL: Record<FuelMetric, string> = { km: 'الكيلومترات', fuel: 'البنزين' };

export function FuelImportDialog({
  open,
  onOpenChange,
  metric,
  dayArr,
  year,
  month,
  employees,
  templateEmployees,
  dailyRows,
  bulkUpsertDailyMileage,
  onImported,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pendingUnmatched, setPendingUnmatched] = useState<UnmatchedEmployeeName[] | null>(null);
  const [pendingState, setPendingState] = useState<{
    matrixByName: Map<string, { day: number; value: number }[]>;
    matched: Map<string, { id: string; name: string; similarity: number }>;
  } | null>(null);

  const resetState = () => {
    setPendingUnmatched(null);
    setPendingState(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const finalizeImport = async (nameMapping: Map<string, string>) => {
    if (!pendingState) return;
    setBusy(true);
    try {
      const dailyLookup = buildDailyLookup(dailyRows);
      const rows = buildFuelImportRows({
        matrixByName: pendingState.matrixByName,
        nameMapping,
        metric,
        year,
        month,
        dailyLookup,
      });
      await runFuelImportUpload({ rows, bulkUpsertDailyMileage });
      onImported();
      onOpenChange(false);
    } finally {
      setBusy(false);
      resetState();
    }
  };

  const handleFileSelected = async (file: File) => {
    setBusy(true);
    try {
      const parsed = await parseFuelImportFile({ file, dayArr, employees });
      if (!parsed) return;
      if (parsed.unmatched.length > 0) {
        setPendingUnmatched(parsed.unmatched);
        setPendingState({ matrixByName: parsed.matrixByName, matched: parsed.matched });
        return;
      }
      const finalMapping = new Map<string, string>();
      parsed.matched.forEach((m, name) => finalMapping.set(name, m.id));
      const dailyLookup = buildDailyLookup(dailyRows);
      const rows = buildFuelImportRows({
        matrixByName: parsed.matrixByName,
        nameMapping: finalMapping,
        metric,
        year,
        month,
        dailyLookup,
      });
      await runFuelImportUpload({ rows, bulkUpsertDailyMileage });
      onImported();
      onOpenChange(false);
    } finally {
      setBusy(false);
      resetState();
    }
  };

  return (
    <>
      <Dialog open={open && !pendingUnmatched} onOpenChange={(v) => { if (!v) { resetState(); } onOpenChange(v); }}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>رفع ملف {METRIC_LABEL[metric]} لكل المناديب</DialogTitle>
            <DialogDescription>
              القالب يحتوي على أسماء المناديب جاهزة، ثم عمود لكل يوم في الشهر. أدخل القيم المطلوبة وارفع الملف مباشرة.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            <Button
              variant="outline"
              className="gap-2 justify-start"
              onClick={() => downloadFuelMetricTemplate(dayArr, metric, templateEmployees, dailyRows)}
            >
              <Download size={16} /> تحميل القالب
            </Button>
            <Button
              className="gap-2 justify-start"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud size={16} /> {busy ? 'جاري المعالجة...' : 'اختيار ملف ورفعه'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelected(file);
              }}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NameMappingDialog
        open={!!pendingUnmatched}
        unmatched={pendingUnmatched ?? []}
        onConfirm={(mapping) => {
          if (!pendingState) return;
          const finalMapping = new Map<string, string>();
          pendingState.matched.forEach((m, name) => finalMapping.set(name, m.id));
          mapping.forEach((id, name) => finalMapping.set(name, id));
          finalizeImport(finalMapping);
        }}
        onCancel={() => resetState()}
      />
    </>
  );
}
