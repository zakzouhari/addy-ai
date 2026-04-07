// POST /api/admin/seed-demo — create a fully-populated demo loan (admin only)
import { nanoid } from '../_lib/auth.js';
import { ok, forbidden, serverError } from '../_lib/response.js';

export async function onRequestPost(context) {
  const { env } = context;
  const user = context.data.user;

  if (user.role !== 'admin') return forbidden('Admin only');

  const now    = new Date().toISOString();
  const loanId = nanoid();

  try {
    // Check if a demo loan already exists
    const existing = await env.DB.prepare(
      "SELECT id FROM loans WHERE notes LIKE '%[DEMO LOAN]%' LIMIT 1"
    ).first();

    if (existing) {
      // Return the existing demo loan rather than creating a duplicate
      const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?')
        .bind(existing.id).first();
      return ok({ loan, created: false, message: 'Demo loan already exists — opening existing file.' });
    }

    const extracted = JSON.stringify({
      loan_number:          'DEMO-2024-00142',
      interest_rate:        '6.875%',
      loan_term:            '30 years',
      appraised_value:      485000,
      ltv:                  '79.4%',
      dti_ratio:            '38.2%',
      credit_score:         '748',
      employment_status:    'Employed',
      employer:             'Sunrise Technologies, Inc.',
      gross_monthly_income: 14200,
      assets_total:         122000,
      down_payment:         100000,
    });

    // Create the demo loan
    await env.DB.prepare(`
      INSERT INTO loans (
        id, borrower_name, borrower_email, borrower_phone, co_borrower_name,
        loan_amount, property_address, property_type, loan_type, loan_purpose,
        status, assigned_to, notes, extracted_data, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      loanId,
      'Michael & Sarah Johnson',
      'mjohnson@email.com',
      '(813) 555-0147',
      'Sarah Johnson',
      385000,
      '4821 Palmetto Ridge Dr, Tampa, FL 33611',
      'SFR',
      'Conventional',
      'Purchase',
      'docs_pending',
      user.sub,
      '[DEMO LOAN] This is a sample loan file created to demonstrate Clearpath Processor capabilities. All borrower data is fictitious.',
      extracted,
      now, now,
      user.sub
    ).run();

    // Add realistic missing items
    const missingItems = [
      { item: 'Last 2 years W-2 forms (2022 & 2023)',                        priority: 'critical'      },
      { item: 'Last 2 years federal tax returns (all pages)',                 priority: 'critical'      },
      { item: 'Most recent 30-day pay stubs (both borrowers)',                priority: 'critical'      },
      { item: 'Last 2 months bank statements — all pages, all accounts',      priority: 'critical'      },
      { item: 'Government-issued photo ID (driver\'s license or passport)',   priority: 'critical'      },
      { item: 'Fully executed purchase contract with all addenda',            priority: 'critical'      },
      { item: 'Homeowner\'s insurance binder / declaration page',             priority: 'normal'        },
      { item: 'Gift letter if any portion of down payment is a gift',         priority: 'normal'        },
      { item: 'Explanation letter for credit inquiries in past 90 days',      priority: 'normal'        },
      { item: 'HOA contact info and dues documentation (if applicable)',      priority: 'nice-to-have'  },
      { item: 'Employment verification letter from HR',                       priority: 'nice-to-have'  },
    ];

    for (const mi of missingItems) {
      await env.DB.prepare(
        'INSERT INTO missing_items (id, loan_id, item, priority, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(nanoid(), loanId, mi.item, mi.priority, 'pending', 'demo', now, now).run();
    }

    // Add a sample email log entry
    await env.DB.prepare(`
      INSERT INTO email_log (id, loan_id, to_email, to_name, subject, html, text, sent_at, status, template)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      nanoid(), loanId,
      'mjohnson@email.com', 'Michael Johnson',
      'Welcome — Johnson Loan File Opened',
      '<p>Welcome to Clearpath Processor!</p>',
      'Welcome to Clearpath Processor!',
      now, 'sent', 'welcome'
    ).run();

    const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(loanId).first();

    return ok({
      loan,
      created: true,
      missing_items_added: missingItems.length,
      message: 'Demo loan created with full borrower data, 11 missing items, and sample email log.',
    });

  } catch (err) {
    console.error('Seed demo error:', err);
    return serverError('Failed to create demo loan: ' + err.message);
  }
}
