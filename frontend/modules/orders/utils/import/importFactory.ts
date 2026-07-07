import { MatrixImportStrategy } from './matrixStrategy';
import { ListImportStrategy } from './listStrategy';
import type { SpreadsheetImportStrategy } from './strategy';

export class ImportFactory {
  static detectStrategy(headers: string[]): SpreadsheetImportStrategy | null {
    if (!headers || headers.length === 0) return null;

    const normalizedHeaders = headers.map((h) => String(h || '').toLowerCase().trim());

    // Matrix format check: usually first column is Employee name, followed by days (1, 2, 3...)
    const hasNumericHeaders = normalizedHeaders.some((h) => {
      const num = Number(h);
      return !Number.isNaN(num) && num >= 1 && num <= 31;
    });

    if (hasNumericHeaders) {
      return new MatrixImportStrategy();
    }

    // List format check: expect words like "تاريخ", "يوم", "طلبات"
    const hasDateOrDay = normalizedHeaders.some(
      (h) => h.includes('تاريخ') || h.includes('يوم') || h.includes('date') || h.includes('day')
    );
    const hasCount = normalizedHeaders.some(
      (h) => h.includes('طلبات') || h.includes('عدد') || h.includes('orders') || h.includes('count')
    );

    // If it has list-like headers, or it just has exactly 3 columns (Name, Date, Orders)
    if (hasDateOrDay || hasCount || normalizedHeaders.length === 3) {
      return new ListImportStrategy();
    }

    return null;
  }
}
