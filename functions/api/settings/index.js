// GET  /api/settings  — retrieve app settings (admin only)
// POST /api/settings  — update app settings (admin only)
import { ok, badRequest, forbidden, serverError, parseBody } from '../_lib/response.js';
import { auditLog } from '../_lib/audit.js';

const ALLOWED_KEYS = [
  'simplenexus_email',
  'simplenexus_portal_url',
  'default_underwriter_email',
  'from_email',
  'sender_name',
  'company_name',
  'twilio_phone_number',
];

export async function onRequestGet(context) {
  const { env } = context;
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required');

  try {
    const settings = {};
    for (const key of ALLOWED_KEYS) {
      settings[key] = await env.KV.get(`setting:${key}`) || '';
    }
    return ok({ settings });
  } catch (err) {
    console.error('Get settings error:', err);
    return serverError('Failed to retrieve settings');
  }
}

export async function onRequestPost(context) {
  const { env } = context;
  const user = context.data.user;
  if (user.role !== 'admin') return forbidden('Admin access required');

  const body = await parseBody(context.request);
  if (!body) return badRequest('Request body required');

  try {
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      if (value !== null && value !== undefined) {
        await env.KV.put(`setting:${key}`, String(value));
      }
    }

    await auditLog(env, {
      userId: user.sub, action: 'update_settings',
      detail: { keys_updated: Object.keys(body).filter(k => ALLOWED_KEYS.includes(k)) },
      request: context.request,
    });

    return ok({ message: 'Settings saved', updated: Object.keys(body).filter(k => ALLOWED_KEYS.includes(k)) });
  } catch (err) {
    console.error('Save settings error:', err);
    return serverError('Failed to save settings');
  }
}
