import { RouteObject } from "react-router-dom";
import { AppLayout } from "./components/AppLayout.js";
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

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "meetings", element: <Meetings /> },
      { path: "meetings/:id", element: <MeetingDetail /> },
      { path: "room/:id", element: <Room /> },
      { path: "tasks", element: <Tasks /> },
      { path: "analytics", element: <Analytics /> },
      { path: "settings", element: <Settings /> },
      { path: "forbidden", element: <Forbidden /> },
      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <Signup />,
  },
];

