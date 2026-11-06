import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateMeetingDialog } from "../src/components/CreateMeetingDialog.js";
import { Meetings } from "../src/pages/Meetings.js";
import * as meetingsApi from "../src/lib/meetings.js";

describe("Meetings UI Components", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.restoreAllMocks();
  });

  it("renders CreateMeetingDialog fields and handles cancel", () => {
    const handleClose = vi.fn();

    render(
      <CreateMeetingDialog
        isOpen={true}
        onClose={handleClose}
      />,
    );

    expect(screen.getByRole("heading", { name: "New Meeting" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Meeting Title \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Schedule Time/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Meeting" })).toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("does not render CreateMeetingDialog when isOpen is false", () => {
    const { container } = render(
      <CreateMeetingDialog
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Meetings list page with filters and empty state", async () => {
    vi.spyOn(meetingsApi, "fetchMeetings").mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Meetings />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: "Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All Meetings" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Live Now" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ended" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search meetings by title/i)).toBeInTheDocument();

    // Verify empty state is rendered
    expect(await screen.findByText("No meetings found")).toBeInTheDocument();
  });

  it("renders meeting rows when data is returned", async () => {
    vi.spyOn(meetingsApi, "fetchMeetings").mockResolvedValueOnce({
      items: [
        {
          id: "m1",
          title: "Sprint Retrospective",
          hostId: "u1",
          hostName: "Maya Chen",
          colorIndex: 2,
          status: "LIVE",
          scheduledAt: new Date().toISOString(),
          participantCount: 3,
          aiStatus: "NONE",
          actionItemCount: 0,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Meetings />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Sprint Retrospective")).toBeInTheDocument();
    expect(screen.getByText(/Host: Maya Chen/i)).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });
});
