import React from "react";
import { RouteObject, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore.js";
import { AppLayout } from "./components/AppLayout.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { PublicOnlyRoute } from "./components/PublicOnlyRoute.js";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Login } from "./pages/Login.js";
import { Signup } from "./pages/Signup.js";
import { Meetings } from "./pages/Meetings.js";
import { MeetingDetail } from "./pages/MeetingDetail.js";
import { Room } from "./pages/Room.js";
import { Tasks } from "./pages/Tasks.js";
import { Analytics } from "./pages/Analytics.js";
import { Settings } from "./pages/Settings.js";
import { NotFound } from "./pages/NotFound.js";
import { Forbidden } from "./pages/Forbidden.js";

function RootRedirect(): React.JSX.Element | null {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) {
    return null;
  }
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/",
        element: <RootRedirect />,
      },
      // Public auth routes (signed-in users redirected to /dashboard)
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: "/login", element: <Login /> },
          { path: "/signup", element: <Signup /> },
        ],
      },
      // Protected app routes
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: "/dashboard", element: <Dashboard /> },
              { path: "/meetings", element: <Meetings /> },
              { path: "/meetings/:id", element: <MeetingDetail /> },
              { path: "/tasks", element: <Tasks /> },
              { path: "/analytics", element: <Analytics /> },
              { path: "/settings", element: <Settings /> },
            ],
          },
          // Room route also protected, with returnTo support
          { path: "/room/:roomCode", element: <Room /> },
        ],
      },
      // Standalone error & fallback pages
      { path: "/forbidden", element: <Forbidden /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];
