import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  X,
  Sparkles,
  Video,
  CheckSquare,
  FileText,
  Search,
  ArrowRight,
  Shield,
  Zap,
  Users,
  BarChart3,
  MessageSquare,
  Laptop,
  CheckCircle2,
} from "lucide-react";
import { useAuthStore } from "../store/authStore.js";

const HOW_IT_WORKS_STEPS = [
  "Create a team or join one with an invite code.",
  "Create a meeting and share its room code.",
  "Hold the meeting with video, chat, screen sharing, and live captions.",
  "End it and review the written summary, decisions, and action items.",
  "Convert action items into tasks and follow them on the board.",
];

const FEATURES = [
  {
    name: "Video meetings",
    description: "Up to 4 people in the browser, with screen sharing.",
    icon: Video,
  },
  {
    name: "Chat and captions",
    description: "Messages saved with the meeting; live captions in Chrome and Edge.",
    icon: MessageSquare,
  },
  {
    name: "Written summaries",
    description: "A summary, key points, decisions, and action items made from the transcript and chat.",
    icon: Sparkles,
  },
  {
    name: "Task board",
    description: "Three columns, assignees, due dates, live updates.",
    icon: CheckSquare,
  },
  {
    name: "Analytics",
    description: "Meetings per week, task status, participation.",
    icon: BarChart3,
  },
  {
    name: "Teams and roles",
    description: "Admin and Member, invite code.",
    icon: Users,
  },
];

const BUILT_WITH = [
  { label: "Front end", value: "React 19, TypeScript, Vite, Tailwind CSS." },
  { label: "Back end", value: "Node.js, Express, Socket.io." },
  { label: "Database", value: "MongoDB Atlas." },
  { label: "Video", value: "WebRTC." },
  { label: "Summaries", value: "A language model API." },
  { label: "Security", value: "JWT sessions, bcrypt, Zod validation, rate limiting." },
  { label: "Hosting and checks", value: "Render, GitHub Actions." },
];

const LIMITS = [
  "Rooms hold up to 4 people.",
  "Live captions need Chrome or Edge and use the browser's speech service.",
  "The free host can take about a minute to wake after idle time.",
  "The demo uses sample data.",
];

/* Real inline-SVG Apple logo mark */
function AppleGlyph() {
  return (
    <svg width="15" height="18" viewBox="0 0 170 170" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.67-7.85-11.96-14.42-6-9.17-10.87-19.78-14.61-31.84-3.74-12.06-5.61-23.75-5.61-35.07 0-15.54 4.09-28.84 12.27-39.9 8.18-11.06 18.73-16.71 31.65-16.96 5.43 0 11.45 1.44 18.06 4.34 6.61 2.89 10.88 4.39 12.82 4.49 1.74 0 6.27-1.61 13.59-4.84 7.32-3.23 13.63-4.58 18.94-4.07 14.33 1.19 25.4 6.65 33.22 16.39-11.73 7.1-17.49 16.91-17.29 29.43.2 10.15 4.14 18.73 11.83 25.74 7.69 7.01 16.89 11.02 27.6 12.04-2.39 7.39-5.32 14.99-8.79 22.81zM119.22 31.84c0-7.39 2.66-14.28 7.98-20.67 5.32-6.39 12.06-10.45 20.22-12.17.22 1.3.33 2.5.33 3.59 0 7.39-2.77 14.45-8.31 21.18-5.54 6.73-12.28 10.66-20.22 11.79z" />
    </svg>
  );
}

/* Real inline-SVG Windows logo mark */
function WindowsGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4h-13.051M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.8" />
    </svg>
  );
}

/* Real Product Hunt Badge mark */
function ProductHuntGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 40 40" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="20" cy="20" r="20" fill="#DA552F" />
      <path d="M22.5 13H15v14h4v-5h3.5c3.038 0 5.5-2.015 5.5-4.5s-2.462-4.5-5.5-4.5zm0 5.5H19v-2.5h3.5c1.105 0 2 .672 2 1.25s-.895 1.25-2 1.25z" fill="#FFFFFF" />
    </svg>
  );
}

/* Warm geometric logo glyph for IntellMeet */
function IntellMeetGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="navWarmGrad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffb347" />
          <stop offset="0.5" stopColor="#ff6b4a" />
          <stop offset="1" stopColor="#ff2f3a" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="7" fill="url(#navWarmGrad)" />
      <path d="M8 14h2.5m2-5v10m4.5-7v4m3-2h2" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const COMMAND_PALETTE_ROWS = [
  {
    icon: Sparkles,
    label: "Generate AI summary & decisions",
    arg: "pnpm build",
    displayShortcut: "Cmd+Enter",
  },
  {
    icon: Video,
    label: "Join active video room",
    arg: "room/eng-sync",
    displayShortcut: "Cmd+K",
  },
  {
    icon: CheckSquare,
    label: "Convert action items to tasks",
    arg: "board/brightwell",
    displayShortcut: "Cmd+B",
  },
  {
    icon: FileText,
    label: "Export meeting transcript & notes",
    arg: "~/projects/app",
    displayShortcut: "Cmd+O",
  },
];

export function Landing(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<number>(0);
  const [typedQuery] = useState<string>("deploy staging");
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    document.title = "IntellMeet — Video Meetings & AI Summaries";
  }, []);

  // Trap focus and handle escape when mobile menu is open
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMobileMenuOpen(false);
        menuBtnRef.current?.focus();
        return;
      }

      if (e.key === "Tab" && panelRef.current) {
        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable.at(-1);

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const closeMenu = () => {
    setMobileMenuOpen(false);
    menuBtnRef.current?.focus();
  };

  return (
    <div className="aurora-canvas">
      {/* Skip to main content accessible link */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          top: "-9999px",
          left: "16px",
          zIndex: 100,
          padding: "8px 16px",
          backgroundColor: "#ffffff",
          color: "#07080a",
          textDecoration: "none",
          borderRadius: "6px",
          fontSize: "14px",
          fontWeight: 600,
        }}
        onFocus={(e) => {
          e.currentTarget.style.top = "16px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.top = "-9999px";
        }}
      >
        Skip to main content
      </a>

      {/* =========================================================================
          ANIMATED WARM AURORA LIGHT-BLADE BACKDROP
          Pure CSS keyframes over subtle grain + radial vignette, strictly warm
         ========================================================================= */}
      <div className="aurora-backdrop" aria-hidden="true">
        {/* Blade 1: Left diagonal crimson core */}
        <div className="aurora-blade aurora-blade-1" />

        {/* Blade 2: Right diagonal coral-amber streak */}
        <div className="aurora-blade aurora-blade-2" />

        {/* Blade 3: Center ambient glowing heart */}
        <div className="aurora-blade aurora-blade-3" />

        {/* SVG Film Grain Filter */}
        <svg className="aurora-grain" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>

        {/* Radial vignette keeping text crisp */}
        <div className="aurora-vignette" />
      </div>

      {/* =========================================================================
          FLOATING TRANSLUCENT PILL NAV
          Rounded dark-glass container hovering at top with hairline border & glow
         ========================================================================= */}
      <header style={{ position: "relative", zIndex: 40, padding: "0 16px" }}>
        <nav aria-label="Main navigation" className="floating-pill-nav">
          {/* Left: Warm logo glyph + white wordmark */}
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              textDecoration: "none",
            }}
          >
            <IntellMeetGlyph />
            <span
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: "16px",
                fontWeight: 700,
                color: "#ffffff",
                letterSpacing: "-0.02em",
              }}
            >
              IntellMeet
            </span>
          </Link>

          {/* Center: Row of muted #9c9c9d 14px/500 text links (hidden on mobile) */}
          <div
            className="hidden lg:flex"
            style={{
              alignItems: "center",
              gap: "28px",
            }}
          >
            <a
              href="#how-it-works"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#9c9c9d",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9c9c9d")}
            >
              How it works
            </a>
            <a
              href="#features"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#9c9c9d",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9c9c9d")}
            >
              Features
            </a>
            <a
              href="#built-with"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#9c9c9d",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9c9c9d")}
            >
              Built with
            </a>
            <a
              href="#good-to-know"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#9c9c9d",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#9c9c9d")}
            >
              Good to know
            </a>
          </div>

          {/* Right: Auth controls / tactile CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            {user ? (
              <Link
                to="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "36px",
                  padding: "0 16px",
                  borderRadius: "9999px",
                  background: "linear-gradient(135deg, #ff6b4a 0%, #ff2f3a 100%)",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                  boxShadow: "0 0 16px rgba(255, 47, 58, 0.35)",
                }}
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  style={{
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#9c9c9d",
                    textDecoration: "none",
                    padding: "6px 8px",
                    transition: "color 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#9c9c9d")}
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  className="keycap-btn hidden sm:inline-flex"
                  style={{
                    padding: "7px 15px",
                    fontSize: "13px",
                    borderRadius: "9999px",
                  }}
                >
                  <AppleGlyph />
                  <span>Sign up</span>
                </Link>
              </>
            )}

            {/* Mobile menu trigger */}
            <button
              ref={menuBtnRef}
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-menu-panel"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex lg:hidden"
              style={{
                width: "36px",
                height: "36px",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "9999px",
                color: "#ffffff",
                cursor: "pointer",
              }}
            >
              {mobileMenuOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Drawer Dialog */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={closeMenu}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(6px)",
              zIndex: 45,
            }}
          />

          <dialog
            open
            id="landing-menu-panel"
            ref={panelRef}
            aria-modal="true"
            aria-label="Landing navigation"
            className="mobile-menu-panel"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              height: "100%",
              width: "85%",
              maxWidth: "320px",
              backgroundColor: "#0d0e12",
              border: "none",
              borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 0 40px rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              zIndex: 50,
              padding: "24px 20px",
              margin: 0,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <IntellMeetGlyph />
                <span style={{ fontSize: "17px", fontWeight: 700, color: "#ffffff" }}>IntellMeet</span>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
                style={{
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  color: "#9c9c9d",
                  cursor: "pointer",
                }}
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>

            <nav
              aria-label="Mobile links"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                flex: 1,
              }}
            >
              <a
                href="#how-it-works"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#e4e4e7",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                How it works
              </a>
              <a
                href="#features"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#e4e4e7",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                Features
              </a>
              <a
                href="#built-with"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#e4e4e7",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                }}
              >
                Built with
              </a>
              <a
                href="#good-to-know"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "#e4e4e7",
                  textDecoration: "none",
                }}
              >
                Good to know
              </a>
            </nav>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto", paddingTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={closeMenu}
                  style={{
                    height: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "8px",
                    background: "linear-gradient(135deg, #ff6b4a 0%, #ff2f3a 100%)",
                    color: "#ffffff",
                    fontSize: "15px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    onClick={closeMenu}
                    style={{
                      height: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, #ff6b4a 0%, #ff2f3a 100%)",
                      color: "#ffffff",
                      fontSize: "15px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Sign up
                  </Link>
                  <Link
                    to="/login"
                    onClick={closeMenu}
                    style={{
                      height: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.15)",
                      backgroundColor: "transparent",
                      color: "#ffffff",
                      fontSize: "15px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Log in
                  </Link>
                </>
              )}
            </div>
          </dialog>
        </>
      )}

      {/* Main Content Landmark */}
      <main id="main-content" style={{ position: "relative", zIndex: 10, flex: 1 }}>
        <div style={{ maxWidth: "1040px", margin: "0 auto", padding: "0 20px" }}>
          
          {/* =====================================================================
              HERO SECTION
              Eyebrow, Scoped 64px H1, Warm Gradient Accent, Subtitle, Keycaps, Mockup
             ===================================================================== */}
          <section
            style={{
              padding: "76px 0 60px 0",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            {/* Subtle Eyebrow Pill */}
            <div className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              <span>v2.0 — now with an AI command bar</span>
            </div>

            {/* Scoped Two-line H1 with Warm-Gradient Accent Word */}
            <h1 className="hero-headline">
              Meetings that end with<br />
              notes and <span className="hero-gradient-word">owners</span>.
            </h1>

            {/* Subtitle in Inter 18px / 400 / 0.2px letter-spacing */}
            <p className="hero-subtitle">
              Hold a video meeting with your team, get a written summary with decisions and action items, and turn them into tasks on a shared board.
            </p>

            {/* Tactile Keycap Download Button Row */}
            <div className="keycap-row">
              <a
                href="#download-mac"
                className="keycap-btn"
                onClick={(e) => e.preventDefault()}
                role="button"
                aria-label="Download for Mac"
              >
                <AppleGlyph />
                <span>Download for Mac</span>
              </a>

              <a
                href="#download-windows"
                className="keycap-btn"
                onClick={(e) => e.preventDefault()}
                role="button"
                aria-label="Download for Windows"
              >
                <WindowsGlyph />
                <span>Download for Windows</span>
              </a>
            </div>

            {/* GeistMono 12px #9c9c9d Caption */}
            <div className="keycap-caption">
              brew install intellmeet - Install via homebrew or winget
            </div>

            {/* Direct Web App / Demo CTAs */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "14px",
                marginTop: "18px",
                flexWrap: "wrap",
              }}
            >
              {user ? (
                <Link
                  to="/dashboard"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 18px",
                    borderRadius: "9999px",
                    backgroundColor: "rgba(255, 107, 74, 0.16)",
                    border: "1px solid rgba(255, 107, 74, 0.4)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Open dashboard &rarr;
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "7px 16px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#d4d4d8",
                      fontSize: "13px",
                      fontWeight: 500,
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#ffffff";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.25)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#d4d4d8";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                    }}
                  >
                    Log in
                  </Link>

                  <Link
                    to="/login?demo=1"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "7px 18px",
                      borderRadius: "9999px",
                      backgroundColor: "rgba(255, 107, 74, 0.14)",
                      border: "1px solid rgba(255, 107, 74, 0.35)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255, 107, 74, 0.22)";
                      e.currentTarget.style.borderColor = "rgba(255, 107, 74, 0.55)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "rgba(255, 107, 74, 0.14)";
                      e.currentTarget.style.borderColor = "rgba(255, 107, 74, 0.35)";
                    }}
                  >
                    Try the demo &rarr;
                  </Link>
                </>
              )}
            </div>

            {/* ===================================================================
                DARK-GLASS COMMAND-BAR / LAUNCHER MOCKUP
                Backdrop-blurred rounded panel, warm drop shadow, warm blinking caret
               =================================================================== */}
            <div className="command-bar-mockup" role="region" aria-label="Command palette launcher mockup">
              {/* Top search input row */}
              <div className="command-bar-header">
                <div className="command-bar-input-wrap">
                  <Search size={17} style={{ color: "#a1a1aa", flexShrink: 0 }} />
                  <div className="command-bar-query">
                    <span>{typedQuery}</span>
                    <span className="warm-caret" />
                  </div>
                </div>
                <div className="command-mode-pill">Command</div>
              </div>

              {/* 4 Result rows with active warm aurora tint on first row */}
              <div className="command-bar-results">
                {COMMAND_PALETTE_ROWS.map((item, idx) => {
                  const Icon = item.icon;
                  const isActive = idx === activeRow;
                  return (
                    <div
                      key={item.label}
                      className={`command-row ${isActive ? "command-row-active" : ""}`}
                      onClick={() => setActiveRow(idx)}
                      role="option"
                      aria-selected={isActive}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setActiveRow(idx);
                        }
                      }}
                    >
                      <div className="command-row-left">
                        <div className="command-row-icon">
                          <Icon size={15} />
                        </div>
                        <div className="command-row-label">
                          <span>{item.label}</span>
                          <span className="command-row-arg">{item.arg}</span>
                        </div>
                      </div>

                      <div className="shortcut-chip">
                        {item.displayShortcut}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer strip: mono hints + brand wordmark */}
              <div className="command-bar-footer">
                <div>up/down navigate &middot; enter open &middot; esc dismiss</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#d4d4d8", fontWeight: 600 }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ff6b4a" }} />
                  IntellMeet
                </div>
              </div>
            </div>

            {/* Exactly ONE Centered Low-Emphasis Ghost Pill */}
            <div style={{ display: "flex", justifyContent: "center", marginTop: "28px" }}>
              <a href="#how-it-works" className="ghost-pill">
                Learn more <ArrowRight size={13} style={{ color: "inherit" }} />
              </a>
            </div>
          </section>

          {/* =====================================================================
              HOW IT WORKS SECTION
             ===================================================================== */}
          <section
            id="how-it-works"
            style={{
              padding: "72px 0",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              scrollMarginTop: "90px",
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "32px" }}>
              <div style={{ fontSize: "12px", fontFamily: "'Geist Mono', monospace", color: "#ff6b4a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                Workflow
              </div>
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                How it works
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {HOW_IT_WORKS_STEPS.map((stepText, idx) => {
                const borderColors = [
                  "#ff6b4a",
                  "#ffb347",
                  "#ff2f3a",
                  "#2A7F78",
                  "#C46A7C",
                ];
                return (
                  <div
                    key={stepText}
                    className="obsidian-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "18px 20px",
                      gap: "18px",
                      borderLeft: `4px solid ${borderColors[idx] || "#ff6b4a"}`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'Geist Mono', monospace",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: borderColors[idx] || "#ff6b4a",
                        minWidth: "24px",
                      }}
                    >
                      {idx + 1}.
                    </span>
                    <span style={{ fontSize: "15px", color: "#e4e4e7", lineHeight: 1.45, fontWeight: 400 }}>
                      {stepText}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* =====================================================================
              FEATURES SECTION
             ===================================================================== */}
          <section
            id="features"
            style={{
              padding: "72px 0",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              scrollMarginTop: "90px",
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "32px" }}>
              <div style={{ fontSize: "12px", fontFamily: "'Geist Mono', monospace", color: "#ff6b4a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                Capabilities
              </div>
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Features
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: "16px",
              }}
            >
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.name}
                    className="obsidian-card"
                    style={{
                      padding: "24px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                    }}
                  >
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        backgroundColor: "rgba(255, 107, 74, 0.12)",
                        border: "1px solid rgba(255, 107, 74, 0.25)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ff6b4a",
                      }}
                    >
                      <Icon size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "#ffffff",
                          marginBottom: "6px",
                          fontFamily: "'Inter', sans-serif",
                        }}
                      >
                        {f.name}
                      </div>
                      <div style={{ fontSize: "14px", color: "#a1a1aa", lineHeight: 1.5 }}>
                        {f.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* =====================================================================
              BUILT WITH SECTION
             ===================================================================== */}
          <section
            id="built-with"
            style={{
              padding: "72px 0",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              scrollMarginTop: "90px",
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "32px" }}>
              <div style={{ fontSize: "12px", fontFamily: "'Geist Mono', monospace", color: "#ff6b4a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                Architecture
              </div>
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Built with
              </h2>
            </div>

            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "14px",
              }}
            >
              {BUILT_WITH.map((item) => (
                <div
                  key={item.label}
                  className="obsidian-card"
                  style={{
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <dt
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#ffb347",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {item.label}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "14px", color: "#e4e4e7", lineHeight: 1.45 }}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* =====================================================================
              GOOD TO KNOW (HONEST LIMITS) SECTION
             ===================================================================== */}
          <section
            id="good-to-know"
            style={{
              padding: "72px 0 80px 0",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              scrollMarginTop: "90px",
              textAlign: "left",
            }}
          >
            <div style={{ marginBottom: "32px" }}>
              <div style={{ fontSize: "12px", fontFamily: "'Geist Mono', monospace", color: "#9c9c9d", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                Transparency
              </div>
              <h2
                style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                Good to know
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {LIMITS.map((limit) => (
                <div
                  key={limit}
                  className="obsidian-card"
                  style={{
                    padding: "16px 20px",
                    fontSize: "14px",
                    color: "#d4d4d8",
                    lineHeight: 1.45,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a1a1aa", flexShrink: 0 }} />
                  <span>{limit}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* =========================================================================
          FOOTER LANDMARK
         ========================================================================= */}
      <footer
        style={{
          borderTop: "1px solid rgba(255, 255, 255, 0.08)",
          backgroundColor: "#07080a",
          padding: "32px 20px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            maxWidth: "1040px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "14px",
            color: "#9c9c9d",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IntellMeetGlyph />
            <span style={{ fontWeight: 600, color: "#ffffff" }}>IntellMeet</span>
            <span style={{ color: "#52525b" }}>&middot;</span>
            <span style={{ fontSize: "12px", fontFamily: "'Geist Mono', monospace", color: "#71717a" }}>v2.0</span>
          </div>

          <a
            href="https://github.com/anupam0806/intellmeet"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#d4d4d8",
              textDecoration: "underline",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#d4d4d8")}
          >
            Source code
          </a>
        </div>
      </footer>

      {/* =========================================================================
          FLOATING PRODUCT HUNT BADGE CARD (Bottom-Right)
          Hairline border, subtle depth, muted and unobtrusive
         ========================================================================= */}
      <a
        href="https://www.producthunt.com"
        target="_blank"
        rel="noopener noreferrer"
        className="ph-badge-card"
        aria-label="Featured on Product Hunt #1 Product of the Day"
      >
        <ProductHuntGlyph />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              color: "#9c9c9d",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            Featured on
          </span>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Product Hunt <span style={{ color: "#ff6b4a", fontWeight: 600, marginLeft: "4px" }}>#1 of the Day</span>
          </span>
        </div>
      </a>
    </div>
  );
}
