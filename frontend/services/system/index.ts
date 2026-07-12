/**
 * System / Cross-cutting Services
 * Import from here for domain-organized access:
 *   import { dashboardService } from '@services/system';
 *
 * Existing per-file imports still work:
 *   import { dashboardService } from '@services/dashboardService';
 */

export { dashboardService } from '@services/dashboardService';

export { analyticsService } from '@services/analyticsService';

export { predictionService } from '@services/predictionService';

export { aiService } from '@services/aiService';

export { settingsHubService } from '@services/settingsHubService';

export { searchService } from '@services/searchService';

export { auditService } from '@services/auditService';

export { storageService } from '@services/storageService';

export { realtimeService } from '@services/realtimeService';

export { serverFunction } from '@services/serverFunction';

export { getErrorMessage, handleSupabaseError, ServiceError, toServiceError } from '@services/serviceError';
