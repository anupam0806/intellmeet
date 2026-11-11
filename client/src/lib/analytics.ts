import { z } from "zod";
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

export const weeklyMeetingCountSchema = z.object({
  weekStart: z.string(),
  count: z.number().default(0),
});

export const taskStatusCountSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  count: z.number().default(0),
});

export const memberParticipationSchema = z.object({
  userId: z.string(),
  name: z.string(),
  meetingsAttended: z.number().default(0),
});

export const analyticsTotalsSchema = z.object({
  meetings: z.number().default(0),
  endedMeetings: z.number().default(0),
  avgDurationMinutes: z.number().default(0),
  openTasks: z.number().default(0),
  doneTasks: z.number().default(0),
});

export const analyticsRangeSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export const analyticsOverviewSchema = z.object({
  range: analyticsRangeSchema,
  totals: analyticsTotalsSchema,
  meetingsPerWeek: z.array(weeklyMeetingCountSchema).default([]),
  tasksByStatus: z.array(taskStatusCountSchema).default([]),
  participation: z.array(memberParticipationSchema).default([]),
  actionItemConversionRate: z.number().default(0),
});

export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;

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
  const raw = await apiFetch<unknown>(`/api/v1/analytics/overview${qs ? `?${qs}` : ""}`);
  return analyticsOverviewSchema.parse(raw);
}
