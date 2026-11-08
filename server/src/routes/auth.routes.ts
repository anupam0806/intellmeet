import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimiter, demoRateLimiter } from "../middleware/rateLimit.js";
import { signupSchema, loginSchema, demoLoginSchema } from "../validators/auth.js";

export const authRouter = Router();

authRouter.post("/signup", authRateLimiter, validateBody(signupSchema), AuthController.signup);
authRouter.post("/login", authRateLimiter, validateBody(loginSchema), AuthController.login);
authRouter.post("/demo", demoRateLimiter, validateBody(demoLoginSchema), AuthController.demo);
authRouter.post("/refresh", AuthController.refresh);
authRouter.post("/logout", AuthController.logout);
authRouter.get("/me", requireAuth, AuthController.me);

