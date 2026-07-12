import { employeeTierService } from '@services/employeeTierService';

export type Employee = { id: string; name: string; sponsorship_status: string | null; };
export type AppRow = { id: string; name: string; brand_color: string; text_color: string; };
export type TierRow = {
  id: string;
  sim_number: string | null;
  employee_id: string;
  package_type: string;
  renewal_date: string;
  delivery_status: string;
  app_ids: string[];
  notes: string | null;
  created_at: string;
};
export type TierSortField = keyof TierRow | 'employee_name';
export type SortDir = 'asc' | 'desc' | null;
export type TierCreatePayload = Parameters<typeof employeeTierService.createTier>[0];

export const STATUS_DELIVERED = 'delivered';
export const STATUS_NOT_DELIVERED = 'not_delivered';

export const statusLabel = (s: string) => {
  if (s === STATUS_DELIVERED) return 'مسلّمة';
  return 'غير مسلم';
};

const _statusCls = (s: string) =>
  s === STATUS_DELIVERED
    ? 'bg-success/10 text-success border border-success/20'
    : 'bg-muted text-muted-foreground border border-border';
