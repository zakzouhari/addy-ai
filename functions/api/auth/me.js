// GET /api/auth/me — return current authenticated user
import { ok } from '../_lib/response.js';

export async function onRequestGet(context) {
  const user = context.data.user;
  return ok({ user: { id: user.sub, email: user.email, name: user.name, role: user.role } });
}
