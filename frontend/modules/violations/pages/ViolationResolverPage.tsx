import { FileWarning } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useViolationTable } from '@modules/violations/hooks/useViolationTable';
import ViolationSearchTab from '@modules/violations/components/ViolationSearchTab';
import ViolationFilters from '@modules/violations/components/ViolationFilters';
import ViolationTable from '@modules/violations/components/ViolationTable';
import ResolveViolationModal from '@modules/violations/components/ResolveViolationModal';
import { savedViolationsCountLabel } from '@modules/violations/lib/violationUtils';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';

const ViolationResolverPage = () => {
  const v = useViolationTable();

  if (v.violationsError && !v.violationsLoading) {
    return (
      <div className="space-y-5" dir="rtl">
        <QueryErrorRetry
          error={v.violationsError}
          onRetry={() => v.refetchViolations().catch(() => {})}
          title="تعذر تحميل بيانات المخالفات"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5" dir="rtl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <FileWarning className="text-destructive" size={22} />
        </div>
        <div>
          <nav className="page-breadcrumb">
            <span>العمليات</span>
            <span className="page-breadcrumb-sep">/</span>
            <span className="text-foreground font-medium">استعلام المخالفات</span>
          </nav>
          <h1 className="page-title">استعلام المخالفات</h1>
        </div>
      </div>

      <div className="max-w-5xl space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="border bg-card p-3 text-sm rounded-2xl">إجمالي المخالفات: <span className="font-bold">{v.violationStats.total}</span></div>
          <div className="border bg-card p-3 text-sm rounded-2xl">قيد المراجعة: <span className="font-bold">{v.violationStats.pending}</span></div>
          <div className="border bg-card p-3 text-sm rounded-2xl">موافَق: <span className="font-bold">{v.violationStats.approved}</span></div>
          <div className="border bg-card p-3 text-sm rounded-2xl">محوّل لسلفة: <span className="font-bold">{v.violationStats.converted}</span></div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant={v.activeTab === 'search' ? 'default' : 'outline'} size="sm" onClick={() => v.setActiveTab('search')}>
            الاستعلام
          </Button>
          <Button
            variant={v.activeTab === 'saved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              v.setActiveTab('saved');
              v.fetchViolations();
            }}
          >
            المخالفات المرحلة
          </Button>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            بعد تأكيد ✓ من الاستعلام تُحفظ تلقائياً؛ يمكنك حذف أو «ترحيل للمرحلة» من الجدول ثم المراجعة في التبويب الثاني.
          </span>
        </div>

        {v.activeTab === 'search' && (
          <ViolationSearchTab
            form={v.form}
            setForm={v.setForm}
            suggestions={v.suggestions}
            showSuggestions={v.showSuggestions}
            setShowSuggestions={v.setShowSuggestions}
            suggRef={v.suggRef}
            selectVehicle={v.selectVehicle}
            handleSearch={v.handleSearch}
            handleReset={v.handleReset}
            searching={v.searching}
            noVehicle={v.noVehicle}
            results={v.results}
            dateDisplay={v.dateDisplay}
            perms={v.perms}
            assigningEmployeeId={v.assigningEmployeeId}
            handleAssign={v.handleAssign}
            handleDeleteSearchResultRow={v.handleDeleteSearchResultRow}
            handleTransferSearchRowToSaved={v.handleTransferSearchRowToSaved}
            deletingSearchDeductionId={v.deletingSearchDeductionId}
            setResults={v.setResults}
            setNoVehicle={v.setNoVehicle}
            setAssigningEmployeeId={v.setAssigningEmployeeId}
          />
        )}

        {/* ── Violations Management ── */}
        {v.activeTab === 'saved' && (
        <div className="bg-card border border-border/50 -2xl shadow-sm overflow-hidden rounded-2xl">
          <div className="px-5 py-3 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                المخالفات المرحلة (المؤكَّدة والمحفوظة)
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                كل ما تم تأكيده ✓ من جدول الاستعلام يُسجَّل هنا؛ يمكن تعديلها أو حذفها أو تحويلها لسلفة. إن رحّلت من الاستعلام بزر «ترحيل للمرحلة» سيُفلتر الجدول باسم المندوب للمراجعة.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => v.setActiveTab('search')}>
                ← رجوع للاستعلام
              </Button>
              <span className="text-xs text-muted-foreground">{savedViolationsCountLabel(v.violationsLoading, v.violations.length)}</span>
            </div>
          </div>

          <ViolationFilters
            savedSearch={v.savedSearch}
            setSavedSearch={v.setSavedSearch}
            savedStatusFilter={v.savedStatusFilter}
            setSavedStatusFilter={v.setSavedStatusFilter}
          />

          <ViolationTable
            violationsLoading={v.violationsLoading}
            filteredSortedViolations={v.filteredSortedViolations}
            toggleVSort={v.toggleVSort}
            vSortField={v.vSortField}
            vSortDir={v.vSortDir}
            perms={v.perms}
            isViolationConvertedToAdvance={v.isViolationConvertedToAdvance}
            openEditViolation={v.openEditViolation}
            handleDeleteViolation={v.handleDeleteViolation}
            handleConvertToAdvance={v.handleConvertToAdvance}
            deletingId={v.deletingId}
            convertingId={v.convertingId}
          />
        </div>
        )}

        <ResolveViolationModal
          editDialogOpen={v.editDialogOpen}
          setEditDialogOpen={v.setEditDialogOpen}
          editForm={v.editForm}
          setEditForm={v.setEditForm}
          editSaving={v.editSaving}
          handleSaveEdit={v.handleSaveEdit}
          perms={v.perms}
        />
      </div>

    </div>
  );
};

export default ViolationResolverPage;
