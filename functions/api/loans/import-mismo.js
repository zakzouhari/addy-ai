// POST /api/loans/import-mismo  (multipart/form-data: file)
// Parses a MISMO 3.x XML file, creates a loan record + stores the XML in R2
import { nanoid } from '../_lib/auth.js';
import { ok, created, badRequest, serverError } from '../_lib/response.js';
import { auditLog } from '../_lib/audit.js';

const MAX_FILE_SIZE = 25 * 1024 * 1024;

export async function onRequestPost(context) {
  const { env } = context;
  const user = context.data.user;

  let formData;
  try {
    formData = await context.request.formData();
  } catch {
    return badRequest('Expected multipart/form-data');
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') return badRequest('file is required');
  if (file.size > MAX_FILE_SIZE)         return badRequest('File exceeds 25 MB limit');

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['xml', 'mismo'].includes(ext) && !file.type.includes('xml')) {
    return badRequest('File must be a MISMO XML file (.xml)');
  }

  let xmlText;
  try {
    xmlText = await file.text();
  } catch {
    return serverError('Could not read file');
  }

  // ── Parse MISMO 3.x XML ───────────────────────────────────────────────────
  const parsed = parseMismoXml(xmlText);

  const now    = new Date().toISOString();
  const loanId = nanoid();
  const docId  = nanoid();
  const safeKey = `loans/${loanId}/${docId}/${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    // Store raw MISMO in R2
    const bytes = await file.arrayBuffer();
    await env.DOCUMENTS.put(safeKey, bytes, {
      httpMetadata: { contentType: 'application/xml' },
      customMetadata: { uploadedBy: user.sub, loanId, docId, type: 'MISMO' },
    });

    // Create the loan record
    await env.DB.prepare(`
      INSERT INTO loans (
        id, borrower_name, borrower_email, borrower_phone, co_borrower_name,
        loan_amount, property_address, property_type, loan_type, loan_purpose,
        status, assigned_to, notes, extracted_data, created_at, updated_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      loanId,
      parsed.borrower_name    || 'Unknown Borrower',
      parsed.borrower_email   || null,
      parsed.borrower_phone   || null,
      parsed.co_borrower_name || null,
      parsed.loan_amount      || null,
      parsed.property_address || null,
      parsed.property_type    || null,
      parsed.loan_type        || null,
      parsed.loan_purpose     || null,
      'application',
      user.sub,
      `Imported from MISMO XML: ${file.name}`,
      JSON.stringify(parsed.extracted_data || {}),
      now, now,
      user.sub
    ).run();

    // Store document metadata
    await env.DB.prepare(`
      INSERT INTO documents (id, loan_id, original_name, file_type, file_size, r2_key, doc_category, uploaded_by, uploaded_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(docId, loanId, file.name, 'application/xml', file.size, safeKey, 'MISMO', user.sub, now).run();

    // Auto-create missing items from MISMO analysis if present
    if (parsed.missing_items?.length) {
      for (const item of parsed.missing_items) {
        await env.DB.prepare(
          'INSERT OR IGNORE INTO missing_items (id, loan_id, item, status, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(nanoid(), loanId, item, 'pending', 'ai', now, now).run();
      }
    }

    await auditLog(env, {
      userId: user.sub, loanId, action: 'import_mismo',
      entityType: 'loan', entityId: loanId,
      detail: { filename: file.name, borrower: parsed.borrower_name },
      request: context.request,
    });

    const loan = await env.DB.prepare('SELECT * FROM loans WHERE id = ?').bind(loanId).first();
    return created({ loan, document_id: docId, parsed_fields: Object.keys(parsed.extracted_data || {}).length });

  } catch (err) {
    console.error('MISMO import error:', err);
    // Clean up R2 on failure
    await env.DOCUMENTS.delete(safeKey).catch(() => {});
    return serverError('MISMO import failed: ' + err.message);
  }
}

// ── MISMO 3.x XML parser (regex/string-based, no DOMParser in CF Workers) ──
function parseMismoXml(xml) {
  const result = {
    borrower_name: null, borrower_email: null, borrower_phone: null,
    co_borrower_name: null, loan_amount: null, property_address: null,
    property_type: null, loan_type: null, loan_purpose: null,
    missing_items: [],
    extracted_data: {},
  };

  // Helper: extract first text value matching a tag (case-insensitive, handles namespaces)
  const tag = (name, content = xml) => {
    const re = new RegExp(`<[^>]*:?${name}[^>]*>([^<]*)<`, 'i');
    const m  = content.match(re);
    return m ? m[1].trim() : null;
  };
  const attr = (attrName, tagContent) => {
    const re = new RegExp(`${attrName}="([^"]*)"`, 'i');
    const m  = tagContent?.match(re);
    return m ? m[1].trim() : null;
  };

  // ── Borrower info ──────────────────────────────────────────────────────────
  // Try to get borrower sections
  const borrowerSections = [];
  const bsRe = /<[^>]*:?Borrower[^>]*SequenceNumber="(\d+)"[^>]*>([\s\S]*?)<\/[^>]*:?Borrower>/gi;
  let bsMatch;
  while ((bsMatch = bsRe.exec(xml)) !== null) {
    borrowerSections.push({ seq: parseInt(bsMatch[1]), content: bsMatch[2] });
  }
  // Fallback: look for any borrower section
  if (!borrowerSections.length) {
    const bRe = /<[^>]*:?Borrower[^>]*>([\s\S]*?)<\/[^>]*:?Borrower>/i;
    const bM  = xml.match(bRe);
    if (bM) borrowerSections.push({ seq: 1, content: bM[1] });
  }

  borrowerSections.sort((a, b) => a.seq - b.seq);

  const extractName = (content) => {
    const first  = tag('FirstName', content) || tag('first_name', content);
    const middle = tag('MiddleName', content) || tag('middle_name', content);
    const last   = tag('LastName', content)  || tag('last_name', content);
    if (first && last) return [first, middle, last].filter(Boolean).join(' ');
    // Try FullName
    return tag('FullName', content) || null;
  };

  if (borrowerSections[0]) {
    result.borrower_name  = extractName(borrowerSections[0].content);
    result.borrower_email = tag('EmailAddressText', borrowerSections[0].content) ||
                            tag('Email', borrowerSections[0].content);
    result.borrower_phone = tag('ContactPointTelephoneValue', borrowerSections[0].content) ||
                            tag('MobileNumberText', borrowerSections[0].content) ||
                            tag('PhoneNumber', borrowerSections[0].content);
    result.extracted_data.borrower_ssn_last4 =
      tag('TaxpayerIdentifierValue', borrowerSections[0].content)?.slice(-4) || null;
    result.extracted_data.borrower_dob = tag('BirthDate', borrowerSections[0].content);
  }
  if (borrowerSections[1]) {
    result.co_borrower_name = extractName(borrowerSections[1].content);
    result.extracted_data.co_borrower_email =
      tag('EmailAddressText', borrowerSections[1].content) ||
      tag('Email', borrowerSections[1].content);
  }

  // ── Loan details ────────────────────────────────────────────────────────────
  const loanAmountStr = tag('LoanAmount', xml) || tag('BaseLoanAmount', xml) ||
                        tag('OriginalPrincipalBalanceAmount', xml);
  result.loan_amount = loanAmountStr ? parseFloat(loanAmountStr.replace(/[,$]/g, '')) : null;

  const purposeRaw = tag('LoanPurposeType', xml) || tag('MortgageType', xml);
  if (purposeRaw) {
    const p = purposeRaw.toLowerCase();
    result.loan_purpose = p.includes('refinance') ? 'Refinance'
                         : p.includes('cash') ? 'Cash-Out'
                         : 'Purchase';
  }

  const loanTypeRaw = tag('GSELoanType', xml) || tag('LoanProductType', xml) ||
                      tag('LoanType', xml);
  if (loanTypeRaw) {
    const lt = loanTypeRaw.toLowerCase();
    result.loan_type = lt.includes('fha') ? 'FHA'
                     : lt.includes('va')  ? 'VA'
                     : lt.includes('usda') || lt.includes('rural') ? 'USDA'
                     : lt.includes('jumbo') ? 'Jumbo'
                     : lt.includes('heloc') ? 'HELOC'
                     : 'Conventional';
  }

  // ── Property ────────────────────────────────────────────────────────────────
  const streetNum  = tag('AddressLineText', xml) || tag('StreetAddress', xml);
  const city       = tag('CityName', xml);
  const state      = tag('StateCode', xml);
  const zip        = tag('PostalCode', xml);
  if (streetNum && city) {
    result.property_address = [streetNum, city, state, zip].filter(Boolean).join(', ');
  }

  const propTypeRaw = tag('PropertyUsageType', xml) || tag('AttachmentType', xml) ||
                      tag('PropertyStructureBuiltYear', xml);
  if (!propTypeRaw) {
    const gsePropType = tag('GSEPropertyType', xml);
    if (gsePropType) {
      const pt = gsePropType.toLowerCase();
      result.property_type = pt.includes('condo') ? 'Condo'
                           : pt.includes('multi') || pt.includes('2') || pt.includes('duplex') ? 'Multi-Family'
                           : 'SFR';
    }
  }

  // ── Income ──────────────────────────────────────────────────────────────────
  const baseIncome = tag('CurrentEmploymentMonthlyIncomeAmount', xml) ||
                     tag('BasePayAmount', xml) || tag('MonthlyIncomeAmount', xml);
  if (baseIncome) result.extracted_data.monthly_income = parseFloat(baseIncome.replace(/[,$]/g, ''));

  const employer = tag('EmployerName', xml) || tag('FullNameText', xml);
  if (employer) result.extracted_data.employer_name = employer;

  // ── Assets ──────────────────────────────────────────────────────────────────
  const assets = [];
  const assetRe = /<[^>]*:?ASSET[^>]*>([\s\S]*?)<\/[^>]*:?ASSET>/gi;
  let assetMatch;
  while ((assetMatch = assetRe.exec(xml)) !== null) {
    const ac   = assetMatch[1];
    const type = tag('AssetType', ac) || tag('DepositoryAccountType', ac);
    const bal  = tag('AssetCurrentActualValue', ac) || tag('AssetActualCashValue', ac);
    if (type || bal) assets.push({ type: type || 'Unknown', balance: bal ? parseFloat(bal.replace(/[,$]/g, '')) : null });
  }
  if (assets.length) result.extracted_data.assets = assets;

  // ── Credit ──────────────────────────────────────────────────────────────────
  const creditScore = tag('CreditScoreValue', xml) || tag('CreditScore', xml);
  if (creditScore) result.extracted_data.credit_score = parseInt(creditScore);

  const ltv = tag('LoanToValueRatioPercent', xml) || tag('LTV', xml);
  if (ltv) result.extracted_data.ltv = parseFloat(ltv);

  const dti = tag('TotalDebtExpenseRatioPercent', xml) || tag('DTI', xml);
  if (dti) result.extracted_data.dti = parseFloat(dti);

  // ── Loan number / case number ────────────────────────────────────────────────
  const loanNum = tag('LoanIdentifier', xml) || tag('AgencyCaseIdentifier', xml) ||
                  tag('LenderLoanNumber', xml);
  if (loanNum) result.extracted_data.loan_number = loanNum;

  // ── Standard missing items for new loans ────────────────────────────────────
  const loanTypeForChecklist = result.loan_type || 'Conventional';
  result.missing_items = generateMissingItemsForLoanType(loanTypeForChecklist, result);

  return result;
}

function generateMissingItemsForLoanType(loanType, parsed) {
  const items = [
    'Last 2 years W-2 forms (all employers)',
    'Last 2 years federal tax returns (1040 — all pages and schedules)',
    'Last 30 days pay stubs (all employers)',
    'Last 2 months bank statements (all accounts — all pages)',
    'Copy of government-issued photo ID (driver\'s license or passport)',
  ];

  if (loanType === 'FHA') {
    items.push('Copy of Social Security card');
  }
  if (loanType === 'VA') {
    items.push('Certificate of Eligibility (VA COE)');
    items.push('DD-214 discharge paperwork (if separated from service)');
  }
  if (loanType === 'USDA') {
    items.push('Verification of rural property eligibility');
  }
  if (parsed.loan_purpose === 'Refinance' || parsed.loan_purpose === 'Cash-Out') {
    items.push('Current mortgage statement (most recent)');
    items.push('Homeowner\'s insurance declarations page');
    items.push('Most recent property tax bill');
  } else {
    items.push('Fully executed purchase contract with all addendums');
    items.push('Earnest money deposit proof (cancelled check or wire confirmation)');
  }

  return items;
}
