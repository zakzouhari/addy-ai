// GET  /api/loans — list loans
// POST /api/loans — create loan
import { nanoid } from '../_lib/auth.js';
import { ok, created, badRequest, serverError, parseBody } from '../_lib/response.js';

export async function onRequestGet(context) {
  const { env } = context;
  const url    = new URL(context.request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('q');

  try {
    let sql = `
      SELECT l.*,
             u.name AS assigned_name
      FROM   loans l
      LEFT JOIN users u ON l.assigned_to = u.id
    `;
    const binds = [];
    const where = [];

    if (status) { where.push('l.status = ?'); binds.push(status); }
    if (search) {
      where.push('(l.borrower_name LIKE ? OR l.property_address LIKE ? OR l.borrower_email LIKE ?)');
      const q = `%${search}%`;
      binds.push(q, q, q);
    }
    if (where.length) sql += ' WHERE ' + where.join(' AND ');
    sql += ' ORDER BY l.updated_at DESC LIMIT 200';

    const { results } = await env.DB.prepare(sql).bind(...binds).all();
    return ok({ loans: results });
  } catch (err) {
    console.error('List loans error:', err);
    return serverError('Failed to fetch loans');
  }
}

export async function onRequestPost(context) {
  const { env } = context;
  const user = context.data.user;
  const body = await parseBody(context.request);

  if (!body?.borrower_name) return badRequest('borrower_name is required');

  const id  = nanoid();
  const now = new Date().toISOString();

  try {
    await env.DB.prepare(`
      INSERT INTO loans (
        id, borrower_name, borrower_email, borrower_phone, co_borrower_name,
        loan_amount, property_address, property_type, loan_type, loan_purpose,
        status, assigned_to, notes, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.borrower_name,
      body.borrower_email   || null,
      body.borrower_phone   || null,
      body.co_borrower_name || null,
      body.loan_amount      || null,
      body.property_address || null,
      body.property_type    || null,
      body.loan_type        || null,
      body.loan_purpose     || null,
      body.status           || 'application',
      body.assigned_to      || user.sub,
      body.notes            || null,
      now, now,
      user.sub
    ).run();

    const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(id).first();
    return created({ loan });
  } catch (err) {
    console.error('Create loan error:', err);
    return serverError('Failed to create loan');
  }
}
