// GET  /api/users — list all users (admin only)
// POST /api/users — create user   (admin only)
import { hashPassword, nanoid } from '../_lib/auth.js';
import { ok, created, badRequest, forbidden, serverError, parseBody } from '../_lib/response.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required');

  try {
    const { results } = await context.env.DB.prepare(
      'SELECT id, email, name, role, active, created_at, last_login FROM users ORDER BY name ASC'
    ).all();
    return ok({ users: results });
  } catch (err) {
    return serverError('Failed to fetch users');
  }
}

export async function onRequestPost(context) {
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required');

  const body = await parseBody(context.request);
  if (!body?.email || !body?.name || !body?.password || !body?.role) {
    return badRequest('email, name, password, and role are required');
  }
  const validRoles = ['admin', 'processor', 'assistant'];
  if (!validRoles.includes(body.role)) {
    return badRequest('role must be admin, processor, or assistant');
  }
  if (body.password.length < 8) {
    return badRequest('Password must be at least 8 characters');
  }

  try {
    const existing = await context.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(body.email.toLowerCase()).first();
    if (existing) return badRequest('A user with that email already exists');

    const id   = nanoid();
    const hash = await hashPassword(body.password);
    const now  = new Date().toISOString();

    await context.env.DB.prepare(
      'INSERT INTO users (id, email, name, password_hash, role, active, created_at, created_by) VALUES (?, ?, ?, ?, ?, 1, ?, ?)'
    ).bind(id, body.email.toLowerCase(), body.name, hash, body.role, now, user.sub).run();

    return created({ user: { id, email: body.email.toLowerCase(), name: body.name, role: body.role, active: 1 } });
  } catch (err) {
    console.error('Create user error:', err);
    return serverError('Failed to create user');
  }
}
