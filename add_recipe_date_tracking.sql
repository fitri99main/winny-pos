-- 1. Tambahkan kolom yang diperlukan di tabel produk dan bahan baku
ALTER TABLE products ADD COLUMN IF NOT EXISTS recipe_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS code TEXT;

-- 2. Create/Update HPP History table with effective_date support
CREATE TABLE IF NOT EXISTS recipe_hpp_history (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id),
    product_name TEXT,
    old_cost NUMERIC DEFAULT 0,
    new_cost NUMERIC DEFAULT 0,
    recipe_snapshot JSONB,
    effective_date DATE DEFAULT CURRENT_DATE,
    changed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure effective_date exists in case table was created previously
ALTER TABLE recipe_hpp_history ADD COLUMN IF NOT EXISTS effective_date DATE DEFAULT CURRENT_DATE;
