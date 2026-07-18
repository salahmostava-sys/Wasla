import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@shared/components/ui/sonner';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';
import { appService } from '@services/appService';
import { getErrorMessage } from '@services/serviceError';
import { logger } from '@shared/lib/logger';
import type { WorkType } from '@shared/types/shifts';
import { appsPageService } from '@modules/apps/services/appsPageService';
import { appsRootQueryKey, appsOverviewQueryKey, appEmployeesQueryKey } from '@modules/apps/queryKeys';
import { normalizeCustomColumns, toAppUpsertPayload } from '@modules/apps/lib/appsModel';
import type { AppData, AppFormValues } from '@modules/apps/types';
import { useTranslation } from 'react-i18next';

export const useAppsPage = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { permissions } = usePermissions('apps');
  const { selectedMonth: monthYear } = useTemporalContext();
  const { enabled, userId } = useAuthQueryGate();
  const uid = authQueryUserId(userId);

  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [modalApp, setModalApp] = useState<AppData | null | undefined>(undefined);
  const [deleteApp, setDeleteApp] = useState<AppData | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');
  const [appDependencies, setAppDependencies] = useState<{
    employeeAppsCount: number;
    dailyOrdersCount: number;
    appTargetsCount: number;
    pricingRulesCount: number;
    hasAnyDependencies: boolean;
  } | null>(null);

  const appsQuery = useQuery({
    queryKey: appsOverviewQueryKey(uid, monthYear),
    enabled,
    staleTime: 30_000,
    queryFn: () => appsPageService.getAppsOverview(monthYear),
  });

  const apps = appsQuery.data;
  const selectedApp = useMemo(
    () => apps?.find((app) => app.id === selectedAppId) ?? null,
    [apps, selectedAppId],
  );

  const employeesQuery = useQuery({
    queryKey: appEmployeesQueryKey(uid, monthYear, selectedAppId ?? '__none__'),
    enabled: enabled && !!selectedAppId,
    staleTime: 30_000,
    queryFn: () => selectedAppId ? appsPageService.getAppEmployees(selectedAppId, monthYear) : Promise.resolve([]),
  });

  useQueryErrorToast(appsQuery.isError, appsQuery.error, t('platformsLoadError'), appsQuery.refetch);
  useQueryErrorToast(employeesQuery.isError, employeesQuery.error, t('platformsLoadError'), employeesQuery.refetch);

  const invalidateApps = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: appsRootQueryKey }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  };

  const saveMutation = useMutation({
    mutationFn: async ({
      app,
      values,
    }: {
      app: AppData | null | undefined;
      values: AppFormValues;
    }) => {
      const payload = toAppUpsertPayload(values);

      if (app) {
        await appService.update(app.id, payload);
        return 'edit' as const;
      }

      await appService.create(payload);
      return 'create' as const;
    },
    onSuccess: async (mode) => {
      await invalidateApps();
      toast.success(mode === 'edit' ? t('applicationUpdated') : t('applicationAdded'));
      setModalApp(undefined);
    },
    onError: (error: unknown) => {
      const fallbackMessage = t('genericTryAgainError');
      toast.error(fallbackMessage, { description: getErrorMessage(error, fallbackMessage) });
    },
  });

  const toggleMonthlyActiveMutation = useMutation({
    mutationFn: (app: AppData) =>
      appService.toggleMonthlyActive(app.id, monthYear, !app.is_active_this_month),
    onSuccess: async () => {
      await invalidateApps();
      toast.success(t('operationCompleted'));
    },
    onError: () => {
      toast.error(t('genericTryAgainError'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ app, mode }: { app: AppData; mode: 'soft' | 'hard' }) => {
      if (mode === 'hard') {
        await appService.permanentDelete(app.id);
      } else {
        await appService.delete(app.id);
      }
    },
    onSuccess: async (_, { app }) => {
      await invalidateApps();
      if (selectedAppId === app.id) {
        setSelectedAppId(null);
      }
      setDeleteApp(null);
      setDeleteMode('soft');
      setAppDependencies(null);
      toast.success(t('operationCompleted'));
    },
    onError: () => {
      toast.error(t('genericTryAgainError'));
    },
  });

  const toggleSelectApp = (app: AppData) => {
    setSelectedAppId((current) => (current === app.id ? null : app.id));
  };

  const handleDeleteClick = async (app: AppData) => {
    setDeleteApp(app);
    setDeleteMode('soft');
    // Fetch dependencies
    try {
      const deps = await appService.getAppDependencies(app.id);
      setAppDependencies(deps);
    } catch (error) {
      logger.error('Failed to fetch dependencies', error);
      setAppDependencies(null);
    }
  };

  const handleWorkTypeChange = async (app: AppData, workType: WorkType) => {
    try {
      await appService.update(app.id, {
        ...toAppUpsertPayload({
          name: app.name,
          name_en: app.name_en ?? '',
          brand_color: app.brand_color,
          text_color: app.text_color,
          is_active: app.is_active,
          custom_columns: normalizeCustomColumns(app.custom_columns),
        }),
        work_type: workType,
      });
      await queryClient.invalidateQueries({ queryKey: ['apps'] });
      toast.success(t('workTypeUpdated'));
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('workTypeUpdateError'));
      toast.error(message);
    }
  };

  return {
    permissions,
    monthYear,
    apps: apps ?? [],
    appsLoading: appsQuery.isLoading,
    appsError: appsQuery.error,
    refetchApps: appsQuery.refetch,
    selectedApp,
    appEmployees: employeesQuery.data ?? [],
    loadingEmployees: employeesQuery.isLoading || employeesQuery.isFetching,
    modalApp,
    deleteApp,
    deleteMode,
    appDependencies,
    deleting: deleteMutation.isPending,
    savingApp: saveMutation.isPending,
    openingCreateModal: () => setModalApp(null),
    openingEditModal: (app: AppData) => setModalApp(app),
    closeModal: () => setModalApp(undefined),
    setDeleteApp: handleDeleteClick,
    setDeleteMode,
    toggleSelectApp,
    saveApp: async (values: AppFormValues) => {
      try {
        await saveMutation.mutateAsync({ app: modalApp, values });
      } catch {
        // Mutation errors are handled centrally in the mutation callbacks.
      }
    },
    toggleMonthlyActive: async (app: AppData) => {
      try {
        await toggleMonthlyActiveMutation.mutateAsync(app);
      } catch {
        // Mutation errors are handled centrally in the mutation callbacks.
      }
    },
    confirmDelete: async () => {
      if (!deleteApp) return;
      try {
        await deleteMutation.mutateAsync({ app: deleteApp, mode: deleteMode });
      } catch {
        // Mutation errors are handled centrally in the mutation callbacks.
      }
    },
    closeSelectedApp: () => setSelectedAppId(null),
    handleWorkTypeChange,
  };
};
