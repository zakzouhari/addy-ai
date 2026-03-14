import dotenv from 'dotenv';
dotenv.config();

const config = {
  port: parseInt(process.env.API_PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:3000',
  extensionId: process.env.EXTENSION_ID || '',
  // Team access control: comma-separated list of allowed email addresses
  // If empty or not set, all Google accounts can sign up
  allowedEmails: process.env.ALLOWED_EMAILS
    ? process.env.ALLOWED_EMAILS.split(',').map((e) => e.trim().toLowerCase())
    : [],
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/google/callback',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessExpiresIn: '15m' as const,
    refreshExpiresIn: '7d' as const,
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || '',
  },
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY || '',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef',
  },
  smtp2go: {
    apiKey: process.env.SMTP2GO_API_KEY || '',
    senderEmail: process.env.SMTP2GO_SENDER_EMAIL || 'zzouhari@rmchomemortgage.com',
    senderName: process.env.SMTP2GO_SENDER_NAME || 'Zak Zouhari',
  },
};

export default config;
