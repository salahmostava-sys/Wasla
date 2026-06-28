import type React from 'react';
import { useEffect, useMemo } from 'react';
import { Printer } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { cn } from '@shared/lib/utils';

type PrintReportProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  showPrintButton?: boolean;
  /** Optional company name shown in print header */
  companyName?: string;
  /** Optional logo URL for the print header */
  logoUrl?: string;
  /** Report reference number */
  refNumber?: string;
};

/**
 * PrintReport - Wraps report content with print-friendly formatting
 * Automatically applies print styles and provides a print button
 */
export function PrintReport({
  title,
  subtitle,
  children,
  className,
  showPrintButton = true,
  companyName = 'مهمات التوصيل',
  logoUrl,
  refNumber,
}: Readonly<PrintReportProps>) {
  const timestamp = useMemo(() => {
    const now = new Date();
    return {
      date: now.toLocaleDateString('ar-SA'),
      time: now.toLocaleTimeString('ar-SA'),
      full: now.toLocaleDateString('ar-SA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    };
  }, []);

  useEffect(() => {
    // Add print-specific meta tags
    const meta = document.createElement('meta');
    meta.name = 'print-color-adjust';
    meta.content = 'exact';
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    };
  }, []);

  const handlePrint = () => {
    globalThis.print();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Print Header - visible in both screen and print */}
      <div className="print-header bg-card border border-border/50 p-6 shadow-sm rounded-2xl">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Logo for print */}
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="hidden print:block h-12 w-12 rounded-lg object-cover"
              />
            ) : null}
            <div>
              {/* Company name — only visible in print */}
              <p className="hidden print:block text-xs text-gray-500 mb-1 font-medium">
                {companyName}
              </p>
              <h1 className="text-2xl font-bold text-foreground print:text-gray-900">{title}</h1>
              {subtitle ? (
                <p className="text-sm text-muted-foreground mt-1 print:text-gray-600">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {showPrintButton ? (
            <div className="flex items-center gap-2 print:hidden">
              <Button
                onClick={handlePrint}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Printer size={16} />
                طباعة
              </Button>
            </div>
          ) : null}
        </div>

        {/* Report metadata */}
        <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground print:text-gray-500">
          <span>تاريخ الطباعة: {timestamp.date}</span>
          <span className="print:hidden">•</span>
          <span>الوقت: {timestamp.time}</span>
          {refNumber ? (
            <>
              <span className="print:hidden">•</span>
              <span>رقم مرجعي: {refNumber}</span>
            </>
          ) : null}
        </div>
      </div>

      {/* Report Content */}
      <div className="print-content">
        {children}
      </div>

      {/* Print Footer - only visible when printing */}
      <div className="hidden print:block print-footer mt-8 pt-4 border-t border-gray-300">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            <p className="font-medium">{companyName} — نظام إدارة المناديب</p>
            <p>تم الطباعة في {timestamp.full} — {timestamp.time}</p>
          </div>
          {refNumber ? (
            <p className="text-[10px]">مرجع: {refNumber}</p>
          ) : null}
        </div>
        {/* CSS counter for page number — handled via @page in CSS */}
      </div>
    </div>
  );
}

/**
 * PrintTable - A table optimized for printing with proper page breaks
 */
export function PrintTable({
  children,
  className
}: Readonly<{
  children: React.ReactNode;
  className?: string
}>) {
  return (
    <div className={cn("overflow-x-auto print:overflow-visible", className)}>
      <table className="w-full border-collapse print:text-[11px]">
        {children}
      </table>
    </div>
  );
}

/**
 * PrintTableHeader - Table header with print-optimized styling
 */
export function PrintTableHeader({
  children,
  className
}: Readonly<{
  children: React.ReactNode;
  className?: string
}>) {
  return (
    <thead className={cn("bg-gray-100 print:bg-gray-200", className)}>
      <tr>
        {children}
      </tr>
    </thead>
  );
}

/**
 * PrintTableCell - Table cell with print-optimized styling
 */
export function PrintTableCell({
  children,
  className,
  header = false
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  header?: boolean;
}>) {
  const Component = header ? 'th' : 'td';

  return (
    <Component
      className={cn(
        "px-4 py-3 text-sm border border-gray-200 print:border-gray-400 print:px-2 print:py-1.5",
        header ? "font-semibold text-gray-700 print:text-gray-900" : "text-gray-600 print:text-gray-800",
        className
      )}
    >
      {children}
    </Component>
  );
}

/**
 * PrintSection — wraps a section of the report to prevent page-break inside.
 */
export function PrintSection({
  children,
  title,
  className,
}: Readonly<{
  children: React.ReactNode;
  title?: string;
  className?: string;
}>) {
  return (
    <div className={cn('print-no-break', className)}>
      {title ? (
        <h3 className="text-sm font-bold text-foreground mb-2 print:text-gray-900">{title}</h3>
      ) : null}
      {children}
    </div>
  );
}
