import React, { useMemo } from "react";
import { parseISO, format } from "date-fns";
import { Users } from "lucide-react";
import {
  SortIcon,
  ColFilterPopover,
  SkeletonRow,
} from "@modules/employees/components/EmployeesViewParts";
import {
  cityLabel,
  DEFAULT_EMPLOYEE_CITY_OPTIONS,
} from "@modules/employees/model/employeeCity";
import {
  InlineInputEditor,
} from "@modules/employees/components/EmployeeInlineEditors";
import { useActiveApps } from "@modules/employees/hooks/useActiveApps";
import { useCommercialRecords } from "@shared/hooks/useCommercialRecords";
import {
  calcResidency,
  dayColorByThreshold,
  GRID_SKELETON_IDS,
  EMPTY_DATA_PLACEHOLDER,
} from "@modules/employees/types/employee.types";

import { buildColumnFilter } from "./table/EmployeeTableFilters";
import { renderEmployeeCell } from "./table/EmployeeTableRenderers";
import { EmployeeTablePagination } from "@modules/employees/components/EmployeeTablePagination";
import { EmployeeTableProvider, useEmployeeTable, type EmployeeTableContextValue } from "../context/EmployeeTableContext";




type EmployeeDetailedTableProps = EmployeeTableContextValue;

function EmployeeDetailedTableInner() {
  const {
    activeCols,
    colFilters,
    sortField,
    sortDir,
    handleSort,
    paginated,
    filteredCount,
    loading,
    hasNoPaginatedRows,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    saveField,
    setSelectedEmployee,
    setEditEmployee,
    setShowAddModal,
    setDeleteEmployee,
    setStatusDateDialog,
    setStatusDate,
    permissions,
    uniqueVals,
    setColFilter,
    tableRef,
    refetchEmployees,
    presenceActiveRows,
    onRowEditStart,
    onRowEditEnd,
  } = useEmployeeTable();
  const { data: availableApps = [] } = useActiveApps();
  const { recordNames: commercialRecordNames = [] } = useCommercialRecords();
  const emptyCell = (
    <span className="text-muted-foreground/40">{EMPTY_DATA_PLACEHOLDER}</span>
  );
  const cellText = (value?: string | null) => value || EMPTY_DATA_PLACEHOLDER;
  const cityOptions = useMemo(
    () =>
      Array.from(new Set([...DEFAULT_EMPLOYEE_CITY_OPTIONS, ...uniqueVals.city]))
        .map((value) => ({ value, label: cityLabel(value, value) })),
    [uniqueVals.city],
  );
  const buildTextOptions = (values: string[], currentValue?: string | null) =>
    Array.from(new Set([...values, currentValue || ""].filter(Boolean))).map(
      (value) => ({ value, label: value }),
    );
  const formatDateCell = (value?: string | null) =>
    value ? format(parseISO(value), "yyyy/MM/dd") : EMPTY_DATA_PLACEHOLDER;
  const getDateInputValue = (value?: string | null) =>
    value?.slice(0, 10) || "";
  const renderTextValue = (
    value?: string | null,
    options?: Readonly<{ dir?: "rtl" | "ltr" | "auto"; className?: string }>,
  ) => (
    <span
      className={`text-sm text-muted-foreground whitespace-nowrap ${options?.className || ""}`}
      dir={options?.dir}
    >
      {cellText(value)}
    </span>
  );
  const renderEditableTextCell = (
    employeeId: string,
    field: string,
    value?: string | null,
    options?: Readonly<{
      dir?: "rtl" | "ltr" | "auto";
      className?: string;
      placeholder?: string;
      inputType?: "text" | "email";
    }>,
  ) => {
    const display = renderTextValue(value, options);
    if (!permissions.can_edit) return display;
    return (
      <InlineInputEditor
        value={value || ""}
        inputType={options?.inputType || "text"}
        dir={options?.dir || "auto"}
        placeholder={options?.placeholder}
        onSave={(nextValue) => saveField(employeeId, field, nextValue)}
        renderDisplay={() => display}
      />
    );
  };
  const renderEditableDate = (
    employeeId: string,
    field: string,
    value?: string | null,
    display?: React.ReactNode,
  ) => {
    const displayNode =
      display ??
      (value
        ? renderTextValue(formatDateCell(value), { dir: "ltr" })
        : emptyCell);
    if (!permissions.can_edit) return displayNode;
    return (
      <InlineInputEditor
        value={getDateInputValue(value)}
        inputType="date"
        dir="ltr"
        onSave={(nextValue) => saveField(employeeId, field, nextValue === '' ? null : nextValue)}
        renderDisplay={() => displayNode}
      />
    );
  };

  return (
    <div className="ta-table-wrap">
      <div className="overflow-x-auto">
        <table className="w-full text-center align-middle whitespace-nowrap" ref={tableRef}>
          <thead className="bg-yellow-400">
            <tr className="ta-thead">
              {activeCols.map((col) => {
                const isFilterable = !["seq", "actions"].includes(col.key);
                const isActive = !!colFilters[col.key];

                const filterContent = isFilterable
                  ? buildColumnFilter({
                      col,
                      colFilters,
                      cityOptions,
                      availableApps,
                      commercialRecordNames,
                      uniqueVals,
                      setColFilter,
                    })
                  : null;

                return (
                  <th
                    key={col.key}
                    role={col.sortable ? "button" : undefined}
                    tabIndex={col.sortable ? 0 : undefined}
                    className={`ta-th select-none whitespace-nowrap text-center text-black ${col.key === "seq" ? "w-10 px-2" : ""} ${col.sortable ? "cursor-pointer hover:text-gray-800" : ""}`}
                    onClick={
                      col.sortable ? () => handleSort(col.key) : undefined
                    }
                    onKeyDown={
                      col.sortable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleSort(col.key);
                            }
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{col.label}</span>
                      {col.sortable && (
                        <SortIcon
                          field={col.key}
                          sortField={sortField}
                          sortDir={sortDir}
                        />
                      )}
                      {isFilterable && filterContent && (
                        <ColFilterPopover
                          colKey={col.key}
                          label={col.label}
                          active={isActive}
                          onClear={() => setColFilter(col.key, "")}
                        >
                          {filterContent}
                        </ColFilterPopover>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading &&
              GRID_SKELETON_IDS.map((id) => (
                <SkeletonRow
                  key={`employees-grid-skeleton-${id}`}
                  cols={activeCols.length}
                />
              ))}
            {!loading && hasNoPaginatedRows && (
              <tr>
                <td colSpan={activeCols.length} className="ta-td">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users size={40} className="opacity-60" aria-hidden />
                    <p className="font-medium">لا توجد نتائج</p>
                    <p className="text-xs">
                      جرّب تغيير الفلاتر أو إضافة موظف جديد
                    </p>
                  </div>
                </td>
              </tr>
            )}
            {!loading &&
              !hasNoPaginatedRows &&
              paginated.map((employee, rowIndex) => {
                const residencyStatus = calcResidency(employee.residency_expiry);
                const daysColor = dayColorByThreshold(residencyStatus.days);
                const globalIdx = (page - 1) * pageSize + rowIndex + 1;
                const presenceUser = presenceActiveRows?.get(employee.id);
                return (
                  <tr
                    key={employee.id}
                    className={`border-b border-border/30 hover:bg-muted/20 transition-colors relative ${presenceUser ? 'ring-1 ring-inset' : ''}`}
                    style={presenceUser ? { '--ring-color': presenceUser.color, ringColor: presenceUser.color } as React.CSSProperties : undefined}
                    onFocusCapture={() => onRowEditStart?.(employee.id)}
                    onBlurCapture={(e) => {
                      // Only fire onRowEditEnd if focus left the row entirely
                      if (!e.currentTarget.contains(e.relatedTarget)) {
                        onRowEditEnd?.();
                      }
                    }}
                  >
                    {activeCols.map((col, colIdx) => {
                      return renderEmployeeCell({
                        col, colIdx, emp: employee,
                        globalIdx,
                        presenceUser,
                        res: residencyStatus, daysColor,
                        permissions,
                        availableApps,
                        cityOptions,
                        commercialRecordNames,
                        uniqueVals,
                        emptyCell,
                        saveField,
                        setSelectedEmployee,
                        setEditEmployee,
                        setShowAddModal,
                        setDeleteEmployee,
                        setStatusDateDialog,
                        setStatusDate,
                        refetchEmployees,
                        renderTextValue,
                        renderEditableTextCell,
                        renderEditableDate,
                        formatDateCell,
                        buildTextOptions,
                      });
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {!loading && (
        <EmployeeTablePagination
          page={page}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalPages={totalPages}
          filteredCount={filteredCount}
        />
      )}
    </div>
  );
}

export const EmployeeDetailedTable = React.memo((props: Readonly<EmployeeDetailedTableProps>) => {
  return (
    <EmployeeTableProvider value={props}>
      <EmployeeDetailedTableInner />
    </EmployeeTableProvider>
  );
});
