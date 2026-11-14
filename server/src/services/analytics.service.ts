import mongoose from "mongoose";
import { Meeting } from "../models/Meeting.js";
import { Task } from "../models/Task.js";
import { User } from "../models/User.js";
import type { AnalyticsQueryInput } from "../validators/analytics.js";

export interface AnalyticsOverview {
  range: { from: string; to: string };
  totals: {
    meetings: number;
    endedMeetings: number;
    avgDurationMinutes: number;
    openTasks: number;
    doneTasks: number;
  };
  meetingsPerWeek: Array<{ weekStart: string; count: number; isCurrentWeek?: boolean }>;
  tasksByStatus: Array<{ status: "TODO" | "IN_PROGRESS" | "DONE"; count: number }>;
  participation: Array<{ userId: string; name: string; meetingsAttended: number }>;
  actionItemConversionRate: number;
}

export class AnalyticsService {
  static async getOverview(
    teamId: string,
    query: AnalyticsQueryInput,
  ): Promise<AnalyticsOverview> {
    let fromStr = query.from;
    let toStr = query.to;

    // Default to the last 30 days ending today in UTC
    if (!fromStr || !toStr) {
      const now = new Date();
      toStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      const thirtyDaysAgo = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 29),
      );
      fromStr = `${thirtyDaysAgo.getUTCFullYear()}-${String(thirtyDaysAgo.getUTCMonth() + 1).padStart(2, "0")}-${String(thirtyDaysAgo.getUTCDate()).padStart(2, "0")}`;
    }

    const fromDate = new Date(`${fromStr}T00:00:00.000Z`);
    const toDate = new Date(`${toStr}T23:59:59.999Z`);
    const teamObjectId = new mongoose.Types.ObjectId(teamId);

    // 1. Meeting Totals aggregation
    const meetingTotalsAgg = await Meeting.aggregate([
      { $match: { teamId: teamObjectId } },
      {
        $addFields: {
          effectiveDate: {
            $ifNull: ["$startedAt", { $ifNull: ["$scheduledAt", "$createdAt"] }],
          },
        },
      },
      {
        $match: {
          effectiveDate: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: null,
          meetings: { $sum: 1 },
          endedMeetings: {
            $sum: { $cond: [{ $eq: ["$status", "ENDED"] }, 1, 0] },
          },
          endedDurationSeconds: {
            $sum: {
              $cond: [
                { $eq: ["$status", "ENDED"] },
                { $ifNull: ["$durationSeconds", 0] },
                0,
              ],
            },
          },
        },
      },
    ]);

    const meetingsCount = meetingTotalsAgg[0]?.meetings ?? 0;
    const endedMeetingsCount = meetingTotalsAgg[0]?.endedMeetings ?? 0;
    const avgDurationMinutes =
      endedMeetingsCount > 0
        ? Number(
            (meetingTotalsAgg[0].endedDurationSeconds / endedMeetingsCount / 60).toFixed(1),
          )
        : 0;

    // 2. Task Totals aggregation
    const taskTotalsAgg = await Task.aggregate([
      { $match: { teamId: teamObjectId } },
      {
        $group: {
          _id: null,
          openTasks: {
            $sum: {
              $cond: [{ $in: ["$status", ["TODO", "IN_PROGRESS"]] }, 1, 0],
            },
          },
          doneTasks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "DONE"] },
                    { $gte: ["$completedAt", fromDate] },
                    { $lte: ["$completedAt", toDate] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const openTasks = taskTotalsAgg[0]?.openTasks ?? 0;
    const doneTasks = taskTotalsAgg[0]?.doneTasks ?? 0;

    // 3. Tasks by Status aggregation
    const tasksByStatusAgg = await Task.aggregate([
      { $match: { teamId: teamObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const taskCountMap = new Map(tasksByStatusAgg.map((t) => [t._id, t.count as number]));
    const tasksByStatus: Array<{ status: "TODO" | "IN_PROGRESS" | "DONE"; count: number }> = [
      { status: "TODO", count: taskCountMap.get("TODO") || 0 },
      { status: "IN_PROGRESS", count: taskCountMap.get("IN_PROGRESS") || 0 },
      { status: "DONE", count: taskCountMap.get("DONE") || 0 },
    ];

    // 4. Meetings per Week aggregation (Monday-start UTC weeks overlapping the range)
    const dayOfWeek = fromDate.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startMonday = new Date(
      Date.UTC(
        fromDate.getUTCFullYear(),
        fromDate.getUTCMonth(),
        fromDate.getUTCDate() + diffToMonday,
        0,
        0,
        0,
        0,
      ),
    );

    const toDayOfWeek = toDate.getUTCDay();
    const toDiffToMonday = toDayOfWeek === 0 ? -6 : 1 - toDayOfWeek;
    const endMonday = new Date(
      Date.UTC(
        toDate.getUTCFullYear(),
        toDate.getUTCMonth(),
        toDate.getUTCDate() + toDiffToMonday,
        0,
        0,
        0,
        0,
      ),
    );

    const weekMap = new Map<string, number>();
    const weekStarts: string[] = [];

    let curr = new Date(startMonday);
    while (curr <= endMonday) {
      const weekStr = `${curr.getUTCFullYear()}-${String(curr.getUTCMonth() + 1).padStart(2, "0")}-${String(curr.getUTCDate()).padStart(2, "0")}`;
      weekStarts.push(weekStr);
      weekMap.set(weekStr, 0);
      curr = new Date(
        Date.UTC(curr.getUTCFullYear(), curr.getUTCMonth(), curr.getUTCDate() + 7, 0, 0, 0, 0),
      );
    }

    const meetingsPerWeekAgg = await Meeting.aggregate([
      { $match: { teamId: teamObjectId } },
      {
        $addFields: {
          effectiveDate: {
            $ifNull: ["$startedAt", { $ifNull: ["$scheduledAt", "$createdAt"] }],
          },
        },
      },
      {
        $match: {
          effectiveDate: { $gte: fromDate, $lte: toDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: {
                $dateTrunc: {
                  date: "$effectiveDate",
                  unit: "week",
                  startOfWeek: "monday",
                },
              },
              timezone: "UTC",
            },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    for (const item of meetingsPerWeekAgg) {
      if (item._id && weekMap.has(item._id)) {
        weekMap.set(item._id, item.count);
      }
    }

    const now = new Date();
    const nowDay = now.getUTCDay();
    const nowDiffToMonday = nowDay === 0 ? -6 : 1 - nowDay;
    const currentWeekMonday = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + nowDiffToMonday,
        0,
        0,
        0,
        0,
      ),
    );
    const currentWeekStr = `${currentWeekMonday.getUTCFullYear()}-${String(currentWeekMonday.getUTCMonth() + 1).padStart(2, "0")}-${String(currentWeekMonday.getUTCDate()).padStart(2, "0")}`;

    const meetingsPerWeek = weekStarts.map((weekStart) => ({
      weekStart,
      count: weekMap.get(weekStart) || 0,
      isCurrentWeek: weekStart === currentWeekStr,
    }));

    // 5. Participation aggregation
    const [participationAgg, teamMembers] = await Promise.all([
      Meeting.aggregate([
        { $match: { teamId: teamObjectId } },
        {
          $addFields: {
            effectiveDate: {
              $ifNull: ["$startedAt", { $ifNull: ["$scheduledAt", "$createdAt"] }],
            },
          },
        },
        {
          $match: {
            effectiveDate: { $gte: fromDate, $lte: toDate },
          },
        },
        { $unwind: "$participants" },
        {
          $group: {
            _id: {
              meetingId: "$_id",
              userId: "$participants.userId",
            },
          },
        },
        {
          $group: {
            _id: "$_id.userId",
            meetingsAttended: { $sum: 1 },
          },
        },
      ]),
      User.find({ teamId: teamObjectId }).select("name").lean(),
    ]);

    const attendanceMap = new Map(
      participationAgg.map((p) => [p._id.toString(), p.meetingsAttended as number]),
    );

    const participation = teamMembers.map((member) => ({
      userId: member._id.toString(),
      name: member.name,
      meetingsAttended: attendanceMap.get(member._id.toString()) || 0,
    }));

    participation.sort(
      (a, b) => b.meetingsAttended - a.meetingsAttended || a.name.localeCompare(b.name),
    );

    // 6. Action item conversion rate aggregation
    const conversionAgg = await Meeting.aggregate([
      {
        $match: {
          teamId: teamObjectId,
          status: "ENDED",
          "ai.status": "READY",
        },
      },
      {
        $addFields: {
          effectiveDate: {
            $ifNull: ["$startedAt", { $ifNull: ["$scheduledAt", "$createdAt"] }],
          },
        },
      },
      {
        $match: {
          effectiveDate: { $gte: fromDate, $lte: toDate },
        },
      },
      { $unwind: "$ai.actionItems" },
      {
        $group: {
          _id: null,
          totalItems: { $sum: 1 },
          convertedItems: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$ai.actionItems.taskId", null] },
                    { $gt: [{ $type: "$ai.actionItems.taskId" }, "missing"] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    let actionItemConversionRate = 0;
    if (conversionAgg[0] && conversionAgg[0].totalItems > 0) {
      const rate = conversionAgg[0].convertedItems / conversionAgg[0].totalItems;
      actionItemConversionRate = Number(rate.toFixed(2));
    }

    return {
      range: {
        from: fromStr,
        to: toStr,
      },
      totals: {
        meetings: meetingsCount,
        endedMeetings: endedMeetingsCount,
        avgDurationMinutes,
        openTasks,
        doneTasks,
      },
      meetingsPerWeek,
      tasksByStatus,
      participation,
      actionItemConversionRate,
    };
  }
}
