import { useQuery } from '@tanstack/react-query';
import { logError } from '@shared/lib/logger';
import { storageService } from '@services/storageService';

export const extractStoragePath = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (!value.startsWith('http')) return value;
  const marker = '/storage/v1/object/public/';
  const index = value.indexOf(marker);
  if (index === -1) return null;
  const rest = value.slice(index + marker.length);
  const firstSlash = rest.indexOf('/');
  if (firstSlash === -1) return null;
  return rest.slice(firstSlash + 1);
};

export const useSignedUrl = (bucket: string, path: string | null | undefined) => {
  const query = useQuery({
    queryKey: ['storage', 'signed-url', bucket, path ?? '__none__'] as const,
    enabled: Boolean(path),
    staleTime: 4 * 60_000,
    gcTime: 10 * 60_000,
    retry: false,
    queryFn: async () => {
      if (!path) {
        logError('[useSignedUrl] missing path', new Error('path is null or undefined'), { meta: { bucket, path } });
        throw new Error('Path is required to create signed URL');
      }
      try {
        return await storageService.createSignedUrl(bucket, path, 300);
      } catch (error) {
        logError('[useSignedUrl] createSignedUrl failed', error, { meta: { bucket, path } });
        throw error;
      }
    },
  });

  if (query.error) {
    throw query.error;
  }

  return query.data ?? null;
};
