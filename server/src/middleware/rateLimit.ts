import rateLimit from "express-rate-limit";

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () =>
    (process.env.NODE_ENV === "test" && process.env.TEST_RATE_LIMIT !== "true") ||
    process.env.RATE_LIMIT_DISABLED === "true",
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many authentication attempts. Please try again later.",
        details: [],
      },
    });
  },
});

export const demoRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () =>
    (process.env.NODE_ENV === "test" && process.env.TEST_RATE_LIMIT !== "true") ||
    process.env.RATE_LIMIT_DISABLED === "true",
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many authentication attempts. Please try again later.",
        details: [],
      },
    });
  },
});

export const aiGenerateRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
  skip: () =>
    (process.env.NODE_ENV === "test" && process.env.TEST_RATE_LIMIT !== "true") ||
    process.env.RATE_LIMIT_DISABLED === "true",
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many AI generation requests. Please try again later.",
        details: [],
      },
    });
  },
});

export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    (process.env.NODE_ENV === "test" && process.env.TEST_RATE_LIMIT !== "true") ||
    process.env.RATE_LIMIT_DISABLED === "true" ||
    req.path.startsWith("/v1/health") ||
    req.path.startsWith("/health") ||
    req.originalUrl.includes("/health"),
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Please try again later.",
        details: [],
      },
    });
  },
});


