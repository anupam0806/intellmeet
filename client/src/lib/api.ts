interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly details: unknown[];
  readonly status: number;

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let inMemoryToken: string | null = null;
let onUnauthenticatedCallback: (() => void) | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryToken;
}

export function setOnUnauthenticated(cb: () => void): void {
  onUnauthenticatedCallback = cb;
}

function onRefreshed(token: string | null): void {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (inMemoryToken) {
    headers.set("Authorization", `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401 && !path.includes("/auth/refresh") && !path.includes("/auth/login")) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });

        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as { accessToken: string };
          setAccessToken(data.accessToken);
          onRefreshed(data.accessToken);
          isRefreshing = false;

          // Retry initial request with new token
          headers.set("Authorization", `Bearer ${data.accessToken}`);
          const retryRes = await fetch(url, {
            ...options,
            headers,
            credentials: "include",
          });
          return parseResponse<T>(retryRes);
        } else {
          setAccessToken(null);
          onRefreshed(null);
          isRefreshing = false;
          if (onUnauthenticatedCallback) {
            onUnauthenticatedCallback();
          }
        }
      } catch {
        setAccessToken(null);
        onRefreshed(null);
        isRefreshing = false;
        if (onUnauthenticatedCallback) {
          onUnauthenticatedCallback();
        }
      }
    } else {
      // Queue request while refresh is in flight
      return new Promise((resolve, reject) => {
        refreshSubscribers.push(async (newToken) => {
          if (!newToken) {
            reject(new ApiClientError(401, "UNAUTHENTICATED", "Session expired"));
            return;
          }
          try {
            headers.set("Authorization", `Bearer ${newToken}`);
            const retryRes = await fetch(url, {
              ...options,
              headers,
              credentials: "include",
            });
            resolve(await parseResponse<T>(retryRes));
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");

  if (!response.ok) {
    if (isJson) {
      const errorBody = (await response.json()) as ApiErrorResponse;
      throw new ApiClientError(
        response.status,
        errorBody.error?.code ?? "ERROR",
        errorBody.error?.message ?? "An unexpected error occurred",
        errorBody.error?.details ?? [],
      );
    }
    const text = await response.text();
    throw new ApiClientError(response.status, "HTTP_ERROR", text || response.statusText);
  }

  if (isJson) {
    return (await response.json()) as T;
  }

  // Reject unexpected HTML response (e.g. SPA fallback on wrong API paths)
  if (contentType && contentType.includes("text/html")) {
    throw new ApiClientError(
      response.status,
      "INVALID_RESPONSE",
      "Expected JSON response from API but received HTML",
    );
  }

  return (await response.text()) as unknown as T;
}

