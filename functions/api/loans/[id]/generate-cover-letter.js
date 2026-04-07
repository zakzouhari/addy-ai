// POST /api/loans/:id/generate-cover-letter
// AI-generated professional underwriter cover letter
import { ok, notFound, serverError } from '../../_lib/response.js';
import { auditLog } from '../../_lib/audit.js';

const SYSTEM_PROMPT = `You are a senior mortgage loan processor writing a professional cover letter to an underwriter.
The letter should be formal, concise, and highlight the strengths of the loan file.
Structure the letter with these sections:
1. Header (date, to: Underwriting Department, from: processor name/company)
2. Subject line with borrower name and loan purpose
3. Opening paragraph: introduce the loan
4. Borrower profile: income, employment, credit highlights
5. Loan summary: amount, type, purpose, LTV, property
6. Key strengths and compensating factors
7. Document checklist (list all attached docs)
8. Any special notes or considerations
9. Professional closing

Respond with only the HTML cover letter body (no <html>/<body> tags), using clean inline styles for professional formatting. Use #1E4976 as the primary color for headings.`;

export async function onRequestPost(context) {
  const { env, params } = context;
  const user = context.data.user;

  try {
    const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(params.id).first();
    if (!loan) return notFound('Loan not found');

    const { results: docs }  = await env.DB.prepare('SELECT * FROM documents WHERE loan_id = ?').bind(params.id).all();
    const { results: items } = await env.DB.prepare(
      "SELECT * FROM missing_items WHERE loan_id = ? AND status = 'pending'"
    ).bind(params.id).all();

    const extracted = loan.extracted_data ? JSON.parse(loan.extracted_data) : {};

    // Gather any doc analysis data
    const analyzedDocs = docs.filter(d => d.analyzed && d.analysis);
    const analysisData = analyzedDocs.map(d => {
      try {
        const a = JSON.parse(d.analysis);
        return `${d.doc_category} (${d.original_name}): ${a.summary || ''}`;
      } catch { return ''; }
    }).filter(Boolean);

    const profileText = `
LOAN FILE DETAILS:
Borrower: ${loan.borrower_name}${loan.co_borrower_name ? ' / ' + loan.co_borrower_name : ''}
Email: ${loan.borrower_email || 'N/A'}
Phone: ${loan.borrower_phone || 'N/A'}
Loan Amount: ${loan.loan_amount ? '$' + Number(loan.loan_amount).toLocaleString() : 'N/A'}
Loan Type: ${loan.loan_type || 'N/A'}
Loan Purpose: ${loan.loan_purpose || 'N/A'}
Property Address: ${loan.property_address || 'N/A'}
Property Type: ${loan.property_type || 'N/A'}
Status: ${loan.status}
Notes: ${loan.notes || 'None'}
Processor: ${user.name}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}

EXTRACTED DATA:
${Object.entries(extracted).map(([k,v]) => `${k}: ${JSON.stringify(v)}`).join('\n') || 'None'}

UPLOADED DOCUMENTS (${docs.length} total):
${docs.map(d => `- ${d.doc_category}: ${d.original_name}`).join('\n') || 'None uploaded'}

DOCUMENT ANALYSIS SUMMARIES:
${analysisData.join('\n') || 'No documents analyzed yet'}

OUTSTANDING MISSING ITEMS (${items.length}):
${items.map(i => `- [${i.priority?.toUpperCase() || 'NORMAL'}] ${i.item}`).join('\n') || 'None'}
`;

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 4096,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: profileText }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error('Claude API error:', err);
      return serverError('Cover letter generation failed');
    }

    const claudeData  = await claudeRes.json();
    const letterHtml  = claudeData.content?.[0]?.text || '';

    await auditLog(env, {
      userId: user.sub, loanId: params.id, action: 'generate_cover_letter',
      entityType: 'loan', entityId: params.id,
      detail: { borrower: loan.borrower_name },
      request: context.request,
    });

    return ok({
      html:        letterHtml,
      borrower:    loan.borrower_name,
      loan_type:   loan.loan_type,
      loan_amount: loan.loan_amount,
      generated_by: user.name,
      generated_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Cover letter error:', err);
    return serverError('Cover letter generation failed: ' + err.message);
  }
}
