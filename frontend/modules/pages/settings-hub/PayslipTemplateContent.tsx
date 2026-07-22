import type React from 'react';
import { FileText, Info } from 'lucide-react';
import { useLanguage } from '@app/providers/LanguageContext';
import { usePermissions } from '@shared/hooks/usePermissions';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SalarySlipTemplateEditor } from '@modules/salaries/components/SalarySlipTemplateEditor';

const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) => (
  <div className="flex items-center gap-3 pb-4 mb-5" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(31,84,173,0.08)', color: '#1f54ad' }}
    >
      {icon}
    </div>
    <div>
      <h2 className="text-base font-bold" style={{ color: 'var(--ds-on-surface)' }}>{title}</h2>
      <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>{subtitle}</p>
    </div>
  </div>
);

export default function PayslipTemplateContent() {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  const { permissions, loading } = usePermissions('salaries');

  if (loading) return null;

  if (!permissions.can_view) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <ShieldAlert size={40} className="text-destructive" />
        <p className="text-lg font-semibold">{t('accessDenied')}</p>
      </div>
    );
  }

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <SectionHeader
        icon={<FileText size={20} />}
        title={isRTL ? 'تخصيص كشف الراتب' : 'Payslip Template'}
        subtitle={isRTL ? 'صمّم قوالب كشوف الرواتب واختر أعمدتها' : 'Design payslip templates and choose their columns'}
      />

      <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-muted-foreground mb-4">
        <Info size={15} className="mt-0.5 flex-shrink-0 text-primary" />
        <span>
          {isRTL
            ? 'ترويسة الشركة الرسمية (الاسم، الرقم الموحّد، السجل، الضريبة) والعنوان في الفوتر تُضاف تلقائيًا من «بيانات المنشأة». حقول HTML هنا اختيارية لأي إضافات فوق الترويسة الرسمية.'
            : 'The official company header (name, unified number, CR, VAT) and footer address are added automatically from Organization Info. The HTML fields here are optional extras above the official header.'}
        </span>
      </div>

      <SalarySlipTemplateEditor />
    </div>
  );
}
