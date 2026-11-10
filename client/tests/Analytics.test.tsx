import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Analytics } from "../src/pages/Analytics.js";
import * as analyticsApi from "../src/lib/analytics.js";

describe("Phase P7: Analytics Dashboard (Client)", () => {
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
});
