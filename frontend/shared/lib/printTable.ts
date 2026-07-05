/**
 * Open a print dialog with a cloned table (RTL-friendly).
 */
export function printHtmlTable(
  table: HTMLTableElement,
  options: { title: string; subtitle?: string }
): void {
  const { title, subtitle } = options;
  // Validate inputs
  if (!table || !(table instanceof HTMLTableElement)) {
    throw new Error('Invalid table element');
  }
  if (!options.title || typeof options.title !== 'string') {
    throw new Error('Title is required');
  }
  
  // Create a hidden iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error('Failed to create print iframe');
  }

  doc.open();
  doc.close();
  doc.documentElement.lang = 'ar';
  doc.documentElement.dir = 'rtl';

  const head = doc.head;
  const body = doc.body;
  if (!head || !body) return;

  const meta = doc.createElement('meta');
  meta.setAttribute('charset', 'UTF-8');
  head.appendChild(meta);

  const titleEl = doc.createElement('title');
  titleEl.textContent = title;
  head.appendChild(titleEl);

  const style = doc.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; direction: rtl; color: #111; background: white; }
    h2 { text-align: center; margin-bottom: 8px; font-size: 15px; }
    p.subtitle { text-align: center; color: #666; font-size: 11px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: right; font-size: 10px; white-space: nowrap; }
    td { padding: 5px 8px; border-bottom: 1px solid #e0e0e0; text-align: right; white-space: nowrap; vertical-align: middle; }
    tr:nth-child(even) td { background: #f9f9f9; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print-table-export { display: none !important; }
    }
  `;
  head.appendChild(style);

  const h2 = doc.createElement('h2');
  h2.textContent = title;
  body.appendChild(h2);

  if (subtitle) {
    const sub = doc.createElement('p');
    sub.className = 'subtitle';
    sub.textContent = subtitle;
    body.appendChild(sub);
  }

  body.appendChild(table.cloneNode(true));

  // Print using the iframe's content window
  const contentWindow = iframe.contentWindow;
  if (contentWindow) {
    contentWindow.focus();
    // Use setTimeout to ensure styles are applied and table is fully rendered
    setTimeout(() => {
      contentWindow.print();
      // Clean up after print dialog is closed
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          iframe.remove();
        }
      }, 500);
    }, 200);
  } else if (document.body.contains(iframe)) {
    iframe.remove();
  }
}
