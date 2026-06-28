/**
 * DocumentScanner — مسح وثائق الموظفين ضوئياً باستخدام OCR
 *
 * يتيح للمستخدم رفع صورة الإقامة أو رخصة القيادة، ويستخرج البيانات تلقائياً،
 * ثم يعرضها للمراجعة قبل حفظها على Supabase.
 *
 * تدعم: الإقامة السعودية · رخصة القيادة السعودية
 * اللغة: عربي RTL
 */
import { useState, useRef, useCallback } from 'react';
import { ScanLine, Upload, CheckCircle2, Loader2, AlertCircle, X, FileImage, Fingerprint, Car } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useToast } from '@shared/hooks/use-toast';
import { employeeService } from '@services/employeeService';
import {
  extractTextFromImage,
  parseIqamaData,
  parseLicenseData,
  type IqamaData,
  type LicenseData,
} from '@services/ocrService';

// ─── أنواع ────────────────────────────────────────────────────────────────────

type ScanMode = 'iqama' | 'license';

interface ScannedIqamaFields {
  name?: string;
  nameEn?: string;
  national_id?: string;  // maps iqamaNumber → national_id
  nationality?: string;
  birth_date?: string;
  residency_expiry?: string;
}

interface ScannedLicenseFields {
  name?: string;
  nameEn?: string;
  license_number?: string;
  license_expiry?: string;
  license_class?: string;
}

type ScannedFields = ScannedIqamaFields | ScannedLicenseFields;

interface Props {
  employeeId: string;
  employeeName: string;
  onSaved: () => void;
}

// ─── Label maps ───────────────────────────────────────────────────────────────

const IQAMA_FIELD_LABELS: Record<string, string> = {
  name: 'الاسم بالعربي',
  nameEn: 'الاسم بالإنجليزي',
  national_id: 'رقم الإقامة',
  nationality: 'الجنسية',
  birth_date: 'تاريخ الميلاد',
  residency_expiry: 'تاريخ انتهاء الإقامة',
};

const LICENSE_FIELD_LABELS: Record<string, string> = {
  name: 'الاسم بالعربي',
  nameEn: 'الاسم بالإنجليزي',
  license_number: 'رقم الرخصة',
  license_expiry: 'تاريخ انتهاء الرخصة',
  license_class: 'فئة الرخصة',
};

// ─── Helper: map raw OCR result → employee fields ─────────────────────────────

function mapIqamaToEmployee(data: IqamaData): ScannedIqamaFields {
  return {
    ...(data.name && { name: data.name }),
    ...(data.nameEn && { nameEn: data.nameEn }),
    ...(data.iqamaNumber && { national_id: data.iqamaNumber }),
    ...(data.nationality && { nationality: data.nationality }),
    ...(data.dateOfBirth && { birth_date: data.dateOfBirth }),
    ...(data.expiryDate && { residency_expiry: data.expiryDate }),
  };
}

function mapLicenseToEmployee(data: LicenseData): ScannedLicenseFields {
  return {
    ...(data.name && { name: data.name }),
    ...(data.nameEn && { nameEn: data.nameEn }),
    ...(data.licenseNumber && { license_number: data.licenseNumber }),
    ...(data.expiryDate && { license_expiry: data.expiryDate }),
    ...(data.licenseClass && { license_class: data.licenseClass }),
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DocumentScanner({ employeeId, employeeName, onSaved }: Readonly<Props>) {
  const { toast } = useToast();
  const iqamaInputRef = useRef<HTMLInputElement>(null);
  const licenseInputRef = useRef<HTMLInputElement>(null);

  const [activeMode, setActiveMode] = useState<ScanMode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<ScannedFields | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMode, setSavedMode] = useState<ScanMode | null>(null);

  // ─── تحديث حقل محرر ─────────────────────────────────────────────────────

  const handleFieldChange = (key: string, value: string) => {
    setExtractedFields(prev => prev ? { ...prev, [key]: value } : null);
  };

  // ─── معالجة الصورة بـ OCR ─────────────────────────────────────────────────

  const processImage = useCallback(async (file: File, mode: ScanMode) => {
    setActiveMode(mode);
    setScanning(true);
    setScanProgress(0);
    setScanStatus('تهيئة محرك قراءة الوثائق...');
    setPreviewUrl(URL.createObjectURL(file));
    setSavedMode(null);
    setScanError(null);

    try {
      const text = await extractTextFromImage(file, ({ status, progress }) => {
        setScanProgress(Math.round(progress * 100));
        const statusMap: Record<string, string> = {
          'loading tesseract core': 'تحميل محرك OCR...',
          'initializing tesseract': 'تهيئة Tesseract...',
          'loading language traineddata': 'تحميل بيانات اللغة...',
          'initializing api': 'تهيئة واجهة المعالجة...',
          'recognizing text': 'قراءة النص من الصورة...',
        };
        setScanStatus(statusMap[status] ?? status);
      });

      if (mode === 'iqama') {
        const data = parseIqamaData(text);
        setExtractedFields(mapIqamaToEmployee(data));
      } else {
        const data = parseLicenseData(text);
        setExtractedFields(mapLicenseToEmployee(data));
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      const errDetail = errorObj?.stack || errorObj?.message || JSON.stringify(err) || 'Unknown error';
      setScanError(errDetail);
      toast({
        title: 'فشل قراءة الوثيقة',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة',
        variant: 'destructive',
      });
      setExtractedFields(null);
    } finally {
      setScanning(false);
      setScanStatus('');
    }
  }, [toast]);

  // ─── رفع الصورة وبدء المسح ────────────────────────────────────────────────

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: ScanMode) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void processImage(file, mode);
    // reset input so same file can be re-selected
    e.target.value = '';
  };

  // ─── حفظ البيانات في Supabase ─────────────────────────────────────────────

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const handleSave = async () => {
    if (!extractedFields || !activeMode) return;
    setSaving(true);
    try {
      // بناء payload مع استبعاد الحقول غير المعروفة في جدول employees
      const payload: Record<string, unknown> = {};
      const fields = extractedFields as Record<string, string | undefined>;

      if (activeMode === 'iqama') {
        if (fields.name) payload.name = fields.name;
        if (fields.national_id) payload.national_id = fields.national_id;
        if (fields.nationality) payload.nationality = fields.nationality;
        if (fields.birth_date) payload.birth_date = fields.birth_date;
        if (fields.residency_expiry) payload.residency_expiry = fields.residency_expiry;
      } else {
        if (fields.license_expiry) payload.license_expiry = fields.license_expiry;
        // license_number / license_class stored as notes in national_id for now
        // extend if schema supports it
      }

      await employeeService.updateEmployee(employeeId, payload);

      toast({
        title: '✅ تم الحفظ بنجاح',
        description: `تم تحديث بيانات ${employeeName} من ${activeMode === 'iqama' ? 'صورة الإقامة' : 'صورة الرخصة'}`,
      });

      setSavedMode(activeMode);
      setExtractedFields(null);
      setPreviewUrl(null);
      setActiveMode(null);
      onSaved();
    } catch (err) {
      toast({
        title: 'فشل الحفظ',
        description: err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── إلغاء / إعادة تعيين ──────────────────────────────────────────────────

  const handleReset = () => {
    setExtractedFields(null);
    setPreviewUrl(null);
    setActiveMode(null);
    setScanning(false);
    setSavedMode(null);
  };

  const fieldLabels = activeMode === 'iqama' ? IQAMA_FIELD_LABELS : LICENSE_FIELD_LABELS;
  const fieldsEntries = extractedFields
    ? Object.entries(extractedFields as Record<string, string | undefined>).filter(([, v]) => v)
    : [];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      dir="rtl"
      className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-l from-primary/5 to-transparent border-b border-border/40">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <ScanLine size={18} className="text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground text-sm">مسح الوثائق ضوئياً</h3>
          <p className="text-xs text-muted-foreground">استخراج البيانات تلقائياً من صور الوثائق</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Scan Buttons */}
        {!scanning && !extractedFields && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Iqama Button */}
            <button
              type="button"
              id="scan-iqama-btn"
              onClick={() => iqamaInputRef.current?.click()}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-border/60 hover:border-primary/60 hover:bg-primary/5 transition-all duration-200 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 group-hover:bg-blue-500/20 flex items-center justify-center transition-colors">
                <Fingerprint size={22} className="text-blue-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm text-foreground">مسح صورة الإقامة</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  يستخرج: الاسم · رقم الإقامة · الجنسية · التواريخ
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-primary/70 font-medium">
                <Upload size={12} />
                رفع الصورة
              </div>
            </button>
            <input
              ref={iqamaInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleFileSelect(e, 'iqama')}
            />

            {/* License Button */}
            <button
              type="button"
              id="scan-license-btn"
              onClick={() => licenseInputRef.current?.click()}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border-2 border-dashed border-border/60 hover:border-emerald-500/60 hover:bg-emerald-500/5 transition-all duration-200 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                <Car size={22} className="text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm text-foreground">مسح صورة الرخصة</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  يستخرج: رقم الرخصة · تاريخ الانتهاء · الفئة
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <Upload size={12} />
                رفع الصورة
              </div>
            </button>
            <input
              ref={licenseInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handleFileSelect(e, 'license')}
            />
          </div>
        )}

        {/* Error Display */}
        {scanError && (
          <div className="mt-4 p-4 border border-red-200 bg-red-50 text-red-800 rounded-lg text-sm text-left" dir="ltr">
            <h4 className="font-semibold mb-2 text-right" dir="rtl">تفاصيل الخطأ التقني (لتزويد الدعم الفني):</h4>
            <pre className="whitespace-pre-wrap break-words">{scanError}</pre>
          </div>
        )}

        {/* ─── حالة: جارٍ المسح ─────────────────────────────────── */}
        {scanning && (
          <div className="flex flex-col items-center gap-5 py-6">
            {/* Image Preview */}
            {previewUrl && (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="معاينة الوثيقة"
                  className="w-full max-w-sm h-40 object-cover rounded-xl border border-border/50 opacity-70"
                />
                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/30 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 size={28} className="animate-spin text-primary" />
                    <span className="text-xs font-medium text-primary">جارٍ المسح...</span>
                  </div>
                </div>
                {/* Scanning animation bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary/20 rounded-t-xl overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}
            <div className="text-center space-y-2 w-full max-w-sm">
              <p className="text-sm font-medium text-foreground">{scanStatus}</p>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-l from-primary to-primary/60 rounded-full transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{scanProgress}%</p>
            </div>
          </div>
        )}

        {/* ─── حالة: نتائج OCR للمراجعة ────────────────────────── */}
        {!scanning && extractedFields && (
          <div className="space-y-4">
            {/* Preview thumbnail */}
            {previewUrl && (
              <div className="flex items-start gap-3">
                <img
                  src={previewUrl}
                  alt="معاينة الوثيقة"
                  className="w-20 h-16 object-cover rounded-lg border border-border/50 flex-shrink-0"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <FileImage size={14} className="text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      {activeMode === 'iqama' ? '🪪 بيانات الإقامة المستخرجة' : '🚗 بيانات الرخصة المستخرجة'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    راجع البيانات وعدّل ما يلزم قبل الحفظ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  aria-label="إلغاء"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Fields */}
            {fieldsEntries.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {fieldsEntries.map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-xs text-muted-foreground font-medium" htmlFor={`ocr-field-${key}`}>
                      {fieldLabels[key] ?? key}
                    </label>
                    <input
                      id={`ocr-field-${key}`}
                      type="text"
                      value={value ?? ''}
                      onChange={e => handleFieldChange(key, e.target.value)}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-border/60 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/60 transition"
                      dir={key === 'nameEn' || key === 'national_id' || key === 'license_number' ? 'ltr' : 'rtl'}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <AlertCircle size={22} className="text-warning" />
                <p className="text-sm font-medium text-foreground">لم يتم التعرف على بيانات واضحة</p>
                <p className="text-xs text-muted-foreground">
                  جرب صورة أوضح أو ذات إضاءة أفضل
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={saving}
                className="gap-1.5"
              >
                <X size={13} />
                إلغاء
              </Button>
              {fieldsEntries.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="gap-1.5"
                  id="ocr-confirm-save-btn"
                >
                  {saving ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={13} />
                  )}
                  {saving ? 'جارٍ الحفظ...' : 'تأكيد وحفظ'}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ─── حالة: تم الحفظ ────────────────────────────────────── */}
        {savedMode && !extractedFields && !scanning && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <p className="text-sm font-semibold text-foreground">
              تم حفظ بيانات {savedMode === 'iqama' ? 'الإقامة' : 'الرخصة'} بنجاح
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="mt-2"
            >
              مسح وثيقة أخرى
            </Button>
          </div>
        )}

        {/* Hint */}
        {!scanning && !extractedFields && !savedMode && (
          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
            🔒 المعالجة تتم داخل المتصفح فقط — لا يتم رفع الصورة للخوادم
          </p>
        )}
      </div>
    </div>
  );
}
