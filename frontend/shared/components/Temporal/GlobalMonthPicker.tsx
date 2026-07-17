import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTemporalContext } from '@app/providers/TemporalContext';
import { format, addMonths, subMonths, parseISO } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@app/providers/LanguageContext';
import { useTranslation } from 'react-i18next';

const GlobalMonthPicker = () => {
  const { selectedMonth, setSelectedMonth } = useTemporalContext();
  const { isRTL, lang } = useLanguage();
  const { t } = useTranslation();
  
  const date = parseISO(`${selectedMonth}-01`);
  
  const handlePrev = () => {
    const prev = subMonths(date, 1);
    setSelectedMonth(format(prev, 'yyyy-MM'));
  };
  
  const handleNext = () => {
    const next = addMonths(date, 1);
    setSelectedMonth(format(next, 'yyyy-MM'));
  };

  return (
    <div className="flex items-center gap-1 bg-background/50 border border-border/60 rounded-xl p-1 shadow-sm backdrop-blur-sm group hover:border-primary/30 transition-all">
      <button type="button"
        onClick={handlePrev}
        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        title={t('previousMonth')}
        aria-label={t('previousMonth')}
      >
        {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
      
      <div className="relative flex items-center px-2 gap-2 min-w-[130px] justify-center">
        <Calendar size={14} className="text-primary/70" />
        <span className="text-xs font-bold text-foreground select-none">
          {format(date, 'MMMM yyyy', { locale: lang === 'ar' ? ar : enUS })}
        </span>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </div>

      <button type="button"
        onClick={handleNext}
        className="p-1.5 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        title={t('nextMonth')}
        aria-label={t('nextMonth')}
      >
        {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>
    </div>
  );
};

export default GlobalMonthPicker;
