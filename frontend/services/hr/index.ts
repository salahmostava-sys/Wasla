/**
 * HR Domain Services
 * Import from here for domain-organized access:
 *   import { employeeService } from '@services/hr';
 *
 * Existing per-file imports still work:
 *   import { employeeService } from '@services/employeeService';
 */

export { employeeService } from '@services/employeeService';
export type { Employee, EmployeeFilters } from '@services/employeeService';

export { attendanceService } from '@services/attendanceService';

export { alertsService } from '@services/alertsService';

export { appService } from '@services/appService';

export { accountAssignmentService } from '@services/accountAssignmentService';

export { employeeProfileService } from '@services/employeeProfileService';

export { employeeActivityService } from '@services/employeeActivityService';

export { employeeTierService } from '@services/employeeTierService';

export { commercialRecordService } from '@services/commercialRecordService';

export { authService } from '@services/authService';

export { profileService } from '@services/profileService';

export { permissionsService } from '@services/permissionsService';
export type { PagePermission } from '@services/permissionsService';

export { userPermissionService } from '@services/userPermissionService';

export { bulkDeleteService } from '@services/bulkDeleteService';
