// POST /api/loans/:id/send-reminder
// One-click multi-channel reminder: fires email + SMS (+ optional voice)
// Body: { channels: ['email','sms','voice'], custom_message: '...' }
import { nanoid } from '../../_lib/auth.js';
import { ok, notFound, badRequest, serverError, parseBody } from '../../_lib/response.js';
import { auditLog } from '../../_lib/audit.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const user = context.data.user;
  const body = await parseBody(context.request) || {};

  const channels = body.channels || ['email', 'sms'];

  const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(params.id).first();
  if (!loan) return notFound('Loan not found');

  const { results: items } = await env.DB.prepare(
    "SELECT item FROM missing_items WHERE loan_id = ? AND status = 'pending' ORDER BY priority DESC"
  ).bind(params.id).all();

  const pendingItems = items.map(i => i.item);
  const firstName    = loan.borrower_name.split(' ')[0];
  const now          = new Date().toISOString();
  const results      = { email: null, sms: null, voice: null };

  // ── EMAIL ──────────────────────────────────────────────────────────────────
  if (channels.includes('email') && loan.borrower_email) {
    const fromEmail = env.FROM_EMAIL   || 'zzouhari@rmchomemortgage.com';
    const fromName  = env.SENDER_NAME  || 'Clearpath Processor';

    const itemsHtml = pendingItems.length
      ? '<ul style="margin:10px 0;padding-left:20px;">' + pendingItems.map(i => `<li style="margin:4px 0;">${i}</li>`).join('') + '</ul>'
      : '<p>Please contact your loan processor for details.</p>';

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;padding:20px;color:#1E293B;">
  <h2 style="color:#1E4976;margin-bottom:4px;">Action Required: Outstanding Documents</h2>
  <p style="color:#64748B;font-size:13px;margin-top:0;">Clearpath Processor — Loan Processing Platform</p>
  <hr style="border:1px solid #E2E8F0;margin:16px 0;">
  <p>Dear ${firstName},</p>
  <p>We are still waiting on the following items to continue processing your ${loan.loan_type || ''} loan${loan.property_address ? ' for ' + loan.property_address : ''}:</p>
  ${itemsHtml}
  <p>${body.custom_message || 'Please provide these items at your earliest convenience so we can move forward with your application.'}</p>
  <p style="margin-top:24px;">If you have any questions, please don't hesitate to reach out.</p>
  <p>Best regards,<br><strong>${fromName}</strong></p>
  <hr style="border:1px solid #E2E8F0;margin:16px 0;">
  <p style="font-size:11px;color:#94A3B8;">Clearpath Processor — A Clearpath Automation, LLC product</p>
</div>`;

    const smtp2goRes = await fetch('https://api.smtp2go.com/v3/email/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:   env.SMTP2GO_API_KEY,
        to:        [loan.borrower_email],
        sender:    `${fromName} <${fromEmail}>`,
        subject:   `Action Required: Missing Documents — ${loan.borrower_name}`,
        html_body: htmlBody,
        text_body: `Dear ${firstName},\n\nWe are still waiting on the following items:\n\n${pendingItems.map(i => '• ' + i).join('\n') || '(contact your processor)'}\n\n${body.custom_message || ''}\n\nBest regards,\n${fromName}`,
      }),
    }).catch(err => ({ ok: false, _err: err.message }));

    let emailSuccess = false;
    if (smtp2goRes?.json) {
      const d = await smtp2goRes.json().catch(() => ({}));
      emailSuccess = d?.data?.succeeded === 1;
      const logId = nanoid();
      await env.DB.prepare(`
        INSERT INTO email_log (id, loan_id, to_email, to_name, subject, body, template, sent_at, sent_by, status, error_msg)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        logId, params.id, loan.borrower_email, loan.borrower_name,
        `Action Required: Missing Documents — ${loan.borrower_name}`,
        htmlBody, 'missing_items', now, user.sub,
        emailSuccess ? 'sent' : 'failed',
        emailSuccess ? null : JSON.stringify(d)
      ).run().catch(() => {});
    }
    results.email = { success: emailSuccess, to: loan.borrower_email };
  }

  // ── SMS ────────────────────────────────────────────────────────────────────
  if (channels.includes('sms') && loan.borrower_phone) {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken  = env.TWILIO_AUTH_TOKEN;
    const fromPhone  = env.TWILIO_PHONE_NUMBER || '+18312823862';

    if (accountSid && authToken) {
      const toPhone = loan.borrower_phone.replace(/[^+\d]/g, '');
      const itemsShort = pendingItems.slice(0, 3).map(i => '• ' + i).join('\n');
      const smsBody = body.custom_message ||
        `Hi ${firstName}, your loan processor is waiting for:\n${itemsShort}${pendingItems.length > 3 ? `\n(+${pendingItems.length - 3} more items)` : ''}\nPlease provide these ASAP to avoid delays. Reply STOP to opt out.`;

      const twilioRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method:  'POST',
          headers: {
            'Content-Type':  'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
          },
          body: new URLSearchParams({ From: fromPhone, To: toPhone, Body: smsBody }),
        }
      ).catch(err => ({ ok: false, _err: err.message }));

      let smsSuccess = false;
      let twilioSid  = null;
      if (twilioRes?.json) {
        const td = await twilioRes.json().catch(() => ({}));
        smsSuccess = !!td?.sid;
        twilioSid  = td?.sid || null;
        const smsLogId = nanoid();
        await env.DB.prepare(`
          INSERT INTO sms_log (id, loan_id, to_phone, body, twilio_sid, sent_at, sent_by, status, error_msg)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          smsLogId, params.id, toPhone, smsBody, twilioSid, now, user.sub,
          smsSuccess ? 'sent' : 'failed',
          smsSuccess ? null : JSON.stringify(twilioRes._err || {})
        ).run().catch(() => {});
      }
      results.sms = { success: smsSuccess, to: toPhone, sid: twilioSid };
    } else {
      results.sms = { success: false, error: 'Twilio not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN missing)' };
    }
  }

  // ── VOICE ──────────────────────────────────────────────────────────────────
  if (channels.includes('voice') && loan.borrower_phone) {
    const agentId = env.ELEVENLABS_AGENT_ID;
    const apiKey  = env.ELEVENLABS_API_KEY;
    const fromPhone = env.TWILIO_PHONE_NUMBER || '+18312823862';

    if (agentId && apiKey) {
      const toPhone = loan.borrower_phone.replace(/[^+\d]/g, '');
      const callId  = nanoid();

      const elRes = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
        method:  'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          agent_phone_number_id: fromPhone,
          to_number: toPhone,
          conversation_initiation_client_data: {
            dynamic_variables: {
              borrower_name:    loan.borrower_name,
              missing_items:    pendingItems.slice(0, 5).join('; ') || 'a few outstanding items',
              processor_name:   user.name,
              loan_amount:      loan.loan_amount ? '$' + Number(loan.loan_amount).toLocaleString() : 'your loan',
              property_address: loan.property_address || 'the subject property',
              company_name:     'Clearpath Automation',
            },
          },
        }),
      }).catch(err => ({ ok: false, _err: err.message }));

      let voiceSuccess = false;
      let elevenlabsCallId = null;
      if (elRes?.json) {
        const ed = await elRes.json().catch(() => ({}));
        elevenlabsCallId = ed?.conversation_id || ed?.call_id || null;
        voiceSuccess     = elRes.ok || !!elevenlabsCallId;
        await env.DB.prepare(
          'INSERT INTO voice_call_log (id, loan_id, to_phone, elevenlabs_call_id, status, initiated_at, initiated_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(callId, params.id, toPhone, elevenlabsCallId, voiceSuccess ? 'initiated' : 'failed', now, user.sub).run().catch(() => {});
      }
      results.voice = { success: voiceSuccess, to: toPhone, call_id: callId };
    } else {
      results.voice = { success: false, error: 'ElevenLabs not configured' };
    }
  }

  await auditLog(env, {
    userId: user.sub, loanId: params.id, action: 'send_reminder',
    entityType: 'loan', entityId: params.id,
    detail: { channels, results },
    request: context.request,
  });

  return ok({
    message: 'Reminder sent via selected channels',
    results,
    channels_attempted: channels,
  });
}
