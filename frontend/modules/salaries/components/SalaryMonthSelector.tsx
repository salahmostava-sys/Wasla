import { useMemo } from 'react';
import { Wallet, TrendingUp, Users, Building2, Package, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/ui/button';
import { SalaryEngineStatusBadge } from '@modules/salaries/components/SalaryEngineStatusBadge';
import { isAdministrativeJobTitle } from '@modules/salaries/model/salaryUtils';
import type { SalaryRow } from '@modules/salaries/types/salary.types';

interface SalaryMonthSelectorProps {
  loadingData: boolean;
  previewBackendError: string | null;
  isRefreshingPreview?: boolean;
}

export function SalaryMonthSelector(props: Readonly<SalaryMonthSelectorProps>) {
  const { loadingData, previewBackendError, isRefreshingPreview = false } = props;
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <nav className="page-breadcrumb">
          <span>{t('home')}</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>{t('monthlyPayroll')}</span>
        </nav>
        <h1 className="page-title flex items-center gap-2"><Wallet size={20} /> {t('monthlyPayroll')}</h1>
        <div className="mt-1">
          <SalaryEngineStatusBadge
            loadingData={loadingData}
            previewBackendError={previewBackendError}
            isRefreshingPreview={isRefreshingPreview}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs"
          onClick={() => navigate('/orders')}
        >
          <Package size={13} />
          {t('orders')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 h-8 text-xs"
          onClick={() => navigate('/orders?tab=shifts')}
        >
          <Clock size={13} />
          {t('shifts')}
        </Button>
      </div>
    </div>
  );
}

interface SalarySummaryCardsProps {
  totalNet: number;
  platforms: string[];
  platformColors: Record<string, { header: string; headerText: string; cellBg: string; valueColor: string; focusBorder: string }>;
  filtered: SalaryRow[];
  computeRow: (r: SalaryRow) => { totalPlatformSalary: number; totalAdditions: number; totalWithSalary: number; totalDeductions: number; netSalary: number; remaining: number };
}

export function SalarySummaryCards(props: Readonly<SalarySummaryCardsProps>) {
  const { totalNet, platforms, platformColors, filtered, computeRow } = props;

  // FIX Q2: memoize all derived sums so they don't recompute on every parent render.
  // Previously all reduce() calls ran on every render regardless of whether filtered changed.
  const platformTotals = useMemo(
    () => Object.fromEntries(
      platforms.map((p) => [p, filtered.reduce((s, r) => s + (r.platformSalaries[p] || 0), 0)])
    ),
    [filtered, platforms],
  );

  const adminTotal = useMemo(
    () => filtered
      .filter((r) => isAdministrativeJobTitle(r.jobTitle))
      .reduce((s, r) => s + computeRow(r).netSalary, 0),
    [filtered, computeRow],
  );

  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(160px, 1fr))` }}>
      <div className="bg-card border-t-4 border-primary p-4 shadow-card rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight">إجمالي الرواتب</p>
            <p className="text-[22px] font-semibold text-foreground leading-tight mt-1">{totalNet.toLocaleString('en-US')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">ريال سعودي</p>
          </div>
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={14} className="text-primary" />
          </div>
        </div>
      </div>

      {platforms.map(p => {
        const pc = platformColors[p];
        return (
          <div key={p} className="bg-card p-4 shadow-card border-t-4 rounded-2xl" style={{ borderTopColor: pc?.header || 'hsl(var(--primary))' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground leading-tight truncate">{p}</p>
                <p className="text-[22px] font-semibold text-foreground leading-tight mt-1">{(platformTotals[p] ?? 0).toLocaleString('en-US')}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">ريال سعودي</p>
              </div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${pc?.header}20` }}>
                <Users size={14} style={{ color: pc?.header || 'hsl(var(--primary))' }} />
              </div>
            </div>
          </div>
        );
      })}

      <div className="bg-card border-t-4 border-muted-foreground/30 p-4 shadow-card rounded-2xl">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-tight">الرواتب الإدارية</p>
            <p className="text-[22px] font-semibold text-foreground leading-tight mt-1">{adminTotal.toLocaleString('en-US')}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">ريال سعودي</p>
          </div>
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Building2 size={14} className="text-muted-foreground" />
          </div>
        </div>
      </div>
    </div>
  );
}
