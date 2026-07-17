import { User } from 'lucide-react';
import ProfileSettingsContent from '@modules/pages/settings-hub/ProfileSettingsContent';
import { useLanguage } from '@app/providers/LanguageContext';
import { useTranslation } from 'react-i18next';

/** صفحة مستقلة: أي مستخدم مسجّل (له دور) يصل إليها دون صلاحية «الإعدادات». */
const ProfilePage = () => {
  const { isRTL } = useLanguage();
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 animate-fade-in" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex-shrink-0">
        <nav className="page-breadcrumb">
          <span>{t('home')}</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>{t('profile')}</span>
        </nav>
        <h1 className="page-title flex items-center gap-2">
          <User size={20} /> {t('profile')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('profileDescription')}
        </p>
      </div>
      <ProfileSettingsContent omitPageHeading />
    </div>
  );
};

export default ProfilePage;
