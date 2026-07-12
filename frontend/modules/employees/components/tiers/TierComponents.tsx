import { useState, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Input } from '@shared/components/ui/input';
import { Check, ChevronsUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { AppRow, Employee, SortDir } from '../../types/tier.types';

export const RenewalBadge = ({ date }: { date: string }) => {
  const days = differenceInDays(parseISO(date), new Date());
  if (days < 0)  return <span className="text-xs text-destructive font-medium">{date} <span className="text-[10px]">(منتهية)</span></span>;
  if (days <= 7)  return <span className="text-xs text-destructive font-medium">{date} <span className="text-[10px]">({days}د)</span></span>;
  if (days <= 30) return <span className="text-xs text-warning font-medium">{date} <span className="text-[10px]">({days}د)</span></span>;
  return <span className="text-xs text-foreground">{date}</span>;
};

export const AppMultiSelect = ({
  apps, selected, onChange,
}: { apps: AppRow[]; selected: string[]; onChange: (ids: string[]) => void }) => {
  const [open, setOpen] = useState(false);
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);

  const chosen = apps.filter(a => selected.includes(a.id));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="min-h-[32px] w-full flex flex-wrap gap-1 items-center px-2 py-1 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-colors text-start">
          {chosen.length === 0
            ? <span className="text-xs text-muted-foreground">اختر منصة...</span>
            : chosen.map(a => (
              <span key={a.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
                style={{ background: a.brand_color, color: a.text_color }}>
                {a.name}
              </span>
            ))}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {apps.map(a => (
          <button key={a.id} onClick={() => toggle(a.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-sm">
            <Check size={13} className={selected.includes(a.id) ? 'text-primary' : 'opacity-0'} />
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.brand_color }} />
            {a.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};

export const EmployeeSelect = ({
  employees, value, onChange,
}: { employees: Employee[]; value: string; onChange: (id: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const chosen = employees.find(e => e.id === value);
  const filtered = employees.filter(e => e.name.includes(q));

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (e.target instanceof Node && !ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="w-full min-w-[160px] flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border border-border/50 bg-background hover:border-primary/50 transition-colors text-sm">
        <span className={chosen ? 'text-foreground' : 'text-muted-foreground'}>
          {chosen ? chosen.name : 'بدون مندوب'}
        </span>
        <ChevronsUpDown size={12} className="text-muted-foreground flex-shrink-0" />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-56 bg-popover border border-border shadow-card overflow-hidden rounded-2xl">
          <div className="p-1.5 border-b border-border">
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..." className="h-7 text-xs" autoFocus />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button onClick={() => { onChange(''); setOpen(false); setQ(''); }}
              className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted transition-colors text-sm text-start border-b border-border mb-1">
              <Check size={13} className={!value ? 'text-primary' : 'opacity-0'} />
              <span className="text-muted-foreground italic">بدون مندوب</span>
            </button>
            {filtered.map(e => (
              <button key={e.id} onClick={() => { onChange(e.id); setOpen(false); setQ(''); }}
                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-muted transition-colors text-sm text-start">
                <Check size={13} className={e.id === value ? 'text-primary' : 'opacity-0'} />
                <span>{e.name}</span>
                {e.sponsorship_status === 'absconded' && (
                  <span className="mr-auto text-[10px] text-destructive">هروب</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-muted-foreground p-3 text-center">لا نتائج</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export const SortIcon = ({ field, sortField, sortDir }: { field: string; sortField: string | null; sortDir: SortDir }) => {
  if (sortField !== field) return <ChevronsUpDown size={11} className="text-muted-foreground/40 inline ms-1" />;
  if (sortDir === 'asc') return <ChevronUp size={11} className="text-primary inline ms-1" />;
  return <ChevronDown size={11} className="text-primary inline ms-1" />;
};

export const ThSort = ({ field, label, className, sortField, sortDir, onSort }: { field: string; label: string; className?: string; sortField: string | null; sortDir: SortDir; onSort: (field: string) => void }) => (
  <th
    className={`px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap select-none border-b border-border/50 text-center ${className ?? ''}`}
  >
    <button
      type="button"
      className="w-full cursor-pointer bg-transparent hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      {label} <SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </button>
  </th>
);
