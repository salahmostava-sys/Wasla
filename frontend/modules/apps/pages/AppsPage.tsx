import React from 'react';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Package } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@shared/components/ui/alert-dialog';
import { PageSection } from '@shared/components/layout/PageScaffold';
import { Card, CardContent } from '@shared/components/ui/card';
import { AppCard, AddAppCard } from '@modules/apps/components/AppCard';
import { AppEmployeesPanel } from '@modules/apps/components/AppEmployeesPanel';
import { AppModal } from '@modules/apps/components/AppModal';
import { AppsPageHeader } from '@modules/apps/components/AppsPageHeader';
import { useAppsPage } from '@modules/apps/hooks/useAppsPage';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';
import { Skeleton } from '@shared/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

const AppsPage = () => {
  const { t } = useTranslation();
  const { isRTL, lang } = useLanguage();
  const {
    permissions,
    monthYear,
    apps,
    appsLoading,
    appsError,
    refetchApps,
    selectedApp,
    appEmployees,
    loadingEmployees,
    modalApp,
    deleteApp,
    deleteMode,
    appDependencies,
    deleting,
    savingApp,
    openingCreateModal,
    openingEditModal,
    closeModal,
    setDeleteApp,
    setDeleteMode,
    toggleSelectApp,
    saveApp,
    toggleMonthlyActive,
    confirmDelete,
    closeSelectedApp,
    handleWorkTypeChange,
  } = useAppsPage();

  if (appsError && !appsLoading) {
    return (
      <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
        <AppsPageHeader canEdit={permissions.can_edit} onAdd={openingCreateModal} />
        <QueryErrorRetry
          error={appsError}
          onRetry={() => refetchApps()}
          title={t('platformsLoadError')}
        />
      </div>
    );
  }

  const pageTitle = (() => {
    const date = new Date(`${monthYear}-01`);
    const monthName = format(date, 'MMMM yyyy', { locale: lang === 'ar' ? ar : enUS });
    return t('platformsForMonth', { month: monthName });
  })();

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <AppsPageHeader canEdit={permissions.can_edit} onAdd={openingCreateModal} />

      <PageSection title={pageTitle}>
        {appsLoading && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item}  className="h-40 rounded-2xl bg-muted/40" />
            ))}
          </div>
        )}
        {!appsLoading && apps.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package size={48} className="text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">{t('noPlatforms')}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {permissions.can_edit
                  ? t('addPlatformToStart')
                  : t('noPlatformsAvailable')}
              </p>
            </CardContent>
          </Card>
        )}
        {!appsLoading && apps.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {apps.map((app) => {
              const isAppSelected = selectedApp?.id === app.id;
              return (
                <React.Fragment key={app.id}>
                  <AppCard
                    app={app}
                    selected={isAppSelected}
                    canEdit={permissions.can_edit}
                    onSelect={toggleSelectApp}
                    onEdit={openingEditModal}
                    onToggleActive={(item, event) => {
                      event.stopPropagation();
                      toggleMonthlyActive(item);
                    }}
                    onDelete={(item, event) => {
                      event.stopPropagation();
                      setDeleteApp(item);
                    }}
                    onWorkTypeChange={handleWorkTypeChange}
                  />
                  {isAppSelected && (
                    <div className="col-span-2 md:col-span-3 lg:col-span-5 w-full mt-2 mb-4">
                      <AppEmployeesPanel
                        app={selectedApp}
                        monthYear={monthYear}
                        employees={appEmployees}
                        loading={loadingEmployees}
                        onClose={closeSelectedApp}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {permissions.can_edit && <AddAppCard onClick={openingCreateModal} />}
          </div>
        )}
      </PageSection>

      {modalApp !== undefined && (
        <AppModal
          app={modalApp}
          saving={savingApp}
          onClose={closeModal}
          onSave={saveApp}
        />
      )}

      <AlertDialog open={!!deleteApp} onOpenChange={(open) => { if (!open) { setDeleteApp(null); setDeleteMode('soft'); } }}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'} className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removePlatformTitle', { name: deleteApp?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>{t('chooseRemovalMethod')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1">
                  <p className="font-semibold text-sm">📦 {t('archive')}</p>
                  <p className="text-xs text-muted-foreground">{t('archivePlatformDescription')}</p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="font-semibold text-sm">🗑️ {t('deletePermanently')}</p>
                  <p className="text-xs text-muted-foreground">{t('deletePlatformPermanentlyDescription')}</p>
                </div>
              </div>

              {appDependencies?.hasAnyDependencies && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground">{t('relatedData')}</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 ms-3">
                    {appDependencies.employeeAppsCount > 0 && <li>• {t('relatedEmployeesCount', { count: appDependencies.employeeAppsCount })}</li>}
                    {appDependencies.dailyOrdersCount > 0 && <li>• {t('relatedOrderRecordsCount', { count: appDependencies.dailyOrdersCount })}</li>}
                    {appDependencies.appTargetsCount > 0 && <li>• {t('relatedMonthlyTargetsCount', { count: appDependencies.appTargetsCount })}</li>}
                    {appDependencies.pricingRulesCount > 0 && <li>• {t('relatedPricingRulesCount', { count: appDependencies.pricingRulesCount })}</li>}
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
            <AlertDialogCancel disabled={deleting}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setDeleteMode('soft'); confirmDelete(); }}
              disabled={deleting}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {deleting && deleteMode === 'soft' ? t('archiving') : `📦 ${t('archive')}`}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => { setDeleteMode('hard'); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && deleteMode === 'hard' ? t('deleting') : `🗑️ ${t('deletePermanently')}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AppsPage;
