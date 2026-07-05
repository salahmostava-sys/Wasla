/**
 * AI Service - Analytics and Analysis Functions Only
 * Chat functionality has been removed
 *
 * NOTE: types and endpoints mirror ai-backend/main.py (FastAPI) — the source of truth.
 */

export interface EmployeeRank {
  employee_id: string;
  employee_name: string;
  composite_score: number;
  rank: number;
  total_orders: number;
  attendance_rate: number;
  error_rate: number;
  performance_tier: 'excellent' | 'good' | 'average' | 'needs_improvement';
}

export interface BestEmployeeResponse {
  employees: EmployeeRank[];
  best_employee: EmployeeRank | null;
}

export interface EmployeeRecord {
  employee_id: string;
  employee_name: string;
  total_orders: number;
  attendance_days: number;
  error_count: number;
  late_days: number;
  salary: number;
  avg_orders_per_day: number;
}

export interface SalaryForecastResponse {
  predicted_monthly_salary: number;
  current_daily_avg: number;
  projected_monthly_orders: number;
  confidence: 'high' | 'medium' | 'low';
  trend: 'on_track' | 'above_target' | 'below_target';
  days_remaining: number;
}

export interface SalaryAnalysisResponse {
  expected_salary: number;
  risk: 'underpaid' | 'normal' | 'overpaid';
  diff_percent: number;
}

class AIService {
  private readonly isConfiguredValue: boolean;

  constructor() {
    // Check if AI backend is configured
    this.isConfiguredValue = this.checkConfiguration();
  }

  private checkConfiguration(): boolean {
    // Check if AI backend URL is configured
    const aiBackendUrl = import.meta.env.VITE_AI_BACKEND_URL;
    return Boolean(aiBackendUrl && aiBackendUrl !== 'none');
  }

  isConfigured(): boolean {
    return this.isConfiguredValue;
  }

  private getBackendUrl(): string {
    if (!this.isConfiguredValue) {
      throw new Error('AI backend is not configured');
    }
    const aiBackendUrl = import.meta.env.VITE_AI_BACKEND_URL;
    if (!aiBackendUrl) {
      throw new Error('AI backend URL is not configured');
    }
    return aiBackendUrl;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.getBackendUrl()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`AI service error: ${response.statusText}`);
    }
    return (await response.json()) as T;
  }

  async predictSalary(params: {
    current_orders: number;
    days_passed: number;
    avg_order_value: number;
    base_salary?: number;
    working_days_per_month?: number;
  }): Promise<SalaryForecastResponse> {
    try {
      return await this.post<SalaryForecastResponse>('/predict-salary', params);
    } catch (error) {
      console.error('[AIService] predictSalary failed:', error);
      throw error;
    }
  }

  async bestEmployees(employees: EmployeeRecord[], limit: number): Promise<BestEmployeeResponse> {
    try {
      return await this.post<BestEmployeeResponse>('/best-employee', {
        employees,
        top_n: limit,
      });
    } catch (error) {
      console.error('[AIService] bestEmployees failed:', error);
      throw error;
    }
  }

  async analyzeSalary(
    baseSalary: number,
    totalOrders: number,
    totalBonus: number
  ): Promise<SalaryAnalysisResponse> {
    try {
      return await this.post<SalaryAnalysisResponse>('/analyze', {
        base_salary: baseSalary,
        orders: totalOrders,
        bonus: totalBonus,
      });
    } catch (error) {
      console.error('[AIService] analyzeSalary failed:', error);
      throw error;
    }
  }
}

export const aiService = new AIService();
