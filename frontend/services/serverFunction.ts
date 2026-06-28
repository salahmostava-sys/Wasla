/**
 * callServerFunction — استدعاء نقاط الـ API الداخلية (/api/functions/*)
 *
 * يُستبدل هذا `supabase.functions.invoke()` الذي يستدعي Supabase Edge Functions
 * السحابية (غير موجودة). بدلاً من ذلك، يُرسل الطلب لخادم Express المحلي
 * عبر Vite proxy على `/api/functions/*`.
 *
 * @param functionName  اسم الدالة مثل 'salary-engine'
 * @param body          payload الطلب
 * @returns             البيانات أو رمي ServiceError عند الفشل
 */
import { supabase } from '@services/supabase/client';
import { logError } from '@shared/lib/logger';

export async function callServerFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  // جلب الـ token من الجلسة الحالية
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error('Not authenticated: no access token available');
  }

  const response = await fetch(`/api/functions/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorMessage = `Server function '${functionName}' failed with status ${response.status}`;
    try {
      const errBody = await response.json();
      if (errBody?.error) errorMessage = errBody.error;
    } catch {
      // لو الـ response مش JSON، نستخدم الرسالة الافتراضية
    }
    logError(`[callServerFunction] ${errorMessage}`, { functionName, status: response.status });
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}
