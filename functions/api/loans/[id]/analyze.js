// POST /api/loans/:id/analyze
// Full loan-level AI analysis: reviews all uploaded docs + loan profile,
// generates a prioritized missing items list
import { nanoid } from '../../_lib/auth.js';
import { ok, notFound, serverError } from '../../_lib/response.js';
import { auditLog } from '../../_lib/audit.js';

const SYSTEM_PROMPT = `You are a senior mortgage loan processor with 20+ years of experience.
You are reviewing a complete loan file to identify what documents and information are still needed.

Given the loan profile and list of already uploaded documents, you will:
1. Identify ALL missing documents required for this loan type
2. Classify each missing item as CRITICAL (loan cannot proceed without it), NORMAL (standard requirement), or NICE-TO-HAVE (strengthens the file)
3. Note any discrepancies, red flags, or items needing clarification
4. Provide a brief overall assessment of the file's completeness

Standard requirements for common loan types:
- Conventional: W-2s (2yr), Tax returns (2yr), Pay stubs (30 days), Bank statements (2 months), Photo ID, Purchase contract or refi docs
- FHA: Same as Conventional + Social Security card, FHA case number
- VA: Same as Conventional + COE, DD-214
- USDA: Conventional docs + rural eligibility verification
- Self-employed: Add 2yr business returns, YTD P&L, business bank statements, CPA letter
- Investment property: Add current leases, rental income history, Schedule E

Always respond in valid JSON with this structure:
{
  "assessment": "2-3 sentence summary of file completeness",
  "completion_pct": 0-100,
  "missing_items": [
    {"item": "description", "priority": "critical|normal|nice-to-have", "reason": "why needed"}
  ],
  "flags": ["any issues or discrepancies found"],
  "strengths": ["positive aspects of the file"]
}`;

export async function onRequestPost(context) {
  const { env, params } = context;
  const user = context.data.user;

  try {
    // Fetch loan + all documents + existing missing items
    const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(params.id).first();
    if (!loan) return notFound('Loan not found');

    const { results: docs }  = await env.DB.prepare('SELECT * FROM documents WHERE loan_id = ?').bind(params.id).all();
    const { results: items } = await env.DB.prepare('SELECT * FROM missing_items WHERE loan_id = ?').bind(params.id).all();

    // Build the loan profile text
    const docList = docs.map(d => `  - ${d.original_name} (${d.doc_category}) — ${d.analyzed ? 'analyzed ✓' : 'not yet analyzed'}`).join('\n');
    const itemList = items.filter(i => i.status === 'pending').map(i => `  - ${i.item}`).join('\n');

    const extracted = loan.extracted_data ? JSON.parse(loan.extracted_data) : {};

    const profileText = `
LOAN PROFILE:
Borrower: ${loan.borrower_name}${loan.co_borrower_name ? ' / ' + loan.co_borrower_name : ''}
Email: ${loan.borrower_email || 'not provided'}
Phone: ${loan.borrower_phone || 'not provided'}
Loan Amount: ${loan.loan_amount ? '$' + loan.loan_amount.toLocaleString() : 'not provided'}
Loan Type: ${loan.loan_type || 'not specified'}
Loan Purpose: ${loan.loan_purpose || 'not specified'}
Property Address: ${loan.property_address || 'not provided'}
Property Type: ${loan.property_type || 'not specified'}
Current Status: ${loan.status}
Notes: ${loan.notes || 'none'}

EXTRACTED DATA FROM MISMO/DOCS:
${Object.entries(extracted).map(([k,v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n') || '  (none)'}

UPLOADED DOCUMENTS (${docs.length}):
${docList || '  (none uploaded yet)'}

EXISTING PENDING MISSING ITEMS:
${itemList || '  (none)'}
`;

    // Call Claude
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
      return serverError('AI analysis failed');
    }

    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.[0]?.text || '';

    let analysis;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { assessment: rawText, missing_items: [], flags: [], strengths: [] };
    } catch {
      analysis = { assessment: rawText, missing_items: [], flags: [], strengths: [] };
    }

    const now = new Date().toISOString();

    // Add new missing items (avoid duplicates)
    let added = 0;
    if (Array.isArray(analysis.missing_items)) {
      const existingItems = items.map(i => i.item.toLowerCase());
      for (const mi of analysis.missing_items) {
        if (!mi?.item) continue;
        const itemText = mi.item.trim();
        const isDupe   = existingItems.some(e => e.includes(itemText.toLowerCase().slice(0, 20)));
        if (!isDupe) {
          await env.DB.prepare(
            'INSERT INTO missing_items (id, loan_id, item, priority, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(nanoid(), params.id, itemText, mi.priority || 'normal', 'pending', 'ai', now, now).run();
          added++;
        }
      }
    }

    await auditLog(env, {
      userId: user.sub, loanId: params.id, action: 'analyze_loan',
      entityType: 'loan', entityId: params.id,
      detail: { items_added: added, completion_pct: analysis.completion_pct },
      request: context.request,
    });

    return ok({ analysis, items_added: added });

  } catch (err) {
    console.error('Loan analyze error:', err);
    return serverError('Analysis failed: ' + err.message);
  }
}
