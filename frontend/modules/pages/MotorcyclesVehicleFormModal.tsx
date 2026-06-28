import { useEffect, useState } from 'react';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import { Input } from '@shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Switch } from '@shared/components/ui/switch';
import { useToast } from '@shared/hooks/use-toast';
import { vehicleService } from '@services/vehicleService';
import { logError } from '@shared/lib/logger';
import { ALL_STATUSES, statusLabels, type Vehicle, type VehicleStatus } from '@modules/pages/motorcycles.shared';
import { getErrorMessage } from '@services/serviceError';

type VehicleFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editVehicle?: Vehicle | null;
};

type VehicleFormState = {
  plate_number: string;
  plate_number_en: string;
  type: 'motorcycle' | 'car';
  brand: string;
  model: string;
  year: string;
  status: VehicleStatus;
  has_fuel_chip: boolean;
  insurance_expiry: string;
  registration_expiry: string;
  authorization_expiry: string;
  chassis_number: string;
  serial_number: string;
  notes: string;
};

const EMPTY_FORM: VehicleFormState = {
  plate_number: '',
  plate_number_en: '',
  type: 'motorcycle',
  brand: '',
  model: '',
  year: '',
  status: 'active',
  has_fuel_chip: false,
  insurance_expiry: '',
  registration_expiry: '',
  authorization_expiry: '',
  chassis_number: '',
  serial_number: '',
  notes: '',
};

export function VehicleFormModal({ open, onClose, onSaved, editVehicle }: Readonly<VehicleFormModalProps>) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<VehicleFormState>(EMPTY_FORM);

  useEffect(() => {
    if (!editVehicle) {
      setForm(EMPTY_FORM);
      return;
    }

    setForm({
      plate_number: editVehicle.plate_number,
      plate_number_en: editVehicle.plate_number_en ?? '',
      type: editVehicle.type,
      brand: editVehicle.brand ?? '',
      model: editVehicle.model ?? '',
      year: editVehicle.year?.toString() || '',
      status: editVehicle.status,
      has_fuel_chip: editVehicle.has_fuel_chip ?? false,
      insurance_expiry: editVehicle.insurance_expiry ?? '',
      registration_expiry: editVehicle.registration_expiry ?? '',
      authorization_expiry: editVehicle.authorization_expiry ?? '',
      chassis_number: editVehicle.chassis_number ?? '',
      serial_number: editVehicle.serial_number ?? '',
      notes: editVehicle.notes ?? '',
    });
  }, [editVehicle, open]);

  let saveButtonLabel = 'إضافة المركبة';
  if (saving) {
    saveButtonLabel = 'جاري الحفظ...';
  } else if (editVehicle) {
    saveButtonLabel = 'حفظ التعديلات';
  }

  const handleSave = async () => {
    if (!form.plate_number.trim()) {
      toast({ title: 'يرجى إدخال رقم اللوحة', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        plate_number: form.plate_number.trim(),
        plate_number_en: form.plate_number_en.trim() || null,
        type: form.type,
        brand: form.brand || null,
        model: form.model || null,
        year: form.year ? Number.parseInt(form.year, 10) : null,
        status: form.status,
        has_fuel_chip: form.has_fuel_chip,
        insurance_expiry: form.insurance_expiry || null,
        registration_expiry: form.registration_expiry || null,
        authorization_expiry: form.authorization_expiry || null,
        chassis_number: form.chassis_number.trim() || null,
        serial_number: form.serial_number.trim() || null,
        notes: form.notes || null,
      };

      if (editVehicle) {
        await vehicleService.update(editVehicle.id, payload);
      } else {
        await vehicleService.create(payload);
      }

      toast({ title: editVehicle ? 'تم تحديث المركبة' : 'تم إضافة المركبة بنجاح' });
      onSaved();
      onClose();
    } catch (error) {
      logError('[Motorcycles] action failed', error);
      const message = getErrorMessage(error, 'حدث خطأ غير متوقع');
      toast({ title: 'حدث خطأ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle>{editVehicle ? 'تعديل بيانات المركبة' : 'إضافة مركبة جديدة'}</DialogTitle>
        </DialogHeader>
        <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1">
          <div>
            <label htmlFor="vehicle-plate-ar" className="mb-1 block text-sm font-medium">رقم اللوحة (عربي) *</label>
            <Input
              id="vehicle-plate-ar"
              value={form.plate_number}
              onChange={(event) => setForm((previous) => ({ ...previous, plate_number: event.target.value }))}
              placeholder="مثال: أ ب ج 1234"
            />
          </div>
          <div>
            <label htmlFor="vehicle-plate-en" className="mb-1 block text-sm font-medium">رقم اللوحة (إنجليزي)</label>
            <Input
              id="vehicle-plate-en"
              value={form.plate_number_en}
              onChange={(event) => setForm((previous) => ({ ...previous, plate_number_en: event.target.value }))}
              placeholder="AD 2469"
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="vehicle-type" className="mb-1 block text-sm font-medium">النوع</label>
            <Select value={form.type} onValueChange={(value) => setForm((previous) => ({ ...previous, type: value as 'motorcycle' | 'car' }))}>
              <SelectTrigger id="vehicle-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="motorcycle">دباب</SelectItem>
                <SelectItem value="car">سيارة</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="vehicle-status" className="mb-1 block text-sm font-medium">الحالة</label>
            <Select value={form.status} onValueChange={(value) => setForm((previous) => ({ ...previous, status: value as VehicleStatus }))}>
              <SelectTrigger id="vehicle-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="vehicle-brand" className="mb-1 block text-sm font-medium">الماركة</label>
            <Input
              id="vehicle-brand"
              value={form.brand}
              onChange={(event) => setForm((previous) => ({ ...previous, brand: event.target.value }))}
              placeholder="Honda, Yamaha..."
            />
          </div>
          <div>
            <label htmlFor="vehicle-model" className="mb-1 block text-sm font-medium">الموديل</label>
            <Input
              id="vehicle-model"
              value={form.model}
              onChange={(event) => setForm((previous) => ({ ...previous, model: event.target.value }))}
              placeholder="CG125, R15..."
            />
          </div>
          <div>
            <label htmlFor="vehicle-year" className="mb-1 block text-sm font-medium">سنة الصنع</label>
            <Input
              id="vehicle-year"
              type="number"
              value={form.year}
              onChange={(event) => setForm((previous) => ({ ...previous, year: event.target.value }))}
              placeholder="2022"
            />
          </div>
          <div>
            <label htmlFor="vehicle-serial" className="mb-1 block text-sm font-medium">الرقم التسلسلي</label>
            <Input
              id="vehicle-serial"
              value={form.serial_number}
              onChange={(event) => setForm((previous) => ({ ...previous, serial_number: event.target.value }))}
              placeholder="333974020"
              dir="ltr"
            />
          </div>
          <div className="col-span-2">
            <label htmlFor="vehicle-chassis" className="mb-1 block text-sm font-medium">رقم الهيكل</label>
            <Input
              id="vehicle-chassis"
              value={form.chassis_number}
              onChange={(event) => setForm((previous) => ({ ...previous, chassis_number: event.target.value }))}
              placeholder="ME4KC20F1NA014818"
              dir="ltr"
            />
          </div>
          <div>
            <label htmlFor="vehicle-insurance-expiry" className="mb-1 block text-sm font-medium">انتهاء التأمين</label>
            <Input
              id="vehicle-insurance-expiry"
              type="date"
              value={form.insurance_expiry}
              onChange={(event) => setForm((previous) => ({ ...previous, insurance_expiry: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="vehicle-registration-expiry" className="mb-1 block text-sm font-medium">انتهاء التسجيل</label>
            <Input
              id="vehicle-registration-expiry"
              type="date"
              value={form.registration_expiry}
              onChange={(event) => setForm((previous) => ({ ...previous, registration_expiry: event.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="vehicle-authorization-expiry" className="mb-1 block text-sm font-medium">انتهاء التفويض</label>
            <Input
              id="vehicle-authorization-expiry"
              type="date"
              value={form.authorization_expiry}
              onChange={(event) => setForm((previous) => ({ ...previous, authorization_expiry: event.target.value }))}
            />
          </div>
          <div className="col-span-2 flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
            <span className="text-lg">⛽</span>
            <span className="flex-1 text-sm font-medium">شريحة البنزين</span>
            <Switch
              checked={form.has_fuel_chip}
              onCheckedChange={(checked) => setForm((previous) => ({ ...previous, has_fuel_chip: checked }))}
              aria-label="تبديل شريحة البنزين"
            />
            <span className={`text-xs font-semibold ${form.has_fuel_chip ? 'text-primary' : 'text-muted-foreground'}`}>
              {form.has_fuel_chip ? 'يوجد' : 'لا يوجد'}
            </span>
          </div>
          <div className="col-span-2">
            <label htmlFor="vehicle-notes" className="mb-1 block text-sm font-medium">ملاحظات</label>
            <Input
              id="vehicle-notes"
              value={form.notes}
              onChange={(event) => setForm((previous) => ({ ...previous, notes: event.target.value }))}
              placeholder="أي ملاحظات إضافية..."
            />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => { handleSave(); }} disabled={saving}>{saveButtonLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
