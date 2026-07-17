import type React from 'react';
import { Plus, Columns, Filter, Building2, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { cityLabel } from '@modules/employees/model/employeeCity';
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem, DropdownMenuLabel,
} from '@shared/components/ui/dropdown-menu';
import { DataTableActions } from '@shared/components/table/DataTableActions';
import {
  ALL_COLUMNS,
  type ColKey, type UploadReport, type UploadLiveStats,
} from '@modules/employees/types/employee.types';

type EmployeeActionsBarProps = {
  actionLoading: boolean;
  permissions: { can_edit: boolean };
  onExport: () => Promise<void>;
  onDownloadTemplate: () => Promise<void>;
  onPrint: () => Promise<void>;
  onImportFile: (file: File) => Promise<void>;
  visibleCols: Set<ColKey>;
  setVisibleCols: React.Dispatch<React.SetStateAction<Set<ColKey>>>;
  onAddEmployee: () => void;
  onManageCommercialRecords: () => void;
  isUploading: boolean;
  uploadReport: UploadReport | null;
  setUploadReport: React.Dispatch<React.SetStateAction<UploadReport | null>>;
  uploadProgress: number;
  uploadLiveStats: UploadLiveStats;
  hasActiveFilters: boolean;
  colFilters: Record<string, string>;
  setColFilter: (key: string, value: string) => void;
  setColFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  filteredCount: number;
  totalCount: number;
};

export function EmployeeActionsBar({
  actionLoading, permissions,
  onExport, onDownloadTemplate, onPrint, onImportFile,
  visibleCols, setVisibleCols,
  onAddEmployee,
  onManageCommercialRecords,
  isUploading, uploadReport, setUploadReport,
  uploadProgress, uploadLiveStats,
  hasActiveFilters, colFilters, setColFilter, setColFilters,
  filteredCount, totalCount,
}: Readonly<EmployeeActionsBarProps>) {
  const { t } = useTranslation();
  let floatingUploadBody: React.ReactNode = null;
  if (isUploading) {
    floatingUploadBody = (
      <>
        <div className="text-xs text-muted-foreground">
          تمت معالجة الأسماء: <span className="font-semibold text-foreground">{uploadLiveStats.processedNames}</span> / {uploadLiveStats.totalNames}
        </div>
        {uploadLiveStats.currentName && (
          <div className="text-xs text-muted-foreground truncate">
            الآن: <span className="text-foreground font-medium">{uploadLiveStats.currentName}</span>
          </div>
        )}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
        </div>
        <div className="text-xs font-semibold text-foreground text-end">{uploadProgress}%</div>
      </>
    );
  } else if (uploadReport) {
    floatingUploadBody = (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-3 gap-1">
          <div className="rounded bg-muted/40 px-2 py-1 text-center">المعالجة: {uploadReport.totalProcessed}</div>
          <div className="rounded bg-emerald-50 text-emerald-700 px-2 py-1 text-center">نجاح: {uploadReport.successfulRows}</div>
          <div className="rounded bg-rose-50 text-rose-700 px-2 py-1 text-center">فشل: {uploadReport.failedRows}</div>
        </div>
        {uploadReport.errors.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded border border-rose-200 bg-rose-50/40 p-2 space-y-1">
            {uploadReport.errors.map((error) => (
              <div key={error.rowIndex} className="text-rose-700">
                السطر {error.rowIndex}: {error.issue}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <nav className="page-breadcrumb">
            <span>{t('humanResources')}</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">{t('employees')}</span>
          </nav>
          <h1 className="page-title">{t('employees')}</h1>
        </div>
        <div className="mb-1 grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
          <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            {/* Search */}
            <div className="relative col-span-2 sm:col-auto">
              <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder={t('searchEmployee')}
                value={colFilters.name ?? ''}
                onChange={e => setColFilter('name', e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background ps-8 pe-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
              />
            </div>

            <DataTableActions
              loading={actionLoading}
              onExport={onExport}
              onDownloadTemplate={onDownloadTemplate}
              onPrint={onPrint}
              onImportFile={onImportFile}
              hideImport={!permissions.can_edit}
              className="!w-full !justify-stretch [&_button]:w-full sm:!w-auto sm:!justify-start sm:[&_button]:w-auto"
            />

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-full gap-1.5 sm:w-auto">
                  <Columns size={14} /> {t('columns')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
                <DropdownMenuLabel>{t('showHideColumns')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {ALL_COLUMNS.map(col => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={visibleCols.has(col.key)}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={checked => {
                      setVisibleCols(prev => {
                        if (!checked && prev.size <= 1) {
                          return prev;
                        }
                        const next = new Set(prev);
                        if (checked) next.add(col.key); else next.delete(col.key);
                        return next;
                      });
                    }}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

          </div>

          {permissions.can_edit && (
            <>
              <Button variant="outline" onClick={onManageCommercialRecords} className="h-9 w-full gap-2 sm:w-auto">
                <Building2 size={15} /> {t('commercialRecords')}
              </Button>
              <Button onClick={onAddEmployee} className="h-9 w-full gap-2 sm:w-auto">
              <Plus size={15} /> {t('addEmployeeAction')}
            </Button>
            </>
          )}
        </div>
      </div>

      {(isUploading || uploadReport) && (
        <div className="fixed bottom-4 start-4 z-50 w-[min(92vw,420px)] border border-border/70 bg-card shadow-2xl p-3 space-y-2 rounded-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">حالة رفع القالب</p>
            {uploadReport && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => setUploadReport(null)}
              >
                إغلاق
              </Button>
            )}
          </div>
          {floatingUploadBody}
        </div>
      )}

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Filter size={12} /> الفلاتر النشطة:</span>
          {Object.entries(colFilters).map(([key, val]) => {
            const colLabel = ALL_COLUMNS.find(c => c.key === key)?.label || key;
            const kafalaLabels: Record<string, string> = {
              sponsored: 'على الكفالة',
              not_sponsored: 'ليس على الكفالة',
              absconded: 'هروب',
              terminated: 'انتهاء الخدمة',
            };
            let displayVal: string;
            if (key === 'city') {
              displayVal = val.split(',').map((v) => cityLabel(v.trim(), v.trim())).join('، ');
            } else if (key === 'sponsorship_status') {
              displayVal = val.split(',').map((v) => kafalaLabels[v.trim()] ?? v).join('، ');
            } else {
              displayVal = val;
            }
            return (
              <span key={key} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {colLabel}: {displayVal}
                <button type="button" aria-label="إزالة التصفية" onClick={() => setColFilter(key, '')} className="hover:text-destructive"><X size={10} /></button>
              </span>
            );
          })}
          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setColFilters({})}>
            مسح الكل
          </Button>
        </div>
      )}

      {/* Result count */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{filteredCount} نتيجة من أصل {totalCount}</span>
      </div>
    </>
  );
}
