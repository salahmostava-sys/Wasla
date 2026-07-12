import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, Smartphone, Timer } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useToast } from '@shared/hooks/use-toast';
import { supabase } from '@services/supabase/client';

type TelegramIntegrationRow = {
  id: string;
  user_id: string;
  phone_number: string;
  otp_code: string;
  telegram_chat_id: string | null;
  is_linked: boolean;
  created_at: string;
};

type TelegramConnectCardProps = Readonly<{
  userId: string;
}>;

function generateOtp(): string {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(1000 + (values[0] % 9000));
}

function normalizePhoneNumber(value: string): string {
  return value.trim().replace(/\D/g, '');
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function TelegramConnectCard({ userId }: TelegramConnectCardProps) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [integration, setIntegration] = useState<TelegramIntegrationRow | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [generating, setGenerating] = useState(false);

  const normalizedPhoneNumber = useMemo(() => normalizePhoneNumber(phoneNumber), [phoneNumber]);

  const loadIntegration = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const { data, error } = await supabase
        .from('user_telegram_integrations')
        .select('id, user_id, phone_number, otp_code, telegram_chat_id, is_linked, created_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setIntegration(data);
      if (data?.phone_number) setPhoneNumber(data.phone_number);
    } catch (error) {
      toast({
        title: 'تعذر تحميل ربط تليجرام',
        description: getErrorMessage(error, 'حدث خطأ غير متوقع'),
        variant: 'destructive',
      });
    } finally {
      setLoadingStatus(false);
    }
  }, [toast, userId]);

  useEffect(() => {
    loadIntegration().catch(() => {});
  }, [loadIntegration]);

  const handleGenerateOtp = async () => {
    if (!normalizedPhoneNumber) {
      toast({ title: 'رقم الجوال مطلوب', variant: 'destructive' });
      return;
    }

    const otp = generateOtp();
    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from('user_telegram_integrations')
        .upsert(
          {
            user_id: userId,
            phone_number: normalizedPhoneNumber,
            otp_code: otp,
            telegram_chat_id: null,
            is_linked: false,
          },
          { onConflict: 'user_id' },
        )
        .select('id, user_id, phone_number, otp_code, telegram_chat_id, is_linked, created_at')
        .single();

      if (error) throw error;
      setIntegration(data);
      setGeneratedOtp(otp);
      toast({ title: 'تم إنشاء رمز تليجرام' });
    } catch (error) {
      toast({
        title: 'تعذر إنشاء رمز تليجرام',
        description: getErrorMessage(error, 'حدث خطأ غير متوقع'),
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const isLinked = integration?.is_linked === true;

  return (
    <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageCircle size={17} className="text-primary" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              ربط تليجرام
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            اربط حسابك بالبوت باستخدام رقم الجوال ورمز تحقق من 4 أرقام.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold">
          {loadingStatus ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              جاري التحميل
            </>
          ) : isLinked ? (
            <>
              <CheckCircle2 size={12} className="text-success" />
              مرتبط
            </>
          ) : (
            <>
              <Timer size={12} className="text-warning" />
              قيد الانتظار
            </>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="telegram-phone" className="text-sm text-foreground/80">
          رقم الجوال المسجل في تليجرام
        </Label>
        <div className="flex gap-2">
          <Input
            id="telegram-phone"
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+9665xxxxxxxx"
            dir="ltr"
            className="text-start"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => loadIntegration().catch(() => {})}
            disabled={loadingStatus}
            aria-label="تحديث حالة ربط تليجرام"
          >
            <RefreshCw size={15} className={loadingStatus ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleGenerateOtp}
        disabled={generating || loadingStatus}
        className="w-full gap-2"
      >
        {generating ? <Loader2 size={15} className="animate-spin" /> : <Smartphone size={15} />}
        إنشاء رمز ربط تليجرام
      </Button>

      {generatedOtp && (
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">رمز التحقق</p>
            <span className="rounded-lg bg-background px-4 py-2 font-mono text-2xl font-black tracking-[0.28em] text-primary">
              {generatedOtp}
            </span>
          </div>
          <ol className="list-decimal space-y-1 ps-5 text-sm text-muted-foreground">
            <li>افتح بوت تليجرام الخاص بالنظام.</li>
            <li>اضغط مشاركة رقم الجوال.</li>
            <li>اكتب هذا الرمز في المحادثة: {generatedOtp}</li>
          </ol>
        </div>
      )}
    </div>
  );
}
