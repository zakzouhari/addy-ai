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
