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
  type ColKey,
} from "@modules/employees/types/employee.types";

import { buildColumnFilter } from "./table/EmployeeTableFilters";
import { renderEmployeeCell } from "./table/EmployeeTableRenderers";
import { EmployeeTablePagination } from "@modules/employees/components/EmployeeTablePagination";
import { EmployeeTableProvider, useEmployeeTable, type EmployeeTableContextValue } from "../context/EmployeeTableContext";




import { DoubleScrollbar } from "@shared/components/ui/DoubleScrollbar";
import { useTranslation } from "react-i18next";

type EmployeeDetailedTableProps = EmployeeTableContextValue;

const EMPLOYEE_COLUMN_WIDTHS: Partial<Record<ColKey, string>> = {
  seq: "44px",
  name: "168px",
  name_en: "150px",
  national_id: "124px",
  job_title: "132px",
  city: "112px",
  phone: "118px",
  nationality: "96px",
  platform_apps: "132px",
  commercial_record: "138px",
  sponsorship_status: "124px",
  status: "112px",
  join_date: "108px",
  birth_date: "108px",
  probation_end_date: "138px",
  residency_combined: "136px",
  health_insurance_expiry: "144px",
  license_status: "116px",
  license_expiry: "118px",
  bank_account_number: "150px",
  email: "190px",
  actions: "72px",
};

function EmployeeDetailedTableInner() {
  const { t } = useTranslation();
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
      className={`text-xs text-muted-foreground whitespace-nowrap ${options?.className || ""}`}
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
    <div className="ta-table-wrap employees-table-wrap">
      <DoubleScrollbar>
        <table className="employees-table text-start align-middle whitespace-nowrap" ref={tableRef}>
          <colgroup>
            {activeCols.map((col) => (
              <col key={col.key} style={{ width: EMPLOYEE_COLUMN_WIDTHS[col.key] ?? "120px" }} />
            ))}
          </colgroup>
          <thead>
            <tr className="ta-thead">
              {activeCols.map((col) => {
                const isFilterable = !["seq", "actions"].includes(col.key);
                const isActive = !!colFilters[col.key];
                const columnLabel = t(col.labelKey);

                const filterContent = isFilterable
                  ? buildColumnFilter({
                      col,
                      colFilters,
                      cityOptions,
                      availableApps,
                      commercialRecordNames,
                      uniqueVals,
                      setColFilter,
                      t,
                    })
                  : null;

                return (
                  <th
                    key={col.key}
                    className={`ta-th !px-1 select-none whitespace-nowrap text-center ${col.key === "seq" ? "w-10 !px-1 text-center" : ""}`}
                  >
                    <div className="relative flex min-w-0 items-center justify-center">
                      {col.sortable ? (
                        <button
                          type="button"
                          className="flex w-full min-w-0 items-center justify-center gap-1.5 bg-transparent px-2 text-current cursor-pointer hover:opacity-80"
                          onClick={() => handleSort(col.key)}
                          title={t('sortBy', { label: columnLabel })}
                        >
                          <span className="truncate">{columnLabel}</span>
                          <span className="flex-shrink-0 flex items-center justify-center">
                            {sortField === col.key && (
                              <SortIcon
                                field={col.key}
                                sortField={sortField}
                                sortDir={sortDir}
                              />
                            )}
                          </span>
                        </button>
                      ) : (
                        <span className="px-2">{columnLabel}</span>
                      )}
                      {isFilterable && filterContent && (
                        <span className="absolute end-0 flex items-center justify-center">
                          <ColFilterPopover
                            colKey={col.key}
                            label={columnLabel}
                            active={isActive}
                            onClear={() => setColFilter(col.key, "")}
                          >
                            {filterContent}
                          </ColFilterPopover>
                        </span>
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
                <td colSpan={activeCols.length} className="ta-td !px-1">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Users size={40} className="opacity-60" aria-hidden />
                    <p className="font-medium">{t('noResults')}</p>
                    <p className="text-xs">
                      {t('changeFiltersOrAddEmployee')}
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
                        t,
                      });
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </DoubleScrollbar>

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
