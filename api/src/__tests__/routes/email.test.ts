import request from 'supertest';
import express from 'express';
import emailRoutes from '../../routes/email';
import { mockUser, generateTestToken } from '../setup';
import { prisma } from '../../config/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/email', emailRoutes);

const token = generateTestToken();
const authHeader = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
  (prisma.userAnalytics.upsert as jest.Mock).mockResolvedValue({ userId: mockUser.id, dailyUsage: [], mostUsedTones: [] });
  (prisma.userAnalytics.update as jest.Mock).mockResolvedValue({});
});

describe('POST /api/v1/email/compose', () => {
  it('should return 401 without auth token', async () => {
    const res = await request(app).post('/api/v1/email/compose').send({ topic: 'test', tone: 'friendly' });
    expect(res.status).toBe(401);
  });

  it('should reject missing topic', async () => {
    const res = await request(app).post('/api/v1/email/compose').set(authHeader).send({ tone: 'friendly' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should reject invalid tone', async () => {
    const res = await request(app).post('/api/v1/email/compose').set(authHeader).send({ topic: 'test', tone: 'invalid_tone' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/email/summarize', () => {
  it('should reject empty content', async () => {
    const res = await request(app).post('/api/v1/email/summarize').set(authHeader).send({ emailContent: '' });
    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).post('/api/v1/email/summarize').send({ emailContent: 'test email' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/email/adjust-tone', () => {
  it('should reject invalid adjustment type', async () => {
    const res = await request(app).post('/api/v1/email/adjust-tone').set(authHeader).send({ text: 'hello', adjustment: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('should reject empty text', async () => {
    const res = await request(app).post('/api/v1/email/adjust-tone').set(authHeader).send({ text: '', adjustment: 'more_formal' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/email/follow-up/remind', () => {
  it('should create reminder with valid data', async () => {
    const reminderData = {
      emailId: 'email-1', threadId: 'thread-1', subject: 'Test',
      recipientEmail: 'recipient@example.com', followUpDays: 3,
    };
    (prisma.followUpReminder.create as jest.Mock).mockResolvedValue({ id: 'rem-1', ...reminderData, status: 'PENDING' });

    const res = await request(app).post('/api/v1/email/follow-up/remind').set(authHeader).send(reminderData);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject invalid email', async () => {
    const res = await request(app).post('/api/v1/email/follow-up/remind').set(authHeader).send({
      emailId: 'email-1', threadId: 'thread-1', subject: 'Test',
      recipientEmail: 'not-an-email', followUpDays: 3,
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/email/follow-up/reminders', () => {
  it('should list user reminders', async () => {
    (prisma.followUpReminder.findMany as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/api/v1/email/follow-up/reminders').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
  });
});

describe('DELETE /api/v1/email/follow-up/remind/:id', () => {
  it('should return 404 for non-existent reminder', async () => {
    (prisma.followUpReminder.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await request(app).delete('/api/v1/email/follow-up/remind/non-existent').set(authHeader);
    expect(res.status).toBe(404);
  });

  it('should cancel existing reminder', async () => {
    (prisma.followUpReminder.findFirst as jest.Mock).mockResolvedValue({ id: 'rem-1', userId: mockUser.id });
    (prisma.followUpReminder.update as jest.Mock).mockResolvedValue({ id: 'rem-1', status: 'CANCELLED' });

    const res = await request(app).delete('/api/v1/email/follow-up/remind/rem-1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
