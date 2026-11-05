import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { App } from "../src/App.js";

describe("Client App Smoke Test", () => {
  it("renders the app layout and dashboard headline", async () => {
    render(<App />);

    expect(screen.getByText("IntellMeet")).toBeInTheDocument();
    expect(screen.getByText(/You have 0 live meetings/i)).toBeInTheDocument();
  });
});

