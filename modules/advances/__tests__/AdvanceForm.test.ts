import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdvanceForm from '../components/AdvanceForm';

vi.mock('../services/advanceService');

describe('AdvanceForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form fields', () => {
    render(<AdvanceForm employeeId="emp-123" />);
    
    expect(screen.getByLabelText(/amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request/i })).toBeInTheDocument();
  });

  it('should validate minimum amount', async () => {
    const user = userEvent.setup();
    render(<AdvanceForm employeeId="emp-123" />);
    
    await user.type(screen.getByLabelText(/amount/i), '0');
    await user.click(screen.getByRole('button', { name: /request/i }));
    
    expect(screen.getByText(/minimum amount is 100/i)).toBeInTheDocument();
  });

  it('should validate maximum amount', async () => {
    const user = userEvent.setup();
    render(<AdvanceForm employeeId="emp-123" maxAmount={5000} />);
    
    await user.type(screen.getByLabelText(/amount/i), '10000');
    await user.click(screen.getByRole('button', { name: /request/i }));
    
    expect(screen.getByText(/exceeds maximum/i)).toBeInTheDocument();
  });

  it('should submit form with valid data', async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<AdvanceForm employeeId="emp-123" onSuccess={onSuccess} />);
    
    await user.type(screen.getByLabelText(/amount/i), '1000');
    await user.type(screen.getByLabelText(/reason/i), 'emergency');
    await user.click(screen.getByRole('button', { name: /request/i }));
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
