// PUT    /api/missing-items/:id — update status
// DELETE /api/missing-items/:id — remove item
import { ok, badRequest, notFound, serverError, parseBody } from '../_lib/response.js';

export async function onRequestPut(context) {
  const { env, params } = context;
  const body = await parseBody(context.request);
  if (!body?.status) return badRequest('status is required');

  const validStatuses = ['pending', 'received', 'waived'];
  if (!validStatuses.includes(body.status)) {
    return badRequest('status must be pending, received, or waived');
  }

  try {
    const item = await env.DB.prepare('SELECT id FROM missing_items WHERE id = ?').bind(params.id).first();
    if (!item) return notFound('Missing item not found');

    const now = new Date().toISOString();
    await env.DB.prepare(
      'UPDATE missing_items SET status = ?, updated_at = ? WHERE id = ?'
    ).bind(body.status, now, params.id).run();

    return ok({ id: params.id, status: body.status, updated_at: now });
  } catch {
    return serverError('Failed to update missing item');
  }
}

export async function onRequestDelete(context) {
  const { env, params } = context;
  try {
    const item = await env.DB.prepare('SELECT id FROM missing_items WHERE id = ?').bind(params.id).first();
    if (!item) return notFound('Missing item not found');

    await env.DB.prepare('DELETE FROM missing_items WHERE id = ?').bind(params.id).run();
    return ok({ message: 'Item deleted' });
  } catch {
    return serverError('Failed to delete missing item');
  }
}
