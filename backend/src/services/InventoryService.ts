import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { Errors } from '../errors/AppError.js';
import { inventoryRepository } from '../repositories/InventoryRepository.js';
import { logger } from '../utils/logger.js';

const number = (value: Prisma.Decimal | number) => Number(value);
const inventoryInclude = { item: { include: { category: true } }, location: true } as const;

export type InventoryFilters = { search?: string; locationId?: string; categoryId?: string; page: number; limit: number };
export class InventoryService {
  async list(filters: InventoryFilters) {
    const where: Prisma.InventoryWhereInput = {
      ...(filters.locationId ? { locationId: filters.locationId } : {}),
      ...(filters.categoryId ? { item: { categoryId: filters.categoryId } } : {}),
      ...(filters.search ? { OR: [{ item: { name: { contains: filters.search, mode: 'insensitive' } } }, { item: { sku: { contains: filters.search, mode: 'insensitive' } } }, { batch: { contains: filters.search, mode: 'insensitive' } }] } : {}),
    };
    const [records, total] = await prisma.$transaction([
      prisma.inventory.findMany({ where, include: inventoryInclude, orderBy: [{ item: { name: 'asc' } }, { location: { name: 'asc' } }], skip: (filters.page - 1) * filters.limit, take: filters.limit }),
      prisma.inventory.count({ where }),
    ]);
    return { data: records.map(this.present), pagination: { page: filters.page, limit: filters.limit, total, totalPages: Math.ceil(total / filters.limit) } };
  }

  async get(id: string) {
    const record = await prisma.inventory.findUnique({ where: { id }, include: { ...inventoryInclude, transactions: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    if (!record) throw Errors.notFound('Inventory record');
    return { ...this.present(record), transactions: record.transactions.map((tx) => ({ ...tx, quantity: number(tx.quantity) })) };
  }

  async stockIn(input: { itemId: string; locationId: string; batch: string; quantity: number; reference?: string; note?: string }, userId: string) {
    await this.assertItemAndLocation(input.itemId, input.locationId);
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventory.findUnique({ where: { itemId_locationId_batch: { itemId: input.itemId, locationId: input.locationId, batch: input.batch } } });
      const inventory = existing
        ? await tx.inventory.update({ where: { id: existing.id }, data: { physicalQuantity: { increment: input.quantity } } })
        : await tx.inventory.create({ data: { itemId: input.itemId, locationId: input.locationId, batch: input.batch, physicalQuantity: input.quantity } });
      await tx.inventoryTransaction.create({ data: { inventoryId: inventory.id, type: 'STOCK_IN', quantity: input.quantity, reference: input.reference ?? `STOCK-IN-${inventory.id}-${Date.now()}`, note: input.note, createdById: userId } });
      return inventory;
    });
    logger.info('inventory_stocked_in', { inventoryId: result.id, quantity: input.quantity, userId });
    return this.get(result.id);
  }

  async adjust(id: string, physicalDelta: number, reference: string, userId: string, note?: string) {
    const adjusted = await prisma.$transaction(async (tx) => {
      const record = await inventoryRepository.lockById(tx, id);
      if (!record) throw Errors.notFound('Inventory record');
      const next = number(record.physicalQuantity) + physicalDelta;
      if (next < 0 || next < number(record.reservedQuantity)) throw Errors.insufficientStock();
      const updated = await tx.inventory.update({ where: { id }, data: { physicalQuantity: { increment: physicalDelta } } });
      await tx.inventoryTransaction.create({ data: { inventoryId: id, type: 'ADJUSTMENT', quantity: physicalDelta, reference, note, createdById: userId } });
      return updated;
    });
    logger.info('inventory_adjusted', { inventoryId: id, physicalDelta, userId });
    return this.get(adjusted.id);
  }

  async availableAt(itemId: string, locationId: string, batch = 'GENERAL') {
    const record = await prisma.inventory.findUnique({ where: { itemId_locationId_batch: { itemId, locationId, batch } } });
    return record ? number(record.physicalQuantity) - number(record.reservedQuantity) : 0;
  }

  async sourcesForItem(itemId: string, exceptLocationId?: string) {
    const records = await prisma.inventory.findMany({ where: { itemId, ...(exceptLocationId ? { NOT: { locationId: exceptLocationId } } : {}) }, include: { location: true } });
    return records.map((r) => ({ inventoryId: r.id, location: r.location, batch: r.batch, availableQuantity: number(r.physicalQuantity) - number(r.reservedQuantity) })).filter((r) => r.availableQuantity > 0);
  }

  present(record: { physicalQuantity: Prisma.Decimal; reservedQuantity: Prisma.Decimal } & Record<string, unknown>) {
    const physicalQuantity = number(record.physicalQuantity);
    const reservedQuantity = number(record.reservedQuantity);
    return { ...record, physicalQuantity, reservedQuantity, availableQuantity: physicalQuantity - reservedQuantity };
  }

  private async assertItemAndLocation(itemId: string, locationId: string) {
    const [item, location] = await Promise.all([prisma.item.findUnique({ where: { id: itemId } }), prisma.location.findUnique({ where: { id: locationId } })]);
    if (!item) throw Errors.notFound('Item');
    if (!location) throw Errors.notFound('Location');
  }
}
export const inventoryService = new InventoryService();
