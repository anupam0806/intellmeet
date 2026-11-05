import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export type DatabaseStatus = "connected" | "not-configured" | "connecting" | "disconnected";

let isConfigured = false;

export async function connectDB(): Promise<void> {
  if (!env.MONGODB_URI || env.MONGODB_URI.trim() === "") {
    isConfigured = false;
    logger.warn("MONGODB_URI is empty. Starting server without MongoDB connection (database: not-configured).");
    return;
  }

  isConfigured = true;
  try {
    logger.info("Connecting to MongoDB Atlas...");
    await mongoose.connect(env.MONGODB_URI);
    logger.info("Connected to MongoDB successfully.");
  } catch (error) {
    logger.error({ err: error }, "Failed to connect to MongoDB.");
    throw error;
  }
}

export function getDatabaseStatus(): DatabaseStatus {
  if (!isConfigured) {
    return "not-configured";
  }

  switch (mongoose.connection.readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    default:
      return "disconnected";
  }
}

