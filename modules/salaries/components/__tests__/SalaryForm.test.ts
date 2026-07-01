import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalaryForm from '../SalaryForm';

// Mock the salary service
vi.mock('../../services/salaryService', () => ({
  calculateSalary: vi.fn(),
  submitSalary: vi.fn(),
}));

describe('SalaryForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render salary form with required fields', () => {
    render(<SalaryForm employeeId="emp-123" />);
    
    expect(screen.getByLabelText(/base salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/bonus/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/deductions/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('should validate required fields on submit', async () => {
    const user = userEvent.setup();
    render(<SalaryForm employeeId="emp-123" />);
    
    const submitBtn = screen.getByRole('button', { name: /submit/i });
    await user.click(submitBtn);
    
    expect(screen.getByText(/base salary is required/i)).toBeInTheDocument();
  });

  it('should accept valid salary input', async () => {
    const user = userEvent.setup();
    render(<SalaryForm employeeId="emp-123" onSuccess={vi.fn()} />);
    
    const baseSalaryInput = screen.getByLabelText(/base salary/i);
    await user.type(baseSalaryInput, '5000');
    
    expect(baseSalaryInput).toHaveValue('5000');
  });

  it('should submit form with valid data', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<SalaryForm employeeId="emp-123" onSuccess={onSuccess} />);
    
    await user.type(screen.getByLabelText(/base salary/i), '5000');
    await user.type(screen.getByLabelText(/bonus/i), '500');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should display error message on submission failure', async () => {
    const user = userEvent.setup();
    const mockError = new Error('Server error');
    
    vi.mocked(submitSalary).mockRejectedValueOnce(mockError);
    
    render(<SalaryForm employeeId="emp-123" />);
    
    await user.type(screen.getByLabelText(/base salary/i), '5000');
    await user.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/error submitting salary/i)).toBeInTheDocument();
    });
  });

  it('should calculate total salary on input change', async () => {
    const user = userEvent.setup();
    render(<SalaryForm employeeId="emp-123" />);
    
    await user.type(screen.getByLabelText(/base salary/i), '5000');
    await user.type(screen.getByLabelText(/bonus/i), '500');
    await user.type(screen.getByLabelText(/deductions/i), '200');
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('5300')).toBeInTheDocument(); // 5000 + 500 - 200
    });
  });
});
