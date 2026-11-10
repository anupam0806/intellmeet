import { apiFetch } from "./api.js";

export interface AnalyticsRange {
  from: string;
  to: string;
}

export interface AnalyticsTotals {
  meetings: number;
  endedMeetings: number;
  avgDurationMinutes: number;
  openTasks: number;
  doneTasks: number;
}

export interface WeeklyMeetingCount {
  weekStart: string;
  count: number;
}

export interface TaskStatusCount {
  status: "TODO" | "IN_PROGRESS" | "DONE";
  count: number;
}

export interface MemberParticipation {
  userId: string;
  name: string;
  meetingsAttended: number;
}

export interface AnalyticsOverview {
  range: AnalyticsRange;
  totals: AnalyticsTotals;
  meetingsPerWeek: WeeklyMeetingCount[];
  tasksByStatus: TaskStatusCount[];
  participation: MemberParticipation[];
  actionItemConversionRate: number;
}

export interface AnalyticsQueryInput {
  from?: string;
  to?: string;
}

export async function fetchAnalyticsOverview(
  query?: AnalyticsQueryInput,
): Promise<AnalyticsOverview> {
  const searchParams = new URLSearchParams();
  if (query?.from) searchParams.set("from", query.from);
  if (query?.to) searchParams.set("to", query.to);
  const qs = searchParams.toString();
  return apiFetch<AnalyticsOverview>(`/analytics/overview${qs ? `?${qs}` : ""}`);
}
