import { apiFetch } from "./api.js";

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  order: number;
  assigneeId?: string;
  assigneeName?: string;
  createdBy: string;
  dueDate?: string;
  sourceMeetingId?: string;
  sourceMeetingTitle?: string;
  sourceMeetingColorIndex?: number;
  completedAt?: string;
  createdAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
  position?: number;
}

export interface TaskQueryInput {
  status?: TaskStatus;
  assigneeId?: string;
  q?: string;
}

export async function fetchTasks(query?: TaskQueryInput): Promise<{ items: Task[] }> {
  const searchParams = new URLSearchParams();
  if (query?.status) searchParams.set("status", query.status);
  if (query?.assigneeId) searchParams.set("assigneeId", query.assigneeId);
  if (query?.q) searchParams.set("q", query.q);
  const qs = searchParams.toString();
  return apiFetch<{ items: Task[] }>(`/api/v1/tasks${qs ? `?${qs}` : ""}`);
}

export async function createTask(data: CreateTaskInput): Promise<Task> {
  const res = await apiFetch<Task | { task: Task }>("/api/v1/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return "task" in res ? res.task : res;
}

export async function updateTask(id: string, data: UpdateTaskInput): Promise<Task> {
  const res = await apiFetch<Task | { task: Task }>(`/api/v1/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return "task" in res ? res.task : res;
}

export async function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/api/v1/tasks/${id}`, {
    method: "DELETE",
  });
}

/**
 * Pure reorder helper for drag and drop within a column or across columns.
 * Returns a new array of tasks with updated statuses and contiguous orders.
 */
export function reorderTasksPure(
  tasks: Task[],
  activeId: string,
  targetStatus: TaskStatus,
  targetIndex: number,
): Task[] {
  if (!Array.isArray(tasks)) return [];
  const activeTask = tasks.find((t) => t.id === activeId);
  if (!activeTask) return tasks;

  const result: Task[] = tasks.map((t) => ({ ...t }));
  const taskToMove = result.find((t) => t.id === activeId)!;

  const sourceStatus = taskToMove.status;

  if (sourceStatus === targetStatus) {
    const colTasks = result
      .filter((t) => t.status === sourceStatus)
      .sort((a, b) => a.order - b.order);

    const fromIndex = colTasks.findIndex((t) => t.id === activeId);
    if (fromIndex === -1) return tasks;

    colTasks.splice(fromIndex, 1);
    const clampedIndex = Math.max(0, Math.min(targetIndex, colTasks.length));
    colTasks.splice(clampedIndex, 0, taskToMove);

    colTasks.forEach((t, idx) => {
      t.order = idx;
    });

    return result.sort((a, b) => a.order - b.order);
  } else {
    const sourceCol = result
      .filter((t) => t.status === sourceStatus && t.id !== activeId)
      .sort((a, b) => a.order - b.order);

    sourceCol.forEach((t, idx) => {
      t.order = idx;
    });

    const targetCol = result
      .filter((t) => t.status === targetStatus && t.id !== activeId)
      .sort((a, b) => a.order - b.order);

    taskToMove.status = targetStatus;
    if (targetStatus === "DONE") {
      taskToMove.completedAt = new Date().toISOString();
    } else {
      taskToMove.completedAt = undefined;
    }

    const clampedIndex = Math.max(0, Math.min(targetIndex, targetCol.length));
    targetCol.splice(clampedIndex, 0, taskToMove);

    targetCol.forEach((t, idx) => {
      t.order = idx;
    });

    return result.sort((a, b) => a.order - b.order);
  }
}
