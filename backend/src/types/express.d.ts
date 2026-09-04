import type { RoleCode } from '@prisma/client';

declare global {
  namespace Express {
    interface Request { user?: { id: string; email: string; role: RoleCode; name: string }; requestId?: string; }
  }
}
export {};
