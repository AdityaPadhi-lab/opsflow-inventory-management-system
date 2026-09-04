import type { Request, Response } from 'express';
import { inventoryService } from '../services/InventoryService.js';

export class InventoryController {
  async list(req: Request, res: Response) {
  const result = await inventoryService.list(
    res.locals.validatedQuery as {
      search?: string;
      locationId?: string;
      categoryId?: string;
      page: number;
      limit: number;
    }
  );

  res.json({ success: true, ...result });
}

  async get(req: Request, res: Response) {
    res.json({
      success: true,
      data: await inventoryService.get(String(req.params.id)),
    });
  }

  async stockIn(req: Request, res: Response) {
    res.status(201).json({
      success: true,
      data: await inventoryService.stockIn(req.body, req.user!.id),
    });
  }

  async adjust(req: Request, res: Response) {
    const { physicalDelta, reference, note } = req.body;

    res.json({
      success: true,
      data: await inventoryService.adjust(
        String(req.params.id),
        physicalDelta,
        reference,
        req.user!.id,
        note
      ),
    });
  }
}

export const inventoryController = new InventoryController();