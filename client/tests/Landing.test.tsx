import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Landing } from "../src/pages/Landing.js";
import { Login } from "../src/pages/Login.js";
import { Signup } from "../src/pages/Signup.js";
import { ProtectedRoute } from "../src/components/ProtectedRoute.js";
import { PublicOnlyRoute } from "../src/components/PublicOnlyRoute.js";
import { useAuthStore } from "../src/store/authStore.js";

describe("Public Landing Page and Auth Flow", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  it("Landing renders the h1, the three sections, and the limits", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Landing />
      </MemoryRouter>,
    );

    // Headline h1
    expect(
      screen.getByRole("heading", { level: 1, name: "Meetings that end with notes and owners." }),
    ).toBeInTheDocument();

    // Three main sections
    expect(screen.getByRole("heading", { level: 2, name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Features" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Built with" })).toBeInTheDocument();

    // Honest limits ("Good to know")
    expect(screen.getByRole("heading", { level: 2, name: "Good to know" })).toBeInTheDocument();
    expect(screen.getByText("Rooms hold up to 4 people.")).toBeInTheDocument();
    expect(
      screen.getByText("Live captions need Chrome or Edge and use the browser's speech service."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The free host can take about a minute to wake after idle time."),
    ).toBeInTheDocument();
    expect(screen.getByText("The demo uses sample data.")).toBeInTheDocument();

    // Footer with source code link
    const sourceLink = screen.getByRole("link", { name: "Source code" });
    expect(sourceLink).toBeInTheDocument();
    expect(sourceLink).toHaveAttribute("href", "https://github.com/anupam0806/intellmeet");
  });

  it("the Log in button goes to /login", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<div>Login Page Target</div>} />
        </Routes>
      </MemoryRouter>,
    );

    // There are top bar and hero "Log in" links
    const loginLinks = screen.getAllByRole("link", { name: "Log in" });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(loginLinks[0]).toHaveAttribute("href", "/login");

    fireEvent.click(loginLinks[0]!);
    expect(screen.getByText("Login Page Target")).toBeInTheDocument();
  });

  it("signed-in users see 'Open dashboard'", () => {
    useAuthStore.getState().setAuth(
      {
        id: "u1",
        name: "Dev Patel",
        email: "dev@brightwell.test",
        role: "MEMBER",
        teamId: "t1",
        createdAt: new Date().toISOString(),
      },
      "fake-access-token",
    );

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Landing />
      </MemoryRouter>,
    );

    // Primary action is "Open dashboard" instead of "Log in" or "Sign up"
    const openDashLinks = screen.getAllByRole("link", { name: "Open dashboard" });
    expect(openDashLinks.length).toBeGreaterThan(0);
    expect(openDashLinks[0]).toHaveAttribute("href", "/dashboard");

    // "Log in" and "Sign up" should not be rendered
    expect(screen.queryByRole("link", { name: "Sign up" })).not.toBeInTheDocument();
  });

  it("the mobile menu opens, closes with Escape, and returns focus", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Landing />
      </MemoryRouter>,
    );

    const menuBtn = screen.getByRole("button", { name: "Open menu" });
    expect(menuBtn).toBeInTheDocument();
    expect(menuBtn).toHaveAttribute("aria-expanded", "false");
    expect(menuBtn).toHaveAttribute("aria-controls", "landing-menu-panel");

    // Open menu
    fireEvent.click(menuBtn);
    expect(menuBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("dialog", { name: "Landing navigation" })).toBeInTheDocument();

    // Close with Escape
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Landing navigation" })).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(menuBtn);
  });

  it("/login?demo=1 opens the demo panel automatically", () => {
    render(
      <MemoryRouter initialEntries={["/login?demo=1"]}>
        <Login />
      </MemoryRouter>,
    );

    // Demo panel should be immediately visible
    expect(screen.getByRole("region", { name: "Demo accounts" })).toBeInTheDocument();
    expect(screen.getByText("Maya Chen, Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Maya" })).toBeInTheDocument();
  });

  it("the auth pages no longer contain the sample panel text and link back to home", () => {
    // 1. Login page check
    const { unmount: unmountLogin } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/AUTOMATED MEETING INSIGHTS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sprint 14 Planning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Finalize checkout error handling/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IntellMeet" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");

    unmountLogin();

    // 2. Signup page check
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Signup />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/AUTOMATED MEETING INSIGHTS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sprint 14 Planning/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "IntellMeet" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Back to home" })).toHaveAttribute("href", "/");
  });

  it("protected routes still redirect unauthenticated users to /login", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page Target</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Secret</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login Page Target")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Secret")).not.toBeInTheDocument();
  });

  it("public only routes redirect authenticated users to /dashboard", () => {
    useAuthStore.getState().setAuth(
      {
        id: "u1",
        name: "Dev Patel",
        email: "dev@brightwell.test",
        role: "MEMBER",
        teamId: "t1",
        createdAt: new Date().toISOString(),
      },
      "fake-token",
    );

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/dashboard" element={<div>Dashboard Home</div>} />
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard Home")).toBeInTheDocument();
  });
});

