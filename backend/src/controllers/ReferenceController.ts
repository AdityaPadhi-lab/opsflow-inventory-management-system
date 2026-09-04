import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';

export class ReferenceController {
  async locations(_req: Request, res: Response) { res.json({ success: true, data: await prisma.location.findMany({ orderBy: { name: 'asc' } }) }); }
  async categories(_req: Request, res: Response) { res.json({ success: true, data: await prisma.category.findMany({ orderBy: { name: 'asc' } }) }); }
  async items(_req: Request, res: Response) { res.json({ success: true, data: await prisma.item.findMany({ include: { category: true }, orderBy: { name: 'asc' } }) }); }
  async customers(_req: Request, res: Response) { res.json({ success: true, data: await prisma.customer.findMany({ orderBy: { name: 'asc' } }) }); }
  async users(_req: Request, res: Response) { res.json({ success: true, data: await prisma.user.findMany({ select: { id: true, name: true, email: true, role: { select: { code: true, label: true } } }, orderBy: { name: 'asc' } }) }); }
  async overview(_req: Request, res: Response) {
    const [inventory, workOrders, transfers, orders] = await Promise.all([prisma.inventory.findMany(), prisma.workOrder.count({ where: { status: { not: 'COMPLETED' } } }), prisma.transfer.count({ where: { status: { not: 'RECEIVED' } } }), prisma.customerOrder.count({ where: { status: 'DRAFT' } })]);
    const atRisk = inventory.filter((line) => Number(line.physicalQuantity) - Number(line.reservedQuantity) <= 10).length;
    res.json({ success: true, data: { inventoryLines: inventory.length, atRiskInventoryLines: atRisk, openWorkOrders: workOrders, activeTransfers: transfers, unreservedOrders: orders } });
  }
}
export const referenceController = new ReferenceController();
