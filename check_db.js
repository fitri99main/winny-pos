import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndAddColumns() {
  console.log('Checking columns...');
  
  // We can't directly alter table via anon key if RLS blocks it, but let's try calling a generic RPC or just do a simple select
  const { data, error } = await supabase.from('purchases').select('debit_account, credit_account').limit(1);
  if (error) {
    console.error('Columns might be missing:', error.message);
  } else {
    console.log('Columns exist!');
  }
}

checkAndAddColumns();
