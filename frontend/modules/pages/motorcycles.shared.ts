export type VehicleStatus = 'active' | 'maintenance' | 'breakdown' | 'rental' | 'ended' | 'inactive';

export type Vehicle = {
  id: string;
  plate_number: string;
  plate_number_en?: string | null;
  type: 'motorcycle' | 'car';
  brand: string | null;
  model: string | null;
  year: number | null;
  status: VehicleStatus;
  has_fuel_chip: boolean;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  authorization_expiry: string | null;
  chassis_number?: string | null;
  serial_number?: string | null;
  notes: string | null;
  current_rider?: string | null;
};

export const statusLabels: Record<VehicleStatus, string> = {
  active: 'نشطة',
  maintenance: 'صيانة',
  breakdown: 'خربان',
  rental: 'إيجار',
  ended: 'منتهي',
  inactive: 'غير نشطة',
};

export const typeLabels: Record<Vehicle['type'], string> = {
  motorcycle: 'دباب',
  car: 'سيارة',
};

export const ALL_STATUSES: VehicleStatus[] = ['active', 'maintenance', 'breakdown', 'rental', 'inactive', 'ended'];
