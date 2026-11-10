import { apiFetch } from "./api.js";

export type NotificationType = "TASK_ASSIGNED" | "MEETING_SUMMARY_READY";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: NotificationItem[];
  unreadCount: number;
}

export async function fetchNotifications(): Promise<NotificationsResponse> {
  return apiFetch<NotificationsResponse>("/notifications");
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await apiFetch<void>(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiFetch<void>("/notifications/read-all", {
    method: "POST",
  });
}
