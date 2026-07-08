import { useQuery, type QueryKey, type UseQueryResult } from '@tanstack/react-query';
import { useAuth } from '@app/providers/AuthContext';
import { authQueryUserId, useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { useQueryErrorToast } from '@shared/hooks/useQueryErrorToast';

type UseAuthedQueryParams<TData, TQueryKey extends QueryKey> = {
  buildQueryKey: (uid: string) => TQueryKey;
  queryFn: () => Promise<TData>;
  errorTitle?: string;
  notifyOnError?: boolean;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  requireUser?: boolean;
  refetchOnWindowFocus?: boolean | 'always';
  refetchOnReconnect?: boolean | 'always';
};

export function useAuthedQuery<TData, TQueryKey extends QueryKey = QueryKey>({
  buildQueryKey,
  queryFn,
  errorTitle,
  notifyOnError = true,
  staleTime,
  gcTime,
  enabled = true,
  requireUser = true,
  refetchOnWindowFocus,
  refetchOnReconnect,
}: UseAuthedQueryParams<TData, TQueryKey>): UseQueryResult<TData> {
  const { user, session } = useAuth();
  const { userId, authReady } = useAuthQueryGate();
  const uid = authQueryUserId(user?.id ?? userId);

  const query = useQuery<TData, Error, TData, TQueryKey>({
    queryKey: buildQueryKey(uid),
    queryFn,
    staleTime,
    gcTime,
    enabled: !!session && authReady && (!requireUser || !!user?.id) && enabled,
    refetchOnWindowFocus,
    refetchOnReconnect,
    structuralSharing: false,
  });

  useQueryErrorToast(
    notifyOnError && query.isError,
    notifyOnError ? query.error : null,
    errorTitle,
    notifyOnError ? query.refetch : undefined,
  );
  return query;
}
