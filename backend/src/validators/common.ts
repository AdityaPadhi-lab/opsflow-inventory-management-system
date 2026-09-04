import type { RequestHandler } from 'express';
import { z } from 'zod';

export const validate = (
  schema: {
    body?: z.ZodTypeAny;
    params?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
  }
): RequestHandler => (req, res, next) => {
  try {
    if (schema.body) {
      req.body = schema.body.parse(req.body);
    }

    if (schema.params) {
      req.params = schema.params.parse(req.params);
    }

    if (schema.query) {
      res.locals.validatedQuery = schema.query.parse(req.query);
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const idParams = z.object({
  id: z.string().min(1),
});

export const quantity = z.coerce
  .number()
  .positive('Quantity must be greater than zero.')
  .finite();