-- Migration: Add parent_code to accounts table for sub-account support
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS parent_code TEXT REFERENCES accounts(code) ON DELETE SET NULL;
