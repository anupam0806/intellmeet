import mongoose, { Schema, Document } from "mongoose";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface ITask extends Document {
  teamId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  status: TaskStatus;
  order: number;
  assigneeId?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  dueDate?: Date;
  sourceMeetingId?: mongoose.Types.ObjectId;
  sourceActionItemId?: mongoose.Types.ObjectId;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    title: { type: String, required: true, minlength: 2, maxlength: 200, trim: true },
    description: { type: String, maxlength: 2000, trim: true },
    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "DONE"],
      default: "TODO",
      required: true,
    },
    order: { type: Number, required: true, default: 0 },
    assigneeId: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: { type: Date },
    sourceMeetingId: { type: Schema.Types.ObjectId, ref: "Meeting" },
    sourceActionItemId: { type: Schema.Types.ObjectId },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

// Indexes matching docs/03-Database-Schema.md
taskSchema.index({ teamId: 1, status: 1, order: 1 });
taskSchema.index({ teamId: 1, assigneeId: 1 });
taskSchema.index({ sourceMeetingId: 1 });

export const Task = mongoose.model<ITask>("Task", taskSchema);
