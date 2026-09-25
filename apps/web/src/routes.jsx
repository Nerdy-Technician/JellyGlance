import { lazy } from "react";
import { Navigate } from "react-router-dom";

const Home = lazy(() => import("./pages/home"));
const Settings = lazy(() => import("./pages/settings"));
const UserProfilePage = lazy(() => import("./pages/user-profile"));
const MyGlance = lazy(() => import("./pages/my-glance"));
const Libraries = lazy(() => import("./pages/libraries"));
const LibraryInfo = lazy(() => import("./pages/components/library-info"));
const ItemInfo = lazy(() => import("./pages/components/item-info"));
const About = lazy(() => import("./pages/about"));
const TestingRoutes = lazy(() => import("./pages/testing"));
const Activity = lazy(() => import("./pages/activity"));
const StatisticsHub = lazy(() => import("./pages/statistics-hub"));
const UsersHub = lazy(() => import("./pages/users-hub"));
const ServerHub = lazy(() => import("./pages/server-hub"));
const ActivityTimeline = lazy(() => import("./pages/activity_time_line"));
const RecentlyAddedPage = lazy(() => import("./pages/recently-added"));
const Integrations = lazy(() => import("./pages/integrations"));
const Calendar = lazy(() => import("./pages/calendar"));
const Requests = lazy(() => import("./pages/requests"));
const Downloads = lazy(() => import("./pages/downloads"));
const ActiveTranscodes = lazy(() => import("./pages/active-transcodes"));

function InsightsRedirect() {
  const tab = new URLSearchParams(window.location.search).get("tab") || "wrapped";
  return <Navigate to={`/statistics?tab=${encodeURIComponent(tab)}`} replace />;
}

const routes = [
  { path: "/", element: <Home />, exact: true },
  { path: "/me", element: <MyGlance />, exact: true },
  { path: "/kiosk", element: <Home kioskMode />, exact: true },
  { path: "/home/kiosk", element: <Home kioskMode />, exact: true },
  { path: "/settings/*", element: <Settings />, exact: true },
  { path: "/users", element: <UsersHub />, exact: true },
  { path: "/users/:UserId", element: <UserProfilePage />, exact: true },
  { path: "/libraries", element: <Libraries />, exact: true },
  { path: "/libraries/:LibraryId", element: <LibraryInfo />, exact: true },
  { path: "/libraries/item/:Id", element: <ItemInfo />, exact: true },
  { path: "/recently-added", element: <RecentlyAddedPage />, exact: true },
  { path: "/integrations", element: <Integrations />, exact: true },
  { path: "/calendar", element: <Calendar />, exact: true },
  { path: "/requests", element: <Requests />, exact: true },
  { path: "/downloads", element: <Downloads />, exact: true },
  { path: "/active-transcodes", element: <ActiveTranscodes />, exact: true },
  { path: "/automation-health", element: <Navigate to="/server-management?tab=automation" replace />, exact: true },
  { path: "/wizarr", element: <Navigate to="/users?tab=invites" replace />, exact: true },
  { path: "/maintainerr", element: <Navigate to="/server-management?tab=maintainerr" replace />, exact: true },
  { path: "/server-management", element: <ServerHub />, exact: true },
  { path: "/server", element: <Navigate to="/server-management" replace />, exact: true },
  { path: "/insights", element: <InsightsRedirect />, exact: true },
  { path: "/repair", element: <Navigate to="/settings/repair" replace />, exact: true },
  { path: "/statistics", element: <StatisticsHub />, exact: true },
  { path: "/activity", element: <Activity />, exact: true },
  { path: "/timeline", element: <ActivityTimeline />, exact: true },
  { path: "/about", element: <About />, exact: true },
  { path: "/swagger", element: <Navigate to="/settings/api-key" replace />, exact: true },
  { path: "/testing/*", element: <TestingRoutes />, exact: true },
];

export default routes;
