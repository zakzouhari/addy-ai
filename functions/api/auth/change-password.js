// POST /api/auth/change-password
import { verifyPassword, hashPassword } from '../_lib/auth.js';
import { ok, badRequest, unauthorized, serverError, parseBody } from '../_lib/response.js';

export async function onRequestPost(context) {
  const { env } = context;
  const user = context.data.user;
  const body = await parseBody(context.request);

  if (!body?.currentPassword || !body?.newPassword) {
    return badRequest('currentPassword and newPassword are required');
  }
  if (body.newPassword.length < 8) {
    return badRequest('New password must be at least 8 characters');
  }

  try {
    const record = await env.DB.prepare(
      'SELECT password_hash FROM users WHERE id = ?'
    ).bind(user.sub).first();

    const valid = await verifyPassword(body.currentPassword, record.password_hash);
    if (!valid) return unauthorized('Current password is incorrect');

    const newHash = await hashPassword(body.newPassword);
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .bind(newHash, user.sub).run();

    return ok({ message: 'Password updated successfully' });

  } catch (err) {
    console.error('Change password error:', err);
    return serverError('Failed to change password');
  }
}
