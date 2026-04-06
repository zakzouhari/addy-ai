// POST /api/auth/setup — one-time initial user seeding
// Only runs if the users table is empty. Call once after DB migration.
import { hashPassword, nanoid } from '../_lib/auth.js';
import { ok, badRequest, serverError } from '../_lib/response.js';

const INITIAL_USERS = [
  { name: 'Zak Zouhari',       email: 'zzouhari@rmchomemortgage.com', role: 'admin',     password: 'AddyAI2024!' },
  { name: 'Alexandra Zouhari', email: 'azouhari@rmchomemortgage.com', role: 'assistant', password: 'AddyAI2024!' },
  { name: 'Jennifer Rosario',  email: 'jrosario@rmchomemortgage.com', role: 'processor', password: 'AddyAI2024!' },
];

export async function onRequestPost(context) {
  const { env } = context;

  try {
    // Check if already seeded
    const existing = await env.DB.prepare('SELECT COUNT(*) as cnt FROM users').first();
    if (existing?.cnt > 0) {
      return badRequest('Setup already completed. Users exist.');
    }

    const now = new Date().toISOString();
    const stmt = env.DB.prepare(
      'INSERT INTO users (id, email, name, password_hash, role, active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );

    for (const u of INITIAL_USERS) {
      const hash = await hashPassword(u.password);
      await stmt.bind(nanoid(), u.email, u.name, hash, u.role, now).run();
    }

    return ok({
      message: 'Setup complete. 3 users created.',
      users: INITIAL_USERS.map(u => ({ name: u.name, email: u.email, role: u.role })),
      defaultPassword: 'AddyAI2024!',
    });

  } catch (err) {
    console.error('Setup error:', err);
    return serverError('Setup failed: ' + err.message);
  }
}
