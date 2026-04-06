// GET    /api/users/:id — get user (admin only)
// PUT    /api/users/:id — update user (admin only)
// DELETE /api/users/:id — delete user (admin only)
import { hashPassword } from '../_lib/auth.js';
import { ok, badRequest, forbidden, notFound, serverError, parseBody } from '../_lib/response.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required');

  try {
    const record = await context.env.DB.prepare(
      'SELECT id, email, name, role, active, created_at, last_login FROM users WHERE id = ?'
    ).bind(context.params.id).first();
    if (!record) return notFound('User not found');
    return ok({ user: record });
  } catch {
    return serverError('Failed to fetch user');
  }
}

export async function onRequestPut(context) {
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required');

  const body = await parseBody(context.request);
  if (!body) return badRequest('Request body required');

  const targetId = context.params.id;

  // Prevent self-demotion of the only admin
  if (targetId === user.sub && body.role && body.role !== 'admin') {
    const { results } = await context.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM users WHERE role = 'admin' AND active = 1"
    ).all();
    if (results[0]?.cnt <= 1) {
      return badRequest('Cannot remove admin role from the only active admin');
    }
  }

  try {
    const record = await context.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(targetId).first();
    if (!record) return notFound('User not found');

    const updates = [];
    const values  = [];
    const allowed = ['name', 'email', 'role', 'active'];

    for (const field of allowed) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(field === 'email' ? body[field].toLowerCase() : body[field]);
      }
    }

    if (body.password) {
      if (body.password.length < 8) return badRequest('Password must be at least 8 characters');
      updates.push('password_hash = ?');
      values.push(await hashPassword(body.password));
    }

    if (!updates.length) return badRequest('No updatable fields provided');

    values.push(targetId);
    await context.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const updated = await context.env.DB.prepare(
      'SELECT id, email, name, role, active, created_at, last_login FROM users WHERE id = ?'
    ).bind(targetId).first();

    return ok({ user: updated });
  } catch (err) {
    console.error('Update user error:', err);
    return serverError('Failed to update user');
  }
}

export async function onRequestDelete(context) {
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required');

  const targetId = context.params.id;
  if (targetId === user.sub) return badRequest('Cannot delete your own account');

  try {
    const record = await context.env.DB.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).bind(targetId).first();
    if (!record) return notFound('User not found');

    // Soft-delete: deactivate instead of hard delete to preserve foreign key refs
    await context.env.DB.prepare(
      "UPDATE users SET active = 0 WHERE id = ?"
    ).bind(targetId).run();

    return ok({ message: 'User deactivated' });
  } catch {
    return serverError('Failed to delete user');
  }
}
