import type React from 'react';
import { useMemo } from 'react';
import { differenceInDays, differenceInYears, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { Users, UserCheck, UserX, UserMinus, ShieldCheck, ShieldOff, Car, AlertTriangle, CalendarClock, MapPin, Globe2, TrendingUp } from 'lucide-react';
import type { Employee } from '@modules/employees/model/employeeUtils';
import { getEmployeeCities } from '@modules/employees/model/employeeUtils';
import { SPONSORSHIP_LABELS, LICENSE_LABELS } from '@modules/employees/types/employee.types';

interface Props {
  allEmployees: Employee[];
}

const today = new Date();

const daysDiff = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  try { return differenceInDays(parseISO(dateStr), today); } catch { return null; }
};



export function EmployeeKPIs({ allEmployees }: Readonly<Props>) {
  const stats = useMemo(() => {
    const active   = allEmployees.filter(e => e.status === 'active');
    const inactive = allEmployees.filter(e => e.status === 'inactive');
    const ended    = allEmployees.filter(e => e.status === 'ended');

    const sponsored    = allEmployees.filter(e => e.sponsorship_status === 'sponsored');
    const notSponsored = allEmployees.filter(e => e.sponsorship_status === 'not_sponsored');
    const absconded    = allEmployees.filter(e => e.sponsorship_status === 'absconded');
    const terminated   = allEmployees.filter(e => e.sponsorship_status === 'terminated');

    const hasLicense = allEmployees.filter(e => e.license_status === 'has_license');
    const noLicense  = allEmployees.filter(e => e.license_status === 'no_license');
    const applied    = allEmployees.filter(e => e.license_status === 'applied');

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
    const newThisMonth = allEmployees.filter(e => {
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
      total: allEmployees.length, active: active.length, inactive: inactive.length, ended: ended.length,
      sponsored: sponsored.length, notSponsored: notSponsored.length, absconded: absconded.length, terminated: terminated.length,
      hasLicense: hasLicense.length, noLicense: noLicense.length, applied: applied.length,
      residencyExpired: residencyExpired.length, residencyExpiring30: residencyExpiring30.length, residencyExpiring60: residencyExpiring60.length,
      insuranceExpired: insuranceExpired.length, insuranceExpiring30: insuranceExpiring30.length,
      licenseExpired: licenseExpired.length, licenseExpiring30: licenseExpiring30.length,
      probationExpiring7: probationExpiring7.length, probationExpiring30: probationExpiring30.length,
      newThisMonth: newThisMonth.length,
      avgAge,
      cityCount, natCount, jobCount,
      activeCount: active.length,
    };
  }, [allEmployees]);

  const cityMax = useMemo(() => Math.max(1, ...Object.values(stats.cityCount)), [stats.cityCount]);
  const natMax  = useMemo(() => Math.max(1, ...Object.values(stats.natCount)),  [stats.natCount]);

  const CITY_LABELS: Record<string, string> = { makkah: 'مكة المكرمة', jeddah: 'جدة' };

  if (allEmployees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Users size={40} className="opacity-30" />
        <p className="text-sm">لا توجد بيانات موظفين</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── القسم الأول: الملخص العام ── */}
      <Section title="الملخص العام" icon={<TrendingUp size={16} />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard icon={<Users size={20} />} label="إجمالي الموظفين" value={stats.total} color="blue" />
          <KpiCard icon={<UserCheck size={20} />} label="نشط" value={stats.active} color="green" />
          <KpiCard icon={<UserMinus size={20} />} label="غير نشط" value={stats.inactive} color="yellow" />
          <KpiCard icon={<UserX size={20} />} label="منتهي" value={stats.ended} color="gray" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <KpiCard icon={<CalendarClock size={20} />} label="موظفون جدد هذا الشهر" value={stats.newThisMonth} color="purple" />
          {stats.avgAge !== null && (
            <KpiCard icon={<Users size={20} />} label="متوسط العمر" value={`${stats.avgAge} سنة`} color="blue" />
          )}
        </div>
      </Section>

      {/* ── القسم الثاني: حالة الكفالة ── */}
      <Section title="حالة الكفالة" icon={<ShieldCheck size={16} />}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label={SPONSORSHIP_LABELS['sponsored']}    value={stats.sponsored}    color="green"  icon={<ShieldCheck size={20} />} />
          <KpiCard label={SPONSORSHIP_LABELS['not_sponsored']} value={stats.notSponsored} color="gray"   icon={<ShieldOff size={20} />} />
          <KpiCard label={SPONSORSHIP_LABELS['absconded']}    value={stats.absconded}    color="red"    icon={<UserX size={20} />} />
          <KpiCard label={SPONSORSHIP_LABELS['terminated']}   value={stats.terminated}   color="orange" icon={<UserMinus size={20} />} />
        </div>
        <div className="mt-2">
          <SponsorshipBar
            sponsored={stats.sponsored} notSponsored={stats.notSponsored}
            absconded={stats.absconded} terminated={stats.terminated}
            total={stats.total}
          />
        </div>
      </Section>

      {/* ── القسم الثالث: حالة الرخصة ── */}
      <Section title="حالة الرخصة" icon={<Car size={16} />}>
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label={LICENSE_LABELS['has_license']} value={stats.hasLicense} color="green"  icon={<Car size={20} />} />
          <KpiCard label={LICENSE_LABELS['no_license']}  value={stats.noLicense}  color="red"    icon={<Car size={20} />} />
          <KpiCard label={LICENSE_LABELS['applied']}     value={stats.applied}    color="yellow" icon={<Car size={20} />} />
        </div>
      </Section>

      {/* ── القسم الرابع: تنبيهات الوثائق ── */}
      <Section title="تنبيهات الوثائق" icon={<AlertTriangle size={16} />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <AlertCard label="إقامة منتهية"          value={stats.residencyExpired}   severity="danger" />
          <AlertCard label="إقامة تنتهي خلال 30 يوم" value={stats.residencyExpiring30} severity="warning" />
          <AlertCard label="إقامة تنتهي خلال 60 يوم" value={stats.residencyExpiring60} severity="info" />
          <AlertCard label="تأمين صحي منتهٍ"       value={stats.insuranceExpired}   severity="danger" />
          <AlertCard label="تأمين ينتهي خلال 30 يوم" value={stats.insuranceExpiring30} severity="warning" />
          <AlertCard label="رخصة قيادة منتهية"     value={stats.licenseExpired}    severity="danger" />
          <AlertCard label="رخصة تنتهي خلال 30 يوم"  value={stats.licenseExpiring30}  severity="warning" />
          <AlertCard label="تجربة تنتهي خلال 7 أيام" value={stats.probationExpiring7}  severity="danger" />
          <AlertCard label="تجربة تنتهي خلال 30 يوم" value={stats.probationExpiring30} severity="warning" />
        </div>
      </Section>

      {/* ── القسم الخامس: توزيع المدن ── */}
      {Object.keys(stats.cityCount).length > 0 && (
        <Section title="توزيع الموظفين حسب المدينة" icon={<MapPin size={16} />}>
          <div className="space-y-2">
            {Object.entries(stats.cityCount)
              .sort(([, a], [, b]) => b - a)
              .map(([city, count]) => (
                <BarRow
                  key={city}
                  label={CITY_LABELS[city] ?? city}
                  value={count}
                  max={cityMax}
                  total={stats.activeCount}
                  color="bg-primary"
                />
              ))}
          </div>
        </Section>
      )}

      {/* ── القسم السادس: توزيع الجنسيات ── */}
      {Object.keys(stats.natCount).length > 0 && (
        <Section title="توزيع الموظفين حسب الجنسية" icon={<Globe2 size={16} />}>
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
                />
              ))}
          </div>
        </Section>
      )}

      {/* ── القسم السابع: توزيع المسميات الوظيفية ── */}
      {Object.keys(stats.jobCount).length > 0 && (
        <Section title="أكثر المسميات الوظيفية" icon={<Users size={16} />}>
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
                />
              ))}
          </div>
        </Section>
      )}
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
  icon, label, value, color = 'blue',
}: Readonly<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: keyof typeof COLOR_MAP;
}>) {
  const c = COLOR_MAP[color];
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

function AlertCard({ label, value, severity }: Readonly<{ label: string; value: number; severity: keyof typeof SEVERITY }>) {
  const s = SEVERITY[severity];
  const isEmpty = value === 0;
  return (
    <div className={`rounded-lg border p-3 flex flex-col gap-1 ${isEmpty ? 'bg-muted/20 border-border opacity-60' : s.bg + ' ' + s.border}`}>
      <div className={`text-2xl font-bold tabular-nums ${isEmpty ? 'text-muted-foreground' : s.val}`}>{value}</div>
      <div className={`text-xs leading-tight ${isEmpty ? 'text-muted-foreground' : s.label}`}>{label}</div>
    </div>
  );
}

function BarRow({ label, value, max, total, color }: Readonly<{ label: string; value: number; max: number; total: number; color: string }>) {
  const pct = Math.round((value / Math.max(1, max)) * 100);
  const share = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-muted-foreground truncate text-right shrink-0">{label}</div>
      <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs font-semibold tabular-nums w-8 text-right">{value}</div>
      <div className="text-xs text-muted-foreground w-10 text-right">{share}%</div>
    </div>
  );
}

function SponsorshipBar({ sponsored, notSponsored, absconded, terminated, total }: Readonly<{
  sponsored: number; notSponsored: number; absconded: number; terminated: number; total: number;
}>) {
  if (total === 0) return null;
  const pctOf = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  const widthOf = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="space-y-1">
      <div className="h-4 rounded-full overflow-hidden flex gap-0.5">
        {sponsored    > 0 && <div className="bg-green-500  h-full"  style={{ width: widthOf(sponsored) }}    title={`على الكفالة: ${sponsored}`} />}
        {notSponsored > 0 && <div className="bg-slate-400  h-full"  style={{ width: widthOf(notSponsored) }} title={`ليس على الكفالة: ${notSponsored}`} />}
        {absconded    > 0 && <div className="bg-red-500    h-full"  style={{ width: widthOf(absconded) }}    title={`هروب: ${absconded}`} />}
        {terminated   > 0 && <div className="bg-orange-400 h-full"  style={{ width: widthOf(terminated) }}   title={`انتهاء خدمة: ${terminated}`} />}
      </div>
      <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap">
        {sponsored    > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" />على الكفالة {pctOf(sponsored)}</span>}
        {notSponsored > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-slate-400" />ليس على الكفالة {pctOf(notSponsored)}</span>}
        {absconded    > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" />هروب {pctOf(absconded)}</span>}
        {terminated   > 0 && <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-orange-400" />انتهاء خدمة {pctOf(terminated)}</span>}
      </div>
    </div>
  );
}
