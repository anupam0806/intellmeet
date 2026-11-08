import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITranscriptSegment extends Document {
  meetingId: Types.ObjectId;
  teamId: Types.ObjectId;
  speakerId?: Types.ObjectId;
  speakerName: string;
  text: string;
  ts: Date;
  createdAt: Date;
  updatedAt: Date;
}

const transcriptSegmentSchema = new Schema<ITranscriptSegment>(
  {
    meetingId: {
      type: Schema.Types.ObjectId,
      ref: "Meeting",
      required: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    speakerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    speakerName: {
      type: String,
      required: true,
      trim: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 1000,
    },
    ts: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "transcriptsegments",
  },
);

// Indexes per docs/03
transcriptSegmentSchema.index({ meetingId: 1, ts: 1 });
transcriptSegmentSchema.index({ teamId: 1 });

export const TranscriptSegment = mongoose.model<ITranscriptSegment>(
  "TranscriptSegment",
  transcriptSegmentSchema,
);

