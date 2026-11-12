import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { sanitizeInPlace } from "./utils/sanitize.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.routes.js";
import { teamRouter } from "./routes/team.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { meetingRouter } from "./routes/meeting.routes.js";
import { taskRouter } from "./routes/task.routes.js";
import { notificationRouter } from "./routes/notification.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { rtcRouter } from "./routes/rtc.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { generalRateLimiter } from "./middleware/rateLimit.js";

export function resolveClientDistPath(clientDistOverride?: string): { path: string; exists: boolean } {
  const defaultClientDist = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../client/dist",
  );
  const clientDistPath =
    clientDistOverride ||
    (env.CLIENT_DIST_DIR && env.CLIENT_DIST_DIR.trim() !== ""
      ? path.resolve(env.CLIENT_DIST_DIR)
      : defaultClientDist);
  return { path: clientDistPath, exists: fs.existsSync(clientDistPath) };
}

export function createApp(clientDistOverride?: string): express.Application {
  const app = express();

  // Trust proxy for rate limit and secure cookies behind reverse proxy (Render)
  app.set("trust proxy", 1);

  // Security headers with CSP tailored for IntellMeet SPA
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", "blob:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
    }),
  );

  // CORS (development only)
  if (env.NODE_ENV === "development") {
    app.use(
      cors({
        origin: env.CLIENT_ORIGIN,
        credentials: true,
      }),
    );
  }

  // Cookie parsing
  app.use(cookieParser());

  // JSON body parser with limit
  app.use(express.json({ limit: "1mb" }));

  // Request parameter/body sanitization: strip keys starting with '$' or containing '.'
  app.use((req, _res, next) => {
    if (req.body && typeof req.body === "object") {
      sanitizeInPlace(req.body);
    }
    if (req.query && typeof req.query === "object") {
      sanitizeInPlace(req.query);
    }
    if (req.params && typeof req.params === "object") {
      sanitizeInPlace(req.params);
    }
    next();
  });

  // Health checks are mounted before rate limiting so uptime monitors are never throttled
  app.use("/api/v1/health", healthRouter);
  app.use("/health", healthRouter);

  // General rate limiter: 1000 requests per 15 minutes per IP (excludes /health and static client files)
  app.use("/api", generalRateLimiter);

  // API v1 routes
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/team", teamRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/meetings", meetingRouter);
  app.use("/api/v1/tasks", taskRouter);
  app.use("/api/v1/notifications", notificationRouter);
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/rtc", rtcRouter);
  app.use("/rtc", rtcRouter);

  // 404 handler for unmatched API routes
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
        details: [],
      },
    });
  });

  // Static serving for built client in production or when dist exists
  const { path: clientDistPath, exists: clientDistExists } = resolveClientDistPath(clientDistOverride);

  if (clientDistExists) {
    // Serve static files with caching
    app.use(
      express.static(clientDistPath, {
        setHeaders: (res, filePath) => {
          const normalized = filePath.replaceAll("\\", "/");
          if (normalized.includes("/assets/")) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else if (normalized.endsWith("index.html")) {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );

    // Fallback middleware: sends index.html for GET/HEAD non-API, non-socket.io routes without extension
    app.use((req, res, next) => {
      if (
        (req.method === "GET" || req.method === "HEAD") &&
        !req.path.startsWith("/api") &&
        !req.path.startsWith("/socket.io") &&
        !path.extname(req.path)
      ) {
        const indexPath = path.join(clientDistPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.setHeader("Cache-Control", "no-cache");
          res.sendFile(indexPath, (err) => {
            if (err) next(err);
          });
          return;
        }
      }
      next();
    });
  } else {
    logger.warn(`Client dist folder not found at ${clientDistPath}; continuing without client static serving.`);
  }

  // Central error handler
  app.use(errorHandler);

  return app;
}

