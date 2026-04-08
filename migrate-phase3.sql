-- Phase 3: Agentic Underwriter Brain — new columns + tables
-- Run ONCE after migrate.sql has already been applied

-- New columns on loans table
ALTER TABLE loans ADD COLUMN mismo_data         TEXT;
ALTER TABLE loans ADD COLUMN coborrower_email   TEXT;
ALTER TABLE loans ADD COLUMN dti                REAL;
ALTER TABLE loans ADD COLUMN ltv                REAL;
ALTER TABLE loans ADD COLUMN completeness_score INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN last_analyzed_at   TEXT;

-- underwriter_assessments: one row per AI assessment run
CREATE TABLE IF NOT EXISTS underwriter_assessments (
  id                 TEXT PRIMARY KEY,
  loan_id            TEXT NOT NULL,
  model              TEXT NOT NULL,
  completeness_score INTEGER,
  recommendation     TEXT,
  summary            TEXT,
  strengths          TEXT,
  concerns           TEXT,
  missing_items      TEXT,
  calculations       TEXT,
  next_steps         TEXT,
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
  action         TEXT NOT NULL,
  model          TEXT NOT NULL,
  input_tokens   INTEGER DEFAULT 0,
  output_tokens  INTEGER DEFAULT 0,
  cost_usd       REAL,
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
