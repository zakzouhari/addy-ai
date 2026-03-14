import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  plan: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } });
      return;
    }

    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; email: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, plan: true },
    });

    if (!user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not found' } });
      return;
    }

    req.user = { id: user.id, email: user.email, name: user.name, plan: user.plan };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired' } });
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid access token' } });
      return;
    }
    logger.error('Auth middleware error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' } });
  }
}

export function requirePlan(...plans: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
      return;
    }
    if (!plans.includes(req.user.plan)) {
      res.status(403).json({ success: false, error: { code: 'PLAN_REQUIRED', message: `This feature requires one of: ${plans.join(', ')}` } });
      return;
    }
    next();
  };
}
