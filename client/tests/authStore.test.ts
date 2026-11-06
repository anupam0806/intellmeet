import { describe, it, expect, beforeEach } from "vitest";
import { useAuthStore, User } from "../src/store/authStore.js";
import { getAccessToken } from "../src/lib/api.js";

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it("stores accessToken in memory only", () => {
    const mockUser: User = {
      id: "user123",
      name: "Test User",
      email: "test@example.com",
      role: "ADMIN",
      teamId: "team123",
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().setAuth(mockUser, "memory-only-token-abc");

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.accessToken).toBe("memory-only-token-abc");
    expect(getAccessToken()).toBe("memory-only-token-abc");

    // Ensure it is NOT placed in localStorage or sessionStorage
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(sessionStorage.getItem("accessToken")).toBeNull();
  });

  it("clearAuth resets state to unauthenticated", () => {
    const mockUser: User = {
      id: "user123",
      name: "Test User",
      email: "test@example.com",
      role: "MEMBER",
      teamId: "team123",
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().setAuth(mockUser, "token123");
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("updateUser updates user fields in place", () => {
    const mockUser: User = {
      id: "user123",
      name: "Old Name",
      email: "test@example.com",
      role: "MEMBER",
      teamId: "team123",
      createdAt: new Date().toISOString(),
    };

    useAuthStore.getState().setAuth(mockUser, "token123");
    useAuthStore.getState().updateUser({ name: "Updated Name" });

    expect(useAuthStore.getState().user?.name).toBe("Updated Name");
    expect(useAuthStore.getState().user?.email).toBe("test@example.com");
  });
});

