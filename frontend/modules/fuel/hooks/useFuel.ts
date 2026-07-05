import { fuelService } from '@services/fuelService';
import { employeeService } from '@services/employeeService';
import { appService } from '@services/appService';
import { orderService } from '@services/orderService';
import { useMemo } from 'react';

export function useFuel() {
  return useMemo(() => ({
    getActiveEmployees: employeeService.getActiveEmployees,
    getActiveApps: appService.getActiveApps,
    getActiveEmployeeAppLinks: employeeService.getActiveEmployeeAppLinks,
    getMonthlyOrders: orderService.getMonthlyOrders,
    getMonthlyDailyMileage: fuelService.getMonthlyDailyMileage,
    getActiveVehicleAssignments: fuelService.getActiveVehicleAssignments,
    getDailyMileageByMonth: fuelService.getDailyMileageByMonth,
    upsertDailyMileage: fuelService.upsertDailyMileage,
    deleteDailyMileage: fuelService.deleteDailyMileage,
    bulkUpsertDailyMileage: fuelService.bulkUpsertDailyMileage,
    saveMonthlyMileageImport: fuelService.saveMonthlyMileageImport,
    exportDailyMileage: fuelService.exportDailyMileage,
  }), []);
}
