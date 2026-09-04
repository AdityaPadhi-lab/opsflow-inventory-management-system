import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { Errors } from '../errors/AppError.js';
import { inventoryRepository } from '../repositories/InventoryRepository.js';
import { logger } from '../utils/logger.js';
import { serializableTransaction } from '../utils/transaction.js';

const include = { customer: true, location: true, items: { include: { item: { include: { category: true } }, reservation: true } } } as const;
const asNumber = (value: Prisma.Decimal | number) => Number(value);
type OrderWithRelations = Prisma.CustomerOrderGetPayload<{ include: typeof include }>;

export class OrderService {
  async list() {
    const orders = await prisma.customerOrder.findMany({ include, orderBy: { createdAt: 'desc' } });
    return orders.map((order) => this.present(order));
  }

  async get(id: string) {
    const order = await prisma.customerOrder.findUnique({ where: { id }, include });
    if (!order) throw Errors.notFound('Customer order');
    return this.present(order);
  }

  async create(input: { code: string; customerId: string; locationId: string; items: { itemId: string; batch: string; quantity: number }[] }) {
    const [customer, location, itemCount] = await Promise.all([prisma.customer.findUnique({ where: { id: input.customerId } }), prisma.location.findUnique({ where: { id: input.locationId } }), prisma.item.count({ where: { id: { in: input.items.map((item) => item.itemId) } } })]);
    if (!customer) throw Errors.notFound('Customer');
    if (!location) throw Errors.notFound('Location');
    if (itemCount !== new Set(input.items.map((item) => item.itemId)).size) throw Errors.notFound('Item');
    const order = await prisma.customerOrder.create({ data: { code: input.code, customerId: input.customerId, locationId: input.locationId, items: { create: input.items } }, include });
    logger.info('customer_order_created', { orderId: order.id });
    return this.present(order);
  }

  async reserve(id: string, userId: string) {
    const result = await serializableTransaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "CustomerOrder" WHERE id = ${id} FOR UPDATE`);
      const order = await tx.customerOrder.findUnique({ where: { id }, include: { items: { include: { reservation: true, item: true } } } });
      if (!order) throw Errors.notFound('Customer order');
      if (order.status === 'RESERVED' || order.items.some((item) => item.reservation)) throw Errors.conflict('This order has already been reserved.');
      const locked = [] as { item: typeof order.items[number]; inventory: NonNullable<Awaited<ReturnType<typeof inventoryRepository.lockByKey>>>; availableBefore: number }[];
      for (const item of [...order.items].sort((a, b) => `${a.itemId}:${a.batch}`.localeCompare(`${b.itemId}:${b.batch}`))) {
        const inventory = await inventoryRepository.lockByKey(tx, item.itemId, order.locationId, item.batch);
        const availableBefore = inventory ? asNumber(inventory.physicalQuantity) - asNumber(inventory.reservedQuantity) : 0;
        if (!inventory || availableBefore < asNumber(item.quantity)) throw Errors.insufficientStock();
        locked.push({ item, inventory, availableBefore });
      }
      const lines = [];
      for (const { item, inventory, availableBefore } of locked) {
        await tx.inventory.update({ where: { id: inventory.id }, data: { reservedQuantity: { increment: item.quantity } } });
        const reservation = await tx.reservation.create({ data: { customerOrderItemId: item.id, inventoryId: inventory.id, reservedById: userId, quantity: item.quantity } });
        await tx.inventoryTransaction.create({ data: { inventoryId: inventory.id, type: 'RESERVATION', quantity: item.quantity, reference: `RESERVATION-${reservation.id}`, note: `Reserved for ${order.code}`, createdById: userId } });
        lines.push({ itemId: item.itemId, itemName: item.item.name, requestedQuantity: asNumber(item.quantity), availableBefore, reservedAfter: asNumber(inventory.reservedQuantity) + asNumber(item.quantity), availableAfter: availableBefore - asNumber(item.quantity) });
      }
      await tx.customerOrder.update({ where: { id }, data: { status: 'RESERVED' } });
      return lines;
    });
    logger.info('customer_order_reserved', { orderId: id, userId });
    return { order: await this.get(id), reservationResult: result };
  }

  private present(order: OrderWithRelations) {
    return { ...order, items: order.items.map((item) => ({ ...item, quantity: asNumber(item.quantity), reservation: item.reservation ? { ...item.reservation, quantity: asNumber(item.reservation.quantity) } : null })), reservationStatus: order.status === 'RESERVED' ? 'RESERVED' : 'NOT_RESERVED' };
  }
}
export const orderService = new OrderService();


