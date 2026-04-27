-- Migration: Add order_index to accounts table for custom ordering
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
