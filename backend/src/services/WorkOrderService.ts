import { Prisma, type WorkOrderStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { Errors } from '../errors/AppError.js';
import { inventoryService } from './InventoryService.js';

const include = { location: true, assignedUser: { select: { id: true, name: true, email: true, role: { select: { code: true } } } }, materials: { include: { item: { include: { category: true } } } } } as const;
type WorkOrderWithRelations = Prisma.WorkOrderGetPayload<{ include: typeof include }>;

export class WorkOrderService {
  async list() {
    const orders = await prisma.workOrder.findMany({ include, orderBy: { createdAt: 'desc' } });
    return Promise.all(orders.map((order) => this.withMaterialStock(order)));
  }

  async get(id: string) {
    const order = await prisma.workOrder.findUnique({ where: { id }, include });
    if (!order) throw Errors.notFound('Work order');
    return this.withMaterialStock(order);
  }

  async create(input: { code: string; locationId: string; assignedUserId: string; itemId: string; requiredQuantity: number }) {
    const [location, item, user] = await Promise.all([prisma.location.findUnique({ where: { id: input.locationId } }), prisma.item.findUnique({ where: { id: input.itemId } }), prisma.user.findUnique({ where: { id: input.assignedUserId }, include: { role: true } })]);
    if (!location) throw Errors.notFound('Location');
    if (!item) throw Errors.notFound('Item');
    if (!user) throw Errors.notFound('Assigned user');
    if (user.role.code === 'SALES_USER') throw Errors.conflict('Sales users cannot be assigned to a work order.');
    const order = await prisma.workOrder.create({ data: { code: input.code, locationId: input.locationId, assignedUserId: input.assignedUserId, materials: { create: { itemId: input.itemId, requiredQuantity: input.requiredQuantity } } }, include });
    return this.withMaterialStock(order);
  }

  async changeStatus(id: string, status: WorkOrderStatus) {
    const order = await prisma.workOrder.update({ where: { id }, data: { status }, include });
    return this.withMaterialStock(order);
  }

  private async withMaterialStock(order: WorkOrderWithRelations) {
    const materials = await Promise.all(order.materials.map(async (material) => {
      const requiredQuantity = Number(material.requiredQuantity);
      const availableQuantity = await inventoryService.availableAt(material.itemId, order.locationId);
      const shortageQuantity = Math.max(requiredQuantity - availableQuantity, 0);
      const potentialTransferSources = shortageQuantity > 0 ? await inventoryService.sourcesForItem(material.itemId, order.locationId) : [];
      return { ...material, requiredQuantity, availableQuantity, shortageQuantity, potentialTransferSources };
    }));
    return { ...order, materials };
  }
}
export const workOrderService = new WorkOrderService();

