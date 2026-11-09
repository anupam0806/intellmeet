import type { Request, Response, NextFunction } from "express";
import { TaskService } from "../services/task.service.js";
import type { TaskQueryInput } from "../validators/task.js";
import type { Server as SocketIOServer } from "socket.io";

export class TaskController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await TaskService.listTasks(
        req.user!.teamId,
        req.query as unknown as TaskQueryInput,
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const io = req.app.get("io") as SocketIOServer | undefined;
      const task = await TaskService.createTask(
        req.user!.teamId,
        req.user!.id,
        req.body,
        io,
      );
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const io = req.app.get("io") as SocketIOServer | undefined;
      const task = await TaskService.updateTask(
        req.params.id as string,
        req.user!.teamId,
        req.user!.id,
        req.user!.role,
        req.body,
        io,
      );
      res.status(200).json(task);
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const io = req.app.get("io") as SocketIOServer | undefined;
      await TaskService.deleteTask(
        req.params.id as string,
        req.user!.teamId,
        req.user!.id,
        req.user!.role,
        io,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}
