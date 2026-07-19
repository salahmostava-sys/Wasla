import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import type { OrderImportBatch } from '@services/performanceService';

function sourceLabel(sourceType: OrderImportBatch['source_type']) {
  switch (sourceType) {
    case 'excel':
      return 'Excel';
    case 'api':
      return 'API';
    default:
      return 'Manual';
  }
}

function statusLabel(status: OrderImportBatch['status']) {
  switch (status) {
    case 'completed':
      return 'مكتمل';
    case 'failed':
      return 'فشل';
    default:
      return 'قيد التنفيذ';
  }
}

interface OrdersImportHistorySummaryProps {
  batches: OrderImportBatch[];
  onDelete?: (batchId: string) => void;
  canDelete?: boolean;
}

export function OrdersImportHistorySummary(props: Readonly<OrdersImportHistorySummaryProps>) {
  const { batches, onDelete, canDelete = true } = props;
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  if (batches.length === 0) {
    return null;
  }

  const toggleExpand = (batchId: string) => {
    setExpandedBatch(expandedBatch === batchId ? null : batchId);
  };

  return (
    <div className="bg-card border border-border/50 p-3 shadow-sm rounded-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">آخر عمليات الاستيراد</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Batch tracking وملخص سريع لآخر المحاولات</p>
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{batches.length} سجل</span>
      </div>

      <div className="space-y-2">
        {batches.map((batch) => {
          const isExpanded = expandedBatch === batch.id;
          const hasErrors = batch.error_count > 0 || (batch.error_summary && batch.error_summary.length > 0);

          return (
            <div
              key={batch.id}
              className="rounded-lg border border-border/50 overflow-hidden"
            >
              <div className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 bg-card rounded-2xl">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{batch.file_name || 'بدون اسم ملف'}</span>
                    <span className="text-[11px] text-muted-foreground">{sourceLabel(batch.source_type)}</span>
                    {hasErrors && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-medium dark:bg-rose-950/45 dark:text-rose-300">
                        {batch.error_count} أخطاء
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {batch.imported_rows.toLocaleString('en-US')} / {batch.total_rows.toLocaleString('en-US')} صف
                    {batch.skipped_rows > 0 ? ` • ${batch.skipped_rows} تخطي` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={(() => {
                      if (batch.status === 'completed') return 'text-[11px] font-bold text-emerald-600';
                      if (batch.status === 'failed') return 'text-[11px] font-bold text-rose-500';
                      return 'text-[11px] font-bold text-amber-600';
                    })()}
                  >
                    {statusLabel(batch.status)}
                  </span>

                  {hasErrors && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => toggleExpand(batch.id)}
                      title={isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </Button>
                  )}

                  {canDelete && onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:text-rose-300 dark:hover:bg-rose-950/45"
                      onClick={() => onDelete(batch.id)}
                      title="حذف السجل"
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </Button>
                  )}
                </div>
              </div>

              {isExpanded && hasErrors && batch.error_summary && (
                <div className="px-3 py-2 bg-rose-50/50 border-t border-rose-100 dark:bg-rose-950/30 dark:border-rose-800/60">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} className="text-rose-500" />
                    <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">تفاصيل الأخطاء:</span>
                  </div>
                  <ul className="space-y-1">
                    {batch.error_summary.map((err) => (
                      <li key={`${err.row}-${err.reason}-${err.details ?? ''}`} className="text-[11px] text-rose-600 dark:text-rose-300">
                        {err.row ? `الصف ${err.row}: ` : ''}{err.reason}
                        {err.details ? ` (${err.details})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
