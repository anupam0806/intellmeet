import mongoose, { Schema, Document, Types } from "mongoose";

export type MeetingStatus = "SCHEDULED" | "LIVE" | "ENDED";
export type AiStatus = "NONE" | "PENDING" | "READY" | "INSUFFICIENT" | "FAILED";

export interface IParticipant {
  userId: Types.ObjectId;
  name: string;
  joinedAt: Date;
  leftAt?: Date;
  captionsOn: boolean;
}

export interface IActionItem {
  _id: Types.ObjectId;
  title: string;
  assigneeName?: string;
  assigneeId?: Types.ObjectId;
  dueDate?: Date;
  taskId?: Types.ObjectId;
}

export interface IAiMetadata {
  status: AiStatus;
  summary?: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: IActionItem[];
  provider?: string;
  model?: string;
  generatedAt?: Date;
  attempts: number;
  error?: string;
}

export interface IMeeting extends Document {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  title: string;
  description?: string;
  hostId: Types.ObjectId;
  roomCode: string;
  colorIndex: number;
  status: MeetingStatus;
  scheduledAt?: Date;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  participants: IParticipant[];
  ai: IAiMetadata;
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema<IParticipant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    joinedAt: { type: Date, required: true, default: Date.now },
    leftAt: { type: Date },
    captionsOn: { type: Boolean, required: true, default: false },
  },
  { _id: false },
);

const actionItemSchema = new Schema<IActionItem>({
  title: { type: String, required: true },
  assigneeName: { type: String },
  assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
  dueDate: { type: Date },
  taskId: { type: Schema.Types.ObjectId, ref: "Task" },
});

const aiMetadataSchema = new Schema<IAiMetadata>(
  {
    status: {
      type: String,
      enum: ["NONE", "PENDING", "READY", "INSUFFICIENT", "FAILED"],
      required: true,
      default: "NONE",
    },
    summary: { type: String },
    keyPoints: { type: [String], default: [] },
    decisions: { type: [String], default: [] },
    actionItems: { type: [actionItemSchema], default: [] },
    provider: { type: String },
    model: { type: String },
    generatedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    error: { type: String },
  },
  { _id: false },
);

const meetingSchema = new Schema<IMeeting>(
  {
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    hostId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    roomCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    colorIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 5,
    },
    status: {
      type: String,
      enum: ["SCHEDULED", "LIVE", "ENDED"],
      required: true,
      default: "SCHEDULED",
    },
    scheduledAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    ai: {
      type: aiMetadataSchema,
      default: () => ({
        status: "NONE",
        keyPoints: [],
        decisions: [],
        actionItems: [],
        attempts: 0,
      }),
    },
  },
  {
    timestamps: true,
  },
);

// Indexes per docs/03
meetingSchema.index({ teamId: 1, createdAt: -1 });
meetingSchema.index({ teamId: 1, status: 1 });
meetingSchema.index({ "ai.status": 1, endedAt: 1 });
meetingSchema.index({
  title: "text",
  description: "text",
  "ai.summary": "text",
});

export const Meeting = mongoose.model<IMeeting>("Meeting", meetingSchema);

