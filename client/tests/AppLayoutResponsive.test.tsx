import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppLayout } from "../src/components/AppLayout.js";
import { useAuthStore } from "../src/store/authStore.js";
import * as notificationsApi from "../src/lib/notifications.js";
import * as socketModule from "../src/lib/socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Responsive App Frame & Viewport (< 1024px vs >= 1024px)", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;

    const mockSocket = {
      connected: true,
      connect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    };
    vi.spyOn(socketModule, "getSocket").mockReturnValue(mockSocket as any);

    vi.spyOn(notificationsApi, "fetchNotifications").mockResolvedValue({
      items: [
        {
          id: "notif-1",
          type: "TASK_ASSIGNED",
          message: 'Maya Chen assigned you "Design System Polish"',
          link: "/tasks?highlight=t-1",
          read: false,
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
    vi.spyOn(notificationsApi, "markNotificationAsRead").mockResolvedValue();
    vi.spyOn(notificationsApi, "markAllNotificationsAsRead").mockResolvedValue();

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
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  function mockMatchMedia(matches: boolean) {
    const listeners: Array<(e: MediaQueryListEvent) => void> = [];
    window.matchMedia = vi.fn().mockImplementation((query: string) => {
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn((fn) => listeners.push(fn)),
        removeListener: vi.fn((fn) => {
          const idx = listeners.indexOf(fn);
          if (idx >= 0) listeners.splice(idx, 1);
        }),
        addEventListener: vi.fn((_, fn) => listeners.push(fn)),
        removeEventListener: vi.fn((_, fn) => {
          const idx = listeners.indexOf(fn);
          if (idx >= 0) listeners.splice(idx, 1);
        }),
        dispatchEvent: vi.fn(),
      };
    });
  }

  it("ensures client/index.html includes a valid viewport meta tag", () => {
    const indexPath = path.resolve(__dirname, "../index.html");
    const html = fs.readFileSync(indexPath, "utf-8");
    expect(html).toMatch(/<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width[^"']*initial-scale=1/i);
  });

  it("renders desktop layout at wide width (>= 1024px)", async () => {
    mockMatchMedia(true);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    // Desktop nav links are visible
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();

    // Desktop account info is present
    expect(screen.getByText("Dev Patel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    // Notification bell is rendered
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();

    // Menu button is NOT rendered
    expect(screen.queryByRole("button", { name: /open menu|close menu/i })).not.toBeInTheDocument();
  });

  it("renders mobile app frame at narrow width (< 1024px)", async () => {
    mockMatchMedia(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    // Desktop nav links and top bar account info are NOT rendered
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("Dev Patel")).not.toBeInTheDocument();

    // Notification bell and menu button ARE rendered
    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    expect(bellBtn).toBeInTheDocument();

    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    expect(menuBtn).toBeInTheDocument();
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    expect(menuBtn).toHaveAttribute("aria-controls", "mobile-menu-panel");

    // Drawer is closed initially
    expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();

    // Clicking menu button opens drawer panel
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    expect(menuBtn).toHaveAttribute("aria-label", "Close menu");

    const drawer = screen.getByRole("dialog", { name: "Navigation menu" });
    expect(drawer).toBeInTheDocument();
    expect(drawer).toHaveAttribute("id", "mobile-menu-panel");

    // Drawer contents: Row 1 account, Rows 2-6 nav links, Row 7 sign out
    expect(screen.getByText("Dev Patel")).toBeInTheDocument();
    expect(screen.getByText("MEMBER")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Tasks" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();

    // Active route gets aria-current="page"
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });

  it("closes mobile menu drawer and restores focus on Escape key", async () => {
    mockMatchMedia(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menuBtn);
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });

    // Drawer closes
    expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("closes mobile menu drawer when tapping scrim", async () => {
    mockMatchMedia(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menuBtn);
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toBeInTheDocument();

    const scrim = screen.getByTestId("mobile-menu-scrim");
    fireEvent.click(scrim);

    expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("navigates and closes mobile menu drawer when clicking a navigation link", async () => {
    mockMatchMedia(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="dashboard" element={<div>Dashboard Content</div>} />
            <Route path="meetings" element={<div>Meetings Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menuBtn);

    const meetingsLink = screen.getByRole("link", { name: "Meetings" });
    fireEvent.click(meetingsLink);

    // Menu should close
    expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
    // Routed to Meetings content
    expect(screen.getByText("Meetings Content")).toBeInTheDocument();
  });

  it("signs out from mobile menu drawer", async () => {
    mockMatchMedia(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    const menuBtn = screen.getByRole("button", { name: /open menu/i });
    fireEvent.click(menuBtn);

    const signOutBtn = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(signOutBtn);

    // User is logged out in store
    await waitFor(() => {
      expect(useAuthStore.getState().user).toBeNull();
    });
    // Menu is closed
    expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
  });

  it("enforces mutual exclusivity between mobile menu and notification dropdown", async () => {
    mockMatchMedia(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppLayout />
      </MemoryRouter>,
    );

    const bellBtn = screen.getByRole("button", { name: /notifications/i });
    const menuBtn = screen.getByRole("button", { name: /open menu/i });

    // Open notification dropdown
    fireEvent.click(bellBtn);
    expect(bellBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu", { name: "Notifications list" })).toBeInTheDocument();

    // Now open menu: notification dropdown must close
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    expect(bellBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu", { name: "Notifications list" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Navigation menu" })).toBeInTheDocument();

    // Now open notification dropdown: mobile menu must close
    fireEvent.click(bellBtn);
    expect(bellBtn).toHaveAttribute("aria-expanded", "true");
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Navigation menu" })).not.toBeInTheDocument();
  });
});
