import cron from 'node-cron';
import { prisma } from '../config/prisma';
import logger from '../config/logger';

export function startReminderCron(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const dueReminders = await prisma.followUpReminder.findMany({
        where: {
          status: 'PENDING',
          scheduledAt: { lte: new Date() },
        },
        include: { user: { select: { email: true, name: true } } },
      });

      if (dueReminders.length === 0) return;

      logger.info(`Processing ${dueReminders.length} due follow-up reminders`);

      for (const reminder of dueReminders) {
        await prisma.followUpReminder.update({
          where: { id: reminder.id },
          data: { status: 'TRIGGERED' },
        });

        logger.info(
          `Reminder triggered for user ${reminder.user.email}: Follow up with ${reminder.recipientEmail} about "${reminder.subject}"`
        );
        // In production, this would send a push notification via web-push or FCM
      }
    } catch (err) {
      logger.error('Reminder cron error:', err);
    }
  });

  logger.info('Follow-up reminder cron job started (every 5 minutes)');
}
