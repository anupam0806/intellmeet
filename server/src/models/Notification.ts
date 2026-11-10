import mongoose, { Schema, Document } from "mongoose";

export type NotificationType = "TASK_ASSIGNED" | "MEETING_SUMMARY_READY";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  teamId: mongoose.Types.ObjectId;
  type: NotificationType;
  message: string;
  link: string;
  read: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true },
    type: {
      type: String,
      enum: ["TASK_ASSIGNED", "MEETING_SUMMARY_READY"],
      required: true,
    },
    message: { type: String, required: true, trim: true },
    link: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false, required: true },
  },
  {
    timestamps: true,
  },
);

// Compound index matching docs/03-Database-Schema.md
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
