import type React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Wallet, Wrench, AlertTriangle, Package, Fuel, Users } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@shared/components/ui/tooltip';

export type QuickAction = {
  id: string;
  label: string;
  to: string;
  icon: React.ReactNode;
  color: string;
  hoverColor: string;
  /** Optional keyboard shortcut hint shown in tooltip */
  shortcut?: string;
};

const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'add-order',
    label: 'إضافة طلب',
    to: '/orders',
    icon: <Package size={18} />,
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    hoverColor: 'hover:bg-blue-500/20',
    shortcut: 'Alt+O',
  },
  {
    id: 'record-attendance',
    label: 'تسجيل حضور',
    to: '/attendance',
    icon: <Clock size={18} />,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    hoverColor: 'hover:bg-emerald-500/20',
    shortcut: 'Alt+A',
  },
  {
    id: 'request-advance',
    label: 'طلب سلفة',
    to: '/advances',
    icon: <Wallet size={18} />,
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    hoverColor: 'hover:bg-amber-500/20',
    shortcut: 'Alt+S',
  },
  {
    id: 'add-maintenance',
    label: 'صيانة',
    to: '/maintenance',
    icon: <Wrench size={18} />,
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    hoverColor: 'hover:bg-purple-500/20',
  },
  {
    id: 'add-fuel',
    label: 'وقود',
    to: '/fuel',
    icon: <Fuel size={18} />,
    color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    hoverColor: 'hover:bg-rose-500/20',
  },
  {
    id: 'add-employee',
    label: 'موظف جديد',
    to: '/employees?new=1',
    icon: <Users size={18} />,
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
    hoverColor: 'hover:bg-cyan-500/20',
  },
  {
    id: 'view-alerts',
    label: 'التنبيهات',
    to: '/alerts',
    icon: <AlertTriangle size={18} />,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    hoverColor: 'hover:bg-orange-500/20',
  },
];

type QuickActionsProps = {
  actions?: QuickAction[];
  className?: string;
};

export function QuickActions({ actions = DEFAULT_QUICK_ACTIONS, className }: Readonly<QuickActionsProps>) {
  return (
    <div className={cn('rounded-2xl border border-border/60 bg-card p-4 shadow-sm', className)}>
      <h3 className="mb-3 text-sm font-semibold text-foreground">⚡ إجراءات سريعة</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {actions.map((action) => {
          const card = (
            <Link
              key={action.id}
              to={action.to}
              className={cn(
                'flex flex-col items-center gap-2 p-4 rounded-xl border border-border/50 shadow-sm transition-all duration-200',
                action.color,
                action.hoverColor,
                'hover:shadow-card-hover hover:scale-[1.02] active:scale-[0.98]'
              )}
            >
              <div className="p-2 bg-card/50 rounded-2xl">
                {action.icon}
              </div>
              <span className="text-xs font-semibold text-center">{action.label}</span>
              {action.shortcut ? (
                <kbd className="hidden sm:inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/40">
                  {action.shortcut}
                </kbd>
              ) : null}
            </Link>
          );

          if (action.shortcut) {
            return (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>{card}</TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {action.label} — <kbd className="font-mono">{action.shortcut}</kbd>
                </TooltipContent>
              </Tooltip>
            );
          }

          return card;
        })}
      </div>
    </div>
  );
}
