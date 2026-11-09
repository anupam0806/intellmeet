import { Router } from "express";
import { TaskController } from "../controllers/task.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  createTaskSchema,
  updateTaskSchema,
  taskQuerySchema,
  taskIdParamSchema,
} from "../validators/task.js";

export const taskRouter = Router();

taskRouter.use(requireAuth);

taskRouter.get("/", validateQuery(taskQuerySchema), TaskController.list);
taskRouter.post("/", validateBody(createTaskSchema), TaskController.create);
taskRouter.patch(
  "/:id",
  validateParams(taskIdParamSchema),
  validateBody(updateTaskSchema),
  TaskController.update,
);
taskRouter.delete("/:id", validateParams(taskIdParamSchema), TaskController.delete);
