import { useMemo } from 'react';
import { appService } from '@services/appService';
import { useAuthedQuery } from '@shared/hooks/useAuthedQuery';

export interface CustomColumn {
  key: string;
  label: string;
  /** 'deduction' (default) or 'earning' — determines where it appears in salary slip */
  column_type?: 'deduction' | 'earning';
}

export interface AppColorData {
  id: string;
  name: string;
  brand_color: string;
  text_color: string;
  is_active: boolean;
  custom_columns?: CustomColumn[];
}

const FALLBACK_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#dc2626'];

const appColorsQueryKey = (userId: string) => ['apps', userId, 'colors'] as const;

// Re-use the canonical parser from appsModel to avoid duplication
import { normalizeCustomColumns } from '@modules/apps/lib/appsModel';

/** Auto-detect readable text color (black or white) based on background brightness */
export function getContrastText(hexColor: string): string {
  const hex = hexColor.replaceAll('#', '');
  const r = Number.parseInt(hex.substring(0, 2), 16) || 0;
  const g = Number.parseInt(hex.substring(2, 4), 16) || 0;
  const b = Number.parseInt(hex.substring(4, 6), 16) || 0;
  // Perceived brightness formula
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#000000' : '#ffffff';
}

export const getAppColor = (apps: AppColorData[], appName: string) => {
  const idx = Math.max(0, apps.findIndex((app) => app.name === appName));
  const app = apps.find((item) => item.name === appName);
  const brand = app?.brand_color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  // Use stored text_color if available, fall back to auto-contrast detection
  const text = app?.text_color || getContrastText(brand);
  return {
    bg: `${brand}22`,
    cellBg: `${brand}15`,
    text: brand,
    val: brand,
    solid: brand,
    solidText: text,
  };
};

export const useAppColors = () => {
  const query = useAuthedQuery({
    buildQueryKey: appColorsQueryKey,
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    requireUser: false,
    notifyOnError: false,
    queryFn: async (): Promise<AppColorData[]> => {
      const apps = await appService.getAll();
      return apps.map((app, index) => {
        const brand = app.brand_color || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
        return {
          id: app.id,
          name: app.name,
          brand_color: brand,
          // Use stored text_color if set; auto-detect contrast only as fallback
          text_color: app.text_color || getContrastText(brand),
          is_active: app.is_active ?? true,
          custom_columns: normalizeCustomColumns(app.custom_columns),
        };
      });
    },
  });

  const apps = query.data;
  const activeApps = useMemo(() => (apps ?? []).filter((app) => app.is_active), [apps]);
  return { apps: apps ?? [], activeApps, loading: query.isLoading };
};

