import { supabase } from '@services/supabase/client';
import { handleSupabaseError } from '@services/serviceError';

export interface VehicleReportRow {
  id: string;
  plate_number: string;
  plate_number_en: string | null;
  type: 'motorcycle' | 'car';
  brand: string | null;
  model: string | null;
  year: number | null;
  status: 'active' | 'maintenance' | 'breakdown' | 'rental' | 'ended' | 'inactive';
  has_fuel_chip: boolean | null;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  authorization_expiry: string | null;
  serial_number: string | null;
  chassis_number: string | null;
  notes: string | null;
  // computed from joins
  current_rider: string | null;
  total_maintenance_cost: number;
  maintenance_count: number;
  total_km: number;
  total_fuel_cost: number;
  maintenance_logs: VehicleMaintenanceLog[];
  documents: VehicleDoc[];
}

export interface VehicleMaintenanceLog {
  id: string;
  maintenance_date: string;
  type: string;
  total_cost: number;
  odometer_reading: number | null;
  notes: string | null;
  parts: { name_ar: string; quantity_used: number; cost_at_time: number }[];
}

export interface VehicleDoc {
  id: string;
  doc_type: string;
  title: string | null;
  file_path: string;
  file_name: string;
  created_at: string;
}

export interface VehicleReportFilters {
  fromDate?: string;
  toDate?: string;
  vehicleType?: 'motorcycle' | 'car' | 'all';
  status?: string;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function getVehicleReport(filters: VehicleReportFilters = {}): Promise<VehicleReportRow[]> {
  const { fromDate, toDate, vehicleType, status } = filters;

  // 1. Fetch all vehicles
  let vehicleQuery = supabase.from('vehicles').select('*').order('plate_number');
  if (vehicleType && vehicleType !== 'all') vehicleQuery = vehicleQuery.eq('type', vehicleType);
  if (status && status !== 'all') vehicleQuery = vehicleQuery.eq('status', status);

  const { data: vehicles, error: vErr } = await vehicleQuery;
  if (vErr) handleSupabaseError(vErr, 'vehicleReportService.getVehicleReport.vehicles');

  const vehicleIds = (vehicles ?? []).map((v) => v.id);
  if (vehicleIds.length === 0) return [];

  // 2. Fetch current riders (active assignments)
  const { data: assignments, error: aErr } = await supabase
    .from('vehicle_assignments')
    .select('vehicle_id, employees(name)')
    .is('end_date', null)
    .is('returned_at', null)
    .in('vehicle_id', vehicleIds);
  if (aErr) handleSupabaseError(aErr, 'vehicleReportService.getVehicleReport.assignments');

  const riderMap: Record<string, string> = {};
  for (const a of assignments ?? []) {
    const emp = a.employees as { name?: string } | null;
    if (a.vehicle_id && emp?.name) riderMap[a.vehicle_id] = emp.name;
  }

  // 3. Fetch maintenance logs (with parts)
  let logsQuery = supabase
    .from('maintenance_logs')
    .select(`
      id, vehicle_id, maintenance_date, type, total_cost, odometer_reading, notes,
      maintenance_parts(quantity_used, cost_at_time, spare_parts(name_ar))
    `)
    .in('vehicle_id', vehicleIds)
    .order('maintenance_date', { ascending: false });

  if (fromDate) logsQuery = logsQuery.gte('maintenance_date', fromDate);
  if (toDate) logsQuery = logsQuery.lte('maintenance_date', toDate);

  const { data: logs, error: lErr } = await logsQuery;
  if (lErr) handleSupabaseError(lErr, 'vehicleReportService.getVehicleReport.logs');

  // 4. Fetch fuel/km data grouped by vehicle via active assignments
  //    vehicle_mileage_daily is per employee, we join via vehicle_assignments
  //    We get fuel data per vehicle via a join: vehicle_assignments + vehicle_mileage_daily
  let fuelQuery = supabase
    .from('vehicle_assignments')
    .select(`
      vehicle_id,
      employee_id,
      start_date,
      end_date,
      employees!inner(
        vehicle_mileage_daily(date, km_total, fuel_cost)
      )
    `)
    .in('vehicle_id', vehicleIds);

  if (fromDate || toDate) {
    // Filter by date overlap: assignment.start_date <= toDate AND (assignment.end_date >= fromDate OR end_date IS NULL)
    if (fromDate) fuelQuery = fuelQuery.gte('start_date', fromDate);
  }

  const { data: fuelAssignments } = await fuelQuery;

  // 5. Fetch vehicle documents
  const { data: docs, error: dErr } = await supabase
    .from('vehicle_documents')
    .select('id, vehicle_id, doc_type, title, file_path, file_name, created_at')
    .in('vehicle_id', vehicleIds)
    .order('created_at', { ascending: false });
  if (dErr) handleSupabaseError(dErr, 'vehicleReportService.getVehicleReport.documents');

  // Build lookup maps
  type LogRow = {
    id: string;
    vehicle_id: string;
    maintenance_date: string;
    type: string;
    total_cost: number;
    odometer_reading: number | null;
    notes: string | null;
    maintenance_parts: { quantity_used: number; cost_at_time: number; spare_parts: { name_ar: string } | null }[];
  };

  const logsMap: Record<string, VehicleMaintenanceLog[]> = {};
  for (const log of (logs ?? []) as LogRow[]) {
    if (!logsMap[log.vehicle_id]) logsMap[log.vehicle_id] = [];
    logsMap[log.vehicle_id].push({
      id: log.id,
      maintenance_date: log.maintenance_date,
      type: log.type,
      total_cost: Number(log.total_cost) || 0,
      odometer_reading: log.odometer_reading,
      notes: log.notes,
      parts: (log.maintenance_parts ?? []).map((p) => ({
        name_ar: p.spare_parts?.name_ar ?? '—',
        quantity_used: p.quantity_used,
        cost_at_time: Number(p.cost_at_time) || 0,
      })),
    });
  }

  // Fuel map per vehicle
  const fuelMap: Record<string, { km: number; cost: number }> = {};
  for (const assign of fuelAssignments ?? []) {
    const vid = assign.vehicle_id;
    const emp = assign.employees as { vehicle_mileage_daily?: { date: string; km_total: number; fuel_cost: number }[] } | null;
    const mileageRows = emp?.vehicle_mileage_daily ?? [];
    for (const row of mileageRows) {
      if (fromDate && row.date < fromDate) continue;
      if (toDate && row.date > toDate) continue;
      if (!fuelMap[vid]) fuelMap[vid] = { km: 0, cost: 0 };
      fuelMap[vid].km += Number(row.km_total) || 0;
      fuelMap[vid].cost += Number(row.fuel_cost) || 0;
    }
  }

  // Docs map
  type DocRow = { id: string; vehicle_id: string; doc_type: string; title: string | null; file_path: string; file_name: string; created_at: string };
  const docsMap: Record<string, VehicleDoc[]> = {};
  for (const doc of (docs ?? []) as DocRow[]) {
    if (!docsMap[doc.vehicle_id]) docsMap[doc.vehicle_id] = [];
    docsMap[doc.vehicle_id].push({
      id: doc.id,
      doc_type: doc.doc_type,
      title: doc.title,
      file_path: doc.file_path,
      file_name: doc.file_name,
      created_at: doc.created_at,
    });
  }

  // Assemble final rows
  return (vehicles ?? []).map((v) => {
    const vLogs = logsMap[v.id] ?? [];
    const vFuel = fuelMap[v.id] ?? { km: 0, cost: 0 };
    return {
      id: v.id,
      plate_number: v.plate_number,
      plate_number_en: v.plate_number_en ?? null,
      type: v.type ?? 'motorcycle',
      brand: v.brand ?? null,
      model: v.model ?? null,
      year: v.year ?? null,
      status: v.status ?? 'active',
      has_fuel_chip: v.has_fuel_chip ?? null,
      insurance_expiry: v.insurance_expiry ?? null,
      registration_expiry: v.registration_expiry ?? null,
      authorization_expiry: v.authorization_expiry ?? null,
      serial_number: v.serial_number ?? null,
      chassis_number: v.chassis_number ?? null,
      notes: v.notes ?? null,
      current_rider: riderMap[v.id] ?? null,
      total_maintenance_cost: vLogs.reduce((s, l) => s + l.total_cost, 0),
      maintenance_count: vLogs.length,
      total_km: vFuel.km,
      total_fuel_cost: vFuel.cost,
      maintenance_logs: vLogs,
      documents: docsMap[v.id] ?? [],
    };
  });
}
