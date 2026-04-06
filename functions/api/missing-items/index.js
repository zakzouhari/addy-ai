// GET  /api/missing-items?loanId=xxx — list missing items for a loan
// POST /api/missing-items            — create missing item
import { nanoid } from '../_lib/auth.js';
import { ok, created, badRequest, serverError, parseBody } from '../_lib/response.js';

export async function onRequestGet(context) {
  const { env } = context;
  const url    = new URL(context.request.url);
  const loanId = url.searchParams.get('loanId');
  if (!loanId) return badRequest('loanId query parameter required');

  try {
    const { results } = await env.DB.prepare(
      'SELECT * FROM missing_items WHERE loan_id = ? ORDER BY created_at ASC'
    ).bind(loanId).all();
    return ok({ missing_items: results });
  } catch {
    return serverError('Failed to fetch missing items');
  }
}

export async function onRequestPost(context) {
  const { env } = context;
  const body = await parseBody(context.request);
  if (!body?.loan_id || !body?.item) return badRequest('loan_id and item are required');

  const now = new Date().toISOString();
  const id  = nanoid();

  try {
    await env.DB.prepare(
      'INSERT INTO missing_items (id, loan_id, item, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, body.loan_id, body.item.trim(), 'pending', 'manual', now, now).run();

    return created({ missing_item: { id, loan_id: body.loan_id, item: body.item.trim(), status: 'pending', source: 'manual', created_at: now } });
  } catch (err) {
    return serverError('Failed to create missing item');
  }
}
