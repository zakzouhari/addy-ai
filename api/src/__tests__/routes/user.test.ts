import request from 'supertest';
import express from 'express';
import userRoutes from '../../routes/user';
import { mockUser, generateTestToken } from '../setup';
import { prisma } from '../../config/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/user', userRoutes);

const token = generateTestToken();
const authHeader = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
});

describe('GET /api/v1/user/me', () => {
  it('should return user profile', async () => {
    const res = await request(app).get('/api/v1/user/me').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(mockUser.email);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get('/api/v1/user/me');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/user/settings', () => {
  it('should update settings', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ ...mockUser, settings: { ...mockUser.settings, defaultTone: 'formal' } });

    const res = await request(app).patch('/api/v1/user/settings').set(authHeader).send({ defaultTone: 'formal' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject invalid tone', async () => {
    const res = await request(app).patch('/api/v1/user/settings').set(authHeader).send({ defaultTone: 'bad_tone' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/user/style-profile', () => {
  it('should return style profile', async () => {
    const res = await request(app).get('/api/v1/user/style-profile').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
