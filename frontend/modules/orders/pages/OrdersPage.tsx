import { Suspense, lazy, Component, type ErrorInfo, type ReactNode } from 'react';
import { Package, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent } from '@shared/components/ui/tabs';
import { ResponsiveTabBar } from '@shared/components/ResponsiveTabBar';
import Loading from '@shared/components/Loading';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions } from '@shared/hooks/usePermissions';
import { useUrlTab } from '@shared/hooks/useUrlTab';
import { PageLoadingState, PageAccessDeniedState } from '@shared/components/PageAccessState';
import { Button } from '@shared/components/ui/button';
import { logError } from '@shared/lib/logger';

/* ── Simple error boundary for page-level errors ── */
class OrdersErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError('[OrdersPage] Error boundary caught', error, { meta: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center" dir="rtl">
          <AlertTriangle size={40} className="text-destructive" />
          <p className="text-lg font-semibold">حدث خطأ غير متوقع</p>
          <p className="text-sm text-muted-foreground">{this.state.error?.message || 'حاول إعادة تحميل الصفحة'}</p>
          <Button variant="outline" onClick={() => this.setState({ hasError: false, error: null })}>
            إعادة المحاولة
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const SpreadsheetGridTab = lazy(() =>
  import('@modules/orders/components/SpreadsheetGridTab').then((module) => ({
    default: module.SpreadsheetGridTab,
  })),
);
const MonthSummaryTab = lazy(() =>
  import('@modules/orders/components/MonthSummaryTab').then((module) => ({
    default: module.MonthSummaryTab,
  })),
);
const ShiftsTabWrapper = lazy(() =>
  import('@modules/orders/components/ShiftsTabWrapper').then((module) => ({
    default: module.ShiftsTabWrapper,
  })),
);
const WalletTab = lazy(() =>
  import('@modules/wallet/pages/WalletPage').then((module) => ({
    default: module.default,
  })),
);

const ORDER_TABS = ['grid', 'shifts', 'summary', 'wallet'] as const;
type OrderTab = (typeof ORDER_TABS)[number];

const isOrderTab = (v: string | null): v is OrderTab =>
  v !== null && ORDER_TABS.includes(v as OrderTab);

const TabLoader = () => <Loading minHeightClassName="min-h-[240px]" />;

const OrdersPage = () => {
  const { authLoading } = useAuthQueryGate();
  const { permissions, loading: permsLoading } = usePermissions('orders');
  const { permissions: walletPerms } = usePermissions('wallet');
  const { tab, onTabChange } = useUrlTab(isOrderTab, 'grid');

  if (authLoading || permsLoading) {
    return <PageLoadingState />;
  }

  if (!permissions.can_view) {
    return <PageAccessDeniedState message="ليس لديك صلاحية الوصول لصفحة الطلبات" dir="rtl" />;
  }

  return (
    <OrdersErrorBoundary>
      <div className="flex flex-col gap-3 w-full" dir="rtl">
        <div className="flex-shrink-0">
          <nav className="page-breadcrumb">
            <span>الرئيسية</span>
            <span className="page-breadcrumb-sep">/</span>
            <span>الطلبات اليومية</span>
          </nav>
          <h1 className="page-title flex items-center gap-2">
            <Package size={18} /> الطلبات اليومية
          </h1>
        </div>

        <Tabs value={tab} onValueChange={onTabChange} dir="rtl" className="w-full">
          <ResponsiveTabBar
            value={tab}
            onValueChange={onTabChange}
            selectAriaLabel="قسم الطلبات"
            tabsListClassName="bg-muted/50 p-0.5 h-9 items-stretch"
            options={[
              { value: 'grid', label: '📦 الطلبات', selectLabel: 'الطلبات' },
              { value: 'shifts', label: '⏰ الدوام', selectLabel: 'الدوام' },
              { value: 'summary', label: '📊 ملخص الشهر', selectLabel: 'ملخص الشهر' },
              ...(walletPerms.can_view ? [{ value: 'wallet', label: '💼 المحفظة', selectLabel: 'المحفظة' }] : []),
            ]}
          />
          <TabsContent value="grid" className="mt-2 outline-none">
            <Suspense fallback={<TabLoader />}>
              <SpreadsheetGridTab />
            </Suspense>
          </TabsContent>
          <TabsContent value="shifts" className="mt-2 outline-none">
            <Suspense fallback={<TabLoader />}>
              <ShiftsTabWrapper />
            </Suspense>
          </TabsContent>
          <TabsContent value="summary" className="mt-2 overflow-x-auto outline-none">
            <Suspense fallback={<TabLoader />}>
              <MonthSummaryTab />
            </Suspense>
          </TabsContent>
          {walletPerms.can_view && (
            <TabsContent value="wallet" className="mt-2 outline-none">
              <Suspense fallback={<TabLoader />}>
                <WalletTab />
              </Suspense>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </OrdersErrorBoundary>
  );
};

export default OrdersPage;
