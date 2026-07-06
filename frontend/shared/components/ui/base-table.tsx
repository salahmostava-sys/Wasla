import type { ReactNode } from 'react';
import { Inbox, Loader2 } from 'lucide-react';

export interface TableColumn<T> {
  key: string | keyof T;
  title: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
}

export interface BaseTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  emptyMessage?: string;
  className?: string;
  isLoading?: boolean;
}

export function BaseTable<T>({ 
  data, 
  columns, 
  emptyMessage = 'لا توجد سجلات لعرضها', 
  className = '', 
  isLoading = false 
}: Readonly<BaseTableProps<T>>) {
  if (isLoading) {
    return (
      <div className="w-full min-h-[200px] flex flex-col items-center justify-center border rounded-xl bg-card text-muted-foreground gap-3 animate-pulse">
        <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        <p className="text-sm">جاري جلب البيانات...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full min-h-[200px] flex flex-col items-center justify-center border rounded-xl bg-card text-muted-foreground p-8 text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Inbox className="w-6 h-6 opacity-60" />
        </div>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`w-full overflow-x-auto border rounded-xl bg-card ${className}`}>
      <table className="w-full text-sm text-right">
        <thead className="bg-muted/50 border-b">
          <tr>
            {columns.map((col, idx) => (
              <th key={String(col.key) + idx} className={`p-4 font-medium text-muted-foreground min-w-[120px] whitespace-normal text-center align-middle ${col.className || ''}`}>
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-muted/30 transition-colors">
              {columns.map((col, colIndex) => (
                <td key={String(col.key) + colIndex} className={`p-4 align-middle ${col.className || ''}`}>
                  {col.render ? col.render(row, rowIndex) : String((row as Record<keyof T, unknown>)[col.key as keyof T] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
