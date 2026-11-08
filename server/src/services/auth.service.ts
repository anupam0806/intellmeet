import crypto from "node:crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User, IUser } from "../models/User.js";
import { Team } from "../models/Team.js";
import { env, isDemoLoginEnabled } from "../config/env.js";
import { ApiError } from "../middleware/errorHandler.js";
import { SignupInput, LoginInput, DemoPersona } from "../validators/auth.js";
import { UpdateUserInput } from "../validators/user.js";

const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuvwxyzABCDEF1234567890abcdefghijk";

function getBcryptRounds(): number {
  if (env.NODE_ENV === "test") return 4;
  if (env.NODE_ENV === "production") return 12;
  return 10;
}

export function formatUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    teamId: user.teamId.toString(),
    ...(user.avatarUrl ? { avatarUrl: user.avatarUrl } : {}),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function generateUniqueInviteCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.randomBytes(8);
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[bytes[i]! % chars.length];
    }
    const existing = await Team.findOne({ inviteCode: code });
    if (!existing) {
      return code;
    }
  }
  throw new ApiError(500, "INTERNAL", "Failed to generate unique invite code");
}

export function generateAccessToken(user: { _id: mongoose.Types.ObjectId; teamId: mongoose.Types.ObjectId; role: string }): string {
  return jwt.sign(
    {
      userId: user._id.toString(),
      teamId: user.teamId.toString(),
      role: user.role,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: "15m", algorithm: "HS256" },
  );
}

export async function createRefreshToken(userId: mongoose.Types.ObjectId): Promise<{ rawToken: string; hash: string }> {
  const secretPart = crypto.randomBytes(32).toString("hex");
  const rawToken = `${userId.toString()}.${secretPart}`;
  const hash = await bcrypt.hash(secretPart, getBcryptRounds());
  return { rawToken, hash };
}

export const DEMO_PERSONAS: Record<DemoPersona, { email: string; name: string; role: "ADMIN" | "MEMBER" }> = {
  maya: { email: "maya@brightwell.test", name: "Maya Chen", role: "ADMIN" },
  dev: { email: "dev@brightwell.test", name: "Dev Patel", role: "MEMBER" },
  lena: { email: "lena@brightwell.test", name: "Lena Fischer", role: "MEMBER" },
  omar: { email: "omar@brightwell.test", name: "Omar Haddad", role: "MEMBER" },
  sofia: { email: "sofia@brightwell.test", name: "Sofia Rossi", role: "MEMBER" },
};

export class AuthService {
  static async signup(input: SignupInput) {
    const existingUser = await User.findOne({ email: input.email });
    if (existingUser) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(input.password, getBcryptRounds());

    let teamId: mongoose.Types.ObjectId;
    let role: "ADMIN" | "MEMBER";

    if (input.teamName) {
      role = "ADMIN";
      const dummyUserId = new mongoose.Types.ObjectId();
      const inviteCode = await generateUniqueInviteCode();
      const team = await Team.create({
        name: input.teamName,
        inviteCode,
        ownerId: dummyUserId,
      });
      teamId = team._id;
    } else if (input.inviteCode) {
      role = "MEMBER";
      const team = await Team.findOne({ inviteCode: input.inviteCode });
      if (!team) {
        throw new ApiError(404, "INVALID_INVITE_CODE", "Invalid team invite code");
      }
      teamId = team._id;
    } else {
      throw new ApiError(400, "VALIDATION_ERROR", "Must provide teamName or inviteCode");
    }

    const user = new User({
      name: input.name,
      email: input.email,
      passwordHash,
      role,
      teamId,
      lastLoginAt: new Date(),
    });

    const { rawToken, hash } = await createRefreshToken(user._id);
    user.refreshTokenHash = hash;
    await user.save();

    // If admin created the team, update the ownerId
    if (input.teamName) {
      await Team.findByIdAndUpdate(teamId, { ownerId: user._id });
    }

    const accessToken = generateAccessToken(user);

    return {
      accessToken,
      refreshTokenValue: rawToken,
      user: formatUser(user),
    };
  }

  static async login(input: LoginInput) {
    const user = await User.findOne({ email: input.email }).select("+passwordHash");

    const isMatch = await bcrypt.compare(
      input.password,
      user ? user.passwordHash : DUMMY_HASH,
    );

    if (!user || !isMatch) {
      throw new ApiError(401, "UNAUTHENTICATED", "Invalid email or password");
    }

    const { rawToken, hash } = await createRefreshToken(user._id);
    user.refreshTokenHash = hash;
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);

    return {
      accessToken,
      refreshTokenValue: rawToken,
      user: formatUser(user),
    };
  }

  static async demoLogin(persona: DemoPersona = "maya") {
    if (!isDemoLoginEnabled()) {
      throw new ApiError(404, "NOT_FOUND", "Demo accounts are not available on this server");
    }

    const personaConfig = DEMO_PERSONAS[persona];
    if (!personaConfig) {
      throw new ApiError(400, "VALIDATION_ERROR", "Invalid demo persona");
    }

    const user = await User.findOne({ email: personaConfig.email });
    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "Demo data is not seeded");
    }

    const { rawToken, hash } = await createRefreshToken(user._id);
    user.refreshTokenHash = hash;
    user.lastLoginAt = new Date();
    await user.save();

    const accessToken = generateAccessToken(user);

    return {
      accessToken,
      refreshTokenValue: rawToken,
      user: formatUser(user),
    };
  }

  static async refresh(rawCookie: string | undefined) {
    if (!rawCookie) {
      throw new ApiError(401, "UNAUTHENTICATED", "Refresh token required");
    }

    const dotIndex = rawCookie.indexOf(".");
    if (dotIndex === -1) {
      throw new ApiError(401, "UNAUTHENTICATED", "Invalid refresh token format");
    }

    const userId = rawCookie.slice(0, dotIndex);
    const secretPart = rawCookie.slice(dotIndex + 1);

    if (!mongoose.Types.ObjectId.isValid(userId) || !secretPart) {
      throw new ApiError(401, "UNAUTHENTICATED", "Invalid refresh token format");
    }

    const user = await User.findById(userId).select("+refreshTokenHash");
    if (!user || !user.refreshTokenHash) {
      throw new ApiError(401, "UNAUTHENTICATED", "Session expired or invalid");
    }

    const isMatch = await bcrypt.compare(secretPart, user.refreshTokenHash);
    if (!isMatch) {
      // Reused old token: revoke all tokens for this user as required
      user.refreshTokenHash = undefined;
      await user.save();
      throw new ApiError(401, "UNAUTHENTICATED", "Reused or invalid refresh token");
    }

    // Rotate refresh token
    const { rawToken: newRawToken, hash: newHash } = await createRefreshToken(user._id);
    user.refreshTokenHash = newHash;
    await user.save();

    const accessToken = generateAccessToken(user);

    return {
      accessToken,
      refreshTokenValue: newRawToken,
    };
  }

  static async logout(rawCookie: string | undefined, userId?: string) {
    if (rawCookie) {
      const dotIndex = rawCookie.indexOf(".");
      if (dotIndex !== -1) {
        const cookieUserId = rawCookie.slice(0, dotIndex);
        if (mongoose.Types.ObjectId.isValid(cookieUserId)) {
          await User.findByIdAndUpdate(cookieUserId, { $unset: { refreshTokenHash: 1 } });
          return;
        }
      }
    }

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      await User.findByIdAndUpdate(userId, { $unset: { refreshTokenHash: 1 } });
    }
  }

  static async getMe(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(401, "UNAUTHENTICATED", "User not found");
    }
    return formatUser(user);
  }

  static async updateMe(userId: string, input: UpdateUserInput) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "User not found");
    }

    if (input.name !== undefined) {
      user.name = input.name;
    }
    if (input.avatarUrl !== undefined) {
      user.avatarUrl = input.avatarUrl;
    }

    await user.save();
    return formatUser(user);
  }
}

