import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Dashboard } from "../src/pages/Dashboard.js";
import { useAuthStore, type User } from "../src/store/authStore.js";
import * as meetingsApi from "../src/lib/meetings.js";
import * as tasksApi from "../src/lib/tasks.js";

describe("Phase P7: Dashboard Real-Data Integration", () => {
  let queryClient: QueryClient;

  const mockUser: User = {
    id: "user-maya",
    name: "Maya Chen",
    email: "maya@brightwell.test",
    role: "ADMIN",
    teamId: "team-brightwell",
    createdAt: "2026-11-01T00:00:00.000Z",
  };

  const mockMeetings: meetingsApi.MeetingSummary[] = [
    {
      id: "m-live-1",
      title: "Sprint Standup",
      hostId: "user-maya",
      hostName: "Maya Chen",
      colorIndex: 1,
      status: "LIVE",
      participantCount: 3,
      aiStatus: "NONE",
      actionItemCount: 0,
      startedAt: new Date().toISOString(),
    },
    {
      id: "m-sched-1",
      title: "Design Review",
      hostId: "user-dev",
      hostName: "Dev Patel",
      colorIndex: 0,
      status: "SCHEDULED",
      participantCount: 0,
      aiStatus: "NONE",
      actionItemCount: 0,
      scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: "m-ended-1",
      title: "Retro: October release",
      hostId: "user-omar",
      hostName: "Omar Haddad",
      colorIndex: 4,
      status: "ENDED",
      participantCount: 4,
      aiStatus: "READY",
      actionItemCount: 3,
      startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      endedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 1800 * 1000).toISOString(),
    },
  ];

  const mockTasks: tasksApi.Task[] = [
    {
      id: "t-1",
      title: "Implement onboarding stepper",
      status: "IN_PROGRESS",
      order: 0,
      createdBy: "user-sofia",
      assigneeId: "user-maya",
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // Overdue!
      createdAt: new Date().toISOString(),
    },
    {
      id: "t-2",
      title: "Review customer support escalation tickets",
      status: "TODO",
      order: 0,
      createdBy: "user-dev",
      assigneeId: "user-maya",
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), // Upcoming
      createdAt: new Date().toISOString(),
    },
    {
      id: "t-3",
      title: "Archived done task",
      status: "DONE",
      order: 0,
      createdBy: "user-maya",
      assigneeId: "user-maya",
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      user: mockUser,
      accessToken: "mock-token",
      isInitialized: true,
      isLoading: false,
    });

    vi.spyOn(meetingsApi, "fetchMeetings").mockResolvedValue({
      items: mockMeetings,
      page: 1,
      limit: 50,
      total: 3,
    });

    vi.spyOn(tasksApi, "fetchTasks").mockResolvedValue({
      items: mockTasks,
    });
  });

  function renderDashboard() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/meetings" element={<div>Meetings Page</div>} />
            <Route path="/meetings/:id" element={<div>Meeting Detail Page</div>} />
            <Route path="/tasks" element={<div>Tasks Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it("renders headline sentence with real counts linked to filtered views", async () => {
    renderDashboard();

    // 2 meetings this week (1 live, 1 scheduled)
    await waitFor(() => {
      const meetingsLink = screen.getByRole("link", { name: /2 meetings/i });
      expect(meetingsLink).toBeInTheDocument();
      expect(meetingsLink).toHaveAttribute("href", "/meetings");

      // 2 open tasks (1 IN_PROGRESS + 1 TODO; excludes 1 DONE)
      const tasksLink = screen.getByRole("link", { name: /2 open tasks/i });
      expect(tasksLink).toBeInTheDocument();
      expect(tasksLink).toHaveAttribute("href", "/tasks?assigneeId=me");

      // 1 write-up ready to review
      const summariesLink = screen.getByRole("link", { name: /1 write-up/i });
      expect(summariesLink).toBeInTheDocument();
      expect(summariesLink).toHaveAttribute("href", "/meetings?status=ENDED");
    });
  });

  it("renders Live now section with join button navigating to meeting", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Live now" })).toBeInTheDocument();
      expect(screen.getByText("Sprint Standup")).toBeInTheDocument();
      expect(screen.getByText(/Host: Maya Chen · 3 in room/i)).toBeInTheDocument();
    });

    const joinBtn = screen.getByRole("button", { name: "Join" });
    fireEvent.click(joinBtn);

    await waitFor(() => {
      expect(screen.getByText("Meeting Detail Page")).toBeInTheDocument();
    });
  });

  it("renders Upcoming section with scheduled meeting and details", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
      expect(screen.getByText("Design Review")).toBeInTheDocument();
      expect(screen.getByText(/Host: Dev Patel/i)).toBeInTheDocument();
    });
  });

  it("renders My tasks section grouped by status, with overdue flags in text", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "My tasks" })).toBeInTheDocument();
      expect(screen.getByText("In progress (1)")).toBeInTheDocument();
      expect(screen.getByText("Implement onboarding stepper")).toBeInTheDocument();
      expect(screen.getByText("Overdue")).toBeInTheDocument();

      expect(screen.getByText("To do (1)")).toBeInTheDocument();
      expect(screen.getByText("Review customer support escalation tickets")).toBeInTheDocument();
    });
  });

  it("handles empty states across all three sections cleanly", async () => {
    vi.spyOn(meetingsApi, "fetchMeetings").mockResolvedValueOnce({
      items: [],
      page: 1,
      limit: 50,
      total: 0,
    });
    vi.spyOn(tasksApi, "fetchTasks").mockResolvedValueOnce({
      items: [],
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("No meetings live right now")).toBeInTheDocument();
      expect(screen.getByText("No scheduled meetings")).toBeInTheDocument();
      expect(screen.getByText("No tasks assigned yet")).toBeInTheDocument();
    });
  });

  it("displays error state with retry button on query failure", async () => {
    vi.spyOn(meetingsApi, "fetchMeetings").mockRejectedValueOnce(new Error("Database disconnected"));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getAllByText("Failed to load live meetings.")[0]).toBeInTheDocument();
    });

    // Retry refetches
    vi.spyOn(meetingsApi, "fetchMeetings").mockResolvedValueOnce({
      items: mockMeetings,
      page: 1,
      limit: 50,
      total: 3,
    });

    const retryBtns = screen.getAllByRole("button", { name: /retry/i });
    fireEvent.click(retryBtns[0]!);

    await waitFor(() => {
      expect(screen.getByText("Sprint Standup")).toBeInTheDocument();
    });
  });
});
