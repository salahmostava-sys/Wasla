import { Plus, Smartphone } from 'lucide-react';
import { Button } from '@shared/components/ui/button';

interface AppsPageHeaderProps {
  canEdit: boolean;
  onAdd: () => void;
}

export const AppsPageHeader = ({ canEdit, onAdd }: Readonly<AppsPageHeaderProps>) => {
  return (
    <div className="flex flex-col gap-4 -2xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between rounded-2xl">
      <div>
        <nav className="mb-1 flex items-center gap-1 text-xs text-muted-foreground/80">
          <span>الرئيسية</span>
          <span className="opacity-50">/</span>
          <span className="font-medium text-muted-foreground">التطبيقات</span>
        </nav>
        <h1 className="flex items-center gap-2 text-xl font-black text-foreground">
          <Smartphone size={22} className="text-primary" />
          أرشيف المنصات والتطبيقات
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground/80">
          إدارة تفعيل المنصات ومتابعة أدائها التاريخي
        </p>
      </div>

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button onClick={onAdd} className="gap-2 shadow-sm" type="button">
            <Plus size={16} /> إضافة منصة
          </Button>
        </div>
      )}
    </div>
  );
};
