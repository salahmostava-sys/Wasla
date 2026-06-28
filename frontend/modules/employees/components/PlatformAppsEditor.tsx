import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Checkbox } from '@shared/components/ui/checkbox';
import { useToast } from '@shared/hooks/use-toast';
import { employeeService } from '@services/employeeService';
import { getErrorMessage } from '@services/serviceError';

type PlatformApp = {
  id: string;
  name: string;
  brand_color?: string | null;
};

type PlatformAppsEditorProps = {
  employeeId: string;
  employeeName: string;
  currentApps: PlatformApp[];
  availableApps: PlatformApp[];
  onSuccess: () => void;
};

export function PlatformAppsEditor({
  employeeId,
  employeeName,
  currentApps,
  availableApps,
  onSuccess,
}: Readonly<PlatformAppsEditorProps>) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedAppIds, setSelectedAppIds] = useState<Set<string>>(
    new Set(currentApps.map(app => app.id))
  );
  const [saving, setSaving] = useState(false);

  // Sync selectedAppIds with currentApps when popover opens or currentApps change
  useEffect(() => {
    if (!open) {
      setSelectedAppIds(new Set(currentApps.map(app => app.id)));
    }
  }, [open, currentApps]);

  const handleToggleApp = (appId: string) => {
    setSelectedAppIds(prev => {
      const next = new Set(prev);
      if (next.has(appId)) {
        next.delete(appId);
      } else {
        next.add(appId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await employeeService.replaceEmployeeApps(employeeId, Array.from(selectedAppIds));
      toast({
        title: 'تم التحديث',
        description: `تم تحديث التطبيقات للموظف ${employeeName}`,
      });
      onSuccess();
      setOpen(false);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: getErrorMessage(error, 'فشل تحديث التطبيقات'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = () => {
    const current = new Set(currentApps.map(app => app.id));
    if (current.size !== selectedAppIds.size) return true;
    for (const id of selectedAppIds) {
      if (!current.has(id)) return true;
    }
    return false;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center justify-center gap-1 whitespace-nowrap transition-opacity hover:opacity-80">
          {currentApps.length > 0 ? (
            currentApps.map(app => (
              <span
                key={app.id}
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: app.brand_color || '#6366f1',
                  color: '#ffffff'
                }}
              >
                {app.name}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground/40 text-xs">•</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64" align="start" dir="rtl">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">اختيار التطبيقات</h4>
            {hasChanges() && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="h-7 px-2 text-xs"
              >
                {saving ? (
                  <Loader2 size={12} className="animate-spin me-1" />
                ) : (
                  <Check size={12} className="me-1" />
                )}
                حفظ
              </Button>
            )}
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {availableApps.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                لا توجد تطبيقات متاحة
              </p>
            ) : (
              availableApps.map(app => (
                <label
                  key={app.id}
                  className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedAppIds.has(app.id)}
                    onCheckedChange={() => handleToggleApp(app.id)}
                  />
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: app.brand_color || '#6366f1',
                      color: '#ffffff'
                    }}
                  >
                    {app.name}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

