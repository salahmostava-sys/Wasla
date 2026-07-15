import { BadgeCheck, Clock3, CreditCard, FileWarning, ListChecks } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { useViolationTable } from '@modules/violations/hooks/useViolationTable';
import ViolationSearchTab from '@modules/violations/components/ViolationSearchTab';
import ViolationFilters from '@modules/violations/components/ViolationFilters';
import ViolationTable from '@modules/violations/components/ViolationTable';
import ResolveViolationModal from '@modules/violations/components/ResolveViolationModal';
import { savedViolationsCountLabel } from '@modules/violations/lib/violationUtils';
import { QueryErrorRetry } from '@shared/components/QueryErrorRetry';

const VIOLATION_STAT_ITEMS = [
  { key: 'total', label: 'إجمالي المخالفات', icon: ListChecks, tone: 'text-primary bg-primary/10' },
  { key: 'pending', label: 'قيد المراجعة', icon: Clock3, tone: 'text-warning bg-warning/10' },
  { key: 'approved', label: 'تمت الموافقة', icon: BadgeCheck, tone: 'text-success bg-success/10' },
  { key: 'converted', label: 'محوّلة إلى سلفة', icon: CreditCard, tone: 'text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/40' },
] as const;

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
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-destructive/10">
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

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {VIOLATION_STAT_ITEMS.map(({ key, label, icon: Icon, tone }) => (
            <div key={key} className="flex min-h-24 items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{v.violationStats[key].toLocaleString('en-US')}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
                <Icon size={19} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
          <Button variant={v.activeTab === 'search' ? 'default' : 'outline'} className="h-10" onClick={() => v.setActiveTab('search')}>
            الاستعلام
          </Button>
          <Button
            variant={v.activeTab === 'saved' ? 'default' : 'outline'}
            className="h-10"
            onClick={() => {
              v.setActiveTab('saved');
              v.fetchViolations();
            }}
          >
            المخالفات المرحلة
          </Button>
          <span className="hidden text-sm text-muted-foreground lg:inline">
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
        <div className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-sm">
          <div className="px-5 py-3 border-b border-border/50 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                المخالفات المرحلة (المؤكَّدة والمحفوظة)
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
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
