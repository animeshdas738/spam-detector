-- Run once against the production database to create the reported_issues table.
-- psql "postgresql://..." -f schema.sql

CREATE SCHEMA IF NOT EXISTS spampishing;

CREATE TABLE IF NOT EXISTS spampishing.reported_issues (
  id                BIGSERIAL    PRIMARY KEY,
  issue_type        VARCHAR(100) NOT NULL,
  description       TEXT         NOT NULL,
  page_url          TEXT,
  user_agent        TEXT,
  browser_language  VARCHAR(20),
  screen_resolution VARCHAR(20),
  viewport_size     VARCHAR(20),
  timezone          VARCHAR(100),
  platform          VARCHAR(100),
  referrer          TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reported_issues_created_at
  ON spampishing.reported_issues (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reported_issues_issue_type
  ON spampishing.reported_issues (issue_type);
