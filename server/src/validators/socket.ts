import { z } from "zod";

export const socketRoomJoinSchema = z
  .object({
    meetingId: z
      .string({ required_error: "Meeting ID is required" })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid meeting ID format"),
  })
  .strict();

export type SocketRoomJoinInput = z.infer<typeof socketRoomJoinSchema>;

export const socketRoomLeaveSchema = z
  .object({
    meetingId: z
      .string({ required_error: "Meeting ID is required" })
      .regex(/^[0-9a-fA-F]{24}$/, "Invalid meeting ID format"),
  })
  .strict();

export type SocketRoomLeaveInput = z.infer<typeof socketRoomLeaveSchema>;

export const socketSignalOfferSchema = z
  .object({
    to: z.string({ required_error: "Recipient socket ID is required" }).min(1),
    sdp: z.unknown(),
  })
  .strict();

export type SocketSignalOfferInput = z.infer<typeof socketSignalOfferSchema>;

export const socketSignalAnswerSchema = z
  .object({
    to: z.string({ required_error: "Recipient socket ID is required" }).min(1),
    sdp: z.unknown(),
  })
  .strict();

export type SocketSignalAnswerInput = z.infer<typeof socketSignalAnswerSchema>;

export const socketSignalIceSchema = z
  .object({
    to: z.string({ required_error: "Recipient socket ID is required" }).min(1),
    candidate: z.unknown(),
  })
  .strict();

export type SocketSignalIceInput = z.infer<typeof socketSignalIceSchema>;

export const socketMediaStateSchema = z
  .object({
    audio: z.boolean(),
    video: z.boolean(),
    screen: z.boolean(),
    captions: z.boolean(),
  })
  .strict();

export type SocketMediaStateInput = z.infer<typeof socketMediaStateSchema>;

export const socketChatSendSchema = z
  .object({
    text: z
      .string({ required_error: "Text is required" })
      .trim()
      .min(1, "Text must be at least 1 character")
      .max(2000, "Text cannot exceed 2000 characters"),
  })
  .strict();

export type SocketChatSendInput = z.infer<typeof socketChatSendSchema>;

export const socketChatTypingSchema = z
  .object({
    isTyping: z.boolean(),
  })
  .strict();

export type SocketChatTypingInput = z.infer<typeof socketChatTypingSchema>;

