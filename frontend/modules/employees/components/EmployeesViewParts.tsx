import type React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown, X, ChevronDown as FilterIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Skeleton } from '@shared/components/ui/skeleton';
import { Input } from '@shared/components/ui/input';
import { useSignedUrl, extractStoragePath } from '@shared/hooks/useSignedUrl';
import { getEmployeeCities } from '@modules/employees/model/employeeUtils';
import { cityLabel } from '@modules/employees/model/employeeCity';

export const CityBadge = ({ city }: { city?: string | null }) => {
  if (!city) return <span className="text-muted-foreground/40">•</span>;
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
      {cityLabel(city, city)}
    </span>
  );
};

export const CityBadges = ({ cities, city }: { cities?: string[] | null; city?: string | null }) => {
  const values = getEmployeeCities({ cities, city });
  if (values.length === 0) return <span className="text-muted-foreground/40">•</span>;
  return (
    <div className="flex flex-wrap justify-center gap-1">
      {values.map((value) => (
        <CityBadge key={value} city={value} />
      ))}
    </div>
  );
};

export const LicenseBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">•</span>;
  const map: Record<string, { label: string; cls: string }> = {
    has_license: { label: 'لديه رخصة', cls: 'badge-success' },
    no_license: { label: 'ليس لديه رخصة', cls: 'badge-urgent' },
    applied: { label: 'تم التقديم', cls: 'badge-warning' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

export const SponsorBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">•</span>;
  const map: Record<string, { label: string; cls: string }> = {
    sponsored: { label: 'على الكفالة', cls: 'badge-info' },
    not_sponsored: {
      label: 'ليس على الكفالة',
      cls: 'bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full',
    },
    absconded: { label: 'هروب', cls: 'badge-urgent' },
    terminated: { label: 'انتهاء الخدمة', cls: 'badge-urgent' },
  };
  const m = map[status];
  return m ? <span className={m.cls}>{m.label}</span> : null;
};

export const StatusBadge = ({ status }: { status?: string | null }) => {
  if (!status) return <span className="text-muted-foreground/40">•</span>;
  if (status === 'active') return <span className="badge-success">نشط</span>;
  if (status === 'inactive') return <span className="badge-warning">غير نشط</span>;
  if (status === 'ended')
    return <span className="bg-muted text-muted-foreground text-xs font-medium px-2.5 py-0.5 rounded-full">منتهي</span>;
  return <span className="text-muted-foreground/40">{status || '•'}</span>;
};

export const EmployeeAvatar = ({ path, name }: { path?: string | null; name: string }) => {
  const storagePath = extractStoragePath(path);
  const signedUrl = useSignedUrl('employee-documents', storagePath);
  if (!path) return null;
  if (!signedUrl) {
    return (
      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-xs font-semibold text-muted-foreground select-none">
        {name.charAt(0)}
      </div>
    );
  }
  return <img src={signedUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="" />;
};

export const SortIcon = ({
  field,
  sortField,
  sortDir,
}: {
  field: string;
  sortField: string | null;
  sortDir: 'asc' | 'desc' | null;
}) => {
  if (sortField !== field) return <ChevronsUpDown size={11} className="inline ms-1 text-current opacity-45" />;
  if (sortDir === 'asc') return <ChevronUp size={11} className="inline ms-1 text-current" />;
  return <ChevronDown size={11} className="inline ms-1 text-current" />;
};

export interface ColFilterPopoverProps {
  colKey: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
  onClear: () => void;
}

export const ColFilterPopover = ({ label, active, children, onClear }: Readonly<ColFilterPopoverProps>) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className={`inline-flex items-center gap-0.5 rounded transition-colors text-current ${active ? 'opacity-100' : 'opacity-45 hover:opacity-80'}`}
          title={`فلترة ${label}`}
          onClick={(e) => e.stopPropagation()}
        >
          <FilterIcon size={10} />
          {active && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3 space-y-2 max-h-80 overflow-y-auto" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">{label}</span>
          {active && (
            <button type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="text-xs text-destructive hover:underline flex items-center gap-1"
            >
              <X size={10} /> مسح
            </button>
          )}
        </div>
        {children}
      </PopoverContent>
    </Popover>
  );
};

export const SkeletonRow = ({ cols }: { cols: number }) => (
  <tr className="border-b border-border/30">
    {Array.from({ length: cols }, (_, i) => (
      <td key={i} className="ta-td">
        <Skeleton className="h-4 w-full" />
      </td>
    ))}
  </tr>
);

export const TextFilterInput = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) => (
  <Input
    className="h-7 text-xs px-2"
    placeholder="ابحث..."
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onClick={(e) => e.stopPropagation()}
    autoFocus
  />
);


