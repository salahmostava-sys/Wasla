import { lazy, Suspense } from "react";
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

const Login = lazy(() => import("@modules/pages/Login"));

const Dashboard = lazy(() => import("@modules/pages/Dashboard"));
const Employees = lazy(() => import("@modules/employees/pages/EmployeesPage"));
const Attendance = lazy(() => import("@modules/pages/Attendance"));
const Orders = lazy(() => import("@modules/orders/pages/OrdersPage"));
const Salaries = lazy(() => import("@modules/salaries/pages/SalariesPage"));
const Advances = lazy(() => import("@modules/advances/pages/AdvancesPage"));
const FuelPage = lazy(() => import("@modules/fuel/pages/FuelPage"));
const MaintenancePage = lazy(() => import("@modules/maintenance/pages/MaintenancePage"));
const Apps = lazy(() => import("@modules/pages/Apps"));
const AppSettingsPage = lazy(() => import("@modules/apps/pages/AppSettingsPage").then(m => ({ default: m.AppSettingsPage })));
const Alerts = lazy(() => import("@modules/pages/Alerts"));
const SettingsHub = lazy(() => import("@modules/pages/SettingsHub"));
const ViolationResolverPage = lazy(() => import("@modules/violations/pages/ViolationResolverPage"));
const FinancePage = lazy(() => import("@modules/finance/pages/FinancePage"));
const Motorcycles = lazy(() => import("@modules/pages/Motorcycles"));
const VehicleAssignment = lazy(() => import("@modules/pages/VehicleAssignment"));
const EmployeeTiers = lazy(() => import("@modules/pages/EmployeeTiers"));
const PlatformAccounts = lazy(() => import("@modules/pages/PlatformAccounts"));
const AiAnalytics = lazy(() => import("@modules/pages/AiAnalyticsPage"));
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

const queryClient = new QueryClient({
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
    <ErrorContextSync />
    <ProgressBar />
    <KeyboardShortcuts />
    <OfflineIndicator />
    <AlertsFaviconBadge />
    <LanguageProvider>
      <TemporalProvider>
        <SystemSettingsProvider>
          <Outlet />
        </SystemSettingsProvider>
      </TemporalProvider>
    </LanguageProvider>
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
          { path: "advances", element: <PageGuard pageKey="advances"><Advances /></PageGuard> },
          { path: "finance", element: <PageGuard pageKey="finance"><FinancePage /></PageGuard> },
          { path: "motorcycles", element: <PageGuard pageKey="vehicles"><Motorcycles /></PageGuard> },
          {
            path: "vehicle-assignment",
            element: <PageGuard pageKey="vehicle_assignment"><VehicleAssignment /></PageGuard>,
          },
          { path: "fuel", element: <PageGuard pageKey="fuel"><FuelPage /></PageGuard> },
          { path: "maintenance", element: <PageGuard pageKey="maintenance"><MaintenancePage /></PageGuard> },
          { path: "apps", element: <PageGuard pageKey="apps"><Apps /></PageGuard> },
          { path: "apps/settings", element: <PageGuard pageKey="apps"><AppSettingsPage /></PageGuard> },
          { path: "alerts", element: <PageGuard pageKey="alerts"><Alerts /></PageGuard> },
          { path: "employee-tiers", element: <PageGuard pageKey="employee_tiers"><EmployeeTiers /></PageGuard> },
          {
            path: "platform-accounts",
            element: <PageGuard pageKey="platform_accounts"><PlatformAccounts /></PageGuard>,
          },
          { path: "ai-analytics", element: <PageGuard pageKey="ai_analytics"><AiAnalytics /></PageGuard> },
          { path: "profile", element: <ProfilePage /> },
          { path: "profile-page", element: <Navigate to="/profile" replace /> },
          { path: "settings", element: <PageGuard pageKey="settings"><SettingsHub /></PageGuard> },
          { path: "settings/general", element: <Navigate to="/settings?tab=general" replace /> },
          { path: "settings/schemes", element: <Navigate to="/settings?tab=schemes" replace /> },
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

const App = () => (
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

export default App;
