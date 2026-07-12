import { supabase } from '@services/supabase/client';
import { ServiceError, toServiceError } from '@services/serviceError';

export const COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE =
  'يلزم تطبيق migration السجلات التجارية أولاً حتى يمكن إدارة السجلات من الواجهة.';

export type CommercialRecordItem = {
  id: string | null;
  name: string;
  registration_number: string | null;
  residency_renewal_monthly_cost: number | null;
  usage_count: number;
  source: 'managed' | 'legacy';
};

export type CommercialRecordCatalog = {
  tableAvailable: boolean;
  records: CommercialRecordItem[];
};

export type CommercialRecordInput = {
  name: string;
  registration_number?: string | null;
  residency_renewal_monthly_cost?: number | null;
};

type CommercialRecordRow = {
  id: string;
  name: string;
  registration_number: string | null;
  residency_renewal_monthly_cost: number | null;
};

const normalizeCommercialRecordName = (value: string | null | undefined) => value?.trim() ?? '';

const normalizeCommercialRecordKey = (value: string | null | undefined) =>
  normalizeCommercialRecordName(value).toLocaleLowerCase();

const normalizeOptionalText = (value: string | null | undefined) => {
  const normalizedText = value?.trim() ?? '';
  return normalizedText || null;
};

const normalizeResidencyRenewalMonthlyCost = (value: number | null | undefined) => {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0) {
    throw new ServiceError('تكلفة تجديد الإقامة الشهرية يجب أن تكون رقماً موجباً أو صفراً');
  }
  return value;
};

const buildCommercialRecordPayload = (record: CommercialRecordInput) => {
  const normalizedName = normalizeCommercialRecordName(record.name);
  if (!normalizedName) {
    throw new ServiceError('اسم السجل التجاري مطلوب');
  }

  return {
    name: normalizedName,
    registration_number: normalizeOptionalText(record.registration_number),
    residency_renewal_monthly_cost: normalizeResidencyRenewalMonthlyCost(record.residency_renewal_monthly_cost),
  };
};

const isMissingCommercialRecordsTable = (error: unknown) => {
  const message =
    error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : '';

  return message.includes('commercial_records') && (
    message.includes('does not exist') ||
    message.includes('Could not find the table') ||
    message.includes('schema cache')
  );
};

async function listManagedCommercialRecords(): Promise<CommercialRecordRow[]> {
  const { data, error } = await supabase
    .from('commercial_records')
    .select('id, name, registration_number, residency_renewal_monthly_cost')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []);
}

async function listEmployeeCommercialRecordUsage(): Promise<Map<string, { name: string; count: number }>> {
  const { data, error } = await supabase
    .from('employees')
    .select('commercial_record')
    .not('commercial_record', 'is', null);

  if (error) throw toServiceError(error, 'commercialRecordService.listEmployeeCommercialRecordUsage');

  const counts = new Map<string, { name: string; count: number }>();
  for (const row of data ?? []) {
    const name = normalizeCommercialRecordName((row as { commercial_record?: string | null }).commercial_record);
    if (!name) continue;
    const key = normalizeCommercialRecordKey(name);
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { name, count: 1 });
    }
  }
  return counts;
}

export const commercialRecordService = {
  async listCatalog(): Promise<CommercialRecordCatalog> {
    const usageMap = await listEmployeeCommercialRecordUsage();

    let managedRows: CommercialRecordRow[] = [];
    let tableAvailable = true;

    try {
      managedRows = await listManagedCommercialRecords();
    } catch (error) {
      if (!isMissingCommercialRecordsTable(error)) {
        throw toServiceError(error, 'commercialRecordService.listCatalog');
      }
      tableAvailable = false;
    }

    const managedByKey = new Map<string, CommercialRecordItem>();
    for (const row of managedRows) {
      const key = normalizeCommercialRecordKey(row.name);
      managedByKey.set(key, {
        id: row.id,
        name: normalizeCommercialRecordName(row.name),
        registration_number: row.registration_number,
        residency_renewal_monthly_cost: row.residency_renewal_monthly_cost,
        usage_count: usageMap.get(key)?.count ?? 0,
        source: 'managed',
      });
    }

    const records: CommercialRecordItem[] = [...managedByKey.values()];
    for (const [key, usage] of usageMap.entries()) {
      if (managedByKey.has(key)) continue;
      records.push({
        id: null,
        name: usage.name,
        registration_number: null,
        residency_renewal_monthly_cost: null,
        usage_count: usage.count,
        source: 'legacy',
      });
    }

    records.sort((a, b) => {
      if (a.usage_count !== b.usage_count) return b.usage_count - a.usage_count;
      return a.name.localeCompare(b.name, 'ar');
    });

    return { tableAvailable, records };
  },

  async createRecord(record: CommercialRecordInput) {
    const payload = buildCommercialRecordPayload(record);

    const { data, error } = await supabase
      .from('commercial_records')
      .insert(payload)
      .select('id, name, registration_number, residency_renewal_monthly_cost')
      .single();

    if (error) {
      if (isMissingCommercialRecordsTable(error)) {
        throw new ServiceError(COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE, error);
      }
      throw toServiceError(error, 'commercialRecordService.createRecord');
    }

    return data;
  },

  async updateRecord(recordId: string, record: CommercialRecordInput, previousRecord: CommercialRecordInput) {
    const payload = buildCommercialRecordPayload(record);
    const previousPayload = buildCommercialRecordPayload(previousRecord);
    const normalizedName = payload.name;
    const normalizedPrevious = previousPayload.name;

    const { error: updateRecordError } = await supabase
      .from('commercial_records')
      .update(payload)
      .eq('id', recordId);

    if (updateRecordError) {
      if (isMissingCommercialRecordsTable(updateRecordError)) {
        throw new ServiceError(COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE, updateRecordError);
      }
      throw toServiceError(updateRecordError, 'commercialRecordService.updateRecord.record');
    }

    if (normalizedPrevious && normalizedPrevious !== normalizedName) {
      const { error: syncEmployeesError } = await supabase
        .from('employees')
        .update({ commercial_record: normalizedName })
        .eq('commercial_record', normalizedPrevious);

      if (syncEmployeesError) {
        await supabase
          .from('commercial_records')
          .update(previousPayload)
          .eq('id', recordId);
        throw toServiceError(syncEmployeesError, 'commercialRecordService.updateRecord.syncEmployees');
      }
    }
  },

  async deleteRecord(recordId: string) {
    const { error } = await supabase
      .from('commercial_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      if (isMissingCommercialRecordsTable(error)) {
        throw new ServiceError(COMMERCIAL_RECORDS_MIGRATION_REQUIRED_MESSAGE, error);
      }
      throw toServiceError(error, 'commercialRecordService.deleteRecord');
    }
  },
};

