import type React from 'react';
import { useState, useMemo } from 'react';
import { useLanguage } from '@app/providers/LanguageContext';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@shared/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Textarea } from '@shared/components/ui/textarea';
import { Button } from '@shared/components/ui/button';
import { Loader2, Search, Filter } from 'lucide-react';
import { Checkbox } from '@shared/components/ui/checkbox';
import type { AttendanceStatus, Employee } from './MonthlyRecord';
import { todayISO } from '@shared/lib/formatters';
import { filterEmployeesBySearchAndApp } from '../lib/attendanceDomain';

interface BulkAttendanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  apps: { id: string; name: string }[];
  employeeApps: { employee_id: string; app_id: string }[];
  isSaving: boolean;
  onSave: (data: {
    employeeIds: string[];
    date: string;
    status: AttendanceStatus;
    check_in: string | null;
    check_out: string | null;
    note: string | null;
  }) => void;
}

export function BulkAttendanceDialog({
  open,
  onOpenChange,
  employees,
  apps,
  employeeApps,
  isSaving,
  onSave,
}: Readonly<BulkAttendanceDialogProps>) {
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [note, setNote] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterAppId, setFilterAppId] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filteredEmployees = useMemo(() => {
    return filterEmployeesBySearchAndApp(employees, searchQuery, filterAppId, employeeApps);
  }, [employees, searchQuery, filterAppId, employeeApps]);

  const allSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedIds.has(e.id));
  const someSelected = filteredEmployees.some((e) => selectedIds.has(e.id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) {
      for (const e of filteredEmployees) next.delete(e.id);
    } else {
      for (const e of filteredEmployees) next.add(e.id);
    }
    setSelectedIds(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSave = () => {
    if (selectedIds.size === 0) return;
    onSave({
      employeeIds: Array.from(selectedIds),
      date,
      status,
      check_in: checkIn || null,
      check_out: checkOut || null,
      note: note || null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="sm:max-w-md w-full flex flex-col p-0" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-6 pb-4 border-b">
          <SheetHeader>
            <SheetTitle className="text-start">{t('bulkAttendance') || 'تسجيل حضور جماعي'}</SheetTitle>
            <SheetDescription className="text-start">
              {t('bulkAttendanceDesc') || 'تسجيل حالة الحضور لعدد من المناديب في يوم واحد.'}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('date')}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('status')}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">{t('present')}</SelectItem>
                    <SelectItem value="absent">{t('absent')}</SelectItem>
                    <SelectItem value="leave">{t('leave')}</SelectItem>
                    <SelectItem value="sick">{t('sick')}</SelectItem>
                    <SelectItem value="late">{t('late')}</SelectItem>
                    <SelectItem value="none">{t('unspecified')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('checkInTime')}</Label>
                <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('checkOutTime')}</Label>
                <Input type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('optionalNotePlaceholder')}
                rows={2}
              />
            </div>
          </div>

          <div className="flex flex-col flex-1 min-h-[400px] border border-border rounded-md">
            <div className="p-3 border-b border-border bg-muted/30 space-y-3">
              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder={t('searchByEmployeeName')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="ps-9 h-9 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterAppId} onValueChange={setFilterAppId}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder={t('filterByApp') || 'تصفية حسب التطبيق'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('allApps') || 'جميع التطبيقات'}</SelectItem>
                    {apps.map((app) => (
                      <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-2 border-b border-border bg-muted/10 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium">
                <Checkbox
                  checked={allSelected}
                  ref={(ref) => {
                    if (ref) {
                      ref.indeterminate = !allSelected && someSelected;
                    }
                  }}
                  onCheckedChange={toggleAll}
                />
                <span>{t('selectAll')} ({filteredEmployees.length})</span>
              </label>
              <span className="text-xs text-muted-foreground">
                {t('selectedCount', { count: selectedIds.size }) || `محدد: ${selectedIds.size}`}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {filteredEmployees.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {t('noMatchingEmployees')}
                </div>
              ) : (
                filteredEmployees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                  >
                    <Checkbox checked={selectedIds.has(emp.id)} onCheckedChange={() => toggleOne(emp.id)} />
                    <span className="text-sm">{emp.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-background mt-auto flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving || selectedIds.size === 0}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin ms-2" /> : null}
            {t('saveRecord')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
