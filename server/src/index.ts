import http from "node:http";
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
}

bootstrap().catch((err: unknown) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});

