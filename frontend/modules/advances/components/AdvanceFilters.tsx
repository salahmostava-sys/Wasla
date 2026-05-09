import { Search, AlertTriangle } from 'lucide-react';
import { Input } from '@shared/components/ui/input';

interface AdvanceFiltersProps {
  writtenOffTotals: { count: number; remaining: number };
  showWrittenOff: boolean;
  setShowWrittenOff: (v: boolean | ((p: boolean) => boolean)) => void;
  search: string;
  setSearch: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
}

export const AdvanceFilters = ({
  writtenOffTotals,
  showWrittenOff,
  setShowWrittenOff,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
}: Readonly<AdvanceFiltersProps>) => {
  return (
    <>
      {writtenOffTotals.count > 0 && (
        <button
          type="button"
          onClick={() => { setShowWrittenOff(v => !v); }}
          className={`w-full flex items-center gap-3 rounded-xl border p-3 text-sm transition-colors ${showWrittenOff ? 'bg-destructive/10 border-destructive/30' : 'bg-muted/30 border-border/40 hover:bg-muted/50'}`}>
          <AlertTriangle size={16} className="text-destructive flex-shrink-0" />
          <span className="font-medium text-foreground">الديون المعدومة: {writtenOffTotals.count} مندوب</span>
          <span className="font-bold text-destructive ms-1">{writtenOffTotals.remaining.toLocaleString('en-US')} ر.س</span>
          <span className="ms-auto text-xs text-muted-foreground">{showWrittenOff ? 'إخفاء ←' : 'عرض ←'}</span>
        </button>
      )}
      {!showWrittenOff && (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 max-w-sm">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث بالاسم أو رقم الإقامة..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="flex gap-2">
        {[{ v: 'all', l: 'الكل' }, { v: 'active', l: 'نشط' }, { v: 'has_debt', l: 'عليه متبقي' }, { v: 'completed', l: 'منتهي' }].map(s => (
          <button key={s.v} onClick={() => setStatusFilter(s.v)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${statusFilter === s.v ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
            {s.l}
          </button>
        ))}
      </div>
    </div>
      )}
    </>
  );
};
