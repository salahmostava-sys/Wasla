import { useState, useEffect, type Dispatch, type FormEvent, type SetStateAction, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@app/providers/AuthContext';
import { ThemeToggle } from '@shared/components/ThemeToggle';
import { LanguageToggle } from '@shared/components/LanguageToggle';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { dashboardService } from '@services/dashboardService';
import { loadRememberedEmail, persistRememberedEmail } from '@shared/lib/loginRememberStorage';
import { logError } from '@shared/lib/logger';
import { brandLogoSrc } from '@shared/lib/brandLogo';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Label } from '@shared/components/ui/label';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface SystemSettings {
  project_name_ar: string;
  project_name_en: string;
  project_subtitle_ar: string;
  project_subtitle_en: string;
  logo_url: string | null;
  updated_at?: string | null;
}

const DEACTIVATED_LOGIN_MESSAGE = 'هذا الحساب معطّل. تواصل مع المسؤول.';

function getFriendlyLoginErrorMessage(message: string, t: TFunction): string {
  const normalized = message.toLowerCase();

  if (message === DEACTIVATED_LOGIN_MESSAGE || normalized.includes('معط')) {
    return t('loginAccountDisabled');
  }
  if (message === t('loginActionFailed')) {
    return message;
  }
  if (normalized.includes('invalid login credentials')) {
    return t('loginInvalidCredentials');
  }
  if (
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('429')
  ) {
    return t('loginRateLimited');
  }
  if (
    normalized.includes(':timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('fetch failed') ||
    normalized.includes('network') ||
    normalized.includes('مهلة')
  ) {
    return t('loginNetworkError');
  }
  if (
    normalized.includes('email not confirmed') ||
    normalized.includes('email_not_confirmed')
  ) {
    return t('loginEmailNotConfirmed');
  }
  return t('loginUnexpectedError', { message });
}

function useFeatures(t: TFunction) {
  return useMemo(() => [
    { icon: 'dashboard_customize', title: t('feature1Title'), desc: t('feature1Desc') },
    { icon: 'local_shipping', title: t('feature2Title'), desc: t('feature2Desc') },
    { icon: 'analytics', title: t('feature3Title'), desc: t('feature3Desc') },
    { icon: 'security', title: t('feature4Title'), desc: t('feature4Desc') },
  ], [t]);
}

async function fetchSettingsSafely(setSettings: (s: SystemSettings) => void) {
  try {
    const data = await dashboardService.getSystemSettings();
    if (!data) return;
    setSettings({
      project_name_ar: data.project_name_ar ?? '',
      project_name_en: data.project_name_en ?? '',
      project_subtitle_ar: data.project_subtitle_ar ?? '',
      project_subtitle_en: data.project_subtitle_en ?? '',
      logo_url: data.logo_url ?? null,
      updated_at: (data as { updated_at?: string | null }).updated_at ?? null,
    });
  } catch (err) {
    logError('[Login] getSystemSettings failed', err);
  }
}

async function fetchRememberedEmailSafely(
  setRememberMe: (val: boolean) => void,
  setEmail: (val: string) => void,
  getCancelled: () => boolean
) {
  try {
    const { email: storedEmail, remember } = await loadRememberedEmail();
    if (getCancelled()) return;
    setRememberMe(remember);
    if (storedEmail) setEmail(storedEmail);
  } catch (e) {
    logError('[Login] loadRememberedEmail failed', e);
  }
}

async function performLoginAction(
  email: string,
  password: string,
  rememberMe: boolean,
  signIn: (e: string, p: string) => Promise<{ error: { message: string } | null }>,
  setLoading: (l: boolean) => void,
  setLoginError: (err: string) => void,
  navigate: (path: string, opts?: { replace?: boolean }) => void,
  t: TFunction,
) {
  setLoading(true);
  let error: { message: string } | null;
  try {
    const res = await signIn(email, password);
    error = res.error;
  } catch (err) {
    logError('[Login] signIn threw', err);
    error = { message: t('loginActionFailed') };
  } finally {
    setLoading(false);
  }

  if (error) {
    setLoginError(getFriendlyLoginErrorMessage(error.message, t));
  } else {
    try { await persistRememberedEmail(email.trim(), rememberMe); } catch (e) { logError('[Login] persist failed', e); }
    navigate('/', { replace: true });
  }
}

function useLoginLogic() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchSettingsSafely(setSettings);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRememberedEmailSafely(setRememberMe, setEmail, () => cancelled);
    return () => { cancelled = true; };
  }, []);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError('');
    if (!email || !password) return;
    await performLoginAction(email, password, rememberMe, signIn, setLoading, setLoginError, navigate, t);
  };

  return {
    email, setEmail, password, setPassword, showPw, setShowPw, rememberMe, setRememberMe,
    loading, loginError, settings, capsLock, setCapsLock, mounted, handleLogin
  };
}

function LoginBrandingPanel({
  settings,
  mounted,
  projectName,
  projectSubtitle,
}: Readonly<{
  settings: SystemSettings | null;
  mounted: boolean;
  projectName: string;
  projectSubtitle: string;
}>) {
  const { t, i18n } = useTranslation();
  const features = useFeatures(t);
  const isRtl = i18n.language === 'ar';

  return (
    <section
      className="hidden lg:flex lg:w-[52%] relative flex-col justify-between overflow-hidden px-12 py-10 xl:px-16 xl:py-12"
      style={{
        background: 'var(--ds-primary)',
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.045]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.55) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div className={`relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <div className="flex items-center gap-4 mb-7">
          {settings?.logo_url ? (
            <span className="w-20 h-20 overflow-hidden bg-white ring-1 ring-white/35 shadow-card rounded-xl flex items-center justify-center shrink-0">
              <img
                src={brandLogoSrc(settings.logo_url, settings.updated_at)}
                alt=""
                className="h-full w-full object-contain scale-150"
              />
            </span>
          ) : (
            <div className="w-20 h-20 bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20 shadow-card relative rounded-xl shrink-0">
              <span className="material-symbols-outlined text-5xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
              <span className={`absolute -top-1 ${isRtl ? '-right-1' : '-left-1'} w-3.5 h-3.5 bg-emerald-400 rounded-full ring-2 ring-white/30`} />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl xl:text-3xl font-extrabold text-white leading-tight max-w-lg">{projectName}</h1>
            <p className="text-white/90 text-sm mt-1 truncate max-w-md">{projectSubtitle}</p>
          </div>
        </div>
        <p className="text-white/90 text-lg max-w-xl leading-8">
          {t('systemSubtitleDesc')}
        </p>
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-3 mt-10">
        {features.map((f, i) => (
          <div
            key={f.icon}
            className="group min-h-[132px] bg-white/[0.07] hover:bg-white/[0.12] backdrop-blur-sm border border-white/10 hover:border-white/20 p-4 rounded-2xl flex flex-col gap-2 transition-all duration-300 cursor-default"
            style={{
              animationDelay: `${i * 80 + 200}ms`,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'none' : 'translateY(16px)',
              transition: `opacity 500ms ${i * 80 + 200}ms, transform 500ms ${i * 80 + 200}ms cubic-bezier(0.22,1,0.36,1), background-color 200ms, border-color 200ms`,
            }}
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/15 transition-colors">
              <span className="material-symbols-outlined text-white text-lg">{f.icon}</span>
            </div>
            <h3 className="text-white font-bold text-base">{f.title}</h3>
            <p className="text-white/90 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <p className={`relative z-10 text-white/80 text-sm mt-8 ${isRtl ? 'text-right' : 'text-left'}`}>
        {`© ${new Date().getFullYear()} ${projectName}`}
      </p>
    </section>
  );
}

type LoginFormSectionProps = Readonly<{
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  showPw: boolean;
  setShowPw: Dispatch<SetStateAction<boolean>>;
  rememberMe: boolean;
  setRememberMe: Dispatch<SetStateAction<boolean>>;
  loading: boolean;
  loginError: string;
  settings: SystemSettings | null;
  capsLock: boolean;
  setCapsLock: (v: boolean) => void;
  mounted: boolean;
  handleLogin: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  projectName: string;
  projectSubtitle: string;
}>;

function PasswordField({ password, setPassword, showPw, setShowPw, capsLock, setCapsLock, email, loginError }: Readonly<{
  password: string; setPassword: (v: string) => void; showPw: boolean; setShowPw: Dispatch<SetStateAction<boolean>>;
  capsLock: boolean; setCapsLock: (v: boolean) => void; email: string; loginError: string;
}>) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <div className="relative group">
      <div className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors duration-200`}>
        <span className="material-symbols-outlined text-xl">lock</span>
      </div>
      <input
        id="login-password"
        name="password"
        type={showPw ? 'text' : 'password'}
        value={password}
        onChange={e => setPassword(e.target.value)}
        onKeyUp={e => setCapsLock(e.getModifierState('CapsLock'))}
        placeholder="••••••••"
        required
        dir="ltr"
        autoComplete="current-password"
        autoFocus={!!email}
        aria-invalid={!!loginError}
        className={`block h-12 w-full ${isRtl ? 'pr-14 pl-14' : 'pl-14 pr-14'} text-base bg-[var(--ds-field-bg)] border border-[var(--ds-field-border)] rounded-xl focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary hover:border-[var(--ds-field-border)] transition-all duration-200 outline-none text-foreground placeholder:text-muted-foreground/50`}
        style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: !showPw ? '0.12em' : 'normal', textAlign: 'left', direction: 'ltr' }} // NOSONAR
      />
      <button
        type="button"
        onClick={() => setShowPw(v => !v)}
        className={`absolute inset-y-0 ${isRtl ? 'left-0 pl-4' : 'right-0 pr-4'} flex items-center text-muted-foreground hover:text-foreground transition-colors duration-200`}
        aria-label={showPw ? t('hidePassword') : t('showPassword')}
      >
        {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
      {capsLock && (
        <div className={`flex items-center gap-2 text-amber-600 dark:text-amber-400 px-1 animate-slide-up mt-2`}>
          <span className="material-symbols-outlined text-sm">warning</span>
          <span className="text-xs">{t('capsLockWarning')}</span>
        </div>
      )}
    </div>
  );
}

function LoginErrorAlert({ loginError }: Readonly<{ loginError: string }>) {
  if (!loginError) return null;
  return (
    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/25 rounded-xl px-4 py-3 animate-slide-up">
      <span className="material-symbols-outlined text-destructive text-lg flex-shrink-0">error</span>
      <p className="text-destructive text-sm font-medium">{loginError}</p>
    </div>
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function LoginFormSection(props: LoginFormSectionProps) {
  const {
    email,
    setEmail,
    password,
    setPassword,
    showPw,
    setShowPw,
    rememberMe,
    setRememberMe,
    loading,
    loginError,
    settings,
    capsLock,
    setCapsLock,
    mounted,
    handleLogin,
    projectName,
    projectSubtitle,
  } = props;

  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  return (
    <section className="w-full lg:w-[48%] flex flex-col justify-center items-center px-6 py-8 sm:px-10 lg:px-12 xl:px-16 bg-background relative min-h-screen lg:min-h-0">

      <div className={`absolute top-5 ${isRtl ? 'left-5' : 'right-5'} flex gap-2`}>
        <ThemeToggle className="w-9 h-9 hover:scale-105 active:scale-95" />
        <LanguageToggle className="w-9 h-9 hover:scale-105 active:scale-95" />
      </div>

      <div
        className="lg:hidden flex flex-col items-center mb-10 pt-6"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(-12px)', transition: 'opacity 500ms, transform 500ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        {settings?.logo_url ? (
          <span className="w-20 h-20 overflow-hidden shadow-card border border-border bg-card mb-3 rounded-xl flex items-center justify-center">
            <img
              src={brandLogoSrc(settings.logo_url, settings.updated_at)}
              alt=""
              className="h-full w-full object-contain scale-150"
            />
          </span>
        ) : (
          <div className="w-20 h-20 rounded-xl mb-3 flex items-center justify-center" style={{ background: 'var(--ds-primary)' }}>
            <span className="material-symbols-outlined text-5xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>local_shipping</span>
          </div>
        )}
        <h1 className="text-lg font-extrabold text-foreground text-center leading-tight max-w-[17rem]">{projectName}</h1>
        <p className="text-xs text-muted-foreground mt-1">{projectSubtitle}</p>
      </div>

      <div className="w-full max-w-[420px]">

        <div
          className="mb-8"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)', transition: 'opacity 450ms 50ms, transform 450ms 50ms cubic-bezier(0.22,1,0.36,1)' }}
        >
          <h2 className="text-2xl font-extrabold text-foreground mb-2">{t('login')}</h2>
          <p className="text-sm text-muted-foreground">{t('welcomeBack')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">

          <div
            className="space-y-2"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)', transition: 'opacity 450ms 120ms, transform 450ms 120ms cubic-bezier(0.22,1,0.36,1)' }}
          >
            <label htmlFor="login-email" className="block text-sm font-medium text-muted-foreground">{t('email')}</label>
            <div className="relative group">
              <div className={`absolute inset-y-0 ${isRtl ? 'right-0 pr-4' : 'left-0 pl-4'} flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors duration-200`}>
                <span className="material-symbols-outlined text-xl">mail</span>
              </div>
              <input
                id="login-email"
                name="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                dir="ltr"
                autoComplete="email"
                autoFocus={!email}
                aria-invalid={!!loginError}
                className={`block h-12 w-full ${isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'} text-base bg-[var(--ds-field-bg)] border border-[var(--ds-field-border)] rounded-xl focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary hover:border-[var(--ds-field-border)] transition-all duration-200 outline-none text-foreground placeholder:text-muted-foreground/50`}
              />
            </div>
          </div>

          <div
            className="space-y-2"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)', transition: 'opacity 450ms 180ms, transform 450ms 180ms cubic-bezier(0.22,1,0.36,1)' }}
          >
            <label htmlFor="login-password" className="block text-sm font-medium text-muted-foreground">{t('password')}</label>
            <PasswordField
              password={password}
              setPassword={setPassword}
              showPw={showPw}
              setShowPw={setShowPw}
              capsLock={capsLock}
              setCapsLock={setCapsLock}
              email={email}
              loginError={loginError}
            />
          </div>

          <div
            className="flex items-center gap-3 px-1"
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)', transition: 'opacity 450ms 240ms, transform 450ms 240ms cubic-bezier(0.22,1,0.36,1)' }}
          >
            <Checkbox
              id="remember-me"
              checked={rememberMe}
              onCheckedChange={(v) => setRememberMe(v === true)}
              className="h-5 w-5"
            />
            <Label htmlFor="remember-me" className="text-sm text-muted-foreground font-normal cursor-pointer select-none leading-none">
              {t('rememberMe')}
            </Label>
          </div>

          <LoginErrorAlert loginError={loginError} />

          <div
            style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(14px)', transition: 'opacity 450ms 300ms, transform 450ms 300ms cubic-bezier(0.22,1,0.36,1)' }}
          >
            <button
              type="submit"
              disabled={loading}
              className="relative h-12 w-full px-5 text-white font-bold rounded-xl overflow-hidden active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed group"
              style={{ background: 'var(--ds-primary)' }}
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                  background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.8s linear infinite',
                }}
              />
              {loading ? (
                <><Loader2 size={18} className="animate-spin" /><span>{t('loginVerifying')}</span></>
              ) : (
                <><span>{t('login')}</span><span className="material-symbols-outlined text-xl">login</span></>
              )}
            </button>
          </div>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8 lg:hidden">
        {`© ${new Date().getFullYear()} ${projectName}`}
      </p>
    </section>
  );
}

const Login = () => {
  const {
    email, setEmail, password, setPassword, showPw, setShowPw, rememberMe, setRememberMe,
    loading, loginError, settings, capsLock, setCapsLock, mounted, handleLogin
  } = useLoginLogic();

  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const projectName = isRtl
    ? settings?.project_name_ar || t('appName')
    : settings?.project_name_en || t('appName');
  const projectSubtitle = isRtl
    ? settings?.project_subtitle_ar || t('appSubtitle')
    : settings?.project_subtitle_en || t('appSubtitle');

  return (
    <div className="min-h-screen flex bg-background" dir={isRtl ? 'rtl' : 'ltr'}>

      <LoginBrandingPanel
        settings={settings}
        mounted={mounted}
        projectName={projectName}
        projectSubtitle={projectSubtitle}
      />

      <LoginFormSection
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        showPw={showPw}
        setShowPw={setShowPw}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        loading={loading}
        loginError={loginError}
        settings={settings}
        capsLock={capsLock}
        setCapsLock={setCapsLock}
        mounted={mounted}
        handleLogin={handleLogin}
        projectName={projectName}
        projectSubtitle={projectSubtitle}
      />

      {/* Security badge */}
      <div className={`fixed bottom-5 ${isRtl ? 'left-5' : 'right-5'} hidden lg:flex items-center gap-2 bg-card/90 backdrop-blur-sm py-2 px-3.5 shadow-card border border-border/40 rounded-xl`}>
        <span className="material-symbols-outlined text-emerald-500 text-lg">verified_user</span>
        <span className="text-xs font-semibold text-muted-foreground">{t('secureConnection')}</span>
      </div>
    </div>
  );
};

export default Login;
