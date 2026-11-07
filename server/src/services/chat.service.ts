import mongoose from "mongoose";
import { ChatMessage } from "../models/ChatMessage.js";
import { Meeting } from "../models/Meeting.js";
import { ApiError } from "../middleware/errorHandler.js";

export interface ChatMessageItem {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export class ChatService {
  static async createMessage(input: {
    meetingId: string;
    teamId: string;
    senderId: string;
    senderName: string;
    text: string;
  }): Promise<ChatMessageItem> {
    const doc = await ChatMessage.create({
      meetingId: new mongoose.Types.ObjectId(input.meetingId),
      teamId: new mongoose.Types.ObjectId(input.teamId),
      senderId: new mongoose.Types.ObjectId(input.senderId),
      senderName: input.senderName,
      text: input.text,
    });

    return {
      id: doc._id.toString(),
      senderId: doc.senderId.toString(),
      senderName: doc.senderName,
      text: doc.text,
      createdAt: doc.createdAt.toISOString(),
    };
  }

  static async getMeetingChat(meetingId: string, teamId: string): Promise<{ items: ChatMessageItem[] }> {
    // Verify meeting belongs to team
    const meeting = await Meeting.findOne({
      _id: new mongoose.Types.ObjectId(meetingId),
      teamId: new mongoose.Types.ObjectId(teamId),
    });

    if (!meeting) {
      throw new ApiError(404, "NOT_FOUND", "Meeting not found");
    }

    const messages = await ChatMessage.find({
      meetingId: new mongoose.Types.ObjectId(meetingId),
      teamId: new mongoose.Types.ObjectId(teamId),
    }).sort({ createdAt: 1 });

    const items: ChatMessageItem[] = messages.map((m) => ({
      id: m._id.toString(),
      senderId: m.senderId.toString(),
      senderName: m.senderName,
      text: m.text,
      createdAt: m.createdAt.toISOString(),
    }));

    return { items };
  }

  static async deleteMeetingChat(meetingId: string): Promise<void> {
    await ChatMessage.deleteMany({
      meetingId: new mongoose.Types.ObjectId(meetingId),
    });
  }
}

