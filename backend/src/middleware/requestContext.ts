import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
export const requestContext: RequestHandler = (req, res, next) => { req.requestId = randomUUID(); res.setHeader('X-Request-Id', req.requestId); next(); };
