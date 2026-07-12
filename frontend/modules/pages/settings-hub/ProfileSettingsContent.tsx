import type React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Camera, Eye, EyeOff, Check, AlertCircle, User, Loader2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useToast } from '@shared/hooks/use-toast';
import { useAuth } from '@app/providers/AuthContext';
import { useLanguage } from '@app/providers/LanguageContext';
import { cn } from '@shared/lib/utils';
import { settingsHubService } from '@services/settingsHubService';
import { validateUploadFile } from '@shared/lib/validation';
import { useQuery } from '@tanstack/react-query';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';

const getStrength = (pw: string) => {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(3, Math.floor(score * 3 / 5));
};

const strengthLabelAr = (s: number) => (['', 'ضعيفة', 'متوسطة', 'قوية'][s] || '');

const strengthColor = (s: number) => {
  if (s === 1) return 'bg-destructive';
  if (s === 2) return 'bg-warning';
  return 'bg-success';
};

const SectionHeader = ({ icon, title, subtitle }: Readonly<{ icon: React.ReactNode; title: string; subtitle?: string }>) => (
  <div className="flex items-center gap-3 pb-4 mb-5" style={{ borderBottom: '1px solid var(--ds-surface-container)' }}>
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      style={{ background: 'rgba(31,84,173,0.08)', color: '#1f54ad' }}>
      {icon}
    </div>
    <div>
      <h2 className="text-base font-bold" style={{ color: 'var(--ds-on-surface)' }}>{title}</h2>
      {subtitle && <p className="text-xs" style={{ color: 'var(--ds-on-surface-variant)' }}>{subtitle}</p>}
    </div>
  </div>
);

type PwFieldId = 'next' | 'confirm';
type PwFieldProps = Readonly<{
  id: PwFieldId;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}>;

const PwField = ({ id, label, value, onChange, show, onToggle }: Readonly<PwFieldProps>) => (
  <div>
    <Label htmlFor={id} className="text-sm mb-1.5 block" style={{ color: 'var(--ds-on-surface-variant)' }}>{label}</Label>
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} className="pe-10" dir="ltr" />
      <button type="button" onClick={onToggle} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  </div>
);

interface ProfileSettingsContentProps {
  /** إخفاء عنوان القسم العلوي (عند عرض الصفحة المستقلة التي تحتوي على h1) */
  omitPageHeading?: boolean;
}

export default function ProfileSettingsContent({ omitPageHeading = false }: Readonly<ProfileSettingsContentProps>) { // NOSONAR: settings page combines profile and password flows
  const { user } = useAuth();
  const { toast } = useToast();
  const { isRTL } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profileData, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ['settings', 'profile', user?.id],
    queryFn: () => settingsHubService.getProfileByUserId(user?.id),
    enabled: !!user,
    staleTime: 60_000,
  });

  const [profile, setProfile] = useState({ name: '', avatar_url: '' });
  const [profileSynced, setProfileSynced] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [pw, setPw] = useState({ next: '', confirm: '' });
  const [showPw, setShowPw] = useState({ next: false, confirm: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');

  const strength = getStrength(pw.next);

  let strengthTextClass = 'text-success';
  if (strength === 1) strengthTextClass = 'text-destructive';
  else if (strength === 2) strengthTextClass = 'text-warning';

  const passwordsMatch = pw.next === pw.confirm;

  // Sync form from query (once) — moved to useEffect to avoid setState during render
  useEffect(() => {
    if (profileData && !profileSynced) {
      setProfile({ name: profileData.name ?? '', avatar_url: profileData.avatar_url ?? '' });
      setProfileSynced(true);
    }
  }, [profileData, profileSynced]);

  // Revoke preview ObjectURL on cleanup to prevent memory leak
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateUploadFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    });
    if (!validation.valid) {
      toast({ title: validation.error, variant: 'destructive' });
      return;
    }
    setAvatarFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      let avatar_url = profile.avatar_url;
      if (avatarFile) {
        const ext = avatarFile.name.split('.').pop();
        const path = `${user.id}/avatar.${ext}`;
        const uploadData = await settingsHubService.uploadAvatar(path, avatarFile);
        const { data: urlData } = settingsHubService.getAvatarPublicUrl(uploadData.path);
        avatar_url = urlData.publicUrl;
      }
      await settingsHubService.updateProfileByUserId(user.id, { name: profile.name.trim(), avatar_url });
      setProfile(p => ({ ...p, avatar_url }));
      setAvatarFile(null);
      toast({ title: 'تم حفظ التغييرات ✓' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast({ title: 'خطأ في الحفظ', description: message, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    setPwError('');
    if (!pw.next || pw.next.length < 8) {
      setPwError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError('كلمتا المرور غير متطابقتين');
      return;
    }
    setSavingPw(true);
    try {
      await settingsHubService.updatePassword(pw.next);
    } catch (e: unknown) {
      setSavingPw(false);
      setPwError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSavingPw(false);
    toast({ title: 'تم تغيير كلمة المرور ✓' });
    setPw({ next: '', confirm: '' });
  };

  const avatarSrc = previewUrl || profile.avatar_url || null;
  const initial = (profile.name || user?.email || 'U').charAt(0).toUpperCase();

  if (profileLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-primary" />
    </div>
  );

  if (profileError) return (
    <QueryErrorRetry
      error={profileError}
      onRetry={() => refetchProfile().catch(() => {})}
      title="تعذر تحميل الملف الشخصي"
    />
  );

  return (
    <div className="space-y-8 max-w-xl" dir={isRTL ? 'rtl' : 'ltr'}>
      {!omitPageHeading && (
        <SectionHeader
          icon={<User size={20} />}
          title="الملف الشخصي"
          subtitle="تعديل بياناتك الشخصية وكلمة المرور"
        />
      )}

      {/* Avatar */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          الصورة الشخصية
        </p>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            {avatarSrc ? (
              <img src={avatarSrc} alt="الصورة الشخصية" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold border-2 border-border"
                style={{ background: 'rgba(31,84,173,0.1)', color: '#1f54ad' }}>
                {initial}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 end-0 w-7 h-7 text-white flex items-center justify-center shadow-card transition-opacity hover:opacity-90 rounded-2xl"
              style={{ background: '#1f54ad' }}
            >
              <Camera size={12} />
            </button>
          </div>
          <div className="flex-1 space-y-2">
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileRef.current?.click()}>
              <Camera size={14} />
              تغيير الصورة
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              JPG أو PNG — الحجم الأقصى 2MB
            </p>
            {avatarFile && <p className="text-[11px] text-primary text-center truncate">{avatarFile.name}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Personal Info */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          المعلومات الشخصية
        </p>
        <div>
          <Label className="text-sm mb-1.5 block text-foreground/80">الاسم الكامل</Label>
          <Input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="أدخل اسمك" />
        </div>
        <div>
          <Label className="text-sm mb-1.5 block text-foreground/80">البريد الإلكتروني</Label>
          <Input value={user?.email ?? ''} readOnly dir="ltr" className="bg-muted/40 text-muted-foreground cursor-default" />
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
            <AlertCircle size={11} />
            لتغيير البريد الإلكتروني، تواصل مع المسؤول
          </p>
        </div>
        <Button onClick={saveProfile} disabled={savingProfile} className="w-full gap-2">
          {savingProfile ? (
            'جاري الحفظ...'
          ) : (
            <>
              <Check size={15} />
              حفظ التغييرات
            </>
          )}
        </Button>
      </div>

      {/* Change Password */}
      <div className="bg-card border border-border/50 p-5 space-y-4 rounded-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          تغيير كلمة المرور
        </p>
        <PwField
          id="next"
          label="كلمة المرور الجديدة"
          value={pw.next}
          onChange={v => { setPw(p => ({ ...p, next: v })); setPwError(''); }}
          show={showPw.next}
          onToggle={() => setShowPw(s => ({ ...s, next: !s.next }))}
        />
        {pw.next && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={`profile-pw-strength-${i}`} className={cn('h-1.5 flex-1 rounded-full transition-colors', strength >= i ? strengthColor(strength) : 'bg-muted')} />
              ))}
            </div>
            <p className={cn('text-xs font-medium', strengthTextClass)}>
              {strengthLabelAr(strength)}
            </p>
          </div>
        )}
        <PwField
          id="confirm"
          label="تأكيد كلمة المرور"
          value={pw.confirm}
          onChange={v => { setPw(p => ({ ...p, confirm: v })); setPwError(''); }}
          show={showPw.confirm}
          onToggle={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
        />
        {pw.confirm && pw.next && (
          <p className={cn('text-xs flex items-center gap-1', passwordsMatch ? 'text-success' : 'text-destructive')}>
            {passwordsMatch ? (
              <>
                <Check size={11} />
                كلمتا المرور متطابقتان
              </>
            ) : (
              <>
                <AlertCircle size={11} />
                كلمتا المرور غير متطابقتين
              </>
            )}
          </p>
        )}
        {pwError && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle size={11} /> {pwError}
          </p>
        )}
        <Button variant="outline" onClick={changePassword} disabled={savingPw || !pw.next || !pw.confirm} className="w-full gap-2">
          {savingPw ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
        </Button>
      </div>
    </div>
  );
}
