import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, ClipboardList, Banknote, UserCheck } from 'lucide-react';
import { Button } from '@shared/components/ui/button';

type QuickAction = {
  icon: React.ReactNode;
  label: string;
  to: string;
  variant?: 'default' | 'outline' | 'secondary';
};

const ACTIONS: QuickAction[] = [
  {
    icon: <ClipboardList size={16} />,
    label: 'إضافة طلب',
    to: '/orders',
    variant: 'default',
  },
  {
    icon: <UserCheck size={16} />,
    label: 'تسجيل حضور',
    to: '/attendance',
    variant: 'secondary',
  },
  {
    icon: <Banknote size={16} />,
    label: 'طلب سلفة',
    to: '/advances',
    variant: 'outline',
  },
  {
    icon: <PlusCircle size={16} />,
    label: 'موظف جديد',
    to: '/employees?new=1',
    variant: 'outline',
  },
];

/**
 * QuickActions — أزرار سريعة على لوحة التحكم للعمليات اليومية.
 */
export function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="-2xl border border-border/60 bg-card p-4 shadow-sm rounded-2xl">
      <h3 className="mb-3 text-sm font-semibold text-foreground">⚡ إجراءات سريعة</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTIONS.map((action) => (
          <Button
            key={action.to}
            variant={action.variant}
            size="sm"
            className="gap-2 h-9 text-xs font-medium w-full justify-center"
            onClick={() => navigate(action.to)}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
