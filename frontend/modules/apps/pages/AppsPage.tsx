import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
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

const AppsPage = () => {
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
      <div className="space-y-4" dir="rtl">
        <AppsPageHeader canEdit={permissions.can_edit} onAdd={openingCreateModal} />
        <QueryErrorRetry
          error={appsError}
          onRetry={() => refetchApps()}
          title="تعذر تحميل المنصات"
        />
      </div>
    );
  }

  const pageTitle = (() => {
    const date = new Date(`${monthYear}-01`);
    const monthName = format(date, 'MMMM yyyy', { locale: ar });
    return `منصات شهر ${monthName}`;
  })();

  return (
    <div className="space-y-4" dir="rtl">
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
              <h3 className="text-lg font-medium">لا توجد منصات</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {permissions.can_edit
                  ? 'أضف منصة جديدة للبدء'
                  : 'لا توجد منصات متاحة حالياً'}
              </p>
            </CardContent>
          </Card>
        )}
        {!appsLoading && apps.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {apps.map((app) => {
              const isAppSelected = selectedApp?.id === app.id;
              return (
                <AppCard
                  key={app.id}
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
              );
            })}

            {permissions.can_edit && <AddAppCard onClick={openingCreateModal} />}
          </div>
        )}

        {selectedApp && (
          <AppEmployeesPanel
            app={selectedApp}
            monthYear={monthYear}
            employees={appEmployees}
            loading={loadingEmployees}
            onClose={closeSelectedApp}
          />
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
        <AlertDialogContent dir="rtl" className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة المنصة — {deleteApp?.name}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>اختر طريقة الإزالة:</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1">
                  <p className="font-semibold text-sm">📦 أرشفة</p>
                  <p className="text-xs text-muted-foreground">تختفي من الأشهر القادمة لكن تبقى في التقارير التاريخية</p>
                </div>
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                  <p className="font-semibold text-sm">🗑️ حذف نهائي</p>
                  <p className="text-xs text-muted-foreground">تُحذف بالكامل مع كل البيانات المرتبطة — لا يمكن التراجع</p>
                </div>
              </div>

              {appDependencies?.hasAnyDependencies && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground">البيانات المرتبطة:</p>
                  <ul className="text-xs text-muted-foreground space-y-0.5 ms-3">
                    {appDependencies.employeeAppsCount > 0 && <li>• {appDependencies.employeeAppsCount} موظف</li>}
                    {appDependencies.dailyOrdersCount > 0 && <li>• {appDependencies.dailyOrdersCount} سجل طلبات</li>}
                    {appDependencies.appTargetsCount > 0 && <li>• {appDependencies.appTargetsCount} هدف شهري</li>}
                    {appDependencies.pricingRulesCount > 0 && <li>• {appDependencies.pricingRulesCount} قاعدة تسعير</li>}
                  </ul>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 flex-col sm:flex-row">
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setDeleteMode('soft'); confirmDelete(); }}
              disabled={deleting}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {deleting && deleteMode === 'soft' ? 'جاري الأرشفة...' : '📦 أرشفة'}
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => { setDeleteMode('hard'); confirmDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && deleteMode === 'hard' ? 'جاري الحذف...' : '🗑️ حذف نهائي'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AppsPage;
