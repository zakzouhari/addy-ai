// POST /api/documents/:id/analyze — run Claude AI analysis on a document
import { ok, notFound, serverError } from '../../_lib/response.js';
import { getStorage } from '../../_lib/storage.js';

const SYSTEM_PROMPT = `You are a mortgage loan processing expert. Analyze the provided document and extract all relevant information.

For MISMO XML files, extract:
- Borrower information (name, SSN last 4, DOB, employment, income)
- Co-borrower information if present
- Loan details (amount, type, purpose, rate, term)
- Property information (address, type, value, appraised value)
- Assets, liabilities, credit information

For other documents (pay stubs, bank statements, tax returns, IDs), extract:
- Document type and date range
- Key financial figures
- Employer/institution name
- Any flags or discrepancies

Always respond in JSON with this structure:
{
  "document_type": "...",
  "summary": "...",
  "extracted_data": { ... all extracted fields ... },
  "missing_items": ["list of documents or info that appears to be missing or needed"],
  "flags": ["any issues, inconsistencies, or items needing attention"],
  "confidence": "high|medium|low"
}`;

export async function onRequestPost(context) {
  const { env, params } = context;

  try {
    const doc = await env.DB.prepare(
      'SELECT * FROM documents WHERE id = ?'
    ).bind(params.id).first();
    if (!doc) return notFound('Document not found');

    // Fetch from storage (R2 or KV fallback)
    const obj = await getStorage(env).get(doc.r2_key);
    if (!obj) return notFound('Document file not found in storage');

    const fileType = (doc.file_type || '').toLowerCase();
    let messageContent;

    if (fileType.includes('pdf')) {
      // Send as base64-encoded PDF (Claude supports PDF documents)
      const bytes  = await obj.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        },
        { type: 'text', text: `Analyze this document: "${doc.original_name}"` },
      ];
    } else if (fileType.includes('xml') || fileType.includes('text') || doc.original_name.endsWith('.xml')) {
      // Read as text for XML/MISMO files
      const text = await obj.text();
      const truncated = text.length > 100000 ? text.slice(0, 100000) + '\n...[truncated]' : text;
      messageContent = [
        { type: 'text', text: `Analyze this document: "${doc.original_name}"\n\n${truncated}` },
      ];
    } else if (fileType.includes('image/')) {
      // Send as image
      const bytes  = await obj.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)));
      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: doc.file_type, data: base64 },
        },
        { type: 'text', text: `Analyze this document image: "${doc.original_name}"` },
      ];
    } else {
      // Attempt to read as text
      const text = await obj.text().catch(() => null);
      if (!text) return serverError('Cannot analyze this file type');
      messageContent = [
        { type: 'text', text: `Analyze this document: "${doc.original_name}"\n\n${text.slice(0, 50000)}` },
      ];
    }

    // Call Claude API
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
        messages:   [{ role: 'user', content: messageContent }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error('Claude API error:', err);
      return serverError('AI analysis failed');
    }

    const claudeData = await claudeRes.json();
    const rawText    = claudeData.content?.[0]?.text || '';

    // Extract JSON from Claude's response
    let analysis;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: rawText, extracted_data: {}, missing_items: [], flags: [] };
    } catch {
      analysis = { summary: rawText, extracted_data: {}, missing_items: [], flags: [] };
    }

    const analysisJson = JSON.stringify(analysis);
    const now          = new Date().toISOString();

    // Save analysis to DB
    await env.DB.prepare(
      'UPDATE documents SET analyzed = 1, analysis = ? WHERE id = ?'
    ).bind(analysisJson, params.id).run();

    // Auto-create missing items from AI
    if (Array.isArray(analysis.missing_items) && analysis.missing_items.length > 0) {
      for (const item of analysis.missing_items) {
        if (typeof item === 'string' && item.trim()) {
          const { nanoid } = await import('../../_lib/auth.js');
          await env.DB.prepare(
            'INSERT OR IGNORE INTO missing_items (id, loan_id, item, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(nanoid(), doc.loan_id, item.trim(), 'pending', 'ai', now, now).run();
        }
      }
    }

    // Update loan extracted_data if MISMO/high confidence
    if (analysis.extracted_data && Object.keys(analysis.extracted_data).length > 0) {
      await env.DB.prepare('UPDATE loans SET updated_at = ? WHERE id = ?').bind(now, doc.loan_id).run();
    }

    return ok({ analysis, document_id: params.id });

  } catch (err) {
    console.error('Analyze error:', err);
    return serverError('Analysis failed: ' + err.message);
  }
}
