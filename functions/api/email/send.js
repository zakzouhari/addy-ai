// POST /api/email/send — send email via SMTP2Go and log in D1
import { nanoid } from '../_lib/auth.js';
import { ok, badRequest, serverError, parseBody } from '../_lib/response.js';

export async function onRequestPost(context) {
  const { env } = context;
  const user = context.data.user;
  const body = await parseBody(context.request);

  if (!body?.to || !body?.subject || !body?.html) {
    return badRequest('to, subject, and html are required');
  }

  const fromEmail  = env.FROM_EMAIL     || 'noreply@rmcclientexperience.com';
  const fromName   = env.SENDER_NAME   || 'Zak Zouhari | RMC Home Mortgage';
  const replyTo    = env.REPLY_TO_EMAIL || 'zzouhari@rmchomemortgage.com';
  const loanId    = body.loan_id || null;
  const template  = body.template || 'custom';

  try {
    // Send via SMTP2Go REST API
    const smtp2goRes = await fetch('https://api.smtp2go.com/v3/email/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:    env.SMTP2GO_API_KEY,
        to:         [body.to],
        sender:     `${fromName} <${fromEmail}>`,
        reply_to:   `Zak Zouhari <${replyTo}>`,
        subject:    body.subject,
        html_body:  body.html,
        text_body:  body.text || stripHtml(body.html),
      }),
    });

    const smtp2goData = await smtp2goRes.json().catch(() => ({}));
    const success     = smtp2goData?.data?.succeeded === 1;

    const now    = new Date().toISOString();
    const logId  = nanoid();
    const status = success ? 'sent' : 'failed';
    const errMsg = success ? null : JSON.stringify(smtp2goData);

    // Log the email
    await env.DB.prepare(`
      INSERT INTO email_log (id, loan_id, to_email, to_name, subject, body, template, sent_at, sent_by, status, error_msg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      logId, loanId,
      typeof body.to === 'string' ? body.to : body.to[0],
      body.to_name || null,
      body.subject, body.html,
      template, now, user.sub,
      status, errMsg
    ).run();

    if (!success) {
      console.error('SMTP2Go error:', smtp2goData);
      return serverError('Email sending failed: ' + (smtp2goData?.data?.error || 'Unknown error'));
    }

    return ok({ message: 'Email sent successfully', log_id: logId });

  } catch (err) {
    console.error('Send email error:', err);
    return serverError('Failed to send email');
  }
}

function stripHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
