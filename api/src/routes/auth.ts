import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../config/prisma';
import config from '../config';
import logger from '../config/logger';
import { GoogleService } from '../services/google';
import { authenticate } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimiter';

const router = Router();

// ============================================================
// Email + Password Authentication
// ============================================================

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(200),
});

router.post('/register', authLimiter, async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    // Team access control
    if (config.allowedEmails.length > 0 && !config.allowedEmails.includes(data.email.toLowerCase())) {
      res.status(403).json({ success: false, error: { code: 'ACCESS_DENIED', message: 'Your email is not authorized to use this application. Contact your administrator.' } });
      return;
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      res.status(409).json({ success: false, error: { code: 'USER_EXISTS', message: 'An account with this email already exists. Try signing in instead.' } });
      return;
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        passwordHash,
        authMethod: 'EMAIL',
        settings: {
          defaultTone: 'friendly',
          signature: '',
          language: 'en',
          followUpDefaultDays: 3,
          knowledgeBaseEnabled: true,
          autoDetectLanguage: true,
        },
        analytics: { create: {} },
      },
    });

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    const refreshTokenValue = uuidv4();
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(`New email user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresAt: Date.now() + 15 * 60 * 1000,
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid registration data', details: err.errors } });
      return;
    }
    logger.error('Registration error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Registration failed' } });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (!user || !user.passwordHash) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const validPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    const refreshTokenValue = uuidv4();
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    logger.info(`Email user logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: refreshTokenValue,
        expiresAt: Date.now() + 15 * 60 * 1000,
        user: { id: user.id, email: user.email, name: user.name, plan: user.plan },
      },
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid login data', details: err.errors } });
      return;
    }
    logger.error('Login error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Login failed' } });
  }
});

// ============================================================
// Google OAuth Authentication
// ============================================================

router.get('/google', authLimiter, (_req: Request, res: Response) => {
  const url = GoogleService.getAuthUrl();
  res.redirect(url);
});

router.get('/google/callback', authLimiter, async (req: Request, res: Response) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      res.redirect(`${config.dashboardUrl}/login?error=no_code`);
      return;
    }

    const tokens = await GoogleService.getTokens(code);
    const profile = await GoogleService.getUserProfile(tokens.accessToken);

    // Team access control: if ALLOWED_EMAILS is set, only those emails can sign in
    if (config.allowedEmails.length > 0 && !config.allowedEmails.includes(profile.email.toLowerCase())) {
      logger.warn(`Access denied for email: ${profile.email} (not in allowed list)`);
      res.redirect(`${config.dashboardUrl}/login?error=access_denied`);
      return;
    }

    // Check if user exists by googleId first, then by email (for users who registered with email first)
    let user = await prisma.user.findUnique({ where: { googleId: profile.googleId } });

    if (!user) {
      // Check if an email-registered user exists with this email — link their Google account
      user = await prisma.user.findUnique({ where: { email: profile.email } });
      if (user && !user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.googleId, avatarUrl: profile.picture, name: profile.name },
        });
        logger.info(`Linked Google account to existing user: ${user.email}`);
      } else if (!user) {
        user = await prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            googleId: profile.googleId,
            authMethod: 'GOOGLE',
            avatarUrl: profile.picture,
            settings: {
              defaultTone: 'friendly',
              signature: '',
              language: 'en',
              followUpDefaultDays: 3,
              knowledgeBaseEnabled: true,
              autoDetectLanguage: true,
            },
            analytics: { create: {} },
          },
        });
        logger.info(`New Google user created: ${user.email}`);
      }
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl: profile.picture, name: profile.name },
      });
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    const refreshTokenValue = uuidv4();
    await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const params = new URLSearchParams({
      accessToken,
      refreshToken: refreshTokenValue,
      expiresAt: String(Date.now() + 15 * 60 * 1000),
    });

    res.redirect(`${config.dashboardUrl}/login?${params.toString()}`);
  } catch (err) {
    logger.error('Google OAuth callback error:', err);
    res.redirect(`${config.dashboardUrl}/login?error=auth_failed`);
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: { code: 'MISSING_TOKEN', message: 'Refresh token required' } });
      return;
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      if (storedToken) {
        await prisma.refreshToken.delete({ where: { id: storedToken.id } });
      }
      res.status(401).json({ success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid or expired refresh token' } });
      return;
    }

    const accessToken = jwt.sign(
      { userId: storedToken.user.id, email: storedToken.user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpiresIn }
    );

    const newRefreshToken = uuidv4();
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresAt: Date.now() + 15 * 60 * 1000,
      },
    });
  } catch (err) {
    logger.error('Token refresh error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to refresh token' } });
  }
});

router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({ where: { token: refreshToken, userId: req.user!.id } });
    }
    res.json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    logger.error('Logout error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Logout failed' } });
  }
});

router.delete('/account', authenticate, async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.user!.id } });
    logger.info(`User account deleted: ${req.user!.email}`);
    res.json({ success: true, data: { message: 'Account and all associated data deleted' } });
  } catch (err) {
    logger.error('Account deletion error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to delete account' } });
  }
});

export default router;
