import { Router } from "express";
import { UserController } from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { updateUserSchema } from "../validators/user.js";

export const userRouter = Router();

userRouter.patch("/me", requireAuth, validateBody(updateUserSchema), UserController.updateMe);

