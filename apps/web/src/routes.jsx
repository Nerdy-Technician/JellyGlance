import { lazy } from "react";
import { Navigate } from "react-router-dom";

const Home = lazy(() => import("./pages/home"));
const Settings = lazy(() => import("./pages/settings"));
const Users = lazy(() => import("./pages/users"));
const UserProfilePage = lazy(() => import("./pages/user-profile"));
const Libraries = lazy(() => import("./pages/libraries"));
const LibraryInfo = lazy(() => import("./pages/components/library-info"));
const ItemInfo = lazy(() => import("./pages/components/item-info"));
const About = lazy(() => import("./pages/about"));
const TestingRoutes = lazy(() => import("./pages/testing"));
const Activity = lazy(() => import("./pages/activity"));
const Statistics = lazy(() => import("./pages/statistics"));
const ActivityTimeline = lazy(() => import("./pages/activity_time_line"));
const RecentlyAddedPage = lazy(() => import("./pages/recently-added"));
const Integrations = lazy(() => import("./pages/integrations"));
const Calendar = lazy(() => import("./pages/calendar"));
const Requests = lazy(() => import("./pages/requests"));
const Downloads = lazy(() => import("./pages/downloads"));
const ServerManagement = lazy(() => import("./pages/server-management"));
const Wizarr = lazy(() => import("./pages/wizarr"));

const routes = [
  { path: "/", element: <Home />, exact: true },
  { path: "/home/kiosk", element: <Home kioskMode />, exact: true },
  { path: "/settings", element: <Settings />, exact: true },
  { path: "/users", element: <Users />, exact: true },
  { path: "/users/:UserId", element: <UserProfilePage />, exact: true },
  { path: "/libraries", element: <Libraries />, exact: true },
  { path: "/libraries/:LibraryId", element: <LibraryInfo />, exact: true },
  { path: "/libraries/item/:Id", element: <ItemInfo />, exact: true },
  { path: "/recently-added", element: <RecentlyAddedPage />, exact: true },
  { path: "/integrations", element: <Integrations />, exact: true },
  { path: "/calendar", element: <Calendar />, exact: true },
  { path: "/requests", element: <Requests />, exact: true },
  { path: "/downloads", element: <Downloads />, exact: true },
  { path: "/wizarr", element: <Wizarr />, exact: true },
  { path: "/server-management", element: <ServerManagement />, exact: true },
  { path: "/repair", element: <Navigate to="/settings?tab=tabRepair" replace />, exact: true },
  { path: "/statistics", element: <Statistics />, exact: true },
  { path: "/activity", element: <Activity />, exact: true },
  { path: "/timeline", element: <ActivityTimeline />, exact: true },
  { path: "/about", element: <About />, exact: true },
  { path: "/testing/*", element: <TestingRoutes />, exact: true },
];

export default routes;
