// POST /api/auth/logout
import { clearSessionCookie } from '../_lib/auth.js';
import { ok } from '../_lib/response.js';

export async function onRequestPost() {
  return ok({ message: 'Logged out' }, { 'Set-Cookie': clearSessionCookie() });
}
