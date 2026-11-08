import mongoose from "mongoose";
import { z } from "zod";
import type { Server as SocketIOServer } from "socket.io";
import { Meeting } from "../../models/Meeting.js";
import { TranscriptSegment } from "../../models/TranscriptSegment.js";
import { ChatMessage } from "../../models/ChatMessage.js";
import { User, type IUser } from "../../models/User.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import type { AiProvider } from "./provider.js";
import { OpenAiCompatibleProvider } from "./openaiCompatible.js";
import { MockAiProvider } from "./mock.js";
import { buildSystemPrompt, buildUserPrompt, type TimelineItem } from "./prompts.js";

// Active generations lock set to guard against concurrent runs
const activeGenerations = new Set<string>();

export function isAiGenerationActive(meetingId: string): boolean {
  return activeGenerations.has(meetingId);
}

export function getAiProvider(): AiProvider {
  if (env.AI_PROVIDER === "openai") {
    return new OpenAiCompatibleProvider();
  }
  return new MockAiProvider();
}

// Zod schema for provider JSON validation
const actionItemOutputSchema = z
  .object({
    title: z.string().min(2).max(200),
    assigneeName: z
      .string()
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() ? val.trim() : null)),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional()
      .transform((val) => (val && val.trim() ? val.trim() : null)),
  })
  .strict();

export const aiOutputSchema = z
  .object({
    summary: z
      .string()
      .trim()
      .refine((s) => {
        const words = s.split(/\s+/).filter(Boolean);
        return words.length > 0 && words.length <= 200;
      }, "Summary must be between 1 and 200 words"),
    keyPoints: z.array(z.string()),
    decisions: z.array(z.string()),
    actionItems: z.array(actionItemOutputSchema),
  })
  .strict();

export type AiOutput = z.infer<typeof aiOutputSchema>;

export function cleanJsonFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "");
    cleaned = cleaned.replace(/\n?```\s*$/i, "");
  }
  return cleaned.trim();
}

export function matchAssignee(
  assigneeName: string | null,
  teamMembers: IUser[],
): { assigneeId?: mongoose.Types.ObjectId; resolvedName?: string } {
  if (!assigneeName || !assigneeName.trim()) {
    return {};
  }

  const queryName = assigneeName.trim().toLowerCase();

  // 1. Try exact full name match (case-insensitive)
  const exactMatches = teamMembers.filter(
    (m) => m.name.trim().toLowerCase() === queryName,
  );
  if (exactMatches.length === 1 && exactMatches[0]) {
    return {
      assigneeId: exactMatches[0]._id,
      resolvedName: exactMatches[0].name,
    };
  }

  // 2. Try unique first name match (case-insensitive)
  const firstNameMatches = teamMembers.filter((m) => {
    const firstName = m.name.trim().split(/\s+/)[0]?.toLowerCase();
    return firstName === queryName;
  });

  if (firstNameMatches.length === 1 && firstNameMatches[0]) {
    return {
      assigneeId: firstNameMatches[0]._id,
      resolvedName: firstNameMatches[0].name,
    };
  }

  // Ambiguous first name or no match -> leave assigneeId unset, keep name as text
  return {
    resolvedName: assigneeName.trim(),
  };
}

export async function generateMeetingIntelligence(
  meetingId: string,
  customProvider?: AiProvider,
  io?: SocketIOServer,
): Promise<void> {
  // Prevent duplicate concurrent execution for the same meeting
  if (activeGenerations.has(meetingId)) {
    logger.warn({ meetingId }, "AI generation already in progress for meeting");
    return;
  }

  activeGenerations.add(meetingId);

  try {
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      logger.error({ meetingId }, "Meeting not found for AI generation");
      return;
    }

    // Must be in ENDED status
    if (meeting.status !== "ENDED") {
      logger.warn({ meetingId, status: meeting.status }, "Cannot generate AI for non-ended meeting");
      return;
    }

    // Set status to PENDING atomically
    meeting.ai.status = "PENDING";
    await meeting.save();

    // 1. Load team-scoped transcript segments and chat messages
    const [segments, chatMessages, teamMembers] = await Promise.all([
      TranscriptSegment.find({ meetingId: meeting._id, teamId: meeting.teamId }).sort({ ts: 1 }),
      ChatMessage.find({ meetingId: meeting._id, teamId: meeting.teamId }).sort({ createdAt: 1 }),
      User.find({ teamId: meeting.teamId }),
    ]);

    // 2. Minimum content check
    // "If there are fewer than 5 transcript segments or fewer than 40 words in total, set status INSUFFICIENT and do NOT call the provider."
    let totalTranscriptWords = 0;
    for (const seg of segments) {
      if (seg.text) {
        totalTranscriptWords += seg.text.trim().split(/\s+/).filter(Boolean).length;
      }
    }

    if (segments.length < 5 || totalTranscriptWords < 40) {
      meeting.ai.status = "INSUFFICIENT";
      meeting.ai.summary = undefined;
      meeting.ai.keyPoints = [];
      meeting.ai.decisions = [];
      meeting.ai.actionItems = [];
      meeting.ai.generatedAt = new Date();
      meeting.ai.error = undefined;
      await meeting.save();

      emitAiReady(meeting.teamId.toString(), meeting._id.toString(), "INSUFFICIENT", io);
      return;
    }

    // 3. Prepare timeline for prompt
    const timelineItems: TimelineItem[] = [];

    for (const seg of segments) {
      timelineItems.push({
        timestamp: new Date(seg.ts),
        speaker: seg.speakerName,
        text: seg.text,
        isChat: false,
      });
    }

    for (const chat of chatMessages) {
      timelineItems.push({
        timestamp: new Date(chat.createdAt),
        speaker: chat.senderName,
        text: chat.text,
        isChat: true,
      });
    }

    // Sort timeline chronologically
    timelineItems.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const provider = customProvider ?? getAiProvider();
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(meeting.title, timelineItems, env.AI_MAX_INPUT_CHARS);

    let parsedResult: AiOutput | null = null;
    let attemptsCount = 0;

    // Retry once on parse/validation failure (max 2 attempts)
    for (let attempt = 1; attempt <= 2; attempt++) {
      attemptsCount++;
      try {
        const rawResponse = await provider.generate({
          system: systemPrompt,
          user: userPrompt,
        });

        const cleanedJson = cleanJsonFences(rawResponse);
        const parsedUnknown = JSON.parse(cleanedJson) as unknown;
        const validation = aiOutputSchema.safeParse(parsedUnknown);

        if (validation.success) {
          parsedResult = validation.data;
          break;
        }
      } catch {
        // Parse error or validation failure, proceed to retry if attempt < 2
      }
    }

    // Handle failure after retries
    if (!parsedResult) {
      meeting.ai.status = "FAILED";
      meeting.ai.attempts = attemptsCount;
      meeting.ai.error = "Failed to parse or validate meeting intelligence.";
      await meeting.save();

      emitAiReady(meeting.teamId.toString(), meeting._id.toString(), "FAILED", io);
      return;
    }

    // 4. Map action items and match assignees
    const actionItemsWithIds = parsedResult.actionItems.map((item) => {
      const match = matchAssignee(item.assigneeName, teamMembers);
      return {
        _id: new mongoose.Types.ObjectId(),
        title: item.title,
        assigneeName: match.resolvedName || item.assigneeName || undefined,
        assigneeId: match.assigneeId,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
      };
    });

    // 5. Save results
    meeting.ai.status = "READY";
    meeting.ai.summary = parsedResult.summary;
    meeting.ai.keyPoints = parsedResult.keyPoints;
    meeting.ai.decisions = parsedResult.decisions;
    meeting.ai.actionItems = actionItemsWithIds as unknown as typeof meeting.ai.actionItems;
    meeting.ai.provider = provider.name;
    meeting.ai.model = provider.model;
    meeting.ai.generatedAt = new Date();
    meeting.ai.attempts = attemptsCount;
    meeting.ai.error = undefined;

    await meeting.save();

    emitAiReady(meeting.teamId.toString(), meeting._id.toString(), "READY", io);
  } catch {
    logger.error({ meetingId }, "Unexpected error in generateMeetingIntelligence");
    try {
      const meeting = await Meeting.findById(meetingId);
      if (meeting) {
        meeting.ai.status = "FAILED";
        meeting.ai.error = "An error occurred during AI intelligence generation.";
        await meeting.save();
        emitAiReady(meeting.teamId.toString(), meeting._id.toString(), "FAILED", io);
      }
    } catch {
      // Ignore fallback save error
    }
  } finally {
    activeGenerations.delete(meetingId);
  }
}

function emitAiReady(teamId: string, meetingId: string, status: string, io?: SocketIOServer): void {
  if (io) {
    io.to(`team:${teamId}`).emit("meeting:ai-ready", { meetingId, status });
  }
}

export async function recoverPendingAiGenerations(
  customProvider?: AiProvider,
  io?: SocketIOServer,
): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 1000); // More than 1 minute old
  const pendingMeetings = await Meeting.find({
    status: "ENDED",
    "ai.status": "PENDING",
    endedAt: { $lte: cutoff },
  }).sort({ endedAt: 1 });

  for (const m of pendingMeetings) {
    await generateMeetingIntelligence(m._id.toString(), customProvider, io);
  }
}
