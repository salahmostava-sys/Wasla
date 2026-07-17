import { Loader2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

/** حالة التحميل الأولية لصفحة أثناء انتظار المصادقة والصلاحيات. */
export function PageLoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );
}

/** رسالة "غير مصرح بالوصول" لصفحة لا يملك المستخدم صلاحية عرضها. */
export function PageAccessDeniedState({
  message,
  dir,
}: Readonly<{ message: string; dir?: 'rtl' | 'ltr' }>) {
  const { t } = useTranslation();
  const { lang } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center" dir={dir}>
      <ShieldAlert size={40} className="text-destructive" />
      <p className="text-lg font-semibold">{t('accessDenied')}</p>
      <p className="text-sm text-muted-foreground">
        {lang === 'ar' && message ? message : t('accessDeniedDefault')}
      </p>
    </div>
  );
}
