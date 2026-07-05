import { useState } from 'react';
import { 
  Monitor, Layout, LogIn, Calendar, Banknote, Landmark, 
  Settings, ExternalLink, RefreshCw, Smartphone, Laptop, CheckCircle2 
} from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';

type StitchScreen = {
  filename: string;
  titleAr: string;
  titleEn: string;
  icon: typeof Monitor;
  descriptionAr: string;
  screenshotUrl: string;
  badge: string;
  badgeColor: string;
};

const STITCH_SCREENS: StitchScreen[] = [
  {
    filename: 'Login_Page___Modern_Split_Variant.html',
    titleAr: 'تسجيل الدخول - واجهة تقسيم شاشة عصرية',
    titleEn: 'Login Page - Modern Split Variant',
    icon: LogIn,
    descriptionAr: 'تصميم عصري يقسم الشاشة إلى نصفين: صورة بيئة عمل احترافية مع تراكب الهوية البصرية لشركة ChronosHR من جهة، ونموذج تسجيل الدخول بخطوط طباعية ممتازة ومؤثرات ظل خفيفة من جهة أخرى.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLuxhOu6YEuuVXYdyavthadNVg5XrzXZi68SbIyS7h6aWopyUSvo0pwqjixTjgGZ6nc3XXnCFh4eq_Iouke9WEZ-glJ-J_PKYrjGkuWWzEQk1cR9EvgKgeCrewMEOV0T8g8Q-vr2mEYsns1qoMt6rTk5TkBABsSGESONssO2YBVa6WM_jvEYjJ3FOXTbPaWZ3U-v3IB4md7OOTWjwBnPzJqVJgeG3M7tjUAGCBy9g2wCsNY2lemkEcLk9A',
    badge: 'مقترح حديث',
    badgeColor: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
  },
  {
    filename: 'Login_Page.html',
    titleAr: 'تسجيل الدخول - كلاسيكي احترافي',
    titleEn: 'Login Page',
    icon: LogIn,
    descriptionAr: 'صفحة تسجيل دخول احترافية مبسطة مع بطاقة مركزية بيضاء تطفو فوق تدرج لوني ناعم. تستخدم خطوط ومكونات نظام Lumina مع إبقاء خيارات التذكر واستعادة كلمة المرور.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLvuCXTBNNd2QkPRjNas67mKQtub4Ww0e8rF6qUyYgfAmiRmrNpqojjXV63m_97I28oqG_-2Y2Hfpp-TK1-LvDowAyaYsqUkuo0fbShKr5gXd8ulqIAidem2EVwrac3Mnkf58qIS5gYQeUGt7sqLcPjgrDSTza6YnawsYQEo5JyZPtdd0gxY3a6V2Krm0Z1Y3aDDeB5eb4nxD4WKRyFQuO7rhVWDXngoxhrMY4kOMckMJBm1a0wg7w-9l9w',
    badge: 'افتراضي',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
  },
  {
    filename: 'Login_Page___Minimal_Professional_Variant.html',
    titleAr: 'تسجيل الدخول - واجهة الحد الأدنى البسيطة',
    titleEn: 'Login Page - Minimal Professional Variant',
    icon: LogIn,
    descriptionAr: 'نسخة مبسطة (Minimal) تركز بالكامل على سهولة الاستخدام وتقليل المشتتات البصرية للوصول الفوري والسريع للنظام.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLu_IQujbOCU724W5BI6f9RbyuR8ymfMCoohmTNTCK1fn1c8PvCFF0Sgu9ovhBIgeXjAOhBWjnfq0baYwzc80JevLbQ_Vm8cfo3Ee2P_f-TjWxrFGt5lriRd_WEf4JGfJjAlr-ChOCgfVn2NBYWsvSRXz5QDRoRTVNQP2kh6thDPIVMhFaNmC7mHt7tpZKA6ayrAVtEFKx6Jca8txbgMLV9_UywE4JMiwKdu2EnPbQj6EwChbTvtXlurZTY',
    badge: 'بسيط جداً',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
  },
  {
    filename: 'Personal_and_Operational_Expenses_Dashboard.html',
    titleAr: 'لوحة مصاريف التشغيل والمصاريف الشخصية',
    titleEn: 'Personal & Operational Expenses',
    icon: Landmark,
    descriptionAr: 'لوحة تحكم مصممة بالكامل لإدارة وتحليل المصاريف الشخصية والتشغيلية، تفصلها بصرياً عن السلف باستخدام درجات اللون النيلي والبنفسجي، مع بطاقات مؤشرات للأداء وجدول مراجعة وتصفية متطور.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLuALYBxA0EDV0Mu-K3J7lUMQLfsluwJay_HgtvjBTXg4DF4RivMC9OdhJsB81f7p2yYvw3_d8CNPBATX1J6f0_VMFqZqAqnXrWUc0PhCqz1PjmyD0AZ-EnZb3K9cXx0SXD6jlB165LeadrQb19Ybe3dc6ynjJHZVzeOP8h8zfusxtZwY7Zhzzo8Kj_G0X10PfnciHugegWkfKi_eosicNQQ4rtg5BEwE3KKD2zbkzok0iOtAwXYMPLNAg',
    badge: 'إعادة تصميم كاملة',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
  },
  {
    filename: 'Daily_Attendance_Dashboard.html',
    titleAr: 'لوحة تسجيل الحضور والانصراف اليومي',
    titleEn: 'Daily Attendance Dashboard',
    icon: Calendar,
    descriptionAr: 'لوحة تحكم تفاعلية لإدارة الحضور اليومي للمناديب، تظهر إحصائيات فورية، بطاقات للموظفين متضمنة صورهم ورسوم بيانية مصغرة (Sparklines) لمسار الحضور، وقائمة زمنية متصلة لتتبع الحركات.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLutu_owd56QgS--qWal-einGnOv7q5AZqefO3WgKlxNDGHQUyZ_rzZ7YI59qxKFH3y9axOPnTquhspweztCBHiUblz5adUB1Q7tel_0OEX6MJMl0XZdXNrOXbziq2ZvN13CkOli0NaZ9OsR5eEqWrIbfpM36-tWOAoo0Ml8LgN_xOLdPg5KvdEmGHu1U-vTq8aWYgCJvmUB1NHNn62wVYDkAiPUvaj0Ec4dGihNZmVygUk0fG-yRLRpBUI',
    badge: 'مؤشرات ذكية',
    badgeColor: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300'
  },
  {
    filename: 'Advances_and_Debts_Dashboard.html',
    titleAr: 'لوحة السلف والديون للمناديب',
    titleEn: 'Advances and Debts Dashboard',
    icon: Banknote,
    descriptionAr: 'تصميم مخصص لإدارة طلبات السلف المالية والمديونيات الخاصة بالمناديب والموظفين، مع فحص حالات السداد وتاريخ الدفعات وأزرار إجراءات مخصصة وسريعة.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLui5iVEfFJK-uLLxIeeSzhMQnm-3ZTpvPFjMk0clrFerRt0RgXHu14oYkNtqZFgKEw1oyC8EOjDEG0qG_GtwZ5Qg7j24QMBpd6LZ3BtxovNyHEokq1rzmE2yH2CQ8oYBsxrQ3T3uROU-WTy6h17fFPTdQAhO_-Qcly2IAA5gL3rWT9JrW7IGgKhzVY6HSVBsNK1ZdKz8oXxdMGzVTm711sULdn1ufpgCHja2K468gAt3JLaMbZXkhn9RiQ',
    badge: 'إدارة مالية',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
  },
  {
    filename: 'Main_Application_Shell.html',
    titleAr: 'الهيكل والواجهة الرئيسية للتطبيق',
    titleEn: 'Main Application Shell',
    icon: Layout,
    descriptionAr: 'تصميم الهيكل والواجهة العامة لنظام ChronosHR شاملة القائمة الجانبية (Sidebar) سريعة الاستجابة وأقسام التنقل وعناصر الهوية البصرية المتكاملة للمشروع.',
    screenshotUrl: 'https://lh3.googleusercontent.com/aida/AP1WRLvLUTRcxDtlDjhvAsBiIi4W9AgpcbOAB74QX7pz5OiGaI32BouxnEd3g7TEl8-oZ2qFnmMjU0bVaNnh6s-f6hP-7UudhB0br4DJHRszEaBTkC5dKU4X9QjOC1Wl8JT2tBjd9ID_FzOcvQ0eTpFlik7n11vpMwDmxDwwzA8y8ssqnNalpk5Oj1xD6oUp-3B7PPcXCHLSy1kji6E2mKikEbLsAiBteyP3dCIccacf3rx5qjJ5BR5aSIHhLIE',
    badge: 'واجهة عامة',
    badgeColor: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
  }
];

const StitchPreview = () => {
  const [selectedScreen, setSelectedScreen] = useState<StitchScreen>(STITCH_SCREENS[0]);
  const [viewMode, setViewMode] = useState<'iframe' | 'image'>('iframe');
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [reloadKey, setReloadKey] = useState<number>(0);

  const iframeSrc = `/stitch-preview/${selectedScreen.filename}`;

  return (
    <div className="flex flex-col gap-5 animate-fade-in pb-10" dir="rtl">
      {/* Breadcrumb */}
      <div className="flex-shrink-0">
        <nav className="page-breadcrumb">
          <span>الرئيسية</span>
          <span className="page-breadcrumb-sep">/</span>
          <span>تصاميم Stitch</span>
        </nav>
        <h1 className="page-title flex items-center gap-2">
          <Settings size={22} className="text-indigo-600 dark:text-indigo-400" /> مستعرض تصاميم Stitch للـ UI/UX
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          قم بمراجعة جميع الصفحات المعاد تصميمها بالكامل باستخدام نظام تصميم Lumina Enterprise المتطور ومحرك ذكاء Stitch
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Screens Menu */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <Card className="shadow-sm border-border bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">الصفحات المعاد تصميمها</CardTitle>
              <CardDescription className="text-xs">اختر الصفحة التي ترغب في استعراضها</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 p-3">
              {STITCH_SCREENS.map((scr) => {
                const isSelected = selectedScreen.filename === scr.filename;
                const Icon = scr.icon;
                return (
                  <button
                    key={scr.filename}
                    onClick={() => setSelectedScreen(scr)}
                    className={`flex items-start gap-3 w-full text-right p-3 rounded-lg transition-all duration-200 ${
                      isSelected 
                        ? 'bg-indigo-600/10 text-indigo-600 border border-indigo-600/30' 
                        : 'hover:bg-muted/80 text-foreground border border-transparent'
                    }`}
                  >
                    <div className={`p-2 rounded-md ${isSelected ? 'bg-indigo-600 text-white' : 'bg-muted'}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm truncate">{scr.titleAr}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ${scr.badgeColor}`}>
                          {scr.badge}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">{scr.titleEn}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Design System Guidelines Summary */}
          <Card className="shadow-sm border-border bg-card/60 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CheckCircle2 size={16} className="text-indigo-600" /> موجهات نظام تصميم Lumina
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2.5 text-muted-foreground">
              <div>
                <span className="font-bold text-foreground block mb-0.5">الألوان والسمة (Colors & Theme):</span>
                تعتمد على اللون النيلي الأساسي (#4F46E5) والبنفسجي للأولويات، مع درجات Emerald للحضور والأخضر الإيجابي، والـ Rose للمخالفات والغياب.
              </div>
              <div>
                <span className="font-bold text-foreground block mb-0.5">الخطوط الطباعية (Typography):</span>
                استخدام خط **Hanken Grotesk** كخط أساسي للعناوين والفقرات، وخط **JetBrains Mono** المخصص لعرض الأرقام والبيانات الإحصائية والتواقيت لدقة مظهر البيانات.
              </div>
              <div>
                <span className="font-bold text-foreground block mb-0.5">الانحناء والحواف (Roundness):</span>
                حواف دائرية ناعمة بمقدار **8px (0.5rem)** للبطاقات والحقول والأزرار للظهور بمظهر عصري وسلس.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Interactive Previewer */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <Card className="shadow-md border-border overflow-hidden bg-card">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 border-b border-border bg-muted/20">
              <div>
                <h2 className="font-bold text-base text-foreground">{selectedScreen.titleAr}</h2>
                <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{selectedScreen.titleEn}</p>
              </div>

              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex border border-border rounded-lg overflow-hidden bg-background">
                  <Button
                    size="sm"
                    variant={viewMode === 'iframe' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('iframe')}
                    className="rounded-none text-xs px-3"
                  >
                    مستعرض حي
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === 'image' ? 'default' : 'ghost'}
                    onClick={() => setViewMode('image')}
                    className="rounded-none text-xs px-3"
                  >
                    لقطة شاشة ثابتة
                  </Button>
                </div>

                {/* Device Type Toggle (only for iframe) */}
                {viewMode === 'iframe' && (
                  <div className="flex border border-border rounded-lg overflow-hidden bg-background">
                    <Button
                      size="sm"
                      variant={deviceMode === 'desktop' ? 'default' : 'ghost'}
                      onClick={() => setDeviceMode('desktop')}
                      className="rounded-none p-2"
                      title="شاشة كمبيوتر"
                    >
                      <Laptop size={15} />
                    </Button>
                    <Button
                      size="sm"
                      variant={deviceMode === 'mobile' ? 'default' : 'ghost'}
                      onClick={() => setDeviceMode('mobile')}
                      className="rounded-none p-2"
                      title="شاشة جوال"
                    >
                      <Smartphone size={15} />
                    </Button>
                  </div>
                )}

                {/* Open in New Window */}
                <Button
                  size="sm"
                  variant="outline"
                  className="p-2"
                  title="فتح في نافذة مستقلة"
                  onClick={() => window.open(iframeSrc, '_blank')}
                >
                  <ExternalLink size={15} />
                </Button>

                {/* Reload iframe */}
                {viewMode === 'iframe' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="p-2"
                    title="تحديث العرض"
                    onClick={() => setReloadKey(prev => prev + 1)}
                  >
                    <RefreshCw size={15} />
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4 bg-muted/5 border-b border-border text-sm">
              <span className="font-bold text-indigo-600 block mb-1">وصف واجهة التصميم:</span>
              <p className="text-muted-foreground text-xs leading-relaxed">{selectedScreen.descriptionAr}</p>
            </div>

            {/* View Area */}
            <div className="bg-muted/40 p-6 flex justify-center items-center overflow-x-auto min-h-[500px]">
              {viewMode === 'image' ? (
                <div className="relative border border-border shadow-lg rounded-xl overflow-hidden max-w-full bg-background">
                  <img 
                    src={selectedScreen.screenshotUrl} 
                    alt={selectedScreen.titleEn}
                    className="max-h-[700px] object-contain"
                  />
                </div>
              ) : (
                <div 
                  className={`transition-all duration-300 border border-border shadow-2xl rounded-xl overflow-hidden bg-background ${
                    deviceMode === 'mobile' ? 'w-[375px] h-[667px]' : 'w-full h-[700px]'
                  }`}
                >
                  <iframe
                    key={reloadKey}
                    src={iframeSrc}
                    title={selectedScreen.titleEn}
                    className="w-full h-full border-0"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default StitchPreview;
