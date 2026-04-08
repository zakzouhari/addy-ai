-- Phase 2 migration: add priority to missing_items + new tables
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN checks)

-- Add priority column to missing_items (Phase 2 addition)
ALTER TABLE missing_items ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';

-- doc_classifications
CREATE TABLE IF NOT EXISTS doc_classifications (
  id              TEXT PRIMARY KEY,
  document_id     TEXT NOT NULL,
  loan_id         TEXT NOT NULL,
  doc_type        TEXT,
  period_start    TEXT,
  period_end      TEXT,
  tax_year        TEXT,
  wages_ytd       REAL,
  employer_name   TEXT,
  institution     TEXT,
  account_ending  TEXT,
  ending_balance  REAL,
  large_deposits  TEXT,
  classified_at   TEXT NOT NULL,
  raw_metadata    TEXT,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (loan_id)     REFERENCES loans(id)     ON DELETE CASCADE
);

-- sms_log
CREATE TABLE IF NOT EXISTS sms_log (
  id          TEXT PRIMARY KEY,
  loan_id     TEXT,
  to_phone    TEXT NOT NULL,
  body        TEXT NOT NULL,
  twilio_sid  TEXT,
  sent_at     TEXT NOT NULL,
  sent_by     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'sent',
  error_msg   TEXT,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE SET NULL,
  FOREIGN KEY (sent_by) REFERENCES users(id)
);

-- voice_call_log
CREATE TABLE IF NOT EXISTS voice_call_log (
  id                 TEXT PRIMARY KEY,
  loan_id            TEXT,
  to_phone           TEXT NOT NULL,
  elevenlabs_call_id TEXT,
  status             TEXT NOT NULL DEFAULT 'initiated',
  initiated_at       TEXT NOT NULL,
  initiated_by       TEXT NOT NULL,
  summary            TEXT,
  items_committed    TEXT,
  FOREIGN KEY (loan_id)      REFERENCES loans(id) ON DELETE SET NULL,
  FOREIGN KEY (initiated_by) REFERENCES users(id)
);

-- audit_log
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,
  loan_id     TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT,
  entity_id   TEXT,
  detail      TEXT,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE SET NULL
);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_doc_class_doc  ON doc_classifications(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_class_loan ON doc_classifications(loan_id);
CREATE INDEX IF NOT EXISTS idx_sms_loan       ON sms_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_voice_loan     ON voice_call_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_loan     ON audit_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_user     ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created  ON audit_log(created_at DESC);

-- ─────────────────────────────────────────────────────────
-- Phase 3: Agentic Underwriter Brain
-- ─────────────────────────────────────────────────────────

-- New columns on loans table (safe to run multiple times)
ALTER TABLE loans ADD COLUMN mismo_data         TEXT;     -- raw MISMO XML text (or key JSON fields)
ALTER TABLE loans ADD COLUMN coborrower_email   TEXT;
ALTER TABLE loans ADD COLUMN dti                REAL;     -- debt-to-income ratio (calculated)
ALTER TABLE loans ADD COLUMN ltv                REAL;     -- loan-to-value ratio (calculated)
ALTER TABLE loans ADD COLUMN completeness_score INTEGER DEFAULT 0;  -- 0-100
ALTER TABLE loans ADD COLUMN last_analyzed_at   TEXT;

-- underwriter_assessments: one row per AI assessment run
CREATE TABLE IF NOT EXISTS underwriter_assessments (
  id                 TEXT PRIMARY KEY,
  loan_id            TEXT NOT NULL,
  model              TEXT NOT NULL,                     -- claude-haiku-4-5 | claude-sonnet-4-6
  completeness_score INTEGER,
  recommendation     TEXT,                              -- ready_for_uw | needs_work | major_issues
  summary            TEXT,
  strengths          TEXT,                              -- JSON array
  concerns           TEXT,                              -- JSON array
  missing_items      TEXT,                              -- JSON array of {name,category,priority,reason,action}
  calculations       TEXT,                              -- JSON: {dti, ltv, front_end_ratio, reserves_months}
  next_steps         TEXT,                              -- JSON array
  input_doc_count    INTEGER DEFAULT 0,
  input_tokens       INTEGER DEFAULT 0,
  output_tokens      INTEGER DEFAULT 0,
  created_at         TEXT NOT NULL,
  created_by         TEXT NOT NULL,
  FOREIGN KEY (loan_id)    REFERENCES loans(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- claude_token_log: track every Claude API call for cost visibility
CREATE TABLE IF NOT EXISTS claude_token_log (
  id             TEXT PRIMARY KEY,
  loan_id        TEXT,
  action         TEXT NOT NULL,                         -- underwrite | analyze | doc_analyze | cover_letter | reminder
  model          TEXT NOT NULL,
  input_tokens   INTEGER DEFAULT 0,
  output_tokens  INTEGER DEFAULT 0,
  cost_usd       REAL,                                  -- approximate cost
  created_at     TEXT NOT NULL,
  created_by     TEXT,
  FOREIGN KEY (loan_id)    REFERENCES loans(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_uw_assessments_loan ON underwriter_assessments(loan_id);
CREATE INDEX IF NOT EXISTS idx_uw_assessments_at   ON underwriter_assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_log_loan       ON claude_token_log(loan_id);
CREATE INDEX IF NOT EXISTS idx_token_log_created    ON claude_token_log(created_at DESC);
