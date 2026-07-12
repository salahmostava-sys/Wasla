import { orderService } from '@services/orderService';
import { useAuthedQuery } from '@shared/hooks/useAuthedQuery';

const ordersQueryKey = (userId: string) => ['orders', userId] as const;

export const useOrders = () => {
  return useAuthedQuery({
    buildQueryKey: ordersQueryKey,
    queryFn: async () => {
      const rows = await orderService.getAll();
      return rows || [];
    },
    staleTime: 30_000,
  });
};
