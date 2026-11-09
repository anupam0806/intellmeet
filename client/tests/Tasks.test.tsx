import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tasks } from "../src/pages/Tasks.js";
import { MeetingDetail } from "../src/pages/MeetingDetail.js";
import { useAuthStore } from "../src/store/authStore.js";
import * as tasksApi from "../src/lib/tasks.js";
import * as meetingsApi from "../src/lib/meetings.js";
import * as apiModule from "../src/lib/api.js";

describe("Phase P6: Tasks Board and Action Item Conversion (Client)", () => {
  let queryClient: QueryClient;

  const mockTasks: tasksApi.Task[] = [
    {
      id: "task-1",
      title: "First Todo Task",
      description: "Description 1",
      status: "TODO",
      order: 0,
      createdBy: "user-1", // Created by Maya (Admin)
      assigneeId: "user-2", // Assigned to Dev
      assigneeName: "Dev Patel",
      createdAt: "2026-11-09T10:00:00.000Z",
    },
    {
      id: "task-2",
      title: "Second Todo Task (Unassigned)",
      status: "TODO",
      order: 1,
      createdBy: "user-1",
      createdAt: "2026-11-09T10:01:00.000Z",
    },
    {
      id: "task-3",
      title: "In Progress Task",
      status: "IN_PROGRESS",
      order: 0,
      createdBy: "user-2", // Created by Dev
      assigneeId: "user-2",
      assigneeName: "Dev Patel",
      createdAt: "2026-11-09T10:02:00.000Z",
    },
  ];

  const mockTeamMembers = [
    { id: "user-1", name: "Maya Chen", email: "maya@brightwell.test", role: "ADMIN" },
    { id: "user-2", name: "Dev Patel", email: "dev@brightwell.test", role: "MEMBER" },
    { id: "user-3", name: "Lena Fischer", email: "lena@brightwell.test", role: "MEMBER" },
  ];

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
        createdAt: "2026-11-09T00:00:00.000Z",
      },
      accessToken: "mock-jwt-token",
      isInitialized: true,
      isLoading: false,
    });

    vi.spyOn(apiModule, "apiFetch").mockImplementation(async (path: string) => {
      if (path.includes("/api/v1/team")) {
        return { id: "team-1", name: "Brightwell Design Co.", members: mockTeamMembers };
      }
      if (path.includes("/api/v1/tasks")) {
        return { items: mockTasks };
      }
      return {};
    });
  });

  describe("Unit: reorderTasksPure helper", () => {
    it("reorders within the same column and updates order numbers contiguously", () => {
      const list: tasksApi.Task[] = [
        { id: "1", title: "A", status: "TODO", order: 0, createdBy: "u1", createdAt: "" },
        { id: "2", title: "B", status: "TODO", order: 1, createdBy: "u1", createdAt: "" },
        { id: "3", title: "C", status: "TODO", order: 2, createdBy: "u1", createdAt: "" },
      ];

      // Move C (index 2) to position 0
      const reordered = tasksApi.reorderTasksPure(list, "3", "TODO", 0);
      const todoItems = reordered.filter((t) => t.status === "TODO").sort((a, b) => a.order - b.order);
      expect(todoItems.map((t) => t.id)).toEqual(["3", "1", "2"]);
      expect(todoItems.map((t) => t.order)).toEqual([0, 1, 2]);
    });

    it("moves task across columns, updating status, completedAt, and column orders", () => {
      const list: tasksApi.Task[] = [
        { id: "1", title: "A", status: "TODO", order: 0, createdBy: "u1", createdAt: "" },
        { id: "2", title: "B", status: "TODO", order: 1, createdBy: "u1", createdAt: "" },
        { id: "3", title: "C", status: "IN_PROGRESS", order: 0, createdBy: "u1", createdAt: "" },
      ];

      // Move B to DONE at position 0
      const reordered = tasksApi.reorderTasksPure(list, "2", "DONE", 0);
      const doneTask = reordered.find((t) => t.id === "2");
      expect(doneTask?.status).toBe("DONE");
      expect(doneTask?.completedAt).toBeDefined();
      expect(doneTask?.order).toBe(0);

      // Verify TODO column remaining tasks have contiguous orders
      const todoTasks = reordered.filter((t) => t.status === "TODO");
      expect(todoTasks).toHaveLength(1);
      expect(todoTasks[0]?.order).toBe(0);
    });
  });

  describe("Tasks Page Rendering and Lanes", () => {
    it("renders three lanes (To do, In progress, Done) with correct counts", async () => {
      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(screen.getByText("Tasks")).toBeInTheDocument();
      expect(screen.getByText("To do")).toBeInTheDocument();
      expect(screen.getByText("In progress")).toBeInTheDocument();
      expect(screen.getByText("Done")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("First Todo Task")).toBeInTheDocument();
        expect(screen.getByText("Second Todo Task (Unassigned)")).toBeInTheDocument();
        expect(screen.getByText("In Progress Task")).toBeInTheDocument();
      });
    });

    it("opens create task dialog, validates and creates task", async () => {
      const createSpy = vi.spyOn(tasksApi, "createTask").mockResolvedValue({
        id: "task-new",
        title: "Brand New Task",
        status: "TODO",
        order: 2,
        createdBy: "user-1",
        createdAt: "2026-11-09T10:05:00.000Z",
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const newBtn = screen.getByRole("button", { name: /new task/i });
      fireEvent.click(newBtn);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "New task" })).toBeInTheDocument();

      const titleInput = screen.getByLabelText(/title \*/i);
      fireEvent.change(titleInput, { target: { value: "Brand New Task" } });

      const submitBtn = screen.getByRole("button", { name: /create task/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Brand New Task",
            status: "TODO",
          }),
        );
      });
    });

    it("changes status using card menu", async () => {
      const updateSpy = vi.spyOn(tasksApi, "updateTask").mockResolvedValue({
        ...mockTasks[0]!,
        status: "IN_PROGRESS",
        order: 1,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("First Todo Task")).toBeInTheDocument();
      });

      // Click card options button
      const optionsBtns = screen.getAllByRole("button", { name: "Task options" });
      fireEvent.click(optionsBtns[0]!);

      // Click "In progress" from the dropdown
      const moveBtn = screen.getByRole("button", { name: /in progress/i });
      fireEvent.click(moveBtn);

      await waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(
          "task-1",
          expect.objectContaining({
            status: "IN_PROGRESS",
          }),
        );
      });
    });

    it("hides edit and delete controls for Member on forbidden tasks", async () => {
      // Set current user as Lena (Member, user-3)
      useAuthStore.setState({
        user: {
          id: "user-3",
          name: "Lena Fischer",
          email: "lena@brightwell.test",
          role: "MEMBER",
          teamId: "team-1",
          createdAt: "2026-11-09T00:00:00.000Z",
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <Tasks />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("First Todo Task")).toBeInTheDocument();
      });

      // Task 1 was created by user-1 and assigned to user-2. Lena (user-3) cannot edit it.
      // Task 2 was created by user-1 and is unassigned. Lena CAN edit/move it.
      // Task 3 was created by user-2 and assigned to user-2. Lena cannot edit it.
      // Therefore, only 1 Task options button should exist (on Task 2)!
      const optionButtons = screen.getAllByRole("button", { name: "Task options" });
      expect(optionButtons).toHaveLength(1);

      // Open options on Task 2: Lena can edit it, but CANNOT delete it
      fireEvent.click(optionButtons[0]!);
      expect(screen.getByRole("button", { name: /edit task/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /delete task/i })).not.toBeInTheDocument();
    });
  });

  describe("Meeting Detail: Action Item Conversion", () => {
    it("allows host/Admin to convert an action item, updates state to Converted and View task link", async () => {
      const mockEndedMeeting: meetingsApi.Meeting = {
        id: "meet-1",
        teamId: "team-1",
        title: "Sprint Review",
        hostId: "user-1",
        hostName: "Maya Chen",
        roomCode: "DEMO01",
        colorIndex: 2,
        status: "ENDED",
        participants: [
          { userId: "user-1", name: "Maya Chen", joinedAt: "2026-11-09T08:00:00.000Z", captionsOn: false },
        ],
        ai: {
          status: "READY",
          summary: "Summary text",
          keyPoints: [],
          decisions: [],
          actionItems: [
            {
              id: "ai-item-1",
              title: "Draft architecture proposal",
              assigneeName: "Dev Patel",
              assigneeId: "user-2",
              dueDate: "2026-11-20T00:00:00.000Z",
            },
          ],
        },
        createdAt: "2026-11-09T08:00:00.000Z",
      };

      vi.spyOn(meetingsApi, "fetchMeeting").mockResolvedValue(mockEndedMeeting);
      vi.spyOn(meetingsApi, "getMeetingTranscript").mockResolvedValue({ items: [], total: 0 });
      vi.spyOn(meetingsApi, "getMeetingChat").mockResolvedValue({ items: [] });
      const convertSpy = vi.spyOn(meetingsApi, "convertActionItemToTask").mockResolvedValue({
        task: { id: "new-converted-task-123" },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/meetings/meet-1"]}>
            <Routes>
              <Route path="/meetings/:id" element={<MeetingDetail />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Draft architecture proposal")).toBeInTheDocument();
      });

      // Find the active "Convert to task" button
      const convertBtn = screen.getByRole("button", { name: "Convert to task" });
      expect(convertBtn).not.toBeDisabled();
      fireEvent.click(convertBtn);

      // Dialog opens prefilled
      expect(screen.getByRole("dialog", { name: "Convert to task" })).toBeInTheDocument();

      // Click "Convert to task" in modal
      const modalConvertBtns = screen.getAllByRole("button", { name: "Convert to task" });
      expect(modalConvertBtns.length).toBeGreaterThan(1);
      fireEvent.click(modalConvertBtns[1]!);

      await waitFor(() => {
        expect(convertSpy).toHaveBeenCalledWith("meet-1", "ai-item-1", expect.any(Object));
      });

      // Verify "Task created" toast and button replaced by "Converted" & "View task"
      await waitFor(() => {
        expect(screen.getByText("Task created")).toBeInTheDocument();
        expect(screen.getByText("Converted")).toBeInTheDocument();
        const viewTaskLink = screen.getByRole("link", { name: "View task" });
        expect(viewTaskLink).toHaveAttribute("href", "/tasks?highlight=new-converted-task-123");
      });
    });
  });
});
