import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { Login } from "../src/pages/Login.js";
import { useAuthStore } from "../src/store/authStore.js";

describe("Demo Login UI Component", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the 5 demo personas with their name, role as text, and continue button", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Try the demo" })).toBeInTheDocument();

    // Check all 5 personas and roles
    expect(screen.getByText("Maya Chen")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Maya" })).toBeInTheDocument();

    expect(screen.getByText("Dev Patel")).toBeInTheDocument();
    expect(screen.getAllByText("Member").length).toBe(4);
    expect(screen.getByRole("button", { name: "Continue as Dev" })).toBeInTheDocument();

    expect(screen.getByText("Lena Fischer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Lena" })).toBeInTheDocument();

    expect(screen.getByText("Omar Haddad")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Omar" })).toBeInTheDocument();

    expect(screen.getByText("Sofia Rossi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue as Sofia" })).toBeInTheDocument();
  });

  it("clicking a persona button calls POST /api/v1/auth/demo with { persona }", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: "mock-access-token-dev",
          user: {
            id: "dev-id",
            name: "Dev Patel",
            email: "dev@brightwell.test",
            role: "MEMBER",
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

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    const devButton = screen.getByRole("button", { name: "Continue as Dev" });
    fireEvent.click(devButton);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toContain("/api/v1/auth/demo");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({ persona: "dev" });

    // Verify auth store is populated
    await waitFor(() => {
      expect(useAuthStore.getState().user?.name).toBe("Dev Patel");
      expect(useAuthStore.getState().accessToken).toBe("mock-access-token-dev");
    });
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

    const mayaButton = screen.getByRole("button", { name: "Continue as Maya" });
    fireEvent.click(mayaButton);

    await waitFor(() => {
      expect(
        screen.getByText("Demo accounts are not set up on this server."),
      ).toBeInTheDocument();
    });
  });
});
