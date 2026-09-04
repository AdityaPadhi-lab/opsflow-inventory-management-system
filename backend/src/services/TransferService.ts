import { Prisma, type TransferStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError, Errors } from '../errors/AppError.js';
import { inventoryRepository } from '../repositories/InventoryRepository.js';
import { inventoryService } from './InventoryService.js';
import { logger } from '../utils/logger.js';
import { serializableTransaction } from '../utils/transaction.js';

const asNumber = (value: Prisma.Decimal | number) => Number(value);
const include = { item: { include: { category: true } }, sourceLocation: true, destinationLocation: true } as const;

export class TransferService {
  async list() {
    const transfers = await prisma.transfer.findMany({ include, orderBy: { createdAt: 'desc' } });
    return transfers.map((transfer) => ({ ...transfer, quantity: asNumber(transfer.quantity) }));
  }

  async create(input: { code: string; sourceLocationId: string; destinationLocationId: string; itemId: string; batch: string; quantity: number }) {
    if (input.sourceLocationId === input.destinationLocationId) throw Errors.conflict('Source and destination locations must differ.');
    const [item, source, destination] = await Promise.all([prisma.item.findUnique({ where: { id: input.itemId } }), prisma.location.findUnique({ where: { id: input.sourceLocationId } }), prisma.location.findUnique({ where: { id: input.destinationLocationId } })]);
    if (!item) throw Errors.notFound('Item');
    if (!source || !destination) throw Errors.notFound('Location');
    if ((await inventoryService.availableAt(input.itemId, input.sourceLocationId, input.batch)) < input.quantity) throw Errors.insufficientStock();
    const transfer = await prisma.transfer.create({ data: input, include });
    logger.info('transfer_requested', { transferId: transfer.id, quantity: input.quantity });
    return { ...transfer, quantity: asNumber(transfer.quantity) };
  }

  async dispatch(id: string, userId: string) {
    const transfer = await serializableTransaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Transfer" WHERE id = ${id} FOR UPDATE`);
      const transfer = await tx.transfer.findUnique({ where: { id } });
      if (!transfer) throw Errors.notFound('Transfer');
      if (transfer.status !== 'REQUESTED') throw Errors.invalidTransfer('Only requested transfers can be dispatched.');
      const source = await inventoryRepository.lockByKey(tx, transfer.itemId, transfer.sourceLocationId, transfer.batch);
      if (!source || asNumber(source.physicalQuantity) - asNumber(source.reservedQuantity) < asNumber(transfer.quantity)) throw Errors.insufficientStock();
      await tx.inventory.update({ where: { id: source.id }, data: { physicalQuantity: { decrement: transfer.quantity } } });
      await tx.inventoryTransaction.create({ data: { inventoryId: source.id, type: 'TRANSFER_DISPATCH', quantity: transfer.quantity, reference: `TRANSFER-DISPATCH-${transfer.id}`, note: `Dispatched ${transfer.code}`, createdById: userId } });
      return tx.transfer.update({ where: { id }, data: { status: 'DISPATCHED' }, include });
    });
    logger.info('transfer_dispatched', { transferId: id, userId });
    return { ...transfer, quantity: asNumber(transfer.quantity) };
  }

  async receive(id: string, userId: string) {
    const transfer = await serializableTransaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Transfer" WHERE id = ${id} FOR UPDATE`);
      const transfer = await tx.transfer.findUnique({ where: { id } });
      if (!transfer) throw Errors.notFound('Transfer');
      if (transfer.status === 'RECEIVED') throw new AppError(409, 'TRANSFER_ALREADY_RECEIVED', 'This transfer has already been received.');
      if (transfer.status !== 'DISPATCHED') throw Errors.invalidTransfer('Only dispatched transfers can be received.');
      let destination = await inventoryRepository.lockByKey(tx, transfer.itemId, transfer.destinationLocationId, transfer.batch);
      if (!destination) destination = await tx.inventory.create({ data: { itemId: transfer.itemId, locationId: transfer.destinationLocationId, batch: transfer.batch, physicalQuantity: 0 } });
      await tx.inventory.update({ where: { id: destination.id }, data: { physicalQuantity: { increment: transfer.quantity } } });
      await tx.inventoryTransaction.create({ data: { inventoryId: destination.id, type: 'TRANSFER_RECEIPT', quantity: transfer.quantity, reference: `TRANSFER-RECEIPT-${transfer.id}`, note: `Received ${transfer.code}`, createdById: userId } });
      return tx.transfer.update({ where: { id }, data: { status: 'RECEIVED' }, include });
    });
    logger.info('transfer_received', { transferId: id, userId });
    return { ...transfer, quantity: asNumber(transfer.quantity) };
  }

  async sourceAvailability(id: string) {
    const transfer = await prisma.transfer.findUnique({ where: { id } });
    if (!transfer) throw Errors.notFound('Transfer');
    return { availableQuantity: await inventoryService.availableAt(transfer.itemId, transfer.sourceLocationId, transfer.batch) };
  }
}
export const transferService = new TransferService();


