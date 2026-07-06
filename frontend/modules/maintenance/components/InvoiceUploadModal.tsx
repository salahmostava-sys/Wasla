import { BaseInput } from '@shared/components/ui/base-input';
import { useRef, useState } from 'react';
import { FileText, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { useToast } from '@shared/hooks/use-toast';
import { extractTextFromImage, parseInvoiceLineItems, type OcrProgress } from '@services/ocrService';
import { storageService } from '@services/storageService';
import * as maintenanceService from '@services/maintenanceService';
import { getErrorMessage } from '@services/serviceError';

type DraftRow = { name: string; quantity: string; unitPrice: string };

const emptyRow = (): DraftRow => ({ name: '', quantity: '1', unitPrice: '' });

export function InvoiceUploadModal({
  open,
  onOpenChange,
  onSaved,
}: Readonly<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}>) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [supplier, setSupplier] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setFile(null);
    setInvoiceNumber('');
    setInvoiceDate('');
    setSupplier('');
    setRows([]);
    setProgress(null);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setRows([]);
    if (!picked) return;

    if (!picked.type.startsWith('image/')) {
      toast({
        title: 'صيغة غير مدعومة للتعرف التلقائي',
        description: 'التعرّف التلقائي على البيانات يعمل مع صور الفواتير (JPG/PNG). أضف البنود يدوياً بالأسفل.',
      });
      setRows([emptyRow()]);
      return;
    }

    setExtracting(true);
    try {
      const rawText = await extractTextFromImage(picked, setProgress);
      const parsed = parseInvoiceLineItems(rawText);
      if (parsed.length === 0) {
        toast({ title: 'لم يتم التعرف على بنود بشكل مؤكد', description: 'أضف بنود الفاتورة يدوياً بالأسفل.' });
        setRows([emptyRow()]);
      } else {
        setRows(parsed.map(p => ({ name: p.name, quantity: String(p.quantity), unitPrice: String(p.unitPrice) })));
        toast({ title: `✅ تم التعرف على ${parsed.length} صنف`, description: 'راجع البيانات وعدّلها قبل الحفظ.' });
      }
    } catch (err) {
      toast({ title: 'تعذر استخراج بيانات الفاتورة', description: getErrorMessage(err), variant: 'destructive' });
      setRows([emptyRow()]);
    } finally {
      setExtracting(false);
      setProgress(null);
    }
  };

  const setRow = (idx: number, field: keyof DraftRow, val: string) =>
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = rows.reduce(
    (sum, r) => sum + (Number.parseFloat(r.quantity) || 0) * (Number.parseFloat(r.unitPrice) || 0),
    0
  );

  const handleSave = async () => {
    const validRows = rows.filter(r => r.name.trim() && Number.parseFloat(r.quantity) > 0);
    if (validRows.length === 0) {
      toast({ title: 'أضف صنفاً واحداً على الأقل باسم وكمية صحيحة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let invoiceAttachmentUrl: string | null = null;
      if (file) {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const randomPart = crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
        const fileName = `${Date.now()}-${randomPart}.${ext}`;
        invoiceAttachmentUrl = await storageService.uploadFile('invoice-attachments', fileName, file);
      }

      for (const row of validRows) {
        await maintenanceService.createSparePart({
          name_ar: row.name.trim(),
          stock_quantity: Number.parseFloat(row.quantity) || 0,
          unit_cost: Number.parseFloat(row.unitPrice) || 0,
          unit: 'قطعة',
          supplier: supplier.trim() || null,
          invoice_number: invoiceNumber.trim() || null,
          invoice_date: invoiceDate || null,
          invoice_attachment_url: invoiceAttachmentUrl,
        });
      }

      toast({ title: `✅ تمت إضافة ${validRows.length} صنف للمخزون`, description: 'تم ربط كل صنف برقم الفاتورة المدخل.' });
      onSaved();
      close();
    } catch (err) {
      toast({ title: 'خطأ أثناء الحفظ', description: getErrorMessage(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => (v ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            رفع فاتورة وإضافة قطع الغيار تلقائياً
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File picker */}
          <div className="space-y-1.5">
            <Label>صورة الفاتورة</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <UploadCloud size={16} />
              {file ? file.name : 'اضغط لاختيار صورة الفاتورة (JPG/PNG)'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
            {extracting && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" />
                {progress?.status ?? 'جاري التحليل...'}
              </p>
            )}
          </div>

          {/* Invoice meta */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>رقم الفاتورة</Label>
              <Input placeholder="مثال: INV-2026-014" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} />
            </div>
            <BaseInput label="تاريخ الفاتورة" type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            <BaseInput label="المورد" placeholder="اسم المحل / الشركة" value={supplier} onChange={e => setSupplier(e.target.value)} />
          </div>

          {/* Line items table */}
          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>بنود الفاتورة (راجع وعدّل قبل الحفظ)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow} className="gap-1">
                  <Plus size={13} /> إضافة صنف
                </Button>
              </div>
              <div className="border border-border/60 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-right">
                      <th className="p-2 font-semibold text-muted-foreground">اسم القطعة</th>
                      <th className="p-2 font-semibold text-muted-foreground w-20">الكمية</th>
                      <th className="p-2 font-semibold text-muted-foreground w-24">السعر</th>
                      <th className="p-2 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {rows.map((row, idx) => (
                      <tr key={`invoice-row-${idx}`}>
                        <td className="p-1.5">
                          <Input value={row.name} onChange={e => setRow(idx, 'name', e.target.value)} placeholder="اسم القطعة" />
                        </td>
                        <td className="p-1.5">
                          <Input type="number" min="0" step="1" value={row.quantity} onChange={e => setRow(idx, 'quantity', e.target.value)} />
                        </td>
                        <td className="p-1.5">
                          <Input type="number" min="0" step="0.01" value={row.unitPrice} onChange={e => setRow(idx, 'unitPrice', e.target.value)} />
                        </td>
                        <td className="p-1.5 text-center">
                          <button type="button" onClick={() => removeRow(idx)} className="text-muted-foreground hover:text-destructive p-1 rounded hover:bg-muted">
                            <Trash2 size={13} className="text-destructive" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground text-left">
                إجمالي الفاتورة المدخل: <span className="font-semibold text-foreground">{totalAmount.toLocaleString('en-US')}</span> ر.س
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={close}>إلغاء</Button>
          <Button onClick={handleSave} disabled={saving || extracting || rows.length === 0}>
            {saving ? 'جاري الحفظ...' : '✅ إضافة الأصناف للمخزون'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
