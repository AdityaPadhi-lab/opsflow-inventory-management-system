import { z } from 'zod';
import { quantity } from './common.js';
const orderItemSchema = z.object({ itemId: z.string().min(1), batch: z.string().trim().min(1).max(80).default('GENERAL'), quantity });
export const orderCreateSchema = z.object({ code: z.string().trim().min(3).max(40), customerId: z.string().min(1), locationId: z.string().min(1), items: z.array(orderItemSchema).min(1).superRefine((items, ctx) => { const keys = new Set<string>(); items.forEach((item, index) => { const key = `${item.itemId}:${item.batch}`; if (keys.has(key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate item and batch lines are not allowed.', path: [index] }); keys.add(key); }); }) });
