import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type AttendanceWeekRow = { day: string; present: number; absent: number; leave: number; sick: number; late: number };

export function AttendanceChart(props: Readonly<{
  loading: boolean;
  kpis: { presentToday: number; lateToday: number; absentToday: number; leaveToday: number; sickToday: number };
  attendanceWeek: AttendanceWeekRow[];
}>) {
  const { loading, kpis, attendanceWeek } = props;
  return (
    <div className="space-y-4">
      <div className="bg-card -2xl shadow-card p-5 rounded-2xl">
        <h3 className="text-sm font-bold mb-1">الحضور اليوم</h3>
        <p className="text-[11px] text-muted-foreground/80 mb-3">{format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}</p>
        {loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">{['a1', 'a2', 'a3', 'a4', 'a5'].map((k) => <div key={k} className="h-16 bg-muted/40 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            <div className="rounded-xl bg-emerald-50 p-4 text-center"><p className="text-2xl font-black text-emerald-700">{kpis.presentToday}</p><p className="text-[10px] font-semibold text-emerald-600 mt-1">حاضر</p></div>
            <div className="rounded-xl bg-orange-50 p-4 text-center"><p className="text-2xl font-black text-orange-600">{kpis.lateToday}</p><p className="text-[10px] font-semibold text-orange-500 mt-1">متأخر</p></div>
            <div className="rounded-xl bg-rose-50 p-4 text-center"><p className="text-2xl font-black text-rose-600">{kpis.absentToday}</p><p className="text-[10px] font-semibold text-rose-500 mt-1">غائب</p></div>
            <div className="rounded-xl bg-amber-50 p-4 text-center"><p className="text-2xl font-black text-amber-600">{kpis.leaveToday}</p><p className="text-[10px] font-semibold text-amber-500 mt-1">إجازة</p></div>
            <div className="rounded-xl bg-sky-50 p-4 text-center"><p className="text-2xl font-black text-sky-600">{kpis.sickToday}</p><p className="text-[10px] font-semibold text-sky-500 mt-1">مريض</p></div>
          </div>
        )}
      </div>

      <div className="bg-card -2xl shadow-card p-5 rounded-2xl">
        <h3 className="text-sm font-bold mb-1">الحضور — آخر 7 أيام</h3>
        <p className="text-[11px] text-muted-foreground/80 mb-3">حاضر / متأخر / غائب / إجازة / مريض</p>
        {attendanceWeek.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-muted-foreground/80 text-sm">لا توجد بيانات حضور</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={attendanceWeek} barGap={2} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={25} />
              <Tooltip />
              <Bar dataKey="present" name="حاضر" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" name="متأخر" fill="#f97316" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" name="غائب" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leave" name="إجازة" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sick" name="مريض" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
