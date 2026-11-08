import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Login } from "../src/pages/Login.js";
import { Signup } from "../src/pages/Signup.js";
import { useAuthStore } from "../src/store/authStore.js";
import * as apiModule from "../src/lib/api.js";

describe("Password Field Show/Hide Toggle", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    vi.restoreAllMocks();
  });

  describe("Login Page", () => {
    it("renders with password hidden by default and accessible toggle button", () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const passwordInput = screen.getByLabelText(/^Password$/i);
      expect(passwordInput).toHaveAttribute("type", "password");

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("aria-pressed", "false");
      expect(toggleButton).toHaveAttribute("type", "button");

      const svgIcon = toggleButton.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
      expect(svgIcon).toHaveAttribute("width", "20");
      expect(svgIcon).toHaveAttribute("height", "20");
    });

    it("toggles password visibility between text and password on click", () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const passwordInput = screen.getByLabelText(/^Password$/i);
      const toggleButton = screen.getByRole("button", { name: "Show password" });

      // Click to show password
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");
      expect(toggleButton).toHaveAttribute("aria-label", "Hide password");
      expect(toggleButton).toHaveAttribute("aria-pressed", "true");

      // Click again to hide password
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(toggleButton).toHaveAttribute("aria-label", "Show password");
      expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    });

    it("is keyboard operable and can receive focus", () => {
      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      toggleButton.focus();
      expect(document.activeElement).toBe(toggleButton);

      // Trigger with keyboard click / enter
      fireEvent.click(toggleButton);
      const passwordInput = screen.getByLabelText(/^Password$/i);
      expect(passwordInput).toHaveAttribute("type", "text");
    });

    it("returns password to hidden when form is submitted", async () => {
      vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
        accessToken: "test-token",
        user: { id: "u1", name: "User", email: "user@example.com", role: "member", teamId: "t1" },
      });

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const emailInput = screen.getByLabelText(/Email/i);
      const passwordInput = screen.getByLabelText(/^Password$/i);
      const toggleButton = screen.getByRole("button", { name: "Show password" });

      // Toggle to show password
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");

      // Fill in valid credentials
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "validpassword123" } });

      // Submit form
      const submitButton = screen.getByRole("button", { name: "Log in" });
      fireEvent.click(submitButton);

      // Password input should return to hidden
      await waitFor(() => {
        expect(passwordInput).toHaveAttribute("type", "password");
        expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
      });
    });

    it("returns to hidden when unmounted and re-mounted", () => {
      const { unmount } = render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      fireEvent.click(toggleButton);
      expect(screen.getByLabelText(/^Password$/i)).toHaveAttribute("type", "text");

      unmount();

      render(
        <MemoryRouter>
          <Login />
        </MemoryRouter>,
      );

      expect(screen.getByLabelText(/^Password$/i)).toHaveAttribute("type", "password");
      expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
    });
  });

  describe("Signup Page", () => {
    it("renders with password hidden by default and accessible toggle button", () => {
      render(
        <MemoryRouter>
          <Signup />
        </MemoryRouter>,
      );

      const passwordInput = screen.getByLabelText(/Password \(8–72 characters\)/i);
      expect(passwordInput).toHaveAttribute("type", "password");

      const toggleButton = screen.getByRole("button", { name: "Show password" });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton).toHaveAttribute("aria-pressed", "false");

      const svgIcon = toggleButton.querySelector("svg");
      expect(svgIcon).toBeInTheDocument();
      expect(svgIcon).toHaveAttribute("width", "20");
      expect(svgIcon).toHaveAttribute("height", "20");
    });

    it("toggles password visibility between text and password on click in Signup", () => {
      render(
        <MemoryRouter>
          <Signup />
        </MemoryRouter>,
      );

      const passwordInput = screen.getByLabelText(/Password \(8–72 characters\)/i);
      const toggleButton = screen.getByRole("button", { name: "Show password" });

      // Click to show password
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");
      expect(toggleButton).toHaveAttribute("aria-label", "Hide password");
      expect(toggleButton).toHaveAttribute("aria-pressed", "true");

      // Click again to hide password
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "password");
      expect(toggleButton).toHaveAttribute("aria-label", "Show password");
      expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    });

    it("returns password to hidden when signup form is submitted", async () => {
      vi.spyOn(apiModule, "apiFetch").mockResolvedValue({
        accessToken: "test-token",
        user: { id: "u1", name: "User", email: "user@example.com", role: "admin", teamId: "t1" },
      });

      render(
        <MemoryRouter>
          <Signup />
        </MemoryRouter>,
      );

      const nameInput = screen.getByLabelText(/Full name/i);
      const emailInput = screen.getByLabelText(/Email address/i);
      const passwordInput = screen.getByLabelText(/Password \(8–72 characters\)/i);
      const teamInput = screen.getByLabelText(/Team name/i);
      const toggleButton = screen.getByRole("button", { name: "Show password" });

      // Toggle to show password
      fireEvent.click(toggleButton);
      expect(passwordInput).toHaveAttribute("type", "text");

      // Fill in valid signup fields
      fireEvent.change(nameInput, { target: { value: "Test User" } });
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "supersecret123" } });
      fireEvent.change(teamInput, { target: { value: "Acme Corp" } });

      // Submit form
      const submitButton = screen.getByRole("button", { name: /create team and account/i });
      fireEvent.click(submitButton);

      // Password input should return to hidden
      await waitFor(() => {
        expect(passwordInput).toHaveAttribute("type", "password");
        expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("aria-pressed", "false");
      });
    });

    it("has css rule in globals.css hiding Edge ::-ms-reveal and ::-ms-clear controls", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const cssContent = fs.readFileSync(path.resolve(__dirname, "../src/styles/globals.css"), "utf-8");
      expect(cssContent).toContain("input::-ms-reveal");
      expect(cssContent).toContain("input::-ms-clear");
      expect(cssContent).toContain("display: none");
    });
  });
});
