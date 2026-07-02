import { useEffect, useRef } from 'react';
import { loadJsPdf } from '@modules/salaries/lib/salaryPdfLoaders';
import { months } from '@modules/salaries/lib/salaryMonths';
import type { SalaryRow } from '@modules/salaries/types/salary.types';
import type JSZip from 'jszip';

// FIX P4: pre-warm the buildBatchSlipHTML module once at module load time.
// Previously it was dynamic-imported inside the setTimeout on EVERY iteration,
// which re-triggers the module resolution pipeline each time (even if cached).
// A single top-level import lets the bundler tree-shake and the runtime cache it.
const buildBatchSlipHTMLPromise = import('@modules/salaries/lib/buildBatchSlipHTML');

/**
 * Manages sequential batch PDF generation for salary slips.
 * Generates one PDF per row via iframe + jsPDF, adds to ZIP, then downloads.
 */
export function useBatchPdfExport(params: {
  batchQueue: SalaryRow[];
  batchIndex: number;
  batchZip: JSZip | null;
  selectedMonth: string;
  projectName: string;
  setBatchQueue: React.Dispatch<React.SetStateAction<SalaryRow[]>>;
  setBatchIndex: React.Dispatch<React.SetStateAction<number>>;
  setBatchZip: React.Dispatch<React.SetStateAction<JSZip | null>>;
  toast: (opts: { title: string }) => unknown;
}) {
  const {
    batchQueue, batchIndex, batchZip, selectedMonth, projectName,
    setBatchQueue, setBatchIndex, setBatchZip, toast,
  } = params;
  const batchAbortRef = useRef(false);
  // FIX W8: track the active iframe at hook level so cleanup can remove it on unmount/abort
  const activeIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    batchAbortRef.current = false;

    if (batchQueue.length === 0 || !batchZip) return;

    // All done — generate and download ZIP
    if (batchIndex >= batchQueue.length) {
      const [y, m] = selectedMonth.split('-');
      batchZip.generateAsync({ type: 'blob' }).then(blob => {
        if (batchAbortRef.current) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `كشوف_رواتب_${m}_${y}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: `✅ تم تحميل ${batchQueue.length} كشف راتب في ملف ZIP` });
        setBatchQueue([]);
        setBatchIndex(0);
        setBatchZip(null);
      });
      return;
    }

    // Process one slip at a time
    const timer = setTimeout(async () => {
      if (batchAbortRef.current) return;

      // FIX W3+W8: track iframe in both closure and ref so cleanup works on
      // unmount (ref) and on normal completion (closure).
      let iframe: HTMLIFrameElement | null = null;
      const safeRemoveIframe = () => {
        if (iframe) {
          try { iframe.remove(); } catch { /* ignore */ }
          iframe = null;
          activeIframeRef.current = null;
        }
      };

      try {
        const row = batchQueue[batchIndex];
        const { buildBatchSlipHTML } = await buildBatchSlipHTMLPromise;
        const monthLabel = months.find(m => m.v === selectedMonth)?.l || selectedMonth;
        const html = buildBatchSlipHTML(row, monthLabel, projectName);

        const JsPdf = await loadJsPdf();
        const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        iframe = document.createElement('iframe');
        iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:794px;height:1123px;border:none';
        activeIframeRef.current = iframe;
        document.body.appendChild(iframe);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        iframe.src = blobUrl;
        
        // Clean up Blob URL when iframe loads or unmounts, but we'll do it on load
        iframe.onload = () => URL.revokeObjectURL(blobUrl);

        await new Promise(resolve => setTimeout(resolve, 200));
        if (batchAbortRef.current) {
          safeRemoveIframe();
          return;
        }

        const container = iframe.contentDocument?.querySelector('.slip-container') as HTMLElement | null;
        if (container) {
          await pdf.html(container, { x: 5, y: 5, width: 190, windowWidth: 700 });
        }

        safeRemoveIframe();

        if (batchAbortRef.current) return;
        const pdfBlob = pdf.output('blob');
        const safeName = row.employeeName.replaceAll(/\s+/g, '_');
        const [y, m] = selectedMonth.split('-');
        batchZip.file(`كشف_راتب_${safeName}_${m}_${y}.pdf`, pdfBlob);
        setBatchIndex(i => i + 1);
      } catch {
        safeRemoveIframe();
        if (!batchAbortRef.current) setBatchIndex(i => i + 1);
      }
    }, 150);

    return () => {
      batchAbortRef.current = true;
      clearTimeout(timer);
      // FIX W8: remove any lingering iframe left from an in-progress render
      if (activeIframeRef.current) {
        try { activeIframeRef.current.remove(); } catch { /* ignore */ }
        activeIframeRef.current = null;
      }
    };
  }, [batchIndex, batchQueue, batchZip, selectedMonth, toast, projectName, setBatchQueue, setBatchIndex, setBatchZip]);
}
