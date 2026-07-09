import { getVehicleReport } from '@services/vehicleReportService';
import { useAuthedQuery } from '@shared/hooks/useAuthedQuery';

export const motorcyclesDataQueryKey = (userId: string) => ['motorcycles', userId, 'list'] as const;

export const useMotorcyclesData = () => {
  return useAuthedQuery({
    buildQueryKey: motorcyclesDataQueryKey,
    queryFn: () => getVehicleReport(),
    staleTime: 60_000,
  });
};
