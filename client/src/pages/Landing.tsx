import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuthStore } from "../store/authStore.js";

const HOW_IT_WORKS_STEPS = [
  "Create a team or join one with an invite code.",
  "Create a meeting and share its room code.",
  "Hold the meeting with video, chat, screen sharing, and live captions.",
  "End it and review the written summary, decisions, and action items.",
  "Convert action items into tasks and follow them on the board.",
];

const FEATURES = [
  { name: "Video meetings", description: "Up to 4 people in the browser, with screen sharing." },
  { name: "Chat and captions", description: "Messages saved with the meeting; live captions in Chrome and Edge." },
  { name: "Written summaries", description: "A summary, key points, decisions, and action items made from the transcript and chat." },
  { name: "Task board", description: "Three columns, assignees, due dates, live updates." },
  { name: "Analytics", description: "Meetings per week, task status, participation." },
  { name: "Teams and roles", description: "Admin and Member, invite code." },
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

export function Landing(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    document.title = "IntellMeet";
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--ground)" }}>
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

      {/* Top bar header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backgroundColor: "var(--ground)",
          borderBottom: "1px solid var(--rule)",
        }}
      >
        <div
          style={{
            maxWidth: "1024px",
            margin: "0 auto",
            height: "64px",
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Product name */}
          <Link
            to="/"
            style={{
              fontSize: "19px",
              fontWeight: 700,
              color: "var(--ink)",
              textDecoration: "none",
              letterSpacing: "-0.01em",
            }}
          >
            IntellMeet
          </Link>

          {/* Desktop navigation (1024px and up) */}
          <nav
            aria-label="Main navigation"
            className="hidden lg:flex"
            style={{ alignItems: "center", gap: "24px" }}
          >
            <a
              href="#how-it-works"
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              How it works
            </a>
            <a
              href="#features"
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Features
            </a>
            <a
              href="#built-with"
              style={{
                fontSize: "14px",
                color: "var(--ink-soft)",
                textDecoration: "none",
                fontWeight: 500,
              }}
            >
              Built with
            </a>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginLeft: "12px" }}>
              {user ? (
                <Link
                  to="/dashboard"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "44px",
                    padding: "0 16px",
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
                      justifyContent: "center",
                      height: "44px",
                      padding: "0 16px",
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
                  <Link
                    to="/signup"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "44px",
                      padding: "0 16px",
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
                </>
              )}
            </div>
          </nav>

          {/* Narrow screen controls (below 1024px) */}
          <div className="flex lg:hidden" style={{ alignItems: "center", gap: "12px" }}>
            {user ? (
              <Link
                to="/dashboard"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "44px",
                  padding: "0 14px",
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
              <Link
                to="/login"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "44px",
                  padding: "0 14px",
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
            )}

            <button
              ref={menuBtnRef}
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-menu-panel"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              style={{
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "transparent",
                border: "1px solid var(--rule)",
                borderRadius: "var(--radius)",
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              {mobileMenuOpen ? <X size={20} strokeWidth={1.75} /> : <Menu size={20} strokeWidth={1.75} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu drawer panel */}
      {mobileMenuOpen && (
        <>
          <div
            onClick={closeMenu}
            aria-hidden="true"
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
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
              backgroundColor: "var(--surface)",
              border: "none",
              borderLeft: "1px solid var(--rule)",
              boxShadow: "var(--shadow-menu)",
              display: "flex",
              flexDirection: "column",
              zIndex: 50,
              padding: "24px 20px",
              margin: 0,
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <span style={{ fontSize: "17px", fontWeight: 700, color: "var(--ink)" }}>
                IntellMeet
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={closeMenu}
                style={{
                  width: "44px",
                  height: "44px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "transparent",
                  border: "none",
                  color: "var(--ink)",
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
                gap: "12px",
                flex: 1,
              }}
            >
              <a
                href="#how-it-works"
                onClick={closeMenu}
                style={{
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                }}
              >
                How it works
              </a>
              <a
                href="#features"
                onClick={closeMenu}
                style={{
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                }}
              >
                Features
              </a>
              <a
                href="#built-with"
                onClick={closeMenu}
                style={{
                  minHeight: "44px",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "16px",
                  fontWeight: 500,
                  color: "var(--ink)",
                  textDecoration: "none",
                }}
              >
                Built with
              </a>
            </nav>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--rule)" }}>
              {user ? (
                <Link
                  to="/dashboard"
                  onClick={closeMenu}
                  style={{
                    minHeight: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--signal)",
                    color: "var(--on-signal)",
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
                      minHeight: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius)",
                      backgroundColor: "var(--signal)",
                      color: "var(--on-signal)",
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
                      minHeight: "44px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--radius)",
                      border: "1px solid var(--rule)",
                      backgroundColor: "transparent",
                      color: "var(--ink)",
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

      {/* Main content landmark */}
      <main id="main-content" style={{ flex: 1 }}>
        <div style={{ maxWidth: "1024px", margin: "0 auto", padding: "0 20px" }}>
          {/* Hero section */}
          <section
            style={{
              padding: "72px 0 64px 0",
              textAlign: "left",
              borderBottom: "1px solid var(--rule)",
            }}
          >
            <h1
              style={{
                fontSize: "36px",
                fontWeight: 800,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
                margin: "0 0 16px 0",
                maxWidth: "720px",
              }}
            >
              Meetings that end with notes and owners.
            </h1>
            <p
              style={{
                fontSize: "17px",
                lineHeight: 1.5,
                color: "var(--ink-soft)",
                margin: "0 0 32px 0",
                maxWidth: "680px",
              }}
            >
              Hold a video meeting with your team, get a written summary with decisions and action items, and turn them into tasks on a shared board.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              {user ? (
                <Link
                  to="/dashboard"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "44px",
                    padding: "0 20px",
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--signal)",
                    color: "var(--on-signal)",
                    fontSize: "15px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Open dashboard
                </Link>
              ) : (
                <Link
                  to="/login"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "44px",
                    padding: "0 20px",
                    borderRadius: "var(--radius)",
                    backgroundColor: "var(--signal)",
                    color: "var(--on-signal)",
                    fontSize: "15px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Log in
                </Link>
              )}

              <Link
                to="/login?demo=1"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "44px",
                  padding: "0 20px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--rule)",
                  backgroundColor: "transparent",
                  color: "var(--ink)",
                  fontSize: "15px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Try the demo
              </Link>
            </div>
          </section>

          {/* How it works section */}
          <section
            id="how-it-works"
            style={{
              padding: "56px 0",
              borderBottom: "1px solid var(--rule)",
              scrollMarginTop: "72px",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 24px 0",
              }}
            >
              How it works
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {HOW_IT_WORKS_STEPS.map((stepText, idx) => (
                <div
                  key={stepText}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "16px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--rule)",
                    borderLeft: `6px solid var(--meeting-${idx})`,
                    gap: "16px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "15px",
                      fontWeight: 700,
                      color: "var(--ink-soft)",
                      minWidth: "20px",
                    }}
                  >
                    {idx + 1}.
                  </span>
                  <span style={{ fontSize: "15px", color: "var(--ink)", lineHeight: 1.4 }}>
                    {stepText}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Features section */}
          <section
            id="features"
            style={{
              padding: "56px 0",
              borderBottom: "1px solid var(--rule)",
              scrollMarginTop: "72px",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 24px 0",
              }}
            >
              Features
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {FEATURES.map((f) => (
                <div
                  key={f.name}
                  style={{
                    padding: "16px 20px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--rule)",
                  }}
                >
                  <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--ink)", marginBottom: "4px" }}>
                    {f.name}
                  </div>
                  <div style={{ fontSize: "14px", color: "var(--ink-soft)", lineHeight: 1.4 }}>
                    {f.description}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Built with section */}
          <section
            id="built-with"
            style={{
              padding: "56px 0",
              borderBottom: "1px solid var(--rule)",
              scrollMarginTop: "72px",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 24px 0",
              }}
            >
              Built with
            </h2>

            <dl
              style={{
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {BUILT_WITH.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "14px 18px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--rule)",
                    gap: "4px",
                  }}
                >
                  <dt style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink-soft)" }}>
                    {item.label}
                  </dt>
                  <dd style={{ margin: 0, fontSize: "15px", color: "var(--ink)" }}>
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Good to know (honest limits) */}
          <section
            style={{
              padding: "56px 0",
              textAlign: "left",
            }}
          >
            <h2
              style={{
                fontSize: "22px",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                margin: "0 0 24px 0",
              }}
            >
              Good to know
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {LIMITS.map((limit) => (
                <div
                  key={limit}
                  style={{
                    padding: "14px 18px",
                    backgroundColor: "var(--surface)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--rule)",
                    fontSize: "14px",
                    color: "var(--ink)",
                    lineHeight: 1.4,
                  }}
                >
                  {limit}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* Footer landmark */}
      <footer
        style={{
          borderTop: "1px solid var(--rule)",
          backgroundColor: "var(--ground)",
          padding: "24px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "1024px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "14px",
            color: "var(--ink-soft)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>IntellMeet</span>
          <a
            href="https://github.com/anupam0806/intellmeet"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--ink)", textDecoration: "underline" }}
          >
            Source code
          </a>
        </div>
      </footer>
    </div>
  );
}

