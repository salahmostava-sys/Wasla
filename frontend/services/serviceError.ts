import { logError } from '@shared/lib/logger';
import * as Sentry from '@sentry/react';

export class ServiceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.cause = cause;
  }
}

function readErrorStringProp(obj: object, key: "message" | "error"): string | null {
  if (!(key in obj)) return null;
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" && v ? v : null;
}

function sanitizePostgresMessage(rawMessage: string): string {
  if (!rawMessage) return rawMessage;
  
  const lowerMsg = rawMessage.toLowerCase();
  
  if (lowerMsg.includes('operator does not exist')) {
    return 'تعذر معالجة البيانات بسبب عدم توافق في أنواع الحقول.';
  }
  if (lowerMsg.includes('permission denied')) {
    return 'عذراً، لا تملك الصلاحيات الكافية لتنفيذ هذه العملية.';
  }
  if (lowerMsg.includes('violates foreign key constraint') || lowerMsg.includes('foreign key constraint')) {
    return 'لا يمكن إتمام العملية لارتباط هذا السجل ببيانات أخرى في النظام.';
  }
  if (lowerMsg.includes('violates unique constraint') || lowerMsg.includes('duplicate key')) {
    return 'هذا السجل موجود مسبقاً.';
  }
  if (lowerMsg.includes('timeout') || lowerMsg.includes('statement timeout')) {
    return 'انتهى وقت الاتصال بالخادم، يرجى المحاولة لاحقاً.';
  }
  
  return rawMessage;
}

function resolveEdgeFunctionMessage(rawMessage: string, errorObj: object): string {
  if (!rawMessage.includes("Edge Function returned a non-2xx status code")) {
    return rawMessage;
  }
  const ctx = "context" in errorObj ? (errorObj as { context?: unknown }).context : undefined;
  if (!ctx || typeof ctx !== "object") return rawMessage;
  const fromErr = readErrorStringProp(ctx, "error");
  if (fromErr) return fromErr;
  const fromMsg = readErrorStringProp(ctx, "message");
  return fromMsg ?? rawMessage;
}

/** Wraps Supabase or unknown errors as {@link ServiceError} for consistent service-layer throws. */
export function toServiceError(error: unknown, context?: string): ServiceError {
  if (error instanceof ServiceError) return error;
  if (error) {
    logError('[serviceError] toServiceError', error);
    Sentry.captureException(error, { extra: { context } });
  }
  let message: string;
  const raw =
    error && typeof error === "object"
      ? readErrorStringProp(error, "message")
      : null;
  if (raw) {
    message = resolveEdgeFunctionMessage(raw, error as object);
    message = sanitizePostgresMessage(message);
  } else if (context) {
    message = `Service failure: ${context}`;
  } else {
    message = "Service failure";
  }
  return new ServiceError(message, error);
}

export const throwIfError = (error: unknown, context: string): void => {
  if (!error) return;
  throw toServiceError(error, context);
};

/**
 * Central handler for Supabase client `error` (and other service-layer failures).
 * Use after `const { data, error } = await ...` (or `res.error`):
 * `if (error) handleSupabaseError(error, 'serviceName.action')`
 */
export function handleSupabaseError(error: unknown, context: string): never {
  throw toServiceError(error, context);
}

/**
 * Converts unknown runtime errors to user-facing message safely.
 * Use in UI catch blocks to avoid repetitive instanceof checks.
 */
export function getErrorMessage(error: unknown, fallback = 'حدث خطأ غير متوقع'): string {
  if (error instanceof ServiceError && error.message) return error.message;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}
