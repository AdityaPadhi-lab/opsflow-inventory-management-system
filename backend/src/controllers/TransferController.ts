import type { Request, Response } from 'express';
import { transferService } from '../services/TransferService.js';
export class TransferController {
  async list(_req: Request, res: Response) { res.json({ success: true, data: await transferService.list() }); }
  async create(req: Request, res: Response) { res.status(201).json({ success: true, data: await transferService.create(req.body) }); }
  async dispatch(req: Request, res: Response) { res.json({ success: true, data: await transferService.dispatch(String(req.params.id), req.user!.id) }); }
  async receive(req: Request, res: Response) { res.json({ success: true, data: await transferService.receive(String(req.params.id), req.user!.id) }); }
  async sourceAvailability(req: Request, res: Response) { res.json({ success: true, data: await transferService.sourceAvailability(String(req.params.id)) }); }
}
export const transferController = new TransferController();

