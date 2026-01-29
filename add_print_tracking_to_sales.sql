-- Add print tracking columns to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS print_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_printed_at TIMESTAMP WITH TIME ZONE;
