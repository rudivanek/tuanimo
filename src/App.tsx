import { lazy, Suspense, useEffect } from 'react';
import { Route, Switch, Redirect } from 'wouter';
import { useAuth } from './contexts/AuthContext';
import { useAdmin } from './hooks/useAdmin';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { Layout } from './components/Layout';
import { InstallPrompt } from './components/InstallPrompt';
import { OnboardingTour } from './components/OnboardingTour';
import { OnboardingConversation } from './components/OnboardingConversation';
import { UpdateBanner } from './components/UpdateBanner';
import { useOnboardingGate } from './hooks/useOnboardingGate';

const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const JournalPage    = lazy(() => import('./pages/JournalPage').then(m => ({ default: m.JournalPage })));
const InsightsPage   = lazy(() => import('./pages/InsightsPage').then(m => ({ default: m.InsightsPage })));;
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
const AISettingsPage     = lazy(() => import('./pages/admin/AISettingsPage').then(m => ({ default: m.AISettingsPage })));
const AdminAnalyticsPage = lazy(() => import('./pages/admin/AdminAnalyticsPage').then(m => ({ default: m.AdminAnalyticsPage })));
const ElenaMemoryPage    = lazy(() => import('./pages/ElenaMemoryPage').then(m => ({ default: m.ElenaMemoryPage })));

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
const ElenaMemoryRoute   = () => <ProtectedRoute component={ElenaMemoryPage} />;
const AdminPageRoute     = () => <AdminRoute component={AdminPage} />;
const TokenUsageRoute    = () => <AdminRoute component={TokenUsagePage} />;
const TokenCostsRoute    = () => <AdminRoute component={TokenCostsPage} />;
const AdminUsersRoute    = () => <AdminRoute component={AdminUsersPage} />;
const CrisisEventsRoute  = () => <AdminRoute component={CrisisEventsPage} />;
const CrisisResourcesRoute = () => <AdminRoute component={CrisisResourcesPage} />;
const PlanLimitsRoute    = () => <AdminRoute component={PlanLimitsPage} />;
const AdminEmailRoute    = () => <AdminRoute component={AdminEmailPage} />;
const CostPerCycleRoute  = () => <AdminRoute component={CostPerCyclePage} />;
const AdminAnalyticsRoute = () => <AdminRoute component={AdminAnalyticsPage} />;

function HomeRoute() {
  const { user, loading } = useAuth();

  // Logged-out visitors landing on the app domain get sent to the marketing
  // site — except inside the installed PWA, where ejecting to a website would
  // be jarring; those users go to the login screen instead.
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true);

  // Never bounce out of a dev server or an embedded preview (Bolt, StackBlitz):
  // the external site refuses to be framed and the preview dies.
  const canLeaveApp =
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.self === window.top;

  const hasBlockedNotice = (() => {
    try {
      return !!localStorage.getItem('conelena_account_blocked');
    } catch {
      return false;
    }
  })();

  useEffect(() => {
    if (!loading && !user && !isStandalone && canLeaveApp && !hasBlockedNotice) {
      window.location.replace('https://conelena.app');
    }
  }, [loading, user, isStandalone, canLeaveApp, hasBlockedNotice]);

  if (loading) return <LoadingScreen />;
  if (user) return <Redirect to="/chat" />;
  if (isStandalone || !canLeaveApp || hasBlockedNotice) return <Redirect to="/login" />;
  return <LoadingScreen />;
}

function App() {
  const { user, loading } = useAuth();
  const { needsOnboarding, markComplete } = useOnboardingGate(user?.id ?? null, loading);

  if (loading) return <LoadingScreen />;

  // Show Elena onboarding overlay before anything else (new users + existing beta users)
  if (user && needsOnboarding) {
    return <OnboardingConversation onComplete={markComplete} />;
  }

  return (
    <>
      {/* Update banner — appears at top when a new deploy is detected */}
      <UpdateBanner />

      <Switch>
        <Route path="/"                      component={HomeRoute} />
        <Route path="/login"                 component={LoginPage} />
        <Route path="/reset-password"        component={() => <Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
        <Route path="/chat"                  component={ChatRoute} />
        <Route path="/journal"               component={JournalRoute} />
        <Route path="/practicas"             component={PracticasRoute} />
        <Route path="/insights"              component={InsightsRoute} />
        <Route path="/settings"              component={SettingsRoute} />
        <Route path="/memory"                component={ElenaMemoryRoute} />
        <Route path="/admin"                 component={AdminPageRoute} />
        <Route path="/admin/cost-per-cycle"  component={CostPerCycleRoute} />
        <Route path="/admin/token-usage"     component={TokenUsageRoute} />
        <Route path="/admin/token-costs"     component={TokenCostsRoute} />
        <Route path="/admin/users"           component={AdminUsersRoute} />
        <Route path="/admin/crisis-events"     component={CrisisEventsRoute} />
        <Route path="/admin/crisis-resources"  component={CrisisResourcesRoute} />
        <Route path="/admin/plan-limits"     component={PlanLimitsRoute} />
        <Route path="/admin/email-campaigns" component={AdminEmailRoute} />
        <Route path="/admin/analytics"       component={AdminAnalyticsRoute} />
        <Route path="/admin/ai-settings"     component={() => <Suspense fallback={<LoadingScreen />}><AISettingsPage /></Suspense>} />
        <Route>
          {user ? <Redirect to="/chat" /> : <Redirect to="/" />}
        </Route>
      </Switch>

      {/* PWA install prompt — only shows on mobile, only when logged in, only if not already installed */}
      <InstallPrompt />

      {/* Onboarding tour — auto-shows for first-time users, re-openable from Settings */}
      {user && <OnboardingTour />}
    </>
  );
}

export default App;

