// ─────────────────────────────────────────────────────────────────────────────
// Addy AI — Auth middleware for all /api/* routes
// ─────────────────────────────────────────────────────────────────────────────
import { getTokenFromRequest, verifyToken } from './_lib/auth.js';
import { unauthorized } from './_lib/response.js';

// Routes that don't require a valid session
const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/setup',
];

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Always allow OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  // Skip auth for public paths
  if (PUBLIC_PATHS.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
    return next();
  }

  // Verify session token
  const token = getTokenFromRequest(request);
  if (!token) return unauthorized('No session');

  const secret = env.JWT_SECRET;
  if (!secret) return unauthorized('Server misconfiguration: missing JWT_SECRET');

  const user = await verifyToken(token, secret);
  if (!user) return unauthorized('Invalid or expired session');

  // Attach to context for downstream handlers
  context.data.user = user;
  return next();
}
