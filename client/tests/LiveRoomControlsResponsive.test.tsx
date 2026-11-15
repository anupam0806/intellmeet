import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LiveRoomView } from "../src/components/room/LiveRoomView.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("LiveRoomView Responsive Control Bar", () => {
  const defaultProps = {
    isHost: false,
    isAdmin: false,
    hostId: "user-host",
    colorIndex: 0,
    selfName: "Dev Patel",
    selfStream: null,
    selfAudio: true,
    selfVideo: true,
    isScreenSharing: false,
    screenStream: null,
    captionsEnabled: false,
    captions: [],
    peers: [],
    chatMessages: [],
    typingUsers: [],
    onToggleAudio: vi.fn(),
    onToggleVideo: vi.fn(),
    onToggleScreenShare: vi.fn(),
    onToggleCaptions: vi.fn(),
    onLeaveMeeting: vi.fn(),
    onEndMeeting: vi.fn(),
    onSendMessage: vi.fn(),
    onTyping: vi.fn(),
    onRetryPeerConnection: vi.fn(),
  };

  it("ensures index.html contains viewport-fit=cover for safe-area insets", () => {
    const indexPath = path.resolve(__dirname, "../index.html");
    const html = fs.readFileSync(indexPath, "utf-8");
    expect(html).toMatch(/<meta\s+name=["']viewport["']\s+content=["'][^"']*viewport-fit=cover[^"']*/i);
  });

  it("ensures LiveRoomView.css defines dynamic viewport (100dvh) and safe-area insets", () => {
    const cssPath = path.resolve(__dirname, "../src/components/room/LiveRoomView.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Viewport unit resilience
    expect(css).toContain("height: 100dvh");
    expect(css).toContain("max-height: 100dvh");

    // Safe-area inset handling
    expect(css).toContain("env(safe-area-inset-bottom");
    expect(css).toContain("padding-bottom: max(12px, env(safe-area-inset-bottom, 12px))");

    // Main stage flex bounds
    expect(css).toContain("min-height: 0");

    // Control bar anchoring and classes
    expect(css).toContain(".live-room-control-btn");
    expect(css).toContain(".live-room-btn-leave");
  });

  it("renders all essential control buttons with live-room-control-btn class", () => {
    render(<LiveRoomView {...defaultProps} />);

    const controlsBar = screen.getByRole("complementary", { name: "Room controls" });
    expect(controlsBar).toBeInTheDocument();

    // Verify all essential buttons exist and have accessible names
    expect(screen.getByRole("button", { name: "Mute microphone" })).toHaveClass("live-room-control-btn");
    expect(screen.getByRole("button", { name: "Turn off camera" })).toHaveClass("live-room-control-btn");
    expect(screen.getByRole("button", { name: "Share screen" })).toHaveClass("live-room-control-btn");
    expect(screen.getByRole("button", { name: "Toggle chat" })).toHaveClass("live-room-control-btn");
    expect(screen.getByRole("button", { name: "Toggle participants list" })).toHaveClass("live-room-control-btn");

    // Leave button is always visible, tappable, and has both base and leave classes
    const leaveBtn = screen.getByRole("button", { name: "Leave meeting" });
    expect(leaveBtn).toBeInTheDocument();
    expect(leaveBtn).toHaveClass("live-room-control-btn");
    expect(leaveBtn).toHaveClass("live-room-btn-leave");

    fireEvent.click(leaveBtn);
    expect(defaultProps.onLeaveMeeting).toHaveBeenCalledTimes(1);
  });

  it("renders host 'End meeting for all' button when user isHost or isAdmin", () => {
    render(<LiveRoomView {...defaultProps} isHost={true} />);

    const endBtn = screen.getByRole("button", { name: "End meeting for all" });
    expect(endBtn).toBeInTheDocument();
    expect(endBtn).toHaveClass("live-room-control-btn");

    const leaveBtn = screen.getByRole("button", { name: "Leave meeting" });
    expect(leaveBtn).toBeInTheDocument();
  });
});
