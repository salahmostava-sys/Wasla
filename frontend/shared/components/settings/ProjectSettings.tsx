import { BaseInput } from '@shared/components/ui/base-input';
import type React from 'react';
const t = (isRTL: boolean, ar: string, en: string) => isRTL ? ar : en;
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '@app/providers/LanguageContext';
import { useTheme } from '@app/providers/ThemeContext';
import { useSystemSettings } from '@app/providers/SystemSettingsContext';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { toast } from '@shared/components/ui/sonner';
import { TOAST_ERROR_GENERIC, TOAST_SUCCESS_ACTION, TOAST_SUCCESS_EDIT } from '@shared/lib/toastMessages';
import { Loader2, Save, Globe, Building2, Upload, X, Download, Database, Bell } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { format } from 'date-fns';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useAuth } from '@app/providers/AuthContext';
import { validateUploadFile } from '@shared/lib/validation';
import { settingsHubService, BACKUP_TABLES } from '@services/settingsHubService';
import { brandLogoSrc } from '@shared/lib/brandLogo';
import { getErrorMessage } from '@shared/lib/query';
import { logError } from '@shared/lib/logger';
import { loadXlsx } from '@modules/orders/utils/xlsx';

async function uploadNewLogo(logoFile: File, userId: string | undefined, isRTL: boolean): Promise<string> {
  const sessionUserId = await settingsHubService.getCurrentUserId();
  const uid = userId ?? sessionUserId;
  if (!uid) {
    throw new Error(t(isRTL, 'تعذر الرفع. يجب تسجيل الدخول لرفع الشعار.', 'Cannot upload. You must be signed in to upload a logo.'));
  }
  const ext = logoFile.name.split('.').pop() || 'png';
  const version = Date.now();
  const path = `${uid}/project-logo-${version}.${ext}`;
  
  await settingsHubService.uploadCompanyLogo(path, logoFile);
  const { data: { publicUrl } } = settingsHubService.getCompanyLogoPublicUrl(path);
  return publicUrl;
}

/** Next logo URL for save: new file wins, else removal clears, else unchanged. */
async function resolveLogoUrlForSave(
  currentLogoUrl: string | null | undefined,
  logoFile: File | null,
  removeLogo: boolean,
  userId: string | undefined,
  isRTL: boolean,
): Promise<string | null> {
  if (logoFile) {
    return uploadNewLogo(logoFile, userId, isRTL);
  }
  if (removeLogo) {
    return null;
  }
  return currentLogoUrl ?? null;
}

function ProjectSettingsSectionHeader({ icon, title }: Readonly<{ icon: React.ReactNode; title: string }>) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary">{icon}</div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
  );
}

async function exportBackupFiles(): Promise<number> {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm');
  const tables = BACKUP_TABLES;

  const results: Record<string, unknown[]> = {};
  await Promise.all(
    tables.map(async (table) => {
      results[table] = await settingsHubService.exportTableRows(table);
    })
  );

  const exportedCount = Object.keys(results).filter(k => Array.isArray(results[k])).length;

  const jsonBlob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
  const jsonUrl = URL.createObjectURL(jsonBlob);
  const jsonLink = document.createElement('a');
  jsonLink.href = jsonUrl;
  jsonLink.download = `backup_${timestamp}.json`;
  jsonLink.click();
  URL.revokeObjectURL(jsonUrl);

  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  for (const table of tables) {
    const sheetData = results[table];
    const ws = XLSX.utils.json_to_sheet(sheetData.length > 0 ? sheetData : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, table.slice(0, 31));
  }
  XLSX.writeFile(wb, `backup_${timestamp}.xlsx`);

  return exportedCount;
}

/** Result of restoring a single table from a backup JSON file. */
interface RestoreTableResult {
  table: string;
  restored: number;
  error?: string;
}

/**
 * Restore rows from a previously downloaded backup JSON file (as produced by
 * exportBackupFiles). Only recognized backup tables are processed; unknown keys
 * in the file are ignored. Existing rows are matched/updated by `id` (upsert),
 * new rows are inserted; nothing is deleted.
 */
async function importBackupFile(file: File): Promise<RestoreTableResult[]> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid-json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid-json');
  }

  const data = parsed as Record<string, unknown>;
  const results: RestoreTableResult[] = [];

  for (const table of BACKUP_TABLES) {
    const rows = data[table];
    if (!Array.isArray(rows) || rows.length === 0) continue;
    try {
      const restored = await settingsHubService.importTableRows(table, rows as Record<string, unknown>[]);
      results.push({ table, restored });
    } catch (err: unknown) {
      results.push({ table, restored: 0, error: getErrorMessage(err) });
    }
  }

  return results;
}

function renderLanguageButtons(
  defaultLang: string,
  setDefaultLang: (lang: string) => void,
) {
  return (
    <div className="flex gap-2">
      {['ar', 'en'].map(l => (
        <button type="button"
          key={l}
          onClick={() => setDefaultLang(l)}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
            defaultLang === l
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary/50'
          )}
        >
          {l === 'ar' ? 'العربية' : 'English'}
        </button>
      ))}
    </div>
  );
}

function renderThemeButtons(
  isDark: boolean,
  toggleTheme: () => void,
  isRTL: boolean,
) {
  const currentTheme = isDark ? 'dark' : 'light';
  return (
    <div className="flex gap-2">
      {[
        { key: 'light', labelAr: 'فاتح', labelEn: 'Light' },
        { key: 'dark', labelAr: 'داكن', labelEn: 'Dark' },
      ].map(opt => (
        <button type="button"
          key={opt.key}
          onClick={() => { if (currentTheme !== opt.key) toggleTheme(); }}
          className={cn(
            'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
            currentTheme === opt.key
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary/50'
          )}
        >
          {t(isRTL, opt.labelAr, opt.labelEn)}
        </button>
      ))}
    </div>
  );
}

export default function ProjectSettings() {
  const { isRTL } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const { settings, refresh } = useSystemSettings();
  const { permissions } = usePermissions('settings');

  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [defaultLang, setDefaultLang] = useState('ar');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [iqamaAlertDays, setIqamaAlertDays] = useState(90);
  const [saving, setSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (settings) {
      setNameAr(settings.project_name_ar);
      setNameEn(settings.project_name_en);
      setDefaultLang(settings.default_language);
      setLogoPreview(brandLogoSrc(settings.logo_url, settings.updated_at) ?? settings.logo_url);
      setRemoveLogo(false);
      setIqamaAlertDays(settings.iqama_alert_days ?? 90);
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    });
    if (!validation.valid) {
      toast.error(TOAST_ERROR_GENERIC, { description: validation.error ?? (t(isRTL, 'خطأ في الملف', 'Invalid file')) });
      return;
    }
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
    const nextUrl = URL.createObjectURL(file);
    logoObjectUrlRef.current = nextUrl;
    setLogoFile(file);
    setLogoPreview(nextUrl);
    setRemoveLogo(false);
    e.target.value = '';
  };

  const clearLogoObjectUrl = useCallback(() => {
    if (logoObjectUrlRef.current) {
      URL.revokeObjectURL(logoObjectUrlRef.current);
      logoObjectUrlRef.current = null;
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      let logo_url: string | null;
      try {
        logo_url = await resolveLogoUrlForSave(settings?.logo_url ?? null, logoFile, removeLogo, user?.id, isRTL);
      } catch (e: unknown) {
        toast.error(TOAST_ERROR_GENERIC, { description: e instanceof Error ? e.message : String(e) });
        return;
      }

      const payload = {
        project_name_ar: nameAr,
        project_name_en: nameEn,
        default_language: defaultLang,
        logo_url,
        iqama_alert_days: iqamaAlertDays,
      };

      await settingsHubService.saveSystemSettings(settings?.id, payload);

      clearLogoObjectUrl();
      setLogoFile(null);
      setRemoveLogo(false);
      await refresh();
      toast.success(TOAST_SUCCESS_EDIT, {
        description: t(isRTL, 'تم تحديث إعدادات المشروع', 'Project settings updated'),
      });
    } catch (err: unknown) {
      logError('[ProjectSettings] save failed', err);
      toast.error(TOAST_ERROR_GENERIC, { description: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  // Backup handler
  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const exportedCount = await exportBackupFiles();

      toast.success(TOAST_SUCCESS_ACTION, {
        description: isRTL
          ? `تم تصدير ${exportedCount} جدول - JSON + Excel`
          : `Exported ${exportedCount} tables - JSON + Excel`,
      });
    } catch (err: unknown) {
      logError('[ProjectSettings] backup export failed', err);
      toast.error(TOAST_ERROR_GENERIC, { description: getErrorMessage(err) });
    }
    setBackupLoading(false);
  };

  // Restore handler
  const handleRestoreFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validation = validateUploadFile(file, { allowedTypes: ['application/json'] });
    if (!validation.valid && !file.name.toLowerCase().endsWith('.json')) {
      toast.error(TOAST_ERROR_GENERIC, {
        description: t(isRTL, 'من فضلك اختر ملف نسخة احتياطية بصيغة JSON.', 'Please select a JSON backup file.'),
      });
      return;
    }

    const confirmed = window.confirm(
      t(
        isRTL,
        'سيتم استرجاع البيانات من ملف النسخة الاحتياطية. السجلات المطابقة سيتم تحديثها والسجلات الجديدة ستُضاف، ولن يتم حذف أي بيانات حالية. هل تريد المتابعة؟',
        'Data will be restored from the backup file. Matching records will be updated and new ones added; no existing data will be deleted. Continue?',
      ),
    );
    if (!confirmed) return;

    setRestoreLoading(true);
    try {
      const results = await importBackupFile(file);
      const totalRestored = results.reduce((sum, r) => sum + r.restored, 0);
      const failed = results.filter(r => r.error);

      if (results.length === 0) {
        toast.error(TOAST_ERROR_GENERIC, {
          description: t(isRTL, 'لم يتم العثور على بيانات قابلة للاسترجاع في هذا الملف.', 'No restorable data found in this file.'),
        });
      } else if (failed.length > 0) {
        toast.error(TOAST_ERROR_GENERIC, {
          description: isRTL
            ? `تم استرجاع ${totalRestored} سجل، لكن فشل استرجاع: ${failed.map(f => f.table).join('، ')}`
            : `Restored ${totalRestored} records, but failed for: ${failed.map(f => f.table).join(', ')}`,
        });
      } else {
        toast.success(TOAST_SUCCESS_ACTION, {
          description: isRTL
            ? `تم استرجاع ${totalRestored} سجل من ${results.length} جدول بنجاح`
            : `Restored ${totalRestored} records across ${results.length} tables`,
        });
      }
    } catch (err: unknown) {
      logError('[ProjectSettings] restore failed', err);
      const isInvalidJson = err instanceof Error && err.message === 'invalid-json';
      toast.error(TOAST_ERROR_GENERIC, {
        description: isInvalidJson
          ? t(isRTL, 'الملف غير صالح. من فضلك اختر ملف JSON صادر من زر تحميل النسخة الاحتياطية.', 'Invalid file. Please select a JSON file exported from the backup download button.')
          : getErrorMessage(err),
      });
    }
    setRestoreLoading(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Project Name */}
      <div className="bg-card border border-border/50 p-5 shadow-sm rounded-2xl">
        <ProjectSettingsSectionHeader icon={<Building2 size={14} />} title={t(isRTL, 'اسم المشروع', 'Project Name')} />
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BaseInput label={t(isRTL, 'اسم المشروع (عربي)', 'Project Name (Arabic)')} value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="وصلة" dir="rtl" />
            <BaseInput label={t(isRTL, 'اسم المشروع (إنجليزي)', 'Project Name (English)')} value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Wasla" dir="ltr" />
          </div>
        </div>
      </div>

      {/* Logo */}
      <div className="bg-card border border-border/50 p-5 shadow-sm rounded-2xl">
        <ProjectSettingsSectionHeader icon={<Upload size={14} />} title={t(isRTL, 'شعار المشروع', 'Project Logo')} />
        <div className="flex items-center gap-4">
          {logoPreview ? (
            <div className="relative">
              <img src={logoPreview} alt="logo" className="h-16 w-16 rounded-xl object-cover border border-border" />
              <button type="button"
                onClick={() => {
                  clearLogoObjectUrl();
                  setLogoPreview(null);
                  setLogoFile(null);
                  setRemoveLogo(true);
                }}
                className="absolute -top-1.5 -end-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center text-2xl border border-border border-dashed">
              +
            </div>
          )}
          <div>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              className="sr-only"
              aria-label={t(isRTL, 'اختيار ملف الشعار', 'Choose logo file')}
              onChange={handleLogoChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => logoInputRef.current?.click()}
            >
              <Upload size={13} /> {t(isRTL, 'رفع شعار', 'Upload Logo')}
            </Button>
            <p className="text-xs text-muted-foreground mt-1.5">
              {t(isRTL, 'PNG، JPG، SVG - الحد الأقصى 2 ميغابايت', 'PNG, JPG, SVG - Max 2MB')}
            </p>
          </div>
        </div>
      </div>

      {/* Language & Theme */}
      <div className="bg-card border border-border/50 p-5 shadow-sm rounded-2xl">
        <ProjectSettingsSectionHeader icon={<Globe size={14} />} title={t(isRTL, 'اللغة والمظهر', 'Language & Theme')} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {t(isRTL, 'اللغة الافتراضية', 'Default Language')}
            </Label>
            {renderLanguageButtons(defaultLang, setDefaultLang)}
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {t(isRTL, 'مظهر النظام', 'System Theme')}
            </Label>
            {renderThemeButtons(isDark, toggleTheme, isRTL)}
          </div>
        </div>
      </div>

      {/* Alert Settings */}
      <div className="bg-card border border-border/50 p-5 shadow-sm rounded-2xl">
        <ProjectSettingsSectionHeader icon={<Bell size={14} />} title={t(isRTL, 'إعدادات التنبيهات', 'Alert Settings')} />
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Label className="text-xs font-medium text-muted-foreground">
              {t(isRTL, 'التنبيه بانتهاء الإقامة (للموظفين) قبل', 'Iqama expiry alert (employees) before')}
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(isRTL, 'سيظهر تنبيه تلقائي عند اقتراب انتهاء إقامة الموظف بهذا العدد من الأيام أو أقل.', 'An automatic alert shows when an employee iqama expires within this many days.')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Input
              type="number"
              min={1}
              max={365}
              value={iqamaAlertDays}
              onChange={e => setIqamaAlertDays(Math.max(1, Number.parseInt(e.target.value) || 90))}
              className="w-24 text-center"
            />
            <span className="text-sm text-muted-foreground">{t(isRTL, 'يوم', 'days')}</span>
          </div>
        </div>
      </div>

      {/* Backup Section (Admin only) */}
      {permissions.can_edit && (
        <div className="bg-card border border-border/50 p-5 shadow-sm rounded-2xl">
          <ProjectSettingsSectionHeader icon={<Database size={14} />} title={t(isRTL, 'النسخ الاحتياطي', 'Backup')} />
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                {isRTL
                  ? 'تحميل نسخة احتياطية كاملة من قاعدة البيانات تشمل: الموظفين، الحضور، السلف، الطلبات، الرواتب، المركبات، والتنبيهات.'
                  : 'Download a full database backup including: employees, attendance, advances, orders, salaries, vehicles, and alerts.'}
              </p>
              <p className="text-xs text-muted-foreground">
                {t(isRTL, 'يُصدر ملفين: JSON + Excel', 'Exports two files: JSON + Excel')}
              </p>
            </div>
            <div className="flex flex-col gap-2 min-w-44 flex-shrink-0">
              <Button
                onClick={handleBackup}
                disabled={backupLoading}
                variant="outline"
                className="gap-2"
              >
                {backupLoading ? (
                  <><Loader2 size={14} className="animate-spin" /> {t(isRTL, 'جاري التصدير...', 'Exporting...')}</>
                ) : (
                  <><Download size={14} /> {t(isRTL, 'تحميل نسخة احتياطية', 'Download Backup')}</>
                )}
              </Button>
              <input
                ref={restoreInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                aria-label={t(isRTL, 'اختيار ملف نسخة احتياطية', 'Choose backup file')}
                onChange={handleRestoreFileChange}
              />
              <Button
                onClick={() => restoreInputRef.current?.click()}
                disabled={restoreLoading}
                variant="outline"
                className="gap-2"
              >
                {restoreLoading ? (
                  <><Loader2 size={14} className="animate-spin" /> {t(isRTL, 'جاري الاسترجاع...', 'Restoring...')}</>
                ) : (
                  <><Upload size={14} /> {t(isRTL, 'رفع نسخة احتياطية', 'Upload Backup')}</>
                )}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {t(
              isRTL,
              'يقبل رفع النسخة الاحتياطية ملف JSON الصادر من زر التحميل أعلاه فقط. السجلات المطابقة (بنفس المعرّف) تُحدَّث، والجديدة تُضاف، ولا يُحذف أي شيء تلقائيًا.',
              'Only accepts the JSON file exported by the download button above. Matching records (by ID) are updated, new ones are added, and nothing is deleted automatically.',
            )}
          </p>
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-32">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t(isRTL, 'حفظ الإعدادات', 'Save Settings')}
        </Button>
      </div>
    </div>
  );
}
