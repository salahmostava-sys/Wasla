/**
 * Salary slip actions — Preview, Print, and PDF export.
 *
 * All three operate on a standalone HTML string produced by buildSalarySlipHTML().
 * No canvas or image capture involved.
 */

import DOMPurify from 'dompurify';

// ─── Preview in iframe ──────────────────────────────────────────────────────

/**
 * Render salary slip HTML inside an existing container element using an iframe.
 * The iframe is sandboxed and uses `srcdoc` for security.
 */
export function previewSlipInIframe(container: HTMLElement, html: string): void {
  // Clear previous content safely
  container.replaceChildren();

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.minHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.borderRadius = '8px';
  iframe.style.background = '#ffffff';
  iframe.sandbox.add('allow-same-origin');
  iframe.srcdoc = html;

  container.appendChild(iframe);
}

// ─── Print ──────────────────────────────────────────────────────────────────

/**
 * Open a hidden iframe, load the HTML, and trigger globalThis.print().
 * Automatically cleans up after printing.
 */
export function printSlipHTML(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '-10000px';
  iframe.style.width = '800px';
  iframe.style.height = '1200px';
  iframe.style.border = 'none';

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    iframe.remove();
    return;
  }

  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(html, 'text/html');
  iframeDoc.replaceChild(iframeDoc.adoptNode(parsedDoc.documentElement), iframeDoc.documentElement);

  // Wait for fonts to load, then print
  iframe.addEventListener('load', () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        // Fallback: open in new window
        const win = globalThis.open('', '_blank');
        if (win) {
          const parser = new DOMParser();
          const newDoc = parser.parseFromString(html, 'text/html');
          win.document.replaceChild(win.document.adoptNode(newDoc.documentElement), win.document.documentElement);
          win.document.close();
          win.print();
        }
      }
      // Cleanup after a delay to let the print dialog finish
      setTimeout(() => {
        try { iframe.remove(); } catch { /* already removed */ }
      }, 1000);
    }, 300);
  });
}

// ─── Export PDF ──────────────────────────────────────────────────────────────

/**
 * Export salary slip as PDF using an iframe-based print approach.
 *
 * This opens a new window with the HTML content and triggers the browser's
 * Save as PDF functionality via globalThis.print(). This approach:
 * - Produces pixel-perfect RTL Arabic output
 * - Has zero dependency on html2canvas or jsPDF for rendering
 * - Lets the browser handle PDF generation natively
 */
export function exportSlipPDF(html: string, filename: string): void {
  const printWindow = globalThis.open('', '_blank');
  if (!printWindow) {
    // Fallback: download as HTML file
    downloadAsHTML(html, filename.replaceAll('.pdf', '.html'));
    return;
  }

  const parser = new DOMParser();
  const newDoc = parser.parseFromString(html, 'text/html');
  printWindow.document.replaceChild(printWindow.document.adoptNode(newDoc.documentElement), printWindow.document.documentElement);
  printWindow.document.close();
  printWindow.document.title = filename.replaceAll('.pdf', '');

  // Wait for content to load, then trigger print
  printWindow.addEventListener('load', () => {
    setTimeout(() => {
      printWindow.print();
      // Don't auto-close — let the user control the print dialog
    }, 500);
  });
}

// ─── Export as Blob (for ZIP batching) ───────────────────────────────────────

/**
 * Convert salary slip HTML to a PDF Blob using jsPDF.
 * Used specifically for batch ZIP export where we need actual file blobs.
 */
export async function exportSlipToBlob(html: string, _filename: string): Promise<Blob> {
  // Use jsPDF with html plugin for blob generation
  const { default: JsPdf } = await import('jspdf');
  
  // Create a temporary hidden iframe to render the HTML
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '-10000px';
  iframe.style.width = '794px'; // A4 width in px at 96dpi
  iframe.style.height = '1123px'; // A4 height
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  return new Promise<Blob>((resolve, reject) => {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      iframe.remove();
      reject(new Error('Could not access iframe document'));
      return;
    }

    // Sanitize HTML to prevent XSS before injecting into iframe
    const cleanHtml = String(DOMPurify.sanitize(html));
    const parser = new DOMParser();
    const parsedDoc = parser.parseFromString(cleanHtml, 'text/html');
    iframeDoc.replaceChild(iframeDoc.adoptNode(parsedDoc.documentElement), iframeDoc.documentElement);

    iframe.addEventListener('load', async () => {
      try {
        const container = iframeDoc.querySelector('.slip-container') as HTMLElement;
        if (!container) {
          throw new Error('Slip container not found');
        }

        const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        await pdf.html(container, {
          callback: () => { /* no-op, handled below */ },
          x: 0,
          y: 0,
          width: 190,
          windowWidth: 700,
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        });

        const blob = pdf.output('blob');
        resolve(blob);
      } catch (e) {
        reject(e);
      } finally {
        try { iframe.remove(); } catch { /* ignore */ }
      }
    });
  });
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function downloadAsHTML(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
