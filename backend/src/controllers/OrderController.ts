import type { Request, Response } from 'express';
import { orderService } from '../services/OrderService.js';
export class OrderController {
  async list(_req: Request, res: Response) { res.json({ success: true, data: await orderService.list() }); }
  async get(req: Request, res: Response) { res.json({ success: true, data: await orderService.get(String(req.params.id)) }); }
  async create(req: Request, res: Response) { res.status(201).json({ success: true, data: await orderService.create(req.body) }); }
  async reserve(req: Request, res: Response) { res.json({ success: true, data: await orderService.reserve(String(req.params.id), req.user!.id) }); }
}
export const orderController = new OrderController();

