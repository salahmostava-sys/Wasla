// attendanceService removed — salaries depend on daily_shifts (orders page attendance tab) not attendance table
import { employeeService } from '@services/employeeService';
import { orderService } from '@services/orderService';
import { appService } from '@services/appService';
import { fuelService } from '@services/fuelService';
import { salaryService } from '@services/salaryService';
import { advanceService } from '@services/advanceService';
import { externalDeductionService } from '@services/externalDeductionService';
import { performanceService } from '@services/performanceService';

export const salaryDataService = {
  calculateSalaryForEmployeeMonth(
    employeeId: string,
    monthYear: string,
    paymentMethod = 'cash',
    manualDeduction = 0,
    manualDeductionNote: string | null = null
  ) {
    return salaryService.calculateSalaryForEmployeeMonth(
      employeeId,
      monthYear,
      paymentMethod,
      manualDeduction,
      manualDeductionNote
    );
  },

  calculateSalaryForMonth(monthYear: string, paymentMethod = 'cash') {
    return salaryService.calculateSalaryForMonth({ monthYear, paymentMethod });
  },

  getSalaryPreviewForMonth(monthYear: string) {
    return salaryService.getSalaryPreviewForMonth(monthYear);
  },

  async getMonthlyContext(selectedMonth: string) {
    const [employees, extRes, orders, appsWithSchemeRes, fuelRes, savedRecords, allAdvances] =
      await Promise.all([
        employeeService.getActiveForSalaryContext(),
        externalDeductionService.getApprovedByMonth(selectedMonth),
        orderService.getSalaryContextOrdersByMonth(selectedMonth),
        appService.getActiveWithSalarySchemes(),
        fuelService.getMonthlyFuelByMonthYear(selectedMonth),
        salaryService.getMonthRecordsForSalaryContext(selectedMonth),
        advanceService.getActiveAndPausedForSalaryContext(),
      ]);

    return {
      employees,
      extRes,
      orders,
      appsWithSchemeRes,
      attendanceRows: [] as Array<{ employee_id: string }>, // attendance page is separate from salary
      fuelRes,
      savedRecords,
      allAdvances,
    };
  },

  async upsertSalaryRecord(record: Record<string, unknown>) {
    await salaryService.upsertMany([record]);
  },

  async upsertSalaryRecords(records: Record<string, unknown>[]) {
    await salaryService.upsertMany(records);
  },

  async delete(id: string) {
    await salaryService.delete(id);
  },

  captureMonthSnapshot(monthYear: string) {
    return performanceService.captureSalaryMonthSnapshot(monthYear);
  },

  markInstallmentsDeducted(installmentIds: string[], deductedAtIso: string) {
    return advanceService.markInstallmentsDeducted(installmentIds, deductedAtIso);
  },

  getInstallmentsByIds(installmentIds: string[]) {
    return advanceService.getInstallmentsByIds(installmentIds);
  },

  getAdvanceInstallmentStatuses(advanceId: string) {
    return advanceService.getAdvanceInstallmentStatuses(advanceId);
  },

  markAdvanceCompleted(advanceId: string) {
    return advanceService.markAdvanceCompleted(advanceId);
  },

  getMonthInstallmentsForAdvances(selectedMonth: string, advanceIds: string[]) {
    return advanceService.getMonthInstallmentsForAdvances(selectedMonth, advanceIds);
  },

  getPendingInstallmentsForAdvances(advanceIds: string[]) {
    return advanceService.getPendingInstallmentsForAdvances(advanceIds);
  },
};


