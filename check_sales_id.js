import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('--- Roles in Database ---');
  const { data: roles, error: rolesError } = await supabase.from('roles').select('*');
  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
  } else {
    console.log(JSON.stringify(roles, null, 2));
  }

  console.log('\n--- Profiles in Database ---');
  const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, name, role, email');
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
  } else {
    console.log(JSON.stringify(profiles, null, 2));
  }
}
check();
