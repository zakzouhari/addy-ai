// POST /api/documents/upload  (multipart/form-data: loanId, category, file)
import { nanoid } from '../_lib/auth.js';
import { ok, created, badRequest, notFound, serverError } from '../_lib/response.js';
import { getStorage } from '../_lib/storage.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function onRequestPost(context) {
  const { env } = context;
  const user = context.data.user;

  let formData;
  try {
    formData = await context.request.formData();
  } catch {
    return badRequest('Expected multipart/form-data');
  }

  const loanId   = formData.get('loanId');
  const category = formData.get('category') || 'Other';
  const file     = formData.get('file');

  if (!loanId)       return badRequest('loanId is required');
  if (!file || typeof file === 'string') return badRequest('file is required');

  if (file.size > MAX_FILE_SIZE) {
    return badRequest('File exceeds 25 MB limit');
  }

  // Verify loan exists
  const loan = await env.DB.prepare('SELECT id FROM loans WHERE id = ?').bind(loanId).first();
  if (!loan) return notFound('Loan not found');

  const docId    = nanoid();
  const ext      = file.name.split('.').pop()?.toLowerCase() || '';
  const safeKey  = `loans/${loanId}/${docId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const now      = new Date().toISOString();

  try {
    const bytes   = await file.arrayBuffer();
    const storage = getStorage(env);

    // Store in R2 (or KV fallback)
    await storage.put(safeKey, bytes, {
      httpMetadata: { contentType: file.type || 'application/octet-stream' },
      customMetadata: { uploadedBy: user.sub, loanId, docId },
    });

    // Save metadata in D1
    await env.DB.prepare(`
      INSERT INTO documents (id, loan_id, original_name, file_type, file_size, r2_key, doc_category, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(docId, loanId, file.name, file.type, file.size, safeKey, category, user.sub, now).run();

    // Update loan updated_at
    await env.DB.prepare('UPDATE loans SET updated_at = ? WHERE id = ?').bind(now, loanId).run();

    return created({
      document: {
        id: docId,
        loan_id: loanId,
        original_name: file.name,
        file_type: file.type,
        file_size: file.size,
        doc_category: category,
        uploaded_at: now,
        analyzed: 0,
      },
    });
  } catch (err) {
    console.error('Upload error:', err);
    // Try to clean up storage if DB failed
    await getStorage(env).delete(safeKey).catch(() => {});
    return serverError('Upload failed');
  }
}
