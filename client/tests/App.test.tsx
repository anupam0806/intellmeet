import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { Login } from "../src/pages/Login.js";
import { Signup } from "../src/pages/Signup.js";
import { useAuthStore } from "../src/store/authStore.js";

describe("Auth Pages UI", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("renders the login screen elements", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try demo" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
  });

  it("renders the signup screen with Create and Join tabs", () => {
    render(
      <MemoryRouter>
        <Signup />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create a team" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join a team" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Team name/i)).toBeInTheDocument();
  });
});
