import jwt from 'jsonwebtoken';

// Mock Prisma
jest.mock('../config/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), findFirst: jest.fn() },
    refreshToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    knowledgeDocument: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn(), count: jest.fn(), update: jest.fn() },
    knowledgeChunk: { findMany: jest.fn() },
    followUpReminder: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    userAnalytics: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    $executeRawUnsafe: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  },
}));

// Mock Redis
jest.mock('../config/redis', () => ({
  redis: { get: jest.fn(), set: jest.fn(), connect: jest.fn() },
  connectRedis: jest.fn(),
}));

// Mock logger
jest.mock('../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"summary":"Test summary","keyPoints":["point1"],"actionItems":[],"deadlines":[],"mentionedPeople":[]}' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  }));
});

export const TEST_JWT_SECRET = 'test-secret';
process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  googleId: 'google-123',
  avatarUrl: null,
  plan: 'FREE' as const,
  settings: { defaultTone: 'friendly', signature: '', language: 'en', followUpDefaultDays: 3, knowledgeBaseEnabled: true, autoDetectLanguage: true },
  styleProfile: null,
  stripeCustomerId: null,
  stripeSubscriptionId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

export function generateTestToken(userId: string = mockUser.id, email: string = mockUser.email): string {
  return jwt.sign({ userId, email }, TEST_JWT_SECRET, { expiresIn: '1h' });
}
