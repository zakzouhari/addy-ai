// POST /api/loans/:id/voice-outreach
// Initiates an ElevenLabs outbound AI voice call to the borrower
import { nanoid } from '../../_lib/auth.js';
import { ok, notFound, badRequest, serverError } from '../../_lib/response.js';
import { auditLog } from '../../_lib/audit.js';

export async function onRequestPost(context) {
  const { env, params } = context;
  const user = context.data.user;

  const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(params.id).first();
  if (!loan) return notFound('Loan not found');

  if (!loan.borrower_phone) {
    return badRequest('Borrower phone number is required for voice outreach');
  }

  const agentId = env.ELEVENLABS_AGENT_ID;
  const apiKey  = env.ELEVENLABS_API_KEY;
  if (!agentId || !apiKey) {
    return badRequest('ElevenLabs is not configured (ELEVENLABS_AGENT_ID / ELEVENLABS_API_KEY missing)');
  }

  // Get pending missing items for the call script
  const { results: items } = await env.DB.prepare(
    "SELECT item FROM missing_items WHERE loan_id = ? AND status = 'pending' ORDER BY priority DESC LIMIT 10"
  ).bind(params.id).all();

  const missingItemsList = items.map(i => i.item).join('; ');
  const fromPhone = env.TWILIO_PHONE_NUMBER || '+18312823862';
  const toPhone   = loan.borrower_phone.replace(/[^+\d]/g, '');

  // ── Build dynamic variables for the ElevenLabs agent ─────────────────────
  const dynamicVars = {
    borrower_name:      loan.borrower_name,
    loan_amount:        loan.loan_amount ? '$' + Number(loan.loan_amount).toLocaleString() : 'your loan',
    property_address:   loan.property_address || 'the subject property',
    missing_items:      missingItemsList || 'a few outstanding items',
    processor_name:     user.name || 'your loan processor',
    company_name:       'Clearpath Automation',
  };

  const now    = new Date().toISOString();
  const callId = nanoid();

  try {
    // ── Call ElevenLabs Conversational AI outbound calling API ────────────────
    const elRes = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method:  'POST',
      headers: {
        'xi-api-key':    apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        agent_id:          agentId,
        agent_phone_number_id: fromPhone,    // EL uses phone number ID or E.164 number
        to_number:         toPhone,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVars,
        },
      }),
    });

    const elData = await elRes.json().catch(() => ({}));

    const elevenlabsCallId = elData?.conversation_id || elData?.call_id || null;
    const success = elRes.ok || !!elevenlabsCallId;
    const status  = success ? 'initiated' : 'failed';
    const errMsg  = success ? null : JSON.stringify(elData);

    // Log the call
    await env.DB.prepare(`
      INSERT INTO voice_call_log (id, loan_id, to_phone, elevenlabs_call_id, status, initiated_at, initiated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(callId, params.id, toPhone, elevenlabsCallId, status, now, user.sub).run();

    if (!success) {
      console.error('ElevenLabs API error:', elData);
      return serverError('Voice call initiation failed: ' + (elData?.detail || JSON.stringify(elData)));
    }

    await auditLog(env, {
      userId: user.sub, loanId: params.id, action: 'voice_call',
      entityType: 'loan', entityId: params.id,
      detail: { to_phone: toPhone, call_id: callId, elevenlabs_call_id: elevenlabsCallId },
      request: context.request,
    });

    return ok({
      message:    'Voice call initiated successfully',
      call_id:    callId,
      elevenlabs_call_id: elevenlabsCallId,
      to_phone:   toPhone,
    });

  } catch (err) {
    console.error('Voice outreach error:', err);
    // Still log the failed attempt
    await env.DB.prepare(`
      INSERT INTO voice_call_log (id, loan_id, to_phone, status, initiated_at, initiated_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(callId, params.id, toPhone, 'failed', now, user.sub).run().catch(() => {});
    return serverError('Voice outreach failed: ' + err.message);
  }
}
