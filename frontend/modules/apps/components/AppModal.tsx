import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Columns, PlusCircle, Trash2, X } from 'lucide-react';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { toast } from '@shared/components/ui/sonner';
import { toAppFormValues } from '@modules/apps/lib/appsModel';
import type { AppData, AppFormValues, CustomColumn } from '@modules/apps/types';
import { getContrastText } from '@shared/hooks/useAppColors';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

interface AppModalProps {
  app?: AppData | null;
  saving: boolean;
  onClose: () => void;
  onSave: (values: AppFormValues) => Promise<void>;
}

export const AppModal = ({ app, saving, onClose, onSave }: Readonly<AppModalProps>) => {
  const isEdit = Boolean(app);
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const [form, setForm] = useState<AppFormValues>(() => toAppFormValues(app));
  const [newColumnLabel, setNewColumnLabel] = useState('');

  const addColumn = () => {
    const label = newColumnLabel.trim();
    if (!label) return;

    const nextColumn: CustomColumn = {
      key: `col_${Date.now()}`,
      label,
    };

    setForm((current) => ({
      ...current,
      custom_columns: [...current.custom_columns, nextColumn],
    }));
    setNewColumnLabel('');
  };

  const removeColumn = (key: string) => {
    setForm((current) => ({
      ...current,
      custom_columns: current.custom_columns.filter((column) => column.key !== key),
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(t('genericTryAgainError'), { description: t('nameRequired') });
      return;
    }

    await onSave(form);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto -2xl border border-border/50 bg-card shadow-2xl rounded-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4 rounded-2xl">
          <h2 className="text-lg font-bold text-foreground">
            {isEdit ? t('editApplication') : t('addApplication')}
          </h2>
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div>
            <Label className="mb-1.5 block text-sm">
              {t('applicationNameArabic')} <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              placeholder={t('applicationArabicPlaceholder')}
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-sm">{t('applicationNameEnglish')}</Label>
            <Input
              value={form.name_en}
              onChange={(event) => setForm((current) => ({ ...current, name_en: event.target.value }))}
              placeholder="e.g. HungerStation"
              dir="ltr"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="mb-1.5 block text-sm">{t('applicationBrandColor')}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.brand_color}
                  onChange={(event) => {
                    const newColor = event.target.value;
                    setForm((current) => ({
                      ...current,
                      brand_color: newColor,
                      text_color: getContrastText(newColor)
                    }));
                  }}
                  className="h-8 w-14 cursor-pointer rounded border border-border"
                />
                <Input
                  value={form.brand_color}
                  onChange={(event) => setForm((current) => ({ ...current, brand_color: event.target.value }))}
                  className="flex-1 font-mono text-sm"
                  dir="ltr"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block text-sm">{t('applicationTextColor')}</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.text_color}
                  onChange={(event) => setForm((current) => ({ ...current, text_color: event.target.value }))}
                  className="h-10 w-10 cursor-pointer rounded-lg border border-border"
                />
                <Input
                  value={form.text_color}
                  onChange={(event) => setForm((current) => ({ ...current, text_color: event.target.value }))}
                  className="flex-1 font-mono text-sm"
                  dir="ltr"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-sm">{t('preview')}</Label>
            <div
              className="rounded-xl px-5 py-3 text-center text-base font-bold"
              style={{ backgroundColor: form.brand_color, color: form.text_color }}
            >
              {form.name || t('applicationNamePreview')}
            </div>
          </div>

          <div className="mt-2 border-t border-border pt-4">
            <Label className="mb-2 flex items-center gap-2 text-sm">
              <Columns size={14} />
              {t('customDeductionColumns')}
            </Label>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {t('customDeductionColumnsDescription')}
            </p>

            <div className="mb-3 space-y-2">
              {form.custom_columns.map((column) => (
                <div
                  key={column.key}
                  className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
                >
                  <span className="flex-1 text-sm">{column.label}</span>
                  <button
                    onClick={() => removeColumn(column.key)}
                    className="rounded-md p-1.5 text-destructive transition-colors hover:bg-destructive/10"
                    title={t('delete')}
                    type="button"
                  >
                    <Trash2 size={14} className="text-destructive" />
                  </button>
                </div>
              ))}

              {form.custom_columns.length === 0 && (
                <p className="text-[11px] italic text-muted-foreground/60">{t('noCustomColumns')}</p>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={newColumnLabel}
                onChange={(event) => setNewColumnLabel(event.target.value)}
                placeholder={t('columnName')}
                className="flex-1 text-sm"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addColumn();
                  }
                }}
              />
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={addColumn}
                disabled={!newColumnLabel.trim()}
                className="gap-1"
              >
                <PlusCircle size={14} />
                {t('add')}
              </Button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-card px-6 py-4 rounded-2xl">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? t('saving') : <><Check size={15} /> {isEdit ? t('saveChanges') : t('addApplicationAction')}</>}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
