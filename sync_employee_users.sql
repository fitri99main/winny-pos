-- WINNY PORTAL: User-Employee Synchronization Script
-- This script ensures that anyone in auth.users whose email matches an entry in public.employees
-- has a correctly configured entry in the public.profiles table.

-- 1. IDENTIFY & SYNC PROFILES
-- This logic finds users in auth.users who match employees by email
-- and creates or updates their profile with the employee's name and role.
INSERT INTO public.profiles (id, email, name, role, status)
SELECT 
    au.id, 
    au.email, 
    e.name, 
    e.position as role, -- Use position as the default role name
    'Aktif' as status
FROM auth.users au
JOIN public.employees e ON lower(au.email) = lower(e.email)
ON CONFLICT (id) DO UPDATE 
SET 
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    email = EXCLUDED.email;

-- 2. AUDIT QUERY: Find Employees without Login Accounts
-- Run this in SQL Editor to see which employees still need to register
-- or be added to auth.users by an administrator.
/*
SELECT 
    name, 
    email, 
    position, 
    department
FROM public.employees
WHERE lower(email) NOT IN (SELECT lower(email) FROM auth.users)
   OR email IS NULL;
*/

-- 3. AUDIT QUERY: Find Registered Users who are NOT in Employees
-- This helps identify users who might have signed up but aren't mapped to HR data.
/*
SELECT 
    p.name, 
    p.email, 
    p.role
FROM public.profiles p
WHERE lower(p.email) NOT IN (SELECT lower(email) FROM public.employees);
*/
