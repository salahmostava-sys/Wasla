import { useLocation, Link } from "react-router-dom";
import { logError } from "@shared/lib/logger";
import { useEffect } from "react";
import { Button } from "@shared/components/ui/button";
import { MoveRight, MoveLeft } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';
import { motion } from "motion/react";

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  useEffect(() => {
    logError("404 Error: User attempted to access non-existent route", location.pathname);
  }, [location.pathname]);

  const ArrowIcon = isRTL ? MoveLeft : MoveRight;
  const hoverTranslate = isRTL ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1';

  return (
    <div
      className="min-h-[100dvh] bg-background text-foreground grid grid-cols-1 md:grid-cols-2"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex flex-col justify-center p-8 md:p-16 lg:p-24 space-y-12 border-b md:border-b-0 md:border-r border-border md:rtl:border-l md:rtl:border-r-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-[11px] uppercase tracking-[0.2em] mb-4 text-muted-foreground font-mono">
            Error 404
          </div>
          <h1 className="text-7xl md:text-9xl tracking-tighter leading-none font-black text-primary">
            404
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 max-w-sm"
        >
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight">
            {t('pageNotFound')}
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed">
            المسار الذي تحاول الوصول إليه غير موجود، ربما تم نقله أو إزالته. يمكنك العودة بأمان إلى الصفحة الرئيسية والمتابعة.
          </p>
          <div className="pt-4">
            <Button asChild size="lg" className="rounded-none shadow-none group transition-all duration-300">
              <Link to="/" className="inline-flex items-center gap-3">
                {t('backHome')}
                <ArrowIcon className={`h-4 w-4 transition-transform ${hoverTranslate}`} />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
      
      {/* Visual / Asset side */}
      <div className="bg-muted/30 hidden md:flex items-center justify-center p-8 relative overflow-hidden">
        {/* Abstract shape */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
          className="w-full max-w-sm aspect-square rounded-full border-[1px] border-primary/20 flex items-center justify-center"
        >
            <div className="w-2/3 h-2/3 rounded-full border-[1px] border-primary/40 flex items-center justify-center">
                <div className="w-1/3 h-1/3 rounded-full bg-primary/10"></div>
            </div>
        </motion.div>
      </div>
    </div>
  );
};

export default NotFound;
