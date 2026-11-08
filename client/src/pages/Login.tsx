import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch, ApiClientError } from "../lib/api.js";
import { useAuthStore, User } from "../store/authStore.js";

const loginFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginFormSchema>;

export function Login(): React.JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [serverError, setServerError] = useState<string | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    return () => {
      setShowPassword(false);
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
  });

  const getTargetUrl = () => {
    const returnTo = searchParams.get("returnTo");
    return returnTo ? decodeURIComponent(returnTo) : "/dashboard";
  };

  const onSubmit = async (data: LoginFormData) => {
    setShowPassword(false);
    setServerError(null);
    try {
      const res = await apiFetch<{ accessToken: string; user: User }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setAuth(res.user, res.accessToken);
      navigate(getTargetUrl());
    } catch (err) {
      if (err instanceof ApiClientError) {
        setServerError(err.message || "Invalid email or password");
      } else {
        setServerError("Failed to connect to the server. Please try again.");
      }
    }
  };

  const handleDemoLogin = async () => {
    setServerError(null);
    setDemoLoading(true);
    try {
      const res = await apiFetch<{ accessToken: string; user: User }>("/api/v1/auth/demo", {
        method: "POST",
      });
      setAuth(res.user, res.accessToken);
      navigate(getTargetUrl());
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "NOT_FOUND") {
        setServerError("Demo team is not seeded yet. Sign up below to get started.");
      } else {
        setServerError("Unable to sign in with demo credentials.");
      }
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "var(--ground)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "880px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--rule)",
          overflow: "hidden",
        }}
      >
        {/* Left Column: Log in Form */}
        <div style={{ padding: "40px" }}>
          <h1
            style={{
              fontSize: "30px",
              fontWeight: 700,
              margin: "0 0 8px 0",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Log in
          </h1>
          <p style={{ color: "var(--ink-soft)", margin: "0 0 24px 0", fontSize: "15px" }}>
            Enter your team credentials to access your meetings and tasks.
          </p>

          {serverError && (
            <div
              style={{
                padding: "12px",
                borderRadius: "var(--radius)",
                backgroundColor: "var(--ground)",
                border: "1px solid var(--error)",
                color: "var(--error)",
                fontSize: "14px",
                marginBottom: "20px",
              }}
            >
              {serverError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              setShowPassword(false);
              handleSubmit(onSubmit)(e);
            }}
            noValidate
          >
            <div style={{ marginBottom: "16px" }}>
              <label
                htmlFor="email"
                style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "var(--radius)",
                  border: errors.email ? "1px solid var(--error)" : "1px solid var(--rule)",
                  backgroundColor: "var(--surface)",
                  color: "var(--ink)",
                  fontSize: "15px",
                }}
              />
              {errors.email && (
                <span style={{ display: "block", color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                  {errors.email.message}
                </span>
              )}
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="password"
                style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
              >
                Password
              </label>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  {...register("password")}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    height: "40px",
                    padding: "0 40px 0 12px",
                    borderRadius: "var(--radius)",
                    border: errors.password ? "1px solid var(--error)" : "1px solid var(--rule)",
                    backgroundColor: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: "15px",
                  }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--ink-soft)",
                    cursor: "pointer",
                    borderRadius: "3px",
                    lineHeight: 1,
                  }}
                >
                  {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
                </button>
              </div>
              {errors.password && (
                <span style={{ display: "block", color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                  {errors.password.message}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || demoLoading}
              style={{
                width: "100%",
                height: "40px",
                borderRadius: "var(--radius)",
                border: "none",
                backgroundColor: "var(--signal)",
                color: "var(--on-signal)",
                fontSize: "15px",
                fontWeight: 600,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
                marginBottom: "12px",
              }}
            >
              {isSubmitting ? "Signing in..." : "Log in"}
            </button>

            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isSubmitting || demoLoading}
              style={{
                width: "100%",
                height: "40px",
                borderRadius: "var(--radius)",
                border: "1px solid var(--rule)",
                backgroundColor: "transparent",
                color: "var(--ink)",
                fontSize: "15px",
                fontWeight: 600,
                cursor: demoLoading ? "not-allowed" : "pointer",
                opacity: demoLoading ? 0.7 : 1,
                marginBottom: "20px",
              }}
            >
              {demoLoading ? "Connecting to demo..." : "Try demo"}
            </button>
          </form>

          <p style={{ fontSize: "13px", color: "var(--ink-soft)", margin: "0 0 16px 0" }}>
            The server can take about a minute to wake after idle time.
          </p>

          <div style={{ fontSize: "14px", color: "var(--ink-soft)" }}>
            Don't have an account?{" "}
            <Link to="/signup" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>
              Sign up
            </Link>
          </div>
        </div>

        {/* Right Column: Sample Action List (Seeded Meeting Preview) */}
        <div
          style={{
            backgroundColor: "var(--ground)",
            padding: "40px",
            borderLeft: "1px solid var(--rule)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: "16px" }}>
            Automated Meeting Insights
          </div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", margin: "0 0 8px 0" }}>
            Sprint 14 Planning
          </h2>
          <p style={{ fontSize: "14px", color: "var(--ink-soft)", margin: "0 0 24px 0" }}>
            Generated from meeting transcript and live discussion.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div
              style={{
                backgroundColor: "var(--surface)",
                padding: "12px 16px",
                borderRadius: "var(--radius)",
                borderLeft: "4px solid var(--meeting-0)",
                fontSize: "14px",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
                Finalize checkout error handling
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
                Assigned to Maya Chen · Due Friday
              </div>
            </div>

            <div
              style={{
                backgroundColor: "var(--surface)",
                padding: "12px 16px",
                borderRadius: "var(--radius)",
                borderLeft: "4px solid var(--meeting-1)",
                fontSize: "14px",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
                Review mobile layout responsiveness
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
                Assigned to Dev Patel · Due Monday
              </div>
            </div>

            <div
              style={{
                backgroundColor: "var(--surface)",
                padding: "12px 16px",
                borderRadius: "var(--radius)",
                borderLeft: "4px solid var(--meeting-2)",
                fontSize: "14px",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: "4px" }}>
                Update customer onboarding notes
              </div>
              <div style={{ fontSize: "13px", color: "var(--ink-soft)" }}>
                Assigned to Lena Fischer · Due Wednesday
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
