import { z } from "zod";

export const socketTranscriptSegmentSchema = z
  .object({
    text: z.string().trim().min(1).max(1000),
    ts: z.number(),
    speakerId: z.string().optional(),
    speakerName: z.string().optional(),
  })
  .strict();

export type SocketTranscriptSegmentInput = z.infer<typeof socketTranscriptSegmentSchema>;

export const getTranscriptQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(2000).default(500),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type GetTranscriptQuery = z.infer<typeof getTranscriptQuerySchema>;

export const postTranscriptBodySchema = z
  .object({
    text: z.string().min(1).max(50000),
  })
  .strict();

export type PostTranscriptBody = z.infer<typeof postTranscriptBodySchema>;

