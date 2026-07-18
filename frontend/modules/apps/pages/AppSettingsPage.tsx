import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, AlertCircle, Package } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent } from '@shared/components/ui/card';
import { useAuthQueryGate, authQueryUserId } from '@shared/hooks/useAuthQueryGate';
import { usePermissions } from '@shared/hooks/usePermissions';
import { appService } from '@services/appService';
import { AppWorkTypeSettings } from '@modules/settings/components/AppWorkTypeSettings';
import type { WorkType } from '@shared/types/shifts';
import { toast } from '@shared/components/ui/sonner';
import { getErrorMessage } from '@services/serviceError';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

export function AppSettingsPage() {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);
  const queryClient = useQueryClient();
  const { permissions: { can_edit } = {} } = usePermissions('apps');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [workTypeUpdating, setWorkTypeUpdating] = useState(false);

  const { data: apps = [], isLoading, error } = useQuery({
    queryKey: ['apps', 'all', uid],
    queryFn: () => appService.getAll(),
    enabled,
  });

  const selectedApp = apps.find((a) => a.id === selectedAppId);

  const handleWorkTypeChange = async (workType: WorkType) => {
    if (!selectedApp || workTypeUpdating) return;
    if (!can_edit) {
      toast.error(t('editPermissionDenied'));
      return;
    }

    setWorkTypeUpdating(true);
    try {
      await appService.update(selectedApp.id, {
        ...selectedApp,
        work_type: workType,
      });
      await queryClient.invalidateQueries({ queryKey: ['apps'] });
      toast.success(t('workTypeUpdated'));
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('workTypeUpdateError'));
      toast.error(message);
    } finally {
      setWorkTypeUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin size-8 text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h2 className="text-2xl font-bold">{t('platformSettings')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('platformSettingsDescription')}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle size={48} className="text-destructive mb-4" />
            <h3 className="text-lg font-medium">{t('dataLoadError')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {getErrorMessage(error, t('platformsGenericLoadError'))}
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['apps', 'all', uid] })}
            >
              {t('retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h2 className="text-2xl font-bold">{t('platformSettings')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('platformSettingsDescription')}
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package size={48} className="text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">{t('noPlatforms')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('addPlatformsFromManagement')}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedApp) {
    return (
      <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <nav className="page-breadcrumb"><span>{t('home')}</span><span className="page-breadcrumb-sep">/</span><span>{t('platformSettings')}</span></nav>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedAppId(null)}
          className="gap-2"
        >
          {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          {t('backToList')}
        </Button>
        <AppWorkTypeSettings
          appId={selectedApp.id}
          appName={selectedApp.name}
          currentWorkType={(selectedApp.work_type || 'orders') as WorkType}
          onWorkTypeChange={handleWorkTypeChange}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <nav className="page-breadcrumb"><span>{t('home')}</span><span className="page-breadcrumb-sep">/</span><span>{t('platformSettings')}</span></nav>
      <div>
        <h2 className="text-2xl font-bold">{t('platformSettings')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('platformSettingsDescription')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <button type="button"
            key={app.id}
            onClick={() => setSelectedAppId(app.id)}
            className="flex items-center gap-4 rounded-lg border p-4 text-start transition-colors hover:bg-muted/50"
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold"
              style={{ backgroundColor: app.brand_color, color: app.text_color }}
            >
              {app.name.charAt(0)}
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{app.name}</h3>
              <p className="text-xs text-muted-foreground">
                {app.work_type === 'orders' && `📦 ${t('workTypeOrders')}`}
                {app.work_type === 'shift' && `⏰ ${t('workTypeShift')}`}
                {app.work_type === 'hybrid' && `🔄 ${t('workTypeHybrid')}`}
                {!app.work_type && `📦 ${t('workTypeOrdersDefault')}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
