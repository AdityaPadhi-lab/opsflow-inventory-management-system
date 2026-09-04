import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import type { RoleCode } from '@prisma/client';
import { env } from '../config/env.js';
import { Errors } from '../errors/AppError.js';

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return next(Errors.unauthenticated());
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (!payload.sub || !payload.email || !payload.role || !payload.name) return next(Errors.unauthenticated());
    req.user = { id: payload.sub, email: String(payload.email), role: payload.role as RoleCode, name: String(payload.name) };
    return next();
  } catch { return next(Errors.unauthenticated()); }
};

export const authorize = (...roles: RoleCode[]): RequestHandler => (req, _res, next) => {
  if (!req.user) return next(Errors.unauthenticated());
  return roles.includes(req.user.role) ? next() : next(Errors.forbidden());
};
