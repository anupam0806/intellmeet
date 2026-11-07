import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";

export class RtcController {
  static getConfig(_req: Request, res: Response, _next: NextFunction): void {
    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [];

    const stunList = env.STUN_URLS
      ? env.STUN_URLS.split(",").map((u) => u.trim()).filter(Boolean)
      : ["stun:stun.l.google.com:19302"];

    if (stunList.length > 0) {
      iceServers.push({ urls: stunList });
    }

    if (env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
      iceServers.push({
        urls: env.TURN_URL,
        username: env.TURN_USERNAME,
        credential: env.TURN_CREDENTIAL,
      });
    }

    res.status(200).json({
      iceServers,
      maxParticipants: env.MAX_PARTICIPANTS,
    });
  }
}

