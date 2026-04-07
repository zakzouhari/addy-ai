// ─────────────────────────────────────────────────────────────────────────────
// Clearpath Processor — Audit logging helper
// ─────────────────────────────────────────────────────────────────────────────
import { nanoid } from './auth.js';

/**
 * Log an action to the audit_log table.
 * Does not throw — failures are logged to console only.
 */
export async function auditLog(env, { userId, loanId, action, entityType, entityId, detail, request }) {
  try {
    const ip        = request?.headers?.get('CF-Connecting-IP') || request?.headers?.get('X-Forwarded-For') || null;
    const userAgent = request?.headers?.get('User-Agent')?.slice(0, 200) || null;
    const now       = new Date().toISOString();

    await env.DB.prepare(`
      INSERT INTO audit_log (id, user_id, loan_id, action, entity_type, entity_id, detail, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      nanoid(),
      userId   || null,
      loanId   || null,
      action,
      entityType || null,
      entityId   || null,
      detail ? JSON.stringify(detail) : null,
      ip,
      userAgent,
      now
    ).run();
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}
