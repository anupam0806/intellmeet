import { Team } from "../models/Team.js";
import { User, UserRole } from "../models/User.js";
import { ApiError } from "../middleware/errorHandler.js";
import { formatUser, generateUniqueInviteCode } from "./auth.service.js";

export class TeamService {
  static async getTeam(teamId: string, callerRole: UserRole) {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new ApiError(404, "NOT_FOUND", "Team not found");
    }

    const members = await User.find({ teamId }).sort({ createdAt: 1 });
    const formattedMembers = members.map((member) => ({
      id: member._id.toString(),
      name: member.name,
      email: member.email,
      role: member.role,
    }));

    if (callerRole === "ADMIN") {
      return {
        id: team._id.toString(),
        name: team.name,
        inviteCode: team.inviteCode,
        members: formattedMembers,
      };
    }

    return {
      id: team._id.toString(),
      name: team.name,
      members: formattedMembers,
    };
  }

  static async updateMemberRole(teamId: string, targetUserId: string, newRole: UserRole) {
    const member = await User.findOne({ _id: targetUserId, teamId });
    if (!member) {
      throw new ApiError(404, "NOT_FOUND", "Member not found");
    }

    if (member.role === "ADMIN" && newRole === "MEMBER") {
      const adminCount = await User.countDocuments({ teamId, role: "ADMIN" });
      if (adminCount <= 1) {
        throw new ApiError(409, "LAST_ADMIN", "Cannot demote the last administrator of a team");
      }
    }

    member.role = newRole;
    await member.save();

    return formatUser(member);
  }

  static async regenerateInviteCode(teamId: string) {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new ApiError(404, "NOT_FOUND", "Team not found");
    }

    const newCode = await generateUniqueInviteCode();
    team.inviteCode = newCode;
    await team.save();

    return { inviteCode: newCode };
  }
}

