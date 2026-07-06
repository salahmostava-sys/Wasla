import { BaseInput } from '@shared/components/ui/base-input';
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { Textarea } from '@shared/components/ui/textarea';
import { toast } from '@shared/components/ui/sonner';
import walletService from '@services/walletService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: { id: string; name: string };
  type: 'collection' | 'deposit';
  onSuccess: () => void;
}

const WalletTransactionModal = ({ open, onOpenChange, employee, type, onSuccess }: Props) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  const isCollection = type === 'collection';
  const title = isCollection ? `تسجيل استلام كاش - ${employee.name}` : `تسجيل شحن المحفظة - ${employee.name}`;
  const btnLabel = isCollection ? 'تسجيل الكاش' : 'تأكيد الشحن';

  const mutation = useMutation({
    mutationFn: async () => {
      const numAmount = Number.parseFloat(amount);
      if (Number.isNaN(numAmount) || numAmount <= 0) throw new Error('المبلغ غير صحيح');
      
      await walletService.addTransaction({
        employee_id: employee.id,
        transaction_type: type,
        amount: numAmount,
        transaction_date: date,
        notes: notes || null,
      });
    },
    onSuccess: () => {
      toast.success('تم تسجيل الحركة بنجاح');
      setAmount('');
      setNotes('');
      setDate(format(new Date(), 'yyyy-MM-dd'));
      onSuccess();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-start">{title}</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <BaseInput label="المبلغ (ريال)" id="amount"
              type="number"
              min="1"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="مثال: 150.5"
              autoFocus />

          <BaseInput label="التاريخ" id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)} />

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل إضافية..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-start">
          <Button 
            className="w-full sm:w-auto"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !amount}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {btnLabel}
          </Button>
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WalletTransactionModal;
