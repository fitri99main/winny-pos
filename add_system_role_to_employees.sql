-- Add system_role column to employees table to link with Auth Roles
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS system_role TEXT DEFAULT NULL;

-- Comment for clarity
COMMENT ON COLUMN employees.system_role IS 'Role for System Access (e.g. Admin, Cashier). If set, this employee is allowed to Sign Up as a User.';
