import type React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { X, ChevronLeft } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { useToast } from '@shared/hooks/use-toast';
import { useForm, type FieldPath, type FieldPathValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getErrorMessage } from '@shared/lib/query';
import { normalizeArabicDigits } from '@shared/lib/formatters';
import { logError } from '@shared/lib/logger';
import { useCommercialRecords } from '@shared/hooks/useCommercialRecords';
import {
  DEFAULT_EMPLOYEE_CITY_OPTIONS,
  cityLabel,
  normalizeEmployeeCities,
  normalizeEmployeeCityValue,
} from '@modules/employees/model/employeeCity';
import {
  clampEmployeeNationalIdInput,
  clampEmployeePhoneInput,
  EMPLOYEE_INTL_PHONE_DIGITS,
  EMPLOYEE_NATIONAL_ID_DIGITS,
} from '@modules/employees/model/employeeFieldValidation';


import {
  AddEmployeeModalProps as Props,
  STEPS,
  UploadStatus
} from './add-modal/addEmployee.types';
import {
  employeeFormSchema,
  EmployeeFormValues,
  validateEmployeeStep,
} from './add-modal/addEmployee.schema';
import {
  buildEmployeeDefaultValues,
  buildEmployeePayload,
  clearRemovedDocumentsOnEdit,
  getFooterActionContent,
  getResidencyStatus,
  rollbackNewEmployeeAfterSaveFailure,
  uploadNewEmployeeDocuments,
  upsertEmployeeAndAudit,
} from './add-modal/addEmployee.utils';
import {
  F,
  SectionTitle,
  StepIndicator,
  UploadArea,
} from './add-modal/AddEmployeeComponents';

const AddEmployeeModal = ({ onClose, onSuccess, editEmployee }: Readonly<Props>) => {
  const isEdit = !!editEmployee;
  const [step, setStep] = useState(0);
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [citySelectValue, setCitySelectValue] = useState('');

  const formApi = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: buildEmployeeDefaultValues(editEmployee),
    mode: 'onBlur',
  });

  const { trigger, setValue, getValues, watch, formState } = formApi;
  const errors: Record<string, { message?: string }> = formState.errors;
  const form = watch();
  const selectedCities = form.cities ?? [];
  const { recordNames: commercialRecordNames } = useCommercialRecords();

  const [files, setFiles] = useState<{ personal: File | null; id: File | null; iqama: File | null; license: File | null }>({
    personal: null, id: null, iqama: null, license: null,
  });
  /** Tracks which existing documents the user wants to remove (storage path + db field). */
  const [removedDocs, setRemovedDocs] = useState<Array<{ storagePath: string; field: string }>>([]);
  const [uploadState, setUploadState] = useState<{
    personal: { status: UploadStatus; error: string | null };
    id: { status: UploadStatus; error: string | null };
    iqama: { status: UploadStatus; error: string | null };
    license: { status: UploadStatus; error: string | null };
  }>({
    personal: { status: editEmployee?.personal_photo_url ? 'uploaded' : 'idle', error: null },
    id: { status: editEmployee?.id_photo_url ? 'uploaded' : 'idle', error: null },
    iqama: { status: editEmployee?.iqama_photo_url ? 'uploaded' : 'idle', error: null },
    license: { status: editEmployee?.license_photo_url ? 'uploaded' : 'idle', error: null },
  });

  useEffect(() => {
    setUploadState({
      personal: { status: editEmployee?.personal_photo_url ? 'uploaded' : 'idle', error: null },
      id: { status: editEmployee?.id_photo_url ? 'uploaded' : 'idle', error: null },
      iqama: { status: editEmployee?.iqama_photo_url ? 'uploaded' : 'idle', error: null },
      license: { status: editEmployee?.license_photo_url ? 'uploaded' : 'idle', error: null },
    });
  }, [editEmployee?.personal_photo_url, editEmployee?.id_photo_url, editEmployee?.iqama_photo_url, editEmployee?.license_photo_url]);

  const uploadedFilesCount = (['personal', 'id', 'iqama', 'license'] as const).filter((k) => {
    return uploadState[k].status === 'uploaded';
  }).length;
  const totalUploadSlots = 4;
  const uploadProgressPct = Math.round((uploadedFilesCount / totalUploadSlots) * 100);

  const setField = useCallback(<K extends FieldPath<EmployeeFormValues>>(k: K, v: FieldPathValue<EmployeeFormValues, K>) => {
    setValue(k, v, { shouldDirty: true });
  }, [setValue]);

  const upsertCity = useCallback((value: string) => {
    const normalized = normalizeEmployeeCityValue(value);
    if (!normalized) return;
    const next = normalizeEmployeeCities([...(getValues('cities') || []), normalized]);
    setField('cities', next);
    setCitySelectValue('');
  }, [getValues, setField]);

  const removeCity = useCallback((value: string) => {
    const normalized = normalizeEmployeeCityValue(value);
    if (!normalized) return;
    const next = normalizeEmployeeCities((getValues('cities') || []).filter((city) => city !== normalized));
    setField('cities', next);
  }, [getValues, setField]);

  const resStatus = getResidencyStatus(form.residency_expiry, (error) => {
    logError('[AddEmployeeModal] could not parse residency_expiry', error, { level: 'warn' });
  });

  const availableCityOptions = DEFAULT_EMPLOYEE_CITY_OPTIONS.filter((city) => !selectedCities.includes(city));

  const validateStep = useCallback((s: number) => validateEmployeeStep(s, trigger), [trigger]);

  const next = async () => {
    const ok = await validateStep(step);
    if (!ok) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep(s => Math.max(s - 1, 0));

  // Extracted to module level

  const save = async () => {
    const ok = await validateStep(step);
    if (!ok) return;
    setSaving(true);
    let createdEmployeeId: string | null = null;
    let uploadedDocumentPaths: string[] = [];
    try {
      const v = getValues();
      const payload = buildEmployeePayload(v, editEmployee);
      const empId = await upsertEmployeeAndAudit(payload, isEdit, editEmployee?.id);
      if (!isEdit) createdEmployeeId = empId;
      uploadedDocumentPaths = await uploadNewEmployeeDocuments(empId, files, setUploadState);

      await clearRemovedDocumentsOnEdit(empId, removedDocs, isEdit);

      toast({
        title: isEdit ? 'تم تحديث بيانات المندوب' : 'تم إضافة المندوب بنجاح',
        description: v.name,
      });

      if (onSuccess) onSuccess();
      else onClose();
    } catch (err: unknown) {
      logError('[AddEmployeeModal] save failed', err);
      const rollbackFatal = await rollbackNewEmployeeAfterSaveFailure(createdEmployeeId, uploadedDocumentPaths, toast);
      if (rollbackFatal) return;
      toast({ title: 'خطأ في الحفظ', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };
  const footerActionContent = getFooterActionContent(step, saving, isEdit);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-card -2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-border/50 rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? 'تعديل بيانات المندوب' : 'إضافة مندوب جديد'}
          </h2>
          <button aria-label="إغلاق" onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Steps indicator */}
        <StepIndicator step={step} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 0 */}
          {step === 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2"><SectionTitle title="── البيانات الأساسية ──" /></div>
              <F label="الاسم الكامل" required error={errors.name?.message}>
                <Input value={form.name} onChange={e => setField('name', e.target.value)} />
              </F>
              <F label="الاسم (إنجليزي)">
                <Input value={form.name_en} onChange={e => setField('name_en', e.target.value)} dir="ltr" />
              </F>
              <F label="المسمى الوظيفي">
                <Input
                  value={form.job_title}
                  onChange={e => setField('job_title', e.target.value)}
                  placeholder="مثال: مندوب توصيل، محاسب، مشرف..."
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: '🛵 مندوب توصيل', value: 'مندوب توصيل' },
                    { label: '🚗 سائق', value: 'سائق' },
                    { label: '📊 محاسب', value: 'محاسب' },
                    { label: '🏢 مشرف', value: 'مشرف' },
                    { label: '📋 موظف إداري', value: 'موظف إداري' },
                    { label: '👔 مدير', value: 'مدير' },
                  ].map(({ label, value }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setField('job_title', value)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                        form.job_title === value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </F>
              <F label="رقم الهاتف" required error={errors.phone?.message}>
                <Input
                  value={form.phone}
                  onChange={e => setField('phone', clampEmployeePhoneInput(e.target.value))}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={EMPLOYEE_INTL_PHONE_DIGITS}
                />
              </F>
              <F label="البريد الإلكتروني">
                <Input type="email" value={form.email} onChange={e => setField('email', e.target.value)} dir="ltr" />
              </F>
              <F label="رقم الهوية الوطنية" required error={errors.national_id?.message}>
                <Input
                  value={form.national_id}
                  onChange={e => setField('national_id', clampEmployeeNationalIdInput(e.target.value))}
                  dir="ltr"
                  inputMode="numeric"
                  maxLength={EMPLOYEE_NATIONAL_ID_DIGITS}
                />
              </F>
              <F label="الجنسية">
                <Select value={form.nationality} onValueChange={v => setField('nationality', v)}>
                  <SelectTrigger><SelectValue placeholder="اختر الجنسية" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="سعودي">سعودي</SelectItem>
                    <SelectItem value="يمني">يمني</SelectItem>
                    <SelectItem value="باكستاني">باكستاني</SelectItem>
                    <SelectItem value="مصري">مصري</SelectItem>
                    <SelectItem value="سوداني">سوداني</SelectItem>
                    <SelectItem value="بنغالي">بنغالي</SelectItem>
                    <SelectItem value="هندي">هندي</SelectItem>
                    <SelectItem value="فلبيني">فلبيني</SelectItem>
                    <SelectItem value="فلسطيني">فلسطيني</SelectItem>
                    <SelectItem value="سوري">سوري</SelectItem>
                    <SelectItem value="أردني">أردني</SelectItem>
                    <SelectItem value="إثيوبي">إثيوبي</SelectItem>
                    <SelectItem value="نيبالي">نيبالي</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="السجل التجاري">
                <div className="space-y-2">
                  <Input
                    list="employee-commercial-records"
                    value={form.commercial_record}
                    onChange={e => setField('commercial_record', e.target.value)}
                    placeholder="أدخل أو اختر السجل التجاري"
                  />
                  <datalist id="employee-commercial-records">
                    {commercialRecordNames.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                  {commercialRecordNames.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {commercialRecordNames.slice(0, 8).map((name) => (
                        <button
                          key={name}
                          type="button"
                          onClick={() => setField('commercial_record', name)}
                          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
                            form.commercial_record === name
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </F>
              <F label="رقم الحساب البنكي">
                <Input value={form.bank_account_number} onChange={e => setField('bank_account_number', e.target.value)} dir="ltr" />
              </F>
              <F label="المدن">
                <div className="space-y-3">
                  <div>
                    <Select value={citySelectValue || undefined} onValueChange={upsertCity}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="اختر مدينة" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCityOptions.length > 0 ? (
                          availableCityOptions.map((city) => (
                            <SelectItem key={city} value={city}>{cityLabel(city)}</SelectItem>
                          ))
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">{"\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0643\u0644 \u0627\u0644\u0645\u062F\u0646 \u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629"}</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedCities.length === 0 && <span className="text-xs text-muted-foreground">لا توجد مدن مضافة</span>}
                    {selectedCities.map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => removeCity(city)}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
                      >
                        {cityLabel(city, city)}
                        <X size={12} />
                      </button>
                    ))}
                  </div>
                </div>
              </F>
              <F label="تاريخ الانضمام">
                <Input type="date" value={form.join_date} onChange={e => setField('join_date', normalizeArabicDigits(e.target.value))} />
              </F>
              <F label="تاريخ الميلاد">
                <Input type="date" value={form.birth_date} onChange={e => setField('birth_date', normalizeArabicDigits(e.target.value))} />
              </F>
              <F label="لغة كشف الراتب">
                <div className="flex gap-2 mt-1">
                  {([
                    { v: 'ar', flag: '🇸🇦', l: 'العربية' },
                    { v: 'en', flag: '🇬🇧', l: 'English' },
                  ] as { v: 'ar' | 'en'; flag: string; l: string }[]).map(({ v, flag, l }) => (
                    <button key={v} type="button" onClick={() => setField('preferred_language', v)}
                      className={`flex-1 py-2 px-2 rounded-lg border text-xs font-medium transition-colors flex items-center justify-center gap-1 ${form.preferred_language === v ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                      {flag} {l}
                    </button>
                  ))}
                </div>
              </F>
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="sm:col-span-2"><SectionTitle title="── الإقامة والوثائق ──" /></div>
              <div>
                <F label="تاريخ انتهاء الإقامة" required error={errors.residency_expiry?.message}>
                  <Input type="date" value={form.residency_expiry} onChange={e => setField('residency_expiry', normalizeArabicDigits(e.target.value))} />
                </F>
                {resStatus && (
                  <div className={`mt-2 flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${resStatus.valid ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {resStatus.valid ? '✅' : '🔴'}
                    <span>
                      حالة الإقامة: {resStatus.valid ? 'صالحة' : 'منتهية'} —
                      {resStatus.valid ? ` متبقي ${resStatus.days} يوم` : ` منذ ${Math.abs(resStatus.days)} يوم`}
                    </span>
                  </div>
                )}
              </div>
              <F label="تاريخ انتهاء التأمين الصحي">
                <Input type="date" value={form.health_insurance_expiry} onChange={e => setField('health_insurance_expiry', normalizeArabicDigits(e.target.value))} />
              </F>
              <F label="حالة الرخصة">
                <Select
                  value={form.license_status}
                  onValueChange={(value) => setField('license_status', value as EmployeeFormValues['license_status'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="has_license">لديه رخصة</SelectItem>
                    <SelectItem value="no_license">ليس لديه رخصة</SelectItem>
                    <SelectItem value="applied">تم التقديم عليها</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="حالة الكفالة">
                <Select
                  value={form.sponsorship_status}
                  onValueChange={(value) => setField('sponsorship_status', value as EmployeeFormValues['sponsorship_status'])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sponsored">على الكفالة</SelectItem>
                    <SelectItem value="not_sponsored">ليس على الكفالة</SelectItem>
                    <SelectItem value="absconded">هروب</SelectItem>
                    <SelectItem value="terminated">انتهاء الخدمة</SelectItem>
                  </SelectContent>
                </Select>
              </F>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <SectionTitle title="── رفع المستندات ──" />
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-foreground">تقدم رفع المستندات</span>
                  <span className="text-muted-foreground">{uploadedFilesCount}/{totalUploadSlots}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgressPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {uploadedFilesCount === totalUploadSlots
                    ? 'تم رفع كل المستندات بنجاح.'
                    : 'يمكنك رفع المستندات الآن أو لاحقاً.'}
                </p>
              </div>
              <div className="flex gap-4">
                <UploadArea
                  label="الصورة الشخصية" icon="📷"
                  file={files.personal} existingStoragePath={editEmployee?.personal_photo_url}
                  onFile={f => { setFiles(p => ({ ...p, personal: f })); setUploadState((s) => ({ ...s, personal: { status: 'selected', error: null } })); }}
                  onRemove={() => {
                    setFiles(p => ({ ...p, personal: null }));
                    setUploadState((s) => ({ ...s, personal: { status: 'idle', error: null } }));
                    if (editEmployee?.personal_photo_url) setRemovedDocs(prev => [...prev, { storagePath: editEmployee.personal_photo_url as string, field: 'personal_photo_url' }]);
                  }}
                  status={uploadState.personal.status}
                  errorText={uploadState.personal.error}
                />
                <UploadArea
                  label="صورة الهوية" icon="🪪"
                  file={files.id} existingStoragePath={editEmployee?.id_photo_url}
                  onFile={f => { setFiles(p => ({ ...p, id: f })); setUploadState((s) => ({ ...s, id: { status: 'selected', error: null } })); }}
                  onRemove={() => {
                    setFiles(p => ({ ...p, id: null }));
                    setUploadState((s) => ({ ...s, id: { status: 'idle', error: null } }));
                    if (editEmployee?.id_photo_url) setRemovedDocs(prev => [...prev, { storagePath: editEmployee.id_photo_url as string, field: 'id_photo_url' }]);
                  }}
                  status={uploadState.id.status}
                  errorText={uploadState.id.error}
                />
                <UploadArea
                  label="صورة الإقامة" icon="📄"
                  file={files.iqama} existingStoragePath={editEmployee?.iqama_photo_url}
                  onFile={f => { setFiles(p => ({ ...p, iqama: f })); setUploadState((s) => ({ ...s, iqama: { status: 'selected', error: null } })); }}
                  onRemove={() => {
                    setFiles(p => ({ ...p, iqama: null }));
                    setUploadState((s) => ({ ...s, iqama: { status: 'idle', error: null } }));
                    if (editEmployee?.iqama_photo_url) setRemovedDocs(prev => [...prev, { storagePath: editEmployee.iqama_photo_url as string, field: 'iqama_photo_url' }]);
                  }}
                  status={uploadState.iqama.status}
                  errorText={uploadState.iqama.error}
                />
                <UploadArea
                  label="صورة الرخصة" icon="🚗"
                  file={files.license} existingStoragePath={editEmployee?.license_photo_url}
                  onFile={f => { setFiles(p => ({ ...p, license: f })); setUploadState((s) => ({ ...s, license: { status: 'selected', error: null } })); }}
                  onRemove={() => {
                    setFiles(p => ({ ...p, license: null }));
                    setUploadState((s) => ({ ...s, license: { status: 'idle', error: null } }));
                    if (editEmployee?.license_photo_url) setRemovedDocs(prev => [...prev, { storagePath: editEmployee.license_photo_url as string, field: 'license_photo_url' }]);
                  }}
                  status={uploadState.license.status}
                  errorText={uploadState.license.error}
                />
              </div>
              <p className="text-xs text-muted-foreground">الملفات المقبولة: JPG, PNG, WEBP, PDF — الحجم الأقصى: 5MB لكل ملف</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0">
          <Button variant="outline" onClick={step === 0 ? onClose : back} disabled={saving}>
            {step === 0 ? 'إلغاء' : <><ChevronLeft size={15} /> السابق</>}
          </Button>
          <Button onClick={step === STEPS.length - 1 ? save : next} disabled={saving} className="gap-2">
            {footerActionContent}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AddEmployeeModal;

