import { lazy, Suspense } from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { useAuth } from './contexts/AuthContext';
import { useAdmin } from './hooks/useAdmin';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { Layout } from './components/Layout';
import { InstallPrompt } from './components/InstallPrompt';
import { OnboardingTour } from './components/OnboardingTour';

const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const JournalPage    = lazy(() => import('./pages/JournalPage').then(m => ({ default: m.JournalPage })));
const InsightsPage   = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })));
const SettingsPage   = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const PracticasPage  = lazy(() => import('./pages/PracticasPage').then(m => ({ default: m.PracticasPage })));
const AdminPage      = lazy(() => import('./pages/AdminPage').then(m => ({ default: m.AdminPage })));
const TokenUsagePage     = lazy(() => import('./pages/admin/TokenUsagePage').then(m => ({ default: m.TokenUsagePage })));
const TokenCostsPage     = lazy(() => import('./pages/admin/TokenCostsPage').then(m => ({ default: m.TokenCostsPage })));
const AdminUsersPage     = lazy(() => import('./pages/admin/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const CrisisEventsPage   = lazy(() => import('./pages/admin/CrisisEventsPage').then(m => ({ default: m.CrisisEventsPage })));
const CrisisResourcesPage = lazy(() => import('./pages/admin/CrisisResourcesPage').then(m => ({ default: m.CrisisResourcesPage })));
const PlanLimitsPage     = lazy(() => import('./pages/admin/PlanLimitsPage').then(m => ({ default: m.PlanLimitsPage })));
const AdminEmailPage     = lazy(() => import('./pages/admin/AdminEmailPage').then(m => ({ default: m.AdminEmailPage })));
const CostPerCyclePage   = lazy(() => import('./pages/admin/CostPerCyclePage').then(m => ({ default: m.CostPerCyclePage })));

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </Layout>
  );
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useAdmin();
  if (loading || adminLoading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;
  if (!isAdmin) return <Redirect to="/chat" />;
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Component />
      </Suspense>
    </Layout>
  );
}

const ChatRoute          = () => <ProtectedRoute component={ChatPage} />;
const JournalRoute       = () => <ProtectedRoute component={JournalPage} />;
const InsightsRoute      = () => <ProtectedRoute component={InsightsPage} />;
const SettingsRoute      = () => <ProtectedRoute component={SettingsPage} />;
const PracticasRoute     = () => <ProtectedRoute component={PracticasPage} />;
const AdminPageRoute     = () => <AdminRoute component={AdminPage} />;
const TokenUsageRoute    = () => <AdminRoute component={TokenUsagePage} />;
const TokenCostsRoute    = () => <AdminRoute component={TokenCostsPage} />;
const AdminUsersRoute    = () => <AdminRoute component={AdminUsersPage} />;
const CrisisEventsRoute  = () => <AdminRoute component={CrisisEventsPage} />;
const CrisisResourcesRoute = () => <AdminRoute component={CrisisResourcesPage} />;
const PlanLimitsRoute    = () => <AdminRoute component={PlanLimitsPage} />;
const AdminEmailRoute    = () => <AdminRoute component={AdminEmailPage} />;
const CostPerCycleRoute  = () => <AdminRoute component={CostPerCyclePage} />;

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Redirect to="/chat" />;
  return <LandingPage />;
}

function App() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;

  return (
    <>
      <Switch>
        <Route path="/"                      component={HomeRoute} />
        <Route path="/login"                 component={LoginPage} />
        <Route path="/reset-password"        component={() => <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
        <Route path="/chat"                  component={ChatRoute} />
        <Route path="/journal"               component={JournalRoute} />
        <Route path="/practicas"             component={PracticasRoute} />
        <Route path="/insights"              component={InsightsRoute} />
        <Route path="/settings"              component={SettingsRoute} />
        <Route path="/admin"                 component={AdminPageRoute} />
        <Route path="/admin/cost-per-cycle"  component={CostPerCycleRoute} />
        <Route path="/admin/token-usage"     component={TokenUsageRoute} />
        <Route path="/admin/token-costs"     component={TokenCostsRoute} />
        <Route path="/admin/users"           component={AdminUsersRoute} />
        <Route path="/admin/crisis-events"     component={CrisisEventsRoute} />
        <Route path="/admin/crisis-resources"  component={CrisisResourcesRoute} />
        <Route path="/admin/plan-limits"     component={PlanLimitsRoute} />
        <Route path="/admin/email-campaigns" component={AdminEmailRoute} />
        <Route>
          {user ? <Redirect to="/chat" /> : <Redirect to="/" />}
        </Route>
      </Switch>

      {/* PWA install prompt */}
      <InstallPrompt />

      {/* Onboarding tour — auto-shows on first login, re-triggerable from Configuración */}
      {user && <OnboardingTour />}
    </>
  );
}

export default App;
