import http from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { env } from "./config/env.js";
import { connectDB, getDatabaseStatus } from "./config/db.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

async function bootstrap(): Promise<void> {
  // Database connection
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  // Initialize Socket.io
  const io = new SocketIOServer(server, {
    cors:
      env.NODE_ENV === "development"
        ? {
            origin: env.CLIENT_ORIGIN,
            credentials: true,
          }
        : undefined,
  });

  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket connected");
    socket.on("disconnect", () => {
      logger.debug({ socketId: socket.id }, "Socket disconnected");
    });
  });

  server.listen(env.PORT, () => {
    logger.info(
      `IntellMeet Server listening on http://localhost:${env.PORT} [env: ${env.NODE_ENV}, database: ${getDatabaseStatus()}]`,
    );
  });
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});

