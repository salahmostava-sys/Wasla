import type React from 'react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/components/ui/dropdown-menu';
import { Search, FolderOpen, LayoutGrid, Table2, FileText, Archive, CheckCircle } from 'lucide-react';
import type { SalaryRow } from '@modules/salaries/types/salary.types';

interface SalaryActionsBarProps {
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  viewMode: 'table' | 'cards';
  setViewMode: (v: 'table' | 'cards') => void;
  pendingCount: number;
  /** FIX I5: canEdit was passed but ignored — now gates approve-all and import */
  canEdit: boolean;
  approveAll: () => void;
  salaryActionLoading: boolean;
  salaryToolbarImportRef: React.RefObject<HTMLInputElement | null>;
  onSalaryToolbarImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  runExportExcel: () => void;
  downloadSalaryTemplate: () => void;
  openSalaryToolbarImport: () => void;
  runPrintTable: () => void;
  startBatchZipExport: () => void;
  exportMergedPDF: () => void;
  batchQueue: SalaryRow[];
  batchIndex: number;
  openWpsDialog: () => void;
}

import { loadXlsx, loadJsPdf } from '@modules/salaries/lib/salaryPdfLoaders';

export function SalaryActionsBar(props: Readonly<SalaryActionsBarProps>) {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    pendingCount,
    canEdit,
    approveAll,
    salaryActionLoading,
    salaryToolbarImportRef,
    onSalaryToolbarImportChange,
    runExportExcel,
    downloadSalaryTemplate,
    openSalaryToolbarImport,
    runPrintTable,
    startBatchZipExport,
    exportMergedPDF,
    batchQueue,
    batchIndex,
    openWpsDialog,
  } = props;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        ref={salaryToolbarImportRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        className="hidden"
        onChange={onSalaryToolbarImportChange}
      />
      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث بالاسم..." className="pr-9 h-9 w-48" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="flex gap-1">
        {[{ v: 'all', l: 'الكل' }, { v: 'pending', l: 'معلّق' }, { v: 'approved', l: 'معتمد' }, { v: 'paid', l: 'مصروف' }].map(s => (
          <button type="button" key={s.v} onClick={() => setStatusFilter(s.v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {s.l}
          </button>
        ))}
      </div>
      <div className="flex gap-2 ms-auto items-center">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button type="button"
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            <Table2 size={13} /> جدول
          </button>
          <button type="button"
            onClick={() => setViewMode('cards')}
            className={`px-2.5 py-1.5 flex items-center gap-1 text-xs border-r border-l border-border transition-colors ${viewMode === 'cards' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            <LayoutGrid size={13} /> بطاقات
          </button>
        </div>
        {pendingCount > 0 && canEdit && (
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={approveAll}>
            <CheckCircle size={13} /> اعتماد الكل ({pendingCount})
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-1.5 h-9"
              onMouseEnter={() => {
                loadXlsx();
                loadJsPdf();
              }}
            >
              <FolderOpen size={14} /> ملفات
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={runExportExcel} disabled={salaryActionLoading}>
              📊 تصدير Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={downloadSalaryTemplate} disabled={salaryActionLoading}>
              📋 تحميل قالب الاستيراد
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openSalaryToolbarImport} disabled={salaryActionLoading || !canEdit}>
              ⬆️ استيراد Excel
            </DropdownMenuItem>
            <DropdownMenuItem onClick={runPrintTable} disabled={salaryActionLoading}>
              🖨️ طباعة الجدول
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={startBatchZipExport}
              disabled={batchQueue.length > 0}
            >
              <Archive size={13} className="me-2" />
              {batchQueue.length > 0 ? `جارٍ التصدير ${batchIndex}/${batchQueue.length}...` : 'تحميل ZIP كل الكشوف'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportMergedPDF}>
              <FileText size={13} className="me-2" /> PDF مدمج للكل
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openWpsDialog}>
              🏦 حماية الأجور (WPS / مُدد)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

interface BatchProgressBarProps {
  batchQueue: SalaryRow[];
  batchIndex: number;
  batchMonth: string;
}

export function BatchProgressBar(props: Readonly<BatchProgressBarProps>) {
  const { batchQueue, batchIndex, batchMonth } = props;

  if (batchQueue.length === 0) return null;

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5 flex items-center gap-3">
      <Archive size={14} className="text-primary flex-shrink-0 animate-pulse" />
      <div className="flex-1">
        <div className="flex justify-between text-xs mb-1">
          <span className="text-primary font-medium">جارٍ تجهيز كشوف الرواتب ({batchMonth})</span>
          <span className="text-muted-foreground">{batchIndex} / {batchQueue.length}</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${(batchIndex / batchQueue.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
