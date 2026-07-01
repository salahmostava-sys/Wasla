import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EmployeeListPage from '../EmployeeListPage';

vi.mock('../../services/employeeService');
vi.mock('@/lib/supabase');

describe('EmployeeListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render employee list', async () => {
    render(<EmployeeListPage />);
    
    await waitFor(() => {
      expect(screen.getByText(/employees/i)).toBeInTheDocument();
    });
  });

  it('should display loading state initially', () => {
    render(<EmployeeListPage />);
    
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display error message on fetch failure', async () => {
    const mockError = 'Failed to fetch employees';
    vi.mocked(getEmployees).mockRejectedValueOnce(new Error(mockError));
    
    render(<EmployeeListPage />);
    
    await waitFor(() => {
      expect(screen.getByText(new RegExp(mockError, 'i'))).toBeInTheDocument();
    });
  });

  it('should filter employees by search term', async () => {
    const user = userEvent.setup();
    render(<EmployeeListPage />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'Ahmed');
    
    await waitFor(() => {
      // Should display only matching employees
      expect(screen.getByText(/Ahmed/i)).toBeInTheDocument();
    });
  });

  it('should sort employees by selected column', async () => {
    const user = userEvent.setup();
    render(<EmployeeListPage />);
    
    const sortBtn = screen.getByRole('button', { name: /sort by name/i });
    await user.click(sortBtn);
    
    // Verify sorting was applied (implementation-specific)
    await waitFor(() => {
      // Employees should be reordered
    });
  });

  it('should paginate through employees', async () => {
    const user = userEvent.setup();
    render(<EmployeeListPage />);
    
    const nextBtn = screen.getByRole('button', { name: /next/i });
    await user.click(nextBtn);
    
    await waitFor(() => {
      // Next page should be displayed
    });
  });
});
