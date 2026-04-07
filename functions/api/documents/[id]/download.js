// GET /api/documents/:id/download — stream document from storage
import { notFound, serverError } from '../../_lib/response.js';
import { getStorage } from '../../_lib/storage.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const doc = await env.DB.prepare(
      'SELECT original_name, file_type, r2_key FROM documents WHERE id = ?'
    ).bind(params.id).first();
    if (!doc) return notFound('Document not found');

    const obj = await getStorage(env).get(doc.r2_key);
    if (!obj) return notFound('File not found in storage');

    const headers = new Headers();
    headers.set('Content-Type', doc.file_type || 'application/octet-stream');
    headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(doc.original_name)}"`);
    headers.set('Cache-Control', 'private, max-age=3600');

    return new Response(obj.body, { status: 200, headers });
  } catch (err) {
    console.error('Download error:', err);
    return serverError('Download failed');
  }
}

// DELETE /api/documents/:id/download (actually delete the document)
export async function onRequestDelete(context) {
  const { env, params } = context;
  try {
    const doc = await env.DB.prepare(
      'SELECT r2_key, loan_id FROM documents WHERE id = ?'
    ).bind(params.id).first();
    if (!doc) return notFound('Document not found');

    await getStorage(env).delete(doc.r2_key).catch(() => {});
    await env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(params.id).run();
    await env.DB.prepare('UPDATE loans SET updated_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), doc.loan_id).run();

    return new Response(JSON.stringify({ message: 'Document deleted' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return serverError('Delete failed');
  }
}
