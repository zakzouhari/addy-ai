// GET    /api/loans/:id — get loan with documents, missing items, email log
// PUT    /api/loans/:id — update loan
// DELETE /api/loans/:id — delete loan (admin only)
import { ok, badRequest, forbidden, notFound, serverError, parseBody } from '../_lib/response.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const loan = await env.DB.prepare(`
      SELECT l.*, u.name AS assigned_name, c.name AS creator_name
      FROM   loans l
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN users c ON l.created_by  = c.id
      WHERE  l.id = ?
    `).bind(params.id).first();
    if (!loan) return notFound('Loan not found');

    const [docs, items, emails] = await Promise.all([
      env.DB.prepare(
        'SELECT id, original_name, file_type, file_size, doc_category, uploaded_at, analyzed, analysis FROM documents WHERE loan_id = ? ORDER BY uploaded_at DESC'
      ).bind(params.id).all(),
      env.DB.prepare(
        'SELECT * FROM missing_items WHERE loan_id = ? ORDER BY created_at ASC'
      ).bind(params.id).all(),
      env.DB.prepare(
        'SELECT id, to_email, to_name, subject, sent_at, status, template FROM email_log WHERE loan_id = ? ORDER BY sent_at DESC'
      ).bind(params.id).all(),
    ]);

    return ok({
      loan,
      documents:     docs.results,
      missing_items: items.results,
      emails:        emails.results,
    });
  } catch (err) {
    console.error('Get loan error:', err);
    return serverError('Failed to fetch loan');
  }
}

export async function onRequestPut(context) {
  const { env, params } = context;
  const body = await parseBody(context.request);
  if (!body) return badRequest('Request body required');

  const loan = await env.DB.prepare('SELECT id FROM loans WHERE id = ?').bind(params.id).first();
  if (!loan) return notFound('Loan not found');

  const allowed = [
    'borrower_name','borrower_email','borrower_phone','co_borrower_name',
    'loan_amount','property_address','property_type','loan_type','loan_purpose',
    'status','assigned_to','notes','extracted_data',
  ];
  const updates = [];
  const values  = [];

  for (const field of allowed) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }
  if (!updates.length) return badRequest('No updatable fields provided');

  updates.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(params.id);

  try {
    await env.DB.prepare(`UPDATE loans SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    const updated = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(params.id).first();
    return ok({ loan: updated });
  } catch (err) {
    console.error('Update loan error:', err);
    return serverError('Failed to update loan');
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required to delete loans');

  try {
    const loan = await env.DB.prepare('SELECT id FROM loans WHERE id = ?').bind(params.id).first();
    if (!loan) return notFound('Loan not found');

    // Delete R2 documents first
    const { results: docs } = await env.DB.prepare(
      'SELECT r2_key FROM documents WHERE loan_id = ?'
    ).bind(params.id).all();

    for (const doc of docs) {
      await env.DOCUMENTS.delete(doc.r2_key).catch(() => {});
    }

    // Cascade delete handled by DB foreign keys (ON DELETE CASCADE)
    await env.DB.prepare('DELETE FROM loans WHERE id = ?').bind(params.id).run();
    return ok({ message: 'Loan deleted' });
  } catch (err) {
    console.error('Delete loan error:', err);
    return serverError('Failed to delete loan');
  }
}
