import request from 'supertest';
import express from 'express';
import knowledgeRoutes from '../../routes/knowledge';
import { mockUser, generateTestToken } from '../setup';
import { prisma } from '../../config/prisma';

const app = express();
app.use(express.json());
app.use('/api/v1/knowledge', knowledgeRoutes);

const token = generateTestToken();
const authHeader = { Authorization: `Bearer ${token}` };

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
});

describe('POST /api/v1/knowledge/upload', () => {
  it('should accept text document', async () => {
    (prisma.knowledgeDocument.count as jest.Mock).mockResolvedValue(0);
    (prisma.knowledgeDocument.create as jest.Mock).mockResolvedValue({
      id: 'doc-1', title: 'Test Doc', sourceType: 'TEXT', status: 'PROCESSING',
    });

    const res = await request(app).post('/api/v1/knowledge/upload').set(authHeader).send({
      title: 'Test Doc', sourceType: 'text', content: 'This is test content for the knowledge base.',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should reject when exceeding plan limit', async () => {
    (prisma.knowledgeDocument.count as jest.Mock).mockResolvedValue(3);

    const res = await request(app).post('/api/v1/knowledge/upload').set(authHeader).send({
      title: 'Test', sourceType: 'text', content: 'Content',
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('LIMIT_REACHED');
  });

  it('should reject empty content', async () => {
    (prisma.knowledgeDocument.count as jest.Mock).mockResolvedValue(0);

    const res = await request(app).post('/api/v1/knowledge/upload').set(authHeader).send({
      title: 'Test', sourceType: 'text', content: '  ',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/v1/knowledge', () => {
  it('should list user documents', async () => {
    (prisma.knowledgeDocument.findMany as jest.Mock).mockResolvedValue([]);
    const res = await request(app).get('/api/v1/knowledge').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('DELETE /api/v1/knowledge/:id', () => {
  it('should delete document', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue({ id: 'doc-1', userId: mockUser.id });
    (prisma.knowledgeDocument.delete as jest.Mock).mockResolvedValue({});

    const res = await request(app).delete('/api/v1/knowledge/doc-1').set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 for non-existent document', async () => {
    (prisma.knowledgeDocument.findFirst as jest.Mock).mockResolvedValue(null);
    const res = await request(app).delete('/api/v1/knowledge/non-existent').set(authHeader);
    expect(res.status).toBe(404);
  });
});
