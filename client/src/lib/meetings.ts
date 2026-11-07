import { apiFetch } from "./api.js";

export interface MeetingSummary {
  id: string;
  title: string;
  hostId: string;
  hostName: string;
  colorIndex: number;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  participantCount: number;
  aiStatus: "NONE" | "PENDING" | "READY" | "INSUFFICIENT" | "FAILED";
  actionItemCount: number;
}

export interface MeetingParticipant {
  userId: string;
  name: string;
  joinedAt: string;
  leftAt?: string;
  captionsOn: boolean;
}

export interface MeetingActionItem {
  id: string;
  title: string;
  assigneeName?: string;
  assigneeId?: string;
  dueDate?: string;
  taskId?: string;
}

export interface MeetingAi {
  status: "NONE" | "PENDING" | "READY" | "INSUFFICIENT" | "FAILED";
  summary?: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  provider?: string;
  model?: string;
  generatedAt?: string;
  error?: string;
}

export interface Meeting {
  id: string;
  teamId: string;
  title: string;
  description?: string;
  hostId: string;
  hostName: string;
  roomCode: string;
  colorIndex: number;
  status: "SCHEDULED" | "LIVE" | "ENDED";
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  participants: MeetingParticipant[];
  ai: MeetingAi;
  createdAt: string;
}

export interface PaginatedMeetings {
  items: MeetingSummary[];
  page: number;
  limit: number;
  total: number;
}

export interface MeetingQueryParams {
  q?: string;
  status?: "SCHEDULED" | "LIVE" | "ENDED" | "ALL" | "";
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const MEETING_COLORS = [
  "var(--meeting-0)",
  "var(--meeting-1)",
  "var(--meeting-2)",
  "var(--meeting-3)",
  "var(--meeting-4)",
  "var(--meeting-5)",
] as const;

export function getMeetingColor(colorIndex: number): string {
  const safeIndex = Math.abs(colorIndex) % 6;
  return MEETING_COLORS[safeIndex] || MEETING_COLORS[0];
}

export function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (minutes < 60) {
    return remainingSecs > 0 ? `${minutes}m ${remainingSecs}s` : `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

export async function fetchMeetings(params: MeetingQueryParams = {}): Promise<PaginatedMeetings> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status && params.status !== "ALL") query.set("status", params.status);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());

  const qs = query.toString();
  return apiFetch<PaginatedMeetings>(`/api/v1/meetings${qs ? `?${qs}` : ""}`);
}

export async function fetchMeeting(id: string): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/v1/meetings/${id}`);
}

export async function createMeeting(data: {
  title: string;
  description?: string;
  scheduledAt?: string;
}): Promise<Meeting> {
  return apiFetch<Meeting>("/api/v1/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function updateMeeting(
  id: string,
  data: {
    title?: string;
    description?: string;
    scheduledAt?: string;
  },
): Promise<Meeting> {
  return apiFetch<Meeting>(`/api/v1/meetings/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteMeeting(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/meetings/${id}`, {
    method: "DELETE",
  });
}

export async function joinMeetingByCode(roomCode: string): Promise<{ meeting: Meeting }> {
  return apiFetch<{ meeting: Meeting }>("/api/v1/meetings/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode }),
  });
}

export async function startMeeting(id: string): Promise<{ meeting: Meeting }> {
  return apiFetch<{ meeting: Meeting }>(`/api/v1/meetings/${id}/start`, {
    method: "POST",
  });
}

export async function endMeeting(id: string): Promise<{ meeting: Meeting }> {
  return apiFetch<{ meeting: Meeting }>(`/api/v1/meetings/${id}/end`, {
    method: "POST",
  });
}

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export async function getMeetingChat(meetingId: string): Promise<{ items: ChatMessageItem[] }> {
  return apiFetch<{ items: ChatMessageItem[] }>(`/api/v1/meetings/${meetingId}/chat`);
}

export interface RtcConfig {
  iceServers: RTCIceServer[];
  maxParticipants: number;
}

export async function getRtcConfig(): Promise<RtcConfig> {
  return apiFetch<RtcConfig>("/api/v1/rtc/config");
}


