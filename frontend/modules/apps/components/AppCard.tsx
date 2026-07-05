import type React from 'react';
import { Edit2, Plus, Power, PowerOff, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@shared/components/ui/select';
import type { AppData } from '@modules/apps/types';
import { getWorkTypeLabel } from '@shared/lib/workType';
import type { WorkType } from '@shared/types/shifts';

interface AppCardProps {
  app: AppData;
  selected: boolean;
  canEdit: boolean;
  onSelect: (app: AppData) => void;
  onEdit: (app: AppData) => void;
  onToggleActive: (app: AppData, event: React.MouseEvent) => void;
  onDelete: (app: AppData, event: React.MouseEvent) => void;
  onWorkTypeChange?: (app: AppData, workType: WorkType) => void;
}

export const AppCard = ({
  app,
  selected,
  canEdit,
  onSelect,
  onEdit,
  onToggleActive,
  onDelete,
  onWorkTypeChange,
}: Readonly<AppCardProps>) => {
  const isActiveInMonth = app.is_active_this_month;

  return (
    <button
      type="button"
      onClick={() => isActiveInMonth && onSelect(app)}
      onKeyDown={(event) => {
        if (isActiveInMonth && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onSelect(app);
        }
      }}
      tabIndex={isActiveInMonth ? 0 : -1}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border text-center transition-all ${
        isActiveInMonth
          ? 'border-white/20 shadow-sm hover:scale-[1.01] hover:shadow-card-hover'
          : 'border-white/20 opacity-50 grayscale hover:grayscale-0'
      } ${selected ? 'ring-2 ring-primary border-primary' : ''}`}
      style={{ backgroundColor: app.brand_color, color: app.text_color }}
    >
      <div className="h-full p-5">
        {canEdit && (
          <div
            className="absolute left-2 top-2 z-10 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity"
          >
            <button
              onClick={(event) => {
                event.stopPropagation();
                onEdit(app);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-black"
              title="تعديل"
              type="button"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={(event) => onToggleActive(app, event)}
              className={`flex h-7 w-7 items-center justify-center rounded-full backdrop-blur-sm transition-colors ${
                isActiveInMonth
                  ? 'bg-white/20 hover:bg-rose-500 hover:text-white'
                  : 'bg-white/20 hover:bg-emerald-500 hover:text-white'
              }`}
              title={isActiveInMonth ? 'تعطيل لهذا الشهر' : 'تفعيل لهذا الشهر'}
              type="button"
            >
              {isActiveInMonth ? <PowerOff size={12} /> : <Power size={12} />}
            </button>
            <button
              onClick={(event) => onDelete(app, event)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-rose-600 hover:text-white"
              title="أرشفة نهائية"
              type="button"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}

        <div className={`mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl ${app.logo_url ? 'bg-white' : 'bg-white/20'} text-3xl font-bold shadow-sm overflow-hidden`}>
          {app.logo_url ? (
            <img src={app.logo_url} alt={app.name} className="w-full h-full object-contain p-1" />
          ) : (
            app.name.charAt(0)
          )}
        </div>

        <h3 className="truncate text-sm font-bold" style={{ color: app.text_color }}>
          {app.name}
        </h3>
        <div
          className="mt-1 flex justify-center"
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
        >
          {canEdit && onWorkTypeChange ? (
            <Select
              value={app.work_type || 'orders'}
              onValueChange={(v) => onWorkTypeChange(app, v as WorkType)}
            >
              <SelectTrigger
                className="h-6 w-auto min-w-[80px] border-0 bg-white/20 text-[10px] font-semibold px-2 py-0 gap-1 rounded-full hover:bg-white/30 focus:ring-0 focus:ring-offset-0"
                style={{ color: app.text_color }}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="orders">📦 طلبات</SelectItem>
                <SelectItem value="shift">⏰ دوام</SelectItem>
                <SelectItem value="hybrid">🔄 مختلط</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: app.text_color }}
            >
              {getWorkTypeLabel(app.work_type)}
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: app.text_color, opacity: 0.85 }}>المناديب العاملين</span>
            <span className="font-black text-black text-[15px]">
              {app.employeeCount.toLocaleString('en-US')}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: app.text_color, opacity: 0.85 }}>إجمالي الطلبات</span>
            <span className="font-black text-black text-[15px]">
              {app.ordersCount.toLocaleString('en-US')}
            </span>
          </div>
        </div>

        {!isActiveInMonth && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <span className="rounded-lg border border-white/20 bg-black/50 px-2 py-1 text-[10px] font-bold text-white">
              غير مفعلة للشهر
            </span>
          </div>
        )}
      </div>
    </button>
  );
};

export const AddAppCard = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="group flex min-h-[160px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border p-5 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
    type="button"
  >
    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary/10">
      <Plus size={20} className="text-muted-foreground group-hover:text-primary" />
    </div>
    <p className="text-xs font-medium text-muted-foreground group-hover:text-primary">إضافة منصة جديدة</p>
  </button>
);
