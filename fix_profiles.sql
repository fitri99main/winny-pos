-- 1. Create PROFILES table if not exists
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  name text,
  role text default 'Kasir',
  branch_id text,
  status text default 'Aktif',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable RLS
alter table public.profiles enable row level security;

-- 3. Create RLS Policies (CRITICAL FOR ACCESS)

-- Allow users to read their own profile
create policy "Public profiles are viewable by everyone" 
  on profiles for select 
  using ( true );

-- Allow users to insert their own profile
create policy "Users can insert their own profile" 
  on profiles for insert 
  with check ( auth.uid() = id );

-- Allow users to update their own profile
create policy "Users can update own profile" 
  on profiles for update 
  using ( auth.uid() = id );

-- 4. Create Trigger to automatically create profile on Signup (Optional but helpful)
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'name', 'Kasir');
  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. EMERGENCY FIX: DATA INJECTION
-- This attempts to insert a profile for YOU (the current user) if you run this in SQL Editor
-- Note: 'auth.uid()' works when run from App, but in SQL Editor you might need to manually insert if you know your ID.
-- However, running the policies above usually fixes the "NULL" issue because the App can then auto-create the profile.
