import type React from 'react';
import { Search, Save, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import { OrdersMonthNavigator } from '@shared/components/orders/OrdersMonthNavigator';
import { cn } from '@shared/lib/utils';
import { getAppColor, type AppColorData } from '@shared/hooks/useAppColors';
import type { App } from '@modules/orders/types';
import type { WorkType } from '@shared/types/shifts';

const getWorkTypeMeta = (workType?: WorkType | null) => {
  if (workType === 'shift') {
    return {
      icon: '⏰',
      label: 'دوام',
      title: 'منصة دوام: تسجيلها يتم من تبويب الدوام',
    };
  }
  if (workType === 'hybrid') {
    return {
      icon: '🔄',
      label: 'مختلط',
      title: 'منصة مختلطة: قد تُسجل كطلبات أو دوام حسب الإعداد',
    };
  }
  return {
    icon: '📦',
    label: 'طلبات',
    title: 'منصة طلبات',
  };
};

type Props = Readonly<{
  appColorsList: AppColorData[];
  apps: App[];
  monthLabelText: string;
  search: string;
  onSearchChange: (v: string) => void;
  monthGrandTotal: number;
  allPlatformsGrandTotal: number;
  monthDailyAvg: number;
  filteredEmployeesCount: number;
  platformFilter: string;
  onPlatformFilter: (id: string) => void;
  platformOrderTotals: Record<string, number>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  importRef: React.RefObject<HTMLInputElement>;
  onImportChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onTemplate: () => void;
  onPickImport: () => void;
  onPrint: () => void;
  onSave: () => void;
  onLockMonth: () => void;
  onBulkDelete: () => void;
  canEdit: boolean;
  canShowSave: boolean;
  canShowLock: boolean;
  saving: boolean;
  lockingMonth: boolean;
  isMonthLocked: boolean;
}>;

export function OrdersSpreadsheetToolbar(props: Readonly<Props>) {
  const {
    appColorsList,
    apps,
    monthLabelText,
    search,
    onSearchChange,
    monthGrandTotal,
    allPlatformsGrandTotal,
    monthDailyAvg,
    filteredEmployeesCount,
    platformFilter,
    onPlatformFilter,
    platformOrderTotals,
    onPrevMonth,
    onNextMonth,
    importRef,
    onImportChange,
    onExport,
    onTemplate,
    onPickImport,
    onPrint,
    onSave,
    onLockMonth,
    onBulkDelete,
    canEdit,
    canShowSave,
    canShowLock,
    saving,
    lockingMonth,
    isMonthLocked,
  } = props;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 flex-shrink-0">
      <OrdersMonthNavigator compact label={monthLabelText} onPrev={onPrevMonth} onNext={onNextMonth} />

      <div className="relative flex-1 min-w-[160px] max-w-md">
        <Search
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          placeholder="بحث بالاسم..."
          className="pr-8 h-8 text-xs"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] shrink-0">
        <span className="whitespace-nowrap">
          <span className="text-muted-foreground">إجمالي الطلبات:</span>{' '}
          <span className="font-bold tabular-nums text-foreground">{monthGrandTotal.toLocaleString('en-US')}</span>
          <span className="text-muted-foreground ms-0.5"> طلب</span>
        </span>
        <span className="hidden sm:inline h-3 w-px bg-border" aria-hidden />
        <span className="whitespace-nowrap">
          <span className="text-muted-foreground">شهري:</span>{' '}
          <span className="font-semibold tabular-nums text-foreground">{monthDailyAvg.toLocaleString('en-US')}</span>
          <span className="text-muted-foreground ms-0.5"> /يوم</span>
        </span>
        <span className="h-3 w-px bg-border" aria-hidden />
        <span className="whitespace-nowrap">
          <span className="text-muted-foreground">مناديب:</span>{' '}
          <span className="font-semibold tabular-nums text-foreground">{filteredEmployeesCount}</span>
        </span>
        {platformFilter !== 'all' && apps.find((a) => a.id === platformFilter) && (
          <>
            <span className="h-3 w-px bg-border" aria-hidden />
            <span className="text-primary font-medium truncate max-w-[7rem]">
              {apps.find((a) => a.id === platformFilter)?.name}
            </span>
          </>
        )}
      </div>

      {apps.length > 0 && (
        <>
          <span className="hidden lg:inline text-border mx-0.5 select-none">|</span>
          <div className="flex items-center gap-1.5 flex-wrap min-w-0 max-w-full lg:max-w-[min(100%,42rem)]">
            <span className="text-[10px] text-muted-foreground shrink-0">المنصات:</span>
            <span className="hidden xl:inline text-[10px] text-muted-foreground shrink-0">
              📦 طلبات · ⏰ دوام · 🔄 مختلط
            </span>
            <button
              type="button"
              onClick={() => onPlatformFilter('all')}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors leading-tight shrink-0',
                platformFilter === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
              )}
            >
              الكل ({allPlatformsGrandTotal.toLocaleString('en-US')})
            </button>
            {apps.map((app) => {
              const count = platformOrderTotals[app.id] ?? 0;
              const active = platformFilter === app.id;
              const c = getAppColor(appColorsList, app.name);
              const meta = getWorkTypeMeta(app.work_type);
              return (
                <button
                  type="button"
                  key={app.id}
                  onClick={() => onPlatformFilter(active ? 'all' : app.id)}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors max-w-[150px] leading-tight',
                    active
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                  )}
                  style={active ? { backgroundColor: c.bg, color: c.text, borderColor: c.bg } : undefined}
                  title={`${app.name} — ${meta.title}`}
                >
                  <span className="shrink-0" aria-hidden>{meta.icon}</span>
                  {app.logo_url && (
                    <img src={app.logo_url} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" alt="" />
                  )}
                  <span className="truncate">{app.name}</span>
                  <span className="shrink-0">({count.toLocaleString('en-US')})</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      <div className="flex items-center gap-1.5 ms-auto shrink-0">
        <input ref={importRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onImportChange} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 h-8 text-xs px-2">
              <FolderOpen size={13} /> ملفات
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onExport}>📊 تصدير Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={onTemplate}>📋 تحميل قالب الاستيراد</DropdownMenuItem>
            <DropdownMenuItem onClick={onPickImport}>⬆️ استيراد Excel</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onPrint}>🖨️ طباعة الجدول</DropdownMenuItem>
            {canEdit && !isMonthLocked && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onBulkDelete} className="text-destructive focus:text-destructive">
                  🗑️ حذف جماعي
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        {canShowSave && (
          <Button size="sm" className="gap-1 h-8 text-xs px-2.5" onClick={onSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" /> جاري الحفظ...
              </>
            ) : (
              <>
                <Save size={13} /> حفظ
              </>
            )}
          </Button>
        )}
        {isMonthLocked && canEdit && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-8 text-xs px-2 text-success border-success/40 hover:bg-success/10"
            onClick={onLockMonth}
            disabled={lockingMonth}
          >
            {lockingMonth ? (
              <>
                <Loader2 size={13} className="animate-spin" /> جاري الفتح...
              </>
            ) : (
              <>🔓 فتح الشهر</>
            )}
          </Button>
        )}
        {canShowLock && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1 h-8 text-xs px-2 text-warning border-warning/40 hover:bg-warning/10"
            onClick={onLockMonth}
            disabled={lockingMonth}
          >
            {lockingMonth ? (
              <>
                <Loader2 size={13} className="animate-spin" /> جاري القفل...
              </>
            ) : (
              <>قفل الشهر</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function OrdersSpreadsheetHint(props: Readonly<{ isMonthLocked: boolean }>) {
  const { isMonthLocked } = props;
  return (
    <p className="text-[10px] leading-snug text-muted-foreground flex-shrink-0">
      {isMonthLocked
        ? '🔒 هذا الشهر مقفول: كل الخلايا للقراءة فقط'
        : '💡 انقر على خلية اليوم لإدخال الطلبات — منصات الدوام تُسجل من تبويب الدوام — والرموز: 📦 طلبات، ⏰ دوام، 🔄 مختلط'}
    </p>
  );
}
