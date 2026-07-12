import { supabase } from '@services/supabase/client';
import { toServiceError } from '@services/serviceError';
import { buildVerifiedAvatarObjectKey, parseVerifiedAvatarObjectKey } from '@shared/lib/storagePath';
import { validateUploadFile } from '@shared/lib/validation';

const INVALID_AVATAR_OBJECT_KEY = 'INVALID_AVATAR_OBJECT_KEY';

const ALLOWED_AVATAR_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);

/** امتداد آمن فقط — لا يُؤخذ من اسم الملف دون تحقق (تخفيف path traversal). */
function safeAvatarExtension(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ALLOWED_AVATAR_EXT.has(fromName)) {
    return fromName === 'jpeg' ? 'jpg' : fromName;
  }
  const t = file.type.toLowerCase();
  if (t === 'image/jpeg' || t === 'image/jpg') return 'jpg';
  if (t === 'image/png') return 'png';
  if (t === 'image/gif') return 'gif';
  if (t === 'image/webp') return 'webp';
  return 'jpg';
}

/**
 * Uploads to `avatars` using a key produced only by {@link buildVerifiedAvatarObjectKey}
 * (UUID folder + fixed basename). Keeps Supabase SDK `.upload` usage in one module for SAST clarity.
 */
function assertSegmentSafeForStoragePath(segment: string): void {
  if (!segment || segment.includes('..') || /[/\\]/.test(segment) || segment.includes('://')) {
    throw new Error(INVALID_AVATAR_OBJECT_KEY);
  }
}

export function uploadAvatarToAvatarsBucket(
  userId: string,
  file: File,
  extension: string,
) {
  assertSegmentSafeForStoragePath(userId);
  assertSegmentSafeForStoragePath(extension);
  const objectKey = buildVerifiedAvatarObjectKey(userId, extension);
  if (!objectKey) {
    throw new Error(INVALID_AVATAR_OBJECT_KEY);
  }
  const canonicalKey = parseVerifiedAvatarObjectKey(objectKey);
  if (!canonicalKey) {
    throw new Error(INVALID_AVATAR_OBJECT_KEY);
  }
  return supabase.storage.from('avatars').upload(canonicalKey, file, { upsert: true });
}

/** Validates the file, then uploads using a verified object key only (see {@link uploadAvatarToAvatarsBucket}). */
export async function uploadProfileAvatar(userId: string, file: File) {
  const validation = validateUploadFile(file, {
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });
  if (!validation.valid) {
    throw toServiceError(
      new Error('error' in validation ? validation.error : 'Invalid file'),
      'profileService.uploadAvatar.validation',
    );
  }
  const ext = safeAvatarExtension(file);
  const result = await uploadAvatarToAvatarsBucket(userId, file, ext).catch((e: unknown) => {
    if (e instanceof Error && e.message === INVALID_AVATAR_OBJECT_KEY) {
      throw toServiceError(new Error('مسار التخزين غير صالح'), 'profileService.uploadAvatar.path');
    }
    throw e;
  });
  if (result.error) throw toServiceError(result.error, 'profileService.uploadAvatar');
  if (!result.data) throw toServiceError(new Error('Upload returned no data'), 'profileService.uploadAvatar');
  return result.data;
}

/** Public URL for an object key that matches {@link buildVerifiedAvatarObjectKey} shape only. */
export function getAvatarPublicUrlFromBucket(path: string): string | null {
  const safe = parseVerifiedAvatarObjectKey(path);
  if (!safe) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(safe);
  return data.publicUrl;
}

/** Same as {@link getAvatarPublicUrlFromBucket} but throws {@link toServiceError} when the key is invalid. */
export function getAvatarPublicUrlOrThrow(path: string): string {
  const url = getAvatarPublicUrlFromBucket(path);
  if (!url) {
    throw toServiceError(new Error('مسار التخزين غير صالح'), 'profileService.getAvatarPublicUrl');
  }
  return url;
}
