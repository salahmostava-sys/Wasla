import React, { Suspense, lazy } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent } from '@shared/components/ui/dialog';
import { employeeService } from '@services/employeeService';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useLanguage } from '@app/providers/LanguageContext';
import { useTranslation } from 'react-i18next';

const EmployeeProfile = lazy(() => import('@shared/components/employees/EmployeeProfile'));

export function DashboardRiderProfileModal({
  riderId,
  onClose,
}: Readonly<{
  riderId: string | null;
  onClose: () => void;
}>) {
  const { enabled } = useAuthQueryGate();
  const { isRTL } = useLanguage();
  const { t } = useTranslation();

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', riderId],
    queryFn: () => employeeService.getById(riderId!),
    enabled: enabled && !!riderId,
    staleTime: 5 * 60 * 1000,
  });

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-40">
          <Loader2 className="animate-spin text-primary" size={40} />
        </div>
      );
    }
    if (employee) {
      return (
        <Suspense fallback={<div className="flex items-center justify-center py-40"><Loader2 className="animate-spin text-primary" size={40} /></div>}>
          <EmployeeProfile employee={employee} onBack={onClose} />
        </Suspense>
      );
    }
    return (
      <div className="flex items-center justify-center py-40 text-muted-foreground">
        {t('riderDataNotFound')}
      </div>
    );
  };

  return (
    <Dialog open={!!riderId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1200px] w-[95vw] h-[90vh] overflow-y-auto p-0 border-0 bg-transparent shadow-none [&>button]:hidden">
        <div className="bg-background w-full h-full p-4 sm:p-6 rounded-2xl overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
