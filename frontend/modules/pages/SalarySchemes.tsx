import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Check, X, Loader2, Link2, Settings } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Label } from '@shared/components/ui/label';
import { useToast } from '@shared/hooks/use-toast';
import { usePermissions } from '@shared/hooks/usePermissions';
import { format } from 'date-fns';
import { appService } from '@services/appService';
import { salarySchemeService } from '@services/salarySchemeService';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { defaultQueryRetry } from '@shared/lib/query';
import { getErrorMessage } from '@services/serviceError';

import {
  Tier,
  Scheme,
  Snapshot,
  AppItem,
  SalarySchemeTierRow,
  TierType
} from '../salaries/types/scheme.ui.types';
import {
  SchemeSnapshotPinPanel,
  buildMonthsOfYear,
  clampSnapshotYear,
  tierTypeLabels,
  monthLabel,
} from '../salaries/components/schemes/SchemeSnapshotPinPanel';
import { SchemeFormModal } from '../salaries/components/schemes/SchemeFormModal';
import { Skeleton } from '@shared/components/ui/skeleton';

const currentMonth = format(new Date(), 'yyyy-MM');

function getAppAssignmentLabel(schemeId: string | null | undefined, assignSchemeId: string) {
  if (schemeId === assignSchemeId) return '(مرتبطة حالياً)';
  if (schemeId) return '(مرتبطة بسكيمة أخرى)';
  return '';
}

const SalarySchemes = () => {
  const { toast } = useToast();
  const { enabled, userId } = useAuthQueryGate();
  const { permissions: perms } = usePermissions('salary_schemes');
  const uid = authQueryUserId(userId);
  const queryClient = useQueryClient();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [tiers, setTiers] = useState<Record<string, Tier[]>>({});
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [apps, setApps] = useState<AppItem[]>([]);
  const {
    data: schemeData,
    isLoading: loading,
    error: schemeDataError,
    refetch: refetchSchemeData,
  } = useQuery({
    queryKey: ['salary-schemes', uid, 'page-data'],
    enabled,
    queryFn: async () => {
      const [sData, tData, snData, aData] = await Promise.all([
        salarySchemeService.getSchemes(),
        salarySchemeService.getTiers(),
        salarySchemeService.getSnapshots(),
        appService.getActiveWithScheme(),
      ]);

      const tiersMap: Record<string, Tier[]> = {};
      for (const t of (tData || []) as SalarySchemeTierRow[]) {
        if (!tiersMap[t.scheme_id]) tiersMap[t.scheme_id] = [];
        tiersMap[t.scheme_id].push({
          from: t.from_orders,
          to: t.to_orders ?? 9999,
          pricePerOrder: t.price_per_order,
          tierType: (t.tier_type as TierType) || 'total_multiplier',
          incrementalThreshold: t.incremental_threshold ?? undefined,
          incrementalPrice: t.incremental_price ?? undefined,
        });
      }

      const snapshotsMap: Record<string, Snapshot[]> = {};
      for (const s of (snData || []) as { scheme_id: string; month_year: string }[]) {
        if (!snapshotsMap[s.scheme_id]) snapshotsMap[s.scheme_id] = [];
        snapshotsMap[s.scheme_id].push({ month_year: s.month_year });
      }

      return {
        schemes: (sData || []) as Scheme[],
        apps: (aData || []),
        tiersMap,
        snapshotsMap,
      };
    },
    retry: defaultQueryRetry,
    staleTime: 60_000,
  });
  const [snapshotLoading, setSnapshotLoading] = useState<string | null>(null);
  /** سنة عرض شبكة الأشهر لكل سكيمة */
  const [snapshotYearByScheme, setSnapshotYearByScheme] = useState<Record<string, number>>({});
  /** أشهر محددة للتثبيت (غير المثبتة بعد) ضمن السنة المعروضة */
  const [pinSelectionByScheme, setPinSelectionByScheme] = useState<Record<string, string[]>>({});

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Scheme | null>(null);
  const [editingTiers, setEditingTiers] = useState<Tier[]>([]);

  // Assign scheme to app modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSchemeId, setAssignSchemeId] = useState('');
  const [assignAppId, setAssignAppId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Local state mirrors React Query data — kept intentionally because handleArchive,
  // handleSnapshot, handleUnpinSnapshot, and handleUnassignApp perform optimistic local
  // updates (e.g., setSchemes, setSnapshots) before the server round-trip completes.
  useEffect(() => {
    if (!schemeData) return;
    setSchemes(schemeData.schemes);
    setApps(schemeData.apps);
    setTiers(schemeData.tiersMap);
    setSnapshots(schemeData.snapshotsMap);
  }, [schemeData]);

  useEffect(() => {
    if (!schemeDataError) return;
    const message = getErrorMessage(schemeDataError, 'تعذر تحميل بيانات السكيّمات');
    toast({ title: 'خطأ في التحميل', description: message, variant: 'destructive' });
  }, [schemeDataError, toast]);

  const invalidateRelatedQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['salary-schemes', uid] }),
      queryClient.invalidateQueries({ queryKey: ['salaries', uid] }),
      queryClient.invalidateQueries({ queryKey: ['apps'] }),
    ]);
  };

  const getAssignedApps = (schemeId: string) => apps.filter(a => a.scheme_id === schemeId);

  const openAdd = () => {
    setEditing(null);
    setEditingTiers([]);
    setShowModal(true);
  };

  const openEdit = (s: Scheme) => {
    setEditing(s);
    const rawTiers = tiers[s.id] || [];
    setEditingTiers(
      rawTiers.length
        ? rawTiers.map((t) => ({
            from: t.from ?? 1,
            to: t.to ?? 500,
            pricePerOrder: t.pricePerOrder ?? 5,
            tierType: (t.tierType ?? 'total_multiplier'),
            incrementalThreshold: t.incrementalThreshold,
            incrementalPrice: t.incrementalPrice,
          }))
        : []
    );
    setShowModal(true);
  };

  const openAssign = (schemeId: string) => {
    setAssignSchemeId(schemeId);
    setAssignAppId('');
    setShowAssignModal(true);
  };

  const handleFormSuccess = async () => {
    setShowModal(false);
    await invalidateRelatedQueries();
    refetchSchemeData().catch(() => {});
  };

  const handleAssign = async () => {
    if (!assignAppId) { toast({ title: 'خطأ', description: 'اختر منصة أولاً', variant: 'destructive' }); return; }
    setAssigning(true);
    try {
      await appService.assignScheme(assignAppId, assignSchemeId);
      toast({ title: '✅ تم الربط', description: `تم ربط السكيمة بالمنصة بنجاح` });
      setShowAssignModal(false);
      await invalidateRelatedQueries();
      refetchSchemeData().catch(() => {});
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setAssigning(false);
  };

  const handleUnassignApp = async (appId: string) => {
    try {
      await appService.assignScheme(appId, null);
      toast({ title: 'تم إلغاء الربط' });
      await invalidateRelatedQueries();
      refetchSchemeData().catch(() => {});
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
  };

  const handleArchive = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'archived' : 'active';
    try {
      await salarySchemeService.updateSchemeStatus(id, newStatus);
      setSchemes(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s));
      toast({ title: 'تم التحديث' });
      await invalidateRelatedQueries();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
  };

  const handleSnapshot = async (schemeId: string, monthsToPin?: string[]) => {
    setSnapshotLoading(schemeId);
    try {
      const schemeTiers = tiers[schemeId] || [];
      const months = monthsToPin && monthsToPin.length > 0 ? monthsToPin : [currentMonth];
      // Convert tiers to a JSON-safe structure to avoid unsafe `as unknown as Json` double cast
      const tiersJson = structuredClone(schemeTiers);
      for (const m of months) {
        await salarySchemeService.upsertSnapshot(
          schemeId,
          m,
          tiersJson
        );
      }
      toast({ title: '📌 تم التثبيت', description: `تم تثبيت السكيمة لعدد ${months.length} شهر` });
      setSnapshots(prev => ({
        ...prev,
        [schemeId]: [
          ...(prev[schemeId] || []).filter(s => !months.includes(s.month_year)),
          ...months.map((m) => ({ month_year: m })),
        ],
      }));
      setPinSelectionByScheme(prev => ({
        ...prev,
        [schemeId]: (prev[schemeId] || []).filter(m => !months.includes(m)),
      }));
      await invalidateRelatedQueries();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSnapshotLoading(null);
  };

  const handleUnpinSnapshot = async (schemeId: string, monthYear: string) => {
    setSnapshotLoading(schemeId);
    try {
      await salarySchemeService.deleteSnapshot(schemeId, monthYear);
      setSnapshots(prev => ({
        ...prev,
        [schemeId]: (prev[schemeId] || []).filter(s => s.month_year !== monthYear),
      }));
      toast({ title: 'تم إلغاء التثبيت', description: monthLabel(monthYear) });
      await invalidateRelatedQueries();
    } catch (err: unknown) {
      const message = getErrorMessage(err, 'حدث خطأ غير متوقع');
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
    setSnapshotLoading(null);
  };

  const togglePinMonthSelect = (schemeId: string, monthYear: string) => {
    setPinSelectionByScheme(prev => {
      const cur = prev[schemeId] || [];
      const next = cur.includes(monthYear) ? cur.filter(m => m !== monthYear) : [...cur, monthYear];
      return { ...prev, [schemeId]: next };
    });
  };

  const setSchemeSnapshotYear = (schemeId: string, year: number) => {
    setSnapshotYearByScheme(prev => ({ ...prev, [schemeId]: year }));
    setPinSelectionByScheme(prev => {
      const next = { ...prev };
      delete next[schemeId];
      return next;
    });
  };

  const availableApps = (schemeId: string) => apps.filter(a => !a.scheme_id || a.scheme_id === schemeId);

  const renderTierDescription = (t: Tier) => {
    if (t.tierType === 'fixed_amount') {
      return <span className="ms-auto font-semibold text-primary">{t.pricePerOrder} ر.س ثابت</span>;
    }
    if (t.tierType === 'base_plus_incremental') {
      return (
        <span className="ms-auto font-semibold text-primary">
          {t.pricePerOrder} + (فوق {t.incrementalThreshold ?? t.from}) × {t.incrementalPrice ?? 0} ر.س
        </span>
      );
    }
    if (t.tierType === 'per_order_band') {
      return <span className="ms-auto font-semibold text-primary">كل الطلبات × {t.pricePerOrder} ر.س</span>;
    }
    return <span className="ms-auto font-semibold text-primary">الطلبات × {t.pricePerOrder} ر.س</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">مخططات الرواتب</h2>
          <p className="text-xs text-muted-foreground mt-1">إدارة الشرائح وربطها بالمنصات</p>
        </div>
        {perms.can_edit && (
          <Button className="gap-2" onClick={openAdd}><Plus size={16} /> إضافة سكيمة</Button>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={`scheme-card-skeleton-${i}`}  className="bg-card border border-border/50 p-5 h-48 rounded-2xl" />)}
        </div>
      )}
      {!loading && schemeDataError && (
        <div className="bg-card border border-destructive/30 p-8 text-center rounded-2xl">
          <Settings size={40} className="mx-auto text-destructive mb-3" />
          <p className="text-destructive font-medium">تعذر تحميل البيانات</p>
          <p className="text-muted-foreground text-sm mt-1">
            {getErrorMessage(schemeDataError, 'حدث خطأ أثناء تحميل السكيمات')}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => refetchSchemeData()}>
            إعادة المحاولة
          </Button>
        </div>
      )}
      {!loading && !schemeDataError && schemes.length === 0 && (
        <div className="bg-card border border-dashed border-border p-16 text-center rounded-2xl">
          <Settings size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            {perms.can_edit ? 'لا توجد سكيمات بعد — أضف سكيمة جديدة' : 'لا توجد سكيمات متاحة'}
          </p>
        </div>
      )}
      {!loading && !schemeDataError && schemes.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {schemes.map(s => {
            const assignedApps = getAssignedApps(s.id);
            const isFixed = s.scheme_type === 'fixed_monthly';
            const snapYear = clampSnapshotYear(snapshotYearByScheme[s.id] ?? new Date().getFullYear());
            const pinSel = pinSelectionByScheme[s.id] || [];
            return (
              <div key={s.id} className={`bg-card rounded-xl border shadow-card p-5 ${s.status === 'active' ? 'border-border/50' : 'border-border/30 opacity-70'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{s.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isFixed ? 'bg-accent text-accent-foreground' : 'bg-primary/10 text-primary'}`}>
                      {isFixed ? '📅 راتب شهري ثابت' : '📦 بالطلبات'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={s.status === 'active' ? 'badge-success' : 'badge-warning'}>{s.status === 'active' ? 'نشطة' : 'مؤرشفة'}</span>
                    {perms.can_edit && (
                      <>
                        <button aria-label="تعديل" onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><Pencil size={14} /></button>
                        <button aria-label={s.status === 'active' ? 'أرشفة' : 'تفعيل'} onClick={() => handleArchive(s.id, s.status)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors" title={s.status === 'active' ? 'أرشفة' : 'تفعيل'}>
                          {s.status === 'active' ? <Trash2 size={14} /> : <Check size={14} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Assigned Apps */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-medium text-muted-foreground">المنصات المرتبطة:</p>
                    {perms.can_edit && (
                      <button onClick={() => openAssign(s.id)} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Link2 size={11} /> ربط منصة
                      </button>
                    )}
                  </div>
                  {assignedApps.length === 0 ? (
                    <p className="text-xs text-warning bg-warning/10 rounded-lg px-3 py-1.5">⚠️ لا توجد منصة مرتبطة — الرواتب ستكون صفر</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedApps.map(a => (
                        <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary rounded-full px-2.5 py-1">
                          {a.name}
                          {perms.can_edit && (
                            <button aria-label="إزالة التطبيق" onClick={() => handleUnassignApp(a.id)} className="hover:text-destructive me-0.5"><X size={10} /></button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fixed Monthly */}
                {isFixed ? (
                  <div className="bg-accent rounded-lg px-3 py-2 text-sm mb-3">
                    <span className="text-accent-foreground font-medium">📅 الراتب الشهري الكامل:</span>
                    <span className="font-bold ms-2">{(s.monthly_amount || 0).toLocaleString('en-US')} ر.س</span>
                    <p className="text-xs text-muted-foreground mt-0.5">(monthly_amount ÷ 30) × أيام الحضور</p>
                  </div>
                ) : (
                  <>
                    {/* Tiers */}
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs font-medium text-muted-foreground">الشرائح:</p>
                      {(tiers[s.id] || []).map((t) => (
                        <div key={`${s.id}-tier-${t.tierType}-${t.from}-${t.to}`} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-1.5">
                          <span className="text-xs bg-muted rounded px-1.5 py-0.5 text-muted-foreground">{tierTypeLabels[t.tierType] || t.tierType}</span>
                          <span className="text-muted-foreground">من {t.from} إلى {t.to >= 9999 ? '∞' : t.to}</span>
                          {renderTierDescription(t)}
                        </div>
                      ))}
                    </div>

                    {s.target_bonus && s.target_orders && (
                      <div className="bg-success/10 rounded-lg px-3 py-2 text-sm mb-3">
                        <span className="text-success font-medium">🎯 Target Bonus:</span> عند {s.target_orders} طلب → +{s.target_bonus} ر.س
                      </div>
                    )}
                  </>
                )}

                {/* Snapshot section — شبكة أشهر أفقية + سنة + تثبيت / إلغاء تثبيت */}
                {!isFixed && (
                  <SchemeSnapshotPinPanel
                    year={snapYear}
                    onYearChange={(y) => setSchemeSnapshotYear(s.id, y)}
                    yearMonths={buildMonthsOfYear(snapYear)}
                    selectedMonths={pinSel}
                    pinnedMonthYears={(snapshots[s.id] || []).map((sn) => sn.month_year)}
                    snapshotBusy={snapshotLoading === s.id}
                    onMonthActivate={(my, pinned) => {
                      if (pinned) void handleUnpinSnapshot(s.id, my);
                      else togglePinMonthSelect(s.id, my);
                    }}
                    onPinSelected={() => void handleSnapshot(s.id, pinSel)}
                    onClearSelection={() =>
                      setPinSelectionByScheme((prev) => {
                        const next = { ...prev };
                        delete next[s.id];
                        return next;
                      })
                    }
                    totalPinnedLabelCount={(snapshots[s.id] || []).length}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Scheme Form Modal */}
      <SchemeFormModal
        open={showModal}
        onOpenChange={setShowModal}
        editing={editing}
        initialTiers={editingTiers}
        apps={apps}
        onSuccess={handleFormSuccess}
      />

      {/* Assign App Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>ربط السكيمة بمنصة</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">اختر المنصة التي ستستخدم هذه السكيمة لحساب رواتب جميع مناديبها</p>
            <div className="space-y-2">
              <Label>المنصة *</Label>
              <Select value={assignAppId} onValueChange={setAssignAppId}>
                <SelectTrigger><SelectValue placeholder="اختر المنصة" /></SelectTrigger>
                <SelectContent>
                  {availableApps(assignSchemeId).map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} {getAppAssignmentLabel(a.scheme_id, assignSchemeId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>إلغاء</Button>
            <Button onClick={handleAssign} disabled={assigning || !assignAppId}>
              {assigning && <Loader2 size={14} className="animate-spin me-1" />}
              ربط المنصة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalarySchemes;
