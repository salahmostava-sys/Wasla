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
import { useTranslation } from 'react-i18next';
import { deriveSaudiBankCode, isValidSaudiIban, normalizeIban, saudiBankName } from '@shared/lib/saudiBank';

// The generated Supabase types lag the WPS-fields migration; describe the extra
// columns locally so reads stay typed until `npm run gen:types` is re-run.
type TradeRegisterWps = {
  id: string;
  name: string | null;
  name_en: string | null;
  cr_number: string | null;
  notes: string | null;
  mol_establishment_number: string | null;
  employer_iban: string | null;
  employer_bank_code: string | null;
  tax_number: string | null;
};

const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
  <div className="flex items-center gap-3 pb-4 mb-5" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(31,84,173,0.08)', color: '#1f54ad' }}>
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
  const { t } = useTranslation();
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
  const [molNumber, setMolNumber] = useState('');
  const [employerIban, setEmployerIban] = useState('');
  const [saving, setSaving] = useState(false);

  // Sync form state from query data
  useEffect(() => {
    if (!tradeRegister) return;
    const tr = tradeRegister as unknown as TradeRegisterWps;
    setRecordId(tr.id);
    setNameAr(tr.name ?? '');
    setNameEn(tr.name_en ?? '');
    setCrNumber(tr.cr_number ?? '');
    // tax_number is the dedicated column; fall back to the legacy notes value.
    setTaxNumber(tr.tax_number ?? tr.notes ?? '');
    setMolNumber(tr.mol_establishment_number ?? '');
    setEmployerIban(tr.employer_iban ?? '');
  }, [tradeRegister]);

  const cleanIban = normalizeIban(employerIban);
  const ibanValid = cleanIban === '' || isValidSaudiIban(cleanIban);
  const derivedBankCode = deriveSaudiBankCode(cleanIban);
  const derivedBankName = saudiBankName(derivedBankCode, isRTL ? 'ar' : 'en');

  const handleSave = async () => {
    if (!ibanValid) {
      toast({ title: t('organizationSaveError'), description: t('invalidSaudiIban'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: nameAr.trim(),
        name_en: nameEn.trim(),
        cr_number: crNumber.trim(),
        tax_number: taxNumber.trim(),
        mol_establishment_number: molNumber.trim(),
        employer_iban: cleanIban,
        // Derived from the IBAN so it's always consistent with it.
        employer_bank_code: derivedBankCode,
      };
      if (recordId) {
        await settingsHubService.updateTradeRegister(recordId, payload);
      } else {
        const data = await settingsHubService.createTradeRegister(payload);
        if (data) setRecordId((data as { id: string }).id);
      }
      await queryClient.invalidateQueries({ queryKey: ['settings', 'trade-register'] });
      toast({ title: t('organizationSaved'), description: t('organizationUpdated') });
    } catch (err: unknown) {
      logError('[CompanySettings] save trade register failed', err);
      toast({ title: t('organizationSaveError'), description: getErrorMessage(err), variant: 'destructive' });
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
      <p className="text-lg font-semibold">{t('accessDenied')}</p>
      <p className="text-sm text-muted-foreground">{t('organizationAccessDenied')}</p>
    </div>
  );

  if (error) return (
    <QueryErrorRetry
      error={error}
      onRetry={() => refetch().catch(() => {})}
      title={t('organizationLoadError')}
    />
  );

  return (
    <div className="space-y-6 max-w-2xl" dir={isRTL ? 'rtl' : 'ltr'}>
      <SectionHeader
        icon={<Building2 size={20} />}
        title={t('organizationInfo')}
        subtitle={t('organizationInfoSubtitle')}
      />

      {/* Names */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('organizationName')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BaseInput label={t('organizationNameArabic')} value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder={t('organizationArabicPlaceholder')} dir="rtl" />
          <BaseInput label={t('organizationNameEnglish')} value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder={t('organizationEnglishPlaceholder')} dir="ltr" />
        </div>
      </div>

      {/* Registration Numbers */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('organizationOfficialNumbers')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BaseInput label={t('commercialRegistration')} value={crNumber} onChange={e => setCrNumber(e.target.value)} placeholder="1010101010" dir="ltr" />
          <BaseInput label={t('taxNumber')} value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="3000524140003" dir="ltr" />
        </div>
      </div>

      {/* WPS / Wage Protection establishment data */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('wpsEstablishmentData')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BaseInput label={t('molEstablishmentNumber')} value={molNumber} onChange={e => setMolNumber(e.target.value)} placeholder="700xxxxxxx" dir="ltr" />
          <div>
            <BaseInput
              label={t('employerIban')}
              value={employerIban}
              onChange={e => setEmployerIban(e.target.value)}
              placeholder="SA0000000000000000000000"
              dir="ltr"
            />
            {employerIban !== '' && !ibanValid && (
              <p className="mt-1 text-xs text-destructive">{t('invalidSaudiIban')}</p>
            )}
            {ibanValid && derivedBankCode && (
              <p className="mt-1 text-xs text-muted-foreground">
                {t('detectedBank')}: {derivedBankCode}{derivedBankName ? ` — ${derivedBankName}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-36">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t('organizationSaveAction')}
        </Button>
      </div>
    </div>
  );
}
