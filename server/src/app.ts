import path from "node:path";
import fs from "node:fs";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { sanitizeInPlace } from "./utils/sanitize.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.routes.js";
import { teamRouter } from "./routes/team.routes.js";
import { userRouter } from "./routes/user.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(): express.Application {
  const app = express();

  // Trust proxy for rate limit and secure cookies behind reverse proxy (Render)
  app.set("trust proxy", 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Let React SPA handle inline assets/scripts cleanly
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

  // General rate limiter: 300 requests per 15 minutes per IP
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
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
  app.use("/api", generalLimiter);

  // API v1 routes
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/team", teamRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/health", healthRouter);
  app.use("/health", healthRouter);

  // Static serving for built client in production or when dist exists
  const clientDistPath = path.resolve(process.cwd(), "client/dist");
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/socket.io")) {
        res.sendFile(path.join(clientDistPath, "index.html"));
        return;
      }
      next();
    });
  }

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

  // Central error handler
  app.use(errorHandler);

  return app;
}

