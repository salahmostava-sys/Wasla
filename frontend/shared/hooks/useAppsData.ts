import { appService } from '@services/appService';
import { useAuthedQuery } from '@shared/hooks/useAuthedQuery';

const appsDataQueryKey = (userId: string) => ['apps', userId, 'list-with-counts'] as const;

type AppWithCount = {
  id: string;
  name: string;
  name_en: string | null;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  employeeCount: number;
  custom_columns: unknown[];
};

export const useAppsData = () => {
  return useAuthedQuery({
    buildQueryKey: appsDataQueryKey,
    queryFn: async () => {
      const data = await appService.getAll();
      if (!data.length) return [] as AppWithCount[];

      const appsWithCounts = await Promise.all(
        data.map(async (app) => {
          const count = await appService.countActiveEmployeeApps(app.id);
          return {
            id: app.id,
            name: app.name,
            name_en: app.name_en,
            brand_color: app.brand_color || '#6366f1',
            text_color: app.text_color || '#ffffff',
            is_active: app.is_active,
            employeeCount: count,
            custom_columns: (app.custom_columns as unknown[]) || [],
          };
        })
      );

      return appsWithCounts;
    },
    // Static-ish domain policy: cached aggressively
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
};
