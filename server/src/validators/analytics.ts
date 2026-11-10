import { z } from "zod";

function isValidCalendarDate(dateStr: string): boolean {
  const parts = dateStr.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y === undefined || m === undefined || d === undefined) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export const analyticsQuerySchema = z
  .object({
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "from must be in YYYY-MM-DD format")
      .refine(isValidCalendarDate, "Invalid calendar date for from")
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "to must be in YYYY-MM-DD format")
      .refine(isValidCalendarDate, "Invalid calendar date for to")
      .optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.from && data.to) {
        return data.from <= data.to;
      }
      return true;
    },
    {
      message: "from date cannot be after to date",
      path: ["from"],
    },
  )
  .refine(
    (data) => {
      if (data.from && data.to) {
        const fromDate = new Date(`${data.from}T00:00:00.000Z`);
        const toDate = new Date(`${data.to}T23:59:59.999Z`);
        const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 366;
      }
      return true;
    },
    {
      message: "Date range cannot exceed 366 days",
      path: ["to"],
    },
  );

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;
