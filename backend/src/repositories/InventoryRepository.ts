import { Prisma, type PrismaClient } from '@prisma/client';

export type TransactionClient = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export class InventoryRepository {
  async lockById(tx: TransactionClient, inventoryId: string) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Inventory" WHERE id = ${inventoryId} FOR UPDATE`);
    return tx.inventory.findUnique({ where: { id: inventoryId } });
  }

  async lockByKey(tx: TransactionClient, itemId: string, locationId: string, batch: string) {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Inventory" WHERE "itemId" = ${itemId} AND "locationId" = ${locationId} AND batch = ${batch} FOR UPDATE`);
    return tx.inventory.findUnique({ where: { itemId_locationId_batch: { itemId, locationId, batch } } });
  }
}
export const inventoryRepository = new InventoryRepository();
