import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group';
import type { App } from '@modules/orders/types';

type Props = Readonly<{
  open: boolean;
  apps: App[];
  onConfirm: (appId: string | undefined) => void;
  onCancel: () => void;
}>;

export function ImportPlatformDialog({ open, apps, onConfirm, onCancel }: Readonly<Props>) {
  const [selectedApp, setSelectedApp] = useState<string>('all');

  useEffect(() => {
    if (!open) return;
    setSelectedApp('all');
  }, [open]);

  useEffect(() => {
    if (selectedApp === 'all') return;
    if (apps.some((app) => app.id === selectedApp)) return;
    setSelectedApp('all');
  }, [apps, selectedApp]);

  const handleConfirm = () => {
    onConfirm(selectedApp === 'all' ? undefined : selectedApp);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>اختر المنصة المستهدفة</DialogTitle>
          <DialogDescription>
            اختر المنصة التي سيتم رفع الطلبات عليها. إذا كانت المنصة هجينة فسيتم استكمال جزء الدوام من صفحة الشفتات،
            أما هنا فهذه النافذة مخصصة لرفع الطلبات فقط.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <RadioGroup value={selectedApp} onValueChange={setSelectedApp}>
            <Label htmlFor="all" className="flex min-h-11 cursor-pointer items-center gap-2 font-medium mb-3">
              <RadioGroupItem value="all" id="all" />
              <span>جميع المنصات (السلوك القديم)</span>
            </Label>
            {apps.map((app) => (
              <Label key={app.id} htmlFor={app.id} className="flex min-h-11 cursor-pointer items-center gap-2 mb-2 rounded-md border px-3 py-2">
                <RadioGroupItem value={app.id} id={app.id} />
                {app.logo_url && (
                  <img src={app.logo_url} width={20} height={20} className="w-5 h-5 rounded-full object-cover" alt="" />
                )}
                <span>{app.name}</span>
              </Label>
            ))}
          </RadioGroup>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            إلغاء
          </Button>
          <Button onClick={handleConfirm}>
            متابعة الاستيراد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
