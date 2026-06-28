interface PlatformAccountsStatsProps {
  accountsCount: number;
  activeCount: number;
  warnCount: number;
  alertDays: number;
  appsCount: number;
}

export const PlatformAccountsStats = ({
  accountsCount,
  activeCount,
  warnCount,
  alertDays,
  appsCount,
}: Readonly<PlatformAccountsStatsProps>) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="stat-card rounded-2xl">
        <p className="text-sm text-muted-foreground">إجمالي الحسابات</p>
        <p className="text-3xl font-bold mt-1">{accountsCount}</p>
      </div>
      <div className="stat-card rounded-2xl">
        <p className="text-sm text-muted-foreground">نشطة</p>
        <p className="text-3xl font-bold text-success mt-1">{activeCount}</p>
      </div>
      <div className="stat-card border-r-4 border-r-warning rounded-2xl">
        <p className="text-sm text-muted-foreground">إقامات قريبة الانتهاء</p>
        <p className="text-3xl font-bold text-warning mt-1">{warnCount}</p>
        <p className="text-xs text-muted-foreground mt-1">خلال {alertDays} يوم</p>
      </div>
      <div className="stat-card rounded-2xl">
        <p className="text-sm text-muted-foreground">عدد المنصات</p>
        <p className="text-3xl font-bold mt-1">{appsCount}</p>
      </div>
    </div>
  );
};
