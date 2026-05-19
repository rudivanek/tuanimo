import { Route, Switch, Redirect } from 'wouter';
import { useAuth } from './contexts/AuthContext';
import { useAdmin } from './hooks/useAdmin';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ChatPage } from './pages/ChatPage';
import { JournalPage } from './pages/JournalPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { TokenUsagePage } from './pages/admin/TokenUsagePage';
import { TokenCostsPage } from './pages/admin/TokenCostsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { CrisisEventsPage } from './pages/admin/CrisisEventsPage';
import { PlanLimitsPage } from './pages/admin/PlanLimitsPage';
import { Layout } from './components/Layout';

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>
  );
}

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function AdminRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useAdmin();

  if (loading || adminLoading) return <LoadingScreen />;
  if (!user) return <Redirect to="/login" />;
  if (!isAdmin) return <Redirect to="/app/chat" />;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

const ChatRoute = () => <ProtectedRoute component={ChatPage} />;
const JournalRoute = () => <ProtectedRoute component={JournalPage} />;
const InsightsRoute = () => <ProtectedRoute component={InsightsPage} />;
const SettingsRoute = () => <ProtectedRoute component={SettingsPage} />;
const AdminPageRoute = () => <AdminRoute component={AdminPage} />;
const TokenUsageRoute = () => <AdminRoute component={TokenUsagePage} />;
const TokenCostsRoute = () => <AdminRoute component={TokenCostsPage} />;
const AdminUsersRoute = () => <AdminRoute component={AdminUsersPage} />;
const CrisisEventsRoute = () => <AdminRoute component={CrisisEventsPage} />;
const PlanLimitsRoute = () => <AdminRoute component={PlanLimitsPage} />;
const RedirectToAppChat = () => <Redirect to="/app/chat" />;

function HomeRoute() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Redirect to="/app/chat" />;
  return <LandingPage />;
}

function App() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/login" component={LoginPage} />

      <Route path="/app" component={RedirectToAppChat} />
      <Route path="/app/chat" component={ChatRoute} />
      <Route path="/app/journal" component={JournalRoute} />
      <Route path="/app/insights" component={InsightsRoute} />
      <Route path="/app/settings" component={SettingsRoute} />
      <Route path="/app/admin" component={AdminPageRoute} />
      <Route path="/app/admin/token-usage" component={TokenUsageRoute} />
      <Route path="/app/admin/token-costs" component={TokenCostsRoute} />
      <Route path="/app/admin/users" component={AdminUsersRoute} />
      <Route path="/app/admin/crisis-events" component={CrisisEventsRoute} />
      <Route path="/app/admin/plan-limits" component={PlanLimitsRoute} />

      <Route>
        {user ? <Redirect to="/app/chat" /> : <Redirect to="/" />}
      </Route>
    </Switch>
  );
}

export default App;
