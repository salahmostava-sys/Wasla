import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { getAppColor, type AppColorData } from '@shared/hooks/useAppColors';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ColorBadge } from '@shared/components/ui/ColorBadge';

type App = { id: string; name: string };
type DailyData = Record<string, number>;

export type OrdersPopoverState = { empId: string; day: number; x: number; y: number };

type Props = {
  state: OrdersPopoverState;
  apps: App[];
  data: DailyData;
  appColorsList: AppColorData[];
  canEdit: boolean;
  onApply: (empId: string, day: number, vals: Record<string, number>) => void;
  onClose: () => void;
};

export const OrdersCellPopover = ({ state, apps, data, appColorsList, canEdit, onApply, onClose }: Readonly<Props>) => {
  const defaultValues = useMemo(() => {
    const v: Record<string, string> = {};
    apps.forEach((app) => {
      const k = `${state.empId}::${app.id}::${state.day}`;
      const cur = data[k];
      if (typeof cur === 'number' && cur > 0) v[app.id] = String(cur);
      else v[app.id] = '';
    });
    return { vals: v };
  }, [apps, data, state.day, state.empId]);

  const schema = useMemo(
    () =>
      z.object({
        vals: z.record(
          z
            .string()
            .optional()
            .or(z.literal(''))
            .transform((s) => (s ?? '').trim())
            .refine((s) => s === '' || /^\d+$/.test(s), 'أرقام فقط')
            .transform((s) => (s === '' ? 0 : Number(s)))
            .refine((n) => Number.isFinite(n) && n >= 0, 'غير صالح')
        ),
      }),
    []
  );

  type FormValues = z.infer<typeof schema>;

  const formApi = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as unknown as FormValues,
    mode: 'onBlur',
  });

  const { register, reset, formState, getValues } = formApi;
  const popRef = useRef<HTMLDialogElement>(null);
  const [pos, setPos] = useState({ top: state.y + 6, left: state.x, arrowLeft: 0 });

  useLayoutEffect(() => {
    if (!popRef.current) return;
    const rect = popRef.current.getBoundingClientRect();
    let left = state.x - (rect.width / 2);
    let top = state.y + 6;
    if (left < 8) left = 8;
    if (left + rect.width > globalThis.innerWidth - 8) left = globalThis.innerWidth - rect.width - 8;
    if (top + rect.height > globalThis.innerHeight - 8) top = state.y - rect.height - 6;
    if (top < 8) top = 8;
    const arrowLeft = Math.min(Math.max(state.x - left, 12), rect.width - 12);
    setPos({ top, left, arrowLeft });
  }, [state.x, state.y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [onClose]);

  useEffect(() => {
    reset(defaultValues as unknown as FormValues);
  }, [defaultValues, reset]);

  const handleApply = () => {
    const raw = getValues();
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return;
    onApply(state.empId, state.day, parsed.data.vals);
    onClose();
  };

  return createPortal(
    <dialog
      open
      aria-modal="false"
      ref={popRef}
      className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl p-3 min-w-[140px] max-w-none m-0 text-inherit"
      style={{ top: pos.top, left: pos.left }}
    >
      <div
        className="absolute -top-1.5 -translate-x-1/2 w-3 h-3 bg-popover border-t border-l border-border rotate-45"
        style={{ left: pos.arrowLeft }}
      />
      <div className="flex items-center justify-between mb-2.5 relative z-10">
        <span className="text-xs font-semibold text-foreground">يوم {state.day}</span>
        <button type="button" aria-label="إغلاق" onClick={onClose} className="text-muted-foreground hover:text-foreground p-0.5 rounded">
          <X size={13} />
        </button>
      </div>
      <form
        className="space-y-1.5 relative z-10"
        onSubmit={(e) => {
          e.preventDefault();
          handleApply();
        }}
      >
        <div className="flex flex-col gap-2">
          {apps.map((app) => {
            const c = getAppColor(appColorsList, app.name);
            return (
              <div key={app.id} className="flex items-center gap-2">
                <ColorBadge
                  label={app.name}
                  bg={c.solid}
                  fg={c.solidText}
                  className="flex-shrink-0 w-[4.5rem] justify-center text-center py-0.5 px-1 text-[10px] leading-tight"
                />
                <input
                  type="number" min={0} placeholder="0"
                  {...register(`vals.${app.id}` as const)}
                  disabled={!canEdit}
                  className="flex-1 w-16 h-7 text-center text-sm rounded border border-border bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleApply();
                    if (e.key === 'Escape') onClose();
                  }}
                />
              </div>
            );
          })}
        </div>
        {canEdit && formState.isSubmitted && formState.isValid === false && (
          <p className="text-[11px] text-destructive mt-2">تأكد أن القيم أرقام صحيحة.</p>
        )}
      </form>
      {canEdit && (
        <Button size="sm" className="w-full mt-3 h-7 text-xs gap-1 relative z-10" onClick={handleApply} type="button">
          <Check size={12} /> تطبيق
        </Button>
      )}
    </dialog>,
    document.body
  );
};
