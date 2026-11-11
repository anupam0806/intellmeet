import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { RouteErrorBoundary } from "../src/components/RouteErrorBoundary.js";

function CrashingComponent(): React.JSX.Element {
  throw new Error("Deliberate test render crash");
}

describe("RouteErrorBoundary", () => {
  it("renders error page with reload button and dashboard link when a route crashes", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const router = createMemoryRouter(
      [
        {
          path: "/",
          errorElement: <RouteErrorBoundary />,
          children: [
            {
              path: "crash",
              element: <CrashingComponent />,
            },
            {
              path: "dashboard",
              element: <div>Dashboard Content</div>,
            },
          ],
        },
      ],
      { initialEntries: ["/crash"] },
    );

    render(<RouterProvider router={router} />);

    // Check heading
    expect(
      screen.getByRole("heading", { level: 1, name: "Something went wrong on this page." }),
    ).toBeInTheDocument();

    // Check reload button
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();

    // Check link to dashboard
    const dashboardLink = screen.getByRole("link", { name: "Dashboard" });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute("href", "/dashboard");

    // Ensure no stack trace or joke/emoji is exposed
    expect(screen.queryByText(/Deliberate test render crash/i)).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it("calls window.location.reload when Reload button is clicked", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const originalLocation = window.location;
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    });

    const router = createMemoryRouter(
      [
        {
          path: "/",
          errorElement: <RouteErrorBoundary />,
          children: [
            {
              path: "crash",
              element: <CrashingComponent />,
            },
          ],
        },
      ],
      { initialEntries: ["/crash"] },
    );

    render(<RouterProvider router={router} />);

    const reloadButton = screen.getByRole("button", { name: "Reload" });
    fireEvent.click(reloadButton);

    expect(reloadMock).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});

