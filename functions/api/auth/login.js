// POST /api/auth/login
import { verifyPassword, createToken, sessionCookie } from '../_lib/auth.js';
import { ok, badRequest, unauthorized, parseBody, serverError } from '../_lib/response.js';

export async function onRequestPost(context) {
  const { env } = context;
  const body = await parseBody(context.request);
  if (!body?.email || !body?.password) {
    return badRequest('Email and password are required');
  }

  const email = body.email.trim().toLowerCase();

  try {
    const user = await env.DB.prepare(
      'SELECT id, email, name, role, password_hash, active FROM users WHERE email = ?'
    ).bind(email).first();

    if (!user) return unauthorized('Invalid email or password');
    if (!user.active) return unauthorized('Account is deactivated. Contact your administrator.');

    const valid = await verifyPassword(body.password, user.password_hash);
    if (!valid) return unauthorized('Invalid email or password');

    // Update last_login
    await env.DB.prepare('UPDATE users SET last_login = ? WHERE id = ?')
      .bind(new Date().toISOString(), user.id).run();

    const secret = env.JWT_SECRET;
    if (!secret) return serverError('Server misconfiguration');

    const token = await createToken({
      sub:   user.id,
      email: user.email,
      name:  user.name,
      role:  user.role,
      exp:   Math.floor(Date.now() / 1000) + 86400,
    }, secret);

    return ok({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }, { 'Set-Cookie': sessionCookie(token) });

  } catch (err) {
    console.error('Login error:', err);
    return serverError('Login failed');
  }
}
