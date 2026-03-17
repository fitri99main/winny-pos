-- Update existing roles to include mandatory_session permission
-- This ensures that users with 'Kasir' or 'Manajer' roles are forced to open/close sessions

UPDATE roles 
SET permissions = permissions || '["mandatory_session"]'::jsonb
WHERE (name ILIKE 'Kasir' OR name ILIKE 'Manajer')
AND NOT (permissions @> '["mandatory_session"]'::jsonb);

-- Verify the update
SELECT name, permissions FROM roles WHERE name ILIKE 'Kasir' OR name ILIKE 'Manajer';
