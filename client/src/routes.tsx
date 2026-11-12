import React from "react";
import { RouteObject } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { PublicOnlyRoute } from "./components/PublicOnlyRoute.js";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary.js";
import { Landing } from "./pages/Landing.js";
import { NotFound } from "./pages/NotFound.js";
import { Forbidden } from "./pages/Forbidden.js";

const AppLayout = React.lazy(() =>
  import("./components/AppLayout.js").then((m) => ({ default: m.AppLayout })),
);
const Dashboard = React.lazy(() =>
  import("./pages/Dashboard.js").then((m) => ({ default: m.Dashboard })),
);
const Login = React.lazy(() =>
  import("./pages/Login.js").then((m) => ({ default: m.Login })),
);
const Signup = React.lazy(() =>
  import("./pages/Signup.js").then((m) => ({ default: m.Signup })),
);
const Meetings = React.lazy(() =>
  import("./pages/Meetings.js").then((m) => ({ default: m.Meetings })),
);
const Settings = React.lazy(() =>
  import("./pages/Settings.js").then((m) => ({ default: m.Settings })),
);
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

function LazyPage({ children }: Readonly<{ children: React.ReactNode }>): React.JSX.Element {
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

export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        path: "/",
        element: <Landing />,
      },
      // Public auth routes (signed-in users redirected to /dashboard)
      {
        element: <PublicOnlyRoute />,
        children: [
          {
            path: "/login",
            element: (
              <LazyPage>
                <Login />
              </LazyPage>
            ),
          },
          {
            path: "/signup",
            element: (
              <LazyPage>
                <Signup />
              </LazyPage>
            ),
          },
        ],
      },
      // Protected app routes
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: (
              <LazyPage>
                <AppLayout />
              </LazyPage>
            ),
            children: [
              {
                path: "/dashboard",
                element: (
                  <LazyPage>
                    <Dashboard />
                  </LazyPage>
                ),
              },
              {
                path: "/meetings",
                element: (
                  <LazyPage>
                    <Meetings />
                  </LazyPage>
                ),
              },
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
              {
                path: "/settings",
                element: (
                  <LazyPage>
                    <Settings />
                  </LazyPage>
                ),
              },
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
