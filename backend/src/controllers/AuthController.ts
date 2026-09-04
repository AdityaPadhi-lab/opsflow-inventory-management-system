import type { Request, Response } from 'express';
import { authService } from '../services/AuthService.js';
export class AuthController { async login(req: Request, res: Response) { const data = await authService.login(req.body.email, req.body.password); res.json({ success: true, data }); } }
export const authController = new AuthController();
