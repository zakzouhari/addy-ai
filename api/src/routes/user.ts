import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

const router = Router();
router.use(authenticate);

router.get('/me', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true, email: true, name: true, avatarUrl: true,
        plan: true, settings: true, styleProfile: true,
        createdAt: true, updatedAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }
    res.json({ success: true, data: user });
  } catch (err) {
    logger.error('Get user error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get user' } });
  }
});

const settingsSchema = z.object({
  defaultTone: z.enum(['friendly', 'formal', 'casual', 'excited', 'thankful', 'assertive', 'empathetic', 'custom']).optional(),
  signature: z.string().max(1000).optional(),
  language: z.string().max(10).optional(),
  followUpDefaultDays: z.number().min(1).max(365).optional(),
  knowledgeBaseEnabled: z.boolean().optional(),
  autoDetectLanguage: z.boolean().optional(),
});

router.patch('/settings', async (req: Request, res: Response) => {
  try {
    const data = settingsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const currentSettings = (user?.settings as any) || {};
    const updatedSettings = { ...currentSettings, ...data };

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { settings: updatedSettings },
    });

    res.json({ success: true, data: updatedSettings });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid settings', details: err.errors } });
      return;
    }
    logger.error('Update settings error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' } });
  }
});

router.get('/style-profile', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { styleProfile: true },
    });
    res.json({ success: true, data: user?.styleProfile || null });
  } catch (err) {
    logger.error('Get style profile error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get style profile' } });
  }
});

const styleProfileSchema = z.object({
  formality: z.number().min(0).max(1).optional(),
  greetingStyle: z.string().max(100).optional(),
  closingStyle: z.string().max(100).optional(),
  commonPhrases: z.array(z.string()).max(20).optional(),
  useEmojis: z.boolean().optional(),
});

router.patch('/style-profile', async (req: Request, res: Response) => {
  try {
    const data = styleProfileSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const currentProfile = (user?.styleProfile as any) || {};
    const updatedProfile = { ...currentProfile, ...data };

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { styleProfile: updatedProfile },
    });

    res.json({ success: true, data: updatedProfile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid profile data', details: err.errors } });
      return;
    }
    logger.error('Update style profile error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update style profile' } });
  }
});

router.delete('/data', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        knowledgeDocs: { select: { id: true, title: true } },
        reminders: true,
        analytics: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
      return;
    }

    // Return data export before deletion
    const exportData = {
      user: { email: user.email, name: user.name, plan: user.plan, settings: user.settings },
      knowledgeDocs: user.knowledgeDocs,
      reminders: user.reminders,
      analytics: user.analytics,
      exportedAt: new Date().toISOString(),
    };

    await prisma.user.delete({ where: { id: req.user!.id } });
    logger.info(`GDPR data export and deletion for user: ${req.user!.email}`);

    res.json({ success: true, data: exportData });
  } catch (err) {
    logger.error('Data export/delete error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to export/delete data' } });
  }
});

export default router;
