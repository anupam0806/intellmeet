import type { Server as SocketIOServer } from "socket.io";
import { Notification, type NotificationType, type INotification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { ApiError } from "../middleware/errorHandler.js";

export interface FormattedNotification {
  id: string;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export class NotificationService {
  static async listNotifications(
    userId: string,
    teamId: string,
  ): Promise<{ items: FormattedNotification[]; unreadCount: number }> {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId, teamId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ userId, teamId, read: false }),
    ]);

    const items: FormattedNotification[] = notifications.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      message: n.message,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));

    return { items, unreadCount };
  }

  static async markRead(
    notificationId: string,
    userId: string,
    teamId: string,
  ): Promise<void> {
    const notification = await Notification.findOne({
      _id: notificationId,
      userId,
      teamId,
    });

    if (!notification) {
      throw new ApiError(404, "NOT_FOUND", "Notification not found");
    }

    notification.read = true;
    await notification.save();
  }

  static async markAllRead(userId: string, teamId: string): Promise<void> {
    await Notification.updateMany({ userId, teamId, read: false }, { $set: { read: true } });
  }

  static notifyTaskAssigned = notifyTaskAssigned;
  static notifyMeetingSummaryReady = notifyMeetingSummaryReady;
}

/**
 * Creates a TASK_ASSIGNED notification for the assignee unless the assignee is the actor
 * or does not belong to the team. Emits notification:new to user:<assigneeId>.
 */
export async function notifyTaskAssigned(
  task: { id?: string; title: string; teamId?: unknown },
  assigneeId: string,
  actorId?: string,
  io?: SocketIOServer,
): Promise<INotification | null> {
  if (!assigneeId || assigneeId === actorId) {
    return null;
  }

  const taskTeamId = task.teamId ? task.teamId.toString() : undefined;
  if (!taskTeamId) {
    return null;
  }

  // Ensure assignee belongs to the same team
  const assignee = await User.findOne({ _id: assigneeId, teamId: taskTeamId }).select("teamId");
  if (!assignee) {
    return null;
  }

  // Fetch actor name
  let actorName = "A teammate";
  if (actorId) {
    const actor = await User.findById(actorId).select("name").lean();
    if (actor?.name) {
      actorName = actor.name;
    }
  }

  const link = task.id ? `/tasks?highlight=${task.id}` : "/tasks";

  const notification = await Notification.create({
    userId: assignee._id,
    teamId: assignee.teamId,
    type: "TASK_ASSIGNED",
    message: `${actorName} assigned you "${task.title}"`,
    link,
    read: false,
  });

  const formatted: FormattedNotification = {
    id: notification._id.toString(),
    type: notification.type,
    message: notification.message,
    link: notification.link,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };

  if (io) {
    io.to(`user:${assignee._id.toString()}`).emit("notification:new", formatted);
  }

  return notification;
}

/**
 * Creates a MEETING_SUMMARY_READY notification for the meeting host once only.
 * Emits notification:new to user:<hostId>.
 */
export async function notifyMeetingSummaryReady(
  meetingId: string,
  meetingTitle: string,
  hostId: string,
  teamId: string,
  io?: SocketIOServer,
): Promise<INotification | null> {
  const link = `/meetings/${meetingId}`;

  // Idempotency: verify notification does not already exist for this meeting and host
  const existing = await Notification.findOne({
    userId: hostId,
    teamId,
    type: "MEETING_SUMMARY_READY",
    link,
  });

  if (existing) {
    return existing;
  }

  const notification = await Notification.create({
    userId: hostId,
    teamId,
    type: "MEETING_SUMMARY_READY",
    message: `Summary ready for "${meetingTitle}"`,
    link,
    read: false,
  });

  const formatted: FormattedNotification = {
    id: notification._id.toString(),
    type: notification.type,
    message: notification.message,
    link: notification.link,
    read: notification.read,
    createdAt: notification.createdAt.toISOString(),
  };

  if (io) {
    io.to(`user:${hostId}`).emit("notification:new", formatted);
  }

  return notification;
}
