import { Router } from 'express';
import { authController } from '../controllers/AuthController.js';
import { validate } from '../validators/common.js';
import { loginSchema } from '../validators/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const authRouter = Router();
authRouter.post('/login', validate({ body: loginSchema }), asyncHandler(authController.login.bind(authController)));
