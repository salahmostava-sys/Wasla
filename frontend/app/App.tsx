import { lazy, Suspense, useState } from "react";
import { ChunkRecoveryBootstrap } from "@app/components/ChunkRecoveryBootstrap";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@app/providers/AuthContext";
import { LanguageProvider } from "@app/providers/LanguageContext";
import { SystemSettingsProvider } from "@app/providers/SystemSettingsContext";
import { TemporalProvider } from "@app/providers/TemporalContext";
import { ThemeProvider } from "@app/providers/ThemeContext";
import DashboardLayout from "@app/layout/DashboardLayout";
import PublicLayout from "@app/layout/PublicLayout";
import "@app/i18n";
import { ErrorContextSync } from "@app/components/ErrorContextSync";
import { ProgressBar } from "@shared/components/ProgressBar";
import { KeyboardShortcuts } from "@shared/components/KeyboardShortcuts";
import { OfflineIndicator } from "@shared/components/OfflineIndicator";
import { AlertsFaviconBadge } from "@shared/components/AlertsFaviconBadge";
import { TooltipProvider } from "@shared/components/ui/tooltip";
import ErrorBoundary from "@shared/components/ErrorBoundary";
import Loading from "@shared/components/Loading";
import PageGuard from "@shared/components/PageGuard";
import ProtectedRoute from "@shared/components/ProtectedRoute";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, RouterProvider, createBrowserRouter, Outlet, useLocation } from "react-router-dom";
import { emitAuthFailure, isStrictUnauthenticatedError } from "@shared/lib/auth/authFailureBus";
import { UndoProvider } from "@shared/context/UndoContext";

const Login = lazy(() => import("@modules/pages/Login"));

const Dashboard = lazy(() => import("@modules/dashboard/pages/DashboardPage"));
const Employees = lazy(() => import("@modules/employees/pages/EmployeesPage"));
const Attendance = lazy(() => import("@modules/attendance/pages/AttendancePage"));
const Orders = lazy(() => import("@modules/orders/pages/OrdersPage"));
const Salaries = lazy(() => import("@modules/salaries/pages/SalariesPage"));
const Advances = lazy(() => import("@modules/advances/pages/AdvancesPage"));
const FuelPage = lazy(() => import("@modules/fuel/pages/FuelPage"));
const MaintenancePage = lazy(() => import("@modules/maintenance/pages/MaintenancePage"));
const VehicleReportPage = lazy(() => import("@modules/maintenance/pages/VehicleReportPage"));
const Apps = lazy(() => import("@modules/apps/pages/AppsPage"));
const AppSettingsPage = lazy(() => import("@modules/apps/pages/AppSettingsPage").then(m => ({ default: m.AppSettingsPage })));
const Alerts = lazy(() => import("@modules/pages/Alerts"));
const SettingsHub = lazy(() => import("@modules/pages/SettingsHub"));
const ViolationResolverPage = lazy(() => import("@modules/violations/pages/ViolationResolverPage"));
const FinancePage = lazy(() => import("@modules/finance/pages/FinancePage"));
const WalletPage = lazy(() => import("@modules/wallet/pages/WalletPage"));
const Motorcycles = lazy(() => import("@modules/pages/Motorcycles"));
const VehicleAssignment = lazy(() => import("@modules/pages/VehicleAssignment"));
const EmployeeTiers = lazy(() => import("@modules/pages/EmployeeTiers"));
const ProfilePage = lazy(() => import("@modules/pages/ProfilePage"));
const NotFound = lazy(() => import("@modules/pages/NotFound"));

const PageLoader = () => {
  const location = useLocation();
  const resetKey = `${location.pathname}${location.search}`;
  return <Loading minHeightClassName="min-h-[300px]" resetKey={resetKey} />;
};

const handleGlobalAuthError = (source: "query" | "mutation", error: unknown) => {
  if (!isStrictUnauthenticatedError(error)) return;
  emitAuthFailure({ source, reason: "unauthenticated" });
};

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => handleGlobalAuthError("query", error),
    }),
    mutationCache: new MutationCache({
      onError: (error) => handleGlobalAuthError("mutation", error),
    }),
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
    },
  });
}

const DashboardRouteShell = () => (
  <DashboardLayout>
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </ErrorBoundary>
  </DashboardLayout>
);

const AppProvidersShell = () => (
  <AuthProvider>
    <UndoProvider>
      <ErrorContextSync />
      <ProgressBar />
      <KeyboardShortcuts />
      <OfflineIndicator />
      <LanguageProvider>
        <TemporalProvider>
          <SystemSettingsProvider>
            <AlertsFaviconBadge />
            <Outlet />
          </SystemSettingsProvider>
        </TemporalProvider>
      </LanguageProvider>
    </UndoProvider>
  </AuthProvider>
);

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppProvidersShell />,
    children: [
      {
        path: "login",
        element: (
          <PublicLayout>
            <Login />
          </PublicLayout>
        ),
      },
      {
        path: "/",
        element: (
          <ProtectedRoute>
            <DashboardRouteShell />
          </ProtectedRoute>
        ),
        children: [
          { index: true, element: <Dashboard /> },
          { path: "employees", element: <PageGuard pageKey="employees"><Employees /></PageGuard> },
          { path: "attendance", element: <PageGuard pageKey="attendance"><Attendance /></PageGuard> },
          { path: "orders", element: <PageGuard pageKey="orders"><Orders /></PageGuard> },
          { path: "salaries", element: <PageGuard pageKey="salaries"><Salaries /></PageGuard> },
          { path: "salary-schemes", element: <Navigate to="/settings?tab=schemes" replace /> },
          { path: "advances", element: <PageGuard pageKey="advances"><Advances /></PageGuard> },
          { path: "finance", element: <PageGuard pageKey="finance"><FinancePage /></PageGuard> },
          { path: "wallet", element: <PageGuard pageKey="finance"><WalletPage /></PageGuard> },
          { path: "motorcycles", element: <PageGuard pageKey="vehicles"><Motorcycles /></PageGuard> },
          {
            path: "vehicle-assignment",
            element: <PageGuard pageKey="vehicle_assignment"><VehicleAssignment /></PageGuard>,
          },
          { path: "fuel", element: <PageGuard pageKey="fuel"><FuelPage /></PageGuard> },
          { path: "maintenance", element: <PageGuard pageKey="maintenance"><MaintenancePage /></PageGuard> },
          { path: "maintenance/vehicle-report", element: <PageGuard pageKey="maintenance"><VehicleReportPage /></PageGuard> },
          { path: "apps", element: <PageGuard pageKey="apps"><Apps /></PageGuard> },
          { path: "apps/settings", element: <PageGuard pageKey="apps"><AppSettingsPage /></PageGuard> },
          { path: "alerts", element: <PageGuard pageKey="alerts"><Alerts /></PageGuard> },
          { path: "employee-tiers", element: <PageGuard pageKey="employee_tiers"><EmployeeTiers /></PageGuard> },
          { path: "profile", element: <ProfilePage /> },
          { path: "profile-page", element: <Navigate to="/profile" replace /> },
          { path: "settings", element: <PageGuard pageKey="settings"><SettingsHub /></PageGuard> },
          { path: "settings/general", element: <Navigate to="/settings?tab=general" replace /> },
          { path: "settings/schemes", element: <Navigate to="/salary-schemes" replace /> },
          { path: "settings/users", element: <Navigate to="/settings?tab=users" replace /> },
          { path: "settings/permissions", element: <Navigate to="/settings?tab=users" replace /> },
          { path: "settings/profile", element: <Navigate to="/profile" replace /> },
          { path: "activity-log", element: <Navigate to="/settings?tab=activity" replace /> },
          { path: "reports", element: <Navigate to="/settings?tab=activity" replace /> },
          { path: "vehicles", element: <Navigate to="/motorcycles" replace /> },
          { path: "vehicle-tracking", element: <Navigate to="/motorcycles" replace /> },
          { path: "deductions", element: <Navigate to="/advances" replace /> },
          {
            path: "violation-resolver",
            element: <PageGuard pageKey="violation_resolver"><ViolationResolverPage /></PageGuard>,
          },
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);

const App = () => {
  const [queryClient] = useState(createQueryClient);

  return (
  <QueryClientProvider client={queryClient}>
    <ChunkRecoveryBootstrap />
    <ThemeProvider>
      <TooltipProvider>
        <Toaster position="top-center" />
        <ErrorBoundary>
          <RouterProvider
            router={router}
            future={{
              v7_startTransition: true,
            }}
          />
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
