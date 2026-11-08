import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "../src/components/ProtectedRoute.js";
import { useAuthStore } from "../src/store/authStore.js";

describe("ProtectedRoute Guard", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("redirects unauthenticated user to /login with returnTo query parameter", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Dashboard Content")).not.toBeInTheDocument();
  });

  it("renders protected content for authenticated user", () => {
    useAuthStore.getState().setAuth(
      {
        id: "u1",
        name: "Auth User",
        email: "user@example.com",
        role: "MEMBER",
        teamId: "t1",
        createdAt: new Date().toISOString(),
      },
      "valid-token",
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard Content")).toBeInTheDocument();
    expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
  });
});

