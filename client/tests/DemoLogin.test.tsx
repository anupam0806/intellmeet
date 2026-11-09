import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Login, DEMO_PERSONAS } from "../src/pages/Login.js";
import { useAuthStore } from "../src/store/authStore.js";

describe("Demo Login UI Component", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not render any of the five demo personas by default until 'Try demo' is pressed", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const tryDemoButton = screen.getByRole("button", { name: "Try demo" });
    expect(tryDemoButton).toBeInTheDocument();
    expect(tryDemoButton).toHaveAttribute("aria-expanded", "false");
    expect(tryDemoButton).toHaveAttribute("aria-controls", "demo-accounts-panel");

    // The panel should not be present
    expect(screen.queryByRole("region", { name: "Demo accounts" })).not.toBeInTheDocument();

    // Verify none of the demo names or roles are in the document
    expect(screen.queryByText(/Maya Chen/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dev Patel/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Lena Fischer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Omar Haddad/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sofia Rossi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Admin/)).not.toBeInTheDocument();
  });

  it("pressing 'Try demo' opens the panel with the five people, updates aria-expanded, and moves focus to the first button", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const tryDemoButton = screen.getByRole("button", { name: "Try demo" });
    fireEvent.click(tryDemoButton);

    expect(tryDemoButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Demo accounts" })).toBeInTheDocument();

    // Check all 5 personas and roles as text
    expect(screen.getByText("Maya Chen, Admin")).toBeInTheDocument();
    expect(screen.getByText("Dev Patel, Member")).toBeInTheDocument();
    expect(screen.getByText("Lena Fischer, Member")).toBeInTheDocument();
    expect(screen.getByText("Omar Haddad, Member")).toBeInTheDocument();
    expect(screen.getByText("Sofia Rossi, Member")).toBeInTheDocument();

    // Check all 5 continue buttons
    expect(screen.getByRole("button", { name: "Continue as Maya" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Dev" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Lena" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Omar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Sofia" })).toBeInTheDocument();

    // Verify opening moves focus to its first button
    const firstButton = screen.getByRole("button", { name: "Continue as Maya" });
    expect(document.activeElement).toBe(firstButton);
  });

  it("pressing Escape closes the panel and returns focus to the 'Try demo' button", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const tryDemoButton = screen.getByRole("button", { name: "Try demo" });
    fireEvent.click(tryDemoButton);

    expect(screen.getByRole("region", { name: "Demo accounts" })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue as Maya" }));

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });

    // Panel is closed
    expect(screen.queryByRole("region", { name: "Demo accounts" })).not.toBeInTheDocument();
    expect(tryDemoButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Maya Chen/)).not.toBeInTheDocument();

    // Focus returns to the Try demo button
    expect(document.activeElement).toBe(tryDemoButton);
  });

  it("pressing 'Try demo' again closes the panel and returns focus", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const tryDemoButton = screen.getByRole("button", { name: "Try demo" });
    fireEvent.click(tryDemoButton);
    expect(screen.getByRole("region", { name: "Demo accounts" })).toBeInTheDocument();

    fireEvent.click(tryDemoButton);
    expect(screen.queryByRole("region", { name: "Demo accounts" })).not.toBeInTheDocument();
    expect(tryDemoButton).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(tryDemoButton);
  });

  it("each button calls POST /api/v1/auth/demo with the right persona", async () => {
    for (const p of DEMO_PERSONAS) {
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: `mock-token-${p.persona}`,
            user: {
              id: `${p.persona}-id`,
              name: p.name,
              email: `${p.persona}@brightwell.test`,
              role: p.role === "Admin" ? "ADMIN" : "MEMBER",
              teamId: "team-id",
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      vi.stubGlobal("fetch", fetchSpy);

      const { unmount } = render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      // Open demo panel
      fireEvent.click(screen.getByRole("button", { name: "Try demo" }));

      const button = screen.getByRole("button", { name: `Continue as ${p.firstName}` });
      fireEvent.click(button);

      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });

      const [url, options] = fetchSpy.mock.calls[0]!;
      expect(url).toContain("/api/v1/auth/demo");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body)).toEqual({ persona: p.persona });

      unmount();
      vi.unstubAllGlobals();
    }
  });

  it("displays 'Demo accounts are not set up on this server.' when endpoint returns 404", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "NOT_FOUND",
            message: "Demo data is not seeded",
            details: [],
          },
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    // Open demo panel
    fireEvent.click(screen.getByRole("button", { name: "Try demo" }));

    const mayaButton = screen.getByRole("button", { name: "Continue as Maya" });
    fireEvent.click(mayaButton);

    await waitFor(() => {
      expect(
        screen.getByText("Demo accounts are not set up on this server."),
      ).toBeInTheDocument();
    });
  });
});
