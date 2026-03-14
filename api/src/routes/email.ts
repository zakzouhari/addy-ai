import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { aiLimiter } from '../middleware/rateLimiter';
import { AIService } from '../services/ai';
import { KnowledgeService } from '../services/knowledge';
import { SMTP2GoService } from '../services/smtp2go';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

const router = Router();
router.use(authenticate);

const composeSchema = z.object({
  topic: z.string().min(1).max(2000),
  tone: z.enum(['friendly', 'formal', 'casual', 'excited', 'thankful', 'assertive', 'empathetic', 'custom']),
  recipientEmail: z.string().email().optional(),
  threadContext: z.object({
    subject: z.string(),
    messages: z.array(z.object({ from: z.string(), body: z.string(), date: z.string() })),
  }).optional(),
  language: z.string().max(10).optional(),
  customInstructions: z.string().max(1000).optional(),
});

router.post('/compose', aiLimiter, async (req: Request, res: Response) => {
  try {
    const data = composeSchema.parse(req.body);

    let knowledgeContext: string[] | undefined;
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    const settings = user?.settings as any;

    if (settings?.knowledgeBaseEnabled) {
      try {
        const results = await KnowledgeService.searchKnowledge(req.user!.id, data.topic, 3);
        if (results.length > 0) {
          knowledgeContext = results.map((r) => r.content);
        }
      } catch {
        // Knowledge search failed, continue without it
      }
    }

    const styleProfile = user?.styleProfile as any;

    const result = await AIService.composeDraft({
      ...data,
      knowledgeContext,
      styleProfile: styleProfile || undefined,
    });

    await updateAnalytics(req.user!.id, 'compose', data.tone);

    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Compose error:', err);
    res.status(500).json({ success: false, error: { code: 'COMPOSE_FAILED', message: 'Failed to generate email draft' } });
  }
});

const summarizeSchema = z.object({
  emailContent: z.string().min(1).max(50000),
  threadMessages: z.array(z.object({ from: z.string(), body: z.string(), date: z.string() })).optional(),
});

router.post('/summarize', aiLimiter, async (req: Request, res: Response) => {
  try {
    const data = summarizeSchema.parse(req.body);
    const result = await AIService.summarizeEmail(data);
    await updateAnalytics(req.user!.id, 'summarize');
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Summarize error:', err);
    res.status(500).json({ success: false, error: { code: 'SUMMARIZE_FAILED', message: 'Failed to summarize email' } });
  }
});

const toneAdjustSchema = z.object({
  text: z.string().min(1).max(10000),
  adjustment: z.enum(['more_formal', 'friendlier', 'fix_grammar', 'shorter', 'longer', 'translate']),
  targetLanguage: z.string().max(50).optional(),
});

router.post('/adjust-tone', aiLimiter, async (req: Request, res: Response) => {
  try {
    const data = toneAdjustSchema.parse(req.body);
    const result = await AIService.adjustTone(data);
    await updateAnalytics(req.user!.id, 'tone_adjust');
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Tone adjust error:', err);
    res.status(500).json({ success: false, error: { code: 'ADJUST_FAILED', message: 'Failed to adjust tone' } });
  }
});

const followUpGenerateSchema = z.object({
  originalSubject: z.string().min(1),
  originalBody: z.string().min(1),
  recipientEmail: z.string().email(),
  daysSinceSent: z.number().min(0),
  tone: z.string().optional(),
});

router.post('/follow-up/generate', aiLimiter, async (req: Request, res: Response) => {
  try {
    const data = followUpGenerateSchema.parse(req.body);
    const result = await AIService.generateFollowUp(data);
    res.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Follow-up generation error:', err);
    res.status(500).json({ success: false, error: { code: 'FOLLOWUP_FAILED', message: 'Failed to generate follow-up' } });
  }
});

const reminderSchema = z.object({
  emailId: z.string().min(1),
  threadId: z.string().min(1),
  subject: z.string().min(1),
  recipientEmail: z.string().email(),
  followUpDays: z.number().min(1).max(365),
});

router.post('/follow-up/remind', async (req: Request, res: Response) => {
  try {
    const data = reminderSchema.parse(req.body);
    const scheduledAt = new Date(Date.now() + data.followUpDays * 24 * 60 * 60 * 1000);

    const reminder = await prisma.followUpReminder.create({
      data: {
        userId: req.user!.id,
        emailId: data.emailId,
        threadId: data.threadId,
        subject: data.subject,
        recipientEmail: data.recipientEmail,
        scheduledAt,
      },
    });

    res.json({ success: true, data: reminder });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Reminder creation error:', err);
    res.status(500).json({ success: false, error: { code: 'REMINDER_FAILED', message: 'Failed to create reminder' } });
  }
});

router.get('/follow-up/reminders', async (req: Request, res: Response) => {
  try {
    const reminders = await prisma.followUpReminder.findMany({
      where: { userId: req.user!.id, status: { in: ['PENDING', 'TRIGGERED'] } },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json({ success: true, data: reminders });
  } catch (err) {
    logger.error('Reminders list error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch reminders' } });
  }
});

router.delete('/follow-up/remind/:id', async (req: Request, res: Response) => {
  try {
    const reminder = await prisma.followUpReminder.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!reminder) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
      return;
    }

    await prisma.followUpReminder.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    });

    res.json({ success: true, data: { message: 'Reminder cancelled' } });
  } catch (err) {
    logger.error('Reminder cancel error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel reminder' } });
  }
});

router.post('/analyze-style', aiLimiter, async (req: Request, res: Response) => {
  try {
    const { emails } = req.body;
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'emails array is required' } });
      return;
    }

    const profile = await AIService.analyzeStyle(emails);
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { styleProfile: profile as any },
    });

    res.json({ success: true, data: profile });
  } catch (err) {
    logger.error('Style analysis error:', err);
    res.status(500).json({ success: false, error: { code: 'ANALYSIS_FAILED', message: 'Failed to analyze style' } });
  }
});

router.post('/detect-language', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'text is required' } });
      return;
    }
    const language = await AIService.detectLanguage(text);
    res.json({ success: true, data: { language } });
  } catch (err) {
    logger.error('Language detection error:', err);
    res.status(500).json({ success: false, error: { code: 'DETECTION_FAILED', message: 'Failed to detect language' } });
  }
});

// Send email via SMTP2Go (from @rmchomemortgage.com)
const sendSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(100000),
  isHtml: z.boolean().optional().default(false),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
});

router.post('/send', async (req: Request, res: Response) => {
  try {
    const data = sendSchema.parse(req.body);
    const result = await SMTP2GoService.sendEmail({
      to: data.to,
      subject: data.subject,
      body: data.body,
      isHtml: data.isHtml,
      replyTo: req.user!.email,
      cc: data.cc,
      bcc: data.bcc,
    });

    if (result.success) {
      await updateAnalytics(req.user!.id, 'compose');
      res.json({ success: true, data: { messageId: result.messageId, message: 'Email sent successfully' } });
    } else {
      res.status(500).json({ success: false, error: { code: 'SEND_FAILED', message: result.error || 'Failed to send email' } });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.errors } });
      return;
    }
    logger.error('Email send error:', err);
    res.status(500).json({ success: false, error: { code: 'SEND_FAILED', message: 'Failed to send email' } });
  }
});

async function updateAnalytics(userId: string, type: 'compose' | 'summarize' | 'tone_adjust', tone?: string): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];

    const analytics = await prisma.userAnalytics.upsert({
      where: { userId },
      create: { userId, dailyUsage: [], mostUsedTones: [] },
      update: {},
    });

    const updates: any = {};
    if (type === 'compose') {
      updates.emailsComposed = { increment: 1 };
      updates.timeSavedMinutes = { increment: 5 };
    } else if (type === 'summarize') {
      updates.emailsSummarized = { increment: 1 };
      updates.timeSavedMinutes = { increment: 2 };
    } else if (type === 'tone_adjust') {
      updates.toneAdjustments = { increment: 1 };
      updates.timeSavedMinutes = { increment: 1 };
    }

    await prisma.userAnalytics.update({ where: { userId }, data: updates });

    // Update daily usage
    const dailyUsage = (analytics.dailyUsage as any[]) || [];
    const todayEntry = dailyUsage.find((d: any) => d.date === today);
    if (todayEntry) {
      todayEntry.count += 1;
    } else {
      dailyUsage.push({ date: today, count: 1 });
    }
    // Keep last 90 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const filteredUsage = dailyUsage.filter((d: any) => new Date(d.date) >= cutoff);

    // Update most used tones
    if (tone) {
      const tones = (analytics.mostUsedTones as any[]) || [];
      const toneEntry = tones.find((t: any) => t.tone === tone);
      if (toneEntry) {
        toneEntry.count += 1;
      } else {
        tones.push({ tone, count: 1 });
      }
      await prisma.userAnalytics.update({
        where: { userId },
        data: { dailyUsage: filteredUsage, mostUsedTones: tones },
      });
    } else {
      await prisma.userAnalytics.update({
        where: { userId },
        data: { dailyUsage: filteredUsage },
      });
    }
  } catch (err) {
    logger.error('Analytics update error:', err);
  }
}

export default router;
