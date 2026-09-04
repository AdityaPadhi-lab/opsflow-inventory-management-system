import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';

/** Retries PostgreSQL serialization failures; all business checks run inside each fresh transaction. */
export async function serializableTransaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await prisma.$transaction(operation, { isolationLevel: 'Serializable' }); }
    catch (error) {
      lastError = error;
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034' || attempt === attempts - 1) throw error;
    }
  }
  throw lastError;
}
