import { supabase } from '@services/supabase/client';
import { handleSupabaseError, toServiceError } from '@services/serviceError';

export interface SparePart {
  id: string;
  name_ar: string;
  part_number?: string | null;
  stock_quantity: number;
  min_stock_alert: number;
  unit: string;
  unit_cost: number;
  supplier?: string | null;
  notes?: string | null;
}

export interface CreateSparePartInput {
  name_ar: string;
  part_number?: string | null;
  stock_quantity?: number;
  min_stock_alert?: number;
  unit?: string;
  unit_cost?: number;
  supplier?: string | null;
  notes?: string | null;
}

export interface MaintenancePartInput {
  part_id: string;
  quantity_used: number;
  cost_at_time: number;
}

export interface CreateMaintenanceLogInput {
  vehicle_id: string;
  maintenance_date: string;
  type: string;
  odometer_reading?: number | null;
  notes?: string | null;
}

export interface MaintenanceLogWithDetails {
  id: string;
  vehicle_id: string;
  employee_id?: string | null;
  maintenance_date: string;
  type: string;
  odometer_reading?: number | null;
  total_cost: number;
  status: string;
  notes?: string | null;
  vehicles: { plate_number: string; type: string };
  employees?: { name: string } | null;
  maintenance_parts: {
    id: string;
    quantity_used: number;
    cost_at_time: number;
    spare_parts: { name_ar: string; unit: string };
  }[];
}

const logSelect = `
  id,
  vehicle_id,
  employee_id,
  maintenance_date,
  type,
  odometer_reading,
  total_cost,
  status,
  notes,
  vehicles(plate_number, type),
  employees(name),
  maintenance_parts(
    id,
    quantity_used,
    cost_at_time,
    spare_parts(name_ar, unit)
  )
`;

function mapLog(row: unknown): MaintenanceLogWithDetails {
  const r = row as MaintenanceLogWithDetails;
  return {
    ...r,
    maintenance_parts: r.maintenance_parts ?? [],
  };
}

function isMissingFleetMaintenanceSchemaError(error: unknown): boolean {
  let msg = '';
  if (error && typeof error === 'object' && 'message' in error) {
    const messageValue = (error as { message?: unknown }).message;
    if (typeof messageValue === 'string') {
      msg = messageValue;
    } else if (messageValue !== null && messageValue !== undefined) {
      try {
        msg = JSON.stringify(messageValue);
      } catch {
        msg = '';
      }
    }
  }
  return (
    msg.includes("Could not find the table 'public.spare_parts'") ||
    msg.includes("Could not find the table 'public.maintenance_parts'") ||
    msg.includes("Could not find the table 'public.maintenance_logs'")
  );
}

function throwMaintenanceSchemaError(error: unknown, context: string): never {
  if (isMissingFleetMaintenanceSchemaError(error)) {
    throw toServiceError(
      new Error(
        'جداول الصيانة غير مفعّلة في قاعدة البيانات الحالية. يلزم تطبيق ترحيلات الصيانة (spare_parts / maintenance_logs / maintenance_parts) ثم إعادة المحاولة.'
      ),
      context
    );
  }
  handleSupabaseError(error, context);
}

export async function getSpareparts(): Promise<SparePart[]> {
  const { data, error } = await supabase
    .from('spare_parts')
    .select('id, name_ar, part_number, stock_quantity, min_stock_alert, unit, unit_cost, supplier, notes')
    .order('name_ar');
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.getSpareparts');
  return (data ?? []) as SparePart[];
}

export async function createSparePart(data: CreateSparePartInput): Promise<SparePart> {
  const { data: row, error } = await supabase
    .from('spare_parts')
    .insert({
      name_ar: data.name_ar,
      part_number: data.part_number ?? null,
      stock_quantity: data.stock_quantity ?? 0,
      min_stock_alert: data.min_stock_alert ?? 5,
      unit: data.unit ?? 'قطعة',
      unit_cost: data.unit_cost ?? 0,
      supplier: data.supplier ?? null,
      notes: data.notes ?? null,
    })
    .select()
    .single();
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.createSparePart');
  return row as SparePart;
}

export async function updateSparePart(id: string, data: Partial<SparePart>): Promise<SparePart> {
  const rest = { ...(data as Partial<SparePart> & { id?: string }) };
  delete rest.id;
  const { data: row, error } = await supabase
    .from('spare_parts')
    .update(rest as never)
    .eq('id', id)
    .select()
    .single();
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.updateSparePart');
  return row as SparePart;
}

export async function deleteSparePart(id: string): Promise<void> {
  const { count, error: cErr } = await supabase
    .from('maintenance_parts')
    .select('*', { count: 'exact', head: true })
    .eq('part_id', id);
  if (cErr) throwMaintenanceSchemaError(cErr, 'maintenanceService.deleteSparePart.count');
  if ((count ?? 0) > 0) {
    throw new Error('لا يمكن حذف القطعة لأنها مستخدمة في سجلات صيانة.');
  }
  const { error } = await supabase.from('spare_parts').delete().eq('id', id);
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.deleteSparePart');
}

export async function getMaintenanceLogs(): Promise<MaintenanceLogWithDetails[]> {
  const { data, error } = await supabase
    .from('maintenance_logs')
    .select(logSelect)
    .order('maintenance_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.getMaintenanceLogs');
  return (data ?? []).map(mapLog);
}

async function getMaintenanceLogById(id: string): Promise<MaintenanceLogWithDetails> {
  const { data, error } = await supabase
    .from('maintenance_logs')
    .select(logSelect)
    .eq('id', id)
    .single();
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.getMaintenanceLogById');
  return mapLog(data);
}

export async function createMaintenanceLog(
  data: CreateMaintenanceLogInput,
  parts: MaintenancePartInput[]
): Promise<MaintenanceLogWithDetails> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id ?? null;

  const totalCost = parts.reduce((sum, p) => sum + p.quantity_used * p.cost_at_time, 0);

  const { data: inserted, error } = await supabase
    .from('maintenance_logs')
    .insert({
      vehicle_id: data.vehicle_id,
      maintenance_date: data.maintenance_date ?? new Date().toISOString().split('T')[0],
      type: data.type,
      notes: data.notes ?? null,
      total_cost: totalCost,
      odometer_reading: data.odometer_reading ?? null,
      created_by: uid,
    })
    .select('id')
    .single();

  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.createMaintenanceLog.insert');
  const logId = inserted.id;

  if (parts.length > 0) {
    const rows = parts.map((p) => ({
      maintenance_log_id: logId,
      part_id: p.part_id,
      quantity_used: p.quantity_used,
      cost_at_time: p.cost_at_time,
    }));
    const { error: pErr } = await supabase.from('maintenance_parts').insert(rows);
    if (pErr) throwMaintenanceSchemaError(pErr, 'maintenanceService.createMaintenanceLog.parts');
  }

  return getMaintenanceLogById(logId);
}

export async function deleteMaintenanceLog(id: string): Promise<void> {
  const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.deleteMaintenanceLog');
}

export async function getCurrentDriverNameForVehicle(vehicleId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('vehicle_assignments')
    .select('employees(name)')
    .eq('vehicle_id', vehicleId)
    .is('returned_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) handleSupabaseError(error, 'maintenanceService.getCurrentDriverNameForVehicle');
  const name = (data as { employees?: { name?: string } | null } | null)?.employees?.name;
  return name ?? null;
}

export type LowStockSparePartRow = {
  id: string;
  name_ar: string;
  stock_quantity: number;
  min_stock_alert: number;
  unit: string;
};

/** Rows where stock_quantity < min_stock_alert (computed client-side; table is small). */
export async function getLowStockSpareParts(): Promise<LowStockSparePartRow[]> {
  const { data, error } = await supabase
    .from('spare_parts')
    .select('id, name_ar, stock_quantity, min_stock_alert, unit');
  if (error) throwMaintenanceSchemaError(error, 'maintenanceService.getLowStockSpareParts');
  const rows = (data ?? []) as LowStockSparePartRow[];
  return rows.filter((r) => Number(r.stock_quantity) < Number(r.min_stock_alert ?? 0));
}
