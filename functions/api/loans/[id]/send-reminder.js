// POST /api/loans/:id/send-reminder
// One-click multi-channel reminder: fires email + SMS (+ optional voice)
// Body: { channels: ['email','sms','voice'], custom_message: '...' }
import { nanoid } from '../../_lib/auth.js';
import { ok, notFound, badRequest, serverError, parseBody } from '../../_lib/response.js';
import { auditLog } from '../../_lib/audit.js';

// Categorize missing items by document type for grouped display
function categorizeItems(items) {
  const groups = { Income: [], Assets: [], Identity: [], Property: [], Other: [] };
  const rules = [
    ['Income',   ['w2','paystub','pay stub','tax return','1040','employment','offer letter','social security','pension','alimony','child support','income','profit','loss','1099','self employ']],
    ['Assets',   ['bank','statement','checking','savings','investment','retirement','401k','ira','asset','gift','down payment','deposit']],
    ['Identity', ['id','driver','license','passport','social security','ssn','identification','government issued','government-issued','photo id']],
    ['Property', ['purchase','contract','appraisal','insurance','homeowner','hoa','title','property','listing','address','deed','condo']],
  ];
  for (const item of items) {
    const lower = item.toLowerCase();
    let placed = false;
    for (const [cat, keywords] of rules) {
      if (keywords.some(k => lower.includes(k))) { groups[cat].push(item); placed = true; break; }
    }
    if (!placed) groups.Other.push(item);
  }
  return groups;
}

function buildItemsHtml(items) {
  if (!items.length) return '<p style="color:#64748B;margin:0;">Contact me for details on what\'s needed.</p>';
  const groups = categorizeItems(items);
  let html = '';
  for (const [cat, catItems] of Object.entries(groups)) {
    if (!catItems.length) continue;
    html += `<div style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#3B82C4;margin-bottom:8px;">${cat}</div>
      ${catItems.map(i => `<div style="display:flex;align-items:flex-start;margin-bottom:6px;">
        <span style="min-width:16px;height:16px;border:2px solid #3B82C4;border-radius:3px;display:inline-block;margin:2px 10px 0 0;flex-shrink:0;"></span>
        <span style="color:#1E293B;font-size:14px;line-height:1.4;">${i}</span>
      </div>`).join('')}
    </div>`;
  }
  return html;
}

const SIGNATURE_HTML = `
<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td style="padding-right:16px;vertical-align:top;">
      <img src="https://lh3.googleusercontent.com/d/15kZbKSMPt8DrmkE0QkHXDilivRITsUJ8"
           alt="Zak Zouhari" width="64" height="64"
           style="border-radius:50%;border:2px solid #3B82C4;display:block;">
    </td>
    <td style="vertical-align:top;">
      <div style="font-weight:700;font-size:15px;color:#1E293B;line-height:1.3;">Zak Zouhari</div>
      <div style="font-size:13px;color:#64748B;line-height:1.6;">Mortgage Loan Originator | NMLS #1264079</div>
      <div style="font-size:13px;color:#64748B;line-height:1.6;">RMC Home Mortgage | NMLS #2116211</div>
      <div style="font-size:13px;color:#64748B;margin-top:4px;">(407) 388-5737 (Cell)&nbsp;&nbsp;(877) 478-7369 (Office)</div>
      <div style="margin-top:2px;"><a href="mailto:zzouhari@rmchomemortgage.com" style="font-size:13px;color:#3B82C4;text-decoration:none;">zzouhari@rmchomemortgage.com</a></div>
      <div style="font-size:12px;color:#94A3B8;margin-top:2px;">3999 West First Street, Suite A, Sanford, FL 32771</div>
    </td>
  </tr>
</table>`;

const SIGNATURE_TEXT = `Zak Zouhari
Mortgage Loan Originator | NMLS #1264079
RMC Home Mortgage | NMLS #2116211
(407) 388-5737 (Cell) | (877) 478-7369 (Office)
zzouhari@rmchomemortgage.com
3999 West First Street, Suite A, Sanford, FL 32771`;

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
    const fromEmail = env.FROM_EMAIL     || 'noreply@rmcclientexperience.com';
    const fromName  = env.SENDER_NAME   || 'Zak Zouhari | RMC Home Mortgage';
    const replyTo   = env.REPLY_TO_EMAIL || 'zzouhari@rmchomemortgage.com';

    const loanContext = (loan.loan_type || loan.property_address)
      ? `<p style="margin:0 0 20px;color:#64748B;font-size:13px;">${[loan.loan_type, loan.property_address].filter(Boolean).join(' &bull; ')}</p>`
      : '';

    const itemsHtml = buildItemsHtml(pendingItems);

    const closingMsg = body.custom_message
      ? `<p style="margin:20px 0 0;font-size:15px;">${body.custom_message}</p>`
      : `<p style="margin:20px 0 0;font-size:15px;">When you get a chance, send these over so we can keep your file on track. If you have questions about any of these, just call or text me.</p>`;

    const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #E2E8F0;">
  <div style="background:#3B82C4;padding:20px 28px;">
    <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-.01em;">RMC Home Mortgage</div>
    <div style="color:rgba(255,255,255,.75);font-size:12px;margin-top:3px;">NMLS #2116211</div>
  </div>
  <div style="padding:32px 28px;color:#1E293B;">
    <p style="margin:0 0 12px;font-size:16px;">Hey ${firstName},</p>
    <p style="margin:0 0 20px;font-size:15px;">Quick update on your loan. We still need a few documents to keep things moving.</p>
    ${loanContext}
    <div style="background:#F0F7FF;border-left:4px solid #3B82C4;border-radius:0 8px 8px 0;padding:18px 20px;margin-bottom:8px;">
      <div style="font-weight:600;color:#1E293B;margin-bottom:14px;font-size:14px;">Items still needed:</div>
      ${itemsHtml}
    </div>
    ${closingMsg}
    <p style="margin:28px 0 0;font-size:15px;font-weight:500;">Thanks,</p>
  </div>
  <div style="padding:20px 28px;border-top:1px solid #E2E8F0;background:#F8FAFC;">
    ${SIGNATURE_HTML}
  </div>
</div>`;

    const textBody = `Hey ${firstName},

Quick update on your loan. We still need a few documents to keep things moving.

Items still needed:
${pendingItems.map(i => '  \u2022 ' + i).join('\n') || '  (call or text me for details)'}

${body.custom_message || 'When you get a chance, send these over so we can keep your file on track. If you have questions about any of these, just call or text me.'}

Thanks,
${SIGNATURE_TEXT}`;

    const smtp2goRes = await fetch('https://api.smtp2go.com/v3/email/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:   env.SMTP2GO_API_KEY,
        to:        [loan.borrower_email],
        sender:    `${fromName} <${fromEmail}>`,
        reply_to:  `Zak Zouhari <${replyTo}>`,
        subject:   `Action Required: Missing Documents for ${loan.borrower_name}`,
        html_body: htmlBody,
        text_body: textBody,
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
        `Action Required: Missing Documents for ${loan.borrower_name}`,
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
      const itemsShort = pendingItems.slice(0, 3).map(i => '\u2022 ' + i).join('\n');
      const smsBody = body.custom_message ||
        `Hey ${firstName}, quick update on your loan. We still need:\n${itemsShort}${pendingItems.length > 3 ? `\n(+${pendingItems.length - 3} more items)` : ''}\n\nJust reply here or call me at (407) 388-5737. Reply STOP to opt out.\n\nZak Zouhari | RMC Home Mortgage`;

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
              company_name:     'RMC Home Mortgage',
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
