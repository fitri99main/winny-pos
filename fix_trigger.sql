-- FIX TRIGGER FUNCTION
-- The previous trigger hardcoded 'Kasir'. We need it to read from metadata.

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, name, branch_id, role, status)
  values (
    new.id, 
    new.email, 
    coalesce(new.raw_user_meta_data->>'name', 'New User'),
    coalesce(new.raw_user_meta_data->>'branch_id', 'b1'),
    coalesce(new.raw_user_meta_data->>'role', 'Kasir'), -- CRITICAL FIX: Use metadata role!
    'Aktif'
  );
  return new;
end;
$$ language plpgsql security definer;

-- ENSURE TRIGGER IS LINKED
-- (Re-run toggle just in case)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
