import type { Request, Response } from 'express';
import { workOrderService } from '../services/WorkOrderService.js';
export class WorkOrderController {
  async list(_req: Request, res: Response) { res.json({ success: true, data: await workOrderService.list() }); }
  async get(req: Request, res: Response) { res.json({ success: true, data: await workOrderService.get(String(req.params.id)) }); }
  async create(req: Request, res: Response) { res.status(201).json({ success: true, data: await workOrderService.create(req.body) }); }
  async changeStatus(req: Request, res: Response) { res.json({ success: true, data: await workOrderService.changeStatus(String(req.params.id), req.body.status) }); }
}
export const workOrderController = new WorkOrderController();

