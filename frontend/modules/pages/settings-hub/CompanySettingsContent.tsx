import { BaseInput } from '@shared/components/ui/base-input';
import type React from 'react';
import { useState, useEffect } from 'react';
import { Building2, Save, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useToast } from '@shared/hooks/use-toast';
import { useLanguage } from '@app/providers/LanguageContext';
import { settingsHubService } from '@services/settingsHubService';
import { getErrorMessage } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions } from '@shared/hooks/usePermissions';

const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-3 pb-4 mb-5" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(38,66,230,0.08)', color: '#2642e6' }}>
      {icon}
    </div>
    <div>
      <h2 className="text-base font-bold" style={{ color: 'var(--ds-on-surface)' }}>{title}</h2>
      {subtitle && <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>{subtitle}</p>}
    </div>
  </div>
);

export default function CompanySettingsContent() {
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { enabled } = useAuthQueryGate();
  const { permissions, loading: permsLoading } = usePermissions('settings');

  const { data: tradeRegister, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['settings', 'trade-register'],
    queryFn: () => settingsHubService.getTradeRegister(),
    enabled,
    staleTime: 60_000,
  });

  const [recordId, setRecordId] = useState<string | null>(null);
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form state from query data
  useEffect(() => {
    if (!tradeRegister) return;
    setRecordId(tradeRegister.id);
    setNameAr(tradeRegister.name ?? '');
    setNameEn(tradeRegister.name_en ?? '');
    setCrNumber(tradeRegister.cr_number ?? '');
    setTaxNumber(tradeRegister.notes ?? '');
  }, [tradeRegister]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: nameAr.trim(),
        name_en: nameEn.trim(),
        cr_number: crNumber.trim(),
        notes: taxNumber.trim(),
      };
      if (recordId) {
        await settingsHubService.updateTradeRegister(recordId, payload);
      } else {
        const data = await settingsHubService.createTradeRegister(payload);
        if (data) setRecordId((data as { id: string }).id);
      }
      await queryClient.invalidateQueries({ queryKey: ['settings', 'trade-register'] });
      toast({ title: 'تم الحفظ ✓', description: 'تم تحديث بيانات المنشأة' });
    } catch (err: unknown) {
      logError('[CompanySettings] save trade register failed', err);
      toast({ title: 'خطأ', description: getErrorMessage(err), variant: 'destructive' });
    }
    setSaving(false);
  };

  if (loading || permsLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  if (!permissions.can_view) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <ShieldAlert size={40} className="text-destructive" />
      <p className="text-lg font-semibold">غير مصرح بالوصول</p>
      <p className="text-sm text-muted-foreground">ليس لديك صلاحية تعديل بيانات المنشأة</p>
    </div>
  );

  if (error) return (
    <QueryErrorRetry
      error={error}
      onRetry={() => refetch().catch(() => {})}
      title="تعذر تحميل بيانات المنشأة"
    />
  );

  return (
    <div className="space-y-6 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
      <SectionHeader
        icon={<Building2 size={20} />}
        title="بيانات المنشأة"
        subtitle="المعلومات الأساسية التي تظهر في التقارير والفواتير"
      />

      {/* Names */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          اسم المؤسسة
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BaseInput label="اسم المؤسسة (بالعربية)" value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="شركة المنسق الرقمي" dir="rtl" />
          <BaseInput label="اسم المؤسسة (بالإنجليزية)" value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Digital Coordinator Logistics" dir="ltr" />
        </div>
      </div>

      {/* Registration Numbers */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          الأرقام الرسمية
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BaseInput label="السجل التجاري" value={crNumber} onChange={e => setCrNumber(e.target.value)} placeholder="1010101010" dir="ltr" />
          <BaseInput label="الرقم الضريبي" value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="3000524140003" dir="ltr" />
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-36">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          حفظ البيانات
        </Button>
      </div>
    </div>
  );
}
