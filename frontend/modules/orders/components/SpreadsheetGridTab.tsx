import React from 'react';
import { OrdersGridTable } from '@shared/components/orders/OrdersGridTable';
import { OrdersCellPopover } from '@shared/components/orders/OrdersCellPopover';
import { useAppColors } from '@shared/hooks/useAppColors';
import { useSpreadsheetGrid } from '@modules/orders/hooks/useSpreadsheetGrid';
import { monthLabel, isPastMonth } from '@modules/orders/utils/dateMonth';
import { shortName } from '@modules/orders/utils/text';
import { OrdersSpreadsheetHint, OrdersSpreadsheetToolbar } from '@modules/orders/components/OrdersSpreadsheetToolbar';
import { ImportPlatformDialog } from '@modules/orders/components/ImportPlatformDialog';
import { BulkDeleteOrdersDialog } from '@modules/orders/components/BulkDeleteOrdersDialog';
import { NameMappingDialog } from '@modules/orders/components/NameMappingDialog';
import { OrdersImportHistorySummary } from '@modules/orders/components/OrdersImportHistorySummary';

export const SpreadsheetGridTab = React.memo(() => {
  const g = useSpreadsheetGrid();
  const { apps: appColorsList } = useAppColors();

  return (
    <div className="flex flex-col gap-2">
      <OrdersSpreadsheetToolbar
        appColorsList={appColorsList}
        apps={g.apps}
        monthLabelText={monthLabel(g.year, g.month)}
        search={g.search}
        onSearchChange={g.setSearch}
        monthGrandTotal={g.monthGrandTotal}
        allPlatformsGrandTotal={g.allPlatformsGrandTotal}
        monthDailyAvg={g.monthDailyAvg}
        filteredEmployeesCount={g.filteredEmployees.length}
        platformFilter={g.platformFilter}
        onPlatformFilter={g.setPlatformFilter}
        platformOrderTotals={g.platformOrderTotals}
        onPrevMonth={g.prevMonth}
        onNextMonth={g.nextMonth}
        importRef={g.importRef}
        onImportChange={g.handleImport}
        onExport={g.exportExcel}
        onTemplate={g.handleTemplate}
        onPickImport={() => g.importRef.current?.click()}
        onPrint={g.handlePrint}
        onSave={g.handleSave}
        onLockMonth={g.handleLockMonth}
        onBulkDelete={() => g.setShowBulkDeleteDialog(true)}
        canEdit={g.permissions.can_edit}
        canShowSave={g.permissions.can_edit && !g.isMonthLocked}
        canShowLock={g.permissions.can_edit && isPastMonth(g.year, g.month) && !g.isMonthLocked}
        saving={g.saving}
        lockingMonth={g.lockingMonth}
        isMonthLocked={g.isMonthLocked}
      />

      <OrdersSpreadsheetHint isMonthLocked={g.isMonthLocked} />
      <OrdersImportHistorySummary batches={g.importHistory} onDelete={g.handleDeleteImportBatch} />

      <OrdersGridTable
        loading={g.loading}
        tableRef={g.tableRef}
        seqColMin={g.seqColMin}
        repColMin={g.repColMin}
        days={g.days}
        year={g.year}
        month={g.month}
        today={g.today}
        filteredEmployees={g.filteredEmployees}
        visibleApps={g.visibleApps}
        appColorsList={appColorsList}
        expandedEmp={g.expandedEmp}
        cellPopover={g.cellPopover}
        canEditMonth={g.canEditMonth}
        dayArr={g.dayArr}
        getVal={g.getVal}
        getActiveApps={g.getActiveApps}
        empDayTotal={g.empDayTotal}
        empMonthTotal={g.empMonthTotal}
        empAppMonthTotal={g.empAppMonthTotal}
        shortName={shortName}
        toggleExpand={g.toggleExpand}
        handleCellClick={g.handleCellClick}
      />

      {g.cellPopover && (
        <OrdersCellPopover
          state={g.cellPopover}
          apps={g.apps}
          data={g.data}
          appColorsList={appColorsList}
          canEdit={g.canEditMonth}
          onApply={g.handlePopoverApply}
          onClose={() => g.setCellPopover(null)}
        />
      )}

      <ImportPlatformDialog
        open={g.showImportDialog}
        apps={g.apps}
        onConfirm={g.handleImportConfirm}
        onCancel={g.handleImportCancel}
      />

      <BulkDeleteOrdersDialog
        open={g.showBulkDeleteDialog}
        employees={g.employees}
        apps={g.apps}
        year={g.year}
        month={g.month}
        onConfirm={g.handleBulkDelete}
        onCancel={() => g.setShowBulkDeleteDialog(false)}
      />

      <NameMappingDialog
        open={g.showNameMappingDialog}
        unmatched={g.unmatchedNames}
        onConfirm={g.handleNameMappingConfirm}
        onCancel={g.handleNameMappingCancel}
      />
    </div>
  );
});

SpreadsheetGridTab.displayName = 'SpreadsheetGridTab';
