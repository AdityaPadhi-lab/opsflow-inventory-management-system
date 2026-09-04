import { z } from 'zod';
import { quantity } from './common.js';
export const workOrderCreateSchema = z.object({ code: z.string().trim().min(3).max(40), locationId: z.string().min(1), assignedUserId: z.string().min(1), itemId: z.string().min(1), requiredQuantity: quantity });
export const workOrderStatusSchema = z.object({ status: z.enum(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED']) });
