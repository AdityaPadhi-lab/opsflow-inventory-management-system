import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { Errors } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';

export class AuthService {
  async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      logger.warn('authentication_failed', { email });
      throw Errors.unauthenticated();
    }
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role.code, name: user.name }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
    logger.info('authentication_succeeded', { userId: user.id });
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role.code } };
  }
}
export const authService = new AuthService();
