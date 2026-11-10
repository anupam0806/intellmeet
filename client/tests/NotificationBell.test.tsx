import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "../src/components/AppLayout.js";
import { useAuthStore } from "../src/store/authStore.js";
import * as notificationsApi from "../src/lib/notifications.js";
import * as socketModule from "../src/lib/socket.js";

describe("Phase P7: Notification Bell and Live Updates", () => {
  let socketCallbacks: Record<string, Function>;
  let mockSocket: any;

  const mockNotifications: notificationsApi.NotificationItem[] = [
    {
      id: "notif-1",
      type: "TASK_ASSIGNED",
      message: 'Maya Chen assigned you "Design System Polish"',
      link: "/tasks?highlight=t-1",
      read: false,
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago
    },
    {
      id: "notif-2",
      type: "MEETING_SUMMARY_READY",
      message: 'Summary ready for "Weekly Sync"',
      link: "/meetings/m-1",
      read: true,
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
    },
  ];

  beforeEach(() => {
    socketCallbacks = {};
    mockSocket = {
      connected: true,
      connect: vi.fn(),
      on: vi.fn((event: string, cb: Function) => {
        socketCallbacks[event] = cb;
      }),
      off: vi.fn((event: string) => {
        delete socketCallbacks[event];
      }),
      emit: vi.fn(),
    };
    vi.spyOn(socketModule, "getSocket").mockReturnValue(mockSocket);

    useAuthStore.setState({
      user: {
        id: "user-dev",
        name: "Dev Patel",
        email: "dev@brightwell.test",
        role: "MEMBER",
        teamId: "team-1",
        createdAt: "2026-11-09T00:00:00.000Z",
      },
      accessToken: "mock-jwt",
      isInitialized: true,
      isLoading: false,
    });

    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue({
      items: mockNotifications,
      unreadCount: 1,
    });
    vi.spyOn(notificationsApi, "markNotificationAsRead").mockResolvedValue();
    vi.spyOn(notificationsApi, "markAllNotificationsAsRead").mockResolvedValue();
  });

  it("renders notification bell with badge and toggles dropdown", async () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("notification-badge")).toHaveTextContent("1");
    });

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    expect(bellBtn).toHaveAttribute("aria-expanded", "false");

    // Click bell to open dropdown
    fireEvent.click(bellBtn);
    expect(bellBtn).toHaveAttribute("aria-expanded", "true");

    // Both notifications visible in dropdown
    expect(screen.getByText('Maya Chen assigned you "Design System Polish"')).toBeInTheDocument();
    expect(screen.getByText('Summary ready for "Weekly Sync"')).toBeInTheDocument();
    expect(screen.getByText("5m ago")).toBeInTheDocument();
    expect(screen.getByText("1h ago")).toBeInTheDocument();
  });

  it("displays '9+' when unread count exceeds 9", async () => {
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValueOnce({
      items: mockNotifications,
      unreadCount: 12,
    });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("notification-badge")).toHaveTextContent("9+");
    });
  });

  it("hides badge when unreadCount is 0", async () => {
    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValueOnce({
      items: [],
      unreadCount: 0,
    });

    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
    });
  });

  it("marks item as read optimistically and navigates on click", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard Page</div>} />
            <Route path="tasks" element={<div>Tasks Page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("notification-badge")).toHaveTextContent("1");
    });

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    const unreadItem = screen.getByText('Maya Chen assigned you "Design System Polish"');
    fireEvent.click(unreadItem);

    // markNotificationAsRead should have been called
    expect(notificationsApi.markNotificationAsRead).toHaveBeenCalledWith("notif-1");

    // Dropdown closes and badge vanishes (count becomes 0)
    await waitFor(() => {
      expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
      expect(screen.queryByRole("menu", { name: "Notifications list" })).not.toBeInTheDocument();
    });
  });

  it("marks all notifications as read via Mark all as read button", async () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("notification-badge")).toHaveTextContent("1");
    });

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);

    const markAllBtn = screen.getByRole("button", { name: /mark all as read/i });
    fireEvent.click(markAllBtn);

    expect(notificationsApi.markAllNotificationsAsRead).toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByTestId("notification-badge")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /mark all as read/i })).not.toBeInTheDocument();
    });
  });

  it("closes dropdown on Escape key and returns focus to the bell button", async () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(bellBtn);
    expect(bellBtn).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(bellBtn).toHaveAttribute("aria-expanded", "false");
      expect(document.activeElement).toBe(bellBtn);
    });
  });

  it("receives live notifications via socket and updates unread badge and polite announcement", async () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("notification-badge")).toHaveTextContent("1");
    });

    // Simulate incoming socket event
    const newNotif: notificationsApi.NotificationItem = {
      id: "notif-live-99",
      type: "TASK_ASSIGNED",
      message: 'Alex Rivera assigned you "Security Audit"',
      link: "/tasks?highlight=t-99",
      read: false,
      createdAt: new Date().toISOString(),
    };

    act(() => {
      socketCallbacks["notification:new"]?.(newNotif);
    });

    // Badge increments from 1 to 2
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("2");

    // Screen reader announcement present in polite live region
    expect(screen.getByRole("status")).toHaveTextContent('New notification: Alex Rivera assigned you "Security Audit"');

    // Deduplication check: duplicate socket emit should not increment again
    act(() => {
      socketCallbacks["notification:new"]?.(newNotif);
    });
    expect(screen.getByTestId("notification-badge")).toHaveTextContent("2");
  });
});
