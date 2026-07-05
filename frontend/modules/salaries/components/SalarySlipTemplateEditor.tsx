import { useState, useEffect, useRef, useCallback } from 'react';
import { Save, Plus, Trash2, Eye, Layout, Type, Columns, CheckCircle2, Loader2, Settings2 } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Textarea } from '@shared/components/ui/textarea';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@shared/components/ui/card';
import { ScrollArea } from '@shared/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { toast } from '@shared/components/ui/sonner';
import { salarySlipTemplateService, SalarySlipTemplate } from '@services/salarySlipTemplateService';
import { buildSalarySlipHTML } from '../lib/buildSalarySlipHTML';
import { previewSlipInIframe } from '../lib/salarySlipActions';

const MOCK_PREVIEW_DATA = {
  employee: {
    name: 'أحمد محمد',
    nationalId: '1234567890',
    jobTitle: 'مندوب توصيل',
    city: 'الرياض',
    month: 'مارس 2026',
    status: 'approved' as const,
    paymentMethod: 'تحويل بنكي',
  },
  fields: [
    { key: 'name', label: 'الاسم', value: 'أحمد محمد', type: 'info' as const },
    { key: 'nationalId', label: 'رقم الهوية', value: '1234567890', type: 'info' as const },
    { key: 'city', label: 'المدينة', value: 'الرياض', type: 'info' as const },
    { key: 'month', label: 'الشهر', value: 'مارس 2026', type: 'info' as const },
    { key: 'status', label: 'الحالة', value: 'معتمد', type: 'info' as const },
    { key: 'paymentMethod', label: 'طريقة الصرف', value: 'تحويل بنكي', type: 'info' as const },
    { key: 'orders', label: 'الطلبات', value: 150, type: 'earning' as const },
    { key: 'platformTotal', label: 'إجمالي المنصات', value: 2250, type: 'total' as const },
    { key: 'incentives', label: 'الحوافز', value: 500, type: 'earning' as const },
    { key: 'sickAllowance', label: 'بدل مرضي', value: 0, type: 'earning' as const },
    { key: 'advanceInstallment', label: 'قسط سلفة', value: 200, type: 'deduction' as const },
    { key: 'violations', label: 'المخالفات', value: 50, type: 'deduction' as const },
    { key: 'netSalary', label: 'الصافي', value: 3500, type: 'net' as const },
    { key: 'transfer', label: 'التحويل', value: 3500, type: 'total' as const },
  ],
  platforms: [
    { name: 'HungerStation', orders: 100, salary: 1500 },
    { name: 'Jahez', orders: 50, salary: 750 },
  ],
};

const AVAILABLE_COLUMNS = [
  { key: 'name', label: 'الاسم' },
  { key: 'nationalId', label: 'رقم الهوية' },
  { key: 'city', label: 'المدينة' },
  { key: 'month', label: 'الشهر' },
  { key: 'status', label: 'الحالة' },
  { key: 'paymentMethod', label: 'طريقة الصرف' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'platformTotal', label: 'إجمالي المنصات' },
  { key: 'incentives', label: 'الحوافز' },
  { key: 'sickAllowance', label: 'بدل مرضي' },
  { key: 'advanceInstallment', label: 'قسط سلفة' },
  { key: 'violations', label: 'المخالفات' },
  { key: 'netSalary', label: 'الصافي' },
  { key: 'transfer', label: 'التحويل' },
];

export function SalarySlipTemplateEditor() {
  const [activeTab, setActiveTab] = useState('editor');
  const [templates, setTemplates] = useState<SalarySlipTemplate[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<Partial<SalarySlipTemplate>>({
    name: '',
    header_html: '',
    footer_html: '',
    selected_columns: AVAILABLE_COLUMNS.map(c => c.key),
    is_default: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX #11: use cancellation flag to prevent setState on unmounted component
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await salarySlipTemplateService.getAll();
        if (cancelled) return;
        setTemplates(data);
        if (data.length > 0) {
          const def = data.find(t => t.is_default) || data[0];
          setCurrentTemplate(def);
        }
      } catch {
        if (!cancelled) toast.error('فشل تحميل القوالب');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const data = await salarySlipTemplateService.getAll();
      setTemplates(data);
      if (data.length > 0) {
        const def = data.find(t => t.is_default) || data[0];
        setCurrentTemplate(def);
      }
    } catch {
      toast.error('فشل تحميل القوالب');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentTemplate.name) {
      toast.error('يرجى إدخال اسم القالب');
      return;
    }
    setSaving(true);
    try {
      if (currentTemplate.id) {
        await salarySlipTemplateService.update(currentTemplate.id, currentTemplate);
        toast.success('تم تحديث القالب بنجاح');
      } else {
        const created = await salarySlipTemplateService.create({
          name: currentTemplate.name ?? '',
          header_html: currentTemplate.header_html ?? '',
          footer_html: currentTemplate.footer_html ?? '',
          selected_columns: currentTemplate.selected_columns ?? [],
          is_default: currentTemplate.is_default ?? false,
        });
        setCurrentTemplate(created);
        toast.success('تم إنشاء القالب بنجاح');
      }
      loadTemplates();
    } catch {
      toast.error('فشل حفظ القالب');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!globalThis.confirm('هل أنت متأكد من حذف هذا القالب؟')) return;
    try {
      await salarySlipTemplateService.delete(id);
      toast.success('تم حذف القالب');
      loadTemplates();
    } catch {
      toast.error('فشل حذف القالب');
    }
  };

  const getSelectedColumns = useCallback((): string[] => {
    const cols = currentTemplate.selected_columns;
    if (Array.isArray(cols)) return cols;
    return [];
  }, [currentTemplate.selected_columns]);

  const toggleColumn = (key: string) => {
    const cols = getSelectedColumns();
    if (cols.includes(key)) {
      setCurrentTemplate({ ...currentTemplate, selected_columns: cols.filter(c => c !== key) });
    } else {
      setCurrentTemplate({ ...currentTemplate, selected_columns: [...cols, key] });
    }
  };

  const updatePreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      if (previewRef.current) {
        const html = buildSalarySlipHTML({
          ...MOCK_PREVIEW_DATA,
          template: {
            header_html: currentTemplate.header_html,
            footer_html: currentTemplate.footer_html,
            selected_columns: getSelectedColumns(),
          },
        });
        previewSlipInIframe(previewRef.current, html);
      }
    }, 300);
  }, [currentTemplate.header_html, currentTemplate.footer_html, getSelectedColumns]);

  useEffect(() => {
    if (activeTab === 'preview') {
      updatePreview();
    }
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [updatePreview, activeTab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-4">
      {/* Sidebar: Template List */}
      <div className="lg:col-span-3 space-y-4">
        <Card className="border-primary/20 shadow-sm overflow-hidden bg-white/50 backdrop-blur-sm">
          <CardHeader className="pb-3 bg-primary/5">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Layout size={16} /> القوالب المتاحة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 space-y-1">
            {templates.map(t => (
              <button
                key={t.id}
                type="button"
                className={`w-full flex items-center justify-between p-2 rounded-md transition-colors text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                  currentTemplate.id === t.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted'
                }`}
                onClick={() => setCurrentTemplate(t)}
              >
                <div className="flex items-center gap-2 truncate">
                  {t.is_default && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                  <span className="truncate text-sm">{t.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (t.id) handleDelete(t.id);
                  }}
                  aria-label={`حذف قالب ${t.name}`}
                >
                  <Trash2 size={14} />
                </Button>
              </button>
            ))}
            <Button
              variant="default"
              className="w-full mt-2 gap-2 text-primary border-primary/20 hover:bg-primary/5"
              size="sm"
              onClick={() => setCurrentTemplate({
                name: 'قالب جديد',
                header_html: '',
                footer_html: '',
                selected_columns: AVAILABLE_COLUMNS.map(c => c.key),
                is_default: false,
              })}
            >
              <Plus size={14} /> إضافة قالب
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Columns size={14} /> الأعمدة المختارة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {AVAILABLE_COLUMNS.map(col => (
                  <div key={col.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={getSelectedColumns().includes(col.key)}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    <label htmlFor={`col-${col.key}`} className="text-sm cursor-pointer select-none">
                      {col.label}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Editor & Preview */}
      <div className="lg:col-span-9 space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center bg-white p-2 rounded-t-lg border border-b-0">
            <TabsList className="grid w-[400px] grid-cols-2">
              <TabsTrigger value="editor" className="gap-2"><Settings2 size={16} /> المحرر</TabsTrigger>
              <TabsTrigger value="preview" className="gap-2"><Eye size={16} /> المعاينة</TabsTrigger>
            </TabsList>
            <div className="flex gap-2">
              <Button
                variant={currentTemplate.is_default ? 'secondary' : 'outline'}
                size="sm"
                className="gap-2"
                onClick={() => setCurrentTemplate({ ...currentTemplate, is_default: !currentTemplate.is_default })}
              >
                {currentTemplate.is_default ? 'قالب افتراضي' : 'تعيين كافتراضي'}
              </Button>
              <Button size="sm" className="gap-2 shadow-card rounded-2xl" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                حفظ التغييرات
              </Button>
            </div>
          </div>

          <Card className="rounded-t-none border-t-0 shadow-xl min-h-[600px]">
            <TabsContent value="editor" className="m-0 p-6 space-y-6">
              <div className="space-y-2">
                <label htmlFor="template_name" className="text-sm font-bold flex items-center gap-2"><Type size={14} /> اسم القالب</label>
                <Input
                  id="template_name"
                  value={currentTemplate.name}
                  onChange={e => setCurrentTemplate({ ...currentTemplate, name: e.target.value })}
                  placeholder="مثال: قالب الشركات، قالب المناديب المقيمين..."
                  className="bg-primary/5 border-primary/10"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="header_html" className="text-sm font-bold flex items-center gap-2"><Layout size={14} /> كود HTML للهيدر (Header)</label>
                  <CardDescription className="text-xs mb-1">اترك فارغاً لاستخدام الهيدر الافتراضي</CardDescription>
                  <Textarea
                    id="header_html"
                    value={currentTemplate.header_html ?? ''}
                    onChange={e => setCurrentTemplate({ ...currentTemplate, header_html: e.target.value })}
                    placeholder="<div class='header'>...</div>"
                    className="font-mono text-xs min-h-[250px] bg-slate-950 text-emerald-400 border-slate-800"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="footer_html" className="text-sm font-bold flex items-center gap-2"><Layout size={14} /> كود HTML للفوتر (Footer)</label>
                  <CardDescription className="text-xs mb-1">اترك فارغاً لاستخدام الفوتر الافتراضي</CardDescription>
                  <Textarea
                    id="footer_html"
                    value={currentTemplate.footer_html ?? ''}
                    onChange={e => setCurrentTemplate({ ...currentTemplate, footer_html: e.target.value })}
                    placeholder="<div class='footer'>...</div>"
                    className="font-mono text-xs min-h-[250px] bg-slate-950 text-amber-400 border-slate-800"
                    dir="ltr"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="m-0 p-4 bg-muted/30">
              <div
                ref={previewRef}
                className="rounded-lg border border-border overflow-hidden bg-white shadow-inner mx-auto max-w-[800px]"
                style={{ minHeight: 600 }}
              />
            </TabsContent>
          </Card>
        </Tabs>
      </div>
    </div>
  );
}
