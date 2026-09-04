import { z } from 'zod';
import { idParams, quantity } from './common.js';
export const transferCreateSchema = z.object({ code: z.string().trim().min(3).max(40), sourceLocationId: z.string().min(1), destinationLocationId: z.string().min(1), itemId: z.string().min(1), batch: z.string().trim().min(1).max(80).default('GENERAL'), quantity });
export const transferIdParams = idParams;
