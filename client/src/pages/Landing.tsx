import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  X,
  Video,
  CheckSquare,
  FileText,
  Users,
  BarChart3,
  MessageSquare,
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
    icon: FileText,
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

const MEETING_SPINE_COLORS = [
  "var(--meeting-teal)",
  "var(--meeting-olive)",
  "var(--meeting-rose)",
  "var(--meeting-bronze)",
  "var(--meeting-cocoa)",
];

/* Geometric logo mark for IntellMeet */
function IntellMeetGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
      <rect width="28" height="28" rx="8" fill="var(--signal)" />
      <path d="M8 14h2.5m2-5v10m4.5-7v4m3-2h2" stroke="var(--on-signal)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Landing(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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
      {/* Skip to main content link */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          top: "-9999px",
          left: "16px",
          zIndex: 100,
          padding: "8px 16px",
          backgroundColor: "var(--ink)",
          color: "var(--ground)",
          textDecoration: "none",
          borderRadius: "var(--radius)",
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

      {/* Top bar (48px height flat bar matching AppLayout pattern) */}
      <header
        style={{
          height: "48px",
          borderBottom: "1px solid var(--rule)",
          backgroundColor: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
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
                fontSize: "17px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
              }}
            >
              IntellMeet
            </span>
          </Link>

          {/* Section anchors (hidden on mobile) */}
          <nav
            aria-label="Section anchors"
            className="hidden lg:flex"
            style={{
              alignItems: "center",
              gap: "20px",
            }}
          >
            <a
              href="#how-it-works"
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
            >
              How it works
            </a>
            <a
              href="#features"
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
            >
              Features
            </a>
            <a
              href="#built-with"
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
            >
              Built with
            </a>
            <a
              href="#good-to-know"
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-soft)")}
            >
              Good to know
            </a>
          </nav>
        </div>

        {/* Right side controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {user ? (
            <Link
              to="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: "32px",
                padding: "0 14px",
                borderRadius: "var(--radius)",
                backgroundColor: "var(--signal)",
                color: "var(--on-signal)",
                fontSize: "13px",
                fontWeight: 600,
                textDecoration: "none",
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
                  color: "var(--ink)",
                  textDecoration: "none",
                  padding: "4px 8px",
                }}
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="hidden sm:inline-flex"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "32px",
                  padding: "0 14px",
                  borderRadius: "var(--radius)",
                  backgroundColor: "var(--signal)",
                  color: "var(--on-signal)",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Sign up
              </Link>
            </>
          )}

          {/* Mobile menu button */}
          <button
            ref={menuBtnRef}
            type="button"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="landing-menu-panel"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="flex lg:hidden"
            style={{
              width: "32px",
              height: "32px",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
              border: "1px solid var(--rule)",
              borderRadius: "var(--radius)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            {mobileMenuOpen ? <X size={16} strokeWidth={2} /> : <Menu size={16} strokeWidth={2} />}
          </button>
        </div>
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
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              zIndex: 45,
            }}
          />

          <dialog
            open
            id="landing-menu-panel"
            ref={panelRef}
            aria-modal="true"
            aria-label="Landing navigation"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              height: "100%",
              width: "85%",
              maxWidth: "320px",
              backgroundColor: "var(--surface)",
              border: "none",
              borderLeft: "1px solid var(--rule)",
              display: "flex",
              flexDirection: "column",
              zIndex: 50,
              padding: "24px 20px",
              margin: 0,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <IntellMeetGlyph />
                <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--ink)" }}>IntellMeet</span>
              </div>
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-soft)",
                  cursor: "pointer",
                }}
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <nav
              aria-label="Mobile links"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                flex: 1,
              }}
            >
              <a
                href="#how-it-works"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                How it works
              </a>
              <a
                href="#features"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                Features
              </a>
              <a
                href="#built-with"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                Built with
              </a>
              <a
                href="#good-to-know"
                onClick={closeMenu}
                style={{
                  padding: "10px 0",
                  fontSize: "15px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                }}
              >
                Good to know
              </a>
            </nav>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--rule)" }}>
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={closeMenu}
                  style={{
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--signal)",
                    color: "var(--on-signal)",
                    fontSize: "14px",
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
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius)",
                      backgroundColor: "var(--signal)",
                      color: "var(--on-signal)",
                      fontSize: "14px",
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
                      height: "40px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--rule)",
                      backgroundColor: "transparent",
                      color: "var(--ink)",
                      fontSize: "14px",
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
        <div style={{ maxWidth: "1040px", margin: "0 auto", padding: "0 24px" }}>
          
          {/* Hero Section */}
          <section
            style={{
              padding: "72px 0 56px 0",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <h1 className="hero-headline" aria-label="Meetings that end with notes and owners.">
              Meetings that end with<br />
              notes and <span className="hero-gradient-word">owners</span>.
            </h1>

            <p className="hero-subtitle">
              Hold a video meeting with your team, get a written summary with decisions and action items, and turn them into tasks on a shared board.
            </p>

            <p
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                margin: "0 auto 28px auto",
                lineHeight: 1.5,
                textAlign: "center",
              }}
            >
              IntellMeet runs in your browser. There is nothing to install.
            </p>

            {/* Direct CTAs */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              {user ? (
                <Link
                  to="/dashboard"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "10px 20px",
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--signal)",
                    color: "var(--on-signal)",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Open dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "10px 20px",
                      borderRadius: "var(--radius)",
                      backgroundColor: "transparent",
                      border: "1px solid var(--rule)",
                      color: "var(--ink)",
                      fontSize: "14px",
                      fontWeight: 500,
                      textDecoration: "none",
                    }}
                  >
                    Log in
                  </Link>

                  <Link
                    to="/login?demo=1"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "10px 20px",
                      borderRadius: "var(--radius)",
                      backgroundColor: "var(--signal)",
                      color: "var(--on-signal)",
                      fontSize: "14px",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Try the demo
                  </Link>
                </>
              )}
            </div>
          </section>

          {/* How It Works Section */}
          <section
            id="how-it-works"
            style={{
              padding: "48px 0",
              borderTop: "1px solid var(--rule)",
              scrollMarginTop: "60px",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 20px 0",
              }}
            >
              How it works
            </h2>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {HOW_IT_WORKS_STEPS.map((stepText, idx) => (
                <div
                  key={stepText}
                  className="landing-row"
                  style={{
                    gap: "16px",
                  }}
                >
                  <div
                    style={{
                      width: "3px",
                      height: "20px",
                      borderRadius: "3px",
                      backgroundColor: MEETING_SPINE_COLORS[idx % MEETING_SPINE_COLORS.length],
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: MEETING_SPINE_COLORS[idx % MEETING_SPINE_COLORS.length],
                      minWidth: "20px",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {idx + 1}.
                  </span>
                  <span style={{ fontSize: "15px", color: "var(--ink)", lineHeight: 1.5 }}>
                    {stepText}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Features Section */}
          <section
            id="features"
            style={{
              padding: "48px 0",
              borderTop: "1px solid var(--rule)",
              scrollMarginTop: "60px",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 20px 0",
              }}
            >
              Features
            </h2>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.name}
                    className="landing-row"
                    style={{
                      gap: "16px",
                      alignItems: "flex-start",
                    }}
                  >
                    <Icon size={18} strokeWidth={1.75} style={{ color: "var(--ink-soft)", marginTop: "2px", flexShrink: 0 }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span
                        style={{
                          fontSize: "15px",
                          fontWeight: 600,
                          color: "var(--ink)",
                        }}
                      >
                        {f.name}
                      </span>
                      <span style={{ fontSize: "14px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                        {f.description}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Built With Section */}
          <section
            id="built-with"
            style={{
              padding: "48px 0",
              borderTop: "1px solid var(--rule)",
              scrollMarginTop: "60px",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 20px 0",
              }}
            >
              Built with
            </h2>

            <dl style={{ margin: 0, display: "flex", flexDirection: "column" }}>
              {BUILT_WITH.map((item) => (
                <div
                  key={item.label}
                  className="landing-row"
                  style={{
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <dt
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {item.label}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "14px", color: "var(--ink-soft)", lineHeight: 1.5 }}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Good to know Section */}
          <section
            id="good-to-know"
            style={{
              padding: "48px 0 64px 0",
              borderTop: "1px solid var(--rule)",
              scrollMarginTop: "60px",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 20px 0",
              }}
            >
              Good to know
            </h2>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {LIMITS.map((limit) => (
                <div
                  key={limit}
                  className="landing-row"
                  style={{
                    gap: "12px",
                  }}
                >
                  <span style={{ width: "4px", height: "4px", borderRadius: "50%", backgroundColor: "var(--ink-soft)", flexShrink: 0 }} />
                  <span style={{ fontSize: "14px", color: "var(--ink)", lineHeight: 1.5 }}>
                    {limit}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer Landmark */}
      <footer
        style={{
          borderTop: "1px solid var(--rule)",
          backgroundColor: "var(--surface)",
          padding: "24px 24px",
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
            color: "var(--ink-soft)",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <IntellMeetGlyph />
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>IntellMeet</span>
          </div>

          <a
            href="https://github.com/anupam0806/intellmeet"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--ink)",
              textDecoration: "underline",
            }}
          >
            Source code
          </a>
        </div>
      </footer>
    </div>
  );
}
