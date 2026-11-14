import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { Analytics } from "../src/pages/Analytics.js";
import * as analyticsApi from "../src/lib/analytics.js";
import * as socketModule from "../src/lib/socket.js";

describe("Phase P7: Analytics Dashboard (Client)", () => {
  let socketCallbacks: Record<string, (data?: unknown) => void> = {};
  let mockSocket: any;

  const mockOverview: analyticsApi.AnalyticsOverview = {
    range: {
      from: "2026-03-01",
      to: "2026-03-31",
    },
    totals: {
      meetings: 8,
      endedMeetings: 6,
      avgDurationMinutes: 45.2,
      openTasks: 3,
      doneTasks: 4,
    },
    meetingsPerWeek: [
      { weekStart: "2026-03-02", count: 2 },
      { weekStart: "2026-03-09", count: 3 },
      { weekStart: "2026-03-16", count: 1 },
      { weekStart: "2026-03-23", count: 2 },
    ],
    tasksByStatus: [
      { status: "TODO", count: 1 },
      { status: "IN_PROGRESS", count: 2 },
      { status: "DONE", count: 4 },
    ],
    participation: [
      { userId: "u1", name: "Maya Chen", meetingsAttended: 6 },
      { userId: "u2", name: "Dev Patel", meetingsAttended: 4 },
      { userId: "u3", name: "Alex Rivera", meetingsAttended: 0 },
    ],
    actionItemConversionRate: 0.5,
  };

  beforeEach(() => {
    socketCallbacks = {};
    mockSocket = {
      connected: true,
      connect: vi.fn(),
      on: vi.fn((event: string, cb: (data?: unknown) => void) => {
        socketCallbacks[event] = cb;
      }),
      off: vi.fn((event: string) => {
        delete socketCallbacks[event];
      }),
      emit: vi.fn(),
    };
    vi.spyOn(socketModule, "getSocket").mockReturnValue(mockSocket);
    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockResolvedValue(mockOverview);
  });

  it("renders page header, stat cards, and formatted duration", async () => {
    render(<Analytics />);

    expect(screen.getByRole("heading", { level: 1, name: /analytics/i })).toBeInTheDocument();

    await waitFor(() => {
      // Total meetings stat
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("6 ended of 8 total")).toBeInTheDocument();

      // Avg duration (45.2 -> 45m)
      expect(screen.getByText("45m")).toBeInTheDocument();
      expect(screen.getByText("Across 6 ended meetings")).toBeInTheDocument();

      // Conversion rate (0.5 -> 50%)
      expect(screen.getByText("50%")).toBeInTheDocument();

      // Tasks done & open
      expect(screen.getByText("4 completed · 3 open")).toBeInTheDocument();
    });
  });

  it("renders accessible summary data tables for all three charts", async () => {
    render(<Analytics />);

    await waitFor(() => {
      // Weekly meetings table
      expect(
        screen.getByRole("table", { name: "Meetings per week data table" }),
      ).toBeInTheDocument();

      // Tasks by status table
      expect(
        screen.getByRole("table", { name: "Tasks by status data table" }),
      ).toBeInTheDocument();

      // Participation table
      expect(
        screen.getByRole("table", { name: "Member participation data table" }),
      ).toBeInTheDocument();
    });

    // Verify accessible content inside tables
    expect(screen.getByRole("cell", { name: "Maya Chen" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Dev Patel" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Alex Rivera" })).toBeInTheDocument();
  });

  it("changes date range when preset button is clicked and re-fetches data", async () => {
    render(<Analytics />);

    await waitFor(() => {
      expect(analyticsApi.fetchAnalyticsOverview).toHaveBeenCalledTimes(1);
    });

    const preset7Days = screen.getByRole("button", { name: "Last 7 days" });
    fireEvent.click(preset7Days);

    await waitFor(() => {
      expect(analyticsApi.fetchAnalyticsOverview).toHaveBeenCalledTimes(2);
    });
  });

  it("displays empty state message when range contains zero meetings", async () => {
    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockResolvedValueOnce({
      ...mockOverview,
      totals: {
        meetings: 0,
        endedMeetings: 0,
        avgDurationMinutes: 0,
        openTasks: 0,
        doneTasks: 0,
      },
      actionItemConversionRate: 0,
    });

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText("No meeting data in this range")).toBeInTheDocument();
    });
  });

  it("displays error banner with retry button on fetch failure", async () => {
    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockRejectedValueOnce(
      new Error("Network timeout"),
    );

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Network timeout")).toBeInTheDocument();
    });

    // Clicking retry attempts reload
    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockResolvedValueOnce(mockOverview);
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
    });
  });

  it("handles completely empty response with zero values without crashing", async () => {
    const emptyOverview: analyticsApi.AnalyticsOverview = {
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
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
    };
    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockResolvedValueOnce(emptyOverview);

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText("No meeting data in this range")).toBeInTheDocument();
      expect(screen.getByText("0 completed · 0 open")).toBeInTheDocument();
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("handles malformed/partial response with missing arrays defensively without crashing", async () => {
    // Cast partial object with undefined arrays to simulate defensive component handling
    const malformedData = {
      range: {
        from: "2026-03-01",
        to: "2026-03-31",
      },
      totals: {
        meetings: 5,
        endedMeetings: 3,
        avgDurationMinutes: 20,
        openTasks: 1,
        doneTasks: 2,
      },
      meetingsPerWeek: undefined as unknown as analyticsApi.AnalyticsOverview["meetingsPerWeek"],
      tasksByStatus: undefined as unknown as analyticsApi.AnalyticsOverview["tasksByStatus"],
      participation: undefined as unknown as analyticsApi.AnalyticsOverview["participation"],
      actionItemConversionRate: 0.4,
    } as analyticsApi.AnalyticsOverview;

    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockResolvedValueOnce(malformedData);

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
      expect(screen.getByText("3 ended of 5 total")).toBeInTheDocument();
      expect(screen.getByText("40%")).toBeInTheDocument();
    });
  });

  it("rejects invalid/partial API response with Zod and shows error alert with Retry button", async () => {
    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockRejectedValueOnce(
      new Error("Invalid API response shape"),
    );

    render(<Analytics />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  it("refreshes data in real time when socket events (meeting:created, meeting:ended) are received", async () => {
    render(<Analytics />);

    await waitFor(() => {
      expect(analyticsApi.fetchAnalyticsOverview).toHaveBeenCalledTimes(1);
    });

    expect(mockSocket.on).toHaveBeenCalledWith("meeting:created", expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith("meeting:ended", expect.any(Function));

    // Simulate receiving meeting:created socket event
    await act(async () => {
      socketCallbacks["meeting:created"]?.({ id: "meeting-new" });
      await new Promise((r) => setTimeout(r, 200));
    });

    await waitFor(() => {
      expect(analyticsApi.fetchAnalyticsOverview).toHaveBeenCalledTimes(2);
    });

    // Simulate receiving meeting:ended socket event
    await act(async () => {
      socketCallbacks["meeting:ended"]?.({ meetingId: "meeting-new" });
      await new Promise((r) => setTimeout(r, 200));
    });

    await waitFor(() => {
      expect(analyticsApi.fetchAnalyticsOverview).toHaveBeenCalledTimes(3);
    });
  });

  it("labels the current week dynamically in the accessible table and chart", async () => {
    // Current Monday in UTC
    const now = new Date();
    const day = now.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    const currentMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
    const currentMondayStr = `${currentMonday.getUTCFullYear()}-${String(currentMonday.getUTCMonth() + 1).padStart(2, "0")}-${String(currentMonday.getUTCDate()).padStart(2, "0")}`;

    vi.spyOn(analyticsApi, "fetchAnalyticsOverview").mockResolvedValueOnce({
      ...mockOverview,
      meetingsPerWeek: [
        { weekStart: currentMondayStr, count: 5, isCurrentWeek: true },
      ],
    });

    render(<Analytics />);

    await waitFor(() => {
      expect(
        screen.getByText((content) => content.includes("Current week up to today")),
      ).toBeInTheDocument();
    });
  });
});
