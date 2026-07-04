import React, { createContext, useContext, ReactNode } from 'react';
import type { Employee, SortDir, ColumnDef } from '@modules/employees/types/employee.types';

export type EmployeeTableContextValue = {
  activeCols: ColumnDef[];
  colFilters: Record<string, string>;
  sortField: string | null;
  sortDir: SortDir;
  handleSort: (field: string) => void;
  paginated: Employee[];
  filteredCount: number;
  loading: boolean;
  hasNoPaginatedRows: boolean;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  totalPages: number;
  saveField: (
    id: string,
    field: string,
    value: string | null,
    extraFields?: Record<string, unknown>,
  ) => Promise<void>;
  setSelectedEmployee: React.Dispatch<React.SetStateAction<string | null>>;
  setEditEmployee: React.Dispatch<React.SetStateAction<Employee | null>>;
  setShowAddModal: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteEmployee: React.Dispatch<React.SetStateAction<Employee | null>>;
  setStatusDateDialog: React.Dispatch<
    React.SetStateAction<{
      emp: Employee;
      newStatus: string;
      label: string;
    } | null>
  >;
  setStatusDate: React.Dispatch<React.SetStateAction<string>>;
  permissions: { can_edit: boolean; can_delete: boolean };
  uniqueVals: {
    city: string[];
    nationality: string[];
    sponsorship_status: string[];
    license_status: string[];
    job_title: string[];
    status: string[];
  };
  setColFilter: (key: string, value: string) => void;
  tableRef: React.RefObject<HTMLTableElement | null>;
  refetchEmployees: () => void;
  presenceActiveRows?: Map<string, { userId: string; name: string; color: string }>;
  onRowEditStart?: (rowId: string) => void;
  onRowEditEnd?: () => void;
};

const EmployeeTableContext = createContext<EmployeeTableContextValue | null>(null);

export function EmployeeTableProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: EmployeeTableContextValue;
}) {
  return (
    <EmployeeTableContext.Provider value={value}>
      {children}
    </EmployeeTableContext.Provider>
  );
}

export function useEmployeeTable() {
  const context = useContext(EmployeeTableContext);
  if (!context) {
    throw new Error('useEmployeeTable must be used within an EmployeeTableProvider');
  }
  return context;
}
