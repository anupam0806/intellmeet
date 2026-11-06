import { UserRole } from "../models/User.js";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        teamId: string;
        role: UserRole;
      };
    }
  }
}

export {};

