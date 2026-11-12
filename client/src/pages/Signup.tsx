import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { apiFetch, ApiClientError } from "../lib/api.js";
import { useAuthStore, User } from "../store/authStore.js";

const signupFormSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name cannot exceed 60 characters"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password cannot exceed 72 characters"),
    mode: z.enum(["create", "join"]),
    teamName: z.string().trim().optional(),
    inviteCode: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "create") {
      if (!data.teamName || data.teamName.trim().length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["teamName"],
          message: "Team name must be at least 2 characters",
        });
      } else if (data.teamName.trim().length > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["teamName"],
          message: "Team name cannot exceed 80 characters",
        });
      }
    } else if (data.mode === "join") {
      if (!data.inviteCode || data.inviteCode.trim().length !== 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["inviteCode"],
          message: "Invite code must be exactly 8 characters",
        });
      }
    }
  });

type SignupFormData = z.infer<typeof signupFormSchema>;

export function Signup(): React.JSX.Element {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [mode, setMode] = useState<"create" | "join">("create");
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    return () => {
      setShowPassword(false);
    };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      mode: "create",
      teamName: "",
      inviteCode: "",
    },
  });

  const handleTabSwitch = (newMode: "create" | "join") => {
    setMode(newMode);
    setValue("mode", newMode);
    setServerError(null);
  };

  const onSubmit = async (data: SignupFormData) => {
    setShowPassword(false);
    setServerError(null);
    try {
      const payload: {
        name: string;
        email: string;
        password: string;
        teamName?: string;
        inviteCode?: string;
      } = {
        name: data.name,
        email: data.email,
        password: data.password,
      };

      if (data.mode === "create") {
        payload.teamName = data.teamName?.trim();
      } else {
        payload.inviteCode = data.inviteCode?.trim().toUpperCase();
      }

      const res = await apiFetch<{ accessToken: string; user: User }>("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setAuth(res.user, res.accessToken);
      navigate("/dashboard");
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === "EMAIL_TAKEN") {
          setServerError("An account with this email already exists.");
        } else if (err.code === "INVALID_INVITE_CODE") {
          setServerError("Invite code is invalid. Check the code and try again.");
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Failed to create account. Please check your connection.");
      }
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "var(--ground)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "var(--surface)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--rule)",
          padding: "32px 20px",
        }}
      >
        <h1
          style={{
            fontSize: "30px",
            fontWeight: 700,
            margin: "0 0 8px 0",
            color: "var(--ink)",
            letterSpacing: "-0.01em",
            overflowWrap: "anywhere",
          }}
        >
          Sign up
        </h1>
        <p style={{ color: "var(--ink-soft)", margin: "0 0 24px 0", fontSize: "15px" }}>
          Create an account to start hosting team meetings and tracking tasks.
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

        {/* Mode Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--rule)",
            marginBottom: "24px",
            gap: "16px",
          }}
        >
          <button
            type="button"
            onClick={() => handleTabSwitch("create")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 0",
              minHeight: "44px",
              fontSize: "15px",
              fontWeight: mode === "create" ? 600 : 400,
              color: mode === "create" ? "var(--ink)" : "var(--ink-soft)",
              borderBottom: mode === "create" ? "2px solid var(--ink)" : "2px solid transparent",
            }}
          >
            Create a team
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch("join")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "10px 0",
              minHeight: "44px",
              fontSize: "15px",
              fontWeight: mode === "join" ? 600 : 400,
              color: mode === "join" ? "var(--ink)" : "var(--ink-soft)",
              borderBottom: mode === "join" ? "2px solid var(--ink)" : "2px solid transparent",
            }}
          >
            Join a team
          </button>
        </div>

        <form
          onSubmit={(e) => {
            setShowPassword(false);
            handleSubmit(onSubmit)(e);
          }}
          noValidate
        >
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="name"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
            >
              Full name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              {...register("name")}
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: "40px",
                padding: "0 12px",
                borderRadius: "var(--radius)",
                border: errors.name ? "1px solid var(--error)" : "1px solid var(--rule)",
                backgroundColor: "var(--surface)",
                color: "var(--ink)",
                fontSize: "15px",
              }}
            />
            {errors.name && (
              <span style={{ display: "block", color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                {errors.name.message}
              </span>
            )}
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="email"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
            >
              Email address
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

          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="password"
              style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
            >
              Password (8–72 characters)
            </label>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
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

          {mode === "create" ? (
            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="teamName"
                style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
              >
                Team name
              </label>
              <input
                id="teamName"
                type="text"
                placeholder="e.g. Acme Corp"
                {...register("teamName")}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "var(--radius)",
                  border: errors.teamName ? "1px solid var(--error)" : "1px solid var(--rule)",
                  backgroundColor: "var(--surface)",
                  color: "var(--ink)",
                  fontSize: "15px",
                }}
              />
              {errors.teamName && (
                <span style={{ display: "block", color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                  {errors.teamName.message}
                </span>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="inviteCode"
                style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px", color: "var(--ink)" }}
              >
                8-character invite code
              </label>
              <input
                id="inviteCode"
                type="text"
                placeholder="e.g. BRIGHT24"
                maxLength={8}
                {...register("inviteCode")}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: "40px",
                  padding: "0 12px",
                  borderRadius: "var(--radius)",
                  border: errors.inviteCode ? "1px solid var(--error)" : "1px solid var(--rule)",
                  backgroundColor: "var(--surface)",
                  color: "var(--ink)",
                  fontSize: "15px",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              />
              {errors.inviteCode && (
                <span style={{ display: "block", color: "var(--error)", fontSize: "13px", marginTop: "4px" }}>
                  {errors.inviteCode.message}
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              width: "100%",
              height: "44px",
              borderRadius: "var(--radius)",
              border: "none",
              backgroundColor: "var(--signal)",
              color: "var(--on-signal)",
              fontSize: "15px",
              fontWeight: 600,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              marginBottom: "20px",
            }}
          >
            {isSubmitting
              ? "Creating account..."
              : mode === "create"
                ? "Create team and account"
                : "Join team and create account"}
          </button>
        </form>

        <div style={{ fontSize: "14px", color: "var(--ink-soft)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color: "var(--ink)", fontWeight: 600, textDecoration: "underline" }}>
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
