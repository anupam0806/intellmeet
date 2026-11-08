import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LobbyView } from "../src/components/room/LobbyView.js";

describe("Room LobbyView Component", () => {
  it("renders meeting title, user display name, and join button in ready state", () => {
    const handleJoin = vi.fn();
    const handleToggleAudio = vi.fn();
    const handleToggleVideo = vi.fn();

    render(
      <MemoryRouter>
        <LobbyView
          meetingTitle="Weekly Sprint Planning"
          userName="Jane Doe"
          localStream={null}
          audioEnabled={true}
          videoEnabled={true}
          audioBlocked={false}
          videoBlocked={false}
          lobbyState="ready"
          onToggleAudio={handleToggleAudio}
          onToggleVideo={handleToggleVideo}
          onSelectAudioDevice={vi.fn()}
          onSelectVideoDevice={vi.fn()}
          onJoinRoom={handleJoin}
          isJoining={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Weekly Sprint Planning" })).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join now" })).toBeInTheDocument();

    const joinBtn = screen.getByRole("button", { name: "Join now" });
    fireEvent.click(joinBtn);
    expect(handleJoin).toHaveBeenCalledTimes(1);

    const micBtn = screen.getByRole("button", { name: /Mute microphone/i });
    fireEvent.click(micBtn);
    expect(handleToggleAudio).toHaveBeenCalledTimes(1);
  });

  it("renders waiting_for_host message and enters when meeting starts", () => {
    render(
      <MemoryRouter>
        <LobbyView
          meetingTitle="Quarterly Roadmap"
          userName="Alex Smith"
          localStream={null}
          audioEnabled={true}
          videoEnabled={true}
          audioBlocked={false}
          videoBlocked={false}
          lobbyState="waiting_for_host"
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onSelectAudioDevice={vi.fn()}
          onSelectVideoDevice={vi.fn()}
          onJoinRoom={vi.fn()}
          isJoining={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Waiting for the host to start the meeting/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join when ready" })).toBeInTheDocument();
  });

  it("renders room_full notice and disables join button", () => {
    render(
      <MemoryRouter>
        <LobbyView
          meetingTitle="Executive Sync"
          userName="Late Joiner"
          localStream={null}
          audioEnabled={true}
          videoEnabled={true}
          audioBlocked={false}
          videoBlocked={false}
          lobbyState="room_full"
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onSelectAudioDevice={vi.fn()}
          onSelectVideoDevice={vi.fn()}
          onJoinRoom={vi.fn()}
          isJoining={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/This room has reached its maximum capacity of 4 participants/i)).toBeInTheDocument();
    const joinBtn = screen.getByRole("button", { name: "Join now" });
    expect(joinBtn).toBeDisabled();
  });

  it("displays blocked devices guidance when camera or microphone is blocked", () => {
    render(
      <MemoryRouter>
        <LobbyView
          meetingTitle="Design Review"
          userName="Guest"
          localStream={null}
          audioEnabled={false}
          videoEnabled={false}
          audioBlocked={true}
          videoBlocked={true}
          lobbyState="ready"
          onToggleAudio={vi.fn()}
          onToggleVideo={vi.fn()}
          onSelectAudioDevice={vi.fn()}
          onSelectVideoDevice={vi.fn()}
          onJoinRoom={vi.fn()}
          isJoining={false}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/Camera or microphone access is blocked/i)).toBeInTheDocument();
    // Still allows joining without them
    const joinBtn = screen.getByRole("button", { name: "Join now" });
    expect(joinBtn).toBeEnabled();
  });
});

