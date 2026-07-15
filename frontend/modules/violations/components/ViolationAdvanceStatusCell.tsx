import type { ViolationAdvanceStatusCellProps } from '@modules/violations/types/violation.types';

export function ViolationAdvanceStatusCell({ v, convertedAdv }: Readonly<ViolationAdvanceStatusCellProps>) {
  if (v.linked_advance_id) {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          محوّل لسلفة
        </span>
        <span className="text-[10px] font-mono text-muted-foreground dir-ltr" title={v.linked_advance_id}>
          {v.linked_advance_id.slice(0, 8)}…
        </span>
      </span>
    );
  }
  if (convertedAdv) {
    return (
      <span className="text-[11px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground" title="سجل قديم: مذكور في الملاحظة فقط">
        محوّل (قديم)
      </span>
    );
  }
  return <span className="text-[11px] text-muted-foreground">—</span>;
}
