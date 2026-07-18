import type React from 'react';
import { useMemo, useState } from 'react';
import { differenceInDays, differenceInYears, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Users, UserCheck, UserX, UserMinus, ShieldCheck, ShieldOff, Car, AlertTriangle, CalendarClock, MapPin, Globe2, TrendingUp } from 'lucide-react';
import type { Employee } from '@modules/employees/model/employeeUtils';
import { getEmployeeCities } from '@modules/employees/model/employeeUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import { ScrollArea } from '@shared/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

interface Props {
  allEmployees: Employee[];
  onSelectEmployee?: (id: string) => void;
}

const today = new Date();

const daysDiff = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  try { return differenceInDays(parseISO(dateStr), today); } catch { return null; }
};

const isExcluded = (e: Employee) => {
  if (e.status === 'ended' || e.status === 'inactive') return true;
  if (e.sponsorship_status === 'absconded' || e.sponsorship_status === 'terminated') return true;
  return false;
};

export function EmployeeKPIs({ allEmployees, onSelectEmployee }: Readonly<Props>) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    title: string;
    employees: Employee[];
  }>({
    isOpen: false,
    title: '',
    employees: [],
  });

  const showDetails = (title: string, list: Employee[]) => {
    setDetailModal({
      isOpen: true,
      title,
      employees: list,
    });
  };

  const stats = useMemo(() => {
    // 1. General raw counts (must keep all employees for basic summary tabs status overview)
    const activeRaw   = allEmployees.filter(e => e.status === 'active');
    const inactive = allEmployees.filter(e => e.status === 'inactive');
    const ended    = allEmployees.filter(e => e.status === 'ended');

    const sponsoredRaw    = allEmployees.filter(e => e.sponsorship_status === 'sponsored');
    const notSponsoredRaw = allEmployees.filter(e => e.sponsorship_status === 'not_sponsored');
    const absconded    = allEmployees.filter(e => e.sponsorship_status === 'absconded');
    const terminated   = allEmployees.filter(e => e.sponsorship_status === 'terminated');

    // 2. Active & non-excluded employees list (use this for all other stats, alerts and distributions)
    const active = allEmployees.filter(e => !isExcluded(e));

    const sponsored    = active.filter(e => e.sponsorship_status === 'sponsored');
    const notSponsored = active.filter(e => e.sponsorship_status === 'not_sponsored');

    const hasLicense = active.filter(e => e.license_status === 'has_license');
    const noLicense  = active.filter(e => e.license_status === 'no_license');
    const applied    = active.filter(e => e.license_status === 'applied');

    const residencyExpired   = active.filter(e => { const d = daysDiff(e.residency_expiry); return d !== null && d < 0; });
    const residencyExpiring30 = active.filter(e => { const d = daysDiff(e.residency_expiry); return d !== null && d >= 0 && d <= 30; });
    const residencyExpiring60 = active.filter(e => { const d = daysDiff(e.residency_expiry); return d !== null && d > 30 && d <= 60; });

    const insuranceExpired    = active.filter(e => { const d = daysDiff(e.health_insurance_expiry); return d !== null && d < 0; });
    const insuranceExpiring30 = active.filter(e => { const d = daysDiff(e.health_insurance_expiry); return d !== null && d >= 0 && d <= 30; });

    const licenseExpired    = active.filter(e => { const d = daysDiff(e.license_expiry); return d !== null && d < 0; });
    const licenseExpiring30 = active.filter(e => { const d = daysDiff(e.license_expiry); return d !== null && d >= 0 && d <= 30; });

    const probationExpiring7  = active.filter(e => { const d = daysDiff(e.probation_end_date); return d !== null && d >= 0 && d <= 7; });
    const probationExpiring30 = active.filter(e => { const d = daysDiff(e.probation_end_date); return d !== null && d >= 0 && d <= 30; });

    const monthStart = startOfMonth(today);
    const monthEnd   = endOfMonth(today);
    const newThisMonth = active.filter(e => {
      if (!e.join_date) return false;
      try { return isWithinInterval(parseISO(e.join_date), { start: monthStart, end: monthEnd }); } catch { return false; }
    });

    const ages = active.map(e => {
      if (!e.birth_date) return null;
      try { return differenceInYears(today, parseISO(e.birth_date)); } catch { return null; }
    }).filter((a): a is number => a !== null && a > 10 && a < 80);
    const avgAge = ages.length ? Math.round(ages.reduce((s, a) => s + a, 0) / ages.length) : null;

    const cityCount: Record<string, number> = {};
    active.forEach(e => {
      getEmployeeCities(e).forEach(c => { cityCount[c] = (cityCount[c] ?? 0) + 1; });
    });

    const natCount: Record<string, number> = {};
    active.forEach(e => {
      if (e.nationality) natCount[e.nationality] = (natCount[e.nationality] ?? 0) + 1;
    });

    const jobCount: Record<string, number> = {};
    active.forEach(e => {
      if (e.job_title) jobCount[e.job_title] = (jobCount[e.job_title] ?? 0) + 1;
    });

    return {
      lists: {
        all: allEmployees,
        activeRaw: activeRaw,
        active: active,
        inactive,
        ended,
        sponsoredRaw,
        notSponsoredRaw,
        sponsored,
        notSponsored,
        absconded,
        terminated,
        hasLicense,
        noLicense,
        applied,
        residencyExpired,
        residencyExpiring30,
        residencyExpiring60,
        insuranceExpired,
        insuranceExpiring30,
        licenseExpired,
        licenseExpiring30,
        probationExpiring7,
        probationExpiring30,
        newThisMonth,
      },
      total: allEmployees.length, 
      active: activeRaw.length, 
      inactive: inactive.length, 
      ended: ended.length,
      sponsoredRawCount: sponsoredRaw.length,
      notSponsoredRawCount: notSponsoredRaw.length,
      sponsored: sponsored.length, 
      notSponsored: notSponsored.length,
      absconded: absconded.length, 
      terminated: terminated.length,
      hasLicense: hasLicense.length, 
      noLicense: noLicense.length, 
      applied: applied.length,
      residencyExpired: residencyExpired.length, 
      residencyExpiring30: residencyExpiring30.length, 
      residencyExpiring60: residencyExpiring60.length,
      insuranceExpired: insuranceExpired.length, 
      insuranceExpiring30: insuranceExpiring30.length,
      licenseExpired: licenseExpired.length, 
      licenseExpiring30: licenseExpiring30.length,
      probationExpiring7: probationExpiring7.length, 
      probationExpiring30: probationExpiring30.length,
      newThisMonth: newThisMonth.length,
      avgAge,
      cityCount, 
      natCount, 
      jobCount,
      activeCount: active.length,
    };
  }, [allEmployees]);

  const cityMax = useMemo(() => Math.max(1, ...Object.values(stats.cityCount)), [stats.cityCount]);
  const natMax  = useMemo(() => Math.max(1, ...Object.values(stats.natCount)),  [stats.natCount]);

  const cityLabels: Record<string, string> = { makkah: t('makkah'), jeddah: t('jeddah') };

  if (allEmployees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Users size={40} className="opacity-30" />
        <p className="text-sm">{t('noEmployeeData')}</p>
      </div>
    );
  }

  const handleCityClick = (city: string) => {
    const list = stats.lists.active.filter(e => getEmployeeCities(e).includes(city));
    showDetails(t('cityEmployeeDistribution', { value: cityLabels[city] ?? city }), list);
  };

  const handleNationalityClick = (nationality: string) => {
    const list = stats.lists.active.filter(e => e.nationality === nationality);
    showDetails(t('nationalityEmployeeDistribution', { value: nationality }), list);
  };

  const handleJobClick = (job: string) => {
    const list = stats.lists.active.filter(e => e.job_title === job);
    showDetails(t('jobEmployeeDistribution', { value: job }), list);
  };

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* ── القسم الأول: الملخص العام ── */}
      <Section title={t('generalSummary')} icon={<TrendingUp size={16} />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={<Users size={20} />} label={t('totalEmployees')} value={stats.total} color="blue" onClick={() => showDetails(t('totalEmployees'), stats.lists.all)} />
          <KpiCard icon={<UserCheck size={20} />} label={t('active')} value={stats.active} color="green" onClick={() => showDetails(t('activeEmployees'), stats.lists.activeRaw)} />
          <KpiCard icon={<UserMinus size={20} />} label={t('inactive')} value={stats.inactive} color="yellow" onClick={() => showDetails(t('inactiveEmployees'), stats.lists.inactive)} />
          <KpiCard icon={<UserX size={20} />} label={t('ended')} value={stats.ended} color="gray" onClick={() => showDetails(t('endedEmployees'), stats.lists.ended)} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <KpiCard icon={<CalendarClock size={20} />} label={t('newEmployeesThisMonth')} value={stats.newThisMonth} color="purple" onClick={() => showDetails(t('newEmployeesThisMonth'), stats.lists.newThisMonth)} />
          {stats.avgAge !== null && (
            <KpiCard icon={<Users size={20} />} label={t('averageAge')} value={t('yearsCount', { count: stats.avgAge })} color="blue" />
          )}
        </div>
      </Section>

      {/* ── القسم الثاني: حالة الكفالة ── */}
      <Section title={t('sponsorshipStatus')} icon={<ShieldCheck size={16} />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label={t('sponsored')} value={stats.sponsoredRawCount} color="green" icon={<ShieldCheck size={20} />} onClick={() => showDetails(t('sponsored'), stats.lists.sponsoredRaw)} />
          <KpiCard label={t('notSponsored')} value={stats.notSponsoredRawCount} color="gray" icon={<ShieldOff size={20} />} onClick={() => showDetails(t('notSponsored'), stats.lists.notSponsoredRaw)} />
          <KpiCard label={t('absconded')} value={stats.absconded} color="red" icon={<UserX size={20} />} onClick={() => showDetails(t('absconded'), stats.lists.absconded)} />
          <KpiCard label={t('terminated')} value={stats.terminated} color="orange" icon={<UserMinus size={20} />} onClick={() => showDetails(t('terminated'), stats.lists.terminated)} />
        </div>
        <div className="mt-2">
          <SponsorshipBar
            sponsored={stats.sponsoredRawCount} notSponsored={stats.notSponsoredRawCount}
            absconded={stats.absconded} terminated={stats.terminated}
            total={stats.total}
          />
        </div>
      </Section>

      {/* ── القسم الثالث: حالة الرخصة ── */}
      <Section title={t('licenseStatusSection')} icon={<Car size={16} />}>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label={t('hasLicense')} value={stats.hasLicense} color="green" icon={<Car size={20} />} onClick={() => showDetails(t('hasLicense'), stats.lists.hasLicense)} />
          <KpiCard label={t('noLicense')} value={stats.noLicense} color="red" icon={<Car size={20} />} onClick={() => showDetails(t('noLicense'), stats.lists.noLicense)} />
          <KpiCard label={t('applied')} value={stats.applied} color="yellow" icon={<Car size={20} />} onClick={() => showDetails(t('applied'), stats.lists.applied)} />
        </div>
      </Section>

      {/* ── القسم الرابع: تنبيهات الوثائق ── */}
      <Section title={t('documentAlerts')} icon={<AlertTriangle size={16} />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AlertCard label={t('expiredResidency')} value={stats.residencyExpired} severity="danger" onClick={() => showDetails(t('employeesWithExpiredResidency'), stats.lists.residencyExpired)} />
          <AlertCard label={t('residencyExpiresIn30')} value={stats.residencyExpiring30} severity="warning" onClick={() => showDetails(t('employeesResidencyExpiring30'), stats.lists.residencyExpiring30)} />
          <AlertCard label={t('residencyExpiresIn60')} value={stats.residencyExpiring60} severity="info" onClick={() => showDetails(t('employeesResidencyExpiring60'), stats.lists.residencyExpiring60)} />
          <AlertCard label={t('expiredHealthInsurance')} value={stats.insuranceExpired} severity="danger" onClick={() => showDetails(t('employeesWithExpiredInsurance'), stats.lists.insuranceExpired)} />
          <AlertCard label={t('insuranceExpiresIn30')} value={stats.insuranceExpiring30} severity="warning" onClick={() => showDetails(t('employeesInsuranceExpiring30'), stats.lists.insuranceExpiring30)} />
          <AlertCard label={t('expiredDrivingLicense')} value={stats.licenseExpired} severity="danger" onClick={() => showDetails(t('employeesWithExpiredLicense'), stats.lists.licenseExpired)} />
          <AlertCard label={t('licenseExpiresIn30')} value={stats.licenseExpiring30} severity="warning" onClick={() => showDetails(t('employeesLicenseExpiring30'), stats.lists.licenseExpiring30)} />
          <AlertCard label={t('probationExpiresIn7')} value={stats.probationExpiring7} severity="danger" onClick={() => showDetails(t('employeesProbationExpiring7'), stats.lists.probationExpiring7)} />
          <AlertCard label={t('probationExpiresIn30')} value={stats.probationExpiring30} severity="warning" onClick={() => showDetails(t('employeesProbationExpiring30'), stats.lists.probationExpiring30)} />
        </div>
      </Section>

      {/* ── التوزيعات (مدن، جنسيات، مسميات) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── القسم الخامس: توزيع المدن ── */}
        {Object.keys(stats.cityCount).length > 0 && (
          <Section title={t('employeesByCity')} icon={<MapPin size={16} />}>
            <div className="space-y-2">
              {Object.entries(stats.cityCount)
                .sort(([, a], [, b]) => b - a)
                .map(([city, count]) => (
                  <BarRow
                    key={city}
                    label={cityLabels[city] ?? city}
                    value={count}
                    max={cityMax}
                    total={stats.activeCount}
                    color="bg-primary"
                    onClick={() => handleCityClick(city)}
                  />
                ))}
            </div>
          </Section>
        )}

        {/* ── القسم السادس: توزيع الجنسيات ── */}
        {Object.keys(stats.natCount).length > 0 && (
          <Section title={t('employeesByNationality')} icon={<Globe2 size={16} />}>
            <div className="space-y-2">
              {Object.entries(stats.natCount)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 10)
                .map(([nat, count]) => (
                  <BarRow
                    key={nat}
                    label={nat}
                    value={count}
                    max={natMax}
                    total={stats.activeCount}
                    color="bg-sky-500"
                    onClick={() => handleNationalityClick(nat)}
                  />
                ))}
            </div>
          </Section>
        )}

        {/* ── القسم السابع: توزيع المسميات الوظيفية ── */}
        {Object.keys(stats.jobCount).length > 0 && (
          <Section title={t('topJobTitles')} icon={<Users size={16} />}>
            <div className="space-y-2">
              {Object.entries(stats.jobCount)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([job, count]) => (
                  <BarRow
                    key={job}
                    label={job}
                    value={count}
                    max={Math.max(1, ...Object.values(stats.jobCount))}
                    total={stats.activeCount}
                    color="bg-violet-500"
                    onClick={() => handleJobClick(job)}
                  />
                ))}
            </div>
          </Section>
        )}
      </div>

      {/* Modal to show list of employees */}
      <Dialog open={detailModal.isOpen} onOpenChange={(open) => setDetailModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="max-w-lg w-[90vw] max-h-[85vh] flex flex-col p-6 rounded-2xl border bg-card text-foreground" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader className="pb-3 border-b text-start">
            <DialogTitle className="text-lg font-bold text-foreground">
              {detailModal.title}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 mt-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              {detailModal.employees.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">{t('noEmployees')}</p>
              ) : (
                detailModal.employees.map((emp) => (
                  <button 
                    key={emp.id} 
                    type="button"
                    onClick={() => {
                      setDetailModal(prev => ({ ...prev, isOpen: false }));
                      onSelectEmployee?.(emp.id);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors border border-transparent hover:border-border/40 text-start"
                  >
                    <div className="flex flex-col text-start">
                      <span className="font-semibold text-sm text-foreground hover:text-primary transition-colors">
                        {emp.name}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5">
                        {emp.job_title || t('withoutJobTitle')} {emp.nationality ? `• ${emp.nationality}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        {t('viewProfile')}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, icon, children }: Readonly<{ title: string; icon: React.ReactNode; children: React.ReactNode }>) {
  return (
    <div className="border bg-card shadow-sm overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <span className="text-muted-foreground">{icon}</span>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/30',   icon: 'text-blue-500',   val: 'text-blue-700 dark:text-blue-300'   },
  green:  { bg: 'bg-green-50 dark:bg-green-950/30',  icon: 'text-green-500',  val: 'text-green-700 dark:text-green-300'  },
  red:    { bg: 'bg-red-50 dark:bg-red-950/30',      icon: 'text-red-500',    val: 'text-red-700 dark:text-red-300'      },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950/30',icon: 'text-yellow-500', val: 'text-yellow-700 dark:text-yellow-300' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30',icon: 'text-orange-500', val: 'text-orange-700 dark:text-orange-300' },
  gray:   { bg: 'bg-muted/40',                       icon: 'text-muted-foreground', val: 'text-foreground'               },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30',icon: 'text-purple-500', val: 'text-purple-700 dark:text-purple-300' },
};

function KpiCard({
  icon, label, value, color = 'blue', onClick,
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: keyof typeof COLOR_MAP;
  onClick?: () => void;
}>) {
  const c = COLOR_MAP[color];
  if (onClick) {
    return (
      <button 
        type="button"
        onClick={onClick}
        className={`w-full text-start rounded-lg p-3 flex flex-col gap-1.5 ${c.bg} cursor-pointer hover:opacity-85 transition-opacity`}
      >
        <div className={`${c.icon}`}>{icon}</div>
        <div className={`text-2xl font-bold tabular-nums ${c.val}`}>{value}</div>
        <div className="text-xs text-muted-foreground leading-tight">{label}</div>
      </button>
    );
  }

  return (
    <div className={`rounded-lg p-3 flex flex-col gap-1.5 ${c.bg}`}>
      <div className={`${c.icon}`}>{icon}</div>
      <div className={`text-2xl font-bold tabular-nums ${c.val}`}>{value}</div>
      <div className="text-xs text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

const SEVERITY = {
  danger:  { bg: 'bg-red-50 dark:bg-red-950/30',      border: 'border-red-200 dark:border-red-800',    val: 'text-red-600 dark:text-red-400',    label: 'text-red-700 dark:text-red-300'    },
  warning: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', val: 'text-yellow-600 dark:text-yellow-400', label: 'text-yellow-700 dark:text-yellow-300' },
  info:    { bg: 'bg-blue-50 dark:bg-blue-950/30',     border: 'border-blue-200 dark:border-blue-800',  val: 'text-blue-600 dark:text-blue-400',  label: 'text-blue-700 dark:text-blue-300'  },
};

function AlertCard({ label, value, severity, onClick }: Readonly<{ label: string; value: number; severity: keyof typeof SEVERITY; onClick?: () => void }>) {
  const s = SEVERITY[severity];
  const isEmpty = value === 0;
  
  if (!isEmpty && onClick) {
    return (
      <button 
        type="button"
        onClick={onClick}
        className={`w-full text-start rounded-lg border p-3 flex flex-col gap-1 ${s.bg} ${s.border} cursor-pointer hover:opacity-85 transition-opacity`}
      >
        <div className={`text-2xl font-bold tabular-nums ${s.val}`}>{value}</div>
        <div className={`text-xs leading-tight ${s.label}`}>{label}</div>
      </button>
    );
  }

  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1 ${isEmpty ? 'bg-muted/20 border-border opacity-60' : s.bg + ' ' + s.border}`}>
      <div className={`text-2xl font-bold tabular-nums ${isEmpty ? 'text-muted-foreground' : s.val}`}>{value}</div>
      <div className={`text-xs leading-tight ${isEmpty ? 'text-muted-foreground' : s.label}`}>{label}</div>
    </div>
  );
}

function BarRow({ label, value, max, total, color, onClick }: Readonly<{ label: string; value: number; max: number; total: number; color: string; onClick?: () => void }>) {
  const pct = Math.round((value / Math.max(1, max)) * 100);
  const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

  if (onClick) {
    return (
      <button 
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 p-1 rounded-lg cursor-pointer hover:bg-muted/40 transition-colors"
      >
        <div className="w-28 text-xs text-muted-foreground truncate text-start shrink-0">{label}</div>
        <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-xs font-semibold tabular-nums w-8 text-start">{value}</div>
        <div className="text-xs text-muted-foreground w-10 text-start">{share}%</div>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 p-1 rounded-lg">
      <div className="w-28 text-xs text-muted-foreground truncate text-start shrink-0">{label}</div>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs font-semibold tabular-nums w-8 text-start">{value}</div>
      <div className="text-xs text-muted-foreground w-10 text-start">{share}%</div>
    </div>
  );
}

function SponsorshipBar({ sponsored, notSponsored, absconded, terminated, total }: Readonly<{
  sponsored: number; notSponsored: number; absconded: number; terminated: number; total: number;
}>) {
  const { t } = useTranslation();
  if (total === 0) return null;
  const pctOf = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  const widthOf = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-1">
      <div className="h-4 rounded-full overflow-hidden flex gap-0.5">
        {sponsored > 0 && <div className="bg-green-500 h-full" style={{ width: widthOf(sponsored) }} title={`${t('sponsored')}: ${sponsored}`} />}
        {notSponsored > 0 && <div className="bg-slate-400 h-full" style={{ width: widthOf(notSponsored) }} title={`${t('notSponsored')}: ${notSponsored}`} />}
        {absconded > 0 && <div className="bg-red-500 h-full" style={{ width: widthOf(absconded) }} title={`${t('absconded')}: ${absconded}`} />}
        {terminated > 0 && <div className="bg-orange-400 h-full" style={{ width: widthOf(terminated) }} title={`${t('terminated')}: ${terminated}`} />}
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap">
        {sponsored > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />{t('sponsored')} {pctOf(sponsored)}</span>}
        {notSponsored > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-slate-400" />{t('notSponsored')} {pctOf(notSponsored)}</span>}
        {absconded > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />{t('absconded')} {pctOf(absconded)}</span>}
        {terminated > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />{t('terminated')} {pctOf(terminated)}</span>}
      </div>
    </div>
  );
}
