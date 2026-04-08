// POST /api/loans/:id/underwrite
// Agentic underwriter brain: full structured assessment of a loan file
// Returns cached result if assessment < 24h old and no new docs since last run
import { nanoid } from '../../_lib/auth.js';
import { ok, notFound, serverError } from '../../_lib/response.js';
import { auditLog } from '../../_lib/audit.js';

// Use Haiku for cost efficiency; swap to Sonnet for production
const MODEL_PRIMARY    = 'claude-haiku-4-5-20251001';
const MODEL_PRODUCTION = 'claude-sonnet-4-6';
const CACHE_TTL_MS     = 24 * 60 * 60 * 1000; // 24 hours

const SYSTEM_PROMPT = `You are a senior mortgage underwriter with 25+ years of experience.
You review complete loan files and provide structured assessments for junior processors.

Your job is to analyze the provided loan profile and all extracted document data, then return
a precise JSON assessment with no extra prose outside the JSON block.

Required JSON shape (respond ONLY with this JSON, no markdown, no extra text):
{
  "completeness_score": <0-100 integer>,
  "recommendation": "<ready_for_uw|needs_work|major_issues>",
  "summary": "<2-4 sentence plain-English summary of the file>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "concerns": ["<concern 1>", "<concern 2>"],
  "missing_items": [
    {
      "name": "<document or data point name>",
      "category": "<Income|Assets|Credit|Property|Identity|Legal|Other>",
      "priority": "<critical|standard|nice_to_have>",
      "reason": "<why it is needed>",
      "action": "<specific action the processor should take>"
    }
  ],
  "calculations": {
    "dti": <back-end DTI as decimal, e.g. 0.43 for 43%, or null if cannot compute>,
    "ltv": <LTV as decimal, e.g. 0.80 for 80%, or null if cannot compute>,
    "front_end_ratio": <PITI / gross income, or null>,
    "reserves_months": <months of PITI in verified assets, or null>
  },
  "next_steps": ["<action item 1>", "<action item 2>"]
}

Guidelines:
- completeness_score: 0-49 = major_issues, 50-74 = needs_work, 75-100 = ready_for_uw
- recommendation must be consistent with completeness_score
- Always include at least one next_step
- missing_items should be unique and actionable
- calculations.dti: use total monthly debts / gross monthly income
- calculations.ltv: use loan_amount / appraised_value (or purchase_price if appraisal unavailable)`;

export async function onRequestPost(context) {
  const { env, params } = context;
  const user = context.data.user;

  try {
    // ── Load loan record ───────────────────────────────────────────────────────
    const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(params.id).first();
    if (!loan) return notFound('Loan not found');

    // ── Load documents and missing items ──────────────────────────────────────
    const { results: docs }  = await env.DB.prepare(
      'SELECT * FROM documents WHERE loan_id = ? ORDER BY uploaded_at ASC'
    ).bind(params.id).all();

    const { results: items } = await env.DB.prepare(
      'SELECT * FROM missing_items WHERE loan_id = ? ORDER BY created_at ASC'
    ).bind(params.id).all();

    // ── Cache check: return existing assessment if fresh and no new docs ───────
    const lastDocAt = docs.reduce((max, d) => d.uploaded_at > max ? d.uploaded_at : max, '');
    const { results: existing } = await env.DB.prepare(
      'SELECT * FROM underwriter_assessments WHERE loan_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(params.id).all();

    if (existing.length > 0) {
      const prev = existing[0];
      const age  = Date.now() - new Date(prev.created_at).getTime();
      const noNewDocs = !lastDocAt || prev.created_at >= lastDocAt;
      if (age < CACHE_TTL_MS && noNewDocs) {
        return ok({
          assessment: parseAssessmentRow(prev),
          cached: true,
          cached_at: prev.created_at,
        });
      }
    }

    // ── Build loan profile for the prompt ─────────────────────────────────────
    const extracted = loan.extracted_data ? JSON.parse(loan.extracted_data) : {};
    const docList   = docs.map(d => {
      const analysis = d.analysis ? JSON.parse(d.analysis) : null;
      return `  • ${d.original_name} [${d.doc_category}]${d.analyzed ? ' ✓ analyzed' : ' (not analyzed)'}${
        analysis ? '\n    Extracted: ' + JSON.stringify(analysis).slice(0, 400) : ''
      }`;
    }).join('\n');

    const itemList = items.filter(i => i.status === 'pending')
      .map(i => `  • [${i.priority || 'normal'}] ${i.item}`).join('\n');

    const profileText = `
LOAN PROFILE
─────────────────────────────────────
Borrower:         ${loan.borrower_name}
Co-Borrower:      ${loan.co_borrower_name || 'None'}
Borrower Email:   ${loan.borrower_email || 'not provided'}
Borrower Phone:   ${loan.borrower_phone || 'not provided'}
Co-Borrower Email:${loan.coborrower_email || 'not provided'}
Loan Amount:      ${loan.loan_amount ? '$' + Number(loan.loan_amount).toLocaleString() : 'not provided'}
Loan Type:        ${loan.loan_type || 'not specified'}
Loan Purpose:     ${loan.loan_purpose || 'not specified'}
Property Address: ${loan.property_address || 'not provided'}
Property Type:    ${loan.property_type || 'not specified'}
Current Status:   ${loan.status}
Current DTI:      ${loan.dti != null ? (loan.dti * 100).toFixed(1) + '%' : 'unknown'}
Current LTV:      ${loan.ltv != null ? (loan.ltv * 100).toFixed(1) + '%' : 'unknown'}
Completeness:     ${loan.completeness_score ?? 0}%
Notes:            ${loan.notes || 'none'}

EXTRACTED DATA FROM MISMO / PRIOR AI ANALYSIS
─────────────────────────────────────
${Object.entries(extracted).map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`).join('\n') || '  (none)'}

UPLOADED DOCUMENTS (${docs.length} total)
─────────────────────────────────────
${docList || '  (none uploaded)'}

EXISTING PENDING MISSING ITEMS (${items.filter(i => i.status === 'pending').length})
─────────────────────────────────────
${itemList || '  (none — first analysis)'}
`;

    // ── Call Claude ────────────────────────────────────────────────────────────
    // Try primary (Haiku) first; fall back to Sonnet on 429
    let model = MODEL_PRIMARY;
    let claudeRes = await callClaude(env, model, profileText);

    if (claudeRes.status === 429) {
      // Rate limited on Haiku — wait is not feasible in Workers; try Sonnet
      model = MODEL_PRODUCTION;
      claudeRes = await callClaude(env, model, profileText);
    }

    if (claudeRes.status === 429) {
      return new Response(JSON.stringify({
        error: 'rate_limited',
        message: 'Claude AI is temporarily rate-limited. Please wait 60 seconds and try again.',
        retry_after: 60,
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
      });
    }

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error('Claude API error:', claudeRes.status, errText);
      return serverError('AI underwriting call failed: ' + claudeRes.status);
    }

    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.[0]?.text || '';
    const inputTok   = claudeData.usage?.input_tokens  || 0;
    const outputTok  = claudeData.usage?.output_tokens || 0;

    // ── Parse JSON from Claude response ───────────────────────────────────────
    let assessment;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      assessment = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
      assessment = null;
    }

    if (!assessment) {
      console.error('Claude returned non-JSON:', rawText.slice(0, 500));
      return serverError('AI returned unparseable response');
    }

    // Normalize and clamp values
    const score = Math.max(0, Math.min(100, parseInt(assessment.completeness_score) || 0));
    const rec   = ['ready_for_uw', 'needs_work', 'major_issues'].includes(assessment.recommendation)
                  ? assessment.recommendation : 'needs_work';
    const calcs = assessment.calculations || {};
    const dti   = calcs.dti   != null ? parseFloat(calcs.dti)   : null;
    const ltv   = calcs.ltv   != null ? parseFloat(calcs.ltv)   : null;

    const now = new Date().toISOString();
    const assessId = nanoid();

    // ── Save assessment to DB ─────────────────────────────────────────────────
    await env.DB.prepare(`
      INSERT INTO underwriter_assessments (
        id, loan_id, model, completeness_score, recommendation, summary,
        strengths, concerns, missing_items, calculations, next_steps,
        input_doc_count, input_tokens, output_tokens, created_at, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      assessId, params.id, model, score, rec,
      assessment.summary || '',
      JSON.stringify(assessment.strengths || []),
      JSON.stringify(assessment.concerns  || []),
      JSON.stringify(assessment.missing_items || []),
      JSON.stringify(calcs),
      JSON.stringify(assessment.next_steps || []),
      docs.length, inputTok, outputTok, now, user.sub
    ).run();

    // ── Update loan record ────────────────────────────────────────────────────
    await env.DB.prepare(`
      UPDATE loans SET
        completeness_score = ?,
        dti = ?,
        ltv = ?,
        last_analyzed_at = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(score, dti, ltv, now, now, params.id).run();

    // ── Sync missing_items table from assessment ──────────────────────────────
    const aiMissingItems = Array.isArray(assessment.missing_items) ? assessment.missing_items : [];
    const existingItemTexts = items
      .filter(i => i.status === 'pending' && i.source === 'ai')
      .map(i => i.item.toLowerCase().slice(0, 30));

    for (const mi of aiMissingItems) {
      if (!mi?.name) continue;
      const itemText = mi.name.trim();
      const isDupe   = existingItemTexts.some(e => e.includes(itemText.toLowerCase().slice(0, 20)));
      if (!isDupe) {
        const priority = ['critical', 'standard', 'nice_to_have'].includes(mi.priority)
                         ? mi.priority : 'standard';
        await env.DB.prepare(
          'INSERT INTO missing_items (id, loan_id, item, priority, status, source, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)'
        ).bind(nanoid(), params.id, itemText, priority, 'pending', 'ai', now, now).run();
      }
    }

    // ── Log token usage ───────────────────────────────────────────────────────
    // Cost estimates: Haiku ~$0.0008/1K in, $0.004/1K out; Sonnet ~$0.003/1K in, $0.015/1K out
    const costPerInputK  = model === MODEL_PRIMARY ? 0.0008 : 0.003;
    const costPerOutputK = model === MODEL_PRIMARY ? 0.004  : 0.015;
    const costUsd = (inputTok / 1000) * costPerInputK + (outputTok / 1000) * costPerOutputK;

    await env.DB.prepare(
      'INSERT INTO claude_token_log (id,loan_id,action,model,input_tokens,output_tokens,cost_usd,created_at,created_by) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(nanoid(), params.id, 'underwrite', model, inputTok, outputTok, costUsd, now, user.sub).run();

    await auditLog(env, {
      userId: user.sub, loanId: params.id, action: 'underwrite',
      entityType: 'loan', entityId: params.id,
      detail: { model, score, recommendation: rec, input_tokens: inputTok, output_tokens: outputTok },
      request: context.request,
    });

    return ok({
      assessment: {
        id: assessId,
        loan_id: params.id,
        model,
        completeness_score: score,
        recommendation: rec,
        summary: assessment.summary,
        strengths: assessment.strengths || [],
        concerns:  assessment.concerns  || [],
        missing_items: assessment.missing_items || [],
        calculations: calcs,
        next_steps: assessment.next_steps || [],
        created_at: now,
      },
      cached: false,
      tokens: { input: inputTok, output: outputTok, cost_usd: costUsd },
    });

  } catch (err) {
    console.error('Underwrite error:', err);
    return serverError('Underwriting failed: ' + err.message);
  }
}

// ── Claude API call helper ─────────────────────────────────────────────────────
async function callClaude(env, model, userContent) {
  return fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: userContent }],
    }),
  });
}

// ── Parse assessment row from DB back to object ───────────────────────────────
function parseAssessmentRow(row) {
  return {
    id:                 row.id,
    loan_id:            row.loan_id,
    model:              row.model,
    completeness_score: row.completeness_score,
    recommendation:     row.recommendation,
    summary:            row.summary,
    strengths:          tryParse(row.strengths,    []),
    concerns:           tryParse(row.concerns,     []),
    missing_items:      tryParse(row.missing_items,[]),
    calculations:       tryParse(row.calculations, {}),
    next_steps:         tryParse(row.next_steps,   []),
    created_at:         row.created_at,
  };
}

function tryParse(str, fallback) {
  if (!str) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
