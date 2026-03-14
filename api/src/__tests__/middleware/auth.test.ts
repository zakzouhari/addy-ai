import { Request, Response, NextFunction } from 'express';
import { authenticate, requirePlan } from '../../middleware/auth';
import { mockUser, generateTestToken, TEST_JWT_SECRET } from '../setup';
import { prisma } from '../../config/prisma';
import jwt from 'jsonwebtoken';

beforeEach(() => {
  jest.clearAllMocks();
});

function createMockReqRes(authHeader?: string) {
  const req = { headers: { authorization: authHeader }, user: undefined } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('authenticate middleware', () => {
  it('should attach user to request with valid token', async () => {
    const token = generateTestToken();
    const { req, res, next } = createMockReqRes(`Bearer ${token}`);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: mockUser.id, email: mockUser.email, name: mockUser.name, plan: mockUser.plan });

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user!.id).toBe(mockUser.id);
  });

  it('should return 401 with missing token', async () => {
    const { req, res, next } = createMockReqRes();
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 with invalid token', async () => {
    const { req, res, next } = createMockReqRes('Bearer invalid-token');
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 with expired token', async () => {
    const expired = jwt.sign({ userId: mockUser.id, email: mockUser.email }, TEST_JWT_SECRET, { expiresIn: '0s' });
    const { req, res, next } = createMockReqRes(`Bearer ${expired}`);

    // Small delay to ensure token is expired
    await new Promise((r) => setTimeout(r, 10));
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requirePlan middleware', () => {
  it('should allow correct plans', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: mockUser.id, email: mockUser.email, name: mockUser.name, plan: 'PRO' };

    const middleware = requirePlan('PRO', 'ENTERPRISE');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject unauthorized plans', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: mockUser.id, email: mockUser.email, name: mockUser.name, plan: 'FREE' };

    const middleware = requirePlan('PRO', 'ENTERPRISE');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should return 401 if not authenticated', () => {
    const { req, res, next } = createMockReqRes();
    const middleware = requirePlan('PRO');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
