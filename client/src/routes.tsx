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
import { Settings } from "./pages/Settings.js";
import { NotFound } from "./pages/NotFound.js";
import { Forbidden } from "./pages/Forbidden.js";

const MeetingDetail = React.lazy(() =>
  import("./pages/MeetingDetail.js").then((m) => ({ default: m.MeetingDetail })),
);
const Room = React.lazy(() =>
  import("./pages/Room.js").then((m) => ({ default: m.Room })),
);
const Tasks = React.lazy(() =>
  import("./pages/Tasks.js").then((m) => ({ default: m.Tasks })),
);
const Analytics = React.lazy(() =>
  import("./pages/Analytics.js").then((m) => ({ default: m.Analytics })),
);

function LazyPage({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <React.Suspense
      fallback={
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "40vh",
            color: "var(--ink-soft)",
            fontSize: "14px",
          }}
        >
          Loading...
        </div>
      }
    >
      {children}
    </React.Suspense>
  );
}

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
              {
                path: "/meetings/:id",
                element: (
                  <LazyPage>
                    <MeetingDetail />
                  </LazyPage>
                ),
              },
              {
                path: "/tasks",
                element: (
                  <LazyPage>
                    <Tasks />
                  </LazyPage>
                ),
              },
              {
                path: "/analytics",
                element: (
                  <LazyPage>
                    <Analytics />
                  </LazyPage>
                ),
              },
              { path: "/settings", element: <Settings /> },
            ],
          },
          // Room route also protected, with returnTo support
          {
            path: "/room/:roomCode",
            element: (
              <LazyPage>
                <Room />
              </LazyPage>
            ),
          },
        ],
      },
      // Standalone error & fallback pages
      { path: "/forbidden", element: <Forbidden /> },
      { path: "*", element: <NotFound /> },
    ],
  },
];
