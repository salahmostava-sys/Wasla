import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { useTranslation } from 'react-i18next';

type ConnectionState = 'online' | 'offline' | 'reconnected';

/**
 * OfflineIndicator — شريط تحذيري يظهر أعلى الصفحة عند انقطاع الإنترنت
 * مع حركة انزلاق ناعمة ورسالة عند عودة الاتصال.
 */
export function OfflineIndicator() {
  const { t } = useTranslation();
  const [state, setState] = useState<ConnectionState>(
    navigator.onLine ? 'online' : 'offline',
  );
  const wasOfflineRef = useRef(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const goOffline = () => {
      wasOfflineRef.current = true;
      setState('offline');
      clearTimeout(dismissTimerRef.current);
    };

    const goOnline = () => {
      if (wasOfflineRef.current) {
        setState('reconnected');
        wasOfflineRef.current = false;
        // إخفاء رسالة الاتصال بعد 3 ثواني
        dismissTimerRef.current = setTimeout(() => setState('online'), 3000);
      }
    };

    globalThis.addEventListener('offline', goOffline);
    globalThis.addEventListener('online', goOnline);

    return () => {
      globalThis.removeEventListener('offline', goOffline);
      globalThis.removeEventListener('online', goOnline);
      clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const handleRetry = () => {
    // محاولة إعادة الاتصال عن طريق إعادة تحميل الصفحة
    globalThis.location.reload();
  };

  if (state === 'online') return null;

  const isOffline = state === 'offline';

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'offline-banner fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold shadow-card transition-all duration-500 ease-out',
        isOffline
          ? 'animate-in slide-in-from-top bg-destructive text-destructive-foreground'
          : 'animate-in slide-in-from-top bg-emerald-600 text-white',
      )}
    >
      {isOffline ? (
        <>
          <WifiOff size={14} className="shrink-0 animate-pulse" />
          <span>{t('offlineMessage')}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="mr-2 inline-flex items-center gap-1 rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-semibold transition-colors hover:bg-white/30"
          >
            <RefreshCw size={11} />
            {t('retry')}
          </button>
        </>
      ) : (
        <>
          <Wifi size={14} className="shrink-0" />
          <span>{t('connectionRestored')} ✓</span>
        </>
      )}
    </div>
  );
}
