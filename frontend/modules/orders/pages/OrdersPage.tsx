import { Suspense, lazy, useCallback, useMemo, Component, type ErrorInfo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent } from '@shared/components/ui/tabs';
import { ResponsiveTabBar } from '@shared/components/ResponsiveTabBar';
import Loading from '@shared/components/Loading';
import { useAuthQueryGate } from '@shared/hooks/useAuthQueryGate';
import { usePermissions } from '@shared/hooks/usePermissions';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const v = searchParams.get('tab');
    return isOrderTab(v) ? v : 'grid';
  }, [searchParams]);

  const onTabChange = useCallback(
    (v: string) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === 'grid') next.delete('tab');
          else next.set('tab', v);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  if (authLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!permissions.can_view) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center" dir="rtl">
        <ShieldAlert size={40} className="text-destructive" />
        <p className="text-lg font-semibold">غير مصرح بالوصول</p>
        <p className="text-sm text-muted-foreground">ليس لديك صلاحية الوصول لصفحة الطلبات</p>
      </div>
    );
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
              { value: 'wallet', label: '💼 المحفظة', selectLabel: 'المحفظة' },
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
          <TabsContent value="wallet" className="mt-2 outline-none">
            <Suspense fallback={<TabLoader />}>
              <WalletTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </OrdersErrorBoundary>
  );
};

export default OrdersPage;
