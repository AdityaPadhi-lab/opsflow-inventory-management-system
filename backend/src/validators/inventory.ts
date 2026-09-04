import { z } from 'zod';
import { quantity } from './common.js';
export const inventoryListQuery = z.object({ search: z.string().trim().optional(), locationId: z.string().optional(), categoryId: z.string().optional(), page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(1).max(100).default(25) });
export const stockInSchema = z.object({ itemId: z.string().min(1), locationId: z.string().min(1), batch: z.string().trim().min(1).max(80).default('GENERAL'), quantity, reference: z.string().trim().min(3).max(120).optional(), note: z.string().trim().max(500).optional() });
export const adjustInventorySchema = z.object({ physicalDelta: z.coerce.number().finite().refine((value) => value !== 0, 'Adjustment cannot be zero.'), reference: z.string().trim().min(3).max(120), note: z.string().trim().max(500).optional() });
