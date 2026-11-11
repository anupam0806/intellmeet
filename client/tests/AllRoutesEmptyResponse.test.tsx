import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routes } from "../src/routes.js";
import { useAuthStore, type User } from "../src/store/authStore.js";
import * as apiModule from "../src/lib/api.js";
import * as meetingsApi from "../src/lib/meetings.js";
import * as tasksApi from "../src/lib/tasks.js";
import * as analyticsApi from "../src/lib/analytics.js";
import * as notifApi from "../src/lib/notifications.js";

// Mock socket.io-client to avoid WebSocket connection attempts
vi.mock("../src/lib/socket.js", () => {
  const fakeSocket = {
    connected: false,
    connect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };
  return {
    getSocket: () => fakeSocket,
  };
});

describe("Defensive Route Rendering: Empty API responses across all pages", () => {
  let queryClient: QueryClient;

  const mockUser: User = {
    id: "user-maya",
    name: "Maya Chen",
    email: "maya@brightwell.test",
    role: "ADMIN",
    teamId: "team-brightwell",
    createdAt: "2026-11-01T00:00:00.000Z",
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      user: mockUser,
      accessToken: "mock-access-token",
      isInitialized: true,
      isLoading: false,
    });

    // Mock meetings with empty items
    vi.spyOn(meetingsApi, "fetchMeetings").mockResolvedValue({
      items: [],
      page: 1,
      limit: 10,
      total: 0,
    });

    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue({
      id: "m1",
      teamId: "team-brightwell",
      title: "Empty Meeting",
      hostId: "user-maya",
      hostName: "Maya Chen",
      roomCode: "TESTCODE",
      colorIndex: 0,
      status: "ENDED",
      createdAt: "2026-03-01T00:00:00.000Z",
      participants: [],
      ai: {
        status: "NONE",
        keyPoints: [],
        decisions: [],
        actionItems: [],
      },
    });

    // Mock tasks with empty items
    vi.spyOn(tasksApi, "fetchTasks").mockResolvedValue({
      items: [],
    });

    // Mock analytics overview with empty arrays
    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockResolvedValue({
      range: { from: "2026-03-01", to: "2026-03-31" },
      totals: {
        meetings: 0,
        endedMeetings: 0,
        avgDurationMinutes: 0,
        openTasks: 0,
        doneTasks: 0,
      },
      meetingsPerWeek: [],
      tasksByStatus: [],
      participation: [],
      actionItemConversionRate: 0,
    });

    // Mock notifications with empty items
    vi.spyOn(notifApi, "fetchNotifications").mockResolvedValue({
      items: [],
      unreadCount: 0,
    });

    // Mock generic apiFetch (for /api/v1/team and meeting transcript/chat)
    vi.spyOn(apiModule, "apiFetch").mockImplementation(async (path: string) => {
      if (path.includes("/team")) {
        return {
          id: "team-brightwell",
          name: "Brightwell Team",
          members: [],
        };
      }
      if (path.includes("/transcript") || path.includes("/chat")) {
        return { items: [], total: 0 };
      }
      return {};
    });
  });

  const testRoutes = [
    { path: "/dashboard", heading: /you have/i },
    { path: "/meetings", heading: /^meetings/i },
    { path: "/meetings/m1", heading: /^empty meeting/i },
    { path: "/tasks", heading: /^tasks/i },
    { path: "/analytics", heading: /^analytics/i },
    { path: "/settings", heading: /^settings/i },
  ];

  testRoutes.forEach(({ path, heading }) => {
    it(`renders route ${path} cleanly without throwing when API returns empty data`, async () => {
      const router = createMemoryRouter(routes, {
        initialEntries: [path],
      });

      render(
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: heading })).toBeInTheDocument();
      });

      // Ensure error boundary was not triggered
      expect(screen.queryByText("Something went wrong on this page.")).not.toBeInTheDocument();
    });
  });
});

