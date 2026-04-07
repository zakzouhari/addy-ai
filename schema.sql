-- Clearpath Processor — Loan Processing Platform
-- Cloudflare D1 (SQLite) Schema
-- Run: wrangler d1 execute addy-ai-db --remote --file=schema.sql

-- ─────────────────────────────────────────────────────────
-- Users
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'processor',  -- admin | processor | assistant
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  last_login    TEXT,
  created_by    TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────
-- Loans (one per borrower/transaction)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loans (
  id               TEXT PRIMARY KEY,
  borrower_name    TEXT NOT NULL,
  borrower_email   TEXT,
  borrower_phone   TEXT,
  co_borrower_name TEXT,
  loan_amount      REAL,
  property_address TEXT,
  property_type    TEXT,        -- SFR | Condo | Multi-Family | Commercial
  loan_type        TEXT,        -- Conventional | FHA | VA | USDA | Jumbo | Refi | HELOC
  loan_purpose     TEXT,        -- Purchase | Refinance | Cash-Out
  status           TEXT NOT NULL DEFAULT 'application',
  -- application | docs_pending | processing | underwriting | conditional | clear_to_close | closed | denied | withdrawn
  assigned_to      TEXT,
  notes            TEXT,
  extracted_data   TEXT,        -- JSON from MISMO/AI analysis
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  created_by       TEXT NOT NULL,
  FOREIGN KEY (assigned_to) REFERENCES users(id),
  FOREIGN KEY (created_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────
-- Documents (stored in R2, metadata here)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id            TEXT PRIMARY KEY,
  loan_id       TEXT NOT NULL,
  original_name TEXT NOT NULL,
  file_type     TEXT,           -- application/xml | application/pdf | image/jpeg …
  file_size     INTEGER,
  r2_key        TEXT NOT NULL,  -- loans/{loanId}/{docId}/{filename}
  doc_category  TEXT,           -- MISMO | Paystub | BankStatement | TaxReturn | ID | Other
  uploaded_by   TEXT NOT NULL,
  uploaded_at   TEXT NOT NULL,
  analyzed      INTEGER DEFAULT 0,
  analysis      TEXT,           -- JSON result from Claude
  FOREIGN KEY (loan_id)     REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────
-- Document Classifications (AI-extracted metadata per doc)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doc_classifications (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL,
  loan_id         TEXT NOT NULL,
  doc_type        TEXT,         -- W2 | Paystub | BankStatement | TaxReturn | DriversLicense | Insurance | etc.
  period_start    TEXT,
  period_end      TEXT,
  tax_year        TEXT,
  wages_ytd       REAL,
  employer_name   TEXT,
  institution     TEXT,
  account_ending  TEXT,
  ending_balance  REAL,
  large_deposits  TEXT,         -- JSON array
  classified_at   TEXT NOT NULL,
  raw_metadata    TEXT,         -- full JSON from Claude
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (loan_id)     REFERENCES loans(id)     ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────
-- Missing Items Checklist
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS missing_items (
  id         TEXT PRIMARY KEY,
  loan_id    TEXT NOT NULL,
  item       TEXT NOT NULL,
  priority   TEXT NOT NULL DEFAULT 'normal',    -- critical | normal | nice-to-have
  status     TEXT NOT NULL DEFAULT 'pending',   -- pending | received | waived
  source     TEXT DEFAULT 'manual',             -- manual | ai
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────
-- Email Log
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_log (
  id          TEXT PRIMARY KEY,
  loan_id     TEXT,
  to_email    TEXT NOT NULL,
  to_name     TEXT,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  template    TEXT,             -- missing_items | status_update | welcome | custom | cover_letter
  sent_at     TEXT NOT NULL,
  sent_by     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'sent',   -- sent | failed
  error_msg   TEXT,
  FOREIGN KEY (loan_id)  REFERENCES loans(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────
-- SMS Log
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sms_log (
  id          TEXT PRIMARY KEY,
  loan_id     TEXT,
  to_phone    TEXT NOT NULL,
  body        TEXT NOT NULL,
  twilio_sid  TEXT,
  sent_at     TEXT NOT NULL,
  sent_by     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'sent',   -- sent | failed
  error_msg   TEXT,
  FOREIGN KEY (loan_id)  REFERENCES loans(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────
-- Voice Call Log (ElevenLabs outbound calls)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voice_call_log (
  id              TEXT PRIMARY KEY,
  loan_id         TEXT,
  to_phone        TEXT NOT NULL,
  elevenlabs_call_id TEXT,
  status          TEXT NOT NULL DEFAULT 'initiated',  -- initiated | completed | failed | no-answer
  initiated_at    TEXT NOT NULL,
  initiated_by    TEXT NOT NULL,
  summary         TEXT,         -- post-call summary from webhook
  items_committed TEXT,         -- JSON: list of items borrower committed to
  FOREIGN KEY (loan_id)       REFERENCES loans(id) ON DELETE SET NULL,
  FOREIGN KEY (initiated_by)  REFERENCES users(id)
);

-- ─────────────────────────────────────────────────────────
-- Audit Log (every significant action)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  loan_id     TEXT,
  action      TEXT NOT NULL,   -- view_loan | upload_doc | delete_doc | send_email | send_sms | voice_call | analyze_loan | generate_cover_letter | submit_to_underwriter | import_mismo | login | logout | create_user | update_user
  entity_type TEXT,            -- loan | document | missing_item | user
  entity_id   TEXT,
  detail      TEXT,            -- JSON with extra context
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (loan_id)  REFERENCES loans(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_loans_status      ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_assigned    ON loans(assigned_to);
CREATE INDEX IF NOT EXISTS idx_loans_created_at  ON loans(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_loan    ON documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_doc_class_doc     ON doc_classifications(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_class_loan    ON doc_classifications(loan_id);
CREATE INDEX IF NOT EXISTS idx_missing_loan      ON missing_items(loan_id);
CREATE INDEX IF NOT EXISTS idx_email_loan        ON email_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_sms_loan          ON sms_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_voice_loan        ON voice_call_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_loan        ON audit_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_user        ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_log(created_at DESC);
