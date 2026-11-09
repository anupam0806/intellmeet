import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MeetingDetail } from "../src/pages/MeetingDetail.js";
import { useAuthStore } from "../src/store/authStore.js";
import * as meetingsApi from "../src/lib/meetings.js";
import * as apiModule from "../src/lib/api.js";

describe("Meeting Page: AI Write-up & Ended State (Phase P5)", () => {
  let queryClient: QueryClient;

  const mockBaseMeeting: meetingsApi.Meeting = {
    id: "test-meeting-1",
    teamId: "team-1",
    title: "Checkout Bug Triage",
    description: "Investigate card payment timeouts",
    hostId: "user-1",
    hostName: "Maya Chen",
    roomCode: "DEMOROOM01",
    colorIndex: 1,
    status: "ENDED",
    startedAt: "2026-11-08T10:00:00.000Z",
    endedAt: "2026-11-08T10:35:00.000Z",
    durationSeconds: 2100,
    participants: [
      { userId: "user-1", name: "Maya Chen", joinedAt: "2026-11-08T10:00:00Z", captionsOn: true },
    ],
    ai: {
      status: "READY",
      summary: "Dev identified payment gateway timeouts caused by database connection pool exhaustion.",
      keyPoints: ["Pool size was set to 5", "Increased to 25 with keep-alive enabled"],
      decisions: ["Deploy hotfix immediately to staging"],
      actionItems: [
        {
          id: "item-1",
          title: "Monitor payment success rate in Grafana",
          assigneeName: "Dev Patel",
          assigneeId: "user-2",
          dueDate: "2026-11-10T00:00:00.000Z",
        },
      ],
      attempts: 1,
    },
    createdAt: "2026-11-08T09:50:00.000Z",
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    useAuthStore.setState({
      user: {
        id: "user-1",
        name: "Maya Chen",
        email: "maya@brightwell.test",
        role: "ADMIN",
        teamId: "team-1",
        createdAt: "2026-11-01T00:00:00.000Z",
      },
      accessToken: "mock-token",
    });

    vi.spyOn(meetingsApi, "getMeetingTranscript").mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(meetingsApi, "getMeetingChat").mockResolvedValue({ items: [] });
    vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
      id: "team-1",
      name: "Brightwell",
      members: [
        { id: "user-1", name: "Maya Chen", email: "maya@brightwell.test", role: "ADMIN" },
        { id: "user-2", name: "Dev Patel", email: "dev@brightwell.test", role: "MEMBER" },
      ],
    });
  });

  it("renders PENDING status note when write-up is in progress", async () => {
    const pendingMeeting: meetingsApi.Meeting = {
      ...mockBaseMeeting,
      ai: { ...mockBaseMeeting.ai, status: "PENDING" },
    };
    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(pendingMeeting);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/meetings/test-meeting-1"]}>
          <Routes>
            <Route path="/meetings/:id" element={<MeetingDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("ai-status-pending")).toBeInTheDocument();
    expect(screen.getByText(/AI write-up in progress/i)).toBeInTheDocument();
    expect(screen.getByText(/Generating summary, key points, decisions/i)).toBeInTheDocument();
  });

  it("renders INSUFFICIENT status explaining reason and pointing to paste panel", async () => {
    const insufficientMeeting: meetingsApi.Meeting = {
      ...mockBaseMeeting,
      ai: { ...mockBaseMeeting.ai, status: "INSUFFICIENT" },
    };
    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(insufficientMeeting);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/meetings/test-meeting-1"]}>
          <Routes>
            <Route path="/meetings/:id" element={<MeetingDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("ai-status-insufficient")).toBeInTheDocument();
    expect(screen.getByText(/Not enough content for write-up/i)).toBeInTheDocument();
    expect(screen.getByText(/at least 5 transcript segments and 40 spoken words/i)).toBeInTheDocument();
  });

  it("renders FAILED status with saved reason and Regenerate action", async () => {
    const failedMeeting: meetingsApi.Meeting = {
      ...mockBaseMeeting,
      ai: {
        ...mockBaseMeeting.ai,
        status: "FAILED",
        error: "Failed to parse or validate meeting intelligence.",
      },
    };
    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(failedMeeting);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/meetings/test-meeting-1"]}>
          <Routes>
            <Route path="/meetings/:id" element={<MeetingDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("ai-status-failed")).toBeInTheDocument();
    expect(screen.getByText(/AI write-up failed/i)).toBeInTheDocument();
    expect(screen.getByText("Failed to parse or validate meeting intelligence.")).toBeInTheDocument();
  });

  it("renders READY state with summary in reading serif and neutral attribution", async () => {
    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(mockBaseMeeting);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/meetings/test-meeting-1"]}>
          <Routes>
            <Route path="/meetings/:id" element={<MeetingDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("ai-writeup-ready")).toBeInTheDocument();
    expect(screen.getByText("Generated from the transcript and chat.")).toBeInTheDocument();
    expect(screen.getByTestId("ai-summary")).toHaveTextContent(mockBaseMeeting.ai.summary!);
    expect(screen.getByText("Deploy hotfix immediately to staging")).toBeInTheDocument();
  });

  it("renders action items with active Convert button for host/Admin in P6", async () => {
    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(mockBaseMeeting);

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/meetings/test-meeting-1"]}>
          <Routes>
            <Route path="/meetings/:id" element={<MeetingDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByTestId("action-item-item-1")).toBeInTheDocument();
    expect(screen.getByText("Monitor payment success rate in Grafana")).toBeInTheDocument();
    expect(screen.getByText("Dev Patel")).toBeInTheDocument();

    const convertBtn = screen.getByRole("button", { name: "Convert to task" });
    expect(convertBtn).not.toBeDisabled();
  });

  it("supports inline editing of action item", async () => {
    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(mockBaseMeeting);
    const updateSpy = vi.spyOn(meetingsApi, "updateActionItem").mockResolvedValue({
      item: {
        id: "item-1",
        title: "Updated task title in Grafana",
        assigneeName: "Dev Patel",
        assigneeId: "user-2",
        dueDate: "2026-11-12T00:00:00.000Z",
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/meetings/test-meeting-1"]}>
          <Routes>
            <Route path="/meetings/:id" element={<MeetingDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const editBtn = await screen.findByLabelText("Edit action item");
    fireEvent.click(editBtn);

    const input = screen.getByDisplayValue("Monitor payment success rate in Grafana");
    fireEvent.change(input, { target: { value: "Updated task title in Grafana" } });

    const saveBtn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith("test-meeting-1", "item-1", {
        title: "Updated task title in Grafana",
        assigneeId: "user-2",
        dueDate: "2026-11-10",
      });
    });
  });

  it("opens confirmation modal and triggers regenerate write-up", async () => {
    vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(mockBaseMeeting);
    const regenSpy = vi.spyOn(meetingsApi, "generateAiWriteup").mockResolvedValue({ status: "PENDING" });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/meetings/test-meeting-1"]}>
          <Routes>
            <Route path="/meetings/:id" element={<MeetingDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const regenBtn = await screen.findByRole("button", { name: /Regenerate write-up/i });
    fireEvent.click(regenBtn);

    // Modal opens
    expect(screen.getByText(/Are you sure you want to regenerate the AI write-up/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Regenerate" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(regenSpy).toHaveBeenCalledWith("test-meeting-1");
    });
  });
});
