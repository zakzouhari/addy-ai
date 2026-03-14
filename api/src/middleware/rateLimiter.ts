import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, please try again later' } },
});

export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: (req: Request, _res: Response) => {
    const plan = req.user?.plan;
    if (plan === 'PRO' || plan === 'ENTERPRISE') return 200;
    return 30;
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'AI generation limit reached. Upgrade to Pro for higher limits.' } },
});
