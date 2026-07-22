import { fuelService } from '@services/fuelService';
import { employeeService } from '@services/employeeService';
import { appService } from '@services/appService';
import { useMemo } from 'react';

export function useFuel() {
  return useMemo(() => ({
    getActiveEmployees: employeeService.getActiveEmployees,
    getActiveApps: appService.getActiveApps,
    getActiveEmployeeAppLinks: employeeService.getActiveEmployeeAppLinks,
    getActiveVehicleAssignments: fuelService.getActiveVehicleAssignments,
    getDailyMileageByMonth: fuelService.getDailyMileageByMonth,
    upsertDailyMileage: fuelService.upsertDailyMileage,
    deleteDailyMileage: fuelService.deleteDailyMileage,
    bulkUpsertDailyMileage: fuelService.bulkUpsertDailyMileage,
    saveMonthlyMileageImport: fuelService.saveMonthlyMileageImport,
    exportDailyMileage: fuelService.exportDailyMileage,
  }), []);
}
