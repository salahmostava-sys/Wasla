import { useLocation, Link } from "react-router-dom";
import { logError } from "@shared/lib/logger";
import { useEffect } from "react";
import { Button } from "@shared/components/ui/button";
import { Home } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useLanguage } from '@app/providers/LanguageContext';

const NotFound = () => {
  const location = useLocation();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  useEffect(() => {
    logError("404 Error: User attempted to access non-existent route", location.pathname);
  }, [location.pathname]);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-muted p-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="text-center max-w-md space-y-4">
        <h1 className="text-4xl font-black text-foreground">404</h1>
        <p className="text-lg text-muted-foreground">
          {t('pageNotFound')}
        </p>
        <Button asChild variant="default" className="gap-2">
          <Link to="/">
            <Home className="h-4 w-4" aria-hidden />
            {t('backHome')}
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
