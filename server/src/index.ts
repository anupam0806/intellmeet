import http from "node:http";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { connectDB, getDatabaseStatus } from "./config/db.js";
import { createApp } from "./app.js";
import { createSocketServer } from "./sockets/index.js";
import { recoverPendingAiGenerations } from "./services/ai/generate.js";
import { logger } from "./utils/logger.js";

async function bootstrap(): Promise<void> {
  // Database connection
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.io
  const io = createSocketServer(server);
  app.set("io", io);

  // Recover any stranded PENDING AI generations on start
  recoverPendingAiGenerations(undefined, io).catch((err: unknown) => {
    logger.error({ err }, "Error recovering pending AI generations");
  });

  server.listen(env.PORT, () => {
    logger.info(
      `IntellMeet Server listening on http://localhost:${env.PORT} [env: ${env.NODE_ENV}, database: ${getDatabaseStatus()}]`,
    );
  });

  // Graceful shutdown on SIGTERM and SIGINT
  let isShuttingDown = false;
  const handleShutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // 1. Close Socket.io server
    try {
      await new Promise<void>((resolve) => {
        io.close(() => resolve());
      });
      logger.info("Socket.io server closed.");
    } catch (err) {
      logger.error({ err }, "Error closing Socket.io server");
    }

    // 2. Close HTTP server
    try {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      logger.info("HTTP server closed.");
    } catch (err) {
      logger.error({ err }, "Error closing HTTP server");
    }

    // 3. Close MongoDB connection
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
        logger.info("MongoDB connection closed.");
      }
    } catch (err) {
      logger.error({ err }, "Error closing MongoDB connection");
    }

    logger.info("Graceful shutdown completed. Exiting process.");
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    handleShutdown("SIGTERM").catch((err) => {
      logger.error({ err }, "Fatal error during SIGTERM shutdown");
      process.exit(1);
    });
  });

  process.on("SIGINT", () => {
    handleShutdown("SIGINT").catch((err) => {
      logger.error({ err }, "Fatal error during SIGINT shutdown");
      process.exit(1);
    });
  });
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});

