import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import config from './config';
import logger from './config/logger';
import { connectRedis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { startReminderCron } from './cron/reminders';

import authRoutes from './routes/auth';
import emailRoutes from './routes/email';
import knowledgeRoutes from './routes/knowledge';
import userRoutes from './routes/user';
import billingRoutes from './routes/billing';
import analyticsRoutes from './routes/analytics';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({
  origin: [
    config.dashboardUrl,
    'chrome-extension://*',
    'https://mail.google.com',
    'https://outlook.live.com',
    'https://outlook.office.com',
    'https://outlook.office365.com',
  ],
  credentials: true,
}));
app.use(compression());
app.use(morgan('short', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Stripe webhook needs raw body
app.use('/api/v1/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/email', emailRoutes);
app.use('/api/v1/knowledge', knowledgeRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Error handler
app.use(errorHandler);

async function start(): Promise<void> {
  await connectRedis();
  startReminderCron();

  app.listen(config.port, () => {
    logger.info(`SmartMail AI API running on port ${config.port} (${config.nodeEnv})`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

export default app;
