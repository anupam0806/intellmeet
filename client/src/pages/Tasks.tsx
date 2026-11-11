import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Check,
  AlertCircle,
  X,
  Edit2,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { useAuthStore } from "../store/authStore.js";
import { apiFetch } from "../lib/api.js";
import { getSocket } from "../lib/socket.js";
import { getMeetingColor } from "../lib/meetings.js";
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  reorderTasksPure,
  type Task,
  type TaskStatus,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "../lib/tasks.js";

const LANES: Array<{ id: TaskStatus; label: string }> = [
  { id: "TODO", label: "To do" },
  { id: "IN_PROGRESS", label: "In progress" },
  { id: "DONE", label: "Done" },
];

function getInitials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  if (!first) return "?";
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1];
  return ((first[0] || "") + (last?.[0] || "")).toUpperCase();
}

function isOverdue(dueDateStr?: string, status?: TaskStatus): boolean {
  if (!dueDateStr || status === "DONE") return false;
  const due = new Date(dueDateStr);
  const now = new Date();
  // Strip time for clean date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDateOnly = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDateOnly.getTime() < today.getTime();
}

function formatDueDate(dueDateStr: string): string {
  const d = new Date(dueDateStr);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface TaskCardProps {
  task: Task;
  isHighlighted?: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusChange: (task: Task, newStatus: TaskStatus) => void;
}

function TaskCard({
  task,
  isHighlighted,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onStatusChange,
}: TaskCardProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: task.id,
      data: { task },
      disabled: !canEdit,
    });

  const cardStyle: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    opacity: isDragging ? 0.35 : 1,
    borderLeft: `3px solid ${
      task.sourceMeetingColorIndex !== undefined
        ? getMeetingColor(task.sourceMeetingColorIndex)
        : "var(--rule)"
    }`,
    backgroundColor: "var(--surface)",
    borderColor: isHighlighted ? "var(--signal)" : "var(--rule)",
  };

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...attributes}
      {...listeners}
      role="group"
      aria-label={`Task: ${task.title}`}
      className={`relative rounded-lg border p-3.5 space-y-2.5 transition-colors select-none ${
        isHighlighted ? "outline outline-2 outline-[var(--signal)]" : ""
      }`}
    >
      {/* Top row: Title and Status/Action Menu */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold leading-snug" style={{ color: "var(--ink)" }}>
          {task.title}
        </h3>

        {canEdit && (
          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              aria-label="Task options"
              aria-haspopup="true"
              aria-expanded={menuOpen}
              className="p-1 rounded-lg hover:opacity-80 transition-opacity"
              style={{ color: "var(--ink-soft)" }}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 rounded-lg border py-1 z-30 text-xs"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                  boxShadow: "var(--shadow-menu)",
                }}
              >
                {/* Status change options */}
                <div className="px-2 py-1 text-xs font-semibold" style={{ color: "var(--ink-soft)" }}>
                  Move to
                </div>
                {LANES.filter((l) => l.id !== task.status).map((lane) => (
                  <button
                    key={lane.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onStatusChange(task, lane.id);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-between"
                  >
                    <span>{lane.label}</span>
                    <ArrowRight className="w-3 h-3 opacity-60" />
                  </button>
                ))}

                <div className="my-1 border-t" style={{ borderColor: "var(--rule)" }} />

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit(task);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit task</span>
                </button>

                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDelete(task);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-2"
                    style={{ color: "var(--error)" }}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete task</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Description if present */}
      {task.description && (
        <p className="text-2xs line-clamp-2" style={{ color: "var(--ink-soft)" }}>
          {task.description}
        </p>
      )}

      {/* Source meeting link if present */}
      {task.sourceMeetingId && task.sourceMeetingTitle && (
        <div className="text-2xs truncate">
          <Link
            to={`/meetings/${task.sourceMeetingId}`}
            onClick={(e) => e.stopPropagation()}
            className="hover:underline transition-opacity truncate inline-block max-w-full"
            style={{ color: "var(--ink-soft)" }}
            title={task.sourceMeetingTitle}
          >
            {task.sourceMeetingTitle}
          </Link>
        </div>
      )}

      {/* Bottom meta row: Due date and Assignee avatar */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div>
          {task.dueDate ? (
            <span
              className="inline-flex items-center gap-1 text-2xs font-medium"
              style={{ color: overdue ? "var(--error)" : "var(--ink-soft)" }}
            >
              <Calendar className="w-3 h-3" />
              <span>
                {overdue ? "Overdue · " : "Due "}
                {formatDueDate(task.dueDate)}
              </span>
            </span>
          ) : (
            <span />
          )}
        </div>

        <div
          className="w-5 h-5 rounded-full flex items-center justify-center text-2xs font-semibold shrink-0"
          style={{ backgroundColor: "var(--smoke)", color: "var(--ink)" }}
          title={task.assigneeName || "Unassigned"}
        >
          {getInitials(task.assigneeName)}
        </div>
      </div>
    </div>
  );
}

interface LaneDroppableProps {
  laneId: TaskStatus;
  label: string;
  tasks: Task[];
  children: React.ReactNode;
}

function LaneDroppable({ laneId, label, tasks, children }: LaneDroppableProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({
    id: laneId,
    data: { laneId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[480px] p-4 transition-colors ${
        isOver ? "bg-black/[0.02] dark:bg-white/[0.02]" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b" style={{ borderColor: "var(--rule)" }}>
        <h2 className="text-xs font-semibold" style={{ color: "var(--ink)" }}>
          {label}
        </h2>
        <span
          className="px-2 py-0.5 text-2xs font-semibold rounded-[3px]"
          style={{ backgroundColor: "var(--smoke)", color: "var(--ink-soft)" }}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task List */}
      <div className="space-y-2.5 flex-1">{children}</div>
    </div>
  );
}

export function Tasks(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const currentUser = useAuthStore((s) => s.user);

  // Filters state
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterQuery, setFilterQuery] = useState<string>("");

  // Dialogs state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  // Toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage && !toastError) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
      setToastError(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage, toastError]);

  // Fetch team members for assignee filter and picker
  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: () =>
      apiFetch<{
        id: string;
        name: string;
        members: Array<{ id: string; name: string; email: string; role: string }>;
      }>("/api/v1/team"),
  });
  const teamMembers = Array.isArray(teamQuery.data?.members) ? teamQuery.data.members : [];

  // Fetch tasks
  const tasksQuery = useQuery({
    queryKey: ["tasks"],
    queryFn: () => fetchTasks(),
  });

  const allTasks = Array.isArray(tasksQuery.data?.items) ? tasksQuery.data.items : [];

  // Real-time socket event listeners
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    function handleTaskCreated(created: Task) {
      queryClient.setQueryData(["tasks"], (old: { items: Task[] } | undefined) => {
        const items = Array.isArray(old?.items) ? old.items : [];
        if (items.some((t) => t.id === created.id)) return old;
        return { items: [...items, created] };
      });
    }

    function handleTaskUpdated(updated: Task) {
      queryClient.setQueryData(["tasks"], (old: { items: Task[] } | undefined) => {
        const items = Array.isArray(old?.items) ? old.items : [];
        return {
          items: items.map((t) => (t.id === updated.id ? updated : t)),
        };
      });
    }

    function handleTaskDeleted({ id }: { id: string }) {
      queryClient.setQueryData(["tasks"], (old: { items: Task[] } | undefined) => {
        if (!old) return old;
        const items = Array.isArray(old.items) ? old.items : [];
        return {
          items: items.filter((t) => t.id !== id),
        };
      });
    }

    socket.on("task:created", handleTaskCreated);
    socket.on("task:updated", handleTaskUpdated);
    socket.on("task:deleted", handleTaskDeleted);

    return () => {
      socket.off("task:created", handleTaskCreated);
      socket.off("task:updated", handleTaskUpdated);
      socket.off("task:deleted", handleTaskDeleted);
    };
  }, [queryClient]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return allTasks.filter((task) => {
      // Assignee filter
      if (filterAssignee === "me") {
        if (task.assigneeId !== currentUser?.id) return false;
      } else if (filterAssignee === "unassigned") {
        if (task.assigneeId) return false;
      } else if (filterAssignee !== "all") {
        if (task.assigneeId !== filterAssignee) return false;
      }

      // Search query filter
      if (filterQuery.trim()) {
        const q = filterQuery.trim().toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) ?? false;
        if (!matchesTitle && !matchesDesc) return false;
      }

      return true;
    });
  }, [allTasks, filterAssignee, filterQuery, currentUser]);

  // Tasks grouped by lane
  const tasksByLane = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const t of filteredTasks) {
      if (map[t.status]) {
        map[t.status].push(t);
      }
    }
    // Sort within lane by order
    map.TODO.sort((a, b) => a.order - b.order);
    map.IN_PROGRESS.sort((a, b) => a.order - b.order);
    map.DONE.sort((a, b) => a.order - b.order);
    return map;
  }, [filteredTasks]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor),
  );

  // Mutations
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskInput }) => updateTask(id, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["tasks"], (old: { items: Task[] } | undefined) => {
        const items = Array.isArray(old?.items) ? old.items : [];
        return {
          items: items.map((t) => (t.id === updated.id ? updated : t)),
        };
      });
    },
    onError: (err: Error) => {
      setToastError(err.message || "Failed to update task");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: (_, deletedId) => {
      setDeletingTask(null);
      setToastMessage("Task deleted");
      queryClient.setQueryData(["tasks"], (old: { items: Task[] } | undefined) => {
        if (!old) return old;
        const items = Array.isArray(old.items) ? old.items : [];
        return {
          items: items.filter((t) => t.id !== deletedId),
        };
      });
    },
    onError: (err: Error) => {
      setToastError(err.message || "Failed to delete task");
    },
  });

  // Handle Drag End with optimistic update
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const activeTask = allTasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    // Determine target lane and target index
    let targetStatus: TaskStatus = activeTask.status;
    let targetIndex = 0;

    // Is 'over' a lane container or another card?
    if (LANES.some((l) => l.id === over.id)) {
      targetStatus = over.id as TaskStatus;
      const targetLaneTasks = tasksByLane[targetStatus];
      targetIndex = targetLaneTasks.length;
    } else {
      const overTask = allTasks.find((t) => t.id === over.id);
      if (overTask) {
        targetStatus = overTask.status;
        const targetLaneTasks = tasksByLane[targetStatus];
        targetIndex = targetLaneTasks.findIndex((t) => t.id === over.id);
        if (targetIndex === -1) targetIndex = targetLaneTasks.length;
      }
    }

    // Pure reorder helper
    const reordered = reorderTasksPure(allTasks, activeId, targetStatus, targetIndex);

    // Optimistic cache update
    queryClient.setQueryData(["tasks"], { items: reordered });

    // Call server API
    updateMutation.mutate({
      id: activeId,
      data: {
        status: targetStatus,
        position: targetIndex,
      },
    });
  }

  // Card status change via dropdown menu
  function handleStatusChange(task: Task, newStatus: TaskStatus) {
    const targetLaneTasks = tasksByLane[newStatus];
    const targetIndex = targetLaneTasks.length;

    const reordered = reorderTasksPure(allTasks, task.id, newStatus, targetIndex);
    queryClient.setQueryData(["tasks"], { items: reordered });

    updateMutation.mutate({
      id: task.id,
      data: {
        status: newStatus,
        position: targetIndex,
      },
    });
  }

  // Permission helpers
  function checkCanEdit(task: Task): boolean {
    if (!currentUser) return false;
    if (currentUser.role === "ADMIN") return true;
    const isCreator = currentUser.id === task.createdBy;
    const isAssignee = currentUser.id === task.assigneeId;
    const isUnassigned = !task.assigneeId;
    return isCreator || isAssignee || isUnassigned;
  }

  function checkCanDelete(task: Task): boolean {
    if (!currentUser) return false;
    if (currentUser.role === "ADMIN") return true;
    return currentUser.id === task.createdBy;
  }

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "28px 24px" }} className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b" style={{ borderColor: "var(--rule)" }}>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            Tasks
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-soft)" }}>
            Track commitments across To do, In progress, and Done.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-opacity hover:opacity-90 shrink-0 self-start sm:self-auto"
          style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New task</span>
        </button>
      </div>

      {/* Filters row: Assignee picker and Search input */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--ink-soft)" }} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
            }}
          />
        </div>

        {/* Assignee filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="filter-assignee" className="text-xs font-semibold shrink-0" style={{ color: "var(--ink-soft)" }}>
            Assignee:
          </label>
          <select
            id="filter-assignee"
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border text-xs"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
            }}
          >
            <option value="all">All assignees</option>
            <option value="me">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Board Layout: Three lanes separated by 1 px vertical rules, no card wrapper */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div
          className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x rounded-lg border overflow-hidden"
          style={{ borderColor: "var(--rule)", backgroundColor: "var(--bg)" }}
        >
          {LANES.map((lane) => {
            const laneTasks = tasksByLane[lane.id];
            return (
              <LaneDroppable key={lane.id} laneId={lane.id} label={lane.label} tasks={laneTasks}>
                <SortableContext
                  items={laneTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {laneTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isHighlighted={task.id === highlightId}
                      canEdit={checkCanEdit(task)}
                      canDelete={checkCanDelete(task)}
                      onEdit={(t) => setEditingTask(t)}
                      onDelete={(t) => setDeletingTask(t)}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                  {laneTasks.length === 0 && (
                    <div
                      className="h-28 rounded border border-dashed flex items-center justify-center text-2xs italic"
                      style={{ borderColor: "var(--rule)", color: "var(--ink-soft)" }}
                    >
                      No tasks in this lane
                    </div>
                  )}
                </SortableContext>
              </LaneDroppable>
            );
          })}
        </div>
      </DndContext>

      {/* Create Task Dialog */}
      {isCreateOpen && (
        <CreateTaskDialog
          isOpen={isCreateOpen}
          teamMembers={teamMembers}
          onClose={() => setIsCreateOpen(false)}
          onCreate={(created) => {
            setIsCreateOpen(false);
            setToastMessage("Task created");
            queryClient.setQueryData(["tasks"], (old: { items: Task[] } | undefined) => {
              if (!old) return { items: [created] };
              return { items: [...old.items, created] };
            });
          }}
        />
      )}

      {/* Edit Task Dialog */}
      {editingTask && (
        <EditTaskDialog
          task={editingTask}
          teamMembers={teamMembers}
          onClose={() => setEditingTask(null)}
          onUpdate={(updated) => {
            setEditingTask(null);
            setToastMessage("Task updated");
            queryClient.setQueryData(["tasks"], (old: { items: Task[] } | undefined) => {
              const items = Array.isArray(old?.items) ? old.items : [];
              return {
                items: items.map((t) => (t.id === updated.id ? updated : t)),
              };
            });
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTask && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
        >
          <div
            className="w-full max-w-sm rounded-lg border p-6 space-y-4"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--rule)",
              color: "var(--ink)",
              boxShadow: "var(--shadow-menu)",
            }}
          >
            <h2 className="text-sm font-bold" style={{ color: "var(--error)" }}>
              Delete task
            </h2>
            <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
              Are you sure you want to delete <strong>{deletingTask.title}</strong>? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: "var(--rule)" }}>
              <button
                type="button"
                onClick={() => setDeletingTask(null)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border hover:opacity-80"
                style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingTask.id)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: "var(--error)", color: "var(--on-signal)" }}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Toasts */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-6 z-50 px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--rule)",
            color: "var(--ink)",
          }}
        >
          <Check className="w-3.5 h-3.5" style={{ color: "var(--signal)" }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {toastError && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 left-6 z-50 px-4 py-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--rule)",
            color: "var(--error)",
          }}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{toastError}</span>
        </div>
      )}
    </div>
  );
}

// Dialog for Task Creation
interface CreateTaskDialogProps {
  isOpen: boolean;
  teamMembers: Array<{ id: string; name: string; email: string }>;
  onClose: () => void;
  onCreate: (task: Task) => void;
}

function CreateTaskDialog({
  isOpen,
  teamMembers,
  onClose,
  onCreate,
}: CreateTaskDialogProps): React.JSX.Element | null {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<TaskStatus>("TODO");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: CreateTaskInput) => createTask(data),
    onSuccess: (task) => {
      onCreate(task);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create task");
    },
  });

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters");
      return;
    }
    setError(null);
    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      status,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    >
      <div
        className="w-full max-w-md rounded-lg border p-6 space-y-4"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--rule)",
          color: "var(--ink)",
          boxShadow: "var(--shadow-menu)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="create-task-title" className="text-base font-bold" style={{ color: "var(--ink)" }}>
            New task
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:opacity-80"
            style={{ color: "var(--ink-soft)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--error)", backgroundColor: "var(--surface)", color: "var(--error)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label htmlFor="task-title" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
              Title *
            </label>
            <input
              id="task-title"
              type="text"
              required
              minLength={2}
              maxLength={200}
              placeholder="e.g. Update checkout flow error state"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div>
            <label htmlFor="task-desc" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
              Description
            </label>
            <textarea
              id="task-desc"
              rows={3}
              maxLength={2000}
              placeholder="Optional details or context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-assignee" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                Assignee
              </label>
              <select
                id="task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-status" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                Status
              </label>
              <select
                id="task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              >
                {LANES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="task-due" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
              Due date
            </label>
            <input
              id="task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border hover:opacity-80"
              style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
            >
              {createMutation.isPending ? "Creating..." : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Dialog for Task Editing
interface EditTaskDialogProps {
  task: Task;
  teamMembers: Array<{ id: string; name: string; email: string }>;
  onClose: () => void;
  onUpdate: (task: Task) => void;
}

function EditTaskDialog({
  task,
  teamMembers,
  onClose,
  onUpdate,
}: EditTaskDialogProps): React.JSX.Element {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [assigneeId, setAssigneeId] = useState<string>(task.assigneeId || "");
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [error, setError] = useState<string | null>(null);

  const editMutation = useMutation({
    mutationFn: (data: UpdateTaskInput) => updateTask(task.id, data),
    onSuccess: (updated) => {
      onUpdate(updated);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update task");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) {
      setError("Title must be at least 2 characters");
      return;
    }
    setError(null);
    editMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      assigneeId: assigneeId || null,
      dueDate: dueDate || null,
      status,
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
    >
      <div
        className="w-full max-w-md rounded-lg border p-6 space-y-4"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--rule)",
          color: "var(--ink)",
          boxShadow: "var(--shadow-menu)",
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="edit-task-title" className="text-base font-bold" style={{ color: "var(--ink)" }}>
            Edit task
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:opacity-80"
            style={{ color: "var(--ink-soft)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg text-xs font-medium" style={{ border: "1px solid var(--error)", backgroundColor: "var(--surface)", color: "var(--error)" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label htmlFor="edit-task-title-input" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
              Title *
            </label>
            <input
              id="edit-task-title-input"
              type="text"
              required
              minLength={2}
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div>
            <label htmlFor="edit-task-desc" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
              Description
            </label>
            <textarea
              id="edit-task-desc"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-task-assignee" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                Assignee
              </label>
              <select
                id="edit-task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-task-status" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
                Status
              </label>
              <select
                id="edit-task-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
                style={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--rule)",
                  color: "var(--ink)",
                }}
              >
                {LANES.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="edit-task-due" className="block text-xs font-semibold mb-1" style={{ color: "var(--ink-soft)" }}>
              Due date
            </label>
            <input
              id="edit-task-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border text-xs"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--rule)",
                color: "var(--ink)",
              }}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: "var(--rule)" }}>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border hover:opacity-80"
              style={{ borderColor: "var(--rule)", color: "var(--ink)" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editMutation.isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--signal)", color: "var(--on-signal)" }}
            >
              {editMutation.isPending ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
