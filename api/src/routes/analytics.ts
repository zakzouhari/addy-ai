import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response) => {
  try {
    const analytics = await prisma.userAnalytics.findUnique({
      where: { userId: req.user!.id },
    });

    if (!analytics) {
      res.json({
        success: true,
        data: {
          emailsComposed: 0,
          emailsSummarized: 0,
          toneAdjustments: 0,
          timeSavedMinutes: 0,
          mostUsedTones: [],
          dailyUsage: [],
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        emailsComposed: analytics.emailsComposed,
        emailsSummarized: analytics.emailsSummarized,
        toneAdjustments: analytics.toneAdjustments,
        timeSavedMinutes: analytics.timeSavedMinutes,
        mostUsedTones: analytics.mostUsedTones,
        dailyUsage: analytics.dailyUsage,
      },
    });
  } catch (err) {
    logger.error('Get analytics error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get analytics' } });
  }
});

export default router;
