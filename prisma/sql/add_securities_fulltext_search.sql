-- Phase 9 full-text search patch.
--
-- This repo has no prisma/migrations history (schema changes are applied via
-- `prisma db push`, per the Vercel build command
-- `prisma generate && prisma db push --accept-data-loss && ...`). A generated
-- tsvector column + GIN index isn't something `db push` can express (Prisma
-- has no native tsvector type), so it's applied once via
-- `prisma db execute --file prisma/sql/add_securities_fulltext_search.sql`
-- and then declared to Prisma as an `Unsupported("tsvector")` field on
-- SecuritiesMaster (with `@default(dbgenerated())`, so `db push` doesn't try
-- to strip what it sees as an unmanaged default and fail with "column is a
-- generated column" — Postgres won't let a plain ALTER COLUMN touch a STORED
-- generated column's expression). Kept here (rather than only run ad hoc) so
-- the exact SQL that produced the column is on record.
--
-- Add a generated tsvector column combining name and tickerOrCode.
-- Weighted 'A' for name (higher relevance), 'B' for tickerOrCode, so a
-- query matching the fund/company name ranks above a coincidental
-- substring match in the ticker.
--
-- tickerOrCode is run through regexp_replace first to turn any run of
-- non-alphanumeric characters into a space before tokenizing. Without this,
-- Postgres's default parser keeps a value like "TCS.NS" as one lexeme
-- ('tcs.ns'), so a query for "TCS" would never match — plainto_tsquery
-- requires a whole-lexeme match, not a substring one. Mutual fund scheme
-- codes are plain digits and pass through unaffected either way.
ALTER TABLE "securities_master"
  ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', regexp_replace(coalesce("tickerOrCode", ''), '[^a-zA-Z0-9]+', ' ', 'g')), 'B')
  ) STORED;

CREATE INDEX "securities_master_search_vector_idx"
  ON "securities_master"
  USING GIN ("search_vector");
