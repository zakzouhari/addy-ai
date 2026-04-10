// POST /api/loans/:id/submit-to-underwriter
// Three submission options:
//   (a) email_simplenexus — email to Simple Nexus intake address (loan # in subject)
//   (b) email_underwriter — email directly to underwriter
//   (c) download          — returns bundle manifest (UI handles download)
//
// Body: {
//   mode: 'email_simplenexus' | 'email_underwriter' | 'download',
//   underwriter_email?: string,        // for email_underwriter mode
//   simplenexus_email?: string,        // override setting
//   cover_letter_html?: string,        // pre-generated cover letter HTML (optional)
//   loan_number?: string,              // lender/Simple Nexus loan number
// }
import { nanoid } from '../../_lib/auth.js';
import { ok, notFound, badRequest, serverError, parseBody } from '../../_lib/response.js';
import { auditLog } from '../../_lib/audit.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const user = context.data.user;
  const body = await parseBody(context.request) || {};

  const mode = body.mode || 'download';
  if (!['email_simplenexus', 'email_underwriter', 'download'].includes(mode)) {
    return badRequest('mode must be email_simplenexus, email_underwriter, or download');
  }

  const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(params.id).first();
  if (!loan) return notFound('Loan not found');

  const { results: docs } = await env.DB.prepare('SELECT * FROM documents WHERE loan_id = ?').bind(params.id).all();

  const extracted  = loan.extracted_data ? JSON.parse(loan.extracted_data) : {};
  const loanNumber = body.loan_number || extracted.loan_number || params.id.slice(0, 8).toUpperCase();

  // ── Build bundle manifest (list of docs with categories) ──────────────────
  const docManifest = docs.map((d, i) => ({
    order:    i + 1,
    id:       d.id,
    name:     d.original_name,
    category: d.doc_category,
    r2_key:   d.r2_key,
    file_size: d.file_size,
    file_type: d.file_type,
  }));

  const now = new Date().toISOString();

  if (mode === 'download') {
    // Return the manifest; the UI handles downloading each file individually
    await auditLog(env, {
      userId: user.sub, loanId: params.id, action: 'submit_to_underwriter',
      entityType: 'loan', entityId: params.id,
      detail: { mode, loan_number: loanNumber, doc_count: docs.length },
      request: context.request,
    });

    return ok({
      mode:        'download',
      loan_number: loanNumber,
      borrower:    loan.borrower_name,
      documents:   docManifest,
      cover_letter_included: !!body.cover_letter_html,
      generated_at: now,
      instructions: 'Download each document using the /api/documents/:id/download endpoint, then upload to Simple Nexus or your underwriter portal.',
    });
  }

  // ── Email modes ────────────────────────────────────────────────────────────
  let toEmail, toName, subjectPrefix;

  if (mode === 'email_simplenexus') {
    // Read from KV settings or use body override
    toEmail = body.simplenexus_email || await getKvSetting(env, 'simplenexus_email');
    if (!toEmail) {
      return badRequest('Simple Nexus intake email not configured. Set it in Settings or provide simplenexus_email in the request body.');
    }
    toName       = 'Simple Nexus';
    subjectPrefix = `[Loan #${loanNumber}] Submission |`;
  } else {
    toEmail = body.underwriter_email || await getKvSetting(env, 'default_underwriter_email');
    if (!toEmail) {
      return badRequest('Underwriter email not provided. Provide underwriter_email in the request body or configure it in Settings.');
    }
    toName       = 'Underwriting Department';
    subjectPrefix = `[UW Submission | Loan #${loanNumber}]`;
  }

  const fromEmail = env.FROM_EMAIL  || 'zzouhari@rmchomemortgage.com';
  const fromName  = env.SENDER_NAME || 'Zak Zouhari | RMC Home Mortgage';

  const subject = `${subjectPrefix} ${loan.borrower_name} | ${loan.loan_type || ''} ${loan.loan_purpose || ''}`.trim();

  const coverLetterSection = body.cover_letter_html
    ? `<div style="border:1px solid #E2E8F0;border-radius:8px;padding:20px;margin-bottom:20px;">${body.cover_letter_html}</div>`
    : '';

  const docRows = docManifest.map(d =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;">${d.order}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;font-weight:500;">${d.category}</td>
     <td style="padding:6px 10px;border-bottom:1px solid #F1F5F9;">${d.name}</td></tr>`
  ).join('');

  const htmlBody = `
<div style="font-family:Arial,sans-serif;max-width:700px;padding:20px;color:#1E293B;">
  <div style="background:#1E4976;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:20px;">
    <h2 style="margin:0;font-size:18px;">Underwriter Submission Package</h2>
    <p style="margin:4px 0 0;font-size:13px;opacity:.85;">RMC Home Mortgage | NMLS #2116211</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <tr><td style="padding:6px 0;font-weight:500;color:#64748B;width:140px;">Loan Number:</td><td style="padding:6px 0;font-weight:700;font-size:16px;color:#1E4976;">${loanNumber}</td></tr>
    <tr><td style="padding:6px 0;font-weight:500;color:#64748B;">Borrower:</td><td style="padding:6px 0;">${loan.borrower_name}${loan.co_borrower_name ? ' / ' + loan.co_borrower_name : ''}</td></tr>
    <tr><td style="padding:6px 0;font-weight:500;color:#64748B;">Loan Amount:</td><td style="padding:6px 0;">${loan.loan_amount ? '$' + Number(loan.loan_amount).toLocaleString() : 'N/A'}</td></tr>
    <tr><td style="padding:6px 0;font-weight:500;color:#64748B;">Loan Type:</td><td style="padding:6px 0;">${loan.loan_type || 'N/A'} — ${loan.loan_purpose || ''}</td></tr>
    <tr><td style="padding:6px 0;font-weight:500;color:#64748B;">Property:</td><td style="padding:6px 0;">${loan.property_address || 'N/A'}</td></tr>
    <tr><td style="padding:6px 0;font-weight:500;color:#64748B;">Submitted By:</td><td style="padding:6px 0;">${user.name} — ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>
  </table>

  ${coverLetterSection}

  <h3 style="color:#1E4976;margin-bottom:8px;">Document Package (${docManifest.length} files)</h3>
  <table style="width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;">
    <thead><tr style="background:#F8FAFC;">
      <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B;">#</th>
      <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B;">Category</th>
      <th style="padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;color:#64748B;">Document</th>
    </tr></thead>
    <tbody>${docRows || '<tr><td colspan="3" style="padding:12px;color:#94A3B8;">No documents attached</td></tr>'}</tbody>
  </table>

  <p style="font-size:11px;color:#94A3B8;margin-top:20px;">
    Note: Documents are referenced above. The actual files should be uploaded to your underwriting portal.
    ${mode === 'email_simplenexus' ? 'Please use loan number <strong>' + loanNumber + '</strong> when uploading to Simple Nexus.' : ''}
  </p>
</div>`;

  // Send email
  const smtp2goRes = await fetch('https://api.smtp2go.com/v3/email/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:   env.SMTP2GO_API_KEY,
      to:        [`${toName} <${toEmail}>`],
      sender:    `${fromName} <${fromEmail}>`,
      subject,
      html_body: htmlBody,
      text_body: `Underwriter Submission — Loan #${loanNumber}\nBorrower: ${loan.borrower_name}\nLoan: ${loan.loan_type} ${loan.loan_purpose}\nProperty: ${loan.property_address}\n\nDocuments (${docManifest.length}): ${docManifest.map(d => d.name).join(', ')}`,
    }),
  });

  const smtp2goData = await smtp2goRes.json().catch(() => ({}));
  const success     = smtp2goData?.data?.succeeded === 1;

  // Log in email_log
  const logId = nanoid();
  await env.DB.prepare(`
    INSERT INTO email_log (id, loan_id, to_email, to_name, subject, body, template, sent_at, sent_by, status, error_msg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    logId, params.id, toEmail, toName, subject, htmlBody,
    'underwriter_submission', now, user.sub,
    success ? 'sent' : 'failed',
    success ? null : JSON.stringify(smtp2goData)
  ).run().catch(() => {});

  if (!success) {
    return serverError('Email sending failed: ' + (smtp2goData?.data?.error || 'Unknown SMTP error'));
  }

  await auditLog(env, {
    userId: user.sub, loanId: params.id, action: 'submit_to_underwriter',
    entityType: 'loan', entityId: params.id,
    detail: { mode, to: toEmail, loan_number: loanNumber, doc_count: docs.length },
    request: context.request,
  });

  return ok({
    message:     `Submission email sent to ${toEmail}`,
    mode,
    to:          toEmail,
    subject,
    loan_number: loanNumber,
    doc_count:   docs.length,
    log_id:      logId,
  });
}

async function getKvSetting(env, key) {
  try {
    return await env.KV.get(`setting:${key}`);
  } catch {
    return null;
  }
}
