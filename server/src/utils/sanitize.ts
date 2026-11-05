/**
 * Recursively strips object keys that begin with '$' or contain '.'
 * to prevent NoSQL injection attacks.
 */
export function sanitizeInput<T>(input: T): T {
  if (input === null || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((item: unknown) => sanitizeInput(item)) as unknown as T;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (key.startsWith("$") || key.includes(".")) {
      continue;
    }
    sanitized[key] = sanitizeInput(value);
  }

  return sanitized as T;
}

/**
 * In-place sanitization for objects whose properties cannot be reassigned (e.g., Express 5 req.query).
 */
export function sanitizeInPlace(obj: unknown): void {
  if (obj === null || typeof obj !== "object") {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      sanitizeInPlace(item);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete record[key];
    } else if (record[key] !== null && typeof record[key] === "object") {
      sanitizeInPlace(record[key]);
    }
  }
}
