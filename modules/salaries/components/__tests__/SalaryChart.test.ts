import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import SalaryChart from '../SalaryChart';

describe('SalaryChart Component', () => {
  const mockData = [
    { month: 'Jan', salary: 5000, bonus: 500 },
    { month: 'Feb', salary: 5200, bonus: 600 },
    { month: 'Mar', salary: 5100, bonus: 550 },
  ];

  it('should render chart with title', () => {
    render(<SalaryChart data={mockData} title="Salary Trends" />);
    expect(screen.getByText(/Salary Trends/i)).toBeInTheDocument();
  });

  it('should render chart with data points', () => {
    render(<SalaryChart data={mockData} />);
    
    mockData.forEach((item) => {
      expect(screen.getByText(item.month)).toBeInTheDocument();
    });
  });

  it('should display empty state when data is empty', () => {
    render(<SalaryChart data={[]} />);
    expect(screen.getByText(/no data available/i)).toBeInTheDocument();
  });

  it('should handle missing data gracefully', () => {
    const incompleteData = [
      { month: 'Jan', salary: 5000 },
      { month: 'Feb' }, // missing salary
    ];
    
    render(<SalaryChart data={incompleteData} />);
    expect(screen.getByText(/Jan/i)).toBeInTheDocument();
    // Should still render without crashing
  });
});
