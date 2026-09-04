export class AppError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  unauthenticated: () => new AppError(401, 'UNAUTHORIZED', 'Authentication is required.'),
  forbidden: () => new AppError(403, 'FORBIDDEN', 'You do not have permission for this operation.'),
  notFound: (entity: string) => new AppError(404, 'NOT_FOUND', `${entity} was not found.`),
  insufficientStock: () => new AppError(409, 'INSUFFICIENT_STOCK', 'Insufficient available inventory.'),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  invalidTransfer: (message: string) => new AppError(409, 'INVALID_TRANSFER_STATUS', message),
};
