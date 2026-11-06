import React from "react";
import { Navigate, Outlet, useSearchParams } from "react-router-dom";
import { useAuthStore } from "../store/authStore.js";

export function PublicOnlyRoute(): React.JSX.Element {
  const { user, isInitialized } = useAuthStore();
  const [searchParams] = useSearchParams();

  if (!isInitialized) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "var(--ground)",
          color: "var(--ink-soft)",
          fontSize: "15px",
        }}
      >
        Loading session...
      </div>
    );
  }

  if (user) {
    const returnTo = searchParams.get("returnTo");
    const target = returnTo ? decodeURIComponent(returnTo) : "/dashboard";
    return <Navigate to={target} replace />;
  }

  return <Outlet />;
}

