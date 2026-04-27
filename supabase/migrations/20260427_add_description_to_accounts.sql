-- Migration: Add description to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS description TEXT;
